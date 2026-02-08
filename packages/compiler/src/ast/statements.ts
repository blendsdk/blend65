/**
 * Statement AST Node Implementations for Blend65 Compiler v2
 *
 * This module contains all statement node classes that represent
 * action-performing constructs in Blend65.
 *
 * Statements:
 * - Perform actions (don't produce values)
 * - Control program flow (if, while, for, return, etc.)
 * - Can appear in function bodies and blocks
 * - Execute sequentially (one after another)
 */

import { ASTNodeType, ASTVisitor, Expression, SourceLocation, Statement } from './base.js';

// ============================================
// CONTROL FLOW - CONDITIONAL
// ============================================

/**
 * If statement node
 *
 * Represents: if (condition) { ... } else { ... }
 */
export class IfStatement extends Statement {
  /**
   * Creates an If statement
   * @param condition - Condition expression
   * @param thenBranch - Statements if condition is true
   * @param elseBranch - Statements if condition is false (optional)
   * @param location - Source location
   */
  constructor(
    protected readonly condition: Expression,
    protected readonly thenBranch: Statement[],
    protected readonly elseBranch: Statement[] | null,
    location: SourceLocation
  ) {
    super(ASTNodeType.IF_STMT, location);
  }

  public getCondition(): Expression {
    return this.condition;
  }

  public getThenBranch(): Statement[] {
    return this.thenBranch;
  }

  public getElseBranch(): Statement[] | null {
    return this.elseBranch;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitIfStatement(this);
  }
}

/**
 * Match case clause - used by both Switch and Match statements
 */
export interface CaseClause {
  value: Expression;
  body: Statement[];
  location: SourceLocation;
}

/**
 * Switch statement node - C-style syntax
 *
 * Represents: switch (value) { case 1: ... break; case 2: ... default: ... }
 *
 * Note: Fall-through is explicit (no automatic break).
 * Use 'break' to exit a case.
 */
export class SwitchStatement extends Statement {
  /**
   * Creates a Switch statement
   * @param value - Value being switched on
   * @param cases - Case clauses
   * @param defaultCase - Default case body (optional)
   * @param location - Source location
   */
  constructor(
    protected readonly value: Expression,
    protected readonly cases: CaseClause[],
    protected readonly defaultCase: Statement[] | null,
    location: SourceLocation
  ) {
    super(ASTNodeType.SWITCH_STMT, location);
  }

  public getValue(): Expression {
    return this.value;
  }

  public getCases(): CaseClause[] {
    return this.cases;
  }

  public getDefaultCase(): Statement[] | null {
    return this.defaultCase;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitSwitchStatement(this);
  }
}

/**
 * Match statement node - DEPRECATED, use SwitchStatement
 * Kept for backward compatibility during transition.
 *
 * @deprecated Use SwitchStatement instead
 */
export class MatchStatement extends Statement {
  constructor(
    protected readonly value: Expression,
    protected readonly cases: CaseClause[],
    protected readonly defaultCase: Statement[] | null,
    location: SourceLocation
  ) {
    super(ASTNodeType.MATCH_STMT, location);
  }

  public getValue(): Expression {
    return this.value;
  }

  public getCases(): CaseClause[] {
    return this.cases;
  }

  public getDefaultCase(): Statement[] | null {
    return this.defaultCase;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitMatchStatement(this);
  }
}

// ============================================
// CONTROL FLOW - LOOPS
// ============================================

/**
 * While statement node
 *
 * Represents: while (condition) { ... }
 */
export class WhileStatement extends Statement {
  /**
   * Creates a While statement
   * @param condition - Loop condition
   * @param body - Loop body statements
   * @param location - Source location
   */
  constructor(
    protected readonly condition: Expression,
    protected readonly body: Statement[],
    location: SourceLocation
  ) {
    super(ASTNodeType.WHILE_STMT, location);
  }

  public getCondition(): Expression {
    return this.condition;
  }

  public getBody(): Statement[] {
    return this.body;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitWhileStatement(this);
  }
}

/**
 * Do-while statement node - C-style syntax
 *
 * Represents: do { body } while (condition);
 *
 * The body executes at least once before the condition is checked.
 * This is a common pattern in 6502 programming for efficient loops.
 */
export class DoWhileStatement extends Statement {
  /**
   * Creates a Do-While statement
   * @param body - Loop body statements (executed at least once)
   * @param condition - Loop condition (checked after body)
   * @param location - Source location
   */
  constructor(
    protected readonly body: Statement[],
    protected readonly condition: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.DO_WHILE_STMT, location);
  }

  public getBody(): Statement[] {
    return this.body;
  }

  public getCondition(): Expression {
    return this.condition;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitDoWhileStatement(this);
  }
}

