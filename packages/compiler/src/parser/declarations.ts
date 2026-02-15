/**
 * Declaration Parser for Blend65 Compiler v2
 *
 * Extends ExpressionParser to provide declaration parsing capabilities:
 * - Variable declarations with storage classes and export modifiers
 * - Type checking and annotation parsing
 *
 * V2 Changes:
 * - No @map declarations (removed in v2)
 * - Memory-mapped I/O uses peek/poke intrinsics instead
 * - Storage classes (@zp, @ram, @data) are parsed and passed through to
 *   the frame allocator for memory placement decisions
 */

import {
  DiagnosticCode,
  Expression,
  VariableDecl,
} from '../ast/index.js';
import { TokenType } from '../lexer/types.js';
import { DeclarationParserErrors } from './error-messages.js';
import { ExpressionParser } from './expressions.js';

/**
 * Mapping from alignment sugar token types to their alignment values.
 * Each sugar keyword desugars to @data storage class with a specific alignment.
 *
 * Per language spec: @sprite → @data(align: 64), etc.
 */
const ALIGNMENT_SUGAR_MAP: Record<string, number> = {
  [TokenType.SPRITE]: 64, // VIC-II sprite data (64-byte aligned)
  [TokenType.CHARSET]: 2048, // VIC-II character set (2KB aligned)
  [TokenType.SCREEN]: 1024, // VIC-II screen memory (1KB aligned)
  [TokenType.BITMAP]: 8192, // VIC-II bitmap graphics (8KB aligned)
  [TokenType.PAGE]: 256, // Page-aligned lookup tables (256-byte aligned)
};

/**
 * Declaration parser class - extends ExpressionParser with declaration parsing
 *
 * Handles all declaration parsing including variables and provides
 * foundation for future function, type, and enum declarations.
 *
 * Current declaration support (v2):
 * - Variable declarations: let x: byte = 5, const y: word = 100
 *
 * Future declaration support:
 * - Function declarations: function name(params): returnType { ... }
 * - Type declarations: type MyType = byte | word
 * - Enum declarations: enum Color { RED, GREEN, BLUE }
 *
 * Note: @map declarations are NOT supported in v2. Use peek/poke intrinsics
 * for memory-mapped I/O instead:
 * - peek(address): byte - read from memory
 * - poke(address, value): void - write to memory
 */
export abstract class DeclarationParser extends ExpressionParser {
  // ============================================
  // VARIABLE DECLARATION PARSING
  // ============================================

