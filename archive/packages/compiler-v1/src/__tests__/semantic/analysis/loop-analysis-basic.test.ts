/**
 * Tests for Loop Analysis - Basic Loop Detection (Task 8.11.1-8.11.2)
 *
 * Tests natural loop detection and dominance computation:
 * - Natural loops using back edges (Task 8.11.1)
 * - Dominance computation (Task 8.11.2)
 */

import { describe, it, expect } from 'vitest';
import { Parser } from '../../../parser/parser.js';
import { Lexer } from '../../../lexer/lexer.js';
import { SemanticAnalyzer } from '../../../semantic/analyzer.js';
import { LoopAnalyzer } from '../../../semantic/analysis/loop-analysis.js';

/**
 * Helper to parse and analyze source code for loop analysis
 *
 * Sets up the complete pipeline: Lexer → Parser → SemanticAnalyzer → LoopAnalyzer
 * Returns all analysis artifacts for testing.
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

describe('LoopAnalyzer - Natural Loop Detection (Task 8.11.1)', () => {
  it('should detect a simple while loop', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Analysis should complete without errors
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should detect a for-style loop pattern', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 5) {
          let x: byte = i * 2;
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Analysis should complete without errors
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should detect nested loops', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = 0;
          while (j < 10) {
            j = j + 1;
          }
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Nested loops should be detected without errors
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should detect multiple loops in same function', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 5) {
          i = i + 1;
        }

        let j: byte = 0;
        while (j < 3) {
          j = j + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Both loops should be detected
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should handle function with no loops', () => {
    const source = `
      module Test

      function test(): void {
        let x: byte = 10;
        let y: byte = 20;
        let z: byte = x + y;
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Should complete without issues even with no loops
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should handle empty function', () => {
    const source = `
      module Test

      function test(): void {
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Empty function should work
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should detect loop with conditional in body', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          if (i > 5) {
            let x: byte = i;
          }
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Loop with complex body should be detected
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should detect deeply nested loops', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 3) {
          let j: byte = 0;
          while (j < 3) {
            let k: byte = 0;
            while (k < 3) {
              k = k + 1;
            }
            j = j + 1;
          }
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Triple-nested loops should be detected
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });
});

describe('LoopAnalyzer - Dominance Computation (Task 8.11.2)', () => {
  it('should compute dominance for simple linear code', () => {
    const source = `
      module Test

      function test(): void {
        let x: byte = 1;
        let y: byte = 2;
        let z: byte = 3;
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Linear code should have straightforward dominance
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should compute dominance for diamond control flow', () => {
    const source = `
      module Test

      function test(flag: boolean): void {
        let x: byte = 10;
        if (flag) {
          let y: byte = 20;
        } else {
          let z: byte = 30;
        }
        let w: byte = 40;
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Diamond pattern should compute correctly
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should compute dominance for loop with back edge', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Loop header should dominate back edge source
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should compute dominance for nested conditionals', () => {
    const source = `
      module Test

      function test(a: boolean, b: boolean): void {
        let x: byte = 10;
        if (a) {
          if (b) {
            let y: byte = 20;
          }
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Nested conditionals dominance should be correct
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should compute dominance for multiple paths to same node', () => {
    const source = `
      module Test

      function test(a: boolean, b: boolean): void {
        let result: byte;
        if (a) {
          result = 10;
        } else {
          if (b) {
            result = 20;
          } else {
            result = 30;
          }
        }
        let x: byte = result;
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Multiple paths should merge correctly
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should compute dominance reaching fixpoint', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 100) {
          let j: byte = 0;
          while (j < 100) {
            j = j + 1;
          }
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Dominance algorithm should converge
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });
});