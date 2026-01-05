/**
 * Blend65 Parser
 *
 * Concrete parser implementation for the Blend65 language.
 * Extends RecursiveDescentParser with Blend65-specific syntax rules.
 */
import { TokenType } from '@blend65/lexer';
import { RecursiveDescentParser } from '../strategies/recursive-descent.js';
/**
 * Blend65-specific parser extending recursive descent strategy
 */
export class Blend65Parser extends RecursiveDescentParser {
    isInsideFunction = false;
    loopDepth = 0;
    constructor(tokens, options = {}) {
        super(tokens, options);
        // Blend65 doesn't need additional operators beyond the base set
        // The base class already includes the correct operators for Blend65
    }
    /**
     * Parse a complete Blend65 program
     * Entry point for parsing
     */
    parse() {
        // Skip any leading newlines
        this.skipNewlines();
        // Every Blend65 file starts with a module declaration
        const module = this.parseModuleDeclaration();
        const imports = [];
        const exports = [];
        const body = [];
        // Parse imports, exports, and declarations
        while (!this.isAtEnd()) {
            this.skipNewlines();
            if (this.isAtEnd())
                break;
            const current = this.peek();
            if (current.value === 'import') {
                imports.push(this.parseImportDeclaration());
            }
            else if (current.value === 'export') {
                exports.push(this.parseExportDeclaration());
            }
            else {
                const decl = this.parseDeclaration();
                if (decl) {
                    body.push(decl);
                }
            }
            this.skipNewlines();
        }
        return this.factory.createProgram(module, imports, exports, body, {
            start: module.metadata?.start || { line: 1, column: 1, offset: 0 },
            end: this.previous().end,
        });
    }
    /**
     * Parse module declaration: module Game.Main
     */
    parseModuleDeclaration() {
        const moduleToken = this.consume(TokenType.MODULE, "Expected 'module'");
        const name = this.parseQualifiedName();
        this.consumeStatementTerminator();
        return this.factory.createModuleDeclaration(name, {
            start: moduleToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse qualified name: Game.Main, Engine.Graphics
     */
    parseQualifiedName() {
        const startToken = this.peek();
        const parts = [];
        parts.push(this.consume(TokenType.IDENTIFIER, 'Expected identifier').value);
        while (this.match(TokenType.DOT)) {
            parts.push(this.consume(TokenType.IDENTIFIER, "Expected identifier after '.'").value);
        }
        return this.factory.createQualifiedName(parts, {
            start: startToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse import declaration
     */
    parseImportDeclaration() {
        const importToken = this.consume(TokenType.IMPORT, "Expected 'import'");
        const specifiers = [];
        // Parse import specifiers
        do {
            const imported = this.consume(TokenType.IDENTIFIER, 'Expected identifier').value;
            let local = null;
            if (this.checkLexeme('as')) {
                this.advance(); // consume 'as'
                local = this.consume(TokenType.IDENTIFIER, "Expected identifier after 'as'").value;
            }
            specifiers.push(this.factory.createImportSpecifier(imported, local));
        } while (this.match(TokenType.COMMA));
        this.consume(TokenType.FROM, "Expected 'from'");
        // Parse source - always a qualified name (e.g., c64.sprites, core.helpers)
        const source = this.parseQualifiedName();
        this.consumeStatementTerminator();
        return this.factory.createImportDeclaration(specifiers, source, {
            start: importToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse export declaration
     */
    parseExportDeclaration() {
        const exportToken = this.consume(TokenType.EXPORT, "Expected 'export'");
        const declaration = this.parseDeclaration();
        if (!declaration) {
            throw new Error("Expected declaration after 'export'");
        }
        // Mark declaration as exported
        if (declaration.type === 'FunctionDeclaration' ||
            declaration.type === 'VariableDeclaration' ||
            declaration.type === 'EnumDeclaration') {
            declaration.exported = true;
        }
        return this.factory.createExportDeclaration(declaration, {
            start: exportToken.start,
            end: declaration.metadata?.end || this.previous().end,
        });
    }
    /**
     * Parse a declaration
     */
    parseDeclaration() {
        this.skipNewlines();
        if (this.isAtEnd())
            return null;
        const current = this.peek();
        // NEW: Handle 'callback' keyword
        const callback = this.checkLexeme('callback');
        if (callback) {
            this.advance(); // consume 'callback'
            // After 'callback', must be followed by 'function'
            if (this.checkLexeme('function')) {
                return this.parseFunctionDeclaration(false, true); // exported=false, callback=true
            }
            else {
                throw new Error("Expected 'function' after 'callback'");
            }
        }
        switch (current.value) {
            case 'function':
                return this.parseFunctionDeclaration(false, false); // exported=false, callback=false
            case 'var':
            case 'zp':
            case 'ram':
            case 'data':
            case 'const':
            case 'io':
                return this.parseVariableDeclaration();
            case 'type':
                return this.parseTypeDeclaration();
            case 'enum':
                return this.parseEnumDeclaration();
            default:
                // Try parsing as statement if not a declaration
                const stmt = this.parseStatement();
                if (stmt && stmt.type === 'ExpressionStatement') {
                    // Convert expression statements to declarations if needed
                    // For now, skip non-declaration statements at top level
                    return null;
                }
                return null;
        }
    }
    /**
     * Parse function declaration with callback support
     */
    parseFunctionDeclaration(exported = false, callback = false) {
        const funcToken = this.consume(TokenType.FUNCTION, "Expected 'function'");
        const name = this.consume(TokenType.IDENTIFIER, 'Expected function name').value;
        this.consume(TokenType.LEFT_PAREN, "Expected '('");
        const params = this.parseParameterList();
        this.consume(TokenType.RIGHT_PAREN, "Expected ')'");
        let returnType = this.factory.createPrimitiveType('void');
        if (this.match(TokenType.COLON)) {
            returnType = this.parseTypeAnnotation();
        }
        this.consumeStatementTerminator();
        // Set function context for body parsing
        const wasInsideFunction = this.isInsideFunction;
        this.isInsideFunction = true;
        const body = this.parseStatementBlock();
        // Restore previous context
        this.isInsideFunction = wasInsideFunction;
        this.consume(TokenType.END, "Expected 'end'");
        this.consumeLexeme('function', "Expected 'function' after 'end'");
        this.consumeStatementTerminator();
        return this.factory.createFunctionDeclaration(name, params, returnType, body, exported, callback, {
            start: funcToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse parameter list
     */
    parseParameterList() {
        const params = [];
        if (this.check(TokenType.RIGHT_PAREN)) {
            return params;
        }
        do {
            const name = this.consume(TokenType.IDENTIFIER, 'Expected parameter name').value;
            this.consume(TokenType.COLON, "Expected ':' after parameter name");
            const paramType = this.parseTypeAnnotation();
            let defaultValue = null;
            const optional = false;
            if (this.match(TokenType.ASSIGN)) {
                defaultValue = this.parseExpression();
            }
            params.push(this.factory.createParameter(name, paramType, optional, defaultValue));
        } while (this.match(TokenType.COMMA));
        return params;
    }
    /**
     * Parse variable declaration with storage classes
     */
    parseVariableDeclaration() {
        const startToken = this.peek();
        // Parse storage class if present
        let storageClass = null;
        if (this.checkLexemes('zp', 'ram', 'data', 'const', 'io')) {
            const storageClassToken = this.peek();
            storageClass = this.advance().value;
            // Check if storage class is allowed in current context
            if (this.isInsideFunction) {
                throw new Error(`Storage class '${storageClass}' not allowed inside functions. ` +
                    `Local variables must use automatic storage (no storage class). ` +
                    `Location: line ${storageClassToken.start.line}, column ${storageClassToken.start.column}`);
            }
        }
        this.consume(TokenType.VAR, "Expected 'var'");
        const name = this.consume(TokenType.IDENTIFIER, 'Expected variable name').value;
        this.consume(TokenType.COLON, "Expected ':' after variable name");
        const varType = this.parseTypeAnnotation();
        let initializer = null;
        if (this.match(TokenType.ASSIGN)) {
            initializer = this.parseExpression();
        }
        this.consumeStatementTerminator();
        return this.factory.createVariableDeclaration(name, varType, initializer, storageClass, false, {
            start: startToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse type declaration (placeholder)
     */
    parseTypeDeclaration() {
        // For now, skip type declarations as they're not fully implemented
        throw new Error('Type declarations not yet implemented');
    }
    /**
     * Parse enum declaration: enum Name value1 = 1, value2, value3 = 5 end enum
     */
    parseEnumDeclaration() {
        const enumToken = this.consume(TokenType.ENUM, "Expected 'enum'");
        const name = this.consume(TokenType.IDENTIFIER, 'Expected enum name').value;
        this.consumeStatementTerminator();
        const members = [];
        let autoValue = 0;
        while (!this.isAtEnd() && !this.check(TokenType.END)) {
            this.skipNewlines();
            if (this.check(TokenType.END))
                break;
            const memberName = this.consume(TokenType.IDENTIFIER, 'Expected enum member name').value;
            let value = null;
            if (this.match(TokenType.ASSIGN)) {
                value = this.parseExpression();
                // Update auto-increment if this is a numeric constant
                if (value.type === 'Literal' && typeof value.value === 'number') {
                    autoValue = value.value + 1;
                }
            }
            else {
                // Auto-increment value
                value = this.factory.createLiteral(autoValue, autoValue.toString());
                autoValue++;
            }
            members.push(this.factory.createEnumMember(memberName, value));
            if (!this.match(TokenType.COMMA)) {
                // No more members, skip any trailing newlines before 'end'
                this.skipNewlines();
                break;
            }
            this.skipNewlines();
        }
        // Skip any final newlines before 'end'
        this.skipNewlines();
        this.consume(TokenType.END, "Expected 'end'");
        this.consumeLexeme('enum', "Expected 'enum' after 'end'");
        this.consumeStatementTerminator();
        return this.factory.createEnumDeclaration(name, members, false, {
            start: enumToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse type annotation
     */
    parseTypeAnnotation() {
        const token = this.peek();
        // Primitive types including callback
        if (this.checkLexemes('byte', 'word', 'boolean', 'void', 'callback')) {
            const primType = this.advance().value;
            const baseType = this.factory.createPrimitiveType(primType, {
                start: token.start,
                end: token.end,
            });
            // Check for array types: type[size]
            if (this.match(TokenType.LEFT_BRACKET)) {
                const size = this.parseExpression();
                const rbracket = this.consume(TokenType.RIGHT_BRACKET, "Expected ']'");
                return this.factory.createArrayType(baseType, size, {
                    start: token.start,
                    end: rbracket.end,
                });
            }
            return baseType;
        }
        // Named types (enum types, custom types)
        if (this.check(TokenType.IDENTIFIER)) {
            const typeName = this.advance().value;
            const namedType = this.factory.create('NamedType', {
                name: typeName,
                metadata: {
                    start: token.start,
                    end: token.end,
                },
            });
            // Check for array types: NamedType[size]
            if (this.match(TokenType.LEFT_BRACKET)) {
                const size = this.parseExpression();
                const rbracket = this.consume(TokenType.RIGHT_BRACKET, "Expected ']'");
                return this.factory.createArrayType(namedType, size, {
                    start: token.start,
                    end: rbracket.end,
                });
            }
            return namedType;
        }
        throw new Error(`Expected type annotation, got ${token.value}`);
    }
    /**
     * Parse a statement block until terminator
     */
    parseStatementBlock() {
        const statements = [];
        while (!this.isAtEnd() && !this.isBlockTerminator()) {
            this.skipNewlines();
            if (this.isAtEnd() || this.isBlockTerminator()) {
                break;
            }
            const stmt = this.parseStatement();
            if (stmt) {
                statements.push(stmt);
            }
        }
        return statements;
    }
    /**
     * Parse a statement
     */
    parseStatement() {
        this.skipNewlines();
        if (this.isAtEnd() || this.isBlockTerminator()) {
            return null;
        }
        const current = this.peek();
        switch (current.value) {
            case 'if':
                return this.parseIfStatement();
            case 'while':
                return this.parseWhileStatement();
            case 'for':
                return this.parseForStatement();
            case 'match':
                return this.parseMatchStatement();
            case 'break':
                return this.parseBreakStatement();
            case 'continue':
                return this.parseContinueStatement();
            case 'return':
                return this.parseReturnStatement();
            case 'var':
                // Local variable declaration (storage classes handled in parseVariableDeclaration)
                const varDecl = this.parseVariableDeclaration();
                return this.factory.createExpressionStatement(varDecl);
            case 'zp':
            case 'ram':
            case 'data':
            case 'const':
            case 'io':
                // Storage classes in statements - let parseVariableDeclaration handle the error
                const storageVarDecl = this.parseVariableDeclaration();
                return this.factory.createExpressionStatement(storageVarDecl);
            default:
                // Parse as expression statement
                const expr = this.parseExpression();
                this.consumeStatementTerminator();
                return this.factory.createExpressionStatement(expr);
        }
    }
    /**
     * Parse if statement: if condition then ... else ... end if
     */
    parseIfStatement() {
        const ifToken = this.consume(TokenType.IF, "Expected 'if'");
        const condition = this.parseExpression();
        this.consume(TokenType.THEN, "Expected 'then'");
        this.consumeStatementTerminator();
        const thenBody = this.parseStatementBlock();
        let elseBody = null;
        if (this.checkLexeme('else')) {
            this.advance(); // consume 'else'
            this.consumeStatementTerminator();
            elseBody = this.parseStatementBlock();
        }
        this.consume(TokenType.END, "Expected 'end'");
        this.consumeLexeme('if', "Expected 'if' after 'end'");
        this.consumeStatementTerminator();
        return this.factory.createIfStatement(condition, thenBody, elseBody, {
            start: ifToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse while statement: while condition ... end while
     */
    parseWhileStatement() {
        const whileToken = this.consume(TokenType.WHILE, "Expected 'while'");
        const condition = this.parseExpression();
        this.consumeStatementTerminator();
        // Enter loop context for break/continue validation
        this.loopDepth++;
        const body = this.parseStatementBlock();
        this.loopDepth--;
        this.consume(TokenType.END, "Expected 'end'");
        this.consumeLexeme('while', "Expected 'while' after 'end'");
        this.consumeStatementTerminator();
        return this.factory.createWhileStatement(condition, body, {
            start: whileToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse for statement: for var = start to end ... next
     */
    parseForStatement() {
        const forToken = this.consume(TokenType.FOR, "Expected 'for'");
        const variable = this.consume(TokenType.IDENTIFIER, 'Expected loop variable').value;
        this.consume(TokenType.ASSIGN, "Expected '='");
        const start = this.parseExpression();
        this.consume(TokenType.TO, "Expected 'to'");
        const end = this.parseExpression();
        let step = null;
        if (this.checkLexeme('step')) {
            this.advance(); // consume 'step'
            step = this.parseExpression();
        }
        this.consumeStatementTerminator();
        // Enter loop context for break/continue validation
        this.loopDepth++;
        const body = this.parseStatementBlock();
        this.loopDepth--;
        this.consume(TokenType.NEXT, "Expected 'next'");
        // Optional variable name after 'next'
        if (this.check(TokenType.IDENTIFIER)) {
            this.advance(); // consume variable name
        }
        this.consumeStatementTerminator();
        return this.factory.createForStatement(variable, start, end, step, body, {
            start: forToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse match statement: match expression case value: ... default: ... end match
     */
    parseMatchStatement() {
        const matchToken = this.consume(TokenType.MATCH, "Expected 'match'");
        const discriminant = this.parseExpression();
        this.consumeStatementTerminator();
        const cases = [];
        let defaultCase = null;
        while (!this.isAtEnd() && !this.check(TokenType.END)) {
            this.skipNewlines();
            if (this.checkLexeme('case')) {
                cases.push(this.parseMatchCase(false));
            }
            else if (this.checkLexeme('default')) {
                if (defaultCase !== null) {
                    throw new Error('Multiple default cases not allowed');
                }
                defaultCase = this.parseMatchCase(true);
            }
            else {
                break;
            }
        }
        this.consume(TokenType.END, "Expected 'end'");
        this.consumeLexeme('match', "Expected 'match' after 'end'");
        this.consumeStatementTerminator();
        return this.factory.createMatchStatement(discriminant, cases, defaultCase, {
            start: matchToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse individual match case
     */
    parseMatchCase(isDefault) {
        const startToken = this.peek();
        let test = null;
        if (isDefault) {
            this.advance(); // consume 'default'
        }
        else {
            this.advance(); // consume 'case'
            test = this.parseExpression();
        }
        this.consume(TokenType.COLON, "Expected ':'");
        this.consumeStatementTerminator();
        const consequent = this.parseStatementBlock();
        return this.factory.createMatchCase(test, consequent, {
            start: startToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse return statement
     */
    parseReturnStatement() {
        const returnToken = this.consume(TokenType.RETURN, "Expected 'return'");
        let value = null;
        if (!this.isStatementTerminator()) {
            value = this.parseExpression();
        }
        this.consumeStatementTerminator();
        return this.factory.createReturnStatement(value, {
            start: returnToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse break statement: break
     * Exits the containing loop
     */
    parseBreakStatement() {
        const breakToken = this.consume(TokenType.BREAK, "Expected 'break'");
        // Validate break is only used inside loops
        if (this.loopDepth === 0) {
            throw new Error(`break statement must be inside a loop (for, while). ` +
                `Location: line ${breakToken.start.line}, column ${breakToken.start.column}`);
        }
        this.consumeStatementTerminator();
        return this.factory.createBreakStatement({
            start: breakToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse continue statement: continue
     * Skips to next iteration of containing loop
     */
    parseContinueStatement() {
        const continueToken = this.consume(TokenType.CONTINUE, "Expected 'continue'");
        // Validate continue is only used inside loops
        if (this.loopDepth === 0) {
            throw new Error(`continue statement must be inside a loop (for, while). ` +
                `Location: line ${continueToken.start.line}, column ${continueToken.start.column}`);
        }
        this.consumeStatementTerminator();
        return this.factory.createContinueStatement({
            start: continueToken.start,
            end: this.previous().end,
        });
    }
    /**
     * Parse primary expression (literals, identifiers, parenthesized expressions)
     * Required implementation from RecursiveDescentParser
     */
    parsePrimaryExpression() {
        const token = this.peek();
        // Number literal
        if (this.check(TokenType.NUMBER)) {
            const numToken = this.advance();
            const value = numToken.value.startsWith('$')
                ? parseInt(numToken.value.slice(1), 16)
                : numToken.value.startsWith('0x')
                    ? parseInt(numToken.value, 16)
                    : numToken.value.startsWith('0b')
                        ? parseInt(numToken.value.slice(2), 2)
                        : parseInt(numToken.value, 10);
            return this.factory.createLiteral(value, numToken.value, {
                start: numToken.start,
                end: numToken.end,
            });
        }
        // String literal
        if (this.check(TokenType.STRING)) {
            const strToken = this.advance();
            const value = strToken.value.slice(1, -1); // Remove quotes
            return this.factory.createLiteral(value, strToken.value, {
                start: strToken.start,
                end: strToken.end,
            });
        }
        // Boolean literal
        if (this.check(TokenType.BOOLEAN)) {
            const boolToken = this.advance();
            const value = boolToken.value === 'true';
            return this.factory.createLiteral(value, boolToken.value, {
                start: boolToken.start,
                end: boolToken.end,
            });
        }
        // Identifier
        if (this.check(TokenType.IDENTIFIER)) {
            const idToken = this.advance();
            return this.factory.createIdentifier(idToken.value, {
                start: idToken.start,
                end: idToken.end,
            });
        }
        // Array literal
        if (this.check(TokenType.LEFT_BRACKET)) {
            return this.parseArrayLiteral();
        }
        // Parenthesized expression
        if (this.check(TokenType.LEFT_PAREN)) {
            this.advance(); // consume '('
            const expr = this.parseExpression();
            this.consume(TokenType.RIGHT_PAREN, "Expected ')'");
            return expr;
        }
        throw new Error(`Unexpected token in expression: ${token.value}`);
    }
    /**
     * Parse array literal: [1, 2, 3]
     */
    parseArrayLiteral() {
        const lbracket = this.consume(TokenType.LEFT_BRACKET, "Expected '['");
        const elements = [];
        if (!this.check(TokenType.RIGHT_BRACKET)) {
            do {
                elements.push(this.parseExpression());
            } while (this.match(TokenType.COMMA));
        }
        const rbracket = this.consume(TokenType.RIGHT_BRACKET, "Expected ']'");
        return this.factory.createArrayLiteral(elements, {
            start: lbracket.start,
            end: rbracket.end,
        });
    }
}
//# sourceMappingURL=blend65-parser.js.map