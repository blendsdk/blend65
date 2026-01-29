/**
 * Tests for InstructionGenerator - Tier 1 Instructions
 *
 * Tests the fully translated instructions:
 * - CONST → LDA immediate
 * - HARDWARE_WRITE → STA absolute
 * - HARDWARE_READ → LDA absolute
 * - RETURN_VOID → RTS
 * - RETURN → RTS (value in A)
 * - JUMP → JMP label
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module __tests__/codegen/instruction-generator-tier1.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAcmeEmitter } from '../../asm-il/emitters/index.js';
import { InstructionGenerator } from '../../codegen/instruction-generator.js';
import { ILModule } from '../../il/module.js';
import { ILFunction } from '../../il/function.js';
import { IL_BYTE, IL_WORD, IL_VOID } from '../../il/types.js';
import {
  ILInstruction,
  ILConstInstruction,
  ILHardwareWriteInstruction,
  ILHardwareReadInstruction,
  ILReturnVoidInstruction,
  ILReturnInstruction,
  ILJumpInstruction,
} from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
import { C64_CONFIG } from '../../target/index.js';
import type { CodegenOptions } from '../../codegen/types.js';

/**
 * Concrete test implementation of InstructionGenerator
 */
class TestInstructionGenerator extends InstructionGenerator {
  public exposeGenerateInstruction(instr: ILInstruction): void {
    this.generateInstruction(instr);
  }

  public exposeGenerateConst(instr: ILConstInstruction): void {
    this.generateConst(instr);
  }

  public exposeGenerateHardwareWrite(instr: ILHardwareWriteInstruction): void {
    this.generateHardwareWrite(instr);
  }

  public exposeGenerateHardwareRead(instr: ILHardwareReadInstruction): void {
    this.generateHardwareRead(instr);
  }

  public exposeGenerateReturnVoid(instr: ILReturnVoidInstruction): void {
    this.generateReturnVoid(instr);
  }

  public exposeGenerateReturn(instr: ILReturnInstruction): void {
    this.generateReturn(instr);
  }

  public exposeGenerateJump(instr: ILJumpInstruction): void {
    this.generateJump(instr);
  }

