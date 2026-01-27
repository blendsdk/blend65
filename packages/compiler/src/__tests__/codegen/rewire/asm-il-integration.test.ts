/**
 * CodeGenerator Rewire - ASM-IL Integration Tests
 *
 * Tests for Phase 3e integration of ASM-IL into the CodeGenerator:
 * - generateWithAsmIL() produces AsmModule in result
 * - Dual-output (AssemblyWriter + AsmBuilder) consistency
 * - Label, comment, and instruction generation via AsmBuilder
 * - Complete code generation workflow with ASM-IL
 *
 * @module codegen/rewire/asm-il-integration.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGenerator } from '../../../codegen/code-generator.js';
import { ILModule } from '../../../il/module.js';
import type { ILFunction } from '../../../il/function.js';
import {
  ILReturnVoidInstruction,
  ILConstInstruction,
  ILHardwareWriteInstruction,
} from '../../../il/instructions.js';
import { IL_VOID, IL_BYTE } from '../../../il/types.js';
import type { CodegenOptions } from '../../../codegen/types.js';
import { createAcmeEmitter } from '../../../asm-il/index.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a minimal IL module for testing
 *
 * Note: Entry point will be set when main function is added
 */
function createTestModule(name: string = 'test.blend'): ILModule {
  const module = new ILModule(name);
  return module;
}

/**
 * Helper to add main function and set entry point
 */
function addMainFunctionToModule(module: ILModule, func: ILFunction): void {
  module.addFunction(func);
  if (func.name === 'main') {
    module.setEntryPoint('main');
  }
}

/**
 * Creates a simple main function that does nothing (just returns)
 * Uses proper ILModule.createFunction API: (name, parameters[], returnType)
 */
function createMainFunction(module: ILModule): ILFunction {
  const func = module.createFunction('main', [], IL_VOID);
  func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
  return func;
}

/**
 * Creates a function that writes to border color
 * Uses proper ILModule.createFunction API: (name, parameters[], returnType)
 */
function createBorderColorFunction(module: ILModule): ILFunction {
  const func = module.createFunction('setBorder', [], IL_VOID);
  const entry = func.getEntryBlock();

  // Create a register for the constant
  const reg = func.createRegister(IL_BYTE, 't0');

  // CONST 0 → t0
  entry.addInstruction(new ILConstInstruction(0, 0, IL_BYTE, reg));

  // HARDWARE_WRITE $D020, t0
  entry.addInstruction(new ILHardwareWriteInstruction(1, 0xd020, reg));

  // RETURN_VOID
  entry.addInstruction(new ILReturnVoidInstruction(2));

  return func;
}

/**
 * Creates a helper (non-main) function
 * Uses proper ILModule.createFunction API: (name, parameters[], returnType)
 */
function createHelperFunction(module: ILModule): ILFunction {
  const func = module.createFunction('helper', [], IL_VOID);
  func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
  return func;
}

/**
 * Default code generation options
 */
function createDefaultOptions(): CodegenOptions {
  return {
    target: {
      architecture: 'c64',
      memoryMap: {
        codeStart: 0x0810,
        stackPointer: 0xff,
        zeroPageStart: 0x02,
        zeroPageEnd: 0x8f,
      },
    },
    format: 'asm',
    debug: 'none',
    basicStub: true,
  };
}

// ============================================================================
// generateWithAsmIL() Tests
// ============================================================================

