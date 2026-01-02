/**
 * Blend65 Parser
 *
 * Concrete parser implementation for the Blend65 language.
 * Extends RecursiveDescentParser with Blend65-specific syntax rules.
 */

import { Token, TokenType } from '@blend65/lexer';
import {
  ASTNode,
  Program,
  ModuleDeclaration,
  QualifiedName,
  Expression,
  Statement,
  Declaration,
  Identifier,
  Literal,
  BinaryExpr,
  UnaryExpr,
  CallExpr,
  IfStatement,
  WhileStatement,
  ForStatement,
  BreakStatement,
  ContinueStatement,
  MatchStatement,
  MatchCase,
  FunctionDeclaration,
  VariableDeclaration,
  EnumDeclaration,
  EnumMember,
  Parameter,
  ImportDeclaration,
  ImportSpecifier,
  ExportDeclaration,
  PrimitiveType,
  ArrayType,
  TypeAnnotation,
  StorageClass
} from '@blend65/ast';
import { RecursiveDescentParser, Precedence } from '../strategies/recursive-descent.js';
import { ParserOptions } from '../core/base-parser.js';

/**
 * Blend65-specific parser extending recursive descent strategy
 */
export class Blend65Parser extends RecursiveDescentParser<Program> {
  private isInsideFunction: boolean = false;
  private loopDepth: number = 0;

  constructor(tokens: Token[], options: ParserOptions = {}) {
    super(tokens, options);
    // Blend65 doesn't need additional operators beyond the base set
    // The base class already includes the correct operators for Blend65
  }

  /**
   * Parse a complete Blend65 program
   * Entry point for parsing
   */
  parse(): Program {
    // Skip any leading newlines
    this.skipNewlines();

    // Every Blend65 file starts with a module declaration
    const module = this.parseModuleDeclaration();

    const imports: ImportDeclaration[] = [];
    const exports: ExportDeclaration[] = [];
    const body: Declaration[] = [];

    // Parse imports, exports, and declarations
    while (!this.isAtEnd()) {
      this.skipNewlines();

      if (this.isAtEnd()) break;

      const current = this.peek();

      if (current.value === 'import') {
        imports.push(this.parseImportDeclaration());
      } else if (current.value === 'export') {
        exports.push(this.parseExportDeclaration());
      } else {
        const decl = this.parseDeclaration();
        if (decl) {
          body.push(decl);
        }
      }

      this.skipNewlines();
    }

    return this.factory.createProgram(module, imports, exports, body, {
      start: module.metadata?.start || { line: 1, column: 1, offset: 0 },
      end: this.previous().end
    });
  }

  /**
   * Parse module declaration: module Game.Main
   */
  private parseModuleDeclaration(): ModuleDeclaration {
    const moduleToken = this.consume(TokenType.MODULE, "Expected 'module'");
    const name = this.parseQualifiedName();
    this.consumeStatementTerminator();

    return this.factory.createModuleDeclaration(name, {
      start: moduleToken.start,
      end: this.previous().end
    });
  }

  /**
   * Parse qualified name: Game.Main, Engine.Graphics
   */
  private parseQualifiedName(): QualifiedName {
    const startToken = this.peek();
    const parts: string[] = [];

    parts.push(this.consume(TokenType.IDENTIFIER, "Expected identifier").value);

    while (this.match(TokenType.DOT)) {
      parts.push(this.consume(TokenType.IDENTIFIER, "Expected identifier after '.'").value);
    }

    return this.factory.createQualifiedName(parts, {
      start: startToken.start,
      end: this.previous().end
    });
  }

