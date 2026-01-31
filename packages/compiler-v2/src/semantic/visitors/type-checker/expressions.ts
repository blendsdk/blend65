/**
 * Expression Type Checker for Blend65 Compiler v2
 *
 * Extends LiteralTypeChecker to add type checking for all expression types:
 * - Identifier expressions (variable references)
 * - Binary expressions (a + b, x && y)
 * - Unary expressions (-x, !flag, ~mask)
 * - Call expressions (foo(), add(1, 2))
 * - Index expressions (array[i])
 * - Ternary expressions (a ? b : c)
 * - Assignment expressions (x = 5, counter += 1)
 *
 * This is the third layer of the type checker inheritance chain:
 * TypeCheckerBase → LiteralTypeChecker → ExpressionTypeChecker → ...
 *
 * @module semantic/visitors/type-checker/expressions
 */

import type {
  IdentifierExpression,
  BinaryExpression,
  UnaryExpression,
  CallExpression,
  IndexExpression,
  TernaryExpression,
  AssignmentExpression,
  Expression,
} from '../../../ast/index.js';
import { TokenType } from '../../../lexer/types.js';
import { LiteralTypeChecker } from './literals.js';
import { TypeCheckDiagnosticCodes } from './base.js';
import type { TypeInfo } from '../../types.js';
import { TypeKind } from '../../types.js';
import { DiagnosticCode } from '../../../ast/diagnostics.js';

/**
 * Maps TokenType operators to string operators for TypeSystem
 */
const BINARY_OPERATOR_MAP: Record<string, string> = {
  // Arithmetic
  [TokenType.PLUS]: '+',
  [TokenType.MINUS]: '-',
  [TokenType.MULTIPLY]: '*',
  [TokenType.DIVIDE]: '/',
  [TokenType.MODULO]: '%',
  // Comparison
  [TokenType.EQUAL]: '==',
  [TokenType.NOT_EQUAL]: '!=',
  [TokenType.LESS_THAN]: '<',
  [TokenType.LESS_EQUAL]: '<=',
  [TokenType.GREATER_THAN]: '>',
  [TokenType.GREATER_EQUAL]: '>=',
  // Logical
  [TokenType.AND]: '&&',
  [TokenType.OR]: '||',
  // Bitwise
  [TokenType.BITWISE_AND]: '&',
  [TokenType.BITWISE_OR]: '|',
  [TokenType.BITWISE_XOR]: '^',
  [TokenType.LEFT_SHIFT]: '<<',
  [TokenType.RIGHT_SHIFT]: '>>',
  // Assignment
  [TokenType.ASSIGN]: '=',
  [TokenType.PLUS_ASSIGN]: '+=',
  [TokenType.MINUS_ASSIGN]: '-=',
  [TokenType.MULTIPLY_ASSIGN]: '*=',
  [TokenType.DIVIDE_ASSIGN]: '/=',
  [TokenType.MODULO_ASSIGN]: '%=',
  [TokenType.BITWISE_AND_ASSIGN]: '&=',
  [TokenType.BITWISE_OR_ASSIGN]: '|=',
  [TokenType.BITWISE_XOR_ASSIGN]: '^=',
  [TokenType.LEFT_SHIFT_ASSIGN]: '<<=',
  [TokenType.RIGHT_SHIFT_ASSIGN]: '>>=',
};

/**
 * Maps TokenType unary operators to string operators for TypeSystem
 */
const UNARY_OPERATOR_MAP: Record<string, string> = {
  [TokenType.MINUS]: '-',
  [TokenType.PLUS]: '+',
  [TokenType.NOT]: '!',
  [TokenType.BITWISE_NOT]: '~',
  [TokenType.AT]: '@',
};

/**
 * Expression Type Checker - Type checking for all expression types
 *
 * Handles type checking for complex expressions beyond literals:
 *
 * **Identifier Expressions:**
 * - Looks up symbol in symbol table
 * - Returns the symbol's resolved type
 * - Reports error for undefined variables
 *
 * **Binary Expressions:**
 * - Checks operand types are compatible with operator
 * - Returns result type based on operator rules
 * - Handles arithmetic, comparison, logical, bitwise operators
 *
 * **Unary Expressions:**
 * - Checks operand type is valid for operator
 * - Returns result type based on operator
 * - Handles -, +, !, ~, @ operators
 *
 * **Call Expressions:**
 * - Verifies callee is a function type
 * - Checks argument count matches parameter count
 * - Checks argument types are compatible with parameters
 * - Returns function's return type
 *
 * **Index Expressions:**
 * - Verifies object is an array type
 * - Verifies index is numeric (byte or word)
 * - Returns array's element type
 *
 * **Ternary Expressions:**
 * - Checks condition is boolean-like
 * - Checks both branches have compatible types
 * - Returns common type of both branches
 *
 * **Assignment Expressions:**
 * - Verifies target is a valid lvalue
 * - Checks value type is assignable to target type
 * - Returns the assigned type
 *
 * @example
 * ```typescript
 * class MyChecker extends ExpressionTypeChecker {
 *   // Override to add custom expression checking
 *   override visitBinaryExpression(node: BinaryExpression): void {
 *     super.visitBinaryExpression(node);
 *     // Custom logic here
 *   }
 * }
 * ```
 */
