/**
 * Emit Phase
 *
 * Converts the optimized ASM-IL program into final assembly text.
 * This is the last phase in the v2 compilation pipeline.
 *
 * **V2 Architecture:**
 * In v2, the pipeline is:
 * ```
 * IL → CodeGen → AsmILProgram → AsmOpt → AsmILProgram → EMIT → assembly text
 *                                                        (this)
 * ```
 *
 * @module pipeline/emit-phase
 */

import { AsmILEmitter } from '../codegen/asm-il/emitter.js';
import type { AsmILProgram } from '../codegen/asm-il/types.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import type { PhaseResult } from './types.js';

/**
 * Emit Phase - converts ASM-IL to assembly text
 *
 * Walks the AsmILProgram structure and produces formatted
 * 6502 assembly source code that can be assembled with ACME
 * or other compatible assemblers.
 *
 * @example
 * ```typescript
 * const emitPhase = new EmitPhase();
 * const result = emitPhase.execute(asmProgram);
 *
 * if (result.success) {
 *   writeFileSync('game.asm', result.data);
 * }
 * ```
 */
export class EmitPhase {
  /**
   * Emit assembly text from ASM-IL program
   *
   * Creates an AsmILEmitter and runs it on the program.
   *
   * @param asmProgram - ASM-IL program to emit
   * @returns Phase result with assembly text string
   */
  public execute(asmProgram: AsmILProgram): PhaseResult<string> {
    const startTime = performance.now();
    const diagnostics: Diagnostic[] = [];

    // Create emitter and produce assembly text
    const emitter = new AsmILEmitter();
    const assembly = emitter.emit(asmProgram);

    return {
      data: assembly,
      diagnostics,
      success: true,
      timeMs: performance.now() - startTime,
    };
  }
}
