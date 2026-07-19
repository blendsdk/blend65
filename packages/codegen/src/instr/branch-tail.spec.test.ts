/**
 * Specification tests for branch polarity inversion (`invertBranch`).
 *
 * Every expectation below is derived exclusively from the specification and
 * from 6502 branch semantics, never from reading the implementation. These are
 * immutable oracles — if the implementation disagrees, the implementation is
 * wrong, not the test.
 *
 * Contract: `invertBranch` is total over exactly the eight NMOS conditional
 * branches — BEQ↔BNE, BCC↔BCS, BMI↔BPL, BVC↔BVS — and returns `undefined`
 * for every other opcode. That includes `BRA`: the 65C02 branch-always is
 * unconditional, so it has no polarity partner even though it is a branch.
 */

import { describe, expect, it } from "vitest";
import type { Opcode } from "./opcode.js";
import { OPCODES } from "./opcode.js";

import { invertBranch, planBranchTail, type ConditionalBranch } from "./branch-tail.js";

/**
 * The four condition-flag polarity pairs of the NMOS 6502: each branch tests
 * one processor flag, and its partner tests the opposite value of that flag.
 */
const INVERSE_PAIRS: ReadonlyArray<readonly [ConditionalBranch, ConditionalBranch]> = [
  ["BEQ", "BNE"], // zero flag
  ["BCC", "BCS"], // carry flag
  ["BMI", "BPL"], // negative flag
  ["BVC", "BVS"], // overflow flag
];

/**
 * All eight conditional branch mnemonics, flattened from the pairs.
 *
 * Written out here rather than imported, so the sweep below is an independent
 * enumeration; only the *type* comes from the module, which means an implementation
 * that dropped one of the eight from its union fails to compile this file.
 */
const CONDITIONAL_BRANCHES: readonly ConditionalBranch[] = INVERSE_PAIRS.flat();

describe("Specification: invertBranch — branch polarity inversion (ST-B20..ST-B21)", () => {
  it("inverts each of the eight conditional branches to its partner, and twice is the identity (ST-B20)", () => {
    // Each pair inverts in both directions.
    for (const [a, b] of INVERSE_PAIRS) {
      expect(invertBranch(a)).toBe(b);
      expect(invertBranch(b)).toBe(a);
    }

    // Inverting twice is the identity, for every one of the eight.
    for (const op of CONDITIONAL_BRANCHES) {
      const once = invertBranch(op);
      expect(once).toBeDefined();
      expect(once === undefined ? undefined : invertBranch(once)).toBe(op);
    }
  });

  it("returns undefined for every non-conditional opcode, including BRA (ST-B21)", () => {
    // Named representatives: jumps, loads, no-op, return — and BRA, the 65C02
    // branch-always, which is representable in the opcode union but has no
    // condition to invert.
    const named: readonly Opcode[] = ["JMP", "LDA", "NOP", "RTS", "BRA"];
    for (const op of named) {
      expect(invertBranch(op)).toBeUndefined();
    }

    // Exhaustively: everything outside the eight conditional branches maps to
    // undefined — the function is total over exactly those eight.
    const conditionals = new Set<Opcode>(CONDITIONAL_BRANCHES);
    for (const op of OPCODES) {
      if (!conditionals.has(op)) {
        expect(invertBranch(op)).toBeUndefined();
      }
    }
  });
});

/**
 * The tail decision, as one table rather than two transforms.
 *
 * Given a conditional branch to `T` followed by an unconditional jump to `F`,
 * and `N` the label of the block that will physically follow:
 *
 * | condition | emitted            |
 * |-----------|--------------------|
 * | `F === N` | `B<c> T` — the jump is dropped              |
 * | `T === N` | `B<!c> F` — the branch inverts, jump dropped |
 * | neither   | `B<c> T` · `JMP F` — unchanged              |
 * | no next   | unchanged                                    |
 *
 * The rows are tried in that order, so a branch whose two edges converge is
 * decided rather than undefined.
 */
describe("Specification: planBranchTail — the block-tail decision (ST-B16..ST-B19, ST-B48)", () => {
  it("drops the trailing jump when the false edge is the next block (ST-B16)", () => {
    expect(planBranchTail("BEQ", "a", "b", "b")).toEqual({ kind: "elide" });
  });

  it("inverts the branch when the true edge is the next block (ST-B17)", () => {
    expect(planBranchTail("BEQ", "a", "b", "a")).toEqual({ kind: "invert", opcode: "BNE" });
  });

  it("emits both when neither edge is the next block (ST-B18)", () => {
    expect(planBranchTail("BEQ", "a", "b", "c")).toEqual({ kind: "both" });
  });

  it("emits both when there is no next block (ST-B19)", () => {
    expect(planBranchTail("BEQ", "a", "b", undefined)).toEqual({ kind: "both" });
  });

  it("decides a branch whose two edges converge on the next block (ST-B48)", () => {
    // Both rows would match. The table's stated order settles it: the
    // false-edge row is tried first, so this elides rather than inverting.
    // Collapsing such a branch to an unconditional jump is a different
    // transform and deliberately not this one.
    expect(planBranchTail("BEQ", "a", "a", "a")).toEqual({ kind: "elide" });
  });

  it("inverts through the same polarity table for every conditional branch (ST-B17)", () => {
    // The tail decision and relaxation must never disagree about polarity, so
    // the inverted opcode is exactly what invertBranch reports.
    for (const op of CONDITIONAL_BRANCHES) {
      expect(planBranchTail(op, "a", "b", "a")).toEqual({
        kind: "invert",
        opcode: invertBranch(op),
      });
    }
  });
});
