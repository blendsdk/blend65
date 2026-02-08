/**
 * 65C02 Control Flow Operations Tests
 *
 * Verifies that the control flow operations layer uses BRA (65C02 native)
 * instead of the 6502 JMP instruction for unconditional jumps when
 * the CPU target is set to '65c02'.
 *
 * BRA (Branch Always) is a 2-byte relative branch instruction on the 65C02,
 * saving 1 byte compared to the 3-byte absolute JMP on the 6502.
 *
 * Tests focus on the `genJump()` method refactored in Phase 4 to use
 * `this.cpu.emitBranchAlways()`.
 *
 * @module __tests__/codegen/unit/control-flow-65c02
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ControlFlowOpsGenerator } from '../../../codegen/generator/control.js';
import { AsmILElement, AsmILProgram, AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';
import { ILInstruction, ILOpcode, ILProgram } from '../../../il/index.js';
import { ILOperand, LabelOperand } from '../../../il/operands.js';
import type { CpuTarget } from '../../../codegen/cpu/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Testable subclass exposing the protected genJump method.
 *
 * Constructor accepts cpuTarget to test both 6502 and 65C02 behavior.
 */
class TestableControlFlow65C02 extends ControlFlowOpsGenerator {
  /**
   * Exposes genJump for direct testing.
   */
  public testGenJump(instr: ILInstruction): void {
    this.genJump(instr);
  }

  /**
   * Gets the generated ASM-IL elements for inspection.
   */
  public getElements(): AsmILElement[] {
    return this.asm.getAllElements();
  }

  /** Override to not throw on unhandled opcodes during testing. */
  public generate(_program: ILProgram): AsmILProgram {
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
 * Creates a label operand for testing.
 */
function createLabelOp(name: string): LabelOperand {
  return { kind: 'label', name };
}

/**
 * Creates a JUMP instruction for testing.
 *
 * @param label - Target label name
 * @returns IL instruction
 */
function createJumpInstr(label: string): ILInstruction {
  return {
    opcode: ILOpcode.JUMP,
    operands: [createLabelOp(label)] as ILOperand[],
    comment: `Jump to ${label}`,
  };
}

/**
 * Creates a testable generator for the given CPU target.
 *
 * @param cpuTarget - Target CPU ('6502' or '65c02')
 * @returns TestableControlFlow65C02 instance
 */
function createGenerator(cpuTarget: CpuTarget): TestableControlFlow65C02 {
  return new TestableControlFlow65C02('test', cpuTarget);
}

// ============================================================================
// 65C02 Control Flow Tests
// ============================================================================

describe('Control Flow Operations — 65C02 (BRA)', () => {
  let gen65c02: TestableControlFlow65C02;
  let gen6502: TestableControlFlow65C02;

  beforeEach(() => {
    gen65c02 = createGenerator('65c02');
    gen6502 = createGenerator('6502');
  });

  // --------------------------------------------------------------------------
  // BRA instead of JMP
  // --------------------------------------------------------------------------

  describe('genJump — BRA on 65C02', () => {
    it('65C02 emits BRA with relative addressing', () => {
      gen65c02.testGenJump(createJumpInstr('loop_start'));

      const instrs = getInstructions(gen65c02.getElements());
      // Filter out comment elements — only check instructions
      expect(instrs.length).toBeGreaterThanOrEqual(1);

      // Find the branch/jump instruction
      const branchInstr = instrs.find(i => i.mnemonic === 'BRA' || i.mnemonic === 'JMP');
      expect(branchInstr).toBeDefined();
      expect(branchInstr!.mnemonic).toBe('BRA');
      expect(branchInstr!.mode).toBe(AsmAddressingMode.Relative);
    });

    it('6502 emits JMP with absolute addressing', () => {
      gen6502.testGenJump(createJumpInstr('loop_start'));

      const instrs = getInstructions(gen6502.getElements());
      const jumpInstr = instrs.find(i => i.mnemonic === 'BRA' || i.mnemonic === 'JMP');
      expect(jumpInstr).toBeDefined();
      expect(jumpInstr!.mnemonic).toBe('JMP');
    });

    it('65C02 does NOT emit JMP', () => {
      gen65c02.testGenJump(createJumpInstr('target'));

      const mnemonics = getMnemonics(gen65c02.getElements());
      expect(mnemonics).not.toContain('JMP');
    });

    it('6502 does NOT emit BRA', () => {
      gen6502.testGenJump(createJumpInstr('target'));

      const mnemonics = getMnemonics(gen6502.getElements());
      expect(mnemonics).not.toContain('BRA');
    });
  });

  // --------------------------------------------------------------------------
  // Label references
  // --------------------------------------------------------------------------

  describe('label references', () => {
    it('65C02 BRA references the correct label', () => {
      gen65c02.testGenJump(createJumpInstr('loop_body'));

      const instrs = getInstructions(gen65c02.getElements());
      const braInstr = instrs.find(i => i.mnemonic === 'BRA');
      expect(braInstr).toBeDefined();
      // The label gets prefixed with '.' by localLabel()
      expect(braInstr!.labelOperand).toBe('.loop_body');
    });

    it('6502 JMP references the correct label', () => {
      gen6502.testGenJump(createJumpInstr('loop_body'));

      const instrs = getInstructions(gen6502.getElements());
      const jmpInstr = instrs.find(i => i.mnemonic === 'JMP');
      expect(jmpInstr).toBeDefined();
      expect(jmpInstr!.labelOperand).toBe('.loop_body');
    });
  });

  // --------------------------------------------------------------------------
  // Instruction count comparison
  // --------------------------------------------------------------------------

  describe('instruction count comparison', () => {
    it('both 6502 and 65C02 produce exactly 1 branch/jump instruction', () => {
      gen65c02.testGenJump(createJumpInstr('end'));
      gen6502.testGenJump(createJumpInstr('end'));

      // Both should produce exactly 1 branch/jump instruction
      // (BRA and JMP are both single instructions, just different sizes)
      const instrs65c02 = getInstructions(gen65c02.getElements());
      const instrs6502 = getInstructions(gen6502.getElements());

      const branchCount65c02 = instrs65c02.filter(
        i => i.mnemonic === 'BRA' || i.mnemonic === 'JMP'
      ).length;
      const branchCount6502 = instrs6502.filter(
        i => i.mnemonic === 'BRA' || i.mnemonic === 'JMP'
      ).length;

      expect(branchCount65c02).toBe(1);
      expect(branchCount6502).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Various label names
  // --------------------------------------------------------------------------

  describe('various label names', () => {
    it('handles simple label names', () => {
      gen65c02.testGenJump(createJumpInstr('start'));

      const instrs = getInstructions(gen65c02.getElements());
      const braInstr = instrs.find(i => i.mnemonic === 'BRA');
      expect(braInstr).toBeDefined();
      expect(braInstr!.labelOperand).toBe('.start');
    });

    it('handles underscore label names', () => {
      gen65c02.testGenJump(createJumpInstr('while_end'));

      const instrs = getInstructions(gen65c02.getElements());
      const braInstr = instrs.find(i => i.mnemonic === 'BRA');
      expect(braInstr).toBeDefined();
      expect(braInstr!.labelOperand).toBe('.while_end');
    });

    it('handles loop label names', () => {
      gen65c02.testGenJump(createJumpInstr('for_body'));

      const instrs = getInstructions(gen65c02.getElements());
      const braInstr = instrs.find(i => i.mnemonic === 'BRA');
      expect(braInstr).toBeDefined();
      expect(braInstr!.labelOperand).toBe('.for_body');
    });
  });
});
