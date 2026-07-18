/**
 * Specification tests for the twin-diff parity scoreboard script.
 *
 * The script pairs each committed golden with its hand-written twin (the
 * pair manifest), assembles BOTH sides through real ACME, and reports parity
 * ratios (generated ÷ hand-written, two decimals): bytes from the assembled
 * PRG sizes, cycles as the max-sum ÷ max-sum of the classified instruction
 * streams. Divergences each carry exactly one category; goldens without a
 * twin are listed as unpaired; the JSON output carries min and max cycle
 * sums per side. Input paths must resolve inside the repository.
 *
 * Runs the script as a child process (argv array), exactly as a developer
 * or CI would. Requires the built packages and ACME (both present in CI).
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts", "twin-diff.mjs");

/** The five divergence categories the report may use — never anything else. */
const CATEGORIES = [
  "instruction selection",
  "layout",
  "data placement",
  "addressing modes",
  "register usage",
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

describe.skipIf(!(hasAcme() && hasDist()))("Specification: twin-diff scoreboard", () => {
  it(
    "should report the balloon pair with two-decimal ratios, categorized divergences, and unpaired goldens",
    () => {
      const outDir = mkdtempSync(join(ROOT, "test", ".tmp-twin-diff-"));
      const jsonPath = join(outDir, "out.json");
      try {
        const stdout = execFileSync("node", [SCRIPT, "--json", jsonPath], {
          cwd: ROOT,
          encoding: "utf8",
        });

        // Markdown scoreboard on stdout with the balloon pair's ratios.
        expect(stdout).toContain("balloon");
        expect(stdout).toMatch(/\d+\.\d{2}/);

        // The JSON mirrors the scoreboard's data.
        const report = JSON.parse(readFileSync(jsonPath, "utf8"));
        const balloon = report.pairs.balloon;
        expect(balloon).toBeDefined();

        // Bytes ratio from the assembled PRG sizes, two decimals.
        expect(balloon.bytes.generated).toBeGreaterThan(0);
        expect(balloon.bytes.hand).toBeGreaterThan(0);
        expect(balloon.bytes.ratio).toBe(
          Number((balloon.bytes.generated / balloon.bytes.hand).toFixed(2)),
        );

        // Cycles: min and max sums per side; the headline ratio is max ÷ max.
        for (const side of [balloon.cycles.generated, balloon.cycles.hand]) {
          expect(side.minSum).toBeGreaterThan(0);
          expect(side.maxSum).toBeGreaterThanOrEqual(side.minSum);
        }
        expect(balloon.cycles.ratio).toBe(
          Number((balloon.cycles.generated.maxSum / balloon.cycles.hand.maxSum).toFixed(2)),
        );

        // The markdown carries the same ratio figures as the JSON.
        expect(stdout).toContain(balloon.bytes.ratio.toFixed(2));
        expect(stdout).toContain(balloon.cycles.ratio.toFixed(2));

        // Every divergence row carries exactly one of the five categories.
        expect(balloon.divergences.length).toBeGreaterThan(0);
        for (const divergence of balloon.divergences) {
          expect(CATEGORIES).toContain(divergence.category);
        }

        // Goldens without a twin are unpaired — and the run still exits 0.
        expect(report.unpaired).toContain("gate");
        expect(report.unpaired).toContain("slice8b");
        expect(stdout).toContain("unpaired");
      } finally {
        rmSync(outDir, { recursive: true, force: true });
      }
    },
    240000,
  );

  it("should reject a --json path outside the repository before writing anything", () => {
    const outside = join(ROOT, "..", "evil-twin-diff.json");
    let failed = false;
    try {
      execFileSync("node", [SCRIPT, "--json", outside], { cwd: ROOT, stdio: "pipe" });
    } catch (error) {
      failed = true;
      const stderr = String((error as { stderr?: Buffer }).stderr ?? "");
      expect(stderr).toMatch(/outside the repository/i);
    }
    expect(failed).toBe(true);
    expect(existsSync(outside)).toBe(false);
  });
});
