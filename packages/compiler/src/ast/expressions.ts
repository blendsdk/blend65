/**
 * Expression AST Node Implementations for Blend65 Compiler v2
 *
 * This module contains all expression node classes that represent
 * value-producing constructs in Blend65.
 *
 * Expressions:
 * - Produce a value (have a type: byte, word, string, etc.)
 * - Can be used in larger expressions
 * - Can appear on right side of assignment
 * - Can be passed as function arguments
 */

import { ASTNodeType, ASTVisitor, Expression, SourceLocation } from './base.js';
import { TokenType } from '../lexer/types.js';

// ============================================
// LITERAL EXPRESSIONS
// ============================================

/**
 * Literal value type - the raw value types supported
 */
export type LiteralValue = number | string | boolean;

/**
 * Literal expression node
 *
 * Represents constant values: 42, "hello", true, $D000
 */
export class LiteralExpression extends Expression {
  /**
   * Creates a Literal expression
   * @param value - The literal value
   * @param location - Source location
   */
  constructor(
    protected readonly value: LiteralValue,
    location: SourceLocation
  ) {
    super(ASTNodeType.LITERAL_EXPR, location);
  }

  public getValue(): LiteralValue {
    return this.value;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitLiteralExpression(this);
  }
}

/**
 * Identifier expression node
 *
 * Represents variable/function references: counter, myFunction
 */
export class IdentifierExpression extends Expression {
  /**
   * Creates an Identifier expression
   * @param name - Identifier name
   * @param location - Source location
   */
  constructor(
    protected readonly name: string,
    location: SourceLocation
  ) {
    super(ASTNodeType.IDENTIFIER_EXPR, location);
  }

  public getName(): string {
    return this.name;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitIdentifierExpression(this);
  }
}

// ============================================
// OPERATOR EXPRESSIONS
// ============================================

/**
 * Binary expression node
 *
 * Represents two operands with an operator: 2 + 3, x * y, a && b
 */
export class BinaryExpression extends Expression {
  /**
   * Creates a Binary expression
   * @param left - Left operand
   * @param operator - Operator token type
   * @param right - Right operand
   * @param location - Source location
   */
  constructor(
    protected readonly left: Expression,
    protected readonly operator: TokenType,
    protected readonly right: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.BINARY_EXPR, location);
  }

  public getLeft(): Expression {
    return this.left;
  }

  public getOperator(): TokenType {
    return this.operator;
  }

  public getRight(): Expression {
    return this.right;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitBinaryExpression(this);
  }
}

/**
 * Unary expression node
 *
 * Represents single operand with operator: -x, !flag, ~mask
 */
export class UnaryExpression extends Expression {
  /**
   * Creates a Unary expression
   * @param operator - Operator token type
   * @param operand - Operand expression
   * @param location - Source location
   */
  constructor(
    protected readonly operator: TokenType,
    protected readonly operand: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.UNARY_EXPR, location);
  }

  public getOperator(): TokenType {
    return this.operator;
  }

  public getOperand(): Expression {
    return this.operand;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitUnaryExpression(this);
  }
}

/**
 * Ternary conditional expression node
 *
 * Represents: condition ? thenBranch : elseBranch
 *
 * Examples:
 * - (a > b) ? a : b
 * - isValid ? process() : error()
 * - (x > 0) ? x : -x
 *
 * The ternary operator is right-associative:
 * a ? b : c ? d : e → a ? b : (c ? d : e)
 *
 * Both branches must have compatible types (validated in semantic analysis).
 * On 6502, this compiles to the same branch code as if-else.
 */
export class TernaryExpression extends Expression {
  /**
   * Creates a ternary conditional expression
   *
   * @param condition - The condition expression (evaluated first)
   * @param thenBranch - Expression returned if condition is true
   * @param elseBranch - Expression returned if condition is false
   * @param location - Source location spanning the entire expression
   */
  constructor(
    protected readonly condition: Expression,
    protected readonly thenBranch: Expression,
    protected readonly elseBranch: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.TERNARY_EXPR, location);
  }

  public getCondition(): Expression {
    return this.condition;
  }

  public getThenBranch(): Expression {
    return this.thenBranch;
  }

  public getElseBranch(): Expression {
    return this.elseBranch;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitTernaryExpression(this);
  }
}

