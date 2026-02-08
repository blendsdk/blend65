/**
 * IL Phase
 *
 * Orchestrates intermediate language generation from AST.
 * This phase converts the analyzed AST into IL (Intermediate Language)
 * using frame-allocated addresses from the FramePhase.
 *
 * **V2 Differences from V1:**
 * - Receives FrameAllocationResult (frame map with resolved addresses)
 * - ILGenerator takes (frameMap, symbolTable) in constructor
 * - No SSA construction (v2 uses simple linear IL)
 * - Returns ILProgram (not ILModule)
 *
 * @module pipeline/il-phase
 */

import { ILGenerator } from '../il/generator/index.js';
import type { ILProgram } from '../il/structures.js';
import type { Program } from '../ast/program.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import { DiagnosticCode, DiagnosticSeverity } from '../ast/diagnostics.js';
import type { MultiModuleAnalysisResult, AnalysisResult } from '../semantic/analyzer.js';
import type { FrameAllocationResult } from '../frame/allocator/frame-allocator.js';
import type { PhaseResult } from './types.js';

/**
 * IL Phase - generates IL from analyzed AST with frame allocation
 *
 * Orchestrates the IL generation pipeline using the ILGenerator.
 * The generator uses the frame map to emit load/store instructions
 * with resolved memory addresses.
 *
 * @example
 * ```typescript
 * const ilPhase = new ILPhase();
 * const result = ilPhase.execute(semanticResult, frameResult, programs);
 *
 * if (result.success) {
 *   const ilProgram = result.data;
 *   for (const func of ilProgram.functions) {
 *     console.log(`${func.name}: ${func.instructions.length} IL ops`);
 *   }
 * }
 * ```
 */
export class ILPhase {
  /**
   * Generate IL from analyzed AST with frame allocation
   *
   * Creates an ILGenerator with the frame map and symbol table,
   * then generates IL for the primary module's program.
   *
   * @param semanticResult - Result from semantic analysis
   * @param frameResult - Result from frame allocation
   * @param programs - Array of parsed Program ASTs
   * @returns Phase result with generated ILProgram
   */
  public execute(
    semanticResult: MultiModuleAnalysisResult,
    frameResult: FrameAllocationResult,
    programs: Program[]
  ): PhaseResult<ILProgram> {
    const startTime = performance.now();
    const diagnostics: Diagnostic[] = [];

    // Find the primary module (entry point)
    const primaryModuleName = this.getPrimaryModuleName(semanticResult, programs);
    const moduleResult = semanticResult.modules.get(primaryModuleName);

    if (!moduleResult) {
      diagnostics.push(this.createInternalError(
        `Module '${primaryModuleName}' not found in semantic analysis results`
      ));
      return {
        data: this.createEmptyProgram(primaryModuleName),
        diagnostics,
        success: false,
        timeMs: performance.now() - startTime,
      };
    }

    // Find the primary program AST
    const primaryProgram = programs.find(p => this.getModuleName(p) === primaryModuleName);

    if (!primaryProgram) {
      diagnostics.push(this.createInternalError(
        `Program AST for module '${primaryModuleName}' not found`
      ));
      return {
        data: this.createEmptyProgram(primaryModuleName),
        diagnostics,
        success: false,
        timeMs: performance.now() - startTime,
      };
    }

    // Create IL generator with frame map and symbol table
    // The frame map provides resolved memory addresses for variables
    const generator = new ILGenerator(
      frameResult.frameMap,
      moduleResult.symbolTable
    );

    // Generate IL from the program AST
    const ilProgram = generator.generate(primaryProgram);

    return {
      data: ilProgram,
      diagnostics,
      success: true,
      timeMs: performance.now() - startTime,
    };
  }

  /**
   * Get the primary module name from semantic results
   *
   * Uses the same logic as FramePhase to ensure consistency.
   *
   * @param semanticResult - Multi-module analysis result
   * @param programs - Array of Program ASTs
   * @returns Primary module name
   */
  protected getPrimaryModuleName(
    semanticResult: MultiModuleAnalysisResult,
    programs: Program[]
  ): string {
    const order = semanticResult.compilationOrder;
    if (order.length > 0) {
      // Look for a module with exported main
      for (const moduleName of order) {
        const moduleResult = semanticResult.modules.get(moduleName);
        if (moduleResult && this.hasExportedMain(moduleResult)) {
          return moduleName;
        }
      }
      return order[order.length - 1];
    }

    if (programs.length > 0) {
      return this.getModuleName(programs[programs.length - 1]);
    }

    return 'main';
  }

  /**
   * Check if a module has an exported main function
   *
   * @param moduleResult - Analysis result for a module
   * @returns True if module has exported main
   */
  protected hasExportedMain(moduleResult: AnalysisResult): boolean {
    const exported = moduleResult.symbolTable.getExportedSymbols();
    return exported.some(s => s.name === 'main');
  }

  /**
   * Get module name from a Program AST
   *
   * @param program - Program AST
   * @returns Module name
   */
  protected getModuleName(program: Program): string {
    const moduleDecl = program.getModule();
    const fullName = moduleDecl.getFullName();

    // Use the actual module name from the declaration.
    // Implicit modules created by parse-phase use 'global' as their name.
    // Fall back to 'main' only if the name is truly empty.
    if (!fullName || fullName === '') {
      return 'main';
    }

    return fullName;
  }

  /**
   * Create an empty ILProgram for error cases
   *
   * @param moduleName - Module name
   * @returns Empty ILProgram
   */
  protected createEmptyProgram(moduleName: string): ILProgram {
    return {
      moduleName,
      functions: [],
      globalInit: [],
      entryPoint: 'main',
      instructionCount: 0,
      totalEstimatedCycles: 0,
    };
  }

  /**
   * Create an internal error diagnostic
   *
   * @param message - Error message
   * @returns Diagnostic
   */
  protected createInternalError(message: string): Diagnostic {
    return {
      code: DiagnosticCode.TYPE_MISMATCH,
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
