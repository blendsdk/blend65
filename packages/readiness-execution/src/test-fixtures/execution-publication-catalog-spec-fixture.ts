import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

import {
  prepareIncrementalBindingPublication,
  prepareIncrementalBindingPublicationReview,
  prepareExecutionPublicationCandidateV1,
  publishIncrementalBindingPublication,
  resolvePublishedExecutionRelease,
  resolvePublishedSnapshotByDigest,
} from "@blend65/readiness";
import type {
  PublicationReviewRequestV1,
  PublishedExecutionRelease,
  PublishedSnapshot,
} from "@blend65/readiness";

import { getExecutionCatalogFixtureDescriptorV1 } from "../execution-publication-catalog-conformance-v1.js";

export const CURRENT_EXECUTION_PARENT_DIGEST =
  "sha256:e1713db3ca7dc9d624d0f9e9cb064b6fdcfd3a3e2b0e2421b5c482e00f266905";
export const EXECUTION_SPEC_REVISION =
  "sha256:51860164138f80e23eabf7cfd685ed47a8faf486ff7aee36cc9f46d8b86e1ccd";

const EXECUTION_PUBLICATIONS_RELATIVE_PATH = join("readiness", "execution-publications");
const READINESS_BASE_PUBLICATION_DIGEST =
  "sha256:41afbb4512456470e0b182fb14edb5caeaac7688d7e36ba1e102fc8d42ae3403";
const READINESS_ORACLE_HANDLER_IDS = Object.freeze([
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
]);
const CURRENT_POINTER_RELATIVE_PATH = join(
  EXECUTION_PUBLICATIONS_RELATIVE_PATH,
  "current-execution-publication.json",
);

type Sha256Digest = `sha256:${string}`;

const SOURCE_REPOSITORY_ROOT = resolve(import.meta.dirname, "../../../..");
const HISTORICAL_PARENT_AUTHORITY_SNAPSHOT_ROOT = join(
  import.meta.dirname,
  "rd04-parent-authority",
);
const HISTORICAL_PARENT_AUTHORITY_OVERLAYS = [
  {
    snapshot: "readiness-package.json.snapshot",
    destination: join("packages", "readiness", "package.json"),
    sha256: "82a0b97f00640aa6cf05dfc13d8fc8bb9c33706dcbee9f037793441bbdc04a30",
  },
  {
    snapshot: "canonical-identity.ts.snapshot",
    destination: join("packages", "readiness", "src", "canonical-identity.ts"),
    sha256: "2cf3638dbd7dd921bc7c31d0dcd9905085d84d5e3306fe0fc22232a18e1437a0",
  },
  {
    snapshot: "index.ts.snapshot",
    destination: join("packages", "readiness", "src", "index.ts"),
    sha256: "9ac3267c455476edfc3555c549417331bd2a859061b12d5098aa1820ca4a442a",
  },
] as const;
const AUTHORITY_RELATIVE_PATHS = [
  "readiness",
  "spec",
  join("packages", "readiness", "src"),
  join("packages", "readiness", "package.json"),
] as const;
const MAX_AUTHORITY_FILES = 512;
const MAX_AUTHORITY_BYTES = 64 * 1024 * 1024;

interface AuthorityTreeSize {
  files: number;
  bytes: number;
}

function isExcludedAuthorityPath(path: string): boolean {
  const relativePath = relative(SOURCE_REPOSITORY_ROOT, path);
  return (
    relativePath === EXECUTION_PUBLICATIONS_RELATIVE_PATH ||
    relativePath.startsWith(`${EXECUTION_PUBLICATIONS_RELATIVE_PATH}${sep}`)
  );
}

async function inspectAuthorityPath(path: string, size: AuthorityTreeSize): Promise<void> {
  if (isExcludedAuthorityPath(path)) return;
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink()) {
    throw new Error(`authority fixture source must not contain a symbolic link: ${path}`);
  }
  if (metadata.isDirectory()) {
    const names = (await readdir(path)).sort();
    for (const name of names) await inspectAuthorityPath(join(path, name), size);
    return;
  }
  if (!metadata.isFile() || metadata.nlink !== 1) {
    throw new Error(
      `authority fixture source must contain only single-link regular files: ${path}`,
    );
  }
  size.files += 1;
  size.bytes += metadata.size;
  if (size.files > MAX_AUTHORITY_FILES || size.bytes > MAX_AUTHORITY_BYTES) {
    throw new Error("authority fixture source exceeds its file or byte bound");
  }
}

