import { randomUUID } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { CompatiblePublicationResult } from "./compatible-publication-model.js";
import { getEmbeddedCaseFixtureSetStateV2 } from "./embed-case-fixtures.js";
import { acquireGenerationLock } from "./generation-lock.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { publicationFaultPoint } from "./publication-conformance-v1.js";
import {
  ensurePublicationChildDirectory,
  pinPublicationDirectory,
  removePublicationEntry,
  renamePublicationEntry,
  syncPublicationDirectory,
  writePublicationRegularFile,
  type PublicationDirectoryIdentity,
} from "./publication-filesystem.js";
import {
  PUBLICATION_POINTER_PATH,
  PUBLICATION_RELEASES_PATH,
  PUBLICATION_ROOT_PATH,
  digestPublicationBytes,
  publicationFailure,
  publicationSuccess,
  renderPublicationJson,
  type PublicationBindingRow,
  type PublicationResult,
  type PublicationReviewRequestV1,
} from "./publication-model.js";
import {
  acquirePublishedRuleFamilyAuthorityV2,
  resolvePublishedRuleFamilyRecordByDigestV2,
  type PublishedRuleFamilySnapshotV2,
} from "./publication-resolver.js";
import {
  RULE_FAMILY_PUBLICATION_V2_MEMBER_PATHS,
  computeRuleFamilyPublicationDigestV2,
  createStagedPublishedRuleFamilyRecordV2,
  getPublishedRuleFamilyRecordAuthorityV2,
  renderRuleFamilyPublicationManifestV2,
  renderRuleFamilyPublicationPointerV2,
  type PublishedRuleFamilyRecord,
  type RuleFamilyPublicationManifestV2,
} from "./rule-family-publication-record.js";
import {
  resolveCommittedRuleFamilyPublicationV2,
  verifyPreparedRuleFamilyPredecessorV2,
} from "./rule-family-publication-selection.js";
import { projectRuleFamilySuccessorInventoryV2 } from "./rule-family-inventory.js";
import { validateRuleModelRegistryV2 } from "./rule-family-model.js";
import {
  getPreparedRuleModelMigrationAuthorityV2,
  type PreparedRuleModelMigrationV2,
} from "./rule-model-migration.js";
import { createRuleFamilyPublicationReviewRequestV2 } from "./rule-family-publication-review.js";
import { createFirstVerticalStructuredExecutionExemplarV2 } from "./structured-execution-exemplar.js";
import { readInventoryVersioned } from "./versioning.js";
import { validatePublicationReviewEvidence } from "./publication-review.js";

export { RULE_FAMILY_PUBLICATION_V2_MEMBER_PATHS } from "./rule-family-publication-record.js";

/** Stable semantic-review request reused by the version-two parent workflow. */
export type PublicationSemanticReviewRequestV1 = PublicationReviewRequestV1;

declare const ruleFamilyPublicationReviewV2Brand: unique symbol;

/** Opaque marker paired with an independently reviewable parent request. */
export interface RuleFamilyPublicationReviewV2 {
  readonly [ruleFamilyPublicationReviewV2Brand]: true;
}

declare const preparedRuleFamilyPublicationV2Brand: unique symbol;

/** One-use authority to select an already validated version-two parent. */
export interface PreparedRuleFamilyPublicationV2 {
  readonly [preparedRuleFamilyPublicationV2Brand]: true;
}

/** Input for read-only version-two parent review preparation. */
export interface PrepareRuleFamilyPublicationReviewInputV2 {
  readonly repositoryRoot: string;
  readonly migration: PreparedRuleModelMigrationV2;
}

/** Canonical review request and defensive bytes. */
export interface PreparedRuleFamilyPublicationReviewV2 {
  readonly review: RuleFamilyPublicationReviewV2;
  readonly request: PublicationSemanticReviewRequestV1;
  readonly requestBytes: Uint8Array;
}

/** Input for staging one independently reviewed version-two parent. */
export interface PrepareRuleFamilyPublicationInputV2 {
  readonly repositoryRoot: string;
  readonly migration: PreparedRuleModelMigrationV2;
  readonly semanticReviewBytes: Uint8Array;
}

/** Read-only facts for one staged version-two parent. */
export interface RuleFamilyPublicationPreviewV2 {
  readonly prepared: PreparedRuleFamilyPublicationV2;
  readonly predecessorPublicationDigest: Sha256Digest;
  readonly publicationDigest: Sha256Digest;
  readonly acceptedReviewDigest: Sha256Digest;
  readonly stagedRecord: PublishedRuleFamilyRecord;
}

