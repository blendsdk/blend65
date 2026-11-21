import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import { valueDefinitions } from "../semantic/aggregate-place-proof.js";
import { FIXED_LOOP_MAX_BOUND } from "../semantic/fixed-loop-facts.js";
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

/** Byte width of the two-byte unsigned wrapping form this selection serves. */
export const WORD_BYTES = 2;

/** Bit width of that same form, as the checked integer facts record it. */
export const WORD_WIDTH = 16;

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

/** One loop counter named by an exit test, with the extent that test compares it against. */
interface ControlledExtent {
  /** Binding identity of the counter the test reads. */
  readonly root: string;
  /** Exclusive literal bound the test compares it against. */
  readonly extent: number;
}

/**
 * Recognize one exit test in the exact shape counter narrowing reads, and name the counter it
 * controls together with the literal extent it is compared against.
 *
 * Narrowing matches a less-than comparison whose left operand is a whole unsigned-word load and
 * whose right operand is a literal, and it treats that literal as an exclusive bound. The same two
 * operands are required here, so this cannot credit an extent to a variable narrowing would never
 * have considered — in `i - j < 100` the left operand is arithmetic rather than a counter load, so
 * nothing is recognized and both variables stay protected. Only the canonical spelling is read,
 * which keeps inclusive tests and reversed operands out of the decision rather than inviting an
 * off-by-one argument about them.
 *
 * @param comparison Binary operation already known to use the less-than operator.
 * @param definitions Value definitions for the enclosing function.
 * @returns The counter and its exclusive bound, or `undefined` when the test is not in that shape.
 * @example
 * // `i < 100` names `i` with extent 100. `i <= 99`, `100 > i`, `i < limit` and `i - j < 100`
 * // all yield undefined, which leaves every variable they mention protected.
 */
