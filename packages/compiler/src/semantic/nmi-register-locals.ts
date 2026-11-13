import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import { placeUses } from "./aggregate-place-proof.js";
import { forwardableVolatileByteRead } from "./direct-byte-reads.js";
import type { ExecutionDomain } from "./interrupt-domains.js";
import type { BlockId, SemanticBlock, SemanticFunction, SemanticOperation } from "./operations.js";
import { potentialValueInputs } from "./value-lifetimes.js";

/** Stable elision identity shared by inventory and machine lowering. */
export function nmiLocalElisionKey(
  domain: ExecutionDomain,
  activationRoot: string | undefined,
  bindingKey: string,
): string {
  return `${domain}:${activationRoot ?? ""}:${bindingKey}`;
}

/** One local whose whole life is an adjacent store/load pair fed by a direct read. */
export interface NmiRegisterOnlyLocal {
  /** Source binding eliminated from SFA demand. */
  readonly binding: BindingId;
  /** Exact initializing store. */
  readonly storeSpan: SourceSpan;
  /** Exact single load, or null when a constant store has no load. */
  readonly loadSpan: SourceSpan | null;
  /** Block containing both operations. */
  readonly block: BlockId;
  /** Store operation index in that block. */
  readonly storeIndex: number;
  /** Load operation index in that block, or null when no load exists. */
  readonly loadIndex: number | null;
  /** How the elided value is represented at the load site. */
  readonly representation?: "register" | "constant" | "zero-extended";
  /** Zero-extending conversion result kept in A, when representation is zero-extended. */
  readonly conversionResult?: string;
}

/** One located operation in a source function. */
interface LocatedOperation {
  readonly block: SemanticBlock;
  readonly index: number;
  readonly operation: SemanticOperation;
}

/** Return whether one type is the one-byte scalar the rule can keep in A. */
function byteType(type: SemanticType): boolean {
  return type.kind === "scalar" && type.name === "byte";
}

/** Return whether one type is the two-byte scalar the zero-extension rule can narrow. */
function wordType(type: SemanticType): boolean {
  return type.kind === "scalar" && type.name === "word";
}

/** Return the definition of one value in a function, if present. */
function definitionOf(fn: SemanticFunction, value: string): LocatedOperation | null {
  for (const block of fn.blocks)
    for (let index = 0; index < block.operations.length; index += 1) {
      const operation = block.operations[index]!;
      if ("result" in operation && operation.result === value) return { block, index, operation };
    }
  return null;
}

/** Count every use of one value, including a branch or return terminator. */
function valueUseCount(fn: SemanticFunction, value: string): number {
  let count = 0;
  for (const block of fn.blocks) {
    for (const operation of block.operations)
      count += potentialValueInputs(operation).filter((input) => input === value).length;
    if (block.terminator.kind === "branch" && block.terminator.condition === value) count += 1;
    if (block.terminator.kind === "return" && block.terminator.value === value) count += 1;
  }
  return count;
}

/** A constant or a conversion of a constant emits no A write and no local reinterpretation. */
function constantOnly(operation: SemanticOperation, constants: ReadonlySet<string>): boolean {
  if (operation.kind === "constant") return true;
  return operation.kind === "convert" && constants.has(operation.operand);
}

/** Return whether every operation between two indexes is a constant/conversion only. */
function constantOnlyBetween(
  block: SemanticBlock,
  start: number,
  end: number,
  constants: ReadonlySet<string>,
): boolean {
  for (let index = start + 1; index < end; index += 1)
    if (!constantOnly(block.operations[index]!, constants)) return false;
  return true;
}

/** Return the single operation consuming one value, or null when it is not unique. */
function singleConsumer(fn: SemanticFunction, value: string): LocatedOperation | null {
  let found: LocatedOperation | null = null;
  for (const block of fn.blocks)
    for (let index = 0; index < block.operations.length; index += 1) {
      const operation = block.operations[index]!;
      if (!potentialValueInputs(operation).includes(value)) continue;
      if (found !== null) return null;
      found = { block, index, operation };
    }
  return found;
}

/** Allow only constants/conversions and one exact single-use peer load in the gap. */
function consumerGap(
  block: SemanticBlock,
  start: number,
  end: number,
  constants: ReadonlySet<string>,
  peer: string | null,
): boolean {
  for (let index = start + 1; index < end; index += 1) {
    const operation = block.operations[index]!;
    if (constantOnly(operation, constants)) continue;
    if (
      peer !== null &&
      operation.kind === "load" &&
      operation.result === peer &&
      operation.place.path.length === 0 &&
      byteType(operation.type)
    )
      continue;
    return false;
  }
  return true;
}

