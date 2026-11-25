import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import type {
  SemanticBlock,
  SemanticFunction,
  SemanticGlobal,
  SemanticOperation,
  SemanticPlace,
  ValueId,
} from "./operations.js";
import { constantValue, staticPlaceOffset } from "./block-index-values.js";
import type { Definitions } from "./block-index-values.js";
import {
  SELECTOR_PRESERVING_UNARY,
  UNSHIFTED,
  complemented,
  displaced,
  negated,
} from "./block-index-selector.js";
import type { SelectorReach, SelectorState } from "./block-index-selector.js";

/**
 * The arguments that make the video chip fetch the object a value was computed
 * from, by capability and exact argument position.
 *
 * Belonging to the `c64.vic.*` namespace is not the question. A border colour, a
 * sprite's colour, its position and its index are ordinary numbers, and nothing
 * about writing one makes the chip read the object whose address happened to be
 * divided to produce it. Demanding chip-visible storage for that object narrows
 * storage the chip never looks at, which for a large object can leave no legal
 * home at all. A sprite block number is the one argument this pass recognizes
 * whose value decides where the chip looks.
 *
 * The capabilities that take an address rather than a block number — the sprite,
 * charset, bitmap and screen selectors — prove their own bank, window and
 * alignment constraints when they are lowered. They are deliberately absent:
 * their argument is an address, so even where such arithmetic appears inside one
 * it denotes some other address rather than this object's block.
 */
const VIC_FETCH_ARGUMENTS: ReadonlyMap<string, number> = new Map([["c64.vic.setSpritePointer", 1]]);

/**
 * One scanned body together with the values it defines.
 *
 * A block number can be computed in one function and published in another, so the
 * proof that the video chip receives it walks bodies rather than stopping at the
 * edge of the one that did the arithmetic. Value identities are qualified by the
 * body that defines them, which is why a definition map belongs to a body rather
 * than to the program.
 */
export interface ScannedBody {
  /**
   * Identity of the function this body belongs to, or null for a module
   * initializer, whose result no call site can receive.
   */
  readonly owner: string | null;
  /** Basic blocks of this body in construction order. */
  readonly blocks: readonly SemanticBlock[];
  /** Values this body defines, for static address and index resolution. */
  readonly definitions: Definitions;
}

/** One call whose result a caller receives, kept with the body that receives it. */
interface CallSite {
  /** Body containing the call. */
  readonly body: ScannedBody;
  /** Value the caller receives. */
  readonly result: ValueId;
}

/**
 * Every body the walk may enter, with call sites indexed by callee.
 *
 * Leaving a body means resuming at the callers of its function. Rediscovering
 * those callers by scanning the program each time is the same answer computed
 * repeatedly, so they are indexed once, in the same traversal that indexes each
 * body's definitions.
 */
export interface ProgramWalk {
  /** Function and initializer bodies in declaration order. */
  readonly bodies: readonly ScannedBody[];
  /** Call sites that keep a result, by callee identity. */
  readonly callSites: ReadonlyMap<string, readonly CallSite[]>;
  /** Module objects, whose storage any other body or an interrupt may read. */
  readonly moduleObjects: ReadonlySet<string>;
}

/**
 * Values the walk has already followed, kept per body.
 *
 * A value identity is unique only within the body that defines it, so two bodies
 * may name different values the same. One shared set would treat the second as
 * already walked and answer that it reaches nothing — and answering that way
 * wrongly is what leaves a sprite where the chip cannot see it.
 */
type WalkedValues = Map<ScannedBody, Set<string>>;

/** Values already followed in one body, created on first use. */
function walkedIn(walked: WalkedValues, body: ScannedBody): Set<string> {
  const seen = walked.get(body);
  if (seen !== undefined) return seen;
  const created = new Set<string>();
  walked.set(body, created);
  return created;
}

/**
 * Identity of one step of the walk: a value together with the arithmetic
 * applied to the selector on the way here.
 *
 * The arithmetic belongs in the identity because the same value can be reached
 * with different arithmetic, and those steps answer the question differently —
 * one may designate this object's second block and another nothing at all.
 */
function walkStep(value: ValueId, state: SelectorState): string {
  return `${value}:${state.sign}:${state.offset}`;
}

/**
 * Collect every place the video chip reads one recognized block selector.
 *
 * The walk follows the number forward through the forms ordinary code puts
 * between the arithmetic and the hardware: conversions, operators that leave
 * the value alone, a constant displacement that names a later block, a join
 * that chooses it on one path, a variable it is stored in and read back out of,
 * and a return into every call site that receives it. `lo(address / 64)`
 * narrows the number to the byte the register takes, and that narrowing is
 * followed even though it discards information, because the value the chip
 * receives is still derived from this address and no other.
 *
 * What it does not follow is arithmetic that destroys the selector: taking the
 * high byte leaves a value in `0..3` naming a block in the first 256 bytes of
 * the bank, and multiplying or masking names something unrelated. Claiming
 * provenance there would narrow storage the chip never reads.
 *
 * @param value Selector value to follow.
 * @param body Body that defines the value.
 * @param walk Indexed bodies and call sites.
 * @param reach Accumulator the caller reads the answer from.
 * @param state Arithmetic applied to the selector so far.
 * @param walked Steps already taken, which is what terminates a cycle.
 */