/**
 * Assignment expression node
 *
 * Represents: x = 5, counter += 1
 */
export class AssignmentExpression extends Expression {
  /**
   * Creates an Assignment expression
   * @param target - Assignment target (lvalue)
   * @param operator - Assignment operator
   * @param value - Value to assign
   * @param location - Source location
   */
  constructor(
    protected readonly target: Expression,
    protected readonly operator: TokenType,
    protected readonly value: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.ASSIGNMENT_EXPR, location);
  }

  public getTarget(): Expression {
    return this.target;
  }

  public getOperator(): TokenType {
    return this.operator;
  }

  public getValue(): Expression {
    return this.value;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitAssignmentExpression(this);
  }
}

// ============================================
// ACCESS EXPRESSIONS
// ============================================

/**
 * Call expression node
 *
 * Represents function calls: foo(), add(1, 2)
 */
export class CallExpression extends Expression {
  /**
   * Creates a Call expression
   * @param callee - Function being called
   * @param args - Argument expressions
   * @param location - Source location
   */
  constructor(
    protected readonly callee: Expression,
    protected readonly args: Expression[],
    location: SourceLocation
  ) {
    super(ASTNodeType.CALL_EXPR, location);
  }

  public getCallee(): Expression {
    return this.callee;
  }

  public getArguments(): Expression[] {
    return this.args;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitCallExpression(this);
  }
}

/**
 * Index expression node
 *
 * Represents array access: array[0], sprites[i]
 */
export class IndexExpression extends Expression {
  /**
   * Creates an Index expression
   * @param object - Object being indexed
   * @param index - Index expression
   * @param location - Source location
   */
  constructor(
    protected readonly object: Expression,
    protected readonly index: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.INDEX_EXPR, location);
  }

  public getObject(): Expression {
    return this.object;
  }

  public getIndex(): Expression {
    return this.index;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitIndexExpression(this);
  }
}

/**
 * Member expression node
 *
 * Represents property access: player.health, Game.score
 */
export class MemberExpression extends Expression {
  /**
   * Creates a Member expression
   * @param object - Object being accessed
   * @param property - Property name
   * @param location - Source location
   */
  constructor(
    protected readonly object: Expression,
    protected readonly property: string,
    location: SourceLocation
  ) {
    super(ASTNodeType.MEMBER_EXPR, location);
  }

  public getObject(): Expression {
    return this.object;
  }

  public getProperty(): string {
    return this.property;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitMemberExpression(this);
  }
}

// ============================================
// COMPOSITE EXPRESSIONS
// ============================================

/**
 * Array literal expression node
 *
 * Represents: [1, 2, 3], [x, y], [[1, 2], [3, 4]]
 *
 * Array literals provide a concise syntax for initializing arrays inline.
 * Supports:
 * - Empty arrays: []
 * - Single/multiple elements: [42], [1, 2, 3]
 * - Nested arrays (multidimensional): [[1, 2], [3, 4]]
 * - Expressions as elements: [x, y + 1, foo()]
 *
 * Note: Multidimensional arrays are syntactic sugar - they compile to
 * flat arrays with calculated offsets for 6502 efficiency.
 */
export class ArrayLiteralExpression extends Expression {
  /**
   * Creates an Array Literal expression
   * @param elements - Array element expressions
   * @param location - Source location
   */
  constructor(
    protected readonly elements: Expression[],
    location: SourceLocation
  ) {
    super(ASTNodeType.ARRAY_LITERAL_EXPR, location);
  }

  public getElements(): Expression[] {
    return this.elements;
  }

  public getElementCount(): number {
    return this.elements.length;
  }

  public isEmpty(): boolean {
    return this.elements.length === 0;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitArrayLiteralExpression(this);
  }
}