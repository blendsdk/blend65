/**
 * The permanent corpus layout scan — the invariant that outlives the review.
 *
 * Every committed golden is checked for the three shapes a hand-written 6502
 * program never contains: a jump to the very next label, a block that exists
 * only to jump elsewhere, and a conditional branch that hops over a jump to
 * the place the branch itself could have gone. A fixture added to the corpus
 * years from now cannot quietly reintroduce any of them.
 *
 * The reason this exists rather than trusting one careful review: a missed
 * layout decision does not fail a test, it emits slightly worse code. There is
 * nothing red to notice. Only a structural scan over the whole corpus catches
 * that, and only if it keeps running.
 *
 * Reads committed goldens only — no compiler, no assembler, no emulator — so
 * it runs everywhere.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  branchOverJumps,
  fallThroughJumps,
  scanCoverage,
  trampolineBlocks,
  type ScanViolation,
} from "./testing/golden-scan.js";

/** The committed golden directory. */
const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "golden");

/** Every program with a committed golden, in corpus order. */
const GOLDEN_PROGRAMS: readonly string[] = [
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
];

/** Read one committed golden's assembly text. */
function goldenText(program: string): string {
  return readFileSync(join(GOLDEN_DIR, `${program}.asm.golden`), "utf8");
}

/** Render violations into a message that names the offending lines. */
function describeViolations(violations: readonly ScanViolation[]): string {
  return violations.map((v) => JSON.stringify(v)).join("\n");
}

describe("Specification: the committed corpus stays laid out (ST-B39, ST-B40, ST-B43)", () => {
  for (const program of GOLDEN_PROGRAMS) {
    it(`ST-B39: ${program} jumps to no label it could have fallen into`, () => {
      // A jump whose target is the next label is a jump to the next
      // instruction: three bytes and three cycles to stand still.
      const violations = fallThroughJumps(goldenText(program));
      expect(violations, describeViolations(violations)).toEqual([]);
    });

    it(`ST-B40: ${program} has no block that exists only to jump elsewhere`, () => {
      // Whatever branched here should have branched to the destination.
      // A self-referential jump is a real loop and a function's entry block
      // has no incoming edge to retarget, so both are excluded.
      const violations = trampolineBlocks(goldenText(program));
      expect(violations, describeViolations(violations)).toEqual([]);
    });

    it(`ST-B43: ${program} has no branch hopping over a jump to its own target`, () => {
      // The missed-inversion shape. It is invisible to the two invariants
      // above — the jump's target is not adjacent and no jump-only block
      // exists — so without this case half of one decision goes unwatched.
      //
      // Synthetic labels minted for a branch that cannot reach its target are
      // exempt: that trigram IS the legal long-branch form, and banning it
      // would forbid correct output from ever entering the corpus.
      const violations = branchOverJumps(goldenText(program));
      expect(violations, describeViolations(violations)).toEqual([]);
    });
  }
});

describe("Specification: the layout scan is not passing by parsing nothing (ST-B44)", () => {
  it("ST-B44: every golden yields function sections, and the corpus yields jumps", () => {
    // The three invariants above are all "found nothing". A drift in the
    // emitted function-marker format would make the parser find nothing to
    // look at, and all three would pass while checking literally no code.
    // This is the tripwire for that.
    let totalJumps = 0;
    for (const program of GOLDEN_PROGRAMS) {
      const coverage = scanCoverage(goldenText(program));
      expect(coverage.functionSections, `${program}: no function section parsed`).toBeGreaterThan(
        0,
      );
      totalJumps += coverage.unconditionalJumps;
    }
    // Layout removes jumps; it does not remove all of them. Back edges and
    // jumps to non-adjacent joins survive by design, so a corpus-wide count of
    // zero would mean the scan is reading nothing rather than that the corpus
    // is perfect.
    expect(totalJumps).toBeGreaterThan(0);
  });
});
