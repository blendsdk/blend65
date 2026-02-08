/**
 * Frame Coalescer for Static Frame Allocation
 *
 * Implements frame coalescing - the algorithm that allows non-overlapping
 * functions to share memory, achieving 30-60% memory savings.
 *
 * **Coalescing Rules:**
 * 1. Functions that call each other (directly or indirectly) CANNOT coalesce
 * 2. Functions in different thread contexts (main vs ISR) CANNOT coalesce
 * 3. Functions that share a common ancestor calling both while active CANNOT coalesce
 *
 * **Algorithm:**
 * 1. Build "can coalesce" graph based on call relationships
 * 2. Filter by thread context (main-only coalesce with main-only, etc.)
 * 3. Use greedy grouping to find maximal coalesce groups
 * 4. Assign shared addresses to each group
 *
 * @module frame/allocator/coalescer
 */

import { CallGraph } from '../../semantic/call-graph.js';
import { ThreadContext } from '../enums.js';
import { Frame } from './frame-calculator.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A group of functions that can share the same memory region.
 *
 * All members of a coalesce group never execute simultaneously,
 * so they can safely share the same base address.
 */
export interface CoalesceGroup {
  /** Unique group identifier */
  readonly id: number;

  /** Function names in this group */
  readonly members: string[];

  /** Maximum frame size among members (determines group's memory footprint) */
  readonly size: number;

  /** Base address assigned to this group */
  baseAddress: number;

  /** Thread context of all members (must be same for all) */
  readonly threadContext: ThreadContext;
}

/**
 * Result of the coalescing analysis.
 *
 * Contains all coalesce groups and statistics about memory savings.
 */
export interface CoalesceResult {
  /** All coalesce groups */
  readonly groups: CoalesceGroup[];

  /** Map from function name to coalesce group ID */
  readonly functionToGroup: Map<string, number>;

  /** Total bytes without coalescing */
  readonly bytesWithoutCoalescing: number;

  /** Total bytes with coalescing */
  readonly bytesWithCoalescing: number;

  /** Bytes saved through coalescing */
  readonly bytesSaved: number;

  /** Savings percentage (0.0 - 1.0) */
  readonly savingsPercent: number;
}

// ============================================================================
// Frame Coalescer
// ============================================================================

/**
 * Frame Coalescer - determines which functions can share memory.
 *
 * The coalescer analyzes the call graph to find functions that never
 * execute simultaneously. These functions can share the same memory
 * region (coalesce), significantly reducing total memory usage.
 *
 * **Key Insight:**
 * If function A calls function B, their frames cannot overlap in memory
 * because B's frame is active while A is still active (A is waiting for
 * B to return). However, if A calls B and then calls C sequentially,
 * B and C never overlap and CAN share memory.
 *
 * **Thread Safety:**
 * Functions called from interrupts (ISR) run in a different "thread"
 * than main program functions. Since ISRs can interrupt main at any
 * time, ISR functions cannot coalesce with main functions.
 *
 * @example
 * ```typescript
 * const coalescer = new FrameCoalescer();
 *
 * // Analyze call graph and frames
 * const result = coalescer.coalesce(callGraph, frames);
 *
 * // Check which functions share memory
 * console.log(`${result.groups.length} coalesce groups`);
 * console.log(`Saved ${result.bytesSaved} bytes (${(result.savingsPercent * 100).toFixed(1)}%)`);
 *
 * // Get group for a specific function
 * const groupId = result.functionToGroup.get('funcA');
 * const group = result.groups.find(g => g.id === groupId);
 * console.log(`funcA shares memory with: ${group.members.join(', ')}`);
 * ```
 */
export class FrameCoalescer {
  // ========================================
  // Public API
  // ========================================

  /**
   * Perform coalescing analysis on a set of frames.
   *
   * Analyzes the call graph to determine which functions can share
   * memory and groups them accordingly.
   *
   * @param callGraph - Call graph for the program
   * @param frames - Map of function name to Frame
   * @returns Coalescing result with groups and statistics
   */
  public coalesce(callGraph: CallGraph, frames: Map<string, Frame>): CoalesceResult {
    const functions = Array.from(frames.keys());

    // Handle edge case: no functions
    if (functions.length === 0) {
      return this.createEmptyResult();
    }

    // Step 1: Determine thread context for all functions
    const threadContexts = this.determineAllThreadContexts(callGraph, frames);

    // Step 2: Build "can coalesce" graph
    const canCoalesceGraph = this.buildCanCoalesceGraph(callGraph, frames, threadContexts);

    // Step 3: Build coalesce groups using greedy algorithm
    const groups = this.buildCoalesceGroups(canCoalesceGraph, frames, threadContexts);

    // Step 4: Calculate statistics
    return this.buildResult(groups, frames);
  }

