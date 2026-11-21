import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BinaryOperation, SemanticBlock, SemanticOperation } from "../semantic/operations.js";
import { machineCost, machineInstruction, machineState } from "./lower-control.js";
import type { FunctionLoweringState } from "./lower-state.js";
import type { MachineBlock, MachineInstruction, MachineOperand } from "./machine-types.js";
import { declaredHome, WORD_BYTES, WORD_WIDTH } from "./word-assignment-forwarding.js";
import type { DeclaredHome } from "./word-assignment-forwarding.js";

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
 *   carry occurred, the high one when it did — so those two are data-dependent where the paths
 *   rejoin.
 *
 *   What makes that safe is not an invariant about the successor, which is neither required nor
 *   checked to establish anything. It is that flag and register reuse is *selected between
 *   operations of one block*: the pass that forwards a value onward searches only the operations
 *   of the block it is visiting, so a consumer of this result's flags in another block cannot be
 *   created at all. The sets consulted below are therefore the complete list of readers that can
 *   exist. Beyond them, the form clobbers strictly less than the chain did — the accumulator, the
 *   carry and the overflow are preserved rather than overwritten — and both arms define sign and
 *   zero, so the whole-function flag check still proves every later use has a definer.
 *
 *   Preserving the carry rather than defining it is the one place that could bite, and it bites
 *   safely: the chain produced a whole-word carry-out, so if some later block's only producer of
 *   the carry were this arithmetic, that check reports a program it cannot prove and the build is
 *   refused. It is never accepted and quietly miscompiled.
 *
 *   The positional requirement earns its place against a different reader: the in-block peepholes
 *   that inspect the instructions pending in the block being filled. Closing the block empties
 *   that list, so none of them can reach across this selection.
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
 * In the absolute form this replaces seventeen bytes and twenty-two cycles with eight bytes and
 * either nine or fourteen, depending on whether the low byte wrapped on that iteration. A home
 * that closes into zero page is thirteen bytes against six, and eighteen cycles against eight or
 * twelve. Every figure counts the branch as well as the increments.
 *
 * Those are the figures for the step alone. What a program saves also depends on whether the skip
 * branch can carry the loop's back edge itself, which is a question of relative branch range: a
 * displacement outside one signed byte forces the ordinary long-branch repair, which inverts the
 * condition and adds an absolute jump, so the branch is then paid *in addition to* a jump that has
 * to stay rather than in place of it. That is worth three bytes between the two cases.
 *
 * A relative branch exists in this architecture only as a block terminator, so an operation whose
 * selection needs one cannot express it in a flat instruction list. The function lowering loop
 * already splits the block it is filling for exactly this reason, and this follows that shape: the
 * pending instructions and the low increment close one block on a branch, a second block carries
 * the high increment alone, and both rejoin at a continuation the caller resumes on.
 *
 * The branch is taken when the low byte did **not** wrap, which is the common path and the cheap
 * one: three cycles to skip the high byte, or four if the branch crosses a page, against six to
 * increment it.
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
