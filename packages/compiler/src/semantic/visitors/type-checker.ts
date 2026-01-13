/**
 * Type Checker - Phase 3 of Semantic Analysis
 *
 * Performs comprehensive type checking of all expressions and statements:
 * - Validates type compatibility in assignments
 * - Checks function call signatures
 * - Verifies return types
 * - Annotates AST nodes with type information
 *
 * This is the third pass after:
 * - Phase 1: SymbolTableBuilder (collects all symbols)
 * - Phase 2: TypeResolver (resolves type annotations)
 */

import { ContextWalker } from '../../ast/walker/context.js';
import type { SymbolTable } from '../symbol-table.js';
import type { TypeSystem } from '../type-system.js';
import type { TypeInfo } from '../types.js';
import { TypeKind } from '../types.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../ast/diagnostics.js';
import type { Expression } from '../../ast/base.js';
import type {
  LiteralExpression,
  IdentifierExpression,
  ArrayLiteralExpression,
  BinaryExpression,
  UnaryExpression,
  AssignmentExpression,
  CallExpression,
  IndexExpression,
  MemberExpression,
} from '../../ast/nodes.js';
import { TokenType } from '../../lexer/types.js';

/**
 * TypeChecker - Type checks all expressions and statements
 *
 * This visitor walks the AST and:
 * 1. Computes types for all expressions
 * 2. Validates type compatibility
 * 3. Annotates nodes with type information
 * 4. Collects comprehensive diagnostics
 *
 * **Design:**
 * - Extends ContextWalker for scope tracking
 * - Visit methods return TypeInfo (type of the expression)
 * - Sets node.typeInfo for each expression
 * - Continues checking after errors (collects all issues)
 *
 * **Usage:**
 * ```typescript
 * const checker = new TypeChecker(symbolTable, typeSystem);
 * checker.walk(program);
 * const diagnostics = checker.getDiagnostics();
 * ```
 */
export class TypeChecker extends ContextWalker {
  /** Type system for type operations */
  protected typeSystem: TypeSystem;

  /** Symbol table from Phase 1 */
  protected symbolTable: SymbolTable;

  /** Collected diagnostics */
  protected diagnostics: Diagnostic[];

  /** Current function return type (for return statement checking) */
  protected currentFunctionReturnType: TypeInfo | null;

  /**
   * Creates a new TypeChecker
   *
   * @param symbolTable - Symbol table from Phase 1 (SymbolTableBuilder)
   * @param typeSystem - Type system from Phase 2 (TypeResolver)
   */
  constructor(symbolTable: SymbolTable, typeSystem: TypeSystem) {
    super();
    this.symbolTable = symbolTable;
    this.typeSystem = typeSystem;
    this.diagnostics = [];
    this.currentFunctionReturnType = null;
  }

  /**
   * Get collected diagnostics
   *
   * @returns Array of diagnostic messages
   */
  public getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  /**
   * Report a diagnostic
   *
   * @param diagnostic - The diagnostic to report
   */
  protected reportDiagnostic(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  // ============================================
  // LITERAL EXPRESSIONS
  // ============================================

  /**
   * Visit NumberLiteral - infer byte vs word based on value
   *
   * Type inference rules:
   * - 0-255: byte
   * - 256-65535: word
   * - >65535: error (too large)
   */
  public visitLiteralExpression(node: LiteralExpression): TypeInfo {
    const value = node.getValue();

    let type: TypeInfo;

    if (typeof value === 'number') {
      // Number literal - infer byte vs word
      if (value < 0) {
        // Negative numbers not supported in Blend65
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Negative number literals are not supported`,
          location: node.getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
        type = this.typeSystem.getBuiltinType('byte')!;
      } else if (value <= 255) {
        // Fits in byte
        type = this.typeSystem.getBuiltinType('byte')!;
      } else if (value <= 65535) {
        // Needs word
        type = this.typeSystem.getBuiltinType('word')!;
      } else {
        // Too large for 6502
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Number literal ${value} exceeds maximum value 65535`,
          location: node.getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
        type = this.typeSystem.getBuiltinType('word')!;
      }
    } else if (typeof value === 'boolean') {
      // Boolean literal
      type = this.typeSystem.getBuiltinType('boolean')!;
    } else if (typeof value === 'string') {
      // String literal
      type = this.typeSystem.getBuiltinType('string')!;
    } else {
      // Unknown literal type (should not happen)
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Unknown literal type`,
        location: node.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
      type = {
        kind: TypeKind.Unknown,
        name: 'unknown',
        size: 0,
        isSigned: false,
        isAssignable: false,
      };
    }

    // Annotate node with type
    (node as any).typeInfo = type;
    return type;
  }

  /**
   * Visit ArrayLiteralExpression - infer array type from elements
   *
   * Type inference rules:
   * - Empty array: error (cannot infer type)
   * - Single element: array of that element's type
   * - Multiple elements: check all match first element's type
   */
  public visitArrayLiteralExpression(node: ArrayLiteralExpression): TypeInfo {
    if (node.isEmpty()) {
      // Empty array - cannot infer type
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: 'Cannot infer type of empty array literal',
        location: node.getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });

      // Return byte array with size 0 as placeholder
      const type = this.typeSystem.createArrayType(this.typeSystem.getBuiltinType('byte')!, 0);
      (node as any).typeInfo = type;
      return type;
    }

    // Type check first element to determine array type
    const elements = node.getElements();
    const firstElementType = this.typeCheckExpression(elements[0]);

    // Type check remaining elements and ensure they match
    // Array literals require exact type match (not just assignability)
    for (let i = 1; i < elements.length; i++) {
      const elementType = this.typeCheckExpression(elements[i]);

      // Require exact type kind match for array elements
      if (elementType.kind !== firstElementType.kind) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Array element type mismatch: expected '${firstElementType.name}', got '${elementType.name}'`,
          location: elements[i].getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }
    }

    // Create array type with element type and size
    const type = this.typeSystem.createArrayType(firstElementType, elements.length);
    (node as any).typeInfo = type;
    return type;
  }