/** Successful selected version-two parent transaction. */
export interface PublishedRuleFamilyTransactionV2 {
  readonly publicationDigest: Sha256Digest;
  readonly snapshot: PublishedRuleFamilySnapshotV2;
  readonly reusedExistingRelease: boolean;
}

interface PublicationAssemblyV2 {
  readonly repositoryRoot: string;
  readonly predecessorPublicationDigest: Sha256Digest;
  readonly bindings: readonly PublicationBindingRow[];
  readonly request: PublicationReviewRequestV1;
  readonly requestBytes: Uint8Array;
  readonly preliminaryMembers: ReadonlyMap<string, Uint8Array>;
}

interface PreparedPublicationStateV2 {
  readonly repositoryRoot: string;
  readonly predecessorPublicationDigest: Sha256Digest;
  readonly publicationDigest: Sha256Digest;
  readonly acceptedReviewDigest: Sha256Digest;
  readonly bindings: readonly PublicationBindingRow[];
  readonly members: ReadonlyMap<string, Uint8Array>;
  readonly manifest: RuleFamilyPublicationManifestV2;
  readonly manifestBytes: Uint8Array;
}

interface ParentDirectoriesV2 {
  readonly publication: PublicationDirectoryIdentity;
  readonly releases: PublicationDirectoryIdentity;
}

const PREPARED = new WeakMap<object, PreparedPublicationStateV2>();
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const GENERATION_LOCK_PATH = "readiness/generated/.generation-lock";
const MAX_LOOSE_MEMBER_BYTES = 32 * 1024 * 1024;

function compatibleSuccess<T>(value: T): CompatiblePublicationResult<T> {
  return Object.freeze({ ok: true, value, diagnostics: EMPTY_DIAGNOSTICS });
}

function compatibleFailure<T>(
  code:
    | "publication.capability.invalid"
    | "publication.review.stale"
    | "publication.record.invalid"
    | "publication.io"
    | "publication.lock.contended",
  path: string,
  message: string,
  kind: "invalid" | "stale" | "io" | "contended" = "invalid",
): CompatiblePublicationResult<T> {
  return Object.freeze({
    ok: false,
    kind,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}

async function readLooseMember(
  repositoryRoot: string,
  relativePath: string,
): Promise<PublicationResult<Uint8Array>> {
  try {
    const path = join(repositoryRoot, relativePath);
    const metadata = await lstat(path);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.nlink !== 1 ||
      metadata.size > MAX_LOOSE_MEMBER_BYTES
    ) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        relativePath,
        "Publication source member must be one bounded regular file.",
      );
    }
    return publicationSuccess(new Uint8Array(await readFile(path)));
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      relativePath,
      "Publication source member could not be read safely.",
    );
  }
}

function currentBindingRows(
  migration: NonNullable<ReturnType<typeof getPreparedRuleModelMigrationAuthorityV2>>,
): readonly PublicationBindingRow[] {
  return Object.freeze(
    migration.document.handlers.map((row) =>
      Object.freeze({
        handlerId: row.handlerId,
        kind: row.kind,
        contractVersion: row.contractVersion,
        implementationRevision: row.toRevision,
      }),
    ),
  );
}

function bindingBytes(rows: readonly PublicationBindingRow[]): Uint8Array {
  return renderPublicationJson({
    schemaVersion: 2,
    kind: "rule-family-bindings-v2",
    bindings: rows,
  });
}