export abstract class ExpressionTypeChecker extends LiteralTypeChecker {
  // ============================================
  // IDENTIFIER EXPRESSION
  // ============================================

  /**
   * Type check an identifier expression
   *
   * Looks up the identifier in the symbol table and returns its type.
   * Reports an error if the identifier is not defined.
   *
   * @param node - The identifier expression node
   */
  override visitIdentifierExpression(node: IdentifierExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const name = node.getName();
    const symbolType = this.lookupSymbolType(name);

    if (symbolType) {
      // Found symbol - use its type
      // Identifiers are not constants (they can change at runtime)
      this.setExpressionType(node, symbolType, false);
    } else {
      // Symbol not found - report error
      this.reportUndefinedVariable(name, node.getLocation());
      this.setExpressionType(node, null, false);
    }

    this.exitNode(node);
  }

  // ============================================
  // BINARY EXPRESSION
  // ============================================

  /**
   * Type check a binary expression
   *
   * Checks that both operands have valid types for the operator,
   * and computes the result type.
   *
   * @param node - The binary expression node
   */
  override visitBinaryExpression(node: BinaryExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // First, type check both operands
    const left = node.getLeft();
    const right = node.getRight();

    left.accept(this);
    right.accept(this);

    // Get operand types
    const leftType = this.getTypeOf(left);
    const rightType = this.getTypeOf(right);

    // If either operand failed type checking, propagate the error
    if (!leftType || !rightType) {
      this.setExpressionType(node, null, false);
      this.exitNode(node);
      return;
    }

    // Get operator string
    const operator = node.getOperator();
    const opStr = BINARY_OPERATOR_MAP[operator] ?? operator;

    // Get result type from type system
    const resultType = this.typeSystem.getBinaryOperationType(leftType, rightType, opStr);

    if (resultType) {
      // Check for constant folding opportunity
      const leftResult = this.getExpressionType(left);
      const rightResult = this.getExpressionType(right);

      const isConstant = (leftResult?.isConstant ?? false) && (rightResult?.isConstant ?? false);
      let constantValue: number | boolean | undefined;

      if (isConstant && typeof leftResult?.constantValue === 'number' && typeof rightResult?.constantValue === 'number') {
        constantValue = this.evaluateBinaryOp(opStr, leftResult.constantValue, rightResult.constantValue);
      }

      this.setExpressionType(node, resultType, isConstant, constantValue);
    } else {
      // Invalid operator for these types
      this.reportError(
        TypeCheckDiagnosticCodes.INVALID_OPERAND as DiagnosticCode,
        `Operator '${opStr}' cannot be applied to types '${leftType.name}' and '${rightType.name}'`,
        node.getLocation(),
        `Expected compatible numeric or boolean types`
      );
      this.setExpressionType(node, null, false);
    }

    this.exitNode(node);
  }

  /**
   * Evaluates a binary operation at compile time for constant folding
   *
   * @param op - The operator string
   * @param left - Left operand value
   * @param right - Right operand value
   * @returns The computed value, or undefined if not computable
   */
  protected evaluateBinaryOp(op: string, left: number, right: number): number | boolean | undefined {
    switch (op) {
      // Arithmetic
      case '+':
        return (left + right) & 0xFFFF; // Clamp to 16-bit
      case '-':
        return (left - right) & 0xFFFF;
      case '*':
        return (left * right) & 0xFFFF;
      case '/':
        return right !== 0 ? Math.floor(left / right) : undefined;
      case '%':
        return right !== 0 ? left % right : undefined;
      // Comparison
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '<':
        return left < right;
      case '<=':
        return left <= right;
      case '>':
        return left > right;
      case '>=':
        return left >= right;
      // Bitwise
      case '&':
        return left & right;
      case '|':
        return left | right;
      case '^':
        return left ^ right;
      case '<<':
        return (left << right) & 0xFFFF;
      case '>>':
        return left >> right;
      // Logical (treat as numeric)
      case '&&':
        return left !== 0 && right !== 0;
      case '||':
        return left !== 0 || right !== 0;
      default:
        return undefined;
    }
  }

