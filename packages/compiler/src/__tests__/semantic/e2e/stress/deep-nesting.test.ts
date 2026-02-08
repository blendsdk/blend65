/**
 * Stress Test: Deep Nesting E2E Tests
 * Small, focused tests for deeply nested structures
 */

import { describe, it, expect } from 'vitest';
import { SemanticAnalyzer, type AnalysisResult } from '../../../../semantic/index.js';
import { Parser } from '../../../../parser/index.js';
import { Lexer } from '../../../../lexer/index.js';
import type { Program } from '../../../../ast/index.js';

function parse(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

function analyze(source: string): AnalysisResult {
  const program = parse(source);
  const analyzer = new SemanticAnalyzer();
  return analyzer.analyze(program);
}

describe('Stress: Deep Nesting', () => {
  it('should handle nested if statements', () => {
    const result = analyze(`
      module NestedIf;
      function test(a: byte, b: byte, c: byte): byte {
        if (a > 0) {
          if (b > 0) {
            if (c > 0) {
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

  it('should handle nested while loops', () => {
    const result = analyze(`
      module NestedWhile;
      function test(): void {
        let i: byte = 0;
        let j: byte = 0;
        while (i < 10) {
          j = 0;
          while (j < 10) {
            j = j + 1;
          }
          i = i + 1;
        }
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should handle deeply nested expressions', () => {
    const result = analyze(`
      module NestedExpr;
      function test(a: byte): byte {
        return ((((a + 1) * 2) - 3) / 4) & $FF;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should handle nested ternary operators', () => {
    const result = analyze(`
      module NestedTernary;
      function test(a: byte, b: byte): byte {
        return a > 10 ? (b > 5 ? 3 : 2) : (b > 5 ? 1 : 0);
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should handle mixed nested control flow', () => {
    const result = analyze(`
      module MixedNest;
      function test(): void {
        let i: byte = 0;
        let j: byte = 0;
        while (i < 5) {
          if (i == 2) {
            j = 0;
            while (j < 3) {
              j = j + 1;
            }
          }
          i = i + 1;
        }
      }
    `);
    expect(result.success).toBe(true);
  });
});