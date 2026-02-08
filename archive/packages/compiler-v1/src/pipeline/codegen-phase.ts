/**
 * Code Generation Phase
 *
 * Generates target code from optimized IL.
 *
 * **Phase Responsibilities:**
 * - Generate 6502 assembly from IL via CodeGenerator
 * - Produce binary .prg files via ACME
 * - Generate source maps
 * - Create VICE label files
 *
 * @module pipeline/codegen-phase
 */

import type { ILModule } from '../il/module.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import { DiagnosticCode, DiagnosticSeverity } from '../ast/diagnostics.js';
import type { PhaseResult, CodegenResult, CodegenOptions } from './types.js';
import { CodeGenerator } from '../codegen/code-generator.js';
import type {
  CodegenOptions as InternalCodegenOptions,
  OutputFormat,
  DebugMode,
} from '../codegen/types.js';

/**
 * Code Generation Phase - generates target code from IL
 *
 * This phase converts IL to target machine code using the
 * CodeGenerator class which provides:
 * - Full 6502 instruction selection
 * - Global variable allocation (ZP, RAM, DATA, MAP)
 * - BASIC stub generation
 * - Debug info generation
 * - VICE label file generation
 *
 * @example
 * ```typescript
 * const codegenPhase = new CodegenPhase();
 * const result = codegenPhase.execute(ilModule, {
 *   target: targetConfig,
 *   format: 'prg',
 *   sourceMap: true,
 * });
 *
 * if (result.success) {
 *   writeFileSync('game.prg', result.data.binary);
 * }
 * ```
 */
export class CodegenPhase {
  /**
   * The code generator instance
   */
  protected codeGenerator: CodeGenerator;

  /**
   * Default load address for C64 BASIC programs
   */
  protected readonly DEFAULT_LOAD_ADDRESS = 0x0801;

  /**
   * Creates a new CodegenPhase
   */
  constructor() {
    this.codeGenerator = new CodeGenerator();
  }

  /**
   * Generate target code from IL module
   *
   * Uses the CodeGenerator to translate IL instructions to 6502 assembly
   * and optionally assemble to PRG binary.
   *
   * @param ilModule - Optimized IL module
   * @param options - Code generation options
   * @returns Phase result with generated code
   */
  public execute(ilModule: ILModule, options: CodegenOptions): PhaseResult<CodegenResult> {
    const startTime = performance.now();
    const diagnostics: Diagnostic[] = [];

    // Map pipeline format string to internal OutputFormat type
    const formatMap: Record<string, OutputFormat> = {
      'asm': 'asm',
      'prg': 'prg',
      'both': 'both',
      'crt': 'crt',
    };
    const format: OutputFormat = formatMap[options.format] ?? 'both';

    // Map pipeline debug string to internal DebugMode type
    const debugMap: Record<string, DebugMode> = {
      'none': 'none',
      'inline': 'inline',
      'vice': 'vice',
      'both': 'both',
    };
    const debug: DebugMode = debugMap[options.debug ?? 'none'] ?? 'none';

    // Convert pipeline options to internal codegen options
    const internalOptions: InternalCodegenOptions = {
      target: options.target,
      format,
      debug,
      sourceMap: options.sourceMap ?? false,
      basicStub: true,
      loadAddress: this.DEFAULT_LOAD_ADDRESS,
    };

    // Use the real CodeGenerator
    const codegenResult = this.codeGenerator.generate(ilModule, internalOptions);

    // Convert warnings to diagnostics
    // CodeGenerator returns CodegenWarning[] with message and optional location
    for (const warning of codegenResult.warnings ?? []) {
      diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH, // Generic code for codegen warnings
        severity: DiagnosticSeverity.WARNING,
        message: warning.message,
        location: warning.location ?? {
          // Fallback to module location if no specific location provided
          file: ilModule.name,
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 1, offset: 0 },
        },
      });
    }

    // Only include binary if CodeGenerator actually produced one (ACME assembled successfully)
    // If ACME is not available, binary will be undefined and no .prg file should be written
    const result: CodegenResult = {
      assembly: codegenResult.assembly,
      binary: codegenResult.binary,
      // Note: sourceMap format differs - pipeline uses SourceMap, codegen uses SourceMapEntry[]
      // For now, we omit sourceMap until proper conversion is implemented
      sourceMap: undefined,
      viceLabels: codegenResult.viceLabels,
    };

    return {
      data: result,
      diagnostics,
      success: true,
      timeMs: performance.now() - startTime,
    };
  }

}