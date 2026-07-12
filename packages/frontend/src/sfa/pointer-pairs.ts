/**
 * Zero-page pointer-pair binding — per-parameter pair names colored onto the
 * pointer pool (spec Ch 11 §4.2/§4.3).
 *
 * Each pair-bound by-reference parameter (a `FrameVar` with `byRef: true`)
 * receives a named 2-byte pair overlaid onto the pool the ZP allocator
 * reserves — mirroring frame coloring, so sequential callees share pair
 * addresses while simultaneously-live (interfering) functions stay disjoint.
 *
 * Coloring is chain-max over the interference graph in topological
 * (caller-before-callee) order: a function's pairs start where its highest
 * already-colored interfering neighbour ends. Along any call chain the live
 * pairs form a clique, so chain-max never overlaps two live pairs — and the
 * pool's peak sizing (which sums a function with ALL its neighbours) always
 * bounds the chain maximum, so the coloring provably fits the pool.
 *
 * Imports `@blend65/core` only — never `@blend65/codegen`.
 */

import type { FunctionInfo, InterferenceGraph } from "@blend65/core";

/** One parameter's colored pair: its owner, name, and byte offset in the pool. */
export interface PairBinding {
  /** The owning function's fully-qualified name. */
  readonly functionName: string;
  /** The parameter's name. */
  readonly paramName: string;
  /** The pair's byte offset from the pointer pool's base address. */
  readonly offset: number;
}

/**
 * Colors every pair-bound by-ref parameter onto the pointer pool.
 *
 * @param fns The planned functions (pair-bound params carry `byRef: true`).
 * @param graph The interference graph over the same functions.
 * @returns The bindings plus the pool bytes the coloring actually spans.
 */
export function bindPointerPairs(
  fns: readonly FunctionInfo[],
  graph: InterferenceGraph,
): { bindings: PairBinding[]; poolBytes: number } {
  const byName = new Map(fns.map((f) => [f.name, f]));
  const pairBytes = (fn: FunctionInfo): number =>
    2 * fn.parameters.filter((p) => p.byRef).length;

  // Topological (caller-before-callee) order with a stable name tie-break;
  // any residue (defensively — cycles are rejected upstream) appends in
  // sorted order so the result stays deterministic.
  const order = topologicalOrder(fns);

  const starts = new Map<string, number>();
  const bindings: PairBinding[] = [];
  let poolBytes = 0;

  for (const name of order) {
    const fn = byName.get(name);
    if (fn === undefined) continue;
    const own = pairBytes(fn);
    if (own === 0) continue;

    // Chain-max: begin where the highest already-colored interfering
    // neighbour ends.
    let start = 0;
    for (const neighbour of graph.edges.get(name) ?? []) {
      const nStart = starts.get(neighbour);
      const nFn = byName.get(neighbour);
      if (nStart !== undefined && nFn !== undefined) {
        start = Math.max(start, nStart + pairBytes(nFn));
      }
    }
    starts.set(name, start);
    poolBytes = Math.max(poolBytes, start + own);

    let offset = start;
    for (const p of fn.parameters) {
      if (!p.byRef) continue;
      bindings.push({ functionName: name, paramName: p.name, offset });
      offset += 2;
    }
  }
  return { bindings, poolBytes };
}

/** Caller-before-callee order over the call edges, stable by name. */
function topologicalOrder(fns: readonly FunctionInfo[]): string[] {
  const names = fns.map((f) => f.name).sort();
  const callees = new Map(fns.map((f) => [f.name, f.callees]));

  const order: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (name: string): void => {
    if (state.has(name)) return; // done, or a cycle residue (rejected upstream)
    state.set(name, "visiting");
    // Post-order over callees, then prepend — callers end up first.
    for (const callee of callees.get(name) ?? []) visit(callee);
    state.set(name, "done");
    order.push(name);
  };
  for (const name of names) visit(name);
  return order.reverse();
}
