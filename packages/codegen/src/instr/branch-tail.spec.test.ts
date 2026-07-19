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

// The module under test (does not exist yet — red phase).
import { invertBranch } from "./branch-tail.js";

/**
 * The four condition-flag polarity pairs of the NMOS 6502: each branch tests
 * one processor flag, and its partner tests the opposite value of that flag.
 */
const INVERSE_PAIRS: ReadonlyArray<readonly [Opcode, Opcode]> = [
  ["BEQ", "BNE"], // zero flag
  ["BCC", "BCS"], // carry flag
  ["BMI", "BPL"], // negative flag
  ["BVC", "BVS"], // overflow flag
];

/** All eight conditional branch mnemonics, flattened from the pairs. */
const CONDITIONAL_BRANCHES: readonly Opcode[] = INVERSE_PAIRS.flat();

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
