import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import type {
  SemanticBlock,
  SemanticOperation,
  SemanticPlace,
  SemanticPlacePath,
} from "./operations.js";
import { joinPath } from "./callable-paths.js";

/** One callable leaf and its byte interval relative to an enclosing value. */
export interface CallableLeaf {
  /** Field/index path from the enclosing value, matching `callablePaths`. */
  readonly path: string;
  /** First byte relative to the enclosing value. */
  readonly start: number;
  /** Half-open end byte relative to the enclosing value. */
  readonly end: number;
}

/** Enumerate callable leaves with their exact byte intervals. */
export function callableLeaves(
  type: SemanticType,
  start = 0,
  prefix = "",
): readonly CallableLeaf[] {
  if (type.kind === "function" || type.kind === "interrupt-handler") {
    const bytes = semanticTypeSize(type);
    return [{ path: prefix, start, end: start + bytes }];
  }
  if (type.kind === "struct") {
    return type.fields.flatMap((field) =>
      callableLeaves(field.type, start + field.offset, joinPath(prefix, `field:${field.name}`)),
    );
  }
  if (type.kind === "array" && type.length > 0) {
    const stride = semanticTypeSize(type.element);
    return Array.from({ length: type.length }, (_, index) =>
      callableLeaves(type.element, start + index * stride, joinPath(prefix, "index:*")),
    ).flat();
  }
  return [];
}

/** One statically placed module object and its complete byte interval. */
export interface PlacedRange {
  /** First byte in the selected CPU address space. */
  readonly start: number;
  /** Half-open end byte. */
  readonly end: number;
}

/** One half-open byte range whose callable provenance may be corrupted. */
export interface KilledRange {
  /** Binding root identity. */
  readonly root: string;
  /** First corrupted byte relative to the root. */
  readonly start: number;
  /** Half-open end byte relative to the root. */
  readonly end: number;
}

/** Killed ranges retained in a stable order for equality and overlap checks. */
export type KilledFacts = readonly KilledRange[];

/**
 * Root identity of a kill whose destination could not be resolved. Such a write
 * may have reached any callable byte, so every later callable read is unproved
 * until a definite typed store replaces the bytes. The value cannot collide with
 * a binding identity because those never contain a NUL byte.
 */
export const OPAQUE_ROOT = "\0opaque";

/** One root whose bytes may overlap a source root at a fixed displacement. */
export type AliasTarget =
  | {
      /** Overlapping root identity. */
      readonly root: string;
      /** Byte displacement: source offset `o` corresponds to `o + delta`. */
      readonly delta: number;
    }
  | {
      /** The source may alias any storage whose actual object is unresolved. */
      readonly all: true;
    };

/** May-alias relations for one executable body, keyed by source root. */
export type AliasRelations = ReadonlyMap<string, readonly AliasTarget[]>;

/** State and callbacks threaded through one kill-flow computation. */
export interface KillFlowOptions {
  /** Kills already present on entry, for a callee analysed at a call site. */
  readonly initial?: KilledFacts | undefined;
  /** May-alias relations for this body's parameters and globals. */
  readonly aliases?: AliasRelations | undefined;
  /** Whether an unresolved parameter forces every raw write to stay opaque. */
  readonly opaqueAliases?: boolean | undefined;
  /** Whether later compilation inserts runtime bounds guards. */
  readonly boundsChecked?: boolean | undefined;
  /** Apply a call's translated kill summary to the state after the call. */
  readonly callEffect?:
    | ((
        operation: Extract<SemanticOperation, { readonly kind: "call" | "indirect-call" }>,
        kills: KilledFacts,
      ) => KilledFacts)
    | undefined;
}

/** The single conservative kill used when a raw destination cannot be resolved. */
const OPAQUE_KILL: KilledRange = Object.freeze({ root: OPAQUE_ROOT, start: 0, end: 1 });

