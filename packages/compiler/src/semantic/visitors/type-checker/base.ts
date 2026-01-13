/**
 * TypeChecker Base Class
 *
 * Foundation layer providing:
 * - Core infrastructure (symbol table, type system, diagnostics)
 * - Helper methods (type checking, lvalue detection, type utilities)
 * - Diagnostic reporting
 *
 * This is the base that all type checker layers build upon.
 */

import { ContextWalker } from '../../../ast/walker/context.js';
import type { SymbolTable } from '../../symbol-table.js';
import type { TypeSystem } from '../../type-system.js';
import type { TypeInfo } from '../../types.js';
import { TypeKind } from '../../types.js';
import type { Diagnostic } from '../../../ast/diagnostics.js';
import type { Expression } from '../../../ast/base.js';
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
} from '../../../ast/nodes.js';
import { TokenType } from '../../../lexer/types.js';

/**
 * TypeCheckerBase - Base class for type checking
 *
 * Provides fundamental infrastructure:
 * - Symbol table and type system access
 * - Diagnostic collection
 * - Helper methods for type checking
 * - Common utilities
 *
 * All type checker layers extend this base.
 */
export abstract class TypeCheckerBase extends ContextWalker {
  /** Type system for type operations */
  protected typeSystem: TypeSystem;

  /** Symbol table from Phase 1 */
  protected symbolTable: SymbolTable;

  /** Collected diagnostics */
  protected diagnostics: Diagnostic[];

  /** Current function return type (for return statement checking) */
  protected currentFunctionReturnType: TypeInfo | null;

  /**
   * Creates a new TypeCheckerBase
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
  // HELPER METHODS
  // ============================================

  /**
   * Type check an expression and return its type
   *
   * This helper method dispatches to the appropriate visitor method
   * (which sets typeInfo on the node) and returns the computed type.
   *
   * @param expr - Expression to type check
   * @returns The type of the expression
   */
  protected typeCheckExpression(expr: Expression): TypeInfo {
    const nodeType = expr.getNodeType();

    // Dispatch to appropriate visitor method based on node type
    // Each visitor sets node.typeInfo as a side effect
    if (nodeType === 'LiteralExpression') {
      this.visitLiteralExpression(expr as LiteralExpression);
    } else if (nodeType === 'ArrayLiteralExpression') {
      this.visitArrayLiteralExpression(expr as ArrayLiteralExpression);
    } else if (nodeType === 'IdentifierExpression') {
      this.visitIdentifierExpression(expr as IdentifierExpression);
    } else if (nodeType === 'BinaryExpression') {
      this.visitBinaryExpression(expr as BinaryExpression);
    } else if (nodeType === 'UnaryExpression') {
      this.visitUnaryExpression(expr as UnaryExpression);
    } else if (nodeType === 'AssignmentExpression') {
      this.visitAssignmentExpression(expr as AssignmentExpression);
    } else if (nodeType === 'CallExpression') {
      this.visitCallExpression(expr as CallExpression);
    } else if (nodeType === 'IndexExpression') {
      this.visitIndexExpression(expr as IndexExpression);
    } else if (nodeType === 'MemberExpression') {
      this.visitMemberExpression(expr as MemberExpression);
    } else {
      // Unsupported expression type - set unknown type
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

    // Return the typeInfo that was set by the visitor
    return (expr as any).typeInfo as TypeInfo;
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

  // ============================================
  // ABSTRACT VISITOR METHODS
  // ============================================
  // These must be implemented by derived classes

  public abstract visitLiteralExpression(node: LiteralExpression): void;
  public abstract visitArrayLiteralExpression(node: ArrayLiteralExpression): void;
  public abstract visitIdentifierExpression(node: IdentifierExpression): void;
  public abstract visitBinaryExpression(node: BinaryExpression): void;
  public abstract visitUnaryExpression(node: UnaryExpression): void;
  public abstract visitAssignmentExpression(node: AssignmentExpression): void;
  public abstract visitCallExpression(node: CallExpression): void;
  public abstract visitIndexExpression(node: IndexExpression): void;
  public abstract visitMemberExpression(node: MemberExpression): void;
}
