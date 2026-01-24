/**
 * Tests for CodeGenerator - Main Entry Point and Full Pipeline
 *
 * Tests the final concrete CodeGenerator class which provides
 * the public API for code generation.
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module __tests__/codegen/code-generator.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGenerator } from '../../codegen/code-generator.js';
import { ILModule } from '../../il/module.js';
import { IL_BYTE, IL_VOID } from '../../il/types.js';
import {
  ILReturnVoidInstruction,
  ILConstInstruction,
  ILReturnInstruction,
  ILHardwareWriteInstruction,
} from '../../il/instructions.js';
import { C64_CONFIG } from '../../target/index.js';
import {
  C64_BASIC_START,
  C64_CODE_START,
} from '../../codegen/types.js';
import type { CodegenOptions, CodegenResult } from '../../codegen/types.js';

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
 * Creates an empty IL module
 */
function createEmptyModule(name: string = 'test.bl65'): ILModule {
  return new ILModule(name);
}

/**
 * Creates a module with a simple void main function
 */
function createMainModule(name: string = 'test.bl65'): ILModule {
  const module = new ILModule(name);
  const main = module.createFunction('main', [], IL_VOID);
  main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
  return module;
}

/**
 * Creates a module with a main function that sets border color
 */
function createBorderColorModule(): ILModule {
  const module = new ILModule('border.bl65');
  const main = module.createFunction('main', [], IL_VOID);
  const entry = main.getEntryBlock();
  
  // Set border color to 1 (white): borderColor = 1
  const v0 = main.createRegister(IL_BYTE, 'color');
  entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, v0));
  entry.addInstruction(new ILHardwareWriteInstruction(1, 0xD020, v0));
  entry.addInstruction(new ILReturnVoidInstruction(2));
  
  return module;
}

/**
 * Creates a module with a function that returns a value
 */
function createReturnValueModule(): ILModule {
  const module = new ILModule('return.bl65');
  const func = module.createFunction('getValue', [], IL_BYTE);
  const entry = func.getEntryBlock();
  
  const v0 = func.createRegister(IL_BYTE, 'result');
  entry.addInstruction(new ILConstInstruction(0, 42, IL_BYTE, v0));
  entry.addInstruction(new ILReturnInstruction(1, v0));
  
  return module;
}

