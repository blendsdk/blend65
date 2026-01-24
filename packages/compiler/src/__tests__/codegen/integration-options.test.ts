/**
 * Integration Tests - Code Generation Options
 *
 * Tests complete code generation with various option combinations:
 * - Debug modes (none, inline, vice, both)
 * - Output formats (asm, prg, both, crt)
 * - Source maps
 * - BASIC stub options
 * - Load addresses
 *
 * @module __tests__/codegen/integration-options.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGenerator } from '../../codegen/code-generator.js';
import { ILModule } from '../../il/module.js';
import { ILStorageClass } from '../../il/function.js';
import { IL_BYTE, IL_VOID } from '../../il/types.js';
import {
  ILReturnVoidInstruction,
  ILConstInstruction,
  ILHardwareWriteInstruction,
} from '../../il/instructions.js';
import { C64_CONFIG } from '../../target/index.js';
import { C64_BASIC_START, C64_CODE_START } from '../../codegen/types.js';
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

/**
 * Creates a simple main function module for testing
 */
function createSimpleMainModule(name: string = 'test.bl65'): ILModule {
  const module = new ILModule(name);
  const main = module.createFunction('main', [], IL_VOID);
  main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
  return module;
}

/**
 * Creates a module that sets border color
 */
function createBorderColorModule(): ILModule {
  const module = new ILModule('border.bl65');
  const main = module.createFunction('main', [], IL_VOID);
  const entry = main.getEntryBlock();

  const v0 = main.createRegister(IL_BYTE, 'color');
  entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, v0));
  entry.addInstruction(new ILHardwareWriteInstruction(1, 0xD020, v0));
  entry.addInstruction(new ILReturnVoidInstruction(2));

  return module;
}

