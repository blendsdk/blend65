import { join } from "node:path";

import type { PublishedSnapshot } from "./binding-model.js";
import type { CompatiblePublicationResult } from "./compatible-publication-model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import {
  pinPublicationDirectory,
  readSelectedPublicationPointer,
  verifyPublicationDirectory,
} from "./publication-filesystem.js";
import {
  PUBLICATION_POINTER_PATH,
  PUBLICATION_ROOT_PATH,
  PUBLICATION_V1_LIMITS,
  parsePublicationJson,
  parsePublicationPointer,
  renderPublicationPointer,
} from "./publication-model.js";
import {
  getPublishedMetadata,
  resolvePublishedSnapshot,
  type PublishedRuleFamilySnapshotV2,
} from "./publication-resolver.js";
import {
  getPublishedRuleFamilyRecordAuthorityV2,
  parseRuleFamilyPublicationPointerV2,
  renderRuleFamilyPublicationPointerV2,
  resolvePublishedRuleFamilyRecordByDigestV2,
} from "./rule-family-publication-record.js";

/** Minimum immutable identities needed to validate a parent selection transaction. */
export interface RuleFamilyPublicationSelectionStateV2 {
  readonly repositoryRoot: string;
  readonly predecessorPublicationDigest: Sha256Digest;
  readonly publicationDigest: Sha256Digest;
}

function failure<T>(
  code: "publication.record.invalid" | "publication.review.stale",
  message: string,
  kind: "invalid" | "stale" = "invalid",
): CompatiblePublicationResult<T> {
  return Object.freeze({
    ok: false,
    kind,
    diagnostics: Object.freeze([Object.freeze({ code, path: PUBLICATION_POINTER_PATH, message })]),
  });
}

function success<T>(value: T): CompatiblePublicationResult<T> {
  return Object.freeze({ ok: true, value, diagnostics: Object.freeze([]) as readonly [] });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

/**
 * Resolves the canonical selected passive parent and applies the prepared predecessor comparison.
 *
 * This runs while the generation lock is held. The pointer is read again after complete record
 * authentication so an uncooperative writer cannot turn a stale preparation into a commit.
 */
export async function verifyPreparedRuleFamilyPredecessorV2(
  state: RuleFamilyPublicationSelectionStateV2,
): Promise<CompatiblePublicationResult<true>> {
  const publicationDirectory = await pinPublicationDirectory(
    join(state.repositoryRoot, PUBLICATION_ROOT_PATH),
  );
  if (!publicationDirectory.ok) return publicationDirectory;
  const before = await verifyPublicationDirectory(publicationDirectory.value);
  if (!before.ok) return before;
  const pointer = await readSelectedPublicationPointer(
    join(state.repositoryRoot, PUBLICATION_POINTER_PATH),
    PUBLICATION_V1_LIMITS.maxPointerBytes,
    [publicationDirectory.value],
  );
  if (!pointer.ok) return pointer;
  const parsed = parsePublicationJson(pointer.value.bytes);
  if (!parsed.ok) return parsed;
  const versionTwo =
    isRecord(parsed.value) &&
    parsed.value.schemaVersion === 2 &&
    parsed.value.kind === "rule-family-publication-pointer-v2";
  const selected = versionTwo
    ? parseRuleFamilyPublicationPointerV2(pointer.value.bytes)
    : parsePublicationPointer(pointer.value.bytes);
  if (!selected.ok) return selected;
  const canonicalBytes = versionTwo
    ? renderRuleFamilyPublicationPointerV2(selected.value.publicationDigest)
    : renderPublicationPointer(selected.value.publicationDigest);
  if (!equalBytes(canonicalBytes, pointer.value.bytes)) {
    return failure("publication.record.invalid", "Selected parent pointer is not canonical.");
  }
  const record = await resolvePublishedRuleFamilyRecordByDigestV2({
    repositoryRoot: state.repositoryRoot,
    publicationDigest: selected.value.publicationDigest,
  });
  if (!record.ok) return record;
  const authority = getPublishedRuleFamilyRecordAuthorityV2(record.value);
  if (
    authority === undefined ||
    authority.repositoryRoot !== state.repositoryRoot ||
    authority.publicationDigest !== selected.value.publicationDigest
  ) {
    return failure(
      "publication.record.invalid",
      "Selected parent record does not match its canonical pointer.",
    );
  }
  const finalPointer = await readSelectedPublicationPointer(
    join(state.repositoryRoot, PUBLICATION_POINTER_PATH),
    PUBLICATION_V1_LIMITS.maxPointerBytes,
    [publicationDirectory.value],
  );
  if (!finalPointer.ok || !equalBytes(finalPointer.value.bytes, canonicalBytes)) {
    return failure(
      "publication.review.stale",
      "Selected parent changed while publication authority was being resolved.",
      "stale",
    );
  }
  return authority.publicationDigest === state.predecessorPublicationDigest
    ? success(true)
    : failure(
        "publication.review.stale",
        "Selected parent changed after version-two publication preparation.",
        "stale",
      );
}

function isExactCommittedV2Snapshot(
  snapshot: PublishedSnapshot,
  publicationDigest: Sha256Digest,
): snapshot is PublishedRuleFamilySnapshotV2 {
  return getPublishedMetadata(snapshot)?.publicationDigest === publicationDigest;
}

/** Reconstructs the selected version-two executable authority after the pointer commit. */
export async function resolveCommittedRuleFamilyPublicationV2(
  state: RuleFamilyPublicationSelectionStateV2,
): Promise<CompatiblePublicationResult<PublishedRuleFamilySnapshotV2>> {
  const selected = await resolvePublishedSnapshot({ repositoryRoot: state.repositoryRoot });
  if (!selected.ok) return selected;
  return isExactCommittedV2Snapshot(selected.value, state.publicationDigest)
    ? success(selected.value)
    : failure(
        "publication.record.invalid",
        "Committed pointer does not select the staged version-two parent.",
      );
}
