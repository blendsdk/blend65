/**
 * Type Checker for Blend65 Compiler v2
 *
 * Final concrete class in the type checker inheritance chain.
 * This is the main entry point for type checking.
 *
 * Inheritance Chain:
 * TypeCheckerBase → LiteralTypeChecker → ExpressionTypeChecker →
 * DeclarationTypeChecker → StatementTypeChecker → TypeChecker
 *
 * The TypeChecker class:
 * - Is the only concrete (non-abstract) class in the chain
 * - Provides the public API for type checking
 * - Orchestrates the type checking pass
 * - Integrates with the semantic analysis pipeline
 *
 * @module semantic/visitors/type-checker/type-checker
 */

import { Program } from '../../../ast/program.js';
import { StatementTypeChecker } from './statements.js';
import { SymbolTable } from '../../symbol-table.js';
import { TypeSystem } from '../../type-system.js';
import type { TypeCheckPassResult } from './base.js';
import type { Diagnostic } from '../../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../../ast/diagnostics.js';
import type { Expression, SourceLocation } from '../../../ast/base.js';
import type { TypeInfo } from '../../types.js';

/**
 * Type checking options
 */
export interface TypeCheckOptions {
  /**
   * Whether to stop on first error (default: false)
   */
  stopOnFirstError?: boolean;

  /**
   * Whether to report warnings (default: true)
   */
  reportWarnings?: boolean;

  /**
   * Maximum number of errors before stopping (default: 100)
   */
  maxErrors?: number;
}

/**
 * Type Checker - Main entry point for type checking
 *
 * Performs Pass 3 of semantic analysis: type checking expressions
 * and validating statements.
 *
 * **Usage:**
 *
 * ```typescript
 * // Create type checker
 * const typeChecker = new TypeChecker();
 *
 * // Run type checking
 * const result = typeChecker.check(symbolTable, program);
 *
 * // Check for errors
 * if (!result.success) {
 *   for (const diagnostic of result.diagnostics) {
 *     console.error(diagnostic.message);
 *   }
 * }
 * ```
 *
 * **What Gets Checked:**
 *
 * - Literal type inference (numbers, strings, booleans, arrays)
 * - Binary and unary expression types
 * - Variable references and type resolution
 * - Function calls (argument count, types, return type)
 * - Array indexing (index type, element type)
 * - Assignment compatibility
 * - Declaration type annotations
 * - Condition types (if, while, for)
 * - Return statement types
 * - Break/continue context validation
 *
 * **Prerequisites:**
 *
 * The TypeChecker requires a populated SymbolTable from previous passes:
 * - Pass 1 (SymbolTableBuilder): Declarations registered
 * - Pass 2 (TypeResolver): Type annotations resolved
 *
 * **Output:**
 *
 * The TypeChecker produces:
 * - Diagnostics (errors and warnings)
 * - Expression type annotations (stored in expressionTypes map)
 * - Updated symbol types (if inference is needed)
 */
export class TypeChecker extends StatementTypeChecker {
  // ============================================
  // OPTIONS
  // ============================================

  /**
   * Type checking options
   */
  protected options: TypeCheckOptions;

  // ============================================
  // CONSTRUCTOR
  // ============================================