function comparisonExtent(
  comparison: BinaryOperation,
  definitions: ReadonlyMap<string, SemanticOperation>,
): ControlledExtent | undefined {
  const left = definitions.get(comparison.left);
  if (
    left?.kind !== "load" ||
    left.place.path.length !== 0 ||
    left.type.kind !== "scalar" ||
    left.type.name !== "word"
  )
    return undefined;
  const right = definitions.get(comparison.right);
  if (right?.kind !== "constant" || typeof right.value !== "bigint") return undefined;
  if (right.value < 0n || right.value > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return Object.freeze({
    root: bindingIdentityKey(left.place.root),
    extent: Number(right.value),
  });
}

/**
 * Recognize a countdown's exit test and name the counter together with the extent it can reach.
 *
 * A descending loop's test bounds its counter from below and says nothing about how large it gets,
 * so unlike an ascending test it cannot supply an extent by itself. `i > 0` is satisfied by one and
 * by sixty thousand alike. What does bound such a counter is where it starts: a variable seeded once
 * with a literal and thereafter only ever reduced lands exactly on zero and stops, so it never
 * exceeds that literal and the seed is the extent — plus one, because an extent is an exclusive
 * bound and the seed itself is a value the counter takes.
 *
 * Every part of that argument is required rather than assumed, and the last part is the one that is
 * easy to miss. A second seed would mean the counter can restart from a value this reasoning never
 * saw. An update that is not a subtraction of a positive literal from the counter itself would mean
 * it can grow again. And the step has to divide the seed, because word arithmetic wraps: counting
 * down from a thousand by three reaches one, passes the test, and lands on 65534 — which is both
 * above the seed and a loop with no exit. Steps that differ between update sites are excluded for
 * the same reason, since together they can straddle zero without ever meeting it.
 *
 * Nothing of value is lost to that last requirement. A step of one always divides, and a larger step
 * that does not describes a loop that never ends.
 *
 * Only the canonical spelling is read, matching the ascending recognizer's discipline: the test
 * must compare a whole unsigned-word load against literal zero. `i >= 1` says the same thing and is
 * deliberately not recognized, so no off-by-one argument has to be settled here.
 *
 * @param comparison Binary operation already known to use the greater-than operator.
 * @param definitions Value definitions for the enclosing function.
 * @param blocks Original blocks, since the seed and the update are not local to the test.
 * @returns The counter and its exclusive bound, or `undefined` when the shape is not recognized.
 * @example
 * // `for (let i: word = 1000; i > 0; i -= 1)` names `i` with extent 1001.
 * // `i > 1`, `i >= 1`, a counter seeded twice, one that is also added to, and one stepping by a
 * // value that does not divide its seed all yield undefined, which leaves the counter protected.
 */
function descendingExtent(
  comparison: BinaryOperation,
  definitions: ReadonlyMap<string, SemanticOperation>,
  blocks: readonly SemanticBlock[],
): ControlledExtent | undefined {
  const left = definitions.get(comparison.left);
  if (
    left?.kind !== "load" ||
    left.place.path.length !== 0 ||
    left.type.kind !== "scalar" ||
    left.type.name !== "word"
  )
    return undefined;
  const right = definitions.get(comparison.right);
  if (right?.kind !== "constant" || right.value !== 0n) return undefined;
  const root = bindingIdentityKey(left.place.root);

  let seed: bigint | undefined;
  let step: bigint | undefined;
  let reductions = 0;
  for (const block of blocks)
    for (const operation of block.operations) {
      if (operation.kind !== "store" || operation.place.path.length !== 0) continue;
      if (operation.place.asset !== undefined) return undefined;
      if (bindingIdentityKey(operation.place.root) !== root) continue;
      const stored = definitions.get(operation.value);
      if (stored?.kind === "constant" && typeof stored.value === "bigint") {
        if (seed !== undefined) return undefined;
        seed = stored.value;
        continue;
      }
      if (stored?.kind !== "binary" || stored.operator !== "-") return undefined;
      const target = definitions.get(stored.left);
      if (
        target?.kind !== "load" ||
        target.place.path.length !== 0 ||
        bindingIdentityKey(target.place.root) !== root
      )
        return undefined;
      const amount = definitions.get(stored.right);
      if (amount?.kind !== "constant" || typeof amount.value !== "bigint" || amount.value <= 0n)
        return undefined;
      if (step !== undefined && step !== amount.value) return undefined;
      step = amount.value;
      reductions += 1;
    }
  if (seed === undefined || step === undefined || reductions === 0) return undefined;
  if (seed < 0n || seed >= BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  // Only a step that divides the seed brings the counter to zero. Anything else steps over it and
  // wraps to a value above the seed, which would make the extent recorded here a false bound.
  if (seed % step !== 0n) return undefined;
  return Object.freeze({ root, extent: Number(seed) + 1 });
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
 * const forwarded = selectForwardedWordAssignments(
 *   input, main, main.blocks, singleUse, narrowedCounters);
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
  //
  // The exclusion is then narrowed again by what it is protecting. Counter narrowing only admits a
  // loop whose exit test compares against a literal within the bound it publishes, so a loop that
  // tests against a larger literal has no cheaper representation to lose and keeps its declared
  // word home either way. For those the copy through a scratch is pure loss, and the destination
  // is taken. The bound is imported rather than restated, because the two decisions have to agree:
  // if narrowing were ever widened while a copy of its limit stayed behind, the two would fight
  // over the counter's representation.
  //
  // That implication runs one way only. Evidence is collected per root and an extent has to be
  // readable on *every* signal that nominated it, so one unreadable signal keeps the root
  // excluded and protection wins ties. An extent is only ever recorded for the counter an exit
  // test names in narrowing's own canonical shape; every other variable a test mentions is
  // recorded with no extent, which protects it.
  const controlEvidence = new Map<string, (number | undefined)[]>();
  const noteControlRoot = (key: string, extent: number | undefined): void => {
    const recorded = controlEvidence.get(key);
    if (recorded === undefined) controlEvidence.set(key, [extent]);
    else recorded.push(extent);
  };
  const addControlRoots = (value: string): Set<string> => {
    const named = new Set<string>();
    const seen = new Set<string>();
    const pending = [value];
    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const current = pending[cursor]!;
      if (seen.has(current)) continue;
      seen.add(current);
      const definition = definitions.get(current);
      if (definition === undefined) continue;
      if (definition.kind === "load") {
        if (definition.place.path.length === 0) {
          const key = bindingIdentityKey(definition.place.root);
          noteControlRoot(key, undefined);
          named.add(key);
        }
        continue;
      }
      if (definition.kind === "binary") {
        // A test in narrowing's canonical shape names its counter outright, so that counter is
        // credited with the extent and its load is not walked. Walking it would record it a
        // second time with no extent, and the protective default would outvote the extent the
        // test just supplied.
        //
        // A countdown is credited the same way, from where its counter starts rather than from
        // what the test compares against, because its test bounds the counter from below only.
        const credited =
          definition.operator === "<"
            ? comparisonExtent(definition, definitions)
            : definition.operator === ">"
              ? descendingExtent(definition, definitions, blocks)
              : undefined;
        if (credited !== undefined) {
          noteControlRoot(credited.root, credited.extent);
          named.add(credited.root);
          continue;
        }
        pending.push(definition.left, definition.right);
      } else if (definition.kind === "unary" || definition.kind === "convert")
        pending.push(definition.operand);
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
      // it stands down for a root this edge's test already named — it does not veto in that case,
      // because repeating the root without an extent would permanently outvote the extent the
      // test does supply.
      //
      // Standing down is safe because every loop form builds its condition block before its body
      // and update, so the edge that closes an iteration always leads back to a block at or
      // before this one and the condition is always among the two read above. No loop can
      // therefore reach the backstop without its own test having been offered first.
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
        extents.some((extent) => extent === undefined || extent <= FIXED_LOOP_MAX_BOUND),
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
export interface DeclaredHome {
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
export function declaredHome(
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
