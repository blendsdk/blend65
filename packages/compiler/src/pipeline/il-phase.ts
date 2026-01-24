/**
 * IL Phase
 *
 * Orchestrates intermediate language generation from AST.
 * This phase converts the analyzed AST into IL (Intermediate Language)
 * which is a lower-level representation suitable for optimization
 * and code generation.
 *
 * **Phase Responsibilities:**
 * - Generate IL from AST using ILGenerator
 * - Apply SSA construction (if enabled)
 * - Collect generation errors as diagnostics
 * - Track timing for performance analysis
 *
 * @module pipeline/il-phase
 */

import { ILGenerator, type ILGeneratorOptions } from '../il/generator/index.js';
import { ILModule } from '../il/module.js';
import type { Program } from '../ast/nodes.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import { DiagnosticCode, DiagnosticSeverity } from '../ast/diagnostics.js';
import type { MultiModuleAnalysisResult } from '../semantic/analyzer.js';
import type { TargetConfig } from '../target/config.js';
import type { PhaseResult } from './types.js';

/**
 * IL Phase - generates IL from analyzed AST
 *
 * Orchestrates the IL generation pipeline using the ILGenerator.
 * The generator:
 * 1. Processes global declarations (variables, @map, functions)
 * 2. Generates IL for function bodies
 * 3. Optionally converts to SSA form
 *
 * **Note:** Currently generates IL for a single module.
 * Multi-module IL generation will be added in a future phase.
 *
 * @example
 * ```typescript
 * const ilPhase = new ILPhase();
 * const result = ilPhase.execute(semanticResult, programs, targetConfig);
 *
 * if (result.success) {
 *   const ilModule = result.data;
 *   console.log(ilModule.toDetailedString());
 * }
 * ```
 */
export class ILPhase {
  /**
   * Default IL generator options
   *
   * SSA is enabled by default for optimization opportunities.
   */
  protected readonly defaultOptions: ILGeneratorOptions = {
    enableSSA: true,
    verifySSA: true,
    collectSSAStats: false,
  };

  /**
   * Generate IL from analyzed AST
   *
   * Creates an ILGenerator with the symbol table from semantic analysis
   * and generates IL for the first program (entry module).
   *
   * @param semanticResult - Result from semantic analysis
   * @param programs - Array of parsed Program ASTs
   * @param targetConfig - Target platform configuration
   * @param options - Optional IL generator options
   * @returns Phase result with generated ILModule
   */
  public execute(
    semanticResult: MultiModuleAnalysisResult,
    programs: Program[],
    targetConfig: TargetConfig,
    options?: Partial<ILGeneratorOptions>
  ): PhaseResult<ILModule> {
    const startTime = performance.now();
    const diagnostics: Diagnostic[] = [];

    // Merge options with defaults
    const generatorOptions: ILGeneratorOptions = {
      ...this.defaultOptions,
      ...options,
    };

    // Get the primary module's symbol table
    // For now, use the first module - multi-module IL gen is future work
    const primaryModuleName = this.getPrimaryModuleName(programs);
    const moduleResult = semanticResult.modules.get(primaryModuleName);

    if (!moduleResult) {
      diagnostics.push(this.createInternalError(`Module '${primaryModuleName}' not found in semantic analysis results`));
      return {
        data: this.createEmptyModule(primaryModuleName),
        diagnostics,
        success: false,
        timeMs: performance.now() - startTime,
      };
    }

    // Create IL generator with symbol table and target config
    const generator = new ILGenerator(moduleResult.symbolTable, targetConfig, generatorOptions);

    // Find the primary program AST
    const primaryProgram = programs.find(p => this.getModuleName(p) === primaryModuleName);

    if (!primaryProgram) {
      diagnostics.push(this.createInternalError(`Program AST for module '${primaryModuleName}' not found`));
      return {
        data: this.createEmptyModule(primaryModuleName),
        diagnostics,
        success: false,
        timeMs: performance.now() - startTime,
      };
    }

    // Generate IL
    const ilResult = generator.generateModule(primaryProgram);

    // Convert IL generator errors to diagnostics
    const generatorErrors = generator.getErrors();
    for (const error of generatorErrors) {
      diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH, // Generic code for IL errors
        severity: error.severity === 'error' ? DiagnosticSeverity.ERROR : DiagnosticSeverity.WARNING,
        message: error.message,
        location: error.location,
      });
    }

    return {
      data: ilResult.module,
      diagnostics,
      success: ilResult.success && !generator.hasErrors(),
      timeMs: performance.now() - startTime,
    };
  }

  /**
   * Get the primary module name from programs
   *
   * Currently returns the first module's name.
   * In the future, this will look for the entry point module.
   *
   * @param programs - Array of Program ASTs
   * @returns Primary module name
   */
  protected getPrimaryModuleName(programs: Program[]): string {
    if (programs.length === 0) {
      return 'main';
    }
    return this.getModuleName(programs[0]);
  }

  /**
   * Get module name from a Program AST
   *
   * @param program - Program AST
   * @returns Module name
   */
  protected getModuleName(program: Program): string {
    const moduleDecl = program.getModule();
    return moduleDecl.getFullName() || 'global';
  }

  /**
   * Create an empty IL module for error cases
   *
   * @param name - Module name
   * @returns Empty ILModule
   */
  protected createEmptyModule(name: string): ILModule {
    return new ILModule(name);
  }

  /**
   * Create an internal error diagnostic
   *
   * @param message - Error message
   * @returns Diagnostic
   */
  protected createInternalError(message: string): Diagnostic {
    return {
      code: DiagnosticCode.TYPE_MISMATCH, // Generic code
      severity: DiagnosticSeverity.ERROR,
      message: `Internal compiler error: ${message}`,
      location: {
        source: '<internal>',
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 },
      },
    };
  }
}