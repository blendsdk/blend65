/**
 * Tests for GlobalsGenerator - RAM and Data Section Variables
 *
 * Tests the RAM (@ram) and Data (@data) variable generation.
 * These variables are placed in the data section with labels.
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module __tests__/codegen/globals-generator-ram.test
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
  public exposeRamAllocations(): Map<string, { name: string; label: string; size: number; initialValue?: number | number[] }> {
    return this.ramAllocations;
  }

  public exposeGenerateGlobals(): void {
    this.generateGlobals();
  }

  public exposeLookupGlobalLabel(name: string): string | undefined {
    return this.lookupGlobalLabel(name);
  }

  public exposeLookupGlobalAddress(name: string): { address: number; isZeroPage: boolean } | undefined {
    return this.lookupGlobalAddress(name);
  }

  public exposeAssemblyWriter() {
    return this.assemblyWriter;
  }

  public exposeGetStats() {
    return this.getStats();
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

describe('GlobalsGenerator - RAM and Data Section Variables', () => {
  let generator: TestGlobalsGenerator;
  let module: ILModule;

  beforeEach(() => {
    generator = new TestGlobalsGenerator();
    module = new ILModule('test.bl65');
    generator.setModule(module);
    generator.setOptions(createTestOptions());
  });

  // ===========================================================================
  // RAM Variable Allocation Tests
  // ===========================================================================

  describe('RAM variable allocation', () => {
    it('should allocate RAM variable with label', () => {
      module.createGlobal('buffer', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const alloc = generator.exposeRamAllocations().get('buffer');
      expect(alloc).toBeDefined();
      expect(alloc!.name).toBe('buffer');
      expect(alloc!.label).toBe('_buffer');
      expect(alloc!.size).toBe(1);
    });

    it('should allocate word RAM variable', () => {
      module.createGlobal('counter', IL_WORD, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const alloc = generator.exposeRamAllocations().get('counter');
      expect(alloc).toBeDefined();
      expect(alloc!.size).toBe(2);
    });

    it('should track multiple RAM variables', () => {
      module.createGlobal('var1', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('var2', IL_WORD, ILStorageClass.Ram);
      module.createGlobal('var3', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      expect(generator.exposeRamAllocations().size).toBe(3);
    });

    it('should track data size for RAM variables', () => {
      module.createGlobal('byte1', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('word1', IL_WORD, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const stats = generator.exposeGetStats();
      expect(stats.dataSize).toBe(3); // 1 + 2
    });

    it('should increment global count for RAM variables', () => {
      module.createGlobal('var1', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('var2', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const stats = generator.exposeGetStats();
      expect(stats.globalCount).toBe(2);
    });
  });

  // ===========================================================================
  // Data Section Variable Tests
  // ===========================================================================

  describe('Data section variables', () => {
    it('should allocate DATA variable with label', () => {
      module.createGlobal('constant', IL_BYTE, ILStorageClass.Data);
      generator.exposeGenerateGlobals();

      const alloc = generator.exposeRamAllocations().get('constant');
      expect(alloc).toBeDefined();
      expect(alloc!.label).toBe('_constant');
    });

    it('should handle DATA variable with initial value', () => {
      module.createGlobal('magic', IL_BYTE, ILStorageClass.Data, { initialValue: 0x42 });
      generator.exposeGenerateGlobals();

      const alloc = generator.exposeRamAllocations().get('magic');
      expect(alloc).toBeDefined();
      expect(alloc!.initialValue).toBe(0x42);
    });

    it('should handle DATA word variable with initial value', () => {
      module.createGlobal('address', IL_WORD, ILStorageClass.Data, { initialValue: 0xD020 });
      generator.exposeGenerateGlobals();

      const alloc = generator.exposeRamAllocations().get('address');
      expect(alloc).toBeDefined();
      expect(alloc!.initialValue).toBe(0xD020);
      expect(alloc!.size).toBe(2);
    });
  });

  // ===========================================================================
  // Initial Value Tests
  // ===========================================================================

  describe('initial values', () => {
    it('should store single byte initial value', () => {
      module.createGlobal('value', IL_BYTE, ILStorageClass.Ram, { initialValue: 0xFF });
      generator.exposeGenerateGlobals();

      const alloc = generator.exposeRamAllocations().get('value');
      expect(alloc!.initialValue).toBe(0xFF);
    });

    it('should store array initial value', () => {
      module.createGlobal('data', IL_BYTE, ILStorageClass.Data, { initialValue: [1, 2, 3, 4] });
      generator.exposeGenerateGlobals();

      const alloc = generator.exposeRamAllocations().get('data');
      expect(alloc!.initialValue).toEqual([1, 2, 3, 4]);
    });

    it('should handle uninitialized RAM variable', () => {
      module.createGlobal('uninit', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const alloc = generator.exposeRamAllocations().get('uninit');
      expect(alloc!.initialValue).toBeUndefined();
    });
  });

  // ===========================================================================
  // Label Lookup Tests
  // ===========================================================================

  describe('label lookup', () => {
    it('should lookup RAM variable label', () => {
      module.createGlobal('buffer', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const label = generator.exposeLookupGlobalLabel('buffer');
      expect(label).toBe('_buffer');
    });

    it('should lookup DATA variable label', () => {
      module.createGlobal('constant', IL_BYTE, ILStorageClass.Data);
      generator.exposeGenerateGlobals();

      const label = generator.exposeLookupGlobalLabel('constant');
      expect(label).toBe('_constant');
    });

    it('should return undefined for non-existent variable', () => {
      const label = generator.exposeLookupGlobalLabel('nonExistent');
      expect(label).toBeUndefined();
    });

    it('should return undefined when looking up address for RAM variable', () => {
      // RAM variables don't have fixed addresses - they use labels
      module.createGlobal('buffer', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const address = generator.exposeLookupGlobalAddress('buffer');
      expect(address).toBeUndefined();
    });
  });

  // ===========================================================================
  // Assembly Output Tests
  // ===========================================================================

  describe('assembly output', () => {
    it('should emit section comment for data section', () => {
      module.createGlobal('buffer', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('Data Section');
    });

    it('should emit label for RAM variable', () => {
      module.createGlobal('buffer', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('_buffer');
    });

    it('should emit bytes directive for uninitialized byte', () => {
      module.createGlobal('uninit', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const output = generator.exposeAssemblyWriter().toString();
      // Should emit zero fill or byte 0
      expect(output).toMatch(/(!byte|!8|\.byte|\$00)/i);
    });

    it('should emit initial value for initialized byte', () => {
      module.createGlobal('value', IL_BYTE, ILStorageClass.Data, { initialValue: 0x42 });
      generator.exposeGenerateGlobals();

      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('$42');
    });

    it('should emit word value for initialized word', () => {
      module.createGlobal('addr', IL_WORD, ILStorageClass.Data, { initialValue: 0xD020 });
      generator.exposeGenerateGlobals();

      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('$D020');
    });

    it('should emit array values', () => {
      module.createGlobal('table', IL_BYTE, ILStorageClass.Data, { initialValue: [0x10, 0x20, 0x30] });
      generator.exposeGenerateGlobals();

      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toContain('$10');
      expect(output).toContain('$20');
      expect(output).toContain('$30');
    });
  });

  // ===========================================================================
  // Mixed Storage Class Tests
  // ===========================================================================

  describe('mixed storage classes', () => {
    it('should handle mix of RAM and DATA variables', () => {
      module.createGlobal('ramVar', IL_BYTE, ILStorageClass.Ram);
      module.createGlobal('dataVar', IL_BYTE, ILStorageClass.Data, { initialValue: 0x42 });
      generator.exposeGenerateGlobals();

      expect(generator.exposeRamAllocations().size).toBe(2);
      
      const ramAlloc = generator.exposeRamAllocations().get('ramVar');
      const dataAlloc = generator.exposeRamAllocations().get('dataVar');
      
      expect(ramAlloc!.initialValue).toBeUndefined();
      expect(dataAlloc!.initialValue).toBe(0x42);
    });
  });
});