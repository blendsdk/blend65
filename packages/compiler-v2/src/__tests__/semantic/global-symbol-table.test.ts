/**
 * Global Symbol Table Tests for Blend65 Compiler v2
 *
 * Tests the GlobalSymbolTable class which aggregates exports from all modules
 * and provides cross-module symbol lookup.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GlobalSymbolTable,
  GlobalSymbolKind,
  ModuleRegistry,
} from '../../semantic/index.js';
import {
  Program,
  ModuleDecl,
  ExportDecl,
  FunctionDecl,
  VariableDecl,
  type SourceLocation,
} from '../../ast/index.js';

// ============================================================
// Test Helpers
// ============================================================

/**
 * Creates a test source location
 */
function createLocation(): SourceLocation {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 10, offset: 9 },
  };
}

/**
 * Creates a module declaration
 */
function createModuleDecl(name: string): ModuleDecl {
  return new ModuleDecl(name.split('.'), createLocation());
}

/**
 * Creates a function declaration
 */
function createFunctionDecl(name: string, isExported = false): FunctionDecl {
  return new FunctionDecl(name, [], null, [], createLocation(), isExported);
}

/**
 * Creates a variable declaration
 */
function createVariableDecl(name: string, isConst = false, isExported = false): VariableDecl {
  return new VariableDecl(name, 'byte', null, createLocation(), null, isConst, isExported);
}

/**
 * Creates an export declaration wrapping another declaration
 */
function createExportDecl(decl: FunctionDecl | VariableDecl): ExportDecl {
  return new ExportDecl(decl, createLocation());
}

/**
 * Creates a Program with the given declarations
 */
function createProgram(moduleName: string, declarations: any[]): Program {
  return new Program(createModuleDecl(moduleName), declarations, createLocation());
}

// ============================================================
// Tests
// ============================================================

