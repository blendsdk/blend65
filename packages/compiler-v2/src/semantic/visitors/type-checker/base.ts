/**
 * Type Checker Base for Blend65 Compiler v2
 *
 * Pass 3 of semantic analysis: type checking expressions and statements.
 *
 * This is the foundation layer of the type checker inheritance chain:
 * TypeCheckerBase → LiteralTypeChecker → ExpressionTypeChecker →
 * DeclarationTypeChecker → StatementTypeChecker → TypeChecker
 *
 * Provides:
 * - Diagnostic utilities for reporting type errors
 * - Symbol lookup utilities for finding variables/functions
 * - Type inference result tracking
 * - Common helper methods used by all type checking layers
 *
 * @module semantic/visitors/type-checker/base
 */

import { ASTWalker } from '../../../ast/walker/index.js';
import type { Expression, SourceLocation } from '../../../ast/index.js';
import type { SymbolTable } from '../../symbol-table.js';
import type { Symbol } from '../../symbol.js';
import type { Scope } from '../../scope.js';
import { TypeSystem } from '../../type-system.js';
import type { TypeInfo } from '../../types.js';
import { TypeCompatibility } from '../../types.js';
import type { Diagnostic } from '../../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../../ast/diagnostics.js';

/**
 * Type checking result for an expression
 *
 * Used to track the inferred type of an expression during type checking.
 * The type is null if type checking failed (error already reported).
 */
export interface TypeCheckResult {
  /** The inferred type, or null if type checking failed */
  type: TypeInfo | null;

  /** Whether this expression is a constant (compile-time known) */
  isConstant: boolean;

  /** Optional constant value if known at compile time */
  constantValue?: number | string | boolean;
}

/**
 * Result of the type checking pass
 */
export interface TypeCheckPassResult {
  /** Whether type checking succeeded without errors */
  success: boolean;

  /** Diagnostics collected during type checking */
  diagnostics: Diagnostic[];

  /** Number of expressions type checked */
  expressionsChecked: number;

  /** Number of type errors found */
  errorCount: number;

  /** Number of warnings issued */
  warningCount: number;
}

/**
 * Diagnostic codes specific to type checking
 */
export const TypeCheckDiagnosticCodes = {
  /** Type mismatch error */
  TYPE_MISMATCH: DiagnosticCode.TYPE_MISMATCH,

  /** Undefined variable reference */
  UNDEFINED_VARIABLE: DiagnosticCode.UNDEFINED_VARIABLE,

  /** Invalid operand types for operator */
  INVALID_OPERAND: 'S020' as DiagnosticCode,

  /** Cannot assign to expression */
  INVALID_ASSIGNMENT_TARGET: 'S021' as DiagnosticCode,

  /** Numeric literal out of range */
  NUMERIC_OVERFLOW: 'S022' as DiagnosticCode,

  /** Array element type mismatch */
  ARRAY_ELEMENT_TYPE_MISMATCH: 'S023' as DiagnosticCode,

  /** Empty array cannot infer type */
  EMPTY_ARRAY_NO_TYPE: 'S024' as DiagnosticCode,
} as const;

/**
 * Type Checker Base - Foundation layer for type checking
 *
 * Provides common utilities used by all type checking layers:
 * - Diagnostic creation and collection
 * - Symbol table lookups
 * - Type inference result tracking
 * - Helper methods for common type operations
 *
 * This class should NOT be instantiated directly. Use the final TypeChecker class.
 *
 * @example
 * ```typescript
 * // Don't do this:
 * const checker = new TypeCheckerBase(); // Wrong!
 *
 * // Instead, use the final TypeChecker:
 * const checker = new TypeChecker();
 * const result = checker.check(symbolTable, program);
 * ```
 */
export abstract class TypeCheckerBase extends ASTWalker {
  // ============================================
  // PROTECTED STATE
  // ============================================

  /** The symbol table from Pass 1 and 2 */
  protected symbolTable: SymbolTable;

  /** The type system for type operations */
  protected typeSystem: TypeSystem;

  /** Collected diagnostics during type checking */
  protected diagnostics: Diagnostic[];

  /** Count of expressions checked */
  protected expressionsChecked: number;

