/**
 * TypeChecker Statements Layer
 *
 * Statement-level semantic validation including:
 * - Break/continue validation (must be in loops)
 * - Return statement type checking
 * - Const assignment enforcement
 * - Expression statement validation
 * - Control flow context validation
 *
 * This layer extends TypeCheckerDeclarations and adds statement validation.
 */

import { TypeCheckerDeclarations } from './declarations.js';
import { TypeKind } from '../../types.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../../ast/diagnostics.js';
import type {
  WhileStatement,
  ForStatement,
  IfStatement,
  BreakStatement,
  ContinueStatement,
  ReturnStatement,
  ExpressionStatement,
} from '../../../ast/nodes.js';

/**
 * TypeCheckerStatements - Validates statement-level semantics
 *
 * Responsibilities:
 * - Validate break/continue appear only in loops
 * - Check return statement types match function signatures
 * - Enforce const assignment rules
 * - Validate control flow contexts
 * - Warn about expressions with no side effects
 *
 * **Design:**
 * - Extends TypeCheckerDeclarations (has full expression/declaration checking)
 * - Uses ContextWalker's context management for loop/function tracking
 * - Leverages TypeCheckerBase infrastructure (diagnostics, symbol table, type system)
 *
 * **Usage:**
 * This is an intermediate layer - TypeChecker extends this class.
 */
export abstract class TypeCheckerStatements extends TypeCheckerDeclarations {
  // All infrastructure inherited from base classes:
  // - this.context (from ContextWalker)
  // - this.symbolTable (from TypeCheckerBase)
  // - this.typeSystem (from TypeCheckerBase)
  // - this.diagnostics (from TypeCheckerBase)
  // - this.reportDiagnostic() (from TypeCheckerBase)

  // ============================================
  // LOOP STATEMENT VALIDATION
  // ============================================

  /**
   * Visit while statement
   *
   * Validates:
   * - Condition is type-checked (boolean-compatible)
   * - Body statements are validated
   *
   * Note: Loop context is automatically managed by ContextWalker
   */
  public visitWhileStatement(node: WhileStatement): void {
    // Type check condition
    const conditionType = this.typeCheckExpression(node.getCondition());

    // Verify condition is boolean-compatible (byte, word, or boolean)
    // In 6502 context, any non-zero value is true
    if (
      conditionType.kind !== TypeKind.Boolean &&
      conditionType.kind !== TypeKind.Byte &&
      conditionType.kind !== TypeKind.Word &&
      conditionType.kind !== TypeKind.Unknown
    ) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `While condition must be boolean-compatible, got '${conditionType.name}'`,
        location: node.getCondition().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }

