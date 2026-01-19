/**
 * Control Flow Statement Tests
 *
 * Comprehensive tests for all control flow statement parsing including:
 * - If statements (simple, if-else, nested)
 * - While statements (simple, nested, with break/continue)
 * - For statements (simple, nested, with break/continue)
 * - Match statements (simple, with default, nested)
 * - Return, break, continue statements
 * - Deep nesting scenarios
 * - Error recovery and edge cases
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/index.js';
import { StatementParser } from '../../parser/index.js';
import {
  IfStatement,
  WhileStatement,
  ForStatement,
  MatchStatement,
  ReturnStatement,
  BreakStatement,
  LiteralExpression,
  IdentifierExpression,
  BinaryExpression,
} from '../../ast/index.js';

/**
 * Test parser that extends StatementParser for control flow testing
 */
class TestControlFlowParser extends StatementParser {
  constructor(tokens: any[]) {
    super(tokens);
    // Override module scope for testing control flow statements
    this.isModuleScope = false;
  }

  // Expose protected methods for testing
  public testParseIfStatement() {
    return this.parseIfStatement();
  }

  public testParseWhileStatement() {
    return this.parseWhileStatement();
  }

  public testParseForStatement() {
    return this.parseForStatement();
  }

  public testParseMatchStatement() {
    return this.parseMatchStatement();
  }

  public testParseReturnStatement() {
    return this.parseReturnStatement();
  }

  public testParseBreakStatement() {
    return this.parseBreakStatement();
  }

  public testParseContinueStatement() {
    return this.parseContinueStatement();
  }

  public testParseStatement() {
    return this.parseStatement();
  }
}

/**
 * Helper to parse control flow statements in isolation
 */
function parseControlFlow(source: string, method: keyof TestControlFlowParser) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new TestControlFlowParser(tokens);

  try {
    const stmt = (parser as any)[method]();
    return {
      stmt,
      diagnostics: parser.getDiagnostics(),
      hasErrors: parser.hasErrors(),
    };
  } catch (error) {
    return {
      stmt: null,
      diagnostics: parser.getDiagnostics(),
      hasErrors: true,
      error,
    };
  }
}

