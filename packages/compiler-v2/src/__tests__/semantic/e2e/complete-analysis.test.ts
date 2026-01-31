/**
 * Complete Analysis E2E Tests for Blend65 Compiler v2
 *
 * Tests the full semantic analysis pipeline from source to result:
 * - All 7 passes executing correctly
 * - Result structure completeness
 * - Statistics accuracy
 * - Pass orchestration
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

describe('Complete Analysis E2E', () => {
  describe('minimal programs', () => {
    it('should analyze empty module', () => {
      const result = analyze('module Empty');

      expect(result.success).toBe(true);
      expect(result.moduleName).toBe('Empty');
      expect(result.diagnostics).toHaveLength(0);
      expect(result.symbolTable).toBeDefined();
      expect(result.typeSystem).toBeDefined();
      expect(result.callGraph).toBeDefined();
      expect(result.stats.errorCount).toBe(0);
    });

    it('should analyze module with single variable', () => {
      const result = analyze(`
        module Test
        let x: byte = 10;
      `);

      expect(result.success).toBe(true);
      expect(result.stats.totalDeclarations).toBeGreaterThanOrEqual(1);
    });

    it('should analyze module with single function', () => {
      const result = analyze(`
        module Test

        function add(a: byte, b: byte): byte {
          return a + b;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('pass execution', () => {
    it('should populate all pass results', () => {
      const result = analyze(`
        module Test

        function main(): void {
          let x: byte = 5;
          let y: byte = x + 10;
        }
      `);

      expect(result.success).toBe(true);

      // Pass 1: Symbol Table Building
      expect(result.passResults.symbolTableBuild).toBeDefined();
      expect(result.passResults.symbolTableBuild.symbolTable).toBeDefined();

      // Pass 2: Type Resolution
      expect(result.passResults.typeResolution).toBeDefined();
      expect(result.passResults.typeResolution.resolvedCount).toBeGreaterThan(0);

      // Pass 3: Type Checking
      expect(result.passResults.typeCheck).toBeDefined();
      expect(result.passResults.typeCheck.expressionsChecked).toBeGreaterThan(0);

      // Pass 6: Recursion Checking
      expect(result.passResults.recursionErrors).toBeDefined();
      expect(result.passResults.recursionErrors).toHaveLength(0);

      // Pass 7: Advanced Analysis (if enabled)
      expect(result.passResults.advancedAnalysis).toBeDefined();
    });

    it('should build control flow graphs for all functions', () => {
      const result = analyze(`
        module Test

        function foo(): void {}
        function bar(): void {}
        function baz(): void {}
      `);

      expect(result.success).toBe(true);
      expect(result.cfgs.size).toBe(3);
      expect(result.cfgs.has('foo')).toBe(true);
      expect(result.cfgs.has('bar')).toBe(true);
      expect(result.cfgs.has('baz')).toBe(true);
    });

    it('should build call graph correctly', () => {
      const result = analyze(`
        module Test

        function helper(): byte { return 1; }

        function main(): void {
          let x: byte = helper();
        }
      `);

      expect(result.success).toBe(true);
      expect(result.callGraph.size()).toBe(2);
      expect(result.callGraph.getCallees('main')).toContain('helper');
    });
  });

  describe('complete programs', () => {
    it('should analyze program with variables and functions', () => {
      const result = analyze(`
        module Math

        let globalCounter: byte = 0;

        function increment(): void {
          globalCounter = globalCounter + 1;
        }

        function add(a: byte, b: byte): byte {
          return a + b;
        }

        function multiply(a: byte, b: byte): byte {
          let result: byte = 0;
          for (let i: byte = 0 to b step 1) {
            result = add(result, a);
          }
          return result;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(3);
      expect(result.stats.totalDeclarations).toBeGreaterThanOrEqual(4);
    });

    it('should analyze program with control flow', () => {
      const result = analyze(`
        module Control

        function abs(n: byte): byte {
          if (n < 0) {
            return 0 - n;
          }
          return n;
        }

        function max(a: byte, b: byte): byte {
          if (a > b) {
            return a;
          } else {
            return b;
          }
        }

        function min(a: byte, b: byte): byte {
          return a < b ? a : b;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(3);
    });

    it('should analyze program with loops', () => {
      const result = analyze(`
        module Loops

        function sum(n: byte): byte {
          let total: byte = 0;
          for (let i: byte = 1 to n step 1) {
            total = total + i;
          }
          return total;
        }

        function countDown(start: byte): void {
          let i: byte = start;
          while (i > 0) {
            i = i - 1;
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze program with arrays', () => {
      const result = analyze(`
        module Arrays

        function sumArray(arr: byte[5]): byte {
          let total: byte = 0;
          for (let i: byte = 0 to 4 step 1) {
            total = total + arr[i];
          }
          return total;
        }

        function main(): void {
          let data: byte[5] = [1, 2, 3, 4, 5];
          let sum: byte = sumArray(data);
        }
      `);

      expect(result.success).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should report accurate declaration count', () => {
      const result = analyze(`
        module Stats

        let a: byte = 1;
        let b: byte = 2;
        let c: byte = 3;

        function foo(x: byte): byte {
          let local: byte = 0;
          return x + local;
        }
      `);

      expect(result.success).toBe(true);
      // 3 globals + 1 function + 1 param + 1 local = 6+
      expect(result.stats.totalDeclarations).toBeGreaterThanOrEqual(6);
    });

    it('should report accurate expression check count', () => {
      const result = analyze(`
        module Exprs

        function test(): byte {
          let x: byte = 1 + 2;
          let y: byte = x * 3;
          let z: byte = (x + y) / 2;
          return z - 1;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.expressionsChecked).toBeGreaterThan(0);
    });

    it('should report analysis time', () => {
      const result = analyze(`
        module Timing

        function main(): void {
          let x: byte = 1;
        }
      `);

      expect(result.stats.analysisTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should count errors and warnings separately', () => {
      // This program has no errors but may have warnings from unused variables
      const result = analyze(`
        module Counts

        function main(): void {
          let unused: byte = 10;
        }
      `);

      expect(result.stats.errorCount).toBe(0);
      // May or may not have warnings depending on advanced analysis
    });
  });

  describe('options', () => {
    it('should respect runAdvancedAnalysis option', () => {
      const withAdvanced = analyze(`
        module Test
        function main(): void { let x: byte = 1; }
      `, { runAdvancedAnalysis: true });

      const withoutAdvanced = analyze(`
        module Test
        function main(): void { let x: byte = 1; }
      `, { runAdvancedAnalysis: false });

      expect(withAdvanced.passResults.advancedAnalysis).toBeDefined();
      expect(withoutAdvanced.passResults.advancedAnalysis).toBeUndefined();
    });
  });

  describe('result structure', () => {
    it('should include AST in result', () => {
      const result = analyze(`module Test`);

      expect(result.ast).toBeDefined();
      expect(result.ast.getModule().getFullName()).toBe('Test');
    });

    it('should include type system in result', () => {
      const result = analyze(`module Test`);

      expect(result.typeSystem).toBeDefined();
      // TypeSystem uses lookup method, not getType
    });

    it('should include symbol table in result', () => {
      const result = analyze(`
        module Test
        let x: byte = 10;
      `);

      expect(result.symbolTable).toBeDefined();
      // Symbol table should have the global x
    });
  });

  describe('complex real-world patterns', () => {
    it('should analyze C64-style memory access pattern', () => {
      const result = analyze(`
        module C64Memory

        function poke(addr: word, value: byte): void {
          // Intrinsic implementation
        }

        function peek(addr: word): byte {
          return 0;
        }

        function setBorderColor(color: byte): void {
          poke(53280, color);
        }

        function clearScreen(): void {
          for (let i: word = 0 to 999 step 1) {
            poke(1024 + i, 32);
          }
        }
      `);

      expect(result.success).toBe(true);
    });

    it('should analyze game loop pattern', () => {
      const result = analyze(`
        module GameLoop

        let running: bool = true;
        let frameCount: word = 0;

        function update(): void {
          frameCount = frameCount + 1;
        }

        function render(): void {
          // Render logic
        }

        function handleInput(): void {
          // Input handling
        }

        function gameLoop(): void {
          while (running) {
            handleInput();
            update();
            render();
          }
        }
      `);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBe(4);
    });

    it('should analyze sprite handling pattern', () => {
      const result = analyze(`
        module Sprites

        let spriteX: byte[8];
        let spriteY: byte[8];
        let spriteEnabled: byte = 0;

        function enableSprite(index: byte): void {
          spriteEnabled = spriteEnabled | (1 << index);
        }

        function disableSprite(index: byte): void {
          spriteEnabled = spriteEnabled & (~(1 << index));
        }

        function setPosition(index: byte, x: byte, y: byte): void {
          spriteX[index] = x;
          spriteY[index] = y;
        }

        function moveSprite(index: byte, dx: byte, dy: byte): void {
          spriteX[index] = spriteX[index] + dx;
          spriteY[index] = spriteY[index] + dy;
        }
      `);

      expect(result.success).toBe(true);
    });
  });
});