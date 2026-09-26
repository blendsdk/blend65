import type { SourceSpan } from "../project/types.js";
import type {
  BlockId,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  ValueId,
} from "./operations.js";
import type { SemanticPosition, ValueLifetime } from "./whole-program.js";

/** Return blocks reachable through explicit semantic terminators. */
export function reachableBlocks(
  entry: BlockId,
  blocks: readonly SemanticBlock[],
): readonly SemanticBlock[] {
  const byId = new Map(blocks.map((block) => [block.id, block] as const));
  const reached = new Set<BlockId>();
  const pending: BlockId[] = [entry];
  while (pending.length > 0) {
    const id = pending.shift()!;
    if (reached.has(id)) continue;
    const block = byId.get(id);
    if (block === undefined) throw new Error(`Semantic CFG references missing block '${id}'`);
    reached.add(id);
    if (block.terminator.kind === "jump") pending.push(block.terminator.target);
    else if (block.terminator.kind === "branch") {
      pending.push(block.terminator.whenTrue, block.terminator.whenFalse);
    }
  }
  return Object.freeze(blocks.filter(({ id }) => reached.has(id)));
}

/** Return the value defined by an operation, when it defines one. */
function operationResult(operation: SemanticOperation): ValueId | null {
  return "result" in operation ? operation.result : null;
}

/** Return every existing value used by one operation. */
function operationUses(operation: SemanticOperation): readonly ValueId[] {
  switch (operation.kind) {
    case "convert":
    case "unary":
      return [operation.operand];
    case "binary":
    case "bcd":
      return [operation.left, operation.right];
    case "store":
      return [
        operation.value,
        ...operation.place.path.flatMap((part) => (part.kind === "index" ? [part.value] : [])),
      ];
    case "load":
    case "place-address":
      return operation.place.path.flatMap((part) => (part.kind === "index" ? [part.value] : []));
    case "call":
    case "platform":
      return operation.arguments;
    case "indirect-call":
      return [operation.target, ...operation.arguments];
    case "memory-read":
      return [operation.address];
    case "memory-write":
      return [operation.address, operation.value];
    case "aggregate":
      return [
        ...operation.elements.map(({ value }) => value),
        ...(operation.fill === null ? [] : [operation.fill]),
      ];
    case "merge":
      return [];
    default:
      return [];
  }
}

/** Return the values consumed by a block terminator. */
function terminatorUses(block: SemanticBlock): readonly ValueId[] {
  if (block.terminator.kind === "branch") return [block.terminator.condition];
  if (block.terminator.kind === "return" && block.terminator.value !== null) {
    return [block.terminator.value];
  }
  return [];
}

/** Return the successors selected by one terminator. */
function successors(block: SemanticBlock): readonly BlockId[] {
  if (block.terminator.kind === "jump") return [block.terminator.target];
  if (block.terminator.kind === "branch") {
    return [block.terminator.whenTrue, block.terminator.whenFalse];
  }
  return [];
}

