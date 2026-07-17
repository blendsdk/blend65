/**
 * The SFA interference-graph pass (spec Ch 11 §3.4).
 *
 * Builds the undirected interference graph that drives frame sharing: two
 * functions interfere when they may be simultaneously live on the call stack, so
 * their frames must occupy disjoint memory. Three sources of interference:
 *
 *   1. **Ancestor-descendant**: if `F` can reach `D` along call edges, `F` and `D`
 *      are both live when `D` runs, so they interfere. Equivalently, every
 *      ancestor-descendant pair on a call chain interferes.
 *   2. **Always-live**: interrupt handlers (fire asynchronously), escaped/
 *      address-taken functions (conservative), and `main` (the root) interfere
 *      with *every* other node.
 *   3. **Argument window**: while a callee's arguments are being stored into
 *      its frame, a call nested in a later argument executes — the callee
 *      interferes with everything reachable from such calls (its
 *      `argWindowInterferes` projection), even mere siblings in the call tree.
 *
 * Unreachable functions are excluded entirely. The call graph is a DAG (recursion
 * is rejected upstream by the semantic analyzer); the descendant DFS uses a
 * visited set so a malformed cyclic input can never loop forever (defensive).
 *
 * Imports `@blend65/core` only — never `@blend65/codegen`. Pure and deterministic.
 */

import type { FunctionInfo, InterferenceGraph } from "@blend65/core";

/**
 * Returns `true` if `name` denotes the program entry point (`main`).
 *
 * A function is `main` if its (possibly fully-qualified) name is exactly `"main"`
 * or ends with `".main"` (i.e. `module.main`). Recorded so coloring is
 * deterministic regardless of module naming; a future semantic-analysis pass will
 * mark the resolved entry point explicitly.
 *
 * @param name A fully-qualified function name.
 * @returns `true` iff `name` is the entry point.
 */
function isMain(name: string): boolean {
  return name === "main" || name.endsWith(".main");
}

/**
 * Builds the interference graph for a set of functions.
 *
 * @param fns The functions to analyze (each carries its `callees` and flags).
 * @returns The symmetric interference graph over the reachable functions.
 */
export function buildInterferenceGraph(fns: readonly FunctionInfo[]): InterferenceGraph {
  // Step 0 — reachable set only: unreachable functions get no node.
  const reachable = fns.filter((f) => f.isReachable);
  const nodes = new Set(reachable.map((f) => f.name));
  const byName = new Map(reachable.map((f) => [f.name, f]));

  // Adjacency, seeded with an empty set per node so every node is a key.
  const edges = new Map<string, Set<string>>();
  for (const name of nodes) {
    edges.set(name, new Set());
  }

  /** Adds a symmetric, idempotent edge between two distinct reachable nodes. */
  function addEdge(a: string, b: string): void {
    if (a === b || !nodes.has(a) || !nodes.has(b)) {
      return; // self-loops and dangling endpoints are ignored.
    }
    edges.get(a)?.add(b);
    edges.get(b)?.add(a);
  }

  /**
   * Collects every node reachable from `start` along call edges, excluding
   * `start` itself. A visited set bounds the walk even on malformed cyclic input.
   */
  function descendantsOf(start: string): Set<string> {
    const out = new Set<string>();
    const stack: string[] = [start];
    const visited = new Set<string>([start]);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const fn = byName.get(cur);
      if (!fn) {
        continue;
      }
      for (const callee of fn.callees) {
        // Only reachable callees participate; dangling names are ignored.
        if (!nodes.has(callee) || visited.has(callee)) {
          continue;
        }
        visited.add(callee);
        out.add(callee);
        stack.push(callee);
      }
    }
    return out;
  }

  // Step 1 — ancestor-descendant edges.
  for (const f of reachable) {
    for (const d of descendantsOf(f.name)) {
      addEdge(f.name, d);
    }
  }

  // Step 2 — always-live nodes interfere with all others. The irq-reachable
  // tier covers a handler's whole call subtree: an interrupt can fire while
  // ANY mainline function is live, so nothing reached from a handler may
  // share frame memory with anything else (pointer pairs inherit the same
  // edges through the coloring passes).
  const alwaysLive = reachable.filter(
    (f) => f.isInterrupt || f.isEscaped || f.isIrqReachable === true || isMain(f.name),
  );
  for (const live of alwaysLive) {
    for (const other of nodes) {
      addEdge(live.name, other);
    }
  }

  // Step 3 — argument-window edges: the callee vs everything that may run
  // while its arguments are being marshalled. Self-pairs are skipped by
  // `addEdge` (a callee reached from its own argument list is rejected
  // loudly at lowering, never colored around).
  for (const f of reachable) {
    for (const other of f.argWindowInterferes) {
      addEdge(f.name, other);
    }
  }

  return { nodes, edges };
}
