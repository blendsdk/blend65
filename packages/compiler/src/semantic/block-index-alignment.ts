import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import { mergeVicFetchRanges } from "../target/vic-fetch.js";
import type { VicFetchRange } from "../target/vic-fetch.js";
import type {
  SemanticBlock,
  SemanticFunction,
  SemanticGlobal,
  SemanticOperation,
  SemanticPlace,
  ValueId,
} from "./operations.js";
import { collectSelectorReach } from "./block-index-consumers.js";
import { scanProgram } from "./block-index-program.js";
import type { ScannedBody } from "./block-index-program.js";
import { ENUMERATED_ELEMENT_LIMIT, FETCHED_BYTES } from "./block-index-selector.js";
import type { ProvedPlace, SelectorReach } from "./block-index-selector.js";
import { constantValue, staticPlaceOffset } from "./block-index-values.js";
import type { Definitions } from "./block-index-values.js";
import {
  addressOperation,
  highByteOperand,
  lowByteOperand,
  throughWidening,
} from "./block-index-values.js";

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
  /** Whether this use left along a route the consumer proof does not follow. */
  readonly unfollowed: boolean;
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
): ProvedPlace | null {
  let type: SemanticType | undefined = place.rootType;
  let offset = 0;
  const selected: { stride: number; length: number }[] = [];
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
      selected.push({ stride, length: type.length });
    } else {
      if (index < 0 || index >= type.length) return null;
      offset += stride * index;
    }
    type = type.element;
  }
  // A runtime contribution is `index * stride`; the remaining static offset must
  // already be a multiple of the demand. The stride check above proves the rest.
  if (selected.length > 0 && offset % align !== 0) return null;
  return offset % align === 0
    ? { offset, selected: Object.freeze(selected.map((step) => Object.freeze(step))) }
    : null;
}

/**
 * Every byte offset of one object a proved place can address.
 *
 * A runtime index addresses any declared element of its dimension, so the
 * offsets are enumerated rather than collapsed: two sheets selected by an index
 * need their own two blocks reachable, not the sixteen kilobytes between and
 * around them. Enumeration stops at a bound beyond which the list stops being
 * cheaper than the span it covers, and the span is used instead.
 */
function addressableOffsets(proved: ProvedPlace, size: number): readonly number[] {
  let offsets = [proved.offset];
  for (const step of proved.selected) {
    const widened: number[] = [];
    for (const base of offsets)
      for (let index = 0; index < step.length; index += 1) widened.push(base + index * step.stride);
    if (widened.length > ENUMERATED_ELEMENT_LIMIT) return [];
    offsets = widened;
  }
  return offsets.filter((offset) => offset >= 0 && offset < size);
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
      const published = reach.displacements.size > 0 || reach.runtimeSelected || reach.escaped;
      // An index chooses between the declared elements of its dimension, and a
      // displacement read at run time chooses between every block of the
      // object. Either way the chip may read any of them, so all of them are
      // demanded; shrinking to the one a static prefix happens to name would
      // leave the rest where the chip cannot see them.
      const addressable = addressableOffsets(proved, size);
      const runtimeSelected = reach.runtimeSelected || proved.selected.length > 0;
      const fetched: VicFetchRange[] = [];
      if (!published) {
        // Nothing proves the chip receives this number, so nothing is demanded.
      } else if (reach.runtimeSelected || reach.escaped || addressable.length === 0) {
        // Past the enumeration bound, with the block chosen by arithmetic
        // nothing here can evaluate, or with the number gone somewhere this
        // proof does not follow, the whole object is the honest demand.
        fetched.push({ offset: 0, bytes: size });
      } else {
        // A displacement names a later block of the same object. Runs are
        // clamped to the object, because bytes past its end belong to whatever
        // is placed there and are not this object's to demand.
        for (const base of addressable)
          for (const blocks of reach.displacements) {
            const offset = base + blocks * FETCHED_BYTES;
            if (offset < 0 || offset >= size) continue;
            fetched.push({ offset, bytes: Math.min(FETCHED_BYTES, size - offset) });
          }
      }
      const known = demands.get(key) ?? [];
      known.push({
        align,
        offset: proved.offset,
        fetched,
        runtimeSelected,
        unfollowed: reach.escaped,
        span,
      });
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
        const reach: SelectorReach = {
          displacements: new Set(),
          runtimeSelected: false,
          escaped: false,
        };
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
      let unfollowed = false;
      for (const demand of required) {
        // Every published use contributes its own runs. Satisfying one says
        // nothing about another, so they accumulate rather than replace: a
        // second sprite published from the same sheet is a second run the chip
        // reads, at a different offset.
        if (demand.fetched.length > 0) {
          fetched.push(...demand.fetched);
          origin ??= demand.span;
          runtimeSelected ||= demand.runtimeSelected;
          unfollowed ||= demand.unfollowed;
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
              ...(unfollowed ? { unfollowed: true as const } : {}),
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
