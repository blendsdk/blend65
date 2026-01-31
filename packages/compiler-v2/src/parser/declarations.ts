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
 * - Simplified storage classes (no @zp, @ram, @data - handled by frame allocator)
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
   * Parses a variable declaration (v2 simplified)
   *
   * Grammar: [ export ] (let | const) Identifier : Type [ = Expression ] ;
   *
   * Examples:
   * - let counter: byte = 0;
   * - const MAX_SIZE: word = 256;
   * - export let buffer: byte;
   *
   * Note: Storage classes (@zp, @ram, @data) are handled by the frame allocator
   * in v2 and are no longer part of the variable declaration syntax.
   *
   * @returns VariableDecl AST node
   */
  protected parseVariableDecl(): VariableDecl {
    const startToken = this.getCurrentToken();

    // Parse optional export modifier
    const isExport = this.parseExportModifier();

    // Parse let/const (no storage classes in v2)
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
      null, // No storage class in v2 - handled by frame allocator
      isConst,
      isExport
    );
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