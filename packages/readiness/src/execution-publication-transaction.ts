import { randomUUID } from "node:crypto";
import { lstat } from "node:fs/promises";
import { basename, join } from "node:path";

import type { ExecutionIssueV1, ExecutionOperationResultV1 } from "./execution-contracts.js";
import {
  executionPublicationFaultPointV1,
  executionPublicationReconciliationObservationV1,
  type ExecutionPublicationReconciliationObservationV1,
} from "./execution-publication-conformance-v1.js";
import {
  CURRENT_EXECUTION_PUBLICATION_FILENAME,
  EXECUTION_MANIFEST_V1_FILENAME,
  EXECUTION_PUBLICATION_MEMBER_LIMIT,
  EXECUTION_PUBLICATION_RELEASE_LIMIT,
  EXECUTION_PUBLICATIONS_ROOT,
  createExecutionPublicationV1,
  equalExecutionPublicationBytes,
  executionFilesystemFailure,
  executionPublicationFailure,
  executionPublicationSuccess,
  parseExecutionPublicationPointerV1,
  renderExecutionPublicationPointer,
  type ValidatedExecutionPublicationV1,
} from "./execution-publication-model.js";
import {
  getPublishedExecutionReleaseDescriptorV1,
  pinExecutionPublicationDirectoryChainV1,
  resolvePublishedExecutionRelease,
  validateExecutionPublicationReleaseDirectoryV1,
  validateExecutionPublicationRepositoryRootV1,
  verifyExecutionPublicationDirectoryChainV1,
  type PublishedExecutionRelease,
} from "./execution-publication-resolver.js";
import {
  ensurePublicationChildDirectory,
  pinPublicationDirectory,
  readPublicationDirectoryNames,
  readPublicationRegularFile,
  removePublicationEntry,
  renamePublicationEntry,
  syncPublicationDirectory,
  writePublicationRegularFile,
  type PublicationDirectoryIdentity,
} from "./publication-filesystem.js";
import {
  getPublishedSnapshotAuthority,
  resolvePublishedSnapshotByDigest,
} from "./publication-resolver.js";
import { isExecutionDigest, readExecutionRecord } from "./execution-validation.js";

/** Content-addressed passive child created without selecting it. */
export interface ExecutionPublicationCandidateV1 {
  readonly digest: string;
  readonly parentDigest: string;
  readonly bindingDigest: string;
  readonly semanticReviewDigest: string;
}

/** Closed candidate-preparation input whose bytes are defensively copied before I/O. */
export interface PrepareExecutionPublicationInputV1 {
  readonly repositoryRoot: string;
  readonly parentDigest: string;
  readonly bindingBytes: Uint8Array;
  readonly semanticReviewBytes: Uint8Array;
}