async function assemblePublicationV2(
  input: PrepareRuleFamilyPublicationReviewInputV2,
): Promise<PublicationResult<PublicationAssemblyV2>> {
  const migration = getPreparedRuleModelMigrationAuthorityV2(input.migration);
  if (migration === undefined) {
    return publicationFailure(
      "invalid",
      "publication.migration.invalid",
      "/migration",
      "Parent publication requires a genuine complete migration capability.",
    );
  }
  if (
    migration.targetModel === undefined ||
    migration.firstVerticalCandidate === undefined ||
    migration.fixtureSet === undefined
  ) {
    return publicationFailure(
      "invalid",
      "publication.migration.invalid",
      "/migration",
      "Canonical replay proves stored migration bytes but does not carry staging authorities.",
    );
  }
  const source = getPublishedRuleFamilyRecordAuthorityV2(migration.sourceRecord);
  if (source === undefined || source.repositoryRoot !== input.repositoryRoot) {
    return publicationFailure(
      "invalid",
      "publication.record.invalid",
      "/repositoryRoot",
      "Migration predecessor must belong to the same canonical repository.",
    );
  }
  const fixtureState = getEmbeddedCaseFixtureSetStateV2(migration.fixtureSet);
  const modelResult = validateRuleModelRegistryV2(migration.targetModel);
  const exemplar = createFirstVerticalStructuredExecutionExemplarV2();
  const inventoryBytes = source.members.get("compiler-readiness-v1.json");
  if (
    fixtureState === undefined ||
    !modelResult.ok ||
    !exemplar.ok ||
    inventoryBytes === undefined
  ) {
    return publicationFailure(
      "invalid",
      "publication.record.invalid",
      "/migration",
      "Migration authorities could not be reconstructed for publication.",
    );
  }
  const predecessorInventory = readInventoryVersioned(inventoryBytes);
  const successorInventory =
    predecessorInventory.ok && predecessorInventory.inventory !== undefined
      ? projectRuleFamilySuccessorInventoryV2(predecessorInventory.inventory)
      : undefined;
  if (
    successorInventory === undefined ||
    modelResult.model.inventoryDigest !== successorInventory.inventoryDigest
  ) {
    return publicationFailure(
      "invalid",
      "publication.record.invalid",
      "/migration",
      "Migration model and successor inventory authority do not agree.",
    );
  }
  const [bindingRejections, diagnosticOracle, ruleModelSeed] = await Promise.all([
    readLooseMember(input.repositoryRoot, "readiness/oracles/binding-rejections-v1.json"),
    readLooseMember(input.repositoryRoot, "readiness/oracles/diagnostic-oracle-v1.json"),
    readLooseMember(input.repositoryRoot, "readiness/rule-models/rule-model-seed-v1.json"),
  ]);
  if (!bindingRejections.ok) return bindingRejections;
  if (!diagnosticOracle.ok) return diagnosticOracle;
  if (!ruleModelSeed.ok) return ruleModelSeed;
  const bindings = currentBindingRows(migration);
  const preliminaryMembers = new Map<string, Uint8Array>([
    ["binding-rejections-v1.json", bindingRejections.value],
    ["bindings-v2.json", bindingBytes(bindings)],
    ["compiler-readiness-v1.json", successorInventory.canonicalBytes.slice()],
    ["diagnostic-oracle-v1.json", diagnosticOracle.value],
    ["embed-fixtures-v2.json", fixtureState.bytes.slice()],
    ["first-vertical-v2.json", renderPublicationJson(migration.firstVerticalCandidate)],
    ["migration-v2.json", migration.canonicalBytes.slice()],
    ["rule-model-seed-v1.json", ruleModelSeed.value],
    ["rule-models-v2.json", modelResult.canonicalBytes.slice()],
    ["structured-execution-exemplar-v2.json", exemplar.value.canonicalBytes.slice()],
  ]);
  const request = createRuleFamilyPublicationReviewRequestV2(
    migration,
    bindings,
    preliminaryMembers,
  );
  const requestBytes = renderPublicationJson(request);
  preliminaryMembers.set("rule-models-v2-review.json", requestBytes.slice());
  return publicationSuccess(
    Object.freeze({
      repositoryRoot: input.repositoryRoot,
      predecessorPublicationDigest: source.publicationDigest,
      bindings,
      request,
      requestBytes,
      preliminaryMembers,
    }),
  );
}

/** Prepares the exact digest-bound review request for a version-two parent. */
export async function prepareRuleFamilyPublicationReviewV2(
  input: PrepareRuleFamilyPublicationReviewInputV2,
): Promise<PublicationResult<PreparedRuleFamilyPublicationReviewV2>> {
  const assembled = await assemblePublicationV2(input);
  if (!assembled.ok) return assembled;
  const review = Object.freeze({}) as RuleFamilyPublicationReviewV2;
  return publicationSuccess(
    Object.freeze({
      review,
      request: assembled.value.request,
      requestBytes: assembled.value.requestBytes.slice(),
    }),
  );
}

/**
 * Validates independent review and stages an immutable version-two parent capability.
 *
 * @param input Complete migration and exact accepted semantic-review bytes.
 * @returns Readable staged record and one-use publication authority.
 */
