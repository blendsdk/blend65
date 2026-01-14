/**
 * Tests for Global Symbol Table
 *
 * Validates cross-module symbol aggregation and lookup
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GlobalSymbolTable, type GlobalSymbol } from '../../semantic/global-symbol-table.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { SymbolKind, type Symbol } from '../../semantic/symbol.js';
import { ScopeKind } from '../../semantic/scope.js';
import { TypeKind, type TypeInfo } from '../../semantic/types.js';
import { SourceLocation } from '../../ast/base.js';
import { VariableDecl, ModuleDecl } from '../../ast/nodes.js';

/**
 * Helper: Create a test source location
 */
function createLocation(line = 1, column = 1): SourceLocation {
  return {
    start: { line, column, offset: 0 },
    end: { line, column: column + 1, offset: 1 },
  };
}

/**
 * Helper: Create a test type info
 */
function createTypeInfo(kind: TypeKind): TypeInfo {
  return {
    kind,
    name: kind,
    size: kind === TypeKind.Byte ? 1 : kind === TypeKind.Word ? 2 : 0,
    isSigned: false,
    isAssignable: true,
  };
}

/**
 * Helper: Create a mock SymbolTable with symbols
 */
function createSymbolTable(
  symbols: Array<{ name: string; exported: boolean; kind?: SymbolKind }>
): SymbolTable {
  const table = new SymbolTable();

  // Create symbols in the root scope
  for (const sym of symbols) {
    const loc = createLocation();
    const decl = new VariableDecl(
      sym.name,
      'byte',
      null, // No initializer
      loc,
      null, // No storage class
      false, // Not const
      sym.exported
    );

    const symbol: Symbol = {
      name: sym.name,
      kind: sym.kind || SymbolKind.Variable,
      declaration: decl,
      type: createTypeInfo(TypeKind.Byte),
      isExported: sym.exported,
      isConst: false,
      scope: table.getRootScope(),
      location: loc,
    };

    table.declare(symbol);
  }

  return table;
}