/** One stable passive inspection diagnostic. */
export interface ExecutionPublicationDiagnosticV1 {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

/** Bounded selected-child and release-directory inspection. */
export interface ExecutionPublicationInspectionV1 {
  readonly selectedDigest?: string;
  readonly releases: readonly string[];
  readonly diagnostics: readonly ExecutionPublicationDiagnosticV1[];
}

interface ExecutionPublicationDirectoriesV1 {
  readonly repository: PublicationDirectoryIdentity;
  readonly readiness: PublicationDirectoryIdentity;
  readonly publication: PublicationDirectoryIdentity;
  readonly releases: PublicationDirectoryIdentity;
}

async function ensureExecutionPublicationDirectories(
  repositoryRoot: string,
): Promise<ExecutionOperationResultV1<ExecutionPublicationDirectoriesV1>> {
  const repository = await pinPublicationDirectory(repositoryRoot);
  if (!repository.ok) return executionFilesystemFailure(repository);
  const readiness = await ensurePublicationChildDirectory(repository.value, "readiness");
  if (!readiness.ok) return executionFilesystemFailure(readiness);
  const publication = await ensurePublicationChildDirectory(
    readiness.value.identity,
    basename(EXECUTION_PUBLICATIONS_ROOT),
  );
  if (!publication.ok) return executionFilesystemFailure(publication);
  const releases = await ensurePublicationChildDirectory(publication.value.identity, "releases");
  if (!releases.ok) return executionFilesystemFailure(releases);
  return executionPublicationSuccess({
    repository: repository.value,
    readiness: readiness.value.identity,
    publication: publication.value.identity,
    releases: releases.value.identity,
  });
}

function candidate(release: ValidatedExecutionPublicationV1): ExecutionPublicationCandidateV1 {
  return Object.freeze({
    digest: release.digest,
    parentDigest: release.parentDigest,
    bindingDigest: release.bindingDigest,
    semanticReviewDigest: release.semanticReviewDigest,
  });
}

function parsePrepareInput(
  input: unknown,
): ExecutionOperationResultV1<PrepareExecutionPublicationInputV1> {
  const record = readExecutionRecord(input, [
    "repositoryRoot",
    "parentDigest",
    "bindingBytes",
    "semanticReviewBytes",
  ]);
  if (
    record === undefined ||
    typeof record.repositoryRoot !== "string" ||
    typeof record.parentDigest !== "string" ||
    !(record.bindingBytes instanceof Uint8Array) ||
    !(record.semanticReviewBytes instanceof Uint8Array) ||
    record.bindingBytes.byteLength === 0 ||
    record.bindingBytes.byteLength > EXECUTION_PUBLICATION_MEMBER_LIMIT ||
    record.semanticReviewBytes.byteLength === 0 ||
    record.semanticReviewBytes.byteLength > EXECUTION_PUBLICATION_MEMBER_LIMIT
  ) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "",
      "Execution publication input must have the exact closed byte-bearing shape.",
    );
  }
  return executionPublicationSuccess(
    Object.freeze({
      repositoryRoot: record.repositoryRoot,
      parentDigest: record.parentDigest,
      bindingBytes: record.bindingBytes,
      semanticReviewBytes: record.semanticReviewBytes,
    }),
  );
}

async function exactExistingRelease(
  repositoryRoot: string,
  releaseRoot: string,
  expected: ValidatedExecutionPublicationV1,
): Promise<boolean> {
  const existing = await validateExecutionPublicationReleaseDirectoryV1(
    repositoryRoot,
    releaseRoot,
    expected.digest,
  );
  if (!existing.ok) return false;
  if (!equalExecutionPublicationBytes(existing.value.manifestBytes, expected.manifestBytes)) {
    return false;
  }
  for (const [path, bytes] of expected.members) {
    const actual = existing.value.members.get(path);
    if (actual === undefined || !equalExecutionPublicationBytes(actual, bytes)) return false;
  }
  return true;
}

/**
 * Writes and promotes a complete immutable execution child without selecting it.
 *
 * Every input byte is copied before the first await. Staging validation reconstructs review,
 * parent, manifest, and member joins from the final synced bytes.
 */
