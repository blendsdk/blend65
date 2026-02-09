/**
 * Frame Phase
 *
 * Orchestrates Static Frame Allocation (SFA) for the v2 compiler.
 * This is a NEW phase in v2 that does not exist in v1.
 *
 * **Phase Responsibilities:**
 * - Build call graph from semantic analysis results
 * - Check for recursion (disallowed in SFA)
 * - Calculate frame sizes for each function
 * - Allocate ZP and RAM addresses to frame slots
 *
 * **SFA Architecture:**
 * Each function gets a fixed memory region (Frame) containing:
 * - Parameters (passed via frame slots, not stack)
 * - Local variables (fixed addresses)
 * - Return value slot
 *
 * @module pipeline/frame-phase
 */

import { FrameAllocator, createEmptyAllocationStats, type FrameAllocationResult, type FrameDiagnostic } from '../frame/allocator/frame-allocator.js';
import { type PlatformConfig, C64_PLATFORM_CONFIG } from '../frame/platform.js';
import type { MultiModuleAnalysisResult, AnalysisResult } from '../semantic/analyzer.js';
import type { Program } from '../ast/program.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import { DiagnosticCode, DiagnosticSeverity } from '../ast/diagnostics.js';
import type { PhaseResult } from './types.js';

/**
 * Frame Phase - performs Static Frame Allocation
 *
 * Runs the FrameAllocator on the primary module's program and
 * semantic analysis results (call graph + symbol table).
 *
 * **Why this phase is separate from IL generation:**
 * Frame allocation must happen BEFORE IL generation because the
 * ILGenerator needs the frame map (function→address mappings) to
 * emit correct load/store instructions with resolved addresses.
 *
 * @example
 * ```typescript
 * const framePhase = new FramePhase();
 * const result = framePhase.execute(semanticResult, programs);
 * ```
 */
export class FramePhase {
  /** Platform configuration for memory layout */
  protected readonly platformConfig: PlatformConfig;

  /**
   * Creates a new FramePhase
   *
   * @param platformConfig - Platform config (defaults to C64)
   */
  constructor(platformConfig: PlatformConfig = C64_PLATFORM_CONFIG) {
    this.platformConfig = platformConfig;
  }

  /**
   * Run frame allocation on ALL modules
   *
   * Collects functions from ALL modules' program ASTs and allocates
   * frames for all of them together. This ensures functions defined
   * in imported modules also receive frame allocations, preventing
   * "No frame for function" errors during IL generation.
   *
   * Uses the primary module's call graph for recursion detection
   * and symbol table for type resolution.
   *
   * @param semanticResult - Result from semantic analysis
   * @param programs - Array of parsed Program ASTs
   * @returns Phase result with FrameAllocationResult
   */
  public execute(
    semanticResult: MultiModuleAnalysisResult,
    programs: Program[]
  ): PhaseResult<FrameAllocationResult> {
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
        data: this.createEmptyResult(),
        diagnostics,
        success: false,
        timeMs: performance.now() - startTime,
      };
    }

    // Create frame allocator with platform config and symbol table
    const allocator = new FrameAllocator(this.platformConfig, moduleResult.symbolTable);

    // Collect program ASTs from ALL modules (not just the primary)
    // This ensures functions in imported modules also get frame allocations
    const allPrograms = this.collectAllModulePrograms(semanticResult);

    // Run frame allocation across ALL module programs using
    // the primary module's call graph for recursion detection
    const allocationResult = allocator.allocateMultiplePrograms(
      allPrograms,
      moduleResult.callGraph,
      moduleResult.symbolTable
    );

    // Convert FrameDiagnostics to standard Diagnostics
    for (const frameDiag of allocationResult.diagnostics) {
      diagnostics.push(this.frameDiagnosticToStandard(frameDiag));
    }

    return {
      data: allocationResult,
      diagnostics,
      success: allocationResult.success,
      timeMs: performance.now() - startTime,
    };
  }

  /**
   * Get the primary module name from semantic results
   *
   * Finds the entry point module by looking for a module with an
   * exported main() function. If not found, uses the last module
   * in the compilation order (typically the user's entry module).
   *
   * @param semanticResult - Multi-module analysis result
   * @param programs - Array of Program ASTs
   * @returns Primary module name
   */
  protected getPrimaryModuleName(
    semanticResult: MultiModuleAnalysisResult,
    programs: Program[]
  ): string {
    // Use compilation order from semantic analysis
    // The last module is typically the user's entry module
    const order = semanticResult.compilationOrder;
    if (order.length > 0) {
      // Look for a module with exported main in order
      for (const moduleName of order) {
        const moduleResult = semanticResult.modules.get(moduleName);
        if (moduleResult && this.hasExportedMain(moduleResult)) {
          return moduleName;
        }
      }
      // Fall back to last module in compilation order
      return order[order.length - 1];
    }

    // Fallback: use the last program's module name
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

    if (moduleDecl.isImplicitModule() || !fullName || fullName === '') {
      return 'main';
    }

    return fullName;
  }

  /**
   * Collect program ASTs from ALL modules in the semantic result.
   *
   * Iterates over every module's analysis result and collects
   * their ASTs. This is used to ensure frame allocation covers
   * functions from all modules, not just the primary.
   *
   * @param semanticResult - Multi-module analysis result
   * @returns Array of all module Program ASTs
   */
  protected collectAllModulePrograms(
    semanticResult: MultiModuleAnalysisResult
  ): Program[] {
    const programs: Program[] = [];

    for (const [_moduleName, moduleResult] of semanticResult.modules) {
      programs.push(moduleResult.ast);
    }

    return programs;
  }

  /**
   * Convert a FrameDiagnostic to standard Diagnostic
   *
   * FrameDiagnostics don't have source locations, so we create
   * a synthetic internal location.
   *
   * @param frameDiag - Frame diagnostic to convert
   * @returns Standard Diagnostic
   */
  protected frameDiagnosticToStandard(frameDiag: FrameDiagnostic): Diagnostic {
    // Build message with context if available
    let message = frameDiag.message;
    if (frameDiag.functionName) {
      message = `[${frameDiag.functionName}] ${message}`;
    }
    if (frameDiag.context && frameDiag.context.length > 0) {
      message += ` (${frameDiag.context.join(' → ')})`;
    }

    // Map frame DiagnosticSeverity (from frame/enums) to AST DiagnosticSeverity
    // Both use the same string values ('error', 'warning', 'info') but are different enum types
    const severityStr = frameDiag.severity as unknown as string;
    const severity = severityStr === 'error'
      ? DiagnosticSeverity.ERROR
      : severityStr === 'warning'
        ? DiagnosticSeverity.WARNING
        : DiagnosticSeverity.INFO;

    return {
      code: DiagnosticCode.TYPE_MISMATCH, // Generic code for frame diagnostics
      severity,
      message,
      location: {
        source: '<frame-allocator>',
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 },
      },
    };
  }

  /**
   * Create an empty FrameAllocationResult for error cases
   *
   * @returns Empty allocation result
   */
  protected createEmptyResult(): FrameAllocationResult {
    return {
      frameMap: new Map(),
      stats: createEmptyAllocationStats(this.platformConfig),
      diagnostics: [],
      success: false,
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
