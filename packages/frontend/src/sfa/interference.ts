/**
 * The SFA interference-graph pass (RD-05 §4.3, R10–R17; spec Ch 11 §3.4).
 *
 * Builds the undirected interference graph that drives frame sharing: two
 * functions interfere when they may be simultaneously live on the call stack, so
 * their frames must occupy disjoint memory. Two sources of interference:
 *
 *   1. **Ancestor-descendant** (R10/R11): if `F` can reach `D` along call edges,
 *      `F` and `D` are both live when `D` runs, so they interfere. Equivalently,
 *      every ancestor-descendant pair on a call chain interferes.
 *   2. **Always-live** (R13/R14/R15): interrupt handlers (fire asynchronously),
 *      escaped/address-taken functions (conservative), and `main` (the root)
 *      interfere with *every* other node.
 *
 * Unreachable functions are excluded entirely (R17). The call graph is a DAG
 * (recursion is rejected upstream by RD-04, R8); the descendant DFS uses a visited
 * set so a malformed cyclic input can never loop forever (defensive, R8/R61).
 *
 * Imports `@blend65/core` only — never `@blend65/codegen` (R15/AR-20). Pure and
 * deterministic. See plans/rd-05-sfa-frame-planner/03-02-interference-and-coloring.md.
 */

import type { FunctionInfo, InterferenceGraph } from "@blend65/core";

/**
 * Returns `true` if `name` denotes the program entry point (`main`).
 *
 * A function is `main` if its (possibly fully-qualified) name is exactly `"main"`
 * or ends with `".main"` (i.e. `module.main`). Recorded so coloring is
 * deterministic regardless of module naming; the live RD-04b adapter will mark the
 * resolved entry point explicitly later.
 *
 * @param name A fully-qualified function name.
 * @returns `true` iff `name` is the entry point.
 */
function isMain(name: string): boolean {
  return name === "main" || name.endsWith(".main");
}

/**
 * Builds the interference graph for a set of functions (R10–R17).
 *
 * @param fns The functions to analyze (each carries its `callees` and flags).
 * @returns The symmetric interference graph over the reachable functions.
 */
export function buildInterferenceGraph(fns: readonly FunctionInfo[]): InterferenceGraph {
  // Step 0 — reachable set only (R17): unreachable functions get no node.
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
      return; // self-loops and dangling endpoints are ignored (R61).
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
        // Only reachable callees participate; dangling names are ignored (R61).
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

  // Step 1 — ancestor-descendant edges (R10/R11).
  for (const f of reachable) {
    for (const d of descendantsOf(f.name)) {
      addEdge(f.name, d);
    }
  }

  // Step 2 — always-live nodes interfere with all others (R13/R14/R15).
  const alwaysLive = reachable.filter(
    (f) => f.isInterrupt || f.isEscaped || isMain(f.name),
  );
  for (const live of alwaysLive) {
    for (const other of nodes) {
      addEdge(live.name, other);
    }
  }

  return { nodes, edges };
}
