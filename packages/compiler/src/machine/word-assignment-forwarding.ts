import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import { valueDefinitions } from "../semantic/aggregate-place-proof.js";
import type {
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticPlace,
  StoreOperation,
} from "../semantic/operations.js";
import { potentialValueInputs } from "../semantic/value-lifetimes.js";
import type { LoweredValue } from "./lower-control.js";
import { loweredPlace, type FunctionLoweringState } from "./lower-state.js";
import type { MachineLoweringInput } from "./machine-types.js";

/** Byte width of the two-byte unsigned wrapping form this selection serves. */
const WORD_BYTES = 2;

/** Bit width of that same form, as the checked integer facts record it. */
const WORD_WIDTH = 16;

/**
 * One operand of a candidate assignment, in the only two shapes the proof admits.
 *
 * A constant needs no home at all. A place operand is read out of its own
 * declared parameter or local home, which is what lets the proof below reason
 * about whether writing the destination early can disturb it.
 */
export type ForwardedWordOperand =
  | { readonly kind: "constant" }
  | { readonly kind: "place"; readonly place: SemanticPlace };

/** One whole-word assignment whose arithmetic may compute straight into its destination. */
export interface ForwardedWordAssignment {
  /** Exact store that receives the result, immediately after the arithmetic. */
  readonly store: StoreOperation;
  /** Left operand shape, evaluated first. */
  readonly left: ForwardedWordOperand;
  /** Right operand shape, evaluated second. */
  readonly right: ForwardedWordOperand;
}

/** Recognize the two-byte unsigned wrapping scalar the word emitter produces. */
function unsignedWordType(type: SemanticType | undefined): boolean {
  return type !== undefined && type.kind === "scalar" && type.name === "word";
}

/**
 * Describe one operand by the shape the destination proof needs, or reject it.
 *
 * Only a source constant and a read of a whole undecorated variable qualify.
 * Every other producer — another arithmetic step, a call, a conversion, a raw
 * memory read, an element or field read — reaches the emitter through a home
 * that the compiler itself created, and such a home is not guaranteed to be
 * laid out apart from the destination.
 */
function operandShape(
  value: string,
  definitions: ReadonlyMap<string, SemanticOperation>,
  declaredRoots: ReadonlySet<string>,
  narrowedCounters: ReadonlySet<string>,
): ForwardedWordOperand | undefined {
  const definition = definitions.get(value);
  if (definition === undefined) return undefined;
  if (definition.kind === "constant") return Object.freeze({ kind: "constant" });
  if (definition.kind !== "load") return undefined;
  const { place } = definition;
  if (
    place.path.length !== 0 ||
    place.asset !== undefined ||
    !declaredRoots.has(bindingIdentityKey(place.root)) ||
    narrowedCounters.has(bindingIdentityKey(place.root)) ||
    !unsignedWordType(place.rootType)
  )
    return undefined;
  return Object.freeze({ kind: "place", place });
}

/**
 * Select whole-word assignments whose arithmetic result needs no private scratch.
 *
 * The word emitter has to park its low result somewhere while the accumulator
 * computes the high byte. When the only consumer of that result is the very
 * next store into a whole undecorated variable, the variable itself can serve
 * as that parking place, and the separate scratch plus the move out of it
 * disappear. This selection runs before storage closure, so the scratch home is
 * never introduced and then withdrawn after allocation.
 *
 * Only the source shape is judged here. Whether the destination and the
 * operands really resolve to homes that cannot be laid out across each other is
 * settled later, against the actual resolved homes, by
 * {@link forwardedWordDestination}.
 *
 * @param input Closed source and the exact selected profile.
 * @param source Actual function body; absent for generated initializer bodies.
 * @param blocks Original blocks in their original identity order.
 * @param singleUseValues Existing operation-use inventory; independently rechecked here.
 * @param narrowedCounters Roots of proved loop counters, which keep a narrower representation.
 * @returns Arithmetic results that may write their destination, with the proof's inputs.
 * @example
 * // For `x = x + 2`, the addition's result maps to the store into `x`, so the
 * // emitter adds straight into `x` and the store emits nothing.
 * const forwarded = selectForwardedWordAssignments(input, main, main.blocks, singleUse);
 */
