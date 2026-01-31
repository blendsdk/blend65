/**
 * Symbol Tests for Blend65 Compiler v2
 *
 * Tests the Symbol interface, SymbolKind enum, and symbol factory functions.
 *
 * @module __tests__/semantic/symbol.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SymbolKind,
  type Symbol,
  createSymbol,
  createFunctionSymbol,
  createImportedSymbol,
  createIntrinsicSymbol,
  isVariableSymbol,
  isParameterSymbol,
  isFunctionSymbol,
  isCallableSymbol,
  isImportedSymbol,
  isConstantSymbol,
  isIntrinsicSymbol,
} from '../../semantic/symbol.js';
import { type Scope, ScopeKind, createModuleScope } from '../../semantic/scope.js';
import { BUILTIN_TYPES, TypeKind, type TypeInfo } from '../../semantic/types.js';
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

describe('SymbolKind enum', () => {
  it('should define Variable kind', () => {
    expect(SymbolKind.Variable).toBe('variable');
  });

  it('should define Parameter kind', () => {
    expect(SymbolKind.Parameter).toBe('parameter');
  });

  it('should define Function kind', () => {
    expect(SymbolKind.Function).toBe('function');
  });

  it('should define ImportedSymbol kind', () => {
    expect(SymbolKind.ImportedSymbol).toBe('imported');
  });

  it('should define Constant kind', () => {
    expect(SymbolKind.Constant).toBe('constant');
  });

  it('should define EnumMember kind', () => {
    expect(SymbolKind.EnumMember).toBe('enum_member');
  });

  it('should define Intrinsic kind', () => {
    expect(SymbolKind.Intrinsic).toBe('intrinsic');
  });
});

describe('createSymbol', () => {
  let scope: Scope;
  let location: SourceLocation;

  beforeEach(() => {
    scope = createModuleScope('scope_0', null);
    location = createTestLocation();
  });

  describe('basic creation', () => {
    it('should create a symbol with required fields', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

      expect(symbol.name).toBe('x');
      expect(symbol.kind).toBe(SymbolKind.Variable);
      expect(symbol.location).toBe(location);
      expect(symbol.scope).toBe(scope);
    });

    it('should set type to null by default', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

      expect(symbol.type).toBeNull();
    });

    it('should set isExported to false by default', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

      expect(symbol.isExported).toBe(false);
    });

    it('should set isConst to false by default', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

      expect(symbol.isConst).toBe(false);
    });

    it('should initialize metadata as empty Map', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

      expect(symbol.metadata).toBeInstanceOf(Map);
      expect(symbol.metadata?.size).toBe(0);
    });
  });

  describe('with options', () => {
    it('should set type when provided', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope, {
        type: BUILTIN_TYPES.BYTE,
      });

      expect(symbol.type).toBe(BUILTIN_TYPES.BYTE);
    });

    it('should set isExported when provided', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope, {
        isExported: true,
      });

      expect(symbol.isExported).toBe(true);
    });

    it('should set isConst when provided', () => {
      const symbol = createSymbol('MAX', SymbolKind.Constant, location, scope, {
        isConst: true,
      });

      expect(symbol.isConst).toBe(true);
    });

    it('should set sourceModule when provided', () => {
      const symbol = createSymbol('foo', SymbolKind.ImportedSymbol, location, scope, {
        sourceModule: './utils.blend',
      });

      expect(symbol.sourceModule).toBe('./utils.blend');
    });

    it('should set originalName when provided', () => {
      const symbol = createSymbol('bar', SymbolKind.ImportedSymbol, location, scope, {
        originalName: 'foo',
      });

      expect(symbol.originalName).toBe('foo');
    });
  });

  describe('with different kinds', () => {
    it('should create a Variable symbol', () => {
      const symbol = createSymbol('counter', SymbolKind.Variable, location, scope);

      expect(symbol.kind).toBe(SymbolKind.Variable);
    });

    it('should create a Parameter symbol', () => {
      const symbol = createSymbol('arg', SymbolKind.Parameter, location, scope);

      expect(symbol.kind).toBe(SymbolKind.Parameter);
    });

    it('should create a Constant symbol', () => {
      const symbol = createSymbol('MAX_VALUE', SymbolKind.Constant, location, scope, {
        isConst: true,
      });

      expect(symbol.kind).toBe(SymbolKind.Constant);
      expect(symbol.isConst).toBe(true);
    });

    it('should create an EnumMember symbol', () => {
      const symbol = createSymbol('Red', SymbolKind.EnumMember, location, scope);

      expect(symbol.kind).toBe(SymbolKind.EnumMember);
    });
  });
});

describe('createFunctionSymbol', () => {
  let scope: Scope;
  let location: SourceLocation;

  beforeEach(() => {
    scope = createModuleScope('scope_0', null);
    location = createTestLocation();
  });

  it('should create a function symbol with basic fields', () => {
    const symbol = createFunctionSymbol('add', location, scope, [], null);

    expect(symbol.name).toBe('add');
    expect(symbol.kind).toBe(SymbolKind.Function);
    expect(symbol.location).toBe(location);
    expect(symbol.scope).toBe(scope);
  });

  it('should set parameters array', () => {
    const param1 = createSymbol('a', SymbolKind.Parameter, location, scope);
    const param2 = createSymbol('b', SymbolKind.Parameter, location, scope);
    const symbol = createFunctionSymbol('add', location, scope, [param1, param2], null);

    expect(symbol.parameters).toHaveLength(2);
    expect(symbol.parameters?.[0]).toBe(param1);
    expect(symbol.parameters?.[1]).toBe(param2);
  });

  it('should set return type', () => {
    const symbol = createFunctionSymbol('getX', location, scope, [], BUILTIN_TYPES.BYTE);

    expect(symbol.type).toBe(BUILTIN_TYPES.BYTE);
  });

  it('should set isExported flag', () => {
    const symbol = createFunctionSymbol('main', location, scope, [], BUILTIN_TYPES.VOID, undefined, true);

    expect(symbol.isExported).toBe(true);
  });

  it('should set isConst to false', () => {
    const symbol = createFunctionSymbol('test', location, scope, [], null);

    expect(symbol.isConst).toBe(false);
  });

  it('should initialize metadata as empty Map', () => {
    const symbol = createFunctionSymbol('test', location, scope, [], null);

    expect(symbol.metadata).toBeInstanceOf(Map);
  });
});

describe('createImportedSymbol', () => {
  let scope: Scope;
  let location: SourceLocation;

  beforeEach(() => {
    scope = createModuleScope('scope_0', null);
    location = createTestLocation();
  });

  it('should create an imported symbol', () => {
    const symbol = createImportedSymbol('localName', 'originalName', './module.blend', location, scope);

    expect(symbol.name).toBe('localName');
    expect(symbol.kind).toBe(SymbolKind.ImportedSymbol);
    expect(symbol.originalName).toBe('originalName');
    expect(symbol.sourceModule).toBe('./module.blend');
  });

  it('should set type to null (resolved later)', () => {
    const symbol = createImportedSymbol('foo', 'foo', './mod.blend', location, scope);

    expect(symbol.type).toBeNull();
  });

  it('should set isExported to false', () => {
    const symbol = createImportedSymbol('foo', 'foo', './mod.blend', location, scope);

    expect(symbol.isExported).toBe(false);
  });

  it('should set isConst to false', () => {
    const symbol = createImportedSymbol('foo', 'foo', './mod.blend', location, scope);

    expect(symbol.isConst).toBe(false);
  });

  it('should handle aliased imports', () => {
    const symbol = createImportedSymbol('myAdd', 'add', './math.blend', location, scope);

    expect(symbol.name).toBe('myAdd');
    expect(symbol.originalName).toBe('add');
    expect(symbol.sourceModule).toBe('./math.blend');
  });
});

describe('createIntrinsicSymbol', () => {
  it('should create an intrinsic symbol', () => {
    const functionType: TypeInfo = {
      kind: TypeKind.Function,
      name: 'peek',
      size: 0,
      parameterTypes: [BUILTIN_TYPES.WORD],
      returnType: BUILTIN_TYPES.BYTE,
    };

    const symbol = createIntrinsicSymbol('peek', functionType);

    expect(symbol.name).toBe('peek');
    expect(symbol.kind).toBe(SymbolKind.Intrinsic);
    expect(symbol.type).toBe(functionType);
  });

  it('should set isConst to true (intrinsics cannot be reassigned)', () => {
    const functionType: TypeInfo = {
      kind: TypeKind.Function,
      name: 'poke',
      size: 0,
      parameterTypes: [BUILTIN_TYPES.WORD, BUILTIN_TYPES.BYTE],
      returnType: BUILTIN_TYPES.VOID,
    };

    const symbol = createIntrinsicSymbol('poke', functionType);

    expect(symbol.isConst).toBe(true);
  });

  it('should create intrinsic scope with id __intrinsics__', () => {
    const symbol = createIntrinsicSymbol('hi', BUILTIN_TYPES.BYTE);

    expect(symbol.scope.id).toBe('__intrinsics__');
  });

  it('should have location at (0, 0)', () => {
    const symbol = createIntrinsicSymbol('lo', BUILTIN_TYPES.BYTE);

    expect(symbol.location.start.line).toBe(0);
    expect(symbol.location.start.column).toBe(0);
  });
});

describe('Type guard functions', () => {
  let scope: Scope;
  let location: SourceLocation;

  beforeEach(() => {
    scope = createModuleScope('scope_0', null);
    location = createTestLocation();
  });

  describe('isVariableSymbol', () => {
    it('should return true for Variable symbol', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

      expect(isVariableSymbol(symbol)).toBe(true);
    });

    it('should return false for Parameter symbol', () => {
      const symbol = createSymbol('x', SymbolKind.Parameter, location, scope);

      expect(isVariableSymbol(symbol)).toBe(false);
    });

    it('should return false for Function symbol', () => {
      const symbol = createFunctionSymbol('x', location, scope, [], null);

      expect(isVariableSymbol(symbol)).toBe(false);
    });
  });

  describe('isParameterSymbol', () => {
    it('should return true for Parameter symbol', () => {
      const symbol = createSymbol('arg', SymbolKind.Parameter, location, scope);

      expect(isParameterSymbol(symbol)).toBe(true);
    });

    it('should return false for Variable symbol', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

      expect(isParameterSymbol(symbol)).toBe(false);
    });
  });

  describe('isFunctionSymbol', () => {
    it('should return true for Function symbol', () => {
      const symbol = createFunctionSymbol('main', location, scope, [], null);

      expect(isFunctionSymbol(symbol)).toBe(true);
    });

    it('should return false for Variable symbol', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

      expect(isFunctionSymbol(symbol)).toBe(false);
    });

    it('should return false for Intrinsic symbol', () => {
      const symbol = createIntrinsicSymbol('peek', BUILTIN_TYPES.BYTE);

      expect(isFunctionSymbol(symbol)).toBe(false);
    });
  });

  describe('isCallableSymbol', () => {
    it('should return true for Function symbol', () => {
      const symbol = createFunctionSymbol('main', location, scope, [], null);

      expect(isCallableSymbol(symbol)).toBe(true);
    });

    it('should return true for Intrinsic symbol', () => {
      const symbol = createIntrinsicSymbol('peek', BUILTIN_TYPES.BYTE);

      expect(isCallableSymbol(symbol)).toBe(true);
    });

    it('should return false for Variable symbol', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

      expect(isCallableSymbol(symbol)).toBe(false);
    });

    it('should return false for Parameter symbol', () => {
      const symbol = createSymbol('arg', SymbolKind.Parameter, location, scope);

      expect(isCallableSymbol(symbol)).toBe(false);
    });
  });

  describe('isImportedSymbol', () => {
    it('should return true for ImportedSymbol', () => {
      const symbol = createImportedSymbol('foo', 'foo', './mod.blend', location, scope);

      expect(isImportedSymbol(symbol)).toBe(true);
    });

    it('should return false for Variable symbol', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

      expect(isImportedSymbol(symbol)).toBe(false);
    });
  });

  describe('isConstantSymbol', () => {
    it('should return true for Constant kind', () => {
      const symbol = createSymbol('MAX', SymbolKind.Constant, location, scope);

      expect(isConstantSymbol(symbol)).toBe(true);
    });

    it('should return true for symbol with isConst=true', () => {
      const symbol = createSymbol('PI', SymbolKind.Variable, location, scope, {
        isConst: true,
      });

      expect(isConstantSymbol(symbol)).toBe(true);
    });

    it('should return false for mutable Variable', () => {
      const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

      expect(isConstantSymbol(symbol)).toBe(false);
    });
  });

  describe('isIntrinsicSymbol', () => {
    it('should return true for Intrinsic symbol', () => {
      const symbol = createIntrinsicSymbol('peek', BUILTIN_TYPES.BYTE);

      expect(isIntrinsicSymbol(symbol)).toBe(true);
    });

    it('should return false for Function symbol', () => {
      const symbol = createFunctionSymbol('main', location, scope, [], null);

      expect(isIntrinsicSymbol(symbol)).toBe(false);
    });
  });
});

describe('Symbol metadata', () => {
  let scope: Scope;
  let location: SourceLocation;

  beforeEach(() => {
    scope = createModuleScope('scope_0', null);
    location = createTestLocation();
  });

  it('should allow setting metadata', () => {
    const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

    symbol.metadata?.set('useCount', 5);
    symbol.metadata?.set('isRead', true);
    symbol.metadata?.set('isWritten', false);

    expect(symbol.metadata?.get('useCount')).toBe(5);
    expect(symbol.metadata?.get('isRead')).toBe(true);
    expect(symbol.metadata?.get('isWritten')).toBe(false);
  });

  it('should allow getting metadata with default', () => {
    const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

    const useCount = symbol.metadata?.get('useCount') ?? 0;

    expect(useCount).toBe(0);
  });

  it('should allow checking metadata existence', () => {
    const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

    symbol.metadata?.set('isLoopVariable', true);

    expect(symbol.metadata?.has('isLoopVariable')).toBe(true);
    expect(symbol.metadata?.has('nonexistent')).toBe(false);
  });

  it('should allow deleting metadata', () => {
    const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

    symbol.metadata?.set('temp', 'value');
    symbol.metadata?.delete('temp');

    expect(symbol.metadata?.has('temp')).toBe(false);
  });
});

describe('Symbol properties', () => {
  let scope: Scope;
  let location: SourceLocation;

  beforeEach(() => {
    scope = createModuleScope('scope_0', null);
    location = createTestLocation();
  });

  it('should allow modifying type after creation', () => {
    const symbol = createSymbol('x', SymbolKind.Variable, location, scope);

    expect(symbol.type).toBeNull();

    symbol.type = BUILTIN_TYPES.BYTE;

    expect(symbol.type).toBe(BUILTIN_TYPES.BYTE);
  });

  it('should allow adding parameters to function symbol', () => {
    const funcSymbol = createFunctionSymbol('add', location, scope, [], null);
    const param = createSymbol('a', SymbolKind.Parameter, location, scope);

    funcSymbol.parameters = [param];

    expect(funcSymbol.parameters).toHaveLength(1);
    expect(funcSymbol.parameters[0]).toBe(param);
  });
});

describe('Symbol edge cases', () => {
  let scope: Scope;

  beforeEach(() => {
    scope = createModuleScope('scope_0', null);
  });

  it('should handle empty name', () => {
    const location = createTestLocation();
    const symbol = createSymbol('', SymbolKind.Variable, location, scope);

    expect(symbol.name).toBe('');
  });

  it('should handle special characters in name', () => {
    const location = createTestLocation();
    // Note: In practice, the lexer/parser would reject these names,
    // but the symbol system should handle them
    const symbol = createSymbol('_underscore', SymbolKind.Variable, location, scope);

    expect(symbol.name).toBe('_underscore');
  });

  it('should handle very long names', () => {
    const location = createTestLocation();
    const longName = 'x'.repeat(1000);
    const symbol = createSymbol(longName, SymbolKind.Variable, location, scope);

    expect(symbol.name).toBe(longName);
    expect(symbol.name.length).toBe(1000);
  });

  it('should handle location with different lines', () => {
    const multiLineLocation: SourceLocation = {
      start: { line: 10, column: 5 },
      end: { line: 15, column: 20 },
    };
    const symbol = createSymbol('x', SymbolKind.Variable, multiLineLocation, scope);

    expect(symbol.location.start.line).toBe(10);
    expect(symbol.location.end.line).toBe(15);
  });
});