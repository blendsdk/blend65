/**
 * Semantic Analyzer - Main Orchestrator
 *
 * Coordinates all semantic analysis passes and provides
 * a unified interface for semantic checking.
 *
 * Multi-Pass Architecture:
 * - Pass 1: Symbol Table Builder (collect declarations, build scopes)
 * - Pass 2: Type Resolution (resolve type annotations) [Phase 2]
 * - Pass 3: Type Checker (type check expressions/statements) [Phase 3]
 * - Pass 4: Statement Validator (control flow validation) [Phase 4]
 * - Pass 5-8: Advanced analysis passes [Phases 5-8]
 */

import { SymbolTableBuilder } from './visitors/symbol-table-builder.js';
import { SymbolTable } from './symbol-table.js';
import { Diagnostic } from '../ast/diagnostics.js';
import type { Program } from '../ast/nodes.js';

/**
 * Result of semantic analysis
 */
export interface AnalysisResult {
  /** Symbol table with all symbols and scopes */
  symbolTable: SymbolTable;

  /** All diagnostics from all passes */
  diagnostics: Diagnostic[];

  /** True if analysis succeeded (no errors) */
  success: boolean;
}

/**
 * Semantic analyzer orchestrator
 *
 * Coordinates multi-pass semantic analysis:
 * 1. Builds symbol tables and scopes
 * 2. Resolves types
 * 3. Type checks expressions and statements
 * 4. Validates control flow
 * 5. Performs advanced analysis
 *
 * Currently implements Pass 1 (Symbol Table Builder).
 * Future passes will be added in subsequent phases.
 */
export class SemanticAnalyzer {
  /** Symbol table (built during Pass 1) */
  protected symbolTable: SymbolTable | null = null;

  /** All diagnostics from all passes */
  protected diagnostics: Diagnostic[] = [];

  /**
   * Analyze an AST
   *
   * Runs all semantic analysis passes and returns results.
   *
   * @param ast - Program AST to analyze
   * @returns Analysis result with symbol table and diagnostics
   */
  public analyze(ast: Program): AnalysisResult {
    // Reset state for new analysis
    this.symbolTable = null;
    this.diagnostics = [];

    // Pass 1: Build symbol table
    this.runPass1_SymbolTableBuilder(ast);

    // Future passes will be added here:
    // if (!this.hasErrors()) {
    //   this.runPass2_TypeResolution(ast);
    // }
    // if (!this.hasErrors()) {
    //   this.runPass3_TypeChecker(ast);
    // }
    // etc.

    // Return analysis results
    return {
      symbolTable: this.symbolTable!,
      diagnostics: [...this.diagnostics],
      success: !this.hasErrors(),
    };
  }

  /**
   * Pass 1: Symbol Table Builder
   *
   * Collects all declarations and builds the symbol table with
   * proper scope hierarchy. This is the foundation for all
   * subsequent analysis passes.
   *
   * @param ast - Program AST
   */
  protected runPass1_SymbolTableBuilder(ast: Program): void {
    const builder = new SymbolTableBuilder();

    // Visit the entire AST to collect declarations
    ast.accept(builder);

    // Extract results
    this.symbolTable = builder.getSymbolTable();
    this.diagnostics.push(...builder.getDiagnostics());
  }

  /**
   * Get the symbol table
   *
   * @returns Symbol table (null if analyze() not called yet)
   */
  public getSymbolTable(): SymbolTable | null {
    return this.symbolTable;
  }

  /**
   * Get all diagnostics
   *
   * @returns Array of diagnostics from all passes
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Check if any errors occurred during analysis
   *
   * @returns True if any error-level diagnostics exist
   */
  public hasErrors(): boolean {
    return this.diagnostics.some(d => d.severity === 'error');
  }

  /**
   * Get count of diagnostics by severity
   *
   * @returns Counts of errors, warnings, info, hints
   */
  public getDiagnosticCounts(): {
    errors: number;
    warnings: number;
    info: number;
    hints: number;
  } {
    return {
      errors: this.diagnostics.filter(d => d.severity === 'error').length,
      warnings: this.diagnostics.filter(d => d.severity === 'warning').length,
      info: this.diagnostics.filter(d => d.severity === 'info').length,
      hints: this.diagnostics.filter(d => d.severity === 'hint').length,
    };
  }
}
