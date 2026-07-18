/**
 * Specification tests for the annotate-cycles script.
 *
 * Given an ACME report, the script emits a listing with per-instruction
 * cycle annotations (`min-max` where branch/page-cross variable) and
 * per-block sums (a block starts at a branch target and ends at a control
 * transfer). Final assembled addresses make branch page-cross detection
 * exact. A `.asm` input with the assemble flag first invokes ACME (argv
 * array) for the report. Input paths must resolve inside the repository.
 *
 * The oracle block is hand-computed from the fixture + documented NMOS
 * timings: dex (2) + nop (2) + bne (2, +1 taken, +1 more across the page
 * boundary the fixture straddles) = block 6-8.
 */

import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts", "annotate-cycles.mjs");

/** Whether real ACME is on PATH. */
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

/**
 * The fixture straddles the $08/$09 page boundary: the BNE at $08fe falls
 * through to $0900, so its taken branch back to $08fc crosses a page.
 */
const FIXTURE_ASM = ["* = $08fc", "loop    dex", "        nop", "        bne loop", "        rts", ""].join(
  "\n",
);

describe.skipIf(!(hasAcme() && hasDist()))("Specification: annotate-cycles listing", () => {
  // Fixture lives INSIDE the repo — the script rejects outside paths.
  const dir = mkdtempSync(join(ROOT, "test", ".tmp-annotate-"));

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  /** Assemble the fixture with ACME, returning the report path. */
  function assembleFixture(): { asmPath: string; reportPath: string } {
    const asmPath = join(dir, "fixture.asm");
    const reportPath = join(dir, "fixture.report");
    writeFileSync(asmPath, FIXTURE_ASM, "utf8");
    execFileSync(
      "acme",
      ["--cpu", "6510", "--format", "cbm", "--report", reportPath, "-o", join(dir, "fixture.prg"), asmPath],
      { stdio: "pipe" },
    );
    return { asmPath, reportPath };
  }

  it("should annotate every instruction with exact page-cross-aware ranges and block sums", () => {
    const { reportPath } = assembleFixture();
    const stdout = execFileSync("node", [SCRIPT, reportPath], { cwd: ROOT, encoding: "utf8" });

    // Every instruction line is annotated (fixture has 4 instructions).
    const annotated = stdout.split("\n").filter((line) => /^\$[0-9a-f]{4}\s/.test(line));
    expect(annotated).toHaveLength(4);

    // Fixed-cost instructions read as a single number...
    expect(stdout).toMatch(/\$08fc\s+DEX\s+2\b/);
    // ...the page-crossing branch as an exact min-max range...
    expect(stdout).toMatch(/\$08fe\s+BNE\s+\$08fc\s+2-4/);
    // ...and the block sums match the hand-computed reference.
    expect(stdout).toContain("block total: 6-8");
    expect(stdout).toContain("block total: 6-6");
  });

  it("should assemble a .asm input first when given the assemble flag", () => {
    const { asmPath } = assembleFixture();
    const stdout = execFileSync("node", [SCRIPT, "--assemble", asmPath], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(stdout).toMatch(/\$08fe\s+BNE\s+\$08fc\s+2-4/);
    expect(stdout).toContain("block total: 6-8");
  });

  it("should reject an input path outside the repository before reading anything", () => {
    const outside = join(ROOT, "..", "evil.report");
    let failed = false;
    try {
      execFileSync("node", [SCRIPT, outside], { cwd: ROOT, stdio: "pipe" });
    } catch (error) {
      failed = true;
      const stderr = String((error as { stderr?: Buffer }).stderr ?? "");
      expect(stderr).toMatch(/outside the repository/i);
    }
    expect(failed).toBe(true);
  });
});
