import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";

import {
  currentPublicationConformance,
  publicationFaultPoint,
} from "./publication-conformance-v1.js";
import {
  ensurePublicationChildDirectory,
  pinPublicationDirectory,
  readPublicationDirectoryNames,
  readPublicationRegularFile,
  removePublicationEntry,
  renamePublicationEntry,
  syncPublicationDirectory,
  verifyPublicationDirectory,
  writePublicationRegularFile,
  type PublicationDirectoryIdentity,
} from "./publication-filesystem.js";
import {
  PUBLICATION_MEMBER_PATHS,
  PUBLICATION_POINTER_PATH,
  PUBLICATION_RELEASES_PATH,
  PUBLICATION_ROOT_PATH,
  publicationFailure,
  publicationSuccess,
  renderPublicationPointer,
  type PublicationRelease,
  type PublicationResult,
} from "./publication-model.js";

/** Result of durably promoting staged immutable release content. */
export interface PromotedPublicationRelease {
  /** Absolute immutable release directory. */
  readonly releaseRoot: string;
  /** Whether an exact immutable release already existed. */
  readonly reusedExistingRelease: boolean;
}

interface PublicationDirectories {
  readonly repository: PublicationDirectoryIdentity;
  readonly readiness: PublicationDirectoryIdentity;
  readonly publication: PublicationDirectoryIdentity;
  readonly releases: PublicationDirectoryIdentity;
}

async function ensurePublicationDirectories(
  repositoryRoot: string,
): Promise<PublicationResult<PublicationDirectories>> {
  const repository = await pinPublicationDirectory(repositoryRoot);
  if (!repository.ok) return repository;
  const readiness = await ensurePublicationChildDirectory(repository.value, "readiness");
  if (!readiness.ok) return readiness;
  if (readiness.value.created) {
    await publicationFaultPoint("after-publication-directory-sync", {
      memberPath: "readiness",
    });
  }
  const publication = await ensurePublicationChildDirectory(
    readiness.value.identity,
    "publications",
  );
  if (!publication.ok) return publication;
  if (publication.value.created) {
    await publicationFaultPoint("after-publication-directory-sync", {
      memberPath: "readiness/publications",
    });
  }
  const releases = await ensurePublicationChildDirectory(publication.value.identity, "releases");
  if (!releases.ok) return releases;
  if (releases.value.created) {
    await publicationFaultPoint("after-publication-directory-sync", {
      memberPath: "readiness/publications/releases",
    });
  }
  return publicationSuccess({
    repository: repository.value,
    readiness: readiness.value.identity,
    publication: publication.value.identity,
    releases: releases.value.identity,
  });
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

async function releaseMatches(releaseRoot: string, release: PublicationRelease): Promise<boolean> {
  const directory = await pinPublicationDirectory(releaseRoot);
  if (!directory.ok) return false;
  const expectedNames = [...PUBLICATION_MEMBER_PATHS, "manifest.json"].sort();
  const actualNames = await readPublicationDirectoryNames(directory.value, expectedNames.length);
  if (
    !actualNames.ok ||
    actualNames.value.length !== expectedNames.length ||
    [...actualNames.value].sort().some((name, index) => name !== expectedNames[index])
  ) {
    return false;
  }
  const manifest = await readPublicationRegularFile(
    join(releaseRoot, "manifest.json"),
    release.manifestBytes.byteLength,
    release.manifestBytes.byteLength,
  );
  if (!manifest.ok || !equalBytes(manifest.value.bytes, release.manifestBytes)) return false;
  for (const memberPath of PUBLICATION_MEMBER_PATHS) {
    const expected = release.members.get(memberPath);
    if (expected === undefined) return false;
    const member = await readPublicationRegularFile(
      join(releaseRoot, memberPath),
      expected.byteLength,
      expected.byteLength,
    );
    if (!member.ok || !equalBytes(member.value.bytes, expected)) return false;
  }
  return (await verifyPublicationDirectory(directory.value)).ok;
}

/**
 * Writes, synchronizes and promotes one complete immutable content-addressed release.
 *
 * This low-level operation is intentionally absent from the package public index.
 */
export async function promotePublicationRelease(
  repositoryRoot: string,
  release: PublicationRelease,
): Promise<PublicationResult<PromotedPublicationRelease>> {
  if (currentPublicationConformance()?.forceDurabilityUnsupported === true) {
    return publicationFailure(
      "durability-unsupported",
      "publication.durability-unsupported",
      PUBLICATION_ROOT_PATH,
      "Durable publication is unavailable for this operation.",
    );
  }
  const publicationRoot = join(repositoryRoot, PUBLICATION_ROOT_PATH);
  const releasesRoot = join(repositoryRoot, PUBLICATION_RELEASES_PATH);
  const stagingName = `.staging.${randomUUID()}`;
  const stagingRoot = join(publicationRoot, stagingName);
  const releaseRoot = join(releasesRoot, release.publicationDigest);
  let directories: Awaited<ReturnType<typeof ensurePublicationDirectories>>;
  let staging: Awaited<ReturnType<typeof ensurePublicationChildDirectory>>;
  try {
    directories = await ensurePublicationDirectories(repositoryRoot);
    if (!directories.ok) return directories;
    staging = await ensurePublicationChildDirectory(directories.value.publication, stagingName);
    if (!staging.ok) return staging;
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      PUBLICATION_ROOT_PATH,
      "Publication directory preparation failed safely.",
    );
  }

  let keepStaging = true;
  try {
    for (const memberPath of PUBLICATION_MEMBER_PATHS) {
      const bytes = release.members.get(memberPath);
      if (bytes === undefined) {
        return publicationFailure(
          "invalid",
          "publication.input.invalid",
          memberPath,
          "Staged release is missing a required member.",
        );
      }
      const written = await writePublicationRegularFile(staging.value.identity, memberPath, bytes);
      if (!written.ok) return written;
      await publicationFaultPoint("after-member-sync", {
        publicationDigest: release.publicationDigest,
        memberPath,
      });
    }
    const manifestWritten = await writePublicationRegularFile(
      staging.value.identity,
      "manifest.json",
      release.manifestBytes,
    );
    if (!manifestWritten.ok) return manifestWritten;
    await publicationFaultPoint("after-member-sync", {
      publicationDigest: release.publicationDigest,
      memberPath: "manifest.json",
    });
    const stagingSynced = await syncPublicationDirectory(staging.value.identity);
    if (!stagingSynced.ok) return stagingSynced;
    await publicationFaultPoint("after-staging-directory-sync", {
      publicationDigest: release.publicationDigest,
    });

    await publicationFaultPoint("before-release-rename", {
      publicationDigest: release.publicationDigest,
    });
    const renamed = await renamePublicationEntry(
      directories.value.publication,
      stagingName,
      directories.value.releases,
      release.publicationDigest,
    );
    if (!renamed.ok) {
      if (renamed.kind !== "collision") return renamed;
      if (!(await releaseMatches(releaseRoot, release))) {
        return publicationFailure(
          "collision",
          "publication.collision",
          releaseRoot,
          "Existing publication digest has unequal release bytes.",
        );
      }
      const removed = await removePublicationEntry(
        directories.value.publication,
        stagingName,
        true,
      );
      if (!removed.ok) return removed;
      keepStaging = false;
      await publicationFaultPoint("after-release-rename", {
        publicationDigest: release.publicationDigest,
      });
      const releasesSynced = await syncPublicationDirectory(directories.value.releases);
      if (!releasesSynced.ok) return releasesSynced;
      await publicationFaultPoint("after-releases-directory-sync", {
        publicationDigest: release.publicationDigest,
      });
      return publicationSuccess({
        releaseRoot,
        reusedExistingRelease: true,
      });
    }
    keepStaging = false;
    await publicationFaultPoint("after-release-rename", {
      publicationDigest: release.publicationDigest,
    });
    const publicationSynced = await syncPublicationDirectory(directories.value.publication);
    if (!publicationSynced.ok) return publicationSynced;
    const releasesSynced = await syncPublicationDirectory(directories.value.releases);
    if (!releasesSynced.ok) return releasesSynced;
    await publicationFaultPoint("after-releases-directory-sync", {
      publicationDigest: release.publicationDigest,
    });
    return publicationSuccess({
      releaseRoot,
      reusedExistingRelease: false,
    });
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      stagingRoot,
      "Publication staging failed before the commit point.",
    );
  } finally {
    if (keepStaging) {
      await removePublicationEntry(directories.value.publication, stagingName, true).catch(
        () => undefined,
      );
    }
  }
}

