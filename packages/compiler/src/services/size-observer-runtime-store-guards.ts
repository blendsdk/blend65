import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import { bindingLabel, machineSuccessors, semanticSuccessors } from "../machine/lower-control.js";
import {
  literalResolver,
  valueDefinitions,
} from "../semantic/aggregate-place-proof.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import type { MachineBlock } from "../machine/machine-types.js";
import type { SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import type { Body, Item } from "./size-observer-complement-field-layout.js";
import type { FinalObserverInput } from "./size-observers.js";

/** One source store to the accumulator binding. */
type AccumulatorWrite = {
  /** Exact containing block. */
  readonly block: { readonly id: string };
  /** Exact store operation. */
  readonly operation: Extract<SemanticOperation, { readonly kind: "store" }>;
};

/** One indexed store operation and the concrete guard maximum that contains its use. */
type StoreGuard = ReadonlyMap<string, bigint>;

/** Exact source operation keyed to its authenticated guard maxima. */
type StoreGuards = ReadonlyMap<SemanticOperation, StoreGuard>;

/** Resolve the index-register load for a store mode, or null for a computed pointer. */
function indexOpcode(mode: string): "ldy" | "ldx" | null {
  if (mode === "absolute-y" || mode === "indirect-indexed-y") return "ldy";
  if (mode === "absolute-x" || mode === "indirect-indexed-x") return "ldx";
  return null;
}

/** Compare exact source spans without relying on object identity. */
function sameSpan(
  left: { readonly sourceId: string; readonly start: number; readonly end: number },
  right: { readonly sourceId: string; readonly start: number; readonly end: number },
): boolean {
  return left.sourceId === right.sourceId && left.start === right.start && left.end === right.end;
}

/**
 * Read the nearest index-register load before one store in the same actual block.
 * The caller still verifies that the loaded private byte is the semantic index root.
 */
function indexLoad(pair: Body, sink: Item, opcode: "ldy" | "ldx"): Item | null {
  return (
    pair.items
      .filter((item) => item.block === sink.block && item.index < sink.index)
      .reverse()
      .find(
        (item) =>
          item.source.opcode === opcode &&
          item.source.operand?.kind === "storage" &&
          (item.source.operand.offset ?? 0) === 0,
      ) ?? null
  );
}

/** A guard load/cmp pair must be the final two instructions of the branch block. */
function guardTail(pair: Body, block: MachineBlock, extent: number): readonly [Item, Item] | null {
  const items = pair.items.filter((item) => item.block === block);
  const load = items.at(-2),
    compare = items.at(-1);
  if (
    load?.source.opcode !== "lda" ||
    load.source.operand?.kind !== "storage" ||
    compare?.source.opcode !== "cmp" ||
    compare.source.mode !== "immediate" ||
    compare.source.operand?.kind !== "immediate" ||
    compare.source.operand.value !== extent
  )
    return null;
  return [load, compare];
}

/** The failure edge must reach a self-contained stop block and never the store. */
function stopBlock(pair: Body, label: string, store: string): boolean {
  if (label === store) return false;
  const block = pair.actual.blocks.find((candidate) => candidate.label === label);
  return (
    block !== undefined &&
    block.instructions.length === 1 &&
    block.instructions[0]?.opcode === "sei" &&
    block.terminator.kind === "jump" &&
    block.terminator.target === block.label &&
    !machineSuccessors(block).includes(store)
  );
}

/** Identify the branch form that sends an out-of-range index to the shared stop block. */
function guardedEdge(block: MachineBlock, store: string): { readonly stop: string } | null {
  const terminator = block.terminator;
  if (terminator.kind === "branch" && terminator.opcode === "bcs" && terminator.fallthrough === store)
    return { stop: terminator.target };
  if (
    terminator.kind === "long-branch" &&
    terminator.opcode === "bcc" &&
    terminator.fallthrough === store
  )
    return { stop: terminator.jump.target };
  return null;
}

/** Resolve a value through identity conversions without accepting an ambiguous alias. */
function sourceValue(
  definitions: ReturnType<typeof valueDefinitions>,
  value: string,
): SemanticOperation | undefined {
  let cursor = value;
  for (let depth = 0; depth < 8; depth += 1) {
    const operation = definitions.get(cursor);
    if (operation?.kind !== "convert") return operation;
    cursor = operation.operand;
  }
  return undefined;
}

/**
 * Prove the outer loop is reached from the function entry through recognized
 * top-level loops only. An unrecognized enclosing loop would make the preheader
 * fail this chain even though its own loop fact still looks ordinary.
 */
function entryReached(
  loop: FixedLoopFacts,
  loops: readonly FixedLoopFacts[],
  entry: string,
): boolean {
  const seen = new Set<FixedLoopFacts>();
  let current: FixedLoopFacts | null = loop;
  while (current !== null) {
    if (current.preheader.id === entry) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    current =
      loops.find(
        (candidate) =>
          candidate !== current &&
          candidate.parent === null &&
          candidate.exit.id === current!.preheader.id,
      ) ?? null;
  }
  return false;
}

/**
 * Prove a byte accumulator bounded by a directly nested pair of fixed loops.
 * The exact pattern is: constant initialization outside both loops, all updates
 * in one innermost loop body, unit increments, and a parent-next inner start.
 * The count is the triangular sum B*(B-1)/2 per update, never a loop-product
 * over-approximation. Any other write, address exposure or unusual shape returns
 * null, leaving the existing containment rejection in force.
 */
function accumulatorBound(
  input: FinalObserverInput,
  fn: SemanticFunction,
  binding: BindingId,
  extent: number,
  limit: bigint,
): bigint | null {
  const facts = input.candidate.lowered.program.storageSelection?.sourceFacts;
  const packet = facts?.functions.get(fn);
  if (packet === undefined || packet.function !== fn) return null;
  const loops = packet.loops;
  if (loops.length === 0) return null;
  const definitions = valueDefinitions(fn.blocks);
  const literal = literalResolver(definitions);
  const predecessors = new Map<string, number>();
  for (const block of fn.blocks)
    for (const target of semanticSuccessors(block.terminator))
      predecessors.set(target, (predecessors.get(target) ?? 0) + 1);
  const key = bindingIdentityKey(binding);
  const writes: AccumulatorWrite[] = [];
  for (const block of fn.blocks)
    for (const operation of block.operations) {
      if (
        operation.kind === "store" &&
        operation.place.path.length === 0 &&
        bindingIdentityKey(operation.place.root) === key
      )
        writes.push({ block, operation });
    }
  if (writes.length === 0) return null;
  const initialization = writes.filter(({ operation }) => literal(operation.value) !== undefined);
  if (initialization.length !== 1) return null;
  const initial = literal(initialization[0]!.operation.value);
  if (initial === undefined || initial < 0n) return null;
  const updates = writes.filter(({ operation }) => operation !== initialization[0]!.operation);
  for (const { operation } of updates) {
    const value = sourceValue(definitions, operation.value);
    if (value?.kind !== "binary" || value.operator !== "+" || value.integer === null) return null;
    const left = sourceValue(definitions, value.left),
      right = sourceValue(definitions, value.right);
    const self = (candidate: SemanticOperation | undefined) =>
      candidate?.kind === "load" &&
      candidate.place.path.length === 0 &&
      bindingIdentityKey(candidate.place.root) === key;
    if (!((self(left) && literal(value.right) === 1n) || (self(right) && literal(value.left) === 1n)))
      return null;
  }
  for (const block of fn.blocks)
    for (const operation of block.operations)
      if (
        operation.kind === "place-address" &&
        bindingIdentityKey(operation.place.root) === key
      )
        return null;
  if (updates.length === 0) return initial < BigInt(extent) ? initial : null;
  const updateBlocks = new Set(updates.map(({ block }) => block.id));
  if (updateBlocks.size !== 1) return null;
  const updateBlock = [...updateBlocks][0]!;
  const containing = loops.filter((loop) => loop.members.has(updateBlock));
  const inner = containing.sort((left, right) => left.members.size - right.members.size)[0];
  if (
    inner === undefined ||
    (inner.body.id !== updateBlock && inner.update.id !== updateBlock) ||
    inner.initial.kind !== "parent-next"
  )
    return null;
  const outer: FixedLoopFacts | null = inner.parent;
  if (
    outer === null ||
    outer.parent !== null ||
    !entryReached(outer, loops, fn.entry) ||
    (outer.preheader.id !== fn.entry && (predecessors.get(outer.preheader.id) ?? 0) !== 1) ||
    inner.preheader.id !== outer.body.id ||
    outer.initial.kind !== "constant" ||
    outer.initial.value !== 0 ||
    outer.bound !== inner.bound ||
    outer.tripDomain.minimum !== outer.bound ||
    outer.tripDomain.maximum !== outer.bound ||
    inner.tripDomain.maximum !== outer.bound - 1 ||
    inner.initial.domain.minimum !== 1 ||
    inner.initial.domain.maximum !== outer.bound ||
    bindingIdentityKey(inner.initial.parent) !== bindingIdentityKey(outer.counter) ||
    literal(outer.increment.right) !== 1n ||
    literal(inner.increment.right) !== 1n ||
    (initialization[0]!.block.id !== outer.preheader.id &&
      initialization[0]!.block.id !== fn.entry) ||
    inner.members.has(initialization[0]!.block.id) ||
    outer.members.has(initialization[0]!.block.id)
  )
    return null;
  const bound = BigInt(outer.bound);
  const count = (bound * (bound - 1n)) / 2n;
  const maximum = initial + count * BigInt(updates.length);
  return maximum <= limit && maximum < BigInt(extent) ? maximum : null;
}

/**
 * Derive use-site maxima from the actual bounds checks emitted in both layouts.
 * This is a fallback for indexes whose source facts do not already prove containment.
 * It never manufactures a guard from an extent and never accepts a missing branch.
 * @param input Same checked source and independently closed actual constructions.
 * @param fn Exact source function whose stores are being observed.
 * @param before Original actual body.
 * @param after Selected actual body.
 * @returns Guard maxima per semantic store, or the first inconsistent premise.
 * @example const guards = deriveRuntimeStoreGuards(input, fn, before, after);
 */
export function deriveRuntimeStoreGuards(
  input: FinalObserverInput,
  fn: SemanticFunction,
  before: Body,
  after: Body,
): StoreGuards | string {
  const definitions = valueDefinitions(fn.blocks);
  const globals = new Set(
    input.checked.program.semantic.globals.map(({ id }) => bindingIdentityKey(id)),
  );
  const guards = new Map<SemanticOperation, StoreGuard>();
  for (const block of fn.blocks) {
    for (const operation of block.operations) {
      if (operation.kind !== "store") continue;
      const path = operation.place.path;
      if (path.length !== 1 || path[0]?.kind !== "index") continue;
      const rootType = operation.place.rootType;
      if (rootType?.kind !== "array") continue;
      const extent = rootType.length;
      if (extent <= 0) continue;
      if (!globals.has(bindingIdentityKey(operation.place.root))) continue;
      const definition = definitions.get(path[0].value);
      if (definition?.kind !== "load" || definition.place.path.length !== 0) continue;
      const witnesses = [before, after].map((pair) => {
        const sinks = pair.items.filter(
          (item) =>
            item.source.source === operation.span &&
            item.source.opcode === "sta" &&
            indexOpcode(item.source.mode) !== null,
        );
        if (sinks.length !== 1) return "Runtime store guard has no unique actual sink";
        const sink = sinks[0]!;
        const target = sink.source.operand;
        if (
          target?.kind !== "label" ||
          target.label !== bindingLabel("global", operation.place.root) ||
          (target.offset ?? 0) !== 0
        )
          return "Runtime store guard targets another object";
        const opcode = indexOpcode(sink.source.mode);
        if (opcode === null) return "Runtime store guard has no index register";
        const loaded = indexLoad(pair, sink, opcode);
        const operand = loaded?.source.operand;
        if (loaded === null || operand?.kind !== "storage")
          return "Runtime store guard has no index load";
        const request = pair.view.requests.get(operand.requestId);
        if (
          request === undefined ||
          request.bytes !== 1 ||
          request.persistent === true ||
          !["local", "parameter", "temporary"].includes(request.storageClass) ||
          request.binding === null ||
          bindingIdentityKey(request.binding) !== bindingIdentityKey(definition.place.root)
        )
          return "Runtime store guard uses another index home";
        const predecessors = pair.actual.blocks.filter((candidate) =>
          machineSuccessors(candidate).includes(sink.block.label),
        );
        if (predecessors.length !== 1) return "Runtime store guard has no unique predecessor";
        const guardBlock = predecessors[0]!;
        const tail = guardTail(pair, guardBlock, extent);
        if (tail === null) return null;
        const [load, compare] = tail;
        // An unrelated source comparison may legally guard this access. Only a
        // compiler-emitted guard attributed to this exact store is validated here;
        // source guards keep their stronger existing proof.
        if (
          load.source.source === null ||
          compare.source.source === null ||
          !sameSpan(load.source.source, operation.span) ||
          !sameSpan(compare.source.source, operation.span)
        )
          return null;
        const edge = guardedEdge(guardBlock, sink.block.label);
        if (
          edge === null ||
          load.source.operand?.kind !== "storage" ||
          load.source.operand.requestId !== operand.requestId ||
          (load.source.operand.offset ?? 0) !== 0 ||
          !stopBlock(pair, edge.stop, sink.block.label)
        )
          return "Runtime store guard disagrees with its actual branch";
        const between = pair.items.filter(
          (item) =>
            item.block === sink.block &&
            item.index < sink.index &&
            item.source.opcode === "sta" &&
            item.source.operand?.kind === "storage" &&
            item.source.operand.requestId === operand.requestId,
        );
        if (between.length !== 0) return "Runtime store guard is separated from its index";
        return { request, maximum: BigInt(extent - 1) };
      });
      const [original, selected] = witnesses;
      if (typeof original === "string") return original;
      if (typeof selected === "string") return selected;
      if (original === null && selected === null) {
        const limit =
          definition.type.kind === "scalar" && definition.type.name === "byte"
            ? 255n
            : definition.type.kind === "enum"
              ? 255n
              : 65535n;
        const maximum = accumulatorBound(
          input,
          fn,
          definition.place.root,
          extent,
          limit,
        );
        if (maximum !== null) guards.set(operation, new Map([[path[0].value, maximum]]));
        continue;
      }
      if (original === null || selected === null)
        return "Runtime store guard disagrees between actual layouts";
      if (
        original.request.id !== selected.request.id ||
        original.request.binding === null ||
        selected.request.binding === null ||
        bindingIdentityKey(original.request.binding) !==
          bindingIdentityKey(selected.request.binding) ||
        original.maximum !== selected.maximum
      )
        return "Runtime store guard disagrees between actual layouts";
      guards.set(operation, new Map([[path[0].value, original.maximum]]));
    }
  }
  return guards;
}