  // ============================================
  // UNARY EXPRESSION
  // ============================================

  /**
   * Type check a unary expression
   *
   * Checks that the operand has a valid type for the operator,
   * and computes the result type.
   *
   * @param node - The unary expression node
   */
  override visitUnaryExpression(node: UnaryExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // First, type check the operand
    const operand = node.getOperand();
    operand.accept(this);

    // Get operand type
    const operandType = this.getTypeOf(operand);

    if (!operandType) {
      this.setExpressionType(node, null, false);
      this.exitNode(node);
      return;
    }

    // Get operator string
    const operator = node.getOperator();
    const opStr = UNARY_OPERATOR_MAP[operator] ?? operator;

    // Get result type from type system
    const resultType = this.typeSystem.getUnaryOperationType(operandType, opStr);

    if (resultType) {
      // Check for constant folding
      const operandResult = this.getExpressionType(operand);
      const isConstant = operandResult?.isConstant ?? false;
      let constantValue: number | boolean | undefined;

      if (isConstant && typeof operandResult?.constantValue === 'number') {
        constantValue = this.evaluateUnaryOp(opStr, operandResult.constantValue);
      } else if (isConstant && typeof operandResult?.constantValue === 'boolean' && opStr === '!') {
        constantValue = !operandResult.constantValue;
      }

      this.setExpressionType(node, resultType, isConstant, constantValue);
    } else {
      this.reportError(
        TypeCheckDiagnosticCodes.INVALID_OPERAND as DiagnosticCode,
        `Operator '${opStr}' cannot be applied to type '${operandType.name}'`,
        node.getLocation(),
        `Expected numeric or boolean type`
      );
      this.setExpressionType(node, null, false);
    }

    this.exitNode(node);
  }

  /**
   * Evaluates a unary operation at compile time for constant folding
   *
   * @param op - The operator string
   * @param operand - Operand value
   * @returns The computed value, or undefined if not computable
   */
  protected evaluateUnaryOp(op: string, operand: number): number | boolean | undefined {
    switch (op) {
      case '-':
        return (-operand) & 0xFFFF;
      case '+':
        return operand;
      case '~':
        return (~operand) & 0xFFFF;
      case '!':
        return operand === 0;
      default:
        return undefined;
    }
  }

  // ============================================
  // CALL EXPRESSION
  // ============================================

  /**
   * Type check a call expression
   *
   * Verifies the callee is callable, checks argument count and types,
   * and returns the function's return type.
   *
   * @param node - The call expression node
   */
  override visitCallExpression(node: CallExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Type check the callee
    const callee = node.getCallee();
    callee.accept(this);

    const calleeType = this.getTypeOf(callee);

    if (!calleeType) {
      // Callee type check failed - propagate error
      this.setExpressionType(node, null, false);
      this.exitNode(node);
      return;
    }

    // Check if callee is a function type
    if (!this.isFunctionType(calleeType)) {
      this.reportError(
        TypeCheckDiagnosticCodes.INVALID_OPERAND as DiagnosticCode,
        `Cannot call non-function type '${calleeType.name}'`,
        node.getLocation(),
        `Expression must be a function to be called`
      );
      this.setExpressionType(node, null, false);
      this.exitNode(node);
      return;
    }

    // Type check all arguments
    const args = node.getArguments();
    for (const arg of args) {
      if (this.shouldStop) break;
      arg.accept(this);
    }

    // Get function parameter types
    const paramTypes = calleeType.parameterTypes ?? [];
    const returnType = calleeType.returnType;

    // Check argument count
    if (args.length !== paramTypes.length) {
      this.reportError(
        TypeCheckDiagnosticCodes.TYPE_MISMATCH as DiagnosticCode,
        `Expected ${paramTypes.length} argument(s) but got ${args.length}`,
        node.getLocation(),
        `Function requires exactly ${paramTypes.length} argument(s)`
      );
      // Still return the return type even if argument count is wrong
      this.setExpressionType(node, returnType ?? null, false);
      this.exitNode(node);
      return;
    }

    // Check each argument type
    for (let i = 0; i < args.length; i++) {
      const argType = this.getTypeOf(args[i]);
      const paramType = paramTypes[i];

      if (argType && paramType && !this.canAssign(argType, paramType)) {
        this.reportTypeMismatch(paramType, argType, args[i].getLocation(), `argument ${i + 1}`);
      }
    }

    // Return the function's return type
    this.setExpressionType(node, returnType ?? null, false);

    this.exitNode(node);
  }

