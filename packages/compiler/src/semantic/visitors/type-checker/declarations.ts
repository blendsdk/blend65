/**
 * TypeChecker Declarations Layer
 *
 * Handles type checking for declarations:
 * - Variable declarations (type checking initializers)
 * - Function declarations (scope management)
 * - Memory-mapped declarations (@map - all 4 forms)
 * - Expression statements
 */

import { TypeCheckerAssignments } from './assignments.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../../ast/diagnostics.js';
import { isVariableDecl } from '../../../ast/type-guards.js';

/**
 * TypeCheckerDeclarations - Type checks declarations and statements
 *
 * Implements:
 * - visitFunctionDecl (scope management)
 * - visitVariableDecl (initializer checking)
 * - visitSimpleMapDecl (@map at address)
 * - visitRangeMapDecl (@map from/to)
 * - visitSequentialStructMapDecl (@map type)
 * - visitExplicitStructMapDecl (@map layout)
 * - visitExpressionStatement (statement-level expressions)
 */
export abstract class TypeCheckerDeclarations extends TypeCheckerAssignments {
  // ============================================
  // HELPER METHODS - Scope Lookup
  // ============================================

  /**
   * Find function scope recursively
   *
   * Searches the scope tree for a scope with the given function as its node.
   * Supports both top-level functions (direct children) and nested functions
   * (deeper in the scope tree).
   *
   * @param parentScope - Scope to start searching from
   * @param node - Function declaration node to find scope for
   * @returns Function scope if found, undefined otherwise
   */
  protected findFunctionScope(parentScope: any, node: any): any {
    // Check direct children first
    const children = parentScope.children || [];
    for (const child of children) {
      if (child.node === node) {
        return child;
      }
    }

    // Recursively search child scopes (for nested functions)
    for (const child of children) {
      const found = this.findFunctionScope(child, node);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  // ============================================
  // DECLARATIONS - Function & Variable
  // ============================================

  /**
   * Visit FunctionDecl - manage scope and type check function
   *
   * This method:
   * 1. Looks up the function's scope created in Phase 1
   * 2. Enters that scope (parameters are already declared there)
   * 3. Delegates to parent to handle context and body traversal
   * 4. Exits the scope after body is processed
   *
   * **Critical:** This synchronizes with SymbolTable's scope hierarchy.
   * Without this, function parameters won't be visible during type checking.
   */
  public visitFunctionDecl(node: any): void {
    if (this.shouldStop) return;

    // Find the function's scope created in Phase 1
    // The scope should have this function's node as its owner
    // Use recursive search to support nested functions
    const currentScope = this.symbolTable.getCurrentScope();
    const functionScope = this.findFunctionScope(currentScope, node);

    if (!functionScope) {
      // This shouldn't happen if Phase 1 ran correctly, but handle gracefully
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Internal error: Function scope not found for '${node.getName()}'`,
        location: node.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });

      // Still call parent to maintain context tracking
      super.visitFunctionDecl(node);
      return;
    }

    // Get the function's return type from the symbol (BEFORE entering scope)
    // The function symbol is in the module scope, not the function's own scope
    const symbol = this.symbolTable.lookup(node.getName());
    const prevReturnType = this.currentFunctionReturnType;

    // Extract return type from Callback type (stored in signature.returnType)
    if (symbol?.type && (symbol.type as any).signature?.returnType) {
      this.currentFunctionReturnType = (symbol.type as any).signature.returnType;
    } else {
      this.currentFunctionReturnType = null;
    }

    // Enter function scope (parameters are already declared in this scope)
    this.symbolTable.enterScope(functionScope);

    // Call parent to handle context management and body traversal
    // This will:
    // - Enter FUNCTION context
    // - Call enterNode(node)
    // - Visit all body statements (which will call our visitors)
    // - Call exitNode(node)
    // - Exit FUNCTION context
    super.visitFunctionDecl(node);

    // Restore previous return type
    this.currentFunctionReturnType = prevReturnType;

    // Exit function scope
    this.symbolTable.exitScope();
  }

  /**
   * Visit VariableDecl - type check initializer
   *
   * Type checks the initializer expression if present and validates
   * that its type is assignable to the variable's declared type.
   *
   * Uses type guard for proper TypeScript type checking.
   *
   * Validates:
   * - Initializer type matches declared type
   * - Type widening (byte → word) is allowed
   * - Type narrowing (word → byte) is rejected
   */
  public visitVariableDecl(node: any): void {
    // Only process actual VariableDecl nodes using type guard
    // This ensures proper type narrowing and safety
    if (!isVariableDecl(node)) {
      return;
    }

    const varName = node.getName();

    // Skip error recovery nodes (parser creates nodes with name "error")
    if (!varName || varName === 'error') {
      return;
    }

    // Get symbol from symbol table (created in Phase 1, type resolved in Phase 2)
    const symbol = this.symbolTable.lookup(varName);

    if (!symbol) {
      // Error already reported in Phase 1
      return;
    }

    // Type check initializer if present
    const initializer = node.getInitializer();
    if (initializer) {
      const initType = this.typeCheckExpression(initializer);

      // Check if type checking succeeded
      if (!initType || !initType.name) {
        // Type checking failed - error already reported, skip further checks
        return;
      }

      // If symbol has explicit type (from Phase 2), check compatibility
      if (symbol.type) {
        // Check type compatibility between initializer and declared type
        if (!this.typeSystem.canAssign(initType, symbol.type)) {
          this.reportDiagnostic({
            severity: DiagnosticSeverity.ERROR,
            message: `Type mismatch in variable initialization: cannot assign '${initType.name}' to '${symbol.type.name}'`,
            location: initializer.getLocation(),
            code: DiagnosticCode.TYPE_MISMATCH,
          });
        }
      } else {
        // No explicit type annotation - infer type from initializer
        symbol.type = initType;
      }
    } else if (!symbol.type) {
      // No initializer and no type annotation - error
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Variable '${node.getName()}' must have either a type annotation or an initializer`,
        location: node.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }
  }

  // ============================================
  // MEMORY-MAPPED DECLARATIONS (@map)
  // ============================================

  /**
   * Visit SimpleMapDecl - type check simple @map declaration
   *
   * Validates:
   * - Address expression is numeric (word type)
   *
   * Example: @map borderColor at $D020: byte;
   */
  public visitSimpleMapDecl(node: any): void {
    // Type check address expression
    const addressType = this.typeCheckExpression(node.getAddress());

    // Address must be numeric (byte or word, preferably word for full address space)
    if (!this.isNumericType(addressType)) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `@map address must be numeric (word), got '${addressType.name}'`,
        location: node.getAddress().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }
  }

  /**
   * Visit RangeMapDecl - type check range @map declaration
   *
   * Validates:
   * - Start address expression is numeric (word type)
   * - End address expression is numeric (word type)
   *
   * Example: @map sprites from $D000 to $D02E: byte;
   */
  public visitRangeMapDecl(node: any): void {
    // Type check start address expression
    const startType = this.typeCheckExpression(node.getStartAddress());

    if (!this.isNumericType(startType)) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `@map start address must be numeric (word), got '${startType.name}'`,
        location: node.getStartAddress().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }

    // Type check end address expression
    const endType = this.typeCheckExpression(node.getEndAddress());

    if (!this.isNumericType(endType)) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `@map end address must be numeric (word), got '${endType.name}'`,
        location: node.getEndAddress().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }
  }

  /**
   * Visit SequentialStructMapDecl - type check sequential struct @map
   *
   * Validates:
   * - Base address expression is numeric (word type)
   *
   * Example:
   * @map sid at $D400 type
   *   voice1Freq: word;
   *   voice1Control: byte;
   * end @map
   */
  public visitSequentialStructMapDecl(node: any): void {
    // Type check base address expression
    const baseType = this.typeCheckExpression(node.getBaseAddress());

    if (!this.isNumericType(baseType)) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `@map base address must be numeric (word), got '${baseType.name}'`,
        location: node.getBaseAddress().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }

    // Fields are type-checked in Phase 2 (TypeResolver)
    // No additional validation needed here
  }

  /**
   * Visit ExplicitStructMapDecl - type check explicit struct @map
   *
   * Validates:
   * - Base address expression is numeric (word type)
   * - All field address/offset expressions are numeric
   *
   * Example:
   * @map vic at $D000 layout
   *   borderColor at 0: byte;
   *   bgColor at 1: byte;
   *   sprites at 16: byte[8];
   * end @map
   */
  public visitExplicitStructMapDecl(node: any): void {
    // Type check base address expression
    const baseType = this.typeCheckExpression(node.getBaseAddress());

    if (!this.isNumericType(baseType)) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `@map base address must be numeric (word), got '${baseType.name}'`,
        location: node.getBaseAddress().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }

    // Type check each field's address specification
    const fields = node.getFields();
    for (const field of fields) {
      const addressSpec = field.addressSpec;

      if (addressSpec.kind === 'single') {
        // Single address: field at <address>
        const addrType = this.typeCheckExpression(addressSpec.address);
        if (!this.isNumericType(addrType)) {
          this.reportDiagnostic({
            severity: DiagnosticSeverity.ERROR,
            message: `@map field offset must be numeric (word), got '${addrType.name}'`,
            location: field.location,
            code: DiagnosticCode.TYPE_MISMATCH,
          });
        }
      } else if (addressSpec.kind === 'range') {
        // Range: field from <start> to <end>
        const startType = this.typeCheckExpression(addressSpec.startAddress);
        if (!this.isNumericType(startType)) {
          this.reportDiagnostic({
            severity: DiagnosticSeverity.ERROR,
            message: `@map field start offset must be numeric (word), got '${startType.name}'`,
            location: field.location,
            code: DiagnosticCode.TYPE_MISMATCH,
          });
        }

        const endType = this.typeCheckExpression(addressSpec.endAddress);
        if (!this.isNumericType(endType)) {
          this.reportDiagnostic({
            severity: DiagnosticSeverity.ERROR,
            message: `@map field end offset must be numeric (word), got '${endType.name}'`,
            location: field.location,
            code: DiagnosticCode.TYPE_MISMATCH,
          });
        }
      }
    }
  }

  // ============================================
  // STATEMENTS - Expression Statement
  // ============================================

  /**
   * Visit ExpressionStatement - type check the expression
   *
   * This is the entry point for type checking expressions in statement position.
   */
  public visitExpressionStatement(node: any): void {
    // Type check the expression
    this.typeCheckExpression(node.getExpression());
  }
}