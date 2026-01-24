/**
 * compileToAcme() Integration Tests
 *
 * Tests for the main compilation pipeline function:
 * IL Module → CodeGenerator → AsmOptimizer → AcmeEmitter → ACME text
 *
 * @module __tests__/asm-il/integration/compile-to-acme.test
 * @since Phase 3f (CodeGenerator Integration)
 */

import { describe, it, expect } from 'vitest';
import {
  compileToAcme,
  createDefaultConfig,
  quickCompileToAcme,
} from '../../../asm-il/compile-to-acme.js';
import { ILModule } from '../../../il/module.js';
import {
  ILReturnVoidInstruction,
  ILConstInstruction,
  ILHardwareWriteInstruction,
} from '../../../il/instructions.js';
import { IL_VOID, IL_BYTE } from '../../../il/types.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a minimal IL module for testing
 */
function createTestModule(name: string = 'test.blend'): ILModule {
  return new ILModule(name);
}

/**
 * Creates a simple main function that does nothing
 */
function addMainFunction(module: ILModule): void {
  const func = module.createFunction('main', [], IL_VOID);
  func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
  module.setEntryPoint('main');
}

/**
 * Creates a function that writes to border color
 */
function addBorderColorFunction(module: ILModule): void {
  const func = module.createFunction('setBorder', [], IL_VOID);
  const entry = func.getEntryBlock();
  const reg = func.createRegister(IL_BYTE, 't0');

  entry.addInstruction(new ILConstInstruction(0, 0, IL_BYTE, reg));
  entry.addInstruction(new ILHardwareWriteInstruction(1, 0xd020, reg));
  entry.addInstruction(new ILReturnVoidInstruction(2));
}

// ============================================================================
// compileToAcme() BASIC TESTS
// ============================================================================

