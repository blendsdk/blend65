/**
 * Call Graph Analysis
 *
 * Builds a directed graph where nodes are functions and edges represent
 * function calls. Used by inter-procedural optimization passes for:
 * - Dead function elimination (unreachable from entry)
 * - Function inlining decisions (call site counting)
 * - Dependency analysis (caller/callee relationships)
 *
 * The graph is constructed by scanning IL instructions for CALL opcodes
 * and extracting the callee function name from the FunctionOperand.
 *
 * @module optimizer/analysis/call-graph
 */

import { ILOpcode } from '../../il/enums.js';
import type { FunctionOperand } from '../../il/operands.js';
import type { ILProgram } from '../../il/structures.js';

// ============================================================================
// Call Graph Class
// ============================================================================

/**
 * Call graph for inter-procedural analysis.
 *
 * Builds a directed graph where nodes are function names and edges
 * represent call relationships. Supports reachability analysis
 * (BFS from entry point) and call site counting.
 *
 * **Usage:**
 * ```typescript
 * const graph = CallGraph.build(program);
 * if (!graph.isReachable('unusedHelper')) {
 *   // Safe to remove this function
 * }
 * const callCount = graph.getCallCount('helper');
 * if (callCount === 1) {
 *   // Good candidate for single-site inlining
 * }
 * ```
 *
 * @see DeadFunctionElimPass - Uses reachability to remove dead functions
 * @see FunctionInliningPass - Uses call counts for inlining decisions
 */
export class CallGraph {
  // ═══════════════════════════════════════════════════════════════════
  // Graph Data (edges and metadata)
  // ═══════════════════════════════════════════════════════════════════

  /** Map from function name to set of functions it calls (outgoing edges) */
  protected callees: Map<string, Set<string>>;

  /** Map from function name to set of functions that call it (incoming edges) */
  protected callers: Map<string, Set<string>>;

  /**
   * Map from function name to number of call sites targeting it.
   *
   * Note: This counts call sites (instructions), not unique callers.
   * A function called twice from the same caller has callCount = 2.
   */
  protected callCounts: Map<string, number>;

  /** Entry point function name (root for reachability analysis) */
  protected entryPoint: string;

  /**
   * Cached set of reachable functions from the entry point.
   * Computed lazily on first reachability query, invalidated by rebuild().
   */
  protected reachableCache: Set<string> | null;

