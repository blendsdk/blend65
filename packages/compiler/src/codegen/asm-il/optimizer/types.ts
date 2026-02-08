/**
 * ASM-IL Optimizer Types
 *
 * Type definitions for the ASM-IL optimization pipeline.
 * Adapted from compiler-v1 to work with v2's AsmILProgram structure.
 *
 * The ASM-IL optimizer is the second stage of the two-stage optimization
 * pipeline. It operates on generated 6502 assembly (AsmILProgram) and
 * applies machine-level peephole patterns and 6502-specific optimizations.
 *
 * @module codegen/asm-il/optimizer/types
 */

import type { AsmILProgram } from '../types.js';

// ============================================================================
// Optimization Pass Interface
// ============================================================================

/**
 * Represents a single optimization pass over ASM-IL.
 *
 * Each pass implements a focused optimization strategy (e.g., flag patterns,
 * store-load elimination). Passes follow the immutable transformation pattern:
 * they return a new AsmILProgram if changes were made, or the same reference
 * if unchanged — enabling cheap convergence detection.
 *
 * **Implementation Requirements:**
 * - `name` must be unique across all registered passes
 * - `run()` must return the same reference if no changes were made
 * - `run()` must return a new object if changes were made
 * - Passes should be stateless between invocations
 *
 * @example
 * ```typescript
 * class FlagPatternsPass implements AsmOptimizationPass {
 *   readonly name = 'flag-patterns';
 *   readonly isTransform = true;
 *
 *   run(program: AsmILProgram): AsmOptimizationPassResult {
 *     // Analyze and transform instructions...
 *     return { program: optimizedProgram, changed: true, stats: { ... } };
 *   }
 * }
 * ```
 */
export interface AsmOptimizationPass {
  /** Unique name for this pass (e.g., 'flag-patterns', 'store-load') */
  readonly name: string;

  /** Whether this pass modifies the program (false for analysis-only passes) */
  readonly isTransform: boolean;

  /**
   * Run the optimization pass on an ASM-IL program.
   *
   * @param program - The program to optimize
   * @returns Result containing the (possibly optimized) program and statistics
   */
  run(program: AsmILProgram): AsmOptimizationPassResult;
}

// ============================================================================
// Pass Result
// ============================================================================

/**
 * Result from running a single optimization pass.
 *
 * Contains the transformed program and statistics about what changed.
 * The `changed` flag is critical for fixed-point iteration — when no
 * pass reports changes, the optimizer has reached a fixed point.
 */
export interface AsmOptimizationPassResult {
  /** The (possibly optimized) program */
  program: AsmILProgram;

  /** Whether any transformations were applied */
  changed: boolean;

  /** Per-pattern statistics for debugging and analysis */
  stats: AsmPassTransformStats;
}

/**
 * Detailed statistics about transformations applied by a single pass.
 *
 * Used for debugging, performance analysis, and optimization reporting.
 */
export interface AsmPassTransformStats {
  /** Number of individual patterns matched and transformed */
  patternsMatched: number;

  /** Number of instructions removed */
  instructionsRemoved: number;

  /** Number of instructions added (e.g., replacement instructions) */
  instructionsAdded: number;

  /** Estimated cycles saved (based on 6502 cycle counts) */
  estimatedCyclesSaved: number;

  /** Estimated bytes saved (based on instruction sizes) */
  estimatedBytesSaved: number;

  /** Optional debug descriptions of each transformation */
  debugInfo?: string[];
}

// ============================================================================
// Optimizer Configuration
// ============================================================================

/**
 * Configuration for the ASM-IL optimizer pass manager.
 *
 * Controls which passes run, iteration limits, and debug output.
 */
export interface AsmOptimizerConfig {
  /** Enable/disable optimization (false = pass-through) */
  enabled: boolean;

  /** List of passes to run in order */
  passes: AsmOptimizationPass[];

  /** Maximum iterations for fixed-point optimization (prevents infinite loops) */
  maxIterations: number;

  /** Enable debug logging to console */
  debug: boolean;
}

