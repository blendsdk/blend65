/**
 * Code Generation Phase
 *
 * Generates ASM-IL (structured 6502 assembly) from optimized IL.
 *
 * **V2 Differences from V1:**
 * - Generates AsmILProgram (structured ASM-IL), not raw assembly text
 * - The emitter phase converts AsmILProgram → assembly text
 * - The ASM optimizer operates on AsmILProgram before emission
 *
 * @module pipeline/codegen-phase
 */

import { CodeGenerator } from '../codegen/generator/index.js';
import type { CpuTarget } from '../codegen/cpu/index.js';
import { DEFAULT_CPU_TARGET } from '../codegen/cpu/index.js';
import type { ILProgram } from '../il/structures.js';
import type { AsmILProgram } from '../codegen/asm-il/types.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import type { PhaseResult } from './types.js';

/**
 * Code Generation Phase - generates ASM-IL from IL
 *
 * Converts the IL program to a structured assembly representation
 * (AsmILProgram) that can be further optimized and then emitted
 * as assembly text.
 *
 * @example
 * ```typescript
 * const codegenPhase = new CodegenPhase();
 * const result = codegenPhase.execute(ilProgram);
 * ```
 */
export class CodegenPhase {
  /**
   * Generate ASM-IL from IL program
   *
   * Creates a CodeGenerator and translates IL instructions to
   * structured 6502 assembly (AsmILProgram).
   *
   * @param ilProgram - Optimized IL program
   * @param cpuTarget - CPU target (defaults to 6502)
   * @returns Phase result with generated AsmILProgram
   */
  public execute(
    ilProgram: ILProgram,
    cpuTarget: CpuTarget = DEFAULT_CPU_TARGET
  ): PhaseResult<AsmILProgram> {
    const startTime = performance.now();
    const diagnostics: Diagnostic[] = [];

    // Create code generator for the target CPU
    const generator = new CodeGenerator(
      ilProgram.moduleName,
      cpuTarget
    );

    // Generate ASM-IL from IL program
    const asmProgram = generator.generate(ilProgram);

    return {
      data: asmProgram,
      diagnostics,
      success: true,
      timeMs: performance.now() - startTime,
    };
  }
}
