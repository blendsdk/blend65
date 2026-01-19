/**
 * DeclarationParser Tests
 *
 * Tests declaration parsing capabilities including:
 * - Variable declarations with storage classes and export modifiers
 * - @map declarations (simple, range, sequential struct, explicit struct)
 * - Type annotation parsing
 * - Error handling for malformed declarations
 */

import { describe, it, expect } from 'vitest';
import { Token, TokenType } from '../../lexer/types.js';
import { DeclarationParser } from '../../parser/declarations.js';
import {
  VariableDecl,
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
  LiteralExpression,
  DiagnosticCode,
} from '../../ast/index.js';

// Create a concrete test implementation of DeclarationParser
class TestDeclarationParser extends DeclarationParser {
  // Expose protected methods for testing
  public testParseVariableDecl() {
    return this.parseVariableDecl();
  }

  public testParseMapDecl() {
    return this.parseMapDecl();
  }

  public testParseSimpleMapDecl(startToken: Token, name: string, address: any) {
    return this.parseSimpleMapDecl(startToken, name, address);
  }

  public testParseRangeMapDecl(startToken: Token, name: string) {
    return this.parseRangeMapDecl(startToken, name);
  }

  public testParseSequentialStructMapDecl(startToken: Token, name: string, baseAddress: any) {
    return this.parseSequentialStructMapDecl(startToken, name, baseAddress);
  }

