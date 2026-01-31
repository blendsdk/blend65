/**
 * Complex Control Flow Programs E2E Tests for Blend65 Compiler v2
 *
 * Tests programs with complex control flow:
 * - Nested conditionals
 * - Complex loop patterns
 * - Early returns and break/continue
 * - Mixed control flow
 *
 * Task 5.21.5: Test complex control flow programs
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

describe('Complex Control Flow Programs E2E', () => {
  describe('nested conditionals', () => {
    it('should analyze deeply nested if-else', () => {
      const result = analyze(`
        module Test;

        function classify(value: byte): byte {
          if (value < 50) {
            if (value < 25) {
              if (value < 10) {
                return 0;
              } else {
                return 1;
              }
            } else {
              return 2;
            }
          } else {
            if (value < 75) {
              return 3;
            } else {
              if (value < 90) {
                return 4;
              } else {
                return 5;
              }
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      expect(result.cfgs.has('classify')).toBe(true);
    });

    it('should analyze else-if chain', () => {
      const result = analyze(`
        module Test;

        function getGrade(score: byte): byte {
          if (score >= 90) {
            return 65;
          } else {
            if (score >= 80) {
              return 66;
            } else {
              if (score >= 70) {
                return 67;
              } else {
                if (score >= 60) {
                  return 68;
                } else {
                  return 70;
                }
              }
            }
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze if with multiple conditions', () => {
      const result = analyze(`
        module Test;

        function checkRange(x: byte, y: byte): bool {
          if (x > 0 && x < 100) {
            if (y > 0 && y < 100) {
              if (x + y < 150) {
                return true;
              }
            }
          }
          return false;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze conditional with complex boolean expressions', () => {
      const result = analyze(`
        module Test;

        function isValid(a: byte, b: byte, c: byte): bool {
          if ((a > 0 && b > 0) || c > 0) {
            if (!(a == b) && (b != c || a != c)) {
              return true;
            }
          }
          return false;
        }
      `);

      expect(result.success).toBe(true);
    });
  });

  describe('complex loop patterns', () => {
    it('should analyze nested while loops', () => {
      const result = analyze(`
        module Test;

        function process2D(): byte {
          let total: byte = 0;
          let i: byte = 0;
          while (i < 10) {
            let j: byte = 0;
            while (j < 10) {
              total = total + 1;
              j = j + 1;
            }
            i = i + 1;
          }
          return total;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze nested for loops', () => {
      const result = analyze(`
        module Test;

        function sumMatrix(data: byte[100]): word {
          let total: word = 0;
          for (let i: byte = 0 to 9 step 1) {
            for (let j: byte = 0 to 9 step 1) {
              let idx: byte = i * 10 + j;
              total = total + data[idx];
            }
          }
          return total;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze triple nested loops', () => {
      const result = analyze(`
        module Test;

        function countCombinations(): word {
          let count: word = 0;
          let x: byte = 0;
          while (x < 5) {
            let y: byte = 0;
            while (y < 5) {
              let z: byte = 0;
              while (z < 5) {
                count = count + 1;
                z = z + 1;
              }
              y = y + 1;
            }
            x = x + 1;
          }
          return count;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze loop with multiple exit conditions', () => {
      const result = analyze(`
        module Test;

        function findFirst(data: byte[100], target: byte, len: byte): byte {
          let i: byte = 0;
          while (i < len && i < 100) {
            if (data[i] == target) {
              return i;
            }
            i = i + 1;
          }
          return 255;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze countdown loop', () => {
      const result = analyze(`
        module Test;

        function countDown(start: byte): byte {
          let count: byte = 0;
          let i: byte = start;
          while (i > 0) {
            count = count + 1;
            i = i - 1;
          }
          return count;
        }
      `);

      expect(result.success).toBe(true);
    });
  });

  describe('early returns', () => {
    it('should analyze guard clause pattern', () => {
      const result = analyze(`
        module Test;

        function processValue(value: byte): byte {
          // Guard clauses
          if (value == 0) {
            return 0;
          }
          if (value > 200) {
            return 255;
          }
          if (value < 10) {
            return value * 10;
          }

          // Main processing
          let result: byte = value * 2;
          if (result > 200) {
            result = 200;
          }
          return result;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze early return in loop', () => {
      const result = analyze(`
        module Test;

        function contains(data: byte[50], target: byte, len: byte): bool {
          let i: byte = 0;
          while (i < len) {
            if (data[i] == target) {
              return true;
            }
            i = i + 1;
          }
          return false;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze multiple return paths', () => {
      const result = analyze(`
        module Test;

        function categorize(x: byte, y: byte): byte {
          if (x == 0 && y == 0) {
            return 0;
          }

          if (x == 0) {
            return 1;
          }

          if (y == 0) {
            return 2;
          }

          if (x == y) {
            return 3;
          }

          if (x > y) {
            return 4;
          }

          return 5;
        }
      `);

      expect(result.success).toBe(true);
    });
  });

  describe('break and continue', () => {
    it('should analyze break in while loop', () => {
      const result = analyze(`
        module Test;

        function findFirstZero(data: byte[20]): byte {
          let i: byte = 0;
          while (i < 20) {
            if (data[i] == 0) {
              break;
            }
            i = i + 1;
          }
          return i;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze continue in while loop', () => {
      const result = analyze(`
        module Test;

        function sumNonZero(data: byte[10]): word {
          let total: word = 0;
          let i: byte = 0;
          while (i < 10) {
            let val: byte = data[i];
            i = i + 1;
            if (val == 0) {
              continue;
            }
            total = total + val;
          }
          return total;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze break in for loop', () => {
      const result = analyze(`
        module Test;

        function findValue(data: byte[100], target: byte): byte {
          let result: byte = 255;
          for (let i: byte = 0 to 99 step 1) {
            if (data[i] == target) {
              result = i;
              break;
            }
          }
          return result;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze break in nested loops (inner only)', () => {
      const result = analyze(`
        module Test;

        function process(): byte {
          let found: byte = 0;
          let i: byte = 0;
          while (i < 10) {
            let j: byte = 0;
            while (j < 10) {
              if (i * j > 50) {
                found = found + 1;
                break;
              }
              j = j + 1;
            }
            i = i + 1;
          }
          return found;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze continue in nested loops', () => {
      const result = analyze(`
        module Test;

        function countValid(): byte {
          let count: byte = 0;
          let i: byte = 0;
          while (i < 10) {
            let j: byte = 0;
            while (j < 10) {
              j = j + 1;
              if (j % 2 == 0) {
                continue;
              }
              count = count + 1;
            }
            i = i + 1;
          }
          return count;
        }
      `);

      expect(result.success).toBe(true);
    });
  });

  describe('mixed control flow', () => {
    it('should analyze loop with conditionals and early exit', () => {
      const result = analyze(`
        module Test;

        function findMatchingPair(a: byte[10], b: byte[10]): byte {
          let i: byte = 0;
          while (i < 10) {
            let aVal: byte = a[i];
            if (aVal > 0) {
              let j: byte = 0;
              while (j < 10) {
                if (b[j] == aVal) {
                  return i;
                }
                j = j + 1;
              }
            }
            i = i + 1;
          }
          return 255;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze state machine with loop', () => {
      const result = analyze(`
        module Test;

        function processInput(input: byte[50], len: byte): byte {
          let state: byte = 0;
          let result: byte = 0;
          let i: byte = 0;

          while (i < len) {
            let c: byte = input[i];

            if (state == 0) {
              if (c == 1) {
                state = 1;
              } else {
                if (c == 2) {
                  state = 2;
                }
              }
            } else {
              if (state == 1) {
                if (c == 0) {
                  result = result + 1;
                  state = 0;
                }
              } else {
                if (state == 2) {
                  if (c == 0) {
                    result = result + 2;
                    state = 0;
                  }
                }
              }
            }

            i = i + 1;
          }

          return result;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze conditional loop bounds', () => {
      const result = analyze(`
        module Test;

        function processRange(data: byte[100], start: byte, end: byte): byte {
          let sum: byte = 0;

          if (start >= end) {
            return 0;
          }

          if (end > 100) {
            return 0;
          }

          let i: byte = start;
          while (i < end) {
            sum = sum + data[i];
            if (sum > 200) {
              break;
            }
            i = i + 1;
          }

          return sum;
        }
      `);

      expect(result.success).toBe(true);
    });
  });

  describe('control flow graph verification', () => {
    it('should build CFG for function with if-else', () => {
      const result = analyze(`
        module Test;

        function test(x: byte): byte {
          if (x > 10) {
            return 1;
          } else {
            return 0;
          }
        }
      `);

      expect(result.success).toBe(true);
      // CFG is built for the function
      expect(result.cfgs.has('test')).toBe(true);
      const cfg = result.cfgs.get('test');
      expect(cfg).toBeDefined();
      // Just verify CFG exists - node count depends on implementation
    });

    it('should build CFG for function with while loop', () => {
      const result = analyze(`
        module Test;

        function countdown(n: byte): byte {
          let i: byte = n;
          while (i > 0) {
            i = i - 1;
          }
          return i;
        }
      `);

      expect(result.success).toBe(true);
      const cfg = result.cfgs.get('countdown');
      expect(cfg).toBeDefined();
    });

    it('should build CFG for complex function', () => {
      const result = analyze(`
        module Test;

        function complex(a: byte, b: byte): byte {
          let result: byte = 0;

          if (a > b) {
            let temp: byte = a;
            while (temp > b) {
              result = result + 1;
              temp = temp - 1;
            }
          } else {
            if (a < b) {
              for (let i: byte = a to b step 1) {
                result = result + 1;
              }
            }
          }

          return result;
        }
      `);

      expect(result.success).toBe(true);
      const cfg = result.cfgs.get('complex');
      expect(cfg).toBeDefined();
    });
  });

  describe('ternary operator control flow', () => {
    it('should analyze ternary in loop condition', () => {
      const result = analyze(`
        module Test;

        function process(useShort: bool, data: byte[100]): byte {
          let limit: byte = useShort ? 10 : 100;
          let sum: byte = 0;
          let i: byte = 0;
          while (i < limit) {
            sum = sum + data[i];
            i = i + 1;
          }
          return sum;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze nested ternaries', () => {
      const result = analyze(`
        module Test;

        function classify(x: byte): byte {
          return x < 10 ? 0 : x < 50 ? 1 : x < 100 ? 2 : 3;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze ternary in function calls', () => {
      const result = analyze(`
        module Test;

        function slow(x: byte): byte { return x * 2; }
        function fast(x: byte): byte { return x << 1; }

        function compute(x: byte, useFast: bool): byte {
          return useFast ? fast(x) : slow(x);
        }
      `);

      expect(result.success).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should analyze empty function body', () => {
      const result = analyze(`
        module Test;

        function doNothing(): void {
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze single statement function', () => {
      const result = analyze(`
        module Test;

        function getOne(): byte {
          return 1;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze function with only declarations', () => {
      const result = analyze(`
        module Test;

        function setup(): void {
          let a: byte = 1;
          let b: byte = 2;
          let c: byte = 3;
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze deeply nested control flow', () => {
      const result = analyze(`
        module Test;

        function deep(x: byte): byte {
          if (x > 0) {
            if (x > 10) {
              if (x > 20) {
                if (x > 30) {
                  if (x > 40) {
                    return 5;
                  }
                  return 4;
                }
                return 3;
              }
              return 2;
            }
            return 1;
          }
          return 0;
        }
      `);

      expect(result.success).toBe(true);
    });
  });
});