export async function prepareExecutionPublicationCandidateV1(
  rawInput: PrepareExecutionPublicationInputV1,
): Promise<ExecutionOperationResultV1<ExecutionPublicationCandidateV1>> {
  const parsed = parsePrepareInput(rawInput);
  if (!parsed.ok) return parsed;
  const prepared = createExecutionPublicationV1(parsed.value);
  if (!prepared.ok) return prepared;
  const root = await validateExecutionPublicationRepositoryRootV1(parsed.value.repositoryRoot);
  if (!root.ok) return root;
  if (!isExecutionDigest(parsed.value.parentDigest)) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "/parentDigest",
      "Execution publication parent must be a canonical SHA-256 digest.",
    );
  }
  const parent = await resolvePublishedSnapshotByDigest({
    repositoryRoot: root.value,
    publicationDigest: parsed.value.parentDigest,
  });
  if (!parent.ok) {
    return executionPublicationFailure(
      "execution.stale-authority",
      "/parentDigest",
      "Execution publication parent is unavailable or incompatible.",
    );
  }
  const parentAuthority = getPublishedSnapshotAuthority(parent.value);
  if (
    parentAuthority === undefined ||
    prepared.value.semanticReviewSpecRevision !== parentAuthority.inventory.specRevision
  ) {
    return executionPublicationFailure(
      "execution.stale-authority",
      "/specRevision",
      "Execution semantic review names a different parent inventory revision.",
    );
  }
  const directories = await ensureExecutionPublicationDirectories(root.value);
  if (!directories.ok) return directories;
  const stagingName = `.execution-staging.${randomUUID()}`;
  const staging = await ensurePublicationChildDirectory(directories.value.publication, stagingName);
  if (!staging.ok) return executionFilesystemFailure(staging);
  const stagingRoot = staging.value.identity.path;
  const releaseRoot = join(directories.value.releases.path, prepared.value.digest);
  let keepStaging = true;
  let operation: ExecutionOperationResultV1<ExecutionPublicationCandidateV1>;
  try {
    operation = await (async () => {
      for (const [path, bytes] of prepared.value.members) {
        const written = await writePublicationRegularFile(staging.value.identity, path, bytes);
        if (!written.ok) return executionFilesystemFailure(written);
        await executionPublicationFaultPointV1("after-member-sync", {
          publicationDigest: prepared.value.digest,
          memberPath: path,
        });
      }
      const manifestWritten = await writePublicationRegularFile(
        staging.value.identity,
        EXECUTION_MANIFEST_V1_FILENAME,
        prepared.value.manifestBytes,
      );
      if (!manifestWritten.ok) return executionFilesystemFailure(manifestWritten);
      await executionPublicationFaultPointV1("after-member-sync", {
        publicationDigest: prepared.value.digest,
        memberPath: EXECUTION_MANIFEST_V1_FILENAME,
      });
      const stagedSync = await syncPublicationDirectory(staging.value.identity);
      if (!stagedSync.ok) return executionFilesystemFailure(stagedSync);
      await executionPublicationFaultPointV1("after-staging-sync", {
        publicationDigest: prepared.value.digest,
      });
      await executionPublicationFaultPointV1("before-review-validation", {
        publicationDigest: prepared.value.digest,
      });
      const validated = await validateExecutionPublicationReleaseDirectoryV1(
        root.value,
        stagingRoot,
        prepared.value.digest,
      );
      if (!validated.ok) return validated;
      await executionPublicationFaultPointV1("after-review-validation", {
        publicationDigest: prepared.value.digest,
      });
      await executionPublicationFaultPointV1("before-release-rename", {
        publicationDigest: prepared.value.digest,
      });
      const renamed = await renamePublicationEntry(
        directories.value.publication,
        stagingName,
        directories.value.releases,
        prepared.value.digest,
      );
      if (!renamed.ok) {
        if (
          renamed.kind !== "collision" ||
          !(await exactExistingRelease(root.value, releaseRoot, prepared.value))
        ) {
          return executionFilesystemFailure(renamed);
        }
        const removed = await removePublicationEntry(
          directories.value.publication,
          stagingName,
          true,
        );
        if (!removed.ok) return executionFilesystemFailure(removed);
      }
      keepStaging = false;
      await executionPublicationFaultPointV1("after-release-rename", {
        publicationDigest: prepared.value.digest,
      });
      const releasesSync = await syncPublicationDirectory(directories.value.releases);
      if (!releasesSync.ok) return executionFilesystemFailure(releasesSync);
      await executionPublicationFaultPointV1("after-releases-sync", {
        publicationDigest: prepared.value.digest,
      });
      const final = await validateExecutionPublicationReleaseDirectoryV1(
        root.value,
        releaseRoot,
        prepared.value.digest,
      );
      return final.ok ? executionPublicationSuccess(candidate(final.value)) : final;
    })();
  } catch {
    operation = executionPublicationFailure(
      "execution.io",
      "",
      "Execution publication staging failed safely at a durable boundary.",
    );
  }
  if (keepStaging) {
    try {
      const removed = await removePublicationEntry(
        directories.value.publication,
        stagingName,
        true,
      );
      if (!removed.ok) return executionFilesystemFailure(removed);
    } catch {
      return executionPublicationFailure(
        "execution.io",
        "",
        "Execution publication staging cleanup failed and residue may remain.",
      );
    }
  }
  return operation;
}

