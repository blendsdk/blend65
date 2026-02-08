/**
 * Control Flow Statement Tests (v2)
 *
 * Comprehensive tests for all control flow statement parsing including:
 * - If statements (simple, if-else, nested)
 * - While statements (simple, nested, with break/continue)
 * - For statements (simple, nested, with break/continue)
 * - Switch statements (simple, with default, nested)
 * - Return, break, continue statements
 * - Deep nesting scenarios
 * - Error recovery and edge cases
 *
 * NOTE: v2 compiler - no @map support, uses peek/poke intrinsics instead
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/index.js';
import { StatementParser } from '../../parser/index.js';
import {
  IfStatement,
  WhileStatement,
  ForStatement,
  SwitchStatement,
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

  /**
   * Expose parseIfStatement for testing
   */
  public testParseIfStatement() {
    return this.parseIfStatement();
  }

  /**
   * Expose parseWhileStatement for testing
   */
  public testParseWhileStatement() {
    return this.parseWhileStatement();
  }

  /**
   * Expose parseForStatement for testing
   */
  public testParseForStatement() {
    return this.parseForStatement();
  }

  /**
   * Expose parseSwitchStatement for testing
   */
  public testParseSwitchStatement() {
    return this.parseSwitchStatement();
  }

  /**
   * Expose parseReturnStatement for testing
   */
  public testParseReturnStatement() {
    return this.parseReturnStatement();
  }

  /**
   * Expose parseBreakStatement for testing
   */
  public testParseBreakStatement() {
    return this.parseBreakStatement();
  }

  /**
   * Expose parseContinueStatement for testing
   */
  public testParseContinueStatement() {
    return this.parseContinueStatement();
  }

  /**
   * Expose parseStatement for testing
   */
  public testParseStatement() {
    return this.parseStatement();
  }
}