  /**
   * Creates a new TypeChecker
   *
   * @param typeSystem - Optional TypeSystem instance (creates new if not provided)
   * @param options - Optional type checking options
   */
  constructor(typeSystem?: TypeSystem, options?: TypeCheckOptions) {
    super(typeSystem);
    this.options = {
      stopOnFirstError: false,
      reportWarnings: true,
      maxErrors: 100,
      ...options,
    };
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Type check a program
   *
   * This is the main entry point for type checking. It initializes
   * the type checker state and visits the entire program.
   *
   * @param symbolTable - The symbol table from Pass 1 and 2
   * @param program - The program AST to type check
   * @returns The type checking result
   *
   * @example
   * ```typescript
   * const typeChecker = new TypeChecker();
   * const result = typeChecker.check(symbolTable, program);
   *
   * if (result.success) {
   *   console.log('Type checking passed!');
   * } else {
   *   console.error(`Found ${result.errorCount} errors`);
   * }
   * ```
   */
  public check(symbolTable: SymbolTable, program: Program): TypeCheckPassResult {
    // Initialize state for this pass
    this.initializeState(symbolTable);

    // Reset loop/switch depth
    this.loopDepth = 0;
    this.switchDepth = 0;

    // Visit the program
    program.accept(this);

    // Return the result
    return this.finalizeResult();
  }

  /**
   * Type check a single expression
   *
   * Useful for REPL scenarios or testing individual expressions.
   *
   * @param symbolTable - The symbol table
   * @param expression - The expression to type check
   * @returns The inferred type, or null if type checking failed
   *
   * @example
   * ```typescript
   * const typeChecker = new TypeChecker();
   * const type = typeChecker.checkExpression(symbolTable, expr);
   *
   * if (type) {
   *   console.log(`Expression has type: ${type.name}`);
   * }
   * ```
   */
  public checkExpression(
    symbolTable: SymbolTable,
    expression: Expression
  ): TypeInfo | null {
    // Initialize state
    this.initializeState(symbolTable);

    // Visit the expression
    expression.accept(this);

    // Return the inferred type
    return this.getTypeOf(expression);
  }

  // ============================================
  // OPTION ACCESSORS
  // ============================================

  /**
   * Gets the current type checking options
   */
  public getOptions(): TypeCheckOptions {
    return { ...this.options };
  }

  /**
   * Sets type checking options
   *
   * @param options - The options to set
   */
  public setOptions(options: Partial<TypeCheckOptions>): void {
    this.options = { ...this.options, ...options };
  }

  // ============================================
  // ERROR LIMIT HANDLING
  // ============================================

  /**
   * Override reportError to handle max errors
   */
  protected override reportError(
    code: DiagnosticCode,
    message: string,
    location: SourceLocation,
    note?: string
  ): void {
    // Check if we should stop
    if (this.options.stopOnFirstError) {
      super.reportError(code, message, location, note);
      this.stop();
      return;
    }

    // Check max errors
    if (this.options.maxErrors && this.errorCount >= this.options.maxErrors) {
      // Don't report more errors
      return;
    }

    super.reportError(code, message, location, note);
  }

  /**
   * Override reportWarning to handle options
   */
  protected override reportWarning(
    code: DiagnosticCode,
    message: string,
    location: SourceLocation,
    note?: string
  ): void {
    // Check if warnings are enabled
    if (!this.options.reportWarnings) {
      return;
    }

    super.reportWarning(code, message, location, note);
  }

  // ============================================
  // RESULT ACCESSORS
  // ============================================

  /**
   * Gets all diagnostics from the type checking pass
   *
   * @returns Array of diagnostics
   */
  public override getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Gets only error diagnostics
   *
   * @returns Array of error diagnostics
   */
  public getErrors(): Diagnostic[] {
    return this.diagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR);
  }

  /**
   * Gets only warning diagnostics
   *
   * @returns Array of warning diagnostics
   */
  public getWarnings(): Diagnostic[] {
    return this.diagnostics.filter((d) => d.severity === DiagnosticSeverity.WARNING);
  }

  /**
   * Checks if type checking produced any errors
   *
   * @returns True if there are errors
   */
  public hasErrors(): boolean {
    return this.errorCount > 0;
  }

  /**
   * Checks if type checking produced any warnings
   *
   * @returns True if there are warnings
   */
  public hasWarnings(): boolean {
    return this.warningCount > 0;
  }

  /**
   * Gets the type of an expression after type checking
   *
   * @param expr - The expression
   * @returns The type info, or null if not type checked
   */
  public getExpressionTypeInfo(expr: Expression): TypeInfo | null {
    return this.getTypeOf(expr);
  }

  /**
   * Gets the number of expressions that were type checked
   *
   * @returns The count of expressions checked
   */
  public getExpressionsCheckedCount(): number {
    return this.expressionsChecked;
  }

  // ============================================
  // DEBUGGING
  // ============================================

  /**
   * Gets a string representation of the type checking result
   *
   * Useful for debugging and logging.
   *
   * @returns A string summary of the type checking result
   */
  public toString(): string {
    const lines: string[] = [];
    lines.push('Type Checking Result:');
    lines.push(`  Expressions checked: ${this.expressionsChecked}`);
    lines.push(`  Errors: ${this.errorCount}`);
    lines.push(`  Warnings: ${this.warningCount}`);

    if (this.diagnostics.length > 0) {
      lines.push('  Diagnostics:');
      for (const diag of this.diagnostics.slice(0, 10)) {
        const severity = diag.severity === 'error' ? '❌' : '⚠️';
        lines.push(`    ${severity} ${diag.message}`);
      }
      if (this.diagnostics.length > 10) {
        lines.push(`    ... and ${this.diagnostics.length - 10} more`);
      }
    }

    return lines.join('\n');
  }
}