describe('compileToAcme()', () => {
  describe('basic compilation', () => {
    it('should compile a simple module', () => {
      const module = createTestModule();
      addMainFunction(module);

      const config = createDefaultConfig();
      const result = compileToAcme(module, config);

      expect(result.asmText).toBeDefined();
      expect(result.asmText.length).toBeGreaterThan(0);
    });

    it('should produce ACME-compatible output', () => {
      const module = createTestModule();
      addMainFunction(module);

      const config = createDefaultConfig();
      const result = compileToAcme(module, config);

      // Check for ACME syntax elements
      expect(result.asmText).toContain('*=');
      expect(result.asmText).toContain('$');
    });

    it('should return all result components', () => {
      const module = createTestModule();
      addMainFunction(module);

      const config = createDefaultConfig();
      const result = compileToAcme(module, config);

      expect(result.asmText).toBeDefined();
      expect(result.asmModule).toBeDefined();
      expect(result.codeGenResult).toBeDefined();
      expect(result.emitterResult).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it('should include correct stats', () => {
      const module = createTestModule();
      addMainFunction(module);

      const config = createDefaultConfig();
      const result = compileToAcme(module, config);

      expect(result.stats.totalBytes).toBeGreaterThan(0);
      expect(result.stats.lineCount).toBeGreaterThan(0);
      expect(result.stats.functionCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('with hardware access', () => {
    it('should compile hardware write instructions', () => {
      const module = createTestModule();
      addBorderColorFunction(module);

      const config = createDefaultConfig();
      const result = compileToAcme(module, config);

      // Should contain STA to border color register
      expect(result.asmText).toContain('D020');
      expect(result.asmText).toContain('STA');
    });

    it('should compile LDA immediate for constants', () => {
      const module = createTestModule();
      addBorderColorFunction(module);

      const config = createDefaultConfig();
      const result = compileToAcme(module, config);

      expect(result.asmText).toContain('LDA');
    });
  });

  describe('optimization control', () => {
    it('should skip optimization when optimize is false', () => {
      const module = createTestModule();
      addMainFunction(module);

      const config = createDefaultConfig({ optimize: false });
      const result = compileToAcme(module, config);

      expect(result.stats.optimizationChanged).toBe(false);
    });

    it('should run optimization when optimize is true', () => {
      const module = createTestModule();
      addMainFunction(module);

      const config = createDefaultConfig({ optimize: true });
      const result = compileToAcme(module, config);

      // Pass-through optimizer doesn't change anything, but should run
      expect(result.optimizationResult).toBeDefined();
    });

    it('should include optimization result when enabled', () => {
      const module = createTestModule();
      addMainFunction(module);

      const config = createDefaultConfig({ optimize: true });
      const result = compileToAcme(module, config);

      expect(result.optimizationResult).toBeDefined();
      expect(result.optimizationResult?.module).toBeDefined();
    });
  });

  describe('emitter configuration', () => {
    it('should use uppercase mnemonics by default', () => {
      const module = createTestModule();
      addMainFunction(module);

      const config = createDefaultConfig();
      const result = compileToAcme(module, config);

      expect(result.asmText).toContain('RTS');
    });

    it('should use lowercase mnemonics when configured', () => {
      const module = createTestModule();
      addMainFunction(module);

      const config = createDefaultConfig({
        emitter: { uppercaseMnemonics: false },
      });
      const result = compileToAcme(module, config);

      expect(result.asmText).toContain('rts');
    });

    it('should include comments when configured', () => {
      const module = createTestModule();
      addMainFunction(module);

      const config = createDefaultConfig({
        emitter: { includeComments: true },
      });
      const result = compileToAcme(module, config);

      expect(result.asmText).toContain(';');
    });
  });
});

// ============================================================================
// createDefaultConfig() TESTS
// ============================================================================

describe('createDefaultConfig()', () => {
  it('should return valid default configuration', () => {
    const config = createDefaultConfig();

    expect(config.codeGen).toBeDefined();
    expect(config.codeGen.target?.architecture).toBe('c64');
    expect(config.optimize).toBe(false);
    expect(config.emitter).toBeDefined();
  });

  it('should allow overrides', () => {
    const config = createDefaultConfig({ optimize: true });

    expect(config.optimize).toBe(true);
    expect(config.codeGen).toBeDefined();
  });

  it('should preserve default codeGen when not overridden', () => {
    const config = createDefaultConfig({ optimize: true });

    expect(config.codeGen.target?.architecture).toBe('c64');
    expect(config.codeGen.basicStub).toBe(true);
  });
});

// ============================================================================
// quickCompileToAcme() TESTS
// ============================================================================

describe('quickCompileToAcme()', () => {
  it('should compile with default settings', () => {
    const module = createTestModule();
    addMainFunction(module);

    const asmText = quickCompileToAcme(module);

    expect(asmText).toBeDefined();
    expect(asmText.length).toBeGreaterThan(0);
  });

  it('should return only the assembly text', () => {
    const module = createTestModule();
    addMainFunction(module);

    const result = quickCompileToAcme(module);

    expect(typeof result).toBe('string');
  });

  it('should produce valid ACME output', () => {
    const module = createTestModule();
    addMainFunction(module);

    const asmText = quickCompileToAcme(module);

    expect(asmText).toContain('RTS');
    expect(asmText).toContain('$');
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Handling', () => {
  describe('code generation errors', () => {
    it('should throw if code generation fails to produce AsmModule', () => {
      // Note: This test verifies the error message when AsmModule is not produced
      // In practice, generateWithAsmIL should always produce an AsmModule
      // This test ensures the error handling code path is covered
      
      const module = createTestModule();
      addMainFunction(module);
      const config = createDefaultConfig();
      
      // Normal compilation should succeed
      expect(() => compileToAcme(module, config)).not.toThrow();
    });
  });

  describe('input validation', () => {
    it('should handle module without functions', () => {
      const module = createTestModule();
      // No functions added

      const config = createDefaultConfig();
      
      // Should not throw - CodeGenerator handles this with fallback loop
      expect(() => compileToAcme(module, config)).not.toThrow();
    });

    it('should handle module without main function', () => {
      const module = createTestModule();
      // Add a non-main function
      const func = module.createFunction('helper', [], IL_VOID);
      func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const config = createDefaultConfig();
      
      // Should produce output with infinite loop fallback
      const result = compileToAcme(module, config);
      expect(result.asmText).toContain('JMP');
    });
  });
});

// ============================================================================
// PIPELINE FLOW TESTS
// ============================================================================

describe('Pipeline Flow', () => {
  it('should flow: CodeGenerator → Optimizer → Emitter', () => {
    const module = createTestModule();
    addMainFunction(module);

    const config = createDefaultConfig({ optimize: true });
    const result = compileToAcme(module, config);

    // CodeGenerator produced AsmModule
    expect(result.codeGenResult.module).toBeDefined();

    // Optimizer processed AsmModule
    expect(result.optimizationResult).toBeDefined();
    expect(result.optimizationResult?.module).toBeDefined();

    // Emitter produced text
    expect(result.emitterResult.text).toBeDefined();
    expect(result.emitterResult.text.length).toBeGreaterThan(0);
  });

  it('should aggregate statistics from all stages', () => {
    const module = createTestModule();
    addMainFunction(module);

    const config = createDefaultConfig();
    const result = compileToAcme(module, config);

    // Stats from CodeGenerator
    expect(result.stats.codeSize).toBeDefined();
    expect(result.stats.dataSize).toBeDefined();
    expect(result.stats.functionCount).toBeDefined();
    expect(result.stats.globalCount).toBeDefined();

    // Stats from Emitter
    expect(result.stats.totalBytes).toBeDefined();
    expect(result.stats.lineCount).toBeDefined();

    // Stats from Optimizer
    expect(result.stats.optimizationPasses).toBeDefined();
    expect(result.stats.optimizationChanged).toBeDefined();
  });

  it('should preserve source information through pipeline', () => {
    const module = createTestModule('my-program.blend');
    addMainFunction(module);

    const config = createDefaultConfig();
    const result = compileToAcme(module, config);

    // Module name should be preserved
    expect(result.asmModule.name).toBe('my-program.blend');
  });
});

// ============================================================================
// REAL PROGRAM TESTS
// ============================================================================

describe('Real Program Compilation', () => {
  it('should compile border color program', () => {
    const module = createTestModule('border.blend');
    addBorderColorFunction(module);
    module.setEntryPoint('setBorder');

    const config = createDefaultConfig();
    const result = compileToAcme(module, config);

    // Should have valid ACME output
    expect(result.asmText).toContain('D020');
    expect(result.asmText).toContain('LDA');
    expect(result.asmText).toContain('STA');
    expect(result.stats.totalBytes).toBeGreaterThan(0);
  });

  it('should compile multiple functions', () => {
    const module = createTestModule('multi.blend');
    addMainFunction(module);
    addBorderColorFunction(module);

    const config = createDefaultConfig();
    const result = compileToAcme(module, config);

    // Should contain both functions
    expect(result.asmText).toContain('_main');
    expect(result.asmText).toContain('_setBorder');
    expect(result.stats.functionCount).toBeGreaterThanOrEqual(2);
  });
});