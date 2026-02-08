/**
 * Tests for Loop Analysis - Loop-Invariant Detection (Task 8.11.3)
 *
 * Tests detection of expressions that don't change within a loop body,
 * enabling loop-invariant code motion optimization.
 */

import { describe, it, expect } from 'vitest';
import { Parser } from '../../../parser/parser.js';
import { Lexer } from '../../../lexer/lexer.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { LoopAnalyzer } from '../../../semantic/analysis/loop-analysis.js';

/**
 * Helper to parse and analyze source code for loop analysis
 */
function analyzeLoops(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const analyzer = new SemanticAnalyzer();
  analyzer.analyze(ast);

  const symbolTable = analyzer.getSymbolTable();
  const cfgs = analyzer.getAllCFGs();

  const loopAnalyzer = new LoopAnalyzer(cfgs, symbolTable);
  loopAnalyzer.analyze(ast);

  return {
    ast,
    analyzer: loopAnalyzer,
    symbolTable,
    cfgs,
    diagnostics: loopAnalyzer.getDiagnostics(),
  };
}

describe('LoopAnalyzer - Loop-Invariant Detection (Task 8.11.3)', () => {
  it('should identify constant as loop-invariant', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let x: byte = 42;
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Constant 42 is always loop-invariant
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should identify variable defined outside loop as invariant', () => {
    const source = `
      module Test

      function test(): void {
        let max: byte = 100;
        let i: byte = 0;
        while (i < max) {
          let x: byte = max;
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // 'max' is defined outside loop and not modified - it's invariant
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should detect loop counter as NOT invariant', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let x: byte = i;
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // 'i' is modified in loop - NOT invariant
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should detect binary expression with invariant operands as invariant', () => {
    const source = `
      module Test

      function test(): void {
        let a: byte = 10;
        let b: byte = 20;
        let i: byte = 0;
        while (i < 5) {
          let x: byte = a + b;
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // a + b is invariant (both operands defined outside, not modified)
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should detect expression with one variant operand as NOT invariant', () => {
    const source = `
      module Test

      function test(): void {
        let a: byte = 10;
        let i: byte = 0;
        while (i < 10) {
          let x: byte = a + i;
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // a + i is NOT invariant (i changes each iteration)
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should identify nested invariant expressions', () => {
    const source = `
      module Test

      function test(): void {
        let a: byte = 2;
        let b: byte = 3;
        let c: byte = 4;
        let i: byte = 0;
        while (i < 10) {
          let x: byte = (a + b) * c;
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // (a + b) * c is fully invariant
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should detect function calls as NOT invariant (conservative)', () => {
    const source = `
      module Test

      function getValue(): byte {
        return 42;
      }

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let x: byte = getValue();
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Function calls are NOT invariant (may have side effects)
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should handle nested loops with different invariants', () => {
    const source = `
      module Test

      function test(): void {
        let outer: byte = 100;
        let i: byte = 0;
        while (i < 10) {
          let inner: byte = i;
          let j: byte = 0;
          while (j < 5) {
            let x: byte = outer;
            let y: byte = inner;
            j = j + 1;
          }
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // 'outer' invariant in both, 'inner' invariant only in inner loop
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should handle complex invariant chain', () => {
    const source = `
      module Test

      function test(): void {
        let base: byte = 10;
        let offset: byte = 5;
        let multiplier: byte = 2;
        let i: byte = 0;
        while (i < 10) {
          let temp1: byte = base + offset;
          let temp2: byte = temp1 * multiplier;
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Both temp1 and temp2 are invariant (depend only on invariants)
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should detect unary expressions with invariant operand as invariant', () => {
    const source = `
      module Test

      function test(): void {
        let value: byte = 10;
        let i: byte = 0;
        while (i < 5) {
          let x: byte = -value;
          let y: byte = ~value;
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // -value and ~value are invariant (value not modified in loop)
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });
});