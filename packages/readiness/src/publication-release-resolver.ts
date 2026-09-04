import { join } from "node:path";

import { loadPublicationAuthorityContext, type AuthorityPaths } from "./authority-loader.js";
import { isFreshCandidateRegistration, validatePublishedBindings } from "./binding-validator.js";
import type {
  ExecutableBinding,
  FreshCandidateRegistration,
  PublishedSnapshot,
  ValidatedBindingRegistry,
} from "./binding-model.js";
import type { CampaignRendererBindingV1 } from "./campaign-model.js";
import { COMPATIBLE_PUBLICATION_AUTHORITY_REVISION } from "./publication-authority-revision.generated.js";
import { readPublicationAuthorityFiles } from "./publication-authority-loader.js";
import {
  PUBLICATION_V1_HANDLER_IDS,
  RD03_PUBLICATION_HANDLER_IDS,
  loadPublicationCandidatesForHandlerIds,
  publicationCandidateDependencyPaths,
  publicationCandidatesFromAuthority,
} from "./publication-candidates.js";
import { publicationImplementationAuthorityFromBytes } from "./publication-implementation-authority.js";
import {
  PUBLICATION_RELEASES_PATH,
  PUBLICATION_V1_LIMITS,
  digestPublicationBytes,
  parsePublicationBindings,
  parsePublicationJson,
  parsePublicationManifest,
  publicationDigestPreimage,
  publicationFailure,
  publicationSuccess,
  renderPublicationBindings,
  renderPublicationManifest,
  type PublicationResult,
} from "./publication-model.js";
import {
  reconstructPublicationReviewRequest,
  validatePublicationReviewEvidence,
} from "./publication-review.js";
import {
  canonicalPublicationRepositoryRoot,
  deepFreezePublicationValue,
  digestPublicationAuthority,
  equalPublicationBytes,
  pinPublicationDirectoryChain,
  readPinnedPublicationFile,
} from "./publication-resolver-support.js";
import type { PublishedSnapshotFactory } from "./publication-snapshot-state.js";
import { PUBLISHED_RENDERER_REVISION } from "./published-replay-authority.generated.js";
import { publishedRendererAuthorityFromBytes } from "./published-replay-authority.js";
import { parseRuleModelRegistry } from "./rule-model-input.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { readInventoryVersioned } from "./versioning.js";

const AUTHORITY_PATHS: AuthorityPaths = Object.freeze({
  inventory: "readiness/inventory/compiler-readiness-v1.json",
  identityLedger: "readiness/inventory/rule-identities-v1.jsonl",
  reviewEvidence: "readiness/reviews/compiler-readiness-v1-review.json",
});
const SEED_CONTRACT_PATH = "readiness/rule-models/rule-model-seed-v1.json";
const DIAGNOSTIC_MANIFEST_PATH = "readiness/oracles/diagnostic-oracle-v1.json";
const BINDING_REJECTION_PATH = "readiness/oracles/binding-rejections-v1.json";

function joinBindings(
  inventory: NonNullable<ReturnType<typeof readInventoryVersioned>["inventory"]>,
  rows: Awaited<ReturnType<typeof parsePublicationBindings>> extends PublicationResult<infer T>
    ? T
    : never,
  candidates: readonly FreshCandidateRegistration[],
): PublicationResult<ValidatedBindingRegistry> {
  if (!Array.isArray(candidates) || candidates.length !== rows.length) {
    return publicationFailure(
      "invalid",
      "publication.binding.invalid",
      "/candidates",
      "Selected publication requires one exact fresh candidate per binding row.",
    );
  }
  const byId = new Map<string, FreshCandidateRegistration>();
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (!isFreshCandidateRegistration(candidate) || byId.has(candidate.binding.handlerId)) {
      return publicationFailure(
        "invalid",
        "publication.binding.invalid",
        `/candidates/${index}`,
        "Publication candidate is not fresh, exact and unique.",
      );
    }
    byId.set(candidate.binding.handlerId, candidate);
  }
  const executable: ExecutableBinding[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const candidate = byId.get(row.handlerId);
    if (
      candidate === undefined ||
      candidate.binding.implementationRevision !== row.implementationRevision
    ) {
      return publicationFailure(
        "invalid",
        "publication.implementation-unavailable",
        `/bindings/${index}/implementationRevision`,
        "The exact published implementation revision is not installed.",
      );
    }
    if (
      candidate.binding.kind !== row.kind ||
      candidate.binding.contractVersion !== row.contractVersion
    ) {
      return publicationFailure(
        "invalid",
        "publication.binding.invalid",
        `/bindings/${index}`,
        "Serialized binding does not match its exact fresh executable candidate.",
      );
    }
    executable.push(candidate.binding);
  }
  const validated = validatePublishedBindings(inventory.handlerDeclarations, executable);
  if (!validated.ok) {
    const first = validated.diagnostics[0];
    return publicationFailure(
      "invalid",
      "publication.binding.invalid",
      first?.path ?? "/bindings",
      first?.message ?? "Published binding validation failed.",
    );
  }
  return publicationSuccess(validated.bindings);
}

