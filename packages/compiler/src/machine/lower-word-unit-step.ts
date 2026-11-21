import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BinaryOperation, SemanticBlock, SemanticOperation } from "../semantic/operations.js";
import { machineCost, machineInstruction, machineState } from "./lower-control.js";
import type { FunctionLoweringState } from "./lower-state.js";
import type { MachineBlock, MachineInstruction, MachineOperand } from "./machine-types.js";
import { declaredHome, WORD_BYTES, WORD_WIDTH } from "./word-assignment-forwarding.js";
import type { DeclaredHome } from "./word-assignment-forwarding.js";

/** One admitted unit step: the home it acts on, and which way it moves. */
export interface WordUnitStep {
  /** Resolved declared home of the two-byte variable being stepped. */
  readonly home: DeclaredHome;
  /** True for a step of minus one, which needs the borrow form rather than the carry form. */
  readonly descending: boolean;
}

/**
 * Decide whether one operation is an in-place unit step whose processor state is unobserved.
 *
 * The shape itself is settled by the whole-word assignment selection, which has already proved
 * that this arithmetic is immediately followed by a store of its result into a whole undecorated
 * variable. Three further things are required here, and each rules out a way the increment form
 * could differ from the chain it replaces:
 *
 * - **The step is written back over its own operand.** The left operand must read the very
 *   variable the store writes, so the step acts on one home rather than moving a value between
 *   two. A step from one variable into another is not an increment or a decrement of anything.
 * - **The step is exactly one, up or down.** Only `INC` and `DEC` exist; a larger constant still
 *   needs a real addition or subtraction on the low byte.
 * - **Nothing observes the state the chain would have left.** The forms do not leave the same
 *   processor state as the chain, which is why this cannot reuse the surrounding slices' flag
 *   arguments. The chain always ends with the accumulator holding its high byte and the flags
 *   describing it. The two selected forms differ from each other here, so each is stated:
 *
 *   The **increment** leaves the accumulator, the carry and the overflow untouched, and leaves
 *   sign and zero describing *whichever half it last incremented* — the low one when no carry
 *   occurred, the high one when it did — so those two are data-dependent where the paths rejoin.
 *
 *   The **decrement** is the better-behaved of the two on flags and the worse on registers. Both
 *   of its arms end on the same low-byte decrement, so sign and zero uniformly describe the new
 *   low byte with no path dependence at all. In exchange it must load the low byte to test it
 *   before decrementing, so it clobbers the accumulator with the byte's *old* value. That is not a
 *   new hazard: the chain being replaced also ends with the accumulator overwritten, by its own
 *   high result, so the accumulator is already dead across this operation wherever the chain would
 *   have been emitted. Replacing one accumulator-clobbering form with another cannot break a
 *   reader that the chain did not already break.
 *
 *   What makes all of this safe is not an invariant about the successor, which is neither required
 *   nor checked to establish anything. It is that flag and register reuse is *selected between
 *   operations of one block*: the pass that forwards a value onward searches only the operations
 *   of the block it is visiting, so a consumer of this result's flags in another block cannot be
 *   created at all. The sets consulted below are therefore the complete list of readers that can
 *   exist. Both forms also define sign and zero on both arms, so the whole-function flag check
 *   still proves every later use has a definer.
 *
 *   Preserving the carry rather than defining it is the one place that could bite, and it bites
 *   safely in both directions: the chain produced a whole-word carry or borrow out, so if some
 *   later block's only producer of the carry were this arithmetic, that check reports a program it
 *   cannot prove and the build is refused. It is never accepted and quietly miscompiled.
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
 * @param definitions Value definitions for the enclosing function, to read the step constant.
 * @returns The destination home and the step's direction, or undefined to keep the ordinary chain.
 * @example
 * // `for (let i: word = 0; i < 1000; i += 1)` qualifies: the update closes its block and the
 * // block jumps back to the exit test, which establishes its own flags with a comparison.
 * // `if (rising) { x = x + 1; } else { x = x - 1; }` qualifies in both arms, since each arm ends
 * // by jumping to the join.
 * // `value = value + 1; sink = value;` does not: ordinary work follows the step in its block.
 */
