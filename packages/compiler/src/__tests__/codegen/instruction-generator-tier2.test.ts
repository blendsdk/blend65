/**
 * Tests for InstructionGenerator - Tier 2 Instructions
 *
 * Tests the simplified translation instructions:
 * - BRANCH → stub: JMP (always take then-branch)
 * - LOAD_VAR → LDA (ZP or absolute or label)
 * - STORE_VAR → STA (ZP or absolute or label)
 * - CALL → JSR label
 * - CALL_VOID → JSR label
 * - Binary ops → CLC/ADC, SEC/SBC, or NOP
 * - Unary ops → EOR #$FF for NOT, or NOP
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * @module __tests__/codegen/instruction-generator-tier2.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InstructionGenerator } from '../../codegen/instruction-generator.js';
import { ILModule } from '../../il/module.js';
import { ILStorageClass } from '../../il/function.js';
import { IL_BYTE, IL_WORD, IL_VOID } from '../../il/types.js';
import {
  ILInstruction,
  ILOpcode,
  ILBranchInstruction,
  ILLoadVarInstruction,
  ILStoreVarInstruction,
  ILCallInstruction,
  ILCallVoidInstruction,
  ILBinaryInstruction,
  ILUnaryInstruction,
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

  public exposeGenerateBranch(instr: ILBranchInstruction): void {
    this.generateBranch(instr);
  }

  public exposeGenerateLoadVar(instr: ILLoadVarInstruction): void {
    this.generateLoadVar(instr);
  }

  public exposeGenerateStoreVar(instr: ILStoreVarInstruction): void {
    this.generateStoreVar(instr);
  }

  public exposeGenerateCall(instr: ILCallInstruction): void {
    this.generateCall(instr);
  }

  public exposeGenerateCallVoid(instr: ILCallVoidInstruction): void {
    this.generateCallVoid(instr);
  }

  public exposeGenerateBinaryOp(instr: ILBinaryInstruction): void {
    this.generateBinaryOp(instr);
  }

  public exposeGenerateUnaryOp(instr: ILUnaryInstruction): void {
    this.generateUnaryOp(instr);
  }

  public exposeGetOperatorSymbol(opcode: ILOpcode): string {
    return this.getOperatorSymbol(opcode);
  }

  public exposeGetUnaryOperatorSymbol(opcode: ILOpcode): string {
    return this.getUnaryOperatorSymbol(opcode);
  }

  public exposeGenerateGlobals(): void {
    this.generateGlobals();
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

describe('InstructionGenerator - Tier 2 Instructions', () => {
  let generator: TestInstructionGenerator;
  let module: ILModule;

  beforeEach(() => {
    generator = new TestInstructionGenerator();
    module = new ILModule('test.bl65');
    generator.setModule(module);
    generator.setOptions(createTestOptions());
  });

  // ===========================================================================
  // BRANCH Instruction Tests (Stub)
  // ===========================================================================

  describe('generateBranch()', () => {
    it('should emit JMP to then-label (stub always takes then-branch)', () => {
      const cond = createRegister(0, 'condition');
      const thenLabel = { kind: 'label' as const, name: 'if_true', blockId: 1 };
      const elseLabel = { kind: 'label' as const, name: 'if_false', blockId: 2 };
      const instr = new ILBranchInstruction(0, cond, thenLabel, elseLabel);

      generator.exposeGenerateBranch(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('JMP');
      expect(output).toContain('.block_if_true');
    });

    it('should emit comment showing branch intent', () => {
      const cond = createRegister(0);
      const thenLabel = { kind: 'label' as const, name: 'loop', blockId: 1 };
      const elseLabel = { kind: 'label' as const, name: 'exit', blockId: 2 };
      const instr = new ILBranchInstruction(0, cond, thenLabel, elseLabel);

      generator.exposeGenerateBranch(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STUB');
      expect(output).toContain('.block_loop');
      expect(output).toContain('.block_exit');
    });

    it('should emit comment indicating stub behavior', () => {
      const cond = createRegister(0);
      const thenLabel = { kind: 'label' as const, name: 'then', blockId: 1 };
      const elseLabel = { kind: 'label' as const, name: 'else', blockId: 2 };
      const instr = new ILBranchInstruction(0, cond, thenLabel, elseLabel);

      generator.exposeGenerateBranch(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STUB');
      expect(output).toContain('then-branch');
    });
  });

  // ===========================================================================
  // LOAD_VAR Instruction Tests
  // ===========================================================================

  describe('generateLoadVar()', () => {
    it('should emit LDA zero-page for ZP variables', () => {
      // Create a ZP variable
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();
      generator.exposeResetState();

      // Re-generate globals to populate allocations
      generator.exposeGenerateGlobals();

      const v0 = createRegister(0);
      const instr = new ILLoadVarInstruction(0, 'counter', v0);

      generator.exposeGenerateLoadVar(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('LDA');
      // Should use zero-page addressing
    });

    it('should emit LDA with label for RAM variables', () => {
      // Create a RAM variable
      module.createGlobal('buffer', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const v0 = createRegister(0);
      const instr = new ILLoadVarInstruction(0, 'buffer', v0);

      generator.exposeGenerateLoadVar(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('LDA');
      expect(output).toContain('_buffer');
    });

    it('should emit LDA absolute for map variables', () => {
      // Create a map variable with fixed address
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, { address: 0xD020 });
      generator.exposeGenerateGlobals();

      const v0 = createRegister(0);
      const instr = new ILLoadVarInstruction(0, 'borderColor', v0);

      generator.exposeGenerateLoadVar(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('LDA');
      expect(output).toContain('$D020');
    });

    it('should emit stub comment for unknown variables', () => {
      const v0 = createRegister(0);
      const instr = new ILLoadVarInstruction(0, 'unknown', v0);

      generator.exposeGenerateLoadVar(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STUB');
      expect(output).toContain('unknown');
    });

    it('should include comment showing variable name', () => {
      module.createGlobal('score', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const v0 = createRegister(0);
      const instr = new ILLoadVarInstruction(0, 'score', v0);

      generator.exposeGenerateLoadVar(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('score');
    });
  });

  // ===========================================================================
  // STORE_VAR Instruction Tests
  // ===========================================================================

  describe('generateStoreVar()', () => {
    it('should emit STA zero-page for ZP variables', () => {
      module.createGlobal('counter', IL_BYTE, ILStorageClass.ZeroPage);
      generator.exposeGenerateGlobals();

      const v0 = createRegister(0);
      const instr = new ILStoreVarInstruction(0, 'counter', v0);

      generator.exposeGenerateStoreVar(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STA');
    });

    it('should emit STA with label for RAM variables', () => {
      module.createGlobal('buffer', IL_BYTE, ILStorageClass.Ram);
      generator.exposeGenerateGlobals();

      const v0 = createRegister(0);
      const instr = new ILStoreVarInstruction(0, 'buffer', v0);

      generator.exposeGenerateStoreVar(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STA');
      expect(output).toContain('_buffer');
    });

    it('should emit STA absolute for map variables', () => {
      module.createGlobal('borderColor', IL_BYTE, ILStorageClass.Map, { address: 0xD020 });
      generator.exposeGenerateGlobals();

      const v0 = createRegister(0);
      const instr = new ILStoreVarInstruction(0, 'borderColor', v0);

      generator.exposeGenerateStoreVar(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STA');
      expect(output).toContain('$D020');
    });

    it('should emit stub comment for unknown variables', () => {
      const v0 = createRegister(0);
      const instr = new ILStoreVarInstruction(0, 'unknown', v0);

      generator.exposeGenerateStoreVar(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STUB');
    });
  });

  // ===========================================================================
  // CALL Instruction Tests
  // ===========================================================================

  describe('generateCall()', () => {
    it('should emit JSR to function label', () => {
      const v0 = createRegister(0);
      const instr = new ILCallInstruction(0, 'getValue', [], v0);

      generator.exposeGenerateCall(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('JSR');
      expect(output).toContain('_getValue');
    });

    it('should emit stub comment when call has arguments', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const v2 = createRegister(2);
      const instr = new ILCallInstruction(0, 'add', [v0, v1], v2);

      generator.exposeGenerateCall(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('JSR');
      expect(output).toContain('_add');
      expect(output).toContain('STUB');
      expect(output).toContain('args');
    });

    it('should include comment showing function name', () => {
      const v0 = createRegister(0);
      const instr = new ILCallInstruction(0, 'readInput', [], v0);

      generator.exposeGenerateCall(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('readInput');
    });
  });

  // ===========================================================================
  // CALL_VOID Instruction Tests
  // ===========================================================================

  describe('generateCallVoid()', () => {
    it('should emit JSR to function label', () => {
      const instr = new ILCallVoidInstruction(0, 'init', []);

      generator.exposeGenerateCallVoid(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('JSR');
      expect(output).toContain('_init');
    });

    it('should emit stub comment when call has arguments', () => {
      const v0 = createRegister(0);
      const instr = new ILCallVoidInstruction(0, 'print', [v0]);

      generator.exposeGenerateCallVoid(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('JSR');
      expect(output).toContain('STUB');
    });
  });

  // ===========================================================================
  // Binary Operation Tests
  // ===========================================================================

  describe('generateBinaryOp()', () => {
    it('should emit CLC/ADC for ADD operation', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const v2 = createRegister(2);
      const instr = new ILBinaryInstruction(0, ILOpcode.ADD, v0, v1, v2);

      generator.exposeGenerateBinaryOp(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('CLC');
      expect(output).toContain('ADC');
    });

    it('should emit SEC/SBC for SUB operation', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const v2 = createRegister(2);
      const instr = new ILBinaryInstruction(0, ILOpcode.SUB, v0, v1, v2);

      generator.exposeGenerateBinaryOp(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('SEC');
      expect(output).toContain('SBC');
    });

    it('should emit AND instruction for AND operation', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const v2 = createRegister(2);
      const instr = new ILBinaryInstruction(0, ILOpcode.AND, v0, v1, v2);

      generator.exposeGenerateBinaryOp(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('AND');
    });

    it('should emit ORA instruction for OR operation', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const v2 = createRegister(2);
      const instr = new ILBinaryInstruction(0, ILOpcode.OR, v0, v1, v2);

      generator.exposeGenerateBinaryOp(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('ORA');
    });

    it('should emit CMP instruction for comparison operations', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const v2 = createRegister(2);
      const instr = new ILBinaryInstruction(0, ILOpcode.CMP_EQ, v0, v1, v2);

      generator.exposeGenerateBinaryOp(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('CMP');
    });

    it('should include STUB comment showing operation', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const v2 = createRegister(2);
      const instr = new ILBinaryInstruction(0, ILOpcode.ADD, v0, v1, v2);

      generator.exposeGenerateBinaryOp(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STUB');
      expect(output).toContain('+');
    });
  });

  // ===========================================================================
  // Unary Operation Tests
  // ===========================================================================

  describe('generateUnaryOp()', () => {
    it('should emit EOR #$FF for bitwise NOT', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const instr = new ILUnaryInstruction(0, ILOpcode.NOT, v0, v1);

      generator.exposeGenerateUnaryOp(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('EOR');
      expect(output).toContain('#$FF');
    });

    it('should emit NOP placeholder for NEG operation', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const instr = new ILUnaryInstruction(0, ILOpcode.NEG, v0, v1);

      generator.exposeGenerateUnaryOp(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('NOP');
    });

    it('should emit NOP placeholder for LOGICAL_NOT operation', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const instr = new ILUnaryInstruction(0, ILOpcode.LOGICAL_NOT, v0, v1);

      generator.exposeGenerateUnaryOp(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('NOP');
    });

    it('should include STUB comment showing operation', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const instr = new ILUnaryInstruction(0, ILOpcode.NEG, v0, v1);

      generator.exposeGenerateUnaryOp(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('STUB');
      expect(output).toContain('-');
    });
  });

  // ===========================================================================
  // Operator Symbol Tests
  // ===========================================================================

  describe('getOperatorSymbol()', () => {
    it('should return + for ADD', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.ADD)).toBe('+');
    });

    it('should return - for SUB', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.SUB)).toBe('-');
    });

    it('should return * for MUL', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.MUL)).toBe('*');
    });

    it('should return / for DIV', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.DIV)).toBe('/');
    });

    it('should return % for MOD', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.MOD)).toBe('%');
    });

    it('should return & for AND', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.AND)).toBe('&');
    });

    it('should return | for OR', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.OR)).toBe('|');
    });

    it('should return ^ for XOR', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.XOR)).toBe('^');
    });

    it('should return << for SHL', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.SHL)).toBe('<<');
    });

    it('should return >> for SHR', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.SHR)).toBe('>>');
    });

    it('should return == for CMP_EQ', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.CMP_EQ)).toBe('==');
    });

    it('should return != for CMP_NE', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.CMP_NE)).toBe('!=');
    });

    it('should return < for CMP_LT', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.CMP_LT)).toBe('<');
    });

    it('should return <= for CMP_LE', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.CMP_LE)).toBe('<=');
    });

    it('should return > for CMP_GT', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.CMP_GT)).toBe('>');
    });

    it('should return >= for CMP_GE', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.CMP_GE)).toBe('>=');
    });

    it('should return ? for unknown opcode', () => {
      expect(generator.exposeGetOperatorSymbol(ILOpcode.CONST)).toBe('?');
    });
  });

  // ===========================================================================
  // Unary Operator Symbol Tests
  // ===========================================================================

  describe('getUnaryOperatorSymbol()', () => {
    it('should return - for NEG', () => {
      expect(generator.exposeGetUnaryOperatorSymbol(ILOpcode.NEG)).toBe('-');
    });

    it('should return ~ for NOT', () => {
      expect(generator.exposeGetUnaryOperatorSymbol(ILOpcode.NOT)).toBe('~');
    });

    it('should return ! for LOGICAL_NOT', () => {
      expect(generator.exposeGetUnaryOperatorSymbol(ILOpcode.LOGICAL_NOT)).toBe('!');
    });

    it('should return ? for unknown opcode', () => {
      expect(generator.exposeGetUnaryOperatorSymbol(ILOpcode.CONST)).toBe('?');
    });
  });

  // ===========================================================================
  // Instruction Dispatch Tests
  // ===========================================================================

  describe('generateInstruction() dispatch - Tier 2', () => {
    it('should dispatch BRANCH to generateBranch', () => {
      const cond = createRegister(0);
      const thenLabel = { kind: 'label' as const, name: 'then', blockId: 1 };
      const elseLabel = { kind: 'label' as const, name: 'else', blockId: 2 };
      const instr = new ILBranchInstruction(0, cond, thenLabel, elseLabel);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('JMP');
    });

    it('should dispatch LOAD_VAR to generateLoadVar', () => {
      const v0 = createRegister(0);
      const instr = new ILLoadVarInstruction(0, 'counter', v0);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('LDA');
    });

    it('should dispatch STORE_VAR to generateStoreVar', () => {
      const v0 = createRegister(0);
      const instr = new ILStoreVarInstruction(0, 'counter', v0);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      // Stub will emit comment for unknown variable
      expect(output).toContain('STUB');
    });

    it('should dispatch CALL to generateCall', () => {
      const v0 = createRegister(0);
      const instr = new ILCallInstruction(0, 'func', [], v0);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('JSR');
    });

    it('should dispatch CALL_VOID to generateCallVoid', () => {
      const instr = new ILCallVoidInstruction(0, 'func', []);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('JSR');
    });

    it('should dispatch ADD to generateBinaryOp', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const v2 = createRegister(2);
      const instr = new ILBinaryInstruction(0, ILOpcode.ADD, v0, v1, v2);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('CLC');
      expect(output).toContain('ADC');
    });

    it('should dispatch NOT to generateUnaryOp', () => {
      const v0 = createRegister(0);
      const v1 = createRegister(1);
      const instr = new ILUnaryInstruction(0, ILOpcode.NOT, v0, v1);

      generator.exposeGenerateInstruction(instr);
      const output = generator.exposeAssemblyWriter().toString();

      expect(output).toContain('EOR');
    });
  });
});