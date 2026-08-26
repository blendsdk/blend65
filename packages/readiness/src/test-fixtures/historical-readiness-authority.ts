import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, open, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

const SOURCE_REPOSITORY_ROOT = resolve(import.meta.dirname, "../../../..");
const AUTHORITY_RELATIVE_PATHS = [
  "readiness",
  "spec",
  join("packages", "readiness", "src"),
  join("packages", "readiness", "package.json"),
] as const;
const EXCLUDED_EXECUTION_PUBLICATIONS = join("readiness", "execution-publications");
const HISTORICAL_PARENT_AUTHORITY_SNAPSHOT_ROOT = join(
  SOURCE_REPOSITORY_ROOT,
  "packages/readiness-execution/src/test-fixtures/rd04-parent-authority",
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
const MAX_AUTHORITY_FILES = 512;
const MAX_AUTHORITY_BYTES = 64 * 1024 * 1024;

interface AuthorityTreeSize {
  files: number;
  bytes: number;
}

function isExcludedAuthorityPath(path: string): boolean {
  const relativePath = relative(SOURCE_REPOSITORY_ROOT, path);
  return (
    relativePath === EXCLUDED_EXECUTION_PUBLICATIONS ||
    relativePath.startsWith(`${EXCLUDED_EXECUTION_PUBLICATIONS}${sep}`)
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

async function copyCurrentAuthority(repositoryRoot: string): Promise<void> {
  const size: AuthorityTreeSize = { files: 0, bytes: 0 };
  for (const relativePath of AUTHORITY_RELATIVE_PATHS) {
    await inspectAuthorityPath(join(SOURCE_REPOSITORY_ROOT, relativePath), size);
  }
  for (const relativePath of AUTHORITY_RELATIVE_PATHS) {
    const source = join(SOURCE_REPOSITORY_ROOT, relativePath);
    const destination = join(repositoryRoot, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, {
      recursive: true,
      force: false,
      errorOnExist: true,
      dereference: false,
      filter: (path) => !isExcludedAuthorityPath(path),
    });
  }
}

/** Restores the immutable parent authority files inside an isolated repository copy. */
export async function restoreHistoricalReadinessAuthority(repositoryRoot: string): Promise<void> {
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
      if (createHash("sha256").update(bytes).digest("hex") !== overlay.sha256) {
        throw new Error(`historical authority overlay digest mismatch: ${source}`);
      }
      await writeFile(join(repositoryRoot, overlay.destination), bytes);
    } finally {
      await handle.close();
    }
  }
}

/** Creates a bounded repository whose authority matches the immutable RD-04 parent bytes. */
export async function createHistoricalReadinessAuthorityRepository(
  prefix: string,
): Promise<string> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), prefix));
  try {
    await copyCurrentAuthority(repositoryRoot);
    await restoreHistoricalReadinessAuthority(repositoryRoot);
    return repositoryRoot;
  } catch (error) {
    await rm(repositoryRoot, { recursive: true, force: true });
    throw error;
  }
}
