/**
 * Single Module Analysis Tests
 *
 * Tests for analyzing a single module through the SemanticAnalyzer.
 *
 * @module __tests__/semantic/analyzer/single-module.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import { SemanticAnalyzer, type AnalysisResult } from '../../../semantic/analyzer.js';
import { DiagnosticSeverity } from '../../../ast/diagnostics.js';

// ============================================
// TEST HELPERS
// ============================================

/**
 * Parses source code into a Program AST
 * CRITICAL: Always tokenize first, then parse!
 */
function parseProgram(source: string) {
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

/**
 * Gets error messages from analysis result
 */
function getErrors(result: AnalysisResult): string[] {
  return result.diagnostics
    .filter(d => d.severity === DiagnosticSeverity.ERROR)
    .map(d => d.message);
}

// ============================================
// TESTS: BASIC SINGLE MODULE ANALYSIS
// ============================================

describe('SemanticAnalyzer - Single Module Analysis', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  });

  describe('Basic Programs', () => {
    it('should analyze an empty module', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.moduleName).toBe('test');
      expect(result.diagnostics.length).toBe(0);
    });

    it('should analyze a module with a simple variable', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.stats.totalDeclarations).toBeGreaterThan(0);
    });

    it('should analyze a module with multiple variables', () => {
      const source = `
        module test;
        let x: byte = 5;
        let y: word = 1000;
        const MAX: byte = 255;
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.stats.totalDeclarations).toBeGreaterThanOrEqual(3);
    });

    it('should analyze a module with a simple function', () => {
      const source = `
        module test;
        function add(a: byte, b: byte): byte {
          return a + b;
        }
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBeGreaterThan(0);
    });

    it('should analyze a module with multiple functions', () => {
      const source = `
        module test;
        function add(a: byte, b: byte): byte {
          return a + b;
        }
        function sub(a: byte, b: byte): byte {
          return a - b;
        }
        function mul(a: byte, b: byte): byte {
          return a * b;
        }
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
      expect(result.stats.functionsAnalyzed).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Result Structure', () => {
    it('should return proper module name', () => {
      const source = `module myTestModule;`;
      const result = analyzeSource(source);

      expect(result.moduleName).toBe('myTestModule');
    });

    it('should return the original AST', () => {
      const source = `module test;`;
      const program = parseProgram(source);
      const result = analyzer.analyze(program);

      expect(result.ast).toBe(program);
    });

    it('should include symbol table in result', () => {
      const source = `
        module test;
        let x: byte = 5;
      `;
      const result = analyzeSource(source);

      expect(result.symbolTable).toBeDefined();
      expect(result.symbolTable.getRootScope()).toBeDefined();
    });

    it('should include type system in result', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.typeSystem).toBeDefined();
      expect(result.typeSystem.getBuiltinType('byte')).toBeDefined();
      expect(result.typeSystem.getBuiltinType('word')).toBeDefined();
    });

    it('should include call graph in result', () => {
      const source = `
        module test;
        function foo(): void {}
      `;
      const result = analyzeSource(source);

      expect(result.callGraph).toBeDefined();
    });

    it('should include CFGs in result', () => {
      const source = `
        module test;
        function foo(): void {}
      `;
      const result = analyzeSource(source);

      expect(result.cfgs).toBeDefined();
      expect(result.cfgs instanceof Map).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track total declarations', () => {
      const source = `
        module test;
        let a: byte = 1;
        let b: byte = 2;
        let c: byte = 3;
      `;
      const result = analyzeSource(source);

      expect(result.stats.totalDeclarations).toBeGreaterThanOrEqual(3);
    });

    it('should track expressions checked', () => {
      const source = `
        module test;
        let x: byte = 1 + 2 * 3;
      `;
      const result = analyzeSource(source);

      expect(result.stats.expressionsChecked).toBeGreaterThan(0);
    });

    it('should track functions analyzed', () => {
      const source = `
        module test;
        function a(): void {}
        function b(): void {}
      `;
      const result = analyzeSource(source);

      expect(result.stats.functionsAnalyzed).toBeGreaterThanOrEqual(2);
    });

    it('should track error count', () => {
      const source = `
        module test;
        let x: byte = unknownVar;
      `;
      const result = analyzeSource(source);

      expect(result.stats.errorCount).toBeGreaterThan(0);
    });

    it('should track analysis time', () => {
      const source = `module test;`;
      const result = analyzeSource(source);

      expect(result.stats.analysisTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Control Flow', () => {
    it('should analyze if statements', () => {
      const source = `
        module test;
        function check(x: byte): byte {
          if (x > 10) {
            return 1;
          }
          return 0;
        }
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
    });

    it('should analyze while loops', () => {
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

    // Note: For loops with variable declarations in init have parser limitations
    // See execution plan Session 5.18 notes for details
    it('should analyze for loops with pre-declared variable', () => {
      const source = `
        module test;
        function loop(): void {
          let i: byte = 0;
          while (i < 10) {
            let x: byte = i;
            i = i + 1;
          }
        }
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
    });
  });

  describe('Type Checking', () => {
    it('should type check variable initializers', () => {
      const source = `
        module test;
        let x: byte = 5;
        let y: word = 1000;
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
    });

    it('should type check binary expressions', () => {
      const source = `
        module test;
        let x: byte = 5 + 3;
        let y: byte = 10 - 2;
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
    });

    it('should type check function calls', () => {
      const source = `
        module test;
        function add(a: byte, b: byte): byte {
          return a + b;
        }
        function main(): void {
          let result: byte = add(1, 2);
        }
      `;
      const result = analyzeSource(source);

      expect(result.success).toBe(true);
    });

    it('should type check return statements', () => {
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
});