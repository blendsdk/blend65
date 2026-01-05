/**
 * Recursive Descent Parser Strategy
 *
 * A practical, readable approach to parsing: each grammar rule becomes a
 * method that calls other methods for its sub-rules. This class provides
 * a robust expression pipeline and common helpers so novices can build
 * parsers without reinventing token navigation or precedence handling.
 *
 * Adapted for Blend65 from original blend-lang implementation.
 */
import { Token } from '@blend65/lexer';
import { ASTNode, Expression } from '@blend65/ast';
import { BaseParser, ParserOptions } from '../core/base-parser.js';
/** Precedence levels for operators (higher number = binds tighter). */
export declare enum Precedence {
    None = 0,
    Assignment = 1,// =, +=, -=, etc.
    Conditional = 2,// ?:
    LogicalOr = 3,// ||, or
    LogicalAnd = 4,// &&, and
    BitwiseOr = 5,// |
    BitwiseXor = 6,// ^, xor
    BitwiseAnd = 7,// &
    Equality = 8,// ==, !=
    Relational = 9,// <, >, <=, >=
    Shift = 10,// <<, >>
    Additive = 11,// +, -
    Multiplicative = 12,// *, /, %
    Exponent = 13,// ** (right-associative)
    Unary = 13,// !, -, +, ~, not
    Postfix = 14,// (removed ++ and -- for Blend65)
    Call = 15,// (), [], .
    Primary = 16
}
/** Operator information stored in the precedence table. */
export interface OperatorInfo {
    precedence: Precedence;
    rightAssociative?: boolean;
}
/** Base class with expression parsing and postfix/call/member support. */
export declare abstract class RecursiveDescentParser<T extends ASTNode = ASTNode> extends BaseParser<T> {
    /**
     * Operator precedence table
     * Subclasses should override this to define their operators
     */
    protected operatorPrecedence: Map<string, OperatorInfo>;
    constructor(tokens: Token[], options?: ParserOptions);
    /**
     * Initialize operator precedence table for Blend65
     * Subclasses should override this to define their operators
     */
    protected initializeOperators(): void;
    /**
     * Canonical expression entrypoint with staged precedence:
     * assignment → conditional → binary → unary → postfix → primary
     */
    protected parseExpression(): Expression;
    /**
     * Parse assignment expressions and validate assignable LHS.
     */
    protected parseAssignmentExpression(): Expression;
    /**
     * Parse conditional (ternary) expression: test ? consequent : alternate
     * Note: Blend65 v0.1 doesn't have ternary operators, but keeping for compatibility
     */
    protected parseConditionalExpression(): Expression;
    /**
     * Register an operator with its precedence
     */
    protected registerOperator(operator: string, precedence: Precedence, rightAssociative?: boolean): void;
    /**
     * Get operator precedence
     */
    protected getOperatorPrecedence(operator: string): Precedence;
    /**
     * Check if an operator is right-associative
     */
    protected isRightAssociative(operator: string): boolean;
    /**
     * Parse a binary expression with precedence climbing
     * This is a common pattern in recursive descent parsers
     */
    protected parseBinaryExpression(minPrecedence?: Precedence): Expression;
    /**
     * Parse a unary expression
     * Blend65 supports: !, -, +, ~, not (no ++ or -- operators)
     */
    protected parseUnaryExpression(): Expression;
    /**
     * Parse a postfix expression
     * Blend65 supports function calls, array indexing, member access
     * No postfix ++ or -- operators
     */
    protected parsePostfixExpression(): Expression;
    /**
     * Parse a call expression: func(args)
     */
    protected parseCallExpression(callee: Expression): ASTNode;
    /**
     * Parse an index expression: array[index]
     */
    protected parseIndexExpression(object: Expression): ASTNode;
    /**
     * Parse a member expression: object.member
     */
    protected parseMemberExpression(object: Expression): ASTNode;
    /**
     * Parse a primary expression (literals, identifiers, parenthesized expressions)
     * Subclasses must override this
     */
    protected abstract parsePrimaryExpression(): Expression;
    /**
     * Helper: Skip newlines (useful for languages with optional newlines)
     */
    protected skipNewlines(): void;
    /**
     * Helper: Check if current token is a statement terminator
     */
    protected isStatementTerminator(): boolean;
    /**
     * Helper: Consume a statement terminator
     */
    protected consumeStatementTerminator(): void;
    /**
     * Helper: Check if current token is a Blend65 block terminator
     */
    protected isBlockTerminator(): boolean;
    /**
     * Helper: Synchronize to a block terminator for error recovery
     */
    protected synchronizeToBlockEnd(): void;
}
//# sourceMappingURL=recursive-descent.d.ts.map