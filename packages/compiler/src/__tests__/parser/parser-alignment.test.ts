/**
 * Parser Alignment Tests
 *
 * Tests alignment-related parsing capabilities including:
 * - Sugar keywords: @sprite, @charset, @screen, @bitmap, @page
 * - Explicit alignment: @data(align: N), @ram(align: N)
 * - Sugar keywords desugar to @data with correct alignment values
 * - Storage class + alignment propagation to VariableDecl AST node
 * - Sugar keywords are module-scope only (rejected in function bodies)
 * - Error handling for malformed alignment syntax
 */

import { describe, it, expect } from 'vitest';
import { Token, TokenType } from '../../lexer/types.js';
import { DeclarationParser } from '../../parser/declarations.js';
import { Parser } from '../../parser/parser.js';
import { VariableDecl, LiteralExpression } from '../../ast/index.js';

// Concrete test implementation of DeclarationParser to expose protected methods
class TestDeclarationParser extends DeclarationParser {
  /** Expose protected parseVariableDecl for direct unit testing */
  public testParseVariableDecl(): VariableDecl {
    return this.parseVariableDecl();
  }
}

/**
 * Helper to create a test token with source location
 *
 * @param type - Token type enum value
 * @param value - Token string value
 * @param line - Source line (default 1)
 * @param column - Source column (default 1)
 * @returns Token object with start/end positions
 */
function createToken(type: TokenType, value: string, line = 1, column = 1): Token {
  return {
    type,
    value,
    start: { line, column, offset: column },
    end: { line, column: column + value.length, offset: column + value.length },
  };
}

