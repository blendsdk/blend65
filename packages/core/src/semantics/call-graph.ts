/**
 * The static call graph for Blend65 semantic analysis.
 *
 * A {@link CallGraph} records which functions call which — the `functions` set
 * of all function symbols and the `edges` map from each caller to its callees.
 * It is consumed by SFA frame planning and by recursion detection.
 *
 * Only the empty graph is currently built (via {@link emptyCallGraph}); real
 * edge construction and cycle detection are not implemented yet.
 */

import type { Symbol } from "./symbol.js";

/** The static caller -> callee relation over a program's functions. */
export interface CallGraph {
  /** Every function symbol in the program. */
  readonly functions: ReadonlySet<Symbol>;
  /** Caller -> set of callees. */
  readonly edges: ReadonlyMap<Symbol, ReadonlySet<Symbol>>;
  /**
   * Returns the recursion cycles in the graph, each as a list of symbols.
   *
   * Cycle (recursion) detection is not implemented yet; this always returns no
   * cycles, and E10174 is not emitted. Passthrough: returns `[]` (the empty
   * graph has no cycles).
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
    findCycles: () => [], // Recursion detection is not implemented yet
  };
}
