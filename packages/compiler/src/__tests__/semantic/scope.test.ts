/**
 * Scope Tests for Blend65 Compiler v2
 *
 * Tests the Scope interface, ScopeKind enum, and scope utility functions.
 *
 * @module __tests__/semantic/scope.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ScopeKind,
  type Scope,
  createScope,
  createModuleScope,
  createFunctionScope,
  createBlockScope,
  createLoopScope,
  declareSymbol,
  lookupLocal,
  lookupInChain,
  isInsideLoop,
  isInsideFunction,
  getEnclosingFunctionScope,
  getEnclosingFunctionSymbol,
  getModuleScope,
  isDescendantOf,
  getAllVisibleSymbols,
  getScopeDepth,
  isModuleScope,
  isFunctionScope,
  isBlockScope,
  isLoopScope,
} from '../../semantic/scope.js';
import { SymbolKind, createSymbol, createFunctionSymbol } from '../../semantic/symbol.js';
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

describe('ScopeKind enum', () => {
  it('should define Module kind', () => {
    expect(ScopeKind.Module).toBe('module');
  });

  it('should define Function kind', () => {
    expect(ScopeKind.Function).toBe('function');
  });

  it('should define Block kind', () => {
    expect(ScopeKind.Block).toBe('block');
  });

  it('should define Loop kind', () => {
    expect(ScopeKind.Loop).toBe('loop');
  });
});

describe('createScope', () => {
  it('should create a scope with required fields', () => {
    const scope = createScope('scope_0', ScopeKind.Module, null, null);

    expect(scope.id).toBe('scope_0');
    expect(scope.kind).toBe(ScopeKind.Module);
    expect(scope.parent).toBeNull();
    expect(scope.node).toBeNull();
  });

  it('should initialize children as empty array', () => {
    const scope = createScope('scope_0', ScopeKind.Module, null, null);

    expect(scope.children).toEqual([]);
  });

  it('should initialize symbols as empty Map', () => {
    const scope = createScope('scope_0', ScopeKind.Module, null, null);

    expect(scope.symbols).toBeInstanceOf(Map);
    expect(scope.symbols.size).toBe(0);
  });

  it('should add scope to parent children when parent exists', () => {
    const parent = createScope('scope_0', ScopeKind.Module, null, null);
    const child = createScope('scope_1', ScopeKind.Block, parent, null);

    expect(parent.children).toContain(child);
    expect(parent.children).toHaveLength(1);
  });

  it('should set parent reference correctly', () => {
    const parent = createScope('scope_0', ScopeKind.Module, null, null);
    const child = createScope('scope_1', ScopeKind.Block, parent, null);

    expect(child.parent).toBe(parent);
  });
});

describe('createModuleScope', () => {
  it('should create a module scope', () => {
    const scope = createModuleScope('scope_0', null);

    expect(scope.kind).toBe(ScopeKind.Module);
  });

  it('should have null parent', () => {
    const scope = createModuleScope('scope_0', null);

    expect(scope.parent).toBeNull();
  });

  it('should set the node reference', () => {
    const node = {} as any; // Mock AST node
    const scope = createModuleScope('scope_0', node);

    expect(scope.node).toBe(node);
  });
});

describe('createFunctionScope', () => {
  let moduleScope: Scope;
  let functionSymbol: any;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
    const location = createTestLocation();
    functionSymbol = createFunctionSymbol('test', location, moduleScope, [], null);
  });

  it('should create a function scope', () => {
    const scope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);

    expect(scope.kind).toBe(ScopeKind.Function);
  });

  it('should set parent correctly', () => {
    const scope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);

    expect(scope.parent).toBe(moduleScope);
  });

  it('should set functionSymbol', () => {
    const scope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);

    expect(scope.functionSymbol).toBe(functionSymbol);
  });

  it('should reset loopDepth to 0', () => {
    const scope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);

    expect(scope.loopDepth).toBe(0);
  });

  it('should add function scope to parent children', () => {
    const scope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);

    expect(moduleScope.children).toContain(scope);
  });
});

describe('createBlockScope', () => {
  let moduleScope: Scope;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
  });

  it('should create a block scope', () => {
    const scope = createBlockScope('scope_1', moduleScope, null);

    expect(scope.kind).toBe(ScopeKind.Block);
  });

  it('should set parent correctly', () => {
    const scope = createBlockScope('scope_1', moduleScope, null);

    expect(scope.parent).toBe(moduleScope);
  });

  it('should inherit loopDepth from parent when defined', () => {
    moduleScope.loopDepth = 2;
    const scope = createBlockScope('scope_1', moduleScope, null);

    expect(scope.loopDepth).toBe(2);
  });

  it('should not set loopDepth when parent has no loopDepth', () => {
    const scope = createBlockScope('scope_1', moduleScope, null);

    expect(scope.loopDepth).toBeUndefined();
  });
});

describe('createLoopScope', () => {
  let moduleScope: Scope;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
  });

  it('should create a loop scope', () => {
    const scope = createLoopScope('scope_1', moduleScope, null);

    expect(scope.kind).toBe(ScopeKind.Loop);
  });

  it('should increment loopDepth from 0 to 1', () => {
    const scope = createLoopScope('scope_1', moduleScope, null);

    expect(scope.loopDepth).toBe(1);
  });

  it('should increment loopDepth from parent', () => {
    const loop1 = createLoopScope('scope_1', moduleScope, null);
    const loop2 = createLoopScope('scope_2', loop1, null);

    expect(loop2.loopDepth).toBe(2);
  });

  it('should handle deeply nested loops', () => {
    let scope: Scope = moduleScope;
    for (let i = 1; i <= 5; i++) {
      scope = createLoopScope(`scope_${i}`, scope, null);
      expect(scope.loopDepth).toBe(i);
    }
  });
});

describe('declareSymbol', () => {
  let scope: Scope;
  let location: SourceLocation;

  beforeEach(() => {
    scope = createModuleScope('scope_0', null);
    location = createTestLocation();
  });

  it('should add symbol to scope', () => {
    const symbol = createSymbol('x', SymbolKind.Variable, location, scope);
    const result = declareSymbol(scope, symbol);

    expect(result).toBe(true);
    expect(scope.symbols.has('x')).toBe(true);
    expect(scope.symbols.get('x')).toBe(symbol);
  });

  it('should return false for duplicate name', () => {
    const symbol1 = createSymbol('x', SymbolKind.Variable, location, scope);
    const symbol2 = createSymbol('x', SymbolKind.Variable, location, scope);

    declareSymbol(scope, symbol1);
    const result = declareSymbol(scope, symbol2);

    expect(result).toBe(false);
  });

  it('should not replace existing symbol on duplicate', () => {
    const symbol1 = createSymbol('x', SymbolKind.Variable, location, scope);
    const symbol2 = createSymbol('x', SymbolKind.Parameter, location, scope);

    declareSymbol(scope, symbol1);
    declareSymbol(scope, symbol2);

    expect(scope.symbols.get('x')).toBe(symbol1);
  });

  it('should allow different names', () => {
    const symbol1 = createSymbol('x', SymbolKind.Variable, location, scope);
    const symbol2 = createSymbol('y', SymbolKind.Variable, location, scope);

    expect(declareSymbol(scope, symbol1)).toBe(true);
    expect(declareSymbol(scope, symbol2)).toBe(true);
    expect(scope.symbols.size).toBe(2);
  });
});

describe('lookupLocal', () => {
  let scope: Scope;
  let location: SourceLocation;

  beforeEach(() => {
    scope = createModuleScope('scope_0', null);
    location = createTestLocation();
  });

  it('should find symbol in scope', () => {
    const symbol = createSymbol('x', SymbolKind.Variable, location, scope);
    declareSymbol(scope, symbol);

    expect(lookupLocal(scope, 'x')).toBe(symbol);
  });

  it('should return undefined for non-existent symbol', () => {
    expect(lookupLocal(scope, 'nonexistent')).toBeUndefined();
  });

  it('should not find symbol in parent scope', () => {
    const parent = createModuleScope('scope_0', null);
    const child = createBlockScope('scope_1', parent, null);

    const symbol = createSymbol('x', SymbolKind.Variable, location, parent);
    declareSymbol(parent, symbol);

    expect(lookupLocal(child, 'x')).toBeUndefined();
  });
});

describe('lookupInChain', () => {
  let moduleScope: Scope;
  let blockScope: Scope;
  let location: SourceLocation;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
    blockScope = createBlockScope('scope_1', moduleScope, null);
    location = createTestLocation();
  });

  it('should find symbol in current scope', () => {
    const symbol = createSymbol('x', SymbolKind.Variable, location, blockScope);
    declareSymbol(blockScope, symbol);

    expect(lookupInChain(blockScope, 'x')).toBe(symbol);
  });

  it('should find symbol in parent scope', () => {
    const symbol = createSymbol('x', SymbolKind.Variable, location, moduleScope);
    declareSymbol(moduleScope, symbol);

    expect(lookupInChain(blockScope, 'x')).toBe(symbol);
  });

  it('should find symbol in grandparent scope', () => {
    const innerBlock = createBlockScope('scope_2', blockScope, null);

    const symbol = createSymbol('x', SymbolKind.Variable, location, moduleScope);
    declareSymbol(moduleScope, symbol);

    expect(lookupInChain(innerBlock, 'x')).toBe(symbol);
  });

  it('should return symbol from nearest scope (shadowing)', () => {
    const parentSymbol = createSymbol('x', SymbolKind.Variable, location, moduleScope);
    const childSymbol = createSymbol('x', SymbolKind.Variable, location, blockScope);

    declareSymbol(moduleScope, parentSymbol);
    declareSymbol(blockScope, childSymbol);

    expect(lookupInChain(blockScope, 'x')).toBe(childSymbol);
  });

  it('should return undefined for non-existent symbol', () => {
    expect(lookupInChain(blockScope, 'nonexistent')).toBeUndefined();
  });
});

describe('isInsideLoop', () => {
  let moduleScope: Scope;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
  });

  it('should return false for module scope', () => {
    expect(isInsideLoop(moduleScope)).toBe(false);
  });

  it('should return true for loop scope', () => {
    const loopScope = createLoopScope('scope_1', moduleScope, null);

    expect(isInsideLoop(loopScope)).toBe(true);
  });

  it('should return true for block scope inside loop', () => {
    const loopScope = createLoopScope('scope_1', moduleScope, null);
    const blockScope = createBlockScope('scope_2', loopScope, null);

    expect(isInsideLoop(blockScope)).toBe(true);
  });

  it('should return false for block scope outside loop', () => {
    const blockScope = createBlockScope('scope_1', moduleScope, null);

    expect(isInsideLoop(blockScope)).toBe(false);
  });
});

describe('isInsideFunction', () => {
  let moduleScope: Scope;
  let functionSymbol: any;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
    const location = createTestLocation();
    functionSymbol = createFunctionSymbol('test', location, moduleScope, [], null);
  });

  it('should return false for module scope', () => {
    expect(isInsideFunction(moduleScope)).toBe(false);
  });

  it('should return true for function scope', () => {
    const functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);

    expect(isInsideFunction(functionScope)).toBe(true);
  });

  it('should return true for block scope inside function', () => {
    const functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);
    const blockScope = createBlockScope('scope_2', functionScope, null);

    expect(isInsideFunction(blockScope)).toBe(true);
  });

  it('should return true for loop scope inside function', () => {
    const functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);
    const loopScope = createLoopScope('scope_2', functionScope, null);

    expect(isInsideFunction(loopScope)).toBe(true);
  });
});

describe('getEnclosingFunctionScope', () => {
  let moduleScope: Scope;
  let functionSymbol: any;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
    const location = createTestLocation();
    functionSymbol = createFunctionSymbol('test', location, moduleScope, [], null);
  });

  it('should return null for module scope', () => {
    expect(getEnclosingFunctionScope(moduleScope)).toBeNull();
  });

  it('should return function scope when in function scope', () => {
    const functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);

    expect(getEnclosingFunctionScope(functionScope)).toBe(functionScope);
  });

  it('should return function scope when in nested block', () => {
    const functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);
    const blockScope = createBlockScope('scope_2', functionScope, null);

    expect(getEnclosingFunctionScope(blockScope)).toBe(functionScope);
  });

  it('should return function scope when in deeply nested scope', () => {
    const functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);
    const block1 = createBlockScope('scope_2', functionScope, null);
    const loop1 = createLoopScope('scope_3', block1, null);
    const block2 = createBlockScope('scope_4', loop1, null);

    expect(getEnclosingFunctionScope(block2)).toBe(functionScope);
  });
});

describe('getEnclosingFunctionSymbol', () => {
  let moduleScope: Scope;
  let functionSymbol: any;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
    const location = createTestLocation();
    functionSymbol = createFunctionSymbol('test', location, moduleScope, [], null);
  });

  it('should return undefined for module scope', () => {
    expect(getEnclosingFunctionSymbol(moduleScope)).toBeUndefined();
  });

  it('should return function symbol when in function scope', () => {
    const functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);

    expect(getEnclosingFunctionSymbol(functionScope)).toBe(functionSymbol);
  });

  it('should return function symbol when in nested block', () => {
    const functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);
    const blockScope = createBlockScope('scope_2', functionScope, null);

    expect(getEnclosingFunctionSymbol(blockScope)).toBe(functionSymbol);
  });
});

describe('getModuleScope', () => {
  let moduleScope: Scope;
  let functionSymbol: any;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
    const location = createTestLocation();
    functionSymbol = createFunctionSymbol('test', location, moduleScope, [], null);
  });

  it('should return module scope when in module scope', () => {
    expect(getModuleScope(moduleScope)).toBe(moduleScope);
  });

  it('should return module scope from function scope', () => {
    const functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);

    expect(getModuleScope(functionScope)).toBe(moduleScope);
  });

  it('should return module scope from deeply nested scope', () => {
    const functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);
    const block = createBlockScope('scope_2', functionScope, null);
    const loop = createLoopScope('scope_3', block, null);

    expect(getModuleScope(loop)).toBe(moduleScope);
  });
});

describe('isDescendantOf', () => {
  let moduleScope: Scope;
  let functionSymbol: any;
  let functionScope: Scope;
  let blockScope: Scope;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
    const location = createTestLocation();
    functionSymbol = createFunctionSymbol('test', location, moduleScope, [], null);
    functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);
    blockScope = createBlockScope('scope_2', functionScope, null);
  });

  it('should return true when scope is descendant', () => {
    expect(isDescendantOf(blockScope, moduleScope)).toBe(true);
  });

  it('should return true when scope is direct child', () => {
    expect(isDescendantOf(functionScope, moduleScope)).toBe(true);
  });

  it('should return false when scope is not descendant', () => {
    expect(isDescendantOf(moduleScope, functionScope)).toBe(false);
  });

  it('should return false when scope is the same', () => {
    expect(isDescendantOf(moduleScope, moduleScope)).toBe(false);
  });

  it('should return false for unrelated scopes', () => {
    const anotherFunction = createFunctionSymbol(
      'another',
      createTestLocation(),
      moduleScope,
      [],
      null,
    );
    const anotherScope = createFunctionScope('scope_3', moduleScope, anotherFunction, null);

    expect(isDescendantOf(blockScope, anotherScope)).toBe(false);
  });
});

describe('getAllVisibleSymbols', () => {
  let moduleScope: Scope;
  let functionSymbol: any;
  let functionScope: Scope;
  let location: SourceLocation;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
    location = createTestLocation();
    functionSymbol = createFunctionSymbol('test', location, moduleScope, [], null);
    functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);
  });

  it('should return all symbols visible from current scope', () => {
    const globalVar = createSymbol('globalVar', SymbolKind.Variable, location, moduleScope);
    const localVar = createSymbol('localVar', SymbolKind.Variable, location, functionScope);

    declareSymbol(moduleScope, globalVar);
    declareSymbol(functionScope, localVar);

    const visible = getAllVisibleSymbols(functionScope);

    expect(visible.get('globalVar')).toBe(globalVar);
    expect(visible.get('localVar')).toBe(localVar);
    expect(visible.size).toBe(2);
  });

  it('should return shadowed symbol from inner scope', () => {
    const globalX = createSymbol('x', SymbolKind.Variable, location, moduleScope);
    const localX = createSymbol('x', SymbolKind.Variable, location, functionScope);

    declareSymbol(moduleScope, globalX);
    declareSymbol(functionScope, localX);

    const visible = getAllVisibleSymbols(functionScope);

    expect(visible.get('x')).toBe(localX);
    expect(visible.size).toBe(1);
  });

  it('should return empty map for empty scopes', () => {
    const visible = getAllVisibleSymbols(functionScope);

    expect(visible.size).toBe(0);
  });
});

describe('getScopeDepth', () => {
  let moduleScope: Scope;
  let functionSymbol: any;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
    const location = createTestLocation();
    functionSymbol = createFunctionSymbol('test', location, moduleScope, [], null);
  });

  it('should return 0 for module scope', () => {
    expect(getScopeDepth(moduleScope)).toBe(0);
  });

  it('should return 1 for direct child of module', () => {
    const functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);

    expect(getScopeDepth(functionScope)).toBe(1);
  });

  it('should return 2 for grandchild of module', () => {
    const functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);
    const blockScope = createBlockScope('scope_2', functionScope, null);

    expect(getScopeDepth(blockScope)).toBe(2);
  });

  it('should handle deep nesting', () => {
    let scope: Scope = moduleScope;
    for (let i = 1; i <= 10; i++) {
      scope = createBlockScope(`scope_${i}`, scope, null);
    }

    expect(getScopeDepth(scope)).toBe(10);
  });
});

describe('Scope type guards', () => {
  let moduleScope: Scope;
  let functionSymbol: any;
  let functionScope: Scope;
  let blockScope: Scope;
  let loopScope: Scope;

  beforeEach(() => {
    moduleScope = createModuleScope('scope_0', null);
    const location = createTestLocation();
    functionSymbol = createFunctionSymbol('test', location, moduleScope, [], null);
    functionScope = createFunctionScope('scope_1', moduleScope, functionSymbol, null);
    blockScope = createBlockScope('scope_2', functionScope, null);
    loopScope = createLoopScope('scope_3', functionScope, null);
  });

  describe('isModuleScope', () => {
    it('should return true for module scope', () => {
      expect(isModuleScope(moduleScope)).toBe(true);
    });

    it('should return false for function scope', () => {
      expect(isModuleScope(functionScope)).toBe(false);
    });

    it('should return false for block scope', () => {
      expect(isModuleScope(blockScope)).toBe(false);
    });
  });

  describe('isFunctionScope', () => {
    it('should return true for function scope', () => {
      expect(isFunctionScope(functionScope)).toBe(true);
    });

    it('should return false for module scope', () => {
      expect(isFunctionScope(moduleScope)).toBe(false);
    });

    it('should return false for block scope', () => {
      expect(isFunctionScope(blockScope)).toBe(false);
    });
  });

  describe('isBlockScope', () => {
    it('should return true for block scope', () => {
      expect(isBlockScope(blockScope)).toBe(true);
    });

    it('should return false for module scope', () => {
      expect(isBlockScope(moduleScope)).toBe(false);
    });

    it('should return false for loop scope', () => {
      expect(isBlockScope(loopScope)).toBe(false);
    });
  });

  describe('isLoopScope', () => {
    it('should return true for loop scope', () => {
      expect(isLoopScope(loopScope)).toBe(true);
    });

    it('should return false for block scope', () => {
      expect(isLoopScope(blockScope)).toBe(false);
    });

    it('should return false for function scope', () => {
      expect(isLoopScope(functionScope)).toBe(false);
    });
  });
});

describe('Scope hierarchy', () => {
  it('should build correct scope tree', () => {
    const moduleScope = createModuleScope('module', null);
    const location = createTestLocation();
    const funcSymbol = createFunctionSymbol('main', location, moduleScope, [], null);

    // Build tree: module -> function -> (if block, while loop -> nested block)
    const functionScope = createFunctionScope('func', moduleScope, funcSymbol, null);
    const ifBlock = createBlockScope('if', functionScope, null);
    const whileLoop = createLoopScope('while', functionScope, null);
    const nestedBlock = createBlockScope('nested', whileLoop, null);

    // Verify structure
    expect(moduleScope.children).toHaveLength(1);
    expect(moduleScope.children[0]).toBe(functionScope);

    expect(functionScope.children).toHaveLength(2);
    expect(functionScope.children).toContain(ifBlock);
    expect(functionScope.children).toContain(whileLoop);

    expect(whileLoop.children).toHaveLength(1);
    expect(whileLoop.children[0]).toBe(nestedBlock);

    // Verify parent references
    expect(nestedBlock.parent).toBe(whileLoop);
    expect(whileLoop.parent).toBe(functionScope);
    expect(ifBlock.parent).toBe(functionScope);
    expect(functionScope.parent).toBe(moduleScope);
    expect(moduleScope.parent).toBeNull();
  });
});

describe('Scope edge cases', () => {
  it('should handle scope with many children', () => {
    const moduleScope = createModuleScope('scope_0', null);

    for (let i = 0; i < 100; i++) {
      createBlockScope(`scope_${i + 1}`, moduleScope, null);
    }

    expect(moduleScope.children).toHaveLength(100);
  });

  it('should handle scope with many symbols', () => {
    const moduleScope = createModuleScope('scope_0', null);
    const location = createTestLocation();

    for (let i = 0; i < 100; i++) {
      const symbol = createSymbol(`var${i}`, SymbolKind.Variable, location, moduleScope);
      declareSymbol(moduleScope, symbol);
    }

    expect(moduleScope.symbols.size).toBe(100);
  });

  it('should lookup correct symbol with many shadowing levels', () => {
    const moduleScope = createModuleScope('scope_0', null);
    const location = createTestLocation();

    // Create chain: module -> b1 -> b2 -> b3 -> b4 -> b5
    // Each declares 'x' with different kind
    let scope = moduleScope;
    const kinds = [
      SymbolKind.Variable,
      SymbolKind.Variable,
      SymbolKind.Variable,
      SymbolKind.Variable,
      SymbolKind.Variable,
    ];

    for (let i = 0; i < 5; i++) {
      scope = createBlockScope(`scope_${i + 1}`, scope, null);
      const symbol = createSymbol('x', kinds[i], location, scope);
      declareSymbol(scope, symbol);
    }

    // Should find the innermost 'x'
    const found = lookupInChain(scope, 'x');
    expect(found?.scope.id).toBe('scope_5');
  });
});