import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import { valueDefinitions } from "../semantic/aggregate-place-proof.js";
import type {
  BinaryOperation,
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

/**
 * Largest exit-test literal counter narrowing can still admit.
 *
 * Narrowing reads the right operand of a less-than comparison and rejects anything above eight, so
 * a loop testing against a larger literal cannot be narrowed and needs no protection here.
 */
const NARROWING_EXTENT = 8;

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
/**
 * The literal extent of one exit test, when it is readable in the shape narrowing recognizes.
 *
 * Deliberately narrower than "any comparison against a constant": narrowing recognizes the
 * less-than form with the counter on the left and reads the right operand as an exclusive bound, so
 * only that spelling is read here. Any other arrangement yields nothing, which keeps its root
 * protected rather than inviting an off-by-one argument about inclusive tests or reversed operands.
 *
 * @param comparison Binary operation already known to use the less-than operator.
 * @param definitions Value definitions for the enclosing function.
 * @returns The exclusive literal bound, or `undefined` when the test is not in that shape.
 * @example
 * // `i < 100` yields 100, while `i <= 99`, `100 > i` and `i < limit` all yield undefined.
 */
function comparisonExtent(
  comparison: BinaryOperation,
  definitions: ReadonlyMap<string, SemanticOperation>,
): number | undefined {
  const right = definitions.get(comparison.right);
  if (right?.kind !== "constant" || typeof right.value !== "bigint") return undefined;
  if (right.value < 0n || right.value > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return Number(right.value);
}

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
  //
  // The exclusion is then narrowed again by what it is protecting. Counter narrowing only admits a
  // loop whose exit test compares against a literal of at most eight, so a loop that tests against
  // a larger literal has no cheaper representation to lose and keeps its declared word home either
  // way. For those the copy through a scratch is pure loss, and the destination is taken.
  //
  // That implication runs one way only. Evidence is collected per root and the extent has to be
  // readable on *every* signal that nominated it: one small literal, one test this walk cannot
  // read, or one nomination from the block-final fallback below — which has no condition to read
  // at all — keeps the root excluded. Protection wins ties.
  const controlEvidence = new Map<string, (number | undefined)[]>();
  const noteControlRoot = (key: string, extent: number | undefined): void => {
    const recorded = controlEvidence.get(key);
    if (recorded === undefined) controlEvidence.set(key, [extent]);
    else recorded.push(extent);
  };
  const addControlRoots = (value: string): Set<string> => {
    const named = new Set<string>();
    // The literal travels down the walk, so a compound test attributes each comparison's own
    // extent to the roots below it rather than smearing one across all of them.
    const seen = new Set<string>();
    const pending: (readonly [string, number | undefined])[] = [[value, undefined]];
    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const [current, extent] = pending[cursor]!;
      const visited = `${current}|${extent ?? ""}`;
      if (seen.has(visited)) continue;
      seen.add(visited);
      const definition = definitions.get(current);
      if (definition === undefined) continue;
      if (definition.kind === "load") {
        if (definition.place.path.length === 0) {
          const key = bindingIdentityKey(definition.place.root);
          noteControlRoot(key, extent);
          named.add(key);
        }
        continue;
      }
      if (definition.kind === "binary") {
        const literal =
          definition.operator === "<" ? comparisonExtent(definition, definitions) : extent;
        pending.push([definition.left, literal], [definition.right, literal]);
      } else if (definition.kind === "unary" || definition.kind === "convert")
        pending.push([definition.operand, extent]);
    }
    return named;
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
      const tested = new Set<string>();
      for (const candidate of [block, blocks[targetIndex]]) {
        if (candidate?.terminator.kind === "branch")
          for (const key of addControlRoots(candidate.terminator.condition)) tested.add(key);
      }
      // A block-final assignment on a closing edge advances the loop even when no test names it,
      // which covers a latch whose condition the walk above cannot resolve. It is a backstop, so
      // it stands down for a root the exit test already named: repeating that root without an
      // extent would permanently outvote the extent the test does supply.
      const last = block.operations[block.operations.length - 1];
      if (last?.kind === "store" && last.place.path.length === 0) {
        const key = bindingIdentityKey(last.place.root);
        if (!tested.has(key)) noteControlRoot(key, undefined);
      }
    }
  }
  const inductionRoots = new Set(
    [...controlEvidence]
      .filter(([, extents]) =>
        extents.some((extent) => extent === undefined || extent <= NARROWING_EXTENT),
      )
      .map(([key]) => key),
  );

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
