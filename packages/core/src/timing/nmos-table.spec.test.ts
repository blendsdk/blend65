/**
 * Specification tests for the NMOS 6502 timing table.
 *
 * Expected records are transcribed from the documented NMOS 6502 instruction
 * timings (MOS/WDC datasheets): byte size, base cycles, page-cross penalty,
 * branch-taken penalty. These are immutable oracles: if the implementation
 * disagrees, the implementation is wrong — not these tests.
 */

import { describe, expect, it } from "vitest";

import { getTiming } from "./index.js";

describe("Specification: NMOS timing table — reference records", () => {
  // LDA abs,X: 4 cycles base, +1 when the effective address crosses a page.
  it("should cost LDA abs,X as 3 bytes / 4 base cycles with a +1 page-cross penalty", () => {
    expect(getTiming("LDA", "AbsoluteX")).toEqual({
      bytes: 3,
      baseCycles: 4,
      pageCrossPenalty: 1,
      branchTakenPenalty: 0,
    });
  });

  // STA abs,X: the write cycle is always performed, so the cost is a fixed 5 —
  // no page-cross variability.
  it("should cost STA abs,X as 3 bytes / 5 fixed cycles with no page-cross penalty", () => {
    expect(getTiming("STA", "AbsoluteX")).toEqual({
      bytes: 3,
      baseCycles: 5,
      pageCrossPenalty: 0,
      branchTakenPenalty: 0,
    });
  });
});

describe("Specification: NMOS timing table — branch penalties", () => {
  const BRANCH_OPCODES = ["BCC", "BCS", "BEQ", "BMI", "BNE", "BPL", "BVC", "BVS"] as const;

  // Every branch reads as: 2 cycles not taken, +1 when taken, +1 more when the
  // taken branch crosses a page (total +2 taken-across-page).
  it("should cost every branch as 2 bytes / 2 base cycles, +1 taken, +1 more taken-across-page", () => {
    for (const opcode of BRANCH_OPCODES) {
      expect(getTiming(opcode, "Relative"), opcode).toEqual({
        bytes: 2,
        baseCycles: 2,
        pageCrossPenalty: 1,
        branchTakenPenalty: 1,
      });
    }
  });
});

describe("Specification: NMOS timing table — subroutine linkage", () => {
  it("should cost JSR abs at 6 base cycles", () => {
    expect(getTiming("JSR", "Absolute").baseCycles).toBe(6);
  });

  it("should cost RTS at 6 base cycles", () => {
    expect(getTiming("RTS", "Implied").baseCycles).toBe(6);
  });
});

describe("Specification: NMOS timing table — illegal lookups fail loudly", () => {
  // A legal opcode with a mode that is illegal for it must throw an error
  // naming both keys — never return undefined or a silent 0-cost record.
  it("should throw an error naming both keys when the mode is illegal for the opcode", () => {
    expect(() => getTiming("LDA", "Implied")).toThrowError(/LDA.*Implied/);
  });
});
