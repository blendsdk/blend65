/**
 * Register Tracker Tests
 *
 * Verifies that RegisterTracker correctly tracks known contents of
 * 6502 A, X, Y registers through instruction sequences.
 *
 * Tests cover:
 * - Load instructions (immediate → known value, memory → unknown)
 * - Transfer instructions (TAX, TAY, TXA, TYA)
 * - Stack operations (PLA, TSX, PHA, PHP, TXS)
 * - Arithmetic (ADC, SBC, AND, ORA, EOR → destroys A)
 * - Shift/rotate (accumulator mode vs memory mode)
 * - Increment/decrement (INX, DEX, INY, DEY)
 * - JSR (clobbers all registers)
 * - Non-register instructions (STA, CMP, branches, etc.)
 * - Value equality (areEqual)
 * - Multi-instruction sequences
 */

import { describe, it, expect } from 'vitest';
import { RegisterTracker } from '../../../../../codegen/asm-il/optimizer/analysis/register-tracker.js';
import type { RegisterState } from '../../../../../codegen/asm-il/optimizer/analysis/register-tracker.js';
import { AsmAddressingMode } from '../../../../../codegen/asm-il/types.js';
import type { AsmInstruction } from '../../../../../codegen/asm-il/types.js';

// ============================================================================
// Helpers
// ============================================================================

/** Create an implied-mode instruction */
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