  // ═══════════════════════════════════════════════════════════════════
  // Constructor (protected — use static build() instead)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Creates a new CallGraph instance.
   *
   * Use `CallGraph.build(program)` to construct a call graph from
   * an ILProgram. Direct construction is protected for internal use.
   *
   * @param entryPoint - Entry point function name for reachability analysis
   */
  protected constructor(entryPoint: string) {
    this.callees = new Map();
    this.callers = new Map();
    this.callCounts = new Map();
    this.entryPoint = entryPoint;
    this.reachableCache = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Static Builder
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Build a call graph from an ILProgram.
   *
   * Algorithm:
   * 1. Initialize nodes for all functions in the program
   * 2. For each function, scan instructions for CALL opcodes
   * 3. Extract callee name from FunctionOperand
   * 4. Record caller→callee (outgoing) and callee→caller (incoming) edges
   * 5. Count call sites per callee
   *
   * The entry point is taken from `program.entryPoint` (usually 'main').
   * Exported functions and callbacks are also treated as reachable roots
   * because they may be invoked externally.
   *
   * @param program - The IL program to analyze
   * @returns A fully constructed CallGraph
   *
   * @example
   * ```typescript
   * const program = createTestILProgram([mainFunc, helperFunc]);
   * const graph = CallGraph.build(program);
   * ```
   */
  static build(program: ILProgram): CallGraph {
    const graph = new CallGraph(program.entryPoint);

    // Step 1: Initialize nodes for all functions
    for (const func of program.functions) {
      graph.callees.set(func.name, new Set());
      graph.callers.set(func.name, new Set());
      // Initialize call counts to 0 for all defined functions
      if (!graph.callCounts.has(func.name)) {
        graph.callCounts.set(func.name, 0);
      }
    }

    // Step 2-5: Scan instructions and record edges
    for (const func of program.functions) {
      for (const instr of func.instructions) {
        if (instr.opcode === ILOpcode.CALL && instr.operands.length > 0) {
          const operand = instr.operands[0];

          // CALL instructions use FunctionOperand with kind === 'function'
          if (operand.kind === 'function') {
            const callee = (operand as FunctionOperand).name;

            // Record outgoing edge: caller → callee
            graph.callees.get(func.name)?.add(callee);

            // Record incoming edge: callee → caller
            // Ensure the callee node exists (may be external/intrinsic)
            if (!graph.callers.has(callee)) {
              graph.callers.set(callee, new Set());
            }
            graph.callers.get(callee)!.add(func.name);

            // Increment call site count for the callee
            const currentCount = graph.callCounts.get(callee) ?? 0;
            graph.callCounts.set(callee, currentCount + 1);
          }
        }
      }
    }

    return graph;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Reachability Analysis
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Check if a function is reachable from the entry point.
   *
   * Uses BFS from the entry point to determine if the named function
   * can be reached through any chain of calls. Exported functions
   * and callbacks are always considered reachable since they may be
   * invoked externally.
   *
   * Results are cached after the first call. Use `rebuild()` or
   * `invalidateCache()` to force recomputation.
   *
   * @param funcName - Function name to check
   * @returns true if reachable from entry point
   *
   * @example
   * ```typescript
   * if (!graph.isReachable('unusedHelper')) {
   *   // Safe to remove
   * }
   * ```
   */
  isReachable(funcName: string): boolean {
    return this.getReachableFunctions().has(funcName);
  }

  /**
   * Get all functions reachable from the entry point.
   *
   * Performs a BFS (breadth-first search) starting from the entry point
   * function, following outgoing call edges. The entry point itself is
   * always included in the reachable set.
   *
   * Exported functions and callbacks are also included as additional
   * roots since they can be invoked externally (e.g., from interrupt
   * handlers or other modules).
   *
   * Results are cached. Subsequent calls return the cached set without
   * recomputation. Use `rebuild()` to invalidate the cache.
   *
   * @returns Set of all reachable function names
   *
   * @example
   * ```typescript
   * const reachable = graph.getReachableFunctions();
   * for (const func of program.functions) {
   *   if (!reachable.has(func.name)) {
   *     // This function is dead code
   *   }
   * }
   * ```
   */
  getReachableFunctions(): Set<string> {
    // Return cached result if available
    if (this.reachableCache !== null) {
      return this.reachableCache;
    }

    const reachable = new Set<string>();
    const worklist: string[] = [];

    // Start BFS from the entry point (if it exists in the graph)
    if (this.callees.has(this.entryPoint)) {
      worklist.push(this.entryPoint);
      reachable.add(this.entryPoint);
    }

    // BFS: process worklist until empty
    while (worklist.length > 0) {
      const current = worklist.shift()!;
      const targets = this.callees.get(current);

      if (targets) {
        for (const callee of targets) {
          if (!reachable.has(callee)) {
            reachable.add(callee);
            // Only follow edges to functions that exist in the graph
            // (external/intrinsic functions won't have outgoing edges)
            if (this.callees.has(callee)) {
              worklist.push(callee);
            }
          }
        }
      }
    }

    // Cache the result
    this.reachableCache = reachable;
    return reachable;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Query Methods
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get the number of call sites targeting a function.
   *
   * This counts individual CALL instructions, not unique callers.
   * For example, if function A calls B twice, getCallCount('B') returns 2.
   *
   * @param funcName - Function name to query
   * @returns Number of call sites (0 if function is never called)
   *
   * @example
   * ```typescript
   * const count = graph.getCallCount('helper');
   * if (count === 1) {
   *   // Single call site — good inlining candidate
   * }
   * ```
   */
  getCallCount(funcName: string): number {
    return this.callCounts.get(funcName) ?? 0;
  }

  /**
   * Get the set of functions that call the given function.
   *
   * Returns unique caller names (not call site count).
   *
   * @param funcName - Function name to query
   * @returns Set of caller function names (empty set if none)
   *
   * @example
   * ```typescript
   * const callers = graph.getCallers('render');
   * // callers might be Set { 'main', 'gameLoop' }
   * ```
   */
  getCallers(funcName: string): Set<string> {
    return this.callers.get(funcName) ?? new Set();
  }

  /**
   * Get the set of functions called by the given function.
   *
   * Returns unique callee names.
   *
   * @param funcName - Function name to query
   * @returns Set of callee function names (empty set if none)
   *
   * @example
   * ```typescript
   * const callees = graph.getCallees('main');
   * // callees might be Set { 'init', 'gameLoop' }
   * ```
   */
  getCallees(funcName: string): Set<string> {
    return this.callees.get(funcName) ?? new Set();
  }

  /**
   * Get the entry point function name.
   *
   * @returns The entry point name used for reachability analysis
   */
  getEntryPoint(): string {
    return this.entryPoint;
  }

  /**
   * Get all function names known to the call graph.
   *
   * Returns names of functions that were present in the ILProgram
   * when the graph was built.
   *
   * @returns Set of all known function names
   */
  getAllFunctions(): Set<string> {
    return new Set(this.callees.keys());
  }

  /**
   * Check if the call graph contains a function.
   *
   * @param funcName - Function name to check
   * @returns true if the function exists in the graph
   */
  hasFunction(funcName: string): boolean {
    return this.callees.has(funcName);
  }

  /**
   * Check if a function is recursive (calls itself directly).
   *
   * Only detects direct self-recursion. For mutual recursion detection,
   * use `isMutuallyRecursive()`.
   *
   * @param funcName - Function name to check
   * @returns true if the function calls itself
   *
   * @example
   * ```typescript
   * if (graph.isRecursive('fibonacci')) {
   *   // Skip inlining — would cause infinite expansion
   * }
   * ```
   */
  isRecursive(funcName: string): boolean {
    const targets = this.callees.get(funcName);
    return targets !== undefined && targets.has(funcName);
  }

  /**
   * Check if two functions are mutually recursive.
   *
   * Detects cycles between funcA and funcB (A calls B and B calls A,
   * directly or indirectly through a chain).
   *
   * @param funcA - First function name
   * @param funcB - Second function name
   * @returns true if A and B are in a cycle
   */
  isMutuallyRecursive(funcA: string, funcB: string): boolean {
    // Check if funcA can reach funcB and funcB can reach funcA
    return this.canReach(funcA, funcB) && this.canReach(funcB, funcA);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Rebuild (Post-Mutation)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Rebuild the call graph from a modified program.
   *
   * After inlining or dead function elimination modifies the program,
   * the call graph becomes stale. This method reconstructs the graph
   * from the current state of the program.
   *
   * @param program - The modified IL program to re-analyze
   *
   * @example
   * ```typescript
   * // After inlining modifies the program
   * inliningPass.run(program, options);
   * graph.rebuild(program);
   * // Graph now reflects the post-inlining call structure
   * ```
   */
  rebuild(program: ILProgram): void {
    // Clear all existing data
    this.callees.clear();
    this.callers.clear();
    this.callCounts.clear();
    this.reachableCache = null;
    this.entryPoint = program.entryPoint;

    // Rebuild using the same algorithm as build()
    for (const func of program.functions) {
      this.callees.set(func.name, new Set());
      this.callers.set(func.name, new Set());
      if (!this.callCounts.has(func.name)) {
        this.callCounts.set(func.name, 0);
      }
    }

    for (const func of program.functions) {
      for (const instr of func.instructions) {
        if (instr.opcode === ILOpcode.CALL && instr.operands.length > 0) {
          const operand = instr.operands[0];
          if (operand.kind === 'function') {
            const callee = (operand as FunctionOperand).name;

            this.callees.get(func.name)?.add(callee);

            if (!this.callers.has(callee)) {
              this.callers.set(callee, new Set());
            }
            this.callers.get(callee)!.add(func.name);

            const currentCount = this.callCounts.get(callee) ?? 0;
            this.callCounts.set(callee, currentCount + 1);
          }
        }
      }
    }
  }

  /**
   * Invalidate the reachability cache.
   *
   * Forces recomputation of reachable functions on the next
   * `isReachable()` or `getReachableFunctions()` call.
   */
  invalidateCache(): void {
    this.reachableCache = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Internal Helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Check if funcFrom can reach funcTo through any chain of calls.
   *
   * Uses BFS to find a path from funcFrom to funcTo in the call graph.
   *
   * @param funcFrom - Starting function
   * @param funcTo - Target function
   * @returns true if there is a call path from funcFrom to funcTo
   */
  protected canReach(funcFrom: string, funcTo: string): boolean {
    const visited = new Set<string>();
    const worklist: string[] = [funcFrom];
    visited.add(funcFrom);

    while (worklist.length > 0) {
      const current = worklist.shift()!;
      const targets = this.callees.get(current);

      if (targets) {
        for (const callee of targets) {
          if (callee === funcTo) {
            return true;
          }
          if (!visited.has(callee)) {
            visited.add(callee);
            if (this.callees.has(callee)) {
              worklist.push(callee);
            }
          }
        }
      }
    }

    return false;
  }
}
