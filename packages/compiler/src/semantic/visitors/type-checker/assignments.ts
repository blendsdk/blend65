/**
 * TypeChecker Assignments Layer
 *
 * Handles type checking for complex expressions:
 * - Assignment expressions (simple and compound)
 * - Call expressions (function calls)
 * - Index expressions (array access)
 * - Member expressions (struct/map member access)
 */

import { TypeCheckerExpressions } from './expressions.js';
import type { TypeInfo } from '../../types.js';
import { TypeKind } from '../../types.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../../ast/diagnostics.js';
import type {
  AssignmentExpression,
  CallExpression,
  IndexExpression,
  MemberExpression,
} from '../../../ast/nodes.js';
import { TokenType } from '../../../lexer/types.js';

/**
 * TypeCheckerAssignments - Type checks complex expressions
 *
 * Implements:
 * - visitAssignmentExpression (simple and compound assignments)
 * - visitCallExpression (function calls)
 * - visitIndexExpression (array indexing)
 * - visitMemberExpression (member access)
 */
export abstract class TypeCheckerAssignments extends TypeCheckerExpressions {
  // ============================================
  // ASSIGNMENT & COMPLEX EXPRESSIONS
  // ============================================

  /**
   * Visit AssignmentExpression - type check assignment
   *
   * Type rules:
   * - Left side must be an lvalue (variable, array element, member)
   * - Left side must not be const
   * - Right side type must be assignable to left side type
   * - Supports simple (=) and compound assignments (+=, -=, etc.)
   */
  public visitAssignmentExpression(node: AssignmentExpression): void {
    const operator = node.getOperator();
    const target = node.getTarget();
    const value = node.getValue();

    // Type check left side (target)
    const targetType = this.typeCheckExpression(target);

    // Check if target is an lvalue
    if (!this.isLValue(target)) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Left side of assignment must be an lvalue (variable, array element, or member)`,
        location: target.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }

    // Check if target is const
    if (this.isConst(target)) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Cannot assign to const variable`,
        location: target.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }

    // Type check right side (value)
    const valueType = this.typeCheckExpression(value);

