/**
 * Tests for GlobalsGenerator - Setup and Initialization
 *
 * Tests the basic setup and state management of GlobalsGenerator.
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module __tests__/codegen/globals-generator-setup.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GlobalsGenerator, ZP_RESERVED } from '../../codegen/globals-generator.js';
import { ILModule } from '../../il/module.js';
import { ILStorageClass } from '../../il/function.js';
import { IL_BYTE, IL_WORD } from '../../il/types.js';
import { C64_CONFIG } from '../../target/index.js';
import type { CodegenOptions } from '../../codegen/types.js';

/**
 * Concrete test implementation of GlobalsGenerator
 *
 * GlobalsGenerator is abstract, so we need a concrete class
 * to test its protected methods.
 */
class TestGlobalsGenerator extends GlobalsGenerator {
  // Expose protected properties for testing

  public exposeNextZpAddress(): number {
    return this.nextZpAddress;
  }

  public exposeZpAllocations(): Map<string, { name: string; address: number; size: number }> {
    return this.zpAllocations;
  }

  public exposeRamAllocations(): Map<string, { name: string; label: string; size: number; initialValue?: number | number[] }> {
    return this.ramAllocations;
  }

  public exposeMapAddresses(): Map<string, number> {
    return this.mapAddresses;
  }

  // Expose protected methods for testing

  public exposeResetState(): void {
    this.resetState();
  }

  public exposeGenerateGlobals(): void {
    this.generateGlobals();
  }

  public exposeLookupGlobalAddress(name: string): { address: number; isZeroPage: boolean } | undefined {
    return this.lookupGlobalAddress(name);
  }

  public exposeLookupGlobalLabel(name: string): string | undefined {
    return this.lookupGlobalLabel(name);
  }

  public exposeGetTypeSize(type: { kind: string; size?: number }): number {
    return this.getTypeSize(type);
  }

  public exposeAssemblyWriter() {
    return this.assemblyWriter;
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

/**
 * Creates standard test options
 */
function createTestOptions(): CodegenOptions {
  return {
    target: C64_CONFIG,
    format: 'prg',
    sourceMap: false,
    debug: 'none',
    loadAddress: 0x0801,
  };
}

describe('GlobalsGenerator - Setup and Initialization', () => {
  let generator: TestGlobalsGenerator;
  let module: ILModule;

  beforeEach(() => {
    generator = new TestGlobalsGenerator();
    module = new ILModule('test.bl65');
    generator.setModule(module);
    generator.setOptions(createTestOptions());
  });

  // ===========================================================================
  // Initial State Tests
  // ===========================================================================

  describe('initial state', () => {
    it('should start with nextZpAddress at USER_START (0x0A)', () => {
      expect(generator.exposeNextZpAddress()).toBe(ZP_RESERVED.USER_START);
    });

    it('should start with empty zpAllocations', () => {
      expect(generator.exposeZpAllocations().size).toBe(0);
    });

    it('should start with empty ramAllocations', () => {
      expect(generator.exposeRamAllocations().size).toBe(0);
    });

    it('should start with empty mapAddresses', () => {
      expect(generator.exposeMapAddresses().size).toBe(0);
    });
  });

  // ===========================================================================
  // State Reset Tests
  // ===========================================================================

  describe('resetState()', () => {
    it('should reset nextZpAddress to USER_START (0x0A)', () => {
      // Add a global to modify state
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();
      expect(generator.exposeNextZpAddress()).toBeGreaterThan(ZP_RESERVED.USER_START);

      // Reset and verify
      generator.exposeResetState();
      expect(generator.exposeNextZpAddress()).toBe(ZP_RESERVED.USER_START);
    });

    it('should clear zpAllocations', () => {
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();
      expect(generator.exposeZpAllocations().size).toBe(1);

      generator.exposeResetState();
      expect(generator.exposeZpAllocations().size).toBe(0);
    });

    it('should clear ramAllocations', () => {
      module.createGlobal('buffer', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();
      expect(generator.exposeRamAllocations().size).toBe(1);

      generator.exposeResetState();
      expect(generator.exposeRamAllocations().size).toBe(0);
    });

    it('should clear mapAddresses', () => {
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, { address: 0xD020 });
      generator.exposeGenerateGlobals();
      expect(generator.exposeMapAddresses().size).toBe(1);

      generator.exposeResetState();
      expect(generator.exposeMapAddresses().size).toBe(0);
    });
  });

  // ===========================================================================
  // Empty Module Tests
  // ===========================================================================

  describe('empty module handling', () => {
    it('should handle module with no globals', () => {
      generator.exposeGenerateGlobals();
      
      expect(generator.exposeZpAllocations().size).toBe(0);
      expect(generator.exposeRamAllocations().size).toBe(0);
      expect(generator.exposeMapAddresses().size).toBe(0);
    });

    it('should not emit any output for empty module', () => {
      generator.exposeGenerateGlobals();
      
      const output = generator.exposeAssemblyWriter().toString();
      expect(output).toBe('');
    });
  });
});