/** Return whether one value is the compile-time constant zero. */
function zeroConstant(fn: SemanticFunction, value: string): boolean {
  const definition = definitionOf(fn, value);
  if (definition === null) return false;
  if (definition.operation.kind === "constant") return definition.operation.value === 0n;
  return definition.operation.kind === "convert" && zeroConstant(fn, definition.operation.operand);
}

/** Return whether one value is an empty-path byte load the ALU can address directly. */
function directByteLoad(fn: SemanticFunction, value: string): boolean {
  const definition = definitionOf(fn, value);
  return (
    definition?.operation.kind === "load" &&
    definition.operation.place.path.length === 0 &&
    byteType(definition.operation.type)
  );
}

/**
 * Prove the NMI locals whose complete life is one adjacent store/load pair.
 *
 * The result is a source-shape proof only. Storage inventory uses it to omit the
 * request before allocation; machine lowering consumes the recorded set. A local
 * with an address, a second access, a cross-block life, an indexed path or a
 * non-direct initializer is deliberately absent.
 * @param fn Exact checked source function.
 * @param excluded Global and returned-local binding keys that must never be elided.
 * @returns Binding keys mapped to their exact store/load evidence.
 */
export function nmiRegisterOnlyLocals(
  fn: SemanticFunction,
  excluded: ReadonlySet<string>,
): ReadonlyMap<string, NmiRegisterOnlyLocal> {
  const excludedKeys = new Set([
    ...excluded,
    ...fn.parameters.map((parameter) => bindingIdentityKey(parameter.id)),
  ]);
  const constants = new Set<string>();
  for (const block of fn.blocks)
    for (const operation of block.operations) {
      if (operation.kind === "constant") constants.add(operation.result);
      else if (operation.kind === "convert" && constants.has(operation.operand))
        constants.add(operation.result);
    }

  interface Access {
    readonly stores: {
      readonly block: SemanticBlock;
      readonly index: number;
      readonly operation: Extract<SemanticOperation, { kind: "store" }>;
    }[];
    readonly loads: {
      readonly block: SemanticBlock;
      readonly index: number;
      readonly operation: Extract<SemanticOperation, { kind: "load" }>;
    }[];
    rejected: boolean;
  }
  const accesses = new Map<string, Access>();
  for (const block of fn.blocks)
    for (let index = 0; index < block.operations.length; index += 1) {
      const operation = block.operations[index]!;
      for (const use of placeUses(operation)) {
        const key = bindingIdentityKey(use.place.root);
        if (excludedKeys.has(key) || use.place.asset !== undefined) continue;
        const access = accesses.get(key) ?? { stores: [], loads: [], rejected: false };
        if (use.place.path.length !== 0) access.rejected = true;
        else if (operation.kind === "store") access.stores.push({ block, index, operation });
        else if (operation.kind === "load") access.loads.push({ block, index, operation });
        else access.rejected = true;
        accesses.set(key, access);
      }
    }

  const result = new Map<string, NmiRegisterOnlyLocal>();
  for (const [key, access] of accesses) {
    if (access.rejected || access.stores.length !== 1 || access.loads.length > 1) continue;
    const store = access.stores[0]!;
    const load = access.loads[0];
    const initializer = definitionOf(fn, store.operation.value)?.operation;
    const constantInitializer =
      initializer !== undefined &&
      (initializer.kind === "constant" ||
        (initializer.kind === "convert" && constants.has(initializer.operand)));
    if (load !== undefined) {
      if (
        store.block.id !== load.block.id ||
        load.index <= store.index ||
        !constantOnlyBetween(store.block, store.index, load.index, constants)
      )
        continue;
    }
    if (constantInitializer) {
      // A constant local needs no register and no home. A dead store is safe
      // when no load exists; a single load resolves to the constant value.
      if (load !== undefined) {
        if (valueUseCount(fn, load.operation.result) > 1) continue;
        const consumer = singleConsumer(fn, load.operation.result);
        if (
          consumer !== null &&
          (consumer.block.id !== load.block.id ||
            !consumerGap(load.block, load.index, consumer.index, constants, null))
        )
          continue;
      }
      result.set(
        key,
        Object.freeze({
          binding: store.operation.place.root,
          storeSpan: store.operation.span,
          loadSpan: load?.operation.span ?? null,
          block: store.block.id,
          storeIndex: store.index,
          loadIndex: load?.index ?? null,
        }),
      );
      continue;
    }
    if (load === undefined) continue;

    // A single-use word local initialized by a zero-extending byte read and
    // consumed by a byte-masked `&` needs only the low byte in A. The high byte
    // is proved zero and never observed.
    const zeroExtendedRead =
      initializer !== undefined &&
      initializer.kind === "convert" &&
      initializer.conversion === "zero-extend" &&
      initializer.operand !== undefined &&
      wordType(store.operation.type) &&
      wordType(load.operation.type);
    if (zeroExtendedRead && initializer?.kind === "convert") {
      const source = definitionOf(fn, initializer.operand)?.operation;
      const consumer = singleConsumer(fn, load.operation.result);
      const binaryConsumer = consumer?.operation.kind === "binary" ? consumer.operation : null;
      const other = binaryConsumer
        ? binaryConsumer.left === load.operation.result
          ? binaryConsumer.right
          : binaryConsumer.right === load.operation.result
            ? binaryConsumer.left
            : null
        : null;
      const maskDefinition = other === null ? undefined : definitionOf(fn, other)?.operation;
      const byteMask =
        maskDefinition?.kind === "constant" &&
        typeof maskDefinition.value === "bigint" &&
        maskDefinition.value >= 0n &&
        maskDefinition.value <= 0xffn;
      if (
        source?.kind === "platform" &&
        byteType(source.type) &&
        valueUseCount(fn, initializer.result) === 1 &&
        consumer !== null &&
        consumer.block.id === load.block.id &&
        valueUseCount(fn, load.operation.result) === 1 &&
        binaryConsumer?.operator === "&" &&
        byteMask &&
        wordType(binaryConsumer.type) &&
        consumerGap(load.block, load.index, consumer.index, constants, null)
      ) {
        result.set(
          key,
          Object.freeze({
            binding: store.operation.place.root,
            storeSpan: store.operation.span,
            loadSpan: load.operation.span,
            block: store.block.id,
            storeIndex: store.index,
            loadIndex: load.index,
            representation: "zero-extended" as const,
            conversionResult: initializer.result,
          }),
        );
      }
      continue;
    }

    if (!byteType(load.operation.type) || !byteType(store.operation.type)) continue;

    const valueDefinition = definitionOf(fn, store.operation.value);
    if (
      valueDefinition === null ||
      valueDefinition.block.id !== store.block.id ||
      valueDefinition.operation.kind !== "platform" ||
      !byteType(valueDefinition.operation.type) ||
      !forwardableVolatileByteRead(valueDefinition.operation.capability) ||
      valueUseCount(fn, store.operation.value) !== 1 ||
      !constantOnlyBetween(store.block, valueDefinition.index, store.index, constants)
    )
      continue;

    if (valueUseCount(fn, load.operation.result) !== 1) continue;
    const consumer = singleConsumer(fn, load.operation.result);
    const binaryConsumer = consumer?.operation.kind === "binary" ? consumer.operation : null;
    const bitwisePeer =
      binaryConsumer !== null &&
      (binaryConsumer.operator === "&" ||
        binaryConsumer.operator === "|" ||
        binaryConsumer.operator === "^") &&
      (binaryConsumer.left === load.operation.result ||
        binaryConsumer.right === load.operation.result)
        ? binaryConsumer.left === load.operation.result
          ? binaryConsumer.right
          : binaryConsumer.left
        : null;
    const peer =
      bitwisePeer !== null &&
      directByteLoad(fn, bitwisePeer) &&
      valueUseCount(fn, bitwisePeer) === 1
        ? bitwisePeer
        : null;
    if (
      consumer === null ||
      consumer.block.id !== load.block.id ||
      !consumerGap(load.block, load.index, consumer.index, constants, peer)
    )
      continue;

    let takesA = false;
    if (consumer.operation.kind === "store") {
      takesA =
        consumer.operation.value === load.operation.result &&
        consumer.operation.place.path.length === 0 &&
        byteType(consumer.operation.type);
    } else if (consumer.operation.kind === "memory-write") {
      takesA =
        consumer.operation.value === load.operation.result &&
        consumer.operation.width === 1 &&
        constants.has(consumer.operation.address);
    } else if (consumer.operation.kind === "binary") {
      const operator = consumer.operation.operator;
      const left = consumer.operation.left === load.operation.result;
      const right = consumer.operation.right === load.operation.result;
      const other = left ? consumer.operation.right : consumer.operation.left;
      if (operator === "==" || operator === "!=") {
        takesA =
          left &&
          zeroConstant(fn, other) &&
          consumer.operation.type.kind === "scalar" &&
          consumer.operation.type.name === "boolean";
      } else if (operator === "&" || operator === "|" || operator === "^") {
        takesA =
          (left || right) &&
          byteType(consumer.operation.type) &&
          (constants.has(other) || (directByteLoad(fn, other) && valueUseCount(fn, other) === 1));
      }
    }
    if (!takesA) continue;

    result.set(
      key,
      Object.freeze({
        binding: store.operation.place.root,
        storeSpan: store.operation.span,
        loadSpan: load.operation.span,
        block: store.block.id,
        storeIndex: store.index,
        loadIndex: load.index,
      }),
    );
  }
  return result;
}

