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
