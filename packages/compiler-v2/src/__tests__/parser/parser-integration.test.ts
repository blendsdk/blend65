/**
 * Parser Integration Tests (V2)
 *
 * Tests the complete Parser class integration including:
 * - Full inheritance chain functionality
 * - Main parse() entry point
 * - Integration between all parser layers
 * - End-to-end parsing of complete programs
 *
 * NOTE: V2 has NO storage classes (@zp/@ram/@data) - frame allocator handles memory.
 * NOTE: V2 has NO @map syntax - uses peek/poke intrinsics instead.
 */

import { describe, it, expect } from 'vitest';
import { Token, TokenType } from '../../lexer/types.js';
import { Parser } from '../../parser/parser.js';
import {
  Program,
  VariableDecl,
  LiteralExpression,
  BinaryExpression,
  IdentifierExpression,
  DiagnosticCode,
} from '../../ast/index.js';

// Helper to create test tokens
function createToken(type: TokenType, value: string, line = 1, column = 1): Token {
  return {
    type,
    value,
    start: { line, column, offset: column },
    end: { line, column: column + value.length, offset: column + value.length },
  };
}

describe('Parser Integration', () => {
  let parser: Parser;

  describe('Complete Program Parsing', () => {
    it('parses program with implicit global module', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      expect(program).toBeInstanceOf(Program);
      expect(program.getModule().isImplicitModule()).toBe(true);
      expect(program.getModule().getFullName()).toBe('global');
      expect(program.getDeclarations()).toHaveLength(1);
    });

    it('parses program with explicit module', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'Game'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'score'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.WORD, 'word'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      expect(program).toBeInstanceOf(Program);
      expect(program.getModule().isImplicitModule()).toBe(false);
      expect(program.getModule().getFullName()).toBe('Game');
      expect(program.getDeclarations()).toHaveLength(1);
    });

    it('parses program with multiple declarations', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'Test'),
        createToken(TokenType.SEMICOLON, ';'),
        // First variable declaration
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'counter'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '0'),
        createToken(TokenType.SEMICOLON, ';'),
        // Second variable declaration
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'MAX_VALUE'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.WORD, 'word'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '1000'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      expect(program).toBeInstanceOf(Program);
      expect(program.getModule().getFullName()).toBe('Test');
      expect(program.getDeclarations()).toHaveLength(2);

      const [counterDecl, maxDecl] = program.getDeclarations();
      expect(counterDecl).toBeInstanceOf(VariableDecl);
      expect((counterDecl as VariableDecl).getName()).toBe('counter');
      expect(maxDecl).toBeInstanceOf(VariableDecl);
      expect((maxDecl as VariableDecl).getName()).toBe('MAX_VALUE');
    });
  });

  describe('Expression Integration', () => {
    it('parses complex expressions in variable initializers', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'result'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.WORD, 'word'),
        createToken(TokenType.ASSIGN, '='),
        // Complex expression: (x + y) * 2
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.PLUS, '+'),
        createToken(TokenType.IDENTIFIER, 'y'),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.MULTIPLY, '*'),
        createToken(TokenType.NUMBER, '2'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      const declarations = program.getDeclarations();
      expect(declarations).toHaveLength(1);

      const varDecl = declarations[0] as VariableDecl;
      expect(varDecl.getName()).toBe('result');

      const initializer = varDecl.getInitializer() as BinaryExpression;
      expect(initializer).toBeInstanceOf(BinaryExpression);
      expect(initializer.getOperator()).toBe(TokenType.MULTIPLY);

      // Right side should be literal 2
      expect((initializer.getRight() as LiteralExpression).getValue()).toBe(2);

      // Left side should be (x + y)
      const leftSide = initializer.getLeft() as BinaryExpression;
      expect(leftSide.getOperator()).toBe(TokenType.PLUS);
      expect((leftSide.getLeft() as IdentifierExpression).getName()).toBe('x');
      expect((leftSide.getRight() as IdentifierExpression).getName()).toBe('y');
    });

    it('parses hex values in variable initializers', () => {
      const tokens = [
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'SCREEN_ADDRESS'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.WORD, 'word'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '$0400'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      const declarations = program.getDeclarations();
      expect(declarations).toHaveLength(1);

      const varDecl = declarations[0] as VariableDecl;
      expect(varDecl.getName()).toBe('SCREEN_ADDRESS');
      expect((varDecl.getInitializer() as LiteralExpression).getValue()).toBe(0x0400);
    });
  });

  describe('Error Recovery Integration', () => {
    it('recovers from multiple errors and continues parsing', () => {
      const tokens = [
        // Invalid first declaration
        createToken(TokenType.IDENTIFIER, 'invalid'), // Should be let/const
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.SEMICOLON, ';'),
        // Valid second declaration
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'valid'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      expect(program).toBeInstanceOf(Program);
      expect(program.getDeclarations()).toHaveLength(1);

      // Should have errors but still parse what it can
      expect(parser.hasErrors()).toBe(true);
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.some(d => d.code === DiagnosticCode.UNEXPECTED_TOKEN)).toBe(true);

      // The valid declaration should be parsed
      const validDecl = program.getDeclarations()[0] as VariableDecl;
      expect(validDecl.getName()).toBe('valid');
    });

    it('handles unexpected tokens and synchronizes', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.IF, 'if'), // Unexpected token instead of semicolon
        createToken(TokenType.LET, 'let'), // Parser should synchronize and continue here
        createToken(TokenType.IDENTIFIER, 'y'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      expect(parser.hasErrors()).toBe(true);

      // Should still parse what it can after recovery
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.some(d => d.code === DiagnosticCode.UNEXPECTED_TOKEN)).toBe(true);
    });
  });

  describe('Export Modifiers', () => {
    it('parses exported const variable', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'MAX_PLAYERS'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '4'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      const declarations = program.getDeclarations();
      expect(declarations).toHaveLength(1);

      const varDecl = declarations[0] as VariableDecl;
      expect(varDecl.getName()).toBe('MAX_PLAYERS');
      expect(varDecl.isExportedVariable()).toBe(true);
      expect(varDecl.isConst()).toBe(true);
      expect((varDecl.getInitializer() as LiteralExpression).getValue()).toBe(4);
    });

    it('parses exported let variable', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'playerCount'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '0'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      const declarations = program.getDeclarations();
      expect(declarations).toHaveLength(1);

      const varDecl = declarations[0] as VariableDecl;
      expect(varDecl.getName()).toBe('playerCount');
      expect(varDecl.isExportedVariable()).toBe(true);
      expect(varDecl.isConst()).toBe(false);
    });
  });

  // V2: Removed "Storage Classes and Export Modifiers" test with @zp - no storage classes in v2

  describe('Inheritance Chain Verification', () => {
    it('can access BaseParser utilities', () => {
      const tokens = [createToken(TokenType.EOF, '')];
      parser = new Parser(tokens);

      // Should have access to diagnostic collection (BaseParser)
      expect(parser.hasErrors()).toBe(false);
      expect(parser.getDiagnostics()).toEqual([]);
    });

    it('can access ExpressionParser functionality', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '2'),
        createToken(TokenType.PLUS, '+'),
        createToken(TokenType.NUMBER, '3'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      const varDecl = program.getDeclarations()[0] as VariableDecl;
      const initializer = varDecl.getInitializer() as BinaryExpression;

      // Verifies expression parsing works (ExpressionParser)
      expect(initializer).toBeInstanceOf(BinaryExpression);
      expect(initializer.getOperator()).toBe(TokenType.PLUS);
    });

    it('can access DeclarationParser functionality', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'test'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '42'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      const declarations = program.getDeclarations();

      // Verifies variable parsing works (DeclarationParser)
      expect(declarations).toHaveLength(1);
      expect(declarations[0]).toBeInstanceOf(VariableDecl);
      expect((declarations[0] as VariableDecl).getName()).toBe('test');
    });

    it('can access ModuleParser functionality', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'TestModule'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.IDENTIFIER, 'SubModule'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      const moduleDecl = program.getModule();

      // Verifies module parsing works (ModuleParser)
      expect(moduleDecl.getNamePath()).toEqual(['TestModule', 'SubModule']);
      expect(moduleDecl.getFullName()).toBe('TestModule.SubModule');
    });
  });

  describe('Real-World Program Examples', () => {
    it('parses simple game module', () => {
      const tokens = [
        // Module declaration
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'Game'),
        createToken(TokenType.SEMICOLON, ';'),
        // Score variable
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'score'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.WORD, 'word'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '0'),
        createToken(TokenType.SEMICOLON, ';'),
        // Lives constant
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'INITIAL_LIVES'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '3'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      expect(program).toBeInstanceOf(Program);
      expect(parser.hasErrors()).toBe(false);

      // Module
      expect(program.getModule().getFullName()).toBe('Game');

      // Declarations
      const declarations = program.getDeclarations();
      expect(declarations).toHaveLength(2);

      const scoreVar = declarations[0] as VariableDecl;
      expect(scoreVar.getName()).toBe('score');
      expect(scoreVar.isExportedVariable()).toBe(true);

      const livesConst = declarations[1] as VariableDecl;
      expect(livesConst.getName()).toBe('INITIAL_LIVES');
      expect(livesConst.isConst()).toBe(true);
    });

    // V2: Removed "parses C64 SID register mapping" test - was all @map syntax
  });

  describe('Error Handling Integration', () => {
    it('collects multiple errors from different layers', () => {
      const tokens = [
        // Missing module name
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.LET, 'let'), // Should be identifier
        // Invalid variable declaration
        createToken(TokenType.IDENTIFIER, 'invalid'), // Should be let/const
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      expect(parser.hasErrors()).toBe(true);

      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(1); // Multiple errors
      expect(diagnostics.some(d => d.code === DiagnosticCode.EXPECTED_TOKEN)).toBe(true);
      expect(diagnostics.some(d => d.code === DiagnosticCode.UNEXPECTED_TOKEN)).toBe(true);
    });

    it('provides meaningful error locations', () => {
      const tokens = [
        createToken(TokenType.LET, 'let', 1, 1),
        createToken(TokenType.COLON, ':', 1, 5), // Missing identifier
        createToken(TokenType.BYTE, 'byte', 1, 7),
        createToken(TokenType.EOF, '', 1, 11),
      ];
      parser = new Parser(tokens);

      parser.parse();
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBeGreaterThan(0);

      const errorDiagnostic = diagnostics[0];
      expect(errorDiagnostic.location.start.line).toBe(1);
      expect(errorDiagnostic.location.start.column).toBe(5); // Points to the colon
    });
  });

  describe('Performance and Edge Cases', () => {
    it('handles empty files', () => {
      const tokens = [createToken(TokenType.EOF, '')];
      parser = new Parser(tokens);

      const program = parser.parse();
      expect(program).toBeInstanceOf(Program);
      expect(program.getModule().isImplicitModule()).toBe(true);
      expect(program.getDeclarations()).toHaveLength(0);
      expect(parser.hasErrors()).toBe(false);
    });

    it('handles files with only module declaration', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'EmptyModule'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();
      expect(program).toBeInstanceOf(Program);
      expect(program.getModule().getFullName()).toBe('EmptyModule');
      expect(program.getDeclarations()).toHaveLength(0);
      expect(parser.hasErrors()).toBe(false);
    });

    it('handles large number of declarations', () => {
      const tokens: Token[] = [];

      // Add many variable declarations
      for (let i = 0; i < 100; i++) {
        tokens.push(createToken(TokenType.LET, 'let'));
        tokens.push(createToken(TokenType.IDENTIFIER, `var${i}`));
        tokens.push(createToken(TokenType.COLON, ':'));
        tokens.push(createToken(TokenType.BYTE, 'byte'));
        tokens.push(createToken(TokenType.SEMICOLON, ';'));
      }
      tokens.push(createToken(TokenType.EOF, ''));

      parser = new Parser(tokens);
      const program = parser.parse();

      expect(program.getDeclarations()).toHaveLength(100);
      expect(parser.hasErrors()).toBe(false);
    });
  });

  describe('Public API Verification', () => {
    it('provides complete diagnostic information', () => {
      const tokens = [
        createToken(TokenType.IDENTIFIER, 'error1'),
        createToken(TokenType.IDENTIFIER, 'error2'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      parser.parse();

      expect(parser.hasErrors()).toBe(true);
      expect(parser.getDiagnostics().length).toBeGreaterThan(0);

      const counts = parser.getDiagnosticCounts();
      expect(counts.errors).toBeGreaterThan(0);
      expect(counts.warnings).toBe(0);
    });

    it('maintains clean state for successful parsing', () => {
      const tokens = [
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'success'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new Parser(tokens);

      const program = parser.parse();

      expect(parser.hasErrors()).toBe(false);
      expect(parser.getDiagnostics()).toEqual([]);
      expect(program).toBeInstanceOf(Program);
    });
  });
});