import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_MANIFESTS = Object.freeze([
  {
    prefix: "packages/readiness/",
    module: "../packages/readiness/dist/test-fixtures/rd05-coverage-sources.js",
  },
  {
    prefix: "packages/readiness-execution/",
    module: "../packages/readiness-execution/dist/test-fixtures/rd05-coverage-sources.js",
  },
]);
const PRODUCTION_SOURCE = /^packages\/(readiness|readiness-execution)\/src\/.+\.ts$/u;

/** Runs Git without a shell and returns its standard output without path-damaging trimming. */
function git(arguments_) {
  return execFileSync("git", arguments_, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Splits NUL-delimited Git paths so quoted, escaped, and newline-bearing names stay exact. */
function paths(output) {
  if (output.length === 0) return [];
  if (!output.endsWith("\0")) throw new TypeError("Git path output must be NUL terminated.");
  return output.slice(0, -1).split("\0");
}

/** Reports whether a changed file is shipped production source governed by this gate. */
function isProductionSource(path) {
  return (
    PRODUCTION_SOURCE.test(path) && !path.includes(".test.") && !path.includes("/test-fixtures/")
  );
}

/** Loads one compiled checked manifest and prefixes its package-relative paths. */
async function loadManifest(definition) {
  const source = await import(new URL(definition.module, import.meta.url));
  if (
    typeof source.rd05PreimplementationAncestor !== "string" ||
    !/^[0-9a-f]{40}$/u.test(source.rd05PreimplementationAncestor) ||
    !Array.isArray(source.rd05CoverageFiles) ||
    !Array.isArray(source.rd05ParticipatingExistingFiles) ||
    !Array.isArray(source.rd05ReviewOnlyExclusions)
  ) {
    throw new TypeError(`Invalid coverage manifest for ${definition.prefix}`);
  }
  const qualify = (path) => `${definition.prefix}${path}`;
  return {
    baseline: source.rd05PreimplementationAncestor,
    declared: new Set([
      ...source.rd05CoverageFiles.map(qualify),
      ...source.rd05ParticipatingExistingFiles.map(qualify),
      ...source.rd05ReviewOnlyExclusions.map(qualify),
    ]),
  };
}

const manifests = await Promise.all(PACKAGE_MANIFESTS.map(loadManifest));
const baselines = new Set(manifests.map((manifest) => manifest.baseline));
if (baselines.size !== 1)
  throw new Error("RD-05 package manifests disagree on the baseline commit.");
const [baseline] = baselines;
git(["cat-file", "-e", `${baseline}^{commit}`]);
try {
  git(["merge-base", "--is-ancestor", baseline, "HEAD"]);
} catch {
  throw new Error(`RD-05 baseline ${baseline} is not an ancestor of HEAD.`);
}

const changed = new Set([
  ...paths(git(["diff", "--name-only", "-z", "--diff-filter=ACMR", `${baseline}...HEAD`])),
  ...paths(git(["diff", "--name-only", "-z", "--diff-filter=ACMR", "--cached"])),
  ...paths(git(["diff", "--name-only", "-z", "--diff-filter=ACMR"])),
  ...paths(git(["ls-files", "-z", "--others", "--exclude-standard"])),
]);
const declared = new Set(manifests.flatMap((manifest) => [...manifest.declared]));
const unowned = [...changed]
  .filter(isProductionSource)
  .filter((path) => !declared.has(path))
  .sort();
if (unowned.length > 0) {
  throw new Error(`RD-05 production sources lack coverage ownership:\n${unowned.join("\n")}`);
}

process.stdout.write(
  `RD-05 coverage ownership is complete for ${[...changed].filter(isProductionSource).length} changed production source files.\n`,
);
