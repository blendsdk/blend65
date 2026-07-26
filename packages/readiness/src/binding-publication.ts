import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import {
  loadPublicationAuthorityContext,
  parseSemanticReviewEvidence,
  type AuthorityPaths,
  type PublicationAuthorityContext,
} from "./authority-loader.js";
import type { FreshCandidateRegistration } from "./binding-model.js";
import {
  isFreshCandidateRegistration,
  validateCandidateBindings,
  validatePublishedBindings,
} from "./binding-validator.js";
import {
  currentPublicationConformance,
  publicationFaultPoint,
} from "./publication-conformance-v1.js";
import { acquireGenerationLock } from "./generation-lock.js";
import type { HandlerDeclaration, InventoryV1 } from "./model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { commitPublicationPointer, promotePublicationRelease } from "./publication-pointer.js";
import {
  PUBLICATION_MEMBER_PATHS,
  PUBLICATION_ROOT_PATH,
  PUBLICATION_V1_LIMITS,
  createPreparedPublicationReview,
  digestPublicationBytes,
  inspectPublicationLimits,
  parsePublicationJson,
  publicationDigestPreimage,
  publicationFailure,
  publicationSuccess,
  renderPublicationBindings,
  renderPublicationJson,
  renderPublicationManifest,
  type PrepareBindingPublicationReviewInput,
  type PreparedBindingPublicationReview,
  type PublicationBindingRow,
  type PublicationManifestMember,
  type PublicationManifestV1,
  type PublicationRelease,
  type PublicationResult,
  type PublicationReviewRequestV1,
  type PublicationReviewUnitV1,
  type PublishBindingTransactionInput,
  type PublishedBindingTransaction,
} from "./publication-model.js";
import {
  getPublishedMetadata,
  resolvePublishedReleaseDigest,
  resolvePublishedSnapshot,
} from "./publication-resolver.js";
import { loadPublicationCandidateCatalog } from "./publication-candidates.js";
import { computeGenerationDigest, renderGeneratedProjections } from "./projection.js";
import { computeInventoryReviewDigests, INVENTORY_REVIEW_UNIT_IDS } from "./review-digests.js";
import { validateReviewEvidence, type SemanticReviewRecord } from "./review-evidence.js";
import { parseRuleModelRegistry } from "./rule-model-input.js";
import { readInventoryVersioned } from "./versioning.js";

const AUTHORITY_PATHS: AuthorityPaths = Object.freeze({
  inventory: "readiness/inventory/compiler-readiness-v1.json",
  identityLedger: "readiness/inventory/rule-identities-v1.jsonl",
  reviewEvidence: "readiness/reviews/compiler-readiness-v1-review.json",
});
const RULE_MODEL_PATH = "readiness/rule-models/rule-models-v1.json";
const RULE_MODEL_REVIEW_PATH = "readiness/reviews/rule-models-v1-review.json";
const GENERATION_LOCK_PATH = "readiness/generated/.generation-lock";
const PUBLICATION_BINDINGS_UNIT = "publication-bindings";
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

/** Fixed independently authored semantic-review input consumed by the publish CLI. */
export const PUBLICATION_SEMANTIC_REVIEW_SOURCE_PATH = "readiness/reviews/semantic-review-v1.json";

interface PreparedReleaseAuthority {
  readonly request: PublicationReviewRequestV1;
  readonly requestBytes: Uint8Array;
  readonly inventory: InventoryV1;
  readonly inventoryBytes: Uint8Array;
  readonly bindingRows: readonly PublicationBindingRow[];
  readonly bindingBytes: Uint8Array;
  readonly ruleModelBytes: Uint8Array;
  readonly ruleModelReviewBytes: Uint8Array;
  readonly declarationsBytes: Uint8Array;
  readonly markdownBytes: Uint8Array;
  readonly candidates: readonly FreshCandidateRegistration[];
}

function digest(domain: string, bytes: Uint8Array): Sha256Digest {
  return currentPublicationConformance()?.digest?.(domain, bytes) ?? digestPublicationBytes(bytes);
}

