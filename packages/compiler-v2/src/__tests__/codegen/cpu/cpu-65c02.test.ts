/**
 * WDC 65C02 Instruction Set Tests
 *
 * Verifies that Cpu65C02InstructionSet emits single dedicated
 * instructions for operations that require multi-instruction
 * sequences on the base 6502.
 *
 * @module __tests__/codegen/cpu/cpu-65c02
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Cpu65C02InstructionSet } from '../../../codegen/cpu/cpu-65c02.js';
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
// Cpu65C02InstructionSet Tests
// ============================================================================

describe('Cpu65C02InstructionSet', () => {
  let cpu: Cpu65C02InstructionSet;
  let asm: AsmILBuilder;

  beforeEach(() => {
    cpu = new Cpu65C02InstructionSet();
    asm = new AsmILBuilder('test');
  });

  // --------------------------------------------------------------------------
  // emitStoreZero (STZ)
  // --------------------------------------------------------------------------

  describe('emitStoreZero', () => {
    it('emits STZ with zero page addressing', () => {
      cpu.emitStoreZero(asm, 0x10, true);

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('STZ');
      expect(instrs[0].mode).toBe(AsmAddressingMode.ZeroPage);
      expect(instrs[0].operand).toBe(0x10);
    });

    it('emits STZ with absolute addressing', () => {
      cpu.emitStoreZero(asm, 0xD020, false);

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('STZ');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Absolute);
      expect(instrs[0].operand).toBe(0xD020);
    });

    it('passes comment to STZ instruction', () => {
      cpu.emitStoreZero(asm, 0x10, true, 'clear counter');

      const instrs = getInstructions(asm);
      expect(instrs[0].comment).toBe('clear counter');
    });

    it('does NOT emit LDA (preserves accumulator)', () => {
      cpu.emitStoreZero(asm, 0x10, true);

      const mnemonics = getMnemonics(asm);
      expect(mnemonics).not.toContain('LDA');
    });
  });

  // --------------------------------------------------------------------------
  // emitBranchAlways (BRA)
  // --------------------------------------------------------------------------

  describe('emitBranchAlways', () => {
    it('emits BRA with relative addressing', () => {
      cpu.emitBranchAlways(asm, 'loop_start');

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('BRA');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Relative);
      expect(instrs[0].labelOperand).toBe('loop_start');
    });

    it('does NOT emit JMP (uses relative BRA instead)', () => {
      cpu.emitBranchAlways(asm, 'target');

      const mnemonics = getMnemonics(asm);
      expect(mnemonics).not.toContain('JMP');
    });

    it('passes comment to BRA instruction', () => {
      cpu.emitBranchAlways(asm, 'end', 'skip over');

      const instrs = getInstructions(asm);
      expect(instrs[0].comment).toBe('skip over');
    });
  });

  // --------------------------------------------------------------------------
  // emitIncrementA (INC A)
  // --------------------------------------------------------------------------

  describe('emitIncrementA', () => {
    it('emits INC with accumulator addressing', () => {
      cpu.emitIncrementA(asm);

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('INC');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Accumulator);
    });

    it('does NOT emit CLC or ADC (preserves carry flag)', () => {
      cpu.emitIncrementA(asm);

      const mnemonics = getMnemonics(asm);
      expect(mnemonics).not.toContain('CLC');
      expect(mnemonics).not.toContain('ADC');
    });

    it('passes comment to INC instruction', () => {
      cpu.emitIncrementA(asm, 'bump counter');

      const instrs = getInstructions(asm);
      expect(instrs[0].comment).toBe('bump counter');
    });
  });

  // --------------------------------------------------------------------------
  // emitDecrementA (DEC A)
  // --------------------------------------------------------------------------

  describe('emitDecrementA', () => {
    it('emits DEC with accumulator addressing', () => {
      cpu.emitDecrementA(asm);

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('DEC');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Accumulator);
    });

    it('does NOT emit SEC or SBC (preserves carry flag)', () => {
      cpu.emitDecrementA(asm);

      const mnemonics = getMnemonics(asm);
      expect(mnemonics).not.toContain('SEC');
      expect(mnemonics).not.toContain('SBC');
    });

    it('passes comment to DEC instruction', () => {
      cpu.emitDecrementA(asm, 'dec counter');

      const instrs = getInstructions(asm);
      expect(instrs[0].comment).toBe('dec counter');
    });
  });

  // --------------------------------------------------------------------------
  // emitPushX / emitPullX (PHX / PLX)
  // --------------------------------------------------------------------------

  describe('emitPushX', () => {
    it('emits PHX with implied addressing', () => {
      cpu.emitPushX(asm);

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('PHX');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Implied);
    });

    it('does NOT emit TXA or PHA (preserves accumulator)', () => {
      cpu.emitPushX(asm);

      const mnemonics = getMnemonics(asm);
      expect(mnemonics).not.toContain('TXA');
      expect(mnemonics).not.toContain('PHA');
    });

    it('passes comment to PHX instruction', () => {
      cpu.emitPushX(asm, 'save X');

      const instrs = getInstructions(asm);
      expect(instrs[0].comment).toBe('save X');
    });
  });

  describe('emitPullX', () => {
    it('emits PLX with implied addressing', () => {
      cpu.emitPullX(asm);

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('PLX');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Implied);
    });

    it('does NOT emit PLA or TAX (preserves accumulator)', () => {
      cpu.emitPullX(asm);

      const mnemonics = getMnemonics(asm);
      expect(mnemonics).not.toContain('PLA');
      expect(mnemonics).not.toContain('TAX');
    });

    it('passes comment to PLX instruction', () => {
      cpu.emitPullX(asm, 'restore X');

      const instrs = getInstructions(asm);
      expect(instrs[0].comment).toBe('restore X');
    });
  });

  // --------------------------------------------------------------------------
  // emitPushY / emitPullY (PHY / PLY)
  // --------------------------------------------------------------------------

  describe('emitPushY', () => {
    it('emits PHY with implied addressing', () => {
      cpu.emitPushY(asm);

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('PHY');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Implied);
    });

    it('does NOT emit TYA or PHA (preserves accumulator)', () => {
      cpu.emitPushY(asm);

      const mnemonics = getMnemonics(asm);
      expect(mnemonics).not.toContain('TYA');
      expect(mnemonics).not.toContain('PHA');
    });

    it('passes comment to PHY instruction', () => {
      cpu.emitPushY(asm, 'save Y');

      const instrs = getInstructions(asm);
      expect(instrs[0].comment).toBe('save Y');
    });
  });

  describe('emitPullY', () => {
    it('emits PLY with implied addressing', () => {
      cpu.emitPullY(asm);

      const instrs = getInstructions(asm);
      expect(instrs).toHaveLength(1);
      expect(instrs[0].mnemonic).toBe('PLY');
      expect(instrs[0].mode).toBe(AsmAddressingMode.Implied);
    });

    it('does NOT emit PLA or TAY (preserves accumulator)', () => {
      cpu.emitPullY(asm);

      const mnemonics = getMnemonics(asm);
      expect(mnemonics).not.toContain('PLA');
      expect(mnemonics).not.toContain('TAY');
    });

    it('passes comment to PLY instruction', () => {
      cpu.emitPullY(asm, 'restore Y');

      const instrs = getInstructions(asm);
      expect(instrs[0].comment).toBe('restore Y');
    });
  });

  // --------------------------------------------------------------------------
  // Instruction Count Verification (all single instructions)
  // --------------------------------------------------------------------------

  describe('instruction counts (65C02 uses single instructions)', () => {
    it('emitStoreZero produces 1 instruction (STZ)', () => {
      cpu.emitStoreZero(asm, 0x10, true);
      expect(getInstructions(asm)).toHaveLength(1);
    });

    it('emitBranchAlways produces 1 instruction (BRA)', () => {
      cpu.emitBranchAlways(asm, 'lbl');
      expect(getInstructions(asm)).toHaveLength(1);
    });

    it('emitIncrementA produces 1 instruction (INC A)', () => {
      cpu.emitIncrementA(asm);
      expect(getInstructions(asm)).toHaveLength(1);
    });

    it('emitDecrementA produces 1 instruction (DEC A)', () => {
      cpu.emitDecrementA(asm);
      expect(getInstructions(asm)).toHaveLength(1);
    });

    it('emitPushX produces 1 instruction (PHX)', () => {
      cpu.emitPushX(asm);
      expect(getInstructions(asm)).toHaveLength(1);
    });

    it('emitPullX produces 1 instruction (PLX)', () => {
      cpu.emitPullX(asm);
      expect(getInstructions(asm)).toHaveLength(1);
    });

    it('emitPushY produces 1 instruction (PHY)', () => {
      cpu.emitPushY(asm);
      expect(getInstructions(asm)).toHaveLength(1);
    });

    it('emitPullY produces 1 instruction (PLY)', () => {
      cpu.emitPullY(asm);
      expect(getInstructions(asm)).toHaveLength(1);
    });
  });
});
