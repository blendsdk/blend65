/**
 * Multi-Module Analysis Tests
 *
 * Tests for analyzing multiple modules together through the SemanticAnalyzer.
 *
 * @module __tests__/semantic/analyzer/multi-module.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import { SemanticAnalyzer, type MultiModuleAnalysisResult } from '../../../semantic/analyzer.js';
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
 * Gets error messages from multi-module result
 */
function getErrors(result: MultiModuleAnalysisResult): string[] {
  return result.diagnostics
    .filter(d => d.severity === DiagnosticSeverity.ERROR)
    .map(d => d.message);
}

// ============================================
// TESTS: MULTI-MODULE ANALYSIS
// ============================================

describe('SemanticAnalyzer - Multi-Module Analysis', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  });

  describe('Basic Multi-Module', () => {
    it('should analyze two independent modules', () => {
      const module1 = parseProgram(`
        module moduleA;
        let x: byte = 5;
      `);
      const module2 = parseProgram(`
        module moduleB;
        let y: byte = 10;
      `);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.success).toBe(true);
      expect(result.modules.size).toBe(2);
      expect(result.modules.has('moduleA')).toBe(true);
      expect(result.modules.has('moduleB')).toBe(true);
    });

    it('should analyze three independent modules', () => {
      const module1 = parseProgram(`module a;`);
      const module2 = parseProgram(`module b;`);
      const module3 = parseProgram(`module c;`);

      const result = analyzer.analyzeMultiple([module1, module2, module3]);

      expect(result.success).toBe(true);
      expect(result.modules.size).toBe(3);
    });

    it('should handle empty module list', () => {
      const result = analyzer.analyzeMultiple([]);

      expect(result.success).toBe(true);
      expect(result.modules.size).toBe(0);
    });

    it('should handle single module in list', () => {
      const module1 = parseProgram(`module single;`);

      const result = analyzer.analyzeMultiple([module1]);

      expect(result.success).toBe(true);
      expect(result.modules.size).toBe(1);
      expect(result.modules.has('single')).toBe(true);
    });
  });

  describe('Module with Exports', () => {
    it('should collect exported variables', () => {
      const module1 = parseProgram(`
        module math;
        export let PI: word = 314;
      `);
      const module2 = parseProgram(`module main;`);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.success).toBe(true);
      expect(result.globalSymbolTable).toBeDefined();
    });

    it('should collect exported functions', () => {
      const module1 = parseProgram(`
        module utils;
        export function add(a: byte, b: byte): byte {
          return a + b;
        }
      `);
      const module2 = parseProgram(`module main;`);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.success).toBe(true);
    });

    it('should collect multiple exports from one module', () => {
      const module1 = parseProgram(`
        module math;
        export let PI: word = 314;
        export const E: word = 271;
        export function add(a: byte, b: byte): byte {
          return a + b;
        }
      `);

      const result = analyzer.analyzeMultiple([module1]);

      expect(result.success).toBe(true);
    });
  });

  describe('Compilation Order', () => {
    it('should provide compilation order for independent modules', () => {
      const module1 = parseProgram(`module a;`);
      const module2 = parseProgram(`module b;`);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.compilationOrder).toBeDefined();
      expect(result.compilationOrder.length).toBe(2);
      expect(result.compilationOrder).toContain('a');
      expect(result.compilationOrder).toContain('b');
    });

    it('should include all modules in compilation order', () => {
      const modules = [
        parseProgram(`module x;`),
        parseProgram(`module y;`),
        parseProgram(`module z;`),
      ];

      const result = analyzer.analyzeMultiple(modules);

      expect(result.compilationOrder.length).toBe(3);
    });
  });

  describe('Global Symbol Table', () => {
    it('should create global symbol table', () => {
      const module1 = parseProgram(`
        module lib;
        export let value: byte = 42;
      `);

      const result = analyzer.analyzeMultiple([module1]);

      expect(result.globalSymbolTable).toBeDefined();
    });

    it('should aggregate exports from multiple modules', () => {
      const module1 = parseProgram(`
        module lib1;
        export let a: byte = 1;
      `);
      const module2 = parseProgram(`
        module lib2;
        export let b: byte = 2;
      `);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.globalSymbolTable).toBeDefined();
    });
  });

  describe('Dependency Graph', () => {
    it('should create dependency graph', () => {
      const module1 = parseProgram(`module a;`);
      const module2 = parseProgram(`module b;`);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.dependencyGraph).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should track total modules', () => {
      const modules = [
        parseProgram(`module a;`),
        parseProgram(`module b;`),
        parseProgram(`module c;`),
      ];

      const result = analyzer.analyzeMultiple(modules);

      expect(result.stats.totalModules).toBe(3);
    });

    it('should track total declarations across modules', () => {
      const module1 = parseProgram(`
        module a;
        let x: byte = 1;
        let y: byte = 2;
      `);
      const module2 = parseProgram(`
        module b;
        let z: byte = 3;
      `);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.stats.totalDeclarations).toBeGreaterThanOrEqual(3);
    });

    it('should track total errors across modules', () => {
      const module1 = parseProgram(`
        module a;
        let x: byte = unknownA;
      `);
      const module2 = parseProgram(`
        module b;
        let y: byte = unknownB;
      `);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.stats.totalErrors).toBeGreaterThanOrEqual(2);
    });

    it('should track total time', () => {
      const modules = [
        parseProgram(`module a;`),
        parseProgram(`module b;`),
      ];

      const result = analyzer.analyzeMultiple(modules);

      expect(result.stats.totalTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Per-Module Results', () => {
    it('should provide per-module analysis results', () => {
      const module1 = parseProgram(`
        module a;
        let x: byte = 5;
      `);
      const module2 = parseProgram(`
        module b;
        let y: byte = 10;
      `);

      const result = analyzer.analyzeMultiple([module1, module2]);

      const resultA = result.modules.get('a');
      const resultB = result.modules.get('b');

      expect(resultA).toBeDefined();
      expect(resultB).toBeDefined();
      expect(resultA!.moduleName).toBe('a');
      expect(resultB!.moduleName).toBe('b');
    });

    it('should have individual symbol tables per module', () => {
      const module1 = parseProgram(`
        module a;
        let x: byte = 5;
      `);
      const module2 = parseProgram(`
        module b;
        let y: byte = 10;
      `);

      const result = analyzer.analyzeMultiple([module1, module2]);

      const resultA = result.modules.get('a');
      const resultB = result.modules.get('b');

      expect(resultA!.symbolTable).toBeDefined();
      expect(resultB!.symbolTable).toBeDefined();
      // Symbol tables should be different instances
      expect(resultA!.symbolTable).not.toBe(resultB!.symbolTable);
    });
  });

  describe('Error Handling', () => {
    it('should collect errors from all modules', () => {
      const module1 = parseProgram(`
        module a;
        let x: byte = unknownA;
      `);
      const module2 = parseProgram(`
        module b;
        let y: byte = unknownB;
      `);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);
    });

    it('should mark success false if any module has errors', () => {
      const module1 = parseProgram(`module a;`);
      const module2 = parseProgram(`
        module b;
        let x: byte = unknownVar;
      `);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.success).toBe(false);
    });

    it('should mark success true if all modules pass', () => {
      const module1 = parseProgram(`
        module a;
        let x: byte = 5;
      `);
      const module2 = parseProgram(`
        module b;
        let y: byte = 10;
      `);

      const result = analyzer.analyzeMultiple([module1, module2]);

      expect(result.success).toBe(true);
    });
  });
});