  /**
   * Parse import declaration
   */
  private parseImportDeclaration(): ImportDeclaration {
    const importToken = this.consume(TokenType.IMPORT, "Expected 'import'");

    const specifiers: ImportSpecifier[] = [];

    // Parse import specifiers
    do {
      const imported = this.consume(TokenType.IDENTIFIER, "Expected identifier").value;
      let local: string | null = null;

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
      end: this.previous().end
    });
  }

  /**
   * Parse export declaration
   */
  private parseExportDeclaration(): ExportDeclaration {
    const exportToken = this.consume(TokenType.EXPORT, "Expected 'export'");
    const declaration = this.parseDeclaration();

    if (!declaration) {
      throw new Error("Expected declaration after 'export'");
    }

    // Mark declaration as exported
    if (declaration.type === 'FunctionDeclaration' || declaration.type === 'VariableDeclaration') {
      (declaration as any).exported = true;
    }

    return this.factory.createExportDeclaration(declaration, {
      start: exportToken.start,
      end: declaration.metadata?.end || this.previous().end
    });
  }

  /**
   * Parse a declaration
   */
  private parseDeclaration(): Declaration | null {
    this.skipNewlines();

    if (this.isAtEnd()) return null;

    const current = this.peek();

    switch (current.value) {
      case 'function':
        return this.parseFunctionDeclaration();
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
   * Parse function declaration
   */
  private parseFunctionDeclaration(): FunctionDeclaration {
    const funcToken = this.consume(TokenType.FUNCTION, "Expected 'function'");
    const name = this.consume(TokenType.IDENTIFIER, "Expected function name").value;

    this.consume(TokenType.LEFT_PAREN, "Expected '('");
    const params = this.parseParameterList();
    this.consume(TokenType.RIGHT_PAREN, "Expected ')'");

    let returnType: TypeAnnotation = this.factory.createPrimitiveType('void');
    if (this.match(TokenType.COLON)) {
      returnType = this.parseTypeAnnotation();
    }

    this.consumeStatementTerminator();

    // Set function context for body parsing
    const wasInsideFunction = this.isInsideFunction;
    this.isInsideFunction = true;

    const body = this.parseStatementBlock('function');

    // Restore previous context
    this.isInsideFunction = wasInsideFunction;

    this.consume(TokenType.END, "Expected 'end'");
    this.consumeLexeme('function', "Expected 'function' after 'end'");
    this.consumeStatementTerminator();

    return this.factory.createFunctionDeclaration(name, params, returnType, body, false, {
      start: funcToken.start,
      end: this.previous().end
    });
  }

  /**
   * Parse parameter list
   */
  private parseParameterList(): Parameter[] {
    const params: Parameter[] = [];

    if (this.check(TokenType.RIGHT_PAREN)) {
      return params;
    }

    do {
      const name = this.consume(TokenType.IDENTIFIER, "Expected parameter name").value;
      this.consume(TokenType.COLON, "Expected ':' after parameter name");
      const paramType = this.parseTypeAnnotation();

      let defaultValue: Expression | null = null;
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
  private parseVariableDeclaration(): VariableDeclaration {
    const startToken = this.peek();

    // Parse storage class if present
    let storageClass: StorageClass | null = null;
    if (this.checkLexemes('zp', 'ram', 'data', 'const', 'io')) {
      const storageClassToken = this.peek();
      storageClass = this.advance().value as StorageClass;

      // Check if storage class is allowed in current context
      if (this.isInsideFunction) {
        throw new Error(
          `Storage class '${storageClass}' not allowed inside functions. ` +
          `Local variables must use automatic storage (no storage class). ` +
          `Location: line ${storageClassToken.start.line}, column ${storageClassToken.start.column}`
        );
      }
    }

    this.consume(TokenType.VAR, "Expected 'var'");
    const name = this.consume(TokenType.IDENTIFIER, "Expected variable name").value;
    this.consume(TokenType.COLON, "Expected ':' after variable name");
    const varType = this.parseTypeAnnotation();

    let initializer: Expression | null = null;
    if (this.match(TokenType.ASSIGN)) {
      initializer = this.parseExpression();
    }

    this.consumeStatementTerminator();

    return this.factory.createVariableDeclaration(
      name,
      varType,
      initializer,
      storageClass,
      false,
      {
        start: startToken.start,
        end: this.previous().end
      }
    );
  }

  /**
   * Parse type declaration (placeholder)
   */
  private parseTypeDeclaration(): Declaration {
    // For now, skip type declarations as they're not fully implemented
    throw new Error("Type declarations not yet implemented");
  }

  /**
   * Parse enum declaration: enum Name value1 = 1, value2, value3 = 5 end enum
   */
  private parseEnumDeclaration(): EnumDeclaration {
    const enumToken = this.consume(TokenType.ENUM, "Expected 'enum'");
    const name = this.consume(TokenType.IDENTIFIER, "Expected enum name").value;
    this.consumeStatementTerminator();

    const members: EnumMember[] = [];
    let autoValue = 0;

    while (!this.isAtEnd() && !this.check(TokenType.END)) {
      this.skipNewlines();

      if (this.check(TokenType.END)) break;

      const memberName = this.consume(TokenType.IDENTIFIER, "Expected enum member name").value;
      let value: Expression | null = null;

      if (this.match(TokenType.ASSIGN)) {
        value = this.parseExpression();
        // Update auto-increment if this is a numeric constant
        if (value.type === 'Literal' && typeof (value as any).value === 'number') {
          autoValue = (value as any).value + 1;
        }
      } else {
        // Auto-increment value
        value = this.factory.createLiteral(autoValue, autoValue.toString());
        autoValue++;
      }

      members.push(this.factory.createEnumMember(memberName, value));

      if (!this.match(TokenType.COMMA)) {
        break;
      }
      this.skipNewlines();
    }

    this.consume(TokenType.END, "Expected 'end'");
    this.consumeLexeme('enum', "Expected 'enum' after 'end'");
    this.consumeStatementTerminator();

    return this.factory.createEnumDeclaration(name, members, false, {
      start: enumToken.start,
      end: this.previous().end
    });
  }

  /**
   * Parse type annotation
   */
  private parseTypeAnnotation(): TypeAnnotation {
    const token = this.peek();

    if (this.checkLexemes('byte', 'word', 'boolean', 'void')) {
      const primType = this.advance().value as 'byte' | 'word' | 'boolean' | 'void';
      const baseType = this.factory.createPrimitiveType(primType, {
        start: token.start,
        end: token.end
      });

      // Check for array types: type[size]
      if (this.match(TokenType.LEFT_BRACKET)) {
        const size = this.parseExpression();
        const rbracket = this.consume(TokenType.RIGHT_BRACKET, "Expected ']'");

        return this.factory.createArrayType(baseType, size, {
          start: token.start,
          end: rbracket.end
        });
      }

      return baseType;
    }

    throw new Error(`Expected type annotation, got ${token.value}`);
  }

  /**
   * Parse a statement block until terminator
   */
  private parseStatementBlock(blockType: string): Statement[] {
    const statements: Statement[] = [];

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
  private parseStatement(): Statement | null {
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
      case 'break':
        return this.parseBreakStatement();
      case 'continue':
        return this.parseContinueStatement();
      case 'return':
        return this.parseReturnStatement();
      case 'var':
        // Local variable declaration (storage classes handled in parseVariableDeclaration)
        const varDecl = this.parseVariableDeclaration();
        return this.factory.createExpressionStatement(varDecl as any);
      case 'zp':
      case 'ram':
      case 'data':
      case 'const':
      case 'io':
        // Storage classes in statements - let parseVariableDeclaration handle the error
        const storageVarDecl = this.parseVariableDeclaration();
        return this.factory.createExpressionStatement(storageVarDecl as any);
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
  private parseIfStatement(): IfStatement {
    const ifToken = this.consume(TokenType.IF, "Expected 'if'");
    const condition = this.parseExpression();
    this.consume(TokenType.THEN, "Expected 'then'");
    this.consumeStatementTerminator();

    const thenBody = this.parseStatementBlock('if');

    let elseBody: Statement[] | null = null;
    if (this.checkLexeme('else')) {
      this.advance(); // consume 'else'
      this.consumeStatementTerminator();
      elseBody = this.parseStatementBlock('if');
    }

    this.consume(TokenType.END, "Expected 'end'");
    this.consumeLexeme('if', "Expected 'if' after 'end'");
    this.consumeStatementTerminator();

    return this.factory.createIfStatement(condition, thenBody, elseBody, {
      start: ifToken.start,
      end: this.previous().end
    });
  }

  /**
   * Parse while statement: while condition ... end while
   */
  private parseWhileStatement(): WhileStatement {
    const whileToken = this.consume(TokenType.WHILE, "Expected 'while'");
    const condition = this.parseExpression();
    this.consumeStatementTerminator();

    // Enter loop context for break/continue validation
    this.loopDepth++;
    const body = this.parseStatementBlock('while');
    this.loopDepth--;

    this.consume(TokenType.END, "Expected 'end'");
    this.consumeLexeme('while', "Expected 'while' after 'end'");
    this.consumeStatementTerminator();

    return this.factory.createWhileStatement(condition, body, {
      start: whileToken.start,
      end: this.previous().end
    });
  }

  /**
   * Parse for statement: for var = start to end ... next
   */
  private parseForStatement(): ForStatement {
    const forToken = this.consume(TokenType.FOR, "Expected 'for'");
    const variable = this.consume(TokenType.IDENTIFIER, "Expected loop variable").value;
    this.consume(TokenType.ASSIGN, "Expected '='");
    const start = this.parseExpression();
    this.consume(TokenType.TO, "Expected 'to'");
    const end = this.parseExpression();

    let step: Expression | null = null;
    if (this.checkLexeme('step')) {
      this.advance(); // consume 'step'
      step = this.parseExpression();
    }

    this.consumeStatementTerminator();

    // Enter loop context for break/continue validation
    this.loopDepth++;
    const body = this.parseStatementBlock('for');
    this.loopDepth--;

    this.consume(TokenType.NEXT, "Expected 'next'");
    // Optional variable name after 'next'
    if (this.check(TokenType.IDENTIFIER)) {
      this.advance(); // consume variable name
    }
    this.consumeStatementTerminator();

    return this.factory.createForStatement(variable, start, end, step, body, {
      start: forToken.start,
      end: this.previous().end
    });
  }

  /**
   * Parse return statement
   */
  private parseReturnStatement() {
    const returnToken = this.consume(TokenType.RETURN, "Expected 'return'");

    let value: Expression | null = null;
    if (!this.isStatementTerminator()) {
      value = this.parseExpression();
    }

    this.consumeStatementTerminator();

    return this.factory.createReturnStatement(value, {
      start: returnToken.start,
      end: this.previous().end
    });
  }

  /**
   * Parse break statement: break
   * Exits the containing loop
   */
  private parseBreakStatement(): BreakStatement {
    const breakToken = this.consume(TokenType.BREAK, "Expected 'break'");

    // Validate break is only used inside loops
    if (this.loopDepth === 0) {
      throw new Error(
        `break statement must be inside a loop (for, while). ` +
        `Location: line ${breakToken.start.line}, column ${breakToken.start.column}`
      );
    }

    this.consumeStatementTerminator();

    return this.factory.createBreakStatement({
      start: breakToken.start,
      end: this.previous().end
    });
  }

  /**
   * Parse continue statement: continue
   * Skips to next iteration of containing loop
   */
  private parseContinueStatement(): ContinueStatement {
    const continueToken = this.consume(TokenType.CONTINUE, "Expected 'continue'");

    // Validate continue is only used inside loops
    if (this.loopDepth === 0) {
      throw new Error(
        `continue statement must be inside a loop (for, while). ` +
        `Location: line ${continueToken.start.line}, column ${continueToken.start.column}`
      );
    }

    this.consumeStatementTerminator();

    return this.factory.createContinueStatement({
      start: continueToken.start,
      end: this.previous().end
    });
  }

  /**
   * Parse primary expression (literals, identifiers, parenthesized expressions)
   * Required implementation from RecursiveDescentParser
   */
  protected parsePrimaryExpression(): Expression {
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
        end: numToken.end
      });
    }

    // String literal
    if (this.check(TokenType.STRING)) {
      const strToken = this.advance();
      const value = strToken.value.slice(1, -1); // Remove quotes
      return this.factory.createLiteral(value, strToken.value, {
        start: strToken.start,
        end: strToken.end
      });
    }

    // Boolean literal
    if (this.check(TokenType.BOOLEAN)) {
      const boolToken = this.advance();
      const value = boolToken.value === 'true';
      return this.factory.createLiteral(value, boolToken.value, {
        start: boolToken.start,
        end: boolToken.end
      });
    }

    // Identifier
    if (this.check(TokenType.IDENTIFIER)) {
      const idToken = this.advance();
      return this.factory.createIdentifier(idToken.value, {
        start: idToken.start,
        end: idToken.end
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
  private parseArrayLiteral(): Expression {
    const lbracket = this.consume(TokenType.LEFT_BRACKET, "Expected '['");
    const elements: Expression[] = [];

    if (!this.check(TokenType.RIGHT_BRACKET)) {
      do {
        elements.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }

    const rbracket = this.consume(TokenType.RIGHT_BRACKET, "Expected ']'");
    return this.factory.createArrayLiteral(elements, {
      start: lbracket.start,
      end: rbracket.end
    });
  }
}
