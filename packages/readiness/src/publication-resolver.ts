import { realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import type {
  ExecutableBinding,
  FreshCandidateRegistration,
  HandlerImplementation,
  PublishedSnapshot,
  ValidatedBindingRegistry,
} from "./binding-model.js";
import { isFreshCandidateRegistration, validatePublishedBindings } from "./binding-validator.js";
import { installPublishedBindingLookup } from "./publication-binding-lookup.js";
import { loadPublicationCandidateCatalog } from "./publication-candidates.js";
import { currentPublicationConformance } from "./publication-conformance-v1.js";
import {
  pinPublicationDirectory,
  readPublicationRegularFile,
  verifyPublicationDirectory,
  type PublicationBoundedRead,
  type PublicationDirectoryIdentity,
} from "./publication-filesystem.js";
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
  type PublishedMetadata,
  type ResolvePublishedSnapshotInput,
} from "./publication-model.js";
import { parseRuleModelRegistry } from "./rule-model-input.js";
import { readInventoryVersioned } from "./versioning.js";

interface PublishedSnapshotState {
  readonly publicationDigest: Sha256Digest;
  readonly inventoryGenerationDigest: Sha256Digest;
  readonly inventory: InventoryV1;
  readonly bindings: ValidatedBindingRegistry;
}

const SNAPSHOTS = new WeakMap<object, PublishedSnapshotState>();

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
  candidates: readonly FreshCandidateRegistration[],
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
  const bindings = joinBindings(inventoryResult.inventory, bindingsResult.value, candidates);
  if (!bindings.ok) return bindings;
  const inventory = deepFreeze(inventoryResult.inventory);
  return publicationSuccess(
    createSnapshot({
      publicationDigest,
      inventoryGenerationDigest: manifest.inventoryGenerationDigest,
      inventory,
      bindings: bindings.value,
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
  const catalog = await loadPublicationCandidateCatalog(root.value);
  if (!catalog.ok) {
    const first = catalog.diagnostics[0];
    return publicationFailure(
      "invalid",
      "publication.binding.invalid",
      first?.path ?? "/bindings",
      first?.message ?? "Package-owned publication bindings could not be reconstructed.",
    );
  }
  const snapshot = await resolvePublishedReleaseDigest(
    root.value,
    pointer.value.publicationDigest,
    catalog.candidates,
  );
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
