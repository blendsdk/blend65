/**
 * Scope Manager for Blend65 Parser
 *
 * Centralized scope tracking for the parser, managing:
 * - Function scopes with parameters and local variables
 * - Loop scopes for break/continue validation
 * - Variable lookup across scope chain
 * - Return type tracking for function validation
 *
 * This class provides a single source of truth for all scope-related
 * information during parsing, making scope management easier to test
 * and maintain.
 */

import { DiagnosticCode, Parameter, SourceLocation } from '../ast/index.js';

/**
 * Scope types for tracking context
 */
export enum ScopeType {
  FUNCTION = 'function',
  LOOP = 'loop',
}

/**
 * Information about a scope in the scope stack
 */
interface ScopeInfo {
  type: ScopeType;
  functionName?: string; // For function scopes: function name for error messages
  returnType?: string | null; // For function scopes
  variables?: Map<string, string>; // For function scopes: name -> type
}

/**
 * Callback type for reporting errors during scope operations
 */
export type ErrorReporter = (
  code: DiagnosticCode,
  message: string,
  location?: SourceLocation
) => void;

/**
 * ScopeManager - Centralized scope tracking for parser
 *
 * Manages the scope stack during parsing, tracking:
 * - Function scopes with parameters, local variables, and return types
 * - Loop scopes for break/continue validation
 * - Nested scope relationships
 *
 * Design:
 * - Uses a single stack of ScopeInfo objects
 * - Each scope records its type (function or loop)
 * - Function scopes track variables and return types
 * - Loop scopes track nesting for validation
 * - Provides queries for scope context (in function? in loop?)
 *
 * Usage:
 * ```typescript
 * const scopeManager = new ScopeManager(errorReporter);
 *
 * // Entering function
 * scopeManager.enterFunctionScope(params, 'word');
 * scopeManager.addLocalVariable('temp', 'byte', location);
 * const type = scopeManager.lookupVariable('temp'); // 'byte'
 *
 * // Entering loop
 * scopeManager.enterLoopScope();
 * const inLoop = scopeManager.isInLoop(); // true
 * scopeManager.exitLoopScope();
 *
 * // Exiting function
 * scopeManager.exitFunctionScope();
 * ```
 */
export class ScopeManager {
  /**
   * Stack of scopes (function and loop)
   * Innermost scope is at the end of the array
   */
  protected scopes: ScopeInfo[] = [];

  /**
   * Error reporter callback for validation errors
   */
  protected reportError: ErrorReporter;

  /**
   * Create a new ScopeManager
   *
   * @param errorReporter Callback for reporting validation errors
   */
  constructor(errorReporter: ErrorReporter) {
    this.reportError = errorReporter;
  }

  // ============================================
  // FUNCTION SCOPE MANAGEMENT
  // ============================================

  /**
   * Enter a new function scope with parameters
   *
   * Creates a new function scope and adds all parameters as local variables.
   * Validates for duplicate parameter names and reports errors.
   *
   * @param parameters Function parameters to add to scope
   * @param returnType Expected return type for validation (null for void)
   * @param functionName Optional function name for error messages (Task 3.3)
   */
  public enterFunctionScope(
    parameters: Parameter[],
    returnType: string | null,
    functionName?: string
  ): void {
    const scope: ScopeInfo = {
      type: ScopeType.FUNCTION,
      functionName,
      returnType,
      variables: new Map<string, string>(),
    };

    // Add parameters to scope, checking for duplicates
    for (const param of parameters) {
      if (scope.variables!.has(param.name)) {
        this.reportError(
          DiagnosticCode.DUPLICATE_DECLARATION,
          `Duplicate parameter '${param.name}'`,
          param.location
        );
      } else {
        scope.variables!.set(param.name, param.typeAnnotation);
      }
    }

    this.scopes.push(scope);
  }

