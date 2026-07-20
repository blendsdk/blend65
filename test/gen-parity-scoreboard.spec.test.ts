/**
 * Specification tests for the parity-scoreboard generator script.
 *
 * The generator renders the committed scoreboard from repo state: per-pair
 * byte/cycle ratios, measured columns from committed data only, and
 * per-pair routing sections. Routing is ENFORCED before any output: every
 * computed divergence group needs a routing entry, and every routing key
 * needs computed rows — an unrouted or stale group aborts generation with
 * nothing written. Input paths (--out, --manifest, --budgets) must resolve
 * inside the repository, and malformed input fails loudly under the
 * script's own stderr prefix.
 *
 * Negative cases run against temp ONE-PAIR manifests staged inside the
 * repo — committed assets are never touched. Runs the script as a child
 * process (argv array). Requires the built packages and ACME (both in CI).
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts", "gen-parity-scoreboard.mjs");
const GOLDEN_DIR = join(ROOT, "packages", "test-harness", "test", "golden");
const COMMITTED_MANIFEST = join(GOLDEN_DIR, "twins.json");
const COMMITTED_BUDGETS = join(GOLDEN_DIR, "budgets.json");
const COMMITTED_SCOREBOARD = join(GOLDEN_DIR, "SCOREBOARD.md");

/** Every corpus pair the committed scoreboard must list. */
const CORPUS_PAIRS = [
  "gate",
  "slice3a",
  "slice3b",
  "slice4a",
  "slice4b",
  "slice5a",
  "slice5b",
  "slice6",
  "slice7",
  "slice7b",
  "slice8",
  "slice8b",
  "guards",
  "rasterpoll",
  "balloon",
];

/** Whether real ACME is on PATH (the pair assembly needs it). */
function hasAcme(): boolean {
  try {
    return execFileSync("which", ["acme"], { encoding: "utf8" }).trim().length > 0;
  } catch {
    return false;
  }
}

/** Whether the compiler package is built (the script needs its dist). */
function hasDist(): boolean {
  return existsSync(join(ROOT, "packages", "compiler", "dist", "index.js"));
}

/** Run the generator; return {status, stderr} without throwing. */
function runGenerator(args: string[]): { status: number; stderr: string } {
  try {
    execFileSync("node", [SCRIPT, ...args], { cwd: ROOT, stdio: "pipe" });
    return { status: 0, stderr: "" };
  } catch (error) {
    const failure = error as { status?: number; stderr?: Buffer };
    return { status: failure.status ?? 1, stderr: String(failure.stderr ?? "") };
  }
}

/**
 * Stage a ONE-PAIR manifest (the committed balloon entry with `routing`
 * replaced as given) in a scratch dir inside the repo; returns its paths.
 */
function stageManifest(routing: unknown): { dir: string; manifestPath: string; outPath: string } {
  const dir = mkdtempSync(join(ROOT, "test", ".tmp-scoreboard-"));
  const committed = JSON.parse(readFileSync(COMMITTED_MANIFEST, "utf8"));
  const balloon = { ...committed.pairs.balloon };
  if (routing === undefined) {
    delete balloon.routing;
  } else {
    balloon.routing = routing;
  }
  const manifestPath = join(dir, "twins.json");
  writeFileSync(manifestPath, JSON.stringify({ pairs: { balloon } }, null, 2), "utf8");
  return { dir, manifestPath, outPath: join(dir, "SCOREBOARD.md") };
}

const GENERATOR_TIMEOUT = 240000;

