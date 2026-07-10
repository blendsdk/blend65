/**
 * The static call graph for Blend65 semantic analysis.
 *
 * A {@link CallGraph} records which functions call which — the `functions` set
 * of all function symbols and the `edges` map from each caller to its callees.
 * It is consumed by SFA frame planning and by recursion detection: static
 * frame allocation gives every function one fixed frame, so any call cycle
 * (direct or indirect) is a language error and must be found before frames
 * are planned.
 *
 * {@link findCallCycles} implements the detection as an iterative Tarjan
 * strongly-connected-components pass — bounded, deterministic, and safe on
 * any input graph.
 */

import type { Symbol } from "./symbol.js";

/** The static caller -> callee relation over a program's functions. */
export interface CallGraph {
  /** Every function symbol in the program. */
  readonly functions: ReadonlySet<Symbol>;
  /** Caller -> set of callees. */
  readonly edges: ReadonlyMap<Symbol, ReadonlySet<Symbol>>;
  /**
   * Returns the recursion cycles in the graph, each as a list of symbols
   * starting at the cycle's anchor (its first-declared member) and following
   * call edges — see {@link findCallCycles}.
   */
  findCycles(): Symbol[][];
}

/**
 * Constructs the empty {@link CallGraph} used by the passthrough model: no
 * functions, no edges, and a `findCycles` that reports no cycles.
 *
 * @returns An empty call graph.
 */
export function emptyCallGraph(): CallGraph {
  return {
    functions: new Set(),
    edges: new Map(),
    findCycles: () => [], // the empty graph has no cycles
  };
}

/**
 * Finds every call cycle in `(functions, edges)` — an SCC of size > 1, or a
 * single function with a self-edge.
 *
 * Implementation: Tarjan's strongly-connected-components algorithm with an
 * explicit work stack (no recursion — safe on arbitrarily deep graphs) and a
 * visited bound (each node enters the stack once), so it terminates on any
 * input, cyclic or not.
 *
 * Determinism: cycles are ordered by their **anchor** — the member declared
 * first (the iteration order of `functions` is collection order, i.e.
 * program/item declaration order) — and each cycle's member list starts at
 * its anchor and follows call edges around the cycle. Callees not present in
 * `functions` are ignored.
 *
 * @param functions Every function symbol, in declaration order.
 * @param edges Caller -> callees.
 * @returns The cycles, each anchored and edge-ordered, sorted by anchor.
 */
export function findCallCycles(
  functions: ReadonlySet<Symbol>,
  edges: ReadonlyMap<Symbol, ReadonlySet<Symbol>>,
): Symbol[][] {
  // Declaration index — the anchor/sorting key.
  const declIndex = new Map<Symbol, number>();
  let i = 0;
  for (const fn of functions) declIndex.set(fn, i++);

  // Tarjan state.
  const indexOf = new Map<Symbol, number>();
  const lowlink = new Map<Symbol, number>();
  const onStack = new Set<Symbol>();
  const stack: Symbol[] = [];
  let nextIndex = 0;
  const sccs: Symbol[][] = [];

  /** One explicit DFS frame: the node and its remaining callees to visit. */
  interface Frame {
    readonly node: Symbol;
    readonly callees: Symbol[];
    next: number;
  }

  const calleesOf = (fn: Symbol): Symbol[] =>
    [...(edges.get(fn) ?? [])].filter((c) => declIndex.has(c));

  for (const root of functions) {
    if (indexOf.has(root)) continue;

    const work: Frame[] = [{ node: root, callees: calleesOf(root), next: 0 }];
    indexOf.set(root, nextIndex);
    lowlink.set(root, nextIndex);
    nextIndex++;
    stack.push(root);
    onStack.add(root);

    while (work.length > 0) {
      const frame = work[work.length - 1];
      if (frame.next < frame.callees.length) {
        const callee = frame.callees[frame.next];
        frame.next++;
        if (!indexOf.has(callee)) {
          indexOf.set(callee, nextIndex);
          lowlink.set(callee, nextIndex);
          nextIndex++;
          stack.push(callee);
          onStack.add(callee);
          work.push({ node: callee, callees: calleesOf(callee), next: 0 });
        } else if (onStack.has(callee)) {
          const low = Math.min(lowlink.get(frame.node) ?? 0, indexOf.get(callee) ?? 0);
          lowlink.set(frame.node, low);
        }
      } else {
        work.pop();
        const node = frame.node;
        if (work.length > 0) {
          const parent = work[work.length - 1].node;
          const low = Math.min(lowlink.get(parent) ?? 0, lowlink.get(node) ?? 0);
          lowlink.set(parent, low);
        }
        if (lowlink.get(node) === indexOf.get(node)) {
          // Root of an SCC: pop its members off the stack.
          const members: Symbol[] = [];
          for (;;) {
            const popped = stack.pop();
            if (popped === undefined) break;
            onStack.delete(popped);
            members.push(popped);
            if (popped === node) break;
          }
          const selfLoop = members.length === 1 && (edges.get(node)?.has(node) ?? false);
          if (members.length > 1 || selfLoop) sccs.push(members);
        }
      }
    }
  }

  // Anchor + edge-order each cycle, then sort cycles by anchor declaration.
  const cycles = sccs.map((members) => orderCycle(members, edges, declIndex));
  cycles.sort((a, b) => (declIndex.get(a[0]) ?? 0) - (declIndex.get(b[0]) ?? 0));
  return cycles;
}

/**
 * Orders one SCC's members starting at its anchor (lowest declaration index)
 * and following call edges within the SCC (first-declared callee first) so
 * the rendered path reads as the actual call chain. Bounded: each member is
 * visited once.
 */
function orderCycle(
  members: readonly Symbol[],
  edges: ReadonlyMap<Symbol, ReadonlySet<Symbol>>,
  declIndex: ReadonlyMap<Symbol, number>,
): Symbol[] {
  const inScc = new Set(members);
  const anchor = [...members].sort(
    (a, b) => (declIndex.get(a) ?? 0) - (declIndex.get(b) ?? 0),
  )[0];

  const ordered: Symbol[] = [anchor];
  const seen = new Set<Symbol>([anchor]);
  let current = anchor;
  while (ordered.length < members.length) {
    const next = [...(edges.get(current) ?? [])]
      .filter((c) => inScc.has(c) && !seen.has(c))
      .sort((a, b) => (declIndex.get(a) ?? 0) - (declIndex.get(b) ?? 0))[0];
    if (next === undefined) break; // multi-path SCC — remaining members appended below
    ordered.push(next);
    seen.add(next);
    current = next;
  }
  // Any members not on the walked chain (dense SCCs) still belong to the cycle.
  for (const m of members) {
    if (!seen.has(m)) ordered.push(m);
  }
  return ordered;
}
