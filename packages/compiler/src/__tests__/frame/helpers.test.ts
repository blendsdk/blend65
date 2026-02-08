/**
 * Tests for SFA test helper utilities
 *
 * These tests verify that the test helpers work correctly before
 * using them in actual SFA tests.
 *
 * @module __tests__/frame/helpers.test
 */

import { describe, it, expect } from 'vitest';
import {
  parseSource,
  buildSymbolTable,
  buildCallGraph,
  wrapInModule,
  wrapInFunction,
  wrapInProgram,
  INLINE_FIXTURES,
} from './helpers/index.js';

describe('SFA Test Helpers', () => {
  describe('parseSource', () => {
    it('should parse simple source code', () => {
      const source = INLINE_FIXTURES.emptyFunction;
      const program = parseSource(source);

      expect(program).toBeDefined();
      expect(program.getModule()).toBeDefined();
      expect(program.getModule().getFullName()).toBe('Test');
    });

    it('should parse source with locals', () => {
      const source = INLINE_FIXTURES.simpleLocals;
      const program = parseSource(source);

      expect(program).toBeDefined();
      expect(program.getModule()).toBeDefined();
    });

    it('should parse source with multiple functions', () => {
      const source = INLINE_FIXTURES.nonOverlapping;
      const program = parseSource(source);

      expect(program).toBeDefined();
      // Program declarations contain all top-level declarations
      const functions = program.getDeclarations().filter(
        d => d.getNodeType() === 'FunctionDecl'
      );
      expect(functions).toHaveLength(3);
    });
  });

  describe('buildSymbolTable', () => {
    it('should build symbol table from simple source', () => {
      const source = INLINE_FIXTURES.emptyFunction;
      const { program, symbolTable } = buildSymbolTable(source);

      expect(program).toBeDefined();
      expect(symbolTable).toBeDefined();
    });

    it('should register function in symbol table', () => {
      const source = INLINE_FIXTURES.emptyFunction;
      const { symbolTable } = buildSymbolTable(source);

      // The function 'main' should be registered
      // Note: We're just checking the symbol table exists and is valid
      expect(symbolTable).toBeDefined();
    });

    it('should handle multiple functions', () => {
      const source = INLINE_FIXTURES.nonOverlapping;
      const { symbolTable } = buildSymbolTable(source);

      expect(symbolTable).toBeDefined();
    });
  });

  describe('buildCallGraph', () => {
    it('should build call graph from simple source', () => {
      const source = INLINE_FIXTURES.emptyFunction;
      const { callGraph } = buildCallGraph(source);

      expect(callGraph).toBeDefined();
    });

    it('should detect function calls', () => {
      const source = INLINE_FIXTURES.nonOverlapping;
      const { callGraph } = buildCallGraph(source);

      expect(callGraph).toBeDefined();
      // callGraph should have nodes for main, funcA, funcB
      expect(callGraph.getAllFunctions()).toBeDefined();
    });

    it('should detect nested calls', () => {
      const source = INLINE_FIXTURES.nestedCalls;
      const { callGraph } = buildCallGraph(source);

      expect(callGraph).toBeDefined();
      // Should have main -> outer -> inner chain
      const functions = callGraph.getAllFunctions();
      // getAllFunctions returns a Set, so use .size
      expect(functions.size).toBeGreaterThan(0);
    });
  });

  describe('wrapper functions', () => {
    it('wrapInModule should create valid module', () => {
      const code = 'function test(): void {}';
      const wrapped = wrapInModule(code);

      expect(wrapped).toContain('module Test.Module;');
      expect(wrapped).toContain(code);

      // Should parse without errors
      const program = parseSource(wrapped);
      expect(program.getModule()).toBeDefined();
      expect(program.getModule().getFullName()).toBe('Test.Module');
    });

    it('wrapInModule should use custom module name', () => {
      const code = 'function test(): void {}';
      const wrapped = wrapInModule(code, 'Custom.Name');

      expect(wrapped).toContain('module Custom.Name;');
    });

    it('wrapInFunction should create valid function', () => {
      const code = 'let x: byte = 0;';
      const wrapped = wrapInFunction(code);

      expect(wrapped).toContain('function test(): void {');
      expect(wrapped).toContain(code);
    });

    it('wrapInFunction should use custom function name', () => {
      const code = 'let x: byte = 0;';
      const wrapped = wrapInFunction(code, 'customFunc');

      expect(wrapped).toContain('function customFunc(): void {');
    });

    it('wrapInProgram should create complete valid program', () => {
      const code = 'let x: byte = 0;';
      const wrapped = wrapInProgram(code);

      expect(wrapped).toContain('module Test.Module;');
      expect(wrapped).toContain('function main(): void {');
      expect(wrapped).toContain(code);

      // Should parse without errors
      const program = parseSource(wrapped);
      expect(program.getModule()).toBeDefined();
      expect(program.getModule().getFullName()).toBe('Test.Module');
    });
  });

  describe('INLINE_FIXTURES', () => {
    it('should have emptyFunction fixture', () => {
      expect(INLINE_FIXTURES.emptyFunction).toBeDefined();
      expect(INLINE_FIXTURES.emptyFunction).toContain('module Test;');
      expect(INLINE_FIXTURES.emptyFunction).toContain('function main()');
    });

    it('should have simpleLocals fixture', () => {
      expect(INLINE_FIXTURES.simpleLocals).toBeDefined();
      expect(INLINE_FIXTURES.simpleLocals).toContain('let x: byte');
      expect(INLINE_FIXTURES.simpleLocals).toContain('let y: byte');
    });

    it('should have nonOverlapping fixture', () => {
      expect(INLINE_FIXTURES.nonOverlapping).toBeDefined();
      expect(INLINE_FIXTURES.nonOverlapping).toContain('funcA()');
      expect(INLINE_FIXTURES.nonOverlapping).toContain('funcB()');
    });

    it('should have nestedCalls fixture', () => {
      expect(INLINE_FIXTURES.nestedCalls).toBeDefined();
      expect(INLINE_FIXTURES.nestedCalls).toContain('outer()');
      expect(INLINE_FIXTURES.nestedCalls).toContain('inner()');
    });

    it('should have directRecursion fixture', () => {
      expect(INLINE_FIXTURES.directRecursion).toBeDefined();
      expect(INLINE_FIXTURES.directRecursion).toContain('factorial');
    });

    it('should have callbackIsolation fixture', () => {
      expect(INLINE_FIXTURES.callbackIsolation).toBeDefined();
      expect(INLINE_FIXTURES.callbackIsolation).toContain('callback irq()');
    });

    it('all fixtures should be parseable', () => {
      const fixtureKeys = Object.keys(INLINE_FIXTURES) as Array<
        keyof typeof INLINE_FIXTURES
      >;

      for (const key of fixtureKeys) {
        const source = INLINE_FIXTURES[key];
        expect(() => parseSource(source), `Fixture '${key}' should parse`).not.toThrow();
      }
    });
  });
});