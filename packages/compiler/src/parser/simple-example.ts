/**
 * Simple Example Parser
 *
 * Demonstrates how to use the Parser base class and AST infrastructure.
 * This is a minimal working parser that can parse:
 * - Variable declarations: @zp let x: byte = 5
 * - Simple expressions: literals, identifiers, binary operators
 *
 * This serves as:
 * - Learning example for building parsers
 * - Template for extending to full Blend65 grammar
 * - Validation that the foundation works correctly
 */

import {
  Declaration,
  DiagnosticCode,
  Expression,
  IdentifierExpression,
  LiteralExpression,
  ModuleDecl,
  Program,
  VariableDecl,
} from '../ast/index.js';
import { TokenType } from '../lexer/types.js';
import { Parser } from './base.js';

/**
 * Simple parser example
 *
 * Parses a minimal subset of Blend65:
 * - Module declaration (or implicit global)
 * - Variable declarations with storage classes
 * - Simple expressions (literals, identifiers, binary ops)
 *
 * Architecture:
 * - Extends Parser base class
 * - Inherits parseExpression() (universal Pratt parser)
 * - Implements parsePrimaryExpression() (grammar-specific atoms)
 * - Uses base class utilities for token management and error handling
 *
 * Usage:
 * ```typescript
 * const lexer = new Lexer(source);
 * const tokens = lexer.tokenize();
 * const parser = new SimpleExampleParser(tokens);
 * const ast = parser.parse();
 *
 * if (parser.hasErrors()) {
 *   console.error(parser.getDiagnostics());
 * } else {
 *   console.log('AST:', ast);
 * }
 * ```
 */
