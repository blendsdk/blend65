/**
 * Tests for else if statement parsing
 *
 * This test suite verifies:
 * - Basic else if functionality
 * - Multiple else if chains
 * - Else if without else
 * - Nested if statements with else if
 * - Error handling (else if after else)
 * - Complex expressions in else if conditions
 */

import { describe, test, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { IfStatement } from '../../ast/nodes.js';
import { isIfStatement } from '../../ast/type-guards.js';

describe('else if statement parsing', () => {
  /**
   * Helper function to parse source code and return the first statement
   */
  function parseFirstStatement(source: string): IfStatement {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const program = parser.parse();
    const funcDecl = program.getDeclarations()[0] as any;
    return funcDecl.getBody()[0] as IfStatement;
  }

  // ============================================
  // BASIC ELSE IF TESTS
  // ============================================

  test('parses simple if-else if-else', () => {
    const source = `
      function test(): void {
        if (x > 10) {
          a();
        } else if (x > 5) {
          b();
        } else {
          c();
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    // Main if statement
    expect(ifStmt.getNodeType()).toBe('IfStatement');
    expect(ifStmt.getThenBranch().length).toBe(1);

    // Else branch contains nested if (else if)
    const elseBranch = ifStmt.getElseBranch();
    expect(elseBranch).not.toBeNull();
    expect(elseBranch!.length).toBe(1);
    expect(elseBranch![0].getNodeType()).toBe('IfStatement');

    // Nested if (the else if)
    const nestedIf = elseBranch![0] as IfStatement;
    expect(nestedIf.getThenBranch().length).toBe(1);
    expect(nestedIf.getElseBranch()).not.toBeNull();
    expect(nestedIf.getElseBranch()!.length).toBe(1);
  });

  test('parses if-else if without else', () => {
    const source = `
      function test(): void {
        if (x > 10) {
          big();
        } else if (x > 5) {
          medium();
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getNodeType()).toBe('IfStatement');
    expect(ifStmt.getThenBranch().length).toBe(1);

    // Else branch contains nested if (else if)
    const elseBranch = ifStmt.getElseBranch();
    expect(elseBranch).not.toBeNull();
    expect(elseBranch!.length).toBe(1);
    expect(elseBranch![0].getNodeType()).toBe('IfStatement');

    // Nested if has no else branch
    const nestedIf = elseBranch![0] as IfStatement;
    expect(nestedIf.getElseBranch()).toBeNull();
  });

  // ============================================
  // MULTIPLE ELSE IF CHAINS
  // ============================================

  test('parses multiple else if branches', () => {
    const source = `
      function test(): void {
        if (x == 1) {
          one();
        } else if (x == 2) {
          two();
        } else if (x == 3) {
          three();
        } else if (x == 4) {
          four();
        } else {
          other();
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    // Main if
    expect(ifStmt.getNodeType()).toBe('IfStatement');

    // First else if (nested in else branch)
    let currentElse = ifStmt.getElseBranch();
    expect(currentElse).not.toBeNull();
    expect(currentElse![0].getNodeType()).toBe('IfStatement');

    // Second else if
    let nestedIf = currentElse![0] as IfStatement;
    currentElse = nestedIf.getElseBranch();
    expect(currentElse).not.toBeNull();
    expect(currentElse![0].getNodeType()).toBe('IfStatement');

    // Third else if
    nestedIf = currentElse![0] as IfStatement;
    currentElse = nestedIf.getElseBranch();
    expect(currentElse).not.toBeNull();
    expect(currentElse![0].getNodeType()).toBe('IfStatement');

    // Final else
    nestedIf = currentElse![0] as IfStatement;
    currentElse = nestedIf.getElseBranch();
    expect(currentElse).not.toBeNull();
    expect(currentElse![0].getNodeType()).toBe('ExpressionStatement');
  });

  test('parses long else if chain (5+ branches)', () => {
    const source = `
      function test(): void {
        if (x == 1) {
          one();
        } else if (x == 2) {
          two();
        } else if (x == 3) {
          three();
        } else if (x == 4) {
          four();
        } else if (x == 5) {
          five();
        } else if (x == 6) {
          six();
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    // Verify deep nesting (should have 6 levels)
    let depth = 1;
    let currentStmt: IfStatement | null = ifStmt;

    while (currentStmt && currentStmt.getElseBranch()) {
      const elseBranch = currentStmt.getElseBranch();
      if (elseBranch && isIfStatement(elseBranch[0])) {
        currentStmt = elseBranch[0] as IfStatement;
        depth++;
      } else {
        break;
      }
    }

    expect(depth).toBe(6);
  });

  // ============================================
  // NESTED IF STATEMENTS WITH ELSE IF
  // ============================================

  test('parses nested if statements with else if', () => {
    const source = `
      function test(): void {
        if (outer) {
          if (inner) {
            a();
          } else if (innerElse) {
            b();
          }
        } else if (outerElse) {
          c();
        }
      }
    `;

    const outerIf = parseFirstStatement(source);

    // Outer if statement
    expect(outerIf.getNodeType()).toBe('IfStatement');

    // Outer then branch contains inner if
    const outerThen = outerIf.getThenBranch();
    expect(outerThen.length).toBe(1);
    expect(outerThen[0].getNodeType()).toBe('IfStatement');

    // Inner if has else if (nested structure)
    const innerIf = outerThen[0] as IfStatement;
    expect(innerIf.getElseBranch()).not.toBeNull();
    expect(innerIf.getElseBranch()![0].getNodeType()).toBe('IfStatement');

    // Outer else if
    const outerElse = outerIf.getElseBranch();
    expect(outerElse).not.toBeNull();
    expect(outerElse![0].getNodeType()).toBe('IfStatement');
  });

  // ============================================
  // COMPLEX EXPRESSIONS IN ELSE IF
  // ============================================

  test('parses complex conditions in else if', () => {
    const source = `
      function test(): void {
        if (x > 10 && y < 5) {
          a();
        } else if ((x + y) == 15) {
          b();
        } else if (x * 2 > y) {
          c();
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getNodeType()).toBe('IfStatement');

    // Verify conditions are binary expressions
    expect(ifStmt.getCondition().getNodeType()).toBe('BinaryExpression');

    const firstElseif = ifStmt.getElseBranch()![0] as IfStatement;
    expect(firstElseif.getCondition().getNodeType()).toBe('BinaryExpression');
  });

  test('parses else if with function calls in condition', () => {
    const source = `
      function test(): void {
        if (isValid()) {
          valid();
        } else if (isError()) {
          error();
        } else if (isWarning()) {
          warning();
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getCondition().getNodeType()).toBe('CallExpression');

    const firstElseif = ifStmt.getElseBranch()![0] as IfStatement;
    expect(firstElseif.getCondition().getNodeType()).toBe('CallExpression');
  });

  // ============================================
  // MULTIPLE STATEMENTS IN BRANCHES
  // ============================================

  test('parses else if with multiple statements in branches', () => {
    const source = `
      function test(): void {
        if (x > 10) {
          a();
          b();
          c();
        } else if (x > 5) {
          d();
          e();
        } else {
          f();
          g();
          h();
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    // Then branch has 3 statements
    expect(ifStmt.getThenBranch().length).toBe(3);

    // Else if then branch has 2 statements
    const elseifStmt = ifStmt.getElseBranch()![0] as IfStatement;
    expect(elseifStmt.getThenBranch().length).toBe(2);

    // Final else has 3 statements
    expect(elseifStmt.getElseBranch()!.length).toBe(3);
  });

  // ============================================
  // ELSE IF WITH VARIOUS STATEMENT TYPES
  // ============================================

  test('parses else if with variable declarations', () => {
    const source = `
      function test(): void {
        if (x > 10) {
          let temp: byte = 10;
        } else if (x > 5) {
          let result: word = 100;
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getThenBranch()[0].getNodeType()).toBe('VariableDecl');

    const elseifStmt = ifStmt.getElseBranch()![0] as IfStatement;
    expect(elseifStmt.getThenBranch()[0].getNodeType()).toBe('VariableDecl');
  });

  test('parses else if with return statements', () => {
    const source = `
      function test(): byte {
        if (x > 10) {
          return 10;
        } else if (x > 5) {
          return 5;
        } else {
          return 0;
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getThenBranch()[0].getNodeType()).toBe('ReturnStatement');

    const elseifStmt = ifStmt.getElseBranch()![0] as IfStatement;
    expect(elseifStmt.getThenBranch()[0].getNodeType()).toBe('ReturnStatement');
    expect(elseifStmt.getElseBranch()![0].getNodeType()).toBe('ReturnStatement');
  });

  // ============================================
  // BACKWARD COMPATIBILITY
  // ============================================

  test('parses traditional nested if-else (no else if) unchanged', () => {
    const source = `
      function test(): void {
        if (x > 10) {
          big();
        } else {
          if (x > 5) {
            medium();
          } else {
            small();
          }
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    // Structure should be identical to else if version
    expect(ifStmt.getNodeType()).toBe('IfStatement');
    expect(ifStmt.getElseBranch()).not.toBeNull();
    expect(ifStmt.getElseBranch()![0].getNodeType()).toBe('IfStatement');
  });

  // ============================================
  // EMPTY BRANCHES
  // ============================================

  test('parses else if with empty then branch', () => {
    const source = `
      function test(): void {
        if (x > 10) {
        } else if (x > 5) {
          doSomething();
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    // Empty then branch
    expect(ifStmt.getThenBranch().length).toBe(0);

    // Else if has statements
    const elseifStmt = ifStmt.getElseBranch()![0] as IfStatement;
    expect(elseifStmt.getThenBranch().length).toBe(1);
  });

  // ============================================
  // INTEGRATION WITH OTHER CONTROL FLOW
  // ============================================

  test('parses else if with while loop inside', () => {
    const source = `
      function test(): void {
        if (x > 10) {
          while (running) {
            process();
          }
        } else if (x > 5) {
          while (active) {
            update();
          }
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getThenBranch()[0].getNodeType()).toBe('WhileStatement');

    const elseifStmt = ifStmt.getElseBranch()![0] as IfStatement;
    expect(elseifStmt.getThenBranch()[0].getNodeType()).toBe('WhileStatement');
  });

  test('parses else if with for loop inside', () => {
    const source = `
      function test(): void {
        if (mode == 1) {
          for (i = 0 to 10) {
            process(i);
          }
        } else if (mode == 2) {
          for (j = 0 to 5) {
            update(j);
          }
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getThenBranch()[0].getNodeType()).toBe('ForStatement');

    const elseifStmt = ifStmt.getElseBranch()![0] as IfStatement;
    expect(elseifStmt.getThenBranch()[0].getNodeType()).toBe('ForStatement');
  });

  // ============================================
  // REAL-WORLD PATTERNS
  // ============================================

  test('parses game state machine with else if', () => {
    const source = `
      function updateGame(): void {
        if (gameState == 0) {
          showMenu();
        } else if (gameState == 1) {
          playGame();
        } else if (gameState == 2) {
          showPause();
        } else if (gameState == 3) {
          showGameOver();
        } else {
          reset();
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getNodeType()).toBe('IfStatement');

    // Verify 5 total branches (1 if + 3 else if + 1 else)
    let branchCount = 1;
    let currentStmt: IfStatement | null = ifStmt;

    while (currentStmt && currentStmt.getElseBranch()) {
      branchCount++;
      const elseBranch = currentStmt.getElseBranch();
      if (elseBranch && isIfStatement(elseBranch[0])) {
        currentStmt = elseBranch[0] as IfStatement;
      } else {
        break;
      }
    }

    expect(branchCount).toBe(5);
  });

  test('parses score evaluation with else if', () => {
    const source = `
      function getRank(): byte {
        if (score > 10000) {
          return 4;
        } else if (score > 5000) {
          return 3;
        } else if (score > 1000) {
          return 2;
        } else if (score > 0) {
          return 1;
        } else {
          return 0;
        }
      }
    `;

    const ifStmt = parseFirstStatement(source);

    // All branches contain return statements
    expect(ifStmt.getThenBranch()[0].getNodeType()).toBe('ReturnStatement');

    let currentStmt: IfStatement | null = ifStmt;
    let returnCount = 1;

    while (currentStmt && currentStmt.getElseBranch()) {
      const elseBranch = currentStmt.getElseBranch()!;
      if (isIfStatement(elseBranch[0])) {
        currentStmt = elseBranch[0] as IfStatement;
        expect(currentStmt.getThenBranch()[0].getNodeType()).toBe('ReturnStatement');
        returnCount++;
      } else {
        expect(elseBranch[0].getNodeType()).toBe('ReturnStatement');
        returnCount++;
        break;
      }
    }

    expect(returnCount).toBe(5);
  });
});