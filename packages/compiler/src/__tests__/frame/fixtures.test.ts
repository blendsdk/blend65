/**
 * SFA Test Fixtures Verification
 *
 * Ensures all SFA fixture files exist and parse correctly.
 * This validates that our test fixtures are valid Blend programs.
 *
 * @module __tests__/frame/fixtures.test
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import {
  loadFixture,
  loadFixtureCategory,
  fixturesExist,
  INLINE_FIXTURES,
} from './helpers/fixtures.js';

describe('SFA Test Fixtures', () => {
  describe('Fixture Directory', () => {
    it('should have SFA fixtures directory', () => {
      expect(fixturesExist()).toBe(true);
    });
  });

  describe('01-basic/ Fixtures', () => {
    const category = '01-basic';

    it('should have all basic fixtures', () => {
      const fixtures = loadFixtureCategory(category);
      expect(fixtures.size).toBeGreaterThanOrEqual(5);

      expect(fixtures.has('single-function')).toBe(true);
      expect(fixtures.has('two-functions')).toBe(true);
      expect(fixtures.has('nested-calls')).toBe(true);
      expect(fixtures.has('with-parameters')).toBe(true);
      expect(fixtures.has('with-arrays')).toBe(true);
    });

    it('single-function.blend should parse', () => {
      const source = loadFixture(category, 'single-function');
      expect(source).toContain('module SFA.Test.SingleFunction');

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      expect(tokens.length).toBeGreaterThan(0);

      const parser = new Parser(tokens, source);
      const ast = parser.parse();
      expect(ast.declarations.length).toBeGreaterThan(0);
    });

    it('two-functions.blend should parse', () => {
      const source = loadFixture(category, 'two-functions');
      expect(source).toContain('module SFA.Test.TwoFunctions');

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens, source);
      const ast = parser.parse();

      // Should have main, update, and draw functions
      expect(ast.declarations.length).toBeGreaterThanOrEqual(3);
    });

    it('nested-calls.blend should parse', () => {
      const source = loadFixture(category, 'nested-calls');
      expect(source).toContain('module SFA.Test.NestedCalls');

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens, source);
      const ast = parser.parse();

      // Should have main, outer, middle, inner functions
      expect(ast.declarations.length).toBeGreaterThanOrEqual(4);
    });

    it('with-parameters.blend should parse', () => {
      const source = loadFixture(category, 'with-parameters');
      expect(source).toContain('module SFA.Test.WithParameters');

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens, source);
      const ast = parser.parse();

      // Should have main and add functions
      expect(ast.declarations.length).toBeGreaterThanOrEqual(2);
    });

    it('with-arrays.blend should parse', () => {
      const source = loadFixture(category, 'with-arrays');
      expect(source).toContain('module SFA.Test.WithArrays');

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens, source);
      const ast = parser.parse();

      // Should have main function
      expect(ast.declarations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('02-coalescing/ Fixtures', () => {
    const category = '02-coalescing';

    it('should have all coalescing fixtures', () => {
      const fixtures = loadFixtureCategory(category);
      expect(fixtures.size).toBeGreaterThanOrEqual(3);

      expect(fixtures.has('non-overlapping')).toBe(true);
      expect(fixtures.has('overlapping')).toBe(true);
      expect(fixtures.has('deep-calls')).toBe(true);
    });

    it('non-overlapping.blend should parse', () => {
      const source = loadFixture(category, 'non-overlapping');
      expect(source).toContain('module SFA.Test.NonOverlapping');

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens, source);
      const ast = parser.parse();

      // Should have main, funcA, funcB
      expect(ast.declarations.length).toBeGreaterThanOrEqual(3);
    });

    it('overlapping.blend should parse', () => {
      const source = loadFixture(category, 'overlapping');
      expect(source).toContain('module SFA.Test.Overlapping');

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens, source);
      const ast = parser.parse();

      // Should have main, outer, inner
      expect(ast.declarations.length).toBeGreaterThanOrEqual(3);
    });

    it('deep-calls.blend should parse', () => {
      const source = loadFixture(category, 'deep-calls');
      expect(source).toContain('module SFA.Test.DeepCalls');

      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens, source);
      const ast = parser.parse();

      // Should have main, branch1, branch2, leaf1a, leaf1b, leaf2a, leaf2b
      expect(ast.declarations.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Inline Fixtures Validation', () => {
    /**
     * Test that each inline fixture parses correctly
     */
    const inlineFixtureTests: Array<{
      name: keyof typeof INLINE_FIXTURES;
      expectedMinDeclarations: number;
    }> = [
      { name: 'emptyFunction', expectedMinDeclarations: 1 },
      { name: 'oneLocal', expectedMinDeclarations: 1 },
      { name: 'simpleLocals', expectedMinDeclarations: 1 },
      { name: 'mixedSizeLocals', expectedMinDeclarations: 1 },
      { name: 'withParameters', expectedMinDeclarations: 1 },
      { name: 'nonOverlapping', expectedMinDeclarations: 3 },
      { name: 'nestedCalls', expectedMinDeclarations: 3 },
      { name: 'directRecursion', expectedMinDeclarations: 1 },
      { name: 'indirectRecursion', expectedMinDeclarations: 2 },
      { name: 'zpRequired', expectedMinDeclarations: 1 },
      { name: 'ramRequired', expectedMinDeclarations: 1 },
      { name: 'pointerVariable', expectedMinDeclarations: 1 },
      { name: 'hotLoopVariable', expectedMinDeclarations: 1 },
      { name: 'callbackIsolation', expectedMinDeclarations: 2 },
      { name: 'multipleCallbacks', expectedMinDeclarations: 3 },
      { name: 'manyIndependent', expectedMinDeclarations: 5 },
      { name: 'diamondPattern', expectedMinDeclarations: 4 },
      { name: 'zpOverflow', expectedMinDeclarations: 1 },
      { name: 'gameLoop', expectedMinDeclarations: 4 },
      { name: 'stateMachine', expectedMinDeclarations: 4 },
    ];

    it.each(inlineFixtureTests)(
      '$name should parse with at least $expectedMinDeclarations declarations',
      ({ name, expectedMinDeclarations }) => {
        const source = INLINE_FIXTURES[name];
        expect(source).toBeDefined();
        expect(source.length).toBeGreaterThan(0);

        const lexer = new Lexer(source);
        const tokens = lexer.tokenize();

        const parser = new Parser(tokens, source);
        const ast = parser.parse();

        expect(ast.declarations.length).toBeGreaterThanOrEqual(
          expectedMinDeclarations,
        );
      },
    );
  });

  describe('Fixture Content Validation', () => {
    describe('Basic Fixtures Content', () => {
      it('single-function.blend has correct structure', () => {
        const source = loadFixture('01-basic', 'single-function');

        // Should have module declaration
        expect(source).toContain('module SFA.Test.SingleFunction');

        // Should have main function with two locals
        expect(source).toContain('function main(): void');
        expect(source).toContain('let x: byte');
        expect(source).toContain('let y: byte');
      });

      it('with-arrays.blend has array declaration', () => {
        const source = loadFixture('01-basic', 'with-arrays');

        // Should have array local
        expect(source).toContain('let buffer: byte[16]');
      });

      it('with-parameters.blend has function parameters', () => {
        const source = loadFixture('01-basic', 'with-parameters');

        // Should have function with parameters
        expect(source).toContain('function add(a: byte, b: byte): byte');
      });
    });

    describe('Coalescing Fixtures Content', () => {
      it('non-overlapping.blend has sibling functions', () => {
        const source = loadFixture('02-coalescing', 'non-overlapping');

        // Functions called sequentially, not nested
        expect(source).toContain('funcA()');
        expect(source).toContain('funcB()');
        expect(source).toContain('function funcA()');
        expect(source).toContain('function funcB()');
      });

      it('overlapping.blend has nested calls', () => {
        const source = loadFixture('02-coalescing', 'overlapping');

        // Outer calls inner - they overlap
        expect(source).toContain('function outer()');
        expect(source).toContain('inner()');
        expect(source).toContain('function inner()');
      });

      it('deep-calls.blend has multiple branches', () => {
        const source = loadFixture('02-coalescing', 'deep-calls');

        // Two branches with leaf functions
        expect(source).toContain('branch1()');
        expect(source).toContain('branch2()');
        expect(source).toContain('leaf1a()');
        expect(source).toContain('leaf2a()');
      });
    });
  });
});