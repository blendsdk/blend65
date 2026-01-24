/**
 * Tests for GlobalsGenerator - Map Variables
 *
 * Tests the @map variable registration functionality.
 * Map variables are memory-mapped to fixed hardware addresses.
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module __tests__/codegen/globals-generator-map.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GlobalsGenerator } from '../../codegen/globals-generator.js';
import { ILModule } from '../../il/module.js';
import { ILStorageClass } from '../../il/function.js';
import { IL_BYTE, IL_WORD } from '../../il/types.js';
import { C64_CONFIG } from '../../target/index.js';
import type { CodegenOptions } from '../../codegen/types.js';

/**
 * Concrete test implementation of GlobalsGenerator
 */
class TestGlobalsGenerator extends GlobalsGenerator {
  public exposeMapAddresses(): Map<string, number> {
    return this.mapAddresses;
  }

  public exposeGenerateGlobals(): void {
    this.generateGlobals();
  }

  public exposeLookupGlobalAddress(name: string): { address: number; isZeroPage: boolean } | undefined {
    return this.lookupGlobalAddress(name);
  }

  public exposeGetStats() {
    return this.getStats();
  }

  public exposeGetWarnings(): string[] {
    return this.getWarnings();
  }

  public setModule(module: ILModule): void {
    this.currentModule = module;
  }

  public setOptions(options: CodegenOptions): void {
    this.options = options;
  }
}

function createTestOptions(): CodegenOptions {
  return {
    target: C64_CONFIG,
    format: 'prg',
    sourceMap: false,
    debug: 'none',
    loadAddress: 0x0801,
  };
}

