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
   * Run ASM-IL optimization passes
   *
   * Creates an AsmOptimizer and runs it on the ASM-IL program.
   *
   * @param asmProgram - ASM-IL program to optimize
   * @param config - Optional optimizer configuration
   * @returns Phase result with AsmOptimizationResult
   */
  public execute(
    asmProgram: AsmILProgram,
    config: Partial<AsmOptimizerConfig> = {}
  ): PhaseResult<AsmOptimizationResult> {
    const startTime = performance.now();
    const diagnostics: Diagnostic[] = [];

    // Create ASM optimizer with configuration
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
