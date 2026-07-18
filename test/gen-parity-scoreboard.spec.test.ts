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
const COMMITTED_MANIFEST = join(ROOT, "packages", "test-harness", "test", "golden", "twins.json");

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
        "instruction selection": [{ disposition: "parity" }],
        layout: [{ disposition: "parity" }],
      });
      try {
        const { status } = runGenerator(["--manifest", manifestPath, "--out", outPath]);
        expect(status).toBe(0);
        const scoreboard = readFileSync(outPath, "utf8");
        expect(scoreboard).toContain("balloon");
        expect(scoreboard).toMatch(/\d+\.\d{2}/);
        // Measured columns: generated from budgets.json, twin from the manifest.
        expect(scoreboard).toContain("162");
        expect(scoreboard).toContain("97");
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
