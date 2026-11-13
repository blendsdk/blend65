import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyTestSource } from "../test/test-tiers.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const vitest = join(root, "node_modules/vitest/vitest.mjs");
const yarn = process.platform === "win32" ? "yarn.cmd" : "yarn";
const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const baseIndex = args.indexOf("--base");
const base = baseIndex >= 0 ? args[baseIndex + 1] : undefined;

/** Run one child command from the repository root and stop on failure. */
function run(command, commandArgs, cwd = root) {
  process.stdout.write(`\n▶ ${command} ${commandArgs.join(" ")}\n`);
  const result = spawnSync(command, commandArgs, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Run Vitest with an explicit config and optional file filters. */
function vitestRun(config, filters = []) {
  run(process.execPath, [
    vitest,
    "run",
    "--config",
    config,
    ...filters,
    "--reporter=dot",
    "--silent",
  ]);
}

/** Read changed paths from Git, including untracked files. */
function changedFiles() {
  const paths = new Set();
  const status = spawnSync("git", ["status", "--porcelain=v1", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  if (status.status !== 0) throw new Error("git status failed");
  for (const entry of status.stdout.split("\0")) {
    if (entry.length < 4) continue;
    const path = entry.slice(3);
    if (path.includes(" -> ")) paths.add(path.split(" -> ").at(-1));
    else paths.add(path);
  }
  if (base !== undefined) {
    const diff = spawnSync("git", ["diff", "--name-only", "-z", `${base}...HEAD`], {
      cwd: root,
      encoding: "utf8",
    });
    if (diff.status !== 0) throw new Error(`git diff against ${base} failed`);
    for (const path of diff.stdout.split("\0")) if (path.length > 0) paths.add(path);
  }
  return [...paths].sort();
}

/** Collect every test file below one changed test directory. */
function testsUnder(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return path.endsWith(".test.ts") ? [path] : [];
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = join(directory, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".test.ts"))
        found.push(relative(root, child).split(sep).join("/"));
    }
  };
  walk(absolute);
  return found;
}

const changed = changedFiles();
if (changed.length === 0) {
  process.stdout.write("No changed files.\n");
  process.exit(0);
}
if (changed.some((path) => path === "spec" || path.startsWith("spec/"))) {
  process.stderr.write("Frozen spec/ changed: run the complete release checkpoint.\n");
  process.exit(2);
}

const docsOnly = changed.every(
  (path) => path.endsWith(".md") || path.startsWith("docs/") || path.startsWith("codeops/"),
);
if (docsOnly) {
  process.stdout.write("Documentation-only change: formatting check only.\n");
  run(yarn, ["prettier", "--check", ...changed]);
  process.exit(0);
}

const compilerAreas = new Set();
const packageTests = [];
const changedRootTests = [];
let testInfrastructureChanged = false;
for (const path of changed) {
  if (path.startsWith("vitest.") || path === "scripts/run-root-tests.mjs")
    testInfrastructureChanged = true;
  else if (path.startsWith("test/") && !path.endsWith(".test.ts")) testInfrastructureChanged = true;
  else if (
    path === "packages/compiler/package.json" ||
    path.startsWith("packages/compiler/vitest.")
  )
    compilerAreas.add("all");
  else if (path.startsWith("packages/compiler/src/")) {
    const relativePath = path.slice("packages/compiler/src/".length);
    const area = relativePath.includes("/") ? relativePath.slice(0, relativePath.indexOf("/")) : "";
    if (area === "") compilerAreas.add("all");
    else compilerAreas.add(area);
  } else if (path.startsWith("packages/cli/")) packageTests.push("@blend65/cli");
  else if (path.startsWith("packages/language-server/"))
    packageTests.push("@blend65/language-server");
  else if (path.startsWith("packages/vscode/")) packageTests.push("@blend65/vscode");
  else if (path.startsWith("test/")) changedRootTests.push(...testsUnder(path));
}

// The fast tier is the inner loop and always runs first.
vitestRun("vitest.fast.config.ts");

// Run only the changed compiler areas instead of the complete package suite.
if (compilerAreas.has("all")) {
  run(yarn, ["workspace", "@blend65/compiler", "vitest", "run", "--reporter=dot", "--silent"]);
} else {
  for (const area of [...compilerAreas].sort())
    run("yarn", [
      "workspace",
      "@blend65/compiler",
      "vitest",
      "run",
      `src/${area}`,
      "--reporter=dot",
      "--silent",
    ]);
}
for (const name of [...new Set(packageTests)].sort())
  run(yarn, ["workspace", name, "test", "--reporter=dot", "--silent"]);

// Run only the changed root test files, in their classified tier.
const rootByTier = new Map([
  ["fast", []],
  ["integration", []],
  ["vice", []],
]);
for (const path of [...new Set(changedRootTests)]) {
  const tier = classifyTestSource(readFileSync(join(root, path), "utf8"));
  rootByTier.get(tier)?.push(path);
}
if (rootByTier.get("integration").length > 0)
  vitestRun("vitest.integration.config.ts", rootByTier.get("integration"));
if (rootByTier.get("vice").length > 0) vitestRun("vitest.vice.config.ts", rootByTier.get("vice"));

if (
  testInfrastructureChanged &&
  !flags.has("--host") &&
  !flags.has("--vice") &&
  !flags.has("--full")
) {
  process.stdout.write("\nTest infrastructure changed: running the complete host root tier.\n");
  vitestRun("vitest.host.config.ts");
}

if (flags.has("--host") || flags.has("--full")) vitestRun("vitest.host.config.ts");
if (flags.has("--vice") || flags.has("--full")) vitestRun("vitest.vice.config.ts");

if (
  compilerAreas.size > 0 &&
  !flags.has("--host") &&
  !flags.has("--vice") &&
  !flags.has("--full")
) {
  process.stdout.write(
    "\nChanged compiler areas: " +
      [...compilerAreas].sort().join(", ") +
      "\nRun `yarn test:host` (and `yarn test:vice` for lowering, SFA, interrupt or layout work) before a checkpoint.\n",
  );
}
