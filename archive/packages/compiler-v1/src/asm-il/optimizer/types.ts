/**
 * ASM-IL Optimizer Types
 *
 * Type definitions for the ASM-IL optimization pipeline.
 *
 * @module asm-il/optimizer/types
 */

import type { AsmModule } from '../types.js';

/**
 * Represents a single optimization pass over ASM-IL.
 * Passes can analyze and transform AsmModule.
 */
export interface AsmOptimizationPass {
  /** Unique name for this pass */
  readonly name: string;

  /** Whether this pass modifies the module (false for analysis-only) */
  readonly isTransform: boolean;

  /**
   * Run the optimization pass on an AsmModule.
   * @param module - The module to optimize
   * @returns The optimized module (may be same reference if unchanged)
   */
  run(module: AsmModule): AsmModule;
}

/**
 * Configuration for the ASM-IL optimizer.
 */
export interface AsmOptimizerConfig {
  /** Enable/disable optimization (false = pass-through) */
  enabled: boolean;

  /** List of passes to run in order */
  passes: AsmOptimizationPass[];

  /** Maximum iterations for fixed-point optimization */
  maxIterations: number;

  /** Enable debug logging */
  debug: boolean;
}

/**
 * Default configuration - pass-through mode.
 */
export const DEFAULT_ASM_OPTIMIZER_CONFIG: AsmOptimizerConfig = {
  enabled: false,
  passes: [],
  maxIterations: 1,
  debug: false,
};

/**
 * Result from running the optimizer.
 */
export interface AsmOptimizationResult {
  /** The optimized module */
  module: AsmModule;

  /** Whether any transformations were applied */
  changed: boolean;

  /** Number of iterations performed */
  iterations: number;

  /** Per-pass statistics */
  passStats: Map<string, AsmPassStatistics>;
}

/**
 * Statistics for a single optimization pass.
 */
export interface AsmPassStatistics {
  /** Pass name */
  name: string;

  /** Number of transformations applied */
  transformations: number;

  /** Execution time in milliseconds */
  timeMs: number;
}