describe('GlobalSymbolTable', () => {
  let globalTable: GlobalSymbolTable;

  beforeEach(() => {
    globalTable = new GlobalSymbolTable();
  });

  describe('Module Registration', () => {
    it('should register a module successfully', () => {
      const symbolTable = createSymbolTable([{ name: 'foo', exported: true }]);

      globalTable.registerModule('moduleA', symbolTable);

      expect(globalTable.hasModule('moduleA')).toBe(true);
      expect(globalTable.getModuleNames()).toEqual(['moduleA']);
    });

    it('should register multiple modules', () => {
      const table1 = createSymbolTable([{ name: 'foo', exported: true }]);
      const table2 = createSymbolTable([{ name: 'bar', exported: true }]);

      globalTable.registerModule('moduleA', table1);
      globalTable.registerModule('moduleB', table2);

      expect(globalTable.hasModule('moduleA')).toBe(true);
      expect(globalTable.hasModule('moduleB')).toBe(true);
      expect(globalTable.getModuleNames()).toEqual(['moduleA', 'moduleB']);
    });

    it('should throw error when registering duplicate module', () => {
      const table1 = createSymbolTable([{ name: 'foo', exported: true }]);
      const table2 = createSymbolTable([{ name: 'bar', exported: true }]);

      globalTable.registerModule('moduleA', table1);

      expect(() => {
        globalTable.registerModule('moduleA', table2);
      }).toThrow("Module 'moduleA' is already registered");
    });

    it('should handle module with no symbols', () => {
      const emptyTable = createSymbolTable([]);

      globalTable.registerModule('emptyModule', emptyTable);

      expect(globalTable.hasModule('emptyModule')).toBe(true);
      expect(globalTable.getAllSymbols('emptyModule')).toEqual([]);
    });

    it('should correctly separate exported and non-exported symbols', () => {
      const table = createSymbolTable([
        { name: 'exported1', exported: true },
        { name: 'private1', exported: false },
        { name: 'exported2', exported: true },
        { name: 'private2', exported: false },
      ]);

      globalTable.registerModule('moduleA', table);

      const allSymbols = globalTable.getAllSymbols('moduleA');
      const exportedSymbols = globalTable.getExportedSymbols('moduleA');

      expect(allSymbols).toHaveLength(4);
      expect(exportedSymbols).toHaveLength(2);
      expect(exportedSymbols.map(s => s.name)).toEqual(['exported1', 'exported2']);
    });
  });

  describe('Symbol Lookup - Cross-Module', () => {
    beforeEach(() => {
      // Setup: moduleA exports foo, moduleB exports bar
      const tableA = createSymbolTable([
        { name: 'foo', exported: true },
        { name: 'internalA', exported: false },
      ]);

      const tableB = createSymbolTable([
        { name: 'bar', exported: true },
        { name: 'internalB', exported: false },
      ]);

      globalTable.registerModule('moduleA', tableA);
      globalTable.registerModule('moduleB', tableB);
    });

    it('should find exported symbol from another module', () => {
      const symbol = globalTable.lookup('foo', 'moduleB');

      expect(symbol).toBeDefined();
      expect(symbol!.name).toBe('foo');
      expect(symbol!.moduleName).toBe('moduleA');
      expect(symbol!.isExported).toBe(true);
    });

    it('should not find non-exported symbol', () => {
      const symbol = globalTable.lookup('internalA', 'moduleB');

      expect(symbol).toBeUndefined();
    });

    it('should not find symbol from same module', () => {
      const symbol = globalTable.lookup('foo', 'moduleA');

      expect(symbol).toBeUndefined();
    });

    it('should return undefined for non-existent symbol', () => {
      const symbol = globalTable.lookup('doesNotExist', 'moduleA');

      expect(symbol).toBeUndefined();
    });

    it('should find first match when multiple modules export same name', () => {
      const tableC = createSymbolTable([{ name: 'common', exported: true }]);
      const tableD = createSymbolTable([{ name: 'common', exported: true }]);

      globalTable.registerModule('moduleC', tableC);
      globalTable.registerModule('moduleD', tableD);

      const symbol = globalTable.lookup('common', 'moduleA');

      expect(symbol).toBeDefined();
      expect(symbol!.name).toBe('common');
      // Should find from one of the modules (implementation dependent)
      expect(['moduleC', 'moduleD']).toContain(symbol!.moduleName);
    });
  });

  describe('Symbol Lookup - Module-Specific', () => {
    beforeEach(() => {
      const table = createSymbolTable([
        { name: 'exported', exported: true },
        { name: 'private', exported: false },
      ]);

      globalTable.registerModule('moduleA', table);
    });

    it('should find exported symbol in specific module', () => {
      const symbol = globalTable.lookupInModule('exported', 'moduleA');

      expect(symbol).toBeDefined();
      expect(symbol!.name).toBe('exported');
      expect(symbol!.moduleName).toBe('moduleA');
    });

    it('should find non-exported symbol in specific module', () => {
      const symbol = globalTable.lookupInModule('private', 'moduleA');

      expect(symbol).toBeDefined();
      expect(symbol!.name).toBe('private');
      expect(symbol!.isExported).toBe(false);
    });

    it('should return undefined for non-existent symbol in module', () => {
      const symbol = globalTable.lookupInModule('doesNotExist', 'moduleA');

      expect(symbol).toBeUndefined();
    });

    it('should return undefined for non-existent module', () => {
      const symbol = globalTable.lookupInModule('exported', 'nonExistentModule');

      expect(symbol).toBeUndefined();
    });
  });

  describe('Export Queries', () => {
    it('should get all exported symbols from a module', () => {
      const table = createSymbolTable([
        { name: 'export1', exported: true },
        { name: 'export2', exported: true },
        { name: 'private1', exported: false },
      ]);

      globalTable.registerModule('moduleA', table);

      const exports = globalTable.getExportedSymbols('moduleA');

      expect(exports).toHaveLength(2);
      expect(exports.map(s => s.name).sort()).toEqual(['export1', 'export2']);
      expect(exports.every(s => s.isExported)).toBe(true);
    });

    it('should return empty array for module with no exports', () => {
      const table = createSymbolTable([
        { name: 'private1', exported: false },
        { name: 'private2', exported: false },
      ]);

      globalTable.registerModule('moduleA', table);

      const exports = globalTable.getExportedSymbols('moduleA');

      expect(exports).toEqual([]);
    });

    it('should return empty array for non-existent module', () => {
      const exports = globalTable.getExportedSymbols('nonExistent');

      expect(exports).toEqual([]);
    });

    it('should get all symbols (exported + non-exported)', () => {
      const table = createSymbolTable([
        { name: 'export1', exported: true },
        { name: 'private1', exported: false },
      ]);

      globalTable.registerModule('moduleA', table);

      const allSymbols = globalTable.getAllSymbols('moduleA');

      expect(allSymbols).toHaveLength(2);
      expect(allSymbols.map(s => s.name).sort()).toEqual(['export1', 'private1']);
    });
  });

  describe('Module Queries', () => {
    it('should check if module exists', () => {
      const table = createSymbolTable([]);
      globalTable.registerModule('moduleA', table);

      expect(globalTable.hasModule('moduleA')).toBe(true);
      expect(globalTable.hasModule('moduleB')).toBe(false);
    });

    it('should get all module names', () => {
      const table1 = createSymbolTable([]);
      const table2 = createSymbolTable([]);
      const table3 = createSymbolTable([]);

      globalTable.registerModule('alpha', table1);
      globalTable.registerModule('beta', table2);
      globalTable.registerModule('gamma', table3);

      const names = globalTable.getModuleNames();

      expect(names).toHaveLength(3);
      expect(names.sort()).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('should return empty array when no modules registered', () => {
      expect(globalTable.getModuleNames()).toEqual([]);
    });
  });

  describe('Symbol Counting', () => {
    it('should count total symbols across all modules', () => {
      const table1 = createSymbolTable([
        { name: 'a', exported: true },
        { name: 'b', exported: false },
      ]);

      const table2 = createSymbolTable([
        { name: 'c', exported: true },
        { name: 'd', exported: false },
        { name: 'e', exported: true },
      ]);

      globalTable.registerModule('moduleA', table1);
      globalTable.registerModule('moduleB', table2);

      expect(globalTable.getTotalSymbolCount()).toBe(5);
    });

    it('should count total exported symbols across all modules', () => {
      const table1 = createSymbolTable([
        { name: 'a', exported: true },
        { name: 'b', exported: false },
      ]);

      const table2 = createSymbolTable([
        { name: 'c', exported: true },
        { name: 'd', exported: false },
        { name: 'e', exported: true },
      ]);

      globalTable.registerModule('moduleA', table1);
      globalTable.registerModule('moduleB', table2);

      expect(globalTable.getTotalExportCount()).toBe(3);
    });

    it('should return 0 for empty global table', () => {
      expect(globalTable.getTotalSymbolCount()).toBe(0);
      expect(globalTable.getTotalExportCount()).toBe(0);
    });
  });

  describe('Symbol Kind Preservation', () => {
    it('should preserve symbol kind during registration', () => {
      const table = createSymbolTable([
        { name: 'myVar', exported: true, kind: SymbolKind.Variable },
        { name: 'myFunc', exported: true, kind: SymbolKind.Function },
      ]);

      globalTable.registerModule('moduleA', table);

      const varSymbol = globalTable.lookupInModule('myVar', 'moduleA');
      const funcSymbol = globalTable.lookupInModule('myFunc', 'moduleA');

      expect(varSymbol!.kind).toBe(SymbolKind.Variable);
      expect(funcSymbol!.kind).toBe(SymbolKind.Function);
    });
  });

  describe('Type Information Preservation', () => {
    it('should preserve type information from symbol table', () => {
      const table = createSymbolTable([{ name: 'counter', exported: true }]);

      globalTable.registerModule('moduleA', table);

      const symbol = globalTable.lookupInModule('counter', 'moduleA');

      expect(symbol!.typeInfo).toBeDefined();
      expect(symbol!.typeInfo!.kind).toBe(TypeKind.Byte);
    });
  });

  describe('Reset', () => {
    it('should reset global symbol table to empty state', () => {
      const table1 = createSymbolTable([{ name: 'foo', exported: true }]);
      const table2 = createSymbolTable([{ name: 'bar', exported: true }]);

      globalTable.registerModule('moduleA', table1);
      globalTable.registerModule('moduleB', table2);

      expect(globalTable.getTotalSymbolCount()).toBeGreaterThan(0);

      globalTable.reset();

      expect(globalTable.getTotalSymbolCount()).toBe(0);
      expect(globalTable.getTotalExportCount()).toBe(0);
      expect(globalTable.getModuleNames()).toEqual([]);
      expect(globalTable.hasModule('moduleA')).toBe(false);
    });

    it('should allow registration after reset', () => {
      const table1 = createSymbolTable([{ name: 'foo', exported: true }]);
      const table2 = createSymbolTable([{ name: 'bar', exported: true }]);

      globalTable.registerModule('moduleA', table1);
      globalTable.reset();
      globalTable.registerModule('moduleB', table2);

      expect(globalTable.hasModule('moduleA')).toBe(false);
      expect(globalTable.hasModule('moduleB')).toBe(true);
      expect(globalTable.getTotalSymbolCount()).toBe(1);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle c64.kernal module with multiple exports', () => {
      const kernalTable = createSymbolTable([
        { name: 'CHROUT', exported: true, kind: SymbolKind.Function },
        { name: 'GETIN', exported: true, kind: SymbolKind.Function },
        { name: 'PLOT', exported: true, kind: SymbolKind.Function },
        { name: 'internalHelper', exported: false, kind: SymbolKind.Function },
      ]);

      globalTable.registerModule('c64.kernal', kernalTable);

      const exports = globalTable.getExportedSymbols('c64.kernal');
      expect(exports).toHaveLength(3);
      expect(exports.map(s => s.name).sort()).toEqual(['CHROUT', 'GETIN', 'PLOT']);
    });

    it('should handle snake game imports from multiple modules', () => {
      const mathTable = createSymbolTable([
        { name: 'abs', exported: true, kind: SymbolKind.Function },
      ]);

      const randomTable = createSymbolTable([
        { name: 'random', exported: true, kind: SymbolKind.Function },
      ]);

      const hardwareTable = createSymbolTable([
        { name: 'borderColor', exported: true, kind: SymbolKind.MapVariable },
      ]);

      globalTable.registerModule('lib.math', mathTable);
      globalTable.registerModule('lib.random', randomTable);
      globalTable.registerModule('hardware', hardwareTable);

      // Game module imports from all libraries
      expect(globalTable.lookup('abs', 'game')).toBeDefined();
      expect(globalTable.lookup('random', 'game')).toBeDefined();
      expect(globalTable.lookup('borderColor', 'game')).toBeDefined();
    });

    it('should handle large module with many symbols', () => {
      const symbols = Array.from({ length: 100 }, (_, i) => ({
        name: `symbol${i}`,
        exported: i % 2 === 0, // Even indices exported
      }));

      const largeTable = createSymbolTable(symbols);
      globalTable.registerModule('largeModule', largeTable);

      expect(globalTable.getTotalSymbolCount()).toBe(100);
      expect(globalTable.getTotalExportCount()).toBe(50);
    });
  });
});