/** One value definition retained for constant index resolution. */
export type Definitions = ReadonlyMap<string, SemanticOperation>;

/** Proved upper bounds for local places, keyed by root and constant-aware path. */
export type IndexBounds = ReadonlyMap<string, number>;

/** Stable key for one place under a bound analysis. */
export function placeBoundKey(place: SemanticPlace): string {
  return JSON.stringify([
    bindingIdentityKey(place.root),
    place.path.map((step) => (step.kind === "field" ? ["field", step.name] : ["index", "*"])),
  ]);
}

/** Resolve one constant expression, including truncating conversions. */
export function constantValue(
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
  const mask = 2 ** (semanticTypeSize(operation.type) * 8) - 1;
  return value & mask;
}

/** Collect the value definitions of one executable body. */
export function definitionsOf(blocks: readonly SemanticBlock[]): Definitions {
  const definitions = new Map<string, SemanticOperation>();
  for (const block of blocks)
    for (const operation of block.operations) {
      const result = "result" in operation ? operation.result : null;
      if (result !== null && result !== undefined) definitions.set(result, operation);
    }
  return definitions;
}

/**
 * Resolve one place to an exact half-open byte range. A runtime index has no
 * exact offset and returns null; callers keep that case on the deferred
 * runtime-destination boundary or use a possible-range check.
 */
export function placeByteRange(place: SemanticPlace, definitions: Definitions): KilledRange | null {
  const root = bindingIdentityKey(place.root);
  let type: SemanticType | undefined = place.rootType;
  let start = 0;
  for (const step of place.path) {
    if (step.kind === "field") {
      if (type?.kind !== "struct") return null;
      const field = type.fields.find(({ name }) => name === step.name);
      if (field === undefined) return null;
      start += field.offset;
      type = field.type;
      continue;
    }
    if (type?.kind !== "array") return null;
    const index = constantValue(definitions.get(step.value), definitions);
    // A runtime index has no exact byte range. The bounded slice leaves it on
    // the deferred #161 path instead of inventing offset zero.
    if (index === null) return null;
    start += semanticTypeSize(type.element) * index;
    type = type.element;
  }
  const bytes = type === undefined ? 0 : semanticTypeSize(type);
  return { root, start, end: start + bytes };
}

/** Whether a place contains an index whose value is not compile-time known. */
export function hasDynamicIndex(place: SemanticPlace, definitions: Definitions): boolean {
  return place.path.some(
    (step) =>
      step.kind === "index" && constantValue(definitions.get(step.value), definitions) === null,
  );
}

/** One possible callable leaf and its path relative to the loaded value. */
export interface PossibleLeaf extends KilledRange {
  /** Leaf path relative to the loaded value, matching `callableLeaves`. */
  readonly path: string;
}

/**
 * Enumerate the possible callable byte intervals for one place, continuing
 * through the complete remaining field/index path after every runtime index.
 * The static prefix and each possible element are retained, so a disjoint
 * non-callable prefix or sibling does not poison the read.
 */
export function possibleCallableRanges(
  place: SemanticPlace,
  definitions: Definitions,
  bounds: IndexBounds = new Map(),
): readonly PossibleLeaf[] {
  const root = bindingIdentityKey(place.root);
  const walk = (
    type: SemanticType | undefined,
    start: number,
    steps: readonly SemanticPlacePath[],
  ): readonly PossibleLeaf[] => {
    if (steps.length === 0) {
      if (type === undefined) return [];
      return callableLeaves(type, start).map((leaf) => ({
        root,
        path: leaf.path,
        start: leaf.start,
        end: leaf.end,
      }));
    }
    const [step, ...rest] = steps;
    if (step.kind === "field") {
      if (type?.kind !== "struct") return [];
      const field = type.fields.find(({ name }) => name === step.name);
      if (field === undefined) return [];
      return walk(field.type, start + field.offset, rest);
    }
    if (type?.kind !== "array") return [];
    const stride = semanticTypeSize(type.element);
    const index = constantValue(definitions.get(step.value), definitions);
    if (index !== null) return walk(type.element, start + stride * index, rest);
    const bound = indexUpperBound(step.value, definitions, bounds);
    const count = bound === null ? type.length : Math.min(type.length, bound + 1);
    return Array.from({ length: count }, (_, element) =>
      walk(type.element, start + element * stride, rest),
    ).flat();
  };
  return walk(place.rootType, 0, place.path);
}