export function collectSelectorReach(
  value: ValueId,
  body: ScannedBody,
  walk: ProgramWalk,
  reach: SelectorReach,
  state: SelectorState = UNSHIFTED,
  walked: WalkedValues = new Map(),
): void {
  // Holding a block number in a variable before publishing it is ordinary, and
  // a place can be written and read repeatedly, so the walk remembers where it
  // has been rather than assuming the derivation chain is acyclic.
  const seen = walkedIn(walked, body);
  const step = walkStep(value, state);
  if (seen.has(step)) return;
  seen.add(step);
  const follow = (next: ValueId, nextState: SelectorState): void =>
    collectSelectorReach(next, body, walk, reach, nextState, walked);
  for (const block of body.blocks) {
    for (const [index, operation] of block.operations.entries()) {
      if (operation.kind === "platform") {
        // The position matters as much as the capability: the same call takes a
        // sprite's index beside its block number, and only one of the two says
        // anything about where the chip reads. A negated selector rises as the
        // block number falls, so it names no fixed part of this object.
        const fetched = VIC_FETCH_ARGUMENTS.get(operation.capability);
        if (fetched !== undefined && operation.arguments[fetched] === value && state.sign === 1)
          reach.displacements.add(state.offset);
      }
      if (operation.kind === "convert" && operation.operand === value)
        follow(operation.result, state);
      if (operation.kind === "unary" && operation.operand === value) {
        if (SELECTOR_PRESERVING_UNARY.has(operation.operator)) follow(operation.result, state);
        if (operation.operator === "~") follow(operation.result, complemented(state));
        if (operation.operator === "-") follow(operation.result, negated(state));
      }
      // `block + 1` names the next block of the same object, which is how an
      // author selects frame one of a sheet without writing the offset out. A
      // displacement decided at run time names an element nothing here can
      // identify, so it widens the demand rather than adding to it.
      if (
        operation.kind === "binary" &&
        (operation.operator === "+" || operation.operator === "-")
      ) {
        const left = operation.left === value;
        const right = operation.right === value;
        if (left || right) {
          const other = constantValue(
            body.definitions.get(left ? operation.right : operation.left),
            body.definitions,
          );
          if (other === null) reach.runtimeSelected = true;
          else if (operation.operator === "+") follow(operation.result, displaced(state, other));
          else if (left) follow(operation.result, displaced(state, -other));
          else follow(operation.result, displaced(negated(state), other));
        }
      }
      // `cond ? lo(&sprites / 64) : 0` publishes the block number on one path.
      // A value that arrives at a join is the join's value on the path it came
      // from, so one incoming edge is enough: the chip receives this address
      // whenever that path runs, and a sprite the chip cannot see on some frames
      // is still a sprite the chip cannot see.
      if (operation.kind === "merge" && operation.incoming.some((edge) => edge.value === value))
        follow(operation.result, state);
      // `let block = lo(&sprites / 64);` publishes through a variable. The read
      // is matched on the written object rather than the exact field, because a
      // demand against an object that did not need one is the cheaper way to be
      // wrong than a sprite the chip cannot see. It is not free, though: an
      // object too large for a visible home pays for an unnecessary demand with
      // a failed build, which is why a value this store provably replaces stops
      // the search here.
      if (operation.kind === "store" && operation.value === value)
        collectLoadedSelectorReach(
          operation.place,
          semanticTypeSize(operation.type),
          block,
          index,
          body,
          walk,
          reach,
          state,
          walked,
        );
    }
  }
  // Computing the block number in a helper and publishing the result is ordinary
  // style, so the walk follows the value out through the return and resumes at
  // every call site. Resuming with the same walk also covers a helper that only
  // hands another helper's answer on, and an initializer has no caller to resume
  // in, which is what distinguishes a body with an owner from one without.
  if (body.owner !== null && leavesByReturn(value, body.blocks))
    for (const site of walk.callSites.get(body.owner) ?? [])
      collectSelectorReach(site.result, site.body, walk, reach, state, walked);
}

