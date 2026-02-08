/**
 * Tests for GlobalsGenerator - Zero Page Allocation
 *
 * Tests the zero-page (@zp) variable allocation functionality.
 * C64 safe ZP range: $02-$8F (142 bytes).
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module __tests__/codegen/globals-generator-zeropage.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAcmeEmitter } from '../../asm-il/emitters/index.js';
import { GlobalsGenerator, ZP_RESERVED } from '../../codegen/globals-generator.js';
import { ILModule } from '../../il/module.js';
import { ILStorageClass } from '../../il/function.js';
import { IL_BYTE, IL_WORD, IL_BOOL } from '../../il/types.js';
import { C64_CONFIG } from '../../target/index.js';
import type { CodegenOptions } from '../../codegen/types.js';

/**
 * Concrete test implementation of GlobalsGenerator
 */
class TestGlobalsGenerator extends GlobalsGenerator {
  public exposeNextZpAddress(): number {
    return this.nextZpAddress;
  }

  public exposeZpAllocations(): Map<string, { name: string; address: number; size: number }> {
    return this.zpAllocations;
  }

  public exposeGenerateGlobals(): void {
    this.generateGlobals();
  }

  public exposeLookupGlobalAddress(name: string): { address: number; isZeroPage: boolean } | undefined {
    return this.lookupGlobalAddress(name);
  }

