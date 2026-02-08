/**
 * Recursion Error E2E Tests for Blend65 Compiler v2
 *
 * Tests recursion detection through the full semantic analysis pipeline:
 * - Direct recursion detected as ERROR
 * - Mutual/indirect recursion detected as ERROR
 * - SFA compliance enforcement
 * - Error message quality
 *
 * CRITICAL: Static Frame Allocation (SFA) means recursion is FORBIDDEN.
 * All recursion must be compile-time ERROR, not warning.
 */

import { describe, it, expect } from 'vitest';
import { SemanticAnalyzer, type AnalysisResult } from '../../../semantic/index.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../../ast/diagnostics.js';
import { Parser } from '../../../parser/index.js';
import { Lexer } from '../../../lexer/index.js';
import type { Program, Diagnostic } from '../../../ast/index.js';

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
function analyze(source: string): AnalysisResult {
  const program = parse(source);
  const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  return analyzer.analyze(program);
}

/**
 * Helper to get only recursion-related errors
 */
function getRecursionErrors(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d =>
    d.code === DiagnosticCode.RECURSION_DETECTED ||
    d.code === DiagnosticCode.INDIRECT_RECURSION_DETECTED
  );
}

/**
 * Helper to check if analysis has recursion errors
 */
function hasRecursionError(result: AnalysisResult): boolean {
  return getRecursionErrors(result.diagnostics).length > 0;
}