  // ============================================
  // INDEX EXPRESSION
  // ============================================

  /**
   * Type check an index expression
   *
   * Verifies the object is an array type and the index is numeric.
   * Returns the array's element type.
   *
   * @param node - The index expression node
   */
  override visitIndexExpression(node: IndexExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Type check object and index
    const object = node.getObject();
    const index = node.getIndex();

    object.accept(this);
    index.accept(this);

    const objectType = this.getTypeOf(object);
    const indexType = this.getTypeOf(index);

    if (!objectType) {
      this.setExpressionType(node, null, false);
      this.exitNode(node);
      return;
    }

    // Check if object is an array
    if (!this.isArrayType(objectType)) {
      this.reportError(
        TypeCheckDiagnosticCodes.INVALID_OPERAND as DiagnosticCode,
        `Cannot index non-array type '${objectType.name}'`,
        node.getLocation(),
        `Expression must be an array type to use index operator`
      );
      this.setExpressionType(node, null, false);
      this.exitNode(node);
      return;
    }

    // Check if index is numeric
    if (indexType && !this.isNumericType(indexType)) {
      this.reportError(
        TypeCheckDiagnosticCodes.INVALID_OPERAND as DiagnosticCode,
        `Array index must be numeric, got '${indexType.name}'`,
        node.getLocation(),
        `Expected byte or word type`
      );
      this.setExpressionType(node, null, false);
      this.exitNode(node);
      return;
    }

    // Return the element type
    const elementType = this.getArrayElementType(objectType);
    this.setExpressionType(node, elementType ?? null, false);

    this.exitNode(node);
  }

  // ============================================
  // TERNARY EXPRESSION
  // ============================================

  /**
   * Type check a ternary expression (condition ? then : else)
   *
   * Checks that the condition is boolean-like and both branches
   * have compatible types. Returns the common type.
   *
   * @param node - The ternary expression node
   */
  override visitTernaryExpression(node: TernaryExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    // Type check all three parts
    const condition = node.getCondition();
    const thenBranch = node.getThenBranch();
    const elseBranch = node.getElseBranch();

    condition.accept(this);
    thenBranch.accept(this);
    elseBranch.accept(this);

    const conditionType = this.getTypeOf(condition);
    const thenType = this.getTypeOf(thenBranch);
    const elseType = this.getTypeOf(elseBranch);

    // Check condition is boolean-like (bool, byte, or word)
    if (conditionType && !this.isBooleanLike(conditionType)) {
      this.reportError(
        TypeCheckDiagnosticCodes.TYPE_MISMATCH as DiagnosticCode,
        `Ternary condition must be boolean-like, got '${conditionType.name}'`,
        condition.getLocation(),
        `Expected bool, byte, or word type`
      );
    }

    // If either branch failed, propagate
    if (!thenType || !elseType) {
      this.setExpressionType(node, thenType ?? elseType ?? null, false);
      this.exitNode(node);
      return;
    }

    // Check branch type compatibility and determine result type
    const resultType = this.getCommonType(thenType, elseType);

    if (!resultType) {
      this.reportError(
        TypeCheckDiagnosticCodes.TYPE_MISMATCH as DiagnosticCode,
        `Ternary branches have incompatible types: '${thenType.name}' and '${elseType.name}'`,
        node.getLocation(),
        `Both branches must have compatible types`
      );
      this.setExpressionType(node, null, false);
      this.exitNode(node);
      return;
    }

    // Check for constant folding
    const condResult = this.getExpressionType(condition);
    const thenResult = this.getExpressionType(thenBranch);
    const elseResult = this.getExpressionType(elseBranch);

    const isConstant =
      (condResult?.isConstant ?? false) &&
      (thenResult?.isConstant ?? false) &&
      (elseResult?.isConstant ?? false);

    let constantValue: number | string | boolean | undefined;
    if (isConstant && condResult?.constantValue !== undefined) {
      // Evaluate at compile time
      const condValue = this.toBooleanValue(condResult.constantValue);
      constantValue = condValue ? thenResult?.constantValue : elseResult?.constantValue;
    }

    this.setExpressionType(node, resultType, isConstant, constantValue);

    this.exitNode(node);
  }