  public getAssemblyOutput(): string {
    const asmModule = this.asmBuilder.build();
    const emitter = createAcmeEmitter();
    return emitter.emit(asmModule).text;
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
 * Creates a virtual register for testing
 */
function createRegister(id: number, name?: string): VirtualRegister {
  return new VirtualRegister(id, IL_BYTE, name);
}

describe('InstructionGenerator - Tier 1 Instructions', () => {
  let generator: TestInstructionGenerator;
  let module: ILModule;

  beforeEach(() => {
    generator = new TestInstructionGenerator();
    module = new ILModule('test.bl65');
    generator.setModule(module);
    generator.setOptions(createTestOptions());
  });

  // ===========================================================================
  // CONST Instruction Tests
  // ===========================================================================

  describe('generateConst()', () => {
    it('should emit LDA immediate for byte constant', () => {
      const v0 = createRegister(0, 'result');
      const instr = new ILConstInstruction(0, 42, IL_BYTE, v0);

      generator.exposeGenerateConst(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('LDA');
      expect(output).toContain('#$2A'); // 42 in hex
    });

    it('should emit LDA immediate for zero value', () => {
      const v0 = createRegister(0);
      const instr = new ILConstInstruction(0, 0, IL_BYTE, v0);

      generator.exposeGenerateConst(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('LDA');
      expect(output).toContain('#$00');
    });

    it('should emit LDA immediate for max byte value (255)', () => {
      const v0 = createRegister(0);
      const instr = new ILConstInstruction(0, 255, IL_BYTE, v0);

      generator.exposeGenerateConst(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('LDA');
      expect(output).toContain('#$FF');
    });

    it('should include comment with register assignment', () => {
      const v0 = createRegister(0, 'counter');
      const instr = new ILConstInstruction(0, 10, IL_BYTE, v0);

      generator.exposeGenerateConst(instr);
      const output = generator.getAssemblyOutput();

      // Should have comment showing the assignment
      expect(output).toContain('v0:counter');
      expect(output).toContain('10');
    });

    it('should handle word constants (low byte only in stub)', () => {
      const v0 = createRegister(0);
      const instr = new ILConstInstruction(0, 0x1234, IL_WORD, v0);

      generator.exposeGenerateConst(instr);
      const output = generator.getAssemblyOutput();

      // Stub only loads into A, so should emit LDA
      expect(output).toContain('LDA');
    });
  });

  // ===========================================================================
  // HARDWARE_WRITE Instruction Tests
  // ===========================================================================

  describe('generateHardwareWrite()', () => {
    it('should emit STA absolute for border color ($D020)', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareWriteInstruction(0, 0xD020, v0);

      generator.exposeGenerateHardwareWrite(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('STA');
      expect(output).toContain('$D020');
    });

    it('should emit STA absolute for background color ($D021)', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareWriteInstruction(0, 0xD021, v0);

      generator.exposeGenerateHardwareWrite(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('STA');
      expect(output).toContain('$D021');
    });

    it('should emit STA absolute for SID register', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareWriteInstruction(0, 0xD418, v0);

      generator.exposeGenerateHardwareWrite(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('STA');
      expect(output).toContain('$D418');
    });

    it('should emit STA absolute for CIA register', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareWriteInstruction(0, 0xDC00, v0);

      generator.exposeGenerateHardwareWrite(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('STA');
      expect(output).toContain('$DC00');
    });

    it('should include comment showing write target', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareWriteInstruction(0, 0xD020, v0);

      generator.exposeGenerateHardwareWrite(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('$D020');
    });
  });

  // ===========================================================================
  // HARDWARE_READ Instruction Tests
  // ===========================================================================

  describe('generateHardwareRead()', () => {
    it('should emit LDA absolute for reading raster line ($D012)', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareReadInstruction(0, 0xD012, v0);

      generator.exposeGenerateHardwareRead(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('LDA');
      expect(output).toContain('$D012');
    });

    it('should emit LDA absolute for reading joystick port 1 ($DC00)', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareReadInstruction(0, 0xDC00, v0);

      generator.exposeGenerateHardwareRead(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('LDA');
      expect(output).toContain('$DC00');
    });

    it('should emit LDA absolute for reading joystick port 2 ($DC01)', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareReadInstruction(0, 0xDC01, v0);

      generator.exposeGenerateHardwareRead(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('LDA');
      expect(output).toContain('$DC01');
    });

    it('should include comment showing read source', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareReadInstruction(0, 0xD012, v0);

      generator.exposeGenerateHardwareRead(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('$D012');
    });
  });

  // ===========================================================================
  // RETURN_VOID Instruction Tests
  // ===========================================================================

  describe('generateReturnVoid()', () => {
    it('should emit RTS instruction', () => {
      const instr = new ILReturnVoidInstruction(0);

      generator.exposeGenerateReturnVoid(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('RTS');
    });

    it('should include comment indicating return void', () => {
      const instr = new ILReturnVoidInstruction(0);

      generator.exposeGenerateReturnVoid(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('Return');
    });
  });

  // ===========================================================================
  // RETURN Instruction Tests
  // ===========================================================================

  describe('generateReturn()', () => {
    it('should emit RTS instruction for return with value', () => {
      const v0 = createRegister(0);
      const instr = new ILReturnInstruction(0, v0);

      generator.exposeGenerateReturn(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('RTS');
    });

    it('should include comment indicating value return', () => {
      const v0 = createRegister(0);
      const instr = new ILReturnInstruction(0, v0);

      generator.exposeGenerateReturn(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('Return');
    });
  });

  // ===========================================================================
  // JUMP Instruction Tests
  // ===========================================================================

  describe('generateJump()', () => {
    it('should emit JMP to target label', () => {
      const targetLabel = { kind: 'label' as const, name: 'loop', blockId: 1 };
      const instr = new ILJumpInstruction(0, targetLabel);

      generator.exposeGenerateJump(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('JMP');
      expect(output).toContain('.block_loop');
    });

    it('should emit JMP to different block labels', () => {
      const targetLabel = { kind: 'label' as const, name: 'endif', blockId: 2 };
      const instr = new ILJumpInstruction(0, targetLabel);

      generator.exposeGenerateJump(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('JMP');
      expect(output).toContain('.block_endif');
    });

    it('should include comment showing jump target', () => {
      const targetLabel = { kind: 'label' as const, name: 'next', blockId: 1 };
      const instr = new ILJumpInstruction(0, targetLabel);

      generator.exposeGenerateJump(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('next');
    });
  });

  // ===========================================================================
  // Instruction Dispatch Tests
  // ===========================================================================

  describe('generateInstruction() dispatch', () => {
    it('should dispatch CONST to generateConst', () => {
      const v0 = createRegister(0);
      const instr = new ILConstInstruction(0, 42, IL_BYTE, v0);

      generator.exposeGenerateInstruction(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('LDA');
    });

    it('should dispatch HARDWARE_WRITE to generateHardwareWrite', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareWriteInstruction(0, 0xD020, v0);

      generator.exposeGenerateInstruction(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('STA');
      expect(output).toContain('$D020');
    });

    it('should dispatch HARDWARE_READ to generateHardwareRead', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareReadInstruction(0, 0xD012, v0);

      generator.exposeGenerateInstruction(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('LDA');
      expect(output).toContain('$D012');
    });

    it('should dispatch RETURN_VOID to generateReturnVoid', () => {
      const instr = new ILReturnVoidInstruction(0);

      generator.exposeGenerateInstruction(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('RTS');
    });

    it('should dispatch RETURN to generateReturn', () => {
      const v0 = createRegister(0);
      const instr = new ILReturnInstruction(0, v0);

      generator.exposeGenerateInstruction(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('RTS');
    });

    it('should dispatch JUMP to generateJump', () => {
      const targetLabel = { kind: 'label' as const, name: 'target', blockId: 1 };
      const instr = new ILJumpInstruction(0, targetLabel);

      generator.exposeGenerateInstruction(instr);
      const output = generator.getAssemblyOutput();

      expect(output).toContain('JMP');
    });
  });

  // ===========================================================================
  // Byte Count Tests
  // ===========================================================================

  describe('instruction byte counts', () => {
    it('should track bytes for LDA immediate (2 bytes)', () => {
      const v0 = createRegister(0);
      const instr = new ILConstInstruction(0, 42, IL_BYTE, v0);

      generator.exposeGenerateConst(instr);
      const stats = generator.exposeGetStats();

      expect(stats.codeSize).toBe(2);
    });

    it('should track bytes for STA absolute (3 bytes)', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareWriteInstruction(0, 0xD020, v0);

      generator.exposeGenerateHardwareWrite(instr);
      const stats = generator.exposeGetStats();

      expect(stats.codeSize).toBe(3);
    });

    it('should track bytes for LDA absolute (3 bytes)', () => {
      const v0 = createRegister(0);
      const instr = new ILHardwareReadInstruction(0, 0xD012, v0);

      generator.exposeGenerateHardwareRead(instr);
      const stats = generator.exposeGetStats();

      expect(stats.codeSize).toBe(3);
    });

    it('should track bytes for RTS (1 byte)', () => {
      const instr = new ILReturnVoidInstruction(0);

      generator.exposeGenerateReturnVoid(instr);
      const stats = generator.exposeGetStats();

      expect(stats.codeSize).toBe(1);
    });

    it('should track bytes for JMP (3 bytes)', () => {
      const targetLabel = { kind: 'label' as const, name: 'loop', blockId: 1 };
      const instr = new ILJumpInstruction(0, targetLabel);

      generator.exposeGenerateJump(instr);
      const stats = generator.exposeGetStats();

      expect(stats.codeSize).toBe(3);
    });

    it('should accumulate bytes across multiple instructions', () => {
      const v0 = createRegister(0);

      // LDA #$2A (2 bytes)
      generator.exposeGenerateConst(new ILConstInstruction(0, 42, IL_BYTE, v0));
      // STA $D020 (3 bytes)
      generator.exposeGenerateHardwareWrite(new ILHardwareWriteInstruction(1, 0xD020, v0));
      // RTS (1 byte)
      generator.exposeGenerateReturnVoid(new ILReturnVoidInstruction(2));

      const stats = generator.exposeGetStats();
      expect(stats.codeSize).toBe(6); // 2 + 3 + 1
    });
  });
});