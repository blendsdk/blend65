import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import type {
  ExecutableBinding,
  FreshCandidateRegistration,
  HandlerImplementation,
  PublishedSnapshot,
  ValidatedBindingRegistry,
} from "./binding-model.js";
import type { CampaignRendererBindingV1 } from "./campaign-model.js";
import { isSha256Digest } from "./canonical-identity.js";
import type { CompatiblePublicationResult } from "./compatible-publication-model.js";
import { isFreshCandidateRegistration, validatePublishedBindings } from "./binding-validator.js";
import { loadPublicationAuthorityContext, type AuthorityPaths } from "./authority-loader.js";
import { installPublishedBindingLookup } from "./publication-binding-lookup.js";
import {
  PUBLICATION_V1_HANDLER_IDS,
  RD03_PUBLICATION_HANDLER_IDS,
  loadPublicationCandidatesForHandlerIds,
  publicationCandidateDependencyPaths,
  publicationCandidatesFromAuthority,
} from "./publication-candidates.js";
import { currentPublicationConformance } from "./publication-conformance-v1.js";
import {
  pinPublicationDirectory,
  readPublicationRegularFile,
  verifyPublicationDirectory,
  type PublicationBoundedRead,
  type PublicationDirectoryIdentity,
} from "./publication-filesystem.js";
import { readPublicationAuthorityFiles } from "./publication-authority-loader.js";
import {
  publicationImplementationAuthorityFromBytes,
  type PublicationImplementationAuthority,
} from "./publication-implementation-authority.js";
import { COMPATIBLE_PUBLICATION_AUTHORITY_REVISION } from "./publication-authority-revision.generated.js";
import type { InventoryV1 } from "./model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import {
  PUBLICATION_POINTER_PATH,
  PUBLICATION_RELEASES_PATH,
  PUBLICATION_ROOT_PATH,
  PUBLICATION_V1_LIMITS,
  digestPublicationBytes,
  parsePublicationBindings,
  parsePublicationJson,
  parsePublicationManifest,
  parsePublicationPointer,
  publicationDigestPreimage,
  publicationFailure,
  publicationSuccess,
  renderPublicationBindings,
  renderPublicationManifest,
  renderPublicationPointer,
  type PublicationResult,
  type PublicationBindingRow,
  type PublishedMetadata,
  type ResolvePublishedSnapshotInput,
} from "./publication-model.js";
import {
  reconstructPublicationReviewRequest,
  validatePublicationReviewEvidence,
} from "./publication-review.js";
import { PUBLISHED_RENDERER_REVISION } from "./published-replay-authority.generated.js";
import { publishedRendererAuthorityFromBytes } from "./published-replay-authority.js";
import { parseRuleModelRegistry } from "./rule-model-input.js";
import { readInventoryVersioned } from "./versioning.js";

interface PublishedSnapshotState {
  readonly repositoryRoot: string;
  readonly publicationDigest: Sha256Digest;
  readonly inventoryGenerationDigest: Sha256Digest;
  readonly inventory: InventoryV1;
  readonly bindingRows: readonly PublicationBindingRow[];
  readonly candidates: readonly FreshCandidateRegistration[];
  readonly bindings: ValidatedBindingRegistry;
  readonly memberBytes: ReadonlyMap<string, Uint8Array>;
  readonly acceptedReviewDigest: Sha256Digest;
  readonly seedContractBytes?: Uint8Array | undefined;
  readonly diagnosticManifestBytes?: Uint8Array | undefined;
  readonly bindingRejectionBytes?: Uint8Array | undefined;
  readonly renderer?: CampaignRendererBindingV1 | undefined;
  readonly candidateAuthorityBytes?: ReadonlyMap<string, Uint8Array> | undefined;
  readonly rendererAuthorityBytes?: ReadonlyMap<string, Uint8Array> | undefined;
  readonly publicationImplementationAuthority?: PublicationImplementationAuthority | undefined;
}

const SNAPSHOTS = new WeakMap<object, PublishedSnapshotState>();
const AUTHORITY_PATHS: AuthorityPaths = Object.freeze({
  inventory: "readiness/inventory/compiler-readiness-v1.json",
  identityLedger: "readiness/inventory/rule-identities-v1.jsonl",
  reviewEvidence: "readiness/reviews/compiler-readiness-v1-review.json",
});
const SEED_CONTRACT_PATH = "readiness/rule-models/rule-model-seed-v1.json";
const DIAGNOSTIC_MANIFEST_PATH = "readiness/oracles/diagnostic-oracle-v1.json";
const BINDING_REJECTION_PATH = "readiness/oracles/binding-rejections-v1.json";

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  const pending: object[] = [value];
  const seen = new Set<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    for (const child of Object.values(current)) {
      if (typeof child === "object" && child !== null) pending.push(child);
    }
    Object.freeze(current);
  }
  return value;
}