  /**
   * Parses a variable declaration with optional storage class
   *
   * Grammar (per language spec v2 section 03-variables.md):
   *   variable_decl = [ storage_class ] , [ "export" ] , mutability , identifier
   *                 , [ ":" , type_expr ] , [ "=" , expression ] , ";" ;
   *   storage_class = "@zp" | "@ram" | "@data" ;
   *   mutability = "let" | "const" ;
   *
   * Examples:
   * - let counter: byte = 0;
   * - const MAX_SIZE: word = 256;
   * - export let buffer: byte;
   * - @zp let playerX: byte = 10;
   * - @data const spriteData: byte[] = [1, 2, 3];
   * - @ram let largeBuffer: byte[1000];
   *
   * Storage classes control where the variable is placed in memory:
   * - @zp: Zero page ($0000-$00FF) - fastest access
   * - @ram: General RAM (default if no storage class)
   * - @data: Initialized data section (ROM-able)
   *
   * @returns VariableDecl AST node
   */
  protected parseVariableDecl(): VariableDecl {
    const startToken = this.getCurrentToken();

    // Parse storage class and optional alignment
    // Handles three cases:
    // 1. Plain storage class: @zp, @ram, @data
    // 2. Storage class with alignment: @data(align: N), @ram(align: N)
    // 3. Alignment sugar: @sprite, @charset, @screen, @bitmap, @page
    let storageClass: TokenType | null = null;
    let alignment: number | undefined = undefined;

    // Case 3: Alignment sugar keywords → desugar to @data + alignment
    if (this.check(
      TokenType.SPRITE, TokenType.CHARSET, TokenType.SCREEN,
      TokenType.BITMAP, TokenType.PAGE
    )) {
      const sugarToken = this.advance();
      storageClass = TokenType.DATA; // All sugar keywords desugar to @data
      alignment = ALIGNMENT_SUGAR_MAP[sugarToken.type];
    }
    // Cases 1 & 2: Plain storage class, possibly with (align: N)
    else if (this.check(TokenType.ZP, TokenType.RAM, TokenType.DATA)) {
      storageClass = this.advance().type;

      // Check for alignment parameter: @data(align: N) or @ram(align: N)
      if (this.check(TokenType.LEFT_PAREN)) {
        alignment = this.parseAlignmentParameter();
      }
    }

    // Parse optional export modifier
    const isExport = this.parseExportModifier();

    // Parse let/const mutability modifier
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
      storageClass, // Storage class: '@zp', '@ram', '@data', or null (defaults to @ram)
      isConst,
      isExport,
      alignment // Alignment in bytes (power-of-2), or undefined if none
    );
  }

  /**
   * Parses the alignment parameter inside parentheses: (align: N)
   *
   * Grammar:
   *   alignment_param = "(" "align" ":" number ")" ;
   *
   * Examples:
   * - (align: 64)
   * - (align: 2048)
   *
   * @returns The alignment value as a number
   */
  protected parseAlignmentParameter(): number {
    // Consume '('
    this.expect(TokenType.LEFT_PAREN, "Expected '(' for alignment parameter");

    // Expect 'align' keyword
    this.expect(TokenType.ALIGN, "Expected 'align' keyword");

    // Expect ':'
    this.expect(TokenType.COLON, "Expected ':' after 'align'");

    // Parse alignment value (must be a number literal)
    const valueToken = this.expect(TokenType.NUMBER, 'Expected alignment value (power-of-2 number)');
    const alignmentValue = parseInt(valueToken.value, 10);

    // Consume ')'
    this.expect(TokenType.RIGHT_PAREN, "Expected ')' after alignment value");

    return alignmentValue;
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
   * - Array types with inference: byte[], word[]
   * - Multidimensional arrays: byte[25][40], word[10][20][30]
   * - Multidimensional with inference: byte[][], byte[][][]
   *
   * Grammar:
   * type_annotation = type_name { "[" [ number ] "]" }
   * type_name = keyword | identifier
   *
   * Examples:
   * - byte
   * - word
   * - byte[256]      // Explicit size
   * - byte[]         // Size inferred from initializer
   * - byte[25][40]   // Explicit multidimensional
   * - byte[][]       // Inferred multidimensional
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

    // Parse array dimensions: byte[256] or byte[] or byte[25][40] or byte[][]
    let fullType = baseType;
    while (this.match(TokenType.LEFT_BRACKET)) {
      // Check for array size (optional - can be inferred)
      if (this.check(TokenType.NUMBER)) {
        // Explicit size: byte[256]
        const sizeToken = this.advance();
        this.expect(TokenType.RIGHT_BRACKET, "Expected ']' after array size");
        fullType += `[${sizeToken.value}]`;
      } else if (this.check(TokenType.RIGHT_BRACKET)) {
        // Empty brackets - size will be inferred: byte[]
        this.advance(); // consume ']'
        fullType += `[]`;
      } else {
        // Error: neither size nor closing bracket
        this.reportError(
          DiagnosticCode.EXPECTED_TOKEN,
          'Expected array size or "]" for size inference'
        );
        // Try to recover by assuming empty brackets
        if (this.check(TokenType.RIGHT_BRACKET)) {
          this.advance();
        }
        fullType += `[]`;
      }
    }

    return fullType;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Check if current token is 'let' or 'const'
   *
   * @returns true if current token is LET or CONST
   */
  protected isLetOrConst(): boolean {
    return this.check(TokenType.LET, TokenType.CONST);
  }
}