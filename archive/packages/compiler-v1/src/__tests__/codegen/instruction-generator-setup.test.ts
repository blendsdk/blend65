/**
 * Tests for InstructionGenerator - Setup and Function Generation
 *
 * Tests the basic setup, function generation, and basic block generation
 * of InstructionGenerator.
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module __tests__/codegen/instruction-generator-setup.test
 */

import { createAcmeEmitter } from '../../asm-il/emitters/index.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { InstructionGenerator } from '../../codegen/instruction-generator.js';
import { ILModule } from '../../il/module.js';
import { ILFunction, ILStorageClass } from '../../il/function.js';
import { BasicBlock } from '../../il/basic-block.js';
import {
  IL_BYTE,
  IL_WORD,
  IL_VOID,
  IL_BOOL,
} from '../../il/types.js';
import {
  ILReturnVoidInstruction,
  ILReturnInstruction,
  ILConstInstruction,
  ILJumpInstruction,
  ILBranchInstruction,
  ILOpcode,
} from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
import { C64_CONFIG } from '../../target/index.js';
import type { CodegenOptions } from '../../codegen/types.js';

/**
 * Concrete test implementation of InstructionGenerator
 *
 * InstructionGenerator is abstract, so we need a concrete class
 * to test its protected methods.
 */
class TestInstructionGenerator extends InstructionGenerator {
  // Expose protected methods for testing

  public exposeGenerateFunctions(): void {
    this.generateFunctions();
  }

  public exposeGenerateFunction(func: ILFunction): void {
    this.generateFunction(func);
  }

  public exposeGenerateBasicBlock(func: ILFunction, block: BasicBlock): void {
    this.generateBasicBlock(func, block);
  }

  public exposeFormatParams(func: ILFunction): string {
    return this.formatParams(func);
  }

  public exposeGetFunctionLabel(name: string): string {
    return this.getFunctionLabel(name);
  }

