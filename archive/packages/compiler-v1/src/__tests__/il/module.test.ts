/**
 * IL Module Tests
 *
 * Tests for ILModule class which represents a compilation unit in the IL representation.
 * An ILModule contains functions, global variables, imports, and exports.
 *
 * Test Categories:
 * - Construction: Module creation
 * - Function Management: Creating, getting, and removing functions
 * - Global Variable Management: Adding and managing globals
 * - Import/Export Management: Module dependencies
 * - Entry Point: Program entry point management
 * - Metadata: Module-level metadata
 * - Analysis: Statistics and validation
 *
 * @module il/module.test
 */

import { describe, expect, it } from 'vitest';
import { ILModule, type ILGlobalVariable, type ILImport, type ILExport } from '../../il/module.js';
import { ILFunction, ILStorageClass } from '../../il/function.js';
import { IL_BYTE, IL_WORD, IL_BOOL, IL_VOID } from '../../il/types.js';
import { ILReturnVoidInstruction } from '../../il/instructions.js';

// =============================================================================
// ILModule Construction Tests
// =============================================================================

describe('ILModule', () => {
  describe('construction', () => {
    it('should create module with name', () => {
      const module = new ILModule('main.bl65');

      expect(module.name).toBe('main.bl65');
    });

    it('should create empty module', () => {
      const module = new ILModule('test');

      expect(module.getFunctionCount()).toBe(0);
      expect(module.getGlobalCount()).toBe(0);
      expect(module.getImportCount()).toBe(0);
      expect(module.getExportCount()).toBe(0);
    });

    it('should handle empty module name', () => {
      const module = new ILModule('');

      expect(module.name).toBe('');
    });

    it('should handle long module name', () => {
      const longName = 'path/to/some/very/long/module/name.bl65';
      const module = new ILModule(longName);

      expect(module.name).toBe(longName);
    });
  });

  // ===========================================================================
  // Function Management Tests
  // ===========================================================================

  describe('function management - createFunction()', () => {
    it('should create function and add to module', () => {
      const module = new ILModule('test');

      const func = module.createFunction('init', [], IL_VOID);

      expect(func.name).toBe('init');
      expect(module.hasFunction('init')).toBe(true);
    });

    it('should create function with parameters', () => {
      const module = new ILModule('test');

      const func = module.createFunction(
        'add',
        [
          { name: 'a', type: IL_BYTE },
          { name: 'b', type: IL_BYTE },
        ],
        IL_BYTE,
      );

      expect(func.parameters).toHaveLength(2);
      expect(func.returnType).toBe(IL_BYTE);
    });

    it('should throw when creating duplicate function', () => {
      const module = new ILModule('test');
      module.createFunction('existing', [], IL_VOID);

      expect(() => {
        module.createFunction('existing', [], IL_VOID);
      }).toThrow();
    });
  });

  describe('function management - addFunction()', () => {
    it('should add existing function to module', () => {
      const module = new ILModule('test');
      const func = new ILFunction('external', [], IL_VOID);

      module.addFunction(func);

      expect(module.hasFunction('external')).toBe(true);
      expect(module.getFunction('external')).toBe(func);
    });

    it('should throw when adding duplicate function', () => {
      const module = new ILModule('test');
      module.createFunction('existing', [], IL_VOID);
      const duplicate = new ILFunction('existing', [], IL_VOID);

      expect(() => {
        module.addFunction(duplicate);
      }).toThrow();
    });
  });

  describe('function management - getFunction()', () => {
    it('should get existing function by name', () => {
      const module = new ILModule('test');
      const created = module.createFunction('myFunc', [], IL_VOID);

      const retrieved = module.getFunction('myFunc');

      expect(retrieved).toBe(created);
    });

    it('should return undefined for non-existent function', () => {
      const module = new ILModule('test');

      expect(module.getFunction('notexist')).toBeUndefined();
    });
  });

  describe('function management - getFunctions()', () => {
    it('should return all functions', () => {
      const module = new ILModule('test');
      module.createFunction('a', [], IL_VOID);
      module.createFunction('b', [], IL_VOID);
      module.createFunction('c', [], IL_VOID);

      const funcs = module.getFunctions();

      expect(funcs).toHaveLength(3);
    });

    it('should return empty array for module without functions', () => {
      const module = new ILModule('test');

      expect(module.getFunctions()).toHaveLength(0);
    });
  });

  describe('function management - getFunctionNames()', () => {
    it('should return all function names', () => {
      const module = new ILModule('test');
      module.createFunction('init', [], IL_VOID);
      module.createFunction('update', [], IL_VOID);

      const names = module.getFunctionNames();

      expect(names).toContain('init');
      expect(names).toContain('update');
    });
  });

  describe('function management - removeFunction()', () => {
    it('should remove existing function', () => {
      const module = new ILModule('test');
      module.createFunction('temp', [], IL_VOID);

      const result = module.removeFunction('temp');

      expect(result).toBe(true);
      expect(module.hasFunction('temp')).toBe(false);
    });

    it('should return false for non-existent function', () => {
      const module = new ILModule('test');

      expect(module.removeFunction('notexist')).toBe(false);
    });
  });

  // ===========================================================================
  // Global Variable Management Tests
  // ===========================================================================

  describe('global management - createGlobal()', () => {
    it('should create global variable', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);

      expect(global.name).toBe('counter');
      expect(global.type).toBe(IL_BYTE);
      expect(global.storageClass).toBe(ILStorageClass.ZeroPage);
    });

    it('should create global with initial value', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('initial', IL_BYTE, ILStorageClass.Data, {
        initialValue: 42,
      });

      expect(global.initialValue).toBe(42);
    });

    it('should create global with fixed address', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('screen', IL_WORD, ILStorageClass.Map, {
        address: 0x0400,
      });

      expect(global.address).toBe(0x0400);
    });

    it('should create exported global', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('shared', IL_BYTE, ILStorageClass.Ram, {
        isExported: true,
      });

      expect(global.isExported).toBe(true);
    });

    it('should create constant global', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('pi', IL_BYTE, ILStorageClass.Data, {
        isConstant: true,
        initialValue: 31, // 3.14 * 10 approximation
      });

      expect(global.isConstant).toBe(true);
    });
  });

  describe('global management - addGlobal()', () => {
    it('should add global variable definition', () => {
      const module = new ILModule('test');
      const globalDef: ILGlobalVariable = {
        name: 'custom',
        type: IL_WORD,
        storageClass: ILStorageClass.Ram,
        isExported: false,
        isConstant: false,
      };

      module.addGlobal(globalDef);

      expect(module.hasGlobal('custom')).toBe(true);
    });

    it('should throw when adding duplicate global', () => {
      const module = new ILModule('test');
      module.createGlobal('existing', IL_BYTE, ILStorageClass.Ram);

      expect(() => {
        module.addGlobal({
          name: 'existing',
          type: IL_BYTE,
          storageClass: ILStorageClass.Ram,
          isExported: false,
          isConstant: false,
        });
      }).toThrow();
    });
  });

  describe('global management - getGlobalsByStorageClass()', () => {
    it('should filter globals by storage class', () => {
      const module = new ILModule('test');
      module.createGlobal('zp1', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('zp2', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('ram1', IL_BYTE, ILStorageClass.Ram);

      const zpGlobals = module.getGlobalsByStorageClass(ILStorageClass.ZeroPage);

      expect(zpGlobals).toHaveLength(2);
    });

    it('should return empty array when no matching storage class', () => {
      const module = new ILModule('test');
      module.createGlobal('ram', IL_BYTE, ILStorageClass.Ram);

      const dataGlobals = module.getGlobalsByStorageClass(ILStorageClass.Data);

      expect(dataGlobals).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Import Management Tests
  // ===========================================================================

  describe('import management', () => {
    it('should create import', () => {
      const module = new ILModule('test');

      const imp = module.createImport('helper', 'helper', './utils.bl65');

      expect(imp.localName).toBe('helper');
      expect(imp.originalName).toBe('helper');
      expect(imp.modulePath).toBe('./utils.bl65');
    });

    it('should create aliased import', () => {
      const module = new ILModule('test');

      const imp = module.createImport('h', 'helper', './utils.bl65');

      expect(imp.localName).toBe('h');
      expect(imp.originalName).toBe('helper');
    });

    it('should create type-only import', () => {
      const module = new ILModule('test');

      const imp = module.createImport('TypeDef', 'TypeDef', './types.bl65', true);

      expect(imp.isTypeOnly).toBe(true);
    });

    it('should get imports from specific module', () => {
      const module = new ILModule('test');
      module.createImport('a', 'a', './module1.bl65');
      module.createImport('b', 'b', './module1.bl65');
      module.createImport('c', 'c', './module2.bl65');

      const fromModule1 = module.getImportsFromModule('./module1.bl65');

      expect(fromModule1).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Export Management Tests
  // ===========================================================================

  describe('export management', () => {
    it('should create function export', () => {
      const module = new ILModule('test');
      module.createFunction('init', [], IL_VOID);

      const exp = module.createExport('init', 'init', 'function');

      expect(exp.exportedName).toBe('init');
      expect(exp.kind).toBe('function');
    });

    it('should create aliased export', () => {
      const module = new ILModule('test');
      module.createFunction('internalInit', [], IL_VOID);

      const exp = module.createExport('init', 'internalInit', 'function');

      expect(exp.exportedName).toBe('init');
      expect(exp.localName).toBe('internalInit');
    });

    it('should create variable export', () => {
      const module = new ILModule('test');
      module.createGlobal('counter', IL_BYTE, ILStorageClass.Ram);

      const exp = module.createExport('counter', 'counter', 'variable');

      expect(exp.kind).toBe('variable');
    });

    it('should get exports by kind', () => {
      const module = new ILModule('test');
      module.createFunction('f1', [], IL_VOID);
      module.createFunction('f2', [], IL_VOID);
      module.createGlobal('g', IL_BYTE, ILStorageClass.Ram);
      module.createExport('f1', 'f1', 'function');
      module.createExport('f2', 'f2', 'function');
      module.createExport('g', 'g', 'variable');

      const funcExports = module.getExportsByKind('function');

      expect(funcExports).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Entry Point Management Tests
  // ===========================================================================

  describe('entry point management', () => {
    it('should default to no entry point', () => {
      const module = new ILModule('test');

      expect(module.hasEntryPoint()).toBe(false);
      expect(module.getEntryPointName()).toBeNull();
    });

    it('should set entry point', () => {
      const module = new ILModule('test');
      module.createFunction('main', [], IL_VOID);

      module.setEntryPoint('main');

      expect(module.hasEntryPoint()).toBe(true);
      expect(module.getEntryPointName()).toBe('main');
    });

    it('should get entry point function', () => {
      const module = new ILModule('test');
      const main = module.createFunction('main', [], IL_VOID);
      module.setEntryPoint('main');

      expect(module.getEntryPoint()).toBe(main);
    });

    it('should throw when setting non-existent entry point', () => {
      const module = new ILModule('test');

      expect(() => {
        module.setEntryPoint('notexist');
      }).toThrow();
    });
  });

  // ===========================================================================
  // Metadata Management Tests
  // ===========================================================================

  describe('metadata management', () => {
    it('should set and get metadata', () => {
      const module = new ILModule('test');

      module.setMetadata('version', '1.0.0');

      expect(module.getMetadata<string>('version')).toBe('1.0.0');
    });

    it('should check metadata existence', () => {
      const module = new ILModule('test');
      module.setMetadata('key', 'value');

      expect(module.hasMetadata('key')).toBe(true);
      expect(module.hasMetadata('notexist')).toBe(false);
    });

    it('should handle complex metadata', () => {
      const module = new ILModule('test');
      const complex = { flags: [1, 2, 3], nested: { value: true } };

      module.setMetadata('config', complex);

      expect(module.getMetadata('config')).toEqual(complex);
    });
  });

  // ===========================================================================
  // Analysis and Statistics Tests
  // ===========================================================================

  describe('statistics - getStats()', () => {
    it('should return empty stats for new module', () => {
      const module = new ILModule('test');

      const stats = module.getStats();

      expect(stats.functionCount).toBe(0);
      expect(stats.globalCount).toBe(0);
      expect(stats.importCount).toBe(0);
      expect(stats.exportCount).toBe(0);
    });

    it('should count functions and globals', () => {
      const module = new ILModule('test');
      module.createFunction('f1', [], IL_VOID);
      module.createFunction('f2', [], IL_VOID);
      module.createGlobal('g1', IL_BYTE, ILStorageClass.Ram);

      const stats = module.getStats();

      expect(stats.functionCount).toBe(2);
      expect(stats.globalCount).toBe(1);
    });

    it('should count total blocks and instructions', () => {
      const module = new ILModule('test');
      const func = module.createFunction('test', [], IL_VOID);
      func.createBlock('extra');

      const stats = module.getStats();

      expect(stats.totalBlocks).toBe(2); // entry + extra
    });
  });

  describe('validation - validate()', () => {
    it('should return empty errors for valid module', () => {
      const module = new ILModule('test');
      const func = module.createFunction('main', [], IL_VOID);
      func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const errors = module.validate();

      expect(errors).toHaveLength(0);
    });

    it('should report missing entry point function', () => {
      const module = new ILModule('test');
      // Force set entry point name without function
      (module as unknown as { entryPointName: string }).entryPointName = 'missing';

      const errors = module.validate();

      expect(errors.some((e) => e.includes('missing'))).toBe(true);
    });

    it('should report invalid export references', () => {
      const module = new ILModule('test');
      module.createExport('invalid', 'nonexistent', 'function');

      const errors = module.validate();

      expect(errors.some((e) => e.includes('nonexistent'))).toBe(true);
    });
  });

  describe('symbol resolution - resolveSymbol()', () => {
    it('should resolve function symbol', () => {
      const module = new ILModule('test');
      const func = module.createFunction('myFunc', [], IL_VOID);

      const resolved = module.resolveSymbol('myFunc');

      expect(resolved?.kind).toBe('function');
      expect(resolved?.value).toBe(func);
    });

    it('should resolve global symbol', () => {
      const module = new ILModule('test');
      module.createGlobal('counter', IL_BYTE, ILStorageClass.Ram);

      const resolved = module.resolveSymbol('counter');

      expect(resolved?.kind).toBe('global');
    });

    it('should resolve import symbol', () => {
      const module = new ILModule('test');
      module.createImport('helper', 'helper', './utils.bl65');

      const resolved = module.resolveSymbol('helper');

      expect(resolved?.kind).toBe('import');
    });

    it('should return undefined for unknown symbol', () => {
      const module = new ILModule('test');

      expect(module.resolveSymbol('unknown')).toBeUndefined();
    });

    it('should prefer function over global with same name', () => {
      const module = new ILModule('test');
      module.createGlobal('name', IL_BYTE, ILStorageClass.Ram);
      module.createFunction('name', [], IL_VOID);

      const resolved = module.resolveSymbol('name');

      expect(resolved?.kind).toBe('function');
    });
  });

  // ===========================================================================
  // Debugging Tests
  // ===========================================================================

  describe('debugging - toString()', () => {
    it('should format module name', () => {
      const module = new ILModule('main.bl65');

      expect(module.toString()).toContain('main.bl65');
    });
  });

  describe('debugging - toDetailedString()', () => {
    it('should include imports', () => {
      const module = new ILModule('test');
      module.createImport('helper', 'helper', './utils.bl65');

      const str = module.toDetailedString();

      expect(str).toContain('helper');
      expect(str).toContain('./utils.bl65');
    });

    it('should include globals', () => {
      const module = new ILModule('test');
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);

      const str = module.toDetailedString();

      expect(str).toContain('counter');
      expect(str).toContain('zeropage');
    });

    it('should include exports', () => {
      const module = new ILModule('test');
      module.createFunction('init', [], IL_VOID);
      module.createExport('init', 'init', 'function');

      const str = module.toDetailedString();

      expect(str).toContain('init');
    });
  });
});