/**
 * Position of the operation that provably replaces one stored value, or null
 * when nothing in this body proves the value is gone.
 *
 * Proof needs three things, and all of them are deliberately narrow. The
 * replacing store has to be in the same basic block and later, so no control
 * flow can reach the chip between the two. Both places have to resolve to the
 * same statically known bytes of the same object, since `frames[i] = 0` says
 * nothing about which element `frames[j]` named. And the written object has to
 * be private to this body: a module object can be read by another function or
 * by an interrupt that runs between the two stores, and the demand this would
 * remove is the only thing keeping such a sprite visible.
 */
function definiteReplacement(
  place: SemanticPlace,
  width: number,
  block: SemanticBlock,
  storeIndex: number,
  body: ScannedBody,
  walk: ProgramWalk,
): number | null {
  const written = bindingIdentityKey(place.root);
  if (walk.moduleObjects.has(written)) return null;
  const offset = staticPlaceOffset(place, body.definitions);
  if (offset === null) return null;
  for (const [index, operation] of block.operations.entries()) {
    if (index <= storeIndex || operation.kind !== "store") continue;
    if (bindingIdentityKey(operation.place.root) !== written) continue;
    if (staticPlaceOffset(operation.place, body.definitions) !== offset) continue;
    // A narrower store leaves part of the original value in place, so only one
    // covering the same bytes replaces what the chip would otherwise receive.
    if (semanticTypeSize(operation.type) < width) continue;
    return index;
  }
  return null;
}

/**
 * Continue the walk through every read of one written object.
 *
 * Reads are matched on the object rather than the exact field, so an unrelated
 * field of the same struct still raises the demand. When this body provably
 * replaces the stored value further down the same block, only the reads between
 * the two can see it: a read anywhere else gets either an older value or the
 * replacement, and neither is this block number.
 */
function collectLoadedSelectorReach(
  place: SemanticPlace,
  width: number,
  storeBlock: SemanticBlock,
  storeIndex: number,
  body: ScannedBody,
  walk: ProgramWalk,
  reach: SelectorReach,
  state: SelectorState,
  walked: WalkedValues,
): void {
  const written = bindingIdentityKey(place.root);
  const replaced = definiteReplacement(place, width, storeBlock, storeIndex, body, walk);
  const reads =
    replaced === null
      ? body.blocks.flatMap((block) => block.operations)
      : storeBlock.operations.slice(storeIndex + 1, replaced);
  for (const operation of reads)
    if (operation.kind === "load" && bindingIdentityKey(operation.place.root) === written)
      collectSelectorReach(operation.result, body, walk, reach, state, walked);
}

/** Whether one value is handed to this body's callers as its result. */
function leavesByReturn(value: ValueId, blocks: readonly SemanticBlock[]): boolean {
  return blocks.some(
    (block) => block.terminator.kind === "return" && block.terminator.value === value,
  );
}

/** One call this body makes, kept until the body it belongs to exists. */
interface BodyCall {
  /** Callee identity. */
  readonly callee: string;
  /** Value this body receives. */
  readonly result: ValueId;
}

/**
 * Index one body's value definitions and the calls it makes, in one traversal of
 * its operations. The calls come back separately because a call site is recorded
 * against the body that makes it, which does not exist until this returns.
 */
function scannedBody(
  owner: string | null,
  blocks: readonly SemanticBlock[],
): { readonly body: ScannedBody; readonly calls: readonly BodyCall[] } {
  const definitions = new Map<string, SemanticOperation>();
  const calls: BodyCall[] = [];
  for (const block of blocks)
    for (const operation of block.operations) {
      const result = "result" in operation ? operation.result : null;
      if (result !== null && result !== undefined) definitions.set(result, operation);
      if (operation.kind === "call" && operation.result !== null)
        calls.push(
          Object.freeze({ callee: bindingIdentityKey(operation.callee), result: operation.result }),
        );
    }
  return { body: Object.freeze({ owner, blocks, definitions }), calls };
}

/**
 * Index every body of one program, and the call sites that keep a result.
 *
 * Both indexes come out of the one traversal of the operations: the walk needs
 * each body's definitions anyway, and a caller search that rescans the program
 * is the same answer computed again for every value that leaves a body.
 */
export function scanProgram(
  functions: readonly SemanticFunction[],
  globals: readonly SemanticGlobal[],
): ProgramWalk {
  const scanned = [
    ...functions.map((fn) => scannedBody(bindingIdentityKey(fn.id), fn.blocks)),
    ...globals.map((global) => scannedBody(null, global.blocks)),
  ];
  const callSites = new Map<string, CallSite[]>();
  for (const { body, calls } of scanned)
    for (const call of calls) {
      const sites = callSites.get(call.callee) ?? [];
      sites.push(Object.freeze({ body, result: call.result }));
      callSites.set(call.callee, sites);
    }
  return Object.freeze({
    bodies: Object.freeze(scanned.map(({ body }) => body)),
    callSites,
    moduleObjects: new Set(globals.map((global) => bindingIdentityKey(global.id))),
  });
}