async function copyParentAuthority(repositoryRoot: string): Promise<void> {
  const size: AuthorityTreeSize = { files: 0, bytes: 0 };
  for (const relativePath of AUTHORITY_RELATIVE_PATHS) {
    await inspectAuthorityPath(join(SOURCE_REPOSITORY_ROOT, relativePath), size);
  }
  for (const relativePath of AUTHORITY_RELATIVE_PATHS) {
    const source = join(SOURCE_REPOSITORY_ROOT, relativePath);
    const destination = join(repositoryRoot, relativePath);
    await mkdir(resolve(destination, ".."), { recursive: true });
    await cp(source, destination, {
      recursive: true,
      force: false,
      errorOnExist: true,
      dereference: false,
      filter: (path) => !isExcludedAuthorityPath(path),
    });
  }
}

async function restoreHistoricalParentAuthority(repositoryRoot: string): Promise<void> {
  let restoredBytes = 0;
  for (const overlay of HISTORICAL_PARENT_AUTHORITY_OVERLAYS) {
    const source = join(HISTORICAL_PARENT_AUTHORITY_SNAPSHOT_ROOT, overlay.snapshot);
    const handle = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile() || metadata.nlink !== 1) {
        throw new Error(
          `historical authority overlay must be a single-link regular file: ${source}`,
        );
      }
      restoredBytes += metadata.size;
      if (restoredBytes > MAX_AUTHORITY_BYTES) {
        throw new Error("historical authority overlays exceed their byte bound");
      }
      const bytes = await handle.readFile();
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (digest !== overlay.sha256) {
        throw new Error(`historical authority overlay digest mismatch: ${source}`);
      }
      await writeFile(join(repositoryRoot, overlay.destination), bytes);
    } finally {
      await handle.close();
    }
  }
}

export interface ExecutionPublicationCatalogFixtureV1 {
  readonly repositoryRoot: string;
  readonly parentDigest: Sha256Digest;
  readonly childDigest: string;
  readonly release: PublishedExecutionRelease;
  readonly bindingBytes: Uint8Array;
  readonly semanticReviewBytes: Uint8Array;
  createChild(
    options?: CreateExecutionPublicationChildOptionsV1,
  ): Promise<ExecutionPublicationCatalogChildV1>;
  cleanup(): Promise<void>;
}

/** Exact historical parent authority resolved inside an isolated test repository. */
export interface HistoricalExecutionParentFixtureV1 {
  readonly repositoryRoot: string;
  readonly parentDigest: Sha256Digest;
  readonly parent: PublishedSnapshot;
  cleanup(): Promise<void>;
}

/** Bounded temporary repository containing exact historical readiness authority bytes. */
export interface HistoricalReadinessAuthorityFixtureV1 {
  readonly repositoryRoot: string;
  cleanup(): Promise<void>;
}

export interface ExecutionPublicationCatalogChildV1 {
  readonly childDigest: string;
  readonly release: PublishedExecutionRelease;
  readonly bindingBytes: Uint8Array;
  readonly semanticReviewBytes: Uint8Array;
}

export interface CreateExecutionPublicationChildOptionsV1 {
  readonly bindingBytes?: Uint8Array;
  readonly parentDigest?: Sha256Digest;
  readonly reviewer?: string;
}