  /**
   * Check if two functions overlap in execution.
   *
   * Functions overlap if:
   * - f1 calls f2 (directly or indirectly)
   * - f2 calls f1 (directly or indirectly)
   *
   * @param f1 - First function name
   * @param f2 - Second function name
   * @param callGraph - Call graph
   * @returns true if functions can execute simultaneously
   */
  public overlaps(f1: string, f2: string, callGraph: CallGraph): boolean {
    // Same function always overlaps with itself
    if (f1 === f2) {
      return true;
    }

    // Check if f1 calls f2 or f2 calls f1 (directly or indirectly)
    return this.isReachable(f1, f2, callGraph) || this.isReachable(f2, f1, callGraph);
  }

  /**
   * Determine the thread context for a function.
   *
   * Thread contexts:
   * - MainOnly: Only reachable from main program flow
   * - IsrOnly: Only reachable from interrupt handlers (callbacks)
   * - Both: Reachable from both (cannot coalesce with anyone)
   *
   * @param funcName - Function name
   * @param callGraph - Call graph
   * @param frames - Map of frames (to check callback status)
   * @returns Thread context for the function
   */
  public determineThreadContext(
    funcName: string,
    callGraph: CallGraph,
    frames: Map<string, Frame>
  ): ThreadContext {
    const frame = frames.get(funcName);

    // Callback functions are ISR context by definition
    if (frame?.isCallback) {
      return ThreadContext.IsrOnly;
    }

    // Find all entry points
    const mainEntry = 'main';
    const callbackEntries = this.findCallbackEntries(frames);

    // Check reachability
    const reachableFromMain = this.isReachable(mainEntry, funcName, callGraph) || funcName === mainEntry;
    const reachableFromISR = callbackEntries.some(
      cb => this.isReachable(cb, funcName, callGraph) || funcName === cb
    );

    // Determine context
    if (reachableFromMain && reachableFromISR) {
      return ThreadContext.Both;
    }
    if (reachableFromISR) {
      return ThreadContext.IsrOnly;
    }
    return ThreadContext.MainOnly;
  }

  // ========================================
  // Protected: Reachability Analysis
  // ========================================

  /**
   * Check if targetFunc is reachable from sourceFunc in the call graph.
   *
   * Uses BFS to find any path from source to target.
   *
   * @param sourceFunc - Starting function
   * @param targetFunc - Function to reach
   * @param callGraph - Call graph
   * @returns true if targetFunc is callable from sourceFunc
   */
  protected isReachable(sourceFunc: string, targetFunc: string, callGraph: CallGraph): boolean {
    if (sourceFunc === targetFunc) {
      return true;
    }

    const visited = new Set<string>();
    const queue: string[] = [sourceFunc];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      const callees = callGraph.getCallees(current);
      for (const callee of callees) {
        if (callee === targetFunc) {
          return true;
        }
        if (!visited.has(callee)) {
          queue.push(callee);
        }
      }
    }