async function readPointerDigest(
  repositoryRoot: string,
): Promise<ExecutionOperationResultV1<string>> {
  const read = await readPublicationRegularFile(
    join(repositoryRoot, EXECUTION_PUBLICATIONS_ROOT, CURRENT_EXECUTION_PUBLICATION_FILENAME),
    512,
  );
  if (!read.ok) return executionFilesystemFailure(read);
  const parsed = parseExecutionPublicationPointerV1(read.value.bytes);
  return parsed.ok ? executionPublicationSuccess(parsed.value.publicationDigest) : parsed;
}

async function pointerExists(repositoryRoot: string): Promise<ExecutionOperationResultV1<boolean>> {
  const path = join(
    repositoryRoot,
    EXECUTION_PUBLICATIONS_ROOT,
    CURRENT_EXECUTION_PUBLICATION_FILENAME,
  );
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return executionPublicationFailure(
        "execution.identity",
        "",
        "Selected execution publication pointer is not a regular file.",
      );
    }
    return executionPublicationSuccess(true);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return executionPublicationSuccess(false);
    }
    return executionPublicationFailure(
      "execution.io",
      "",
      "Selected execution publication pointer could not be inspected safely.",
    );
  }
}

async function reconcileSelection(
  repositoryRoot: string,
  expectedDigest: string,
  originalFailure: ExecutionOperationResultV1<never>,
): Promise<ExecutionOperationResultV1<PublishedExecutionRelease>> {
  let selectedDigest: string | undefined;
  const presence = await pointerExists(repositoryRoot);
  let state: ExecutionPublicationReconciliationObservationV1["state"];
  if (!presence.ok) {
    state = "ambiguous";
  } else if (!presence.value) {
    state = "prior-selection";
  } else {
    const selected = await readPointerDigest(repositoryRoot);
    if (selected.ok) {
      selectedDigest = selected.value;
      state = selected.value === expectedDigest ? "committed" : "prior-selection";
    } else {
      state = "ambiguous";
    }
  }
  await executionPublicationReconciliationObservationV1({
    operation: "execution-publication-selection",
    expectedDigest,
    ...(selectedDigest === undefined ? {} : { selectedDigest }),
    state,
  });
  try {
    await executionPublicationFaultPointV1("during-reconciliation", {
      expectedDigest,
      selectedDigest,
      state,
    });
  } catch {
    return executionPublicationFailure(
      "execution.reconciliation",
      "",
      "Execution publication selection could not be classified safely.",
    );
  }
  if (state === "committed") {
    return resolvePublishedExecutionRelease(repositoryRoot, expectedDigest);
  }
  return state === "ambiguous"
    ? executionPublicationFailure(
        "execution.reconciliation",
        "",
        "Execution publication selection could not be classified safely.",
      )
    : originalFailure;
}

/**
 * Durably selects one fully revalidated child with a same-transaction freshness callback.
 *
 * This primitive is intentionally absent from the readiness package root. The live catalog owner
 * invokes it only after pinning the same passive release and repeats freshness immediately before
 * the pointer rename commit point.
 */
