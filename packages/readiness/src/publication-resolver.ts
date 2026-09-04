import { lstat } from "node:fs/promises";
import { join } from "node:path";

import type {
  ExecutableBinding,
  FreshCandidateRegistration,
  HandlerImplementation,
  PublishedSnapshot,
} from "./binding-model.js";
import type { CampaignRendererBindingV1 } from "./campaign-model.js";
import { isSha256Digest } from "./canonical-identity.js";
import type { CompatiblePublicationResult } from "./compatible-publication-model.js";
import { installPublishedBindingLookup } from "./publication-binding-lookup.js";
import { isVerifiedSelectedPointerReplacement } from "./publication-filesystem.js";
import {
  publicationResolutionObservation,
  type PublicationResolutionObservation,
} from "./publication-conformance-v1.js";
import type { PublicationImplementationAuthority } from "./publication-implementation-authority.js";
import type { InventoryV1 } from "./model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import {
  PUBLICATION_POINTER_PATH,
  PUBLICATION_RELEASES_PATH,
  PUBLICATION_V1_LIMITS,
  parsePublicationJson,
  parsePublicationPointer,
  publicationFailure,
  publicationSuccess,
  renderPublicationPointer,
  type PublicationResult,
  type PublicationBindingRow,
  type PublishedMetadata,
  type ResolvePublishedSnapshotInput,
} from "./publication-model.js";
import { resolvePublishedReleaseDigestV1 } from "./publication-release-resolver.js";
import {
  canonicalPublicationRepositoryRoot as canonicalRepositoryRoot,
  copyPublicationBytesMap as copyBytesMap,
  deepFreezePublicationValue as deepFreeze,
  equalPublicationBytes as equalBytes,
  pinPublicationDirectoryChain as rejectDirectoryLinks,
  readPinnedPublicationFile as readBoundedRegularFile,
} from "./publication-resolver-support.js";
import type { PublishedSnapshotState } from "./publication-snapshot-state.js";
import {
  getPublishedRuleFamilyRecordAuthorityV2,
  parseRuleFamilyPublicationPointerV2,
  renderRuleFamilyPublicationPointerV2,
  resolvePublishedRuleFamilyRecordByDigestV2,
  type PublishedRuleFamilyRecord,
} from "./rule-family-publication-record.js";
import {
  acquireRuleFamilyExecutableAuthorityV2,
  type PublishedRuleFamilyAuthorityV2,
} from "./rule-family-executable-authority.js";

export type { PublishedSnapshotState } from "./publication-snapshot-state.js";

const SNAPSHOTS = new WeakMap<object, PublishedSnapshotState>();

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function observeSelectedResolution(
  observation: PublicationResolutionObservation,
): Promise<PublicationResult<true>> {
  try {
    await publicationResolutionObservation(observation);
    return publicationSuccess(true);
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      PUBLICATION_POINTER_PATH,
      "Selected publication resolution observation failed.",
    );
  }
}

/** Mints a snapshot from facts already authenticated by a publication-format resolver. */
export function createResolvedPublishedSnapshot(state: PublishedSnapshotState): PublishedSnapshot {
  const snapshot = Object.freeze({}) as PublishedSnapshot;
  const implementationAuthority = state.publicationImplementationAuthority;
  SNAPSHOTS.set(
    snapshot,
    Object.freeze({
      ...state,
      inventory: deepFreeze(structuredClone(state.inventory)),
      bindingRows: Object.freeze(state.bindingRows.map((row) => Object.freeze({ ...row }))),
      candidates: Object.freeze([...state.candidates]),
      memberBytes: copyBytesMap(state.memberBytes) ?? new Map(),
      seedContractBytes: state.seedContractBytes?.slice(),
      diagnosticManifestBytes: state.diagnosticManifestBytes?.slice(),
      bindingRejectionBytes: state.bindingRejectionBytes?.slice(),
      candidateAuthorityBytes: copyBytesMap(state.candidateAuthorityBytes),
      rendererAuthorityBytes: copyBytesMap(state.rendererAuthorityBytes),
      publicationImplementationAuthority:
        implementationAuthority === undefined
          ? undefined
          : Object.freeze({
              ...implementationAuthority,
              dependencyPaths: Object.freeze([...implementationAuthority.dependencyPaths]),
              authorityBytes: copyBytesMap(implementationAuthority.authorityBytes) ?? new Map(),
            }),
    }),
  );
  return snapshot;
}

