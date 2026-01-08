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
  ExplicitStructMapDecl,
  Expression,
  IdentifierExpression,
  LiteralExpression,
  ModuleDecl,
  Program,
  RangeMapDecl,
  SequentialStructMapDecl,
  SimpleMapDecl,
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

      // Parse @map declaration
      if (this.check(TokenType.MAP)) {
        declarations.push(this.parseMapDeclaration());
      }
      // Parse variable declaration (with optional export prefix)
      else if (this.isExportModifier() || this.isStorageClass() || this.isLetOrConst()) {
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

  // ============================================
  // @MAP DECLARATION PARSING
  // ============================================

  /**
   * Parses a @map declaration (dispatcher)
   *
   * Determines which form of @map declaration and delegates to appropriate method.
   *
   * Forms:
   * 1. Simple: @map x at $D020: byte;
   * 2. Range: @map x from $D000 to $D02E: byte;
   * 3. Sequential struct: @map x at $D000 type ... end @map
   * 4. Explicit struct: @map x at $D000 layout ... end @map
   *
   * @returns Declaration AST node
   */
  protected parseMapDeclaration(): Declaration {
    const startToken = this.expect(TokenType.MAP, "Expected '@map'");

    // Parse variable name
    const nameToken = this.expect(TokenType.IDENTIFIER, 'Expected identifier after @map');
    const name = nameToken.value;

    // Lookahead to determine which form
    if (this.check(TokenType.AT)) {
      this.advance(); // Consume 'at'

      // Parse address
      const address = this.parsePrimaryExpression();

      // Check what follows: colon (simple) or type/layout (struct)
      if (this.check(TokenType.COLON)) {
        // Simple form: @map x at $D020: byte;
        return this.parseSimpleMapDecl(startToken, name, address);
      } else if (this.check(TokenType.TYPE)) {
        // Sequential struct: @map x at $D000 type ... end @map
        return this.parseSequentialStructMapDecl(startToken, name, address);
      } else if (this.check(TokenType.LAYOUT)) {
        // Explicit struct: @map x at $D000 layout ... end @map
        return this.parseExplicitStructMapDecl(startToken, name, address);
      } else {
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Expected ':', 'type', or 'layout' after address in @map declaration`
        );
        return new VariableDecl('error', null, null, this.currentLocation(), null, false, false);
      }
    } else if (this.check(TokenType.FROM)) {
      // Range form: @map x from $D000 to $D02E: byte;
      return this.parseRangeMapDecl(startToken, name);
    } else {
      this.reportError(
        DiagnosticCode.UNEXPECTED_TOKEN,
        `Expected 'at' or 'from' after identifier in @map declaration`
      );
      return new VariableDecl('error', null, null, this.currentLocation(), null, false, false);
    }
  }

  /**
   * Parses simple @map declaration
   *
   * Grammar: @map identifier at address : type ;
   * Example: @map vicBorderColor at $D020: byte;
   *
   * @param startToken - Starting @map token
   * @param name - Variable name
   * @param address - Address expression (already parsed)
   * @returns SimpleMapDecl AST node
   */
  protected parseSimpleMapDecl(startToken: any, name: string, address: Expression): Declaration {
    // Expect colon
    this.expect(TokenType.COLON, "Expected ':' after address");

    // Parse type annotation
    if (
      !this.check(
        TokenType.BYTE,
        TokenType.WORD,
        TokenType.STRING,
        TokenType.BOOLEAN,
        TokenType.IDENTIFIER
      )
    ) {
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, 'Expected type annotation');
    }
    const typeToken = this.advance();
    const typeAnnotation = typeToken.value;

    // Expect semicolon
    this.expectSemicolon('Expected semicolon after simple @map declaration');

    const location = this.createLocation(startToken, this.getCurrentToken());

    return new SimpleMapDecl(name, address, typeAnnotation, location);
  }

  /**
   * Parses range @map declaration
   *
   * Grammar: @map identifier from address to address : type ;
   * Example: @map spriteRegisters from $D000 to $D02E: byte;
   *
   * @param startToken - Starting @map token
   * @param name - Variable name
   * @returns RangeMapDecl AST node
   */
  protected parseRangeMapDecl(startToken: any, name: string): Declaration {
    // Expect 'from'
    this.expect(TokenType.FROM, "Expected 'from'");

    // Parse start address
    const startAddress = this.parsePrimaryExpression();

    // Expect 'to'
    this.expect(TokenType.TO, "Expected 'to'");

    // Parse end address
    const endAddress = this.parsePrimaryExpression();

    // Expect colon
    this.expect(TokenType.COLON, "Expected ':' after address range");

    // Parse type annotation
    const typeToken = this.advance();
    const typeAnnotation = typeToken.value;

    // Expect semicolon
    this.expectSemicolon('Expected semicolon after range @map declaration');

    const location = this.createLocation(startToken, this.getCurrentToken());

    return new RangeMapDecl(name, startAddress, endAddress, typeAnnotation, location);
  }

  /**
   * Parses sequential struct @map declaration
   *
   * Grammar: @map identifier at address type field : type [, ...] end @map
   * Example: @map sid at $D400 type frequencyLo: byte, frequencyHi: byte end @map
   *
   * @param startToken - Starting @map token
   * @param name - Variable name
   * @param baseAddress - Base address expression (already parsed)
   * @returns SequentialStructMapDecl AST node
   */
  protected parseSequentialStructMapDecl(
    startToken: any,
    name: string,
    baseAddress: Expression
  ): Declaration {
    // Expect 'type'
    this.expect(TokenType.TYPE, "Expected 'type'");

    // Parse fields
    const fields: any[] = [];

    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      const fieldStart = this.getCurrentToken();

      // Parse field name
      const fieldNameToken = this.expect(TokenType.IDENTIFIER, 'Expected field name');
      const fieldName = fieldNameToken.value;

      // Expect colon
      this.expect(TokenType.COLON, "Expected ':' after field name");

      // Parse field type
      const fieldTypeToken = this.advance();
      const fieldBaseType = fieldTypeToken.value;

      // Check for array syntax: byte[16]
      let arraySize: number | null = null;
      if (this.match(TokenType.LEFT_BRACKET)) {
        const sizeToken = this.expect(TokenType.NUMBER, 'Expected array size');
        arraySize = parseInt(sizeToken.value, 10);
        this.expect(TokenType.RIGHT_BRACKET, "Expected ']' after array size");
      }

      const fieldLocation = this.createLocation(fieldStart, this.getCurrentToken());

      fields.push({
        name: fieldName,
        baseType: fieldBaseType,
        arraySize,
        location: fieldLocation,
      });

      // Optional comma
      this.match(TokenType.COMMA);
    }

    // Expect 'end @map'
    this.expect(TokenType.END, "Expected 'end'");
    this.expect(TokenType.MAP, "Expected '@map' after 'end'");

    const location = this.createLocation(startToken, this.getCurrentToken());

    return new SequentialStructMapDecl(name, baseAddress, fields, location);
  }

  /**
   * Parses explicit struct @map declaration
   *
   * Grammar: @map identifier at address layout field : (at addr | from addr to addr) : type [, ...] end @map
   * Example: @map vic at $D000 layout borderColor: at $D020: byte, sprites: from $D000 to $D00F: byte end @map
   *
   * @param startToken - Starting @map token
   * @param name - Variable name
   * @param baseAddress - Base address expression (already parsed)
   * @returns ExplicitStructMapDecl AST node
   */
  protected parseExplicitStructMapDecl(
    startToken: any,
    name: string,
    baseAddress: Expression
  ): Declaration {
    // Expect 'layout'
    this.expect(TokenType.LAYOUT, "Expected 'layout'");

    // Parse fields
    const fields: any[] = [];

    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      const fieldStart = this.getCurrentToken();

      // Parse field name
      const fieldNameToken = this.expect(TokenType.IDENTIFIER, 'Expected field name');
      const fieldName = fieldNameToken.value;

      // Expect colon
      this.expect(TokenType.COLON, "Expected ':' after field name");

      // Parse address specification (at addr OR from addr to addr)
      let addressSpec: any;

      if (this.match(TokenType.AT)) {
        // Single address
        const addr = this.parsePrimaryExpression();
        addressSpec = {
          kind: 'single',
          address: addr,
        };
      } else if (this.match(TokenType.FROM)) {
        // Address range
        const start = this.parsePrimaryExpression();
        this.expect(TokenType.TO, "Expected 'to' in address range");
        const end = this.parsePrimaryExpression();
        addressSpec = {
          kind: 'range',
          startAddress: start,
          endAddress: end,
        };
      } else {
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          "Expected 'at' or 'from' for field address specification"
        );
        addressSpec = {
          kind: 'single',
          address: new LiteralExpression(0, this.currentLocation()),
        };
      }

      // Expect colon
      this.expect(TokenType.COLON, "Expected ':' after address specification");

      // Parse field type
      const fieldTypeToken = this.advance();
      const fieldType = fieldTypeToken.value;

      const fieldLocation = this.createLocation(fieldStart, this.getCurrentToken());

      fields.push({
        name: fieldName,
        addressSpec,
        typeAnnotation: fieldType,
        location: fieldLocation,
      });

      // Optional comma
      this.match(TokenType.COMMA);
    }

    // Expect 'end @map'
    this.expect(TokenType.END, "Expected 'end'");
    this.expect(TokenType.MAP, "Expected '@map' after 'end'");

    const location = this.createLocation(startToken, this.getCurrentToken());

    return new ExplicitStructMapDecl(name, baseAddress, fields, location);
  }
}
