import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import type { SemanticBlock, SemanticOperation, SemanticPlace, ValueId } from "./operations.js";
import { constantValue, staticPlaceOffset } from "./block-index-values.js";
import type { ProgramWalk, ScannedBody } from "./block-index-program.js";
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
      // Handing the number to a function continues the proof inside it: an
      // argument is the mirror of a return, and a parameter read is a read of a
      // place like any other. A call through an address names no callee here,
      // so there is no body to continue into — which is not evidence that the
      // chip never receives the number. The same is true of storing it in
      // module storage, which any other body can read.
      if (operation.kind === "indirect-call" && operation.arguments.includes(value))
        reach.escaped = true;
      if (operation.kind === "call")
        for (const [position, argument] of operation.arguments.entries())
          if (argument === value)
            enterParameter(
              bindingIdentityKey(operation.callee),
              position,
              walk,
              reach,
              state,
              walked,
            );
      if (
        operation.kind === "store" &&
        operation.value === value &&
        walk.moduleObjects.has(bindingIdentityKey(operation.place.root))
      )
        reach.escaped = true;
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
  if (body.owner !== null && leavesByReturn(value, body.blocks)) {
    // Where this function's address exists, it can be called through that
    // address — from a pointer variable or a dispatch table — and such a call
    // names no callee here. Every call of that kind is an indirect call, so the
    // places the result can arrive are the indirect calls accepting this
    // function's shape. Following them, rather than giving up on the value,
    // keeps the demand to what the chip reads where something publishes the
    // number and states no demand at all where nothing does.
    if (walk.functionAddressTaken.has(body.owner) && body.shape !== null)
      for (const site of walk.indirectResults.get(body.shape) ?? [])
        collectSelectorReach(site.result, site.body, walk, reach, state, walked);
    for (const site of walk.callSites.get(body.owner) ?? [])
      collectSelectorReach(site.result, site.body, walk, reach, state, walked);
  }
}

/**
 * Continue the walk inside a called function, at the parameter the argument was
 * passed to.
 *
 * An argument is the mirror of a return: a returned value resumes at the
 * caller's call site, and an argument resumes at the callee's parameter, with
 * the arithmetic applied to the selector crossing the boundary either way. The
 * position matters as much as the callee, because the same call takes a
 * sprite's index beside its block number.
 *
 * A parameter whose address is taken can be read through that address rather
 * than by name, and a callee or position this pass cannot resolve has no body
 * to continue into. Neither is evidence that the chip never receives the
 * number.
 */
function enterParameter(
  callee: string,
  position: number,
  walk: ProgramWalk,
  reach: SelectorReach,
  state: SelectorState,
  walked: WalkedValues,
): void {
  const body = walk.bodiesByOwner.get(callee);
  const parameter = body?.parameters[position];
  if (body === undefined || parameter === undefined) {
    reach.escaped = true;
    return;
  }
  if (walk.addressTaken.has(parameter.key)) reach.escaped = true;
  followReads(
    body.blocks.flatMap((block) => block.operations),
    parameter.key,
    body,
    walk,
    reach,
    state,
    walked,
  );
}

/** Continue the walk at every load of one object among the given operations. */
function followReads(
  operations: readonly SemanticOperation[],
  read: string,
  body: ScannedBody,
  walk: ProgramWalk,
  reach: SelectorReach,
  state: SelectorState,
  walked: WalkedValues,
): void {
  for (const operation of operations)
    if (operation.kind === "load" && bindingIdentityKey(operation.place.root) === read)
      collectSelectorReach(operation.result, body, walk, reach, state, walked);
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
  // Two writes land somewhere this walk cannot account for. Once the written
  // object's address exists, a read can be made through it by an operation this
  // walk does not match, in any body. And a write through a borrowed parameter
  // lands in the caller's object, whose reads are not in this body at all.
  // Either way the number may reach the chip unseen, so the whole object is the
  // honest demand — while the reads that are visible here still contribute
  // everything they prove.
  if (walk.addressTaken.has(written)) reach.escaped = true;
  if (body.parameters.some((parameter) => parameter.key === written && parameter.borrowed))
    reach.escaped = true;
  const replaced = definiteReplacement(place, width, storeBlock, storeIndex, body, walk);
  const reads =
    replaced === null
      ? body.blocks.flatMap((block) => block.operations)
      : storeBlock.operations.slice(storeIndex + 1, replaced);
  followReads(reads, written, body, walk, reach, state, walked);
}

/** Whether one value is handed to this body's callers as its result. */
function leavesByReturn(value: ValueId, blocks: readonly SemanticBlock[]): boolean {
  return blocks.some(
    (block) => block.terminator.kind === "return" && block.terminator.value === value,
  );
}