/** A proved upper bound for one index value, or null when it is unknown. */
export function indexUpperBound(
  value: string,
  definitions: Definitions,
  bounds: IndexBounds = new Map(),
): number | null {
  const operation = definitions.get(value);
  if (operation?.kind === "load" || operation?.kind === "place-address") {
    const bound = bounds.get(placeBoundKey(operation.place));
    if (bound !== undefined) return bound;
  }
  if (operation?.kind === "constant")
    return typeof operation.value === "boolean"
      ? operation.value
        ? 1
        : 0
      : Number(operation.value);
  if (operation?.kind === "convert") return indexUpperBound(operation.operand, definitions, bounds);
  if (operation?.kind === "merge")
    return operation.incoming.reduce<number | null>((maximum, incoming) => {
      const bound = indexUpperBound(incoming.value, definitions, bounds);
      if (bound === null) return null;
      return maximum === null ? bound : Math.max(maximum, bound);
    }, null);
  if (operation?.kind !== "binary") return null;
  const right = constantValue(definitions.get(operation.right), definitions);
  if (operation.operator === "&" && right !== null) return right;
  if (operation.operator === "%" && right !== null && right > 0) return right - 1;
  return null;
}

/** The conservative kill that invalidates every later callable read. */
export function opaqueKill(): KilledFacts {
  return Object.freeze([OPAQUE_KILL]);
}

/** Whether a fact set contains a kill that may cover any root. */
export function hasOpaqueKill(kills: KilledFacts): boolean {
  return kills.some(({ root }) => root === OPAQUE_ROOT);
}

/**
 * Enumerate every possible whole-value byte interval of one place. A runtime
 * index expands to the declared elements; a constant index selects one. The
 * result is null when a step cannot be followed or an empty array leaves no
 * possible element.
 */
export function possiblePlaceRanges(
  place: SemanticPlace,
  definitions: Definitions,
): readonly KilledRange[] | null {
  const root = bindingIdentityKey(place.root);
  const walk = (
    type: SemanticType | undefined,
    start: number,
    steps: readonly SemanticPlacePath[],
  ): readonly KilledRange[] | null => {
    if (steps.length === 0) {
      if (type === undefined) return null;
      return [{ root, start, end: start + semanticTypeSize(type) }];
    }
    const [step, ...rest] = steps;
    if (step.kind === "field") {
      if (type?.kind !== "struct") return null;
      const field = type.fields.find(({ name }) => name === step.name);
      if (field === undefined) return null;
      return walk(field.type, start + field.offset, rest);
    }
    if (type?.kind !== "array" || type.length === 0) return null;
    const stride = semanticTypeSize(type.element);
    const index = constantValue(definitions.get(step.value), definitions);
    if (index !== null) {
      if (index < 0 || index >= type.length) return null;
      return walk(type.element, start + stride * index, rest);
    }
    const bound = indexUpperBound(step.value, definitions);
    const count = bound === null ? type.length : Math.min(type.length, bound + 1);
    const ranges: KilledRange[] = [];
    for (let element = 0; element < count; element += 1) {
      const child = walk(type.element, start + element * stride, rest);
      if (child === null) return null;
      ranges.push(...child);
    }
    return ranges;
  };
  return walk(place.rootType, 0, place.path);
}

/**
 * Resolve a raw write destination to every possible byte interval. An exact
 * place returns one interval. A checked or proved-bounded dynamic index returns
 * its declared elements. An unchecked unbounded index may leave the object, so
 * it returns null and the caller keeps the write opaque.
 */
