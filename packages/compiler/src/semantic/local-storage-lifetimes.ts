import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import { semanticTypesEqual } from "../frontend/semantic-type-relations.js";
import type { SourceSpan } from "../project/types.js";
import { placeUses } from "./aggregate-place-proof.js";
import type {
  BlockId,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  ValueId,
} from "./operations.js";
import { potentialValueInputs, reachableBlocks, valueLifetimes } from "./value-lifetimes.js";
import type { SemanticPosition, ValueLifetime, WholeProgram } from "./whole-program.js";

/** Private producer identity; copied or altered fields cannot manufacture occupancy authority. */
const BINDING_LIFETIME_SEAL = Symbol("binding-lifetime-seal");

/** Bind every position and crossed call, not just a display name or function ID. */
function lifetimeContent(lifetime: ValueLifetime): string {
  return JSON.stringify([
    bindingIdentityKey(lifetime.function),
    lifetime.value,
    lifetime.definition,
    lifetime.liveAt,
    lifetime.callsCrossed,
  ]);
}

/**
 * Validate conditional binding occupancy against its original source producer.
 * Callers with a placed-global program must supply the unchanged source program,
 * after checking that placement was the only allowed representation difference.
 * @param program Original checked source, not a rebuilt equal-ID lookalike.
 * @param key Exact private binding key under which this lifetime was produced.
 * @param lifetime Conditional occupancy, including writes, backing views and calls.
 * @returns Whether source, binding, owner and complete content still match.
 */
export function validLocalStorageLifetime(
  program: WholeProgram,
  key: string,
  lifetime: ValueLifetime,
): boolean {
  if (!(BINDING_LIFETIME_SEAL in lifetime)) return false;
  const seal = lifetime[BINDING_LIFETIME_SEAL];
  const fn = program.semantic.functions.find((entry) => entry.id === lifetime.function);
  return (
    fn !== undefined &&
    typeof seal === "object" &&
    seal !== null &&
    "program" in seal &&
    seal.program === program &&
    "function" in seal &&
    seal.function === fn &&
    "key" in seal &&
    seal.key === key &&
    "content" in seal &&
    seal.content === lifetimeContent(lifetime)
  );
}

/** One source binding's physical occupancy, not one SSA version of its contents. */
interface PrivateBinding {
  readonly id: BindingId;
  readonly type: SemanticType;
  readonly parameter: boolean;
  readonly firstAccess: SemanticPosition;
  firstWrite?: SemanticPosition;
  conservative: boolean;
}

/** Cached potential reads, surviving writes and exact whole-binding kills at one boundary. */
interface BindingAccess {
  readonly reads: Set<string>;
  readonly writes: Set<string>;
  readonly kills: Set<string>;
}

/** Render an existing semantic boundary without inventing an instruction position. */
function positionKey(position: SemanticPosition): string {
  return `${position.block}\0${position.operation}`;
}

/** Source CFG successor identities; missing blocks are rejected by reachableBlocks. */
function successors(block: SemanticBlock): readonly BlockId[] {
  const terminal = block.terminator;
  return terminal.kind === "jump"
    ? [terminal.target]
    : terminal.kind === "branch"
      ? [terminal.whenTrue, terminal.whenFalse]
      : [];
}

/** Content comparison keeps the finite backward fixed point independent of traversal order. */
function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

/** Propagate only possible backing dependencies; a completed scalar call returns a new value. */
function backingRoots(
  blocks: readonly SemanticBlock[],
  bindings: ReadonlyMap<string, PrivateBinding>,
): ReadonlyMap<ValueId, ReadonlySet<string>> {
  const roots = new Map<ValueId, Set<string>>();
  const users = new Map<ValueId, Set<ValueId>>();
  for (const block of blocks)
    for (const operation of block.operations) {
      if (!("result" in operation) || operation.result === null) continue;
      const target = roots.get(operation.result) ?? new Set<string>();
      roots.set(operation.result, target);
      if (operation.kind === "load" || operation.kind === "place-address") {
        const key = bindingIdentityKey(operation.place.root);
        if (bindings.has(key)) target.add(key);
      }
      if (operation.kind === "array-count") {
        const key = bindingIdentityKey(operation.parameter);
        if (bindings.has(key)) target.add(key);
      }
      const call = operation.kind === "call" || operation.kind === "indirect-call";
      const destination =
        operation.kind === "aggregate"
          ? operation.destination
          : call
            ? operation.aggregateDestination
            : undefined;
      if (destination?.kind === "place") {
        const key = bindingIdentityKey(destination.place.root);
        if (bindings.has(key)) target.add(key);
      }
      if (call) continue;
      for (const value of potentialValueInputs(operation)) {
        const consumers = users.get(value) ?? new Set<ValueId>();
        consumers.add(operation.result);
        users.set(value, consumers);
      }
    }
  // Complete roots are retained for the result. Pending roots contain only facts
  // not yet sent along an edge, so long expression chains do not resend prefixes.
  const pendingRoots = new Map(
    [...roots].filter(([, set]) => set.size > 0).map(([value, set]) => [value, new Set(set)]),
  );
  const pending = [...pendingRoots.keys()];
  const queued = new Set(pending);
  for (let head = 0; head < pending.length; head += 1) {
    const value = pending[head]!;
    queued.delete(value);
    const delta = pendingRoots.get(value)!;
    pendingRoots.delete(value);
    for (const consumer of users.get(value) ?? []) {
      const target = roots.get(consumer)!;
      let changed = false;
      for (const root of delta)
        if (!target.has(root)) {
          target.add(root);
          const additions = pendingRoots.get(consumer) ?? new Set<string>();
          additions.add(root);
          pendingRoots.set(consumer, additions);
          changed = true;
        }
      if (changed && !queued.has(consumer)) {
        pending.push(consumer);
        queued.add(consumer);
      }
    }
  }
  return roots;
}