export async function commitExecutionPublicationSelectionV1(
  repositoryRoot: string,
  digest: string,
  revalidateImmediatelyBeforeCommit: () => ExecutionOperationResultV1<true>,
): Promise<ExecutionOperationResultV1<PublishedExecutionRelease>> {
  if (typeof revalidateImmediatelyBeforeCommit !== "function") {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "/revalidateImmediatelyBeforeCommit",
      "Execution selection requires one closed synchronous freshness callback.",
    );
  }
  const release = await resolvePublishedExecutionRelease(repositoryRoot, digest);
  if (!release.ok) return release;
  const descriptor = getPublishedExecutionReleaseDescriptorV1(release.value);
  if (descriptor === undefined || descriptor.digest !== digest) {
    return executionPublicationFailure(
      "execution.identity",
      "/digest",
      "Execution release could not be pinned before selection.",
    );
  }
  const directories = await ensureExecutionPublicationDirectories(repositoryRoot);
  if (!directories.ok) return directories;
  const pointerName = CURRENT_EXECUTION_PUBLICATION_FILENAME;
  const temporaryName = `.execution-pointer.${randomUUID()}.tmp`;
  const pointerBytes = renderExecutionPublicationPointer(digest);
  let temporaryCreated = false;
  const ioFailure = executionPublicationFailure<never>(
    "execution.io",
    "",
    "Execution publication pointer replacement failed safely.",
  );
  try {
    await executionPublicationFaultPointV1("before-pointer-write", { publicationDigest: digest });
    const written = await writePublicationRegularFile(
      directories.value.publication,
      temporaryName,
      pointerBytes,
    );
    if (!written.ok) {
      return reconcileSelection(repositoryRoot, digest, executionFilesystemFailure<never>(written));
    }
    temporaryCreated = true;
    await executionPublicationFaultPointV1("after-pointer-file-sync", {
      publicationDigest: digest,
    });
    let fresh: ExecutionOperationResultV1<true>;
    try {
      fresh = revalidateImmediatelyBeforeCommit();
    } catch {
      return executionPublicationFailure(
        "execution.stale-authority",
        "",
        "Live execution closure changed immediately before selection.",
      );
    }
    if (!fresh.ok) return fresh;
    await executionPublicationFaultPointV1("before-pointer-rename", {
      publicationDigest: digest,
    });
    const renamed = await renamePublicationEntry(
      directories.value.publication,
      temporaryName,
      directories.value.publication,
      pointerName,
    );
    if (!renamed.ok) {
      return reconcileSelection(repositoryRoot, digest, executionFilesystemFailure<never>(renamed));
    }
    temporaryCreated = false;
    await executionPublicationFaultPointV1("after-pointer-rename", {
      publicationDigest: digest,
    });
    const synced = await syncPublicationDirectory(directories.value.publication);
    if (!synced.ok) {
      return reconcileSelection(repositoryRoot, digest, executionFilesystemFailure<never>(synced));
    }
    await executionPublicationFaultPointV1("after-pointer-directory-sync", {
      publicationDigest: digest,
    });
    return resolvePublishedExecutionRelease(repositoryRoot, digest);
  } catch {
    return reconcileSelection(repositoryRoot, digest, ioFailure);
  } finally {
    if (temporaryCreated) {
      await removePublicationEntry(directories.value.publication, temporaryName).catch(
        () => undefined,
      );
    }
  }
}

