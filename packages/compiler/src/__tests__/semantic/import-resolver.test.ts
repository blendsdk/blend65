/**
 * Import Resolver Tests for Blend65 Compiler v2
 *
 * Tests the ImportResolver class which validates import statements
 * and resolves imported symbols from source modules.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ImportResolver,
  ImportErrorCode,
  ModuleRegistry,
} from '../../semantic/index.js';
import {
  Program,
  ModuleDecl,
  ImportDecl,
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
 * Creates an import declaration
 */
function createImportDecl(identifiers: string[], modulePath: string[], isWildcard = false): ImportDecl {
  return new ImportDecl(identifiers, modulePath, createLocation(), isWildcard);
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

describe('ImportResolver', () => {
  let registry: ModuleRegistry;
  let resolver: ImportResolver;

  beforeEach(() => {
    registry = new ModuleRegistry();
    resolver = new ImportResolver(registry);
  });

  // ============================================================
  // Creation Tests
  // ============================================================

  describe('creation', () => {
    it('creates with a module registry', () => {
      expect(resolver).toBeDefined();
    });
  });

  // ============================================================
  // Module Existence Tests
  // ============================================================

  describe('module existence validation', () => {
    it('returns error when importing from non-existent module', () => {
      const mainProgram = createProgram('Game.Main', [
        createImportDecl(['foo'], ['Game', 'Sprites']),
      ]);
      registry.register('Game.Main', mainProgram);

      const results = resolver.resolveImports(mainProgram);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].errors).toHaveLength(1);
      expect(results[0].errors![0].code).toBe(ImportErrorCode.MODULE_NOT_FOUND);
      expect(results[0].errors![0].moduleName).toBe('Game.Sprites');
    });

    it('succeeds when importing from existing module with exports', () => {
      const spritesProgram = createProgram('Game.Sprites', [
        createExportDecl(createFunctionDecl('drawSprite')),
      ]);
      registry.register('Game.Sprites', spritesProgram);

      const mainProgram = createProgram('Game.Main', [
        createImportDecl(['drawSprite'], ['Game', 'Sprites']),
      ]);
      registry.register('Game.Main', mainProgram);

      const results = resolver.resolveImports(mainProgram);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].symbols).toHaveLength(1);
      expect(results[0].symbols![0].localName).toBe('drawSprite');
    });
  });

  // ============================================================
  // Symbol Existence Tests
  // ============================================================

  describe('symbol existence validation', () => {
    it('returns error when importing non-existent symbol', () => {
      const spritesProgram = createProgram('Game.Sprites', [
        createExportDecl(createFunctionDecl('drawSprite')),
      ]);
      registry.register('Game.Sprites', spritesProgram);

      const mainProgram = createProgram('Game.Main', [
        createImportDecl(['nonExistent'], ['Game', 'Sprites']),
      ]);
      registry.register('Game.Main', mainProgram);

      const results = resolver.resolveImports(mainProgram);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].errors![0].code).toBe(ImportErrorCode.SYMBOL_NOT_FOUND);
      expect(results[0].errors![0].symbolName).toBe('nonExistent');
    });

    it('returns error when symbol exists but is not exported', () => {
      const spritesProgram = createProgram('Game.Sprites', [
        createFunctionDecl('privateFunc'),  // Not exported
        createExportDecl(createFunctionDecl('publicFunc')),
      ]);
      registry.register('Game.Sprites', spritesProgram);

      const mainProgram = createProgram('Game.Main', [
        createImportDecl(['privateFunc'], ['Game', 'Sprites']),
      ]);
      registry.register('Game.Main', mainProgram);

      const results = resolver.resolveImports(mainProgram);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].errors![0].code).toBe(ImportErrorCode.SYMBOL_NOT_EXPORTED);
      expect(results[0].errors![0].message).toContain('not exported');
    });
  });

  // ============================================================
  // Named Import Tests
  // ============================================================

  describe('named imports', () => {
    it('resolves single named import', () => {
      const mathProgram = createProgram('Lib.Math', [
        createExportDecl(createFunctionDecl('add')),
      ]);
      registry.register('Lib.Math', mathProgram);

      const mainProgram = createProgram('Game.Main', [
        createImportDecl(['add'], ['Lib', 'Math']),
      ]);
      registry.register('Game.Main', mainProgram);

      const results = resolver.resolveImports(mainProgram);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].symbols).toHaveLength(1);
      expect(results[0].symbols![0].localName).toBe('add');
      expect(results[0].symbols![0].moduleName).toBe('Lib.Math');
      expect(results[0].symbols![0].symbol.kind).toBe('function');
    });

    it('resolves multiple named imports', () => {
      const mathProgram = createProgram('Lib.Math', [
        createExportDecl(createFunctionDecl('add')),
        createExportDecl(createFunctionDecl('subtract')),
        createExportDecl(createFunctionDecl('multiply')),
      ]);
      registry.register('Lib.Math', mathProgram);

      const mainProgram = createProgram('Game.Main', [
        createImportDecl(['add', 'subtract', 'multiply'], ['Lib', 'Math']),
      ]);
      registry.register('Game.Main', mainProgram);

      const results = resolver.resolveImports(mainProgram);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].symbols).toHaveLength(3);
    });

    it('handles partial success with some valid and some invalid imports', () => {
      const mathProgram = createProgram('Lib.Math', [
        createExportDecl(createFunctionDecl('add')),
      ]);
      registry.register('Lib.Math', mathProgram);

      const mainProgram = createProgram('Game.Main', [
        createImportDecl(['add', 'nonExistent'], ['Lib', 'Math']),
      ]);
      registry.register('Game.Main', mainProgram);

      const results = resolver.resolveImports(mainProgram);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].symbols).toHaveLength(1);  // add was resolved
      expect(results[0].errors).toHaveLength(1);   // nonExistent failed
    });
  });

  // ============================================================
  // Wildcard Import Tests
  // ============================================================

  describe('wildcard imports', () => {
    it('imports all exported symbols with wildcard', () => {
      const mathProgram = createProgram('Lib.Math', [
        createExportDecl(createFunctionDecl('add')),
        createExportDecl(createFunctionDecl('subtract')),
        createExportDecl(createVariableDecl('PI', true)),
      ]);
      registry.register('Lib.Math', mathProgram);

      const mainProgram = createProgram('Game.Main', [
        createImportDecl([], ['Lib', 'Math'], true),  // wildcard import
      ]);
      registry.register('Game.Main', mainProgram);

      const results = resolver.resolveImports(mainProgram);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].symbols).toHaveLength(3);
    });

    it('returns error for wildcard import from module with no exports', () => {
      const emptyProgram = createProgram('Lib.Empty', [
        createFunctionDecl('privateFunc'),  // Not exported
      ]);
      registry.register('Lib.Empty', emptyProgram);

      const mainProgram = createProgram('Game.Main', [
        createImportDecl([], ['Lib', 'Empty'], true),  // wildcard import
      ]);
      registry.register('Game.Main', mainProgram);

      const results = resolver.resolveImports(mainProgram);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].errors![0].code).toBe(ImportErrorCode.NO_EXPORTS);
    });
  });

  // ============================================================
  // Symbol Kind Tests
  // ============================================================

  describe('symbol kinds', () => {
    it('identifies exported functions', () => {
      const program = createProgram('Lib.Utils', [
        createExportDecl(createFunctionDecl('helper')),
      ]);
      registry.register('Lib.Utils', program);

      const exports = resolver.getModuleExports('Lib.Utils');

      expect(exports.get('helper')?.kind).toBe('function');
    });

    it('identifies exported variables', () => {
      const program = createProgram('Lib.Utils', [
        createExportDecl(createVariableDecl('counter', false)),
      ]);
      registry.register('Lib.Utils', program);

      const exports = resolver.getModuleExports('Lib.Utils');

      expect(exports.get('counter')?.kind).toBe('variable');
    });

    it('identifies exported constants', () => {
      const program = createProgram('Lib.Utils', [
        createExportDecl(createVariableDecl('MAX_VALUE', true)),
      ]);
      registry.register('Lib.Utils', program);

      const exports = resolver.getModuleExports('Lib.Utils');

      expect(exports.get('MAX_VALUE')?.kind).toBe('constant');
    });
  });

  // ============================================================
  // Multiple Imports Tests
  // ============================================================

  describe('multiple imports', () => {
    it('resolves imports from multiple modules', () => {
      const mathProgram = createProgram('Lib.Math', [
        createExportDecl(createFunctionDecl('add')),
      ]);
      registry.register('Lib.Math', mathProgram);

      const stringProgram = createProgram('Lib.String', [
        createExportDecl(createFunctionDecl('concat')),
      ]);
      registry.register('Lib.String', stringProgram);

      const mainProgram = createProgram('Game.Main', [
        createImportDecl(['add'], ['Lib', 'Math']),
        createImportDecl(['concat'], ['Lib', 'String']),
      ]);
      registry.register('Game.Main', mainProgram);

      const results = resolver.resolveImports(mainProgram);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('handles mix of successful and failed imports', () => {
      const mathProgram = createProgram('Lib.Math', [
        createExportDecl(createFunctionDecl('add')),
      ]);
      registry.register('Lib.Math', mathProgram);

      const mainProgram = createProgram('Game.Main', [
        createImportDecl(['add'], ['Lib', 'Math']),
        createImportDecl(['nonExistent'], ['Lib', 'NonExistent']),
      ]);
      registry.register('Game.Main', mainProgram);

      const results = resolver.resolveImports(mainProgram);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  // ============================================================
  // Cache Tests
  // ============================================================

  describe('caching', () => {
    it('caches module exports', () => {
      const mathProgram = createProgram('Lib.Math', [
        createExportDecl(createFunctionDecl('add')),
      ]);
      registry.register('Lib.Math', mathProgram);

      // First call populates cache
      const exports1 = resolver.getModuleExports('Lib.Math');
      // Second call should return same object (cached)
      const exports2 = resolver.getModuleExports('Lib.Math');

      expect(exports1).toBe(exports2);  // Same reference
    });

    it('clears cache when clearCache is called', () => {
      const mathProgram = createProgram('Lib.Math', [
        createExportDecl(createFunctionDecl('add')),
      ]);
      registry.register('Lib.Math', mathProgram);

      const exports1 = resolver.getModuleExports('Lib.Math');
      resolver.clearCache();
      const exports2 = resolver.getModuleExports('Lib.Math');

      expect(exports1).not.toBe(exports2);  // Different references
      expect(exports1).toEqual(exports2);   // Same content
    });
  });

  // ============================================================
  // Utility Method Tests
  // ============================================================

  describe('utility methods', () => {
    it('symbolExistsInModule finds exported symbols', () => {
      const program = createProgram('Lib.Utils', [
        createExportDecl(createFunctionDecl('helper')),
      ]);
      registry.register('Lib.Utils', program);

      expect(resolver.symbolExistsInModule('Lib.Utils', 'helper')).toBe(true);
    });

    it('symbolExistsInModule finds non-exported symbols', () => {
      const program = createProgram('Lib.Utils', [
        createFunctionDecl('privateHelper'),
      ]);
      registry.register('Lib.Utils', program);

      expect(resolver.symbolExistsInModule('Lib.Utils', 'privateHelper')).toBe(true);
    });

    it('symbolExistsInModule returns false for non-existent symbols', () => {
      const program = createProgram('Lib.Utils', []);
      registry.register('Lib.Utils', program);

      expect(resolver.symbolExistsInModule('Lib.Utils', 'nonExistent')).toBe(false);
    });

    it('symbolExistsInModule returns false for non-existent module', () => {
      expect(resolver.symbolExistsInModule('NonExistent', 'anything')).toBe(false);
    });

    it('getAllErrors collects errors from all imports', () => {
      const mainProgram = createProgram('Game.Main', [
        createImportDecl(['foo'], ['Module1']),
        createImportDecl(['bar'], ['Module2']),
      ]);
      registry.register('Game.Main', mainProgram);

      const errors = resolver.getAllErrors(mainProgram);

      expect(errors).toHaveLength(2);
      expect(errors[0].code).toBe(ImportErrorCode.MODULE_NOT_FOUND);
      expect(errors[1].code).toBe(ImportErrorCode.MODULE_NOT_FOUND);
    });

    it('allImportsValid returns true when all imports valid', () => {
      const mathProgram = createProgram('Lib.Math', [
        createExportDecl(createFunctionDecl('add')),
      ]);
      registry.register('Lib.Math', mathProgram);

      const mainProgram = createProgram('Game.Main', [
        createImportDecl(['add'], ['Lib', 'Math']),
      ]);
      registry.register('Game.Main', mainProgram);

      expect(resolver.allImportsValid(mainProgram)).toBe(true);
    });

    it('allImportsValid returns false when any import invalid', () => {
      const mainProgram = createProgram('Game.Main', [
        createImportDecl(['foo'], ['NonExistent']),
      ]);
      registry.register('Game.Main', mainProgram);

      expect(resolver.allImportsValid(mainProgram)).toBe(false);
    });
  });

  // ============================================================
  // Edge Cases
  // ============================================================

  describe('edge cases', () => {
    it('handles program with no imports', () => {
      const mainProgram = createProgram('Game.Main', [
        createFunctionDecl('main'),
      ]);
      registry.register('Game.Main', mainProgram);

      const results = resolver.resolveImports(mainProgram);

      expect(results).toHaveLength(0);
    });

    it('handles module with no exports', () => {
      const emptyProgram = createProgram('Lib.Empty', []);
      registry.register('Lib.Empty', emptyProgram);

      const exports = resolver.getModuleExports('Lib.Empty');

      expect(exports.size).toBe(0);
    });

    it('handles non-registered module in getModuleExports', () => {
      const exports = resolver.getModuleExports('NonExistent');

      expect(exports.size).toBe(0);
    });
  });
});