export async function prepareRuleFamilyPublicationV2(
  input: PrepareRuleFamilyPublicationInputV2,
): Promise<PublicationResult<RuleFamilyPublicationPreviewV2>> {
  const assembled = await assemblePublicationV2(input);
  if (!assembled.ok) return assembled;
  const accepted = validatePublicationReviewEvidence(
    input.semanticReviewBytes,
    assembled.value.request,
  );
  if (!accepted.ok) return accepted;
  const members = new Map(assembled.value.preliminaryMembers);
  members.set("semantic-review-v2.json", accepted.value.slice());
  const manifest: RuleFamilyPublicationManifestV2 = Object.freeze({
    schemaVersion: 2,
    kind: "rule-family-publication-v2",
    predecessorPublicationDigest: assembled.value.predecessorPublicationDigest,
    members: Object.freeze(
      RULE_FAMILY_PUBLICATION_V2_MEMBER_PATHS.map((path) => {
        const bytes = members.get(path);
        if (bytes === undefined) throw new TypeError(`Missing version-two member: ${path}`);
        return Object.freeze({
          path,
          byteLength: bytes.byteLength,
          digest: digestPublicationBytes(bytes),
        });
      }),
    ),
  });
  const manifestBytes = renderRuleFamilyPublicationManifestV2(manifest);
  const publicationDigest = computeRuleFamilyPublicationDigestV2(manifestBytes);
  const prepared = Object.freeze({}) as PreparedRuleFamilyPublicationV2;
  const memberDigests = new Map(
    manifest.members.map(({ path, digest }) => [path, digest] as const),
  );
  const state: PreparedPublicationStateV2 = Object.freeze({
    repositoryRoot: assembled.value.repositoryRoot,
    predecessorPublicationDigest: assembled.value.predecessorPublicationDigest,
    publicationDigest,
    acceptedReviewDigest: digestPublicationBytes(accepted.value),
    bindings: assembled.value.bindings,
    members,
    manifest,
    manifestBytes,
  });
  PREPARED.set(prepared, state);
  const stagedRecord = createStagedPublishedRuleFamilyRecordV2({
    repositoryRoot: state.repositoryRoot,
    schemaVersion: 2,
    publicationDigest,
    predecessorPublicationDigest: state.predecessorPublicationDigest,
    bindings: state.bindings,
    members: state.members,
    memberDigests,
  });
  return publicationSuccess(
    Object.freeze({
      prepared,
      predecessorPublicationDigest: state.predecessorPublicationDigest,
      publicationDigest,
      acceptedReviewDigest: state.acceptedReviewDigest,
      stagedRecord,
    }),
  );
}

async function publicationDirectories(
  repositoryRoot: string,
): Promise<PublicationResult<ParentDirectoriesV2>> {
  const publication = await pinPublicationDirectory(join(repositoryRoot, PUBLICATION_ROOT_PATH));
  if (!publication.ok) return publication;
  const releases = await pinPublicationDirectory(join(repositoryRoot, PUBLICATION_RELEASES_PATH));
  return releases.ok
    ? publicationSuccess({ publication: publication.value, releases: releases.value })
    : releases;
}

async function promoteV2(
  state: PreparedPublicationStateV2,
): Promise<PublicationResult<{ readonly reusedExistingRelease: boolean }>> {
  const directories = await publicationDirectories(state.repositoryRoot);
  if (!directories.ok) return directories;
  const stagingName = `.rule-family-staging.${randomUUID()}`;
  const staging = await ensurePublicationChildDirectory(directories.value.publication, stagingName);
  if (!staging.ok) return staging;
  let keepStaging = true;
  try {
    for (const path of RULE_FAMILY_PUBLICATION_V2_MEMBER_PATHS) {
      const bytes = state.members.get(path);
      if (bytes === undefined) {
        return publicationFailure(
          "invalid",
          "publication.record.invalid",
          path,
          "Staged version-two member is absent.",
        );
      }
      const written = await writePublicationRegularFile(staging.value.identity, path, bytes);
      if (!written.ok) return written;
      await publicationFaultPoint("after-member-sync", {
        publicationDigest: state.publicationDigest,
        memberPath: path,
      });
    }
    const manifestWritten = await writePublicationRegularFile(
      staging.value.identity,
      "manifest.json",
      state.manifestBytes,
    );
    if (!manifestWritten.ok) return manifestWritten;
    await syncPublicationDirectory(staging.value.identity);
    await publicationFaultPoint("before-release-rename", {
      publicationDigest: state.publicationDigest,
    });
    const renamed = await renamePublicationEntry(
      directories.value.publication,
      stagingName,
      directories.value.releases,
      state.publicationDigest,
    );
    if (!renamed.ok) {
      if (renamed.kind !== "collision") return renamed;
      const existing = await resolvePublishedRuleFamilyRecordByDigestV2({
        repositoryRoot: state.repositoryRoot,
        publicationDigest: state.publicationDigest,
      });
      if (!existing.ok) return renamed;
      const removed = await removePublicationEntry(
        directories.value.publication,
        stagingName,
        true,
      );
      if (!removed.ok) return removed;
      keepStaging = false;
      await publicationFaultPoint("after-release-rename", {
        publicationDigest: state.publicationDigest,
      });
      return publicationSuccess({ reusedExistingRelease: true });
    }
    keepStaging = false;
    await publicationFaultPoint("after-release-rename", {
      publicationDigest: state.publicationDigest,
    });
    const synced = await syncPublicationDirectory(directories.value.releases);
    return synced.ok ? publicationSuccess({ reusedExistingRelease: false }) : synced;
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      PUBLICATION_ROOT_PATH,
      "Version-two release promotion was interrupted safely.",
    );
  } finally {
    if (keepStaging) {
      await removePublicationEntry(directories.value.publication, stagingName, true).catch(
        () => undefined,
      );
    }
  }
}

