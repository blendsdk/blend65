/**
 * Flag State Analyzer Tests
 *
 * Verifies that FlagStateAnalyzer correctly tracks 6502 CPU flag state
 * (C, Z, N, V) through instruction sequences.
 *
 * Tests cover:
 * - Explicit flag set/clear instructions (CLC, SEC, CLV)
 * - Instructions that set Z/N only (loads, logic, transfers, inc/dec)
 * - Instructions that set C/Z/N (arithmetic, compare, shift/rotate)
 * - Instructions that set V (ADC, SBC, BIT)
 * - Instructions that restore all flags (PLP, RTI)
 * - Instructions that don't affect flags (stores, stack, branches)
 * - Flag read detection for all branch types
 * - Composite queries (isAnyFlagRead, isAnyFlagModified)
 */

import { describe, it, expect } from 'vitest';
import { FlagStateAnalyzer } from '../../../../../codegen/asm-il/optimizer/analysis/flag-state.js';
import type { FlagState } from '../../../../../codegen/asm-il/optimizer/analysis/flag-state.js';
import { AsmAddressingMode } from '../../../../../codegen/asm-il/types.js';
import type { AsmInstruction } from '../../../../../codegen/asm-il/types.js';

// ============================================================================
// Helpers
// ============================================================================

/** Create an implied-mode instruction (no operand) */
function implied(mnemonic: string): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.Implied };
}

/** Create an immediate-mode instruction */
function immediate(mnemonic: string, operand: number): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.Immediate, operand };
}

/** Create an absolute-mode instruction */
function absolute(mnemonic: string, operand: number): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.Absolute, operand };
}

/** Create an accumulator-mode instruction */
function accumulator(mnemonic: string): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.Accumulator };
}

/** Create a relative-mode instruction (branches) */
function relative(mnemonic: string, label: string): AsmInstruction {
  return { mnemonic, mode: AsmAddressingMode.Relative, labelOperand: label };
}

// ============================================================================
// Tests
// ============================================================================

