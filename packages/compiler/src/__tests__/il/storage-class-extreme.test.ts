/**
 * Storage Class Extreme Tests - Task 5.7
 *
 * Extreme edge case tests for storage class handling (@zp, @ram, @data, @map).
 * Tests the ILStorageClass enum, storage class conversion, global variable
 * storage class filtering, parameter storage hints, and printer formatting.
 *
 * Test Categories:
 * - ILStorageClass enum edge cases
 * - ILModule.createGlobal() with all storage classes
 * - ILModule.getGlobalsByStorageClass() filtering
 * - ILFunction parameter storage hints
 * - ILGeneratorBase.convertStorageClass() conversion
 * - ILPrinter.formatStorageClass() formatting
 * - C64 memory region integration
 *
 * @module il/storage-class-extreme.test
 */

import { describe, expect, it } from 'vitest';
import { ILModule } from '../../il/module.js';
import { ILFunction, ILStorageClass } from '../../il/function.js';
import { IL_BYTE, IL_WORD, IL_VOID, createArrayType } from '../../il/types.js';
import { ILPrinter } from '../../il/printer.js';
import { ILGeneratorBase } from '../../il/generator/base.js';
import { StorageClass } from '../../semantic/symbol.js';
import { GlobalSymbolTable } from '../../semantic/global-symbol-table.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a minimal ILGeneratorBase for testing convertStorageClass.
 */
function createTestGenerator(): ILGeneratorBase {
  const symbolTable = new GlobalSymbolTable();
  return new ILGeneratorBase(symbolTable, null);
}

// =============================================================================
// ILStorageClass Enum Extreme Tests
// =============================================================================

describe('ILStorageClass Enum Extreme Tests', () => {
  describe('enum value verification', () => {
    it('should have ZeroPage value as "zeropage"', () => {
      expect(ILStorageClass.ZeroPage).toBe('zeropage');
    });

    it('should have Ram value as "ram"', () => {
      expect(ILStorageClass.Ram).toBe('ram');
    });

    it('should have Data value as "data"', () => {
      expect(ILStorageClass.Data).toBe('data');
    });

    it('should have Map value as "map"', () => {
      expect(ILStorageClass.Map).toBe('map');
    });
  });

  describe('enum uniqueness', () => {
    it('should have unique values for all storage classes', () => {
      const values = [
        ILStorageClass.ZeroPage,
        ILStorageClass.Ram,
        ILStorageClass.Data,
        ILStorageClass.Map,
      ];
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(4);
    });
  });
});

// =============================================================================
// ILModule Global Variable Storage Class Tests
// =============================================================================