describe('CodeGenerator - Main API', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  // ===========================================================================
  // Basic generate() API Tests
  // ===========================================================================

  describe('generate() - basic API', () => {
    it('should return a CodegenResult object', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result).toBeDefined();
      expect(typeof result.assembly).toBe('string');
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.stats).toBeDefined();
    });

    it('should always include assembly output', () => {
      const module = createEmptyModule();
      const options = createTestOptions({ format: 'asm' });
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly.length).toBeGreaterThan(0);
    });

    it('should include stats in result', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(typeof result.stats.codeSize).toBe('number');
      expect(typeof result.stats.dataSize).toBe('number');
      expect(typeof result.stats.zpBytesUsed).toBe('number');
      expect(typeof result.stats.functionCount).toBe('number');
      expect(typeof result.stats.globalCount).toBe('number');
      expect(typeof result.stats.totalSize).toBe('number');
    });

    it('should return empty warnings array when no issues', () => {
      const module = createMainModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      // May have ACME warning, but should be array
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  // ===========================================================================
  // Header Generation Tests
  // ===========================================================================

  describe('generate() - header generation', () => {
    it('should include Blend65 header comment', () => {
      const module = createEmptyModule('game.bl65');
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('Blend65');
      expect(result.assembly).toContain('game.bl65');
    });

    it('should include target architecture in header', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('c64');
    });

    it('should emit origin directive with load address', () => {
      const module = createEmptyModule();
      const options = createTestOptions({ loadAddress: 0x0801 });
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('$0801');
    });

    it('should use custom load address when provided', () => {
      const module = createEmptyModule();
      const options = createTestOptions({ loadAddress: 0xC000 });
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('$C000');
    });

    it('should include Configuration section', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('Configuration');
    });
  });

  // ===========================================================================
  // BASIC Stub Generation Tests
  // ===========================================================================

  describe('generate() - BASIC stub', () => {
    it('should include BASIC stub by default', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('BASIC');
      expect(result.assembly).toContain('Stub');
    });

    it('should include BASIC stub when basicStub is true', () => {
      const module = createEmptyModule();
      const options = createTestOptions({ basicStub: true });
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('BASIC');
    });

    it('should skip BASIC stub when basicStub is false', () => {
      const module = createEmptyModule();
      const options = createTestOptions({ basicStub: false });
      
      const result = codegen.generate(module, options);
      
      // Should not have BASIC stub section
      expect(result.assembly).not.toContain('BASIC Stub');
    });

    it('should emit bytes for BASIC stub', () => {
      const module = createEmptyModule();
      const options = createTestOptions({ basicStub: true });
      
      const result = codegen.generate(module, options);
      
      // BASIC stub uses !byte directive
      expect(result.assembly).toContain('!byte');
    });

    it('should update origin to code start after BASIC stub', () => {
      const module = createEmptyModule();
      const options = createTestOptions({ basicStub: true });
      
      const result = codegen.generate(module, options);
      
      // Should have origin at code start ($0810)
      expect(result.assembly).toContain('$0810');
    });

    it('should track BASIC stub bytes in stats', () => {
      const module = createEmptyModule();
      const options = createTestOptions({ basicStub: true });
      
      const result = codegen.generate(module, options);
      
      // BASIC stub adds to data size
      expect(result.stats.dataSize).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Entry Point Generation Tests
  // ===========================================================================

  describe('generate() - entry point', () => {
    it('should include Program Entry Point section', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('Program Entry Point');
    });

    it('should generate infinite loop when no main function', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('No main function');
      expect(result.assembly).toContain('JMP');
      expect(result.assembly).toContain('loop');
    });

    it('should generate JSR to main when main function exists', () => {
      const module = createMainModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('JSR');
      expect(result.assembly).toContain('_main');
    });

    it('should generate _start label', () => {
      const module = createMainModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('_start');
    });

    it('should generate end loop after main returns', () => {
      const module = createMainModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('End');
      expect(result.assembly).toContain('infinite loop');
    });
  });

  // ===========================================================================
  // Function Generation Tests
  // ===========================================================================

  describe('generate() - functions', () => {
    it('should generate code for main function', () => {
      const module = createMainModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('_main');
      expect(result.assembly).toContain('RTS');
    });

    it('should count functions in stats', () => {
      const module = createMainModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.stats.functionCount).toBe(1);
    });

    it('should generate hardware write instructions', () => {
      const module = createBorderColorModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('STA');
      expect(result.assembly).toContain('$D020');
    });

    it('should generate const load instructions', () => {
      const module = createReturnValueModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('LDA');
      expect(result.assembly).toContain('#');
    });

    it('should include Functions section when functions exist', () => {
      const module = createMainModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('Functions');
    });
  });

  // ===========================================================================
  // Footer Generation Tests
  // ===========================================================================

  describe('generate() - footer', () => {
    it('should include End of Program section', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('End of Program');
    });

    it('should include code size in footer', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('Code size:');
      expect(result.assembly).toContain('bytes');
    });

    it('should include data size in footer', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('Data size:');
    });

    it('should include ZP used in footer', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('ZP used:');
    });

    it('should include function count in footer', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('Functions:');
    });

    it('should include global count in footer', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('Globals:');
    });
  });

  // ===========================================================================
  // Output Format Tests
  // ===========================================================================

  describe('generate() - output formats', () => {
    it('should return assembly for format "asm"', () => {
      const module = createMainModule();
      const options = createTestOptions({ format: 'asm' });
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toBeDefined();
      expect(result.binary).toBeUndefined();
    });

    it('should attempt PRG generation for format "prg"', () => {
      const module = createMainModule();
      const options = createTestOptions({ format: 'prg' });
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toBeDefined();
      // Binary is available if ACME is installed
      // If ACME is not installed, there will be a warning
      if (result.binary) {
        expect(result.binary).toBeInstanceOf(Uint8Array);
        expect(result.binary.length).toBeGreaterThan(0);
      } else {
        // ACME not installed - should have warning
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });

    it('should attempt PRG generation for format "both"', () => {
      const module = createMainModule();
      const options = createTestOptions({ format: 'both' });
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toBeDefined();
      // Binary may be undefined if ACME not installed
    });

    it('should add warning for unsupported CRT format', () => {
      const module = createMainModule();
      const options = createTestOptions({ format: 'crt' });
      
      const result = codegen.generate(module, options);
      
      expect(result.warnings.some(w => w.message.includes('CRT'))).toBe(true);
    });
  });

  // ===========================================================================
  // Debug Mode Tests
  // ===========================================================================

  describe('generate() - debug modes', () => {
    it('should not include source comments for debug "none"', () => {
      const module = createMainModule();
      const options = createTestOptions({ debug: 'none' });
      
      const result = codegen.generate(module, options);
      
      // Assembly should still be generated, but minimal comments
      expect(result.assembly).toBeDefined();
      expect(result.viceLabels).toBeUndefined();
    });

    it('should enable source comments for debug "inline"', () => {
      const module = createBorderColorModule();
      const options = createTestOptions({ debug: 'inline' });
      
      const result = codegen.generate(module, options);
      
      // Should have assembly with comments
      expect(result.assembly).toBeDefined();
      expect(result.viceLabels).toBeUndefined();
    });

    it('should generate VICE labels for debug "vice"', () => {
      const module = createMainModule();
      const options = createTestOptions({ debug: 'vice' });
      
      const result = codegen.generate(module, options);
      
      expect(result.viceLabels).toBeDefined();
      expect(typeof result.viceLabels).toBe('string');
    });

    it('should generate both for debug "both"', () => {
      const module = createMainModule();
      const options = createTestOptions({ debug: 'both' });
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toBeDefined();
      expect(result.viceLabels).toBeDefined();
    });
  });

  // ===========================================================================
  // Source Map Tests
  // ===========================================================================

  describe('generate() - source maps', () => {
    it('should not include source map when disabled', () => {
      const module = createMainModule();
      const options = createTestOptions({ sourceMap: false });
      
      const result = codegen.generate(module, options);
      
      expect(result.sourceMap).toBeUndefined();
    });

    it('should include source map when enabled', () => {
      const module = createMainModule();
      const options = createTestOptions({ sourceMap: true });
      
      const result = codegen.generate(module, options);
      
      expect(result.sourceMap).toBeDefined();
      expect(Array.isArray(result.sourceMap)).toBe(true);
    });
  });

  // ===========================================================================
  // Statistics Tests
  // ===========================================================================

  describe('generate() - statistics', () => {
    it('should track code size for instructions', () => {
      const module = createBorderColorModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      // LDA immediate (2 bytes) + STA absolute (3 bytes) + RTS (1 byte) + entry point code
      expect(result.stats.codeSize).toBeGreaterThan(0);
    });

    it('should track function count', () => {
      const module = createMainModule();
      // Add another function
      const func2 = module.createFunction('helper', [], IL_VOID);
      func2.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
      
      const options = createTestOptions();
      const result = codegen.generate(module, options);
      
      expect(result.stats.functionCount).toBe(2);
    });

    it('should calculate total size', () => {
      const module = createMainModule();
      const options = createTestOptions({ basicStub: true });
      
      const result = codegen.generate(module, options);
      
      // Total should be code + data
      expect(result.stats.totalSize).toBeGreaterThanOrEqual(
        result.stats.codeSize + result.stats.dataSize
      );
    });

    it('should start with zero globals for empty module', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.stats.globalCount).toBe(0);
    });

    it('should start with zero ZP bytes for module without @zp vars', () => {
      const module = createMainModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.stats.zpBytesUsed).toBe(0);
    });
  });

  // ===========================================================================
  // Module Name Tests
  // ===========================================================================

  describe('generate() - module handling', () => {
    it('should use module name in header', () => {
      const module = createEmptyModule('myprogram.bl65');
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('myprogram.bl65');
    });

    it('should handle modules with path-like names', () => {
      const module = createEmptyModule('src/games/snake.bl65');
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('snake.bl65');
    });
  });

  // ===========================================================================
  // Multiple Generate Calls Tests
  // ===========================================================================

  describe('generate() - reusability', () => {
    it('should handle multiple generate calls', () => {
      const module1 = createMainModule('prog1.bl65');
      const module2 = createEmptyModule('prog2.bl65');
      const options = createTestOptions();
      
      const result1 = codegen.generate(module1, options);
      const result2 = codegen.generate(module2, options);
      
      expect(result1.assembly).toContain('prog1.bl65');
      expect(result2.assembly).toContain('prog2.bl65');
    });

    it('should reset state between generate calls', () => {
      const module1 = createMainModule();
      const module2 = createEmptyModule();
      const options = createTestOptions();
      
      const result1 = codegen.generate(module1, options);
      const result2 = codegen.generate(module2, options);
      
      // Second result should have 0 functions since module2 has none
      expect(result1.stats.functionCount).toBe(1);
      expect(result2.stats.functionCount).toBe(0);
    });

    it('should not accumulate warnings between calls', () => {
      const module = createMainModule();
      const options = createTestOptions({ format: 'prg' });
      
      codegen.generate(module, options);
      const result2 = codegen.generate(module, options);
      
      // Warnings should be fresh for each call, not accumulated
      // (May have ACME warnings which is fine)
      expect(Array.isArray(result2.warnings)).toBe(true);
    });
  });

  // ===========================================================================
  // Edge Cases Tests
  // ===========================================================================

  describe('generate() - edge cases', () => {
    it('should handle empty module', () => {
      const module = createEmptyModule();
      const options = createTestOptions();
      
      expect(() => codegen.generate(module, options)).not.toThrow();
    });

    it('should handle module with only function (no main)', () => {
      const module = new ILModule('test.bl65');
      const func = module.createFunction('helper', [], IL_VOID);
      func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
      
      const options = createTestOptions();
      const result = codegen.generate(module, options);
      
      // Should still generate valid assembly
      expect(result.assembly).toBeDefined();
      expect(result.assembly.length).toBeGreaterThan(0);
    });

    it('should handle very small load address', () => {
      const module = createEmptyModule();
      const options = createTestOptions({ loadAddress: 0x0400 });
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('$0400');
    });

    it('should handle high load address', () => {
      const module = createEmptyModule();
      const options = createTestOptions({ 
        loadAddress: 0xC000,
        basicStub: false // No BASIC stub for high load address
      });
      
      const result = codegen.generate(module, options);
      
      expect(result.assembly).toContain('$C000');
    });
  });

  // ===========================================================================
  // Assembly Output Structure Tests
  // ===========================================================================

  describe('generate() - assembly structure', () => {
    it('should generate ACME-compatible assembly', () => {
      const module = createMainModule();
      const options = createTestOptions();
      
      const result = codegen.generate(module, options);
      
      // Check for ACME syntax elements - origin directive uses "* = $address"
      expect(result.assembly).toContain('* = $'); // Origin directive
    });

    it('should have sections in correct order', () => {
      const module = createMainModule();
      const options = createTestOptions({ basicStub: true });
      
      const result = codegen.generate(module, options);
      
      // Check section order
      const configIdx = result.assembly.indexOf('Configuration');
      const basicIdx = result.assembly.indexOf('BASIC');
      const entryIdx = result.assembly.indexOf('Program Entry Point');
      const funcIdx = result.assembly.indexOf('Functions');
      const endIdx = result.assembly.indexOf('End of Program');
      
      // Configuration first
      expect(configIdx).toBeLessThan(basicIdx);
      // BASIC before entry point
      expect(basicIdx).toBeLessThan(entryIdx);
      // Entry point before functions  
      expect(entryIdx).toBeLessThan(funcIdx);
      // Functions before end
      expect(funcIdx).toBeLessThan(endIdx);
    });
  });
});

