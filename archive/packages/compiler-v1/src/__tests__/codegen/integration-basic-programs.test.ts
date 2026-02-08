/**
 * Integration Tests - Basic Programs
 *
 * Tests complete code generation for simple programs:
 * - Empty programs
 * - Main function programs
 * - Programs with simple instructions
 *
 * @module __tests__/codegen/integration-basic-programs.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGenerator } from '../../codegen/code-generator.js';
import { ILModule } from '../../il/module.js';
import { IL_BYTE, IL_VOID } from '../../il/types.js';
import {
  ILReturnVoidInstruction,
  ILConstInstruction,
  ILHardwareWriteInstruction,
  ILReturnInstruction,
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

describe('Integration - Basic Programs', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  // ===========================================================================
  // Empty Program Tests
  // ===========================================================================

  describe('empty program', () => {
    it('should generate valid assembly for empty module', () => {
      const module = new ILModule('empty.bl65');
      const options = createTestOptions();

      const result = codegen.generate(module, options);

      expect(result.assembly).toBeDefined();
      expect(result.assembly.length).toBeGreaterThan(0);
      expect(result.assembly).toContain('Blend65');
    });

    it('should return to BASIC when no main function', () => {
      const module = new ILModule('empty.bl65');
      const options = createTestOptions();

      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('No main function');
      expect(result.assembly).toContain('RTS');
      expect(result.assembly).toContain('Return to BASIC');
    });

    it('should report 0 functions in stats', () => {
      const module = new ILModule('empty.bl65');
      const options = createTestOptions();

      const result = codegen.generate(module, options);

      expect(result.stats.functionCount).toBe(0);
    });

    it('should report 0 globals in stats', () => {
      const module = new ILModule('empty.bl65');
      const options = createTestOptions();

      const result = codegen.generate(module, options);

      expect(result.stats.globalCount).toBe(0);
    });
  });

  // ===========================================================================
  // Simple Main Function Tests
  // ===========================================================================

  describe('simple main function', () => {
    it('should generate call to main function', () => {
      const module = new ILModule('simple.bl65');
      const main = module.createFunction('main', [], IL_VOID);
      main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('JSR');
      expect(result.assembly).toContain('_main');
    });

    it('should generate function label', () => {
      const module = new ILModule('simple.bl65');
      const main = module.createFunction('main', [], IL_VOID);
      main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('_main');
    });

    it('should generate RTS at end of main', () => {
      const module = new ILModule('simple.bl65');
      const main = module.createFunction('main', [], IL_VOID);
      main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('RTS');
    });

    it('should report 1 function in stats', () => {
      const module = new ILModule('simple.bl65');
      const main = module.createFunction('main', [], IL_VOID);
      main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.functionCount).toBe(1);
    });
  });

  // ===========================================================================
  // Main with Constant Return Tests
  // ===========================================================================

  describe('main returning constant', () => {
    it('should generate code for function returning constant', () => {
      const module = new ILModule('return.bl65');
      const main = module.createFunction('getValue', [], IL_BYTE);
      const entry = main.getEntryBlock();

      const v0 = main.createRegister(IL_BYTE, 'result');
      entry.addInstruction(new ILConstInstruction(0, 42, IL_BYTE, v0));
      entry.addInstruction(new ILReturnInstruction(1, v0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('LDA');
      expect(result.assembly).toContain('#$2A'); // 42 in hex
      expect(result.assembly).toContain('RTS');
    });

    it('should generate code for returning zero', () => {
      const module = new ILModule('return-zero.bl65');
      const main = module.createFunction('getZero', [], IL_BYTE);
      const entry = main.getEntryBlock();

      const v0 = main.createRegister(IL_BYTE, 'result');
      entry.addInstruction(new ILConstInstruction(0, 0, IL_BYTE, v0));
      entry.addInstruction(new ILReturnInstruction(1, v0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('LDA');
      expect(result.assembly).toContain('#$00');
    });

    it('should generate code for returning max byte value', () => {
      const module = new ILModule('return-max.bl65');
      const main = module.createFunction('getMax', [], IL_BYTE);
      const entry = main.getEntryBlock();

      const v0 = main.createRegister(IL_BYTE, 'result');
      entry.addInstruction(new ILConstInstruction(0, 255, IL_BYTE, v0));
      entry.addInstruction(new ILReturnInstruction(1, v0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('#$FF');
    });
  });

  // ===========================================================================
  // Border Color Change Program Tests
  // ===========================================================================

  describe('border color program', () => {
    /**
     * Creates a program that sets the border color
     * Equivalent to: borderColor = 1
     */
    function createBorderColorProgram(): ILModule {
      const module = new ILModule('border.bl65');
      const main = module.createFunction('main', [], IL_VOID);
      const entry = main.getEntryBlock();

      // LDA #$01
      const v0 = main.createRegister(IL_BYTE, 'color');
      entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, v0));
      // STA $D020
      entry.addInstruction(new ILHardwareWriteInstruction(1, 0xD020, v0));
      // RTS
      entry.addInstruction(new ILReturnVoidInstruction(2));

      return module;
    }

    it('should generate border color change code', () => {
      const module = createBorderColorProgram();
      const options = createTestOptions();

      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('LDA');
      expect(result.assembly).toContain('#$01');
      expect(result.assembly).toContain('STA');
      expect(result.assembly).toContain('$D020');
    });

    it('should have correct instruction order', () => {
      const module = createBorderColorProgram();
      const options = createTestOptions();

      const result = codegen.generate(module, options);

      // LDA should appear before STA
      const ldaIndex = result.assembly.indexOf('LDA');
      const staIndex = result.assembly.indexOf('STA');
      expect(ldaIndex).toBeLessThan(staIndex);
    });

    it('should track code size correctly', () => {
      const module = createBorderColorProgram();
      const options = createTestOptions();

      const result = codegen.generate(module, options);

      // LDA immediate (2 bytes) + STA absolute (3 bytes) + RTS (1 byte)
      // Plus entry point code (JSR + JMP)
      expect(result.stats.codeSize).toBeGreaterThanOrEqual(6);
    });
  });

  // ===========================================================================
  // Background Color Change Program Tests
  // ===========================================================================

  describe('background color program', () => {
    it('should generate background color change code', () => {
      const module = new ILModule('background.bl65');
      const main = module.createFunction('main', [], IL_VOID);
      const entry = main.getEntryBlock();

      const v0 = main.createRegister(IL_BYTE, 'color');
      entry.addInstruction(new ILConstInstruction(0, 6, IL_BYTE, v0)); // Blue
      entry.addInstruction(new ILHardwareWriteInstruction(1, 0xD021, v0));
      entry.addInstruction(new ILReturnVoidInstruction(2));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('#$06');
      expect(result.assembly).toContain('$D021');
    });
  });

  // ===========================================================================
  // Multiple Hardware Writes Tests
  // ===========================================================================

  describe('multiple hardware writes', () => {
    it('should generate code for setting both border and background', () => {
      const module = new ILModule('colors.bl65');
      const main = module.createFunction('main', [], IL_VOID);
      const entry = main.getEntryBlock();

      // Set border to white (1)
      const v0 = main.createRegister(IL_BYTE, 'borderColor');
      entry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, v0));
      entry.addInstruction(new ILHardwareWriteInstruction(1, 0xD020, v0));

      // Set background to black (0)
      const v1 = main.createRegister(IL_BYTE, 'bgColor');
      entry.addInstruction(new ILConstInstruction(2, 0, IL_BYTE, v1));
      entry.addInstruction(new ILHardwareWriteInstruction(3, 0xD021, v1));

      entry.addInstruction(new ILReturnVoidInstruction(4));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('$D020');
      expect(result.assembly).toContain('$D021');
    });

    it('should generate sequential hardware writes correctly', () => {
      const module = new ILModule('multi-write.bl65');
      const main = module.createFunction('main', [], IL_VOID);
      const entry = main.getEntryBlock();

      // Write to 3 VIC registers
      for (let i = 0; i < 3; i++) {
        const reg = main.createRegister(IL_BYTE, `val${i}`);
        entry.addInstruction(new ILConstInstruction(i * 2, i, IL_BYTE, reg));
        entry.addInstruction(new ILHardwareWriteInstruction(i * 2 + 1, 0xD020 + i, reg));
      }
      entry.addInstruction(new ILReturnVoidInstruction(6));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('$D020');
      expect(result.assembly).toContain('$D021');
      expect(result.assembly).toContain('$D022');
    });
  });
});