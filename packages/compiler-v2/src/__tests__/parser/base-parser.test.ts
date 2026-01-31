/**
 * BaseParser Tests (v2)
 *
 * Tests the foundational parser infrastructure including:
 * - Token stream management
 * - Error handling and recovery
 * - Module scope validation
 * - Utility helper methods
 *
 * NOTE: v2 compiler - no @map support, no storage classes (@zp/@ram/@data)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Token, TokenType } from '../../lexer/types.js';
import { BaseParser } from '../../parser/base.js';
import { DiagnosticCode } from '../../ast/index.js';

/**
 * Concrete test implementation of BaseParser
 * Exposes protected methods for testing purposes
 */
class TestBaseParser extends BaseParser {
  /**
   * Expose getCurrentToken for testing
   */
  public testGetCurrentToken() {
    return this.getCurrentToken();
  }

  /**
   * Expose peek for testing
   */
  public testPeek(offset?: number) {
    return this.peek(offset);
  }

  /**
   * Expose advance for testing
   */
  public testAdvance() {
    return this.advance();
  }

  /**
   * Expose isAtEnd for testing
   */
  public testIsAtEnd() {
    return this.isAtEnd();
  }

  /**
   * Expose check for testing
   */
  public testCheck(...types: TokenType[]) {
    return this.check(...types);
  }

  /**
   * Expose match for testing
   */
  public testMatch(...types: TokenType[]) {
    return this.match(...types);
  }

  /**
   * Expose expect for testing
   */
  public testExpect(type: TokenType, message: string) {
    return this.expect(type, message);
  }

  /**
   * Expose reportError for testing
   */
  public testReportError(code: DiagnosticCode, message: string) {
    this.reportError(code, message);
  }

  /**
   * Expose synchronize for testing
   */
  public testSynchronize() {
    this.synchronize();
  }

  /**
   * Expose createLocation for testing
   */
  public testCreateLocation(start: Token, end: Token) {
    return this.createLocation(start, end);
  }

  /**
   * Expose mergeLocations for testing
   */
  public testMergeLocations(start: any, end: any) {
    return this.mergeLocations(start, end);
  }

  /**
   * Expose isExportModifier for testing
   */
  public testIsExportModifier() {
    return this.isExportModifier();
  }

  /**
   * Expose isLetOrConst for testing
   */
  public testIsLetOrConst() {
    return this.isLetOrConst();
  }

  /**
   * Expose parseExportModifier for testing
   */
  public testParseExportModifier() {
    return this.parseExportModifier();
  }
}

/**
 * Helper to create test tokens with source location information
 */
function createToken(type: TokenType, value: string, line = 1, column = 1): Token {
  return {
    type,
    value,
    start: { line, column, offset: column },
    end: { line, column: column + value.length, offset: column + value.length },
  };
}

