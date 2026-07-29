import { realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import {
  loadPublicationAuthorityContext,
  type AuthorityPaths,
  type PublicationAuthorityContext,
} from "./authority-loader.js";
import type { FreshCandidateRegistration } from "./binding-model.js";
import type { PublishedSnapshot } from "./binding-model.js";
import {
  type CompatiblePublicationDiagnostic,
  type CompatiblePublicationResult,
  type PrepareIncrementalBindingPublicationInput,
  type PrepareIncrementalBindingPublicationReviewInput,
  type PreparedIncrementalBindingPublication,
  type PreparedIncrementalBindingPublicationPreview,
  type PreparedIncrementalBindingPublicationReview,
} from "./compatible-publication-model.js";
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
  type PublishBindingTransactionInput,
  type PublishedBindingTransaction,
} from "./publication-model.js";
import { readPublicationAuthorityFiles } from "./publication-authority-loader.js";
import { loadPublicationImplementationAuthority } from "./publication-implementation-authority.js";
import {
  getPublishedBindingRows,
  getPublishedMetadata,
  getPublishedSnapshotAuthority,
  resolvePublishedReleaseDigest,
  resolvePublishedSnapshotByDigest,
  resolvePublishedSnapshot,
} from "./publication-resolver.js";
import {
  RD03_PUBLICATION_HANDLER_IDS,
  loadPublicationCandidateCatalog,
  loadPublicationCandidatesForHandlerIds,
} from "./publication-candidates.js";
import { computeGenerationDigest, renderGeneratedProjections } from "./projection.js";
import {
  reconstructPublicationReviewRequest,
  validatePublicationReviewEvidence,
} from "./publication-review.js";
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
  allowAlreadyBoundCandidates: boolean,
): PublicationResult<InventoryV1> {
  const declarationById = new Map(
    authority.inventory.handlerDeclarations.map((declaration) => [declaration.id, declaration]),
  );
  const candidatesToValidate = allowAlreadyBoundCandidates
    ? candidates.filter(
        ({ binding }) => declarationById.get(binding.handlerId)?.binding === "unbound",
      )
    : candidates;
  const candidateValidation = validateCandidateBindings(
    authority.inventory.handlerDeclarations,
    candidatesToValidate.map(({ binding }) => binding),
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

async function prepareReleaseAuthority(
  input: PrepareBindingPublicationReviewInput,
  candidateOverride?: readonly FreshCandidateRegistration[],
  promotedHandlerIdOverride?: readonly string[],
): Promise<PublicationResult<PreparedReleaseAuthority>> {
  const root = await validateRepositoryRoot(input.repositoryRoot);
  if (!root.ok) return root;
  const catalog =
    candidateOverride === undefined
      ? await loadPublicationCandidateCatalog(root.value)
      : { ok: true as const, candidates: candidateOverride, diagnostics: [] as const };
  if (!catalog.ok) return authorityFailure(catalog.diagnostics);
  const candidates = normalizedCandidates(catalog.candidates);
  if (!candidates.ok) return candidates;
  const authority = await loadPublicationAuthorityContext(root.value, AUTHORITY_PATHS);
  if (!authority.ok) return authorityFailure(authority.diagnostics);
  const inventory = stageInventory(
    authority.context,
    candidates.value,
    promotedHandlerIdOverride !== undefined,
  );
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

  const ruleModelAuthority = await readPublicationAuthorityFiles(
    root.value,
    [RULE_MODEL_PATH, RULE_MODEL_REVIEW_PATH].sort(),
  );
  if (!ruleModelAuthority.ok) return ruleModelAuthority;
  const ruleModelBytes = ruleModelAuthority.value.get(RULE_MODEL_PATH);
  const ruleModelReviewBytes = ruleModelAuthority.value.get(RULE_MODEL_REVIEW_PATH);
  if (ruleModelBytes === undefined || ruleModelReviewBytes === undefined) {
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
  const promotedHandlerIds = Object.freeze(
    promotedHandlerIdOverride === undefined
      ? bindingRows.map(({ handlerId }) => handlerId)
      : [...promotedHandlerIdOverride],
  );
  const implementationAuthority =
    promotedHandlerIdOverride === undefined
      ? undefined
      : await loadPublicationImplementationAuthority(root.value);
  if (implementationAuthority !== undefined && !implementationAuthority.ok) {
    return implementationAuthority;
  }
  const reconstructed = reconstructPublicationReviewRequest({
    context: authority.context,
    inventory: inventoryRoundTrip.inventory,
    bindingBytes,
    inventoryBytes,
    ruleModelBytes,
    ruleModelReviewBytes,
    promotedHandlerIds,
    publicationImplementationAuthority: implementationAuthority?.value,
  });
  if (!reconstructed.ok) return reconstructed;
  return publicationSuccess(
    Object.freeze({
      request: reconstructed.value.request,
      requestBytes: reconstructed.value.requestBytes,
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

function validateSemanticReview(
  bytes: Uint8Array,
  request: PublicationReviewRequestV1,
  diagnosticProfile: "compatible" | "legacy" = "compatible",
): PublicationResult<Uint8Array> {
  return validatePublicationReviewEvidence(bytes, request, diagnosticProfile);
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

interface IncrementalPublicationAssembly {
  readonly root: string;
  readonly baseSnapshot: PublishedSnapshot;
  readonly basePublicationDigest: Sha256Digest;
  readonly prepared: PreparedReleaseAuthority;
}

interface PreparedIncrementalState {
  readonly root: string;
  readonly basePublicationDigest: Sha256Digest;
  readonly publicationDigest: Sha256Digest;
  readonly acceptedReviewDigest: Sha256Digest;
  readonly targetHandlerIds: readonly string[];
  readonly semanticReviewBytes: Uint8Array;
}

const PREPARED_INCREMENTAL_STATES = new WeakMap<object, PreparedIncrementalState>();
const EMPTY_COMPATIBLE_DIAGNOSTICS: readonly [] = Object.freeze([]);

function compatibleSuccess<T>(value: T): CompatiblePublicationResult<T> {
  return Object.freeze({ ok: true, value, diagnostics: EMPTY_COMPATIBLE_DIAGNOSTICS });
}

function compatibleFailure<T>(
  code: CompatiblePublicationDiagnostic["code"],
  path: string,
  message: string,
  kind: Extract<CompatiblePublicationResult<T>, { readonly ok: false }>["kind"] = "invalid",
): CompatiblePublicationResult<T> {
  return Object.freeze({
    ok: false,
    kind,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}

function compatiblePublicationFailure<T>(
  result: Extract<
    PublicationResult<unknown> | CompatiblePublicationResult<unknown>,
    { readonly ok: false }
  >,
): CompatiblePublicationResult<T> {
  return Object.freeze({
    ok: false,
    kind: result.kind,
    diagnostics: result.diagnostics,
  });
}

function exactIncrementalTargets(value: readonly string[]): boolean {
  try {
    return (
      Array.isArray(value) &&
      value.length === RD03_PUBLICATION_HANDLER_IDS.length &&
      value.every((handlerId, index) => handlerId === RD03_PUBLICATION_HANDLER_IDS[index])
    );
  } catch {
    return false;
  }
}

function equalBindingRows(
  left: readonly PublicationBindingRow[],
  right: readonly PublicationBindingRow[],
): boolean {
  return (
    left.length === right.length &&
    left.every((row, index) => {
      const candidate = right[index];
      return (
        candidate !== undefined &&
        row.handlerId === candidate.handlerId &&
        row.kind === candidate.kind &&
        row.contractVersion === candidate.contractVersion &&
        row.implementationRevision === candidate.implementationRevision
      );
    })
  );
}

async function assembleIncrementalPublication(
  input: PrepareIncrementalBindingPublicationReviewInput,
): Promise<CompatiblePublicationResult<IncrementalPublicationAssembly>> {
  const root = await validateRepositoryRoot(input.repositoryRoot);
  if (!root.ok) return compatiblePublicationFailure(root);
  if (!exactIncrementalTargets(input.targetHandlerIds)) {
    return compatibleFailure(
      "publication.targets.invalid",
      "/targetHandlerIds",
      "Incremental publication requires the exact lexical five-handler target set.",
    );
  }
  const baseAuthority = getPublishedSnapshotAuthority(input.baseSnapshot);
  if (baseAuthority === undefined || baseAuthority.repositoryRoot !== root.value) {
    return compatibleFailure(
      "publication.base.invalid",
      "/baseSnapshot",
      "Incremental publication requires a genuine snapshot from the same repository.",
    );
  }
  const currentBase = await resolvePublishedSnapshotByDigest({
    repositoryRoot: root.value,
    publicationDigest: baseAuthority.publicationDigest,
  });
  if (!currentBase.ok) {
    return compatibleFailure(
      "publication.base.invalid",
      "/baseSnapshot",
      "Incremental publication base is absent or no longer authentic.",
    );
  }
  const currentBaseRows = getPublishedBindingRows(currentBase.value);
  const suppliedBaseRows = getPublishedBindingRows(input.baseSnapshot);
  if (
    currentBaseRows === undefined ||
    suppliedBaseRows === undefined ||
    !equalBindingRows(currentBaseRows, suppliedBaseRows)
  ) {
    return compatibleFailure(
      "publication.base.invalid",
      "/baseSnapshot",
      "Incremental publication base metadata does not match its immutable release.",
    );
  }
  const targetCatalog = await loadPublicationCandidatesForHandlerIds({
    repositoryRoot: root.value,
    handlerIds: input.targetHandlerIds,
  });
  if (!targetCatalog.ok) {
    return compatibleFailure(
      "publication.targets.invalid",
      "/targetHandlerIds",
      targetCatalog.diagnostics[0]?.message ?? "Target candidates could not be reconstructed.",
    );
  }
  const refreshedBase = getPublishedSnapshotAuthority(currentBase.value);
  if (refreshedBase === undefined) {
    return compatibleFailure(
      "publication.base.invalid",
      "/baseSnapshot",
      "Resolved base authority is unavailable.",
    );
  }
  const combined = Object.freeze([...refreshedBase.candidates, ...targetCatalog.candidates]);
  const prepared = await prepareReleaseAuthority(
    { repositoryRoot: root.value },
    combined,
    input.targetHandlerIds,
  );
  if (!prepared.ok) return compatiblePublicationFailure(prepared);
  return compatibleSuccess(
    Object.freeze({
      root: root.value,
      baseSnapshot: currentBase.value,
      basePublicationDigest: baseAuthority.publicationDigest,
      prepared: prepared.value,
    }),
  );
}

/**
 * Reconstructs the exact incremental semantic-review request without issuing commit authority.
 *
 * @param input Genuine named base and exact five-handler target set.
 * @returns Deeply immutable request and defensive canonical bytes.
 *
 * @example
 * ```ts
 * const review = await prepareIncrementalBindingPublicationReview(input);
 * ```
 */
export async function prepareIncrementalBindingPublicationReview(
  input: PrepareIncrementalBindingPublicationReviewInput,
): Promise<CompatiblePublicationResult<PreparedIncrementalBindingPublicationReview>> {
  const assembly = await assembleIncrementalPublication(input);
  if (!assembly.ok) return assembly;
  return compatibleSuccess(
    Object.freeze({
      request: assembly.value.prepared.request,
      requestBytes: Uint8Array.prototype.slice.call(
        assembly.value.prepared.requestBytes,
      ) as Uint8Array,
    }),
  );
}

/**
 * Validates independent review and stages one immutable nine-binding release.
 *
 * @param input Genuine base, exact target set and current semantic-review evidence.
 * @returns Readable staged evidence and opaque future commit authority.
 *
 * @example
 * ```ts
 * const preview = await prepareIncrementalBindingPublication(input);
 * ```
 */
export async function prepareIncrementalBindingPublication(
  input: PrepareIncrementalBindingPublicationInput,
): Promise<CompatiblePublicationResult<PreparedIncrementalBindingPublicationPreview>> {
  const assembly = await assembleIncrementalPublication(input);
  if (!assembly.ok) return assembly;
  const review = validateSemanticReview(input.semanticReviewBytes, assembly.value.prepared.request);
  if (!review.ok) {
    const first = review.diagnostics[0];
    return compatibleFailure(
      first?.code ?? "publication.review.invalid",
      "semantic-review-v1.json",
      first?.message ?? "Semantic review evidence was rejected.",
    );
  }
  const release = buildRelease(assembly.value.prepared, review.value);
  if (!release.ok) return compatiblePublicationFailure(release);
  const promoted = await promotePublicationRelease(assembly.value.root, release.value);
  if (!promoted.ok) return compatiblePublicationFailure(promoted);
  const staged = await resolvePublishedReleaseDigest(
    assembly.value.root,
    release.value.publicationDigest,
  );
  if (!staged.ok) return compatiblePublicationFailure(staged);
  const prepared = Object.freeze({}) as PreparedIncrementalBindingPublication;
  const acceptedReviewDigest = digestPublicationBytes(review.value);
  PREPARED_INCREMENTAL_STATES.set(
    prepared,
    Object.freeze({
      root: assembly.value.root,
      basePublicationDigest: assembly.value.basePublicationDigest,
      publicationDigest: release.value.publicationDigest,
      acceptedReviewDigest,
      targetHandlerIds: Object.freeze([...input.targetHandlerIds]),
      semanticReviewBytes: Uint8Array.prototype.slice.call(review.value) as Uint8Array,
    }),
  );
  return compatibleSuccess(
    Object.freeze({
      prepared,
      basePublicationDigest: assembly.value.basePublicationDigest,
      publicationDigest: release.value.publicationDigest,
      acceptedReviewDigest,
      promotedHandlerIds: Object.freeze([...input.targetHandlerIds]),
      stagedSnapshot: staged.value,
    }),
  );
}

/**
 * Selects one previously issued incremental publication after complete authority revalidation.
 *
 * @param prepared Opaque staging capability.
 * @returns Selected transaction result or a closed compatibility failure.
 *
 * @example
 * ```ts
 * const selected = await publishIncrementalBindingPublication(preview.prepared);
 * ```
 */
export async function publishIncrementalBindingPublication(
  prepared: PreparedIncrementalBindingPublication,
): Promise<CompatiblePublicationResult<PublishedBindingTransaction>> {
  const state =
    typeof prepared === "object" && prepared !== null
      ? PREPARED_INCREMENTAL_STATES.get(prepared)
      : undefined;
  if (state === undefined) {
    return compatibleFailure(
      "publication.capability.invalid",
      "/prepared",
      "Incremental publication capability was not issued by this process.",
    );
  }
  PREPARED_INCREMENTAL_STATES.delete(prepared);
  let lock: Awaited<ReturnType<typeof acquireGenerationLock>>;
  try {
    lock = await acquireGenerationLock(join(state.root, GENERATION_LOCK_PATH));
  } catch {
    return compatibleFailure(
      "publication.io",
      GENERATION_LOCK_PATH,
      "Publication generation lock could not be acquired safely.",
      "io",
    );
  }
  if (lock === undefined) {
    return compatibleFailure(
      "publication.lock.contended",
      GENERATION_LOCK_PATH,
      "Another live publisher owns the readiness generation lock.",
      "contended",
    );
  }
  try {
    const selectedBase = await resolvePublishedSnapshot({ repositoryRoot: state.root });
    if (!selectedBase.ok) return compatiblePublicationFailure(selectedBase);
    const selectedMetadata = getPublishedMetadata(selectedBase.value);
    if (selectedMetadata?.publicationDigest !== state.basePublicationDigest) {
      return compatibleFailure(
        "publication.base.stale",
        "/baseSnapshot/publicationDigest",
        "Selected publication changed after incremental staging.",
        "stale",
      );
    }
    const rebuilt = await assembleIncrementalPublication({
      repositoryRoot: state.root,
      baseSnapshot: selectedBase.value,
      targetHandlerIds: state.targetHandlerIds,
    });
    if (!rebuilt.ok) return rebuilt;
    const review = validateSemanticReview(
      state.semanticReviewBytes,
      rebuilt.value.prepared.request,
    );
    if (!review.ok || digestPublicationBytes(review.value) !== state.acceptedReviewDigest) {
      return compatibleFailure(
        "publication.review.stale",
        "semantic-review-v1.json",
        "Accepted review no longer matches current publication authority.",
        "stale",
      );
    }
    const release = buildRelease(rebuilt.value.prepared, review.value);
    if (!release.ok) return compatiblePublicationFailure(release);
    if (release.value.publicationDigest !== state.publicationDigest) {
      return compatibleFailure(
        "publication.snapshot.invalid",
        "/prepared",
        "Rebuilt staged release does not match the issued capability.",
      );
    }
    const promoted = await promotePublicationRelease(state.root, release.value);
    if (!promoted.ok) return compatiblePublicationFailure(promoted);
    const committed = await commitPublicationPointer(state.root, release.value);
    if (!committed.ok) return compatiblePublicationFailure(committed);
    const selected = await resolvePublishedSnapshotByDigest({
      repositoryRoot: state.root,
      publicationDigest: release.value.publicationDigest,
    });
    if (!selected.ok) return compatiblePublicationFailure(selected);
    const exactMetadata = getPublishedMetadata(selected.value);
    if (exactMetadata?.publicationDigest !== release.value.publicationDigest) {
      return compatibleFailure(
        "publication.snapshot.invalid",
        "/publicationDigest",
        "Committed publication did not resolve to the exact staged snapshot.",
      );
    }
    return compatibleSuccess(
      Object.freeze({
        publicationDigest: release.value.publicationDigest,
        snapshot: selected.value,
        reusedExistingRelease: promoted.value.reusedExistingRelease,
      }),
    );
  } finally {
    await lock.release();
  }
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
    const review = validateSemanticReview(
      input.semanticReviewBytes,
      prepared.value.request,
      "legacy",
    );
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
