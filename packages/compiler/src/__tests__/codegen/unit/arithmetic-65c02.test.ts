/**
 * 65C02 Arithmetic Operations Tests
 *
 * Verifies that the arithmetic operations layer uses INC A / DEC A
 * (65C02 native accumulator instructions) instead of the 6502
 * multi-instruction CLC+ADC #1 / SEC+SBC #1 sequences when the
 * CPU target is set to '65c02' and the immediate value is 1.
 *
 * On the 65C02:
 * - **INC A** (1 byte) replaces CLC + ADC #1 (3 bytes) — saves 2 bytes
 * - **DEC A** (1 byte) replaces SEC + SBC #1 (3 bytes) — saves 2 bytes
 *
 * Tests focus on the `genAddImm()` and `genSubImm()` methods refactored
 * in Phase 4 to delegate to `this.cpu.emitIncrementA()`/`emitDecrementA()`
 * when the immediate value is 1.
 *
 * @module __tests__/codegen/unit/arithmetic-65c02
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArithmeticOpsGenerator } from '../../../codegen/generator/arithmetic.js';
import { AsmILElement, AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';
import { ILInstruction, ILOpcode, ILProgram } from '../../../il/index.js';
import { ILOperand, ImmediateOperand } from '../../../il/operands.js';
import type { CpuTarget } from '../../../codegen/cpu/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Testable subclass exposing the protected genAddImm and genSubImm methods.
 *
 * Constructor accepts cpuTarget to test both 6502 and 65C02 behavior.
 */
class TestableArithmetic65C02 extends ArithmeticOpsGenerator {
  /**
   * Exposes genAddImm for direct testing.
   */
  public testGenAddImm(instr: ILInstruction): void {
    this.genAddImm(instr);
  }

  /**
   * Exposes genSubImm for direct testing.
   */
  public testGenSubImm(instr: ILInstruction): void {
    this.genSubImm(instr);
  }

  /**
   * Gets the generated ASM-IL elements for inspection.
   */
  public getElements(): AsmILElement[] {
    return this.asm.getAllElements();
  }

  /** Override to not throw on unhandled opcodes during testing. */
  public generate(_program: ILProgram): never {
    throw new Error('Not implemented for testing');
  }
}

/**
 * Extracts instruction mnemonics from generated output.
 */
function getMnemonics(elements: AsmILElement[]): string[] {
  return elements
    .filter(isInstructionElement)
    .map(e => e.instruction.mnemonic);
}

/**
 * Extracts full instruction details from generated output.
 */
function getInstructions(elements: AsmILElement[]) {
  return elements
    .filter(isInstructionElement)
    .map(e => e.instruction);
}

/**
 * Creates an immediate operand for testing.
 */
function createImmediateOp(value: number): ImmediateOperand {
  return { kind: 'immediate', value, isWord: false };
}

/**
 * Creates an ADD_IMM instruction for testing.
 *
 * @param value - Immediate value to add
 * @returns IL instruction
 */
function createAddImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.ADD_IMM,
    operands: [createImmediateOp(value)] as ILOperand[],
    comment: `Add immediate ${value}`,
  };
}

/**
 * Creates a SUB_IMM instruction for testing.
 *
 * @param value - Immediate value to subtract
 * @returns IL instruction
 */
function createSubImmInstr(value: number): ILInstruction {
  return {
    opcode: ILOpcode.SUB_IMM,
    operands: [createImmediateOp(value)] as ILOperand[],
    comment: `Sub immediate ${value}`,
  };
}

/**
 * Creates a testable generator for the given CPU target.
 *
 * @param cpuTarget - Target CPU ('6502' or '65c02')
 * @returns TestableArithmetic65C02 instance
 */
function createGenerator(cpuTarget: CpuTarget): TestableArithmetic65C02 {
  return new TestableArithmetic65C02('test', cpuTarget);
}

// ============================================================================
// 65C02 Arithmetic Tests
// ============================================================================