function reviewSemanticDigest(
  specRevision: string,
  dependencyDigests: PublicationReviewRequestV1["dependencyDigests"],
  promotedHandlerIds: readonly string[],
  inventoryUnits: readonly PublicationReviewUnitV1[],
): Sha256Digest {
  const bytes = renderPublicationJson({
    schemaVersion: 1,
    specRevision,
    dependencyDigests,
    promotedHandlerIds,
    reviewUnits: inventoryUnits,
  });
  return `sha256:${createHash("sha256")
    .update("blend65.publication-review.v1")
    .update(Uint8Array.of(0))
    .update(bytes)
    .digest("hex")}`;
}

function isDigest(value: string | undefined): value is Sha256Digest {
  return value !== undefined && SHA256_PATTERN.test(value);
}

async function validateRepositoryRoot(repositoryRoot: string): Promise<PublicationResult<string>> {
  if (!isAbsolute(repositoryRoot) || resolve(repositoryRoot) !== repositoryRoot) {
    return publicationFailure(
      "invalid",
      "publication.path.invalid",
      "/repositoryRoot",
      "Repository root must be a canonical absolute path.",
    );
  }
  try {
    if ((await realpath(repositoryRoot)) !== repositoryRoot) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        "/repositoryRoot",
        "Repository root must not traverse a symbolic link.",
      );
    }
    return publicationSuccess(repositoryRoot);
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      "/repositoryRoot",
      "Repository root could not be resolved.",
    );
  }
}

function authorityFailure<T>(
  diagnostics: readonly { readonly path: string; readonly message: string }[],
): PublicationResult<T> {
  const first = diagnostics[0];
  return publicationFailure(
    "invalid",
    "publication.input.invalid",
    first?.path ?? AUTHORITY_PATHS.inventory,
    first?.message ?? "Loose publication authority is invalid.",
  );
}

function normalizedCandidates(
  input: readonly FreshCandidateRegistration[],
): PublicationResult<readonly FreshCandidateRegistration[]> {
  if (
    !Array.isArray(input) ||
    input.length === 0 ||
    input.length > PUBLICATION_V1_LIMITS.maxBindings
  ) {
    return publicationFailure(
      "invalid",
      input.length > PUBLICATION_V1_LIMITS.maxBindings
        ? "publication.input.limit"
        : "publication.input.invalid",
      "/candidates",
      "Publication candidates must be a non-empty bounded array.",
    );
  }
  const candidates = [...input];
  for (let index = 0; index < candidates.length; index += 1) {
    if (!isFreshCandidateRegistration(candidates[index])) {
      return publicationFailure(
        "invalid",
        "publication.binding.invalid",
        `/candidates/${index}`,
        "Publication candidate was not produced by freshness-gated registration.",
      );
    }
  }
  candidates.sort((left, right) => left.binding.handlerId.localeCompare(right.binding.handlerId));
  if (
    candidates.some(
      (candidate, index) =>
        index > 0 && candidate.binding.handlerId === candidates[index - 1]?.binding.handlerId,
    )
  ) {
    return publicationFailure(
      "invalid",
      "publication.binding.invalid",
      "/candidates",
      "Publication candidates must be unique by handler identity.",
    );
  }
  return publicationSuccess(Object.freeze(candidates));
}