/** Derive one function's binding lives without conflating liveness with write occupancy. */
function functionBindingLifetimes(
  fn: SemanticFunction,
  globals: ReadonlySet<string>,
): ReadonlyMap<string, ValueLifetime> {
  const blocks = reachableBlocks(fn.entry, fn.blocks);
  const entry: SemanticPosition = Object.freeze({ block: fn.entry, operation: 0 });
  const bindings = new Map<string, PrivateBinding>();
  for (const parameter of fn.parameters)
    bindings.set(bindingIdentityKey(parameter.id), {
      id: parameter.id,
      type: parameter.type,
      parameter: true,
      firstAccess: entry,
      conservative: false,
    });
  const positions: SemanticPosition[] = [];
  const operations = new Map<string, SemanticOperation>();
  const accesses = new Map<string, BindingAccess>();
  for (const block of blocks) {
    for (let index = 0; index <= block.operations.length; index += 1) {
      const position = Object.freeze({ block: block.id, operation: index });
      positions.push(position);
      accesses.set(positionKey(position), {
        reads: new Set(),
        writes: new Set(),
        kills: new Set(),
      });
      const operation = block.operations[index];
      if (operation === undefined) continue;
      operations.set(positionKey(position), operation);
      for (const use of placeUses(operation)) {
        const key = bindingIdentityKey(use.place.root);
        if (globals.has(key) || use.place.asset !== undefined) continue;
        let binding = bindings.get(key);
        const type = use.place.rootType ?? ("type" in operation ? operation.type : undefined);
        if (binding === undefined) {
          if (type === undefined) throw new Error("Private storage access has no source type");
          binding = {
            id: use.place.root,
            type,
            parameter: false,
            firstAccess: position,
            conservative: false,
          };
          bindings.set(key, binding);
        }
        // A borrowed aggregate parameter stores a pointer, not the addressed object.
        // Its backing reads remain tracked below; taking a local/scalar address
        // instead keeps that actual automatic object conservative for this invocation.
        if (
          operation.kind === "place-address" &&
          !(binding.parameter && (binding.type.kind === "array" || binding.type.kind === "struct"))
        )
          binding.conservative = true;
      }
    }
  }
  const roots = backingRoots(blocks, bindings);
  for (const position of positions) {
    const operation = operations.get(positionKey(position));
    if (operation === undefined) continue;
    const access = accesses.get(positionKey(position))!;
    for (const value of potentialValueInputs(operation))
      for (const root of roots.get(value) ?? []) access.reads.add(root);
    if (operation.kind === "array-count") {
      const key = bindingIdentityKey(operation.parameter);
      if (bindings.has(key)) access.reads.add(key);
    }
    if (operation.kind === "call" || operation.kind === "indirect-call")
      for (const count of operation.argumentArrayCounts ?? []) {
        if (count?.kind !== "parameter") continue;
        const key = bindingIdentityKey(count.binding);
        if (bindings.has(key)) access.reads.add(key);
      }
    for (const use of placeUses(operation)) {
      const key = bindingIdentityKey(use.place.root);
      const binding = bindings.get(key);
      if (binding === undefined) continue;
      const write =
        operation.kind === "store" ||
        operation.kind === "aggregate" ||
        operation.kind === "call" ||
        operation.kind === "indirect-call";
      if (write) {
        access.writes.add(key);
        binding.firstWrite ??= position;
        if (
          operation.kind === "store" &&
          use.place.path.length === 0 &&
          semanticTypesEqual(binding.type, operation.type) &&
          !(binding.parameter && (binding.type.kind === "array" || binding.type.kind === "struct"))
        )
          access.kills.add(key);
      } else access.reads.add(key);
      if (binding.parameter && (binding.type.kind === "array" || binding.type.kind === "struct"))
        access.reads.add(key);
    }
  }
  // A lazy memory view can survive its semantic load through conversions, merges
  // or arithmetic consumers. Keep its backing home until every potential consumer;
  // only a later explicit materialization/elision proof may remove this obligation.
  for (const value of valueLifetimes(fn))
    for (const root of roots.get(value.value) ?? [])
      for (const position of value.liveAt) accesses.get(positionKey(position))?.reads.add(root);

  const generated = new Map<BlockId, Set<string>>();
  const killed = new Map<BlockId, Set<string>>();
  for (const block of blocks) {
    const gen = new Set<string>();
    const kill = new Set<string>();
    for (let index = 0; index <= block.operations.length; index += 1) {
      const access = accesses.get(positionKey({ block: block.id, operation: index }))!;
      for (const root of access.reads) if (!kill.has(root)) gen.add(root);
      for (const root of access.kills) kill.add(root);
    }
    generated.set(block.id, gen);
    killed.set(block.id, kill);
  }
  const liveIn = new Map(blocks.map((block) => [block.id, new Set<string>()]));
  const liveOut = new Map(blocks.map((block) => [block.id, new Set<string>()]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of [...blocks].reverse()) {
      const out = new Set(successors(block).flatMap((id) => [...liveIn.get(id)!]));
      const inside = new Set(generated.get(block.id));
      for (const root of out) if (!killed.get(block.id)!.has(root)) inside.add(root);
      if (!sameSet(out, liveOut.get(block.id)!)) {
        liveOut.set(block.id, out);
        changed = true;
      }
      if (!sameSet(inside, liveIn.get(block.id)!)) {
        liveIn.set(block.id, inside);
        changed = true;
      }
    }
  }
  const occupied = new Map([...bindings.keys()].map((key) => [key, new Set<string>()]));
  for (const block of blocks) {
    const terminal = positionKey({ block: block.id, operation: block.operations.length });
    const live = new Set(liveOut.get(block.id));
    for (const root of accesses.get(terminal)!.reads) live.add(root);
    for (const root of live) occupied.get(root)!.add(terminal);
    for (let index = block.operations.length - 1; index >= 0; index -= 1) {
      const key = positionKey({ block: block.id, operation: index });
      const access = accesses.get(key)!;
      for (const root of access.kills) live.delete(root);
      for (const root of access.reads) live.add(root);
      for (const root of live) occupied.get(root)!.add(key);
      // Even a dead assignment physically writes unless the selected recipe proves it elided.
      for (const root of access.writes) occupied.get(root)!.add(key);
    }
  }
  const result = new Map<string, ValueLifetime>();
  for (const [key, binding] of bindings) {
    const life = occupied.get(key)!;
    if (binding.conservative) for (const position of positions) life.add(positionKey(position));
    // Retained parameter delivery is one common write group before the body.
    if (binding.parameter) life.add(positionKey(entry));
    const liveAt = positions.filter((position) => life.has(positionKey(position)));
    const calls: SourceSpan[] = [];
    for (const position of liveAt) {
      const operation = operations.get(positionKey(position));
      if (operation?.kind === "call" || operation?.kind === "indirect-call")
        calls.push(operation.span);
    }
    result.set(
      key,
      Object.freeze({
        function: fn.id,
        value: `${binding.parameter ? "parameter" : "local"}:${key}`,
        definition: binding.parameter ? entry : (binding.firstWrite ?? binding.firstAccess),
        liveAt: Object.freeze(liveAt),
        callsCrossed: Object.freeze(calls),
      }),
    );
  }
  return result;
}