    // Visit body (context automatically managed by ContextWalker)
    super.visitWhileStatement(node);
  }

  /**
   * Visit for statement
   *
   * Validates:
   * - Variable and range expressions are type-checked
   * - Body statements are validated
   *
   * Note: Loop context is automatically managed by ContextWalker
   */
  public visitForStatement(node: ForStatement): void {
    // Type check start and end expressions
    const startType = this.typeCheckExpression(node.getStart());
    const endType = this.typeCheckExpression(node.getEnd());

    // Start and end must be numeric
    if (!this.isNumericType(startType) && startType.kind !== TypeKind.Unknown) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `For loop start must be numeric, got '${startType.name}'`,
        location: node.getStart().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }

    if (!this.isNumericType(endType) && endType.kind !== TypeKind.Unknown) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `For loop end must be numeric, got '${endType.name}'`,
        location: node.getEnd().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }

    // Visit body (context automatically managed by ContextWalker)
    super.visitForStatement(node);
  }

  /**
   * Visit if statement
   *
   * Validates:
   * - Condition is type-checked (boolean-compatible)
   * - Then and else branches are validated
   */
  public visitIfStatement(node: IfStatement): void {
    // Type check condition
    const conditionType = this.typeCheckExpression(node.getCondition());

    // Verify condition is boolean-compatible
    if (
      conditionType.kind !== TypeKind.Boolean &&
      conditionType.kind !== TypeKind.Byte &&
      conditionType.kind !== TypeKind.Word &&
      conditionType.kind !== TypeKind.Unknown
    ) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `If condition must be boolean-compatible, got '${conditionType.name}'`,
        location: node.getCondition().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }

    // Visit branches
    super.visitIfStatement(node);
  }

  // ============================================
  // BREAK AND CONTINUE VALIDATION
  // ============================================

  /**
   * Visit break statement
   *
   * Validates:
   * - Break must be inside a loop context
   *
   * Uses ContextWalker's context tracking to verify loop context.
   */
  public visitBreakStatement(node: BreakStatement): void {
    // Check if we're in a loop (without crossing function boundary)
    if (!this.context.isInLoopWithoutFunctionBoundary()) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: 'Break statement must be inside a loop',
        location: node.getLocation(),
        code: DiagnosticCode.UNEXPECTED_TOKEN,
      });
    }

    // Call super to allow base walker to continue
    super.visitBreakStatement(node);
  }

  /**
   * Visit continue statement
   *
   * Validates:
   * - Continue must be inside a loop context
   *
   * Uses ContextWalker's context tracking to verify loop context.
   */
  public visitContinueStatement(node: ContinueStatement): void {
    // Check if we're in a loop (without crossing function boundary)
    if (!this.context.isInLoopWithoutFunctionBoundary()) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: 'Continue statement must be inside a loop',
        location: node.getLocation(),
        code: DiagnosticCode.UNEXPECTED_TOKEN,
      });
    }

    // Call super to allow base walker to continue
    super.visitContinueStatement(node);
  }

  // ============================================
  // RETURN STATEMENT VALIDATION
  // ============================================

  /**
   * Visit return statement
   *
   * Validates:
   * - Return must be inside a function
   * - Return type must match function's return type
   */
  public visitReturnStatement(node: ReturnStatement): void {
    // Check if we're in a function
    if (!this.context.isInFunction()) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: 'Return statement must be inside a function',
        location: node.getLocation(),
        code: DiagnosticCode.UNEXPECTED_TOKEN,
      });
      super.visitReturnStatement(node);
      return;
    }

    // Get the return value (if any)
    const returnValue = node.getValue();
    const functionReturnType = this.currentFunctionReturnType;

    // If function has no return type (void), ensure no return value
    if (!functionReturnType || functionReturnType.kind === TypeKind.Void) {
      if (returnValue) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: 'Void function cannot return a value',
          location: returnValue.getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }
      super.visitReturnStatement(node);
      return;
    }

    // If function has return type, ensure return value exists
    if (!returnValue) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Function must return a value of type '${functionReturnType.name}'`,
        location: node.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
      super.visitReturnStatement(node);
      return;
    }

    // Type check the return value
    const returnValueType = this.typeCheckExpression(returnValue);

    // Check type compatibility
    if (!this.typeSystem.canAssign(returnValueType, functionReturnType)) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Cannot return type '${returnValueType.name}' from function with return type '${functionReturnType.name}'`,
        location: returnValue.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }

    // Call super to allow base walker to continue
    super.visitReturnStatement(node);
  }

  // ============================================
  // EXPRESSION STATEMENT VALIDATION
  // ============================================

  /**
   * Visit expression statement
   *
   * Validates:
   * - Expression is type-checked
   * - Warns about expressions with no side effects
   *
   * Note: This overrides the base implementation to add side-effect checking
   */
  public visitExpressionStatement(node: ExpressionStatement): void {
    const expr = node.getExpression();

    // Type check the expression
    this.typeCheckExpression(expr);

    // Check for expressions with no side effects (warning)
    if (this.hasNoSideEffects(expr)) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.WARNING,
        message: 'Expression statement has no effect',
        location: expr.getLocation(),
        code: DiagnosticCode.UNREACHABLE_CODE,
      });
    }

    // Call super to allow base walker to continue
    super.visitExpressionStatement(node);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Check if an expression has side effects
   *
   * Expressions with NO side effects:
   * - Literals (numbers, booleans, strings)
   * - Identifiers (just reading a variable)
   * - Pure binary/unary operations (no assignment)
   *
   * Expressions WITH side effects:
   * - Assignments
   * - Function calls
   * - Increment/decrement
   *
   * @param expr - Expression to check
   * @returns True if expression has NO side effects
   */
  protected hasNoSideEffects(expr: any): boolean {
    const nodeType = expr.getNodeType();

    // Literals have no side effects
    if (nodeType === 'LiteralExpression' || nodeType === 'ArrayLiteralExpression') {
      return true;
    }

    // Identifiers have no side effects (just reading)
    if (nodeType === 'IdentifierExpression') {
      return true;
    }

    // Binary expressions (unless they're assignments)
    if (nodeType === 'BinaryExpression') {
      const binary = expr as any;
      return this.hasNoSideEffects(binary.getLeft()) && this.hasNoSideEffects(binary.getRight());
    }

    // Unary expressions (except address-of which might be used)
    if (nodeType === 'UnaryExpression') {
      const unary = expr as any;
      // Address-of operator might be used for side effects
      if (unary.getOperator().type === 'ADDRESS') {
        return false;
      }
      return this.hasNoSideEffects(unary.getOperand());
    }

    // Everything else has side effects
    // (assignments, calls, member access, etc.)
    return false;
  }
}