    // For simple assignment (=), check type compatibility
    if (operator === TokenType.ASSIGN) {
      if (!this.typeSystem.canAssign(valueType, targetType)) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Type mismatch in assignment: cannot assign '${valueType.name}' to '${targetType.name}'`,
          location: node.getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }
    }
    // For compound assignments (+=, -=, *=, /=, %=, &=, |=, ^=, <<=, >>=)
    else {
      // Compound assignment is equivalent to: target = target op value
      // So we need to check if the operation is valid

      // Arithmetic compound assignments: +=, -=, *=, /=, %=
      if (
        operator === TokenType.PLUS_ASSIGN ||
        operator === TokenType.MINUS_ASSIGN ||
        operator === TokenType.MULTIPLY_ASSIGN ||
        operator === TokenType.DIVIDE_ASSIGN ||
        operator === TokenType.MODULO_ASSIGN
      ) {
        // Both target and value must be numeric
        if (!this.isNumericType(targetType)) {
          this.reportDiagnostic({
            severity: DiagnosticSeverity.ERROR,
            message: `Compound assignment operator '${this.getOperatorSymbol(operator)}' requires numeric target, got '${targetType.name}'`,
            location: target.getLocation(),
            code: DiagnosticCode.TYPE_MISMATCH,
          });
        }

        if (!this.isNumericType(valueType)) {
          this.reportDiagnostic({
            severity: DiagnosticSeverity.ERROR,
            message: `Compound assignment operator '${this.getOperatorSymbol(operator)}' requires numeric value, got '${valueType.name}'`,
            location: value.getLocation(),
            code: DiagnosticCode.TYPE_MISMATCH,
          });
        }

        // Result type would be the larger of the two (but target stays its type)
        const resultType = this.getLargerNumericType(targetType, valueType);
        if (!this.typeSystem.canAssign(resultType, targetType)) {
          this.reportDiagnostic({
            severity: DiagnosticSeverity.ERROR,
            message: `Compound assignment would widen type: result type '${resultType.name}' cannot be assigned to '${targetType.name}'`,
            location: node.getLocation(),
            code: DiagnosticCode.TYPE_MISMATCH,
          });
        }
      }
      // Bitwise compound assignments: &=, |=, ^=, <<=, >>=
      else if (
        operator === TokenType.BITWISE_AND_ASSIGN ||
        operator === TokenType.BITWISE_OR_ASSIGN ||
        operator === TokenType.BITWISE_XOR_ASSIGN ||
        operator === TokenType.LEFT_SHIFT_ASSIGN ||
        operator === TokenType.RIGHT_SHIFT_ASSIGN
      ) {
        // Both target and value must be numeric
        if (!this.isNumericType(targetType)) {
          this.reportDiagnostic({
            severity: DiagnosticSeverity.ERROR,
            message: `Bitwise compound assignment operator '${this.getOperatorSymbol(operator)}' requires numeric target, got '${targetType.name}'`,
            location: target.getLocation(),
            code: DiagnosticCode.TYPE_MISMATCH,
          });
        }

        if (!this.isNumericType(valueType)) {
          this.reportDiagnostic({
            severity: DiagnosticSeverity.ERROR,
            message: `Bitwise compound assignment operator '${this.getOperatorSymbol(operator)}' requires numeric value, got '${valueType.name}'`,
            location: value.getLocation(),
            code: DiagnosticCode.TYPE_MISMATCH,
          });
        }
      }
    }

    // Assignment expression has the type of the target
    (node as any).typeInfo = targetType;
  }

  /**
   * Visit CallExpression - type check function call
   *
   * Type rules:
   * - Callee must be a function (Callback type)
   * - Argument count must match parameter count
   * - Each argument type must be assignable to corresponding parameter type
   * - Result type is function's return type
   */
  public visitCallExpression(node: CallExpression): void {
    // TODO(IL-GEN): Add intrinsic metadata to call sites here.
    // Future enhancement: Detect if callee is a stub function (intrinsic) and annotate:
    //   - (node as any).isIntrinsicCall = true
    //   - (node as any).intrinsicId = 'intrinsic_peek' | 'intrinsic_poke' | etc.
    //   - (node as any).isCompileTime = true (for sizeof)
    // This will enable IL generator to emit specialized code for built-in functions.
    // See: plans/il-generator-requirements.md - AST Annotation Strategy
    const calleeExpr = node.getCallee();

    // Type check callee
    const calleeType = this.typeCheckExpression(calleeExpr);

    // Check if callee is callable (must be Callback type)
    if (calleeType.kind !== TypeKind.Callback) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Expression is not callable (type: '${calleeType.name}')`,
        location: calleeExpr.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });

      // Return unknown type as placeholder
      const unknownType: TypeInfo = {
        kind: TypeKind.Unknown,
        name: 'unknown',
        size: 0,
        isSigned: false,
        isAssignable: false,
      };
      (node as any).typeInfo = unknownType;
      return;
    }

    // Get function signature
    const signature = calleeType.signature;
    if (!signature) {
      // Should not happen for Callback type, but handle gracefully
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Function type missing signature information`,
        location: calleeExpr.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });

      const unknownType: TypeInfo = {
        kind: TypeKind.Unknown,
        name: 'unknown',
        size: 0,
        isSigned: false,
        isAssignable: false,
      };
      (node as any).typeInfo = unknownType;
      return;
    }

    // Check argument count
    const args = node.getArguments();
    const params = signature.parameters;

    if (args.length !== params.length) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Expected ${params.length} argument${params.length !== 1 ? 's' : ''}, got ${args.length}`,
        location: node.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }

    // Type check each argument against corresponding parameter
    const argCount = Math.min(args.length, params.length);
    for (let i = 0; i < argCount; i++) {
      const argType = this.typeCheckExpression(args[i]);
      const paramType = params[i];

      // Check if argument type is assignable to parameter type
      if (!this.typeSystem.canAssign(argType, paramType)) {
        const paramName = signature.parameterNames?.[i] || `parameter ${i + 1}`;
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Argument type mismatch for '${paramName}': expected '${paramType.name}', got '${argType.name}'`,
          location: args[i].getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }
    }

    // Call expression has the return type of the function
    const returnType = signature.returnType;
    (node as any).typeInfo = returnType;
  }

  /**
   * Visit IndexExpression - type check array access
   *
   * Type rules:
   * - Object must be an array type
   * - Index must be numeric (byte or word)
   * - Result type is the array's element type
   */
  public visitIndexExpression(node: IndexExpression): void {
    // Type check object being indexed
    const objectType = this.typeCheckExpression(node.getObject());

    // Check if object is an array
    if (objectType.kind !== TypeKind.Array) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Cannot index non-array type '${objectType.name}'`,
        location: node.getObject().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });

      // Return unknown type as placeholder
      const unknownType: TypeInfo = {
        kind: TypeKind.Unknown,
        name: 'unknown',
        size: 0,
        isSigned: false,
        isAssignable: false,
      };
      (node as any).typeInfo = unknownType;
      return;
    }

    // Type check index
    const indexType = this.typeCheckExpression(node.getIndex());

    // Index must be numeric (byte or word)
    if (!this.isNumericType(indexType)) {
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Array index must be numeric, got '${indexType.name}'`,
        location: node.getIndex().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }

    // Index access returns element type
    const elementType = objectType.elementType;
    if (!elementType) {
      // Should not happen for Array type, but handle gracefully
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Array type missing element type information`,
        location: node.getObject().getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });

      const unknownType: TypeInfo = {
        kind: TypeKind.Unknown,
        name: 'unknown',
        size: 0,
        isSigned: false,
        isAssignable: false,
      };
      (node as any).typeInfo = unknownType;
    }

    (node as any).typeInfo = elementType;
  }

  /**
   * Visit MemberExpression - type check member access
   *
   * Type rules:
   * - Object must be a struct or map type
   * - Property must exist on the object type
   * - Result type is the property's type
   *
   * Note: Currently simplified as Blend65 doesn't have full struct support yet.
   * This is a placeholder for future struct implementation.
   */
  public visitMemberExpression(node: MemberExpression): void {
    // Type check object
    const objectType = this.typeCheckExpression(node.getObject());

    // For now, member access is only supported on structs/maps
    // This is a placeholder implementation until we have full struct support

    // Report error - member access not yet fully implemented
    this.reportDiagnostic({
      severity: DiagnosticSeverity.ERROR,
      message: `Member access is not yet fully implemented (accessing '${node.getProperty()}' on type '${objectType.name}')`,
      location: node.getLocation(),
      code: DiagnosticCode.TYPE_MISMATCH,
    });

    // Return unknown type as placeholder
    const unknownType: TypeInfo = {
      kind: TypeKind.Unknown,
      name: 'unknown',
      size: 0,
      isSigned: false,
      isAssignable: false,
    };
    (node as any).typeInfo = unknownType;
  }
}
