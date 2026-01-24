/**
 * Integration Tests - Multiple Functions
 *
 * Tests complete code generation for programs with multiple functions:
 * - Multiple function definitions
 * - Function call patterns
 * - Helper functions
 *
 * @module __tests__/codegen/integration-functions.test
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

describe('Integration - Multiple Functions', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  // ===========================================================================
  // Two Functions Tests
  // ===========================================================================

  describe('two functions', () => {
    it('should generate labels for both functions', () => {
      const module = new ILModule('two-funcs.bl65');

      // Main function
      const main = module.createFunction('main', [], IL_VOID);
      main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      // Helper function
      const helper = module.createFunction('helper', [], IL_VOID);
      helper.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('_main');
      expect(result.assembly).toContain('_helper');
    });

    it('should report correct function count', () => {
      const module = new ILModule('two-funcs.bl65');

      const main = module.createFunction('main', [], IL_VOID);
      main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const helper = module.createFunction('helper', [], IL_VOID);
      helper.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.stats.functionCount).toBe(2);
    });

    it('should generate RTS for both functions', () => {
      const module = new ILModule('two-funcs.bl65');

      const main = module.createFunction('main', [], IL_VOID);
      main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const helper = module.createFunction('helper', [], IL_VOID);
      helper.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      // Should have at least 2 RTS instructions
      const rtsCount = (result.assembly.match(/RTS/g) || []).length;
      expect(rtsCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ===========================================================================
  // Multiple Helper Functions Tests
  // ===========================================================================

  describe('multiple helper functions', () => {
    it('should generate code for 3 functions', () => {
      const module = new ILModule('three-funcs.bl65');

      const main = module.createFunction('main', [], IL_VOID);
      main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const init = module.createFunction('init', [], IL_VOID);
      init.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const update = module.createFunction('update', [], IL_VOID);
      update.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('_main');
      expect(result.assembly).toContain('_init');
      expect(result.assembly).toContain('_update');
      expect(result.stats.functionCount).toBe(3);
    });

    it('should generate code for 5 functions', () => {
      const module = new ILModule('five-funcs.bl65');
      const funcNames = ['main', 'init', 'update', 'render', 'cleanup'];

      for (const name of funcNames) {
        const func = module.createFunction(name, [], IL_VOID);
        func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
      }

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      for (const name of funcNames) {
        expect(result.assembly).toContain(`_${name}`);
      }
      expect(result.stats.functionCount).toBe(5);
    });
  });

  // ===========================================================================
  // Functions with Code Tests
  // ===========================================================================

  describe('functions with code', () => {
    it('should generate unique code for each function', () => {
      const module = new ILModule('funcs-code.bl65');

      // Main sets border to white (1)
      const main = module.createFunction('main', [], IL_VOID);
      const mainEntry = main.getEntryBlock();
      const v0 = main.createRegister(IL_BYTE, 'color');
      mainEntry.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, v0));
      mainEntry.addInstruction(new ILHardwareWriteInstruction(1, 0xD020, v0));
      mainEntry.addInstruction(new ILReturnVoidInstruction(2));

      // setBorder sets border to blue (6)
      const setBorder = module.createFunction('setBorder', [], IL_VOID);
      const borderEntry = setBorder.getEntryBlock();
      const v1 = setBorder.createRegister(IL_BYTE, 'color');
      borderEntry.addInstruction(new ILConstInstruction(0, 6, IL_BYTE, v1));
      borderEntry.addInstruction(new ILHardwareWriteInstruction(1, 0xD020, v1));
      borderEntry.addInstruction(new ILReturnVoidInstruction(2));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('#$01'); // white
      expect(result.assembly).toContain('#$06'); // blue
      expect(result.stats.functionCount).toBe(2);
    });

    it('should track code size across all functions', () => {
      const module = new ILModule('funcs-size.bl65');

      // Function with 3 instructions
      const func1 = module.createFunction('func1', [], IL_VOID);
      const entry1 = func1.getEntryBlock();
      const v0 = func1.createRegister(IL_BYTE, 'val');
      entry1.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, v0));
      entry1.addInstruction(new ILHardwareWriteInstruction(1, 0xD020, v0));
      entry1.addInstruction(new ILReturnVoidInstruction(2));

      // Function with 3 instructions
      const func2 = module.createFunction('func2', [], IL_VOID);
      const entry2 = func2.getEntryBlock();
      const v1 = func2.createRegister(IL_BYTE, 'val');
      entry2.addInstruction(new ILConstInstruction(0, 2, IL_BYTE, v1));
      entry2.addInstruction(new ILHardwareWriteInstruction(1, 0xD021, v1));
      entry2.addInstruction(new ILReturnVoidInstruction(2));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      // Each function: LDA (2) + STA (3) + RTS (1) = 6 bytes
      // Plus entry point code
      expect(result.stats.codeSize).toBeGreaterThanOrEqual(12);
    });
  });

  // ===========================================================================
  // Functions Returning Values Tests
  // ===========================================================================

  describe('functions returning values', () => {
    it('should generate code for function returning constant', () => {
      const module = new ILModule('return-func.bl65');

      const getMax = module.createFunction('getMax', [], IL_BYTE);
      const entry = getMax.getEntryBlock();
      const v0 = getMax.createRegister(IL_BYTE, 'result');
      entry.addInstruction(new ILConstInstruction(0, 255, IL_BYTE, v0));
      entry.addInstruction(new ILReturnInstruction(1, v0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('_getMax');
      expect(result.assembly).toContain('#$FF');
      expect(result.assembly).toContain('RTS');
    });

    it('should generate code for multiple return functions', () => {
      const module = new ILModule('multi-return.bl65');

      // getZero returns 0
      const getZero = module.createFunction('getZero', [], IL_BYTE);
      const entry0 = getZero.getEntryBlock();
      const v0 = getZero.createRegister(IL_BYTE, 'result');
      entry0.addInstruction(new ILConstInstruction(0, 0, IL_BYTE, v0));
      entry0.addInstruction(new ILReturnInstruction(1, v0));

      // getOne returns 1
      const getOne = module.createFunction('getOne', [], IL_BYTE);
      const entry1 = getOne.getEntryBlock();
      const v1 = getOne.createRegister(IL_BYTE, 'result');
      entry1.addInstruction(new ILConstInstruction(0, 1, IL_BYTE, v1));
      entry1.addInstruction(new ILReturnInstruction(1, v1));

      // getMax returns 255
      const getMax = module.createFunction('getMax', [], IL_BYTE);
      const entryMax = getMax.getEntryBlock();
      const vMax = getMax.createRegister(IL_BYTE, 'result');
      entryMax.addInstruction(new ILConstInstruction(0, 255, IL_BYTE, vMax));
      entryMax.addInstruction(new ILReturnInstruction(1, vMax));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('_getZero');
      expect(result.assembly).toContain('_getOne');
      expect(result.assembly).toContain('_getMax');
      expect(result.stats.functionCount).toBe(3);
    });
  });

  // ===========================================================================
  // No Main Function Tests
  // ===========================================================================

  describe('no main function', () => {
    it('should generate infinite loop when only helper functions', () => {
      const module = new ILModule('helpers-only.bl65');

      // Only helper functions, no main
      const helper1 = module.createFunction('helper1', [], IL_VOID);
      helper1.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const helper2 = module.createFunction('helper2', [], IL_VOID);
      helper2.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('No main function');
      expect(result.assembly).toContain('JMP');
      expect(result.stats.functionCount).toBe(2);
    });
  });

  // ===========================================================================
  // Game-like Structure Tests
  // ===========================================================================

  describe('game-like structure', () => {
    it('should generate code for typical game structure', () => {
      const module = new ILModule('game.bl65');

      // main - entry point
      const main = module.createFunction('main', [], IL_VOID);
      main.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      // initGame - initialization
      const initGame = module.createFunction('initGame', [], IL_VOID);
      const initEntry = initGame.getEntryBlock();
      const v0 = initGame.createRegister(IL_BYTE, 'color');
      initEntry.addInstruction(new ILConstInstruction(0, 0, IL_BYTE, v0));
      initEntry.addInstruction(new ILHardwareWriteInstruction(1, 0xD020, v0));
      initEntry.addInstruction(new ILHardwareWriteInstruction(2, 0xD021, v0));
      initEntry.addInstruction(new ILReturnVoidInstruction(3));

      // updateGame - game logic
      const updateGame = module.createFunction('updateGame', [], IL_VOID);
      updateGame.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      // renderGame - rendering
      const renderGame = module.createFunction('renderGame', [], IL_VOID);
      renderGame.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('_main');
      expect(result.assembly).toContain('_initGame');
      expect(result.assembly).toContain('_updateGame');
      expect(result.assembly).toContain('_renderGame');
      expect(result.stats.functionCount).toBe(4);
    });

    it('should generate init function that clears screen colors', () => {
      const module = new ILModule('init.bl65');

      // clearColors - sets border and background to black
      const clearColors = module.createFunction('clearColors', [], IL_VOID);
      const entry = clearColors.getEntryBlock();

      const black = clearColors.createRegister(IL_BYTE, 'black');
      entry.addInstruction(new ILConstInstruction(0, 0, IL_BYTE, black));
      entry.addInstruction(new ILHardwareWriteInstruction(1, 0xD020, black));
      entry.addInstruction(new ILHardwareWriteInstruction(2, 0xD021, black));
      entry.addInstruction(new ILReturnVoidInstruction(3));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('$D020');
      expect(result.assembly).toContain('$D021');
      expect(result.assembly).toContain('#$00');
    });
  });

  // ===========================================================================
  // Hardware Access Patterns Tests
  // ===========================================================================

  describe('hardware access patterns', () => {
    it('should generate VIC register access function', () => {
      const module = new ILModule('vic-access.bl65');

      // setColors - sets multiple VIC registers
      const setColors = module.createFunction('setColors', [], IL_VOID);
      const entry = setColors.getEntryBlock();

      // Set border to red (2)
      const red = setColors.createRegister(IL_BYTE, 'red');
      entry.addInstruction(new ILConstInstruction(0, 2, IL_BYTE, red));
      entry.addInstruction(new ILHardwareWriteInstruction(1, 0xD020, red));

      // Set background to cyan (3)
      const cyan = setColors.createRegister(IL_BYTE, 'cyan');
      entry.addInstruction(new ILConstInstruction(2, 3, IL_BYTE, cyan));
      entry.addInstruction(new ILHardwareWriteInstruction(3, 0xD021, cyan));

      entry.addInstruction(new ILReturnVoidInstruction(4));

      const options = createTestOptions();
      const result = codegen.generate(module, options);

      expect(result.assembly).toContain('#$02'); // red
      expect(result.assembly).toContain('#$03'); // cyan
      expect(result.assembly).toContain('$D020');
      expect(result.assembly).toContain('$D021');
    });
  });
});