describe.skipIf(!(hasAcme() && hasDist()))("Specification: parity-scoreboard generator", () => {
  it(
    "should abort naming pair and category when a computed divergence group has no routing entry",
    () => {
      const { dir, manifestPath, outPath } = stageManifest(undefined);
      try {
        const { status, stderr } = runGenerator(["--manifest", manifestPath, "--out", outPath]);
        expect(status).not.toBe(0);
        expect(stderr).toMatch(/balloon/);
        expect(stderr).toMatch(/instruction selection|layout/);
        expect(existsSync(outPath)).toBe(false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    GENERATOR_TIMEOUT,
  );

  it(
    "should abort naming a stale routing key whose category has no computed rows",
    () => {
      const { dir, manifestPath, outPath } = stageManifest({
        "instruction selection": [{ disposition: "parity" }],
        layout: [{ disposition: "parity" }],
        "register usage": [{ disposition: "parity" }],
      });
      try {
        const { status, stderr } = runGenerator(["--manifest", manifestPath, "--out", outPath]);
        expect(status).not.toBe(0);
        expect(stderr).toMatch(/stale/i);
        expect(stderr).toMatch(/register usage/);
        expect(existsSync(outPath)).toBe(false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    GENERATOR_TIMEOUT,
  );

  it(
    "should render a fully routed one-pair manifest, measured columns from committed data",
    () => {
      const { dir, manifestPath, outPath } = stageManifest({
        // The source-forced annotation is exercised here, on a staged row,
        // rather than through whichever corpus pair happens to carry the flag
        // — the renderer's coverage should not depend on real routing data
        // keeping a particular shape.
        "instruction selection": [
          { disposition: "parity" },
          {
            disposition: "data/placement",
            issue: 49,
            sourceForced: true,
            note: "staged: a divergence the source itself forces",
          },
        ],
        layout: [{ disposition: "parity" }],
        "data placement": [{ disposition: "parity" }],
      });
      try {
        const { status } = runGenerator(["--manifest", manifestPath, "--out", outPath]);
        expect(status).toBe(0);
        const scoreboard = readFileSync(outPath, "utf8");
        expect(scoreboard).toContain("balloon");
        expect(scoreboard).toMatch(/\d+\.\d{2}/);
        // Measured columns are carried through from committed data, never
        // re-measured here — the generated side from budgets.json, the twin
        // side from the manifest. Both are read rather than written out as
        // literals so a legitimate re-measurement does not fail this wiring
        // check; a generator that ignored either file still would.
        const budgets = JSON.parse(readFileSync(COMMITTED_BUDGETS, "utf8"));
        const twins = JSON.parse(readFileSync(COMMITTED_MANIFEST, "utf8"));
        const measuredGen = budgets.programs.balloon.windows[0].measuredMaxCycles;
        const measuredTwin = twins.pairs.balloon.measured.cycles;
        expect(measuredGen).toBeGreaterThan(0);
        expect(measuredTwin).toBeGreaterThan(0);
        expect(scoreboard).toContain(String(measuredGen));
        expect(scoreboard).toContain(String(measuredTwin));
        expect(scoreboard).toContain("**source-forced**");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    GENERATOR_TIMEOUT,
  );

  it("should reject an --out path outside the repository before any build work", () => {
    const outside = join(ROOT, "..", "evil-scoreboard.md");
    const { status, stderr } = runGenerator(["--out", outside]);
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/outside the repository/i);
    expect(stderr).toMatch(/^gen-parity-scoreboard: /m);
    expect(existsSync(outside)).toBe(false);
  });

  it(
    "should render byte-identical output across consecutive runs, matching the committed scoreboard",
    () => {
      const dir = mkdtempSync(join(ROOT, "test", ".tmp-scoreboard-"));
      try {
        const firstOut = join(dir, "run1.md");
        const secondOut = join(dir, "run2.md");
        expect(runGenerator(["--out", firstOut]).status).toBe(0);
        expect(runGenerator(["--out", secondOut]).status).toBe(0);
        const first = readFileSync(firstOut, "utf8");
        expect(first).toBe(readFileSync(secondOut, "utf8"));
        // The committed scoreboard IS this output — the CI freshness step
        // regenerates and diffs exactly this equality.
        expect(first).toBe(readFileSync(COMMITTED_SCOREBOARD, "utf8"));

        for (const pair of CORPUS_PAIRS) {
          expect(first).toContain(`| ${pair} |`);
        }
        expect(first).toContain("| **Total** |");
        expect(first).toMatch(/\d+\.\d{2}/);
        // Balloon measured columns come from committed data only — read from
        // the two manifests rather than pinned as literals, so re-measuring
        // does not fail this row while a generator that stopped sourcing
        // either file still would.
        const budgets = JSON.parse(readFileSync(COMMITTED_BUDGETS, "utf8"));
        const twins = JSON.parse(readFileSync(COMMITTED_MANIFEST, "utf8"));
        const measuredGen: number = budgets.programs.balloon.windows[0].measuredMaxCycles;
        const measuredTwin: number = twins.pairs.balloon.measured.cycles;
        const ratio = (measuredGen / measuredTwin).toFixed(2);
        expect(first).toContain(`| balloon |`);
        expect(first).toMatch(
          new RegExp(`\\| balloon \\|.*\\| ${measuredGen} \\| ${measuredTwin} \\| ${ratio} \\|`),
        );
        // Routing sections carry issue links. The source-forced annotation is
        // asserted against a staged manifest above instead: no corpus pair
        // carries the flag today, and requiring one would mean keeping a
        // routing claim alive purely to satisfy a test.
        expect(first).toContain("[#49](https://github.com/blendsdk/blend65/issues/49)");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    GENERATOR_TIMEOUT,
  );

  it(
    "should render different output when a committed measured value is mutated",
    () => {
      const dir = mkdtempSync(join(ROOT, "test", ".tmp-scoreboard-"));
      try {
        const budgets = JSON.parse(readFileSync(COMMITTED_BUDGETS, "utf8"));
        const window = budgets.programs.balloon.windows.find(
          (entry: { name: string }) => entry.name === "frameUpdate",
        );
        window.measuredMaxCycles += 1;
        const budgetsPath = join(dir, "budgets.json");
        writeFileSync(budgetsPath, JSON.stringify(budgets, null, 2), "utf8");
        const outPath = join(dir, "mutated.md");
        expect(runGenerator(["--budgets", budgetsPath, "--out", outPath]).status).toBe(0);
        // Stale committed data would fail the CI freshness diff; a
        // regenerate clears it.
        expect(readFileSync(outPath, "utf8")).not.toBe(readFileSync(COMMITTED_SCOREBOARD, "utf8"));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    GENERATOR_TIMEOUT,
  );

  it(
    "should fail loudly on malformed manifest JSON, naming the file under the script prefix",
    () => {
      const dir = mkdtempSync(join(ROOT, "test", ".tmp-scoreboard-"));
      try {
        const manifestPath = join(dir, "twins.json");
        writeFileSync(manifestPath, "{ not json", "utf8");
        const { status, stderr } = runGenerator([
          "--manifest",
          manifestPath,
          "--out",
          join(dir, "SCOREBOARD.md"),
        ]);
        expect(status).not.toBe(0);
        expect(stderr).toMatch(/^gen-parity-scoreboard: /m);
        expect(stderr).toMatch(/twins\.json/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    GENERATOR_TIMEOUT,
  );
});
