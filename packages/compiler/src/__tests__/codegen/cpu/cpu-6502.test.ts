/**
 * MOS 6502 Instruction Set Tests
 *
 * Verifies that Cpu6502InstructionSet emits correct multi-instruction
 * sequences for operations the 6502 doesn't have as single opcodes.
 *
 * @module __tests__/codegen/cpu/cpu-6502
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Cpu6502InstructionSet } from '../../../codegen/cpu/cpu-6502.js';
import { AsmILBuilder } from '../../../codegen/asm-il/builder.js';
import { AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Extracts instruction mnemonics from builder output for easy assertion.
 */
function getMnemonics(asm: AsmILBuilder): string[] {
  return asm.getAllElements()
    .filter(isInstructionElement)
    .map(e => e.instruction.mnemonic);
}

/**
 * Extracts full instruction details from builder output.
 */
function getInstructions(asm: AsmILBuilder) {
  return asm.getAllElements()
    .filter(isInstructionElement)
    .map(e => e.instruction);
}

// ============================================================================
// Cpu6502InstructionSet Tests
// ============================================================================

describe('Cpu6502InstructionSet', () => {
  let cpu: Cpu6502InstructionSet;
  let asm: AsmILBuilder;

  beforeEach(() => {
    cpu = new Cpu6502InstructionSet();
    asm = new AsmILBuilder('test');
  });

  // --------------------------------------------------------------------------
  // emitStoreZero
  // --------------------------------------------------------------------------

  describe('emitStoreZero', () => {
    it('emits LDA #0 + STA zp for zero page address', () => {
      cpu.emitStoreZero(asm, 0x10, true);

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(2);
      expect(instrs[0].mnemonic).toBe('LDA');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Immediate);
      expect(instrs[0].operand).toBe(0);
      expect(instrs[1].mnemonic).toBe('STA');
      expect(instrs[1].mode).toBe(AsmAddressingMode.ZeroPage);
      expect(instrs[1].operand).toBe(0x10);
    });

    it('emits LDA #0 + STA abs for absolute address', () => {
      cpu.emitStoreZero(asm, 0xD020, false);

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(2);
      expect(instrs[0].mnemonic).toBe('LDA');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Immediate);
      expect(instrs[0].operand).toBe(0);
      expect(instrs[1].mnemonic).toBe('STA');
      expect(instrs[1].mode).toBe(AsmAddressingMode.Absolute);
      expect(instrs[1].operand).toBe(0xD020);
    });

    it('passes comment to LDA instruction', () => {
      cpu.emitStoreZero(asm, 0x10, true, 'clear counter');

      const instrs = getInstructions(asm);
      expect(instrs[0].comment).toBe('clear counter');
    });
  });

  // --------------------------------------------------------------------------
  // emitBranchAlways
  // --------------------------------------------------------------------------

  describe('emitBranchAlways', () => {
    it('emits JMP with absolute addressing', () => {
      cpu.emitBranchAlways(asm, 'loop_start');

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('JMP');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Absolute);
      expect(instrs[0].labelOperand).toBe('loop_start');
    });

    it('passes comment to JMP instruction', () => {
      cpu.emitBranchAlways(asm, 'end', 'skip over');

      const instrs = getInstructions(asm);
      expect(instrs[0].comment).toBe('skip over');
    });
  });

  // --------------------------------------------------------------------------
  // emitIncrementA
  // --------------------------------------------------------------------------

  describe('emitIncrementA', () => {
    it('emits CLC + ADC #1', () => {
      cpu.emitIncrementA(asm);

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(2);
      expect(instrs[0].mnemonic).toBe('CLC');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Implied);
      expect(instrs[1].mnemonic).toBe('ADC');
      expect(instrs[1].mode).toBe(AsmAddressingMode.Immediate);
      expect(instrs[1].operand).toBe(1);
    });

    it('passes comment to ADC instruction', () => {
      cpu.emitIncrementA(asm, 'bump counter');

      const instrs = getInstructions(asm);
      expect(instrs[1].comment).toBe('bump counter');
    });
  });

  // --------------------------------------------------------------------------
  // emitDecrementA
  // --------------------------------------------------------------------------

  describe('emitDecrementA', () => {
    it('emits SEC + SBC #1', () => {
      cpu.emitDecrementA(asm);

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(2);
      expect(instrs[0].mnemonic).toBe('SEC');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Implied);
      expect(instrs[1].mnemonic).toBe('SBC');
      expect(instrs[1].mode).toBe(AsmAddressingMode.Immediate);
      expect(instrs[1].operand).toBe(1);
    });

    it('passes comment to SBC instruction', () => {
      cpu.emitDecrementA(asm, 'dec counter');

      const instrs = getInstructions(asm);
      expect(instrs[1].comment).toBe('dec counter');
    });
  });

  // --------------------------------------------------------------------------
  // emitPushX / emitPullX
  // --------------------------------------------------------------------------

  describe('emitPushX', () => {
    it('emits TXA + PHA (clobbers A)', () => {
      cpu.emitPushX(asm);

      const mnemonics = getMnemonics(asm);
      expect(mnemonics).toEqual(['TXA', 'PHA']);
    });

    it('passes comment to TXA instruction', () => {
      cpu.emitPushX(asm, 'save X');

      const instrs = getInstructions(asm);
      expect(instrs[0].comment).toBe('save X');
    });
  });

  describe('emitPullX', () => {
    it('emits PLA + TAX (clobbers A)', () => {
      cpu.emitPullX(asm);

      const mnemonics = getMnemonics(asm);
      expect(mnemonics).toEqual(['PLA', 'TAX']);
    });

    it('passes comment to TAX instruction', () => {
      cpu.emitPullX(asm, 'restore X');

      const instrs = getInstructions(asm);
      expect(instrs[1].comment).toBe('restore X');
    });
  });

  // --------------------------------------------------------------------------
  // emitPushY / emitPullY
  // --------------------------------------------------------------------------

  describe('emitPushY', () => {
    it('emits TYA + PHA (clobbers A)', () => {
      cpu.emitPushY(asm);

      const mnemonics = getMnemonics(asm);
      expect(mnemonics).toEqual(['TYA', 'PHA']);
    });

    it('passes comment to TYA instruction', () => {
      cpu.emitPushY(asm, 'save Y');

      const instrs = getInstructions(asm);
      expect(instrs[0].comment).toBe('save Y');
    });
  });

  describe('emitPullY', () => {
    it('emits PLA + TAY (clobbers A)', () => {
      cpu.emitPullY(asm);

      const mnemonics = getMnemonics(asm);
      expect(mnemonics).toEqual(['PLA', 'TAY']);
    });

    it('passes comment to TAY instruction', () => {
      cpu.emitPullY(asm, 'restore Y');

      const instrs = getInstructions(asm);
      expect(instrs[1].comment).toBe('restore Y');
    });
  });

  // --------------------------------------------------------------------------
  // Instruction Count Verification
  // --------------------------------------------------------------------------

  describe('instruction counts (6502 uses multi-instruction sequences)', () => {
    it('emitStoreZero produces 2 instructions', () => {
      cpu.emitStoreZero(asm, 0x10, true);
      expect(getInstructions(asm)).toHaveLength(2);
    });

    it('emitBranchAlways produces 1 instruction (JMP)', () => {
      cpu.emitBranchAlways(asm, 'lbl');
      expect(getInstructions(asm)).toHaveLength(1);
    });

    it('emitIncrementA produces 2 instructions', () => {
      cpu.emitIncrementA(asm);
      expect(getInstructions(asm)).toHaveLength(2);
    });

    it('emitDecrementA produces 2 instructions', () => {
      cpu.emitDecrementA(asm);
      expect(getInstructions(asm)).toHaveLength(2);
    });

    it('emitPushX produces 2 instructions', () => {
      cpu.emitPushX(asm);
      expect(getInstructions(asm)).toHaveLength(2);
    });

    it('emitPullX produces 2 instructions', () => {
      cpu.emitPullX(asm);
      expect(getInstructions(asm)).toHaveLength(2);
    });

    it('emitPushY produces 2 instructions', () => {
      cpu.emitPushY(asm);
      expect(getInstructions(asm)).toHaveLength(2);
    });

    it('emitPullY produces 2 instructions', () => {
      cpu.emitPullY(asm);
      expect(getInstructions(asm)).toHaveLength(2);
    });
  });
});