describe('Control Flow Statement Parser - Phase 2', () => {
  // ============================================
  // IF STATEMENT TESTS
  // ============================================

  describe('If Statements', () => {
    it('parses simple if statement', () => {
      const source = `if x > 0 then result; end if`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(IfStatement);
      const ifStmt = stmt as IfStatement;
      expect(ifStmt.getCondition()).toBeInstanceOf(BinaryExpression);
      expect(ifStmt.getThenBranch()).toHaveLength(1);
      expect(ifStmt.getElseBranch()).toBeNull();
    });

    it('parses if-else statement', () => {
      const source = `if flag then x; else y; end if`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(IfStatement);
      const ifStmt = stmt as IfStatement;
      expect(ifStmt.getThenBranch()).toHaveLength(1);
      expect(ifStmt.getElseBranch()).toHaveLength(1);
    });

    it('parses nested if statements', () => {
      const source = `if a then if b then result; end if end if`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(IfStatement);
      const outerIf = stmt as IfStatement;
      expect(outerIf.getThenBranch()).toHaveLength(1);
      expect(outerIf.getThenBranch()[0]).toBeInstanceOf(IfStatement);
    });

    it('handles missing then keyword with error recovery', () => {
      const source = `if x > 0 result; end if`;

      const { stmt, hasErrors, diagnostics } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(true);
      expect(stmt).toBeInstanceOf(IfStatement);
      expect(diagnostics.some((d: any) => d.message.includes('then'))).toBe(true);
    });
  });

  // ============================================
  // WHILE STATEMENT TESTS
  // ============================================

  describe('While Statements', () => {
    it('parses simple while statement', () => {
      const source = `while running x; y; end while`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseWhileStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(WhileStatement);
      const whileStmt = stmt as WhileStatement;
      expect(whileStmt.getCondition()).toBeInstanceOf(IdentifierExpression);
      expect(whileStmt.getBody()).toHaveLength(2);
    });

    it('parses nested while loops', () => {
      const source = `while outer while inner nested; end while outer; end while`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseWhileStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(WhileStatement);
      const outerWhile = stmt as WhileStatement;
      expect(outerWhile.getBody()).toHaveLength(2);
      expect(outerWhile.getBody()[0]).toBeInstanceOf(WhileStatement);
    });

    it('parses while with break and continue', () => {
      const source = `while true if done then break; end if if skip then continue; end if result; end while`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseWhileStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(WhileStatement);
      const whileStmt = stmt as WhileStatement;
      expect(whileStmt.getBody()).toHaveLength(3);

      const firstIf = whileStmt.getBody()[0] as IfStatement;
      expect(firstIf.getThenBranch()[0]).toBeInstanceOf(BreakStatement);
    });
  });

  // ============================================
  // FOR STATEMENT TESTS
  // ============================================

  describe('For Statements', () => {
    it('parses simple for statement', () => {
      const source = `for i = 1 to 10 i; next i`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseForStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(ForStatement);
      const forStmt = stmt as ForStatement;
      expect(forStmt.getVariable()).toBe('i');
      expect(forStmt.getStart()).toBeInstanceOf(LiteralExpression);
      expect(forStmt.getEnd()).toBeInstanceOf(LiteralExpression);
      expect(forStmt.getBody()).toHaveLength(1);
    });

    it('parses countdown for loop', () => {
      const source = `for count = 10 to 0 count; next count`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseForStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(ForStatement);
      const forStmt = stmt as ForStatement;
      expect(forStmt.getVariable()).toBe('count');
      expect((forStmt.getStart() as LiteralExpression).getValue()).toBe(10);
      expect((forStmt.getEnd() as LiteralExpression).getValue()).toBe(0);
    });

    it('parses nested for loops', () => {
      const source = `for x = 0 to 5 for y = 0 to 3 result; next y next x`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseForStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(ForStatement);
      const outerFor = stmt as ForStatement;
      expect(outerFor.getVariable()).toBe('x');
      expect(outerFor.getBody()).toHaveLength(1);
      expect(outerFor.getBody()[0]).toBeInstanceOf(ForStatement);
    });

    it('validates variable name matching', () => {
      const source = `for counter = 1 to 10 counter; next wrongName`;

      const { hasErrors, diagnostics } = parseControlFlow(source, 'testParseForStatement');

      expect(hasErrors).toBe(true);
      expect(diagnostics.some((d: any) => d.message.includes('Expected loop variable'))).toBe(true);
    });
  });

  // ============================================
  // MATCH STATEMENT TESTS
  // ============================================

  describe('Match Statements', () => {
    it('parses simple match statement', () => {
      const source = `match value case 1: one; case 2: two; end match`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseMatchStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(MatchStatement);
      const matchStmt = stmt as MatchStatement;
      expect(matchStmt.getValue()).toBeInstanceOf(IdentifierExpression);
      expect(matchStmt.getCases()).toHaveLength(2);
      expect(matchStmt.getDefaultCase()).toBeNull();
    });

    it('parses match with default case', () => {
      const source = `match gameState case 1: menu; case 2: game; default: error; end match`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseMatchStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(MatchStatement);
      const matchStmt = stmt as MatchStatement;
      expect(matchStmt.getCases()).toHaveLength(2);
      expect(matchStmt.getDefaultCase()).toHaveLength(1);
    });

    it('parses nested match statements', () => {
      const source = `match primary case 1: match sub case 1: nested; end match case 2: other; end match`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseMatchStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(MatchStatement);
      const outerMatch = stmt as MatchStatement;
      expect(outerMatch.getCases()).toHaveLength(2);

      const firstCase = outerMatch.getCases()[0];
      expect(firstCase.body).toHaveLength(1);
      expect(firstCase.body[0]).toBeInstanceOf(MatchStatement);
    });
  });

  // ============================================
  // RETURN, BREAK, CONTINUE TESTS
  // ============================================

  describe('Return, Break, Continue Statements', () => {
    it('parses void return statement', () => {
      const source = `return;`;

      const { stmt, hasErrors, diagnostics } = parseControlFlow(source, 'testParseReturnStatement');

      // Return statement outside function now reports error (Task 3.3 validation)
      expect(hasErrors).toBe(true);
      expect(diagnostics.some((d: any) => d.message.includes('outside'))).toBe(true);
      expect(stmt).toBeInstanceOf(ReturnStatement);
      const returnStmt = stmt as ReturnStatement;
      expect(returnStmt.getValue()).toBeNull();
    });

    it('parses value return statement', () => {
      const source = `return 42;`;

      const { stmt, hasErrors, diagnostics } = parseControlFlow(source, 'testParseReturnStatement');

      // Return statement outside function now reports error (Task 3.3 validation)
      expect(hasErrors).toBe(true);
      expect(diagnostics.some((d: any) => d.message.includes('outside'))).toBe(true);
      expect(stmt).toBeInstanceOf(ReturnStatement);
      const returnStmt = stmt as ReturnStatement;
      expect(returnStmt.getValue()).not.toBeNull();
    });

    it('parses expression return statement', () => {
      const source = `return x + y;`;

      const { stmt, hasErrors, diagnostics } = parseControlFlow(source, 'testParseReturnStatement');

      // Return statement outside function now reports error (Task 3.3 validation)
      expect(hasErrors).toBe(true);
      expect(diagnostics.some((d: any) => d.message.includes('outside'))).toBe(true);
      expect(stmt).toBeInstanceOf(ReturnStatement);
      const returnStmt = stmt as ReturnStatement;
      expect(returnStmt.getValue()).toBeInstanceOf(BinaryExpression);
    });

    it('validates break outside loops', () => {
      const source = `break;`;

      const { hasErrors, diagnostics } = parseControlFlow(source, 'testParseBreakStatement');

      expect(hasErrors).toBe(true);
      expect(diagnostics.some((d: any) => d.message.includes('loop'))).toBe(true);
    });

    it('validates continue outside loops', () => {
      const source = `continue;`;

      const { hasErrors, diagnostics } = parseControlFlow(source, 'testParseContinueStatement');

      expect(hasErrors).toBe(true);
      expect(diagnostics.some((d: any) => d.message.includes('loop'))).toBe(true);
    });
  });

  // ============================================
  // COMPLEX NESTING SCENARIOS
  // ============================================

  describe('Complex Nesting Scenarios', () => {
    it('parses deeply nested control flow', () => {
      const source = `if gameActive then while playerAlive for enemy = 1 to 3 match enemyType case 1: basic; case 2: advanced; end match next enemy end while end if`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(IfStatement);

      const outerIf = stmt as IfStatement;
      const whileInIf = outerIf.getThenBranch()[0] as WhileStatement;
      expect(whileInIf).toBeInstanceOf(WhileStatement);

      const forInWhile = whileInIf.getBody()[0] as ForStatement;
      expect(forInWhile).toBeInstanceOf(ForStatement);

      const matchInFor = forInWhile.getBody()[0] as MatchStatement;
      expect(matchInFor).toBeInstanceOf(MatchStatement);
    });
  });

  // ============================================
  // ERROR RECOVERY TESTS
  // ============================================

  describe('Error Recovery', () => {
    it('recovers from missing keywords', () => {
      const source = `if x > 0 result; end if`;

      const { stmt, hasErrors, diagnostics } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(true);
      expect(stmt).toBeInstanceOf(IfStatement);
      expect(diagnostics.length).toBeGreaterThan(0);
    });

    it('recovers from invalid expressions', () => {
      const source = `if + then result; end if`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(true);
      expect(stmt).toBeInstanceOf(IfStatement);
      // Should have errors but still continue parsing
      expect(hasErrors).toBe(true);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    it('parses empty control flow bodies', () => {
      const source = `if true then end if`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(IfStatement);
      const ifStmt = stmt as IfStatement;
      expect(ifStmt.getThenBranch()).toHaveLength(0);
    });

    it('handles complex expressions in conditions', () => {
      const source = `if (x + y) * z > threshold then action; end if`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(IfStatement);
    });
  });
});