  /**
   * Checks if a type is boolean-like (can be used as a condition)
   *
   * In Blend65, bool, byte, and word can all be used as conditions.
   * Zero is false, non-zero is true.
   */
  protected isBooleanLike(type: TypeInfo): boolean {
    return (
      type.kind === TypeKind.Bool ||
      type.kind === TypeKind.Byte ||
      type.kind === TypeKind.Word
    );
  }

  /**
   * Gets the common type between two types
   *
   * Used for ternary expressions to find the result type.
   * Returns the "wider" type that can hold both values.
   */
  protected getCommonType(a: TypeInfo, b: TypeInfo): TypeInfo | null {
    // Identical types
    if (this.areTypesEqual(a, b)) {
      return a;
    }

    // Numeric type widening
    if (this.isNumericType(a) && this.isNumericType(b)) {
      // Either is word -> word
      if (a.kind === TypeKind.Word || b.kind === TypeKind.Word) {
        return this.getBuiltinType('word')!;
      }
      // Both byte
      return this.getBuiltinType('byte')!;
    }

    // Bool and byte are compatible (both become byte)
    if (
      (a.kind === TypeKind.Bool && b.kind === TypeKind.Byte) ||
      (a.kind === TypeKind.Byte && b.kind === TypeKind.Bool)
    ) {
      return this.getBuiltinType('byte')!;
    }

    // Incompatible
    return null;
  }

  /**
   * Converts a value to boolean for condition evaluation
   */
  protected toBooleanValue(value: number | string | boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    return false;
  }

  // ============================================
  // ASSIGNMENT EXPRESSION
  // ============================================

  /**
   * Type check an assignment expression
   *
   * Verifies the target is a valid lvalue (identifier or index),
   * checks the value type is assignable to the target type,
   * and returns the assigned type.
   *
   * @param node - The assignment expression node
   */
  override visitAssignmentExpression(node: AssignmentExpression): void {
    if (this.shouldStop) return;
    this.enterNode(node);

    const target = node.getTarget();
    const value = node.getValue();
    const operator = node.getOperator();

    // Check if target is a valid lvalue
    if (!this.isValidLValue(target)) {
      this.reportError(
        TypeCheckDiagnosticCodes.INVALID_ASSIGNMENT_TARGET as DiagnosticCode,
        `Invalid assignment target`,
        target.getLocation(),
        `Can only assign to variables or array elements`
      );
      this.setExpressionType(node, null, false);
      this.exitNode(node);
      return;
    }

    // Type check target and value
    target.accept(this);
    value.accept(this);

    const targetType = this.getTypeOf(target);
    const valueType = this.getTypeOf(value);

    if (!targetType || !valueType) {
      this.setExpressionType(node, targetType ?? null, false);
      this.exitNode(node);
      return;
    }

    // For compound assignment (+=, -=, etc.), check operator compatibility
    const opStr = BINARY_OPERATOR_MAP[operator] ?? operator;
    if (opStr !== '=') {
      // Extract the base operator (e.g., '+' from '+=')
      const baseOp = opStr.slice(0, -1);
      const opResultType = this.typeSystem.getBinaryOperationType(targetType, valueType, baseOp);

      if (!opResultType) {
        this.reportError(
          TypeCheckDiagnosticCodes.INVALID_OPERAND as DiagnosticCode,
          `Operator '${baseOp}' cannot be applied to types '${targetType.name}' and '${valueType.name}'`,
          node.getLocation(),
          `Compound assignment requires compatible operand types`
        );
        this.setExpressionType(node, null, false);
        this.exitNode(node);
        return;
      }

      // Check if result can be assigned back to target
      if (!this.canAssign(opResultType, targetType)) {
        this.reportTypeMismatch(targetType, opResultType, node.getLocation(), 'compound assignment');
        this.setExpressionType(node, null, false);
        this.exitNode(node);
        return;
      }
    } else {
      // Simple assignment - check value is assignable to target
      if (!this.canAssign(valueType, targetType)) {
        this.reportTypeMismatch(targetType, valueType, value.getLocation(), 'assignment');
        this.setExpressionType(node, null, false);
        this.exitNode(node);
        return;
      }
    }

    // Assignment returns the assigned type
    this.setExpressionType(node, targetType, false);

    this.exitNode(node);
  }

  /**
   * Checks if an expression is a valid lvalue (can be assigned to)
   *
   * Valid lvalues in Blend65:
   * - IdentifierExpression (variable)
   * - IndexExpression (array element)
   */
  protected isValidLValue(expr: Expression): boolean {
    const nodeType = expr.getNodeType();
    return (
      nodeType === 'IdentifierExpression' ||
      nodeType === 'IndexExpression'
    );
  }
}