function digest(domain: string, bytes: Uint8Array): Sha256Digest {
  return currentPublicationConformance()?.digest?.(domain, bytes) ?? digestPublicationBytes(bytes);
}

async function canonicalRepositoryRoot(repositoryRoot: string): Promise<PublicationResult<string>> {
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

async function rejectDirectoryLinks(
  repositoryRoot: string,
  publicationDigest?: Sha256Digest,
): Promise<PublicationResult<readonly PublicationDirectoryIdentity[]>> {
  const paths = [
    repositoryRoot,
    join(repositoryRoot, "readiness"),
    join(repositoryRoot, PUBLICATION_ROOT_PATH),
    join(repositoryRoot, PUBLICATION_RELEASES_PATH),
    ...(publicationDigest === undefined
      ? []
      : [join(repositoryRoot, PUBLICATION_RELEASES_PATH, publicationDigest)]),
  ];
  const identities: PublicationDirectoryIdentity[] = [];
  for (const path of paths) {
    const identity = await pinPublicationDirectory(path);
    if (!identity.ok) return identity;
    identities.push(identity.value);
  }
  return publicationSuccess(Object.freeze(identities));
}

async function readBoundedRegularFile(
  path: string,
  limit: number,
  directories: readonly PublicationDirectoryIdentity[],
): Promise<PublicationResult<PublicationBoundedRead>> {
  for (const directory of directories) {
    const verified = await verifyPublicationDirectory(directory);
    if (!verified.ok) return verified;
  }
  const read = await readPublicationRegularFile(path, limit);
  if (!read.ok) return read;
  for (const directory of directories) {
    const verified = await verifyPublicationDirectory(directory);
    if (!verified.ok) return verified;
  }
  return read;
}

function createSnapshot(state: PublishedSnapshotState): PublishedSnapshot {
  const snapshot = Object.freeze({}) as PublishedSnapshot;
  SNAPSHOTS.set(snapshot, Object.freeze(state));
  return snapshot;
}

function joinBindings(
  inventory: InventoryV1,
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
      candidate.binding.kind !== row.kind ||
      candidate.binding.contractVersion !== row.contractVersion ||
      candidate.binding.implementationRevision !== row.implementationRevision
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
 * Resolves and validates one immutable release digest without consulting the selected pointer.
 *
 * This internal operation supports staged acceptance before the commit point.
 */
export async function resolvePublishedReleaseDigest(
  repositoryRoot: string,
  publicationDigest: Sha256Digest,
  candidates?: readonly FreshCandidateRegistration[],
): Promise<PublicationResult<PublishedSnapshot>> {
  const root = await canonicalRepositoryRoot(repositoryRoot);
  if (!root.ok) return root;
  const directories = await rejectDirectoryLinks(root.value, publicationDigest);
  if (!directories.ok) return directories;

  const releaseRoot = join(root.value, PUBLICATION_RELEASES_PATH, publicationDigest);
  const manifestRead = await readBoundedRegularFile(
    join(releaseRoot, "manifest.json"),
    PUBLICATION_V1_LIMITS.maxManifestBytes,
    directories.value,
  );
  if (!manifestRead.ok) return manifestRead;
  const manifestResult = parsePublicationManifest(manifestRead.value.bytes);
  if (!manifestResult.ok) return manifestResult;
  const manifest = manifestResult.value;
  if (!equalBytes(manifestRead.value.bytes, renderPublicationManifest(manifest))) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "manifest.json",
      "Publication manifest is not in canonical wire form.",
    );
  }
  const computedPublicationDigest = digest(
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
    const read = await readBoundedRegularFile(
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
      digest(`publication-member:${member.path}`, read.value.bytes) !== member.digest
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
  if (!equalBytes(bindingBytes, renderPublicationBindings(bindingsResult.value))) {
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
  if (!equalBytes(semanticReviewBytes, acceptedReview.value)) {
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
  const inventory = deepFreeze(inventoryResult.inventory);
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

/**
 * Resolves the sole selected pointer and returns an opaque fully verified publication.
 *
 * @param input Canonical repository root used to reconstruct package-owned executable authority.
 * @returns Selected publication capability or deterministic bounded diagnostics.
 */
export async function resolvePublishedSnapshot(
  input: ResolvePublishedSnapshotInput,
): Promise<PublicationResult<PublishedSnapshot>> {
  const root = await canonicalRepositoryRoot(input.repositoryRoot);
  if (!root.ok) return root;
  const directories = await rejectDirectoryLinks(root.value);
  if (!directories.ok) return directories;
  const pointerRead = await readBoundedRegularFile(
    join(root.value, PUBLICATION_POINTER_PATH),
    PUBLICATION_V1_LIMITS.maxPointerBytes,
    directories.value,
  );
  if (!pointerRead.ok) return pointerRead;
  const pointer = parsePublicationPointer(pointerRead.value.bytes);
  if (!pointer.ok) return pointer;
  if (
    !equalBytes(pointerRead.value.bytes, renderPublicationPointer(pointer.value.publicationDigest))
  ) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      PUBLICATION_POINTER_PATH,
      "Publication pointer is not in canonical wire form.",
    );
  }
  const snapshot = await resolvePublishedReleaseDigest(root.value, pointer.value.publicationDigest);
  if (!snapshot.ok) return snapshot;
  const metadata = getPublishedMetadata(snapshot.value);
  if (metadata?.publicationDigest !== pointer.value.publicationDigest) {
    return publicationFailure(
      "invalid",
      "publication.digest.mismatch",
      PUBLICATION_POINTER_PATH,
      "Selected pointer and resolved publication disagree.",
    );
  }
  return snapshot;
}

function namedSnapshotInput(
  input: unknown,
): { readonly repositoryRoot: string; readonly publicationDigest: Sha256Digest } | undefined {
  try {
    if (
      typeof input !== "object" ||
      input === null ||
      Array.isArray(input) ||
      Object.getPrototypeOf(input) !== Object.prototype ||
      Reflect.ownKeys(input).length !== 2
    ) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const root = descriptors.repositoryRoot;
    const digestDescriptor = descriptors.publicationDigest;
    if (
      root === undefined ||
      digestDescriptor === undefined ||
      !("value" in root) ||
      !("value" in digestDescriptor) ||
      !root.enumerable ||
      !digestDescriptor.enumerable ||
      typeof root.value !== "string" ||
      !isSha256Digest(digestDescriptor.value)
    ) {
      return undefined;
    }
    return Object.freeze({
      repositoryRoot: root.value,
      publicationDigest: digestDescriptor.value,
    });
  } catch {
    return undefined;
  }
}

function isMissingReleaseError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

/**
 * Resolves one named immutable release without consulting the selected pointer.
 *
 * @param input Canonical repository root and exact publication digest.
 * @returns Fully revalidated snapshot or deterministic release diagnostics.
 *
 * @example
 * ```ts
 * const snapshot = await resolvePublishedSnapshotByDigest({ repositoryRoot, publicationDigest });
 * ```
 */
export async function resolvePublishedSnapshotByDigest(input: {
  readonly repositoryRoot: string;
  readonly publicationDigest: Sha256Digest;
}): Promise<CompatiblePublicationResult<PublishedSnapshot>> {
  const snapshotInput = namedSnapshotInput(input);
  if (snapshotInput === undefined) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "/publicationDigest",
      "Named publication input must contain a canonical repository root and SHA-256 digest.",
    );
  }
  const root = await canonicalRepositoryRoot(snapshotInput.repositoryRoot);
  if (!root.ok) return root;
  try {
    const stat = await lstat(
      join(root.value, PUBLICATION_RELEASES_PATH, snapshotInput.publicationDigest),
    );
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        "/publicationDigest",
        "Named publication release is not a real directory.",
      );
    }
  } catch (error) {
    if (isMissingReleaseError(error)) {
      return Object.freeze({
        ok: false,
        kind: "not-found",
        diagnostics: Object.freeze([
          Object.freeze({
            code: "publication.release.not-found",
            path: "/publicationDigest",
            message: "Named publication release was not found.",
          }),
        ]),
      });
    }
    return publicationFailure(
      "io",
      "publication.io",
      "/publicationDigest",
      "Named publication release could not be inspected.",
    );
  }
  return resolvePublishedReleaseDigest(root.value, snapshotInput.publicationDigest);
}

