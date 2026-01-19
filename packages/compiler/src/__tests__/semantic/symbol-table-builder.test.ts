/**
 * Symbol Table Builder Tests
 *
 * Tests for the SymbolTableBuilder visitor that collects declarations
 * and builds the symbol table with proper scoping.
 */

import { describe, test, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTableBuilder } from '../../semantic/visitors/symbol-table-builder.js';
import { SymbolKind, StorageClass, ScopeKind } from '../../semantic/index.js';

describe('SymbolTableBuilder', () => {
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
    };
  }

  describe('Variable Declaration Collection', () => {
    test('collects simple let variable declaration', () => {
      const source = `
        let counter: byte = 0;
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const symbol = symbolTable.lookup('counter');
      expect(symbol).toBeDefined();
      expect(symbol!.name).toBe('counter');
      expect(symbol!.kind).toBe(SymbolKind.Variable);
      expect(symbol!.isConst).toBe(false);
      expect(symbol!.isExported).toBe(false);
      expect(symbol!.storageClass).toBe(StorageClass.RAM);
    });

    test('collects const variable declaration', () => {
      const source = `
        const MAX_SPRITES: byte = 8;
      `;
      const { symbolTable } = buildSymbolTable(source);

      const symbol = symbolTable.lookup('MAX_SPRITES');
      expect(symbol).toBeDefined();
      expect(symbol!.isConst).toBe(true);
    });

    test('collects @zp variable declaration', () => {
      const source = `
        @zp let zpVar: byte = 0;
      `;
      const { symbolTable } = buildSymbolTable(source);

      const symbol = symbolTable.lookup('zpVar');
      expect(symbol).toBeDefined();
      expect(symbol!.storageClass).toBe(StorageClass.ZeroPage);
    });

    test('collects @ram variable declaration', () => {
      const source = `
        @ram let ramVar: word = 0;
      `;
      const { symbolTable } = buildSymbolTable(source);

      const symbol = symbolTable.lookup('ramVar');
      expect(symbol).toBeDefined();
      expect(symbol!.storageClass).toBe(StorageClass.RAM);
    });

    test('collects @data variable declaration', () => {
      const source = `
        @data const lookup: byte = 255;
      `;
      const { symbolTable } = buildSymbolTable(source);

      const symbol = symbolTable.lookup('lookup');
      expect(symbol).toBeDefined();
      expect(symbol!.storageClass).toBe(StorageClass.Data);
    });

    test('collects exported variable declaration', () => {
      const source = `
        export let score: word = 0;
      `;
      const { symbolTable } = buildSymbolTable(source);

      const symbol = symbolTable.lookup('score');
      expect(symbol).toBeDefined();
      expect(symbol!.isExported).toBe(true);
    });

    test('collects multiple variable declarations', () => {
      const source = `
        let a: byte = 0;
        let b: word = 100;
        const c: byte = 255;
      `;
      const { symbolTable } = buildSymbolTable(source);

      expect(symbolTable.lookup('a')).toBeDefined();
      expect(symbolTable.lookup('b')).toBeDefined();
      expect(symbolTable.lookup('c')).toBeDefined();
      expect(symbolTable.getSymbolCount()).toBe(3);
    });

    test('detects duplicate variable declarations', () => {
      const source = `
        let counter: byte = 0;
        let counter: byte = 10;
      `;
      const { diagnostics, hasErrors } = buildSymbolTable(source);

      expect(hasErrors).toBe(true);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain('Duplicate declaration');
      expect(diagnostics[0].message).toContain('counter');
    });
  });

  describe('Memory-Mapped Declaration Collection', () => {
    test('collects simple @map declaration', () => {
      const source = `
        @map borderColor at $D020: byte;
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const symbol = symbolTable.lookup('borderColor');
      expect(symbol).toBeDefined();
      expect(symbol!.kind).toBe(SymbolKind.MapVariable);
      expect(symbol!.storageClass).toBe(StorageClass.Map);
      expect(symbol!.isConst).toBe(false);
    });

    test('collects @map range declaration', () => {
      const source = `
        @map sprites from $D000 to $D02E: byte;
      `;
      const { symbolTable } = buildSymbolTable(source);

      const symbol = symbolTable.lookup('sprites');
      expect(symbol).toBeDefined();
      expect(symbol!.kind).toBe(SymbolKind.MapVariable);
    });

    test('collects @map sequential struct declaration', () => {
      const source = `
        @map vic at $D000: {
          spriteX0: byte;
          spriteY0: byte;
        };
      `;
      const { symbolTable } = buildSymbolTable(source);

      const symbol = symbolTable.lookup('vic');
      expect(symbol).toBeDefined();
      expect(symbol!.kind).toBe(SymbolKind.MapVariable);
    });

    test('collects @map explicit struct declaration', () => {
      const source = `
        @map sid at $D400: {
          freq1 at $D400: word;
          control1 at $D404: byte;
        };
      `;
      const { symbolTable } = buildSymbolTable(source);

      const symbol = symbolTable.lookup('sid');
      expect(symbol).toBeDefined();
      expect(symbol!.kind).toBe(SymbolKind.MapVariable);
    });

    test('collects multiple @map declarations', () => {
      const source = `
        @map borderColor at $D020: byte;
        @map backgroundColor at $D021: byte;
        @map sprites from $D000 to $D010: byte;
      `;
      const { symbolTable } = buildSymbolTable(source);

      expect(symbolTable.lookup('borderColor')).toBeDefined();
      expect(symbolTable.lookup('backgroundColor')).toBeDefined();
      expect(symbolTable.lookup('sprites')).toBeDefined();
    });

    test('detects duplicate @map declarations', () => {
      const source = `
        @map color at $D020: byte;
        @map color at $D021: byte;
      `;
      const { diagnostics, hasErrors } = buildSymbolTable(source);

      expect(hasErrors).toBe(true);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain('Duplicate declaration');
      expect(diagnostics[0].message).toContain('color');
    });
  });

  describe('Function Declaration Collection', () => {
    test('collects simple function declaration', () => {
      const source = `
        function greet(): void
        end function
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const symbol = symbolTable.lookup('greet');
      expect(symbol).toBeDefined();
      expect(symbol!.kind).toBe(SymbolKind.Function);
      expect(symbol!.isExported).toBe(false);
    });

    test('collects exported function declaration', () => {
      const source = `
        export function main(): void
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const symbol = symbolTable.lookup('main');
      expect(symbol).toBeDefined();
      expect(symbol!.isExported).toBe(true);
    });

    test('collects function with parameters', () => {
      const source = `
        function add(a: byte, b: byte): byte
          return a + b;
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const functionSymbol = symbolTable.lookup('add');
      expect(functionSymbol).toBeDefined();
      expect(functionSymbol!.kind).toBe(SymbolKind.Function);

      // Function should have its own scope
      const rootScope = symbolTable.getRootScope();
      expect(rootScope.children).toHaveLength(1);

      const functionScope = rootScope.children[0];
      expect(functionScope.kind).toBe(ScopeKind.Function);

      // Parameters should be in function scope
      const paramA = functionScope.symbols.get('a');
      const paramB = functionScope.symbols.get('b');

      expect(paramA).toBeDefined();
      expect(paramA!.kind).toBe(SymbolKind.Parameter);

      expect(paramB).toBeDefined();
      expect(paramB!.kind).toBe(SymbolKind.Parameter);
    });

    test('collects function with no parameters', () => {
      const source = `
        function initialize(): void
          let temp: byte = 0;
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const symbol = symbolTable.lookup('initialize');
      expect(symbol).toBeDefined();

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      // Should have function scope but no parameters
      expect(functionScope.symbols.size).toBe(1); // Only 'temp' variable
    });

    test('collects callback function declaration', () => {
      const source = `
        callback function onIRQ(): void
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const symbol = symbolTable.lookup('onIRQ');
      expect(symbol).toBeDefined();
      expect(symbol!.kind).toBe(SymbolKind.Function);
    });

    test('collects multiple function declarations', () => {
      const source = `
        function foo(): void
        end function

        function bar(): byte
          return 0;
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      expect(symbolTable.lookup('foo')).toBeDefined();
      expect(symbolTable.lookup('bar')).toBeDefined();
      expect(symbolTable.getRootScope().children).toHaveLength(2);
    });

    test('detects duplicate function declarations', () => {
      const source = `
        function test(): void
        end function

        function test(): byte
          return 0;
        end function
      `;
      const { diagnostics, hasErrors } = buildSymbolTable(source);

      expect(hasErrors).toBe(true);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain('Duplicate declaration');
      expect(diagnostics[0].message).toContain('test');
    });

    test('detects duplicate parameter names', () => {
      const source = `
        function calc(a: byte, a: byte): byte
          return a;
        end function
      `;
      const { diagnostics, hasErrors } = buildSymbolTable(source);

      expect(hasErrors).toBe(true);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain('Duplicate declaration');
      expect(diagnostics[0].message).toContain('a');
    });
  });

  describe('Import Declaration Collection', () => {
    test('collects single import declaration', () => {
      const source = `
        import foo from bar;
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const symbol = symbolTable.lookup('foo');
      expect(symbol).toBeDefined();
      expect(symbol!.kind).toBe(SymbolKind.ImportedSymbol);
      expect(symbol!.metadata?.importSource).toBe('bar');
    });

    test('collects multiple imports from same module', () => {
      const source = `
        import foo, bar, baz from module.path;
      `;
      const { symbolTable } = buildSymbolTable(source);

      expect(symbolTable.lookup('foo')).toBeDefined();
      expect(symbolTable.lookup('bar')).toBeDefined();
      expect(symbolTable.lookup('baz')).toBeDefined();
      expect(symbolTable.getSymbolCount()).toBe(3);
    });

    test('collects imports from nested module paths', () => {
      const source = `
        import SID from c64.audio.sid;
      `;
      const { symbolTable } = buildSymbolTable(source);

      const symbol = symbolTable.lookup('SID');
      expect(symbol).toBeDefined();
      expect(symbol!.metadata?.importSource).toBe('c64.audio.sid');
    });

    test('detects duplicate imported names', () => {
      const source = `
        import foo from bar;
        import foo from baz;
      `;
      const { diagnostics, hasErrors } = buildSymbolTable(source);

      expect(hasErrors).toBe(true);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain('Duplicate declaration');
      expect(diagnostics[0].message).toContain('foo');
    });
  });

  describe('Scope Management', () => {
    test('creates module scope as root', () => {
      const source = `
        let x: byte = 0;
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      expect(rootScope.kind).toBe(ScopeKind.Module);
      expect(rootScope.parent).toBeNull();
    });

    test('creates function scope for each function', () => {
      const source = `
        function foo(): void
        end function

        function bar(): void
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      expect(rootScope.children).toHaveLength(2);

      expect(rootScope.children[0].kind).toBe(ScopeKind.Function);
      expect(rootScope.children[1].kind).toBe(ScopeKind.Function);
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

    test('variables in function are in function scope', () => {
      const source = `
        function calculate(): byte
          let result: byte = 0;
          return result;
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      // 'result' should be in function scope, not module scope
      expect(rootScope.symbols.has('result')).toBe(false);
      expect(functionScope.symbols.has('result')).toBe(true);
    });

    test('module-level variables are in module scope', () => {
      const source = `
        let global: byte = 0;

        function test(): void
          let local: byte = 1;
        end function
      `;
      const { symbolTable } = buildSymbolTable(source);

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      expect(rootScope.symbols.has('global')).toBe(true);
      expect(functionScope.symbols.has('global')).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('builds symbol table for complete program', () => {
      const source = `
        import random from lib.random;

        @map borderColor at $D020: byte;

        @zp let counter: byte = 0;
        export let score: word = 0;

        function initialize(): void
          counter = 0;
          score = 0;
          borderColor = 0;
        end function

        export function main(): void
          initialize();
        end function
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      // Check all symbols exist
      expect(symbolTable.lookup('random')).toBeDefined();
      expect(symbolTable.lookup('borderColor')).toBeDefined();
      expect(symbolTable.lookup('counter')).toBeDefined();
      expect(symbolTable.lookup('score')).toBeDefined();
      expect(symbolTable.lookup('initialize')).toBeDefined();
      expect(symbolTable.lookup('main')).toBeDefined();

      // Check symbol kinds
      expect(symbolTable.lookup('random')!.kind).toBe(SymbolKind.ImportedSymbol);
      expect(symbolTable.lookup('borderColor')!.kind).toBe(SymbolKind.MapVariable);
      expect(symbolTable.lookup('counter')!.kind).toBe(SymbolKind.Variable);
      expect(symbolTable.lookup('initialize')!.kind).toBe(SymbolKind.Function);

      // Check storage classes
      expect(symbolTable.lookup('counter')!.storageClass).toBe(StorageClass.ZeroPage);
      expect(symbolTable.lookup('borderColor')!.storageClass).toBe(StorageClass.Map);

      // Check export flags
      expect(symbolTable.lookup('score')!.isExported).toBe(true);
      expect(symbolTable.lookup('main')!.isExported).toBe(true);
      expect(symbolTable.lookup('initialize')!.isExported).toBe(false);
    });

    test('handles complex nested function with parameters and local variables', () => {
      const source = `
        function process(input: byte, flags: byte): word
          let temp: byte = 0;
          let result: word = 0;

          temp = input;
          result = temp * flags;

          return result;
        end function
      `;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);

      const rootScope = symbolTable.getRootScope();
      const functionScope = rootScope.children[0];

      // Function should be in module scope
      expect(rootScope.symbols.has('process')).toBe(true);

      // Parameters and local variables should be in function scope
      expect(functionScope.symbols.has('input')).toBe(true);
      expect(functionScope.symbols.has('flags')).toBe(true);
      expect(functionScope.symbols.has('temp')).toBe(true);
      expect(functionScope.symbols.has('result')).toBe(true);

      // Check symbol kinds
      expect(functionScope.symbols.get('input')!.kind).toBe(SymbolKind.Parameter);
      expect(functionScope.symbols.get('flags')!.kind).toBe(SymbolKind.Parameter);
      expect(functionScope.symbols.get('temp')!.kind).toBe(SymbolKind.Variable);
      expect(functionScope.symbols.get('result')!.kind).toBe(SymbolKind.Variable);
    });

    test('detects mixed duplicate declarations', () => {
      const source = `
        let name: byte = 0;
        function name(): void
        end function
      `;
      const { diagnostics, hasErrors } = buildSymbolTable(source);

      expect(hasErrors).toBe(true);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toContain('Duplicate declaration');
      expect(diagnostics[0].message).toContain('name');
    });

    test('handles empty program', () => {
      const source = ``;
      const { symbolTable, diagnostics } = buildSymbolTable(source);

      expect(diagnostics).toHaveLength(0);
      expect(symbolTable.getSymbolCount()).toBe(0);
      expect(symbolTable.getScopeCount()).toBe(1); // Just root scope
    });
  });
});
