/**
 * Stress Test: Many Functions E2E Tests
 * Small, focused tests for programs with many functions
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

describe('Stress: Many Functions', () => {
  it('should handle many void functions', () => {
    const result = analyze(`
      module ManyVoid;
      function f1(): void {} function f2(): void {}
      function f3(): void {} function f4(): void {}
      function f5(): void {} function f6(): void {}
    `);
    expect(result.success).toBe(true);
    expect(result.stats.functionsAnalyzed).toBeGreaterThanOrEqual(6);
  });

  it('should handle many functions with return values', () => {
    const result = analyze(`
      module ManyReturn;
      function g1(): byte { return 1; }
      function g2(): byte { return 2; }
      function g3(): byte { return 3; }
      function g4(): word { return 100; }
    `);
    expect(result.success).toBe(true);
  });

  it('should handle function call chain', () => {
    const result = analyze(`
      module CallChain;
      function a(): void { b(); }
      function b(): void { c(); }
      function c(): void { d(); }
      function d(): void {}
    `);
    expect(result.success).toBe(true);
    expect(result.callGraph.getCallees('a')).toContain('b');
  });

  it('should handle functions with parameters', () => {
    const result = analyze(`
      module WithParams;
      function p1(a: byte): byte { return a; }
      function p2(a: byte, b: byte): byte { return a + b; }
      function p3(a: byte, b: byte, c: byte): byte { return a + b + c; }
    `);
    expect(result.success).toBe(true);
  });

  it('should handle mixed function types', () => {
    const result = analyze(`
      module MixedFuncs;
      function voidFn(): void {}
      function byteFn(): byte { return 42; }
      function wordFn(): word { return 1000; }
      function boolFn(): bool { return true; }
      function caller(): void {
        voidFn();
        let b: byte = byteFn();
        let w: word = wordFn();
        let f: bool = boolFn();
      }
    `);
    expect(result.success).toBe(true);
  });
});