describe('ILModule Global Variable Storage Class Extreme Tests', () => {
  describe('createGlobal() with ZeroPage storage class', () => {
    it('should create @zp byte variable', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('zpVar', IL_BYTE, ILStorageClass.ZeroPage);

      expect(global.name).toBe('zpVar');
      expect(global.type).toBe(IL_BYTE);
      expect(global.storageClass).toBe(ILStorageClass.ZeroPage);
    });

    it('should create @zp word variable for loop counters', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('loopCounter', IL_WORD, ILStorageClass.ZeroPage);

      expect(global.storageClass).toBe(ILStorageClass.ZeroPage);
      expect(global.type).toBe(IL_WORD);
    });

    it('should create @zp pointer variable (word)', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('screenPtr', IL_WORD, ILStorageClass.ZeroPage);

      expect(global.storageClass).toBe(ILStorageClass.ZeroPage);
    });

    it('should create @zp array variable', () => {
      const module = new ILModule('test');
      const arrayType = createArrayType(IL_BYTE, 4);

      const global = module.createGlobal('tempBuffer', arrayType, ILStorageClass.ZeroPage);

      expect(global.storageClass).toBe(ILStorageClass.ZeroPage);
      expect(global.type.kind).toBe('array');
    });
  });

  describe('createGlobal() with Ram storage class', () => {
    it('should create @ram byte variable', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('ramVar', IL_BYTE, ILStorageClass.Ram);

      expect(global.storageClass).toBe(ILStorageClass.Ram);
    });

    it('should create @ram with initial value', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('counter', IL_BYTE, ILStorageClass.Ram, {
        initialValue: 0,
      });

      expect(global.storageClass).toBe(ILStorageClass.Ram);
      expect(global.initialValue).toBe(0);
    });

    it('should create @ram large array for screen buffer', () => {
      const module = new ILModule('test');
      const arrayType = createArrayType(IL_BYTE, 1000);

      const global = module.createGlobal('screenBuffer', arrayType, ILStorageClass.Ram);

      expect(global.storageClass).toBe(ILStorageClass.Ram);
    });
  });

  describe('createGlobal() with Data storage class', () => {
    it('should create @data constant byte', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('maxValue', IL_BYTE, ILStorageClass.Data, {
        initialValue: 255,
        isConstant: true,
      });

      expect(global.storageClass).toBe(ILStorageClass.Data);
      expect(global.isConstant).toBe(true);
      expect(global.initialValue).toBe(255);
    });

    it('should create @data constant array (lookup table)', () => {
      const module = new ILModule('test');
      const arrayType = createArrayType(IL_BYTE, 16);

      const global = module.createGlobal('sinTable', arrayType, ILStorageClass.Data, {
        initialValue: [0, 25, 50, 71, 90, 106, 118, 126, 127, 126, 118, 106, 90, 71, 50, 25],
        isConstant: true,
      });

      expect(global.storageClass).toBe(ILStorageClass.Data);
      expect(global.initialValue).toHaveLength(16);
    });

    it('should create @data string constant', () => {
      const module = new ILModule('test');
      const arrayType = createArrayType(IL_BYTE, 6);

      const global = module.createGlobal('message', arrayType, ILStorageClass.Data, {
        initialValue: [72, 69, 76, 76, 79, 0], // "HELLO\0"
        isConstant: true,
      });

      expect(global.storageClass).toBe(ILStorageClass.Data);
    });
  });

  describe('createGlobal() with Map storage class', () => {
    it('should create @map variable at VIC-II border color address', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, {
        address: 0xd020,
      });

      expect(global.storageClass).toBe(ILStorageClass.Map);
      expect(global.address).toBe(0xd020);
    });

    it('should create @map variable at SID volume address', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('sidVolume', IL_BYTE, ILStorageClass.Map, {
        address: 0xd418,
      });

      expect(global.storageClass).toBe(ILStorageClass.Map);
      expect(global.address).toBe(0xd418);
    });

    it('should create @map word variable for sprite position', () => {
      const module = new ILModule('test');

      const global = module.createGlobal('sprite0X', IL_WORD, ILStorageClass.Map, {
        address: 0xd000,
      });

      expect(global.storageClass).toBe(ILStorageClass.Map);
      expect(global.type).toBe(IL_WORD);
    });

    it('should create @map array for screen memory', () => {
      const module = new ILModule('test');
      const arrayType = createArrayType(IL_BYTE, 1000);

      const global = module.createGlobal('screen', arrayType, ILStorageClass.Map, {
        address: 0x0400,
      });

      expect(global.storageClass).toBe(ILStorageClass.Map);
      expect(global.address).toBe(0x0400);
    });
  });

  describe('getGlobalsByStorageClass() filtering', () => {
    it('should filter only ZeroPage globals', () => {
      const module = new ILModule('test');
      module.createGlobal('zp1', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('zp2', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('ram1', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('data1', IL_BYTE, ILStorageClass.Data);
      module.createGlobal('map1', IL_BYTE, ILStorageClass.Map, { address: 0xd020 });

      const zpGlobals = module.getGlobalsByStorageClass(ILStorageClass.ZeroPage);

      expect(zpGlobals).toHaveLength(2);
      expect(zpGlobals.every((g) => g.storageClass === ILStorageClass.ZeroPage)).toBe(true);
    });

    it('should filter only Ram globals', () => {
      const module = new ILModule('test');
      module.createGlobal('zp1', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('ram1', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('ram2', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('ram3', IL_BYTE, ILStorageClass.Ram);

      const ramGlobals = module.getGlobalsByStorageClass(ILStorageClass.Ram);

      expect(ramGlobals).toHaveLength(3);
    });

    it('should filter only Data globals', () => {
      const module = new ILModule('test');
      module.createGlobal('data1', IL_BYTE, ILStorageClass.Data, { initialValue: 1, isConstant: true });
      module.createGlobal('data2', IL_BYTE, ILStorageClass.Data, { initialValue: 2, isConstant: true });
      module.createGlobal('ram1', IL_BYTE, ILStorageClass.Ram);

      const dataGlobals = module.getGlobalsByStorageClass(ILStorageClass.Data);

      expect(dataGlobals).toHaveLength(2);
      expect(dataGlobals.every((g) => g.isConstant)).toBe(true);
    });

    it('should filter only Map globals', () => {
      const module = new ILModule('test');
      module.createGlobal('border', IL_BYTE, ILStorageClass.Map, { address: 0xd020 });
      module.createGlobal('background', IL_BYTE, ILStorageClass.Map, { address: 0xd021 });
      module.createGlobal('volume', IL_BYTE, ILStorageClass.Map, { address: 0xd418 });
      module.createGlobal('normal', IL_BYTE, ILStorageClass.Ram);

      const mapGlobals = module.getGlobalsByStorageClass(ILStorageClass.Map);

      expect(mapGlobals).toHaveLength(3);
      expect(mapGlobals.every((g) => g.address !== undefined)).toBe(true);
    });

    it('should return empty array when no globals match', () => {
      const module = new ILModule('test');
      module.createGlobal('ram1', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('ram2', IL_BYTE, ILStorageClass.Ram);

      const zpGlobals = module.getGlobalsByStorageClass(ILStorageClass.ZeroPage);

      expect(zpGlobals).toHaveLength(0);
    });
  });
});

// =============================================================================
// ILFunction Parameter Storage Hints Extreme Tests
// =============================================================================

describe('ILFunction Parameter Storage Hints Extreme Tests', () => {
  describe('setParameterStorageHint()', () => {
    it('should set ZeroPage hint for parameter', () => {
      const func = new ILFunction('test', [{ name: 'param', type: IL_BYTE }], IL_VOID);

      func.setParameterStorageHint('param', ILStorageClass.ZeroPage);

      expect(func.getParameterStorageHint('param')).toBe(ILStorageClass.ZeroPage);
    });

    it('should set Ram hint for parameter', () => {
      const func = new ILFunction('test', [{ name: 'param', type: IL_BYTE }], IL_VOID);

      func.setParameterStorageHint('param', ILStorageClass.Ram);

      expect(func.getParameterStorageHint('param')).toBe(ILStorageClass.Ram);
    });

    it('should set Data hint for parameter', () => {
      const func = new ILFunction('test', [{ name: 'param', type: IL_BYTE }], IL_VOID);

      func.setParameterStorageHint('param', ILStorageClass.Data);

      expect(func.getParameterStorageHint('param')).toBe(ILStorageClass.Data);
    });

    it('should set different hints for different parameters', () => {
      const func = new ILFunction(
        'multiParam',
        [
          { name: 'a', type: IL_BYTE },
          { name: 'b', type: IL_WORD },
          { name: 'c', type: IL_BYTE },
        ],
        IL_VOID,
      );

      func.setParameterStorageHint('a', ILStorageClass.ZeroPage);
      func.setParameterStorageHint('b', ILStorageClass.Ram);
      func.setParameterStorageHint('c', ILStorageClass.ZeroPage);

      expect(func.getParameterStorageHint('a')).toBe(ILStorageClass.ZeroPage);
      expect(func.getParameterStorageHint('b')).toBe(ILStorageClass.Ram);
      expect(func.getParameterStorageHint('c')).toBe(ILStorageClass.ZeroPage);
    });

    it('should overwrite existing hint', () => {
      const func = new ILFunction('test', [{ name: 'param', type: IL_BYTE }], IL_VOID);

      func.setParameterStorageHint('param', ILStorageClass.Ram);
      func.setParameterStorageHint('param', ILStorageClass.ZeroPage);

      expect(func.getParameterStorageHint('param')).toBe(ILStorageClass.ZeroPage);
    });
  });

  describe('getParameterStorageHint()', () => {
    it('should return undefined for parameter without hint', () => {
      const func = new ILFunction('test', [{ name: 'param', type: IL_BYTE }], IL_VOID);

      expect(func.getParameterStorageHint('param')).toBeUndefined();
    });

    it('should return undefined for non-existent parameter name', () => {
      const func = new ILFunction('test', [{ name: 'param', type: IL_BYTE }], IL_VOID);

      expect(func.getParameterStorageHint('nonExistent')).toBeUndefined();
    });
  });
});

// =============================================================================
// ILGeneratorBase.convertStorageClass() Extreme Tests
// =============================================================================

describe('ILGeneratorBase.convertStorageClass() Extreme Tests', () => {
  describe('conversion from semantic StorageClass', () => {
    it('should convert StorageClass.ZeroPage to ILStorageClass.ZeroPage', () => {
      const generator = createTestGenerator();

      const result = generator.convertStorageClass(StorageClass.ZeroPage);

      expect(result).toBe(ILStorageClass.ZeroPage);
    });

    it('should convert StorageClass.RAM to ILStorageClass.Ram', () => {
      const generator = createTestGenerator();

      const result = generator.convertStorageClass(StorageClass.RAM);

      expect(result).toBe(ILStorageClass.Ram);
    });

    it('should convert StorageClass.Data to ILStorageClass.Data', () => {
      const generator = createTestGenerator();

      const result = generator.convertStorageClass(StorageClass.Data);

      expect(result).toBe(ILStorageClass.Data);
    });

    it('should convert StorageClass.Map to ILStorageClass.Map', () => {
      const generator = createTestGenerator();

      const result = generator.convertStorageClass(StorageClass.Map);

      expect(result).toBe(ILStorageClass.Map);
    });

    it('should return Ram for undefined storage class (default)', () => {
      const generator = createTestGenerator();

      const result = generator.convertStorageClass(undefined);

      expect(result).toBe(ILStorageClass.Ram);
    });
  });
});

// =============================================================================
// ILPrinter.formatStorageClass() Extreme Tests
// =============================================================================

describe('ILPrinter.formatStorageClass() Extreme Tests', () => {
  describe('storage class formatting', () => {
    it('should format ZeroPage as "zp"', () => {
      const printer = new ILPrinter();

      const result = printer.formatStorageClass(ILStorageClass.ZeroPage);

      expect(result).toBe('zp');
    });

    it('should format Ram as "ram"', () => {
      const printer = new ILPrinter();

      const result = printer.formatStorageClass(ILStorageClass.Ram);

      expect(result).toBe('ram');
    });

    it('should format Data as "data"', () => {
      const printer = new ILPrinter();

      const result = printer.formatStorageClass(ILStorageClass.Data);

      expect(result).toBe('data');
    });

    it('should format Map as "map"', () => {
      const printer = new ILPrinter();

      const result = printer.formatStorageClass(ILStorageClass.Map);

      expect(result).toBe('map');
    });
  });

  describe('printGlobal() with storage classes', () => {
    it('should print @zp global correctly', () => {
      const module = new ILModule('test');
      module.createGlobal('zpCounter', IL_BYTE, ILStorageClass.ZeroPage);
      const printer = new ILPrinter();

      const output = printer.printModule(module);

      expect(output).toContain('zpCounter');
      expect(output).toContain('[zp]');
    });

    it('should print @ram global correctly', () => {
      const module = new ILModule('test');
      module.createGlobal('ramBuffer', IL_WORD, ILStorageClass.Ram);
      const printer = new ILPrinter();

      const output = printer.printModule(module);

      expect(output).toContain('ramBuffer');
      expect(output).toContain('[ram]');
    });

    it('should print @data global with initial value', () => {
      const module = new ILModule('test');
      module.createGlobal('constant', IL_BYTE, ILStorageClass.Data, {
        initialValue: 42,
        isConstant: true,
      });
      const printer = new ILPrinter();

      const output = printer.printModule(module);

      expect(output).toContain('constant');
      expect(output).toContain('[data]');
      expect(output).toContain('42');
    });

    it('should print @map global with address', () => {
      const module = new ILModule('test');
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, {
        address: 0xd020,
      });
      const printer = new ILPrinter();

      const output = printer.printModule(module);

      expect(output).toContain('borderColor');
      expect(output).toContain('[map]');
      expect(output).toContain('D020');
    });
  });
});

// =============================================================================
// C64 Memory Region Integration Tests
// =============================================================================

describe('C64 Memory Region Integration Tests', () => {
  describe('Zero Page ($00-$FF) typical usage', () => {
    it('should track multiple ZP variables for fast access', () => {
      const module = new ILModule('c64-game');

      // Typical game variables in zero page
      module.createGlobal('playerX', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('playerY', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('score', IL_WORD, ILStorageClass.ZeroPage);
      module.createGlobal('tempPtr', IL_WORD, ILStorageClass.ZeroPage);

      const zpGlobals = module.getGlobalsByStorageClass(ILStorageClass.ZeroPage);

      expect(zpGlobals).toHaveLength(4);
    });
  });

  describe('RAM ($0800-$CFFF) typical usage', () => {
    it('should track standard RAM variables', () => {
      const module = new ILModule('c64-app');

      module.createGlobal('gameState', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('levelData', createArrayType(IL_BYTE, 256), ILStorageClass.Ram);
      module.createGlobal('highScores', createArrayType(IL_BYTE, 30), ILStorageClass.Ram);

      const ramGlobals = module.getGlobalsByStorageClass(ILStorageClass.Ram);

      expect(ramGlobals).toHaveLength(3);
    });
  });

  describe('Data Section (ROM-like constants)', () => {
    it('should track read-only data constants', () => {
      const module = new ILModule('c64-data');

      // Lookup tables and constants
      module.createGlobal('spriteData', createArrayType(IL_BYTE, 63), ILStorageClass.Data, {
        isConstant: true,
        initialValue: new Array(63).fill(0),
      });
      module.createGlobal('levelMap', createArrayType(IL_BYTE, 1000), ILStorageClass.Data, {
        isConstant: true,
        initialValue: new Array(1000).fill(0),
      });

      const dataGlobals = module.getGlobalsByStorageClass(ILStorageClass.Data);

      expect(dataGlobals).toHaveLength(2);
      expect(dataGlobals.every((g) => g.isConstant)).toBe(true);
    });
  });

  describe('Hardware I/O ($D000-$DFFF) typical usage', () => {
    it('should track VIC-II mapped registers', () => {
      const module = new ILModule('vic-control');

      // VIC-II registers
      module.createGlobal('sprite0X', IL_BYTE, ILStorageClass.Map, { address: 0xd000 });
      module.createGlobal('sprite0Y', IL_BYTE, ILStorageClass.Map, { address: 0xd001 });
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, { address: 0xd020 });
      module.createGlobal('backgroundColor', IL_BYTE, ILStorageClass.Map, { address: 0xd021 });
      module.createGlobal('rasterLine', IL_BYTE, ILStorageClass.Map, { address: 0xd012 });

      const mapGlobals = module.getGlobalsByStorageClass(ILStorageClass.Map);

      expect(mapGlobals).toHaveLength(5);
      expect(mapGlobals.every((g) => g.address !== undefined && g.address >= 0xd000)).toBe(true);
    });

    it('should track SID mapped registers', () => {
      const module = new ILModule('sid-control');

      // SID registers
      module.createGlobal('voice1FreqLo', IL_BYTE, ILStorageClass.Map, { address: 0xd400 });
      module.createGlobal('voice1FreqHi', IL_BYTE, ILStorageClass.Map, { address: 0xd401 });
      module.createGlobal('voice1PwLo', IL_BYTE, ILStorageClass.Map, { address: 0xd402 });
      module.createGlobal('voice1PwHi', IL_BYTE, ILStorageClass.Map, { address: 0xd403 });
      module.createGlobal('volume', IL_BYTE, ILStorageClass.Map, { address: 0xd418 });

      const mapGlobals = module.getGlobalsByStorageClass(ILStorageClass.Map);

      expect(mapGlobals).toHaveLength(5);
    });

    it('should track CIA mapped registers', () => {
      const module = new ILModule('cia-control');

      // CIA1 registers
      module.createGlobal('cia1DataA', IL_BYTE, ILStorageClass.Map, { address: 0xdc00 });
      module.createGlobal('cia1DataB', IL_BYTE, ILStorageClass.Map, { address: 0xdc01 });

      // CIA2 registers
      module.createGlobal('cia2DataA', IL_BYTE, ILStorageClass.Map, { address: 0xdd00 });
      module.createGlobal('cia2DataB', IL_BYTE, ILStorageClass.Map, { address: 0xdd01 });

      const mapGlobals = module.getGlobalsByStorageClass(ILStorageClass.Map);

      expect(mapGlobals).toHaveLength(4);
    });
  });

  describe('mixed storage class module', () => {
    it('should properly categorize all storage classes in a real module', () => {
      const module = new ILModule('complete-game');

      // Zero page - fast access
      module.createGlobal('playerX', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('playerY', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('tempPtr', IL_WORD, ILStorageClass.ZeroPage);

      // RAM - general storage
      module.createGlobal('screenBuffer', createArrayType(IL_BYTE, 1000), ILStorageClass.Ram);
      module.createGlobal('gameState', IL_BYTE, ILStorageClass.Ram);

      // Data - constants
      module.createGlobal('spriteData', createArrayType(IL_BYTE, 63), ILStorageClass.Data, {
        isConstant: true,
        initialValue: new Array(63).fill(0),
      });

      // Map - hardware
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, { address: 0xd020 });
      module.createGlobal('rasterLine', IL_BYTE, ILStorageClass.Map, { address: 0xd012 });

      // Verify counts
      expect(module.getGlobalsByStorageClass(ILStorageClass.ZeroPage)).toHaveLength(3);
      expect(module.getGlobalsByStorageClass(ILStorageClass.Ram)).toHaveLength(2);
      expect(module.getGlobalsByStorageClass(ILStorageClass.Data)).toHaveLength(1);
      expect(module.getGlobalsByStorageClass(ILStorageClass.Map)).toHaveLength(2);
      expect(module.getGlobalCount()).toBe(8);
    });
  });
});