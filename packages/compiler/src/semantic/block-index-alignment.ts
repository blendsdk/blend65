import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import { mergeVicFetchRanges, vicConsumerBytes } from "../target/vic-fetch.js";
import type { VicFetchRange } from "../target/vic-fetch.js";
import type {
  SemanticBlock,
  SemanticFunction,
  SemanticGlobal,
  SemanticOperation,
  SemanticPlace,
  ValueId,
} from "./operations.js";

/** One storage use that requires a stronger alignment than the declaration states. */
interface AlignmentDemand {
  /** Required first-byte alignment for the effective address. */
  readonly align: number;
  /** Static byte offset from the module object's first byte. */
  readonly offset: number;
  /**
   * Runs the video chip fetches because of this use, empty when nothing proves
   * the chip receives the block number at all.
   */
  readonly fetched: readonly VicFetchRange[];
  /** Whether the block this use selects is decided at run time. */
  readonly runtimeSelected: boolean;
  /** The block-index expression this use was recognized from. */
  readonly span: SourceSpan;
}

/**
 * Region that keeps an object both inside the VIC bank and clear of the
 * character-ROM window the chip reads instead of RAM.
 */
const VIC_VISIBLE_REGION = "c64.vic.bank0-ram";

/** Regions that already satisfy the VIC, so a stated one is strengthened rather than refused. */
const VIC_REGIONS: ReadonlySet<string> = new Set(["c64.vic.bank0", VIC_VISIBLE_REGION]);

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
 * Bytes the chip fetches once it receives a block number from this pass.
 *
 * Every argument recognized above selects a sprite image, so one extent answers
 * for all of them. The capabilities that select a character set, a bitmap or the
 * screen matrix fetch more, and they take an address rather than a block number,
 * which is why they prove their own constraints when they are lowered.
 */
const FETCHED_BYTES = vicConsumerBytes("vic-sprite-block");

/**
 * Unary operators that leave a block selector's value untouched.
 *
 * `lo` narrows a selector to the byte the register takes, and a unary plus is
 * the value itself, so a chip receiving either still fetches from the address
 * this block number was computed from.
 */
const SELECTOR_PRESERVING_UNARY: ReadonlySet<string> = new Set(["lo", "+"]);

/** A sprite pointer is one byte, so every selector step is taken modulo this. */
const SELECTOR_MODULUS = 256;

/**
 * What the chip would receive, written as `sign * block + offset` over the block
 * number this pass recognized.
 *
 * Tracking the arithmetic rather than refusing to follow it is what lets one
 * walk answer three questions that look different and are not. Adding a
 * constant selects a later block of the same object, which is how an author
 * names frame one of a sheet. Complementing the number names an unrelated
 * block — and complementing it again restores the original exactly, so a step
 * the walk would otherwise abandon can come back. Reaching the chip with a
 * negated selector proves nothing about this object, while reaching it with a
 * displacement of `k` proves the chip reads the block `k` further in.
 */
interface SelectorState {
  /** `1` while the selector still rises with the block number, `-1` once negated. */
  readonly sign: 1 | -1;
  /** Constant added to the selector so far, in blocks. */
  readonly offset: number;
}

/** The selector exactly as the recognized block index produced it. */
const UNSHIFTED: SelectorState = Object.freeze({ sign: 1, offset: 0 });

/** Apply one complement, which negates the selector and shifts it. */
function complemented(state: SelectorState): SelectorState {
  return Object.freeze({
    sign: state.sign === 1 ? -1 : 1,
    offset: (SELECTOR_MODULUS - 1 - state.offset + SELECTOR_MODULUS) % SELECTOR_MODULUS,
  });
}

/** Apply one negation, which negates the selector without shifting the block. */
function negated(state: SelectorState): SelectorState {
  return Object.freeze({
    sign: state.sign === 1 ? -1 : 1,
    offset: (SELECTOR_MODULUS - state.offset) % SELECTOR_MODULUS,
  });
}

/** Add a constant number of blocks to the selector. */
function displaced(state: SelectorState, blocks: number): SelectorState {
  return Object.freeze({
    sign: state.sign,
    offset: (((state.offset + blocks) % SELECTOR_MODULUS) + SELECTOR_MODULUS) % SELECTOR_MODULUS,
  });
}