/**
 * Derive conditional access-complete occupancy for private source bindings.
 * Surviving writes, incoming marshals and possible deferred backing reads are
 * retained even when a value has no later source use. This query does not clear
 * alias/physical-observer obligations or introduce cross-domain sharing: selected
 * recipes must still prove actual access coverage and complete final interference.
 * @param program Exact checked source program whose identities own the returned lives.
 * @returns Parameter/local binding keys mapped to existing CFG-boundary lifetimes.
 * @throws {Error} If the source CFG is malformed or a private access lacks its source type.
 * @example
 * const lifetime = deriveLocalStorageLifetimes(program).get(bindingIdentityKey(local.id));
 */
export function deriveLocalStorageLifetimes(
  program: WholeProgram,
): ReadonlyMap<string, ValueLifetime> {
  const globals = new Set(program.semantic.globals.map((global) => bindingIdentityKey(global.id)));
  const reached = new Set(program.reachableFunctions.map(bindingIdentityKey));
  const result = new Map<string, ValueLifetime>();
  for (const fn of program.semantic.functions) {
    if (!reached.has(bindingIdentityKey(fn.id))) continue;
    for (const [key, lifetime] of functionBindingLifetimes(fn, globals))
      result.set(
        key,
        Object.freeze({
          ...lifetime,
          [BINDING_LIFETIME_SEAL]: Object.freeze({
            program,
            function: fn,
            key,
            content: lifetimeContent(lifetime),
          }),
        }),
      );
  }
  return result;
}