export function possibleWriteRanges(
  place: SemanticPlace,
  definitions: Definitions,
  boundsChecked: boolean,
): readonly KilledRange[] | null {
  if (!hasDynamicIndex(place, definitions)) {
    const exact = placeByteRange(place, definitions);
    return exact === null ? null : [exact];
  }
  if (!boundsChecked && !allDynamicIndicesBounded(place, definitions)) return null;
  return possiblePlaceRanges(place, definitions);
}

/** Whether every runtime index in the place is proved inside its array. */
export function allDynamicIndicesBounded(
  place: SemanticPlace,
  definitions: Definitions,
  bounds: IndexBounds = new Map(),
): boolean {
  let type: SemanticType | undefined = place.rootType;
  for (const step of place.path) {
    if (step.kind === "field") {
      if (type?.kind !== "struct") return false;
      const field = type.fields.find(({ name }) => name === step.name);
      if (field === undefined) return false;
      type = field.type;
      continue;
    }
    if (type?.kind !== "array") return false;
    const array = type;
    const index = constantValue(definitions.get(step.value), definitions);
    if (index === null) {
      const bound = indexUpperBound(step.value, definitions, bounds);
      if (bound === null || bound >= array.length) return false;
    } else if (index >= array.length) return false;
    type = array.element;
  }
  return true;
}

/** Merge and sort overlapping or adjacent ranges for stable comparison. */
export function normalizeKills(ranges: readonly KilledRange[]): KilledFacts {
  const byRoot = new Map<string, [number, number][]>();
  for (const range of ranges) {
    if (range.end <= range.start) continue;
    const known = byRoot.get(range.root) ?? [];
    known.push([range.start, range.end]);
    byRoot.set(range.root, known);
  }
  const merged: KilledRange[] = [];
  for (const [root, intervals] of [...byRoot].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    intervals.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
    let current: [number, number] | null = null;
    for (const interval of intervals) {
      if (current === null) current = [interval[0], interval[1]];
      else if (interval[0] <= current[1]) current[1] = Math.max(current[1], interval[1]);
      else {
        merged.push({ root, start: current[0], end: current[1] });
        current = [interval[0], interval[1]];
      }
    }
    if (current !== null) merged.push({ root, start: current[0], end: current[1] });
  }
  return Object.freeze(merged);
}

/** Union two killed fact sets. */
export function unionKills(left: KilledFacts, right: KilledFacts): KilledFacts {
  return normalizeKills([...left, ...right]);
}

/** Remove the bytes a typed store completely writes. */
export function subtractStore(kills: KilledFacts, store: KilledRange): KilledFacts {
  const remaining: KilledRange[] = [];
  for (const range of kills) {
    // Only a definite typed store to the same root can restore its bytes. An
    // opaque kill has no known root and stays until it is replaced by such a
    // store in a later step.
    if (range.root === OPAQUE_ROOT) {
      remaining.push(range);
      continue;
    }
    if (range.root !== store.root || range.end <= store.start || store.end <= range.start) {
      remaining.push(range);
      continue;
    }
    if (range.start < store.start)
      remaining.push({ root: range.root, start: range.start, end: store.start });
    if (store.end < range.end)
      remaining.push({ root: range.root, start: store.end, end: range.end });
  }
  return normalizeKills(remaining);
}

/**
 * Whether a place interval overlaps any killed byte. An opaque runtime write
 * reaches only roots it can name through the source alias model: globals,
 * borrowed aggregate parameters and address-taken storage. A private local
 * whose address never escapes, or a by-value scalar parameter, cannot be named
 * by a callee or a runtime pointer.
 */
export function rangeIsKilled(
  kills: KilledFacts,
  range: KilledRange,
  opaqueRoots?: ReadonlySet<string>,
): boolean {
  return kills.some((killed) =>
    killed.root === OPAQUE_ROOT
      ? opaqueRoots === undefined || opaqueRoots.has(range.root)
      : killed.root === range.root && killed.start < range.end && range.start < killed.end,
  );
}

