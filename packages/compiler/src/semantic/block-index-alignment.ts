import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
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
  /** Whether the computed block number is handed to the video chip. */
  readonly vicVisible: boolean;
}

/**
 * Region that keeps an object both inside the VIC bank and clear of the
 * character-ROM window the chip reads instead of RAM.
 */
const VIC_VISIBLE_REGION = "c64.vic.bank0-ram";

/** Regions that already satisfy the VIC, so a stated one is strengthened rather than refused. */
const VIC_REGIONS: ReadonlySet<string> = new Set(["c64.vic.bank0", VIC_VISIBLE_REGION]);

/** Capability namespace whose operations hand a value to the video chip. */
const VIC_CAPABILITY_PREFIX = "c64.vic.";

/** One value definition retained for static address and index resolution. */
type Definitions = ReadonlyMap<string, SemanticOperation>;

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
 * Whether one value reaches a VIC capability as an argument, following the
 * conversions a block index normally passes through on the way.
 *
 * `lo(address / 64)` narrows the block number to the byte the register takes, so
 * a narrowing step is followed here even though it discards information: the
 * value the chip receives is still derived from this address and no other.
 */
function reachesVicConsumer(
  value: ValueId,
  blocks: readonly SemanticBlock[],
  definitions: Definitions,
  visited: Set<ValueId> = new Set(),
): boolean {
  // Holding a block number in a variable before publishing it is ordinary, and
  // a place can be written and read repeatedly, so the walk remembers where it
  // has been rather than assuming the derivation chain is acyclic.
  if (visited.has(value)) return false;
  visited.add(value);
  for (const block of blocks) {
    for (const operation of block.operations) {
      if (
        operation.kind === "platform" &&
        operation.capability.startsWith(VIC_CAPABILITY_PREFIX) &&
        operation.arguments.includes(value)
      )
        return true;
      if (
        (operation.kind === "convert" || operation.kind === "unary") &&
        operation.operand === value &&
        reachesVicConsumer(operation.result, blocks, definitions, visited)
      )
        return true;
      // `let block = lo(&sprites / 64);` publishes through a variable. The read
      // is matched on the written object rather than the exact field, because
      // being wrong in that direction only states a demand against an object
      // that did not need one, while being wrong the other way puts a sprite
      // where the chip cannot see it.
      if (
        operation.kind === "store" &&
        operation.value === value &&
        loadsReachVicConsumer(operation.place, blocks, definitions, visited)
      )
        return true;
    }
  }
  return false;
}

/** Whether any read of one written object hands its value to the video chip. */
function loadsReachVicConsumer(
  place: SemanticPlace,
  blocks: readonly SemanticBlock[],
  definitions: Definitions,
  visited: Set<ValueId>,
): boolean {
  const written = bindingIdentityKey(place.root);
  for (const block of blocks)
    for (const operation of block.operations)
      if (
        operation.kind === "load" &&
        bindingIdentityKey(operation.place.root) === written &&
        reachesVicConsumer(operation.result, blocks, definitions, visited)
      )
        return true;
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
 */
function placeAlignment(
  place: SemanticPlace,
  align: number,
  definitions: Definitions,
): number | null {
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
  return offset % align === 0 ? offset : null;
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
 * An explicit address is the author's contract and is left exactly as written,
 * including one that is misaligned or outside the bank. Reporting those would
 * have to be a warning, since the program is accepted today and the acceptance
 * is pinned; no warning contract for a hardware advisory exists yet, so the
 * silence is tracked rather than fixed here.
 *
 * @param functions Ordinary and initializer bodies to scan.
 * @param globals Module objects whose placement may be strengthened.
 * @returns The globals with any proved alignment demand applied.
 */
export function alignBlockIndexStorage(
  functions: readonly SemanticFunction[],
  globals: readonly SemanticGlobal[],
): readonly SemanticGlobal[] {
  const byKey = new Map(globals.map((global) => [bindingIdentityKey(global.id), global] as const));
  const demands = new Map<string, AlignmentDemand[]>();
  const scan = (blocks: readonly SemanticBlock[]): void => {
    const definitions = new Map<string, SemanticOperation>();
    for (const block of blocks)
      for (const operation of block.operations) {
        const result = "result" in operation ? operation.result : null;
        if (result !== null && result !== undefined) definitions.set(result, operation);
      }
    const record = (addressValue: ValueId, align: number, vicVisible: boolean): void => {
      const address = addressOperation(addressValue, definitions);
      if (address === undefined || address.place.asset !== undefined) return;
      const key = bindingIdentityKey(address.place.root);
      if (!byKey.has(key)) return;
      const offset = placeAlignment(address.place, align, definitions);
      if (offset === null) return;
      const known = demands.get(key) ?? [];
      known.push({ align, offset, vicVisible });
      demands.set(key, known);
    };
    for (const block of blocks) {
      for (const operation of block.operations) {
        // The block number this operation computes is what a consumer receives,
        // so the proof that the video chip is the consumer starts from it.
        const produced = "result" in operation ? operation.result : null;
        const vicVisible =
          produced !== null &&
          produced !== undefined &&
          reachesVicConsumer(produced, blocks, definitions);
        const complete = completeSelector(operation, definitions);
        if (complete !== null) {
          record(complete, 64, vicVisible);
          continue;
        }
        const demand = blockDemand(operation, definitions, blocks);
        if (demand !== null) record(demand.address, demand.align, vicVisible);
      }
    }
  };
  for (const fn of functions) scan(fn.blocks);
  for (const global of globals) scan(global.blocks);
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
      let vicVisible = false;
      for (const demand of required) {
        // Visibility is a property of the whole object rather than of one byte
        // inside it, so it holds even where root alignment cannot express the
        // offset: the chip cannot reach any part of a block outside its bank.
        vicVisible ||= demand.vicVisible;
        // Root alignment can only express a demand whose static offset is a
        // multiple of it. Leave other shapes exactly as written.
        if (demand.offset % demand.align !== 0) continue;
        align = Math.max(align, demand.align);
      }
      // A region naming some other home is the author's deliberate choice, which
      // this pass states a demand against rather than overrules.
      const region =
        vicVisible && (stated === null || VIC_REGIONS.has(stated)) ? VIC_VISIBLE_REGION : stated;
      if (align === (placement?.align ?? 1) && region === stated) return global;
      return Object.freeze({
        ...global,
        placement: Object.freeze({
          at: null,
          align,
          noCross: placement?.noCross ?? null,
          region,
        }),
      });
    }),
  );
}