/** Compare two value sets without depending on insertion order. */
function sameValues(left: ReadonlySet<ValueId>, right: ReadonlySet<ValueId>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

/** Compute exact CFG liveness without imposing a false linear block order. */
export function valueLifetimes(
  fn: Pick<SemanticFunction, "id" | "entry" | "blocks">,
): readonly ValueLifetime[] {
  const blocks = reachableBlocks(fn.entry, fn.blocks);
  const definitions = new Map<ValueId, SemanticPosition>();
  const definitionsByBlock = new Map<BlockId, ReadonlySet<ValueId>>();
  const usesByBlock = new Map<BlockId, ReadonlySet<ValueId>>();
  const mergeUses = new Map<string, ReadonlySet<ValueId>>();

  for (const block of blocks) {
    const defined = new Set<ValueId>();
    const usedBeforeDefinition = new Set<ValueId>();
    block.operations.forEach((op, operation) => {
      const result = operationResult(op);
      if (result !== null) {
        defined.add(result);
        definitions.set(result, Object.freeze({ block: block.id, operation }));
      }
      for (const value of operationUses(op)) {
        if (!defined.has(value)) usedBeforeDefinition.add(value);
      }
      if (op.kind === "merge") {
        for (const incoming of op.incoming) {
          const key = `${incoming.block}\0${block.id}`;
          mergeUses.set(key, new Set([...(mergeUses.get(key) ?? []), incoming.value]));
        }
      }
    });
    for (const value of terminatorUses(block)) {
      if (!defined.has(value)) usedBeforeDefinition.add(value);
    }
    definitionsByBlock.set(block.id, defined);
    usesByBlock.set(block.id, usedBeforeDefinition);
  }

  const liveIn = new Map(blocks.map(({ id }) => [id, new Set<ValueId>()] as const));
  const liveOut = new Map(blocks.map(({ id }) => [id, new Set<ValueId>()] as const));
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of [...blocks].reverse()) {
      const nextOut = new Set<ValueId>();
      for (const successor of successors(block)) {
        const successorLive = liveIn.get(successor);
        if (successorLive === undefined) {
          throw new Error(`Semantic CFG references missing block '${successor}'`);
        }
        const successorDefinitions = definitionsByBlock.get(successor) ?? new Set<ValueId>();
        for (const value of successorLive) {
          if (!successorDefinitions.has(value)) nextOut.add(value);
        }
        for (const value of mergeUses.get(`${block.id}\0${successor}`) ?? []) {
          nextOut.add(value);
        }
      }
      const nextIn = new Set(usesByBlock.get(block.id) ?? []);
      const localDefinitions = definitionsByBlock.get(block.id) ?? new Set<ValueId>();
      for (const value of nextOut) {
        if (!localDefinitions.has(value)) nextIn.add(value);
      }
      if (!sameValues(liveOut.get(block.id)!, nextOut)) {
        liveOut.set(block.id, nextOut);
        changed = true;
      }
      if (!sameValues(liveIn.get(block.id)!, nextIn)) {
        liveIn.set(block.id, nextIn);
        changed = true;
      }
    }
  }

  const positions = new Map<ValueId, Map<string, SemanticPosition>>();
  const calls = new Map<ValueId, SourceSpan[]>();
  const addPosition = (value: ValueId, block: BlockId, operation: number): void => {
    const position = Object.freeze({ block, operation });
    const byKey = positions.get(value) ?? new Map<string, SemanticPosition>();
    byKey.set(`${block}\0${operation}`, position);
    positions.set(value, byKey);
  };
  for (const [value, definition] of definitions) {
    addPosition(value, definition.block, definition.operation);
  }
  for (const block of blocks) {
    let live = new Set(liveOut.get(block.id) ?? []);
    for (const value of terminatorUses(block)) live.add(value);
    for (const value of live) addPosition(value, block.id, block.operations.length);
    for (let index = block.operations.length - 1; index >= 0; index -= 1) {
      const operation = block.operations[index]!;
      const after = new Set(live);
      const result = operationResult(operation);
      if (result !== null) live.delete(result);
      for (const value of operationUses(operation)) live.add(value);
      if (operation.kind === "call" || operation.kind === "indirect-call") {
        for (const value of live) {
          if (!after.has(value)) continue;
          const crossed = calls.get(value) ?? [];
          crossed.push(operation.span);
          calls.set(value, crossed);
        }
      }
      for (const value of live) addPosition(value, block.id, index);
    }
  }

  return Object.freeze(
    [...definitions].map(([value, definition]) =>
      Object.freeze({
        function: fn.id,
        value,
        definition,
        liveAt: Object.freeze([...(positions.get(value)?.values() ?? [])]),
        callsCrossed: Object.freeze(calls.get(value) ?? []),
      }),
    ),
  );
}
