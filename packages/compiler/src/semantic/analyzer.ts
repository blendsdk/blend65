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
import { TypeResolver } from './visitors/type-resolver.js';
import { TypeChecker } from './visitors/type-checker/type-checker.js';
import { ControlFlowAnalyzer } from './visitors/control-flow-analyzer.js';
import { SymbolTable } from './symbol-table.js';
import { TypeSystem } from './type-system.js';
import { ControlFlowGraph } from './control-flow.js';
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
 * 1. Builds symbol tables and scopes (Phase 1)
 * 2. Resolves types (Phase 2)
 * 3. Type checks expressions and statements (Phase 3 + 4)
 * 4. Builds control flow graphs (Phase 5)
 * 5. Advanced analysis (Phases 6-8, future)
 *
 * **Current Implementation:** Passes 1-5 complete and integrated.
 */
export class SemanticAnalyzer {
  /** Symbol table (built during Pass 1) */
  protected symbolTable: SymbolTable | null = null;

  /** Type system (built during Pass 2) */
  protected typeSystem: TypeSystem | null = null;

  /** Control flow graphs (built during Pass 5) */
  protected cfgs: Map<string, ControlFlowGraph> = new Map();

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
    this.typeSystem = null;
    this.cfgs.clear();
    this.diagnostics = [];

    // Pass 1: Build symbol table
    this.runPass1_SymbolTableBuilder(ast);

    // Pass 2: Type resolution (only if Pass 1 succeeded)
    if (!this.hasErrors()) {
      this.runPass2_TypeResolution(ast);
    }

    // Pass 3: Type checking (only if Pass 2 succeeded)
    if (!this.hasErrors()) {
      this.runPass3_TypeChecker(ast);
    }

    // Pass 5: Control flow analysis (only if Pass 1 succeeded)
    // Note: Can run independently of type checking
    if (!this.hasErrors()) {
      this.runPass5_ControlFlowAnalyzer(ast);
    }

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
   * Pass 2: Type Resolution
   *
   * Resolves type annotations and annotates symbols with type information.
   * Creates the type system with all built-in types and operations.
   *
   * @param ast - Program AST
   */
  protected runPass2_TypeResolution(ast: Program): void {
    if (!this.symbolTable) {
      throw new Error('Pass 1 must be run before Pass 2');
    }

    const resolver = new TypeResolver(this.symbolTable);

    // Visit the entire AST to resolve types
    ast.accept(resolver);

    // Extract results
    this.typeSystem = resolver.getTypeSystem();
    this.diagnostics.push(...resolver.getDiagnostics());
  }

  /**
   * Pass 3: Type Checking
   *
   * Type checks all expressions and statements, validates type compatibility,
   * and performs statement-level semantic validation (break/continue, returns, etc.).
   *
   * Note: Statement validation (Phase 4) is integrated into the TypeChecker.
   *
   * @param ast - Program AST
   */
  protected runPass3_TypeChecker(ast: Program): void {
    if (!this.symbolTable || !this.typeSystem) {
      throw new Error('Pass 1 and Pass 2 must be run before Pass 3');
    }

    const checker = new TypeChecker(this.symbolTable, this.typeSystem);

    // Visit the entire AST to type check
    ast.accept(checker);

    // Extract diagnostics
    this.diagnostics.push(...checker.getDiagnostics());
  }

  /**
   * Pass 5: Control Flow Analysis
   *
   * Builds control flow graphs for all functions, performs reachability analysis,
   * and detects dead code.
   *
   * @param ast - Program AST
   */
  protected runPass5_ControlFlowAnalyzer(ast: Program): void {
    if (!this.symbolTable) {
      throw new Error('Pass 1 must be run before Pass 5');
    }

    const analyzer = new ControlFlowAnalyzer(this.symbolTable);

    // Visit the entire AST to build CFGs
    ast.accept(analyzer);

    // Extract results
    this.cfgs = analyzer.getAllCFGs();
    this.diagnostics.push(...analyzer.getDiagnostics());
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
   * Get the type system
   *
   * @returns Type system (null if analyze() not called yet or Pass 2 failed)
   */
  public getTypeSystem(): TypeSystem | null {
    return this.typeSystem;
  }

  /**
   * Get control flow graph for a specific function
   *
   * @param functionName - Name of the function
   * @returns CFG for the function, or undefined if not found
   */
  public getCFG(functionName: string): ControlFlowGraph | undefined {
    return this.cfgs.get(functionName);
  }

  /**
   * Get all control flow graphs
   *
   * @returns Map of function names to CFGs
   */
  public getAllCFGs(): Map<string, ControlFlowGraph> {
    return this.cfgs;
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