/**
 * Helper to parse control flow statements in isolation
 *
 * @param source - Source code to parse
 * @param method - Method name to call on the parser
 * @returns Object with parsed statement, diagnostics, and error status
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
      const source = `if (x > 0) { result; }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(IfStatement);
      const ifStmt = stmt as IfStatement;
      expect(ifStmt.getCondition()).toBeInstanceOf(BinaryExpression);
      expect(ifStmt.getThenBranch()).toHaveLength(1);
      expect(ifStmt.getElseBranch()).toBeNull();
    });

    it('parses if-else statement', () => {
      const source = `if (flag) { x; } else { y; }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(IfStatement);
      const ifStmt = stmt as IfStatement;
      expect(ifStmt.getThenBranch()).toHaveLength(1);
      expect(ifStmt.getElseBranch()).toHaveLength(1);
    });

    it('parses nested if statements', () => {
      const source = `if (a) { if (b) { result; } }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(IfStatement);
      const outerIf = stmt as IfStatement;
      expect(outerIf.getThenBranch()).toHaveLength(1);
      expect(outerIf.getThenBranch()[0]).toBeInstanceOf(IfStatement);
    });

    it('handles missing opening brace with error recovery', () => {
      const source = `if (x > 0) result; }`;

      const { stmt, hasErrors, diagnostics } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(true);
      expect(stmt).toBeInstanceOf(IfStatement);
      expect(diagnostics.some((d: any) => d.message.includes('{'))).toBe(true);
    });
  });

  // ============================================
  // WHILE STATEMENT TESTS
  // ============================================

  describe('While Statements', () => {
    it('parses simple while statement', () => {
      const source = `while (running) { x; y; }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseWhileStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(WhileStatement);
      const whileStmt = stmt as WhileStatement;
      expect(whileStmt.getCondition()).toBeInstanceOf(IdentifierExpression);
      expect(whileStmt.getBody()).toHaveLength(2);
    });

    it('parses nested while loops', () => {
      const source = `while (outer) { while (inner) { nested; } outer; }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseWhileStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(WhileStatement);
      const outerWhile = stmt as WhileStatement;
      expect(outerWhile.getBody()).toHaveLength(2);
      expect(outerWhile.getBody()[0]).toBeInstanceOf(WhileStatement);
    });

    it('parses while with break and continue', () => {
      const source = `while (true) { if (done) { break; } if (skip) { continue; } result; }`;

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
      const source = `for (i = 1 to 10) { i; }`;

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
      const source = `for (count = 10 to 0) { count; }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseForStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(ForStatement);
      const forStmt = stmt as ForStatement;
      expect(forStmt.getVariable()).toBe('count');
      expect((forStmt.getStart() as LiteralExpression).getValue()).toBe(10);
      expect((forStmt.getEnd() as LiteralExpression).getValue()).toBe(0);
    });

    it('parses nested for loops', () => {
      const source = `for (x = 0 to 5) { for (y = 0 to 3) { result; } }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseForStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(ForStatement);
      const outerFor = stmt as ForStatement;
      expect(outerFor.getVariable()).toBe('x');
      expect(outerFor.getBody()).toHaveLength(1);
      expect(outerFor.getBody()[0]).toBeInstanceOf(ForStatement);
    });
  });

  // ============================================
  // SWITCH STATEMENT TESTS
  // ============================================

  describe('Switch Statements', () => {
    it('parses simple switch statement', () => {
      const source = `switch (value) { case 1: one; case 2: two; }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseSwitchStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(SwitchStatement);
      const switchStmt = stmt as SwitchStatement;
      expect(switchStmt.getValue()).toBeInstanceOf(IdentifierExpression);
      expect(switchStmt.getCases()).toHaveLength(2);
      expect(switchStmt.getDefaultCase()).toBeNull();
    });

    it('parses switch with default case', () => {
      const source = `switch (gameState) { case 1: menu; case 2: game; default: error; }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseSwitchStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(SwitchStatement);
      const switchStmt = stmt as SwitchStatement;
      expect(switchStmt.getCases()).toHaveLength(2);
      expect(switchStmt.getDefaultCase()).toHaveLength(1);
    });

    it('parses nested switch statements', () => {
      const source = `switch (primary) { case 1: switch (sub) { case 1: nested; } case 2: other; }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseSwitchStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(SwitchStatement);
      const outerSwitch = stmt as SwitchStatement;
      expect(outerSwitch.getCases()).toHaveLength(2);

      const firstCase = outerSwitch.getCases()[0];
      expect(firstCase.body).toHaveLength(1);
      expect(firstCase.body[0]).toBeInstanceOf(SwitchStatement);
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
      const source = `if (gameActive) { while (playerAlive) { for (enemy = 1 to 3) { switch (enemyType) { case 1: basic; case 2: advanced; } } } }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(IfStatement);

      const outerIf = stmt as IfStatement;
      const whileInIf = outerIf.getThenBranch()[0] as WhileStatement;
      expect(whileInIf).toBeInstanceOf(WhileStatement);

      const forInWhile = whileInIf.getBody()[0] as ForStatement;
      expect(forInWhile).toBeInstanceOf(ForStatement);

      const switchInFor = forInWhile.getBody()[0] as SwitchStatement;
      expect(switchInFor).toBeInstanceOf(SwitchStatement);
    });
  });

  // ============================================
  // ERROR RECOVERY TESTS
  // ============================================

  describe('Error Recovery', () => {
    it('recovers from missing braces', () => {
      const source = `if (x > 0) result; }`;

      const { stmt, hasErrors, diagnostics } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(true);
      expect(stmt).toBeInstanceOf(IfStatement);
      expect(diagnostics.length).toBeGreaterThan(0);
    });

    it('recovers from invalid expressions', () => {
      const source = `if (+) { result; }`;

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
      const source = `if (true) { }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(IfStatement);
      const ifStmt = stmt as IfStatement;
      expect(ifStmt.getThenBranch()).toHaveLength(0);
    });

    it('handles complex expressions in conditions', () => {
      const source = `if ((x + y) * z > threshold) { action; }`;

      const { stmt, hasErrors } = parseControlFlow(source, 'testParseIfStatement');

      expect(hasErrors).toBe(false);
      expect(stmt).toBeInstanceOf(IfStatement);
    });
  });
});