  public getAssemblyOutput(): string {
    const asmModule = this.asmBuilder.build();
    const emitter = createAcmeEmitter();
    return emitter.emit(asmModule).text;
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

describe('GlobalsGenerator - Zero Page Allocation', () => {
  let generator: TestGlobalsGenerator;
  let module: ILModule;

  beforeEach(() => {
    generator = new TestGlobalsGenerator();
    module = new ILModule('test.bl65');
    generator.setModule(module);
    generator.setOptions(createTestOptions());
  });

  // ===========================================================================
  // Single Variable Allocation Tests
  // ===========================================================================

  describe('single variable allocation', () => {
    it('should allocate byte variable at USER_START (0x0A)', () => {
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const alloc = generator.exposeZpAllocations().get('counter');
      expect(alloc).toBeDefined();
      expect(alloc!.address).toBe(ZP_RESERVED.USER_START);
      expect(alloc!.size).toBe(1);
    });

    it('should allocate word variable at USER_START (0x0A)', () => {
      module.createGlobal('score', IL_WORD, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const alloc = generator.exposeZpAllocations().get('score');
      expect(alloc).toBeDefined();
      expect(alloc!.address).toBe(ZP_RESERVED.USER_START);
      expect(alloc!.size).toBe(2);
    });

    it('should allocate bool variable at USER_START (0x0A)', () => {
      module.createGlobal('gameRunning', IL_BOOL, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const alloc = generator.exposeZpAllocations().get('gameRunning');
      expect(alloc).toBeDefined();
      expect(alloc!.address).toBe(ZP_RESERVED.USER_START);
      expect(alloc!.size).toBe(1);
    });

    it('should advance nextZpAddress after allocation', () => {
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      expect(generator.exposeNextZpAddress()).toBe(ZP_RESERVED.USER_START + 1);
    });

    it('should advance nextZpAddress by 2 for word', () => {
      module.createGlobal('score', IL_WORD, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      expect(generator.exposeNextZpAddress()).toBe(ZP_RESERVED.USER_START + 2);
    });
  });

  // ===========================================================================
  // Multiple Variable Allocation Tests
  // ===========================================================================

  describe('multiple variable allocation', () => {
    it('should allocate multiple byte variables sequentially', () => {
      module.createGlobal('var1', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('var2', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('var3', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const alloc1 = generator.exposeZpAllocations().get('var1');
      const alloc2 = generator.exposeZpAllocations().get('var2');
      const alloc3 = generator.exposeZpAllocations().get('var3');

      expect(alloc1!.address).toBe(ZP_RESERVED.USER_START);
      expect(alloc2!.address).toBe(ZP_RESERVED.USER_START + 1);
      expect(alloc3!.address).toBe(ZP_RESERVED.USER_START + 2);
    });

    it('should allocate mixed byte and word variables correctly', () => {
      module.createGlobal('byteVar', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('wordVar', IL_WORD, ILStorageClass.ZeroPage);
      module.createGlobal('byteVar2', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const byteAlloc = generator.exposeZpAllocations().get('byteVar');
      const wordAlloc = generator.exposeZpAllocations().get('wordVar');
      const byte2Alloc = generator.exposeZpAllocations().get('byteVar2');

      expect(byteAlloc!.address).toBe(ZP_RESERVED.USER_START);
      expect(wordAlloc!.address).toBe(ZP_RESERVED.USER_START + 1);
      expect(byte2Alloc!.address).toBe(ZP_RESERVED.USER_START + 3);
    });

    it('should track total ZP bytes used', () => {
      module.createGlobal('byte1', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('word1', IL_WORD, ILStorageClass.ZeroPage);
      module.createGlobal('byte2', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const stats = generator.exposeGetStats();
      expect(stats.zpBytesUsed).toBe(4); // 1 + 2 + 1
    });

    it('should track global count for ZP variables', () => {
      module.createGlobal('var1', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('var2', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const stats = generator.exposeGetStats();
      expect(stats.globalCount).toBe(2);
    });
  });

  // ===========================================================================
  // Address Lookup Tests
  // ===========================================================================

  describe('address lookup', () => {
    it('should lookup ZP variable address', () => {
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const lookup = generator.exposeLookupGlobalAddress('counter');
      expect(lookup).toBeDefined();
      expect(lookup!.address).toBe(ZP_RESERVED.USER_START);
      expect(lookup!.isZeroPage).toBe(true);
    });

    it('should return undefined for non-existent variable', () => {
      generator.exposeGenerateGlobals();

      const lookup = generator.exposeLookupGlobalAddress('nonExistent');
      expect(lookup).toBeUndefined();
    });

    it('should lookup second ZP variable correctly', () => {
      module.createGlobal('first', IL_WORD, ILStorageClass.ZeroPage);
      module.createGlobal('second', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const lookup = generator.exposeLookupGlobalAddress('second');
      expect(lookup).toBeDefined();
      expect(lookup!.address).toBe(ZP_RESERVED.USER_START + 2); // USER_START + 2 (word size)
      expect(lookup!.isZeroPage).toBe(true);
    });
  });

  // ===========================================================================
  // Assembly Output Tests
  // ===========================================================================

  describe('assembly output', () => {
    it('should emit section comment for ZP variables', () => {
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const output = generator.getAssemblyOutput();
      expect(output).toContain('Zero Page');
    });

    it('should emit comment with variable name and address', () => {
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const output = generator.getAssemblyOutput();
      expect(output).toContain('counter');
      expect(output).toContain('$0A'); // USER_START = 0x0A
    });

    it('should include type information in comment', () => {
      module.createGlobal('score', IL_WORD, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const output = generator.getAssemblyOutput();
      expect(output).toContain('word');
    });
  });

  // ===========================================================================
  // Overflow Protection Tests
  // ===========================================================================

  describe('overflow protection', () => {
    it('should warn when ZP space is exhausted', () => {
      // Create enough variables to exceed ZP limit ($02-$8F = 142 bytes)
      // Create 143 byte variables to trigger overflow
      for (let i = 0; i < 143; i++) {
        module.createGlobal(`var${i}`, IL_BYTE, ILStorageClass.ZeroPage);
      }
      generator.exposeGenerateGlobals();

      const warnings = generator.exposeGetWarnings();
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.includes('overflow') || w.includes('cannot allocate'))).toBe(true);
    });

    it('should not allocate variable that exceeds ZP boundary', () => {
      // Fill ZP almost completely, then try to add a word
      for (let i = 0; i < 141; i++) {
        module.createGlobal(`byte${i}`, IL_BYTE, ILStorageClass.ZeroPage);
      }
      // At 0x91, only 1 byte left before 0x90
      module.createGlobal('finalWord', IL_WORD, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const alloc = generator.exposeZpAllocations().get('finalWord');
      // Should not be allocated because it would exceed boundary
      expect(alloc).toBeUndefined();
    });
  });
});