/** One NMI local retained in a bounded hardware-stack slot for its whole life. */
export interface NmiStackRetainedLocal {
  /** Source binding eliminated from SFA demand. */
  readonly binding: BindingId;
  /** Exact initializing store. */
  readonly storeSpan: SourceSpan;
  /** Exact loads which read the pushed byte. */
  readonly loadSpans: readonly SourceSpan[];
  /** Block containing every access. */
  readonly block: BlockId;
  /** Store operation index in that block. */
  readonly storeIndex: number;
  /** Load operation indexes in that block. */
  readonly loadIndexes: readonly number[];
}

/** Hard upper bound on body-pushed bytes; the cooperative stack reserve is larger. */
const MAX_STACK_RETAINED_BYTES = 8;

/**
 * Prove NMI locals whose complete life fits a bounded hardware-stack slot.
 *
 * The proof is deliberately narrow: one straight-line interrupt handler with a
 * void return, no calls, byte locals with one initializer store and one or more
 * loads, and an initializer already in A (a platform read, a fixed memory read,
 * or a byte `&`). The value is pushed once and read through `TSX`-relative
 * addressing; the handler pops every slot before the wrapper restores A/X.
 * @param fn Exact checked NMI handler body.
 * @param excluded Global, parameter and returned-local binding keys.
 * @returns Binding keys mapped to their exact store/load evidence.
 */
