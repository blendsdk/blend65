import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import { placeUses } from "./aggregate-place-proof.js";
import { forwardableVolatileByteRead } from "./direct-byte-reads.js";
import type { ExecutionDomain } from "./interrupt-domains.js";
import type { BlockId, SemanticBlock, SemanticFunction, SemanticOperation } from "./operations.js";
import { potentialValueInputs } from "./value-lifetimes.js";
import { blockReaches, nmiControlFacts, nmiStackPlan } from "./nmi-stack-plan.js";

export { nmiStackPlan } from "./nmi-stack-plan.js";
export type { NmiStackPlan } from "./nmi-stack-plan.js";

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

/** Return the packed width of one scalar type without importing the machine layer. */
function scalarWidth(type: SemanticType): number {
  if (type.kind !== "scalar") return 8;
  return type.name === "word" || type.name === "sword" ? 16 : 8;
}

/**
 * Return the compile-time value of a byte expression whose non-constant part is
 * neutralized by a zero mask, or null when any part stays runtime.
 *
 * The lowering folds a zero `&`, a constant bitwise expression and constant
 * conversions. This mirror keeps the retention proof from calling a value "in A"
 * when lowering will actually produce a constant.
 */
function foldedConstant(
  fn: SemanticFunction,
  value: string,
  seen: ReadonlySet<string> = new Set<string>(),
): bigint | null {
  if (seen.has(value)) return null;
  const nextSeen = new Set(seen);
  nextSeen.add(value);
  const definition = definitionOf(fn, value)?.operation;
  if (definition === undefined) return null;
  if (definition.kind === "constant")
    return typeof definition.value === "boolean" ? (definition.value ? 1n : 0n) : definition.value;
  if (definition.kind === "convert") {
    const inner = foldedConstant(fn, definition.operand, nextSeen);
    if (inner === null) return null;
    const width = scalarWidth(definition.type);
    const mask = (1n << BigInt(width)) - 1n;
    if (definition.conversion === "truncate") return inner & 0xffn;
    if (definition.conversion === "zero-extend") return inner & mask;
    if (definition.conversion === "sign-extend") {
      if ((inner & 0x80n) !== 0n) return (inner | (mask ^ 0xffn)) & mask;
      return inner & mask;
    }
    return inner & mask;
  }
  if (definition.kind === "binary" && ["&", "|", "^"].includes(definition.operator)) {
    const left = foldedConstant(fn, definition.left, nextSeen);
    const right = foldedConstant(fn, definition.right, nextSeen);
    if (definition.operator === "&" && (left === 0n || right === 0n)) return 0n;
    if (left === null || right === null) return null;
    const width = scalarWidth(definition.type);
    const mask = (1n << BigInt(width)) - 1n;
    const leftBits = left & mask;
    const rightBits = right & mask;
    if (definition.operator === "&") return leftBits & rightBits;
    return definition.operator === "|" ? leftBits | rightBits : leftBits ^ rightBits;
  }
  return null;
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
 * Return whether lowering one byte value necessarily leaves it in A.
 *
 * A platform byte read, a fixed-address byte read, and a byte bitwise result
 * that cannot fold are all produced in A by their own lowering. A constant or a
 * wider value is deliberately absent: the retention store would have nothing to
 * push.
 */
function producesByteInA(
  fn: SemanticFunction,
  value: string,
  constants: ReadonlySet<string>,
): boolean {
  const definition = definitionOf(fn, value)?.operation;
  if (definition === undefined) return false;
  if (foldedConstant(fn, value) !== null) return false;
  if (definition.kind === "platform")
    return byteType(definition.type) && forwardableVolatileByteRead(definition.capability);
  if (definition.kind === "memory-read")
    return definition.width === 1 && constants.has(definition.address);
  if (definition.kind === "binary") {
    if (!["&", "|", "^"].includes(definition.operator) || !byteType(definition.type)) return false;
    // A zero mask folds to a constant at lowering; nothing would be in A to push.
    const zero = (value: string): boolean => {
      const operand = definitionOf(fn, value)?.operation;
      if (operand?.kind === "constant") return operand.value === 0n;
      return operand?.kind === "convert" && zero(operand.operand);
    };
    if (definition.operator === "&" && (zero(definition.left) || zero(definition.right)))
      return false;
    return !(constants.has(definition.left) && constants.has(definition.right));
  }
  return false;
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
    const constantInitializer = foldedConstant(fn, store.operation.value) !== null;
    if (load !== undefined) {
      // A direct read in A must not be clobbered before its store; a constant
      // needs no register and safely crosses any intervening effect.
      if (
        store.block.id !== load.block.id ||
        load.index <= store.index ||
        (!constantInitializer &&
          !constantOnlyBetween(store.block, store.index, load.index, constants))
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
  /** Block containing the store. */
  readonly block: BlockId;
  /** Store operation index in that block. */
  readonly storeIndex: number;
  /** Load operation indexes in source order. */
  readonly loadIndexes: readonly number[];
  /** Block, index, result and A-consumability of every load. */
  readonly loads: readonly {
    readonly block: BlockId;
    readonly index: number;
    readonly result: string;
    readonly consumable: boolean;
  }[];
  /** Load result consumed with PLA because it is the last top-of-stack use. */
  readonly consumeResult: string | null;
}

/**
 * Prove NMI locals whose complete life fits the handler's hardware stack.
 *
 * A byte local has exactly one initializer store and one or more loads. The
 * initializer is already in A (a platform read, a fixed memory read, or a byte
 * bitwise that cannot fold). Every load has one safe consumer. Every store
 * dominates every load of its binding and the single return, no store sits in a
 * cycle, and all stores are dominance-comparable, so the push order is static.
 * The value is pushed once and read through `TSX`-relative addressing; the
 * handler pops every slot before the wrapper restores A/X. The byte count is
 * bounded by the platform's proved stack capacity, not a fixed cap.
 * @param fn Exact checked NMI handler body.
 * @param excluded Global, parameter and returned-local binding keys.
 * @returns Binding keys mapped to their exact store/load evidence.
 */
export function nmiStackRetainedLocals(
  fn: SemanticFunction,
  excluded: ReadonlySet<string>,
): ReadonlyMap<string, NmiStackRetainedLocal> {
  if (fn.entryKind !== "interrupt" || fn.result.kind !== "scalar" || fn.result.name !== "void")
    return new Map();
  const facts = nmiControlFacts(fn.entry, fn.blocks);
  if (facts === null) return new Map();
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
      readonly block: BlockId;
      readonly index: number;
      readonly operation: Extract<SemanticOperation, { kind: "store" }>;
    }[];
    readonly loads: {
      readonly block: BlockId;
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
        else if (operation.kind === "store")
          access.stores.push({ block: block.id, index, operation });
        else if (operation.kind === "load")
          access.loads.push({ block: block.id, index, operation });
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
    if (access.rejected || access.stores.length !== 1 || access.loads.length === 0) continue;
    const store = access.stores[0]!;
    if (
      !byteType(store.operation.type) ||
      access.loads.some((load) => !byteType(load.operation.type))
    )
      continue;
    // Every load must be dominated by the store. Same-block order is the store
    // index; a later block must have the store block in its dominator set.
    const dominatesLoad = (load: { readonly block: BlockId; readonly index: number }): boolean =>
      load.block === store.block
        ? load.index > store.index
        : facts.dominators.get(load.block)?.has(store.block) === true;
    if (access.loads.some((load) => !dominatesLoad(load))) continue;
    const valueDefinition = definitionOf(fn, store.operation.value);
    if (
      valueDefinition === null ||
      valueDefinition.block.id !== store.block ||
      valueDefinition.index >= store.index ||
      valueUseCount(fn, store.operation.value) !== 1 ||
      !constantOnlyBetween(
        fn.blocks.find((block) => block.id === store.block)!,
        valueDefinition.index,
        store.index,
        constants,
      )
    )
      continue;
    const inA = producesByteInA(fn, store.operation.value, constants);
    if (!inA) continue;
    if (access.loads.some((load) => valueUseCount(fn, load.operation.result) === 0)) continue;
    // Only consumers that can materialize a stack byte safely are admitted.
    // A right-hand bitwise operand is safe when the other operand is already in
    // A; the ALU consumes the stack byte through absolute,X addressing.
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
      if (operation.operator !== "&" && operation.operator !== "|" && operation.operator !== "^")
        return false;
      if (operation.left === value)
        return (
          constants.has(operation.right) ||
          (directByteLoad(fn, operation.right) && valueUseCount(fn, operation.right) === 1) ||
          (producesByteInA(fn, operation.right, constants) &&
            valueUseCount(fn, operation.right) === 1)
        );
      if (operation.right !== value) return false;
      // The left operand owns A at the ALU instruction. Its read still executes
      // exactly once at its source point, before the stack byte is consumed.
      return (
        valueUseCount(fn, operation.left) === 1 && producesByteInA(fn, operation.left, constants)
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
    const loadEvidence = access.loads.map((load, index) => {
      const operation = consumers[index]?.operation;
      // PLA is legal only for a plain A consumer. A bitwise consumer addresses
      // the stack byte with absolute,X, where SP must not move.
      const consumable =
        operation?.kind === "store" ||
        operation?.kind === "memory-write" ||
        (operation?.kind === "binary" &&
          (operation.operator === "==" || operation.operator === "!=") &&
          operation.left === load.operation.result &&
          zeroConstant(fn, operation.right));
      return Object.freeze({
        block: load.block,
        index: load.index,
        result: load.operation.result,
        consumable,
      });
    });
    result.set(
      key,
      Object.freeze({
        binding: store.operation.place.root,
        storeSpan: store.operation.span,
        loadSpans: Object.freeze(access.loads.map((load) => load.operation.span)),
        block: store.block,
        storeIndex: store.index,
        loadIndexes: Object.freeze(access.loads.map((load) => load.index)),
        loads: Object.freeze(loadEvidence),
        consumeResult: null,
      }),
    );
  }
  // Only the retention slice and scalar accesses to excluded global/parameter
  // homes may sit between a push and its load. Those accesses emit A-only
  // loads/stores. A call is admitted because the callee is an ordinary function
  // whose stack use is balanced; the lowering re-reads SP after it. Any other
  // operation could change X or SP and is rejected.
  const safeExcludedAccess = (operation: SemanticOperation): boolean =>
    (operation.kind === "load" || operation.kind === "store") &&
    operation.place.path.length === 0 &&
    excludedKeys.has(bindingIdentityKey(operation.place.root)) &&
    operation.type.kind === "scalar" &&
    operation.type.name !== "void";
  for (const block of fn.blocks)
    for (const operation of block.operations)
      if (
        !allowed.has(operation) &&
        operation.kind !== "constant" &&
        operation.kind !== "convert" &&
        operation.kind !== "call" &&
        operation.kind !== "indirect-call" &&
        !safeExcludedAccess(operation)
      )
        return new Map();
  // A join can only be exact when every retained store either dominates a load
  // or cannot reach it. A store that can reach a load without dominating it
  // makes the live depth path-dependent, so the same slot address is wrong on
  // one of the paths.
  const sites = [...result.values()].flatMap((local) => [...local.loads]);
  for (const load of sites) {
    for (const other of result.values()) {
      const storeBlock = other.block;
      const dominates =
        storeBlock === load.block
          ? other.storeIndex < load.index
          : facts.dominators.get(load.block)?.has(storeBlock) === true;
      if (dominates || storeBlock === load.block) continue;
      if (blockReaches(facts.successors, storeBlock, load.block)) return new Map();
    }
  }
  // The structural plan is the whole-handler bound: a join must agree on the
  // live push count, every store must dominate the return, and no store may be
  // loop-carried. The platform capacity check is the byte-count bound.
  const plan = nmiStackPlan(fn.entry, fn.blocks, new Set(result.keys()));
  if (plan === null) return new Map();
  // The last top-slot load in the single return block can be consumed with PLA:
  // the byte is in A and SP rises by one, so the return pops one fewer byte.
  // A right-hand bitwise operand is excluded because the other operand owns A.
  const final = new Map<string, NmiStackRetainedLocal>();
  for (const [key, local] of result) {
    const slot = plan.slots.get(key);
    let consumeResult: string | null = null;
    if (slot === plan.total) {
      // The last load in the return block is the last use on every path that
      // reaches that block. A later non-consumable use (for example a bitwise
      // operand) must keep the slot live; only a consumable final use may pop.
      const returnLoads = local.loads
        .filter((load) => load.block === facts.returnBlock)
        .sort((left, right) => right.index - left.index);
      const last = returnLoads[0];
      consumeResult = last?.consumable === true ? last.result : null;
    }
    final.set(key, Object.freeze({ ...local, consumeResult }));
  }
  return final;
}
