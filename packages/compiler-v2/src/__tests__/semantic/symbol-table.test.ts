/**
 * SymbolTable Tests for Blend65 Compiler v2
 *
 * Tests the SymbolTable class for scope management and symbol declaration/lookup.
 *
 * @module __tests__/semantic/symbol-table.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SymbolTable, type DeclareResult } from '../../semantic/symbol-table.js';
import { SymbolKind, createSymbol, createFunctionSymbol } from '../../semantic/symbol.js';
import { ScopeKind } from '../../semantic/scope.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import type { SourceLocation } from '../../ast/index.js';

/**
 * Creates a test source location
 */
function createTestLocation(line: number = 1, column: number = 0): SourceLocation {
  return {
    start: { line, column, offset: 0 },
    end: { line, column: column + 5, offset: 5 },
  };
}

describe('SymbolTable', () => {
  describe('constructor', () => {
    it('should create symbol table with root module scope', () => {
      const symbolTable = new SymbolTable();

      expect(symbolTable.getRootScope()).toBeDefined();
      expect(symbolTable.getRootScope().kind).toBe(ScopeKind.Module);
    });

    it('should set current scope to root scope initially', () => {
      const symbolTable = new SymbolTable();

      expect(symbolTable.getCurrentScope()).toBe(symbolTable.getRootScope());
    });

    it('should use default module name "main"', () => {
      const symbolTable = new SymbolTable();

      expect(symbolTable.getModuleName()).toBe('main');
    });

    it('should use provided module name', () => {
      const symbolTable = new SymbolTable(null, 'utils');

      expect(symbolTable.getModuleName()).toBe('utils');
    });

    it('should store provided AST node in root scope', () => {
      const node = { type: 'Program' } as any;
      const symbolTable = new SymbolTable(node);

      expect(symbolTable.getRootScope().node).toBe(node);
    });

    it('should start with scope count of 1', () => {
      const symbolTable = new SymbolTable();

      expect(symbolTable.getScopeCount()).toBe(1);
    });

    it('should start with symbol count of 0', () => {
      const symbolTable = new SymbolTable();

      expect(symbolTable.getTotalSymbolCount()).toBe(0);
    });
  });

  describe('scope management', () => {
    let symbolTable: SymbolTable;
    let location: SourceLocation;

    beforeEach(() => {
      symbolTable = new SymbolTable();
      location = createTestLocation();
    });

    describe('enterFunctionScope', () => {
      it('should create function scope', () => {
        const funcResult = symbolTable.declareFunction('test', location);
        const funcSymbol = funcResult.symbol!;
        const scope = symbolTable.enterFunctionScope(funcSymbol);

        expect(scope.kind).toBe(ScopeKind.Function);
      });

      it('should set function scope as current', () => {
        const funcResult = symbolTable.declareFunction('test', location);
        const funcSymbol = funcResult.symbol!;
        const scope = symbolTable.enterFunctionScope(funcSymbol);

        expect(symbolTable.getCurrentScope()).toBe(scope);
      });

      it('should set function symbol on scope', () => {
        const funcResult = symbolTable.declareFunction('test', location);
        const funcSymbol = funcResult.symbol!;
        const scope = symbolTable.enterFunctionScope(funcSymbol);

        expect(scope.functionSymbol).toBe(funcSymbol);
      });

      it('should increment scope count', () => {
        const funcResult = symbolTable.declareFunction('test', location);
        symbolTable.enterFunctionScope(funcResult.symbol!);

        expect(symbolTable.getScopeCount()).toBe(2);
      });

      it('should add scope to all scopes map', () => {
        const funcResult = symbolTable.declareFunction('test', location);
        const scope = symbolTable.enterFunctionScope(funcResult.symbol!);

        expect(symbolTable.getScope(scope.id)).toBe(scope);
      });
    });

    describe('enterBlockScope', () => {
      it('should create block scope', () => {
        const scope = symbolTable.enterBlockScope();

        expect(scope.kind).toBe(ScopeKind.Block);
      });

      it('should set block scope as current', () => {
        const scope = symbolTable.enterBlockScope();

        expect(symbolTable.getCurrentScope()).toBe(scope);
      });

      it('should set parent to previous current scope', () => {
        const rootScope = symbolTable.getRootScope();
        const scope = symbolTable.enterBlockScope();

        expect(scope.parent).toBe(rootScope);
      });
    });

    describe('enterLoopScope', () => {
      it('should create loop scope', () => {
        const scope = symbolTable.enterLoopScope();

        expect(scope.kind).toBe(ScopeKind.Loop);
      });

      it('should set loop scope as current', () => {
        const scope = symbolTable.enterLoopScope();

        expect(symbolTable.getCurrentScope()).toBe(scope);
      });

      it('should set loopDepth to 1', () => {
        const scope = symbolTable.enterLoopScope();

        expect(scope.loopDepth).toBe(1);
      });

      it('should increment loopDepth in nested loops', () => {
        symbolTable.enterLoopScope();
        const inner = symbolTable.enterLoopScope();

        expect(inner.loopDepth).toBe(2);
      });
    });

    describe('exitScope', () => {
      it('should return to parent scope', () => {
        const rootScope = symbolTable.getRootScope();
        symbolTable.enterBlockScope();
        symbolTable.exitScope();

        expect(symbolTable.getCurrentScope()).toBe(rootScope);
      });

      it('should throw when trying to exit module scope', () => {
        expect(() => symbolTable.exitScope()).toThrow('Cannot exit module scope');
      });

      it('should handle multiple enter/exit cycles', () => {
        const rootScope = symbolTable.getRootScope();

        symbolTable.enterBlockScope();
        symbolTable.enterBlockScope();
        symbolTable.exitScope();
        symbolTable.exitScope();

        expect(symbolTable.getCurrentScope()).toBe(rootScope);
      });
    });

    describe('isInLoop', () => {
      it('should return false in module scope', () => {
        expect(symbolTable.isInLoop()).toBe(false);
      });

      it('should return true in loop scope', () => {
        symbolTable.enterLoopScope();

        expect(symbolTable.isInLoop()).toBe(true);
      });

      it('should return true in nested block inside loop', () => {
        symbolTable.enterLoopScope();
        symbolTable.enterBlockScope();

        expect(symbolTable.isInLoop()).toBe(true);
      });

      it('should return false after exiting loop', () => {
        symbolTable.enterLoopScope();
        symbolTable.exitScope();

        expect(symbolTable.isInLoop()).toBe(false);
      });
    });

    describe('isInFunction', () => {
      it('should return false in module scope', () => {
        expect(symbolTable.isInFunction()).toBe(false);
      });

      it('should return true in function scope', () => {
        const funcResult = symbolTable.declareFunction('test', location);
        symbolTable.enterFunctionScope(funcResult.symbol!);

        expect(symbolTable.isInFunction()).toBe(true);
      });

      it('should return true in nested scope inside function', () => {
        const funcResult = symbolTable.declareFunction('test', location);
        symbolTable.enterFunctionScope(funcResult.symbol!);
        symbolTable.enterBlockScope();

        expect(symbolTable.isInFunction()).toBe(true);
      });
    });

    describe('getCurrentFunction', () => {
      it('should return undefined in module scope', () => {
        expect(symbolTable.getCurrentFunction()).toBeUndefined();
      });

      it('should return function symbol in function scope', () => {
        const funcResult = symbolTable.declareFunction('test', location);
        symbolTable.enterFunctionScope(funcResult.symbol!);

        expect(symbolTable.getCurrentFunction()).toBe(funcResult.symbol);
      });

      it('should return function symbol in nested scope', () => {
        const funcResult = symbolTable.declareFunction('test', location);
        symbolTable.enterFunctionScope(funcResult.symbol!);
        symbolTable.enterLoopScope();
        symbolTable.enterBlockScope();

        expect(symbolTable.getCurrentFunction()).toBe(funcResult.symbol);
      });
    });
  });

  describe('symbol declaration', () => {
    let symbolTable: SymbolTable;
    let location: SourceLocation;

    beforeEach(() => {
      symbolTable = new SymbolTable();
      location = createTestLocation();
    });

    describe('declareVariable', () => {
      it('should declare a variable successfully', () => {
        const result = symbolTable.declareVariable('x', location);

        expect(result.success).toBe(true);
        expect(result.symbol).toBeDefined();
        expect(result.symbol?.name).toBe('x');
        expect(result.symbol?.kind).toBe(SymbolKind.Variable);
      });

      it('should set type to null by default', () => {
        const result = symbolTable.declareVariable('x', location);

        expect(result.symbol?.type).toBeNull();
      });

      it('should set type when provided', () => {
        const result = symbolTable.declareVariable('x', location, BUILTIN_TYPES.BYTE);

        expect(result.symbol?.type).toBe(BUILTIN_TYPES.BYTE);
      });

      it('should set isConst when provided', () => {
        const result = symbolTable.declareVariable('x', location, null, { isConst: true });

        expect(result.symbol?.isConst).toBe(true);
      });

      it('should set isExported when provided', () => {
        const result = symbolTable.declareVariable('x', location, null, { isExported: true });

        expect(result.symbol?.isExported).toBe(true);
      });

      it('should fail for duplicate in same scope', () => {
        symbolTable.declareVariable('x', location);
        const result = symbolTable.declareVariable('x', location);

        expect(result.success).toBe(false);
        expect(result.error).toContain('already declared');
        expect(result.existingSymbol).toBeDefined();
      });

      it('should allow same name in different scope (shadowing)', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.enterBlockScope();
        const result = symbolTable.declareVariable('x', location);

        expect(result.success).toBe(true);
      });
    });

    describe('declareConstant', () => {
      it('should declare a constant successfully', () => {
        const result = symbolTable.declareConstant('MAX', location);

        expect(result.success).toBe(true);
        expect(result.symbol?.kind).toBe(SymbolKind.Constant);
        expect(result.symbol?.isConst).toBe(true);
      });

      it('should set isExported when provided', () => {
        const result = symbolTable.declareConstant('MAX', location, null, undefined, true);

        expect(result.symbol?.isExported).toBe(true);
      });

      it('should fail for duplicate', () => {
        symbolTable.declareConstant('MAX', location);
        const result = symbolTable.declareConstant('MAX', location);

        expect(result.success).toBe(false);
      });
    });

    describe('declareParameter', () => {
      it('should declare a parameter successfully', () => {
        const funcResult = symbolTable.declareFunction('test', location);
        symbolTable.enterFunctionScope(funcResult.symbol!);

        const result = symbolTable.declareParameter('arg', location);

        expect(result.success).toBe(true);
        expect(result.symbol?.kind).toBe(SymbolKind.Parameter);
      });

      it('should set type when provided', () => {
        const funcResult = symbolTable.declareFunction('test', location);
        symbolTable.enterFunctionScope(funcResult.symbol!);

        const result = symbolTable.declareParameter('arg', location, BUILTIN_TYPES.BYTE);

        expect(result.symbol?.type).toBe(BUILTIN_TYPES.BYTE);
      });

      it('should fail for duplicate parameter', () => {
        const funcResult = symbolTable.declareFunction('test', location);
        symbolTable.enterFunctionScope(funcResult.symbol!);

        symbolTable.declareParameter('arg', location);
        const result = symbolTable.declareParameter('arg', location);

        expect(result.success).toBe(false);
      });
    });

    describe('declareFunction', () => {
      it('should declare a function successfully', () => {
        const result = symbolTable.declareFunction('test', location);

        expect(result.success).toBe(true);
        expect(result.symbol?.kind).toBe(SymbolKind.Function);
      });

      it('should set return type when provided', () => {
        const result = symbolTable.declareFunction('test', location, BUILTIN_TYPES.BYTE);

        expect(result.symbol?.type).toBe(BUILTIN_TYPES.BYTE);
      });

      it('should set isExported when provided', () => {
        const result = symbolTable.declareFunction('test', location, null, undefined, true);

        expect(result.symbol?.isExported).toBe(true);
      });

      it('should initialize parameters as empty array', () => {
        const result = symbolTable.declareFunction('test', location);

        expect(result.symbol?.parameters).toEqual([]);
      });

      it('should fail for duplicate function', () => {
        symbolTable.declareFunction('test', location);
        const result = symbolTable.declareFunction('test', location);

        expect(result.success).toBe(false);
      });
    });

    describe('declareImport', () => {
      it('should declare an import successfully', () => {
        const result = symbolTable.declareImport('foo', 'foo', './module.blend', location);

        expect(result.success).toBe(true);
        expect(result.symbol?.kind).toBe(SymbolKind.ImportedSymbol);
        expect(result.symbol?.sourceModule).toBe('./module.blend');
      });

      it('should handle aliased imports', () => {
        const result = symbolTable.declareImport('myFoo', 'foo', './module.blend', location);

        expect(result.symbol?.name).toBe('myFoo');
        expect(result.symbol?.originalName).toBe('foo');
      });

      it('should fail for duplicate import', () => {
        symbolTable.declareImport('foo', 'foo', './mod.blend', location);
        const result = symbolTable.declareImport('foo', 'bar', './other.blend', location);

        expect(result.success).toBe(false);
      });
    });

    describe('declareEnumMember', () => {
      it('should declare an enum member successfully', () => {
        const result = symbolTable.declareEnumMember('Red', location);

        expect(result.success).toBe(true);
        expect(result.symbol?.kind).toBe(SymbolKind.EnumMember);
        expect(result.symbol?.isConst).toBe(true);
      });

      it('should fail for duplicate', () => {
        symbolTable.declareEnumMember('Red', location);
        const result = symbolTable.declareEnumMember('Red', location);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('symbol lookup', () => {
    let symbolTable: SymbolTable;
    let location: SourceLocation;

    beforeEach(() => {
      symbolTable = new SymbolTable();
      location = createTestLocation();
    });

    describe('lookupLocal', () => {
      it('should find symbol in current scope', () => {
        symbolTable.declareVariable('x', location);

        expect(symbolTable.lookupLocal('x')).toBeDefined();
      });

      it('should not find symbol in parent scope', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.enterBlockScope();

        expect(symbolTable.lookupLocal('x')).toBeUndefined();
      });

      it('should return undefined for non-existent symbol', () => {
        expect(symbolTable.lookupLocal('nonexistent')).toBeUndefined();
      });
    });

    describe('lookup', () => {
      it('should find symbol in current scope', () => {
        symbolTable.declareVariable('x', location);

        expect(symbolTable.lookup('x')).toBeDefined();
      });

      it('should find symbol in parent scope', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.enterBlockScope();

        expect(symbolTable.lookup('x')).toBeDefined();
      });

      it('should find symbol in grandparent scope', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.enterBlockScope();
        symbolTable.enterBlockScope();

        expect(symbolTable.lookup('x')).toBeDefined();
      });

      it('should return nearest symbol when shadowed', () => {
        symbolTable.declareVariable('x', location, BUILTIN_TYPES.BYTE);
        symbolTable.enterBlockScope();
        symbolTable.declareVariable('x', location, BUILTIN_TYPES.WORD);

        const found = symbolTable.lookup('x');
        expect(found?.type).toBe(BUILTIN_TYPES.WORD);
      });
    });

    describe('lookupGlobal', () => {
      it('should find symbol in module scope', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.enterBlockScope();

        expect(symbolTable.lookupGlobal('x')).toBeDefined();
      });

      it('should not find symbol in nested scope', () => {
        symbolTable.enterBlockScope();
        symbolTable.declareVariable('x', location);

        expect(symbolTable.lookupGlobal('x')).toBeUndefined();
      });
    });

    describe('hasLocal / has', () => {
      it('hasLocal should return true for local symbol', () => {
        symbolTable.declareVariable('x', location);

        expect(symbolTable.hasLocal('x')).toBe(true);
      });

      it('hasLocal should return false for parent symbol', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.enterBlockScope();

        expect(symbolTable.hasLocal('x')).toBe(false);
      });

      it('has should return true for any visible symbol', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.enterBlockScope();

        expect(symbolTable.has('x')).toBe(true);
      });
    });
  });

  describe('query methods', () => {
    let symbolTable: SymbolTable;
    let location: SourceLocation;

    beforeEach(() => {
      symbolTable = new SymbolTable();
      location = createTestLocation();
    });

    describe('getCurrentScopeSymbols', () => {
      it('should return symbols in current scope', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.declareVariable('y', location);

        const symbols = symbolTable.getCurrentScopeSymbols();

        expect(symbols.size).toBe(2);
        expect(symbols.has('x')).toBe(true);
        expect(symbols.has('y')).toBe(true);
      });

      it('should not include parent scope symbols', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.enterBlockScope();
        symbolTable.declareVariable('y', location);

        const symbols = symbolTable.getCurrentScopeSymbols();

        expect(symbols.size).toBe(1);
        expect(symbols.has('y')).toBe(true);
      });
    });

    describe('getAllVisibleSymbols', () => {
      it('should return all visible symbols from scope chain', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.enterBlockScope();
        symbolTable.declareVariable('y', location);

        const symbols = symbolTable.getAllVisibleSymbols();

        expect(symbols.size).toBe(2);
        expect(symbols.has('x')).toBe(true);
        expect(symbols.has('y')).toBe(true);
      });

      it('should return shadowed symbol from inner scope', () => {
        symbolTable.declareVariable('x', location, BUILTIN_TYPES.BYTE);
        symbolTable.enterBlockScope();
        symbolTable.declareVariable('x', location, BUILTIN_TYPES.WORD);

        const symbols = symbolTable.getAllVisibleSymbols();

        expect(symbols.size).toBe(1);
        expect(symbols.get('x')?.type).toBe(BUILTIN_TYPES.WORD);
      });
    });

    describe('getExportedSymbols', () => {
      it('should return only exported symbols', () => {
        symbolTable.declareVariable('x', location, null, { isExported: true });
        symbolTable.declareVariable('y', location);
        symbolTable.declareFunction('foo', location, null, undefined, true);

        const exports = symbolTable.getExportedSymbols();

        expect(exports).toHaveLength(2);
        expect(exports.map(s => s.name)).toContain('x');
        expect(exports.map(s => s.name)).toContain('foo');
      });

      it('should return empty array when no exports', () => {
        symbolTable.declareVariable('x', location);

        const exports = symbolTable.getExportedSymbols();

        expect(exports).toHaveLength(0);
      });
    });

    describe('getFunctionSymbols', () => {
      it('should return only function symbols', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.declareFunction('foo', location);
        symbolTable.declareFunction('bar', location);

        const functions = symbolTable.getFunctionSymbols();

        expect(functions).toHaveLength(2);
        expect(functions.map(s => s.name)).toContain('foo');
        expect(functions.map(s => s.name)).toContain('bar');
      });
    });

    describe('getSymbolsByKind', () => {
      it('should return symbols of specified kind', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.declareConstant('MAX', location);
        symbolTable.declareVariable('y', location);

        const variables = symbolTable.getSymbolsByKind(SymbolKind.Variable);

        expect(variables).toHaveLength(2);
      });

      it('should search in specified scope', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.enterBlockScope();
        symbolTable.declareVariable('y', location);

        const variables = symbolTable.getSymbolsByKind(
          SymbolKind.Variable,
          symbolTable.getRootScope(),
        );

        expect(variables).toHaveLength(1);
        expect(variables[0].name).toBe('x');
      });
    });
  });

  describe('utility methods', () => {
    let symbolTable: SymbolTable;
    let location: SourceLocation;

    beforeEach(() => {
      symbolTable = new SymbolTable();
      location = createTestLocation();
    });

    describe('getScopeCount', () => {
      it('should count all scopes', () => {
        expect(symbolTable.getScopeCount()).toBe(1); // module scope

        symbolTable.enterBlockScope();
        expect(symbolTable.getScopeCount()).toBe(2);

        symbolTable.enterLoopScope();
        expect(symbolTable.getScopeCount()).toBe(3);
      });
    });

    describe('getTotalSymbolCount', () => {
      it('should count all symbols across all scopes', () => {
        symbolTable.declareVariable('x', location);
        symbolTable.declareVariable('y', location);
        symbolTable.enterBlockScope();
        symbolTable.declareVariable('z', location);

        expect(symbolTable.getTotalSymbolCount()).toBe(3);
      });
    });

    describe('toDebugString', () => {
      it('should return debug representation', () => {
        symbolTable.declareVariable('x', location, BUILTIN_TYPES.BYTE);
        symbolTable.declareFunction('test', location);

        const debug = symbolTable.toDebugString();

        expect(debug).toContain('main');
        expect(debug).toContain('variable x');
        expect(debug).toContain('function test');
      });
    });

    describe('getScope', () => {
      it('should return scope by id', () => {
        const block = symbolTable.enterBlockScope();

        expect(symbolTable.getScope(block.id)).toBe(block);
      });

      it('should return undefined for unknown id', () => {
        expect(symbolTable.getScope('nonexistent')).toBeUndefined();
      });
    });

    describe('getAllScopes', () => {
      it('should return all scopes map', () => {
        symbolTable.enterBlockScope();
        symbolTable.enterLoopScope();

        const scopes = symbolTable.getAllScopes();

        expect(scopes.size).toBe(3);
      });
    });
  });

  describe('complex scenarios', () => {
    let symbolTable: SymbolTable;
    let location: SourceLocation;

    beforeEach(() => {
      symbolTable = new SymbolTable(null, 'complex');
      location = createTestLocation();
    });

    it('should handle typical function with parameters and locals', () => {
      // Declare function in module scope
      const funcResult = symbolTable.declareFunction('add', location, BUILTIN_TYPES.BYTE);
      const funcSymbol = funcResult.symbol!;

      // Enter function scope
      symbolTable.enterFunctionScope(funcSymbol);

      // Declare parameters
      symbolTable.declareParameter('a', location, BUILTIN_TYPES.BYTE);
      symbolTable.declareParameter('b', location, BUILTIN_TYPES.BYTE);

      // Declare local
      symbolTable.declareVariable('result', location, BUILTIN_TYPES.BYTE);

      // Verify lookups
      expect(symbolTable.lookup('a')).toBeDefined();
      expect(symbolTable.lookup('b')).toBeDefined();
      expect(symbolTable.lookup('result')).toBeDefined();
      expect(symbolTable.lookup('add')).toBeDefined(); // Function visible from its own scope

      // Exit function
      symbolTable.exitScope();

      // Parameters should not be visible
      expect(symbolTable.lookup('a')).toBeUndefined();
      expect(symbolTable.lookup('result')).toBeUndefined();
      // Function should still be visible
      expect(symbolTable.lookup('add')).toBeDefined();
    });

    it('should handle nested control flow', () => {
      const funcResult = symbolTable.declareFunction('test', location);
      symbolTable.enterFunctionScope(funcResult.symbol!);
      symbolTable.declareVariable('i', location);

      // while loop
      symbolTable.enterLoopScope();
      expect(symbolTable.isInLoop()).toBe(true);

      // if block inside loop
      symbolTable.enterBlockScope();
      symbolTable.declareVariable('temp', location);
      expect(symbolTable.isInLoop()).toBe(true);
      expect(symbolTable.lookup('i')).toBeDefined();
      expect(symbolTable.lookup('temp')).toBeDefined();

      symbolTable.exitScope(); // exit if
      expect(symbolTable.lookup('temp')).toBeUndefined();

      symbolTable.exitScope(); // exit loop
      expect(symbolTable.isInLoop()).toBe(false);

      symbolTable.exitScope(); // exit function
      expect(symbolTable.isInFunction()).toBe(false);
    });

    it('should handle multiple functions', () => {
      // First function
      const func1 = symbolTable.declareFunction('func1', location);
      symbolTable.enterFunctionScope(func1.symbol!);
      symbolTable.declareVariable('x', location);
      symbolTable.exitScope();

      // Second function
      const func2 = symbolTable.declareFunction('func2', location);
      symbolTable.enterFunctionScope(func2.symbol!);
      symbolTable.declareVariable('y', location);

      // x from func1 should not be visible
      expect(symbolTable.lookup('x')).toBeUndefined();
      expect(symbolTable.lookup('y')).toBeDefined();

      // Both functions should be visible
      expect(symbolTable.lookup('func1')).toBeDefined();
      expect(symbolTable.lookup('func2')).toBeDefined();
    });

    it('should handle variable shadowing correctly', () => {
      // Module-level variable
      symbolTable.declareVariable('counter', location, BUILTIN_TYPES.WORD);

      const funcResult = symbolTable.declareFunction('test', location);
      symbolTable.enterFunctionScope(funcResult.symbol!);

      // Parameter shadows module variable
      symbolTable.declareParameter('counter', location, BUILTIN_TYPES.BYTE);

      const param = symbolTable.lookup('counter');
      expect(param?.kind).toBe(SymbolKind.Parameter);
      expect(param?.type).toBe(BUILTIN_TYPES.BYTE);

      symbolTable.exitScope();

      // Module variable visible again
      const moduleVar = symbolTable.lookup('counter');
      expect(moduleVar?.kind).toBe(SymbolKind.Variable);
      expect(moduleVar?.type).toBe(BUILTIN_TYPES.WORD);
    });
  });
});