  public testParseExplicitStructMapDecl(startToken: Token, name: string, baseAddress: any) {
    return this.parseExplicitStructMapDecl(startToken, name, baseAddress);
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

    it('parses variable with storage class', () => {
      const tokens = [
        createToken(TokenType.ZP, '@zp'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'fastVar'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseVariableDecl();
      expect(decl).toBeInstanceOf(VariableDecl);
      expect(decl.getName()).toBe('fastVar');
      expect(decl.getStorageClass()).toBe(TokenType.ZP);
    });

    it('parses variable with export + storage class + initializer', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.RAM, '@ram'),
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
      expect(decl.getStorageClass()).toBe(TokenType.RAM);
      expect(decl.isConst()).toBe(true);
      expect((decl.getInitializer() as LiteralExpression).getValue()).toBe(256);
    });
  });

  describe('Simple @map Declaration Parsing', () => {
    it('parses basic simple @map declaration', () => {
      const tokens = [
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.IDENTIFIER, 'borderColor'),
        createToken(TokenType.AT, 'at'),
        createToken(TokenType.NUMBER, '$D020'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseMapDecl();
      expect(decl).toBeInstanceOf(SimpleMapDecl);

      const mapDecl = decl as SimpleMapDecl;
      expect(mapDecl.getName()).toBe('borderColor');
      expect(mapDecl.getAddress()).toBeInstanceOf(LiteralExpression);
      expect((mapDecl.getAddress() as LiteralExpression).getValue()).toBe(0xd020);
      expect(mapDecl.getTypeAnnotation()).toBe('byte');
    });
  });

  describe('Range @map Declaration Parsing', () => {
    it('parses range @map declaration', () => {
      const tokens = [
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.IDENTIFIER, 'sprites'),
        createToken(TokenType.FROM, 'from'),
        createToken(TokenType.NUMBER, '$D000'),
        createToken(TokenType.TO, 'to'),
        createToken(TokenType.NUMBER, '$D02E'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseMapDecl();
      expect(decl).toBeInstanceOf(RangeMapDecl);

      const rangeDecl = decl as RangeMapDecl;
      expect(rangeDecl.getName()).toBe('sprites');
      expect((rangeDecl.getStartAddress() as LiteralExpression).getValue()).toBe(0xd000);
      expect((rangeDecl.getEndAddress() as LiteralExpression).getValue()).toBe(0xd02e);
      expect(rangeDecl.getTypeAnnotation()).toBe('byte');
    });
  });

  describe('Sequential Struct @map Declaration Parsing', () => {
    it('parses sequential struct @map declaration', () => {
      const tokens = [
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.IDENTIFIER, 'sid'),
        createToken(TokenType.AT, 'at'),
        createToken(TokenType.NUMBER, '$D400'),
        createToken(TokenType.TYPE, 'type'),
        createToken(TokenType.IDENTIFIER, 'frequency'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.COMMA, ','),
        createToken(TokenType.IDENTIFIER, 'volume'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.END, 'end'),
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseMapDecl();
      expect(decl).toBeInstanceOf(SequentialStructMapDecl);

      const structDecl = decl as SequentialStructMapDecl;
      expect(structDecl.getName()).toBe('sid');
      expect((structDecl.getBaseAddress() as LiteralExpression).getValue()).toBe(0xd400);

      const fields = structDecl.getFields();
      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe('frequency');
      expect(fields[0].baseType).toBe('byte');
      expect(fields[1].name).toBe('volume');
      expect(fields[1].baseType).toBe('byte');
    });

    it('parses sequential struct with array fields', () => {
      const tokens = [
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.IDENTIFIER, 'buffer'),
        createToken(TokenType.AT, 'at'),
        createToken(TokenType.NUMBER, '$8000'),
        createToken(TokenType.TYPE, 'type'),
        createToken(TokenType.IDENTIFIER, 'data'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.LEFT_BRACKET, '['),
        createToken(TokenType.NUMBER, '256'),
        createToken(TokenType.RIGHT_BRACKET, ']'),
        createToken(TokenType.END, 'end'),
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseMapDecl();
      expect(decl).toBeInstanceOf(SequentialStructMapDecl);

      const structDecl = decl as SequentialStructMapDecl;
      const fields = structDecl.getFields();
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('data');
      expect(fields[0].baseType).toBe('byte');
      expect(fields[0].arraySize).toBe(256);
    });
  });

  describe('Explicit Struct @map Declaration Parsing', () => {
    it('parses explicit struct @map declaration', () => {
      const tokens = [
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.IDENTIFIER, 'vic'),
        createToken(TokenType.AT, 'at'),
        createToken(TokenType.NUMBER, '$D000'),
        createToken(TokenType.LAYOUT, 'layout'),
        createToken(TokenType.IDENTIFIER, 'borderColor'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.AT, 'at'),
        createToken(TokenType.NUMBER, '$D020'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.END, 'end'),
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseMapDecl();
      expect(decl).toBeInstanceOf(ExplicitStructMapDecl);

      const explicitDecl = decl as ExplicitStructMapDecl;
      expect(explicitDecl.getName()).toBe('vic');
      expect((explicitDecl.getBaseAddress() as LiteralExpression).getValue()).toBe(0xd000);

      const fields = explicitDecl.getFields();
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('borderColor');
      expect(fields[0].addressSpec.kind).toBe('single');
      if (fields[0].addressSpec.kind === 'single') {
        expect((fields[0].addressSpec.address as LiteralExpression).getValue()).toBe(0xd020);
      }
      expect(fields[0].typeAnnotation).toBe('byte');
    });

    it('parses explicit struct with range address spec', () => {
      const tokens = [
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.IDENTIFIER, 'memory'),
        createToken(TokenType.AT, 'at'),
        createToken(TokenType.NUMBER, '$0000'),
        createToken(TokenType.LAYOUT, 'layout'),
        createToken(TokenType.IDENTIFIER, 'screen'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.FROM, 'from'),
        createToken(TokenType.NUMBER, '$0400'),
        createToken(TokenType.TO, 'to'),
        createToken(TokenType.NUMBER, '$07E7'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.END, 'end'),
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseMapDecl();
      expect(decl).toBeInstanceOf(ExplicitStructMapDecl);

      const explicitDecl = decl as ExplicitStructMapDecl;
      const fields = explicitDecl.getFields();
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('screen');
      expect(fields[0].addressSpec.kind).toBe('range');
      if (fields[0].addressSpec.kind === 'range') {
        expect((fields[0].addressSpec.startAddress as LiteralExpression).getValue()).toBe(0x0400);
        expect((fields[0].addressSpec.endAddress as LiteralExpression).getValue()).toBe(0x07e7);
      }
    });
  });

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

    it('handles invalid @map declaration structure', () => {
      const tokens = [
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.IDENTIFIER, 'invalid'),
        createToken(TokenType.SEMICOLON, ';'), // Missing 'at' or 'from'
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      parser.testParseMapDecl();
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some(d => d.code === DiagnosticCode.UNEXPECTED_TOKEN)).toBe(true);
    });

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

  describe('Complex Declaration Scenarios', () => {
    it('parses multiple fields in sequential @map', () => {
      const tokens = [
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.IDENTIFIER, 'sound'),
        createToken(TokenType.AT, 'at'),
        createToken(TokenType.NUMBER, '$D400'),
        createToken(TokenType.TYPE, 'type'),
        createToken(TokenType.IDENTIFIER, 'freq'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.WORD, 'word'),
        createToken(TokenType.COMMA, ','),
        createToken(TokenType.IDENTIFIER, 'pulseWidth'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.WORD, 'word'),
        createToken(TokenType.COMMA, ','),
        createToken(TokenType.IDENTIFIER, 'control'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.END, 'end'),
        createToken(TokenType.MAP, '@map'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestDeclarationParser(tokens);

      const decl = parser.testParseMapDecl();
      expect(decl).toBeInstanceOf(SequentialStructMapDecl);

      const structDecl = decl as SequentialStructMapDecl;
      const fields = structDecl.getFields();
      expect(fields).toHaveLength(3);
      expect(fields[0].name).toBe('freq');
      expect(fields[1].name).toBe('pulseWidth');
      expect(fields[2].name).toBe('control');
    });
  });
});