  // ============================================
  // SIMPLE EXPRESSIONS
  // ============================================

  /**
   * Visit IdentifierExpression - look up symbol type
   *
   * Looks up the identifier in the symbol table and uses its declared type.
   * Reports error if identifier is not found.
   */
  public visitIdentifierExpression(node: IdentifierExpression): TypeInfo {
    const name = node.getName();
    const symbol = this.symbolTable.lookup(name);

    if (!symbol) {
      // Undefined identifier
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Undefined identifier '${name}'`,
        location: node.getLocation(),
        code: DiagnosticCode.UNDEFINED_VARIABLE,
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
      return unknownType;
    }

    // Use symbol's resolved type from Phase 2
    const type = symbol.type || {
      kind: TypeKind.Unknown,
      name: 'unknown',
      size: 0,
      isSigned: false,
      isAssignable: false,
    };
    (node as any).typeInfo = type;
    return type;
  }

  /**
   * Visit BinaryExpression - type check operands and determine result type
   *
   * Type rules for binary operators:
   * - Arithmetic (+, -, *, /, %): numeric types only, result = larger operand type
   * - Comparison (<, <=, >, >=, ==, !=): any compatible types, result = boolean
   * - Logical (&&, ||): boolean only, result = boolean
   * - Bitwise (&, |, ^, <<, >>): numeric types only, result = larger operand type
   */
  public visitBinaryExpression(node: BinaryExpression): TypeInfo {
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
    return resultType;
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
  public visitUnaryExpression(node: UnaryExpression): TypeInfo {
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
    return resultType;
  }

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
  public visitAssignmentExpression(node: AssignmentExpression): TypeInfo {
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
    return targetType;
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
  public visitCallExpression(node: CallExpression): TypeInfo {
    // Type check callee
    const calleeExpr = node.getCallee();
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
      return unknownType;
    }

    // Get function signature
    const signature = calleeType.signature;
    if (!signature) {
      // Should not happen for Callback type
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
      return unknownType;
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
    return returnType;
  }

  /**
   * Visit IndexExpression - type check array access
   *
   * Type rules:
   * - Object must be an array type
   * - Index must be numeric (byte or word)
   * - Result type is the array's element type
   */
  public visitIndexExpression(node: IndexExpression): TypeInfo {
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
      return unknownType;
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
      return unknownType;
    }

    (node as any).typeInfo = elementType;
    return elementType;
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
  public visitMemberExpression(node: MemberExpression): TypeInfo {
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
    return unknownType;
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
    const currentScope = this.symbolTable.getCurrentScope();
    const childScopes = currentScope.children || [];

    // Find child scope with this function as its node
    const functionScope = childScopes.find(scope => scope.node === node);

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

    // Exit function scope
    this.symbolTable.exitScope();
  }

  /**
   * Visit VariableDecl - type check initializer
   *
   * Type checks the initializer expression if present and validates
   * that its type is assignable to the variable's declared type.
   *
   * Validates:
   * - Initializer type matches declared type
   * - Type widening (byte → word) is allowed
   * - Type narrowing (word → byte) is rejected
   */
  public visitVariableDecl(node: any): void {
    // Get symbol from symbol table (created in Phase 1, type resolved in Phase 2)
    const symbol = this.symbolTable.lookup(node.getName());
    if (!symbol || !symbol.type) {
      // Error already reported in Phase 1 or 2
      return;
    }

    // Type check initializer if present
    if (node.getInitializer && node.getInitializer()) {
      const initType = this.typeCheckExpression(node.getInitializer());

      // Check type compatibility between initializer and variable type
      if (!this.typeSystem.canAssign(initType, symbol.type)) {
        this.reportDiagnostic({
          severity: DiagnosticSeverity.ERROR,
          message: `Type mismatch in variable initialization: cannot assign '${initType.name}' to '${symbol.type.name}'`,
          location: node.getInitializer().getLocation(),
          code: DiagnosticCode.TYPE_MISMATCH,
        });
      }
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

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Type check an expression and return its type
   *
   * This helper method dispatches to the appropriate visitor method
   * and returns the computed type.
   *
   * @param expr - Expression to type check
   * @returns The type of the expression
   */
  protected typeCheckExpression(expr: Expression): TypeInfo {
    const nodeType = expr.getNodeType();

    // Dispatch to appropriate visitor method based on node type
    if (nodeType === 'LiteralExpression') {
      return this.visitLiteralExpression(expr as LiteralExpression);
    } else if (nodeType === 'ArrayLiteralExpression') {
      return this.visitArrayLiteralExpression(expr as ArrayLiteralExpression);
    } else if (nodeType === 'IdentifierExpression') {
      return this.visitIdentifierExpression(expr as IdentifierExpression);
    } else if (nodeType === 'BinaryExpression') {
      return this.visitBinaryExpression(expr as BinaryExpression);
    } else if (nodeType === 'UnaryExpression') {
      return this.visitUnaryExpression(expr as UnaryExpression);
    } else if (nodeType === 'AssignmentExpression') {
      return this.visitAssignmentExpression(expr as AssignmentExpression);
    } else if (nodeType === 'CallExpression') {
      return this.visitCallExpression(expr as CallExpression);
    } else if (nodeType === 'IndexExpression') {
      return this.visitIndexExpression(expr as IndexExpression);
    } else if (nodeType === 'MemberExpression') {
      return this.visitMemberExpression(expr as MemberExpression);
    }

    // Default: return unknown type for unsupported expressions
    const unknownType: TypeInfo = {
      kind: TypeKind.Unknown,
      name: 'unknown',
      size: 0,
      isSigned: false,
      isAssignable: false,
    };
    (expr as any).typeInfo = unknownType;
    return unknownType;
  }

  /**
   * Check if an expression is an lvalue (can be assigned to)
   *
   * Lvalues in Blend65:
   * - Identifiers (variables)
   * - Array access (array[index])
   * - Member access (obj.property)
   *
   * @param expr - Expression to check
   * @returns True if expression can be assigned to
   */
  protected isLValue(expr: Expression): boolean {
    const nodeType = expr.getNodeType();

    // Identifiers are lvalues
    if (nodeType === 'IdentifierExpression') {
      return true;
    }

    // Array access is lvalue (array[index])
    if (nodeType === 'IndexExpression') {
      return true;
    }

    // Member access is lvalue (obj.property)
    if (nodeType === 'MemberExpression') {
      return true;
    }

    // Everything else is not an lvalue
    return false;
  }

  /**
   * Check if an expression refers to a const variable
   *
   * @param expr - Expression to check
   * @returns True if expression is a const variable
   */
  protected isConst(expr: Expression): boolean {
    // Only identifiers can be const
    if (expr.getNodeType() !== 'IdentifierExpression') {
      return false;
    }

    const identifier = expr as IdentifierExpression;
    const symbol = this.symbolTable.lookup(identifier.getName());

    return symbol?.isConst || false;
  }

  /**
   * Check if a type is numeric (byte or word)
   *
   * @param type - Type to check
   * @returns True if type is byte or word
   */
  protected isNumericType(type: TypeInfo): boolean {
    return type.kind === TypeKind.Byte || type.kind === TypeKind.Word;
  }

  /**
   * Get the larger of two numeric types
   *
   * When mixing byte and word, result is word.
   * When both are same, return that type.
   *
   * @param left - Left operand type
   * @param right - Right operand type
   * @returns The larger type (word > byte)
   */
  protected getLargerNumericType(left: TypeInfo, right: TypeInfo): TypeInfo {
    // If either is word, result is word
    if (left.kind === TypeKind.Word || right.kind === TypeKind.Word) {
      return this.typeSystem.getBuiltinType('word')!;
    }

    // Both are byte (or unknown)
    return this.typeSystem.getBuiltinType('byte')!;
  }

  /**
   * Get human-readable symbol for operator token
   *
   * Used for error messages.
   *
   * @param operator - Operator token type
   * @returns Human-readable operator symbol
   */
  protected getOperatorSymbol(operator: TokenType): string {
    const symbolMap: Partial<Record<TokenType, string>> = {
      [TokenType.PLUS]: '+',
      [TokenType.MINUS]: '-',
      [TokenType.MULTIPLY]: '*',
      [TokenType.DIVIDE]: '/',
      [TokenType.MODULO]: '%',
      [TokenType.EQUAL]: '==',
      [TokenType.NOT_EQUAL]: '!=',
      [TokenType.LESS_THAN]: '<',
      [TokenType.LESS_EQUAL]: '<=',
      [TokenType.GREATER_THAN]: '>',
      [TokenType.GREATER_EQUAL]: '>=',
      [TokenType.AND]: '&&',
      [TokenType.OR]: '||',
      [TokenType.NOT]: '!',
      [TokenType.BITWISE_AND]: '&',
      [TokenType.BITWISE_OR]: '|',
      [TokenType.BITWISE_XOR]: '^',
      [TokenType.BITWISE_NOT]: '~',
      [TokenType.LEFT_SHIFT]: '<<',
      [TokenType.RIGHT_SHIFT]: '>>',
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
      [TokenType.ADDRESS]: '@',
    };

    return symbolMap[operator] || operator.toString();
  }
}
