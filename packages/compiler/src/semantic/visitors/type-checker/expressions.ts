/**
 * TypeChecker Expressions Layer
 *
 * Handles type checking for simple expressions:
 * - Binary expressions (arithmetic, comparison, logical, bitwise)
 * - Unary expressions (negation, logical NOT, bitwise NOT, address-of)
 */

import { TypeCheckerLiterals } from './literals.js';
import type { TypeInfo } from '../../types.js';
import { TypeKind } from '../../types.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../../ast/diagnostics.js';
import type { BinaryExpression, UnaryExpression } from '../../../ast/nodes.js';
import { TokenType } from '../../../lexer/types.js';

/**
 * TypeCheckerExpressions - Type checks binary and unary expressions
 *
 * Implements:
 * - visitBinaryExpression (all binary operators)
 * - visitUnaryExpression (all unary operators)
 */
export abstract class TypeCheckerExpressions extends TypeCheckerLiterals {
  // ============================================
  // SIMPLE EXPRESSIONS
  // ============================================

  /**
   * Visit BinaryExpression - type check operands and determine result type
   *
   * Type rules for binary operators:
   * - Arithmetic (+, -, *, /, %): numeric types only, result = larger operand type
   * - Comparison (<, <=, >, >=, ==, !=): any compatible types, result = boolean
   * - Logical (&&, ||): boolean only, result = boolean
   * - Bitwise (&, |, ^, <<, >>): numeric types only, result = larger operand type
   */
  public visitBinaryExpression(node: BinaryExpression): void {
    const operator = node.getOperator();
    const leftType = this.typeCheckExpression(node.getLeft());
    const rightType = this.typeCheckExpression(node.getRight());

    let resultType: TypeInfo;

    // Arithmetic operators: +, -, *, /, %
    if (
      operator === TokenType.PLUS ||
      operator === TokenType.MINUS ||
      operator === TokenType.MULTIPLY ||
      operator === TokenType.DIVIDE ||
      operator === TokenType.MODULO
    ) {
      // Both operands must be numeric (byte or word)
      if (!this.isNumericType(leftType)) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Arithmetic operator '${this.getOperatorSymbol(operator)}' requires numeric operand, got '${leftType.name}'`,
          location: node.getLeft().getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }

      if (!this.isNumericType(rightType)) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Arithmetic operator '${this.getOperatorSymbol(operator)}' requires numeric operand, got '${rightType.name}'`,
          location: node.getRight().getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }

      // Result type is the larger of the two operand types
      resultType = this.getLargerNumericType(leftType, rightType);
    }
    // Comparison operators: <, <=, >, >=, ==, !=
    else if (
      operator === TokenType.LESS_THAN ||
      operator === TokenType.LESS_EQUAL ||
      operator === TokenType.GREATER_THAN ||
      operator === TokenType.GREATER_EQUAL ||
      operator === TokenType.EQUAL ||
      operator === TokenType.NOT_EQUAL
    ) {
      // Operands should be comparable (same or compatible types)
      if (
        !this.typeSystem.canAssign(leftType, rightType) &&
        !this.typeSystem.canAssign(rightType, leftType)
      ) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Cannot compare incompatible types '${leftType.name}' and '${rightType.name}'`,
          location: node.getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }

      // Result is always boolean
      resultType = this.typeSystem.getBuiltinType('boolean')!;
    }
    // Logical operators: &&, ||
    else if (operator === TokenType.AND || operator === TokenType.OR) {
      // Both operands must be boolean
      if (leftType.kind !== TypeKind.Boolean) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Logical operator '${this.getOperatorSymbol(operator)}' requires boolean operand, got '${leftType.name}'`,
          location: node.getLeft().getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }

      if (rightType.kind !== TypeKind.Boolean) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Logical operator '${this.getOperatorSymbol(operator)}' requires boolean operand, got '${rightType.name}'`,
          location: node.getRight().getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }

      // Result is boolean
      resultType = this.typeSystem.getBuiltinType('boolean')!;
    }
    // Bitwise operators: &, |, ^, <<, >>
    else if (
      operator === TokenType.BITWISE_AND ||
      operator === TokenType.BITWISE_OR ||
      operator === TokenType.BITWISE_XOR ||
      operator === TokenType.LEFT_SHIFT ||
      operator === TokenType.RIGHT_SHIFT
    ) {
      // Both operands must be numeric
      if (!this.isNumericType(leftType)) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Bitwise operator '${this.getOperatorSymbol(operator)}' requires numeric operand, got '${leftType.name}'`,
          location: node.getLeft().getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }

      if (!this.isNumericType(rightType)) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Bitwise operator '${this.getOperatorSymbol(operator)}' requires numeric operand, got '${rightType.name}'`,
          location: node.getRight().getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }

      // Result type is the larger of the two operand types
      resultType = this.getLargerNumericType(leftType, rightType);
    } else {
      // Unknown operator (should not happen)
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Unknown binary operator`,
        location: node.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
      resultType = this.typeSystem.getBuiltinType('byte')!;
    }

    // Annotate node with result type
    (node as any).typeInfo = resultType;
  }

  /**
   * Visit UnaryExpression - type check operand and determine result type
   *
   * Type rules for unary operators:
   * - Arithmetic negation (-): numeric only, result = operand type
   * - Logical NOT (!): boolean only, result = boolean
   * - Bitwise NOT (~): numeric only, result = operand type
   * - Address-of (@): any lvalue, result = word (address)
   */
  public visitUnaryExpression(node: UnaryExpression): void {
    const operator = node.getOperator();
    const operandType = this.typeCheckExpression(node.getOperand());

    let resultType: TypeInfo;

    // Arithmetic negation: -
    if (operator === TokenType.MINUS) {
      // Operand must be numeric
      if (!this.isNumericType(operandType)) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Unary minus requires numeric operand, got '${operandType.name}'`,
          location: node.getOperand().getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }

      // Result type is same as operand type
      resultType = operandType;
    }
    // Logical NOT: !
    else if (operator === TokenType.NOT) {
      // Operand must be boolean
      if (operandType.kind !== TypeKind.Boolean) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Logical NOT requires boolean operand, got '${operandType.name}'`,
          location: node.getOperand().getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }

      // Result is boolean
      resultType = this.typeSystem.getBuiltinType('boolean')!;
    }
    // Bitwise NOT: ~
    else if (operator === TokenType.BITWISE_NOT) {
      // Operand must be numeric
      if (!this.isNumericType(operandType)) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Bitwise NOT requires numeric operand, got '${operandType.name}'`,
          location: node.getOperand().getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }

      // Result type is same as operand type
      resultType = operandType;
    }
    // Address-of: @ (represented as ADDRESS token)
    else if (operator === TokenType.ADDRESS) {
      // Operand must be an lvalue
      if (!this.isLValue(node.getOperand())) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Address-of operator '@' requires an lvalue (variable, array element, or member)`,
          location: node.getOperand().getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }

      // Result is always word (16-bit address)
      resultType = this.typeSystem.getBuiltinType('word')!;
    } else {
      // Unknown operator (should not happen)
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Unknown unary operator`,
        location: node.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
      resultType = this.typeSystem.getBuiltinType('byte')!;
    }

    // Annotate node with result type
    (node as any).typeInfo = resultType;
  }
}