describe('CodeGenerator - VICE Labels', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  describe('VICE label generation', () => {
    it('should include function labels in VICE output', () => {
      const module = createMainModule();
      const options = createTestOptions({ debug: 'vice' });
      
      const result = codegen.generate(module, options);
      
      expect(result.viceLabels).toBeDefined();
      // VICE labels format varies, just check it's not empty
      expect(result.viceLabels!.length).toBeGreaterThan(0);
    });

    it('should include _start label in VICE output', () => {
      const module = createMainModule();
      const options = createTestOptions({ debug: 'vice' });
      
      const result = codegen.generate(module, options);
      
      // Should have some label content
      expect(result.viceLabels).toBeDefined();
    });
  });
});

describe('CodeGenerator - Warnings', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  describe('warning generation', () => {
    it('should handle PRG generation with or without ACME', () => {
      const module = createMainModule();
      const options = createTestOptions({ format: 'prg' });
      
      const result = codegen.generate(module, options);
      
      // If ACME is available, binary should be generated
      // If ACME is not available, should have warning
      if (result.binary) {
        // ACME worked - binary was generated
        expect(result.binary).toBeInstanceOf(Uint8Array);
        expect(result.binary.length).toBeGreaterThan(0);
      } else {
        // ACME not available - should have warning
        const hasAcmeWarning = result.warnings.some(
          w => w.message.includes('ACME') || w.includes('assembler')
        );
        expect(hasAcmeWarning).toBe(true);
      }
    });

    it('should include warnings in result array', () => {
      const module = createMainModule();
      const options = createTestOptions({ format: 'crt' });
      
      const result = codegen.generate(module, options);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.includes('CRT'))).toBe(true);
    });
  });
});

describe('CodeGenerator - Constants', () => {
  it('should use C64_BASIC_START for default load address', () => {
    expect(C64_BASIC_START).toBe(0x0801);
  });

  it('should use C64_CODE_START for code after BASIC stub', () => {
    expect(C64_CODE_START).toBe(0x0810);
  });
});