import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Execution tier assigned to one root test file. */
export type TestTier = "fast" | "integration" | "vice";

/** One classified test file with its repository-relative path. */
export interface ClassifiedTest {
  /** Forward-slash path relative to the repository root. */
  readonly file: string;
  /** Execution tier selected from the file's imports. */
  readonly tier: TestTier;
}

/**
 * VICE helpers launch and drive a real emulator. They are serialized because
 * concurrent x64sc instances contend for CPU and monitor ports.
 */
const VICE_IMPORT =
  /\b(?:startVice|stopVice|withLibraryVice|withVice|ViceMonitor|setAccessTracepoint(?:Range)?|vice-runtime|vice-fixture|vice-sources|vice-monitor|runProject)\b/u;

/**
 * Build/check helpers invoke the real public compiler and usually ACME. They
 * are host tests, but materially slower than pure unit tests.
 */
const BUILD_IMPORT =
  /\b(?:buildProject|checkProject|buildProfileSource|withProfileProject|withProject|withLibraryBuild|readProfileArtifacts)\b/u;

/** Classify one test source by its imported execution helpers. */
export function classifyTestSource(source: string): TestTier {
  if (VICE_IMPORT.test(source)) return "vice";
  if (BUILD_IMPORT.test(source)) return "integration";
  return "fast";
}

/** Recursively list every root test file and classify it once. */
function scan(root: string): readonly ClassifiedTest[] {
  const testRoot = join(root, "test");
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith(".test.ts")) files.push(path);
    }
  };
  walk(testRoot);
  return Object.freeze(
    files
      .map((path) => relative(root, path).split(sep).join("/"))
      .sort()
      .map((file) =>
        Object.freeze({ file, tier: classifyTestSource(readFileSync(join(root, file), "utf8")) }),
      ),
  );
}

let cached: readonly ClassifiedTest[] | undefined;

/** Return the repository's root test inventory, classified once per process. */
export function classifiedRootTests(root = process.cwd()): readonly ClassifiedTest[] {
  cached ??= scan(root);
  return cached;
}

/** Return the repository-relative files assigned to one execution tier. */
export function filesForTier(tier: TestTier, root = process.cwd()): readonly string[] {
  return classifiedRootTests(root)
    .filter((entry) => entry.tier === tier)
    .map((entry) => entry.file);
}