  /**
   * Exit the current function scope
   *
   * Removes the innermost function scope from the stack.
   * Reports error if not currently in a function scope.
   */
  public exitFunctionScope(): void {
    // Find and remove innermost function scope
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].type === ScopeType.FUNCTION) {
        this.scopes.splice(i, 1);
        return;
      }
    }

    // Error: No function scope to exit
    this.reportError(
      DiagnosticCode.UNEXPECTED_TOKEN,
      'Internal error: Attempting to exit function scope when not in function'
    );
  }

  /**
   * Add a local variable to the current function scope
   *
   * Adds a variable to the innermost function scope. Reports error if:
   * - Not currently in a function scope
   * - Variable already declared in current scope
   *
   * @param name Variable name
   * @param type Variable type annotation
   * @param location Source location for error reporting
   */
  public addLocalVariable(name: string, type: string, location: SourceLocation): void {
    const functionScope = this.getCurrentFunctionScope();

    if (!functionScope) {
      // Not in function scope - this would be a module-level variable
      // which shouldn't be added through this method
      return;
    }

    if (functionScope.variables!.has(name)) {
      this.reportError(
        DiagnosticCode.DUPLICATE_DECLARATION,
        `Variable '${name}' already declared in this scope`,
        location
      );
    } else {
      functionScope.variables!.set(name, type);
    }
  }

  /**
   * Look up a variable in the scope chain
   *
   * Searches from innermost to outermost function scope for the variable.
   * Returns the variable's type if found, null if not found.
   *
   * Note: Only searches function scopes, not loop scopes (loops don't
   * introduce new variable scopes in Blend65).
   *
   * @param name Variable name to look up
   * @returns Variable type if found, null otherwise
   */
  public lookupVariable(name: string): string | null {
    // Search from innermost to outermost scope
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const scope = this.scopes[i];

      // Only function scopes have variables
      if (scope.type === ScopeType.FUNCTION && scope.variables) {
        if (scope.variables.has(name)) {
          return scope.variables.get(name) || null;
        }
      }
    }

    // Not found in any function scope
    return null;
  }

  /**
   * Check if currently inside a function scope
   *
   * @returns True if inside any function scope, false otherwise
   */
  public isInFunction(): boolean {
    return this.scopes.some(scope => scope.type === ScopeType.FUNCTION);
  }

  /**
   * Get the current function's return type
   *
   * Returns the return type of the innermost function scope.
   * Returns null if not in a function scope.
   *
   * @returns Return type of current function, or null if not in function
   */
  public getCurrentFunctionReturnType(): string | null {
    const functionScope = this.getCurrentFunctionScope();
    return functionScope?.returnType ?? null;
  }

  /**
   * Get the current function's name (Task 3.3)
   *
   * Returns the name of the innermost function scope for error messages.
   * Returns placeholder if not in a function scope or name not tracked.
   *
   * @returns Function name or placeholder
   */
  public getCurrentFunctionName(): string {
    const functionScope = this.getCurrentFunctionScope();
    return functionScope?.functionName ?? '<function>';
  }

  /**
   * Get the innermost function scope
   *
   * @returns The innermost function scope, or undefined if not in function
   */
  protected getCurrentFunctionScope(): ScopeInfo | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].type === ScopeType.FUNCTION) {
        return this.scopes[i];
      }
    }
    return undefined;
  }

  // ============================================
  // LOOP SCOPE MANAGEMENT
  // ============================================

  /**
   * Enter a new loop scope
   *
   * Used for tracking loop context to validate break/continue statements.
   * Loop scopes can be nested inside function scopes and other loop scopes.
   */
  public enterLoopScope(): void {
    this.scopes.push({
      type: ScopeType.LOOP,
    });
  }

  /**
   * Exit the current loop scope
   *
   * Removes the innermost loop scope from the stack.
   * Reports error if not currently in a loop scope.
   */
  public exitLoopScope(): void {
    // Find and remove innermost loop scope
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].type === ScopeType.LOOP) {
        this.scopes.splice(i, 1);
        return;
      }
    }

    // Error: No loop scope to exit
    this.reportError(
      DiagnosticCode.UNEXPECTED_TOKEN,
      'Internal error: Attempting to exit loop scope when not in loop'
    );
  }

  /**
   * Check if currently inside a loop scope
   *
   * Used for validating break/continue statements.
   * Returns true if inside any loop, even if nested inside function.
   *
   * @returns True if inside any loop scope, false otherwise
   */
  public isInLoop(): boolean {
    return this.scopes.some(scope => scope.type === ScopeType.LOOP);
  }

  /**
   * Check if currently inside a loop scope without crossing function boundary
   *
   * This is the correct validation for break/continue statements.
   * Returns false if there's a function scope between current position and
   * the nearest loop scope.
   *
   * Edge case example (should return false):
   * ```
   * while condition
   *   function nested()
   *     break;  // ERROR: function boundary crossed
   *   end function
   * end while
   * ```
   *
   * @returns True if in loop AND no function boundary crossed, false otherwise
   */
  public isInLoopWithoutFunctionBoundary(): boolean {
    // Search from innermost to outermost scope
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const scope = this.scopes[i];

      // Found a loop - we're good!
      if (scope.type === ScopeType.LOOP) {
        return true;
      }

      // Found a function before finding a loop - crossed boundary
      if (scope.type === ScopeType.FUNCTION) {
        return false;
      }
    }

    // No loop found at all
    return false;
  }

  /**
   * Get the loop nesting level
   *
   * Counts how many loop scopes are currently active.
   * Useful for diagnostic messages and validation.
   *
   * @returns Number of nested loop scopes
   */
  public getLoopNestingLevel(): number {
    return this.scopes.filter(scope => scope.type === ScopeType.LOOP).length;
  }

  // ============================================
  // DEBUGGING AND TESTING HELPERS
  // ============================================

  /**
   * Get the current scope stack depth
   *
   * Useful for testing and debugging.
   *
   * @returns Total number of active scopes
   */
  public getScopeDepth(): number {
    return this.scopes.length;
  }

  /**
   * Reset all scopes
   *
   * Clears the scope stack. Useful for error recovery or testing.
   */
  public reset(): void {
    this.scopes = [];
  }

  /**
   * Get a snapshot of current scope stack for debugging
   *
   * Returns a read-only representation of the scope stack.
   * Useful for testing and debugging.
   *
   * @returns Array of scope type names from outermost to innermost
   */
  public getScopeStack(): string[] {
    return this.scopes.map(scope => scope.type);
  }
}