/** Add the intersections of one absolute write with every placed object. */
export function addPlacedWrite(
  kills: KilledFacts,
  absoluteStart: number,
  width: number,
  placed: ReadonlyMap<string, PlacedRange>,
): KilledFacts {
  const added: KilledRange[] = [];
  for (const [root, interval] of placed) {
    const start = Math.max(absoluteStart, interval.start);
    const end = Math.min(absoluteStart + width, interval.end);
    if (start < end) added.push({ root, start: start - interval.start, end: end - interval.start });
  }
  return added.length === 0 ? kills : normalizeKills([...kills, ...added]);
}

/** Project one constant-address write onto every placed object its bytes overlap. */
function placedOverlaps(
  kills: KilledFacts,
  address: number,
  width: number,
  placed: ReadonlyMap<string, PlacedRange>,
  aliases: AliasRelations,
): KilledFacts {
  let next = kills;
  for (const [root, interval] of placed) {
    const start = Math.max(address, interval.start);
    const end = Math.min(address + width, interval.end);
    if (start >= end) continue;
    next = addKilledInterval(
      next,
      { root, start: start - interval.start, end: end - interval.start },
      placed,
      aliases,
    );
  }
  return next;
}

/** Add one raw write's byte range to the killed facts. */
export function addRawWrite(
  kills: KilledFacts,
  operation: Extract<SemanticOperation, { readonly kind: "memory-write" }>,
  definitions: Definitions,
  placed: ReadonlyMap<string, PlacedRange>,
  aliases: AliasRelations = new Map(),
  opaqueAliases = false,
  boundsChecked = true,
): KilledFacts {
  const address = throughAddressConversions(operation.address, definitions);
  // An unresolved parameter may alias any storage, so every write in such a body
  // stays opaque until a definite typed store replaces the affected bytes. A
  // constant address still names exactly which bytes it covers, whatever else the
  // body might alias, so those exact facts are kept alongside the opaque one
  // rather than replaced by it.
  if (opaqueAliases) {
    const reached = constantValue(address, definitions);
    const opaque = unionKills(kills, opaqueKill());
    return reached === null
      ? opaque
      : placedOverlaps(opaque, reached, operation.width, placed, aliases);
  }
  if (address?.kind === "place-address") {
    const ranges = possibleWriteRanges(address.place, definitions, boundsChecked);
    if (ranges === null) return unionKills(kills, opaqueKill());
    let next = kills;
    for (const range of ranges)
      next = addKilledInterval(
        next,
        { root: range.root, start: range.start, end: range.start + operation.width },
        placed,
        aliases,
      );
    return next;
  }
  const constant = constantValue(address, definitions);
  if (constant === null) return unionKills(kills, opaqueKill());
  // A constant address is resolved through every placed object it may overlap.
  // Each overlap goes through the same alias path as a place-address write, so a
  // constant write inside a helper also reaches a borrowed parameter of that
  // object.
  return placedOverlaps(kills, constant, operation.width, placed, aliases);
}

/**
 * Add one killed interval and project it onto every assumed alias with its byte
 * displacement. The projection follows the alias graph so a forwarded parameter
 * reaches the storage its caller's caller supplied.
 */
