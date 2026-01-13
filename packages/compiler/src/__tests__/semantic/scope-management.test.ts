/**
 * Scope Management Tests
 *
 * Tests for Blend65's scoping rules:
 * - Function-scoped variables (like JavaScript's var, NOT block-scoped)
 * - Control flow structures (if/while/for) do NOT create new scopes
 * - Module scope and function scope only
 */

import { describe, test, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTableBuilder } from '../../semantic/visitors/symbol-table-builder.js';
import { SymbolKind, ScopeKind } from '../../semantic/index.js';

describe('Scope Management', () => {
  /**
   * Helper to parse source code and build symbol table
   */
  function buildSymbolTable(source: string) {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const builder = new SymbolTableBuilder();
    ast.accept(builder);

    return {
      symbolTable: builder.getSymbolTable(),
      diagnostics: builder.getDiagnostics(),
      hasErrors: builder.hasErrors(),
      ast,
    };
  }

  describe('Function-Scoped Variables', () => {
    test('variables declared in if-block are visible after if', () => {
      const source = `
        function test(): void
          if true then
            let x: byte = 0;
          end if
          x = 10;
        end function
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      // 'x' should be in function scope, not in a separate if-block scope
      expect(functionScope.symbols.has('x')).toBe(true);
      expect(functionScope.symbols.get('x')!.kind).toBe(SymbolKind.Variable);
    });

    test('variables declared in else-block are visible after if-else', () => {
      const source = `
        function test(): void
          if false then
            let a: byte = 1;
          else
            let b: byte = 2;
          end if
          a = 10;
          b = 20;
        end function
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const functionScope = symbolTable.getRootScope().children[0];

      // Both variables should be in function scope
      expect(functionScope.symbols.has('a')).toBe(true);
      expect(functionScope.symbols.has('b')).toBe(true);
    });

    test('variables declared in while-loop are visible after loop', () => {
      const source = `
        function test(): void
          while true
            let counter: byte = 0;
          end while
          counter = 5;
        end function
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const functionScope = symbolTable.getRootScope().children[0];

      // 'counter' should be in function scope
      expect(functionScope.symbols.has('counter')).toBe(true);
    });

    test.skip('variables declared in for-loop are visible after loop (for-loop variables not yet tracked)', () => {
      // TODO: For-loop variables need to be added to symbol table
      // Currently they are part of ForStatement AST node but not tracked as symbols
      const source = `
        function test(): void
          for i = 0 to 10
            let temp: byte = i;
          next i
          temp = 100;
        end function
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const functionScope = symbolTable.getRootScope().children[0];

      // 'temp' should be in function scope (declared with let)
      // Note: 'i' is a for-loop variable, not a VariableDecl, so it won't be in symbol table yet
      expect(functionScope.symbols.has('temp')).toBe(true);
    });

    test('variables declared in nested if-blocks are all in function scope', () => {
      const source = `
        function test(): void
          if true then
            let a: byte = 1;
            if false then
              let b: byte = 2;
            end if
          end if
          a = 10;
          b = 20;
        end function
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const functionScope = symbolTable.getRootScope().children[0];

      // All variables should be in same function scope
      expect(functionScope.symbols.has('a')).toBe(true);
      expect(functionScope.symbols.has('b')).toBe(true);
      expect(functionScope.symbols.size).toBe(2);
    });
  });

  describe('Module Scope vs Function Scope', () => {
    test('module-level variables are in module scope', () => {
      const source = `
        let globalVar: byte = 0;
        const CONSTANT: byte = 255;
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();

      expect(rootScope.symbols.has('globalVar')).toBe(true);
      expect(rootScope.symbols.has('CONSTANT')).toBe(true);
      expect(rootScope.kind).toBe(ScopeKind.Module);
    });

    test('function parameters are in function scope', () => {
      const source = `
        function add(a: byte, b: byte): byte
          return a + b;
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      // Parameters should be in function scope, not module scope
      expect(rootScope.symbols.has('a')).toBe(false);
      expect(rootScope.symbols.has('b')).toBe(false);
      expect(functionScope.symbols.has('a')).toBe(true);
      expect(functionScope.symbols.has('b')).toBe(true);
    });

    test('function-local variables are in function scope', () => {
      const source = `
        function test(): void
          let local: byte = 0;
          const LOCAL_CONST: byte = 100;
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      // Local variables should be in function scope
      expect(rootScope.symbols.has('local')).toBe(false);
      expect(rootScope.symbols.has('LOCAL_CONST')).toBe(false);
      expect(functionScope.symbols.has('local')).toBe(true);
      expect(functionScope.symbols.has('LOCAL_CONST')).toBe(true);
    });

    test('functions can access module-level variables', () => {
      const source = `
        let global: byte = 0;

        function increment(): void
          global = global + 1;
        end function
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const rootScope = symbolTable.getRootScope();

      // 'global' should be in module scope
      expect(rootScope.symbols.has('global')).toBe(true);

      // Function can reference it (this test just ensures no errors)
      const functionSymbol = rootScope.symbols.get('increment');
      expect(functionSymbol).toBeDefined();
    });

    test('shadowing: function-local variable shadows module variable', () => {
      const source = `
        let x: byte = 10;

        function test(): void
          let x: byte = 20;
        end function
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      // Both scopes should have 'x'
      expect(rootScope.symbols.has('x')).toBe(true);
      expect(functionScope.symbols.has('x')).toBe(true);

      // They should be different symbols
      const moduleX = rootScope.symbols.get('x');
      const functionX = functionScope.symbols.get('x');
      expect(moduleX).not.toBe(functionX);
    });
  });

  describe('Symbol Lookup Across Scopes', () => {
    test('lookup in function scope finds local symbols first', () => {
      const source = `
        let value: byte = 10;

        function test(): void
          let value: byte = 20;
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      // Enter function scope for lookup
      symbolTable.enterScope(functionScope);

      // Should find function-local symbol
      const found = symbolTable.lookup('value');
      expect(found).toBeDefined();
      expect(found!.scope).toBe(functionScope);
    });

    test('lookup in function scope falls back to module scope', () => {
      const source = `
        let global: byte = 10;

        function test(): void
          let local: byte = global;
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      // Enter function scope
      symbolTable.enterScope(functionScope);

      // Should find module-level 'global'
      const found = symbolTable.lookup('global');
      expect(found).toBeDefined();
      expect(found!.scope).toBe(rootScope);
    });

    test('lookupLocal only searches current scope', () => {
      const source = `
        let global: byte = 10;

        function test(): void
          let local: byte = 20;
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      // Enter function scope
      symbolTable.enterScope(functionScope);

      // lookupLocal should NOT find module-level symbol
      const notFound = symbolTable.lookupLocal('global');
      expect(notFound).toBeUndefined();

      // But should find function-local symbol
      const found = symbolTable.lookupLocal('local');
      expect(found).toBeDefined();
    });
  });

  describe('Nested Functions', () => {
    test('multiple functions create separate scopes', () => {
      const source = `
        function foo(): void
          let a: byte = 1;
        end function

        function bar(): void
          let b: byte = 2;
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      expect(rootScope.children).toHaveLength(2);

      const fooScope = rootScope.children[0];
      const barScope = rootScope.children[1];

      // Each function should have its own variables
      expect(fooScope.symbols.has('a')).toBe(true);
      expect(fooScope.symbols.has('b')).toBe(false);

      expect(barScope.symbols.has('b')).toBe(true);
      expect(barScope.symbols.has('a')).toBe(false);
    });

    test('functions can have same parameter names in different scopes', () => {
      const source = `
        function first(x: byte): byte
          return x;
        end function

        function second(x: byte): byte
          return x;
        end function
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const rootScope = symbolTable.getRootScope();
      const firstScope = rootScope.children[0];
      const secondScope = rootScope.children[1];

      // Both functions should have 'x' parameter
      expect(firstScope.symbols.has('x')).toBe(true);
      expect(secondScope.symbols.has('x')).toBe(true);

      // They should be different symbols
      const firstX = firstScope.symbols.get('x');
      const secondX = secondScope.symbols.get('x');
      expect(firstX).not.toBe(secondX);
    });
  });

  describe('Scope Hierarchy', () => {
    test('module scope has no parent', () => {
      const source = `
        let x: byte = 0;
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      expect(rootScope.parent).toBeNull();
    });

    test('function scope has module scope as parent', () => {
      const source = `
        function test(): void
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      expect(functionScope.parent).toBe(rootScope);
    });

    test('all function scopes have same parent (module scope)', () => {
      const source = `
        function foo(): void
        end function

        function bar(): void
        end function

        function baz(): void
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();

      expect(rootScope.children).toHaveLength(3);

      // All should have module scope as parent
      expect(rootScope.children[0].parent).toBe(rootScope);
      expect(rootScope.children[1].parent).toBe(rootScope);
      expect(rootScope.children[2].parent).toBe(rootScope);
    });
  });

  describe('Complex Scoping Scenarios', () => {
    test('variables in control flow with same name in function scope', () => {
      const source = `
        function test(): void
          if true then
            let x: byte = 1;
          end if

          if false then
            let x: byte = 2;
          end if
        end function
      `;
      const { diagnostics, hasErrors } = buildSymbolTable(source);

      // This should be an error: duplicate declaration in same scope
      expect(hasErrors).toBe(true);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain('Duplicate declaration');
      expect(diagnostics[0].message).toContain('x');
    });

    test('complete program with module and function scopes', () => {
      const source = `
        import random from lib.random;

        @map borderColor at $D020: byte;

        let score: word = 0;
        const MAX_SCORE: word = 9999;

        function initialize(): void
          let initialized: byte = 0;
          score = 0;
          initialized = 1;
        end function

        function update(delta: byte): void
          let temp: word = 0;
          temp = score + delta;
          score = temp;
        end function

        export function main(): void
          initialize();
        end function
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const rootScope = symbolTable.getRootScope();

      // Module scope should have: random, borderColor, score, MAX_SCORE, initialize, update, main
      expect(rootScope.symbols.size).toBe(7);

      // Should have 3 function scopes
      expect(rootScope.children).toHaveLength(3);

      // First function (initialize) should have 1 local variable
      const initScope = rootScope.children[0];
      expect(initScope.symbols.size).toBe(1);
      expect(initScope.symbols.has('initialized')).toBe(true);

      // Second function (update) should have 1 parameter + 1 local variable
      const updateScope = rootScope.children[1];
      expect(updateScope.symbols.size).toBe(2);
      expect(updateScope.symbols.has('delta')).toBe(true);
      expect(updateScope.symbols.has('temp')).toBe(true);

      // Third function (main) should have no local variables
      const mainScope = rootScope.children[2];
      expect(mainScope.symbols.size).toBe(0);
    });

    test('getVisibleSymbols returns all symbols in scope chain', () => {
      const source = `
        let global: byte = 10;

        function test(param: byte): void
          let local: byte = 20;
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      // Enter function scope
      symbolTable.enterScope(functionScope);

      // Should see: global (module), test (module), param (function), local (function)
      const visible = symbolTable.getVisibleSymbols();
      expect(visible.length).toBe(4);

      const names = visible.map(s => s.name);
      expect(names).toContain('global');
      expect(names).toContain('test');
      expect(names).toContain('param');
      expect(names).toContain('local');
    });
  });
});