function stageInventory(
  authority: PublicationAuthorityContext,
  candidates: readonly FreshCandidateRegistration[],
): PublicationResult<InventoryV1> {
  const candidateValidation = validateCandidateBindings(
    authority.inventory.handlerDeclarations,
    candidates.map(({ binding }) => binding),
  );
  if (!candidateValidation.ok) {
    const first = candidateValidation.diagnostics[0];
    return publicationFailure(
      "invalid",
      "publication.binding.invalid",
      first?.path ?? "/candidates",
      first?.message ?? "Candidate binding validation failed.",
    );
  }
  const promoted = new Set(candidates.map(({ binding }) => binding.handlerId));
  const declarations: HandlerDeclaration[] = authority.inventory.handlerDeclarations.map(
    (declaration) =>
      promoted.has(declaration.id)
        ? Object.freeze({ ...declaration, binding: "bound" as const })
        : declaration,
  );
  if (declarations.filter(({ binding }) => binding === "bound").length !== candidates.length) {
    return publicationFailure(
      "invalid",
      "publication.binding.invalid",
      "/candidates",
      "Every candidate must promote exactly one currently unbound declaration.",
    );
  }
  const inventory = {
    ...authority.inventory,
    handlerDeclarations: Object.freeze(declarations),
  } satisfies InventoryV1;
  const published = validatePublishedBindings(
    inventory.handlerDeclarations,
    candidates.map(({ binding }) => binding),
  );
  if (!published.ok) {
    const first = published.diagnostics[0];
    return publicationFailure(
      "invalid",
      "publication.binding.invalid",
      first?.path ?? "/bindings",
      first?.message ?? "Staged published binding validation failed.",
    );
  }
  return publicationSuccess(Object.freeze(inventory));
}

function inventoryReviewUnits(
  context: PublicationAuthorityContext,
  stagedInventory: InventoryV1,
): PublicationResult<readonly PublicationReviewUnitV1[]> {
  const digests = computeInventoryReviewDigests(
    stagedInventory,
    context.fragments,
    context.identityLedgerBytes,
  );
  const units: PublicationReviewUnitV1[] = [];
  for (const unitId of [...INVENTORY_REVIEW_UNIT_IDS].sort()) {
    const semanticDigest = digests.currentDigests[unitId];
    const dependencies = digests.requiredDependencyIdsByUnit[unitId];
    if (!isDigest(semanticDigest) || dependencies === undefined) {
      return publicationFailure(
        "invalid",
        "publication.input.invalid",
        `/reviewUnits/${unitId}`,
        "Staged inventory review digests are incomplete.",
      );
    }
    const dependencyDigests: Record<string, Sha256Digest> = {};
    for (const dependency of [...dependencies].sort()) {
      const dependencyDigest = digests.currentDigests[dependency];
      if (!isDigest(dependencyDigest)) {
        return publicationFailure(
          "invalid",
          "publication.input.invalid",
          `/reviewUnits/${unitId}/dependencyDigests/${dependency}`,
          "Staged inventory dependency digest is incomplete.",
        );
      }
      dependencyDigests[dependency] = dependencyDigest;
    }
    units.push(
      Object.freeze({
        unitId,
        semanticDigest,
        dependencyDigests: Object.freeze(dependencyDigests),
      }),
    );
  }
  return publicationSuccess(Object.freeze(units));
}