export function selectForwardedWordAssignments(
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
  narrowedCounters: ReadonlySet<string>,
): ReadonlyMap<string, ForwardedWordAssignment> {
  const selected = new Map<string, ForwardedWordAssignment>();
  if (
    source === undefined ||
    input.metadataOnly === true ||
    blocks.length !== source.blocks.length ||
    blocks.some((block, index) => block !== source.blocks[index])
  )
    return selected;

  // Count every original use, including uses on cold paths, so a result that is
  // read anywhere else than by its adjacent store can never qualify.
  const uses = new Map<string, number>();
  for (const block of blocks) {
    for (const operation of block.operations)
      for (const value of potentialValueInputs(operation))
        uses.set(value, (uses.get(value) ?? 0) + 1);
    if (block.terminator.kind === "branch") uses.set(block.terminator.condition, Infinity);
    if (block.terminator.kind === "return" && block.terminator.value !== null)
      uses.set(block.terminator.value, Infinity);
  }

  // Parameters and locals of this function are the only roots whose homes the
  // function owns. A module-level variable and an imported asset live elsewhere.
  const globalKeys = new Set(
    input.program.semantic.globals.map((global) => bindingIdentityKey(global.id)),
  );
  const declaredRoots = new Set<string>();
  for (const block of blocks)
    for (const operation of block.operations) {
      if (operation.kind !== "load" && operation.kind !== "store") continue;
      if (operation.place.asset !== undefined) continue;
      const key = bindingIdentityKey(operation.place.root);
      if (!globalKeys.has(key)) declaredRoots.add(key);
    }

  // Position of each block, so an edge that goes back to an earlier block can be recognized.
  const order = new Map(blocks.map((block, index) => [block.id, index] as const));
  const definitions = valueDefinitions(blocks);

  // Variables a loop controls. Such a variable is represented far more cheaply elsewhere — as a
  // single byte or a register — so it is excluded wherever it is written, including where the
  // loop sets it up, because that narrowing needs one consistent representation across the
  // whole loop.
  //
  // The recognizer is deliberately conservative, and it is a backstop rather than an
  // identification: the facts that name loop counters are not populated on every pass that
  // lowers, so the shape has to be read off the blocks. Two signals are taken, because the two
  // loop forms place their exit test differently — a counted loop tests in the block that is
  // jumped back to, and a do-while tests in the block that jumps back. Anything it over-selects
  // merely keeps its scratch, which costs a saving rather than correctness.
  const inductionRoots = new Set<string>();
  const addControlRoots = (value: string): void => {
    const seen = new Set<string>();
    const pending = [value];
    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const current = pending[cursor]!;
      if (seen.has(current)) continue;
      seen.add(current);
      const definition = definitions.get(current);
      if (definition === undefined) continue;
      if (definition.kind === "load") {
        if (definition.place.path.length === 0)
          inductionRoots.add(bindingIdentityKey(definition.place.root));
        continue;
      }
      if (definition.kind === "binary") pending.push(definition.left, definition.right);
      else if (definition.kind === "unary" || definition.kind === "convert")
        pending.push(definition.operand);
    }
  };
  for (const [blockIndex, block] of blocks.entries()) {
    const targets =
      block.terminator.kind === "jump"
        ? [block.terminator.target]
        : block.terminator.kind === "branch"
          ? [block.terminator.whenTrue, block.terminator.whenFalse]
          : [];
    for (const target of targets) {
      const targetIndex = order.get(target);
      if (targetIndex === undefined || targetIndex > blockIndex) continue;
      // This edge closes an iteration. The exit test sits either here or at the block it
      // returns to, so both are read and whatever either tests is treated as controlled.
      for (const candidate of [block, blocks[targetIndex]]) {
        if (candidate?.terminator.kind === "branch")
          addControlRoots(candidate.terminator.condition);
      }
      // A block-final assignment on a closing edge advances the loop even when no test names
      // it, which covers a latch whose condition the walk above cannot resolve.
      const last = block.operations[block.operations.length - 1];
      if (last?.kind === "store" && last.place.path.length === 0)
        inductionRoots.add(bindingIdentityKey(last.place.root));
    }
  }

  for (const block of blocks) {
    for (const [index, operation] of block.operations.entries()) {
      if (
        operation.kind !== "binary" ||
        (operation.operator !== "+" && operation.operator !== "-") ||
        operation.integer?.width !== WORD_WIDTH ||
        operation.integer.signed ||
        !operation.integer.wrap ||
        !unsignedWordType(operation.type) ||
        !singleUseValues.has(operation.result) ||
        uses.get(operation.result) !== 1
      )
        continue;
      const store = block.operations[index + 1];
      if (
        store?.kind !== "store" ||
        store.value !== operation.result ||
        store.place.path.length !== 0 ||
        store.place.asset !== undefined ||
        !unsignedWordType(store.type) ||
        !unsignedWordType(store.place.rootType) ||
        !declaredRoots.has(bindingIdentityKey(store.place.root)) ||
        // A proved loop counter is already represented more cheaply than its declared word, as a
        // register or a single byte. Writing its word home here would undo that larger saving.
        narrowedCounters.has(bindingIdentityKey(store.place.root))
      )
        continue;
      if (inductionRoots.has(bindingIdentityKey(store.place.root))) continue;
      const left = operandShape(operation.left, definitions, declaredRoots, narrowedCounters);
      const right = operandShape(operation.right, definitions, declaredRoots, narrowedCounters);
      if (left === undefined || right === undefined) continue;
      selected.set(operation.result, Object.freeze({ store, left, right }));
    }
  }
  return selected;
}