describe('FlagStateAnalyzer', () => {
  const analyzer = new FlagStateAnalyzer();

  describe('createInitialState', () => {
    it('should return all flags as undefined', () => {
      const state = analyzer.createInitialState();
      expect(state.carry).toBeUndefined();
      expect(state.zero).toBeUndefined();
      expect(state.negative).toBeUndefined();
      expect(state.overflow).toBeUndefined();
    });
  });

  // ==========================================================================
  // Explicit flag set/clear
  // ==========================================================================

  describe('explicit flag set/clear', () => {
    it('CLC should clear carry flag', () => {
      const before: FlagState = { carry: true, zero: undefined };
      const after = analyzer.analyze(implied('CLC'), before);
      expect(after.carry).toBe(false);
    });

    it('SEC should set carry flag', () => {
      const before: FlagState = { carry: false };
      const after = analyzer.analyze(implied('SEC'), before);
      expect(after.carry).toBe(true);
    });

    it('CLV should clear overflow flag', () => {
      const before: FlagState = { overflow: undefined };
      const after = analyzer.analyze(implied('CLV'), before);
      expect(after.overflow).toBe(false);
    });

    it('CLC should preserve other flags', () => {
      const before: FlagState = { carry: true, zero: false, negative: true, overflow: false };
      const after = analyzer.analyze(implied('CLC'), before);
      expect(after.carry).toBe(false);
      // Other flags unchanged
      expect(after.zero).toBe(false);
      expect(after.negative).toBe(true);
      expect(after.overflow).toBe(false);
    });

    it('SEC should preserve other flags', () => {
      const before: FlagState = { carry: false, zero: true, negative: false, overflow: true };
      const after = analyzer.analyze(implied('SEC'), before);
      expect(after.carry).toBe(true);
      expect(after.zero).toBe(true);
      expect(after.negative).toBe(false);
      expect(after.overflow).toBe(true);
    });
  });

  // ==========================================================================
  // Instructions that set Z, N only
  // ==========================================================================

  describe('instructions that set Z/N only', () => {
    const znInstructions = [
      'LDA', 'LDX', 'LDY',
      'AND', 'ORA', 'EOR',
      'TAX', 'TAY', 'TXA', 'TYA', 'TSX',
      'PLA',
    ];

    for (const mnemonic of znInstructions) {
      it(`${mnemonic} should set Z/N to unknown, preserve C/V`, () => {
        const before: FlagState = { carry: false, zero: true, negative: false, overflow: false };
        // Use immediate mode for loads/logic, implied for transfers
        const instr = ['LDA', 'LDX', 'LDY', 'AND', 'ORA', 'EOR'].includes(mnemonic)
          ? immediate(mnemonic, 0x42)
          : implied(mnemonic);
        const after = analyzer.analyze(instr, before);

        // Z and N become unknown
        expect(after.zero).toBeUndefined();
        expect(after.negative).toBeUndefined();

        // C and V preserved
        expect(after.carry).toBe(false);
        expect(after.overflow).toBe(false);
      });
    }

    it('INC (memory) should set Z/N to unknown, preserve C/V', () => {
      const before: FlagState = { carry: true, overflow: false, zero: false, negative: false };
      const after = analyzer.analyze(absolute('INC', 0x1000), before);
      expect(after.zero).toBeUndefined();
      expect(after.negative).toBeUndefined();
      expect(after.carry).toBe(true);
      expect(after.overflow).toBe(false);
    });

    const regIncDec = ['INX', 'INY', 'DEX', 'DEY'];
    for (const mnemonic of regIncDec) {
      it(`${mnemonic} should set Z/N to unknown, preserve C/V`, () => {
        const before: FlagState = { carry: true, overflow: true, zero: true, negative: true };
        const after = analyzer.analyze(implied(mnemonic), before);
        expect(after.zero).toBeUndefined();
        expect(after.negative).toBeUndefined();
        expect(after.carry).toBe(true);
        expect(after.overflow).toBe(true);
      });
    }

    it('DEC (memory) should set Z/N to unknown, preserve C/V', () => {
      const before: FlagState = { carry: false, overflow: true };
      const after = analyzer.analyze(absolute('DEC', 0x50), before);
      expect(after.zero).toBeUndefined();
      expect(after.negative).toBeUndefined();
      expect(after.carry).toBe(false);
      expect(after.overflow).toBe(true);
    });
  });

  // ==========================================================================
  // Instructions that set C, Z, N
  // ==========================================================================

  describe('instructions that set C/Z/N', () => {
    const cznInstructions = ['CMP', 'CPX', 'CPY', 'ASL', 'LSR', 'ROL', 'ROR'];

    for (const mnemonic of cznInstructions) {
      it(`${mnemonic} should set C/Z/N to unknown, preserve V`, () => {
        const before: FlagState = { carry: true, zero: true, negative: true, overflow: false };
        const instr = ['CMP', 'CPX', 'CPY'].includes(mnemonic)
          ? immediate(mnemonic, 0)
          : accumulator(mnemonic);
        const after = analyzer.analyze(instr, before);
        expect(after.carry).toBeUndefined();
        expect(after.zero).toBeUndefined();
        expect(after.negative).toBeUndefined();
        // Overflow preserved for non-ADC/SBC
        expect(after.overflow).toBe(false);
      });
    }
  });

  // ==========================================================================
  // ADC/SBC — set C, Z, N, V
  // ==========================================================================

  describe('ADC/SBC — set C/Z/N/V', () => {
    it('ADC should set C/Z/N/V all to unknown', () => {
      const before: FlagState = { carry: false, zero: true, negative: false, overflow: false };
      const after = analyzer.analyze(immediate('ADC', 1), before);
      expect(after.carry).toBeUndefined();
      expect(after.zero).toBeUndefined();
      expect(after.negative).toBeUndefined();
      expect(after.overflow).toBeUndefined();
    });

    it('SBC should set C/Z/N/V all to unknown', () => {
      const before: FlagState = { carry: true, zero: false, negative: true, overflow: true };
      const after = analyzer.analyze(immediate('SBC', 1), before);
      expect(after.carry).toBeUndefined();
      expect(after.zero).toBeUndefined();
      expect(after.negative).toBeUndefined();
      expect(after.overflow).toBeUndefined();
    });
  });

  // ==========================================================================
  // BIT instruction
  // ==========================================================================

  describe('BIT instruction', () => {
    it('BIT should set Z/N/V to unknown, preserve C', () => {
      const before: FlagState = { carry: true, zero: false, negative: false, overflow: false };
      const after = analyzer.analyze(absolute('BIT', 0x2000), before);
      expect(after.zero).toBeUndefined();
      expect(after.negative).toBeUndefined();
      expect(after.overflow).toBeUndefined();
      // Carry preserved
      expect(after.carry).toBe(true);
    });
  });

  // ==========================================================================
  // PLP / RTI — restore all flags
  // ==========================================================================

  describe('PLP / RTI — restore all flags', () => {
    it('PLP should set all flags to unknown', () => {
      const before: FlagState = { carry: true, zero: true, negative: true, overflow: true };
      const after = analyzer.analyze(implied('PLP'), before);
      expect(after.carry).toBeUndefined();
      expect(after.zero).toBeUndefined();
      expect(after.negative).toBeUndefined();
      expect(after.overflow).toBeUndefined();
    });

    it('RTI should set all flags to unknown', () => {
      const before: FlagState = { carry: false, zero: false, negative: false, overflow: false };
      const after = analyzer.analyze(implied('RTI'), before);
      expect(after.carry).toBeUndefined();
      expect(after.zero).toBeUndefined();
      expect(after.negative).toBeUndefined();
      expect(after.overflow).toBeUndefined();
    });
  });

  // ==========================================================================
  // Instructions that don't affect flags
  // ==========================================================================

  describe('instructions that do not modify flags', () => {
    const noFlagInstructions = ['STA', 'STX', 'STY', 'PHA', 'PHP', 'NOP', 'JMP', 'JSR', 'RTS', 'BRK', 'TXS'];

    for (const mnemonic of noFlagInstructions) {
      it(`${mnemonic} should preserve all flags`, () => {
        const before: FlagState = { carry: true, zero: false, negative: true, overflow: false };
        const instr = ['STA', 'STX', 'STY'].includes(mnemonic)
          ? absolute(mnemonic, 0x1000)
          : ['JMP', 'JSR'].includes(mnemonic)
            ? absolute(mnemonic, 0x2000)
            : implied(mnemonic);
        const after = analyzer.analyze(instr, before);
        expect(after.carry).toBe(true);
        expect(after.zero).toBe(false);
        expect(after.negative).toBe(true);
        expect(after.overflow).toBe(false);
      });
    }
  });

  // ==========================================================================
  // Branch instructions don't modify flags
  // ==========================================================================

  describe('branch instructions preserve flags', () => {
    const branches = ['BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS'];

    for (const mnemonic of branches) {
      it(`${mnemonic} should not modify any flags`, () => {
        const before: FlagState = { carry: true, zero: true, negative: false, overflow: true };
        const after = analyzer.analyze(relative(mnemonic, '.loop'), before);
        expect(after.carry).toBe(true);
        expect(after.zero).toBe(true);
        expect(after.negative).toBe(false);
        expect(after.overflow).toBe(true);
      });
    }
  });

  // ==========================================================================
  // Immutability
  // ==========================================================================

  describe('immutability', () => {
    it('should not mutate the input state', () => {
      const before: FlagState = { carry: true, zero: false, negative: true, overflow: false };
      const beforeCopy = { ...before };
      analyzer.analyze(implied('CLC'), before);
      // Original state unchanged
      expect(before).toEqual(beforeCopy);
    });
  });

  // ==========================================================================
  // Flag read detection
  // ==========================================================================

  describe('isCarryRead', () => {
    it('should return true for ADC, SBC, ROL, ROR, BCC, BCS', () => {
      expect(analyzer.isCarryRead(immediate('ADC', 1))).toBe(true);
      expect(analyzer.isCarryRead(immediate('SBC', 1))).toBe(true);
      expect(analyzer.isCarryRead(accumulator('ROL'))).toBe(true);
      expect(analyzer.isCarryRead(accumulator('ROR'))).toBe(true);
      expect(analyzer.isCarryRead(relative('BCC', '.label'))).toBe(true);
      expect(analyzer.isCarryRead(relative('BCS', '.label'))).toBe(true);
    });

    it('should return false for non-carry instructions', () => {
      expect(analyzer.isCarryRead(immediate('LDA', 0))).toBe(false);
      expect(analyzer.isCarryRead(implied('NOP'))).toBe(false);
      expect(analyzer.isCarryRead(relative('BEQ', '.x'))).toBe(false);
    });
  });

  describe('isZeroRead', () => {
    it('should return true for BEQ, BNE', () => {
      expect(analyzer.isZeroRead(relative('BEQ', '.done'))).toBe(true);
      expect(analyzer.isZeroRead(relative('BNE', '.loop'))).toBe(true);
    });

    it('should return false for non-zero-flag instructions', () => {
      expect(analyzer.isZeroRead(immediate('LDA', 0))).toBe(false);
      expect(analyzer.isZeroRead(relative('BCC', '.x'))).toBe(false);
    });
  });

  describe('isNegativeRead', () => {
    it('should return true for BMI, BPL', () => {
      expect(analyzer.isNegativeRead(relative('BMI', '.neg'))).toBe(true);
      expect(analyzer.isNegativeRead(relative('BPL', '.pos'))).toBe(true);
    });

    it('should return false for non-negative-flag instructions', () => {
      expect(analyzer.isNegativeRead(relative('BEQ', '.x'))).toBe(false);
    });
  });

  describe('isOverflowRead', () => {
    it('should return true for BVC, BVS', () => {
      expect(analyzer.isOverflowRead(relative('BVC', '.noov'))).toBe(true);
      expect(analyzer.isOverflowRead(relative('BVS', '.ov'))).toBe(true);
    });

    it('should return false for non-overflow-flag instructions', () => {
      expect(analyzer.isOverflowRead(relative('BCC', '.x'))).toBe(false);
    });
  });

  // ==========================================================================
  // Composite queries
  // ==========================================================================

  describe('isAnyFlagRead', () => {
    it('should return true for any flag-reading instruction', () => {
      expect(analyzer.isAnyFlagRead(immediate('ADC', 1))).toBe(true);
      expect(analyzer.isAnyFlagRead(relative('BEQ', '.done'))).toBe(true);
      expect(analyzer.isAnyFlagRead(relative('BMI', '.neg'))).toBe(true);
      expect(analyzer.isAnyFlagRead(relative('BVS', '.ov'))).toBe(true);
    });

    it('should return false for non-flag-reading instructions', () => {
      expect(analyzer.isAnyFlagRead(immediate('LDA', 0))).toBe(false);
      expect(analyzer.isAnyFlagRead(absolute('STA', 0x1000))).toBe(false);
      expect(analyzer.isAnyFlagRead(implied('NOP'))).toBe(false);
    });
  });

  describe('isAnyFlagModified', () => {
    it('should return true for flag-modifying instructions', () => {
      expect(analyzer.isAnyFlagModified(implied('CLC'))).toBe(true);
      expect(analyzer.isAnyFlagModified(implied('SEC'))).toBe(true);
      expect(analyzer.isAnyFlagModified(implied('CLV'))).toBe(true);
      expect(analyzer.isAnyFlagModified(immediate('LDA', 0))).toBe(true);
      expect(analyzer.isAnyFlagModified(immediate('ADC', 1))).toBe(true);
      expect(analyzer.isAnyFlagModified(immediate('CMP', 5))).toBe(true);
      expect(analyzer.isAnyFlagModified(absolute('BIT', 0x2000))).toBe(true);
      expect(analyzer.isAnyFlagModified(implied('PLP'))).toBe(true);
      expect(analyzer.isAnyFlagModified(implied('RTI'))).toBe(true);
    });

    it('should return false for non-flag-modifying instructions', () => {
      expect(analyzer.isAnyFlagModified(absolute('STA', 0x1000))).toBe(false);
      expect(analyzer.isAnyFlagModified(implied('NOP'))).toBe(false);
      expect(analyzer.isAnyFlagModified(absolute('JMP', 0x2000))).toBe(false);
      expect(analyzer.isAnyFlagModified(implied('PHA'))).toBe(false);
      expect(analyzer.isAnyFlagModified(relative('BEQ', '.x'))).toBe(false);
    });
  });

  // ==========================================================================
  // Multi-instruction sequences
  // ==========================================================================

  describe('multi-instruction sequences', () => {
    it('CLC → ADC should show carry cleared then unknown', () => {
      let state = analyzer.createInitialState();
      // CLC: carry = false
      state = analyzer.analyze(implied('CLC'), state);
      expect(state.carry).toBe(false);

      // ADC: carry becomes unknown (result of addition)
      state = analyzer.analyze(immediate('ADC', 1), state);
      expect(state.carry).toBeUndefined();
    });

    it('SEC → SBC → BCS: carry is unknown after SBC', () => {
      let state = analyzer.createInitialState();
      state = analyzer.analyze(implied('SEC'), state);
      expect(state.carry).toBe(true);

      state = analyzer.analyze(immediate('SBC', 5), state);
      expect(state.carry).toBeUndefined();
    });

    it('LDA #$00 → CMP #$00: Z/N set by LDA then reset by CMP', () => {
      let state: FlagState = { carry: true, overflow: false };
      // LDA sets Z/N to unknown, preserves C/V
      state = analyzer.analyze(immediate('LDA', 0), state);
      expect(state.carry).toBe(true);
      expect(state.zero).toBeUndefined();
      expect(state.negative).toBeUndefined();
      expect(state.overflow).toBe(false);

      // CMP sets C/Z/N to unknown
      state = analyzer.analyze(immediate('CMP', 0), state);
      expect(state.carry).toBeUndefined();
      expect(state.zero).toBeUndefined();
      expect(state.negative).toBeUndefined();
      // V still preserved (CMP doesn't affect V)
      expect(state.overflow).toBe(false);
    });
  });
});