describe('CodeGenerator.generateWithAsmIL()', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  describe('AsmModule generation', () => {
    it('should return AsmModule in result when using generateWithAsmIL', () => {
      const module = createTestModule();
      createMainFunction(module);

      const options = createDefaultOptions();
      const result = codegen.generateWithAsmIL(module, options);

      expect(result.module).toBeDefined();
      expect(result.module?.name).toBe('test.blend');
      expect(result.module?.items.length).toBeGreaterThan(0);
    });

    it('should NOT return AsmModule when using regular generate()', () => {
      const module = createTestModule();
      createMainFunction(module);

      const options = createDefaultOptions();
      const result = codegen.generate(module, options);

      // Regular generate() should not produce AsmModule by default
      expect(result.module).toBeUndefined();
    });

    it('should return both assembly text and AsmModule', () => {
      const module = createTestModule();
      createMainFunction(module);

      const options = createDefaultOptions();
      const result = codegen.generateWithAsmIL(module, options);

      // Both outputs should be present
      expect(result.assembly).toBeDefined();
      expect(result.assembly.length).toBeGreaterThan(0);
      expect(result.module).toBeDefined();
      expect(result.module?.items.length).toBeGreaterThan(0);
    });

    it('should set correct module origin', () => {
      const module = createTestModule();
      createMainFunction(module);

      const options = createDefaultOptions();
      const result = codegen.generateWithAsmIL(module, options);

      // Default C64 BASIC start is $0801
      expect(result.module?.origin).toBe(0x0801);
    });
  });

  describe('instruction generation', () => {
    it('should generate instructions in AsmModule', () => {
      const module = createTestModule();
      createMainFunction(module);

      const options = createDefaultOptions();
      const result = codegen.generateWithAsmIL(module, options);

      // Should have instructions in the module
      const instructions = result.module?.items.filter(item => item.kind === 'instruction');
      expect(instructions).toBeDefined();
      expect(instructions!.length).toBeGreaterThan(0);
    });

    it('should generate labels in AsmModule', () => {
      const module = createTestModule();
      createMainFunction(module);

      const options = createDefaultOptions();
      const result = codegen.generateWithAsmIL(module, options);

      // Should have labels in the module
      const labels = result.module?.items.filter(item => item.kind === 'label');
      expect(labels).toBeDefined();
      expect(labels!.length).toBeGreaterThan(0);
    });

    it('should generate comments in AsmModule', () => {
      const module = createTestModule();
      createMainFunction(module);

      const options = createDefaultOptions();
      const result = codegen.generateWithAsmIL(module, options);

      // Should have comments in the module
      const comments = result.module?.items.filter(item => item.kind === 'comment');
      expect(comments).toBeDefined();
      expect(comments!.length).toBeGreaterThan(0);
    });
  });

  describe('hardware write generation', () => {
    it('should generate STA instruction for HARDWARE_WRITE', () => {
      const module = createTestModule();
      createBorderColorFunction(module);

      const options = createDefaultOptions();
      const result = codegen.generateWithAsmIL(module, options);

      // Assembly should contain STA $D020
      expect(result.assembly).toContain('STA');
      expect(result.assembly).toContain('D020');

      // AsmModule should also have STA instruction
      const staInstruction = result.module?.items.find(
        item => item.kind === 'instruction' && (item as any).mnemonic === 'STA'
      );
      expect(staInstruction).toBeDefined();
    });

    it('should generate LDA immediate for CONST', () => {
      const module = createTestModule();
      createBorderColorFunction(module);

      const options = createDefaultOptions();
      const result = codegen.generateWithAsmIL(module, options);

      // Assembly should contain LDA #$00
      expect(result.assembly).toContain('LDA');

      // AsmModule should have LDA instruction
      const ldaInstruction = result.module?.items.find(
        item => item.kind === 'instruction' && (item as any).mnemonic === 'LDA'
      );
      expect(ldaInstruction).toBeDefined();
    });
  });
});

// ============================================================================
// Dual Output Consistency Tests
// ============================================================================

describe('Dual Output Consistency', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  it('should produce equivalent assembly from both outputs', () => {
    const module = createTestModule();
    createMainFunction(module);

    const options = createDefaultOptions();
    const result = codegen.generateWithAsmIL(module, options);

    // AssemblyWriter output
    const legacyAssembly = result.assembly;

    // AsmModule emitted to text
    const emitter = createAcmeEmitter();
    const asmILOutput = emitter.emit(result.module!);

    // Both should contain similar key elements
    // (They may not be identical due to formatting differences)
    expect(legacyAssembly).toContain('_main');
    expect(asmILOutput.text).toContain('_main');

    expect(legacyAssembly).toContain('RTS');
    expect(asmILOutput.text).toContain('RTS');
  });

  it('should track statistics consistently', () => {
    const module = createTestModule();
    createMainFunction(module);

    const options = createDefaultOptions();

    // Generate with ASM-IL
    const resultWithAsmIL = codegen.generateWithAsmIL(module, options);

    // Generate without ASM-IL (fresh instance)
    const module2 = createTestModule();
    createMainFunction(module2);
    const codegen2 = new CodeGenerator();
    const resultWithoutAsmIL = codegen2.generate(module2, options);

    // Statistics should be the same
    expect(resultWithAsmIL.stats.codeSize).toBe(resultWithoutAsmIL.stats.codeSize);
    expect(resultWithAsmIL.stats.dataSize).toBe(resultWithoutAsmIL.stats.dataSize);
    expect(resultWithAsmIL.stats.functionCount).toBe(resultWithoutAsmIL.stats.functionCount);
  });
});