async function commitPointerV2(
  state: PreparedPublicationStateV2,
): Promise<PublicationResult<true>> {
  const directories = await publicationDirectories(state.repositoryRoot);
  if (!directories.ok) return directories;
  const temporaryName = `.current-rule-family.${randomUUID()}.tmp`;
  const written = await writePublicationRegularFile(
    directories.value.publication,
    temporaryName,
    renderRuleFamilyPublicationPointerV2(state.publicationDigest),
  );
  if (!written.ok) return written;
  try {
    await publicationFaultPoint("after-pointer-temporary-sync", {
      publicationDigest: state.publicationDigest,
    });
    const renamed = await renamePublicationEntry(
      directories.value.publication,
      temporaryName,
      directories.value.publication,
      "current-publication.json",
    );
    if (!renamed.ok) return renamed;
    await publicationFaultPoint("after-pointer-rename", {
      publicationDigest: state.publicationDigest,
    });
    const synced = await syncPublicationDirectory(directories.value.publication);
    return synced.ok ? publicationSuccess(true) : synced;
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      PUBLICATION_POINTER_PATH,
      "Version-two pointer commit was interrupted.",
    );
  } finally {
    await removePublicationEntry(directories.value.publication, temporaryName).catch(
      () => undefined,
    );
  }
}

/**
 * Promotes and selects one staged version-two parent through the existing failure boundaries.
 *
 * @param prepared One-use capability returned by preparation.
 * @returns Exact selected snapshot or a closed pre/post-commit failure.
 */
export async function publishRuleFamilyPublicationV2(
  prepared: PreparedRuleFamilyPublicationV2,
): Promise<CompatiblePublicationResult<PublishedRuleFamilyTransactionV2>> {
  const state =
    typeof prepared === "object" && prepared !== null ? PREPARED.get(prepared) : undefined;
  if (state === undefined) {
    return compatibleFailure(
      "publication.capability.invalid",
      "/prepared",
      "Version-two publication capability is invalid or already consumed.",
    );
  }
  PREPARED.delete(prepared);
  const lock = await acquireGenerationLock(join(state.repositoryRoot, GENERATION_LOCK_PATH));
  if (lock === undefined) {
    return compatibleFailure(
      "publication.lock.contended",
      GENERATION_LOCK_PATH,
      "Another readiness publisher owns the generation lock.",
      "contended",
    );
  }
  try {
    const predecessor = await verifyPreparedRuleFamilyPredecessorV2(state);
    if (!predecessor.ok) return predecessor;
    const promoted = await promoteV2(state);
    if (!promoted.ok) return promoted;
    try {
      await publicationFaultPoint("before-staged-validation", {
        publicationDigest: state.publicationDigest,
      });
      const record = await resolvePublishedRuleFamilyRecordByDigestV2({
        repositoryRoot: state.repositoryRoot,
        publicationDigest: state.publicationDigest,
      });
      if (!record.ok) return record;
      const authority = await acquirePublishedRuleFamilyAuthorityV2(record.value);
      if (!authority.ok) return authority;
      await publicationFaultPoint("after-staged-validation", {
        publicationDigest: state.publicationDigest,
      });
    } catch {
      return compatibleFailure(
        "publication.io",
        PUBLICATION_ROOT_PATH,
        "Staged version-two parent validation was interrupted.",
        "io",
      );
    }
    const committed = await commitPointerV2(state);
    const selected = await resolveCommittedRuleFamilyPublicationV2(state);
    if (!selected.ok) return committed.ok ? selected : committed;
    return compatibleSuccess(
      Object.freeze({
        publicationDigest: state.publicationDigest,
        snapshot: selected.value,
        reusedExistingRelease: promoted.value.reusedExistingRelease,
      }),
    );
  } catch {
    return compatibleFailure(
      "publication.io",
      PUBLICATION_ROOT_PATH,
      "Version-two publication transaction failed safely.",
      "io",
    );
  } finally {
    await lock.release();
  }
}