interface OperationIssueV1 {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export function resolveCatalogSpecRepositoryRootV1(): string {
  return SOURCE_REPOSITORY_ROOT;
}

/** Copies exact hash-pinned historical readiness authority into an isolated repository. */
export async function createHistoricalReadinessAuthorityFixtureV1(): Promise<HistoricalReadinessAuthorityFixtureV1> {
  const sourceRepositoryRoot = resolveCatalogSpecRepositoryRootV1();
  const repositoryRoot = await mkdtemp(join(tmpdir(), "blend65-historical-readiness-authority-"));
  try {
    if (sourceRepositoryRoot !== SOURCE_REPOSITORY_ROOT) {
      throw new Error("catalog fixture repository root changed unexpectedly");
    }
    await copyParentAuthority(repositoryRoot);
    await restoreHistoricalParentAuthority(repositoryRoot);
    return {
      repositoryRoot,
      cleanup: async () => {
        await rm(repositoryRoot, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(repositoryRoot, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Stages current oracle bindings over the exact historical base in a bounded temporary repository.
 *
 * @returns The isolated repository, genuine resolved parent, and its cleanup operation.
 */
export async function createHistoricalExecutionParentFixtureV1(): Promise<HistoricalExecutionParentFixtureV1> {
  const authority = await createHistoricalReadinessAuthorityFixtureV1();
  try {
    await writeFile(
      join(authority.repositoryRoot, "readiness/publications/current-publication.json"),
      encodeCanonicalJsonV1({
        schemaVersion: 1,
        publicationDigest: READINESS_BASE_PUBLICATION_DIGEST,
      }),
    );
    const base = await resolvePublishedSnapshotByDigest({
      repositoryRoot: authority.repositoryRoot,
      publicationDigest: READINESS_BASE_PUBLICATION_DIGEST,
    });
    if (!base.ok) {
      throw new Error(
        base.diagnostics
          .map((issue) => `${issue.code} at ${issue.path}: ${issue.message}`)
          .join("; "),
      );
    }
    const review = await prepareIncrementalBindingPublicationReview({
      repositoryRoot: authority.repositoryRoot,
      baseSnapshot: base.value,
      targetHandlerIds: READINESS_ORACLE_HANDLER_IDS,
    });
    if (!review.ok) {
      throw new Error(
        review.diagnostics
          .map((issue) => `${issue.code} at ${issue.path}: ${issue.message}`)
          .join("; "),
      );
    }
    const staged = await prepareIncrementalBindingPublication({
      repositoryRoot: authority.repositoryRoot,
      baseSnapshot: base.value,
      targetHandlerIds: READINESS_ORACLE_HANDLER_IDS,
      semanticReviewBytes: createReadinessReviewBytes(review.value.request),
    });
    if (!staged.ok) {
      throw new Error(
        staged.diagnostics
          .map((issue) => `${issue.code} at ${issue.path}: ${issue.message}`)
          .join("; "),
      );
    }
    const published = await publishIncrementalBindingPublication(staged.value.prepared);
    if (!published.ok) {
      throw new Error(
        published.diagnostics
          .map((issue) => `${issue.code} at ${issue.path}: ${issue.message}`)
          .join("; "),
      );
    }
    return {
      repositoryRoot: authority.repositoryRoot,
      parentDigest: published.value.publicationDigest,
      parent: published.value.snapshot,
      cleanup: authority.cleanup,
    };
  } catch (error) {
    await authority.cleanup();
    throw error;
  }
}

function createReadinessReviewBytes(request: PublicationReviewRequestV1): Uint8Array {
  return encodeCanonicalJsonV1({
    schemaVersion: 1,
    reviews: request.reviewUnits.map((unit) => ({
      unitId: unit.unitId,
      reviewer: "execution publication catalog specification fixture",
      specRevision: request.specRevision,
      semanticDigest: unit.semanticDigest,
      dependencyDigests: unit.dependencyDigests,
      outcome: "accepted",
      resolvedDisagreementIds: [],
    })),
  });
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function encodeCanonicalJsonV1(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`);
}

function acceptedEvidenceDigest(label: string): string {
  return sha256(new TextEncoder().encode(label));
}

function createSemanticReviewBytes(
  parentDigest: Sha256Digest,
  bindingBytes: Uint8Array,
  reviewer: string,
): Uint8Array {
  return encodeCanonicalJsonV1({
    schemaVersion: 1,
    kind: "execution-semantic-review-v1",
    specRevision: EXECUTION_SPEC_REVISION,
    parentDigest,
    bindingDigest: sha256(bindingBytes),
    ciSafe: {
      digest: acceptedEvidenceDigest("execution-catalog-ci-safe"),
      outcome: "accepted",
    },
    coverage: {
      digest: acceptedEvidenceDigest("execution-catalog-coverage"),
      outcome: "accepted",
    },
    localAcmeVice: {
      digest: acceptedEvidenceDigest("execution-catalog-local-acme-vice"),
      outcome: "accepted",
    },
    unresolvedCritical: 0,
    unresolvedMajor: 0,
    reviewer,
    outcome: "accepted",
  });
}

async function createChild(
  repositoryRoot: string,
  options: CreateExecutionPublicationChildOptionsV1 = {},
): Promise<ExecutionPublicationCatalogChildV1> {
  const descriptor = getExecutionCatalogFixtureDescriptorV1();
  const bindingBytes = new Uint8Array(options.bindingBytes ?? descriptor.bindingBytes);
  const parentDigest = options.parentDigest ?? CURRENT_EXECUTION_PARENT_DIGEST;
  const semanticReviewBytes = createSemanticReviewBytes(
    parentDigest,
    bindingBytes,
    options.reviewer ?? "execution publication catalog specification fixture",
  );
  const candidateResult = await prepareExecutionPublicationCandidateV1({
    repositoryRoot,
    parentDigest,
    bindingBytes,
    semanticReviewBytes,
  });
  if (!candidateResult.ok) {
    throw new Error(
      candidateResult.issues
        .map((issue: OperationIssueV1) => `${issue.code} at ${issue.path}: ${issue.message}`)
        .join("; "),
    );
  }
  const candidate = candidateResult.value;
  const releaseResult = await resolvePublishedExecutionRelease(repositoryRoot, candidate.digest);
  if (!releaseResult.ok) {
    throw new Error(
      releaseResult.issues
        .map((issue: OperationIssueV1) => `${issue.code} at ${issue.path}: ${issue.message}`)
        .join("; "),
    );
  }

  return {
    childDigest: candidate.digest,
    release: releaseResult.value,
    bindingBytes,
    semanticReviewBytes,
  };
}

export async function createExecutionPublicationCatalogFixtureV1(
  options: CreateExecutionPublicationChildOptionsV1 = {},
): Promise<ExecutionPublicationCatalogFixtureV1> {
  const historicalParent = await createHistoricalExecutionParentFixtureV1();
  try {
    const parentDigest = options.parentDigest ?? historicalParent.parentDigest;
    const child = await createChild(historicalParent.repositoryRoot, {
      parentDigest,
      ...options,
    });

    return {
      repositoryRoot: historicalParent.repositoryRoot,
      parentDigest,
      childDigest: child.childDigest,
      release: child.release,
      bindingBytes: child.bindingBytes,
      semanticReviewBytes: child.semanticReviewBytes,
      createChild: async (childOptions = {}) =>
        createChild(historicalParent.repositoryRoot, {
          parentDigest,
          ...childOptions,
        }),
      cleanup: historicalParent.cleanup,
    };
  } catch (error) {
    await historicalParent.cleanup();
    throw error;
  }
}

export async function readCurrentPublicationPointerBytesV1(
  repositoryRoot: string,
): Promise<Uint8Array> {
  return new Uint8Array(await readFile(join(repositoryRoot, CURRENT_POINTER_RELATIVE_PATH)));
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nested.flat().sort();
}

export async function snapshotPublicationArtifactsV1(
  repositoryRoot: string,
  digest: string,
): Promise<Readonly<Record<string, Uint8Array>>> {
  const root = join(repositoryRoot, EXECUTION_PUBLICATIONS_RELATIVE_PATH);
  const files = await listFiles(root);
  const bareDigest = digest.replace(/^sha256:/u, "");
  const snapshot: Record<string, Uint8Array> = {};

  for (const path of files) {
    const bytes = new Uint8Array(await readFile(path));
    const relativePath = relative(root, path);
    const text = new TextDecoder().decode(bytes);
    if (
      relativePath.includes(bareDigest) ||
      relativePath.includes(digest) ||
      text.includes(digest)
    ) {
      snapshot[relativePath] = bytes;
    }
  }

  return Object.freeze(snapshot);
}