/**
 * Replaces the sole publication pointer through a synced temporary regular file.
 *
 * This low-level commit point is intentionally absent from the package public index.
 */
export async function commitPublicationPointer(
  repositoryRoot: string,
  release: PublicationRelease,
): Promise<PublicationResult<true>> {
  if (currentPublicationConformance()?.forceDurabilityUnsupported === true) {
    return publicationFailure(
      "durability-unsupported",
      "publication.durability-unsupported",
      PUBLICATION_ROOT_PATH,
      "Durable pointer replacement is unavailable for this operation.",
    );
  }
  const publicationRoot = join(repositoryRoot, PUBLICATION_ROOT_PATH);
  const pointerName = basename(PUBLICATION_POINTER_PATH);
  const temporaryName = `.current-publication.${randomUUID()}.tmp`;
  const bytes = renderPublicationPointer(release.publicationDigest);
  const repository = await pinPublicationDirectory(repositoryRoot);
  if (!repository.ok) return repository;
  const readiness = await pinPublicationDirectory(join(repositoryRoot, "readiness"));
  if (!readiness.ok) return readiness;
  const publication = await pinPublicationDirectory(publicationRoot);
  if (!publication.ok) return publication;
  const written = await writePublicationRegularFile(publication.value, temporaryName, bytes);
  if (!written.ok) return written;
  try {
    await publicationFaultPoint("after-pointer-temporary-sync", {
      publicationDigest: release.publicationDigest,
    });
    const renamed = await renamePublicationEntry(
      publication.value,
      temporaryName,
      publication.value,
      pointerName,
    );
    if (!renamed.ok) return renamed;
    await publicationFaultPoint("after-pointer-rename", {
      publicationDigest: release.publicationDigest,
    });
    const rootSynced = await syncPublicationDirectory(publication.value);
    if (!rootSynced.ok) return rootSynced;
    await publicationFaultPoint("after-publication-root-sync", {
      publicationDigest: release.publicationDigest,
    });
    return publicationSuccess(true);
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      PUBLICATION_POINTER_PATH,
      "Publication pointer could not be committed.",
    );
  } finally {
    await removePublicationEntry(publication.value, temporaryName).catch(() => undefined);
  }
}