/**
 * Resolves and validates one immutable version-one release without consulting the selected pointer.
 *
 * @param repositoryRoot Canonical repository root containing the release store.
 * @param publicationDigest Exact immutable release digest.
 * @param candidates Optional staged executable candidates.
 * @param createSnapshot Capability factory invoked only after complete validation.
 * @returns An authenticated publication snapshot or deterministic diagnostics.
 */
export async function resolvePublishedReleaseDigestV1(
  repositoryRoot: string,
  publicationDigest: Sha256Digest,
  candidates: readonly FreshCandidateRegistration[] | undefined,
  createSnapshot: PublishedSnapshotFactory,
): Promise<PublicationResult<PublishedSnapshot>> {
  const root = await canonicalPublicationRepositoryRoot(repositoryRoot);
  if (!root.ok) return root;
  const directories = await pinPublicationDirectoryChain(root.value, publicationDigest);
  if (!directories.ok) return directories;

  const releaseRoot = join(root.value, PUBLICATION_RELEASES_PATH, publicationDigest);
  const manifestRead = await readPinnedPublicationFile(
    join(releaseRoot, "manifest.json"),
    PUBLICATION_V1_LIMITS.maxManifestBytes,
    directories.value,
  );
  if (!manifestRead.ok) return manifestRead;
  const manifestResult = parsePublicationManifest(manifestRead.value.bytes);
  if (!manifestResult.ok) return manifestResult;
  const manifest = manifestResult.value;
  if (!equalPublicationBytes(manifestRead.value.bytes, renderPublicationManifest(manifest))) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "manifest.json",
      "Publication manifest is not in canonical wire form.",
    );
  }
  const computedPublicationDigest = digestPublicationAuthority(
    "blend65-publication-v1",
    publicationDigestPreimage(manifest),
  );
  if (computedPublicationDigest !== publicationDigest) {
    return publicationFailure(
      "invalid",
      "publication.digest.mismatch",
      "manifest.json",
      "Release directory and recomputed publication digest disagree.",
    );
  }

  const memberBytes = new Map<string, Uint8Array>();
  let totalBytes = 0;
  for (const member of manifest.members) {
    const memberLimit =
      member.path === "bindings-v1.json"
        ? PUBLICATION_V1_LIMITS.maxBindingBytes
        : member.path === "semantic-review-v1.json"
          ? PUBLICATION_V1_LIMITS.maxSemanticReviewBytes
          : PUBLICATION_V1_LIMITS.maxMemberBytes;
    if (member.byteLength > memberLimit) {
      return publicationFailure(
        "invalid",
        "publication.input.limit",
        member.path,
        "Manifest member length exceeds its named version-one limit.",
      );
    }
    const read = await readPinnedPublicationFile(
      join(releaseRoot, member.path),
      memberLimit,
      directories.value,
    );
    if (!read.ok) return read;
    totalBytes += read.value.size;
    if (totalBytes > PUBLICATION_V1_LIMITS.maxTotalReleaseBytes) {
      return publicationFailure(
        "invalid",
        "publication.input.limit",
        releaseRoot,
        "Publication release exceeds the aggregate byte limit.",
      );
    }
    if (
      read.value.size !== member.byteLength ||
      digestPublicationAuthority(`publication-member:${member.path}`, read.value.bytes) !==
        member.digest
    ) {
      return publicationFailure(
        "invalid",
        "publication.digest.mismatch",
        member.path,
        "Publication member length or digest does not match the manifest.",
      );
    }
    memberBytes.set(member.path, read.value.bytes);
  }

  const inventoryBytes = memberBytes.get("compiler-readiness-v1.json");
  const bindingBytes = memberBytes.get("bindings-v1.json");
  const ruleModelBytes = memberBytes.get("rule-models-v1.json");
  const ruleModelReviewBytes = memberBytes.get("rule-models-v1-review.json");
  const semanticReviewBytes = memberBytes.get("semantic-review-v1.json");
  if (
    inventoryBytes === undefined ||
    bindingBytes === undefined ||
    ruleModelBytes === undefined ||
    ruleModelReviewBytes === undefined ||
    semanticReviewBytes === undefined
  ) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      releaseRoot,
      "Publication release is missing an exact required member.",
    );
  }
  for (const [path, bytes] of [
    ["rule-models-v1-review.json", ruleModelReviewBytes],
    ["semantic-review-v1.json", semanticReviewBytes],
  ] as const) {
    const parsed = parsePublicationJson(bytes);
    if (!parsed.ok) {
      return publicationFailure(
        "invalid",
        parsed.diagnostics[0]?.code ?? "publication.input.invalid",
        path,
        parsed.diagnostics[0]?.message ?? "Publication JSON member is invalid.",
      );
    }
  }
  const inventoryResult = readInventoryVersioned(inventoryBytes);
  if (!inventoryResult.ok || inventoryResult.inventory === undefined) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "compiler-readiness-v1.json",
      inventoryResult.diagnostics[0]?.message ?? "Published inventory is invalid.",
    );
  }
  const ruleModels = parseRuleModelRegistry(ruleModelBytes);
  if (!ruleModels.ok) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "rule-models-v1.json",
      ruleModels.diagnostics[0]?.message ?? "Published rule-model authority is invalid.",
    );
  }
  const bindingsResult = parsePublicationBindings(bindingBytes);
  if (!bindingsResult.ok) return bindingsResult;
  if (!equalPublicationBytes(bindingBytes, renderPublicationBindings(bindingsResult.value))) {
    return publicationFailure(
      "invalid",
      "publication.binding.invalid",
      "bindings-v1.json",
      "Published binding registry is not in canonical wire form.",
    );
  }
  const handlerIds = bindingsResult.value.map(({ handlerId }) => handlerId);
  const promotedHandlerIds =
    handlerIds.length === PUBLICATION_V1_HANDLER_IDS.length &&
    handlerIds.every((handlerId, index) => handlerId === PUBLICATION_V1_HANDLER_IDS[index])
      ? PUBLICATION_V1_HANDLER_IDS
      : handlerIds.length ===
            PUBLICATION_V1_HANDLER_IDS.length + RD03_PUBLICATION_HANDLER_IDS.length &&
          RD03_PUBLICATION_HANDLER_IDS.every((handlerId) => handlerIds.includes(handlerId))
        ? RD03_PUBLICATION_HANDLER_IDS
        : undefined;
  if (promotedHandlerIds === undefined) {
    return publicationFailure(
      "invalid",
      "publication.binding.invalid",
      "bindings-v1.json",
      "Published binding set is not a compatible release profile.",
    );
  }
  const compatibleProfile = promotedHandlerIds === RD03_PUBLICATION_HANDLER_IDS;
  let resolvedCandidates = candidates;
  let candidateAuthorityBytes: ReadonlyMap<string, Uint8Array> | undefined;
  if (compatibleProfile) {
    const candidatePaths = publicationCandidateDependencyPaths(handlerIds);
    if (candidatePaths === undefined) {
      return publicationFailure(
        "invalid",
        "publication.binding.invalid",
        "/bindings",
        "Compatible publication candidate paths could not be reconstructed.",
      );
    }
    const authorityPaths = Object.freeze(
      [
        ...new Set([
          ...candidatePaths,
          ...PUBLISHED_RENDERER_REVISION.dependencyPaths,
          ...COMPATIBLE_PUBLICATION_AUTHORITY_REVISION.dependencyPaths,
          SEED_CONTRACT_PATH,
        ]),
      ].sort(),
    );
    const authority = await readPublicationAuthorityFiles(root.value, authorityPaths);
    if (!authority.ok) return authority;
    const loaded = publicationCandidatesFromAuthority(handlerIds, authority.value);
    if (!loaded.ok) {
      return publicationFailure(
        "invalid",
        "publication.binding.invalid",
        "/bindings",
        loaded.diagnostics[0]?.message ??
          "Package-owned publication bindings could not be reconstructed.",
      );
    }
    resolvedCandidates = loaded.candidates;
    candidateAuthorityBytes = authority.value;
  } else if (resolvedCandidates === undefined) {
    const loaded = await loadPublicationCandidatesForHandlerIds({
      repositoryRoot: root.value,
      handlerIds,
    });
    if (!loaded.ok) {
      return publicationFailure(
        "invalid",
        "publication.binding.invalid",
        "/bindings",
        loaded.diagnostics[0]?.message ??
          "Package-owned publication bindings could not be reconstructed.",
      );
    }
    resolvedCandidates = loaded.candidates;
    candidateAuthorityBytes = loaded.authorityBytes;
  }
  const bindings = joinBindings(
    inventoryResult.inventory,
    bindingsResult.value,
    resolvedCandidates,
  );
  if (!bindings.ok) return bindings;
  const reviewContext = await loadPublicationAuthorityContext(root.value, AUTHORITY_PATHS);
  if (!reviewContext.ok) {
    return publicationFailure(
      "invalid",
      "publication.review.invalid",
      "semantic-review-v1.json",
      reviewContext.diagnostics[0]?.message ?? "Review authority could not be reconstructed.",
    );
  }
  const implementationAuthority = compatibleProfile
    ? publicationImplementationAuthorityFromBytes(candidateAuthorityBytes ?? new Map())
    : undefined;
  if (implementationAuthority !== undefined && !implementationAuthority.ok) {
    return implementationAuthority;
  }
  const request = reconstructPublicationReviewRequest({
    context: reviewContext.context,
    inventory: inventoryResult.inventory,
    bindingBytes,
    inventoryBytes,
    ruleModelBytes,
    ruleModelReviewBytes,
    promotedHandlerIds,
    publicationImplementationAuthority: implementationAuthority?.value,
  });
  if (!request.ok) return request;
  const acceptedReview = validatePublicationReviewEvidence(
    semanticReviewBytes,
    request.value.request,
  );
  if (!acceptedReview.ok) return acceptedReview;
  if (!equalPublicationBytes(semanticReviewBytes, acceptedReview.value)) {
    return publicationFailure(
      "invalid",
      "publication.review.invalid",
      "semantic-review-v1.json",
      "Semantic review evidence is not in canonical wire form.",
    );
  }
  let seedContractBytes: Uint8Array | undefined;
  let diagnosticManifestBytes: Uint8Array | undefined;
  let bindingRejectionBytes: Uint8Array | undefined;
  let renderer: CampaignRendererBindingV1 | undefined;
  let rendererAuthorityBytes: ReadonlyMap<string, Uint8Array> | undefined;
  if (compatibleProfile) {
    seedContractBytes = candidateAuthorityBytes?.get(SEED_CONTRACT_PATH);
    diagnosticManifestBytes = candidateAuthorityBytes?.get(DIAGNOSTIC_MANIFEST_PATH);
    bindingRejectionBytes = candidateAuthorityBytes?.get(BINDING_REJECTION_PATH);
    if (
      seedContractBytes === undefined ||
      diagnosticManifestBytes === undefined ||
      bindingRejectionBytes === undefined
    ) {
      return publicationFailure(
        "invalid",
        "publication.binding.invalid",
        "/candidates",
        "Published oracle candidates lack their retained exact content authority.",
      );
    }
    const rendererAuthority = publishedRendererAuthorityFromBytes(
      candidateAuthorityBytes ?? new Map(),
    );
    if (rendererAuthority === undefined) {
      return publicationFailure(
        "invalid",
        "publication.binding.invalid",
        "/renderer",
        "Published renderer dependency authority is stale.",
      );
    }
    renderer = rendererAuthority.binding;
    rendererAuthorityBytes = rendererAuthority.authorityBytes;
  }
  const inventory = deepFreezePublicationValue(inventoryResult.inventory);
  return publicationSuccess(
    createSnapshot({
      repositoryRoot: root.value,
      publicationDigest,
      inventoryGenerationDigest: manifest.inventoryGenerationDigest,
      inventory,
      bindingRows: bindingsResult.value,
      candidates: Object.freeze([...resolvedCandidates]),
      bindings: bindings.value,
      memberBytes: new Map(memberBytes),
      acceptedReviewDigest: digestPublicationBytes(semanticReviewBytes),
      seedContractBytes,
      diagnosticManifestBytes,
      bindingRejectionBytes,
      renderer,
      candidateAuthorityBytes,
      rendererAuthorityBytes,
      publicationImplementationAuthority: implementationAuthority?.value,
    }),
  );
}