async function prepareReleaseAuthority(
  input: PrepareBindingPublicationReviewInput,
): Promise<PublicationResult<PreparedReleaseAuthority>> {
  const root = await validateRepositoryRoot(input.repositoryRoot);
  if (!root.ok) return root;
  const catalog = await loadPublicationCandidateCatalog(root.value);
  if (!catalog.ok) return authorityFailure(catalog.diagnostics);
  const candidates = normalizedCandidates(catalog.candidates);
  if (!candidates.ok) return candidates;
  const authority = await loadPublicationAuthorityContext(root.value, AUTHORITY_PATHS);
  if (!authority.ok) return authorityFailure(authority.diagnostics);
  const inventory = stageInventory(authority.context, candidates.value);
  if (!inventory.ok) return inventory;
  const inventoryBytes = renderPublicationJson(inventory.value);
  const inventoryRoundTrip = readInventoryVersioned(inventoryBytes);
  if (!inventoryRoundTrip.ok || inventoryRoundTrip.inventory === undefined) {
    return authorityFailure(inventoryRoundTrip.diagnostics);
  }
  const projections = renderGeneratedProjections(inventoryRoundTrip.inventory);
  if (!projections.ok || projections.outputs === undefined) {
    return authorityFailure(projections.diagnostics);
  }

  let ruleModelBytes: Uint8Array;
  let ruleModelReviewBytes: Uint8Array;
  try {
    ruleModelBytes = await readFile(join(root.value, RULE_MODEL_PATH));
    ruleModelReviewBytes = await readFile(join(root.value, RULE_MODEL_REVIEW_PATH));
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      RULE_MODEL_PATH,
      "Rule-model publication authority could not be read.",
    );
  }
  if (!parseRuleModelRegistry(ruleModelBytes).ok) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      RULE_MODEL_PATH,
      "Rule-model publication authority is invalid.",
    );
  }
  const ruleModelReview = parsePublicationJson(ruleModelReviewBytes);
  if (!ruleModelReview.ok) return ruleModelReview;

  const bindingRows: PublicationBindingRow[] = candidates.value.map(({ binding }) =>
    Object.freeze({
      handlerId: binding.handlerId,
      kind: binding.kind,
      contractVersion: binding.contractVersion,
      implementationRevision: binding.implementationRevision,
    }),
  );
  const bindingBytes = renderPublicationBindings(bindingRows);
  const dependencyDigests = Object.freeze({
    bindings: digest("publication-member:bindings-v1.json", bindingBytes),
    inventory: digest("publication-member:compiler-readiness-v1.json", inventoryBytes),
    "rule-model": digest("publication-member:rule-models-v1.json", ruleModelBytes),
    "rule-model-review": digest(
      "publication-member:rule-models-v1-review.json",
      ruleModelReviewBytes,
    ),
  });
  const units = inventoryReviewUnits(authority.context, inventoryRoundTrip.inventory);
  if (!units.ok) return units;
  const promotedHandlerIds = Object.freeze(bindingRows.map(({ handlerId }) => handlerId));
  const semanticDigest = reviewSemanticDigest(
    inventory.value.specRevision,
    dependencyDigests,
    promotedHandlerIds,
    units.value,
  );
  const reviewUnits = Object.freeze(
    [
      ...units.value,
      Object.freeze({
        unitId: PUBLICATION_BINDINGS_UNIT,
        semanticDigest,
        dependencyDigests,
      }),
    ].sort((left, right) => left.unitId.localeCompare(right.unitId)),
  );
  const request: PublicationReviewRequestV1 = Object.freeze({
    schemaVersion: 1,
    semanticDigest,
    specRevision: inventory.value.specRevision,
    dependencyDigests,
    promotedHandlerIds,
    reviewUnits,
  });
  return publicationSuccess(
    Object.freeze({
      request,
      requestBytes: renderPublicationJson(request),
      inventory: inventoryRoundTrip.inventory,
      inventoryBytes,
      bindingRows: Object.freeze(bindingRows),
      bindingBytes,
      ruleModelBytes,
      ruleModelReviewBytes,
      declarationsBytes: projections.outputs.declarations,
      markdownBytes: projections.outputs.markdown,
      candidates: candidates.value,
    }),
  );
}

