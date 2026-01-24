/**
 * Optimize Phase
 *
 * Orchestrates optimization passes on IL modules.
 * This phase applies various optimization transformations
 * to improve code quality, size, or performance.
 *
 * **Phase Responsibilities:**
 * - Run optimization passes based on optimization level
 * - O0: No optimization (pass-through)
 * - O1+: Future optimizations
 * - Track timing for performance analysis
 *
 * @module pipeline/optimize-phase
 */

import { createOptimizerForLevel, type OptimizationResult } from '../optimizer/optimizer.js';
import { OptimizationLevel } from '../optimizer/options.js';
import type { ILModule } from '../il/module.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import type { PhaseResult } from './types.js';

/**
 * Optimize Phase - applies optimization passes to IL
 *
 * Orchestrates the optimization pipeline using the Optimizer class.
 * The optimizer:
 * 1. Validates the input IL module
 * 2. Applies optimization passes based on level
 * 3. Returns optimized module with statistics
 *
 * **Current Implementation:**
 * Only O0 (no optimization) is fully implemented.
 * Higher optimization levels will be added in future phases.
 *
 * @example
 * ```typescript
 * const optimizePhase = new OptimizePhase();
 * const result = optimizePhase.execute(ilModule, OptimizationLevel.O0);
 *
 * if (result.success) {
 *   const optimizedModule = result.data.module;
 *   console.log(`Optimizations: ${result.data.passesApplied}`);
 * }
 * ```
 */
export class OptimizePhase {
  /**
   * Run optimization passes on IL module
   *
   * Creates an Optimizer configured for the specified optimization level
   * and runs it on the IL module.
   *
   * @param ilModule - IL module to optimize
   * @param level - Optimization level (O0, O1, O2, O3, Os, Oz)
   * @returns Phase result with OptimizationResult
   */
  public execute(ilModule: ILModule, level: OptimizationLevel): PhaseResult<OptimizationResult> {
    const startTime = performance.now();
    const diagnostics: Diagnostic[] = [];

    // Create optimizer for specified level
    const optimizer = createOptimizerForLevel(level);

    // Run optimization passes
    // The optimizer handles:
    // - Module validation
    // - Pass execution
    // - Statistics collection
    const result = optimizer.optimize(ilModule);

    // Note: Current optimizer doesn't produce diagnostics
    // Future optimizations may add warnings for:
    // - Unreachable code removal
    // - Unused variable elimination
    // - Optimization opportunities missed due to constraints

    return {
      data: result,
      diagnostics,
      success: true, // Optimization currently always succeeds
      timeMs: performance.now() - startTime,
    };
  }

  /**
   * Execute with optimization level from string
   *
   * Convenience method that parses the optimization level string.
   *
   * @param ilModule - IL module to optimize
   * @param levelStr - Optimization level string ('O0', 'O1', etc.)
   * @returns Phase result with OptimizationResult
   */
  public executeWithLevel(ilModule: ILModule, levelStr: string): PhaseResult<OptimizationResult> {
    const level = this.parseOptimizationLevel(levelStr);
    return this.execute(ilModule, level);
  }

  /**
   * Parse optimization level from string
   *
   * Converts string representation to OptimizationLevel enum.
   * Defaults to O0 for unrecognized strings.
   *
   * @param levelStr - Optimization level string
   * @returns OptimizationLevel enum value
   */
  protected parseOptimizationLevel(levelStr: string | undefined): OptimizationLevel {
    switch (levelStr) {
      case 'O0':
        return OptimizationLevel.O0;
      case 'O1':
        return OptimizationLevel.O1;
      case 'O2':
        return OptimizationLevel.O2;
      case 'O3':
        return OptimizationLevel.O3;
      case 'Os':
        return OptimizationLevel.Os;
      case 'Oz':
        return OptimizationLevel.Oz;
      default:
        return OptimizationLevel.O0;
    }
  }
}