describe('GlobalSymbolTable', () => {
  let globalTable: GlobalSymbolTable;

  beforeEach(() => {
    globalTable = new GlobalSymbolTable();
  });

  // ============================================================
  // Creation Tests
  // ============================================================

  describe('creation', () => {
    it('creates an empty table', () => {
      expect(globalTable).toBeDefined();
      expect(globalTable.isEmpty()).toBe(true);
      expect(globalTable.getSymbolCount()).toBe(0);
    });
  });

  // ============================================================
  // Registration Tests
  // ============================================================

  describe('registration', () => {
    it('registers a global symbol', () => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });

      expect(globalTable.getSymbolCount()).toBe(1);
      expect(globalTable.isEmpty()).toBe(false);
    });

    it('registers multiple symbols from same module', () => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });
      globalTable.register({
        name: 'subtract',
        qualifiedName: 'Lib.Math.subtract',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });

      expect(globalTable.getSymbolCount()).toBe(2);
      expect(globalTable.getModuleExports('Lib.Math').size).toBe(2);
    });

    it('registers symbols from multiple modules', () => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });
      globalTable.register({
        name: 'concat',
        qualifiedName: 'Lib.String.concat',
        moduleName: 'Lib.String',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });

      expect(globalTable.getSymbolCount()).toBe(2);
      expect(globalTable.getModuleNames()).toHaveLength(2);
    });
  });

  // ============================================================
  // Qualified Lookup Tests
  // ============================================================

  describe('qualified lookup', () => {
    beforeEach(() => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });
    });

    it('finds symbol by qualified name', () => {
      const result = globalTable.lookupQualified('Lib.Math', 'add');

      expect(result.found).toBe(true);
      expect(result.symbol?.name).toBe('add');
      expect(result.symbol?.moduleName).toBe('Lib.Math');
    });

    it('returns error for non-existent symbol in existing module', () => {
      const result = globalTable.lookupQualified('Lib.Math', 'nonExistent');

      expect(result.found).toBe(false);
      expect(result.error).toContain("Symbol 'nonExistent' not found");
    });

    it('returns error for non-existent module', () => {
      const result = globalTable.lookupQualified('NonExistent', 'anything');

      expect(result.found).toBe(false);
      expect(result.error).toContain("Module 'NonExistent' not found");
    });
  });

  // ============================================================
  // Simple Lookup Tests
  // ============================================================

  describe('simple lookup', () => {
    it('finds unique symbol by simple name', () => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });

      const result = globalTable.lookup('add');

      expect(result.found).toBe(true);
      expect(result.symbol?.name).toBe('add');
    });

    it('returns error for non-existent symbol', () => {
      const result = globalTable.lookup('nonExistent');

      expect(result.found).toBe(false);
      expect(result.error).toContain("Symbol 'nonExistent' not found");
    });

    it('detects ambiguous symbols exported by multiple modules', () => {
      globalTable.register({
        name: 'helper',
        qualifiedName: 'Module1.helper',
        moduleName: 'Module1',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });
      globalTable.register({
        name: 'helper',
        qualifiedName: 'Module2.helper',
        moduleName: 'Module2',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });

      const result = globalTable.lookup('helper');

      expect(result.found).toBe(false);
      expect(result.ambiguous).toHaveLength(2);
      expect(result.error).toContain('ambiguous');
    });
  });

  // ============================================================
  // Module Exports Tests
  // ============================================================

  describe('module exports', () => {
    beforeEach(() => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });
      globalTable.register({
        name: 'PI',
        qualifiedName: 'Lib.Math.PI',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Constant,
        type: null,
        location: createLocation(),
      });
    });

    it('gets all exports from a module', () => {
      const exports = globalTable.getModuleExports('Lib.Math');

      expect(exports.size).toBe(2);
      expect(exports.has('add')).toBe(true);
      expect(exports.has('PI')).toBe(true);
    });

    it('returns empty map for non-existent module', () => {
      const exports = globalTable.getModuleExports('NonExistent');

      expect(exports.size).toBe(0);
    });

    it('hasModuleExports returns true for module with exports', () => {
      expect(globalTable.hasModuleExports('Lib.Math')).toBe(true);
    });

    it('hasModuleExports returns false for module without exports', () => {
      expect(globalTable.hasModuleExports('NonExistent')).toBe(false);
    });
  });

  // ============================================================
  // Has/HasAny Tests
  // ============================================================

  describe('has methods', () => {
    beforeEach(() => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });
    });

    it('has returns true for existing symbol', () => {
      expect(globalTable.has('Lib.Math', 'add')).toBe(true);
    });

    it('has returns false for non-existing symbol', () => {
      expect(globalTable.has('Lib.Math', 'nonExistent')).toBe(false);
    });

    it('has returns false for non-existing module', () => {
      expect(globalTable.has('NonExistent', 'add')).toBe(false);
    });

    it('hasAny returns true when symbol exists in any module', () => {
      expect(globalTable.hasAny('add')).toBe(true);
    });

    it('hasAny returns false when symbol does not exist', () => {
      expect(globalTable.hasAny('nonExistent')).toBe(false);
    });
  });

  // ============================================================
  // Collect from Registry Tests
  // ============================================================

  describe('collectFromRegistry', () => {
    it('collects exports from all modules in registry', () => {
      const registry = new ModuleRegistry();

      const mathProgram = createProgram('Lib.Math', [
        createExportDecl(createFunctionDecl('add')),
        createExportDecl(createFunctionDecl('subtract')),
      ]);
      registry.register('Lib.Math', mathProgram);

      const stringProgram = createProgram('Lib.String', [
        createExportDecl(createFunctionDecl('concat')),
      ]);
      registry.register('Lib.String', stringProgram);

      const count = globalTable.collectFromRegistry(registry);

      expect(count).toBe(3);
      expect(globalTable.getSymbolCount()).toBe(3);
      expect(globalTable.getModuleNames()).toHaveLength(2);
    });

    it('collects exported functions as GlobalSymbolKind.Function', () => {
      const registry = new ModuleRegistry();

      const program = createProgram('Lib.Utils', [
        createExportDecl(createFunctionDecl('helper')),
      ]);
      registry.register('Lib.Utils', program);

      globalTable.collectFromRegistry(registry);

      const result = globalTable.lookupQualified('Lib.Utils', 'helper');
      expect(result.symbol?.kind).toBe(GlobalSymbolKind.Function);
    });

    it('collects exported variables as GlobalSymbolKind.Variable', () => {
      const registry = new ModuleRegistry();

      const program = createProgram('Lib.Utils', [
        createExportDecl(createVariableDecl('counter', false)),
      ]);
      registry.register('Lib.Utils', program);

      globalTable.collectFromRegistry(registry);

      const result = globalTable.lookupQualified('Lib.Utils', 'counter');
      expect(result.symbol?.kind).toBe(GlobalSymbolKind.Variable);
    });

    it('collects exported constants as GlobalSymbolKind.Constant', () => {
      const registry = new ModuleRegistry();

      const program = createProgram('Lib.Utils', [
        createExportDecl(createVariableDecl('MAX', true)),
      ]);
      registry.register('Lib.Utils', program);

      globalTable.collectFromRegistry(registry);

      const result = globalTable.lookupQualified('Lib.Utils', 'MAX');
      expect(result.symbol?.kind).toBe(GlobalSymbolKind.Constant);
    });

    it('ignores non-exported declarations', () => {
      const registry = new ModuleRegistry();

      const program = createProgram('Lib.Utils', [
        createFunctionDecl('privateFunc'),  // Not exported
        createExportDecl(createFunctionDecl('publicFunc')),
      ]);
      registry.register('Lib.Utils', program);

      globalTable.collectFromRegistry(registry);

      expect(globalTable.getSymbolCount()).toBe(1);
      expect(globalTable.hasAny('privateFunc')).toBe(false);
      expect(globalTable.hasAny('publicFunc')).toBe(true);
    });
  });

  // ============================================================
  // Collect from Program Tests
  // ============================================================

  describe('collectFromProgram', () => {
    it('collects exports from a single program', () => {
      const program = createProgram('Lib.Math', [
        createExportDecl(createFunctionDecl('add')),
        createExportDecl(createVariableDecl('PI', true)),
      ]);

      const count = globalTable.collectFromProgram('Lib.Math', program);

      expect(count).toBe(2);
      expect(globalTable.getSymbolCount()).toBe(2);
    });

    it('returns 0 for program with no exports', () => {
      const program = createProgram('Lib.Empty', [
        createFunctionDecl('privateFunc'),
      ]);

      const count = globalTable.collectFromProgram('Lib.Empty', program);

      expect(count).toBe(0);
    });
  });

  // ============================================================
  // Get Symbols Tests
  // ============================================================

  describe('symbol queries', () => {
    beforeEach(() => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });
      globalTable.register({
        name: 'counter',
        qualifiedName: 'Lib.State.counter',
        moduleName: 'Lib.State',
        kind: GlobalSymbolKind.Variable,
        type: null,
        location: createLocation(),
      });
      globalTable.register({
        name: 'MAX',
        qualifiedName: 'Lib.Const.MAX',
        moduleName: 'Lib.Const',
        kind: GlobalSymbolKind.Constant,
        type: null,
        location: createLocation(),
      });
    });

    it('getAllSymbols returns all symbols', () => {
      const symbols = globalTable.getAllSymbols();

      expect(symbols).toHaveLength(3);
    });

    it('getSymbolsByKind filters by kind', () => {
      expect(globalTable.getSymbolsByKind(GlobalSymbolKind.Function)).toHaveLength(1);
      expect(globalTable.getSymbolsByKind(GlobalSymbolKind.Variable)).toHaveLength(1);
      expect(globalTable.getSymbolsByKind(GlobalSymbolKind.Constant)).toHaveLength(1);
    });

    it('getModuleNames returns all module names', () => {
      const names = globalTable.getModuleNames();

      expect(names).toHaveLength(3);
      expect(names).toContain('Lib.Math');
      expect(names).toContain('Lib.State');
      expect(names).toContain('Lib.Const');
    });
  });

  // ============================================================
  // Type Assignment Tests
  // ============================================================

  describe('type assignment', () => {
    it('setSymbolType updates symbol type', () => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });

      const mockType = { kind: 'Function' as any, name: 'function', size: 0 };
      const updated = globalTable.setSymbolType('Lib.Math', 'add', mockType);

      expect(updated).toBe(true);
      expect(globalTable.lookupQualified('Lib.Math', 'add').symbol?.type).toBe(mockType);
    });

    it('setSymbolType returns false for non-existent symbol', () => {
      const mockType = { kind: 'Function' as any, name: 'function', size: 0 };
      const updated = globalTable.setSymbolType('NonExistent', 'nonExistent', mockType);

      expect(updated).toBe(false);
    });
  });

  // ============================================================
  // Clear Tests
  // ============================================================

  describe('clear', () => {
    it('clears all symbols', () => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });

      expect(globalTable.isEmpty()).toBe(false);

      globalTable.clear();

      expect(globalTable.isEmpty()).toBe(true);
      expect(globalTable.getSymbolCount()).toBe(0);
    });
  });

  // ============================================================
  // Find Symbols Tests
  // ============================================================

  describe('findSymbols', () => {
    beforeEach(() => {
      globalTable.register({
        name: 'addNumbers',
        qualifiedName: 'Lib.Math.addNumbers',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });
      globalTable.register({
        name: 'addStrings',
        qualifiedName: 'Lib.String.addStrings',
        moduleName: 'Lib.String',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });
      globalTable.register({
        name: 'multiply',
        qualifiedName: 'Lib.Math.multiply',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });
    });

    it('finds symbols by partial name match', () => {
      const results = globalTable.findSymbols('add');

      expect(results).toHaveLength(2);
    });

    it('finds symbols by partial qualified name match', () => {
      const results = globalTable.findSymbols('Math');

      expect(results).toHaveLength(2);  // addNumbers and multiply
    });

    it('case insensitive search', () => {
      const results = globalTable.findSymbols('ADD');

      expect(results).toHaveLength(2);
    });

    it('returns empty array for no matches', () => {
      const results = globalTable.findSymbols('nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  // ============================================================
  // Stats Tests
  // ============================================================

  describe('getStats', () => {
    it('returns accurate statistics', () => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });
      globalTable.register({
        name: 'counter',
        qualifiedName: 'Lib.State.counter',
        moduleName: 'Lib.State',
        kind: GlobalSymbolKind.Variable,
        type: null,
        location: createLocation(),
      });
      globalTable.register({
        name: 'MAX',
        qualifiedName: 'Lib.Const.MAX',
        moduleName: 'Lib.Const',
        kind: GlobalSymbolKind.Constant,
        type: null,
        location: createLocation(),
      });

      const stats = globalTable.getStats();

      expect(stats.totalSymbols).toBe(3);
      expect(stats.modules).toBe(3);
      expect(stats.functions).toBe(1);
      expect(stats.variables).toBe(1);
      expect(stats.constants).toBe(1);
    });
  });

  // ============================================================
  // Iterator Tests
  // ============================================================

  describe('iterator', () => {
    it('supports for...of iteration', () => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });
      globalTable.register({
        name: 'subtract',
        qualifiedName: 'Lib.Math.subtract',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });

      const symbols = [];
      for (const symbol of globalTable) {
        symbols.push(symbol);
      }

      expect(symbols).toHaveLength(2);
    });
  });

  // ============================================================
  // toString Tests
  // ============================================================

  describe('toString', () => {
    it('produces readable debug output', () => {
      globalTable.register({
        name: 'add',
        qualifiedName: 'Lib.Math.add',
        moduleName: 'Lib.Math',
        kind: GlobalSymbolKind.Function,
        type: null,
        location: createLocation(),
      });

      const output = globalTable.toString();

      expect(output).toContain('GlobalSymbolTable');
      expect(output).toContain('Lib.Math');
      expect(output).toContain('add');
    });
  });
});