/**
 * Tests for Task 6.2.2: Module Analysis Ordering
 *
 * Tests the multi-module analysis orchestration that processes
 * modules in dependency order and builds global symbol table.
 *
 * Coverage:
 * - Analyze modules in topological order
 * - Collect per-module results
 * - Build global symbol table from results
 * - Handle empty module lists
 * - Verify compilation order correctness
 * - Integration with existing single-module tests
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SemanticAnalyzer } from '../../semantic/analyzer.js';
import type { Program } from '../../ast/nodes.js';

/**
 * Helper: Parse a module from source code
 */
function parseModule(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

describe('Task 6.2.2: Module Analysis Ordering', () => {
  describe('Empty and Single Module', () => {
    it('should handle empty module list', () => {
      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([]);

      expect(result.success).toBe(true);
      expect(result.modules.size).toBe(0);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.globalSymbolTable).toBeDefined();
      expect(result.dependencyGraph).toBeDefined();
    });

    it('should analyze single module without imports', () => {
      const source = `
        module Test
        export let counter: byte = 0;
        export function increment(): void
          counter = counter + 1;
        end function
      `;

      const program = parseModule(source);
      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([program]);

      expect(result.success).toBe(true);
      expect(result.modules.size).toBe(1);
      expect(result.modules.has('Test')).toBe(true);

      const moduleResult = result.modules.get('Test')!;
      expect(moduleResult.moduleName).toBe('Test');
      expect(moduleResult.symbolTable).toBeDefined();
      expect(moduleResult.typeSystem).toBeDefined();
      expect(moduleResult.success).toBe(true);
    });

    it('should build global symbol table for single module', () => {
      const source = `
        module Single
        export let data: byte = 42;
        let internal: byte = 10;
      `;

      const program = parseModule(source);
      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([program]);

      expect(result.success).toBe(true);
      expect(result.globalSymbolTable).toBeDefined();

      // Exported symbols should be available
      const exported = result.globalSymbolTable.getExportedSymbols('Single');
      expect(exported).toHaveLength(1);
      expect(exported[0].name).toBe('data');

      // Can lookup in specific module
      const dataSymbol = result.globalSymbolTable.lookupInModule('data', 'Single');
      expect(dataSymbol).toBeDefined();
      expect(dataSymbol?.name).toBe('data');
    });
  });

  describe('Two-Module Dependencies', () => {
    it('should analyze modules in dependency order (A → B)', () => {
      const moduleA = parseModule(`
        module A
        import helper from B
        export let result: byte = helper();
      `);

      const moduleB = parseModule(`
        module B
        export function helper(): byte
          return 42;
        end function
      `);

      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([moduleA, moduleB]);

      expect(result.success).toBe(true);
      expect(result.modules.size).toBe(2);

      // Both modules should be analyzed
      expect(result.modules.has('A')).toBe(true);
      expect(result.modules.has('B')).toBe(true);

      // Verify dependency graph
      const deps = result.dependencyGraph.getModuleDependencies('A');
      expect(deps).toContain('B');
    });

    it('should detect circular imports (A → B → A)', () => {
      const moduleA = parseModule(`
        module A
        import foo from B
        export function bar(): void
        end function
      `);

      const moduleB = parseModule(`
        module B
        import bar from A
        export function foo(): void
        end function
      `);

      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([moduleA, moduleB]);

      expect(result.success).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].message).toContain('Circular import detected');
      expect(result.diagnostics[0].message).toMatch(/A.*B.*A/);
    });

    it('should fail-fast on missing module', () => {
      const moduleA = parseModule(`
        module A
        import missing from NonExistent
        export let x: byte = 0;
      `);

      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([moduleA]);

      expect(result.success).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].message).toContain("Module 'NonExistent' not found");
    });
  });

  describe('Multi-Module Dependency Chains', () => {
    it('should handle linear dependency chain (A → B → C)', () => {
      const moduleA = parseModule(`
        module A
        import funcB from B
        export let x: byte = funcB();
      `);

      const moduleB = parseModule(`
        module B
        import funcC from C
        export function funcB(): byte
          return funcC();
        end function
      `);

      const moduleC = parseModule(`
        module C
        export function funcC(): byte
          return 99;
        end function
      `);

      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([moduleA, moduleB, moduleC]);

      expect(result.success).toBe(true);
      expect(result.modules.size).toBe(3);

      // Verify topological order (C before B before A)
      const order = result.dependencyGraph.getTopologicalOrder();
      const indexC = order.indexOf('C');
      const indexB = order.indexOf('B');
      const indexA = order.indexOf('A');

      expect(indexC).toBeLessThan(indexB);
      expect(indexB).toBeLessThan(indexA);
    });

    it('should handle diamond dependency (A → B,C → D)', () => {
      const moduleA = parseModule(`
        module A
        import b from B
        import c from C
        export let result: byte = b() + c();
      `);

      const moduleB = parseModule(`
        module B
        import d from D
        export function b(): byte
          return d();
        end function
      `);

      const moduleC = parseModule(`
        module C
        import d from D
        export function c(): byte
          return d();
        end function
      `);

      const moduleD = parseModule(`
        module D
        export function d(): byte
          return 10;
        end function
      `);

      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([moduleA, moduleB, moduleC, moduleD]);

      expect(result.success).toBe(true);
      expect(result.modules.size).toBe(4);

      // D should be analyzed before B and C
      const order = result.dependencyGraph.getTopologicalOrder();
      const indexD = order.indexOf('D');
      const indexB = order.indexOf('B');
      const indexC = order.indexOf('C');
      const indexA = order.indexOf('A');

      expect(indexD).toBeLessThan(indexB);
      expect(indexD).toBeLessThan(indexC);
      expect(indexB).toBeLessThan(indexA);
      expect(indexC).toBeLessThan(indexA);
    });

    it('should detect complex circular dependency (A → B → C → B)', () => {
      const moduleA = parseModule(`
        module A
        import b from B
        export let x: byte = b();
      `);

      const moduleB = parseModule(`
        module B
        import c from C
        export function b(): byte
          return c();
        end function
      `);

      const moduleC = parseModule(`
        module C
        import b from B
        export function c(): byte
          return b();
        end function
      `);

      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([moduleA, moduleB, moduleC]);

      expect(result.success).toBe(false);
      expect(result.diagnostics[0].message).toContain('Circular import detected');
    });
  });

  describe('Global Symbol Table Integration', () => {
    it('should aggregate symbols from all modules', () => {
      const moduleA = parseModule(`
        module A
        export let varA: byte = 1;
        export function funcA(): void
        end function
      `);

      const moduleB = parseModule(`
        module B
        export let varB: byte = 2;
        export function funcB(): void
        end function
      `);

      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([moduleA, moduleB]);

      expect(result.success).toBe(true);

      // Check global symbol table has exports from both modules
      const exportsA = result.globalSymbolTable.getExportedSymbols('A');
      const exportsB = result.globalSymbolTable.getExportedSymbols('B');

      expect(exportsA).toHaveLength(2);
      expect(exportsA.map(s => s.name)).toContain('varA');
      expect(exportsA.map(s => s.name)).toContain('funcA');

      expect(exportsB).toHaveLength(2);
      expect(exportsB.map(s => s.name)).toContain('varB');
      expect(exportsB.map(s => s.name)).toContain('funcB');
    });

    it('should allow cross-module symbol lookup', () => {
      const moduleX = parseModule(`
        module X
        export let sharedData: byte = 100;
      `);

      const moduleY = parseModule(`
        module Y
        export function utility(): byte
          return 0;
        end function
      `);

      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([moduleX, moduleY]);

      expect(result.success).toBe(true);

      // Module Y can lookup exports from module X
      const sharedData = result.globalSymbolTable.lookup('sharedData', 'Y');
      expect(sharedData).toBeDefined();
      expect(sharedData?.moduleName).toBe('X');
      expect(sharedData?.name).toBe('sharedData');

      // Module X can lookup exports from module Y
      const utility = result.globalSymbolTable.lookup('utility', 'X');
      expect(utility).toBeDefined();
      expect(utility?.moduleName).toBe('Y');
      expect(utility?.name).toBe('utility');
    });

    it('should respect export visibility in global table', () => {
      const module1 = parseModule(`
        module Test1
        export let publicVar: byte = 1;
        let privateVar: byte = 2;
      `);

      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([module1]);

      expect(result.success).toBe(true);

      // Public symbol visible from other modules
      const publicSymbol = result.globalSymbolTable.lookup('publicVar', 'OtherModule');
      expect(publicSymbol).toBeDefined();

      // Private symbol NOT visible from other modules
      const privateSymbol = result.globalSymbolTable.lookup('privateVar', 'OtherModule');
      expect(privateSymbol).toBeUndefined();
    });
  });

  describe('Per-Module Results Collection', () => {
    it('should collect symbol table for each module', () => {
      const mod1 = parseModule(`
        module Mod1
        let x: byte = 1;
      `);

      const mod2 = parseModule(`
        module Mod2
        let y: byte = 2;
      `);

      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([mod1, mod2]);

      expect(result.success).toBe(true);

      const result1 = result.modules.get('Mod1')!;
      const result2 = result.modules.get('Mod2')!;

      expect(result1.symbolTable).toBeDefined();
      expect(result2.symbolTable).toBeDefined();

      // Each module has its own symbol table
      expect(result1.symbolTable).not.toBe(result2.symbolTable);
    });

    it('should collect type system for each module', () => {
      const mod1 = parseModule(`
        module TypeTest1
        let a: byte = 1;
      `);

      const mod2 = parseModule(`
        module TypeTest2
        let b: word = 1000;
      `);

      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([mod1, mod2]);

      expect(result.success).toBe(true);

      const result1 = result.modules.get('TypeTest1')!;
      const result2 = result.modules.get('TypeTest2')!;

      expect(result1.typeSystem).toBeDefined();
      expect(result2.typeSystem).toBeDefined();
    });

    it('should collect diagnostics per module', () => {
      const goodModule = parseModule(`
        module Good
        export function use(): void
          let valid: byte = 42;
          let result: byte = valid + 1;
        end function
      `);

      const badModule = parseModule(`
        module Bad
        let x: byte = 99999;
      `);

      const analyzer = new SemanticAnalyzer();
      const result = analyzer.analyzeMultiple([goodModule, badModule]);

      // Overall analysis fails due to one bad module
      expect(result.success).toBe(false);

      // Good module should succeed
      const goodResult = result.modules.get('Good')!;
      expect(goodResult.success).toBe(true);
      expect(goodResult.diagnostics).toHaveLength(0);

      // Bad module should fail
      const badResult = result.modules.get('Bad')!;
      expect(badResult.success).toBe(false);
      expect(badResult.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain single-module analyze() method', () => {
      const source = `
        module Legacy
        export function getData(): byte
          return 123;
        end function
      `;

      const program = parseModule(source);
      const analyzer = new SemanticAnalyzer();

      // Old API still works
      const result = analyzer.analyze(program);

      expect(result.success).toBe(true);
      expect(result.symbolTable).toBeDefined();
      expect(result.diagnostics).toHaveLength(0);
    });

    it('should produce same results for single module via both APIs', () => {
      const source = `
        module Compare
        export function test(): byte
          return 42;
        end function
      `;

      const program1 = parseModule(source);
      const program2 = parseModule(source);

      const analyzer1 = new SemanticAnalyzer();
      const analyzer2 = new SemanticAnalyzer();

      const oldResult = analyzer1.analyze(program1);
      const newResult = analyzer2.analyzeMultiple([program2]);

      // Both succeed
      expect(oldResult.success).toBe(true);
      expect(newResult.success).toBe(true);

      // Both have same diagnostic count
      expect(oldResult.diagnostics.length).toBe(0);
      expect(newResult.diagnostics.length).toBe(0);

      // Module result matches old result
      const moduleResult = newResult.modules.get('Compare')!;
      expect(moduleResult.success).toBe(oldResult.success);
    });
  });
});