describe('BaseParser', () => {
  let parser: TestBaseParser;
  let tokens: Token[];

  beforeEach(() => {
    tokens = [
      createToken(TokenType.LET, 'let', 1, 1),
      createToken(TokenType.IDENTIFIER, 'x', 1, 5),
      createToken(TokenType.ASSIGN, '=', 1, 7),
      createToken(TokenType.NUMBER, '42', 1, 9),
      createToken(TokenType.SEMICOLON, ';', 1, 11),
      createToken(TokenType.EOF, '', 1, 12),
    ];
    parser = new TestBaseParser(tokens);
  });

  describe('Token Stream Management', () => {
    it('getCurrentToken returns current token', () => {
      const token = parser.testGetCurrentToken();
      expect(token.type).toBe(TokenType.LET);
      expect(token.value).toBe('let');
    });

    it('getCurrentToken returns EOF when beyond end', () => {
      const emptyParser = new TestBaseParser([createToken(TokenType.EOF, '')]);
      emptyParser.testAdvance(); // Move beyond EOF
      const token = emptyParser.testGetCurrentToken();
      expect(token.type).toBe(TokenType.EOF);
    });

    it('peek returns future token without consuming', () => {
      const token = parser.testPeek(1);
      expect(token.type).toBe(TokenType.IDENTIFIER);
      expect(token.value).toBe('x');
      // Verify current token unchanged
      expect(parser.testGetCurrentToken().type).toBe(TokenType.LET);
    });

    it('peek returns EOF when beyond end', () => {
      const token = parser.testPeek(10);
      expect(token.type).toBe(TokenType.EOF);
    });

    it('advance moves to next token and returns previous', () => {
      const token = parser.testAdvance();
      expect(token.type).toBe(TokenType.LET);
      expect(parser.testGetCurrentToken().type).toBe(TokenType.IDENTIFIER);
    });

    it('advance stays at EOF when at end', () => {
      // Move to EOF
      while (!parser.testIsAtEnd()) {
        parser.testAdvance();
      }
      const eofToken = parser.testAdvance();
      expect(eofToken.type).toBe(TokenType.EOF);
      expect(parser.testGetCurrentToken().type).toBe(TokenType.EOF);
    });

    it('isAtEnd returns true only at EOF', () => {
      expect(parser.testIsAtEnd()).toBe(false);

      // Move to EOF
      while (parser.testGetCurrentToken().type !== TokenType.EOF) {
        parser.testAdvance();
      }

      expect(parser.testIsAtEnd()).toBe(true);
    });
  });

  describe('Token Checking & Consuming', () => {
    it('check returns true for matching types without consuming', () => {
      expect(parser.testCheck(TokenType.LET)).toBe(true);
      expect(parser.testCheck(TokenType.CONST, TokenType.LET)).toBe(true);
      expect(parser.testGetCurrentToken().type).toBe(TokenType.LET); // Not consumed
    });

    it('check returns false for non-matching types', () => {
      expect(parser.testCheck(TokenType.CONST)).toBe(false);
      expect(parser.testCheck(TokenType.IF, TokenType.WHILE)).toBe(false);
    });

    it('check returns false at EOF', () => {
      const eofParser = new TestBaseParser([createToken(TokenType.EOF, '')]);
      expect(eofParser.testCheck(TokenType.LET)).toBe(false);
    });

    it('match consumes token when matching', () => {
      expect(parser.testMatch(TokenType.LET)).toBe(true);
      expect(parser.testGetCurrentToken().type).toBe(TokenType.IDENTIFIER); // Consumed
    });

    it('match does not consume when not matching', () => {
      expect(parser.testMatch(TokenType.CONST)).toBe(false);
      expect(parser.testGetCurrentToken().type).toBe(TokenType.LET); // Not consumed
    });

    it('expect consumes matching token', () => {
      const token = parser.testExpect(TokenType.LET, 'Expected let');
      expect(token.type).toBe(TokenType.LET);
      expect(parser.testGetCurrentToken().type).toBe(TokenType.IDENTIFIER);
    });

    it('expect reports error for non-matching token', () => {
      parser.testExpect(TokenType.CONST, 'Expected const');
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPECTED_TOKEN);
      expect(diagnostics[0].message).toBe('Expected const');
    });

    it('expect returns dummy token for error recovery', () => {
      const dummyToken = parser.testExpect(TokenType.CONST, 'Expected const');

      // Verify dummy token has correct type
      expect(dummyToken.type).toBe(TokenType.CONST);

      // Verify dummy token has empty value (indicates synthetic)
      expect(dummyToken.value).toBe('');

      // Verify dummy token positioned at current location
      const currentToken = parser.testGetCurrentToken();
      expect(dummyToken.start).toEqual(currentToken.start);

      // Verify error was reported
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.EXPECTED_TOKEN);
    });

    it('expect does not advance position when creating dummy token', () => {
      const beforePosition = parser.testGetCurrentToken();
      parser.testExpect(TokenType.CONST, 'Expected const');
      const afterPosition = parser.testGetCurrentToken();

      // Position should not change when error occurs
      expect(afterPosition).toBe(beforePosition);
    });
  });

  describe('Error Handling & Recovery', () => {
    it('reportError collects diagnostic', () => {
      parser.testReportError(DiagnosticCode.UNEXPECTED_TOKEN, 'Test error');
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].code).toBe(DiagnosticCode.UNEXPECTED_TOKEN);
      expect(diagnostics[0].message).toBe('Test error');
    });

    it('synchronize skips to semicolon', () => {
      parser.testAdvance(); // Move to IDENTIFIER
      parser.testSynchronize();
      expect(parser.testGetCurrentToken().type).toBe(TokenType.EOF); // Skipped past semicolon
    });

    it('synchronize stops at statement keywords', () => {
      const tokensWithKeywords = [
        createToken(TokenType.IDENTIFIER, 'invalid'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.IDENTIFIER, 'x'),
        createToken(TokenType.EOF, ''),
      ];
      const keywordParser = new TestBaseParser(tokensWithKeywords);
      keywordParser.testSynchronize();
      expect(keywordParser.testGetCurrentToken().type).toBe(TokenType.LET);
    });
  });

  describe('Export Modifier', () => {
    beforeEach(() => {
      tokens = [
        createToken(TokenType.EXPORT, 'export'),
        createToken(TokenType.LET, 'let'),
        createToken(TokenType.CONST, 'const'),
        createToken(TokenType.EOF, ''),
      ];
      parser = new TestBaseParser(tokens);
    });

    it('isExportModifier detects export token', () => {
      expect(parser.testIsExportModifier()).toBe(true);
      parser.testAdvance();
      expect(parser.testIsExportModifier()).toBe(false);
    });

    it('isLetOrConst detects variable declaration keywords', () => {
      parser.testAdvance(); // Move past export
      expect(parser.testIsLetOrConst()).toBe(true);
      parser.testAdvance(); // Move to const
      expect(parser.testIsLetOrConst()).toBe(true);
    });

    it('parseExportModifier consumes export token', () => {
      expect(parser.testParseExportModifier()).toBe(true);
      expect(parser.testGetCurrentToken().type).toBe(TokenType.LET);
    });
  });

  describe('Location Utilities', () => {
    it('createLocation creates proper SourceLocation', () => {
      const startToken = createToken(TokenType.LET, 'let', 1, 1);
      const endToken = createToken(TokenType.SEMICOLON, ';', 1, 10);
      const location = parser.testCreateLocation(startToken, endToken);

      expect(location.start.line).toBe(1);
      expect(location.start.column).toBe(1);
      expect(location.end.line).toBe(1);
      expect(location.end.column).toBe(11);
    });

    it('mergeLocations combines two locations', () => {
      const startLoc = {
        start: { line: 1, column: 1, offset: 1 },
        end: { line: 1, column: 5, offset: 5 },
      };
      const endLoc = {
        start: { line: 1, column: 7, offset: 7 },
        end: { line: 1, column: 10, offset: 10 },
      };
      const merged = parser.testMergeLocations(startLoc, endLoc);

      expect(merged.start.line).toBe(1);
      expect(merged.start.column).toBe(1);
      expect(merged.end.line).toBe(1);
      expect(merged.end.column).toBe(10);
    });
  });

  describe('Public API', () => {
    it('getDiagnostics returns empty array initially', () => {
      const diagnostics = parser.getDiagnostics();
      expect(diagnostics).toEqual([]);
    });

    it('hasErrors returns false initially', () => {
      expect(parser.hasErrors()).toBe(false);
    });

    it('hasErrors returns true after error', () => {
      parser.testReportError(DiagnosticCode.UNEXPECTED_TOKEN, 'Test error');
      expect(parser.hasErrors()).toBe(true);
    });

    it('getDiagnosticCounts returns correct counts', () => {
      parser.testReportError(DiagnosticCode.UNEXPECTED_TOKEN, 'Error 1');
      parser.testReportError(DiagnosticCode.EXPECTED_TOKEN, 'Error 2');

      const counts = parser.getDiagnosticCounts();
      expect(counts.errors).toBe(2);
      expect(counts.warnings).toBe(0);
    });
  });
});