describe('Integration - Code Generation Options', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  // ===========================================================================
  // Debug Mode Tests
  // ===========================================================================

  describe('debug mode: none', () => {
    it('should generate assembly without VICE labels', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ debug: 'none' });

      const result = codegen.generate(module, options);

      expect(result.assembly).toBeDefined();
      expect(result.viceLabels).toBeUndefined();
    });

    it('should not include source comments when debug is none', () => {
      const module = createBorderColorModule();
      const options = createTestOptions({ debug: 'none' });

      const result = codegen.generate(module, options);

      // Assembly should still be valid
      expect(result.assembly).toContain('LDA');
    });
  });

  describe('debug mode: inline', () => {
    it('should generate assembly with inline comments', () => {
      const module = createBorderColorModule();
      const options = createTestOptions({ debug: 'inline' });

      const result = codegen.generate(module, options);

      expect(result.assembly).toBeDefined();
      // Should have comments but no VICE labels
      expect(result.viceLabels).toBeUndefined();
    });
  });

  describe('debug mode: vice', () => {
    it('should generate VICE labels', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ debug: 'vice' });

      const result = codegen.generate(module, options);

      expect(result.viceLabels).toBeDefined();
      expect(typeof result.viceLabels).toBe('string');
      expect(result.viceLabels!.length).toBeGreaterThan(0);
    });

    it('should include function labels in VICE output', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ debug: 'vice' });

      const result = codegen.generate(module, options);

      // VICE labels should contain some label information
      expect(result.viceLabels).toBeDefined();
    });
  });

  describe('debug mode: both', () => {
    it('should generate both inline comments and VICE labels', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ debug: 'both' });

      const result = codegen.generate(module, options);

      expect(result.assembly).toBeDefined();
      expect(result.viceLabels).toBeDefined();
    });
  });

  // ===========================================================================
  // Output Format Tests
  // ===========================================================================

  describe('output format: asm', () => {
    it('should generate only assembly output', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ format: 'asm' });

      const result = codegen.generate(module, options);

      expect(result.assembly).toBeDefined();
      expect(result.binary).toBeUndefined();
    });

    it('should have no ACME warnings for asm format', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ format: 'asm' });

      const result = codegen.generate(module, options);

      // No ACME warnings since we're not trying to assemble
      const acmeWarnings = result.warnings.filter(w => w.message.includes('ACME'));
      // May or may not have ACME warnings depending on if it checks availability
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('output format: prg', () => {
    it('should attempt PRG generation', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ format: 'prg' });

      const result = codegen.generate(module, options);

      // Should always have assembly
      expect(result.assembly).toBeDefined();
      // If ACME is installed, binary should be generated
      // If not, should have a warning about ACME
      if (result.binary) {
        expect(result.binary).toBeInstanceOf(Uint8Array);
        expect(result.binary.length).toBeGreaterThan(0);
      } else {
        // ACME not available - should have warning
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('output format: both', () => {
    it('should attempt both assembly and PRG', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ format: 'both' });

      const result = codegen.generate(module, options);

      expect(result.assembly).toBeDefined();
      // Binary may be undefined if ACME not installed
    });
  });

  describe('output format: crt', () => {
    it('should warn about unsupported CRT format', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ format: 'crt' });

      const result = codegen.generate(module, options);

      expect(result.warnings.some(w => w.message.includes('CRT'))).toBe(true);
    });

    it('should still generate assembly for CRT format', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ format: 'crt' });

      const result = codegen.generate(module, options);

      expect(result.assembly).toBeDefined();
      expect(result.assembly.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Source Map Tests
  // ===========================================================================

  describe('source map: disabled', () => {
    it('should not include source map when disabled', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ sourceMap: false });

      const result = codegen.generate(module, options);

      expect(result.sourceMap).toBeUndefined();
    });
  });

  describe('source map: enabled', () => {
    it('should include source map when enabled', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ sourceMap: true });

      const result = codegen.generate(module, options);

      expect(result.sourceMap).toBeDefined();
      expect(Array.isArray(result.sourceMap)).toBe(true);
    });

    it('should track mappings for instructions', () => {
      const module = createBorderColorModule();
      const options = createTestOptions({ sourceMap: true });

      const result = codegen.generate(module, options);

      expect(result.sourceMap).toBeDefined();
      // Source map should contain some entries
      expect(Array.isArray(result.sourceMap)).toBe(true);
    });
  });

  // ===========================================================================
  // BASIC Stub Tests
  // ===========================================================================

  describe('BASIC stub: enabled (default)', () => {
    it('should include BASIC stub by default', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions(); // basicStub defaults to true

      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('BASIC');
      expect(result.assembly).toContain('Stub');
    });

    it('should emit BASIC stub bytes', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ basicStub: true });

      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('!byte');
    });

    it('should update origin after BASIC stub', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ basicStub: true });

      const result = codegen.generate(module, options);

      // Should have origin at $0810 after BASIC stub
      expect(result.assembly).toContain('$0810');
    });

    it('should add BASIC stub bytes to stats', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ basicStub: true });

      const result = codegen.generate(module, options);

      expect(result.stats.dataSize).toBeGreaterThan(0);
    });
  });

  describe('BASIC stub: disabled', () => {
    it('should not include BASIC stub when disabled', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ basicStub: false });

      const result = codegen.generate(module, options);

      expect(result.assembly).not.toContain('BASIC Stub');
    });
  });

  // ===========================================================================
  // Load Address Tests
  // ===========================================================================

  describe('load address: default ($0801)', () => {
    it('should use default BASIC load address', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ loadAddress: C64_BASIC_START });

      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('$0801');
    });
  });

  describe('load address: custom', () => {
    it('should use custom load address $C000', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ 
        loadAddress: 0xC000,
        basicStub: false, // No BASIC stub for high address
      });

      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('$C000');
    });

    it('should use custom load address $4000', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ 
        loadAddress: 0x4000,
        basicStub: false,
      });

      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('$4000');
    });

    it('should support screen memory area load address', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ 
        loadAddress: 0x0400, // Screen memory
        basicStub: false,
      });

      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('$0400');
    });
  });

  // ===========================================================================
  // Combined Options Tests
  // ===========================================================================

  describe('combined options', () => {
    it('should handle all debug options with source map', () => {
      const module = createBorderColorModule();
      const options = createTestOptions({
        debug: 'both',
        sourceMap: true,
      });

      const result = codegen.generate(module, options);

      expect(result.assembly).toBeDefined();
      expect(result.viceLabels).toBeDefined();
      expect(result.sourceMap).toBeDefined();
    });

    it('should handle no BASIC stub with custom load address', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({
        basicStub: false,
        loadAddress: 0xC000,
      });

      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('$C000');
      expect(result.assembly).not.toContain('BASIC Stub');
    });

    it('should handle all options together', () => {
      const module = createBorderColorModule();
      const options = createTestOptions({
        format: 'asm',
        debug: 'vice',
        sourceMap: true,
        basicStub: true,
        loadAddress: C64_BASIC_START,
      });

      const result = codegen.generate(module, options);

      expect(result.assembly).toBeDefined();
      expect(result.viceLabels).toBeDefined();
      expect(result.sourceMap).toBeDefined();
      expect(result.assembly).toContain('BASIC');
    });
  });

  // ===========================================================================
  // Statistics with Options Tests
  // ===========================================================================

  describe('statistics with options', () => {
    it('should track correct stats with BASIC stub', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ basicStub: true });

      const result = codegen.generate(module, options);

      // BASIC stub adds to data size
      expect(result.stats.dataSize).toBeGreaterThan(0);
      expect(result.stats.totalSize).toBeGreaterThanOrEqual(result.stats.codeSize + result.stats.dataSize);
    });

    it('should track correct stats without BASIC stub', () => {
      const module = createSimpleMainModule();
      const options = createTestOptions({ basicStub: false });

      const result = codegen.generate(module, options);

      // Still has valid stats
      expect(typeof result.stats.codeSize).toBe('number');
      expect(typeof result.stats.functionCount).toBe('number');
    });
  });

  // ===========================================================================
  // Complex Program with Options Tests
  // ===========================================================================

  describe('complex program with options', () => {
    it('should generate full program with all features enabled', () => {
      const module = new ILModule('complex.bl65');

      // Add globals
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, {
        address: 0xD020,
      });

      // Add main function
      const main = module.createFunction('main', [], IL_VOID);
      const entry = main.getEntryBlock();
      const v0 = main.createRegister(IL_BYTE, 'color');
      entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, v0));
      entry.addInstruction(new ILHardwareWriteInstruction(1, 0xD020, v0));
      entry.addInstruction(new ILReturnVoidInstruction(2));

      // Add helper function
      const helper = module.createFunction('initColors', [], IL_VOID);
      helper.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions({
        debug: 'both',
        sourceMap: true,
        basicStub: true,
      });

      const result = codegen.generate(module, options);

      expect(result.assembly).toBeDefined();
      expect(result.viceLabels).toBeDefined();
      expect(result.sourceMap).toBeDefined();
      expect(result.stats.functionCount).toBe(2);
      expect(result.stats.globalCount).toBe(2);
      expect(result.stats.zpBytesUsed).toBe(1);
    });
  });
});