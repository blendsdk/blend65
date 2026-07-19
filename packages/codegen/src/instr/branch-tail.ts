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
 * The eight NMOS 6502 branches that test a condition, and so have an opposite.
 *
 * `BRA` (65C02 branch-always) is deliberately absent: it is unconditional, so
 * it has no partner and can never be a tail worth inverting.
 */
export const CONDITIONAL_BRANCHES = [
  "BEQ",
  "BNE",
  "BCC",
  "BCS",
  "BMI",
  "BPL",
  "BVC",
  "BVS",
] as const;

/** A 6502 branch that tests a condition — one of {@link CONDITIONAL_BRANCHES}. */
export type ConditionalBranch = (typeof CONDITIONAL_BRANCHES)[number];

/**
 * Narrow an opcode to a conditional branch.
 *
 * A caller holding a general {@link Opcode} uses this before planning a block
 * tail. Anything that fails the guard reaching a block tail is a compiler bug,
 * and the caller — which holds the diagnostic sink — is where that is reported.
 *
 * @param opcode The opcode to classify.
 * @returns `true` and narrows to {@link ConditionalBranch} when matched.
 *
 * @example
 * ```ts
 * if (!isConditionalBranch(framing.branch)) {
 *   bag.addICE(IceCode.Unexpected, null, `block tail on '${framing.branch}'`);
 *   return;
 * }
 * const plan = planBranchTail(framing.branch, trueTarget, falseTarget, next);
 * ```
 */
export function isConditionalBranch(opcode: Opcode): opcode is ConditionalBranch {
  return (CONDITIONAL_BRANCHES as readonly Opcode[]).includes(opcode);
}

/**
 * The four condition-flag polarity pairs of the NMOS 6502, written in both
 * directions so the lookup is a single map access.
 *
 * Each conditional branch tests one processor flag; its partner tests the
 * opposite value of that same flag.
 */
const INVERSE_BRANCH: Record<ConditionalBranch, ConditionalBranch> = {
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
  return isConditionalBranch(opcode) ? INVERSE_BRANCH[opcode] : undefined;
}

/**
 * What a block's tail should emit, given the label that follows it.
 *
 * `elide` drops the trailing jump; `invert` replaces the branch with its
 * opposite aimed at the false edge and drops the jump; `both` leaves the pair
 * as it is.
 */
export type TailPlan =
  | { readonly kind: "both" }
  | { readonly kind: "elide" }
  | { readonly kind: "invert"; readonly opcode: ConditionalBranch };

/**
 * Decide what a conditional block tail emits, given the block that will
 * physically follow it.
 *
 * A block ending in "branch to `T`, otherwise jump to `F`" does not need the
 * jump whenever one of its two edges is simply the next block in the output —
 * falling through gets there for free. Which edge it is decides how:
 *
 * | condition | emitted |
 * |---|---|
 * | `F` is next | `B<c> T` — the jump is dropped |
 * | `T` is next | `B<!c> F` — the branch inverts and the jump is dropped |
 * | neither | `B<c> T` · `JMP F` — unchanged |
 * | nothing follows | unchanged |
 *
 * Elision and inversion are one decision rather than two transforms because
 * they are the same question — *which edge falls through* — asked once. Splitting
 * them invites a second adjacency computation, and two of those will disagree.
 *
 * The rows are tried in the order above, so a branch whose two edges converge
 * on the next block is decided (it elides) rather than undefined. Collapsing
 * such a branch to a plain jump is a different transform and not this one's job.
 *
 * The decision is taken before any instruction has an address, so an inverted
 * branch can turn out to be beyond the 6502's relative reach. That is expected:
 * relaxation is the single authority on range, and it reconstitutes the
 * branch-over-jump form at the same size the unelided pair would have had. The
 * cost of guessing wrong is a forgone improvement, never a regression.
 *
 * @param branch The branch opcode the tail would emit.
 * @param trueTarget The label taken when the branch is taken.
 * @param falseTarget The label taken when it is not.
 * @param nextLabel The label of the block that follows, or `undefined` for the
 *   last block.
 * @returns The {@link TailPlan} for this tail.
 *
 * @example
 * ```ts
 * planBranchTail("BEQ", "a", "b", "b"); // { kind: "elide" }
 * planBranchTail("BEQ", "a", "b", "a"); // { kind: "invert", opcode: "BNE" }
 * planBranchTail("BEQ", "a", "b", "c"); // { kind: "both" }
 * ```
 */
export function planBranchTail(
  branch: ConditionalBranch,
  trueTarget: string,
  falseTarget: string,
  nextLabel: string | undefined,
): TailPlan {
  if (nextLabel === undefined) {
    return { kind: "both" };
  }
  if (falseTarget === nextLabel) {
    return { kind: "elide" };
  }
  if (trueTarget === nextLabel) {
    return { kind: "invert", opcode: INVERSE_BRANCH[branch] };
  }
  return { kind: "both" };
}
