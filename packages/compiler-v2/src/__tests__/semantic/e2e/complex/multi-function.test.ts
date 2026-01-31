/**
 * Complex Multi-Function Programs E2E Tests for Blend65 Compiler v2
 *
 * Tests programs with multiple interacting functions:
 * - Multiple functions calling each other
 * - Helper function patterns
 * - Function composition
 * - Module-level organization
 *
 * Task 5.21.4: Test complex multi-function programs
 */

import { describe, it, expect } from 'vitest';
import { SemanticAnalyzer, type AnalysisResult } from '../../../../semantic/index.js';
import { Parser } from '../../../../parser/index.js';
import { Lexer } from '../../../../lexer/index.js';
import type { Program } from '../../../../ast/index.js';

/**
 * Helper to parse a Blend65 source string and return the Program AST
 */
function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, source);
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

describe('Complex Multi-Function Programs E2E', () => {
  describe('multiple function interactions', () => {
    it('should analyze program with three functions calling each other', () => {
      const result = analyze(`
        module Test;;

        function level1(): byte {
          return level2() + 1;
        }

        function level2(): byte {
          return level3() + 1;
        }

        function level3(): byte {
          return 10;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(3);
      expect(result.callGraph.getCallees('level1')).toContain('level2');
      expect(result.callGraph.getCallees('level2')).toContain('level3');
    });

    it('should analyze helper function pattern', () => {
      const result = analyze(`
        module Test;

        function isEven(n: byte): bool {
          return (n % 2) == 0;
        }

        function isOdd(n: byte): bool {
          return !isEven(n);
        }

        function classify(n: byte): byte {
          if (isEven(n)) {
            return 0;
          }
          return 1;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(3);
    });

    it('should analyze function composition pattern', () => {
      const result = analyze(`
        module Test;

        function addOne(x: byte): byte {
          return x + 1;
        }

        function double(x: byte): byte {
          return x * 2;
        }

        function square(x: byte): byte {
          return x * x;
        }

        function composed(x: byte): byte {
          return square(double(addOne(x)));
        }
      `);

      expect(result.success).toBe(true);
      expect(result.callGraph.getCallees('composed')).toContain('square');
      expect(result.callGraph.getCallees('composed')).toContain('double');
      expect(result.callGraph.getCallees('composed')).toContain('addOne');
    });

    it('should analyze functions with shared state', () => {
      const result = analyze(`
        module Test;

        let counter: byte = 0;

        function reset(): void {
          counter = 0;
        }

        function increment(): void {
          counter = counter + 1;
        }

        function decrement(): void {
          if (counter > 0) {
            counter = counter - 1;
          }
        }

        function getCount(): byte {
          return counter;
        }

        function modifyAndGet(delta: byte): byte {
          if (delta > 0) {
            increment();
          } else {
            decrement();
          }
          return getCount();
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(5);
    });
  });

  describe('math utility patterns', () => {
    it.skip('should analyze math library pattern', () => {
      const result = analyze(`
        module Test;

        function abs(n: byte): byte {
          if (n < 128) {
            return n;
          }
          return 256 - n;
        }

        function min(a: byte, b: byte): byte {
          if (a < b) {
            return a;
          }
          return b;
        }

        function max(a: byte, b: byte): byte {
          if (a > b) {
            return a;
          }
          return b;
        }

        function clamp(value: byte, lo: byte, hi: byte): byte {
          return max(lo, min(value, hi));
        }

        function distance(a: byte, b: byte): byte {
          if (a > b) {
            return a - b;
          }
          return b - a;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(5);
    });

    it('should analyze arithmetic helper pattern', () => {
      const result = analyze(`
        module Test;

        function multiplyBy2(x: byte): byte {
          return x << 1;
        }

        function divideBy2(x: byte): byte {
          return x >> 1;
        }

        function multiplyBy4(x: byte): byte {
          return multiplyBy2(multiplyBy2(x));
        }

        function multiplyBy8(x: byte): byte {
          return multiplyBy2(multiplyBy4(x));
        }

        function fastMultiply(x: byte, factor: byte): byte {
          if (factor == 2) { return multiplyBy2(x); }
          if (factor == 4) { return multiplyBy4(x); }
          if (factor == 8) { return multiplyBy8(x); }
          return x * factor;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(5);
    });
  });

  describe('data processing patterns', () => {
    it('should analyze array processing with multiple functions', () => {
      const result = analyze(`
        module Test;

        function sumArray(data: byte[10], len: byte): word {
          let total: word = 0;
          let i: byte = 0;
          while (i < len) {
            total = total + data[i];
            i = i + 1;
          }
          return total;
        }

        function findMax(data: byte[10], len: byte): byte {
          let maxVal: byte = 0;
          let i: byte = 0;
          while (i < len) {
            if (data[i] > maxVal) {
              maxVal = data[i];
            }
            i = i + 1;
          }
          return maxVal;
        }

        function findMin(data: byte[10], len: byte): byte {
          let minVal: byte = 255;
          let i: byte = 0;
          while (i < len) {
            if (data[i] < minVal) {
              minVal = data[i];
            }
            i = i + 1;
          }
          return minVal;
        }

        function getRange(data: byte[10], len: byte): byte {
          return findMax(data, len) - findMin(data, len);
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(4);
    });

    it('should analyze validation functions', () => {
      const result = analyze(`
        module Test;

        function isDigit(c: byte): bool {
          return c >= 48 && c <= 57;
        }

        function isLetter(c: byte): bool {
          let isUpper: bool = c >= 65 && c <= 90;
          let isLower: bool = c >= 97 && c <= 122;
          return isUpper || isLower;
        }

        function isAlphaNum(c: byte): bool {
          return isDigit(c) || isLetter(c);
        }

        function isSpace(c: byte): bool {
          return c == 32 || c == 9 || c == 10 || c == 13;
        }

        function isValid(c: byte): bool {
          return isAlphaNum(c) || isSpace(c);
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(5);
    });
  });

  describe('state machine patterns', () => {
    it('should analyze simple state machine', () => {
      const result = analyze(`
        module Test;

        let currentState: byte = 0;

        function enterIdle(): void {
          currentState = 0;
        }

        function enterRunning(): void {
          currentState = 1;
        }

        function enterPaused(): void {
          currentState = 2;
        }

        function enterStopped(): void {
          currentState = 3;
        }

        function isIdle(): bool { return currentState == 0; }
        function isRunning(): bool { return currentState == 1; }
        function isPaused(): bool { return currentState == 2; }
        function isStopped(): bool { return currentState == 3; }

        function start(): void {
          if (isIdle() || isPaused()) {
            enterRunning();
          }
        }

        function pause(): void {
          if (isRunning()) {
            enterPaused();
          }
        }

        function stop(): void {
          enterStopped();
        }

        function reset(): void {
          enterIdle();
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(12);
    });
  });

  describe('builder patterns', () => {
    it('should analyze builder/setter pattern', () => {
      const result = analyze(`
        module Test;

        let configA: byte = 0;
        let configB: byte = 0;
        let configC: byte = 0;

        function setConfigA(val: byte): void {
          configA = val;
        }

        function setConfigB(val: byte): void {
          configB = val;
        }

        function setConfigC(val: byte): void {
          configC = val;
        }

        function getConfigA(): byte { return configA; }
        function getConfigB(): byte { return configB; }
        function getConfigC(): byte { return configC; }

        function resetConfig(): void {
          setConfigA(0);
          setConfigB(0);
          setConfigC(0);
        }

        function applyDefaults(): void {
          setConfigA(10);
          setConfigB(20);
          setConfigC(30);
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(8);
    });
  });

  describe('callback simulation patterns', () => {
    it('should analyze dispatch pattern with multiple handlers', () => {
      const result = analyze(`
        module Test;

        function handleEvent0(): void {
          // Handle event type 0
        }

        function handleEvent1(): void {
          // Handle event type 1
        }

        function handleEvent2(): void {
          // Handle event type 2
        }

        function handleDefault(): void {
          // Default handler
        }

        function dispatch(eventType: byte): void {
          if (eventType == 0) {
            handleEvent0();
          } else {
            if (eventType == 1) {
              handleEvent1();
            } else {
              if (eventType == 2) {
                handleEvent2();
              } else {
                handleDefault();
              }
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(5);
    });
  });

  describe('module-level organization', () => {
    it.skip('should analyze well-organized module Test; sections', () => {
      const result = analyze(`
        module Test;

        // === Constants ===
        const MAX_ITEMS: byte = 100;
        const MIN_VALUE: byte = 0;
        const MAX_VALUE: byte = 255;

        // === State ===
        let itemCount: byte = 0;
        let items: byte[100];

        // === Private Helpers ===
        function isValidIndex(idx: byte): bool {
          return idx < itemCount;
        }

        function isValidValue(val: byte): bool {
          return val >= MIN_VALUE && val <= MAX_VALUE;
        }

        // === Public API ===
        function getCount(): byte {
          return itemCount;
        }

        function isEmpty(): bool {
          return itemCount == 0;
        }

        function isFull(): bool {
          return itemCount >= MAX_ITEMS;
        }

        function add(val: byte): bool {
          if (isFull()) {
            return false;
          }
          if (!isValidValue(val)) {
            return false;
          }
          items[itemCount] = val;
          itemCount = itemCount + 1;
          return true;
        }

        function get(idx: byte): byte {
          if (!isValidIndex(idx)) {
            return 0;
          }
          return items[idx];
        }

        function clear(): void {
          itemCount = 0;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(9);
    });

    it('should analyze module Test; initialization pattern', () => {
      const result = analyze(`
        module Test;

        let initialized: bool = false;
        let data: byte[10];

        function initData(): void {
          let i: byte = 0;
          while (i < 10) {
            data[i] = 0;
            i = i + 1;
          }
        }

        function init(): void {
          if (!initialized) {
            initData();
            initialized = true;
          }
        }

        function ensureInit(): void {
          init();
        }

        function doWork(): byte {
          ensureInit();
          return data[0];
        }

        function setData(idx: byte, val: byte): void {
          ensureInit();
          if (idx < 10) {
            data[idx] = val;
          }
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(5);
    });
  });

  describe('call graph verification', () => {
    it('should build correct call graph for complex module', () => {
      const result = analyze(`
        module Test;

        function a(): void { b(); c(); }
        function b(): void { d(); }
        function c(): void { d(); }
        function d(): void {}
        function e(): void { a(); }
      `);

      expect(result.success).toBe(true);

      // Verify call graph structure
      expect(result.callGraph.getCallees('a')).toContain('b');
      expect(result.callGraph.getCallees('a')).toContain('c');
      expect(result.callGraph.getCallees('b')).toContain('d');
      expect(result.callGraph.getCallees('c')).toContain('d');
      expect(result.callGraph.getCallees('e')).toContain('a');
      expect(result.callGraph.getCallees('d')).toHaveLength(0);
    });

    it('should identify leaf functions (no callees)', () => {
      const result = analyze(`
        module Test;

        function leaf1(): byte { return 1; }
        function leaf2(): byte { return 2; }
        function caller(): byte { return leaf1() + leaf2(); }
      `);

      expect(result.success).toBe(true);
      expect(result.callGraph.getCallees('leaf1')).toHaveLength(0);
      expect(result.callGraph.getCallees('leaf2')).toHaveLength(0);
      expect(result.callGraph.getCallees('caller')).toHaveLength(2);
    });
  });
});