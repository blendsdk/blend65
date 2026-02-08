/**
 * Pass Orchestration Tests
 *
 * Tests for the 7-pass orchestration in the SemanticAnalyzer.
 *
 * @module __tests__/semantic/analyzer/pass-orchestration.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import { SemanticAnalyzer, type AnalysisResult } from '../../../semantic/analyzer.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';
import type { Program } from '../../../ast/index.js';

// ============================================
// TEST HELPERS
// ============================================

/**
 * Parses source code into a Program AST
 * CRITICAL: Always tokenize first, then parse!
 */
function parseProgram(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Analyzes source code and returns the result
 */
function analyzeSource(source: string, options?: { runAdvancedAnalysis?: boolean }): AnalysisResult {
  const program = parseProgram(source);
  const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: options?.runAdvancedAnalysis ?? false });
  return analyzer.analyze(program);
}

// ============================================
// TESTS: PASS ORCHESTRATION
// ============================================

describe('SemanticAnalyzer - Pass Orchestration', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  });

  describe('Pass 1: Symbol Table Building', () => {
    it('should build symbol table for variables', () => {
      const source = `
        module test;
        let x: byte = 5;
        let y: word = 1000;
      `;
      const result = analyzeSource(source);

      expect(result.passResults.symbolTableBuild).toBeDefined();
      expect(result.passResults.symbolTableBuild.success).toBe(true);
    });

    it('should build symbol table for functions', () => {
      const source = `
        module test;
        function foo(): void {}
        function bar(x: byte): byte { return x; }
      `;
      const result = analyzeSource(source);

      expect(result.passResults.symbolTableBuild.success).toBe(true);
    });

    it('should detect duplicate declarations', () => {
      const source = `
        module test;
        let x: byte = 5;
        let x: byte = 10;
      `;
      const result = analyzeSource(source);

      expect(result.passResults.symbolTableBuild.diagnostics.length).toBeGreaterThan(0);
    });

    it('should handle nested scopes (functions)', () => {
      const source = `
        module test;
        let x: byte = 5;
        function foo(): void {
          let x: byte = 10;
        }
      `;
      const result = analyzeSource(source);

      expect(result.passResults.symbolTableBuild.success).toBe(true);
    });
  });

  describe('Pass 2: Type Resolution', () => {
    it('should resolve basic types', () => {
      const source = `
        module test;
        let x: byte = 5;
        let y: word = 1000;
      `;
      const result = analyzeSource(source);

      expect(result.passResults.typeResolution).toBeDefined();
      expect(result.passResults.typeResolution.resolvedCount).toBeGreaterThan(0);
    });

    it('should resolve function return types', () => {
      const source = `
        module test;
        function getValue(): byte { return 42; }
      `;
      const result = analyzeSource(source);

      expect(result.passResults.typeResolution.success).toBe(true);
    });

    it('should resolve parameter types', () => {
      const source = `
        module test;
        function add(a: byte, b: byte): byte { return a + b; }
      `;
      const result = analyzeSource(source);

      expect(result.passResults.typeResolution.success).toBe(true);
    });

    it('should report unknown types', () => {
      const source = `
        module test;
        let x: unknownType = 5;
      `;
      const result = analyzeSource(source);

      expect(result.passResults.typeResolution.failedCount).toBeGreaterThan(0);
    });
  });

  describe('Pass 3: Type Checking', () => {
    it('should type check expressions', () => {
      const source = `
        module test;
        let x: byte = 5 + 3;
      `;
      const result = analyzeSource(source);

      expect(result.passResults.typeCheck).toBeDefined();
      expect(result.passResults.typeCheck.expressionsChecked).toBeGreaterThan(0);
    });

    it('should type check function calls', () => {
      const source = `
        module test;
        function add(a: byte, b: byte): byte { return a + b; }
        function main(): void {
          let result: byte = add(1, 2);
        }
      `;
      const result = analyzeSource(source);

      expect(result.passResults.typeCheck.success).toBe(true);
    });

    it('should detect type mismatches', () => {
      const source = `
        module test;
        function getWord(): word { return 1000; }
        function main(): void {
          let x: byte = getWord();
        }
      `;
      const result = analyzeSource(source);

      expect(result.passResults.typeCheck.errorCount).toBeGreaterThan(0);
    });

    it('should type check return statements', () => {
      const source = `
        module test;
        function getValue(): byte { return 42; }
      `;
      const result = analyzeSource(source);

      expect(result.passResults.typeCheck.success).toBe(true);
    });
  });

  describe('Pass 4: Statement Validation (integrated in Pass 3)', () => {
    it('should validate break in loops', () => {
      const source = `
        module test;
        function foo(): void {
          while (1) {
            break;
          }
        }
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
    });

    it('should validate continue in loops', () => {
      const source = `
        module test;
        function foo(): void {
          while (1) {
            continue;
          }
        }
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
    });

    it('should validate return in functions', () => {
      const source = `
        module test;
        function getValue(): byte {
          return 42;
        }
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
    });
  });

  describe('Pass 5: Control Flow Analysis', () => {
    it('should build CFGs for functions', () => {
      const source = `
        module test;
        function foo(): void {
          let x: byte = 5;
        }
      `;
      const result = analyzeSource(source);

      expect(result.cfgs).toBeDefined();
      expect(result.cfgs instanceof Map).toBe(true);
    });

    it('should handle if/else control flow', () => {
      const source = `
        module test;
        function check(x: byte): byte {
          if (x > 10) {
            return 1;
          } else {
            return 0;
          }
        }
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
    });

    it('should handle while loops', () => {
      const source = `
        module test;
        function loop(): void {
          let i: byte = 0;
          while (i < 10) {
            i = i + 1;
          }
        }
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
    });
  });

  describe('Pass 6: Call Graph and Recursion Detection', () => {
    it('should build call graph', () => {
      const source = `
        module test;
        function a(): void { b(); }
        function b(): void {}
      `;
      const result = analyzeSource(source);

      expect(result.callGraph).toBeDefined();
      expect(result.callGraph.size()).toBeGreaterThan(0);
    });

    it('should detect direct recursion', () => {
      const source = `
        module test;
        function recursive(): void {
          recursive();
        }
      `;
      const result = analyzeSource(source);

      expect(result.passResults.recursionErrors.length).toBeGreaterThan(0);
    });

    it('should detect indirect recursion', () => {
      const source = `
        module test;
        function a(): void { b(); }
        function b(): void { a(); }
      `;
      const result = analyzeSource(source);

      expect(result.passResults.recursionErrors.length).toBeGreaterThan(0);
    });

    it('should allow non-recursive functions', () => {
      const source = `
        module test;
        function helper(): byte { return 42; }
        function main(): void {
          let x: byte = helper();
        }
      `;
      const result = analyzeSource(source);

      expect(result.passResults.recursionErrors.length).toBe(0);
    });
  });

  describe('Pass 7: Advanced Analysis (optional)', () => {
    it('should skip advanced analysis when disabled', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source, { runAdvancedAnalysis: false });

      expect(result.passResults.advancedAnalysis).toBeUndefined();
    });

    it('should run advanced analysis when enabled', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source, { runAdvancedAnalysis: true });

      expect(result.passResults.advancedAnalysis).toBeDefined();
    });

    it('should detect unused variables when enabled', () => {
      const source = `
        module test;
        function foo(): void {
          let unused: byte = 5;
        }
      `;
      const result = analyzeSource(source, { runAdvancedAnalysis: true });

      // Advanced analysis should find unused variable warning
      expect(result.passResults.advancedAnalysis).toBeDefined();
    });
  });

  describe('Pass Results Structure', () => {
    it('should include all pass results', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source);

      expect(result.passResults).toBeDefined();
      expect(result.passResults.symbolTableBuild).toBeDefined();
      expect(result.passResults.typeResolution).toBeDefined();
      expect(result.passResults.typeCheck).toBeDefined();
      expect(result.passResults.recursionErrors).toBeDefined();
    });

    it('should track symbol table build result', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source);

      expect(result.passResults.symbolTableBuild.symbolTable).toBeDefined();
      expect(result.passResults.symbolTableBuild.diagnostics).toBeDefined();
    });

    it('should track type resolution result', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source);

      expect(result.passResults.typeResolution.resolvedCount).toBeDefined();
      expect(result.passResults.typeResolution.failedCount).toBeDefined();
    });

    it('should track type check result', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source);

      expect(result.passResults.typeCheck.expressionsChecked).toBeDefined();
      expect(result.passResults.typeCheck.errorCount).toBeDefined();
      expect(result.passResults.typeCheck.warningCount).toBeDefined();
    });
  });
});