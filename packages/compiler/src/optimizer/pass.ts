/**
 * Optimization Pass Interface
 *
 * Defines the contract for optimization passes and their results.
 * Each pass implements a specific optimization transformation.
 *
 * **Pass Types:**
 * - Transform passes: Modify IL instructions (DCE, constant folding, etc.)
 * - Analysis passes: Compute information without modifying (future use)
 *
 * **Pass Lifecycle:**
 * 1. PassManager orders passes by dependencies
 * 2. Each pass runs on the ILFunction
 * 3. Pass returns PassResult indicating changes
 * 4. Iterative levels may re-run passes if changes occurred
 *
 * @module optimizer/pass
 */

import type { ILFunction } from '../il/structures.js';
import type { OptimizationOptions } from './options.js';

// ============================================================================
// Pass Result
// ============================================================================

/**
 * Result returned by an optimization pass.
 *
 * Contains statistics about what the pass did and whether it made changes.
 * Used by PassManager to track optimization effectiveness and decide
 * whether to iterate.
 *
 * @example
 * ```typescript
 * // DCE pass removed 3 dead stores
 * const result: PassResult = {
 *   modified: true,
 *   instructionsRemoved: 3,
 *   instructionsAdded: 0,
 *   debugInfo: ['Removed dead store at index 5', ...],
 * };
 * ```
 */
export interface PassResult {
  /**
   * Was any modification made to the function?
   *
   * true if the pass changed any instructions.
   * Used to determine if iterative optimization should continue.
   */
  modified: boolean;

  /**
   * Number of instructions removed by this pass.
   *
   * Includes deleted instructions and combined instructions.
   * @default 0
   */
  instructionsRemoved: number;

  /**
   * Number of instructions added by this pass.
   *
   * Includes new instructions and expanded instructions.
   * @default 0
   */
  instructionsAdded: number;

  /**
   * Optional debug information.
   *
   * When options.debug is true, passes should populate this
   * with human-readable descriptions of transformations.
   */
  debugInfo?: string[];
}

// ============================================================================
// Optimization Pass Interface
// ============================================================================

/**
 * Interface for optimization passes.
 *
 * All optimization passes must implement this interface.
 * Passes are registered with the PassManager and run in dependency order.
 *
 * **Implementation Requirements:**
 * - `name` must be unique and match the name used in LEVEL_PASSES
 * - `dependencies` must list passes that must run before this one
 * - `run` must be pure (no global state mutation)
 * - `run` may mutate func.instructions in place
 *
 * @example
 * ```typescript
 * class DCEPass implements OptimizationPass {
 *   name = 'dce';
 *   dependencies = []; // No dependencies
 *
 *   run(func: ILFunction, options: OptimizationOptions): PassResult {
 *     // Remove dead code
 *     const removed = this.removeDeadStores(func);
 *     return {
 *       modified: removed > 0,
 *       instructionsRemoved: removed,
 *       instructionsAdded: 0,
 *     };
 *   }
 * }
 * ```
 */
export interface OptimizationPass {
  /**
   * Unique pass name.
   *
   * Must match the name used in options (e.g., 'dce', 'constant-fold').
   * Used for dependency resolution and debugging.
   */
  readonly name: string;

  /**
   * Pass dependencies.
   *
   * List of pass names that must run before this pass.
   * PassManager uses this for topological ordering.
   *
   * @example
   * ```typescript
   * // Copy propagation depends on constant propagation
   * dependencies = ['constant-prop'];
   * ```
   */
  readonly dependencies: string[];

  /**
   * Run the optimization pass on a function.
   *
   * May modify func.instructions in place.
   * Should respect options.debug for logging.
   *
   * @param func - The IL function to optimize (may be modified)
   * @param options - Optimization options
   * @returns Result with statistics and modification flag
   */
  run(func: ILFunction, options: OptimizationOptions): PassResult;
}

// ============================================================================
// Pass Statistics
// ============================================================================

/**
 * Statistics for a single pass execution.
 *
 * Recorded by PassManager for debugging and optimization analysis.
 *
 * @example
 * ```typescript
 * const stat: PassStats = {
 *   pass: 'dce',
 *   iteration: 1,
 *   instructionsBefore: 50,
 *   instructionsAfter: 47,
 *   modified: true,
 *   durationMs: 2.5,
 * };
 * ```
 */
export interface PassStats {
  /** Pass name */
  pass: string;

  /** Iteration number (1-based, for iterative levels) */
  iteration: number;

  /** Instruction count before pass ran */
  instructionsBefore: number;

  /** Instruction count after pass ran */
  instructionsAfter: number;

  /** Whether pass made any modifications */
  modified: boolean;

  /** Pass execution time in milliseconds (optional) */
  durationMs?: number;
}

// ============================================================================
// Optimization Result
// ============================================================================

/**
 * Overall result from running all optimization passes.
 *
 * Returned by PassManager.optimize() with aggregate statistics.
 *
 * @example
 * ```typescript
 * const result = passManager.optimize(func);
 * if (result.modified) {
 *   console.log(`Optimized in ${result.totalIterations} iterations`);
 *   console.log(`Removed ${result.totalInstructionsRemoved} instructions`);
 * }
 * ```
 */
export interface OptimizationResult {
  /** Whether any pass made modifications */
  modified: boolean;

  /** Statistics for each pass execution */
  stats: PassStats[];

  /** Total iterations performed (for iterative levels) */
  totalIterations: number;

  /** Total instructions removed across all passes */
  totalInstructionsRemoved: number;

  /** Total instructions added across all passes */
  totalInstructionsAdded: number;

  /** Total optimization time in milliseconds */
  totalDurationMs: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty PassResult indicating no modifications.
 *
 * Convenience function for passes that don't modify anything.
 *
 * @returns PassResult with modified=false and zero counts
 *
 * @example
 * ```typescript
 * if (nothingToOptimize) {
 *   return createEmptyResult();
 * }
 * ```
 */
export function createEmptyResult(): PassResult {
  return {
    modified: false,
    instructionsRemoved: 0,
    instructionsAdded: 0,
  };
}

/**
 * Create a PassResult for a transformation.
 *
 * Convenience function for creating result with modifications.
 *
 * @param removed - Number of instructions removed
 * @param added - Number of instructions added
 * @param debugInfo - Optional debug messages
 * @returns PassResult with appropriate values
 *
 * @example
 * ```typescript
 * return createResult(3, 0, ['Removed 3 dead stores']);
 * ```
 */
export function createResult(
  removed: number,
  added: number,
  debugInfo?: string[]
): PassResult {
  return {
    modified: removed > 0 || added > 0,
    instructionsRemoved: removed,
    instructionsAdded: added,
    debugInfo,
  };
}

/**
 * Merge multiple PassResults into one.
 *
 * Useful when a pass has multiple sub-transformations.
 *
 * @param results - Array of PassResults to merge
 * @returns Combined PassResult
 *
 * @example
 * ```typescript
 * const combined = mergeResults([
 *   removeDeadStores(func),
 *   removeUnreachableCode(func),
 * ]);
 * ```
 */
export function mergeResults(results: PassResult[]): PassResult {
  const debugInfo: string[] = [];

  let modified = false;
  let removed = 0;
  let added = 0;

  for (const result of results) {
    if (result.modified) {
      modified = true;
    }
    removed += result.instructionsRemoved;
    added += result.instructionsAdded;
    if (result.debugInfo) {
      debugInfo.push(...result.debugInfo);
    }
  }

  return {
    modified,
    instructionsRemoved: removed,
    instructionsAdded: added,
    debugInfo: debugInfo.length > 0 ? debugInfo : undefined,
  };
}