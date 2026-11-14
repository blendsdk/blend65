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

/** One value definition retained for constant index resolution. */
export type Definitions = ReadonlyMap<string, SemanticOperation>;

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
    const bound = indexUpperBound(step.value, definitions);
    const count = bound === null ? type.length : Math.min(type.length, bound + 1);
    return Array.from({ length: count }, (_, element) =>
      walk(type.element, start + element * stride, rest),
    ).flat();
  };
  return walk(place.rootType, 0, place.path);
}

/** A proved upper bound for one index value, or null when it is unknown. */
export function indexUpperBound(value: string, definitions: Definitions): number | null {
  const operation = definitions.get(value);
  if (operation?.kind === "constant")
    return typeof operation.value === "boolean"
      ? operation.value
        ? 1
        : 0
      : Number(operation.value);
  if (operation?.kind === "convert") return indexUpperBound(operation.operand, definitions);
  if (operation?.kind === "merge")
    return operation.incoming.reduce<number | null>((maximum, incoming) => {
      const bound = indexUpperBound(incoming.value, definitions);
      if (bound === null) return null;
      return maximum === null ? bound : Math.max(maximum, bound);
    }, null);
  if (operation?.kind !== "binary") return null;
  const right = constantValue(definitions.get(operation.right), definitions);
  if (operation.operator === "&" && right !== null) return right;
  if (operation.operator === "%" && right !== null && right > 0) return right - 1;
  return null;
}

/** Whether every runtime index in the place is proved inside its array. */
export function allDynamicIndicesBounded(place: SemanticPlace, definitions: Definitions): boolean {
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
      const bound = indexUpperBound(step.value, definitions);
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

/** Whether a place interval overlaps any killed byte. */
export function rangeIsKilled(kills: KilledFacts, range: KilledRange): boolean {
  return kills.some(
    (killed) => killed.root === range.root && killed.start < range.end && range.start < killed.end,
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

/** Add one raw write's byte range to the killed facts. */
export function addRawWrite(
  kills: KilledFacts,
  operation: Extract<SemanticOperation, { readonly kind: "memory-write" }>,
  definitions: Definitions,
  placed: ReadonlyMap<string, PlacedRange>,
): KilledFacts {
  const address = throughAddressConversions(operation.address, definitions);
  if (address?.kind === "place-address") {
    const range = placeByteRange(address.place, definitions);
    if (range === null) return kills;
    let next = normalizeKills([
      ...kills,
      { root: range.root, start: range.start, end: range.start + operation.width },
    ]);
    // A placed root has a proved absolute address, so the same write can also
    // overlap an adjacent placed object.
    const placedRoot = placed.get(range.root);
    if (placedRoot !== undefined)
      next = addPlacedWrite(next, placedRoot.start + range.start, operation.width, placed);
    return next;
  }
  const constant = constantValue(address, definitions);
  return constant === null ? kills : addPlacedWrite(kills, constant, operation.width, placed);
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
 * removes only the bytes it completely replaces.
 */
export function killFlow(
  entry: string,
  blocks: readonly SemanticBlock[],
  definitions: Definitions,
  placed: ReadonlyMap<string, PlacedRange>,
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
  const output = new Map(
    active.map((block) => [block.id, Object.freeze([]) as KilledFacts] as const),
  );
  const input = new Map<string, KilledFacts>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of active) {
      let before: KilledFacts = Object.freeze([]);
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
          after = addRawWrite(after, operation, definitions, placed);
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
