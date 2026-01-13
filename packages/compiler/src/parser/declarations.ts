/**
 * Declaration Parser for Blend65 Compiler
 *
 * Extends ExpressionParser to provide declaration parsing capabilities:
 * - Variable declarations with storage classes and export modifiers
 * - @map declarations (simple, range, sequential struct, explicit struct)
 * - Type checking and annotation parsing
 *
 * Future phases will add function declarations, type declarations, and enum declarations.
 */

import {
  Declaration,
  DiagnosticCode,
  Expression,
  ExplicitMapField,
  ExplicitStructMapDecl,
  LiteralExpression,
  MapField,
  RangeMapDecl,
  SequentialStructMapDecl,
  SimpleMapDecl,
  SingleAddress,
  AddressRange,
  VariableDecl,
} from '../ast/index.js';
import { Token, TokenType } from '../lexer/types.js';
import { DeclarationParserErrors } from './error-messages.js';
import { ExpressionParser } from './expressions.js';

/**
 * Declaration parser class - extends ExpressionParser with declaration parsing
 *
 * Handles all declaration parsing including variables, @map declarations,
 * and provides foundation for future function, type, and enum declarations.
 *
 * Current declaration support (Phase 0):
 * - Variable declarations: let x: byte = 5, @zp const y: word
 * - Simple @map: @map vic at $D020: byte;
 * - Range @map: @map sprites from $D000 to $D02E: byte;
 * - Sequential struct @map: @map sid at $D400 type freq: byte, vol: byte end @map
 * - Explicit struct @map: @map vic at $D000 layout color: at $D020: byte end @map
 *
 * Future declaration support (Phase 4-6):
 * - Function declarations: function name(params): returnType ... end function
 * - Type declarations: type MyType = byte | word
 * - Enum declarations: enum Color { RED, GREEN, BLUE }
 */
export abstract class DeclarationParser extends ExpressionParser {
  // ============================================
  // VARIABLE DECLARATION PARSING
  // ============================================

  /**
   * Parses a variable declaration
   *
   * Grammar: [ export ] [ StorageClass ] (let | const) Identifier : Type [ = Expression ]
   *
   * Examples:
   * - let counter: byte = 0;
   * - @zp const MAX_SIZE: word = 256;
   * - export @ram let buffer: byte;
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
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, DeclarationParserErrors.expectedLetOrConst());
      this.synchronize();
      // Return dummy node for recovery
      return new VariableDecl('error', null, null, this.currentLocation(), null, false, false);
    }

    // Parse variable name
    const nameToken = this.expect(TokenType.IDENTIFIER, 'Expected variable name');

    // Parse type annotation
    let typeAnnotation: string | null = null;
    if (this.match(TokenType.COLON)) {
      // Parse full type expression (handles array types like byte[3])
      typeAnnotation = this.parseTypeAnnotation();
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
  protected parseMapDecl(): Declaration {
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
  protected parseSimpleMapDecl(startToken: Token, name: string, address: Expression): Declaration {
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
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        DeclarationParserErrors.expectedTypeAnnotation()
      );
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
  protected parseRangeMapDecl(startToken: Token, name: string): Declaration {
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
    startToken: Token,
    name: string,
    baseAddress: Expression
  ): Declaration {
    // Expect 'type'
    this.expect(TokenType.TYPE, "Expected 'type'");

    // Parse fields
    const fields: MapField[] = [];

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
    startToken: Token,
    name: string,
    baseAddress: Expression
  ): Declaration {
    // Expect 'layout'
    this.expect(TokenType.LAYOUT, "Expected 'layout'");

    // Parse fields
    const fields: ExplicitMapField[] = [];

    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      const fieldStart = this.getCurrentToken();

      // Parse field name
      const fieldNameToken = this.expect(TokenType.IDENTIFIER, 'Expected field name');
      const fieldName = fieldNameToken.value;

      // Expect colon
      this.expect(TokenType.COLON, "Expected ':' after field name");

      // Parse address specification (at addr OR from addr to addr)
      let addressSpec: SingleAddress | AddressRange;

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

  // ============================================
  // TYPE ANNOTATION PARSING
  // ============================================

  /**
   * Parses a type annotation (for variables, parameters, etc.)
   *
   * Handles:
   * - Simple types: byte, word, void, boolean, string
   * - Custom types: SpriteId, Color (identifiers)
   * - Array types: byte[256], word[100]
   * - Multidimensional arrays: byte[25][40], word[10][20][30]
   *
   * Grammar:
   * type_annotation = type_name { "[" number "]" }
   * type_name = keyword | identifier
   *
   * Examples:
   * - byte
   * - word
   * - byte[256]
   * - byte[25][40]
   *
   * @returns String representation of the type
   */
  protected parseTypeAnnotation(): string {
    // Parse base type (keyword or identifier)
    let baseType: string;

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
      baseType = this.advance().value;
    } else {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        DeclarationParserErrors.expectedTypeAfterColon()
      );
      return 'unknown';
    }

    // Parse array dimensions: byte[256] or byte[25][40]
    let fullType = baseType;
    while (this.match(TokenType.LEFT_BRACKET)) {
      const sizeToken = this.expect(TokenType.NUMBER, 'Expected array size');
      this.expect(TokenType.RIGHT_BRACKET, "Expected ']' after array size");

      fullType += `[${sizeToken.value}]`;
    }

    return fullType;
  }

  // ============================================
  // FUTURE DECLARATION METHODS (PHASES 4-6)
  // ============================================

  // The following methods will be implemented in future phases:
  //
  // Phase 4: Function Declarations
  // protected parseFunctionDecl(): FunctionDecl
  // protected parseParameterList(): Parameter[]
  // protected parseParameter(): Parameter
  //
  // Phase 6: Type System Declarations
  // protected parseTypeDecl(): TypeDecl
  // protected parseEnumDecl(): EnumDecl
  // protected parseEnumMember(): EnumMember
  //
  // These are placeholders to show the planned architecture.
}
