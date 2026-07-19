/**
 * The branch tail — what a block's trailing conditional branch should emit.
 *
 * A 6502 conditional branch is frequently better spelled with the opposite
 * condition: when a block's *true* edge is the block that physically follows
 * it, inverting the branch and targeting the false edge lets the trailing
 * jump disappear entirely; and when a branch cannot reach its target within
 * the relative displacement, the assembler-legal form is the inverted branch
 * hopping over an absolute jump.
 *
 * Both rewrites need the same fact — a branch's polarity partner — so the
 * table lives in exactly one place. Two copies would be a silent hazard: a
 * wrong entry produces assembly that assembles cleanly and branches the wrong
 * way, which no structural check can see.
 *
 * Lives in `@blend65/codegen` (never imported by the frontend/
 * language-server).
 */

import type { Opcode } from "./opcode.js";

/**
 * The four condition-flag polarity pairs of the NMOS 6502, written in both
 * directions so the lookup is a single map access.
 *
 * Each conditional branch tests one processor flag; its partner tests the
 * opposite value of that same flag. `BRA` (65C02 branch-always) is
 * deliberately absent — it is unconditional, so it has no partner.
 */
const INVERSE_BRANCH: Partial<Record<Opcode, Opcode>> = {
  BEQ: "BNE", // zero
  BNE: "BEQ",
  BCC: "BCS", // carry
  BCS: "BCC",
  BMI: "BPL", // negative
  BPL: "BMI",
  BVC: "BVS", // overflow
  BVS: "BVC",
};

/**
 * The polarity partner of a 6502 conditional branch — the branch that is taken
 * exactly when this one is not.
 *
 * Total over the eight NMOS conditional branches and `undefined` for every
 * other opcode, including `BRA`. Callers must treat `undefined` as a compiler
 * bug rather than quietly emitting the un-inverted form: a missed inversion is
 * invisible in the output, which is the failure mode this table exists to
 * prevent.
 *
 * @param opcode The branch mnemonic to invert.
 * @returns The opposite-condition branch, or `undefined` when `opcode` is not
 *   one of the eight conditional branches.
 *
 * @example
 * ```ts
 * invertBranch("BEQ"); // "BNE"
 * invertBranch("BCS"); // "BCC"
 * invertBranch("JMP"); // undefined — not a conditional branch
 * ```
 */
export function invertBranch(opcode: Opcode): Opcode | undefined {
  return INVERSE_BRANCH[opcode];
}