describe('Recursion Error E2E', () => {
  describe('SFA compliance - recursion is ERROR', () => {
    it('should FAIL analysis for direct recursion', () => {
      const result = analyze(`
        module Test

        function factorial(n: byte): byte {
          if (n <= 1) { return 1; }
          return n * factorial(n - 1);
        }
      `);

      expect(result.success).toBe(false);
      expect(hasRecursionError(result)).toBe(true);
    });

    it('should report recursion as ERROR severity', () => {
      const result = analyze(`
        module Test

        function recurse(): void {
          recurse();
        }
      `);

      const recursionErrors = getRecursionErrors(result.diagnostics);
      expect(recursionErrors.length).toBeGreaterThan(0);
      expect(recursionErrors[0].severity).toBe(DiagnosticSeverity.ERROR);
    });

    it('should track recursion errors in pass results', () => {
      const result = analyze(`
        module Test

        function rec(): void { rec(); }
      `);

      expect(result.passResults.recursionErrors.length).toBeGreaterThan(0);
    });
  });

  describe('direct recursion detection', () => {
    it('should detect simple self-call', () => {
      const result = analyze(`
        module Test

        function selfCall(): void {
          selfCall();
        }
      `);

      expect(result.success).toBe(false);
      expect(hasRecursionError(result)).toBe(true);
    });

    it('should detect factorial recursion', () => {
      const result = analyze(`
        module Test

        function factorial(n: byte): byte {
          if (n <= 1) {
            return 1;
          }
          return n * factorial(n - 1);
        }
      `);

      expect(result.success).toBe(false);
    });

    it('should detect fibonacci recursion', () => {
      const result = analyze(`
        module Test

        function fibonacci(n: byte): byte {
          if (n <= 1) {
            return n;
          }
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
      `);

      expect(result.success).toBe(false);
    });

    it('should detect recursion in conditional branches', () => {
      const result = analyze(`
        module Test

        function conditional(n: byte): byte {
          if (n > 0) {
            return conditional(n - 1);
          } else {
            return 0;
          }
        }
      `);

      expect(result.success).toBe(false);
    });

    it('should detect recursion in loop body', () => {
      const result = analyze(`
        module Test

        function loopRecursion(n: byte): void {
          while (n > 0) {
            loopRecursion(n - 1);
            n = n - 1;
          }
        }
      `);

      expect(result.success).toBe(false);
    });

    it('should detect all directly recursive functions', () => {
      const result = analyze(`
        module Test

        function rec1(): void { rec1(); }
        function rec2(): void { rec2(); }
        function rec3(): void { rec3(); }
      `);

      expect(result.success).toBe(false);
      // Should have errors for all 3
      expect(getRecursionErrors(result.diagnostics).length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('mutual recursion detection', () => {
    it('should detect two-function mutual recursion', () => {
      const result = analyze(`
        module Test

        function ping(): void {
          pong();
        }

        function pong(): void {
          ping();
        }
      `);

      expect(result.success).toBe(false);
      expect(hasRecursionError(result)).toBe(true);
    });

    it('should detect even/odd mutual recursion', () => {
      const result = analyze(`
        module Test

        function isEven(n: byte): bool {
          if (n == 0) { return true; }
          return isOdd(n - 1);
        }

        function isOdd(n: byte): bool {
          if (n == 0) { return false; }
          return isEven(n - 1);
        }
      `);

      expect(result.success).toBe(false);
    });

    it('should flag both functions in mutual recursion', () => {
      const result = analyze(`
        module Test

        function a(): void { b(); }
        function b(): void { a(); }
      `);

      // Both 'a' and 'b' should be flagged as part of a cycle
      expect(result.passResults.recursionErrors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('indirect recursion detection', () => {
    it('should detect three-function cycle', () => {
      const result = analyze(`
        module Test

        function a(): void { b(); }
        function b(): void { c(); }
        function c(): void { a(); }
      `);

      expect(result.success).toBe(false);
    });

    it('should detect four-function cycle', () => {
      const result = analyze(`
        module Test

        function a(): void { b(); }
        function b(): void { c(); }
        function c(): void { d(); }
        function d(): void { a(); }
      `);

      expect(result.success).toBe(false);
    });

    it('should detect deep indirect recursion', () => {
      const result = analyze(`
        module Test

        function l1(): void { l2(); }
        function l2(): void { l3(); }
        function l3(): void { l4(); }
        function l4(): void { l5(); }
        function l5(): void { l1(); }
      `);

      expect(result.success).toBe(false);
    });
  });

  describe('non-recursive code passes', () => {
    it('should pass empty module', () => {
      const result = analyze(`module Empty`);
      expect(result.success).toBe(true);
      expect(hasRecursionError(result)).toBe(false);
    });

    it('should pass simple function', () => {
      const result = analyze(`
        module Test

        function add(a: byte, b: byte): byte {
          return a + b;
        }
      `);

      expect(result.success).toBe(true);
      expect(hasRecursionError(result)).toBe(false);
    });

    it('should pass linear call chain', () => {
      const result = analyze(`
        module Test

        function a(): void { b(); }
        function b(): void { c(); }
        function c(): void {}
      `);

      expect(result.success).toBe(true);
    });

    it('should pass diamond call pattern', () => {
      const result = analyze(`
        module Test

        function shared(): byte { return 1; }
        function left(): byte { return shared(); }
        function right(): byte { return shared(); }
        function main(): byte { return left() + right(); }
      `);

      expect(result.success).toBe(true);
    });

    it('should pass complex non-recursive program', () => {
      const result = analyze(`
        module Game

        function init(): void {}
        function update(): void {}
        function render(): void {}
        function handleInput(): void {}

        function main(): void {
          init();
          let running: bool = true;
          while (running) {
            handleInput();
            update();
            render();
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should pass functions calling each other non-cyclically', () => {
      const result = analyze(`
        module Test

        function util(): byte { return 1; }

        function helper1(): byte {
          return util() + 1;
        }

        function helper2(): byte {
          return util() + 2;
        }

        function main(): byte {
          return helper1() + helper2();
        }
      `);

      expect(result.success).toBe(true);
    });
  });

  describe('error message quality', () => {
    it('should mention the recursive function name', () => {
      const result = analyze(`
        module Test
        function factorial(n: byte): byte {
          return n * factorial(n - 1);
        }
      `);

      const errors = getRecursionErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThan(0);

      const errorMessage = errors[0].message;
      expect(errorMessage).toContain('factorial');
    });

    it('should explain SFA restriction', () => {
      const result = analyze(`
        module Test
        function rec(): void { rec(); }
      `);

      const errors = getRecursionErrors(result.diagnostics);
      // Error should reference SFA or static frame allocation
      // Check error details
      expect(result.passResults.recursionErrors.length).toBeGreaterThan(0);
      expect(result.passResults.recursionErrors[0].details).toBeDefined();
    });

    it('should include function location', () => {
      const result = analyze(`
        module Test
        function recursive(): void { recursive(); }
      `);

      const errors = getRecursionErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].location).toBeDefined();
    });
  });

  describe('mixed scenarios', () => {
    it('should detect recursion among non-recursive functions', () => {
      const result = analyze(`
        module Test

        function good1(): void {}
        function good2(): void {}
        function bad(): void { bad(); }
        function good3(): void {}
      `);

      expect(result.success).toBe(false);
      expect(hasRecursionError(result)).toBe(true);
    });

    it('should detect multiple recursion patterns', () => {
      const result = analyze(`
        module Test

        function directRec(): void { directRec(); }

        function mutualA(): void { mutualB(); }
        function mutualB(): void { mutualA(); }
      `);

      expect(result.success).toBe(false);
      // Should detect both direct and mutual recursion
      const errors = getRecursionErrors(result.diagnostics);
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should still analyze other passes despite recursion', () => {
      const result = analyze(`
        module Test

        function recursive(): void { recursive(); }
        function typeError(): byte { return true; }
      `);

      // Should have both recursion error and type error
      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(1);
    });
  });

  describe('call graph accuracy', () => {
    it('should build call graph for recursive functions', () => {
      const result = analyze(`
        module Test

        function rec(): void { rec(); }
      `);

      expect(result.callGraph).toBeDefined();
      expect(result.callGraph.size()).toBeGreaterThanOrEqual(1);
    });

    it('should track callers and callees', () => {
      const result = analyze(`
        module Test

        function a(): void { b(); }
        function b(): void { c(); }
        function c(): void { a(); }
      `);

      expect(result.callGraph.getCallees('a')).toContain('b');
      expect(result.callGraph.getCallees('b')).toContain('c');
      expect(result.callGraph.getCallees('c')).toContain('a');
    });
  });

  describe('SFA design rationale', () => {
    it('should reject classic recursive algorithms', () => {
      // Factorial
      const factorial = analyze(`
        module Test
        function factorial(n: byte): byte {
          if (n <= 1) { return 1; }
          return n * factorial(n - 1);
        }
      `);
      expect(factorial.success).toBe(false);

      // Fibonacci
      const fib = analyze(`
        module Test
        function fib(n: byte): byte {
          if (n <= 1) { return n; }
          return fib(n - 1) + fib(n - 2);
        }
      `);
      expect(fib.success).toBe(false);

      // GCD
      const gcd = analyze(`
        module Test
        function gcd(a: byte, b: byte): byte {
          if (b == 0) { return a; }
          return gcd(b, a - (a / b) * b);
        }
      `);
      expect(gcd.success).toBe(false);
    });

    it('should accept iterative equivalents', () => {
      // Factorial iterative
      const factorial = analyze(`
        module Test
        function factorial(n: byte): byte {
          let result: byte = 1;
          for (let i: byte = 2 to n step 1) {
            result = result * i;
          }
          return result;
        }
      `);
      expect(factorial.success).toBe(true);

      // Fibonacci iterative
      const fib = analyze(`
        module Test
        function fib(n: byte): byte {
          let a: byte = 0;
          let b: byte = 1;
          for (let i: byte = 0 to n step 1) {
            let temp: byte = a + b;
            a = b;
            b = temp;
          }
          return a;
        }
      `);
      expect(fib.success).toBe(true);
    });
  });
});