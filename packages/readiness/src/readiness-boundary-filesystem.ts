import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { posix, resolve, sep } from "node:path";

import {
  READINESS_BOUNDARY_LIMITS,
  scanReadinessOracleBoundary,
  type ReadinessBoundaryDiagnosticCodeV1,
  type ReadinessBoundaryModuleV1,
  type ReadinessBoundaryScanResultV1,
} from "./readiness-boundary-core.js";

const PACKAGE_ROOT = "packages/readiness";
const SOURCE_ROOT = `${PACKAGE_ROOT}/src`;

function failure(
  code: ReadinessBoundaryDiagnosticCodeV1,
  path: string,
  message: string,
): ReadinessBoundaryScanResultV1 {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([
      Object.freeze({
        code,
        path,
        message: message.slice(0, 256),
      }),
    ]),
  });
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function isContained(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function isExcludedSource(path: string): boolean {
  return (
    path.includes("/test-fixtures/") ||
    path.includes("/generated/") ||
    path.endsWith(".d.ts") ||
    path.endsWith(".spec.test.ts") ||
    path.endsWith(".impl.test.ts")
  );
}

function isBoundaryEntry(path: string): boolean {
  const name = posix.basename(path);
  return /^oracle-.*\.ts$/u.test(name) || /^semantic-relations.*\.ts$/u.test(name);
}

function toRepositoryPath(relativePath: string): string {
  return sep === "/" ? relativePath : relativePath.split(sep).join("/");
}

/**
 * Loads the fixed readiness source tree and invokes the in-memory scanner.
 *
 * The adapter rejects symbolic links at the repository, source, directory, and
 * file boundaries. Canonical paths must stay below the fixed source root, file
 * descriptors are opened without following the final link, and discovery and
 * byte counts are enforced while work is accumulated.
 *
 * @param repositoryRoot Repository root containing `packages/readiness`.
 * @returns The same result shape as the in-memory graph scanner.
 */
export async function checkReadinessOracleBoundary(
  repositoryRoot: string,
): Promise<ReadinessBoundaryScanResultV1> {
  const root = resolve(repositoryRoot);
  const sourceRoot = resolve(root, SOURCE_ROOT);
  let canonicalRoot: string;
  let canonicalSourceRoot: string;
  try {
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      return failure(
        "readiness.boundary.input.invalid",
        "/modules",
        "Repository root must be a regular directory without symbolic links.",
      );
    }
    canonicalRoot = await realpath(root);
  } catch {
    return failure(
      "readiness.boundary.input.invalid",
      "/modules",
      "Repository root could not be inspected safely.",
    );
  }
  if (canonicalRoot !== root) {
    return failure(
      "readiness.boundary.input.invalid",
      "/modules",
      "Repository root must not traverse symbolic links.",
    );
  }
  try {
    const sourceStat = await lstat(sourceRoot);
    if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) {
      return failure(
        "readiness.boundary.input.invalid",
        "/modules",
        "Readiness source root must be a regular directory without symbolic links.",
      );
    }
    canonicalSourceRoot = await realpath(sourceRoot);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return scanReadinessOracleBoundary({
        schemaVersion: 1,
        packageRoot: PACKAGE_ROOT,
        entryPaths: [],
        modules: [],
      });
    }
    return failure(
      "readiness.boundary.input.invalid",
      "/modules",
      "Readiness source tree could not be inspected safely.",
    );
  }
  if (
    !isContained(canonicalRoot, canonicalSourceRoot) ||
    canonicalSourceRoot !== resolve(canonicalRoot, SOURCE_ROOT)
  ) {
    return failure(
      "readiness.boundary.input.invalid",
      "/modules",
      "Readiness source root escaped its canonical repository root.",
    );
  }

  const discovered: string[] = [];
  const pending: { readonly directory: string; readonly depth: number }[] = [
    { directory: sourceRoot, depth: 0 },
  ];
  let discoveryEntries = 0;
  while (pending.length > 0) {
    const item = pending.pop();
    if (item === undefined) break;
    let entries;
    try {
      const directoryStat = await lstat(item.directory);
      const canonicalDirectory = await realpath(item.directory);
      if (
        !directoryStat.isDirectory() ||
        directoryStat.isSymbolicLink() ||
        !isContained(canonicalSourceRoot, canonicalDirectory)
      ) {
        return failure(
          "readiness.boundary.input.invalid",
          "/modules",
          "Readiness source directory failed canonical containment.",
        );
      }
      entries = await readdir(item.directory, { withFileTypes: true });
    } catch {
      return failure(
        "readiness.boundary.input.invalid",
        "/modules",
        "Readiness source tree could not be enumerated safely.",
      );
    }
    for (const entry of entries) {
      discoveryEntries += 1;
      if (discoveryEntries > READINESS_BOUNDARY_LIMITS.modules) {
        return failure(
          "readiness.boundary.input.limit",
          "/modules",
          "Readiness source discovery exceeds the fixed entry limit.",
        );
      }
      const absolutePath = resolve(item.directory, entry.name);
      if (!isContained(sourceRoot, absolutePath)) {
        return failure(
          "readiness.boundary.input.invalid",
          "/modules",
          "Readiness source path escaped the fixed source root.",
        );
      }
      let entryStat;
      try {
        entryStat = await lstat(absolutePath);
      } catch {
        return failure(
          "readiness.boundary.input.invalid",
          "/modules",
          "Readiness source entry could not be inspected.",
        );
      }
      if (entryStat.isSymbolicLink()) {
        return failure(
          "readiness.boundary.input.invalid",
          "/modules",
          "Readiness source tree must not contain symbolic links.",
        );
      }
      if (entryStat.isDirectory()) {
        if (item.depth >= READINESS_BOUNDARY_LIMITS.graphDepth) {
          return failure(
            "readiness.boundary.input.limit",
            "/modules",
            "Readiness source tree exceeds the directory-depth limit.",
          );
        }
        pending.push({ directory: absolutePath, depth: item.depth + 1 });
        continue;
      }
      if (!entryStat.isFile()) {
        return failure(
          "readiness.boundary.input.invalid",
          "/modules",
          "Readiness source tree contains a non-regular entry.",
        );
      }
      if (!entry.name.endsWith(".ts")) continue;
      const relativePath = toRepositoryPath(absolutePath.slice(root.length + 1));
      if (isExcludedSource(relativePath)) continue;
      discovered.push(relativePath);
    }
  }

  discovered.sort((left, right) => left.localeCompare(right));
  const modules: ReadinessBoundaryModuleV1[] = [];
  let aggregateBytes = 0;
  for (const [index, path] of discovered.entries()) {
    const absolutePath = resolve(root, path);
    let handle;
    try {
      const canonicalFile = await realpath(absolutePath);
      if (!isContained(canonicalSourceRoot, canonicalFile)) {
        return failure(
          "readiness.boundary.input.invalid",
          `/modules/${index}`,
          "Readiness source file escaped its canonical source root.",
        );
      }
      handle = await open(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      const before = await handle.stat();
      if (!before.isFile() || before.size > READINESS_BOUNDARY_LIMITS.sourceBytes) {
        return failure(
          before.size > READINESS_BOUNDARY_LIMITS.sourceBytes
            ? "readiness.boundary.input.limit"
            : "readiness.boundary.input.invalid",
          `/modules/${index}/source`,
          "Readiness source must be a bounded regular file.",
        );
      }
      const source = new Uint8Array(await handle.readFile());
      const after = await handle.stat();
      if (
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs ||
        source.byteLength !== after.size
      ) {
        return failure(
          "readiness.boundary.input.invalid",
          `/modules/${index}/source`,
          "Readiness source changed while it was being read.",
        );
      }
      aggregateBytes += source.byteLength;
      if (aggregateBytes > READINESS_BOUNDARY_LIMITS.aggregateSourceBytes) {
        return failure(
          "readiness.boundary.input.limit",
          `/modules/${index}/source`,
          "Readiness source tree exceeds the aggregate byte limit.",
        );
      }
      modules.push(Object.freeze({ path, source }));
    } catch {
      return failure(
        "readiness.boundary.input.invalid",
        `/modules/${index}/source`,
        "Readiness source file could not be read safely.",
      );
    } finally {
      try {
        await handle?.close();
      } catch {
        return failure(
          "readiness.boundary.input.invalid",
          `/modules/${index}/source`,
          "Readiness source file descriptor could not be closed safely.",
        );
      }
    }
  }
  return scanReadinessOracleBoundary({
    schemaVersion: 1,
    packageRoot: PACKAGE_ROOT,
    entryPaths: Object.freeze(discovered.filter(isBoundaryEntry)),
    modules: Object.freeze(modules),
  });
}
