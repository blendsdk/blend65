/**
 * Stress Test: Many Variables E2E Tests
 * Small, focused tests for programs with many variables
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

describe('Stress: Many Variables', () => {
  it('should handle many global variables', () => {
    const result = analyze(`
      module ManyGlobals;
      let a: byte = 1; let b: byte = 2; let c: byte = 3;
      let d: byte = 4; let e: byte = 5; let f: byte = 6;
      let g: byte = 7; let h: byte = 8; let i: byte = 9;
      let j: byte = 10;
    `);
    expect(result.success).toBe(true);
  });

  it('should handle many local variables', () => {
    const result = analyze(`
      module ManyLocals;
      function test(): byte {
        let a: byte = 1; let b: byte = 2; let c: byte = 3;
        let d: byte = 4; let e: byte = 5;
        return a + b + c + d + e;
      }
    `);
    expect(result.success).toBe(true);
  });

  it('should handle many constants', () => {
    const result = analyze(`
      module ManyConsts;
      const A: byte = 1; const B: byte = 2; const C: byte = 3;
      const D: byte = 4; const E: byte = 5; const F: byte = 6;
      const G: byte = 7; const H: byte = 8;
    `);
    expect(result.success).toBe(true);
  });

  it('should handle many array variables', () => {
    const result = analyze(`
      module ManyArrays;
      let arr1: byte[5] = [1, 2, 3, 4, 5];
      let arr2: byte[5] = [6, 7, 8, 9, 10];
      let arr3: word[3] = [100, 200, 300];
    `);
    expect(result.success).toBe(true);
  });

  it('should handle mixed variable types', () => {
    const result = analyze(`
      module MixedVars;
      let byteVar: byte = 42;
      let wordVar: word = 1000;
      let boolVar: bool = true;
      let arrVar: byte[4] = [1, 2, 3, 4];
      const CONST_VAL: byte = 99;
    `);
    expect(result.success).toBe(true);
  });
});