/** One resolved declared home together with the private frame that owns it. */
interface DeclaredHome {
  /** Exact home the emitter will address. */
  readonly value: Extract<LoweredValue, { readonly kind: "storage" }>;
  /**
   * Identity of the owning function, execution domain and handler activation,
   * taken from the resolved request. Two homes that share it belong to the same
   * private frame.
   */
  readonly frame: string;
}

/**
 * Resolve one whole undecorated place to its own declared parameter or local home.
 *
 * Resolution goes through the same path the store itself uses, so a home found
 * here is exactly the home the store would have written. Anything that is not a
 * plain declared home of its own root resolves to nothing: a module-level
 * variable and an asset become a link-time label, a compiler-created scratch
 * carries a generated identity, an object-returning function has its root
 * rewritten onto a caller-owned pointer, and an interrupt local that was kept in
 * registers or on the hardware stack has no home at all.
 */
function declaredHome(
  place: SemanticPlace,
  state: FunctionLoweringState,
): DeclaredHome | undefined {
  const lowered = loweredPlace(place, WORD_BYTES, false, state);
  if (lowered.kind !== "storage" || lowered.offset !== undefined) return undefined;
  const key = bindingIdentityKey(place.root);
  for (const suffix of [`:local:${key}`, `:parameter:${key}`]) {
    if (lowered.requestId.endsWith(suffix))
      return Object.freeze({
        value: lowered,
        frame: lowered.requestId.slice(0, lowered.requestId.length - suffix.length),
      });
  }
  return undefined;
}

/**
 * Confirm against the resolved homes that the destination may be written early.
 *
 * Writing the destination's low byte happens before the high byte of an operand
 * is read, so the destination must not be able to share bytes with an operand at
 * a shifted offset. Declared parameter and local homes of one private frame are
 * live at every position of that frame, so static allocation always treats any
 * two of them as conflicting and never lays one across another; identical homes
 * are harmless, because the early write and the later read then touch different
 * bytes of the same variable. A home the compiler created for itself carries no
 * frame of its own and is not covered by that argument, so any operand which
 * arrives through one withdraws the whole decision.
 *
 * @param assignment Source shape already admitted by the barrier above.
 * @param left Resolved left operand, as the emitter will read it.
 * @param right Resolved right operand, as the emitter will read it.
 * @param state Current lowering context, which owns the home resolution.
 * @returns The destination home to compute into, or undefined to keep a scratch.
 */
export function forwardedWordDestination(
  assignment: ForwardedWordAssignment,
  left: LoweredValue,
  right: LoweredValue,
  state: FunctionLoweringState,
): Extract<LoweredValue, { readonly kind: "storage" }> | undefined {
  const destination = declaredHome(assignment.store.place, state);
  if (destination === undefined) return undefined;
  const operands = [
    [assignment.left, left],
    [assignment.right, right],
  ] as const;
  for (const [shape, resolved] of operands) {
    if (shape.kind === "constant") {
      if (resolved.kind !== "constant") return undefined;
      continue;
    }
    const home = declaredHome(shape.place, state);
    if (
      resolved.kind !== "storage" ||
      resolved.bytes !== WORD_BYTES ||
      resolved.offset !== undefined ||
      home === undefined ||
      home.value.requestId !== resolved.requestId ||
      home.frame !== destination.frame
    )
      return undefined;
  }
  return destination.value;
}