export function addKilledInterval(
  kills: KilledFacts,
  range: KilledRange,
  placed: ReadonlyMap<string, PlacedRange>,
  aliases: AliasRelations,
): KilledFacts {
  const added: KilledRange[] = [];
  const seen = new Set<string>();
  const pending: { readonly root: string; readonly delta: number }[] = [
    { root: range.root, delta: 0 },
  ];
  let opaque = false;
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (seen.has(`${current.root}\0${current.delta}`)) continue;
    seen.add(`${current.root}\0${current.delta}`);
    // A contradictory or cyclic relation graph must not grow without bound; a
    // bounded projection falls back to the conservative opaque kill.
    if (seen.size > 256) {
      opaque = true;
      break;
    }
    added.push({
      root: current.root,
      start: range.start + current.delta,
      end: range.end + current.delta,
    });
    for (const target of aliases.get(current.root) ?? []) {
      if ("all" in target) {
        opaque = true;
        continue;
      }
      pending.push({ root: target.root, delta: current.delta + target.delta });
    }
  }
  let next = normalizeKills([...kills, ...added]);
  for (const interval of added) {
    const base = placed.get(interval.root);
    if (base === undefined) continue;
    next = addPlacedWrite(next, base.start + interval.start, interval.end - interval.start, placed);
  }
  return opaque ? unionKills(next, opaqueKill()) : next;
}

/** Follow only conversions that preserve the full address value. */
export function throughAddressConversions(
  value: string,
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

/** Per-block killed facts for one executable body. */
export interface KillFlow {
  /** Killed bytes on entry to each reachable block. */
  readonly input: ReadonlyMap<string, KilledFacts>;
  /** Killed bytes after each reachable block's operations. */
  readonly output: ReadonlyMap<string, KilledFacts>;
}

/**
 * Compute may-killed byte facts over one executable body. A join unions kills
 * because corruption on any path makes a later read unsafe. A typed store
 * removes only the bytes it completely replaces. A call may add the translated
 * kills of every possible callee.
 */
export function killFlow(
  entry: string,
  blocks: readonly SemanticBlock[],
  definitions: Definitions,
  placed: ReadonlyMap<string, PlacedRange>,
  options: KillFlowOptions = {},
): KillFlow {
  const byId = new Map(blocks.map((block) => [block.id, block] as const));
  const reachable = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (reachable.has(id)) continue;
    const block = byId.get(id);
    if (block === undefined) throw new Error(`Semantic CFG references missing block '${id}'`);
    reachable.add(id);
    if (block.terminator.kind === "jump") pending.push(block.terminator.target);
    else if (block.terminator.kind === "branch")
      pending.push(block.terminator.whenTrue, block.terminator.whenFalse);
  }
  const active = blocks.filter((block) => reachable.has(block.id));
  const predecessors = new Map(active.map((block) => [block.id, new Set<string>()] as const));
  for (const block of active) {
    const successors =
      block.terminator.kind === "jump"
        ? [block.terminator.target]
        : block.terminator.kind === "branch"
          ? [block.terminator.whenTrue, block.terminator.whenFalse]
          : [];
    for (const successor of successors) predecessors.get(successor)?.add(block.id);
  }
  const trailing: KilledFacts = Object.freeze([]);
  const output = new Map(active.map((block) => [block.id, trailing] as const));
  const input = new Map<string, KilledFacts>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of active) {
      let before: KilledFacts = block.id === entry ? (options.initial ?? trailing) : trailing;
      if (block.id !== entry) {
        for (const predecessor of predecessors.get(block.id) ?? [])
          before = unionKills(before, output.get(predecessor)!);
      }
      input.set(block.id, before);
      let after = before;
      for (const operation of block.operations) {
        if (operation.kind === "store") {
          const range = placeByteRange(operation.place, definitions);
          if (range !== null) after = subtractStore(after, range);
        } else if (operation.kind === "memory-write") {
          after = addRawWrite(
            after,
            operation,
            definitions,
            placed,
            options.aliases,
            options.opaqueAliases,
            options.boundsChecked ?? true,
          );
        } else if (operation.kind === "call" || operation.kind === "indirect-call") {
          after = options.callEffect?.(operation, after) ?? after;
        }
      }
      const previous = output.get(block.id)!;
      if (JSON.stringify(after) !== JSON.stringify(previous)) {
        output.set(block.id, after);
        changed = true;
      }
    }
  }
  return { input, output };
}
