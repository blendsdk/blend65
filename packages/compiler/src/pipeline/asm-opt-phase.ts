/**
 * ASM Optimization Phase
 *
 * Applies peephole optimizations to the ASM-IL (structured assembly)
 * before emission. This is the second stage of the two-stage
 * optimization pipeline.
 *
 * **Two-Stage Optimizer Pipeline:**
 * ```
 * IL → IL Optimizer → CodeGen → ASM-IL → ASM OPTIMIZER → Emitter
 *                                          (this phase)
 * ```
 *
 * @module pipeline/asm-opt-phase
 */

import { AsmOptimizer } from '../codegen/asm-il/optimizer/asm-optimizer.js';
import type { AsmOptimizerConfig, AsmOptimizationResult } from '../codegen/asm-il/optimizer/types.js';
import { OptimizationLevel, resolveOptions, isOptimizationEnabled } from '../codegen/asm-il/optimizer/options.js';
import { createPassesForLevel } from '../codegen/asm-il/optimizer/pass-factory.js';
import type { AsmILProgram } from '../codegen/asm-il/types.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import type { PhaseResult } from './types.js';

/**
 * ASM Optimization Phase - applies peephole optimizations to ASM-IL
 *
 * Runs the AsmOptimizer on the structured assembly representation
 * to apply local (peephole) optimizations before final emission.
 *
 * @example
 * ```typescript
 * const asmOptPhase = new AsmOptPhase();
 * const result = asmOptPhase.execute(asmProgram);
 * ```
 */
export class AsmOptPhase {
  /**
   * Run ASM-IL optimization passes for a given optimization level.
   *
   * Resolves the optimization level into the correct set of passes
   * using the pass factory, then runs them on the ASM-IL program.
   *
   * **Pipeline integration:**
   * The compiler calls this with the same optimization level string
   * used for IL optimization (e.g., 'O0', 'O1', 'O2', 'O3', 'Os', 'Oz').
   * The level is mapped to the ASM-IL OptimizationLevel enum (same values)
   * and used to create the appropriate passes via `createPassesForLevel()`.
   *
   * @param asmProgram - ASM-IL program to optimize
   * @param levelStr - Optimization level string (e.g., 'O0', 'O2', 'O3')
   * @returns Phase result with AsmOptimizationResult
   */
  public execute(
    asmProgram: AsmILProgram,
    levelStr: string = 'O0'
  ): PhaseResult<AsmOptimizationResult> {
    const startTime = performance.now();
    const diagnostics: Diagnostic[] = [];

    // Map the optimization level string to the ASM-IL OptimizationLevel enum.
    // Both the IL optimizer and ASM-IL optimizer use the same level strings
    // ('O0', 'O1', 'O2', etc.), so this cast is safe.
    const level = (levelStr as OptimizationLevel) || OptimizationLevel.O0;
    const enabled = isOptimizationEnabled(level);

    // Resolve level-specific options (ZP slots, max iterations)
    const options = resolveOptions({ level });

    // Create the appropriate passes for this level using the pass factory
    const passes = enabled ? createPassesForLevel(options) : [];

    // Build the optimizer config from the resolved options and passes
    const config: AsmOptimizerConfig = {
      enabled,
      passes,
      maxIterations: options.maxIterations,
      debug: false,
    };

    // Create ASM optimizer with the level-specific configuration
    const optimizer = new AsmOptimizer(config);

    // Run optimization passes on the ASM-IL program
    const result = optimizer.optimize(asmProgram);

    return {
      data: result,
      diagnostics,
      success: true, // ASM optimization currently always succeeds
      timeMs: performance.now() - startTime,
    };
  }
}
