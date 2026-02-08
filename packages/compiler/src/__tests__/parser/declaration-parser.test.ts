/**
 * DeclarationParser Tests (V2)
 *
 * Tests declaration parsing capabilities including:
 * - Variable declarations with export modifiers
 * - Type annotation parsing
 * - Error handling for malformed declarations
 *
 * NOTE: V2 has NO storage classes (@zp/@ram/@data) - frame allocator handles memory.
 * NOTE: V2 has NO @map syntax - uses peek/poke intrinsics instead.
 */

import { describe, it, expect } from 'vitest';
import { Token, TokenType } from '../../lexer/types.js';
import { DeclarationParser } from '../../parser/declarations.js';
import { VariableDecl, LiteralExpression, DiagnosticCode } from '../../ast/index.js';

// Create a concrete test implementation of DeclarationParser
class TestDeclarationParser extends DeclarationParser {
  // Expose protected methods for testing
  public testParseVariableDecl() {
    return this.parseVariableDecl();
  }
}

// Helper to create test tokens
function createToken(type: TokenType, value: string, line = 1, column = 1): Token {
  return {
    type,
    value,
    start: { line, column, offset: column },
    end: { line, column: column + value.length, offset: column + value.length },
  };
}

describe('DeclarationParser', () => {
  let parser: TestDeclarationParser;

  describe('Variable Declaration Parsing', () => {
    it('parses basic let declaration', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('x');
      expect(decl.getTypeAnnotation()).toBe('byte');
      expect(decl.isConst()).toBe(false);
      expect(decl.isExportedVariable()).toBe(false);
    });

    it('parses const declaration', () => {
      const tokens = [
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'MAX_SIZE'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.WORD, 'word'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('MAX_SIZE');
      expect(decl.getTypeAnnotation()).toBe('word');
      expect(decl.isConst()).toBe(true);
    });

    it('parses variable with initializer', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'counter'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '0'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('counter');
      expect(decl.getInitializer()).toBeInstanceOf(LiteralExpression);
      expect((decl.getInitializer() as LiteralExpression).getValue()).toBe(0);
    });

    it('parses variable with export modifier', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'publicVar'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('publicVar');
      expect(decl.isExportedVariable()).toBe(true);
    });

    // V2: Removed "parses variable with storage class" test - no storage classes in v2

    it('parses exported const with initializer', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'BUFFER_SIZE'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.WORD, 'word'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '256'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('BUFFER_SIZE');
      expect(decl.isExportedVariable()).toBe(true);
      expect(decl.isConst()).toBe(true);
      expect((decl.getInitializer() as LiteralExpression).getValue()).toBe(256);
    });

    // V2: Removed "parses variable with export + storage class + initializer" test - no storage classes in v2
  });

  // V2: Removed all @map declaration tests - v2 uses peek/poke intrinsics instead

  describe('Declaration Error Handling', () => {
    it('handles missing variable name', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.COLON, ':'), // Missing identifier
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      parser.testParseVariableDecl();
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some(d => d.code === DiagnosticCode.EXPECTED_TOKEN)).toBe(true);
    });

    it('handles missing semicolon', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.EOF, ''), // Missing semicolon
      ];
      parser = new TestDeclarationParser(tokens);

      parser.testParseVariableDecl();
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPECTED_TOKEN);
    });

    // V2: Removed "@map declaration structure" test - no @map in v2

    it('recovers from invalid let/const keyword', () => {
      const tokens = [
        createToken(TokenType.IDENTIFIER, 'invalid'), // Should be let/const
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('error'); // Error recovery dummy

      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPECTED_TOKEN);
    });
  });

  describe('Type Annotation Parsing', () => {
    it('parses built-in type keywords', () => {
      const types = [
        { token: TokenType.BYTE, expected: 'byte' },
        { token: TokenType.WORD, expected: 'word' },
        { token: TokenType.VOID, expected: 'void' },
        { token: TokenType.STRING, expected: 'string' },
        { token: TokenType.BOOLEAN, expected: 'boolean' },
        { token: TokenType.CALLBACK, expected: 'callback' },
      ];

      for (const type of types) {
        const tokens = [
          createToken(TokenType.LET, 'let'),
          createToken(TokenType.IDENTIFIER, 'x'),
          createToken(TokenType.COLON, ':'),
          createToken(type.token, type.expected),
          createToken(TokenType.SEMICOLON, ';'),
          createToken(TokenType.EOF, ''),
        ];
        parser = new TestDeclarationParser(tokens);

        const decl = parser.testParseVariableDecl();
        expect(decl.getTypeAnnotation()).toBe(type.expected);
      }
    });

    it('parses custom type identifiers', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'player'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.IDENTIFIER, 'Sprite'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl.getTypeAnnotation()).toBe('Sprite');
    });

    it('handles missing type annotation', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.SEMICOLON, ';'), // Missing colon and type
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl.getTypeAnnotation()).toBeNull();
    });
  });

  // V2: Removed "Complex Declaration Scenarios" - all were @map tests
});