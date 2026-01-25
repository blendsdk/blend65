/**
 * Tests for Loop Analysis - Integration, Edge Cases, and Performance
 *
 * Tests real-world C64 patterns, edge cases, error handling, and performance:
 * - Integration tests with realistic patterns
 * - Edge cases and error handling
 * - Performance tests
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

describe('LoopAnalyzer - Integration Tests', () => {
  it('should analyze complete sprite animation loop pattern', () => {
    // Real-world C64 pattern: sprite animation loop
    const source = `
      module SpriteAnimation

      function animateSprite(): void {
        let spriteX: byte = 100;
        let spriteY: byte = 100;
        let speed: byte = 2;
        let frame: byte = 0;

        while (frame < 60) {
          let newX: byte = spriteX + speed;
          let newY: byte = spriteY;

          spriteX = newX;
          frame = frame + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should analyze game tick loop pattern', () => {
    // Real-world pattern: game main loop
    const source = `
      module GameLoop

      function gameMain(): void {
        let score: byte = 0;
        let lives: byte = 3;
        let level: byte = 1;
        let tick: byte = 0;

        while (lives > 0) {
          let levelBonus: byte = level * 10;

          if (score > 100) {
            level = level + 1;
          }

          tick = tick + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should analyze memory clearing loop pattern', () => {
    // Common C64 pattern: clearing screen memory
    const source = `
      module ScreenClear

      function clearScreen(): void {
        let fillChar: byte = 32;
        let colorValue: byte = 14;

        let i: byte = 0;
        while (i < 250) {
          let offset: byte = i;
          i = i + 1;
        }

        let j: byte = 0;
        while (j < 250) {
          let offset2: byte = j;
          j = j + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // fillChar and colorValue are loop-invariant
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should analyze nested loop with matrix pattern', () => {
    // Pattern: processing a 2D grid (like screen character matrix)
    const source = `
      module MatrixProcess

      function processGrid(): void {
        let width: byte = 40;
        let height: byte = 25;
        let baseValue: byte = 10;

        let row: byte = 0;
        while (row < height) {
          let rowOffset: byte = row * width;

          let col: byte = 0;
          while (col < width) {
            let cellValue: byte = baseValue + col;
            col = col + 1;
          }

          row = row + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // width, height, baseValue are invariant in both loops
    // rowOffset is invariant in inner loop
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should handle complex real-world pattern with branches in loop', () => {
    const source = `
      module ComplexLoop

      function processItems(): void {
        let threshold: byte = 50;
        let multiplier: byte = 2;
        let i: byte = 0;

        while (i < 100) {
          let scaledThreshold: byte = threshold * multiplier;

          if (i < scaledThreshold) {
            let low: byte = i;
          } else {
            let high: byte = i;
          }

          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // threshold * multiplier is loop-invariant
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });
});

describe('LoopAnalyzer - Edge Cases and Error Handling', () => {
  it('should handle single-iteration loop', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 1) {
          i = i + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should handle loop with no body statements', () => {
    const source = `
      module Test

      function test(): void {
        let running: boolean = true;
        while (running) {
          running = false;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should handle multiple functions with loops', () => {
    const source = `
      module Test

      function func1(): void {
        let i: byte = 0;
        while (i < 5) {
          i = i + 1;
        }
      }

      function func2(): void {
        let j: byte = 0;
        while (j < 10) {
          j = j + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    // Both functions should be analyzed independently
    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should handle loop inside conditional', () => {
    const source = `
      module Test

      function test(flag: boolean): void {
        if (flag) {
          let i: byte = 0;
          while (i < 10) {
            i = i + 1;
          }
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should handle loop immediately followed by conditional', () => {
    const source = `
      module Test

      function test(flag: boolean): void {
        let i: byte = 0;
        while (i < 10) {
          i = i + 1;
        }

        if (flag) {
          let x: byte = i;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should handle boolean condition in while loop', () => {
    const source = `
      module Test

      function test(): void {
        let running: boolean = true;
        let count: byte = 0;
        while (running) {
          count = count + 1;
          if (count > 10) {
            running = false;
          }
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('should handle comparison operators in loop condition', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 10;
        while (i > 0) {
          i = i - 1;
        }

        let j: byte = 0;
        while (j <= 5) {
          j = j + 1;
        }

        let k: byte = 0;
        while (k != 10) {
          k = k + 1;
        }
      }
    `;

    const { diagnostics } = analyzeLoops(source);

    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });
});

describe('LoopAnalyzer - Performance', () => {
  it('should handle many sequential loops efficiently', () => {
    const source = `
      module Test

      function test(): void {
        let a: byte = 0;
        while (a < 5) {
          a = a + 1;
        }

        let b: byte = 0;
        while (b < 5) {
          b = b + 1;
        }

        let c: byte = 0;
        while (c < 5) {
          c = c + 1;
        }

        let d: byte = 0;
        while (d < 5) {
          d = d + 1;
        }

        let e: byte = 0;
        while (e < 5) {
          e = e + 1;
        }
      }
    `;

    const startTime = Date.now();
    const { diagnostics } = analyzeLoops(source);
    const endTime = Date.now();

    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    // Should complete in reasonable time (< 1 second)
    expect(endTime - startTime).toBeLessThan(1000);
  });

  it('should converge quickly for complex nested structures', () => {
    const source = `
      module Test

      function test(): void {
        let i: byte = 0;
        while (i < 10) {
          let j: byte = 0;
          while (j < 10) {
            if (j > 5) {
              let x: byte = i + j;
            } else {
              let y: byte = i - j;
            }
            j = j + 1;
          }
          i = i + 1;
        }
      }
    `;

    const startTime = Date.now();
    const { diagnostics } = analyzeLoops(source);
    const endTime = Date.now();

    expect(diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    // Should complete in reasonable time
    expect(endTime - startTime).toBeLessThan(1000);
  });
});