  public exposeGetBlockLabel(name: string): string {
    return this.getBlockLabel(name);
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

  public exposeResetState(): void {
    this.resetState();
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

/**
 * Creates a simple void function with RETURN_VOID
 */
function createSimpleVoidFunction(module: ILModule, name: string): ILFunction {
  const func = module.createFunction(name, [], IL_VOID);
  const entry = func.getEntryBlock();
  entry.addInstruction(new ILReturnVoidInstruction(0));
  return func;
}

/**
 * Creates a function that returns a constant byte value
 */
function createConstReturnFunction(module: ILModule, name: string, value: number): ILFunction {
  const func = module.createFunction(name, [], IL_BYTE);
  const entry = func.getEntryBlock();
  const v0 = func.createRegister(IL_BYTE, 'result');
  entry.addInstruction(new ILConstInstruction(0, value, IL_BYTE, v0));
  entry.addInstruction(new ILReturnInstruction(1, v0));
  return func;
}

describe('InstructionGenerator - Setup and Function Generation', () => {
  let generator: TestInstructionGenerator;
  let module: ILModule;

  beforeEach(() => {
    generator = new TestInstructionGenerator();
    module = new ILModule('test.bl65');
    generator.setModule(module);
    generator.setOptions(createTestOptions());
  });

  // ===========================================================================
  // Initial State Tests
  // ===========================================================================

  describe('initial state', () => {
    it('should start with function count at 0', () => {
      const stats = generator.exposeGetStats();
      expect(stats.functionCount).toBe(0);
    });

    it('should start with empty warnings', () => {
      expect(generator.exposeGetWarnings().length).toBe(0);
    });
  });

  // ===========================================================================
  // Function Label Generation Tests
  // ===========================================================================

  describe('getFunctionLabel()', () => {
    it('should prefix function name with underscore', () => {
      expect(generator.exposeGetFunctionLabel('main')).toBe('_main');
    });

    it('should handle multi-word function names', () => {
      expect(generator.exposeGetFunctionLabel('doSomething')).toBe('_doSomething');
    });

    it('should handle single-char function names', () => {
      expect(generator.exposeGetFunctionLabel('a')).toBe('_a');
    });
  });

  // ===========================================================================
  // Block Label Generation Tests
  // ===========================================================================

  describe('getBlockLabel()', () => {
    it('should prefix block name with .block_', () => {
      expect(generator.exposeGetBlockLabel('loop')).toBe('.block_loop');
    });

    it('should handle entry block label', () => {
      expect(generator.exposeGetBlockLabel('entry')).toBe('.block_entry');
    });
  });

  // ===========================================================================
  // Parameter Formatting Tests
  // ===========================================================================

  describe('formatParams()', () => {
    it('should format empty parameters', () => {
      const func = module.createFunction('test', [], IL_VOID);
      expect(generator.exposeFormatParams(func)).toBe('');
    });

    it('should format single byte parameter', () => {
      const func = module.createFunction('test', [{ name: 'x', type: IL_BYTE }], IL_VOID);
      expect(generator.exposeFormatParams(func)).toBe('x: byte');
    });

    it('should format single word parameter', () => {
      const func = module.createFunction('test', [{ name: 'addr', type: IL_WORD }], IL_VOID);
      expect(generator.exposeFormatParams(func)).toBe('addr: word');
    });

    it('should format multiple parameters', () => {
      const func = module.createFunction('test', [
        { name: 'a', type: IL_BYTE },
        { name: 'b', type: IL_BYTE },
      ], IL_BYTE);
      expect(generator.exposeFormatParams(func)).toBe('a: byte, b: byte');
    });

    it('should format mixed type parameters', () => {
      const func = module.createFunction('test', [
        { name: 'x', type: IL_BYTE },
        { name: 'y', type: IL_WORD },
        { name: 'flag', type: IL_BOOL },
      ], IL_VOID);
      expect(generator.exposeFormatParams(func)).toBe('x: byte, y: word, flag: bool');
    });
  });

  // ===========================================================================
  // Empty Module Function Generation Tests
  // ===========================================================================

  describe('generateFunctions() - empty module', () => {
    it('should emit only origin for module with no functions', () => {
      generator.exposeGenerateFunctions();
      const output = generator.getAssemblyOutput();
      expect(output).toContain('*=');
    });

    it('should keep function count at 0 for empty module', () => {
      generator.exposeGenerateFunctions();
      const stats = generator.exposeGetStats();
      expect(stats.functionCount).toBe(0);
    });
  });

  // ===========================================================================
  // Single Function Generation Tests
  // ===========================================================================

  describe('generateFunction() - single void function', () => {
    it('should emit function label', () => {
      const func = createSimpleVoidFunction(module, 'main');
      generator.exposeGenerateFunction(func);
      
      const output = generator.getAssemblyOutput();
      expect(output).toContain('_main');
    });

    it('should emit function signature comment', () => {
      const func = createSimpleVoidFunction(module, 'main');
      generator.exposeGenerateFunction(func);
      
      const output = generator.getAssemblyOutput();
      expect(output).toContain('function main');
      expect(output).toContain('void');
    });

    it('should emit RTS for return void', () => {
      const func = createSimpleVoidFunction(module, 'main');
      generator.exposeGenerateFunction(func);
      
      const output = generator.getAssemblyOutput();
      expect(output).toContain('RTS');
    });

    it('should increment function count', () => {
      const func = createSimpleVoidFunction(module, 'main');
      generator.exposeGenerateFunction(func);
      
      const stats = generator.exposeGetStats();
      expect(stats.functionCount).toBe(1);
    });
  });

  // ===========================================================================
  // Function with Parameters Tests
  // ===========================================================================

  describe('generateFunction() - with parameters', () => {
    it('should include parameters in signature comment', () => {
      const func = module.createFunction('add', [
        { name: 'a', type: IL_BYTE },
        { name: 'b', type: IL_BYTE },
      ], IL_BYTE);
      func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
      
      generator.exposeGenerateFunction(func);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('a: byte');
      expect(output).toContain('b: byte');
    });

    it('should include return type in signature comment', () => {
      const func = module.createFunction('getVal', [], IL_BYTE);
      func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
      
      generator.exposeGenerateFunction(func);
      const output = generator.getAssemblyOutput();
      expect(output).toContain('byte');
    });
  });

  // ===========================================================================
  // Multiple Functions Tests
  // ===========================================================================

  describe('generateFunctions() - multiple functions', () => {
    it('should emit all functions in module', () => {
      createSimpleVoidFunction(module, 'init');
      createSimpleVoidFunction(module, 'main');
      createSimpleVoidFunction(module, 'cleanup');
      
      generator.exposeGenerateFunctions();
      const output = generator.getAssemblyOutput();
      
      expect(output).toContain('_init');
      expect(output).toContain('_main');
      expect(output).toContain('_cleanup');
    });

    it('should count all functions', () => {
      createSimpleVoidFunction(module, 'func1');
      createSimpleVoidFunction(module, 'func2');
      createSimpleVoidFunction(module, 'func3');
      
      generator.exposeGenerateFunctions();
      const stats = generator.exposeGetStats();
      expect(stats.functionCount).toBe(3);
    });

    it('should emit section comment for functions', () => {
      createSimpleVoidFunction(module, 'main');
      
      generator.exposeGenerateFunctions();
      const output = generator.getAssemblyOutput();
      expect(output).toContain('Functions');
    });
  });

  // ===========================================================================
  // Basic Block Generation Tests
  // ===========================================================================

  describe('generateBasicBlock()', () => {
    it('should not emit label for entry block (id=0)', () => {
      const func = createSimpleVoidFunction(module, 'test');
      const entry = func.getEntryBlock();
      
      generator.exposeGenerateBasicBlock(func, entry);
      const output = generator.getAssemblyOutput();
      
      // Entry block (id=0) should not have its own label emitted
      expect(output).not.toContain('.entry');
    });

    it('should emit label for non-entry blocks', () => {
      const func = module.createFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const loopBlock = func.createBlock('loop');
      
      // Add instructions
      const loopLabel = loopBlock.getLabel();
      entry.addInstruction(new ILJumpInstruction(0, loopLabel));
      loopBlock.addInstruction(new ILReturnVoidInstruction(1));
      
      // Link blocks
      entry.linkTo(loopBlock);
      
      // Generate the loop block (id=1)
      generator.exposeGenerateBasicBlock(func, loopBlock);
      const output = generator.getAssemblyOutput();
      
      expect(output).toContain('.block_loop');
    });

    it('should generate instructions in block', () => {
      const func = createConstReturnFunction(module, 'getValue', 42);
      const entry = func.getEntryBlock();
      
      generator.exposeGenerateBasicBlock(func, entry);
      const output = generator.getAssemblyOutput();
      
      // Should have LDA for const and RTS for return
      expect(output).toContain('LDA');
      expect(output).toContain('RTS');
    });
  });

  // ===========================================================================
  // Multi-Block Function Tests
  // ===========================================================================

  describe('generateFunction() - multiple blocks', () => {
    it('should generate all blocks in function', () => {
      const func = module.createFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const block1 = func.createBlock('block1');
      
      // Create labels for blocks
      const block1Label = block1.getLabel();
      
      // Add instructions
      entry.addInstruction(new ILJumpInstruction(0, block1Label));
      block1.addInstruction(new ILReturnVoidInstruction(1));
      
      // Link blocks
      entry.linkTo(block1);
      
      generator.exposeGenerateFunction(func);
      const output = generator.getAssemblyOutput();
      
      expect(output).toContain('_test');
      expect(output).toContain('.block_block1');
    });

    it('should emit JMP for unconditional jumps', () => {
      const func = module.createFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const block1 = func.createBlock('target');
      
      const block1Label = block1.getLabel();
      entry.addInstruction(new ILJumpInstruction(0, block1Label));
      block1.addInstruction(new ILReturnVoidInstruction(1));
      
      entry.linkTo(block1);
      
      generator.exposeGenerateFunction(func);
      const output = generator.getAssemblyOutput();
      
      expect(output).toContain('JMP');
      expect(output).toContain('.block_target');
    });
  });

  // ===========================================================================
  // State Reset Tests
  // ===========================================================================

  describe('state management', () => {
    it('should reset function count on resetState()', () => {
      createSimpleVoidFunction(module, 'test');
      generator.exposeGenerateFunctions();
      expect(generator.exposeGetStats().functionCount).toBe(1);
      
      generator.exposeResetState();
      expect(generator.exposeGetStats().functionCount).toBe(0);
    });

    it('should accumulate function count across multiple generateFunction calls', () => {
      const func1 = createSimpleVoidFunction(module, 'func1');
      const func2 = createSimpleVoidFunction(module, 'func2');
      
      generator.exposeGenerateFunction(func1);
      expect(generator.exposeGetStats().functionCount).toBe(1);
      
      generator.exposeGenerateFunction(func2);
      expect(generator.exposeGetStats().functionCount).toBe(2);
    });
  });
});