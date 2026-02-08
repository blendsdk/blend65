/**
 * Optimize Phase
 *
 * Orchestrates IL optimization passes.
 * Applies various optimization transformations to the IL
 * before code generation.
 *
 * **Optimization Levels:**
 * - O0: No optimization (pass-through)
 * - O1: Basic (DCE, constant folding)
 * - O2: Standard (all passes, single iteration)
 * - O3: Aggressive (all passes, multiple iterations)
 * - Os: Size-optimized
 * - Oz: Minimum size
 *
 * @module pipeline/optimize-phase
 */

import { ILOptimizer } from '../optimizer/il-optimizer.js';
import type { OptimizationLevel, OptimizationOptions } from '../optimizer/options.js';
import type { ILProgram } from '../il/structures.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import type { PhaseResult } from './types.js';

/**
 * Optimize Phase - applies optimization passes to IL
 *
 * Orchestrates the optimization pipeline using the ILOptimizer.
 * The optimizer runs registered passes based on the optimization level.
 *
 * @example
 * ```typescript
 * const optimizePhase = new OptimizePhase();
 * const result = optimizePhase.execute(ilProgram, 'O0');
 * ```
 */
export class OptimizePhase {
  /**
   * Run optimization passes on IL program
   *
   * Creates an ILOptimizer configured for the specified level
   * and runs it on the IL program.
   *
   * @param ilProgram - IL program to optimize
   * @param level - Optimization level string ('O0', 'O1', etc.)
   * @returns Phase result with optimized ILProgram
   */
  public execute(ilProgram: ILProgram, level: OptimizationLevel = 'O0'): PhaseResult<ILProgram> {
    const startTime = performance.now();
    const diagnostics: Diagnostic[] = [];

    // Create optimizer with specified level
    const options: OptimizationOptions = { level };
    const optimizer = new ILOptimizer(options);

    // Run optimization passes on the program
    // The optimizer handles pass execution and statistics
    const optimizedProgram = optimizer.optimizeProgram(ilProgram);

    return {
      data: optimizedProgram,
      diagnostics,
      success: true, // Optimization currently always succeeds
      timeMs: performance.now() - startTime,
    };
  }
}