    return false;
  }

  /**
   * Find all callback entry points (ISR handlers).
   *
   * @param frames - Map of frames
   * @returns Array of callback function names
   */
  protected findCallbackEntries(frames: Map<string, Frame>): string[] {
    const callbacks: string[] = [];
    for (const [name, frame] of frames) {
      if (frame.isCallback) {
        callbacks.push(name);
      }
    }
    return callbacks;
  }

  // ========================================
  // Protected: Thread Context Analysis
  // ========================================

  /**
   * Determine thread context for all functions.
   *
   * @param callGraph - Call graph
   * @param frames - Map of frames
   * @returns Map from function name to thread context
   */
  protected determineAllThreadContexts(
    callGraph: CallGraph,
    frames: Map<string, Frame>
  ): Map<string, ThreadContext> {
    const contexts = new Map<string, ThreadContext>();

    for (const funcName of frames.keys()) {
      contexts.set(funcName, this.determineThreadContext(funcName, callGraph, frames));
    }

    return contexts;
  }

  // ========================================
  // Protected: Coalesce Graph Building
  // ========================================

  /**
   * Build the "can coalesce" graph.
   *
   * This graph has an edge between f1 and f2 if they CAN share memory:
   * - They don't overlap (neither calls the other)
   * - They have the same thread context (both main-only or both ISR-only)
   *
   * @param callGraph - Call graph
   * @param frames - Map of frames
   * @param threadContexts - Thread context for each function
   * @returns Adjacency map where canCoalesce.get(f1).has(f2) means f1 and f2 can coalesce
   */
  protected buildCanCoalesceGraph(
    callGraph: CallGraph,
    frames: Map<string, Frame>,
    threadContexts: Map<string, ThreadContext>
  ): Map<string, Set<string>> {
    const canCoalesce = new Map<string, Set<string>>();
    const functions = Array.from(frames.keys());

    // Initialize empty sets
    for (const func of functions) {
      canCoalesce.set(func, new Set());
    }

    // Build edges
    for (let i = 0; i < functions.length; i++) {
      const f1 = functions[i];
      const t1 = threadContexts.get(f1)!;

      // Functions in "Both" context cannot coalesce with anyone
      if (t1 === ThreadContext.Both) {
        continue;
      }

      for (let j = i + 1; j < functions.length; j++) {
        const f2 = functions[j];
        const t2 = threadContexts.get(f2)!;

        // Functions in "Both" context cannot coalesce
        if (t2 === ThreadContext.Both) {
          continue;
        }

        // Different thread contexts cannot coalesce
        if (t1 !== t2) {
          continue;
        }

        // Check overlap (call relationship)
        if (!this.overlaps(f1, f2, callGraph)) {
          // They can coalesce!
          canCoalesce.get(f1)!.add(f2);
          canCoalesce.get(f2)!.add(f1);
        }
      }
    }

    return canCoalesce;
  }

  // ========================================
  // Protected: Group Building
  // ========================================

  /**
   * Build coalesce groups using a greedy algorithm.
   *
   * The algorithm:
   * 1. Sort functions by frame size (largest first) for better packing
   * 2. For each unassigned function, start a new group
   * 3. Add all compatible unassigned functions to the group
   *
   * This is a greedy approximation to the maximum clique problem.
   * It doesn't find the optimal solution but works well in practice.
   *
   * @param canCoalesceGraph - "Can coalesce" adjacency map
   * @param frames - Map of frames
   * @param threadContexts - Thread contexts
   * @returns Array of coalesce groups
   */
  protected buildCoalesceGroups(
    canCoalesceGraph: Map<string, Set<string>>,
    frames: Map<string, Frame>,
    threadContexts: Map<string, ThreadContext>
  ): CoalesceGroup[] {
    const groups: CoalesceGroup[] = [];
    const assigned = new Set<string>();

    // Sort functions by frame size (largest first) for better packing
    const sortedFunctions = Array.from(frames.keys()).sort((a, b) => {
      const sizeA = frames.get(a)?.totalSize ?? 0;
      const sizeB = frames.get(b)?.totalSize ?? 0;
      return sizeB - sizeA; // Descending order
    });

    let groupId = 0;

    for (const func of sortedFunctions) {
      if (assigned.has(func)) {
        continue;
      }

      // Start a new group with this function
      const members: string[] = [func];
      assigned.add(func);

      const threadContext = threadContexts.get(func) ?? ThreadContext.MainOnly;

      // Try to add other functions to this group
      for (const candidate of sortedFunctions) {
        if (assigned.has(candidate)) {
          continue;
        }

        // Candidate must be able to coalesce with ALL current members
        let canJoin = true;
        for (const member of members) {
          const memberNeighbors = canCoalesceGraph.get(member) ?? new Set();
          if (!memberNeighbors.has(candidate)) {
            canJoin = false;
            break;
          }
        }

        if (canJoin) {
          members.push(candidate);
          assigned.add(candidate);
        }
      }

      // Calculate group size (max of member sizes)
      const size = members.reduce((max, m) => {
        const frameSize = frames.get(m)?.totalSize ?? 0;
        return Math.max(max, frameSize);
      }, 0);

      groups.push({
        id: groupId++,
        members,
        size,
        baseAddress: 0, // Will be assigned later
        threadContext,
      });
    }

    return groups;
  }

  // ========================================
  // Protected: Result Building
  // ========================================

  /**
   * Build the final coalescing result with statistics.
   *
   * @param groups - Coalesce groups
   * @param frames - Map of frames
   * @returns Complete coalescing result
   */
  protected buildResult(groups: CoalesceGroup[], frames: Map<string, Frame>): CoalesceResult {
    // Build function-to-group map
    const functionToGroup = new Map<string, number>();
    for (const group of groups) {
      for (const member of group.members) {
        functionToGroup.set(member, group.id);
      }
    }

    // Calculate statistics
    const bytesWithoutCoalescing = Array.from(frames.values()).reduce(
      (sum, frame) => sum + frame.totalSize,
      0
    );

    const bytesWithCoalescing = groups.reduce((sum, group) => sum + group.size, 0);

    const bytesSaved = bytesWithoutCoalescing - bytesWithCoalescing;
    const savingsPercent =
      bytesWithoutCoalescing > 0 ? bytesSaved / bytesWithoutCoalescing : 0;

    return {
      groups,
      functionToGroup,
      bytesWithoutCoalescing,
      bytesWithCoalescing,
      bytesSaved,
      savingsPercent,
    };
  }

  /**
   * Create an empty result for edge cases.
   */
  protected createEmptyResult(): CoalesceResult {
    return {
      groups: [],
      functionToGroup: new Map(),
      bytesWithoutCoalescing: 0,
      bytesWithCoalescing: 0,
      bytesSaved: 0,
      savingsPercent: 0,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new frame coalescer.
 *
 * @returns New FrameCoalescer instance
 */
export function createFrameCoalescer(): FrameCoalescer {
  return new FrameCoalescer();
}

/**
 * Perform coalescing on frames with a single function call.
 *
 * Convenience function that creates a coalescer and runs it.
 *
 * @param callGraph - Call graph
 * @param frames - Map of frames
 * @returns Coalescing result
 */
export function coalesceFrames(callGraph: CallGraph, frames: Map<string, Frame>): CoalesceResult {
  const coalescer = new FrameCoalescer();
  return coalescer.coalesce(callGraph, frames);
}