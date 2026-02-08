/**
 * Simple Programs E2E Tests for Blend65 Compiler v2
 *
 * Tests simple, straightforward programs through the full semantic analysis:
 * - Simple variable declarations and usage
 * - Simple function declarations and calls
 * - Simple expressions and operations
 *
 * These tests verify that basic programs analyze correctly without errors.
 */

import { describe, it, expect } from 'vitest';
import { SemanticAnalyzer, type AnalysisResult } from '../../../semantic/index.js';
import { Parser } from '../../../parser/index.js';
import { Lexer } from '../../../lexer/index.js';
import type { Program } from '../../../ast/index.js';

/**
 * Helper to parse a Blend65 source string and return the Program AST
 */
function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Helper to run full semantic analysis on source code
 */
function analyze(source: string, options?: { runAdvancedAnalysis?: boolean }): AnalysisResult {
  const program = parse(source);
  const analyzer = new SemanticAnalyzer(options);
  return analyzer.analyze(program);
}

describe('Simple Programs E2E', () => {
  // ============================================================================
  // Section 5.21.1: Simple Variable Programs
  // ============================================================================
  describe('simple variable programs', () => {
    describe('byte variables', () => {
      it('should analyze single byte variable with literal', () => {
        const result = analyze(`
          module Test
          let x: byte = 42;
        `);

        expect(result.success).toBe(true);
        // Note: May have unused variable warnings - that's OK
        expect(result.stats.errorCount).toBe(0);
        expect(result.stats.totalDeclarations).toBeGreaterThanOrEqual(1);
      });

      it('should analyze multiple byte variables', () => {
        const result = analyze(`
          module Test
          let a: byte = 1;
          let b: byte = 2;
          let c: byte = 3;
        `);

        expect(result.success).toBe(true);
        // May have unused variable warnings - that's OK
        expect(result.stats.errorCount).toBe(0);
      });

      it('should analyze byte variable with hex literal', () => {
        const result = analyze(`
          module Test;
          let color: byte = $0F;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze byte variable with binary literal', () => {
        const result = analyze(`
          module Test;
          let mask: byte = %10101010;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze byte variable initialized from another variable', () => {
        const result = analyze(`
          module Test;
          let x: byte = 10;
          let y: byte = x;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze byte variable with expression initializer', () => {
        const result = analyze(`
          module Test;
          let a: byte = 5;
          let b: byte = a + 10;
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('word variables', () => {
      it('should analyze single word variable with literal', () => {
        const result = analyze(`
          module Test;
          let addr: word = 1024;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze word variable with hex literal', () => {
        const result = analyze(`
          module Test;
          let screenAddr: word = $0400;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze word variable with large value', () => {
        const result = analyze(`
          module Test;
          let memTop: word = 40960;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze multiple word variables', () => {
        const result = analyze(`
          module Test;
          let start: word = $0400;
          let end: word = $07FF;
          let len: word = end - start;
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('bool variables', () => {
      it('should analyze bool variable with true literal', () => {
        const result = analyze(`
          module Test;
          let flag: bool = true;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze bool variable with false literal', () => {
        const result = analyze(`
          module Test;
          let done: bool = false;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze bool variable with comparison expression', () => {
        const result = analyze(`
          module Test;
          let x: byte = 10;
          let isPositive: bool = x > 0;
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('array variables', () => {
      it('should analyze byte array with literal initializer', () => {
        const result = analyze(`
          module Test;
          let data: byte[5] = [1, 2, 3, 4, 5];
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze word array with literal initializer', () => {
        const result = analyze(`
          module Test;
          let addresses: word[3] = [$0400, $0800, $0C00];
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze array access', () => {
        const result = analyze(`
          module Test;
          let data: byte[5] = [1, 2, 3, 4, 5];
          let first: byte = data[0];
          let last: byte = data[4];
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze array access with variable index', () => {
        const result = analyze(`
          module Test;
          let data: byte[10] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
          let i: byte = 3;
          let value: byte = data[i];
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('constant variables', () => {
      it('should analyze const byte', () => {
        const result = analyze(`
          module Test;
          const MAX_VALUE: byte = 255;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze const word', () => {
        const result = analyze(`
          module Test;
          const SCREEN_WIDTH: word = 320;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze const with hex value', () => {
        const result = analyze(`
          module Test;
          const VIC_BASE: word = $D000;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze const used in expression', () => {
        const result = analyze(`
          module Test;
          const BASE: word = $0400;
          let offset: word = 100;
          let addr: word = BASE + offset;
        `);

        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================================================
  // Section 5.21.2: Simple Function Programs
  // ============================================================================
  describe('simple function programs', () => {
    describe('void functions', () => {
      it('should analyze empty void function', () => {
        const result = analyze(`
          module Test;
          function doNothing(): void {}
        `);

        expect(result.success).toBe(true);
        expect(result.stats.functionsAnalyzed).toBeGreaterThanOrEqual(1);
      });

      it('should analyze void function with local variable', () => {
        const result = analyze(`
          module Test;
          function setup(): void {
            let x: byte = 0;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze void function with global variable access', () => {
        const result = analyze(`
          module Test;
          let counter: byte = 0;

          function increment(): void {
            counter = counter + 1;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze void function with explicit return', () => {
        const result = analyze(`
          module Test;
          function earlyReturn(x: byte): void {
            if (x == 0) {
              return;
            }
            // Do something
          }
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('functions returning byte', () => {
      it('should analyze function returning literal', () => {
        const result = analyze(`
          module Test;
          function getZero(): byte {
            return 0;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze function returning parameter', () => {
        const result = analyze(`
          module Test;
          function identity(x: byte): byte {
            return x;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze function returning expression', () => {
        const result = analyze(`
          module Test;
          function add(a: byte, b: byte): byte {
            return a + b;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze function with local computation', () => {
        const result = analyze(`
          module Test;
          function compute(x: byte): byte {
            let temp: byte = x * 2;
            let result: byte = temp + 1;
            return result;
          }
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('functions returning word', () => {
      it('should analyze function returning word literal', () => {
        const result = analyze(`
          module Test;
          function getBaseAddr(): word {
            return $0400;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze function computing word result', () => {
        const result = analyze(`
          module Test;
          function calcOffset(row: byte, col: byte): word {
            let rowOffset: word = row * 40;
            let result: word = rowOffset + col;
            return result;
          }
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('functions returning bool', () => {
      it('should analyze function returning true', () => {
        const result = analyze(`
          module Test;
          function isReady(): bool {
            return true;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze function returning comparison', () => {
        const result = analyze(`
          module Test;
          function isZero(x: byte): bool {
            return x == 0;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze function with boolean logic', () => {
        const result = analyze(`
          module Test;
          function inRange(x: byte, min: byte, max: byte): bool {
            return x >= min && x <= max;
          }
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('function calls', () => {
      it('should analyze calling void function', () => {
        const result = analyze(`
          module Test;
          function doWork(): void {}

          function main(): void {
            doWork();
          }
        `);

        expect(result.success).toBe(true);
        expect(result.callGraph.getCallees('main')).toContain('doWork');
      });

      it('should analyze calling function with arguments', () => {
        const result = analyze(`
          module Test;
          function add(a: byte, b: byte): byte {
            return a + b;
          }

          function main(): void {
            let sum: byte = add(5, 10);
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze chained function calls', () => {
        const result = analyze(`
          module Test;
          function double(x: byte): byte {
            return x * 2;
          }

          function main(): void {
            let x: byte = double(double(5));
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze multiple function calls', () => {
        const result = analyze(`
          module Test;
          function getX(): byte { return 10; }
          function getY(): byte { return 20; }
          function add(a: byte, b: byte): byte { return a + b; }

          function main(): void {
            let result: byte = add(getX(), getY());
          }
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('functions with multiple parameters', () => {
      it('should analyze function with two parameters', () => {
        const result = analyze(`
          module Test;
          function max(a: byte, b: byte): byte {
            if (a > b) {
              return a;
            }
            return b;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze function with three parameters', () => {
        const result = analyze(`
          module Test;
          function clamp(value: byte, min: byte, max: byte): byte {
            if (value < min) {
              return min;
            }
            if (value > max) {
              return max;
            }
            return value;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze function with mixed type parameters', () => {
        const result = analyze(`
          module Test;
          function memSet(addr: word, value: byte, count: byte): void {
            let i: byte = 0;
            while (i < count) {
              i = i + 1;
            }
          }
        `);

        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================================================
  // Section 5.21.3: Simple Expression Programs
  // ============================================================================
  describe('simple expression programs', () => {
    describe('arithmetic expressions', () => {
      it('should analyze addition', () => {
        const result = analyze(`
          module Test;
          let a: byte = 5;
          let b: byte = 10;
          let sum: byte = a + b;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze subtraction', () => {
        const result = analyze(`
          module Test;
          let a: byte = 20;
          let b: byte = 5;
          let diff: byte = a - b;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze multiplication', () => {
        const result = analyze(`
          module Test;
          let a: byte = 5;
          let b: byte = 4;
          let product: byte = a * b;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze division', () => {
        const result = analyze(`
          module Test;
          let a: byte = 20;
          let b: byte = 4;
          let quotient: byte = a / b;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze modulo', () => {
        const result = analyze(`
          module Test;
          let a: byte = 17;
          let b: byte = 5;
          let remainder: byte = a % b;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze complex arithmetic', () => {
        const result = analyze(`
          module Test;
          let a: byte = 5;
          let b: byte = 3;
          let c: byte = 2;
          let result: byte = (a + b) * c - 1;
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('comparison expressions', () => {
      it('should analyze equality', () => {
        const result = analyze(`
          module Test;
          let a: byte = 5;
          let b: byte = 5;
          let equal: bool = a == b;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze inequality', () => {
        const result = analyze(`
          module Test;
          let a: byte = 5;
          let b: byte = 10;
          let notEqual: bool = a != b;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze less than', () => {
        const result = analyze(`
          module Test;
          let x: byte = 5;
          let isSmall: bool = x < 10;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze greater than', () => {
        const result = analyze(`
          module Test;
          let x: byte = 15;
          let isBig: bool = x > 10;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze less than or equal', () => {
        const result = analyze(`
          module Test;
          let x: byte = 10;
          let valid: bool = x <= 10;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze greater than or equal', () => {
        const result = analyze(`
          module Test;
          let x: byte = 10;
          let valid: bool = x >= 10;
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('logical expressions', () => {
      it('should analyze logical AND', () => {
        const result = analyze(`
          module Test;
          let a: bool = true;
          let b: bool = false;
          let both: bool = a && b;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze logical OR', () => {
        const result = analyze(`
          module Test;
          let a: bool = true;
          let b: bool = false;
          let either: bool = a || b;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze logical NOT', () => {
        const result = analyze(`
          module Test;
          let a: bool = true;
          let notA: bool = !a;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze complex logical expression', () => {
        const result = analyze(`
          module Test;
          let x: byte = 5;
          let y: byte = 10;
          let valid: bool = (x > 0 && x < 10) || (y >= 10);
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('bitwise expressions', () => {
      it('should analyze bitwise AND', () => {
        const result = analyze(`
          module Test;
          let a: byte = $FF;
          let b: byte = $0F;
          let result: byte = a & b;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze bitwise OR', () => {
        const result = analyze(`
          module Test;
          let a: byte = $F0;
          let b: byte = $0F;
          let result: byte = a | b;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze bitwise XOR', () => {
        const result = analyze(`
          module Test;
          let a: byte = $FF;
          let b: byte = $AA;
          let result: byte = a ^ b;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze bitwise NOT', () => {
        const result = analyze(`
          module Test;
          let a: byte = $0F;
          let result: byte = ~a;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze left shift', () => {
        const result = analyze(`
          module Test;
          let a: byte = 1;
          let result: byte = a << 4;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze right shift', () => {
        const result = analyze(`
          module Test;
          let a: byte = $F0;
          let result: byte = a >> 4;
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('unary expressions', () => {
      it('should analyze unary minus', () => {
        const result = analyze(`
          module Test;
          let a: byte = 5;
          let neg: byte = -a;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze unary plus', () => {
        const result = analyze(`
          module Test;
          let a: byte = 5;
          let pos: byte = +a;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze address-of operator', () => {
        const result = analyze(`
          module Test;
          let x: byte = 10;
          let addr: word = @x;
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('ternary expressions', () => {
      it('should analyze simple ternary', () => {
        const result = analyze(`
          module Test;
          let condition: bool = true;
          let result: byte = condition ? 1 : 0;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze ternary with comparison', () => {
        const result = analyze(`
          module Test;
          let x: byte = 10;
          let absX: byte = x < 0 ? -x : x;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze nested ternary', () => {
        const result = analyze(`
          module Test;
          let x: byte = 5;
          let category: byte = x < 0 ? 0 : x > 10 ? 2 : 1;
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('assignment expressions', () => {
      it('should analyze simple assignment', () => {
        const result = analyze(`
          module Test;
          function test(): void {
            let x: byte = 0;
            x = 10;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze compound assignment (add)', () => {
        const result = analyze(`
          module Test;
          function test(): void {
            let x: byte = 5;
            x = x + 3;
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze array element assignment', () => {
        const result = analyze(`
          module Test;
          function test(): void {
            let data: byte[5] = [0, 0, 0, 0, 0];
            data[2] = 42;
          }
        `);

        expect(result.success).toBe(true);
      });
    });

    describe('mixed expressions', () => {
      it('should analyze arithmetic with comparison', () => {
        const result = analyze(`
          module Test;
          let a: byte = 5;
          let b: byte = 3;
          let isGreater: bool = (a + b) > 7;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze bitwise with comparison', () => {
        const result = analyze(`
          module Test;
          let flags: byte = $0F;
          let hasBit: bool = (flags & $04) != 0;
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze function call in expression', () => {
        const result = analyze(`
          module Test;
          function getMax(): byte { return 100; }

          function test(): void {
            let x: byte = 50;
            let valid: bool = x < getMax();
          }
        `);

        expect(result.success).toBe(true);
      });

      it('should analyze array access in expression', () => {
        const result = analyze(`
          module Test;
          let data: byte[3] = [10, 20, 30];
          let sum: byte = data[0] + data[1] + data[2];
        `);

        expect(result.success).toBe(true);
      });
    });
  });
});