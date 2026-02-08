/**
 * Symbol Table Tests
 *
 * Tests for SymbolTable class operations:
 * - Scope creation and management
 * - Symbol declaration
 * - Symbol lookup (local and hierarchical)
 * - Scope navigation
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { SourceLocation } from '../../ast/index.js';
import {
  ScopeKind,
  SymbolKind,
  SymbolTable,
  type Symbol as SemanticSymbol,
} from '../../semantic/index.js';

describe('SymbolTable', () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  /**
   * Helper to create a simple test location
   */
  function loc(line: number = 1, column: number = 1): SourceLocation {
    return {
      start: { line, column, offset: 0 },
      end: { line, column: column + 5, offset: 5 },
    };
  }

  describe('Initialization', () => {
    test('creates root module scope on construction', () => {
      const rootScope = symbolTable.getRootScope();
      expect(rootScope).toBeDefined();
      expect(rootScope.kind).toBe(ScopeKind.Module);
      expect(rootScope.parent).toBeNull();
      expect(rootScope.children).toHaveLength(0);
    });

    test('starts with root scope as current scope', () => {
      const currentScope = symbolTable.getCurrentScope();
      const rootScope = symbolTable.getRootScope();
      expect(currentScope).toBe(rootScope);
    });

    test('has one scope initially (root)', () => {
      expect(symbolTable.getScopeCount()).toBe(1);
    });

    test('has zero symbols initially', () => {
      expect(symbolTable.getSymbolCount()).toBe(0);
    });
  });

  describe('Scope Creation', () => {
    test('creates module scope', () => {
      const scope = symbolTable.createScope(ScopeKind.Module, null, null);
      expect(scope.kind).toBe(ScopeKind.Module);
      expect(scope.parent).toBeNull();
      expect(scope.id).toMatch(/^scope_\d+$/);
    });

    test('creates function scope with parent', () => {
      const parentScope = symbolTable.getRootScope();
      const functionScope = symbolTable.createScope(ScopeKind.Function, parentScope, null);

      expect(functionScope.kind).toBe(ScopeKind.Function);
      expect(functionScope.parent).toBe(parentScope);
      expect(parentScope.children).toContain(functionScope);
    });

    test('assigns unique IDs to scopes', () => {
      const scope1 = symbolTable.createScope(ScopeKind.Module, null, null);
      const scope2 = symbolTable.createScope(ScopeKind.Module, null, null);

      expect(scope1.id).not.toBe(scope2.id);
    });

    test('increments scope count', () => {
      const initialCount = symbolTable.getScopeCount();
      symbolTable.createScope(ScopeKind.Function, symbolTable.getRootScope(), null);
      expect(symbolTable.getScopeCount()).toBe(initialCount + 1);
    });
  });

  describe('Scope Navigation', () => {
    test('enters scope changes current scope', () => {
      const newScope = symbolTable.createScope(
        ScopeKind.Function,
        symbolTable.getRootScope(),
        null
      );
      symbolTable.enterScope(newScope);

      expect(symbolTable.getCurrentScope()).toBe(newScope);
    });

    test('exits scope returns to parent', () => {
      const rootScope = symbolTable.getRootScope();
      const functionScope = symbolTable.createScope(ScopeKind.Function, rootScope, null);

      symbolTable.enterScope(functionScope);
      expect(symbolTable.getCurrentScope()).toBe(functionScope);

      symbolTable.exitScope();
      expect(symbolTable.getCurrentScope()).toBe(rootScope);
    });

    test('exits root scope stays at root', () => {
      const rootScope = symbolTable.getRootScope();
      symbolTable.exitScope(); // Try to exit root

      expect(symbolTable.getCurrentScope()).toBe(rootScope);
    });

    test('navigates nested scopes correctly', () => {
      const rootScope = symbolTable.getRootScope();
      const scope1 = symbolTable.createScope(ScopeKind.Function, rootScope, null);
      const scope2 = symbolTable.createScope(ScopeKind.Function, scope1, null);

      symbolTable.enterScope(scope1);
      symbolTable.enterScope(scope2);
      expect(symbolTable.getCurrentScope()).toBe(scope2);

      symbolTable.exitScope();
      expect(symbolTable.getCurrentScope()).toBe(scope1);

      symbolTable.exitScope();
      expect(symbolTable.getCurrentScope()).toBe(rootScope);
    });
  });

  describe('Symbol Declaration', () => {
    test('declares symbol in current scope', () => {
      const symbol: SemanticSymbol = {
        name: 'counter',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: symbolTable.getCurrentScope(),
        location: loc(),
      };

      symbolTable.declare(symbol);

      const found = symbolTable.lookupLocal('counter');
      expect(found).toBe(symbol);
    });

    test('throws error on duplicate declaration in same scope', () => {
      const symbol1: SemanticSymbol = {
        name: 'counter',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: symbolTable.getCurrentScope(),
        location: loc(1, 1),
      };

      const symbol2: SemanticSymbol = {
        name: 'counter',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: symbolTable.getCurrentScope(),
        location: loc(2, 1),
      };

      symbolTable.declare(symbol1);
      expect(() => symbolTable.declare(symbol2)).toThrow(/Duplicate declaration/);
    });

    test('allows same name in different scopes', () => {
      const rootScope = symbolTable.getRootScope();
      const functionScope = symbolTable.createScope(ScopeKind.Function, rootScope, null);

      const symbol1: SemanticSymbol = {
        name: 'x',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: rootScope,
        location: loc(1, 1),
      };

      const symbol2: SemanticSymbol = {
        name: 'x',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: functionScope,
        location: loc(5, 1),
      };

      symbolTable.declare(symbol1);

      symbolTable.enterScope(functionScope);
      symbolTable.declare(symbol2);

      // Both should exist in their respective scopes
      expect(rootScope.symbols.get('x')).toBe(symbol1);
      expect(functionScope.symbols.get('x')).toBe(symbol2);
    });

    test('increments symbol count', () => {
      const symbol: SemanticSymbol = {
        name: 'counter',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: symbolTable.getCurrentScope(),
        location: loc(1, 1),
      };

      const initialCount = symbolTable.getSymbolCount();
      symbolTable.declare(symbol);
      expect(symbolTable.getSymbolCount()).toBe(initialCount + 1);
    });
  });

  describe('Symbol Lookup', () => {
    test('lookupLocal finds symbol in current scope', () => {
      const symbol: SemanticSymbol = {
        name: 'counter',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: symbolTable.getCurrentScope(),
        location: loc(1, 1),
      };

      symbolTable.declare(symbol);
      const found = symbolTable.lookupLocal('counter');
      expect(found).toBe(symbol);
    });

    test('lookupLocal returns undefined for non-existent symbol', () => {
      const found = symbolTable.lookupLocal('nonExistent');
      expect(found).toBeUndefined();
    });

    test('lookupLocal does not search parent scopes', () => {
      const rootScope = symbolTable.getRootScope();
      const functionScope = symbolTable.createScope(ScopeKind.Function, rootScope, null);

      const symbol: SemanticSymbol = {
        name: 'x',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: rootScope,
        location: loc(1, 1),
      };

      symbolTable.declare(symbol);
      symbolTable.enterScope(functionScope);

      // lookupLocal should not find symbol from parent
      expect(symbolTable.lookupLocal('x')).toBeUndefined();
    });

    test('lookup finds symbol in current scope', () => {
      const symbol: SemanticSymbol = {
        name: 'counter',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: symbolTable.getCurrentScope(),
        location: loc(1, 1),
      };

      symbolTable.declare(symbol);
      const found = symbolTable.lookup('counter');
      expect(found).toBe(symbol);
    });

    test('lookup searches parent scopes', () => {
      const rootScope = symbolTable.getRootScope();
      const functionScope = symbolTable.createScope(ScopeKind.Function, rootScope, null);

      const symbol: SemanticSymbol = {
        name: 'x',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: rootScope,
        location: loc(1, 1),
      };

      symbolTable.declare(symbol);
      symbolTable.enterScope(functionScope);

      // lookup should find symbol from parent scope
      const found = symbolTable.lookup('x');
      expect(found).toBe(symbol);
    });

    test('lookup prefers local over parent', () => {
      const rootScope = symbolTable.getRootScope();
      const functionScope = symbolTable.createScope(ScopeKind.Function, rootScope, null);

      const symbolRoot: SemanticSymbol = {
        name: 'x',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: rootScope,
        location: loc(1, 1),
      };

      const symbolLocal: SemanticSymbol = {
        name: 'x',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: functionScope,
        location: loc(5, 1),
      };

      symbolTable.declare(symbolRoot);
      symbolTable.enterScope(functionScope);
      symbolTable.declare(symbolLocal);

      // Should find local symbol, not parent
      const found = symbolTable.lookup('x');
      expect(found).toBe(symbolLocal);
    });

    test('lookup returns undefined for non-existent symbol', () => {
      const found = symbolTable.lookup('nonExistent');
      expect(found).toBeUndefined();
    });
  });

  describe('Symbol Collection', () => {
    test('getSymbolsInScope returns symbols in current scope', () => {
      const symbol1: SemanticSymbol = {
        name: 'a',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: symbolTable.getCurrentScope(),
        location: loc(1, 1),
      };

      const symbol2: SemanticSymbol = {
        name: 'b',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: symbolTable.getCurrentScope(),
        location: loc(2, 1),
      };

      symbolTable.declare(symbol1);
      symbolTable.declare(symbol2);

      const symbols = symbolTable.getSymbolsInScope();
      expect(symbols).toHaveLength(2);
      expect(symbols).toContain(symbol1);
      expect(symbols).toContain(symbol2);
    });

    test('getVisibleSymbols returns symbols from scope chain', () => {
      const rootScope = symbolTable.getRootScope();
      const functionScope = symbolTable.createScope(ScopeKind.Function, rootScope, null);

      const symbolRoot: SemanticSymbol = {
        name: 'x',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: rootScope,
        location: loc(1, 1),
      };

      const symbolLocal: SemanticSymbol = {
        name: 'y',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: functionScope,
        location: loc(5, 1),
      };

      symbolTable.declare(symbolRoot);
      symbolTable.enterScope(functionScope);
      symbolTable.declare(symbolLocal);

      const visible = symbolTable.getVisibleSymbols();
      expect(visible).toHaveLength(2);
      expect(visible).toContain(symbolRoot);
      expect(visible).toContain(symbolLocal);
    });
  });

  describe('Reset', () => {
    test('reset clears all scopes and symbols', () => {
      symbolTable.createScope(ScopeKind.Function, symbolTable.getRootScope(), null);

      const symbol: SemanticSymbol = {
        name: 'x',
        kind: SymbolKind.Variable,
        declaration: null as any,
        isExported: false,
        isConst: false,
        scope: symbolTable.getCurrentScope(),
        location: loc(1, 1),
      };

      symbolTable.declare(symbol);

      expect(symbolTable.getScopeCount()).toBeGreaterThan(1);
      expect(symbolTable.getSymbolCount()).toBe(1);

      symbolTable.reset();

      expect(symbolTable.getScopeCount()).toBe(1); // Only root
      expect(symbolTable.getSymbolCount()).toBe(0);
      expect(symbolTable.getCurrentScope()).toBe(symbolTable.getRootScope());
    });
  });
});
