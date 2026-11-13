import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticBlock } from "./operations.js";

/** Immutable reachability, dominance and cycle facts for one handler body. */
export interface NmiControlFacts {
  readonly dominators: ReadonlyMap<string, ReadonlySet<string>>;
  readonly successors: ReadonlyMap<string, readonly string[]>;
  readonly returnBlock: string;
  readonly cyclic: ReadonlySet<string>;
}

/**
 * Compute dominance and cycle facts for one handler body.
 *
 * The proof admits only fully reachable bodies with exactly one return and no
 * unreachable block. A retained store may not sit in a cycle because it would
 * push on every iteration, and a join must agree on the live push count.
 */
export function nmiControlFacts(
  entry: string,
  blocks: readonly SemanticBlock[],
): NmiControlFacts | null {
  const byId = new Map(blocks.map((block) => [block.id, block] as const));
  if (!byId.has(entry)) return null;
  const successors = new Map(blocks.map((block) => [block.id, semanticTargets(block)] as const));
  const predecessors = new Map(blocks.map((block) => [block.id, [] as string[]] as const));
  for (const block of blocks)
    for (const target of successors.get(block.id)!) predecessors.get(target)?.push(block.id);
  const reachable = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    pending.push(...successors.get(id)!);
  }
  if (reachable.size !== blocks.length) return null;
  const returns = blocks.filter((block) => block.terminator.kind === "return");
  if (returns.length !== 1) return null;
  const all = new Set(reachable);
  const dominators = new Map<string, ReadonlySet<string>>();
  for (const id of reachable) dominators.set(id, id === entry ? new Set([id]) : new Set(all));
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of reachable) {
      if (id === entry) continue;
      const incoming = predecessors.get(id)!;
      let next: Set<string> | null = null;
      for (const predecessor of incoming) {
        const dominatorSet = dominators.get(predecessor);
        if (dominatorSet === undefined) continue;
        if (next === null) next = new Set(dominatorSet);
        else for (const value of [...next]) if (!dominatorSet.has(value)) next.delete(value);
      }
      if (next === null) next = new Set();
      next.add(id);
      const previous = dominators.get(id)!;
      if (previous.size !== next.size || [...next].some((value) => !previous.has(value))) {
        dominators.set(id, next);
        changed = true;
      }
    }
  }
  const cyclic = new Set<string>();
  for (const start of reachable) {
    const seen = new Set<string>();
    const stack = [...successors.get(start)!];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === start) {
        cyclic.add(start);
        break;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...successors.get(id)!);
    }
  }
  return Object.freeze({ dominators, successors, returnBlock: returns[0]!.id, cyclic });
}

/** Return whether one block can reach another through one or more edges. */
export function blockReaches(
  successors: ReadonlyMap<string, readonly string[]>,
  from: string,
  to: string,
): boolean {
  const pending = [...(successors.get(from) ?? [])];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...(successors.get(id) ?? []));
  }
  return false;
}

/** One proved static push plan shared by the proof and machine lowering. */
export interface NmiStackPlan {
  /** One-based push position for each retained binding key. */
  readonly slots: ReadonlyMap<string, number>;
  /** Live pushes at each semantic block entry. */
  readonly depths: ReadonlyMap<string, number>;
  /** Total pushes, equal to the pops at the single return. */
  readonly total: number;
}

/** Successors of one semantic terminator without a second graph representation. */
function semanticTargets(block: SemanticBlock): readonly string[] {
  const terminator = block.terminator;
  if (terminator.kind === "jump") return Object.freeze([terminator.target]);
  if (terminator.kind === "branch")
    return Object.freeze([terminator.whenTrue, terminator.whenFalse]);
  return Object.freeze([]);
}

/**
 * Build the static push order, slot numbers and per-block depths.
 *
 * Every retained store must be dominance-comparable with every other one, must
 * dominate the single return and must not sit in a cycle. The total order makes
 * the push sequence path-independent, so a join always reaches a load with the
 * same number of live pushes.
 * @param entry Semantic entry block identity.
 * @param blocks Exact handler body.
 * @param retained Binding keys whose store was proved retainable.
 * @returns The static plan, or null when the shape is not provable.
 */
export function nmiStackPlan(
  entry: string,
  blocks: readonly SemanticBlock[],
  retained: ReadonlySet<string>,
): NmiStackPlan | null {
  if (retained.size === 0) return null;
  const facts = nmiControlFacts(entry, blocks);
  if (facts === null) return null;
  interface StoreSite {
    readonly key: string;
    readonly block: string;
    readonly index: number;
  }
  const stores: StoreSite[] = [];
  for (const block of blocks) {
    for (let index = 0; index < block.operations.length; index += 1) {
      const operation = block.operations[index]!;
      if (operation.kind !== "store" || operation.place.path.length !== 0) continue;
      const key = bindingIdentityKey(operation.place.root);
      if (!retained.has(key)) continue;
      stores.push({ key, block: block.id, index });
    }
  }
  if (stores.length !== retained.size) return null;
  const dominates = (left: StoreSite, right: StoreSite): boolean =>
    left.block === right.block
      ? left.index < right.index
      : facts.dominators.get(right.block)?.has(left.block) === true;
  for (let left = 0; left < stores.length; left += 1) {
    for (let right = left + 1; right < stores.length; right += 1) {
      const first = stores[left]!;
      const second = stores[right]!;
      if (!dominates(first, second) && !dominates(second, first)) return null;
    }
  }
  const order = [...stores].sort((left, right) =>
    dominates(left, right) ? -1 : dominates(right, left) ? 1 : 0,
  );
  const returnBlock = blocks.find((block) => block.id === facts.returnBlock);
  if (returnBlock === undefined) return null;
  for (const store of order) {
    if (facts.cyclic.has(store.block)) return null;
    const reachesReturn =
      store.block === facts.returnBlock
        ? store.index < returnBlock.operations.length
        : facts.dominators.get(facts.returnBlock)?.has(store.block) === true;
    if (!reachesReturn) return null;
  }
  const depths = new Map<string, number>();
  for (const block of blocks) {
    let depth = 0;
    for (const store of order) {
      if (store.block === block.id) continue;
      if (facts.dominators.get(block.id)?.has(store.block) === true) depth += 1;
    }
    depths.set(block.id, depth);
  }
  const slots = new Map(order.map((store, index) => [store.key, index + 1] as const));
  return Object.freeze({
    slots: Object.freeze(slots) as ReadonlyMap<string, number>,
    depths: Object.freeze(depths) as ReadonlyMap<string, number>,
    total: order.length,
  });
}