/**
 * Resolves and validates one immutable release digest without consulting the selected pointer.
 *
 * This operation supports staged acceptance before the commit point.
 */
export async function resolvePublishedReleaseDigest(
  repositoryRoot: string,
  publicationDigest: Sha256Digest,
  candidates?: readonly FreshCandidateRegistration[],
): Promise<PublicationResult<PublishedSnapshot>> {
  return resolvePublishedReleaseDigestV1(
    repositoryRoot,
    publicationDigest,
    candidates,
    createResolvedPublishedSnapshot,
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
  const first = await resolvePublishedSnapshotAttempt(input, 1);
  if (first.ok || !isVerifiedSelectedPointerReplacement(first)) return first;
  const retry = await observeSelectedResolution({
    operation: "selected-resolution",
    attempt: 1,
    event: "retry",
    reason: "verified-pointer-replacement",
  });
  if (!retry.ok) return retry;
  return resolvePublishedSnapshotAttempt(input, 2);
}

async function resolvePublishedSnapshotAttempt(
  input: ResolvePublishedSnapshotInput,
  attempt: 1 | 2,
): Promise<PublicationResult<PublishedSnapshot>> {
  const started = await observeSelectedResolution({
    operation: "selected-resolution",
    attempt,
    event: "start",
  });
  if (!started.ok) return started;
  const root = await canonicalRepositoryRoot(input.repositoryRoot);
  if (!root.ok) return finishSelectedResolution(root, attempt);
  const directories = await rejectDirectoryLinks(root.value);
  if (!directories.ok) return finishSelectedResolution(directories, attempt);
  const pointerRead = await readBoundedRegularFile(
    join(root.value, PUBLICATION_POINTER_PATH),
    PUBLICATION_V1_LIMITS.maxPointerBytes,
    directories.value,
    true,
  );
  if (!pointerRead.ok) return finishSelectedResolution(pointerRead, attempt);
  const pointerJson = parsePublicationJson(pointerRead.value.bytes);
  if (!pointerJson.ok) return finishSelectedResolution(pointerJson, attempt);
  const pointerValue = pointerJson.value;
  const versionTwo =
    isRecord(pointerValue) &&
    pointerValue.schemaVersion === 2 &&
    pointerValue.kind === "rule-family-publication-pointer-v2";
  const pointer = versionTwo
    ? parseRuleFamilyPublicationPointerV2(pointerRead.value.bytes)
    : parsePublicationPointer(pointerRead.value.bytes);
  if (!pointer.ok) return finishSelectedResolution(pointer, attempt);
  const canonicalPointer = versionTwo
    ? renderRuleFamilyPublicationPointerV2(pointer.value.publicationDigest)
    : renderPublicationPointer(pointer.value.publicationDigest);
  if (!equalBytes(pointerRead.value.bytes, canonicalPointer)) {
    return finishSelectedResolution(
      publicationFailure<PublishedSnapshot>(
        "invalid",
        "publication.input.invalid",
        PUBLICATION_POINTER_PATH,
        "Publication pointer is not in canonical wire form.",
      ),
      attempt,
    );
  }
  let snapshot: PublicationResult<PublishedSnapshot>;
  if (versionTwo) {
    const record = await resolvePublishedRuleFamilyRecordByDigestV2({
      repositoryRoot: root.value,
      publicationDigest: pointer.value.publicationDigest,
    });
    if (!record.ok) {
      snapshot = publicationFailure(
        record.kind === "io" ? "io" : "invalid",
        record.kind === "io" ? "publication.io" : "publication.record.invalid",
        PUBLICATION_POINTER_PATH,
        record.diagnostics[0]?.message ?? "Selected version-two publication is invalid.",
      );
    } else {
      const acquired = await acquirePublishedRuleFamilyAuthorityV2(record.value);
      if (acquired.ok) {
        snapshot = publicationSuccess(acquired.value);
      } else {
        const unavailable =
          acquired.diagnostics[0]?.code === "publication.implementation-unavailable";
        snapshot = publicationFailure(
          acquired.kind === "io" ? "io" : "invalid",
          acquired.kind === "io"
            ? "publication.io"
            : unavailable
              ? "publication.implementation-unavailable"
              : "publication.record.invalid",
          acquired.diagnostics[0]?.path ?? PUBLICATION_POINTER_PATH,
          acquired.diagnostics[0]?.message ?? "Selected version-two authority is invalid.",
        );
      }
    }
  } else {
    snapshot = await resolvePublishedReleaseDigest(root.value, pointer.value.publicationDigest);
  }
  if (!snapshot.ok) return finishSelectedResolution(snapshot, attempt);
  const metadata = getPublishedMetadata(snapshot.value);
  if (metadata?.publicationDigest !== pointer.value.publicationDigest) {
    return finishSelectedResolution(
      publicationFailure<PublishedSnapshot>(
        "invalid",
        "publication.digest.mismatch",
        PUBLICATION_POINTER_PATH,
        "Selected pointer and resolved publication disagree.",
      ),
      attempt,
    );
  }
  const succeeded = await observeSelectedResolution({
    operation: "selected-resolution",
    attempt,
    event: "success",
  });
  return succeeded.ok ? snapshot : succeeded;
}

async function finishSelectedResolution<T>(
  failure: PublicationResult<T>,
  attempt: 1 | 2,
): Promise<PublicationResult<T>> {
  if (failure.ok) return failure;
  const observed = await observeSelectedResolution({
    operation: "selected-resolution",
    attempt,
    event: "failure",
  });
  return observed.ok
    ? failure
    : publicationFailure(
        "io",
        "publication.io",
        PUBLICATION_POINTER_PATH,
        observed.diagnostics[0]?.message ?? "Selected publication resolution observation failed.",
      );
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
  const passive = await resolvePublishedRuleFamilyRecordByDigestV2(snapshotInput);
  if (passive.ok) {
    const passiveAuthority = getPublishedRuleFamilyRecordAuthorityV2(passive.value);
    if (passiveAuthority?.schemaVersion === 2) {
      return acquirePublishedRuleFamilyAuthorityV2(passive.value);
    }
  }
  const resolved = await resolvePublishedReleaseDigest(root.value, snapshotInput.publicationDigest);
  if (!resolved.ok && resolved.diagnostics[0]?.code === "publication.implementation-unavailable") {
    return Object.freeze({ ...resolved, kind: "stale" as const });
  }
  return resolved;
}

/**
 * Acquires executable authority only when every stored handler revision is installed exactly.
 *
 * @param record Authenticated passive historical publication.
 * @returns Executable parent capability or a stale implementation diagnostic.
 */
export async function acquirePublishedRuleFamilyAuthorityV2(
  record: PublishedRuleFamilyRecord,
): Promise<CompatiblePublicationResult<PublishedRuleFamilyAuthorityV2>> {
  return acquireRuleFamilyExecutableAuthorityV2(
    record,
    Object.freeze({
      resolveLegacy: resolvePublishedReleaseDigest,
      createSnapshot: createResolvedPublishedSnapshot,
    }),
  );
}

export {
  getPublishedRuleFamilyRecordProjectionV2,
  resolvePublishedRuleFamilyRecordByDigestV2,
} from "./rule-family-publication-record.js";
export type {
  PublishedRuleFamilyAuthorityV2,
  PublishedRuleFamilySnapshotV2,
} from "./rule-family-executable-authority.js";

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
        bindingRows: Object.freeze(state.bindingRows.map((row) => Object.freeze({ ...row }))),
        candidates: Object.freeze([...state.candidates]),
        memberBytes: copyBytesMap(state.memberBytes) ?? new Map(),
        acceptedReviewDigest: state.acceptedReviewDigest,
        seedContractBytes: state.seedContractBytes?.slice(),
        diagnosticManifestBytes: state.diagnosticManifestBytes?.slice(),
        bindingRejectionBytes: state.bindingRejectionBytes?.slice(),
        renderer: state.renderer,
        candidateAuthorityBytes: copyBytesMap(state.candidateAuthorityBytes),
        rendererAuthorityBytes: copyBytesMap(state.rendererAuthorityBytes),
        publicationImplementationAuthority:
          state.publicationImplementationAuthority === undefined
            ? undefined
            : Object.freeze({
                ...state.publicationImplementationAuthority,
                dependencyPaths: Object.freeze([
                  ...state.publicationImplementationAuthority.dependencyPaths,
                ]),
                authorityBytes:
                  copyBytesMap(state.publicationImplementationAuthority.authorityBytes) ??
                  new Map(),
              }),
      });
}
