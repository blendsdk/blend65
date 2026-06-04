/**
 * The static call graph for Blend65 semantic analysis (RD-04 §4.8, R84–R86).
 *
 * A {@link CallGraph} records which functions call which — the `functions` set
 * of all function symbols and the `edges` map from each caller to its callees.
 * It is consumed by SFA frame planning (RD-05) and by recursion detection.
 *
 * PASSTHROUGH NOTE (RD-04 plan, D2): the skeleton builds only the empty graph
 * (via {@link emptyCallGraph}); real edge construction and cycle detection are
 * DEFERRED(RD-04-checker).
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
   * DEFERRED(RD-04-checker): R86 — cycle (recursion) detection emitting E10174.
   * Passthrough: returns `[]` (the empty graph has no cycles).
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
    findCycles: () => [], // DEFERRED(RD-04-checker): R86 recursion detection
  };
}
