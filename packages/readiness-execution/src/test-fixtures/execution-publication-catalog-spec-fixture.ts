import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

import {
  prepareExecutionPublicationCandidateV1,
  resolvePublishedExecutionRelease,
} from "@blend65/readiness";
import type { PublishedExecutionRelease } from "@blend65/readiness";

import { getExecutionCatalogFixtureDescriptorV1 } from "../execution-publication-catalog-conformance-v1.js";

export const CURRENT_EXECUTION_PARENT_DIGEST =
  "sha256:e5796e6f2abab401100f93547b4044c57a762b9ec7703e6183fda2c07afcd3e5";
export const EXECUTION_SPEC_REVISION =
  "sha256:51860164138f80e23eabf7cfd685ed47a8faf486ff7aee36cc9f46d8b86e1ccd";

const EXECUTION_PUBLICATIONS_RELATIVE_PATH = join("readiness", "execution-publications");
const CURRENT_POINTER_RELATIVE_PATH = join(
  EXECUTION_PUBLICATIONS_RELATIVE_PATH,
  "current-execution-publication.json",
);

type Sha256Digest = `sha256:${string}`;

const SOURCE_REPOSITORY_ROOT = resolve(import.meta.dirname, "../../../..");
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
  const sourceRepositoryRoot = resolveCatalogSpecRepositoryRootV1();
  const repositoryRoot = await mkdtemp(join(tmpdir(), "blend65-execution-publication-catalog-"));
  if (sourceRepositoryRoot !== SOURCE_REPOSITORY_ROOT) {
    throw new Error("catalog fixture repository root changed unexpectedly");
  }
  await copyParentAuthority(repositoryRoot);

  const child = await createChild(repositoryRoot, options);
  const parentDigest = options.parentDigest ?? CURRENT_EXECUTION_PARENT_DIGEST;

  return {
    repositoryRoot,
    parentDigest,
    childDigest: child.childDigest,
    release: child.release,
    bindingBytes: child.bindingBytes,
    semanticReviewBytes: child.semanticReviewBytes,
    createChild: async (childOptions = {}) =>
      createChild(repositoryRoot, {
        parentDigest,
        ...childOptions,
      }),
    cleanup: async () => {
      await rm(repositoryRoot, { recursive: true, force: true });
    },
  };
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
