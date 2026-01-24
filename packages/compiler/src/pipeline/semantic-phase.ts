/**
 * Semantic Phase
 *
 * Orchestrates semantic analysis on parsed ASTs.
 * This phase performs type checking, symbol resolution,
 * and cross-module validation.
 *
 * **Phase Responsibilities:**
 * - Build symbol tables for all modules
 * - Resolve types and type check expressions
 * - Validate imports/exports across modules
 * - Build control flow graphs
 * - Run advanced analysis passes
 *
 * @module pipeline/semantic-phase
 */

import { SemanticAnalyzer, type MultiModuleAnalysisResult } from '../semantic/analyzer.js';
import type { Program } from '../ast/nodes.js';
import type { PhaseResult } from './types.js';

/**
 * Semantic Phase - performs semantic analysis on ASTs
 *
 * Orchestrates the semantic analysis pipeline using the
 * existing SemanticAnalyzer.analyzeMultiple() method.
 *
 * **Multi-Pass Architecture:**
 * 1. Module discovery and validation
 * 2. Dependency graph construction
 * 3. Per-module analysis (in dependency order)
 * 4. Cross-module integration
 *
 * @example
 * ```typescript
 * const semanticPhase = new SemanticPhase();
 * const result = semanticPhase.execute(programs);
 *
 * if (result.success) {
 *   const symbolTable = result.data.globalSymbolTable;
 *   // Access symbols, types, etc.
 * }
 * ```
 */
export class SemanticPhase {
  /**
   * Run semantic analysis on parsed programs
   *
   * Delegates to SemanticAnalyzer.analyzeMultiple() which handles:
   * - Module registry construction
   * - Dependency graph building
   * - Circular import detection
   * - Per-module analysis in dependency order
   * - Global symbol table construction
   *
   * @param programs - Array of parsed Program ASTs
   * @returns Phase result with MultiModuleAnalysisResult
   */
  public execute(programs: Program[]): PhaseResult<MultiModuleAnalysisResult> {
    const startTime = performance.now();

    // Create fresh analyzer for this compilation
    const analyzer = new SemanticAnalyzer();

    // Run multi-module semantic analysis
    // This handles all passes including:
    // - Symbol table building
    // - Type resolution
    // - Type checking
    // - Control flow analysis
    // - Advanced analysis
    const result = analyzer.analyzeMultiple(programs);

    return {
      data: result,
      diagnostics: result.diagnostics,
      success: result.success,
      timeMs: performance.now() - startTime,
    };
  }

  /**
   * Run semantic analysis on a single program
   *
   * Convenience method for single-file compilation.
   * Wraps the program in an array and delegates to execute().
   *
   * @param program - Single parsed Program AST
   * @returns Phase result with MultiModuleAnalysisResult
   */
  public executeSingle(program: Program): PhaseResult<MultiModuleAnalysisResult> {
    return this.execute([program]);
  }
}