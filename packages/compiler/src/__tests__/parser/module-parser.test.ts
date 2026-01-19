/**
 * ModuleParser Tests
 *
 * Tests module system parsing capabilities including:
 * - Module declarations (explicit and implicit)
 * - Module scope validation
 * - Module name path parsing
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { DiagnosticCode, ImportDecl, ModuleDecl, VariableDecl } from '../../ast/index.js';
import { Token, TokenType } from '../../lexer/types.js';
import { ModuleParser } from '../../parser/modules.js';

// Create a concrete test implementation of ModuleParser
class TestModuleParser extends ModuleParser {
  // Expose protected methods for testing
  public testParseModuleDecl() {
    return this.parseModuleDecl();
  }

  public testCreateImplicitGlobalModuleDecl() {
    return this.createImplicitGlobalModuleDecl();
  }

  public testValidateModuleDeclaration() {
    this.validateModuleDeclaration();
  }

  public testValidateModuleScopeItem(token: Token) {
    this.validateModuleScopeItem(token);
  }

  // Phase 5: Import/Export testing methods
  public testParseImportDecl() {
    return this.parseImportDecl();
  }

  public testParseExportDecl() {
    return this.parseExportDecl();
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

describe('ModuleParser', () => {
  let parser: TestModuleParser;

  describe('Module Declaration Parsing', () => {
    it('parses simple module declaration', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'Game'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const moduleDecl = parser.testParseModuleDecl();
      expect(moduleDecl).toBeInstanceOf(ModuleDecl);
      expect(moduleDecl.getNamePath()).toEqual(['Game']);
      expect(moduleDecl.getFullName()).toBe('Game');
      expect(moduleDecl.isImplicitModule()).toBe(false);
    });

    it('parses nested module declaration', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'Game'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.IDENTIFIER, 'Main'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const moduleDecl = parser.testParseModuleDecl();
      expect(moduleDecl).toBeInstanceOf(ModuleDecl);
      expect(moduleDecl.getNamePath()).toEqual(['Game', 'Main']);
      expect(moduleDecl.getFullName()).toBe('Game.Main');
      expect(moduleDecl.isImplicitModule()).toBe(false);
    });

    it('parses deeply nested module declaration', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'Graphics'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.IDENTIFIER, 'Sprites'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.IDENTIFIER, 'Player'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const moduleDecl = parser.testParseModuleDecl();
      expect(moduleDecl).toBeInstanceOf(ModuleDecl);
      expect(moduleDecl.getNamePath()).toEqual(['Graphics', 'Sprites', 'Player']);
      expect(moduleDecl.getFullName()).toBe('Graphics.Sprites.Player');
      expect(moduleDecl.isImplicitModule()).toBe(false);
    });

    it('creates implicit global module', () => {
      const tokens = [createToken(TokenType.EOF, '')];
      parser = new TestModuleParser(tokens);

      const moduleDecl = parser.testCreateImplicitGlobalModuleDecl();
      expect(moduleDecl).toBeInstanceOf(ModuleDecl);
      expect(moduleDecl.getNamePath()).toEqual(['global']);
      expect(moduleDecl.getFullName()).toBe('global');
      expect(moduleDecl.isImplicitModule()).toBe(true);
    });
  });

  describe('Module Declaration Error Handling', () => {
    it('handles missing module name', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.EOF, ''), // Missing identifier
      ];
      parser = new TestModuleParser(tokens);

      parser.testParseModuleDecl();
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPECTED_TOKEN);
    });

    it('handles missing identifier after dot', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'Game'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.EOF, ''), // Missing identifier after dot
      ];
      parser = new TestModuleParser(tokens);

      parser.testParseModuleDecl();
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPECTED_TOKEN);
    });

    it('prevents duplicate module declarations', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'First'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      // First module declaration should be fine
      parser.testParseModuleDecl();
      expect(parser.getDiagnostics().length).toBe(0);

      // Second module declaration should error
      parser.testValidateModuleDeclaration();
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.DUPLICATE_MODULE);
    });
  });

  describe('Module Scope Validation', () => {
    beforeEach(() => {
      parser = new TestModuleParser([createToken(TokenType.EOF, '')]);
    });

    it('allows declaration tokens at module scope', () => {
      const validTokens = [
        TokenType.MODULE,
        TokenType.IMPORT,
        TokenType.EXPORT,
        TokenType.FUNCTION,
        TokenType.LET,
        TokenType.CONST,
        TokenType.TYPE,
        TokenType.ENUM,
        TokenType.ZP,
        TokenType.RAM,
        TokenType.DATA,
        TokenType.EOF,
      ];

      for (const tokenType of validTokens) {
        const token = createToken(tokenType, tokenType.toString());
        parser.testValidateModuleScopeItem(token);
        // Should not add any diagnostics
        expect(parser.getDiagnostics().length).toBe(0);
      }
    });

    it('rejects executable statements at module scope', () => {
      const invalidTokens = [
        { type: TokenType.IDENTIFIER, value: 'someFunction' },
        { type: TokenType.NUMBER, value: '42' },
        { type: TokenType.STRING_LITERAL, value: 'hello' },
        { type: TokenType.IF, value: 'if' },
        { type: TokenType.WHILE, value: 'while' },
      ];

      for (const tokenInfo of invalidTokens) {
        const token = createToken(tokenInfo.type, tokenInfo.value);
        parser.testValidateModuleScopeItem(token);

        const diagnostics = parser.getDiagnostics();
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics.some(d => d.code === DiagnosticCode.INVALID_MODULE_SCOPE)).toBe(true);

        // Reset for next test
        parser = new TestModuleParser([createToken(TokenType.EOF, '')]);
      }
    });
  });

  describe('Module Name Processing', () => {
    it('handles single-part module names', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'Utils'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const moduleDecl = parser.testParseModuleDecl();
      expect(moduleDecl.getNamePath()).toEqual(['Utils']);
      expect(moduleDecl.getFullName()).toBe('Utils');
    });

    it('handles multi-part module names', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module'),
        createToken(TokenType.IDENTIFIER, 'Engine'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.IDENTIFIER, 'Graphics'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.IDENTIFIER, 'Renderer'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const moduleDecl = parser.testParseModuleDecl();
      expect(moduleDecl.getNamePath()).toEqual(['Engine', 'Graphics', 'Renderer']);
      expect(moduleDecl.getFullName()).toBe('Engine.Graphics.Renderer');
    });
  });

  describe('Module Location Tracking', () => {
    it('tracks source location correctly', () => {
      const tokens = [
        createToken(TokenType.MODULE, 'module', 1, 1),
        createToken(TokenType.IDENTIFIER, 'Test', 1, 8),
        createToken(TokenType.EOF, '', 1, 12),
      ];
      parser = new TestModuleParser(tokens);

      const moduleDecl = parser.testParseModuleDecl();
      const location = moduleDecl.getLocation();
      expect(location.start.line).toBe(1);
      expect(location.start.column).toBe(1);
      expect(location.end.line).toBe(1);
      expect(location.end.column).toBe(12);
    });
  });

  // ============================================
  // PHASE 5: IMPORT DECLARATION PARSING TESTS
  // ============================================

  describe('Import Declaration Parsing (Phase 5.1)', () => {
    it('parses single import from simple module', () => {
      const tokens = [
        createToken(TokenType.IMPORT, 'import'),
        createToken(TokenType.IDENTIFIER, 'clearScreen'),
        createToken(TokenType.FROM, 'from'),
        createToken(TokenType.IDENTIFIER, 'c64'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.IDENTIFIER, 'graphics'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const importDecl = parser.testParseImportDecl() as ImportDecl;
      expect(importDecl).toBeInstanceOf(ImportDecl);
      expect(importDecl.getIdentifiers()).toEqual(['clearScreen']);
      expect(importDecl.getModulePath()).toEqual(['c64', 'graphics']);
      expect(importDecl.getModuleName()).toBe('c64.graphics');
      expect(importDecl.isWildcardImport()).toBe(false);
    });

    it('parses multiple imports from module', () => {
      const tokens = [
        createToken(TokenType.IMPORT, 'import'),
        createToken(TokenType.IDENTIFIER, 'clearScreen'),
        createToken(TokenType.COMMA, ','),
        createToken(TokenType.IDENTIFIER, 'setPixel'),
        createToken(TokenType.COMMA, ','),
        createToken(TokenType.IDENTIFIER, 'drawLine'),
        createToken(TokenType.FROM, 'from'),
        createToken(TokenType.IDENTIFIER, 'c64'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.IDENTIFIER, 'graphics'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.IDENTIFIER, 'screen'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const importDecl = parser.testParseImportDecl() as ImportDecl;
      expect(importDecl).toBeInstanceOf(ImportDecl);
      expect(importDecl.getIdentifiers()).toEqual(['clearScreen', 'setPixel', 'drawLine']);
      expect(importDecl.getModulePath()).toEqual(['c64', 'graphics', 'screen']);
      expect(importDecl.getModuleName()).toBe('c64.graphics.screen');
      expect(importDecl.isWildcardImport()).toBe(false);
    });

    it('parses imports from deeply nested modules', () => {
      const tokens = [
        createToken(TokenType.IMPORT, 'import'),
        createToken(TokenType.IDENTIFIER, 'initSID'),
        createToken(TokenType.COMMA, ','),
        createToken(TokenType.IDENTIFIER, 'playNote'),
        createToken(TokenType.FROM, 'from'),
        createToken(TokenType.IDENTIFIER, 'c64'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.IDENTIFIER, 'audio'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.IDENTIFIER, 'sid'),
        createToken(TokenType.DOT, '.'),
        createToken(TokenType.IDENTIFIER, 'player'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const importDecl = parser.testParseImportDecl() as ImportDecl;
      expect(importDecl).toBeInstanceOf(ImportDecl);
      expect(importDecl.getIdentifiers()).toEqual(['initSID', 'playNote']);
      expect(importDecl.getModulePath()).toEqual(['c64', 'audio', 'sid', 'player']);
      expect(importDecl.getModuleName()).toBe('c64.audio.sid.player');
    });

    it('handles import declaration error recovery - missing identifier', () => {
      const tokens = [
        createToken(TokenType.IMPORT, 'import'),
        createToken(TokenType.FROM, 'from'), // Missing identifier
        createToken(TokenType.IDENTIFIER, 'module'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      parser.testParseImportDecl();
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPECTED_TOKEN);
    });

    it('handles import declaration error recovery - missing from', () => {
      const tokens = [
        createToken(TokenType.IMPORT, 'import'),
        createToken(TokenType.IDENTIFIER, 'function'),
        createToken(TokenType.IDENTIFIER, 'module'), // Missing 'from' keyword
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      parser.testParseImportDecl();
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPECTED_TOKEN);
    });

    it('handles import declaration error recovery - missing module name', () => {
      const tokens = [
        createToken(TokenType.IMPORT, 'import'),
        createToken(TokenType.IDENTIFIER, 'function'),
        createToken(TokenType.FROM, 'from'),
        createToken(TokenType.SEMICOLON, ';'), // Missing module name
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      parser.testParseImportDecl();
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPECTED_TOKEN);
    });

    it('handles import declaration error recovery - missing semicolon', () => {
      const tokens = [
        createToken(TokenType.IMPORT, 'import'),
        createToken(TokenType.IDENTIFIER, 'function'),
        createToken(TokenType.FROM, 'from'),
        createToken(TokenType.IDENTIFIER, 'module'),
        createToken(TokenType.EOF, ''), // Missing semicolon - should auto-insert
      ];
      parser = new TestModuleParser(tokens);

      const importDecl = parser.testParseImportDecl() as ImportDecl;
      expect(importDecl).toBeInstanceOf(ImportDecl);
      expect(importDecl.getIdentifiers()).toEqual(['function']);
      expect(importDecl.getModulePath()).toEqual(['module']);
      // Should handle missing semicolon gracefully with auto-insertion
    });
  });

  // ============================================
  // PHASE 5: EXPORT DECLARATION PARSING TESTS
  // ============================================

  describe('Export Declaration Parsing (Phase 5.2)', () => {
    it('handles export function declaration (requires full Parser)', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.FUNCTION, 'function'),
        createToken(TokenType.IDENTIFIER, 'clearScreen'),
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.VOID, 'void'),
        createToken(TokenType.END, 'end'),
        createToken(TokenType.FUNCTION, 'function'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const declaration = parser.testParseExportDecl();

      // At ModuleParser level, function parsing falls back to error handling
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPORT_REQUIRES_DECLARATION);
      expect(diagnostics[0].message).toContain('Function declaration parsing not available');

      // Returns dummy declaration since function parsing not available at this level
      expect(declaration.constructor.name).toBe('VariableDecl'); // Dummy declaration
    });

    it('handles export callback function declaration (requires full Parser)', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.CALLBACK, 'callback'),
        createToken(TokenType.FUNCTION, 'function'),
        createToken(TokenType.IDENTIFIER, 'rasterIRQ'),
        createToken(TokenType.LEFT_PAREN, '('),
        createToken(TokenType.RIGHT_PAREN, ')'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.VOID, 'void'),
        createToken(TokenType.END, 'end'),
        createToken(TokenType.FUNCTION, 'function'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const declaration = parser.testParseExportDecl();

      // At ModuleParser level, function parsing falls back to error handling
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPORT_REQUIRES_DECLARATION);
      expect(diagnostics[0].message).toContain('Function declaration parsing not available');

      // Returns dummy declaration since function parsing not available at this level
      expect(declaration.constructor.name).toBe('VariableDecl'); // Dummy declaration
    });

    it('parses export variable declaration with export flag', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.IDENTIFIER, 'MAX_SPRITES'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '8'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const varDecl = parser.testParseExportDecl() as VariableDecl;
      expect(varDecl).toBeInstanceOf(VariableDecl);
      expect(varDecl.getName()).toBe('MAX_SPRITES');
      expect(varDecl.isExportedVariable()).toBe(true);
      expect(varDecl.isConst()).toBe(true);
    });

    it('parses export storage class variable declaration with export flag', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.ZP, '@zp'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'frameCounter'),
        createToken(TokenType.COLON, ':'),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.NUMBER, '0'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const varDecl = parser.testParseExportDecl() as VariableDecl;
      expect(varDecl).toBeInstanceOf(VariableDecl);
      expect(varDecl.getName()).toBe('frameCounter');
      expect(varDecl.isExportedVariable()).toBe(true);
      expect(varDecl.getStorageClass()).toBe(TokenType.ZP);
    });

    it('handles export type declaration at ModuleParser level (requires full Parser)', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.TYPE, 'type'),
        createToken(TokenType.IDENTIFIER, 'SpriteId'),
        createToken(TokenType.ASSIGN, '='),
        createToken(TokenType.BYTE, 'byte'),
        createToken(TokenType.SEMICOLON, ';'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const declaration = parser.testParseExportDecl();

      // At ModuleParser level, type parsing falls back to error handling
      // Type declarations are implemented in the full Parser class (Phase 6 complete)
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPORT_REQUIRES_DECLARATION);
      expect(diagnostics[0].message).toContain('Type declaration parsing not available');

      // Returns dummy declaration for error recovery at this parser level
      expect(declaration.constructor.name).toBe('VariableDecl');
    });

    it('handles export enum declaration at ModuleParser level (requires full Parser)', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.ENUM, 'enum'),
        createToken(TokenType.IDENTIFIER, 'GameState'),
        createToken(TokenType.LEFT_BRACE, '{'),
        createToken(TokenType.IDENTIFIER, 'MENU'),
        createToken(TokenType.RIGHT_BRACE, '}'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const declaration = parser.testParseExportDecl();

      // At ModuleParser level, enum parsing falls back to error handling
      // Enum declarations are implemented in the full Parser class (Phase 6 complete)
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPORT_REQUIRES_DECLARATION);
      expect(diagnostics[0].message).toContain('Enum declaration parsing not available');

      // Returns dummy declaration for error recovery at this parser level
      expect(declaration.constructor.name).toBe('VariableDecl');
    });

    it('handles invalid export declaration', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.IF, 'if'), // Invalid token after export
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestModuleParser(tokens);

      const declaration = parser.testParseExportDecl();

      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.UNEXPECTED_TOKEN);
      expect(diagnostics[0].message).toContain(
        'Expected function, variable, type, or enum declaration'
      );

      // Returns dummy declaration for error recovery
      expect(declaration.constructor.name).toBe('VariableDecl');
    });
  });

  describe('Import/Export Location Tracking', () => {
    it('tracks import declaration source location', () => {
      const tokens = [
        createToken(TokenType.IMPORT, 'import', 1, 1),
        createToken(TokenType.IDENTIFIER, 'func', 1, 8),
        createToken(TokenType.FROM, 'from', 1, 13),
        createToken(TokenType.IDENTIFIER, 'module', 1, 18),
        createToken(TokenType.SEMICOLON, ';', 1, 24),
        createToken(TokenType.EOF, '', 1, 25),
      ];
      parser = new TestModuleParser(tokens);

      const importDecl = parser.testParseImportDecl() as ImportDecl;
      const location = importDecl.getLocation();
      expect(location.start.line).toBe(1);
      expect(location.start.column).toBe(1);
      expect(location.end.line).toBe(1);
      expect(location.end.column).toBe(25);
    });

    it('tracks export declaration source location', () => {
      const tokens = [
        createToken(TokenType.EXPORT, 'export', 1, 1),
        createToken(TokenType.CONST, 'const', 1, 8),
        createToken(TokenType.IDENTIFIER, 'VALUE', 1, 14),
        createToken(TokenType.COLON, ':', 1, 19),
        createToken(TokenType.BYTE, 'byte', 1, 21),
        createToken(TokenType.ASSIGN, '=', 1, 26),
        createToken(TokenType.NUMBER, '42', 1, 28),
        createToken(TokenType.SEMICOLON, ';', 1, 30),
        createToken(TokenType.EOF, '', 1, 31),
      ];
      parser = new TestModuleParser(tokens);

      const varDecl = parser.testParseExportDecl() as VariableDecl;
      const location = varDecl.getLocation();
      expect(location.start.line).toBe(1);
      expect(location.start.column).toBe(8); // Should start at 'const', not 'export'
      expect(location.end.line).toBe(1);
      expect(location.end.column).toBe(31);
    });
  });
});