/**
 * Looks up one executable handler only through a genuine selected snapshot.
 *
 * @param snapshot Digest-verified selected publication.
 * @param handlerId Exact handler identity.
 * @returns The selected executable binding, or `undefined`.
 */
export function getPublishedBinding(
  snapshot: PublishedSnapshot,
  handlerId: string,
): ExecutableBinding<HandlerImplementation> | undefined {
  if (typeof snapshot !== "object" || snapshot === null || typeof handlerId !== "string") {
    return undefined;
  }
  return SNAPSHOTS.get(snapshot)?.bindings.get(handlerId);
}

installPublishedBindingLookup(getPublishedBinding);

/**
 * Reads the immutable inventory only through a genuine selected snapshot.
 *
 * @param snapshot Digest-verified selected publication.
 * @returns The selected immutable inventory, or `undefined` for a forged value.
 */
export function getPublishedInventory(snapshot: PublishedSnapshot): InventoryV1 | undefined {
  if (typeof snapshot !== "object" || snapshot === null) return undefined;
  return SNAPSHOTS.get(snapshot)?.inventory;
}

/**
 * Reads selected digest metadata only through a genuine selected snapshot.
 *
 * @param snapshot Digest-verified selected publication.
 * @returns Immutable publication metadata, or `undefined` for a forged value.
 */
