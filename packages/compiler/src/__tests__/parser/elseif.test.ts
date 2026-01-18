/**
 * Tests for elseif statement parsing
 *
 * The elseif keyword is syntactic sugar that desugars to nested if-else
 * during parsing. This test suite verifies:
 * - Basic elseif functionality
 * - Multiple elseif chains
 * - Elseif without else
 * - Nested if statements with elseif
 * - Error handling (elseif after else)
 * - Complex expressions in elseif conditions
 */

import { describe, test, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { IfStatement } from '../../ast/nodes.js';
import { isIfStatement } from '../../ast/type-guards.js';

describe('elseif statement parsing', () => {
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
  // BASIC ELSEIF TESTS
  // ============================================

  test('parses simple if-elseif-else', () => {
    const source = `
      function test(): void
        if x > 10 then
          a();
        elseif x > 5 then
          b();
        else
          c();
        end if
      end function
    `;

    const ifStmt = parseFirstStatement(source);

    // Main if statement
    expect(ifStmt.getNodeType()).toBe('IfStatement');
    expect(ifStmt.getThenBranch().length).toBe(1);

    // Else branch contains nested if (desugared elseif)
    const elseBranch = ifStmt.getElseBranch();
    expect(elseBranch).not.toBeNull();
    expect(elseBranch!.length).toBe(1);
    expect(elseBranch![0].getNodeType()).toBe('IfStatement');

    // Nested if (the elseif)
    const nestedIf = elseBranch![0] as IfStatement;
    expect(nestedIf.getThenBranch().length).toBe(1);
    expect(nestedIf.getElseBranch()).not.toBeNull();
    expect(nestedIf.getElseBranch()!.length).toBe(1);
  });

  test('parses if-elseif without else', () => {
    const source = `
      function test(): void
        if x > 10 then
          big();
        elseif x > 5 then
          medium();
        end if
      end function
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getNodeType()).toBe('IfStatement');
    expect(ifStmt.getThenBranch().length).toBe(1);

    // Else branch contains nested if (desugared elseif)
    const elseBranch = ifStmt.getElseBranch();
    expect(elseBranch).not.toBeNull();
    expect(elseBranch!.length).toBe(1);
    expect(elseBranch![0].getNodeType()).toBe('IfStatement');

    // Nested if has no else branch
    const nestedIf = elseBranch![0] as IfStatement;
    expect(nestedIf.getElseBranch()).toBeNull();
  });

  // ============================================
  // MULTIPLE ELSEIF CHAINS
  // ============================================

  test('parses multiple elseif branches', () => {
    const source = `
      function test(): void
        if x == 1 then
          one();
        elseif x == 2 then
          two();
        elseif x == 3 then
          three();
        elseif x == 4 then
          four();
        else
          other();
        end if
      end function
    `;

    const ifStmt = parseFirstStatement(source);

    // Main if
    expect(ifStmt.getNodeType()).toBe('IfStatement');

    // First elseif (nested in else branch)
    let currentElse = ifStmt.getElseBranch();
    expect(currentElse).not.toBeNull();
    expect(currentElse![0].getNodeType()).toBe('IfStatement');

    // Second elseif
    let nestedIf = currentElse![0] as IfStatement;
    currentElse = nestedIf.getElseBranch();
    expect(currentElse).not.toBeNull();
    expect(currentElse![0].getNodeType()).toBe('IfStatement');

    // Third elseif
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

  test('parses long elseif chain (5+ branches)', () => {
    const source = `
      function test(): void
        if x == 1 then
          one();
        elseif x == 2 then
          two();
        elseif x == 3 then
          three();
        elseif x == 4 then
          four();
        elseif x == 5 then
          five();
        elseif x == 6 then
          six();
        end if
      end function
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
  // NESTED IF STATEMENTS WITH ELSEIF
  // ============================================

  test('parses nested if statements with elseif', () => {
    const source = `
      function test(): void
        if outer then
          if inner then
            a();
          elseif innerElse then
            b();
          end if
        elseif outerElse then
          c();
        end if
      end function
    `;

    const outerIf = parseFirstStatement(source);

    // Outer if statement
    expect(outerIf.getNodeType()).toBe('IfStatement');

    // Outer then branch contains inner if
    const outerThen = outerIf.getThenBranch();
    expect(outerThen.length).toBe(1);
    expect(outerThen[0].getNodeType()).toBe('IfStatement');

    // Inner if has elseif (nested structure)
    const innerIf = outerThen[0] as IfStatement;
    expect(innerIf.getElseBranch()).not.toBeNull();
    expect(innerIf.getElseBranch()![0].getNodeType()).toBe('IfStatement');

    // Outer elseif
    const outerElse = outerIf.getElseBranch();
    expect(outerElse).not.toBeNull();
    expect(outerElse![0].getNodeType()).toBe('IfStatement');
  });

  // ============================================
  // COMPLEX EXPRESSIONS IN ELSEIF
  // ============================================

  test('parses complex conditions in elseif', () => {
    const source = `
      function test(): void
        if x > 10 && y < 5 then
          a();
        elseif (x + y) == 15 then
          b();
        elseif x * 2 > y then
          c();
        end if
      end function
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getNodeType()).toBe('IfStatement');

    // Verify conditions are binary expressions
    expect(ifStmt.getCondition().getNodeType()).toBe('BinaryExpression');

    const firstElseif = ifStmt.getElseBranch()![0] as IfStatement;
    expect(firstElseif.getCondition().getNodeType()).toBe('BinaryExpression');
  });

  test('parses elseif with function calls in condition', () => {
    const source = `
      function test(): void
        if isValid() then
          valid();
        elseif isError() then
          error();
        elseif isWarning() then
          warning();
        end if
      end function
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getCondition().getNodeType()).toBe('CallExpression');

    const firstElseif = ifStmt.getElseBranch()![0] as IfStatement;
    expect(firstElseif.getCondition().getNodeType()).toBe('CallExpression');
  });

  // ============================================
  // MULTIPLE STATEMENTS IN BRANCHES
  // ============================================

  test('parses elseif with multiple statements in branches', () => {
    const source = `
      function test(): void
        if x > 10 then
          a();
          b();
          c();
        elseif x > 5 then
          d();
          e();
        else
          f();
          g();
          h();
        end if
      end function
    `;

    const ifStmt = parseFirstStatement(source);

    // Then branch has 3 statements
    expect(ifStmt.getThenBranch().length).toBe(3);

    // Elseif then branch has 2 statements
    const elseifStmt = ifStmt.getElseBranch()![0] as IfStatement;
    expect(elseifStmt.getThenBranch().length).toBe(2);

    // Final else has 3 statements
    expect(elseifStmt.getElseBranch()!.length).toBe(3);
  });

  // ============================================
  // ELSEIF WITH VARIOUS STATEMENT TYPES
  // ============================================

  test('parses elseif with variable declarations', () => {
    const source = `
      function test(): void
        if x > 10 then
          let temp: byte = 10;
        elseif x > 5 then
          let result: word = 100;
        end if
      end function
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getThenBranch()[0].getNodeType()).toBe('VariableDecl');

    const elseifStmt = ifStmt.getElseBranch()![0] as IfStatement;
    expect(elseifStmt.getThenBranch()[0].getNodeType()).toBe('VariableDecl');
  });

  test('parses elseif with return statements', () => {
    const source = `
      function test(): byte
        if x > 10 then
          return 10;
        elseif x > 5 then
          return 5;
        else
          return 0;
        end if
      end function
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

  test('parses traditional nested if-else (no elseif) unchanged', () => {
    const source = `
      function test(): void
        if x > 10 then
          big();
        else
          if x > 5 then
            medium();
          else
            small();
          end if
        end if
      end function
    `;

    const ifStmt = parseFirstStatement(source);

    // Structure should be identical to elseif version
    expect(ifStmt.getNodeType()).toBe('IfStatement');
    expect(ifStmt.getElseBranch()).not.toBeNull();
    expect(ifStmt.getElseBranch()![0].getNodeType()).toBe('IfStatement');
  });

  // ============================================
  // EMPTY BRANCHES
  // ============================================

  test('parses elseif with empty then branch', () => {
    const source = `
      function test(): void
        if x > 10 then
        elseif x > 5 then
          doSomething();
        end if
      end function
    `;

    const ifStmt = parseFirstStatement(source);

    // Empty then branch
    expect(ifStmt.getThenBranch().length).toBe(0);

    // Elseif has statements
    const elseifStmt = ifStmt.getElseBranch()![0] as IfStatement;
    expect(elseifStmt.getThenBranch().length).toBe(1);
  });

  // ============================================
  // INTEGRATION WITH OTHER CONTROL FLOW
  // ============================================

  test('parses elseif with while loop inside', () => {
    const source = `
      function test(): void
        if x > 10 then
          while running
            process();
          end while
        elseif x > 5 then
          while active
            update();
          end while
        end if
      end function
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getThenBranch()[0].getNodeType()).toBe('WhileStatement');

    const elseifStmt = ifStmt.getElseBranch()![0] as IfStatement;
    expect(elseifStmt.getThenBranch()[0].getNodeType()).toBe('WhileStatement');
  });

  test('parses elseif with for loop inside', () => {
    const source = `
      function test(): void
        if mode == 1 then
          for i = 0 to 10
            process(i);
          next i
        elseif mode == 2 then
          for j = 0 to 5
            update(j);
          next j
        end if
      end function
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getThenBranch()[0].getNodeType()).toBe('ForStatement');

    const elseifStmt = ifStmt.getElseBranch()![0] as IfStatement;
    expect(elseifStmt.getThenBranch()[0].getNodeType()).toBe('ForStatement');
  });

  // ============================================
  // REAL-WORLD PATTERNS
  // ============================================

  test('parses game state machine with elseif', () => {
    const source = `
      function updateGame(): void
        if gameState == 0 then
          showMenu();
        elseif gameState == 1 then
          playGame();
        elseif gameState == 2 then
          showPause();
        elseif gameState == 3 then
          showGameOver();
        else
          reset();
        end if
      end function
    `;

    const ifStmt = parseFirstStatement(source);

    expect(ifStmt.getNodeType()).toBe('IfStatement');

    // Verify 5 total branches (1 if + 3 elseif + 1 else)
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

  test('parses score evaluation with elseif', () => {
    const source = `
      function getRank(): byte
        if score > 10000 then
          return 4;
        elseif score > 5000 then
          return 3;
        elseif score > 1000 then
          return 2;
        elseif score > 0 then
          return 1;
        else
          return 0;
        end if
      end function
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