  /** Count of type errors */
  protected errorCount: number;

  /** Count of warnings */
  protected warningCount: number;

  /**
   * Map of expression nodes to their inferred types
   * Uses the node itself as key for fast lookup
   */
  protected expressionTypes: Map<Expression, TypeCheckResult>;

  /**
   * Current scope during traversal (for symbol lookups)
   */
  protected currentScope: Scope | null;

  // ============================================
  // CONSTRUCTOR
  // ============================================

  /**
   * Creates a new TypeCheckerBase
   *
   * @param typeSystem - Optional TypeSystem instance (creates new if not provided)
   */
  constructor(typeSystem?: TypeSystem) {
    super();
    this.symbolTable = null!;
    this.typeSystem = typeSystem ?? new TypeSystem();
    this.diagnostics = [];
    this.expressionsChecked = 0;
    this.errorCount = 0;
    this.warningCount = 0;
    this.expressionTypes = new Map();
    this.currentScope = null;
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize state for a new type checking pass
   *
   * Called at the start of type checking to reset all state.
   *
   * @param symbolTable - The symbol table from previous passes
   */
  protected initializeState(symbolTable: SymbolTable): void {
    this.symbolTable = symbolTable;
    this.diagnostics = [];
    this.expressionsChecked = 0;
    this.errorCount = 0;
    this.warningCount = 0;
    this.expressionTypes.clear();
    this.currentScope = symbolTable.getCurrentScope();
  }

  /**
   * Looks up a symbol in the scope chain
   *
   * Searches from the type checker's current scope up through parent scopes.
   * Uses the type checker's local currentScope tracking, not the symbol table's
   * currentScope, because the type checker navigates scopes independently.
   *
   * @param name - The symbol name to look up
   * @returns The symbol, or null if not found
   */
  protected lookupSymbol(name: string): Symbol | null {
    if (!this.symbolTable) {
      return null;
    }
    // Use lookupFrom with the type checker's currentScope
    // This ensures we look up symbols from the correct scope during type checking
    if (this.currentScope) {
      return this.symbolTable.lookupFrom(name, this.currentScope) ?? null;
    }
    // Fall back to symbolTable's current scope if local scope not set
    return this.symbolTable.lookup(name) ?? null;
  }

  // ============================================
  // TYPE RESULT TRACKING
  // ============================================

  /**
   * Records the type of an expression
   *
   * @param expr - The expression node
   * @param type - The inferred type (null if error)
   * @param isConstant - Whether the value is known at compile time
   * @param constantValue - The constant value if known
   */
  protected setExpressionType(
    expr: Expression,
    type: TypeInfo | null,
    isConstant: boolean = false,
    constantValue?: number | string | boolean
  ): void {
    this.expressionTypes.set(expr, {
      type,
      isConstant,
      constantValue,
    });
    this.expressionsChecked++;
  }

  /**
   * Gets the previously inferred type of an expression
   *
   * @param expr - The expression node
   * @returns The type check result, or null if not yet checked
   */
  protected getExpressionType(expr: Expression): TypeCheckResult | null {
    return this.expressionTypes.get(expr) ?? null;
  }

  /**
   * Gets just the TypeInfo from an expression, or null
   *
   * Convenience method for getting just the type without the full result.
   *
   * @param expr - The expression node
   * @returns The TypeInfo, or null if not checked or error
   */
  protected getTypeOf(expr: Expression): TypeInfo | null {
    const result = this.expressionTypes.get(expr);
    return result?.type ?? null;
  }

  // ============================================
  // SYMBOL LOOKUP UTILITIES
  // ============================================

  /**
   * Looks up a symbol and returns its resolved type
   *
   * @param name - The symbol name to look up
   * @returns The symbol's type, or null if not found or not resolved
   */
  protected lookupSymbolType(name: string): TypeInfo | null {
    const symbol = this.lookupSymbol(name);
    return symbol?.type ?? null;
  }

  /**
   * Checks if a symbol exists in the current scope chain
   *
   * @param name - The symbol name to check
   * @returns True if the symbol exists
   */
  protected symbolExists(name: string): boolean {
    return this.lookupSymbol(name) !== null;
  }

  // ============================================
  // TYPE COMPATIBILITY UTILITIES
  // ============================================

  /**
   * Checks if a value of type 'from' can be assigned to type 'to'
   *
   * @param from - The source type
   * @param to - The target type
   * @returns True if assignment is allowed
   */
  protected canAssign(from: TypeInfo, to: TypeInfo): boolean {
    return this.typeSystem.canAssign(from, to);
  }

  /**
   * Checks type compatibility and returns the compatibility level
   *
   * @param from - The source type
   * @param to - The target type
   * @returns The compatibility level
   */
  protected checkTypeCompatibility(from: TypeInfo, to: TypeInfo): TypeCompatibility {
    return this.typeSystem.checkCompatibility(from, to);
  }

  /**
   * Checks if two types are exactly equal
   *
   * @param a - First type
   * @param b - Second type
   * @returns True if types are identical
   */
  protected areTypesEqual(a: TypeInfo, b: TypeInfo): boolean {
    return this.typeSystem.areTypesEqual(a, b);
  }

  // ============================================
  // TYPE UTILITY METHODS
  // ============================================

  /**
   * Gets a built-in type by name
   *
   * @param name - The type name ('byte', 'word', 'bool', 'void', 'string')
   * @returns The built-in type, or undefined if not found
   */
  protected getBuiltinType(name: string): TypeInfo | undefined {
    return this.typeSystem.getBuiltinType(name);
  }

  /**
   * Checks if a type is numeric (byte or word)
   */
  protected isNumericType(type: TypeInfo): boolean {
    return this.typeSystem.isNumericType(type);
  }

  /**
   * Checks if a type is an array type
   */
  protected isArrayType(type: TypeInfo): boolean {
    return this.typeSystem.isArrayType(type);
  }

  /**
   * Checks if a type is a function type
   */
  protected isFunctionType(type: TypeInfo): boolean {
    return this.typeSystem.isFunctionType(type);
  }

  /**
   * Gets the element type of an array
   */
  protected getArrayElementType(type: TypeInfo): TypeInfo | undefined {
    return this.typeSystem.getArrayElementType(type);
  }

  // ============================================
  // DIAGNOSTIC UTILITIES
  // ============================================

  /**
   * Reports a type error
   *
   * @param code - The diagnostic code
   * @param message - The error message
   * @param location - The source location
   * @param note - Optional additional note
   */
  protected reportError(
    code: DiagnosticCode,
    message: string,
    location: SourceLocation,
    note?: string
  ): void {
    const diagnostic: Diagnostic = {
      code,
      severity: DiagnosticSeverity.ERROR,
      message,
      location,
    };

    if (note) {
      diagnostic.relatedLocations = [
        {
          location,
          message: note,
        },
      ];
    }

    this.diagnostics.push(diagnostic);
    this.errorCount++;
  }

  /**
   * Reports a type warning
   *
   * @param code - The diagnostic code
   * @param message - The warning message
   * @param location - The source location
   * @param note - Optional additional note
   */
  protected reportWarning(
    code: DiagnosticCode,
    message: string,
    location: SourceLocation,
    note?: string
  ): void {
    const diagnostic: Diagnostic = {
      code,
      severity: DiagnosticSeverity.WARNING,
      message,
      location,
    };

    if (note) {
      diagnostic.relatedLocations = [
        {
          location,
          message: note,
        },
      ];
    }

    this.diagnostics.push(diagnostic);
    this.warningCount++;
  }

  /**
   * Reports a type mismatch error
   *
   * Common error type, so has its own helper method.
   *
   * @param expected - The expected type
   * @param actual - The actual type found
   * @param location - The source location
   * @param context - Optional context description
   */
  protected reportTypeMismatch(
    expected: TypeInfo,
    actual: TypeInfo,
    location: SourceLocation,
    context?: string
  ): void {
    const contextStr = context ? ` in ${context}` : '';
    this.reportError(
      DiagnosticCode.TYPE_MISMATCH,
      `Type '${actual.name}' is not assignable to type '${expected.name}'${contextStr}`,
      location,
      `Expected '${expected.name}', got '${actual.name}'`
    );
  }

  /**
   * Reports an undefined variable error
   *
   * @param name - The undefined variable name
   * @param location - The source location
   */
  protected reportUndefinedVariable(name: string, location: SourceLocation): void {
    this.reportError(
      DiagnosticCode.UNDEFINED_VARIABLE,
      `Cannot find name '${name}'`,
      location,
      'Did you mean to declare this variable?'
    );
  }

  // ============================================
  // VALUE RANGE UTILITIES
  // ============================================

  /**
   * Checks if a numeric value fits in a byte (0-255)
   */
  protected fitsInByte(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= 255;
  }

  /**
   * Checks if a numeric value fits in a word (0-65535)
   */
  protected fitsInWord(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= 65535;
  }

  /**
   * Determines the minimum type needed to hold a numeric value
   *
   * @param value - The numeric value
   * @returns 'byte' if fits in byte, 'word' otherwise
   */
  protected getMinimumTypeForValue(value: number): 'byte' | 'word' {
    return this.fitsInByte(value) ? 'byte' : 'word';
  }

  // ============================================
  // SCOPE MANAGEMENT
  // ============================================

  /**
   * Enters a new scope during traversal
   *
   * @param scopeName - The scope name to enter
   */
  protected enterScope(scopeName: string): void {
    const scope = this.symbolTable.getScope(scopeName);
    if (scope) {
      this.currentScope = scope;
    }
  }

  /**
   * Enters a child scope that was created for a specific AST node
   *
   * Used for entering loop scopes, block scopes, etc. that don't have
   * predictable names like function scopes do.
   *
   * @param node - The AST node that created the scope
   * @returns True if the scope was found and entered
   */
  protected enterChildScopeForNode(node: unknown): boolean {
    if (!this.currentScope) {
      return false;
    }

    // Find child scope where the node matches
    for (const childScope of this.currentScope.children) {
      if (childScope.node === node) {
        this.currentScope = childScope;
        return true;
      }
    }

    return false;
  }

  /**
   * Enters the Nth child scope that was created for a specific AST node
   *
   * Used when multiple scopes are created for the same node (e.g., if statement
   * creates separate scopes for then and else branches, both with the same
   * node reference).
   *
   * @param node - The AST node that created the scopes
   * @param index - The zero-based index of which matching scope to enter
   * @returns True if the scope was found and entered
   *
   * @example
   * ```typescript
   * // For if statements with then and else branches:
   * this.enterChildScopeByNodeIndex(ifNode, 0);  // Enter then scope
   * // ... type check then branch ...
   * this.exitScope();
   *
   * this.enterChildScopeByNodeIndex(ifNode, 1);  // Enter else scope
   * // ... type check else branch ...
   * this.exitScope();
   * ```
   */
  protected enterChildScopeByNodeIndex(node: unknown, index: number): boolean {
    if (!this.currentScope) {
      return false;
    }

    // Find the Nth child scope where the node matches
    let matchCount = 0;
    for (const childScope of this.currentScope.children) {
      if (childScope.node === node) {
        if (matchCount === index) {
          this.currentScope = childScope;
          return true;
        }
        matchCount++;
      }
    }

    return false;
  }

  /**
   * Exits the current scope during traversal
   */
  protected exitScope(): void {
    if (this.currentScope?.parent) {
      this.currentScope = this.currentScope.parent;
    }
  }

  // ============================================
  // RESULT FINALIZATION
  // ============================================

  /**
   * Finalize the type checking pass and return the result
   *
   * Creates the TypeCheckPassResult with all statistics and diagnostics.
   *
   * @returns The type checking pass result
   */
  protected finalizeResult(): TypeCheckPassResult {
    return {
      success: this.errorCount === 0,
      diagnostics: this.diagnostics,
      expressionsChecked: this.expressionsChecked,
      errorCount: this.errorCount,
      warningCount: this.warningCount,
    };
  }

  // ============================================
  // ACCESSORS
  // ============================================

  /**
   * Gets the type system instance
   */
  public getTypeSystem(): TypeSystem {
    return this.typeSystem;
  }

  /**
   * Gets all collected diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  /**
   * Gets the expression type map (for testing)
   */
  public getExpressionTypeMap(): Map<Expression, TypeCheckResult> {
    return this.expressionTypes;
  }
}