describe('RegisterTracker', () => {
  const tracker = new RegisterTracker();

  describe('createInitialState', () => {
    it('should return all registers as undefined', () => {
      const state = tracker.createInitialState();
      expect(state.a).toBeUndefined();
      expect(state.x).toBeUndefined();
      expect(state.y).toBeUndefined();
    });
  });

  // ==========================================================================
  // Load instructions
  // ==========================================================================

  describe('load instructions', () => {
    it('LDA immediate should set A to known value', () => {
      const state = tracker.createInitialState();
      const after = tracker.update(immediate('LDA', 0x42), state);
      expect(after.a).toBe(0x42);
      expect(after.x).toBeUndefined();
      expect(after.y).toBeUndefined();
    });

    it('LDX immediate should set X to known value', () => {
      const state = tracker.createInitialState();
      const after = tracker.update(immediate('LDX', 0x10), state);
      expect(after.x).toBe(0x10);
      expect(after.a).toBeUndefined();
    });

    it('LDY immediate should set Y to known value', () => {
      const state = tracker.createInitialState();
      const after = tracker.update(immediate('LDY', 0xFF), state);
      expect(after.y).toBe(0xFF);
    });

    it('LDA #$00 should track zero', () => {
      const state = tracker.createInitialState();
      const after = tracker.update(immediate('LDA', 0), state);
      expect(after.a).toBe(0);
    });

    it('LDA absolute should set A to undefined (memory value unknown)', () => {
      const state: RegisterState = { a: 0x42, x: undefined, y: undefined };
      const after = tracker.update(absolute('LDA', 0x1000), state);
      expect(after.a).toBeUndefined();
    });

    it('LDX absolute should set X to undefined', () => {
      const state: RegisterState = { a: undefined, x: 5, y: undefined };
      const after = tracker.update(absolute('LDX', 0x50), state);
      expect(after.x).toBeUndefined();
    });

    it('LDY zero-page should set Y to undefined', () => {
      const state: RegisterState = { a: undefined, x: undefined, y: 3 };
      const instr: AsmInstruction = { mnemonic: 'LDY', mode: AsmAddressingMode.ZeroPage, operand: 0x50 };
      const after = tracker.update(instr, state);
      expect(after.y).toBeUndefined();
    });
  });

  // ==========================================================================
  // Transfer instructions
  // ==========================================================================

  describe('transfer instructions', () => {
    it('TAX should copy A to X', () => {
      const state: RegisterState = { a: 0x42, x: undefined, y: undefined };
      const after = tracker.update(implied('TAX'), state);
      expect(after.x).toBe(0x42);
      expect(after.a).toBe(0x42); // A unchanged
    });

    it('TAY should copy A to Y', () => {
      const state: RegisterState = { a: 0x10, x: undefined, y: undefined };
      const after = tracker.update(implied('TAY'), state);
      expect(after.y).toBe(0x10);
      expect(after.a).toBe(0x10);
    });

    it('TXA should copy X to A', () => {
      const state: RegisterState = { a: undefined, x: 0x20, y: undefined };
      const after = tracker.update(implied('TXA'), state);
      expect(after.a).toBe(0x20);
      expect(after.x).toBe(0x20);
    });

    it('TYA should copy Y to A', () => {
      const state: RegisterState = { a: undefined, x: undefined, y: 0x30 };
      const after = tracker.update(implied('TYA'), state);
      expect(after.a).toBe(0x30);
      expect(after.y).toBe(0x30);
    });

    it('TAX with unknown A should set X to undefined', () => {
      const state: RegisterState = { a: undefined, x: 5, y: undefined };
      const after = tracker.update(implied('TAX'), state);
      expect(after.x).toBeUndefined();
    });

    it('TXA with unknown X should set A to undefined', () => {
      const state: RegisterState = { a: 0x42, x: undefined, y: undefined };
      const after = tracker.update(implied('TXA'), state);
      expect(after.a).toBeUndefined();
    });
  });

  // ==========================================================================
  // Stack operations
  // ==========================================================================

  describe('stack operations', () => {
    it('PLA should set A to undefined (value from stack is unknown)', () => {
      const state: RegisterState = { a: 0x42, x: undefined, y: undefined };
      const after = tracker.update(implied('PLA'), state);
      expect(after.a).toBeUndefined();
    });

    it('TSX should set X to undefined (stack pointer value unknown)', () => {
      const state: RegisterState = { a: undefined, x: 5, y: undefined };
      const after = tracker.update(implied('TSX'), state);
      expect(after.x).toBeUndefined();
    });

    it('PHA should not change any register', () => {
      const state: RegisterState = { a: 0x42, x: 0x10, y: 0x20 };
      const after = tracker.update(implied('PHA'), state);
      expect(after.a).toBe(0x42);
      expect(after.x).toBe(0x10);
      expect(after.y).toBe(0x20);
    });

    it('PHP should not change any register', () => {
      const state: RegisterState = { a: 0x42, x: 0x10, y: 0x20 };
      const after = tracker.update(implied('PHP'), state);
      expect(after.a).toBe(0x42);
      expect(after.x).toBe(0x10);
      expect(after.y).toBe(0x20);
    });

    it('TXS should not change any register (writes to SP)', () => {
      const state: RegisterState = { a: 0x42, x: 0xFF, y: 0x20 };
      const after = tracker.update(implied('TXS'), state);
      expect(after.a).toBe(0x42);
      expect(after.x).toBe(0xFF);
      expect(after.y).toBe(0x20);
    });
  });

  // ==========================================================================
  // Arithmetic (destroys A)
  // ==========================================================================

  describe('arithmetic (destroys A)', () => {
    const arithmeticOps = ['ADC', 'SBC', 'AND', 'ORA', 'EOR'];

    for (const mnemonic of arithmeticOps) {
      it(`${mnemonic} should set A to undefined`, () => {
        const state: RegisterState = { a: 0x42, x: 0x10, y: 0x20 };
        const after = tracker.update(immediate(mnemonic, 1), state);
        expect(after.a).toBeUndefined();
        // X, Y unchanged
        expect(after.x).toBe(0x10);
        expect(after.y).toBe(0x20);
      });
    }
  });

  // ==========================================================================
  // Shift/Rotate
  // ==========================================================================

  describe('shift/rotate', () => {
    const shiftOps = ['ASL', 'LSR', 'ROL', 'ROR'];

    for (const mnemonic of shiftOps) {
      it(`${mnemonic} accumulator mode should set A to undefined`, () => {
        const state: RegisterState = { a: 0x42, x: 0x10, y: 0x20 };
        const after = tracker.update(accumulator(mnemonic), state);
        expect(after.a).toBeUndefined();
        // X, Y unchanged
        expect(after.x).toBe(0x10);
        expect(after.y).toBe(0x20);
      });

      it(`${mnemonic} memory mode should not change registers`, () => {
        const state: RegisterState = { a: 0x42, x: 0x10, y: 0x20 };
        const after = tracker.update(absolute(mnemonic, 0x1000), state);
        expect(after.a).toBe(0x42);
        expect(after.x).toBe(0x10);
        expect(after.y).toBe(0x20);
      });
    }
  });

  // ==========================================================================
  // Increment/Decrement
  // ==========================================================================

  describe('increment/decrement', () => {
    it('INX should set X to undefined', () => {
      const state: RegisterState = { a: 0x42, x: 5, y: 0x20 };
      const after = tracker.update(implied('INX'), state);
      expect(after.x).toBeUndefined();
      expect(after.a).toBe(0x42);
      expect(after.y).toBe(0x20);
    });

    it('DEX should set X to undefined', () => {
      const state: RegisterState = { a: undefined, x: 5, y: undefined };
      const after = tracker.update(implied('DEX'), state);
      expect(after.x).toBeUndefined();
    });

    it('INY should set Y to undefined', () => {
      const state: RegisterState = { a: undefined, x: undefined, y: 10 };
      const after = tracker.update(implied('INY'), state);
      expect(after.y).toBeUndefined();
    });

    it('DEY should set Y to undefined', () => {
      const state: RegisterState = { a: undefined, x: undefined, y: 0xFF };
      const after = tracker.update(implied('DEY'), state);
      expect(after.y).toBeUndefined();
    });
  });

  // ==========================================================================
  // JSR (clobbers all registers)
  // ==========================================================================

  describe('JSR', () => {
    it('should set all registers to undefined', () => {
      const state: RegisterState = { a: 0x42, x: 0x10, y: 0x20 };
      const after = tracker.update(absolute('JSR', 0x2000), state);
      expect(after.a).toBeUndefined();
      expect(after.x).toBeUndefined();
      expect(after.y).toBeUndefined();
    });
  });

  // ==========================================================================
  // Non-register instructions (should not change registers)
  // ==========================================================================

  describe('non-register instructions', () => {
    const preserveInstructions: Array<[string, AsmInstruction]> = [
      ['STA', absolute('STA', 0x1000)],
      ['STX', absolute('STX', 0x1000)],
      ['STY', absolute('STY', 0x1000)],
      ['CMP', immediate('CMP', 5)],
      ['CPX', immediate('CPX', 5)],
      ['CPY', immediate('CPY', 5)],
      ['NOP', implied('NOP')],
      ['CLC', implied('CLC')],
      ['SEC', implied('SEC')],
      ['CLV', implied('CLV')],
      ['RTS', implied('RTS')],
      ['BRK', implied('BRK')],
      ['BEQ', relative('BEQ', '.done')],
      ['BNE', relative('BNE', '.loop')],
      ['JMP', absolute('JMP', 0x2000)],
    ];

    for (const [name, instr] of preserveInstructions) {
      it(`${name} should preserve all registers`, () => {
        const state: RegisterState = { a: 0x42, x: 0x10, y: 0x20 };
        const after = tracker.update(instr, state);
        expect(after.a).toBe(0x42);
        expect(after.x).toBe(0x10);
        expect(after.y).toBe(0x20);
      });
    }
  });

  // ==========================================================================
  // Immutability
  // ==========================================================================

  describe('immutability', () => {
    it('should not mutate the input state', () => {
      const state: RegisterState = { a: 0x42, x: 0x10, y: 0x20 };
      const stateCopy = { ...state };
      tracker.update(immediate('LDA', 0xFF), state);
      expect(state).toEqual(stateCopy);
    });
  });

  // ==========================================================================
  // areEqual
  // ==========================================================================

  describe('areEqual', () => {
    it('should return true for equal numbers', () => {
      expect(tracker.areEqual(0x42, 0x42)).toBe(true);
    });

    it('should return false for different numbers', () => {
      expect(tracker.areEqual(0x42, 0x43)).toBe(false);
    });

    it('should return true for equal strings', () => {
      expect(tracker.areEqual('counter', 'counter')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(tracker.areEqual('counter', 'player_x')).toBe(false);
    });

    it('should return false when first is undefined', () => {
      expect(tracker.areEqual(undefined, 0x42)).toBe(false);
    });

    it('should return false when second is undefined', () => {
      expect(tracker.areEqual(0x42, undefined)).toBe(false);
    });

    it('should return false when both are undefined', () => {
      expect(tracker.areEqual(undefined, undefined)).toBe(false);
    });

    it('should return false for number vs string mismatch', () => {
      expect(tracker.areEqual(42, 'counter')).toBe(false);
    });
  });

  // ==========================================================================
  // Multi-instruction sequences
  // ==========================================================================

  describe('multi-instruction sequences', () => {
    it('LDA #$42 → TAX should propagate value to X', () => {
      let state = tracker.createInitialState();
      state = tracker.update(immediate('LDA', 0x42), state);
      state = tracker.update(implied('TAX'), state);
      expect(state.a).toBe(0x42);
      expect(state.x).toBe(0x42);
    });

    it('LDA #$10 → ADC #$20 should make A unknown', () => {
      let state = tracker.createInitialState();
      state = tracker.update(immediate('LDA', 0x10), state);
      expect(state.a).toBe(0x10);
      state = tracker.update(immediate('ADC', 0x20), state);
      expect(state.a).toBeUndefined();
    });

    it('LDX #$FF → INX should make X unknown', () => {
      let state = tracker.createInitialState();
      state = tracker.update(immediate('LDX', 0xFF), state);
      expect(state.x).toBe(0xFF);
      state = tracker.update(implied('INX'), state);
      expect(state.x).toBeUndefined();
    });

    it('LDA #$42 → PHA → PLA should make A unknown', () => {
      let state = tracker.createInitialState();
      state = tracker.update(immediate('LDA', 0x42), state);
      expect(state.a).toBe(0x42);
      state = tracker.update(implied('PHA'), state);
      expect(state.a).toBe(0x42); // PHA doesn't change A
      state = tracker.update(implied('PLA'), state);
      expect(state.a).toBeUndefined(); // PLA makes A unknown
    });

    it('LDA #$42 → STA $1000 should preserve A', () => {
      let state = tracker.createInitialState();
      state = tracker.update(immediate('LDA', 0x42), state);
      state = tracker.update(absolute('STA', 0x1000), state);
      // STA doesn't change A
      expect(state.a).toBe(0x42);
    });
  });
});