/** Performs a bounded passive inspection without mutating or resolving live authority. */
export async function inspectExecutionPublicationV1(
  repositoryRoot: string,
): Promise<ExecutionOperationResultV1<ExecutionPublicationInspectionV1>> {
  const root = await validateExecutionPublicationRepositoryRootV1(repositoryRoot);
  if (!root.ok) return root;
  const publicationRoot = join(root.value, EXECUTION_PUBLICATIONS_ROOT);
  try {
    const stat = await lstat(publicationRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      return executionPublicationFailure(
        "execution.io",
        "",
        "Execution publication root is not a real directory.",
      );
    }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return executionPublicationSuccess(
        Object.freeze({ releases: Object.freeze([]), diagnostics: Object.freeze([]) }),
      );
    }
    return executionPublicationFailure(
      "execution.io",
      "",
      "Execution publication root could not be inspected safely.",
    );
  }
  const publication = await pinExecutionPublicationDirectoryChainV1(root.value, publicationRoot);
  if (!publication.ok) return publication;
  const publicationIdentity = publication.value.at(-1);
  if (publicationIdentity === undefined) {
    return executionPublicationFailure(
      "execution.identity",
      "",
      "Execution publication directory chain is incomplete.",
    );
  }
  const publicationNames = await readPublicationDirectoryNames(
    publicationIdentity,
    EXECUTION_PUBLICATION_RELEASE_LIMIT + 1_024,
  );
  if (!publicationNames.ok) return executionFilesystemFailure(publicationNames);
  const publicationVerified = await verifyExecutionPublicationDirectoryChainV1(publication.value);
  if (!publicationVerified.ok) return publicationVerified;
  const diagnostics: ExecutionIssueV1[] = [];
  for (const name of publicationNames.value) {
    if (name === "releases" || name === CURRENT_EXECUTION_PUBLICATION_FILENAME) continue;
    const path = join(publicationRoot, name);
    try {
      const stat = await lstat(path);
      const residue =
        /^\.execution-staging\.[0-9a-f-]+$/u.test(name) ||
        /^\.execution-pointer\.[0-9a-f-]+\.tmp$/u.test(name);
      diagnostics.push(
        Object.freeze({
          code:
            residue && !stat.isSymbolicLink() && (stat.isDirectory() || stat.isFile())
              ? "execution.io"
              : "execution.identity",
          path: `/${name}`,
          message: residue
            ? "Execution publication cleanup residue requires operator inspection."
            : "Execution publication root contains an unexpected entry.",
        }),
      );
    } catch {
      diagnostics.push(
        Object.freeze({
          code: "execution.io",
          path: `/${name}`,
          message: "Execution publication entry could not be inspected safely.",
        }),
      );
    }
  }
  const releasesRoot = join(publicationRoot, "releases");
  const releasesDirectory = await pinExecutionPublicationDirectoryChainV1(root.value, releasesRoot);
  if (!releasesDirectory.ok) return releasesDirectory;
  const releasesIdentity = releasesDirectory.value.at(-1);
  if (releasesIdentity === undefined) {
    return executionPublicationFailure(
      "execution.identity",
      "",
      "Execution releases directory chain is incomplete.",
    );
  }
  const releaseNames = await readPublicationDirectoryNames(
    releasesIdentity,
    EXECUTION_PUBLICATION_RELEASE_LIMIT,
  );
  if (!releaseNames.ok) return executionFilesystemFailure(releaseNames);
  const releasesVerified = await verifyExecutionPublicationDirectoryChainV1(
    releasesDirectory.value,
  );
  if (!releasesVerified.ok) return releasesVerified;
  const releases: string[] = [];
  for (const name of releaseNames.value) {
    const path = join(releasesRoot, name);
    let stat: Awaited<ReturnType<typeof lstat>>;
    try {
      stat = await lstat(path);
    } catch {
      diagnostics.push(
        Object.freeze({
          code: "execution.io",
          path: `/releases/${name}`,
          message: "Execution release entry could not be inspected safely.",
        }),
      );
      continue;
    }
    if (!isExecutionDigest(name)) {
      diagnostics.push(
        Object.freeze({
          code: "execution.invalid-schema",
          path: `/releases/${name}`,
          message: "Execution release entry does not have a canonical digest name.",
        }),
      );
      continue;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      diagnostics.push(
        Object.freeze({
          code: "execution.identity",
          path: `/releases/${name}`,
          message: "Digest-named execution release is not a real directory.",
        }),
      );
    } else {
      releases.push(name);
    }
  }
  const releaseEntriesVerified = await verifyExecutionPublicationDirectoryChainV1(
    releasesDirectory.value,
  );
  if (!releaseEntriesVerified.ok) return releaseEntriesVerified;
  releases.sort();
  let selectedDigest: string | undefined;
  const presence = await pointerExists(root.value);
  if (!presence.ok) {
    diagnostics.push(...presence.issues);
  } else if (presence.value) {
    const selected = await readPointerDigest(root.value);
    if (selected.ok) {
      if (!releases.includes(selected.value)) {
        diagnostics.push(
          Object.freeze({
            code: "execution.stale-authority",
            path: "",
            message: "Selected execution publication does not name an immutable release.",
          }),
        );
      } else {
        const resolved = await resolvePublishedExecutionRelease(root.value, selected.value);
        if (resolved.ok) {
          selectedDigest = selected.value;
        } else {
          diagnostics.push(...resolved.issues);
        }
      }
    } else {
      diagnostics.push(...selected.issues);
    }
  }
  return executionPublicationSuccess(
    Object.freeze({
      ...(selectedDigest === undefined ? {} : { selectedDigest }),
      releases: Object.freeze(releases),
      diagnostics: Object.freeze(diagnostics),
    }),
  );
}
