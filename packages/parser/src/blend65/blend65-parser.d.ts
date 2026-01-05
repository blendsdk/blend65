/**
 * Blend65 Parser
 *
 * Concrete parser implementation for the Blend65 language.
 * Extends RecursiveDescentParser with Blend65-specific syntax rules.
 */
import { Token } from '@blend65/lexer';
import { Program, Expression } from '@blend65/ast';
import { RecursiveDescentParser } from '../strategies/recursive-descent.js';
import { ParserOptions } from '../core/base-parser.js';
/**
 * Blend65-specific parser extending recursive descent strategy
 */
export declare class Blend65Parser extends RecursiveDescentParser<Program> {
    private isInsideFunction;
    private loopDepth;
    constructor(tokens: Token[], options?: ParserOptions);
    /**
     * Parse a complete Blend65 program
     * Entry point for parsing
     */
    parse(): Program;
    /**
     * Parse module declaration: module Game.Main
     */
    private parseModuleDeclaration;
    /**
     * Parse qualified name: Game.Main, Engine.Graphics
     */
    private parseQualifiedName;
    /**
     * Parse import declaration
     */
    private parseImportDeclaration;
    /**
     * Parse export declaration
     */
    private parseExportDeclaration;
    /**
     * Parse a declaration
     */
    private parseDeclaration;
    /**
     * Parse function declaration with callback support
     */
    private parseFunctionDeclaration;
    /**
     * Parse parameter list
     */
    private parseParameterList;
    /**
     * Parse variable declaration with storage classes
     */
    private parseVariableDeclaration;
    /**
     * Parse type declaration (placeholder)
     */
    private parseTypeDeclaration;
    /**
     * Parse enum declaration: enum Name value1 = 1, value2, value3 = 5 end enum
     */
    private parseEnumDeclaration;
    /**
     * Parse type annotation
     */
    private parseTypeAnnotation;
    /**
     * Parse a statement block until terminator
     */
    private parseStatementBlock;
    /**
     * Parse a statement
     */
    private parseStatement;
    /**
     * Parse if statement: if condition then ... else ... end if
     */
    private parseIfStatement;
    /**
     * Parse while statement: while condition ... end while
     */
    private parseWhileStatement;
    /**
     * Parse for statement: for var = start to end ... next
     */
    private parseForStatement;
    /**
     * Parse match statement: match expression case value: ... default: ... end match
     */
    private parseMatchStatement;
    /**
     * Parse individual match case
     */
    private parseMatchCase;
    /**
     * Parse return statement
     */
    private parseReturnStatement;
    /**
     * Parse break statement: break
     * Exits the containing loop
     */
    private parseBreakStatement;
    /**
     * Parse continue statement: continue
     * Skips to next iteration of containing loop
     */
    private parseContinueStatement;
    /**
     * Parse primary expression (literals, identifiers, parenthesized expressions)
     * Required implementation from RecursiveDescentParser
     */
    protected parsePrimaryExpression(): Expression;
    /**
     * Parse array literal: [1, 2, 3]
     */
    private parseArrayLiteral;
}
//# sourceMappingURL=blend65-parser.d.ts.map