/**
 * Default configuration — pass-through mode with no passes.
 *
 * Used as the base when creating optimizer instances. Individual
 * settings are overridden by the caller.
 */
export const DEFAULT_ASM_OPTIMIZER_CONFIG: AsmOptimizerConfig = {
  enabled: false,
  passes: [],
  maxIterations: 1,
  debug: false,
};

// ============================================================================
// Optimizer Result
// ============================================================================

/**
 * Result from running the complete optimizer (all passes, all iterations).
 *
 * Contains the final optimized program and aggregate statistics across
 * all passes and iterations. Used by the compilation pipeline to report
 * optimization effectiveness.
 */
export interface AsmOptimizationResult {
  /** The optimized program */
  program: AsmILProgram;

  /** Whether any transformations were applied across all passes/iterations */
  changed: boolean;

  /** Number of fixed-point iterations performed */
  iterations: number;

  /** Per-pass aggregate statistics (accumulated across all iterations) */
  passStats: Map<string, AsmPassStatistics>;
}

/**
 * Aggregate statistics for a single optimization pass across all iterations.
 *
 * Accumulated by the pass manager as the optimizer runs.
 */
export interface AsmPassStatistics {
  /** Pass name */
  name: string;

  /** Total number of transformation rounds where this pass made changes */
  transformationRounds: number;

  /** Total patterns matched across all iterations */
  totalPatternsMatched: number;

  /** Total instructions removed across all iterations */
  totalInstructionsRemoved: number;

  /** Total instructions added across all iterations */
  totalInstructionsAdded: number;

  /** Total estimated cycles saved */
  totalCyclesSaved: number;

  /** Total estimated bytes saved */
  totalBytesSaved: number;

  /** Total execution time in milliseconds */
  timeMs: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty pass transform stats object.
 *
 * Convenience for passes that didn't change anything.
 *
 * @returns AsmPassTransformStats with all zeros
 */
export function createEmptyTransformStats(): AsmPassTransformStats {
  return {
    patternsMatched: 0,
    instructionsRemoved: 0,
    instructionsAdded: 0,
    estimatedCyclesSaved: 0,
    estimatedBytesSaved: 0,
  };
}

/**
 * Create a pass result indicating no changes were made.
 *
 * Convenience for passes that analyzed but didn't transform.
 *
 * @param program - The unchanged program (same reference returned)
 * @returns AsmOptimizationPassResult with changed=false
 */
export function createUnchangedPassResult(
  program: AsmILProgram
): AsmOptimizationPassResult {
  return {
    program,
    changed: false,
    stats: createEmptyTransformStats(),
  };
}

/**
 * Create an empty aggregate pass statistics object.
 *
 * Used by the pass manager to initialize stats tracking.
 *
 * @param name - Pass name
 * @returns Empty AsmPassStatistics
 */
export function createEmptyPassStatistics(name: string): AsmPassStatistics {
  return {
    name,
    transformationRounds: 0,
    totalPatternsMatched: 0,
    totalInstructionsRemoved: 0,
    totalInstructionsAdded: 0,
    totalCyclesSaved: 0,
    totalBytesSaved: 0,
    timeMs: 0,
  };
}

/**
 * Accumulate pass result stats into aggregate statistics.
 *
 * Called by the pass manager after each pass execution to update
 * the running totals.
 *
 * @param aggregate - The aggregate stats to update (mutated in place)
 * @param result - The pass result to accumulate from
 * @param durationMs - Execution time for this run
 */
export function accumulatePassStats(
  aggregate: AsmPassStatistics,
  result: AsmOptimizationPassResult,
  durationMs: number
): void {
  if (result.changed) {
    aggregate.transformationRounds++;
  }
  aggregate.totalPatternsMatched += result.stats.patternsMatched;
  aggregate.totalInstructionsRemoved += result.stats.instructionsRemoved;
  aggregate.totalInstructionsAdded += result.stats.instructionsAdded;
  aggregate.totalCyclesSaved += result.stats.estimatedCyclesSaved;
  aggregate.totalBytesSaved += result.stats.estimatedBytesSaved;
  aggregate.timeMs += durationMs;
}