export function getPublishedMetadata(snapshot: PublishedSnapshot): PublishedMetadata | undefined {
  if (typeof snapshot !== "object" || snapshot === null) return undefined;
  const state = SNAPSHOTS.get(snapshot);
  return state === undefined
    ? undefined
    : Object.freeze({
        publicationDigest: state.publicationDigest,
        inventoryGenerationDigest: state.inventoryGenerationDigest,
      });
}

/**
 * Reads immutable serialized binding metadata through a genuine snapshot.
 *
 * @param snapshot Resolver-created published snapshot.
 * @returns Lexical binding rows, or `undefined` for a forged value.
 *
 * @example
 * ```ts
 * const rows = getPublishedBindingRows(snapshot);
 * ```
 */
export function getPublishedBindingRows(
  snapshot: PublishedSnapshot,
): readonly PublicationBindingRow[] | undefined {
  if (typeof snapshot !== "object" || snapshot === null) return undefined;
  const rows = SNAPSHOTS.get(snapshot)?.bindingRows;
  return rows === undefined
    ? undefined
    : Object.freeze(rows.map((row) => Object.freeze({ ...row })));
}

/** Package-private authority retained behind one genuine resolver snapshot. */
export interface PublishedSnapshotAuthority {
  readonly repositoryRoot: string;
  readonly publicationDigest: Sha256Digest;
  readonly inventory: InventoryV1;
  readonly bindingRows: readonly PublicationBindingRow[];
  readonly candidates: readonly FreshCandidateRegistration[];
  readonly memberBytes: ReadonlyMap<string, Uint8Array>;
  readonly acceptedReviewDigest: Sha256Digest;
  readonly seedContractBytes?: Uint8Array | undefined;
  readonly diagnosticManifestBytes?: Uint8Array | undefined;
  readonly bindingRejectionBytes?: Uint8Array | undefined;
  readonly renderer?: CampaignRendererBindingV1 | undefined;
  readonly candidateAuthorityBytes?: ReadonlyMap<string, Uint8Array> | undefined;
  readonly rendererAuthorityBytes?: ReadonlyMap<string, Uint8Array> | undefined;
  readonly publicationImplementationAuthority?: PublicationImplementationAuthority | undefined;
}

/**
 * Returns private resolver authority for internal publication and evidence composition.
 *
 * @param snapshot Candidate snapshot capability.
 * @returns Retained authority only for a genuine resolver-created snapshot.
 */
export function getPublishedSnapshotAuthority(
  snapshot: PublishedSnapshot,
): PublishedSnapshotAuthority | undefined {
  if (typeof snapshot !== "object" || snapshot === null) return undefined;
  const state = SNAPSHOTS.get(snapshot);
  return state === undefined
    ? undefined
    : Object.freeze({
        repositoryRoot: state.repositoryRoot,
        publicationDigest: state.publicationDigest,
        inventory: state.inventory,
        bindingRows: state.bindingRows,
        candidates: state.candidates,
        memberBytes: state.memberBytes,
        acceptedReviewDigest: state.acceptedReviewDigest,
        seedContractBytes: state.seedContractBytes,
        diagnosticManifestBytes: state.diagnosticManifestBytes,
        bindingRejectionBytes: state.bindingRejectionBytes,
        renderer: state.renderer,
        candidateAuthorityBytes: state.candidateAuthorityBytes,
        rendererAuthorityBytes: state.rendererAuthorityBytes,
        publicationImplementationAuthority: state.publicationImplementationAuthority,
      });
}