/**
 * For statement node - C-style syntax with extended features
 *
 * Represents:
 * - for (i = 0 to 10) { ... }
 * - for (i = 10 downto 0) { ... }
 * - for (i = 0 to 100 step 5) { ... }
 * - for (let i: word = 0 to 5000) { ... }
 *
 * Features:
 * - Direction: 'to' (count up) or 'downto' (count down)
 * - Step: optional increment/decrement value
 * - Variable type: explicit type for 16-bit counters
 * - Inferred counter type: set by semantic analyzer based on range
 */
export class ForStatement extends Statement {
  /**
   * Counter type inferred by semantic analyzer
   * 'byte' for range 0-255, 'word' for larger ranges
   */
  protected inferredCounterType: 'byte' | 'word' = 'byte';

  /**
   * Creates a For statement
   * @param variable - Loop variable name
   * @param variableType - Explicit type annotation (null = infer from range)
   * @param start - Start value expression
   * @param end - End value expression
   * @param direction - Loop direction: 'to' or 'downto'
   * @param step - Step value expression (null = 1)
   * @param body - Loop body statements
   * @param location - Source location
   */
  constructor(
    protected readonly variable: string,
    protected readonly variableType: string | null,
    protected readonly start: Expression,
    protected readonly end: Expression,
    protected readonly direction: 'to' | 'downto',
    protected readonly step: Expression | null,
    protected readonly body: Statement[],
    location: SourceLocation
  ) {
    super(ASTNodeType.FOR_STMT, location);
  }

  public getVariable(): string {
    return this.variable;
  }

  public getVariableType(): string | null {
    return this.variableType;
  }

  public getStart(): Expression {
    return this.start;
  }

  public getEnd(): Expression {
    return this.end;
  }

  public getDirection(): 'to' | 'downto' {
    return this.direction;
  }

  public getStep(): Expression | null {
    return this.step;
  }

  public getBody(): Statement[] {
    return this.body;
  }

  public getInferredCounterType(): 'byte' | 'word' {
    return this.inferredCounterType;
  }

  public setInferredCounterType(type: 'byte' | 'word'): void {
    this.inferredCounterType = type;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitForStatement(this);
  }
}

// ============================================
// CONTROL FLOW - JUMPS
// ============================================

/**
 * Return statement node
 *
 * Represents: return, return 42
 */
export class ReturnStatement extends Statement {
  /**
   * Creates a Return statement
   * @param value - Return value expression (null for void return)
   * @param location - Source location
   */
  constructor(
    protected readonly value: Expression | null,
    location: SourceLocation
  ) {
    super(ASTNodeType.RETURN_STMT, location);
  }

  public getValue(): Expression | null {
    return this.value;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitReturnStatement(this);
  }
}

/**
 * Break statement node
 *
 * Represents: break (exits nearest loop or switch)
 */
export class BreakStatement extends Statement {
  /**
   * Creates a Break statement
   * @param location - Source location
   */
  constructor(location: SourceLocation) {
    super(ASTNodeType.BREAK_STMT, location);
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitBreakStatement(this);
  }
}

/**
 * Continue statement node
 *
 * Represents: continue (skips to next loop iteration)
 */
export class ContinueStatement extends Statement {
  /**
   * Creates a Continue statement
   * @param location - Source location
   */
  constructor(location: SourceLocation) {
    super(ASTNodeType.CONTINUE_STMT, location);
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitContinueStatement(this);
  }
}

// ============================================
// STRUCTURAL STATEMENTS
// ============================================

/**
 * Expression statement node
 *
 * Represents an expression used as a statement: foo(), x = 5
 */
export class ExpressionStatement extends Statement {
  /**
   * Creates an Expression statement
   * @param expression - The expression
   * @param location - Source location
   */
  constructor(
    protected readonly expression: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.EXPR_STMT, location);
  }

  public getExpression(): Expression {
    return this.expression;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitExpressionStatement(this);
  }
}

/**
 * Block statement node
 *
 * Represents a sequence of statements enclosed in braces.
 * Used inside functions, if/else, loops, etc.
 */
export class BlockStatement extends Statement {
  /**
   * Creates a Block statement
   * @param statements - Statements in the block
   * @param location - Source location
   */
  constructor(
    protected readonly statements: Statement[],
    location: SourceLocation
  ) {
    super(ASTNodeType.BLOCK_STMT, location);
  }

  public getStatements(): Statement[] {
    return this.statements;
  }

  public accept<R>(visitor: ASTVisitor<R>): R {
    return visitor.visitBlockStatement(this);
  }
}