export function wordUnitStepHome(
  operation: BinaryOperation,
  state: FunctionLoweringState,
  block: SemanticBlock,
  index: number,
  definitions: ReadonlyMap<string, SemanticOperation>,
): WordUnitStep | undefined {
  if (
    (operation.operator !== "+" && operation.operator !== "-") ||
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
  const step = definitions.get(operation.right);
  if (step?.kind !== "constant" || step.value !== 1n) return undefined;
  if (
    state.zeroFlagValues.has(operation.result) ||
    state.booleanBranchValues.has(operation.result) ||
    state.booleanMaskTests.has(operation.result) ||
    state.forwardedRegisterValues.has(operation.result) ||
    !state.singleUseValues.has(operation.result)
  )
    return undefined;
  const home = declaredHome(assignment.store.place, state);
  return home === undefined
    ? undefined
    : Object.freeze({ home, descending: operation.operator === "-" });
}

/**
 * Emit the selected step as its own blocks, so the carry or borrow test can be a real branch.
 *
 * In the absolute form the increment replaces seventeen bytes and twenty-two cycles with eight
 * bytes and either nine or fourteen, depending on whether the low byte wrapped on that iteration.
 * A home that closes into zero page is thirteen bytes against six, and eighteen cycles against
 * eight or twelve. Every figure counts the branch as well as the increments.
 *
 * The decrement is dearer than the increment but still well under the chain, because it must load
 * the low byte in order to test it before decrementing: eleven bytes against seventeen, and
 * thirteen or eighteen cycles against twenty-two in the absolute form; eight bytes against
 * thirteen, and eleven or fifteen cycles against eighteen, in zero page. There is no accumulator-
 * free variant, since the zero test has to happen *before* the low byte changes. Where an index
 * register is provably free a load into it would preserve the accumulator at identical cost, which
 * is a register-pressure refinement rather than a correctness one and is not attempted here.
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
 * pending instructions and the step's first half close one block on a branch, a second block
 * carries the high half alone, and both rejoin at a continuation the caller resumes on.
 *
 * The two directions place their work either side of that branch, which is why the continuation is
 * not always empty. Going up, the low byte is incremented before the test, so the branch skips the
 * high byte and nothing needs to follow the join. Going down, the low byte must be *tested* before
 * it changes, so the branch skips the high byte and the low decrement belongs after the join,
 * where both paths reach it. That trailing instruction is handed back as pending work rather than
 * emitted into a block of its own, so no extra edge is introduced.
 *
 * In both directions the branch is taken on the common path — the low byte did not wrap or borrow —
 * costing three cycles to skip the high byte, or four if the branch crosses a page, against six to
 * step it.
 *
 * @param state Current lowering context, for the processor facts and costs.
 * @param step Resolved home and direction from the selection.
 * @param entryLabel Label of the block currently being filled.
 * @param prefix Instructions already pending in that block.
 * @param ordinal Occurrence number, to keep generated labels distinct within one block.
 * @param source Span of the originating operation, for debug attribution.
 * @returns The finished blocks, the label the caller continues on, and any instructions the
 * caller must begin that continuation with.
 * @example
 * // up:   inc <low> · bne continue · inc <high> · continue:
 * // down: lda <low> · bne continue · dec <high> · continue: dec <low>
 */
export function lowerWordUnitStep(
  state: FunctionLoweringState,
  step: WordUnitStep,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
  source: SemanticOperation["span"],
): {
  readonly blocks: readonly MachineBlock[];
  readonly continuation: string;
  readonly pending: readonly MachineInstruction[];
} {
  const cpu = state.input.profile.cpu;
  const requestId = step.home.value.requestId;
  const base = `${entryLabel}.unit.${ordinal}`;
  const highLabel = `${base}.high`;
  const continuation = `${base}.continue`;
  const byte = (offset: number): MachineOperand =>
    Object.freeze({ kind: "storage", requestId, offset });
  const at = (opcode: string, offset: number) =>
    machineInstruction(cpu, opcode, "storage", byte(offset), [], source);
  // Going up the low byte is stepped before the test; going down it is only read, because the
  // branch has to see the value the decrement will borrow out of.
  const opens = step.descending ? at("lda", 0) : at("inc", 0);
  return {
    blocks: Object.freeze([
      Object.freeze({
        label: entryLabel,
        instructions: Object.freeze([...prefix, opens]),
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
        instructions: Object.freeze([at(step.descending ? "dec" : "inc", WORD_BYTES - 1)]),
        terminator: Object.freeze({ kind: "fallthrough" as const, target: continuation }),
      }),
    ]),
    continuation,
    // Both paths reach the join, so the descending form's low-byte decrement belongs there.
    pending: Object.freeze(step.descending ? [at("dec", 0)] : []),
  };
}