export function nmiStackRetainedLocals(
  fn: SemanticFunction,
  excluded: ReadonlySet<string>,
): ReadonlyMap<string, NmiStackRetainedLocal> {
  if (
    fn.entryKind !== "interrupt" ||
    fn.blocks.length !== 1 ||
    fn.blocks[0]!.terminator.kind !== "return" ||
    fn.result.kind !== "scalar" ||
    fn.result.name !== "void"
  )
    return new Map();
  const block = fn.blocks[0]!;
  if (
    block.operations.some(
      (operation) => operation.kind === "call" || operation.kind === "indirect-call",
    )
  )
    return new Map();
  const excludedKeys = new Set([
    ...excluded,
    ...fn.parameters.map((parameter) => bindingIdentityKey(parameter.id)),
  ]);
  const constants = new Set<string>();
  for (const operation of block.operations) {
    if (operation.kind === "constant") constants.add(operation.result);
    else if (operation.kind === "convert" && constants.has(operation.operand))
      constants.add(operation.result);
  }
  interface Access {
    readonly stores: {
      readonly index: number;
      readonly operation: Extract<SemanticOperation, { kind: "store" }>;
    }[];
    readonly loads: {
      readonly index: number;
      readonly operation: Extract<SemanticOperation, { kind: "load" }>;
    }[];
    rejected: boolean;
  }
  const accesses = new Map<string, Access>();
  for (let index = 0; index < block.operations.length; index += 1) {
    const operation = block.operations[index]!;
    for (const use of placeUses(operation)) {
      const key = bindingIdentityKey(use.place.root);
      if (excludedKeys.has(key) || use.place.asset !== undefined) continue;
      const access = accesses.get(key) ?? { stores: [], loads: [], rejected: false };
      if (use.place.path.length !== 0) access.rejected = true;
      else if (operation.kind === "store") access.stores.push({ index, operation });
      else if (operation.kind === "load") access.loads.push({ index, operation });
      else access.rejected = true;
      accesses.set(key, access);
    }
  }
  const result = new Map<string, NmiStackRetainedLocal>();
  const allowed = new Set<SemanticOperation>();
  /** Admit one operation and every definition it reads. */
  const admit = (operation: SemanticOperation): void => {
    if (allowed.has(operation)) return;
    allowed.add(operation);
    for (const input of potentialValueInputs(operation)) {
      const definition = definitionOf(fn, input)?.operation;
      if (definition !== undefined) admit(definition);
    }
  };
  /** Admit the single downstream consumer of a produced value (for example a store). */
  const admitConsumer = (operation: SemanticOperation): void => {
    if (!("result" in operation) || operation.result === null) return;
    const consumer = singleConsumer(fn, operation.result);
    if (consumer !== null && !allowed.has(consumer.operation)) {
      admit(consumer.operation);
      admitConsumer(consumer.operation);
    }
  };
  for (const [key, access] of accesses) {
    if (
      access.rejected ||
      access.stores.length !== 1 ||
      access.loads.length === 0 ||
      access.loads.length > MAX_STACK_RETAINED_BYTES
    )
      continue;
    const store = access.stores[0]!;
    if (
      access.loads.some((load) => load.index <= store.index) ||
      !byteType(store.operation.type) ||
      access.loads.some((load) => !byteType(load.operation.type))
    )
      continue;
    const valueDefinition = definitionOf(fn, store.operation.value);
    if (
      valueDefinition === null ||
      valueDefinition.block.id !== block.id ||
      valueDefinition.index >= store.index ||
      valueUseCount(fn, store.operation.value) !== 1 ||
      !constantOnlyBetween(block, valueDefinition.index, store.index, constants)
    )
      continue;
    const initializer = valueDefinition.operation;
    const inA =
      (initializer.kind === "platform" &&
        byteType(initializer.type) &&
        forwardableVolatileByteRead(initializer.capability)) ||
      (initializer.kind === "memory-read" &&
        initializer.width === 1 &&
        constants.has(initializer.address)) ||
      (initializer.kind === "binary" && initializer.operator === "&" && byteType(initializer.type));
    if (!inA) continue;
    if (access.loads.some((load) => valueUseCount(fn, load.operation.result) === 0)) continue;
    // Only consumers that can materialize a stack byte safely are admitted.
    // A right-hand arithmetic/bitwise operand would need an addressable mode.
    const consumers = access.loads.map((load) => singleConsumer(fn, load.operation.result));
    const safeConsumer = (consumer: LocatedOperation | null, value: string): boolean => {
      if (consumer === null) return false;
      const operation = consumer.operation;
      if (operation.kind === "store") return operation.value === value;
      if (operation.kind === "memory-write")
        return operation.value === value && constants.has(operation.address);
      if (operation.kind !== "binary") return false;
      if (operation.operator === "==" || operation.operator === "!=")
        return operation.left === value && zeroConstant(fn, operation.right);
      return (
        (operation.operator === "&" || operation.operator === "|" || operation.operator === "^") &&
        operation.left === value &&
        (constants.has(operation.right) ||
          (directByteLoad(fn, operation.right) && valueUseCount(fn, operation.right) === 1))
      );
    };
    if (
      consumers.some(
        (consumer, index) => !safeConsumer(consumer, access.loads[index]!.operation.result),
      )
    )
      continue;
    admit(store.operation);
    for (const load of access.loads) {
      admit(load.operation);
      const consumer = consumers[access.loads.indexOf(load)];
      if (consumer !== null) {
        admit(consumer.operation);
        admitConsumer(consumer.operation);
      }
    }
    result.set(
      key,
      Object.freeze({
        binding: store.operation.place.root,
        storeSpan: store.operation.span,
        loadSpans: Object.freeze(access.loads.map((load) => load.operation.span)),
        block: block.id,
        storeIndex: store.index,
        loadIndexes: Object.freeze(access.loads.map((load) => load.index)),
      }),
    );
  }
  // Any unrelated code in the block could clobber X or SP between a TSX and a
  // later stack-relative load. The bounded proof admits only constants and the
  // retained stores/loads, their consumers and their operand definitions.
  if (
    block.operations.some(
      (operation) =>
        !allowed.has(operation) && operation.kind !== "constant" && operation.kind !== "convert",
    )
  )
    return new Map();
  // The cap is on the whole handler, not one local: a ninth retained byte is
  // outside the bounded straight-line proof and must keep its normal rejection.
  return result.size > MAX_STACK_RETAINED_BYTES ? new Map() : result;
}
