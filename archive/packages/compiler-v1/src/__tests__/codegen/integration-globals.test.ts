/**
 * Integration Tests - Global Variables
 *
 * Tests complete code generation for programs with global variables:
 * - @zp (zero-page) variables
 * - @ram variables
 * - @data variables
 * - @map (memory-mapped) variables
 *
 * @module __tests__/codegen/integration-globals.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGenerator } from '../../codegen/code-generator.js';
import { ILModule } from '../../il/module.js';
import { ILStorageClass } from '../../il/function.js';
import { IL_BYTE, IL_WORD, IL_VOID } from '../../il/types.js';
import {
  ILReturnVoidInstruction,
  ILConstInstruction,
  ILHardwareWriteInstruction,
} from '../../il/instructions.js';
import { C64_CONFIG } from '../../target/index.js';
import { C64_BASIC_START } from '../../codegen/types.js';
import type { CodegenOptions } from '../../codegen/types.js';

/**
 * Creates standard test options
 */
function createTestOptions(overrides: Partial<CodegenOptions> = {}): CodegenOptions {
  return {
    target: C64_CONFIG,
    format: 'asm',
    sourceMap: false,
    debug: 'none',
    loadAddress: C64_BASIC_START,
    ...overrides,
  };
}

describe('Integration - Global Variables', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  // ===========================================================================
  // Zero Page Variables Tests
  // ===========================================================================

  describe('zero page variables (@zp)', () => {
    it('should allocate single byte @zp variable', () => {
      const module = new ILModule('zp-byte.bl65');
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('Zero Page');
      expect(result.assembly).toContain('counter');
      expect(result.stats.zpBytesUsed).toBe(1);
    });

    it('should allocate word @zp variable', () => {
      const module = new ILModule('zp-word.bl65');
      module.createGlobal('score', IL_WORD, ILStorageClass.ZeroPage);

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('Zero Page');
      expect(result.assembly).toContain('score');
      expect(result.stats.zpBytesUsed).toBe(2);
    });

    it('should allocate multiple @zp variables sequentially', () => {
      const module = new ILModule('zp-multi.bl65');
      module.createGlobal('var1', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('var2', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('var3', IL_BYTE, ILStorageClass.ZeroPage);

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.zpBytesUsed).toBe(3);
      expect(result.stats.globalCount).toBe(3);
    });

    it('should track ZP bytes in stats for mixed types', () => {
      const module = new ILModule('zp-mixed.bl65');
      module.createGlobal('byte1', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('word1', IL_WORD, ILStorageClass.ZeroPage);
      module.createGlobal('byte2', IL_BYTE, ILStorageClass.ZeroPage);

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.zpBytesUsed).toBe(4); // 1 + 2 + 1
    });
  });

  // ===========================================================================
  // RAM Variables Tests
  // ===========================================================================

  describe('RAM variables (@ram)', () => {
    it('should allocate single @ram variable', () => {
      const module = new ILModule('ram-byte.bl65');
      module.createGlobal('buffer', IL_BYTE, ILStorageClass.Ram);

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('Data Section');
      expect(result.assembly).toContain('buffer');
      expect(result.stats.globalCount).toBe(1);
    });

    it('should allocate @ram variable with initial value', () => {
      const module = new ILModule('ram-init.bl65');
      module.createGlobal('counter', IL_BYTE, ILStorageClass.Ram, {
        initialValue: 42,
      });

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('counter');
      expect(result.stats.dataSize).toBeGreaterThan(0);
    });

    it('should allocate word @ram variable', () => {
      const module = new ILModule('ram-word.bl65');
      module.createGlobal('score', IL_WORD, ILStorageClass.Ram);

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('score');
      expect(result.stats.dataSize).toBeGreaterThanOrEqual(2);
    });

    it('should allocate multiple @ram variables', () => {
      const module = new ILModule('ram-multi.bl65');
      module.createGlobal('var1', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('var2', IL_BYTE, ILStorageClass.Ram);

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.globalCount).toBe(2);
    });
  });

  // ===========================================================================
  // Data Variables Tests
  // ===========================================================================

  describe('data variables (@data)', () => {
    it('should create @data variable with initial value', () => {
      const module = new ILModule('data-init.bl65');
      module.createGlobal('constant', IL_BYTE, ILStorageClass.Data, {
        initialValue: 100,
        isConstant: true,
      });

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('constant');
      expect(result.stats.dataSize).toBeGreaterThan(0);
    });

    it('should create @data variable with array initial value', () => {
      const module = new ILModule('data-array.bl65');
      module.createGlobal(
        'lookup',
        { kind: 'array', elementType: IL_BYTE, size: 4 },
        ILStorageClass.Data,
        { initialValue: [1, 2, 3, 4] }
      );

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('lookup');
    });
  });

  // ===========================================================================
  // Memory Mapped Variables Tests
  // ===========================================================================

  describe('memory mapped variables (@map)', () => {
    it('should register @map variable at fixed address', () => {
      const module = new ILModule('map-border.bl65');
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, {
        address: 0xD020,
      });

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.globalCount).toBe(1);
    });

    it('should register multiple @map variables', () => {
      const module = new ILModule('map-vic.bl65');
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, {
        address: 0xD020,
      });
      module.createGlobal('backgroundColor', IL_BYTE, ILStorageClass.Map, {
        address: 0xD021,
      });

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.globalCount).toBe(2);
    });

    it('should support VIC-II hardware register mapping', () => {
      const module = new ILModule('vic-regs.bl65');

      // VIC-II sprite X positions
      module.createGlobal('sprite0X', IL_BYTE, ILStorageClass.Map, {
        address: 0xD000,
      });
      module.createGlobal('sprite0Y', IL_BYTE, ILStorageClass.Map, {
        address: 0xD001,
      });

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.globalCount).toBe(2);
    });

    it('should support SID hardware register mapping', () => {
      const module = new ILModule('sid-regs.bl65');

      // SID volume control
      module.createGlobal('sidVolume', IL_BYTE, ILStorageClass.Map, {
        address: 0xD418,
      });

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.globalCount).toBe(1);
    });

    it('should support CIA hardware register mapping', () => {
      const module = new ILModule('cia-regs.bl65');

      // CIA1 data port A (joystick port 2)
      module.createGlobal('joystick', IL_BYTE, ILStorageClass.Map, {
        address: 0xDC00,
      });

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.globalCount).toBe(1);
    });
  });

  // ===========================================================================
  // Mixed Storage Classes Tests
  // ===========================================================================

  describe('mixed storage classes', () => {
    it('should handle @zp, @ram, and @map together', () => {
      const module = new ILModule('mixed.bl65');

      // Zero page variable
      module.createGlobal('fastCounter', IL_BYTE, ILStorageClass.ZeroPage);

      // RAM variable
      module.createGlobal('buffer', IL_BYTE, ILStorageClass.Ram);

      // Map variable
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, {
        address: 0xD020,
      });

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.globalCount).toBe(3);
      expect(result.stats.zpBytesUsed).toBe(1);
    });

    it('should track stats correctly for all storage classes', () => {
      const module = new ILModule('stats.bl65');

      // 3 ZP variables (5 bytes total)
      module.createGlobal('zpByte', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('zpWord', IL_WORD, ILStorageClass.ZeroPage);
      module.createGlobal('zpByte2', IL_BYTE, ILStorageClass.ZeroPage);

      // 2 RAM variables
      module.createGlobal('ramVar1', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('ramVar2', IL_BYTE, ILStorageClass.Ram);

      // 2 MAP variables
      module.createGlobal('mapVar1', IL_BYTE, ILStorageClass.Map, {
        address: 0xD020,
      });
      module.createGlobal('mapVar2', IL_BYTE, ILStorageClass.Map, {
        address: 0xD021,
      });

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.globalCount).toBe(7);
      expect(result.stats.zpBytesUsed).toBe(4); // 1 + 2 + 1
    });
  });

  // ===========================================================================
  // Program with Globals Tests
  // ===========================================================================

  describe('program with globals', () => {
    it('should generate program using @zp variable', () => {
      const module = new ILModule('use-zp.bl65');

      // Create @zp variable
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);

      // Create main function
      const main = module.createFunction('main', [], IL_VOID);
      const entry = main.getEntryBlock();
      entry.addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('counter');
      expect(result.assembly).toContain('_main');
      expect(result.stats.functionCount).toBe(1);
      expect(result.stats.globalCount).toBe(1);
    });

    it('should generate program using @map variable for hardware access', () => {
      const module = new ILModule('use-map.bl65');

      // Create @map variable for border color
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, {
        address: 0xD020,
      });

      // Create main function that sets border color
      const main = module.createFunction('main', [], IL_VOID);
      const entry = main.getEntryBlock();

      const v0 = main.createRegister(IL_BYTE, 'color');
      entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, v0));
      entry.addInstruction(new ILHardwareWriteInstruction(1, 0xD020, v0));
      entry.addInstruction(new ILReturnVoidInstruction(2));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('$D020');
      expect(result.stats.functionCount).toBe(1);
      expect(result.stats.globalCount).toBe(1);
    });

    it('should generate program with multiple variable types', () => {
      const module = new ILModule('multi-vars.bl65');

      // ZP variable
      module.createGlobal('frameCount', IL_BYTE, ILStorageClass.ZeroPage);

      // RAM variable
      module.createGlobal('gameState', IL_BYTE, ILStorageClass.Ram);

      // MAP variable
      module.createGlobal('rasterLine', IL_BYTE, ILStorageClass.Map, {
        address: 0xD012,
      });

      // Main function
      const main = module.createFunction('main', [], IL_VOID);
      main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.functionCount).toBe(1);
      expect(result.stats.globalCount).toBe(3);
      expect(result.stats.zpBytesUsed).toBe(1);
    });
  });
});