describe('GlobalsGenerator - Map Variables', () => {
  let generator: TestGlobalsGenerator;
  let module: ILModule;

  beforeEach(() => {
    generator = new TestGlobalsGenerator();
    module = new ILModule('test.bl65');
    generator.setModule(module);
    generator.setOptions(createTestOptions());
  });

  // ===========================================================================
  // Basic Map Variable Tests
  // ===========================================================================

  describe('basic map variable registration', () => {
    it('should register map variable with fixed address', () => {
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, { address: 0xD020 });
      generator.exposeGenerateGlobals();

      const address = generator.exposeMapAddresses().get('borderColor');
      expect(address).toBe(0xD020);
    });

    it('should register map variable for background color', () => {
      module.createGlobal('bgColor', IL_BYTE, ILStorageClass.Map, { address: 0xD021 });
      generator.exposeGenerateGlobals();

      const address = generator.exposeMapAddresses().get('bgColor');
      expect(address).toBe(0xD021);
    });

    it('should register word-sized map variable', () => {
      module.createGlobal('screenPtr', IL_WORD, ILStorageClass.Map, { address: 0x00D1 });
      generator.exposeGenerateGlobals();

      const address = generator.exposeMapAddresses().get('screenPtr');
      expect(address).toBe(0x00D1);
    });
  });

  // ===========================================================================
  // Multiple Map Variables Tests
  // ===========================================================================

  describe('multiple map variables', () => {
    it('should register multiple VIC registers', () => {
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, { address: 0xD020 });
      module.createGlobal('bgColor0', IL_BYTE, ILStorageClass.Map, { address: 0xD021 });
      module.createGlobal('bgColor1', IL_BYTE, ILStorageClass.Map, { address: 0xD022 });
      module.createGlobal('bgColor2', IL_BYTE, ILStorageClass.Map, { address: 0xD023 });
      generator.exposeGenerateGlobals();

      expect(generator.exposeMapAddresses().size).toBe(4);
      expect(generator.exposeMapAddresses().get('borderColor')).toBe(0xD020);
      expect(generator.exposeMapAddresses().get('bgColor0')).toBe(0xD021);
      expect(generator.exposeMapAddresses().get('bgColor1')).toBe(0xD022);
      expect(generator.exposeMapAddresses().get('bgColor2')).toBe(0xD023);
    });

    it('should register SID registers', () => {
      module.createGlobal('sidVolume', IL_BYTE, ILStorageClass.Map, { address: 0xD418 });
      module.createGlobal('sidFilter', IL_BYTE, ILStorageClass.Map, { address: 0xD417 });
      generator.exposeGenerateGlobals();

      expect(generator.exposeMapAddresses().get('sidVolume')).toBe(0xD418);
      expect(generator.exposeMapAddresses().get('sidFilter')).toBe(0xD417);
    });

    it('should track global count for map variables', () => {
      module.createGlobal('reg1', IL_BYTE, ILStorageClass.Map, { address: 0xD020 });
      module.createGlobal('reg2', IL_BYTE, ILStorageClass.Map, { address: 0xD021 });
      module.createGlobal('reg3', IL_BYTE, ILStorageClass.Map, { address: 0xD022 });
      generator.exposeGenerateGlobals();

      const stats = generator.exposeGetStats();
      expect(stats.globalCount).toBe(3);
    });
  });

  // ===========================================================================
  // Address Lookup Tests
  // ===========================================================================

  describe('address lookup', () => {
    it('should lookup map variable address', () => {
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, { address: 0xD020 });
      generator.exposeGenerateGlobals();

      const lookup = generator.exposeLookupGlobalAddress('borderColor');
      expect(lookup).toBeDefined();
      expect(lookup!.address).toBe(0xD020);
      expect(lookup!.isZeroPage).toBe(false);
    });

    it('should return isZeroPage false for high addresses', () => {
      module.createGlobal('vicReg', IL_BYTE, ILStorageClass.Map, { address: 0xD000 });
      generator.exposeGenerateGlobals();

      const lookup = generator.exposeLookupGlobalAddress('vicReg');
      expect(lookup!.isZeroPage).toBe(false);
    });

    it('should return undefined for non-existent map variable', () => {
      const lookup = generator.exposeLookupGlobalAddress('nonExistent');
      expect(lookup).toBeUndefined();
    });
  });

  // ===========================================================================
  // Warning Tests
  // ===========================================================================

  describe('warnings', () => {
    it('should warn when map variable has no address', () => {
      // Create a map variable without an address
      module.createGlobal('badMap', IL_BYTE, ILStorageClass.Map);
      generator.exposeGenerateGlobals();

      const warnings = generator.exposeGetWarnings();
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.includes('badMap') && w.includes('no address'))).toBe(true);
    });

    it('should not warn when map variable has valid address', () => {
      module.createGlobal('goodMap', IL_BYTE, ILStorageClass.Map, { address: 0xD020 });
      generator.exposeGenerateGlobals();

      const warnings = generator.exposeGetWarnings();
      expect(warnings.filter(w => w.includes('goodMap'))).toHaveLength(0);
    });
  });

  // ===========================================================================
  // C64 Hardware Register Tests
  // ===========================================================================

  describe('C64 hardware registers', () => {
    it('should support CIA timer registers', () => {
      module.createGlobal('cia1TimerA', IL_WORD, ILStorageClass.Map, { address: 0xDC04 });
      module.createGlobal('cia1TimerB', IL_WORD, ILStorageClass.Map, { address: 0xDC06 });
      generator.exposeGenerateGlobals();

      expect(generator.exposeMapAddresses().get('cia1TimerA')).toBe(0xDC04);
      expect(generator.exposeMapAddresses().get('cia1TimerB')).toBe(0xDC06);
    });

    it('should support VIC sprite registers', () => {
      module.createGlobal('spriteX0', IL_BYTE, ILStorageClass.Map, { address: 0xD000 });
      module.createGlobal('spriteY0', IL_BYTE, ILStorageClass.Map, { address: 0xD001 });
      module.createGlobal('spriteMSB', IL_BYTE, ILStorageClass.Map, { address: 0xD010 });
      generator.exposeGenerateGlobals();

      expect(generator.exposeMapAddresses().get('spriteX0')).toBe(0xD000);
      expect(generator.exposeMapAddresses().get('spriteY0')).toBe(0xD001);
      expect(generator.exposeMapAddresses().get('spriteMSB')).toBe(0xD010);
    });

    it('should support raster register', () => {
      module.createGlobal('rasterLine', IL_BYTE, ILStorageClass.Map, { address: 0xD012 });
      generator.exposeGenerateGlobals();

      expect(generator.exposeMapAddresses().get('rasterLine')).toBe(0xD012);
    });

    it('should support memory control register', () => {
      module.createGlobal('memControl', IL_BYTE, ILStorageClass.Map, { address: 0xD018 });
      generator.exposeGenerateGlobals();

      expect(generator.exposeMapAddresses().get('memControl')).toBe(0xD018);
    });
  });

  // ===========================================================================
  // Mixed Storage Class Priority Tests
  // ===========================================================================

  describe('mixed with other storage classes', () => {
    it('should process map variables before ZP variables', () => {
      // Map variables should be processed first (just registered, no allocation)
      module.createGlobal('zpVar', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('mapVar', IL_BYTE, ILStorageClass.Map, { address: 0xD020 });
      generator.exposeGenerateGlobals();

      // Both should be tracked
      expect(generator.exposeMapAddresses().has('mapVar')).toBe(true);
      // ZP should not be affected by map processing
      const lookup = generator.exposeLookupGlobalAddress('mapVar');
      expect(lookup!.address).toBe(0xD020);
    });

    it('should handle all storage classes together', () => {
      module.createGlobal('zpCounter', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('ramBuffer', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('dataConst', IL_BYTE, ILStorageClass.Data, { initialValue: 0x42 });
      module.createGlobal('borderReg', IL_BYTE, ILStorageClass.Map, { address: 0xD020 });
      generator.exposeGenerateGlobals();

      const stats = generator.exposeGetStats();
      expect(stats.globalCount).toBe(4);
    });
  });
});