describe('Arithmetic Operations — 65C02 (INC A / DEC A)', () => {
  let gen65c02: TestableArithmetic65C02;
  let gen6502: TestableArithmetic65C02;

  beforeEach(() => {
    gen65c02 = createGenerator('65c02');
    gen6502 = createGenerator('6502');
  });

  // --------------------------------------------------------------------------
  // ADD_IMM 1 → INC A on 65C02
  // --------------------------------------------------------------------------

  describe('genAddImm(1) — INC A on 65C02', () => {
    it('65C02 emits INC with accumulator addressing for ADD_IMM 1', () => {
      gen65c02.testGenAddImm(createAddImmInstr(1));

      const instrs = getInstructions(gen65c02.getElements());
      const incInstr = instrs.find(i => i.mnemonic === 'INC');
      expect(incInstr).toBeDefined();
      expect(incInstr!.mode).toBe(AsmAddressingMode.Accumulator);
    });

    it('6502 emits CLC + ADC #1 for ADD_IMM 1', () => {
      gen6502.testGenAddImm(createAddImmInstr(1));

      const mnemonics = getMnemonics(gen6502.getElements());
      expect(mnemonics).toContain('CLC');
      expect(mnemonics).toContain('ADC');
    });

    it('65C02 does NOT emit CLC or ADC for ADD_IMM 1', () => {
      gen65c02.testGenAddImm(createAddImmInstr(1));

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).not.toContain('CLC');
      expect(mnemonics).not.toContain('ADC');
    });

    it('65C02 produces fewer instructions than 6502 for ADD_IMM 1', () => {
      gen65c02.testGenAddImm(createAddImmInstr(1));
      gen6502.testGenAddImm(createAddImmInstr(1));

      const count65c02 = getInstructions(gen65c02.getElements()).length;
      const count6502 = getInstructions(gen6502.getElements()).length;
      expect(count65c02).toBeLessThan(count6502);
    });

    it('65C02 produces exactly 1 instruction for ADD_IMM 1', () => {
      gen65c02.testGenAddImm(createAddImmInstr(1));

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs).toHaveLength(1);
    });

    it('6502 produces exactly 2 instructions for ADD_IMM 1', () => {
      gen6502.testGenAddImm(createAddImmInstr(1));

      const instrs = getInstructions(gen6502.getElements());
      expect(instrs).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // SUB_IMM 1 → DEC A on 65C02
  // --------------------------------------------------------------------------

  describe('genSubImm(1) — DEC A on 65C02', () => {
    it('65C02 emits DEC with accumulator addressing for SUB_IMM 1', () => {
      gen65c02.testGenSubImm(createSubImmInstr(1));

      const instrs = getInstructions(gen65c02.getElements());
      const decInstr = instrs.find(i => i.mnemonic === 'DEC');
      expect(decInstr).toBeDefined();
      expect(decInstr!.mode).toBe(AsmAddressingMode.Accumulator);
    });

    it('6502 emits SEC + SBC #1 for SUB_IMM 1', () => {
      gen6502.testGenSubImm(createSubImmInstr(1));

      const mnemonics = getMnemonics(gen6502.getElements());
      expect(mnemonics).toContain('SEC');
      expect(mnemonics).toContain('SBC');
    });

    it('65C02 does NOT emit SEC or SBC for SUB_IMM 1', () => {
      gen65c02.testGenSubImm(createSubImmInstr(1));

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).not.toContain('SEC');
      expect(mnemonics).not.toContain('SBC');
    });

    it('65C02 produces fewer instructions than 6502 for SUB_IMM 1', () => {
      gen65c02.testGenSubImm(createSubImmInstr(1));
      gen6502.testGenSubImm(createSubImmInstr(1));

      const count65c02 = getInstructions(gen65c02.getElements()).length;
      const count6502 = getInstructions(gen6502.getElements()).length;
      expect(count65c02).toBeLessThan(count6502);
    });

    it('65C02 produces exactly 1 instruction for SUB_IMM 1', () => {
      gen65c02.testGenSubImm(createSubImmInstr(1));

      const instrs = getInstructions(gen65c02.getElements());
      expect(instrs).toHaveLength(1);
    });

    it('6502 produces exactly 2 instructions for SUB_IMM 1', () => {
      gen6502.testGenSubImm(createSubImmInstr(1));

      const instrs = getInstructions(gen6502.getElements());
      expect(instrs).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // Non-1 values use standard CLC+ADC / SEC+SBC on BOTH CPUs
  // --------------------------------------------------------------------------

  describe('non-1 values use standard sequence on both CPUs', () => {
    it('65C02 uses CLC + ADC for ADD_IMM 5 (not INC A)', () => {
      gen65c02.testGenAddImm(createAddImmInstr(5));

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).toContain('CLC');
      expect(mnemonics).toContain('ADC');
      expect(mnemonics).not.toContain('INC');
    });

    it('65C02 uses SEC + SBC for SUB_IMM 10 (not DEC A)', () => {
      gen65c02.testGenSubImm(createSubImmInstr(10));

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).toContain('SEC');
      expect(mnemonics).toContain('SBC');
      expect(mnemonics).not.toContain('DEC');
    });

    it('65C02 uses CLC + ADC for ADD_IMM 0', () => {
      gen65c02.testGenAddImm(createAddImmInstr(0));

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).toContain('CLC');
      expect(mnemonics).toContain('ADC');
    });

    it('65C02 uses SEC + SBC for SUB_IMM 255', () => {
      gen65c02.testGenSubImm(createSubImmInstr(255));

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).toContain('SEC');
      expect(mnemonics).toContain('SBC');
    });

    it('both CPUs produce same instruction count for ADD_IMM 5', () => {
      gen65c02.testGenAddImm(createAddImmInstr(5));
      gen6502.testGenAddImm(createAddImmInstr(5));

      const count65c02 = getInstructions(gen65c02.getElements()).length;
      const count6502 = getInstructions(gen6502.getElements()).length;
      expect(count65c02).toBe(count6502);
    });

    it('both CPUs produce same instruction count for SUB_IMM 10', () => {
      gen65c02.testGenSubImm(createSubImmInstr(10));
      gen6502.testGenSubImm(createSubImmInstr(10));

      const count65c02 = getInstructions(gen65c02.getElements()).length;
      const count6502 = getInstructions(gen6502.getElements()).length;
      expect(count65c02).toBe(count6502);
    });
  });
});