/**
 * Where the video chip reads this object, collected while walking one selector.
 *
 * Several publications of one object contribute several displacements, and they
 * all hold: satisfying the first says nothing about the second. A displacement
 * decided at run time cannot be named, so it is recorded as such and widens the
 * demand instead of adding to it.
 */
interface SelectorReach {
  /** Block displacements at which the chip provably receives this selector. */
  readonly displacements: Set<number>;
  /** Whether some publication's displacement is only known at run time. */
  runtimeSelected: boolean;
}

/** One value definition retained for static address and index resolution. */
type Definitions = ReadonlyMap<string, SemanticOperation>;

/**
 * One scanned body together with the values it defines.
 *
 * A block number can be computed in one function and published in another, so the
 * proof that the video chip receives it walks bodies rather than stopping at the
 * edge of the one that did the arithmetic. Value identities are qualified by the
 * body that defines them, which is why a definition map belongs to a body rather
 * than to the program.
 */
interface ScannedBody {
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
interface ProgramWalk {
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
 * Resolve the integer value of one constant expression, or null when it is
 * not compile-time known. Conversions preserve the mathematical value except
 * for truncation, which masks to the converted scalar width.
 */
function constantValue(
  operation: SemanticOperation | undefined,
  definitions: Definitions,
): number | null {
  if (operation?.kind === "constant")
    return typeof operation.value === "boolean"
      ? operation.value
        ? 1
        : 0
      : Number(operation.value);
  if (operation?.kind !== "convert") return null;
  const value = constantValue(definitions.get(operation.operand), definitions);
  if (value === null) return null;
  if (operation.conversion !== "truncate") return value;
  const bits = semanticTypeSize(operation.type) * 8;
  const mask = 2 ** bits - 1;
  return value & mask;
}

/**
 * Follow only bit-preserving conversions. A narrowing or value-changing
 * conversion means the value is no longer the object's full address, so the
 * block-index shape does not apply.
 */
function throughConversions(
  value: ValueId,
  definitions: Definitions,
): SemanticOperation | undefined {
  let current = definitions.get(value);
  for (;;) {
    if (
      current?.kind !== "convert" ||
      (current.conversion !== "identity" && current.conversion !== "reinterpret")
    )
      return current;
    current = definitions.get(current.operand);
  }
}

/** Follow widening conversions too; they preserve the numeric value of a selector half. */
function throughWidening(value: ValueId, definitions: Definitions): SemanticOperation | undefined {
  let current = definitions.get(value);
  for (;;) {
    if (current?.kind !== "convert") return current;
    if (current.conversion === "truncate") return current;
    current = definitions.get(current.operand);
  }
}

/** Locate the address-of operation behind one value, following preserving conversions. */
function addressOperation(
  value: ValueId,
  definitions: Definitions,
): Extract<SemanticOperation, { readonly kind: "place-address" }> | undefined {
  const operation = throughConversions(value, definitions);
  return operation?.kind === "place-address" ? operation : undefined;
}

/** Locate the operand of a `hi` unary operation behind one preserving conversion. */
function highByteOperand(value: ValueId, definitions: Definitions): ValueId | null {
  const operation = throughWidening(value, definitions);
  return operation?.kind === "unary" && operation.operator === "hi" ? operation.operand : null;
}

/** Locate the operand of a `lo` unary operation behind one preserving conversion. */
function lowByteOperand(value: ValueId, definitions: Definitions): ValueId | null {
  const operation = throughWidening(value, definitions);
  return operation?.kind === "unary" && operation.operator === "lo" ? operation.operand : null;
}

/**
 * Compute the static byte offset of one place, or null when a runtime index
 * decides it. Only field offsets and constant element indices are provable;
 * a runtime index is left outside the inference domain.
 */
function staticPlaceOffset(place: SemanticPlace, definitions: Definitions): number | null {
  let type: SemanticType | undefined = place.rootType;
  let offset = 0;
  for (const step of place.path) {
    if (step.kind === "field") {
      if (type?.kind !== "struct") return null;
      const field = type.fields.find(({ name }) => name === step.name);
      if (field === undefined) return null;
      offset += field.offset;
      type = field.type;
      continue;
    }
    if (type?.kind !== "array") return null;
    const index = constantValue(definitions.get(step.value), definitions);
    if (index === null || index < 0 || index >= type.length) return null;
    offset += semanticTypeSize(type.element) * index;
    type = type.element;
  }
  return offset;
}

/**
 * Whether one value reaches a larger arithmetic expression, including through
 * value-preserving conversions such as `word(hi(...) * 4)`.
 */
function usedByBinary(
  value: ValueId,
  blocks: readonly SemanticBlock[],
  definitions: Definitions,
): boolean {
  for (const block of blocks) {
    for (const operation of block.operations) {
      if (operation.kind === "binary" && (operation.left === value || operation.right === value))
        return true;
      if (
        operation.kind === "convert" &&
        operation.operand === value &&
        operation.conversion !== "truncate" &&
        usedByBinary(operation.result, blocks, definitions)
      )
        return true;
    }
  }
  return false;
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
function collectSelectorReach(
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

/** One half of a complete `hi * 4 + lo >> 6` block selector. */
type SelectorSide = { readonly high: boolean; readonly address: ValueId };

/** Classify one operand of `+` as the high or low half of a complete selector. */
function selectorSide(value: ValueId, definitions: Definitions): SelectorSide | null {
  const operation = throughWidening(value, definitions);
  if (operation?.kind !== "binary") return null;
  const right = constantValue(definitions.get(operation.right), definitions);
  if (operation.operator === "*") {
    if (right === 4) {
      const high = highByteOperand(operation.left, definitions);
      if (high !== null) return { high: true, address: high };
    }
    if (constantValue(definitions.get(operation.left), definitions) === 4) {
      const high = highByteOperand(operation.right, definitions);
      if (high !== null) return { high: true, address: high };
    }
    return null;
  }
  if (operation.operator === ">>" && right === 6) {
    const low = lowByteOperand(operation.left, definitions);
    return low === null ? null : { high: false, address: low };
  }
  return null;
}

/**
 * Recognize the complete 14-bit selector `hi(address) * 4 + (lo(address) >> 6)`.
 * It is a correct block number at any 64-byte-aligned address; it does not need
 * the 256-byte alignment a standalone `hi * 4` requires.
 */
function completeSelector(operation: SemanticOperation, definitions: Definitions): ValueId | null {
  if (operation.kind !== "binary" || operation.operator !== "+") return null;
  const left = selectorSide(operation.left, definitions);
  const right = selectorSide(operation.right, definitions);
  if (left === null || right === null || left.high === right.high) return null;
  const leftAddress = addressOperation(left.address, definitions);
  const rightAddress = addressOperation(right.address, definitions);
  if (leftAddress === undefined || rightAddress === undefined) return null;
  if (bindingIdentityKey(leftAddress.place.root) !== bindingIdentityKey(rightAddress.place.root))
    return null;
  const leftOffset = staticPlaceOffset(leftAddress.place, definitions);
  const rightOffset = staticPlaceOffset(rightAddress.place, definitions);
  if (leftOffset === null || rightOffset === null || leftOffset !== rightOffset) return null;
  return left.address;
}

/**
 * Recognize one block-index expression.
 *
 * Division and shift forms directly produce a 64-byte block number. A
 * standalone `hi(address) * 4` discards the low address byte and therefore
 * needs 256-byte alignment. When that product is itself an operand of a larger
 * expression, it does not prove a standalone block number; leave it alone so
 * an ordinary combined selector is not over-aligned.
 */
function blockDemand(
  operation: SemanticOperation,
  definitions: Definitions,
  blocks: readonly SemanticBlock[],
): { readonly align: number; readonly address: ValueId } | null {
  if (operation.kind !== "binary") return null;
  const right = constantValue(definitions.get(operation.right), definitions);
  if (operation.operator === "/" && right === 64) return { align: 64, address: operation.left };
  if (operation.operator === ">>" && right === 6) return { align: 64, address: operation.left };
  if (operation.operator !== "*") return null;
  if (usedByBinary(operation.result, blocks, definitions)) return null;
  const leftHigh = highByteOperand(operation.left, definitions);
  if (right === 4 && leftHigh !== null) return { align: 256, address: leftHigh };
  const left = constantValue(definitions.get(operation.left), definitions);
  const rightHigh = left === 4 ? highByteOperand(operation.right, definitions) : null;
  return rightHigh === null ? null : { align: 256, address: rightHigh };
}

/**
 * Prove the effective byte offset of one addressed place for a required
 * alignment. A runtime index is admitted only when its element stride is a
 * multiple of the alignment and the static prefix/suffix remains aligned, so
 * every selected element preserves the demand.
 *
 * The returned offset describes one address, and a runtime step means the
 * program may address any element rather than that one, which is why the caller
 * is told the difference: an offset proved for alignment is not a statement
 * about which bytes are fetched.
 */
function placeAlignment(
  place: SemanticPlace,
  align: number,
  definitions: Definitions,
): { readonly offset: number; readonly dynamic: boolean } | null {
  let type: SemanticType | undefined = place.rootType;
  let offset = 0;
  let dynamic = false;
  for (const step of place.path) {
    if (step.kind === "field") {
      if (type?.kind !== "struct") return null;
      const field = type.fields.find(({ name }) => name === step.name);
      if (field === undefined) return null;
      offset += field.offset;
      type = field.type;
      continue;
    }
    if (type?.kind !== "array") return null;
    const stride = semanticTypeSize(type.element);
    const index = constantValue(definitions.get(step.value), definitions);
    if (index === null) {
      if (stride % align !== 0) return null;
      dynamic = true;
    } else {
      if (index < 0 || index >= type.length) return null;
      offset += stride * index;
    }
    type = type.element;
  }
  // A runtime contribution is `index * stride`; the remaining static offset must
  // already be a multiple of the demand. The stride check above proves the rest.
  if (dynamic && offset % align !== 0) return null;
  return offset % align === 0 ? { offset, dynamic } : null;
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
function scanProgram(
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

/**
 * Record the alignment a module object needs when its address is used as a
 * block index.
 *
 * The pass strengthens placement only; it states demands and never emits a
 * diagnostic itself. A runtime index and a structural field offset that root
 * alignment cannot express are left exactly as written, so ordinary address
 * arithmetic keeps compiling untouched.
 *
 * Two separate demands come out of one block index, and both are stated on the
 * object rather than checked here. Alignment decides where the block begins.
 * Visibility decides whether the chip can read those bytes at all: the VIC
 * fetches only inside its own bank, and inside one window of that bank it reads
 * character ROM instead of the RAM underneath. An object the compiler places
 * itself must satisfy both, because nothing else in the program asked for that
 * address — choosing a home the hardware cannot reach is this pass's own fault.
 *
 * Visibility is proved only where the video chip provably receives the value, and
 * that proof crosses function boundaries: computing a block number in a helper
 * and publishing the result is ordinary style, so a value handed back by a return
 * is followed into every call site that receives it.
 *
 * An explicit address is the author's contract and is left exactly as written,
 * including one that is misaligned or outside the bank. Reporting those would
 * have to be a warning, since the program is accepted today and the acceptance
 * is pinned; no warning contract for a hardware advisory exists yet, so the
 * silence is tracked rather than fixed here.
 *
 * @param functions Function bodies to scan, which also supply every call site.
 * @param globals Module objects whose placement may be strengthened, and whose
 *   initializer bodies are scanned alongside the functions.
 * @returns The globals with any proved alignment demand applied.
 */
export function alignBlockIndexStorage(
  functions: readonly SemanticFunction[],
  globals: readonly SemanticGlobal[],
): readonly SemanticGlobal[] {
  const byKey = new Map(globals.map((global) => [bindingIdentityKey(global.id), global] as const));
  const demands = new Map<string, AlignmentDemand[]>();
  const walk = scanProgram(functions, globals);
  const scan = (body: ScannedBody): void => {
    const { blocks, definitions } = body;
    const record = (
      addressValue: ValueId,
      align: number,
      reach: SelectorReach,
      span: SourceSpan,
    ): void => {
      const address = addressOperation(addressValue, definitions);
      if (address === undefined || address.place.asset !== undefined) return;
      const key = bindingIdentityKey(address.place.root);
      const object = byKey.get(key);
      if (object === undefined) return;
      const proved = placeAlignment(address.place, align, definitions);
      if (proved === null) return;
      const size = semanticTypeSize(object.type);
      // An index or a displacement decided at run time proves the arithmetic for
      // every block of the object and names none of them, so the demand covers
      // the object: the chip may read any of them, and shrinking it to the one
      // the static part happens to name would leave the others where the chip
      // cannot see them.
      const runtimeSelected = proved.dynamic || reach.runtimeSelected;
      const fetched: VicFetchRange[] = [];
      if (runtimeSelected && reach.displacements.size + (reach.runtimeSelected ? 1 : 0) > 0) {
        fetched.push({ offset: 0, bytes: size });
      } else {
        // A displacement names a later block of the same object. Clamped to the
        // object, because bytes past its end belong to whatever is placed there
        // and are not this object's to demand.
        for (const blocks of reach.displacements) {
          const offset = proved.offset + blocks * FETCHED_BYTES;
          if (offset < 0 || offset >= size) continue;
          fetched.push({ offset, bytes: Math.min(FETCHED_BYTES, size - offset) });
        }
      }
      const known = demands.get(key) ?? [];
      known.push({ align, offset: proved.offset, fetched, runtimeSelected, span });
      demands.set(key, known);
    };
    for (const block of blocks) {
      for (const operation of block.operations) {
        const complete = completeSelector(operation, definitions);
        const demand =
          complete === null
            ? blockDemand(operation, definitions, blocks)
            : { align: 64, address: complete };
        if (demand === null) continue;
        // The block number this operation computes is what a consumer receives,
        // so the proof that the video chip is the consumer starts from it — and
        // only once a block index has actually been recognized, so an ordinary
        // expression never pays for the search.
        const produced = "result" in operation ? operation.result : null;
        const reach: SelectorReach = { displacements: new Set(), runtimeSelected: false };
        if (produced !== null && produced !== undefined)
          collectSelectorReach(produced, body, walk, reach);
        record(demand.address, demand.align, reach, operation.span);
      }
    }
  };
  for (const body of walk.bodies) scan(body);
  if (demands.size === 0) return globals;
  return Object.freeze(
    globals.map((global) => {
      const required = demands.get(bindingIdentityKey(global.id));
      if (required === undefined) return global;
      const placement = global.placement;
      // A zero-page object is addressed below $0100, which the VIC always sees,
      // and its home is chosen by a different allocator.
      if (global.zeropage === true) return global;
      // An explicit address is the author's contract. Both demands are stated by
      // refusing a home that cannot satisfy them, and a refusal is not available
      // here: an explicitly placed block is accepted as written today even when
      // it is misaligned or outside the bank, so reporting it would have to be a
      // warning, and no contract for one exists yet.
      if (placement?.at !== null && placement?.at !== undefined) return global;
      const stated = placement?.region ?? null;
      let align = placement?.align ?? 1;
      const fetched: VicFetchRange[] = [];
      let origin: SourceSpan | null = null;
      let runtimeSelected = false;
      for (const demand of required) {
        // Every published use contributes its own runs. Satisfying one says
        // nothing about another, so they accumulate rather than replace: a
        // second sprite published from the same sheet is a second run the chip
        // reads, at a different offset.
        if (demand.fetched.length > 0) {
          fetched.push(...demand.fetched);
          origin ??= demand.span;
          runtimeSelected ||= demand.runtimeSelected;
        }
        // Root alignment can only express a demand whose static offset is a
        // multiple of it. Leave other shapes exactly as written.
        if (demand.offset % demand.align !== 0) continue;
        align = Math.max(align, demand.align);
      }
      // A region naming some other home is the author's deliberate choice, and
      // a stated one already constrains the whole object, so the inferred runs
      // are attached only where they do not argue with what was written.
      const inferred =
        fetched.length === 0 || origin === null || !(stated === null || VIC_REGIONS.has(stated))
          ? null
          : Object.freeze({
              ranges: mergeVicFetchRanges(fetched),
              span: origin,
              ...(runtimeSelected ? { runtimeSelected: true as const } : {}),
            });
      if (align === (placement?.align ?? 1) && inferred === null) return global;
      return Object.freeze({
        ...global,
        ...(inferred === null ? {} : { vicFetch: inferred }),
        placement: Object.freeze({
          at: null,
          align,
          noCross: placement?.noCross ?? null,
          region: stated,
        }),
      });
    }),
  );
}