// ============================================================================
// AsmModule Structure Tests
// ============================================================================

describe('AsmModule Structure', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  it('should have proper metadata', () => {
    const module = createTestModule();
    createMainFunction(module);

    const options = createDefaultOptions();
    const result = codegen.generateWithAsmIL(module, options);

    expect(result.module?.metadata).toBeDefined();
    expect(result.module?.metadata.generatedAt).toBeDefined();
    expect(result.module?.metadata.compilerVersion).toBeDefined();
  });

  it('should set target architecture', () => {
    const module = createTestModule();
    createMainFunction(module);

    const options = createDefaultOptions();
    const result = codegen.generateWithAsmIL(module, options);

    expect(result.module?.target).toBe('c64');
  });

  it('should preserve label lookup', () => {
    const module = createTestModule();
    createMainFunction(module);

    const options = createDefaultOptions();
    const result = codegen.generateWithAsmIL(module, options);

    // Should have labels map
    expect(result.module?.labels).toBeDefined();
    expect(result.module?.labels.size).toBeGreaterThan(0);
  });
});

// ============================================================================
// Multiple Generation Passes
// ============================================================================

describe('Multiple Generation Passes', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  it('should reset state between generations', () => {
    const module1 = createTestModule('module1.blend');
    createMainFunction(module1);

    const module2 = createTestModule('module2.blend');
    createBorderColorFunction(module2);

    const options = createDefaultOptions();

    // First generation
    const result1 = codegen.generateWithAsmIL(module1, options);

    // Second generation
    const result2 = codegen.generateWithAsmIL(module2, options);

    // Results should be independent
    expect(result1.module?.name).toBe('module1.blend');
    expect(result2.module?.name).toBe('module2.blend');

    // Second module should have STA (hardware write)
    const staInResult2 = result2.module?.items.find(
      item => item.kind === 'instruction' && (item as any).mnemonic === 'STA'
    );
    expect(staInResult2).toBeDefined();
  });

  it('should not affect regular generate() after generateWithAsmIL()', () => {
    const module = createTestModule();
    createMainFunction(module);

    const options = createDefaultOptions();

    // First with ASM-IL
    const result1 = codegen.generateWithAsmIL(module, options);
    expect(result1.module).toBeDefined();

    // Second without ASM-IL (fresh module since functions are owned by module)
    const module2 = createTestModule();
    createMainFunction(module2);
    const result2 = codegen.generate(module2, options);
    expect(result2.module).toBeUndefined();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  it('should handle empty module', () => {
    const module = createTestModule();
    // No functions added

    const options = createDefaultOptions();
    const result = codegen.generateWithAsmIL(module, options);

    // Should still produce valid output
    expect(result.module).toBeDefined();
    expect(result.assembly).toBeDefined();
  });

  it('should handle module without main function', () => {
    const module = createTestModule();
    // Add a non-main function using module.createFunction
    createHelperFunction(module);

    const options = createDefaultOptions();
    const result = codegen.generateWithAsmIL(module, options);

    // Should produce valid output with infinite loop fallback
    expect(result.module).toBeDefined();
    expect(result.assembly).toContain('RTS');
    expect(result.assembly).toContain('Return to BASIC');
  });

  it('should handle BASIC stub disabled', () => {
    const module = createTestModule();
    createMainFunction(module);

    const options = createDefaultOptions();
    options.basicStub = false;

    const result = codegen.generateWithAsmIL(module, options);

    expect(result.module).toBeDefined();
  });
});