describe('Parser Alignment', () => {
  // ============================================
  // SUGAR KEYWORD PARSING
  // ============================================

  describe('Sugar keyword parsing', () => {
    it('parses @sprite as @data with alignment 64', () => {
      const tokens = [
        createToken(TokenType.SPRITE, '@sprite'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'spriteData'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('spriteData');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(64);
      expect(decl.isConst()).toBe(true);
    });

    it('parses @charset as @data with alignment 2048', () => {
      const tokens = [
        createToken(TokenType.CHARSET, '@charset'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'charSet'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('charSet');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(2048);
    });

    it('parses @screen as @data with alignment 1024', () => {
      const tokens = [
        createToken(TokenType.SCREEN, '@screen'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'screenMem'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('screenMem');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(1024);
    });

    it('parses @bitmap as @data with alignment 8192', () => {
      const tokens = [
        createToken(TokenType.BITMAP, '@bitmap'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'bitmapData'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('bitmapData');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(8192);
    });

    it('parses @page as @data with alignment 256', () => {
      const tokens = [
        createToken(TokenType.PAGE, '@page'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'lookupTable'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('lookupTable');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(256);
    });

    it('parses sugar keyword with let (mutable)', () => {
      const tokens = [
        createToken(TokenType.SPRITE, '@sprite'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'frameData'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('frameData');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(64);
      expect(decl.isConst()).toBe(false);
    });

    it('parses sugar keyword with export modifier', () => {
      const tokens = [
        createToken(TokenType.CHARSET, '@charset'),
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'customFont'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('customFont');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(2048);
      expect(decl.isExportedVariable()).toBe(true);
      expect(decl.isConst()).toBe(true);
    });

    it('parses sugar keyword with array type and initializer', () => {
      const tokens = [
        createToken(TokenType.SPRITE, '@sprite'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'hero'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.LEFT_BRACKET, '['),
        createToken(TokenType.NUMBER, '64'),
        createToken(TokenType.RIGHT_BRACKET, ']'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.LEFT_BRACKET, '['),
        createToken(TokenType.NUMBER, '1'),
        createToken(TokenType.COMMA, ','),
        createToken(TokenType.NUMBER, '2'),
        createToken(TokenType.RIGHT_BRACKET, ']'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('hero');
      expect(decl.getTypeAnnotation()).toBe('byte[64]');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(64);
      expect(decl.getInitializer()).not.toBeNull();
    });
  });

  // ============================================
  // EXPLICIT ALIGNMENT PARSING
  // ============================================

  describe('Explicit alignment @data(align: N)', () => {
    it('parses @data(align: 64)', () => {
      const tokens = [
        createToken(TokenType.DATA, '@data'),
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.ALIGN, 'align'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.NUMBER, '64'),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'spriteData'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('spriteData');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(64);
    });

    it('parses @data(align: 2048)', () => {
      const tokens = [
        createToken(TokenType.DATA, '@data'),
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.ALIGN, 'align'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.NUMBER, '2048'),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'charSet'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('charSet');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(2048);
    });

    it('parses @data(align: 256) for page-aligned data', () => {
      const tokens = [
        createToken(TokenType.DATA, '@data'),
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.ALIGN, 'align'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.NUMBER, '256'),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'sinTable'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('sinTable');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(256);
    });

    it('parses @data(align: 8192) for bitmap-aligned data', () => {
      const tokens = [
        createToken(TokenType.DATA, '@data'),
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.ALIGN, 'align'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.NUMBER, '8192'),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'bitmapGfx'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('bitmapGfx');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(8192);
    });
  });

  describe('Explicit alignment @ram(align: N)', () => {
    it('parses @ram(align: 256)', () => {
      const tokens = [
        createToken(TokenType.RAM, '@ram'),
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.ALIGN, 'align'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.NUMBER, '256'),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'ramBuffer'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('ramBuffer');
      expect(decl.getStorageClass()).toBe(TokenType.RAM);
      expect(decl.getAlignment()).toBe(256);
      expect(decl.isConst()).toBe(false);
    });

    it('parses @ram(align: 1024)', () => {
      const tokens = [
        createToken(TokenType.RAM, '@ram'),
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.ALIGN, 'align'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.NUMBER, '1024'),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'screenBuf'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('screenBuf');
      expect(decl.getStorageClass()).toBe(TokenType.RAM);
      expect(decl.getAlignment()).toBe(1024);
    });
  });

  // ============================================
  // PLAIN STORAGE CLASSES (NO ALIGNMENT)
  // ============================================

  describe('Plain storage classes have no alignment', () => {
    it('@data without alignment has undefined alignment', () => {
      const tokens = [
        createToken(TokenType.DATA, '@data'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'plainData'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('plainData');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBeUndefined();
    });

    it('@ram without alignment has undefined alignment', () => {
      const tokens = [
        createToken(TokenType.RAM, '@ram'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'buffer'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('buffer');
      expect(decl.getStorageClass()).toBe(TokenType.RAM);
      expect(decl.getAlignment()).toBeUndefined();
    });

    it('@zp without alignment has undefined alignment', () => {
      const tokens = [
        createToken(TokenType.ZP, '@zp'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'fastVar'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('fastVar');
      expect(decl.getStorageClass()).toBe(TokenType.ZP);
      expect(decl.getAlignment()).toBeUndefined();
    });

    it('no storage class has null storageClass and undefined alignment', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'simpleVar'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('simpleVar');
      expect(decl.getStorageClass()).toBeNull();
      expect(decl.getAlignment()).toBeUndefined();
    });
  });

  // ============================================
  // SUGAR VS EXPLICIT EQUIVALENCE
  // ============================================

  describe('Sugar keyword equivalence with explicit alignment', () => {
    it('@sprite and @data(align: 64) produce identical AST fields', () => {
      // Parse @sprite version
      const sugarTokens = [
        createToken(TokenType.SPRITE, '@sprite'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'data1'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const sugarParser = new TestDeclarationParser(sugarTokens);
      const sugarDecl = sugarParser.testParseVariableDecl();

      // Parse @data(align: 64) version
      const explicitTokens = [
        createToken(TokenType.DATA, '@data'),
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.ALIGN, 'align'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.NUMBER, '64'),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'data2'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const explicitParser = new TestDeclarationParser(explicitTokens);
      const explicitDecl = explicitParser.testParseVariableDecl();

      // Both should have same storageClass and alignment
      expect(sugarDecl.getStorageClass()).toBe(explicitDecl.getStorageClass());
      expect(sugarDecl.getAlignment()).toBe(explicitDecl.getAlignment());
      expect(sugarDecl.getStorageClass()).toBe(TokenType.DATA);
      expect(sugarDecl.getAlignment()).toBe(64);
    });
  });

  // ============================================
  // MODULE-SCOPE INTEGRATION (full Parser)
  // ============================================

  describe('Module-scope sugar keywords via full Parser', () => {
    it('parses @sprite declaration at module scope', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'test'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.SPRITE, '@sprite'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'hero'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '0'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);
      expect(program.getDeclarations()).toHaveLength(1);
      const decl = program.getDeclarations()[0] as VariableDecl;
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('hero');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(64);
    });

    it('parses @data(align: 256) declaration at module scope', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'test'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.DATA, '@data'),
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.ALIGN, 'align'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.NUMBER, '256'),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'sinTable'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '0'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);
      expect(program.getDeclarations()).toHaveLength(1);
      const decl = program.getDeclarations()[0] as VariableDecl;
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('sinTable');
      expect(decl.getStorageClass()).toBe(TokenType.DATA);
      expect(decl.getAlignment()).toBe(256);
    });

    it('parses multiple aligned declarations at module scope', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'test'),
        createToken(TokenType.SEMICOLON, ';'),
        // First: @sprite const hero: byte = 0;
        createToken(TokenType.SPRITE, '@sprite'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'hero'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '0'),
        createToken(TokenType.SEMICOLON, ';'),
        // Second: @charset const font: byte = 0;
        createToken(TokenType.CHARSET, '@charset'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'font'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '0'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      const parser = new Parser(tokens);
      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);
      expect(program.getDeclarations()).toHaveLength(2);

      const decl1 = program.getDeclarations()[0] as VariableDecl;
      expect(decl1.getName()).toBe('hero');
      expect(decl1.getAlignment()).toBe(64);

      const decl2 = program.getDeclarations()[1] as VariableDecl;
      expect(decl2.getName()).toBe('font');
      expect(decl2.getAlignment()).toBe(2048);
    });
  });
});