export class SimpleExampleParser extends Parser {
  /**
   * Entry point - parses entire file
   *
   * Implements grammar:
   * Program := [Module] VariableDecl*
   *
   * @returns Program AST node
   */
  public parse(): Program {
    // Check for explicit module declaration
    let moduleDecl: ModuleDecl;

    if (this.check(TokenType.MODULE)) {
      moduleDecl = this.parseModuleDecl();
    } else {
      // Create implicit "module global"
      moduleDecl = this.createImplicitGlobalModule();
    }

    // Parse declarations (for now, just variables)
    const declarations: Declaration[] = [];

    while (!this.isAtEnd()) {
      if (this.isAtEnd()) break;

      // Validate module scope
      this.validateModuleScopeItem(this.getCurrentToken());

      // Parse variable declaration (with optional export prefix)
      if (this.isExportModifier() || this.isStorageClass() || this.isLetOrConst()) {
        declarations.push(this.parseVariableDecl());
      } else {
        // Unknown token - report error and synchronize
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Unexpected token '${this.getCurrentToken().value}'`
        );
        this.synchronize();
      }
    }

    // Create program node
    const location = this.createLocation(this.tokens[0], this.getCurrentToken());

    return new Program(moduleDecl, declarations, location);
  }

  /**
   * Parses a module declaration
   *
   * Grammar: module Identifier [ . Identifier ]*
   *
   * @returns ModuleDecl AST node
   */
  protected parseModuleDecl(): ModuleDecl {
    this.validateModuleDeclaration(); // Check for duplicate

    const startToken = this.expect(TokenType.MODULE, "Expected 'module' keyword");

    // Parse module name path (e.g., Game.Main)
    const namePath: string[] = [];
    namePath.push(this.expect(TokenType.IDENTIFIER, 'Expected module name').value);

    while (this.match(TokenType.DOT)) {
      namePath.push(this.expect(TokenType.IDENTIFIER, 'Expected identifier after dot').value);
    }

    // Module declarations are self-terminating (no semicolon needed)
    const location = this.createLocation(startToken, this.getCurrentToken());

    return new ModuleDecl(namePath, location, false);
  }

  /**
   * Creates implicit "module global" when no module declared
   *
   * @returns ModuleDecl for implicit global module
   */
  protected createImplicitGlobalModule(): ModuleDecl {
    const location = this.createLocation(this.tokens[0], this.tokens[0]);
    return new ModuleDecl(['global'], location, true);
  }

  /**
   * Parses a variable declaration
   *
   * Grammar: [ export ] [ StorageClass ] (let | const) Identifier : Type [ = Expression ]
   *
   * Examples:
   * - @zp let counter: byte
   * - let name: string = "Blend65"
   * - const MAX: byte = 255
   *
   * @returns VariableDecl AST node
   */
  protected parseVariableDecl(): VariableDecl {
    const startToken = this.getCurrentToken();

    // Parse optional export modifier
    const isExport = this.parseExportModifier();

    // Parse optional storage class (@zp, @ram, @data)
    const storageClass = this.parseStorageClass();

    // Parse let/const
    let isConst = false;
    if (this.match(TokenType.CONST)) {
      isConst = true;
    } else if (this.match(TokenType.LET)) {
      isConst = false;
    } else {
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected 'let' or 'const'");
      this.synchronize();
      // Return dummy node for recovery
      return new VariableDecl('error', null, null, this.currentLocation(), null, false, false);
    }

    // Parse variable name
    const nameToken = this.expect(TokenType.IDENTIFIER, 'Expected variable name');

    // Parse type annotation
    let typeAnnotation: string | null = null;
    if (this.match(TokenType.COLON)) {
      // Type can be a keyword (byte, word, void, etc.) or identifier (custom type)
      if (
        this.check(
          TokenType.BYTE,
          TokenType.WORD,
          TokenType.VOID,
          TokenType.STRING,
          TokenType.BOOLEAN,
          TokenType.CALLBACK,
          TokenType.IDENTIFIER
        )
      ) {
        typeAnnotation = this.advance().value;
      } else {
        this.reportError(DiagnosticCode.EXPECTED_TOKEN, 'Expected type name after colon');
      }
    }

    // Parse optional initializer
    let initializer: Expression | null = null;
    if (this.match(TokenType.ASSIGN)) {
      initializer = this.parseExpression();
    }

    this.expectSemicolon('Expected semicolon after variable declaration');

    const location = this.createLocation(startToken, this.getCurrentToken());

    return new VariableDecl(
      nameToken.value,
      typeAnnotation,
      initializer,
      location,
      storageClass,
      isConst,
      isExport
    );
  }

  /**
   * Parses a primary expression (implementation of abstract method)
   *
   * Implements the grammar-specific primary expressions for SimpleExampleParser.
   * This defines the "atoms" that the universal parseExpression() method
   * (inherited from Parser base class) will use to build complex expressions.
   *
   * Primary expressions supported:
   * - Number literals: 42, $D000, 0xFF, 0b1010
   * - String literals: "hello", 'world'
   * - Boolean literals: true, false
   * - Identifiers: counter, myVar
   * - Parenthesized expressions: (2 + 3)
   *
   * @returns Expression AST node representing a primary expression
   */
  protected parsePrimaryExpression(): Expression {
    // Number literals
    if (this.check(TokenType.NUMBER)) {
      const token = this.advance();
      const value = this.parseNumberValue(token.value);
      const location = this.createLocation(token, token);
      return new LiteralExpression(value, location);
    }

    // String literals
    if (this.check(TokenType.STRING_LITERAL)) {
      const token = this.advance();
      const location = this.createLocation(token, token);
      return new LiteralExpression(token.value, location);
    }

    // Boolean literals
    if (this.check(TokenType.BOOLEAN_LITERAL)) {
      const token = this.advance();
      const value = token.value === 'true';
      const location = this.createLocation(token, token);
      return new LiteralExpression(value, location);
    }

    // Identifiers
    if (this.check(TokenType.IDENTIFIER)) {
      const token = this.advance();
      const location = this.createLocation(token, token);
      return new IdentifierExpression(token.value, location);
    }

    // Parenthesized expressions
    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.parseExpression();
      this.expect(TokenType.RIGHT_PAREN, "Expected ')' after expression");
      return expr;
    }

    // Error - unexpected token
    this.reportError(
      DiagnosticCode.UNEXPECTED_TOKEN,
      `Expected expression, found '${this.getCurrentToken().value}'`
    );

    // Return dummy literal for recovery
    return new LiteralExpression(0, this.currentLocation());
  }

  /**
   * Parses a number value from string
   *
   * Handles different number formats:
   * - Decimal: 42, 255
   * - Hex ($ prefix): $D000, $FF
   * - Hex (0x prefix): 0xD000, 0xFF
   * - Binary (0b prefix): 0b1010, 0b11110000
   *
   * @param value - String representation of number
   * @returns Numeric value
   */
  protected parseNumberValue(value: string): number {
    // Hex with $ prefix
    if (value.startsWith('$')) {
      return parseInt(value.substring(1), 16);
    }

    // Hex with 0x prefix
    if (value.startsWith('0x')) {
      return parseInt(value, 16);
    }

    // Binary with 0b prefix
    if (value.startsWith('0b')) {
      return parseInt(value.substring(2), 2);
    }

    // Decimal
    return parseInt(value, 10);
  }
}
