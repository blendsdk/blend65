import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BinaryOperation, SemanticBlock, SemanticOperation } from "../semantic/operations.js";
import { machineCost, machineInstruction, machineState } from "./lower-control.js";
import type { FunctionLoweringState } from "./lower-state.js";
import type { MachineBlock, MachineInstruction, MachineOperand } from "./machine-types.js";
import { declaredHome } from "./word-assignment-forwarding.js";
import type { DeclaredHome } from "./word-assignment-forwarding.js";

/** Byte width of the two-byte form this selection serves. */
const WORD_BYTES = 2;

/** Bit width of that same form, as the checked integer facts record it. */
const WORD_WIDTH = 16;

/**
 * Decide whether one operation is an in-place unit step whose processor state is unobserved.
 *
 * The shape itself is settled by the whole-word assignment selection, which has already proved
 * that this arithmetic is immediately followed by a store of its result into a whole undecorated
 * variable. Three further things are required here, and each rules out a way the increment form
 * could differ from the chain it replaces:
 *
 * - **The step is written back over its own operand.** The left operand must read the very
 *   variable the store writes, so the increment acts on one home rather than moving a value
 *   between two. A step from one variable into another is not an increment of anything.
 * - **The step is exactly one.** Only `INC` and `DEC` exist; a larger constant still needs a real
 *   addition on the low byte.
 * - **Nothing observes the state the chain would have left.** The two forms do not leave the same
 *   processor state, which is why this cannot reuse the surrounding slices' flag arguments. The
 *   addition chain always ends with the accumulator holding its high byte and the flags describing
 *   it. The increment form leaves the accumulator, the carry and the overflow untouched, and
 *   leaves sign and zero describing *whichever half it last incremented* — the low one when no
 *   carry occurred, the high one when it did — so those two are data-dependent at the point the
 *   paths rejoin. The accumulator and the flags are
 *   consumed in this compiler only through values the lowering state records as such: a condition
 *   kept as a zero flag, a branch taken directly on a condition, a mask test, or a value carried
 *   onward in a register. A result named by none of those sets, used exactly once by its own
 *   store, and closing a block that leaves by an unconditional edge has no reader for either. The
 *   positional requirement is what covers the data-dependent sign and zero flags: with the store
 *   last and the exit unconditional, the successor begins by establishing its own.
 *
 *   Note that being *materialized* is deliberately not disqualifying. That set records every value
 *   consumed anywhere, so a result written into a variable is always in it; it says nothing about
 *   whether the processor state around the write is read.
 *
 * Anything short of all three keeps the ordinary chain, which is always correct.
 *
 * @param operation Candidate arithmetic operation in its original block.
 * @param state Current lowering context, which owns home resolution and the consumption sets.
 * @param block Block the operation belongs to, in its original identity.
 * @param index Position of the operation within that block.
 * @param definitions Value definitions for the enclosing function, to read the addend.
 * @returns The resolved destination home, or undefined to keep the ordinary chain.
 * @example
 * // `for (let i: word = 0; i < 1000; i += 1)` qualifies: the update closes its block and the
 * // block jumps back to the exit test, which establishes its own flags with a comparison.
 * // `value = value + 1; sink = value;` does not: ordinary work follows the step in its block.
 */
export function wordUnitStepHome(
  operation: BinaryOperation,
  state: FunctionLoweringState,
  block: SemanticBlock,
  index: number,
  definitions: ReadonlyMap<string, SemanticOperation>,
): DeclaredHome | undefined {
  if (
    operation.operator !== "+" ||
    operation.integer?.width !== WORD_WIDTH ||
    operation.integer.signed ||
    !operation.integer.wrap
  )
    return undefined;
  const assignment = state.forwardedWordAssignments.get(operation.result);
  if (assignment === undefined) return undefined;
  // The store is the operation immediately after this one, so the step closes its block exactly
  // when that store is the block's last operation.
  if (block.operations[index + 1] !== assignment.store) return undefined;
  if (index + 2 !== block.operations.length) return undefined;
  if (block.terminator.kind !== "jump") return undefined;
  if (
    assignment.left.kind !== "place" ||
    bindingIdentityKey(assignment.left.place.root) !==
      bindingIdentityKey(assignment.store.place.root) ||
    assignment.right.kind !== "constant"
  )
    return undefined;
  const addend = definitions.get(operation.right);
  if (addend?.kind !== "constant" || addend.value !== 1n) return undefined;
  if (
    state.zeroFlagValues.has(operation.result) ||
    state.booleanBranchValues.has(operation.result) ||
    state.booleanMaskTests.has(operation.result) ||
    state.forwardedRegisterValues.has(operation.result) ||
    !state.singleUseValues.has(operation.result)
  )
    return undefined;
  return declaredHome(assignment.store.place, state);
}

/**
 * Emit the increment form as its own blocks, so the carry test can be a real branch.
 *
 * This replaces seventeen bytes and twenty-two cycles with eight bytes and either nine or fourteen,
 * depending on whether the low byte wrapped on that iteration.
 *
 * A relative branch exists in this architecture only as a block terminator, so an operation whose
 * selection needs one cannot express it in a flat instruction list. The function lowering loop
 * already splits the block it is filling for exactly this reason, and this follows that shape: the
 * pending instructions and the low increment close one block on a branch, a second block carries
 * the high increment alone, and both rejoin at a continuation the caller resumes on.
 *
 * The branch is taken when the low byte did **not** wrap, which is the common path and the cheap
 * one — three cycles to skip the high byte rather than six to increment it.
 *
 * @param state Current lowering context, for the processor facts and costs.
 * @param requestId Storage request of the two-byte home being advanced.
 * @param entryLabel Label of the block currently being filled.
 * @param prefix Instructions already pending in that block.
 * @param ordinal Occurrence number, to keep generated labels distinct within one block.
 * @param source Span of the originating operation, for debug attribution.
 * @returns The finished blocks and the label the caller continues on.
 * @example
 * // inc <low> · bne continue · inc <high> · continue:
 */
export function lowerWordUnitStep(
  state: FunctionLoweringState,
  requestId: string,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
  source: SemanticOperation["span"],
): { readonly blocks: readonly MachineBlock[]; readonly continuation: string } {
  const cpu = state.input.profile.cpu;
  const base = `${entryLabel}.unit.${ordinal}`;
  const highLabel = `${base}.high`;
  const continuation = `${base}.continue`;
  const byte = (offset: number): MachineOperand =>
    Object.freeze({ kind: "storage", requestId, offset });
  const increment = (offset: number) =>
    machineInstruction(cpu, "inc", "storage", byte(offset), [], source);
  return {
    blocks: Object.freeze([
      Object.freeze({
        label: entryLabel,
        instructions: Object.freeze([...prefix, increment(0)]),
        terminator: Object.freeze({
          kind: "branch" as const,
          opcode: "bne",
          target: continuation,
          fallthrough: highLabel,
          uses: machineState([], ["z"]),
          cost: machineCost(cpu, "bne", "relative"),
        }),
      }),
      Object.freeze({
        label: highLabel,
        instructions: Object.freeze([increment(WORD_BYTES - 1)]),
        terminator: Object.freeze({ kind: "fallthrough" as const, target: continuation }),
      }),
    ]),
    continuation,
  };
}