function renderSemanticReview(records: readonly SemanticReviewRecord[]): Uint8Array {
  return renderPublicationJson({
    schemaVersion: 1,
    reviews: records.map((record) => ({
      unitId: record.unitId,
      reviewer: record.reviewer,
      specRevision: record.specRevision,
      semanticDigest: record.semanticDigest,
      dependencyDigests: Object.fromEntries(
        Object.entries(record.dependencyDigests).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      outcome: record.outcome,
      resolvedDisagreementIds: record.resolvedDisagreementIds,
    })),
  });
}

function validateSemanticReview(
  bytes: Uint8Array,
  request: PublicationReviewRequestV1,
): PublicationResult<Uint8Array> {
  if (bytes.byteLength > PUBLICATION_V1_LIMITS.maxSemanticReviewBytes) {
    return publicationFailure(
      "invalid",
      "publication.input.limit",
      "semantic-review-v1.json",
      "Semantic review evidence exceeds the version-one byte limit.",
    );
  }
  const strict = parsePublicationJson(bytes);
  if (!strict.ok) {
    return publicationFailure(
      "invalid",
      "publication.review.invalid",
      "semantic-review-v1.json",
      strict.diagnostics[0]?.message ?? "Semantic review evidence is invalid.",
    );
  }
  const records = parseSemanticReviewEvidence(bytes);
  if (records === undefined) {
    return publicationFailure(
      "invalid",
      "publication.review.invalid",
      "semantic-review-v1.json",
      "Semantic review evidence does not satisfy its closed schema.",
    );
  }
  const sorted = [...records].sort((left, right) => left.unitId.localeCompare(right.unitId));
  const requiredDependencyIdsByUnit: Record<string, readonly string[]> = {};
  const currentDigests: Record<string, string> = {};
  for (const unit of request.reviewUnits) {
    requiredDependencyIdsByUnit[unit.unitId] = Object.keys(unit.dependencyDigests).sort();
    currentDigests[unit.unitId] = unit.semanticDigest;
    Object.assign(currentDigests, unit.dependencyDigests);
  }
  const evidence = validateReviewEvidence(sorted, {
    expectedSpecRevision: request.specRevision,
    requiredUnitIds: request.reviewUnits.map(({ unitId }) => unitId),
    requiredDependencyIdsByUnit,
    currentDigests,
  });
  if (!evidence.ok) {
    const first = evidence.diagnostics[0];
    const code =
      first?.code === "review.not-accepted"
        ? "publication.review.not-accepted"
        : first?.code.includes("stale") === true
          ? "publication.review.stale"
          : "publication.review.invalid";
    return publicationFailure(
      "invalid",
      code,
      first?.path ?? "semantic-review-v1.json",
      first?.message ?? "Semantic review evidence does not match the staged request.",
    );
  }
  return publicationSuccess(renderSemanticReview(sorted));
}

function buildRelease(
  prepared: PreparedReleaseAuthority,
  semanticReviewBytes: Uint8Array,
): PublicationResult<PublicationRelease> {
  const members = new Map<(typeof PUBLICATION_MEMBER_PATHS)[number], Uint8Array>([
    ["bindings-v1.json", prepared.bindingBytes],
    ["compiler-readiness-v1.json", prepared.inventoryBytes],
    ["compiler-readiness.md", prepared.markdownBytes],
    ["declarations.ts", prepared.declarationsBytes],
    ["rule-models-v1-review.json", prepared.ruleModelReviewBytes],
    ["rule-models-v1.json", prepared.ruleModelBytes],
    ["semantic-review-v1.json", semanticReviewBytes],
  ]);
  const manifestMembers: PublicationManifestMember[] = PUBLICATION_MEMBER_PATHS.map((path) => {
    const bytes = members.get(path);
    if (bytes === undefined) throw new Error(`Missing staged publication member: ${path}`);
    return Object.freeze({
      path,
      byteLength: bytes.byteLength,
      digest: digest(`publication-member:${path}`, bytes),
    });
  });
  const manifest: PublicationManifestV1 = Object.freeze({
    schemaVersion: 1,
    inventoryGenerationDigest: computeGenerationDigest(prepared.inventory),
    members: Object.freeze(manifestMembers),
  });
  const manifestBytes = renderPublicationManifest(manifest);
  const totalReleaseBytes = manifestMembers.reduce((total, member) => total + member.byteLength, 0);
  const limits = inspectPublicationLimits({
    pointerBytes: renderPublicationJson({
      schemaVersion: 1,
      publicationDigest: `sha256:${"0".repeat(64)}`,
    }).byteLength,
    manifestBytes: manifestBytes.byteLength,
    bindingBytes: prepared.bindingBytes.byteLength,
    semanticReviewBytes: semanticReviewBytes.byteLength,
    memberCount: manifestMembers.length,
    memberBytes: Math.max(...manifestMembers.map(({ byteLength }) => byteLength)),
    totalReleaseBytes,
  });
  if (!limits.ok) return limits;
  const publicationDigest = digest("blend65-publication-v1", publicationDigestPreimage(manifest));
  return publicationSuccess(
    Object.freeze({
      inventory: prepared.inventory,
      inventoryGenerationDigest: manifest.inventoryGenerationDigest,
      bindings: prepared.bindingRows,
      members,
      manifest,
      manifestBytes,
      publicationDigest,
    }),
  );
}

/**
 * Computes a complete read-only digest request for independent publication review.
 *
 * @param input Canonical repository root used to reconstruct package-owned callable authority.
 * @returns Prepared capability, closed request and exact canonical request bytes.
 */
export async function prepareBindingPublicationReview(
  input: PrepareBindingPublicationReviewInput,
): Promise<PublicationResult<PreparedBindingPublicationReview>> {
  const prepared = await prepareReleaseAuthority(input);
  if (!prepared.ok) return prepared;
  return publicationSuccess(
    Object.freeze({
      review: createPreparedPublicationReview(),
      request: prepared.value.request,
      requestBytes: prepared.value.requestBytes,
    }),
  );
}

/**
 * Builds, accepts and atomically selects one complete binding publication.
 *
 * @param input Canonical repository root and independent review evidence.
 * @returns Selected snapshot and publication digest, or a typed pre-commit failure.
 */
export async function publishBindingTransaction(
  input: PublishBindingTransactionInput,
): Promise<PublicationResult<PublishedBindingTransaction>> {
  const root = await validateRepositoryRoot(input.repositoryRoot);
  if (!root.ok) return root;
  let lock: Awaited<ReturnType<typeof acquireGenerationLock>>;
  try {
    lock = await acquireGenerationLock(join(root.value, GENERATION_LOCK_PATH));
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      GENERATION_LOCK_PATH,
      "Publication generation lock could not be acquired safely.",
    );
  }
  if (lock === undefined) {
    return publicationFailure(
      "contended",
      "publication.lock.contended",
      GENERATION_LOCK_PATH,
      "Another live publisher owns the readiness generation lock.",
    );
  }
  try {
    if (currentPublicationConformance()?.forceDurabilityUnsupported === true) {
      return publicationFailure(
        "durability-unsupported",
        "publication.durability-unsupported",
        PUBLICATION_ROOT_PATH,
        "Durable publication is unavailable for this operation.",
      );
    }
    const prepared = await prepareReleaseAuthority({
      repositoryRoot: root.value,
    });
    if (!prepared.ok) return prepared;
    const review = validateSemanticReview(input.semanticReviewBytes, prepared.value.request);
    if (!review.ok) return review;
    const release = buildRelease(prepared.value, review.value);
    if (!release.ok) return release;
    const promoted = await promotePublicationRelease(root.value, release.value);
    if (!promoted.ok) return promoted;

    await publicationFaultPoint("before-staged-validation", {
      publicationDigest: release.value.publicationDigest,
    });
    if (currentPublicationConformance()?.forceStagedValidationFailure === true) {
      return publicationFailure(
        "acceptance-failed",
        "publication.acceptance.failed",
        promoted.value.releaseRoot,
        "Package-owned staged invariant validation was forced to fail.",
      );
    }
    const accepted = await resolvePublishedReleaseDigest(
      root.value,
      release.value.publicationDigest,
      prepared.value.candidates,
    );
    if (!accepted.ok) {
      return publicationFailure(
        "acceptance-failed",
        "publication.acceptance.failed",
        promoted.value.releaseRoot,
        accepted.diagnostics[0]?.message ?? "Staged release invariant validation failed.",
      );
    }
    await publicationFaultPoint("after-staged-validation", {
      publicationDigest: release.value.publicationDigest,
    });

    const committed = await commitPublicationPointer(root.value, release.value);
    if (!committed.ok) return committed;
    const selected = await resolvePublishedSnapshot({
      repositoryRoot: root.value,
    });
    if (!selected.ok) return selected;
    const metadata = getPublishedMetadata(selected.value);
    if (metadata?.publicationDigest !== release.value.publicationDigest) {
      return publicationFailure(
        "io",
        "publication.digest.mismatch",
        PUBLICATION_ROOT_PATH,
        "Selected snapshot does not match the committed publication.",
      );
    }
    return publicationSuccess(
      Object.freeze({
        publicationDigest: release.value.publicationDigest,
        snapshot: selected.value,
        reusedExistingRelease: promoted.value.reusedExistingRelease,
      }),
    );
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      PUBLICATION_ROOT_PATH,
      "Publication transaction failed safely.",
    );
  } finally {
    await lock.release();
  }
}
