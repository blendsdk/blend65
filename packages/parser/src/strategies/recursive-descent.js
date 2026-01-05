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
import { TokenType } from '@blend65/lexer';
import { BaseParser } from '../core/base-parser.js';
/** Precedence levels for operators (higher number = binds tighter). */
export var Precedence;
(function (Precedence) {
    Precedence[Precedence["None"] = 0] = "None";
    Precedence[Precedence["Assignment"] = 1] = "Assignment";
    Precedence[Precedence["Conditional"] = 2] = "Conditional";
    Precedence[Precedence["LogicalOr"] = 3] = "LogicalOr";
    Precedence[Precedence["LogicalAnd"] = 4] = "LogicalAnd";
    Precedence[Precedence["BitwiseOr"] = 5] = "BitwiseOr";
    Precedence[Precedence["BitwiseXor"] = 6] = "BitwiseXor";
    Precedence[Precedence["BitwiseAnd"] = 7] = "BitwiseAnd";
    Precedence[Precedence["Equality"] = 8] = "Equality";
    Precedence[Precedence["Relational"] = 9] = "Relational";
    Precedence[Precedence["Shift"] = 10] = "Shift";
    Precedence[Precedence["Additive"] = 11] = "Additive";
    Precedence[Precedence["Multiplicative"] = 12] = "Multiplicative";
    Precedence[Precedence["Exponent"] = 13] = "Exponent";
    Precedence[Precedence["Unary"] = 13] = "Unary";
    Precedence[Precedence["Postfix"] = 14] = "Postfix";
    Precedence[Precedence["Call"] = 15] = "Call";
    Precedence[Precedence["Primary"] = 16] = "Primary";
})(Precedence || (Precedence = {}));
/** Base class with expression parsing and postfix/call/member support. */
export class RecursiveDescentParser extends BaseParser {
    /**
     * Operator precedence table
     * Subclasses should override this to define their operators
     */
    operatorPrecedence = new Map();
    constructor(tokens, options = {}) {
        super(tokens, options);
        // Initialize default operators. Subclasses may register additional ones
        // in their own constructors after super(). Avoid calling overridable
        // methods from base constructor.
        this.initializeOperators();
    }
    /**
     * Initialize operator precedence table for Blend65
     * Subclasses should override this to define their operators
     */
    initializeOperators() {
        // Assignment operators
        this.registerOperator('=', Precedence.Assignment, true);
        this.registerOperator('+=', Precedence.Assignment, true);
        this.registerOperator('-=', Precedence.Assignment, true);
        this.registerOperator('*=', Precedence.Assignment, true);
        this.registerOperator('/=', Precedence.Assignment, true);
        this.registerOperator('%=', Precedence.Assignment, true);
        this.registerOperator('&=', Precedence.Assignment, true);
        this.registerOperator('|=', Precedence.Assignment, true);
        this.registerOperator('^=', Precedence.Assignment, true);
        this.registerOperator('<<=', Precedence.Assignment, true);
        this.registerOperator('>>=', Precedence.Assignment, true);
        // Logical operators (Blend65 style)
        this.registerOperator('or', Precedence.LogicalOr);
        this.registerOperator('and', Precedence.LogicalAnd);
        // Bitwise operators
        this.registerOperator('|', Precedence.BitwiseOr);
        this.registerOperator('xor', Precedence.BitwiseXor);
        this.registerOperator('^', Precedence.BitwiseXor);
        this.registerOperator('&', Precedence.BitwiseAnd);
        // Equality and relational operators
        this.registerOperator('==', Precedence.Equality);
        this.registerOperator('!=', Precedence.Equality);
        this.registerOperator('<', Precedence.Relational);
        this.registerOperator('>', Precedence.Relational);
        this.registerOperator('<=', Precedence.Relational);
        this.registerOperator('>=', Precedence.Relational);
        // Shift operators
        this.registerOperator('<<', Precedence.Shift);
        this.registerOperator('>>', Precedence.Shift);
        // Arithmetic operators
        this.registerOperator('+', Precedence.Additive);
        this.registerOperator('-', Precedence.Additive);
        this.registerOperator('*', Precedence.Multiplicative);
        this.registerOperator('/', Precedence.Multiplicative);
        this.registerOperator('%', Precedence.Multiplicative);
        // Exponentiation (right-associative)
        this.registerOperator('**', Precedence.Exponent, true);
    }
    /**
     * Canonical expression entrypoint with staged precedence:
     * assignment → conditional → binary → unary → postfix → primary
     */
    parseExpression() {
        return this.parseAssignmentExpression();
    }
    /**
     * Parse assignment expressions and validate assignable LHS.
     */
    parseAssignmentExpression() {
        const leftStart = this.peek();
        let left = this.parseConditionalExpression();
        // If next token is an assignment operator, handle specially
        const opToken = this.peek();
        const opLex = opToken.value;
        const info = this.operatorPrecedence.get(opLex);
        if (!info || info.precedence !== Precedence.Assignment) {
            return left;
        }
        // Validate assignable LHS
        const isAssignable = left &&
            (left.type === 'Identifier' || left.type === 'MemberExpr' || left.type === 'IndexExpr');
        if (!isAssignable) {
            // Fallback: treat as binary to avoid crash
            return this.parseBinaryExpression(Precedence.None);
        }
        this.advance(); // consume operator
        const right = this.parseAssignmentExpression(); // right-associative
        return this.factory.createAssignmentExpr(opLex, left, right, {
            start: left.metadata?.start ?? leftStart.start,
            end: right.metadata?.end ?? this.previous().end,
        });
    }
    /**
     * Parse conditional (ternary) expression: test ? consequent : alternate
     * Note: Blend65 v0.1 doesn't have ternary operators, but keeping for compatibility
     */
    parseConditionalExpression() {
        let test = this.parseBinaryExpression(Precedence.None);
        if (this.checkLexeme('?')) {
            const q = this.advance();
            const consequent = this.parseAssignmentExpression();
            this.consume(TokenType.COLON, "Expected ':' in conditional expression");
            const alternate = this.parseAssignmentExpression();
            return this.factory.create('ConditionalExpr', {
                test,
                consequent,
                alternate,
                metadata: {
                    start: test.metadata?.start ?? q.start,
                    end: alternate.metadata?.end ?? this.previous().end,
                },
            });
        }
        return test;
    }
    /**
     * Register an operator with its precedence
     */
    registerOperator(operator, precedence, rightAssociative = false) {
        this.operatorPrecedence.set(operator, { precedence, rightAssociative });
    }
    /**
     * Get operator precedence
     */
    getOperatorPrecedence(operator) {
        return this.operatorPrecedence.get(operator)?.precedence || Precedence.None;
    }
    /**
     * Check if an operator is right-associative
     */
    isRightAssociative(operator) {
        return this.operatorPrecedence.get(operator)?.rightAssociative || false;
    }
    /**
     * Parse a binary expression with precedence climbing
     * This is a common pattern in recursive descent parsers
     */
    parseBinaryExpression(minPrecedence = Precedence.None) {
        let left = this.parseUnaryExpression();
        while (true) {
            const token = this.peek();
            const operator = token.value;
            const info = this.operatorPrecedence.get(operator);
            if (!info) {
                // Stop on non-operator or terminators
                if (this.check(TokenType.RIGHT_PAREN) ||
                    this.check(TokenType.RIGHT_BRACKET) ||
                    this.check(TokenType.SEMICOLON) ||
                    this.check(TokenType.NEWLINE) ||
                    this.check(TokenType.EOF) ||
                    this.checkLexeme(',') ||
                    this.checkLexeme('}')) {
                    break;
                }
                break;
            }
            const precedence = info.precedence;
            // Do not consume assignment operators here; handled by parseAssignmentExpression
            if (precedence === Precedence.Assignment) {
                break;
            }
            if (precedence < minPrecedence) {
                break;
            }
            const operatorToken = this.advance(); // Consume operator
            const nextMinPrecedence = this.isRightAssociative(operator)
                ? precedence
                : (precedence + 1);
            const right = this.parseBinaryExpression(nextMinPrecedence);
            left = this.factory.createBinaryExpr(operator, left, right, {
                start: left.metadata?.start || operatorToken.start,
                end: right.metadata?.end || operatorToken.end,
            });
        }
        return left;
    }
    /**
     * Parse a unary expression
     * Blend65 supports: !, -, +, ~, not (no ++ or -- operators)
     */
    parseUnaryExpression() {
        // Check for unary operators
        const token = this.peek();
        const unaryOps = ['!', '-', '+', '~', 'not'];
        if (unaryOps.includes(token.value)) {
            const operator = this.advance().value;
            const operand = this.parseUnaryExpression();
            return this.factory.createUnaryExpr(operator, operand, {
                start: token.start,
                end: operand.metadata?.end || token.end,
            });
        }
        return this.parsePostfixExpression();
    }
    /**
     * Parse a postfix expression
     * Blend65 supports function calls, array indexing, member access
     * No postfix ++ or -- operators
     */
    parsePostfixExpression() {
        let expr = this.parsePrimaryExpression();
        while (true) {
            // Function call: expr()
            if (this.check(TokenType.LEFT_PAREN)) {
                expr = this.parseCallExpression(expr);
            }
            // Array access: expr[]
            else if (this.check(TokenType.LEFT_BRACKET)) {
                expr = this.parseIndexExpression(expr);
            }
            // Member access: expr.member
            else if (this.check(TokenType.DOT)) {
                expr = this.parseMemberExpression(expr);
            }
            else {
                break;
            }
        }
        return expr;
    }
    /**
     * Parse a call expression: func(args)
     */
    parseCallExpression(callee) {
        const lparen = this.consume(TokenType.LEFT_PAREN, "Expected '('");
        const args = [];
        if (!this.check(TokenType.RIGHT_PAREN)) {
            do {
                args.push(this.parseExpression());
            } while (this.match(TokenType.COMMA));
        }
        const rparen = this.consume(TokenType.RIGHT_PAREN, "Expected ')'");
        return this.factory.createCallExpr(callee, args, {
            start: callee.metadata?.start ?? lparen.start,
            end: rparen.end,
        });
    }
    /**
     * Parse an index expression: array[index]
     */
    parseIndexExpression(object) {
        const lbracket = this.consume(TokenType.LEFT_BRACKET, "Expected '['");
        const index = this.parseExpression();
        const rbracket = this.consume(TokenType.RIGHT_BRACKET, "Expected ']'");
        return this.factory.createIndexExpr(object, index, {
            start: object.metadata?.start ?? lbracket.start,
            end: rbracket.end,
        });
    }
    /**
     * Parse a member expression: object.member
     */
    parseMemberExpression(object) {
        this.consume(TokenType.DOT, "Expected '.'");
        const member = this.consume(TokenType.IDENTIFIER, 'Expected identifier');
        return this.factory.createMemberExpr(object, member.value, {
            start: object.metadata?.start ?? member.start,
            end: member.end,
        });
    }
    /**
     * Helper: Skip newlines (useful for languages with optional newlines)
     */
    skipNewlines() {
        this.skip(TokenType.NEWLINE);
    }
    /**
     * Helper: Check if current token is a statement terminator
     */
    isStatementTerminator() {
        return (this.check(TokenType.SEMICOLON, TokenType.NEWLINE, TokenType.EOF) ||
            this.check(TokenType.RIGHT_BRACE));
    }
    /**
     * Helper: Consume a statement terminator
     */
    consumeStatementTerminator() {
        if (this.match(TokenType.SEMICOLON, TokenType.NEWLINE)) {
            this.skipNewlines();
        }
    }
    /**
     * Helper: Check if current token is a Blend65 block terminator
     */
    isBlockTerminator() {
        return this.checkLexemes('end', 'next', 'else', 'case', 'default');
    }
    /**
     * Helper: Synchronize to a block terminator for error recovery
     */
    synchronizeToBlockEnd() {
        while (!this.isAtEnd() && !this.isBlockTerminator()) {
            this.advance();
        }
    }
}
//# sourceMappingURL=recursive-descent.js.map