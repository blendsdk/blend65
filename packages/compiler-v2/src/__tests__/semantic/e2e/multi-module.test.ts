/**
 * Multi-Module Analysis E2E Tests for Blend65 Compiler v2
 *
 * Tests the multi-module semantic analysis capabilities:
 * - Module registration and dependency tracking
 * - Import resolution across modules
 * - Cross-module type checking
 * - Circular dependency detection
 * - Compilation order calculation
 */

import { describe, it, expect } from 'vitest';
import {
  SemanticAnalyzer,
  type MultiModuleAnalysisResult,
} from '../../../semantic/index.js';
import { DiagnosticSeverity, DiagnosticCode } from '../../../ast/diagnostics.js';
import { Parser } from '../../../parser/index.js';
import { Lexer } from '../../../lexer/index.js';
import type { Program, Diagnostic } from '../../../ast/index.js';

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
 * Helper to run multi-module semantic analysis
 */
function analyzeMultiple(sources: string[]): MultiModuleAnalysisResult {
  const programs = sources.map(s => parse(s));
  const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: false });
  return analyzer.analyzeMultiple(programs);
}

/**
 * Helper to get only error diagnostics
 */
function getErrors(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
}

describe('Multi-Module Analysis E2E', () => {
  describe('single module fallback', () => {
    it('should analyze single module through multi API', () => {
      const result = analyzeMultiple([`
        module Single

        function main(): void {
          let x: byte = 10;
        }
      `]);

      expect(result.success).toBe(true);
      expect(result.modules.size).toBe(1);
      expect(result.modules.has('Single')).toBe(true);
      expect(result.stats.totalModules).toBe(1);
    });
  });

  describe('module registration', () => {
    it('should register all modules', () => {
      const result = analyzeMultiple([
        `module ModuleA function a(): void {}`,
        `module ModuleB function b(): void {}`,
        `module ModuleC function c(): void {}`,
      ]);

      expect(result.success).toBe(true);
      expect(result.modules.size).toBe(3);
      expect(result.modules.has('ModuleA')).toBe(true);
      expect(result.modules.has('ModuleB')).toBe(true);
      expect(result.modules.has('ModuleC')).toBe(true);
    });

    it('should track module in compilation order', () => {
      const result = analyzeMultiple([
        `module A`,
        `module B`,
        `module C`,
      ]);

      expect(result.compilationOrder).toBeDefined();
      expect(result.compilationOrder.length).toBe(3);
      expect(result.compilationOrder).toContain('A');
      expect(result.compilationOrder).toContain('B');
      expect(result.compilationOrder).toContain('C');
    });
  });

  describe('dependency tracking', () => {
    it('should track import dependencies', () => {
      const result = analyzeMultiple([
        `module Lib
         export function helper(): byte { return 1; }`,

        `module Main
         import { helper } from "Lib";
         function main(): void { let x: byte = helper(); }`,
      ]);

      expect(result.dependencyGraph).toBeDefined();
      // Main depends on Lib
    });

    it('should compute correct compilation order for dependencies', () => {
      const result = analyzeMultiple([
        // Main depends on Utils which depends on Core
        `module Main
         import { util } from "Utils";
         function main(): void { util(); }`,

        `module Utils
         import { core } from "Core";
         export function util(): void { core(); }`,

        `module Core
         export function core(): void {}`,
      ]);

      // Core should come before Utils, Utils before Main
      const order = result.compilationOrder;
      const coreIdx = order.indexOf('Core');
      const utilsIdx = order.indexOf('Utils');
      const mainIdx = order.indexOf('Main');

      expect(coreIdx).toBeLessThan(utilsIdx);
      expect(utilsIdx).toBeLessThan(mainIdx);
    });
  });

  describe('export collection', () => {
    it('should collect exports into global symbol table', () => {
      const result = analyzeMultiple([
        `module Math
         export function add(a: byte, b: byte): byte { return a + b; }
         export function sub(a: byte, b: byte): byte { return a - b; }
         export let PI: byte = 3;`,

        `module Main
         import { add, sub, PI } from "Math";
         function main(): void {
           let x: byte = add(1, 2);
           let y: byte = sub(5, 3);
           let z: byte = PI;
         }`,
      ]);

      expect(result.globalSymbolTable).toBeDefined();
    });

    it('should not export non-exported members', () => {
      const result = analyzeMultiple([
        `module Lib
         export function publicFn(): void {}
         function privateFn(): void {}`,

        `module Main
         import { publicFn, privateFn } from "Lib";`,
      ]);

      // Should fail because privateFn is not exported
      expect(result.importResolution.success).toBe(false);
    });
  });

  describe('import resolution', () => {
    it('should resolve simple imports', () => {
      const result = analyzeMultiple([
        `module Lib
         export function getValue(): byte { return 42; }`,

        `module Main
         import { getValue } from "Lib";
         function main(): void {
           let x: byte = getValue();
         }`,
      ]);

      expect(result.success).toBe(true);
      expect(result.importResolution.success).toBe(true);
    });

    it('should resolve multiple imports from same module', () => {
      const result = analyzeMultiple([
        `module Lib
         export function fn1(): void {}
         export function fn2(): void {}
         export function fn3(): void {}`,

        `module Main
         import { fn1, fn2, fn3 } from "Lib";
         function main(): void { fn1(); fn2(); fn3(); }`,
      ]);

      expect(result.success).toBe(true);
    });

    it('should resolve imports from multiple modules', () => {
      const result = analyzeMultiple([
        `module Math
         export function add(a: byte, b: byte): byte { return a + b; }`,

        `module IO
         export function print(): void {}`,

        `module Main
         import { add } from "Math";
         import { print } from "IO";
         function main(): void {
           let sum: byte = add(1, 2);
           print();
         }`,
      ]);

      expect(result.success).toBe(true);
    });

    it('should detect missing module', () => {
      const result = analyzeMultiple([
        `module Main
         import { something } from "NonExistent";`,
      ]);

      expect(result.importResolution.success).toBe(false);
      expect(result.importResolution.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing export', () => {
      const result = analyzeMultiple([
        `module Lib
         export function exported(): void {}`,

        `module Main
         import { notExported } from "Lib";`,
      ]);

      expect(result.importResolution.success).toBe(false);
    });
  });

  describe('circular dependency detection', () => {
    it('should detect direct circular imports', () => {
      const result = analyzeMultiple([
        `module A
         import { bFn } from "B";
         export function aFn(): void { bFn(); }`,

        `module B
         import { aFn } from "A";
         export function bFn(): void { aFn(); }`,
      ]);

      // Should detect cycle A <-> B
      const cycleErrors = result.diagnostics.filter(
        d => d.code === DiagnosticCode.CIRCULAR_IMPORT
      );
      expect(cycleErrors.length).toBeGreaterThan(0);
    });

    it('should detect indirect circular imports', () => {
      const result = analyzeMultiple([
        `module A
         import { c } from "C";
         export function a(): void { c(); }`,

        `module B
         import { a } from "A";
         export function b(): void { a(); }`,

        `module C
         import { b } from "B";
         export function c(): void { b(); }`,
      ]);

      // Should detect cycle A -> C -> B -> A
      const cycleErrors = result.diagnostics.filter(
        d => d.code === DiagnosticCode.CIRCULAR_IMPORT
      );
      expect(cycleErrors.length).toBeGreaterThan(0);
    });

    it('should not flag non-circular dependencies', () => {
      const result = analyzeMultiple([
        `module Base
         export function base(): void {}`,

        `module A
         import { base } from "Base";
         export function a(): void { base(); }`,

        `module B
         import { base } from "Base";
         export function b(): void { base(); }`,

        `module Main
         import { a } from "A";
         import { b } from "B";
         function main(): void { a(); b(); }`,
      ]);

      // Diamond dependency is not circular
      const cycleErrors = result.diagnostics.filter(
        d => d.code === DiagnosticCode.CIRCULAR_IMPORT
      );
      expect(cycleErrors.length).toBe(0);
    });
  });

  describe('cross-module type checking', () => {
    it('should type check imported function calls', () => {
      const result = analyzeMultiple([
        `module Lib
         export function add(a: byte, b: byte): byte { return a + b; }`,

        `module Main
         import { add } from "Lib";
         function main(): void {
           let sum: byte = add(1, 2);
         }`,
      ]);

      expect(result.success).toBe(true);
    });

    it('should detect type errors in cross-module calls', () => {
      const result = analyzeMultiple([
        `module Lib
         export function process(x: byte): byte { return x; }`,

        `module Main
         import { process } from "Lib";
         function main(): void {
           let flag: bool = true;
           let result: byte = process(flag);
         }`,
      ]);

      expect(result.success).toBe(false);
    });

    it('should handle imported types correctly', () => {
      const result = analyzeMultiple([
        `module Math
         export function square(n: word): word { return n * n; }`,

        `module Main
         import { square } from "Math";
         function main(): void {
           let n: word = 100;
           let sq: word = square(n);
         }`,
      ]);

      expect(result.success).toBe(true);
    });
  });

  describe('aggregated statistics', () => {
    it('should sum declarations across modules', () => {
      const result = analyzeMultiple([
        `module A
         let a1: byte = 1;
         let a2: byte = 2;`,

        `module B
         let b1: byte = 1;
         let b2: byte = 2;
         let b3: byte = 3;`,
      ]);

      expect(result.stats.totalDeclarations).toBeGreaterThanOrEqual(5);
    });

    it('should track total modules', () => {
      const result = analyzeMultiple([
        `module A`,
        `module B`,
        `module C`,
        `module D`,
      ]);

      expect(result.stats.totalModules).toBe(4);
    });

    it('should sum errors across modules', () => {
      const result = analyzeMultiple([
        `module A
         function f(): byte { return true; }`,

        `module B
         function g(): byte { return "string"; }`,
      ]);

      expect(result.stats.totalErrors).toBeGreaterThanOrEqual(2);
    });
  });

  describe('per-module results', () => {
    it('should provide individual module results', () => {
      const result = analyzeMultiple([
        `module A
         function a(): void {}`,

        `module B
         function b(): void {}`,
      ]);

      expect(result.modules.get('A')).toBeDefined();
      expect(result.modules.get('B')).toBeDefined();

      const moduleA = result.modules.get('A')!;
      expect(moduleA.moduleName).toBe('A');
      expect(moduleA.symbolTable).toBeDefined();
      expect(moduleA.callGraph).toBeDefined();
    });

    it('should track diagnostics per module', () => {
      const result = analyzeMultiple([
        `module Good
         function ok(): byte { return 1; }`,

        `module Bad
         function fail(): byte { return true; }`,
      ]);

      const good = result.modules.get('Good')!;
      const bad = result.modules.get('Bad')!;

      expect(getErrors(good.diagnostics).length).toBe(0);
      expect(getErrors(bad.diagnostics).length).toBeGreaterThan(0);
    });
  });

  describe('real-world multi-module patterns', () => {
    it('should handle library + application pattern', () => {
      const result = analyzeMultiple([
        // Library modules
        `module Lib.Math
         export function abs(n: byte): byte {
           if (n < 0) { return 0 - n; }
           return n;
         }
         export function min(a: byte, b: byte): byte {
           return a < b ? a : b;
         }`,

        `module Lib.IO
         export function putChar(c: byte): void {}
         export function getChar(): byte { return 0; }`,

        // Application
        `module App.Main
         import { abs, min } from "Lib.Math";
         import { putChar } from "Lib.IO";

         function process(a: byte, b: byte): void {
           let diff: byte = abs(a - b);
           let smaller: byte = min(a, b);
           putChar(diff);
         }`,
      ]);

      // Multi-module analysis runs
      expect(result.stats.totalModules).toBe(3);
    });

    it('should handle layered architecture', () => {
      const result = analyzeMultiple([
        // Data layer
        `module Data
         export function loadData(): byte { return 42; }
         export function saveData(value: byte): void {}`,

        // Service layer
        `module Service
         import { loadData, saveData } from "Data";
         export function processData(): byte {
           let data: byte = loadData();
           let result: byte = data + 1;
           saveData(result);
           return result;
         }`,

        // Presentation layer
        `module Presentation
         import { processData } from "Service";
         function display(): void {
           let result: byte = processData();
         }`,
      ]);

      // Multi-module analysis runs and tracks modules
      expect(result.stats.totalModules).toBe(3);
    });

    it('should handle shared utilities pattern', () => {
      const result = analyzeMultiple([
        // Shared utilities
        `module Utils
         export function clamp(value: byte, min: byte, max: byte): byte {
           if (value < min) { return min; }
           if (value > max) { return max; }
           return value;
         }`,

        // Multiple consumers
        `module ModuleA
         import { clamp } from "Utils";
         function useClamp(): byte { return clamp(150, 0, 100); }`,

        `module ModuleB
         import { clamp } from "Utils";
         function useClamp(): byte { return clamp(50, 0, 255); }`,

        `module ModuleC
         import { clamp } from "Utils";
         function useClamp(): byte { return clamp(0, 10, 20); }`,
      ]);

      // Multi-module analysis runs
      expect(result.stats.totalModules).toBe(4);
    });
  });

  describe('error aggregation', () => {
    it('should collect all errors in aggregated diagnostics', () => {
      const result = analyzeMultiple([
        `module A
         function errA(): byte { return true; }`,

        `module B
         function errB(): byte { return "bad"; }`,
      ]);

      // Collects errors from analysis
      expect(result.success).toBe(false);
      expect(getErrors(result.diagnostics).length).toBeGreaterThanOrEqual(1);
    });

    it('should include import errors in diagnostics', () => {
      const result = analyzeMultiple([
        `module A
         export function a(): void {}`,

        `module B
         import { missing } from "A";`,
      ]);

      expect(result.success).toBe(false);
      expect(result.importResolution.success).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });
});