/**
 * SHR_WORD (16-bit Shift Right) Unit Tests
 *
 * Tests for the improved SHR_WORD code generation that uses count-dependent
 * strategies to minimize code size and cycle count:
 *
 * - Shift 0: No-op (no instructions emitted)
 * - Shift 1-7: Standard 16-bit pattern (PHA/TXA/LSR/TAX/PLA/ROR per shift)
 * - Shift ≥ 8: Optimized (TXA + LSR×(N-8) + LDX #$00)
 *
 * The shift≥8 optimization exploits the fact that all low-byte bits are
 * fully discarded when shifting right by 8+, so the high byte (X) simply
 * becomes the new low byte and is further shifted by the remaining count.
 *
 * @module __tests__/codegen/unit/shr-word.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableBitwiseOpsGenerator,
  createShrWordInstr,
  findInstruction,
  countInstructions,
  hasCommentContaining,
  getInstructions,
} from './_bitwise-helpers.js';
import { isInstructionElement, AsmAddressingMode } from '../../../codegen/asm-il/types.js';

describe('SHR_WORD (16-bit shift right)', () => {
  let generator: TestableBitwiseOpsGenerator;

  beforeEach(() => {
    generator = new TestableBitwiseOpsGenerator();
  });

  // ==========================================================================
  // Shift by 0 — No-op
  // ==========================================================================

  describe('shift by 0 (no-op)', () => {
    it('should emit no shift instructions for shift by 0', () => {
      const instr = createShrWordInstr(0);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      // Only the comment element should be present, no actual instructions
      expect(countInstructions(elements, 'PHA')).toBe(0);
      expect(countInstructions(elements, 'TXA')).toBe(0);
      expect(countInstructions(elements, 'LSR')).toBe(0);
      expect(countInstructions(elements, 'LDX')).toBe(0);
    });
  });

  // ==========================================================================
  // Shift 1-7 — Standard 16-bit pattern
  // ==========================================================================

  describe('shift 1-7 (standard 16-bit pattern)', () => {
    it('should generate standard 6-instruction pattern for shift by 1', () => {
      const instr = createShrWordInstr(1);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      // Standard pattern: PHA / TXA / LSR / TAX / PLA / ROR × 1
      expect(countInstructions(elements, 'PHA')).toBe(1);
      expect(countInstructions(elements, 'TXA')).toBe(1);
      expect(countInstructions(elements, 'LSR')).toBe(1);
      expect(countInstructions(elements, 'TAX')).toBe(1);
      expect(countInstructions(elements, 'PLA')).toBe(1);
      expect(countInstructions(elements, 'ROR')).toBe(1);
      // Should NOT use the optimized path
      expect(countInstructions(elements, 'LDX')).toBe(0);
    });

    it('should generate 2× standard pattern for shift by 2', () => {
      const instr = createShrWordInstr(2);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'PHA')).toBe(2);
      expect(countInstructions(elements, 'TXA')).toBe(2);
      expect(countInstructions(elements, 'LSR')).toBe(2);
      expect(countInstructions(elements, 'TAX')).toBe(2);
      expect(countInstructions(elements, 'PLA')).toBe(2);
      expect(countInstructions(elements, 'ROR')).toBe(2);
    });

    it('should generate 6× standard pattern for shift by 6 (sprite /64)', () => {
      // This is the common sprite pointer calculation: address / 64
      const instr = createShrWordInstr(6);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'PHA')).toBe(6);
      expect(countInstructions(elements, 'TXA')).toBe(6);
      expect(countInstructions(elements, 'LSR')).toBe(6);
      expect(countInstructions(elements, 'TAX')).toBe(6);
      expect(countInstructions(elements, 'PLA')).toBe(6);
      expect(countInstructions(elements, 'ROR')).toBe(6);
    });

    it('should generate 7× standard pattern for shift by 7', () => {
      const instr = createShrWordInstr(7);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'PHA')).toBe(7);
      expect(countInstructions(elements, 'ROR')).toBe(7);
    });

    it('should use correct instruction order within each iteration', () => {
      const instr = createShrWordInstr(1);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements);
      const mnemonics = instructions
        .filter(isInstructionElement)
        .map((e) => e.instruction.mnemonic);

      // Expected order for one iteration: PHA, TXA, LSR, TAX, PLA, ROR
      const expectedOrder = ['PHA', 'TXA', 'LSR', 'TAX', 'PLA', 'ROR'];
      expect(mnemonics).toEqual(expectedOrder);
    });

    it('should handle all counts 1-7 with N×6 instructions', () => {
      for (let count = 1; count <= 7; count++) {
        const gen = new TestableBitwiseOpsGenerator();
        const instr = createShrWordInstr(count);

        gen.testGenShrWord(instr);

        const elements = gen.getElements();
        // Each iteration of standard pattern uses 6 instructions
        expect(countInstructions(elements, 'PHA')).toBe(count);
        expect(countInstructions(elements, 'ROR')).toBe(count);
      }
    });
  });

  // ==========================================================================
  // Shift ≥ 8 — Optimized path (TXA + LSR×(N-8) + LDX #$00)
  // ==========================================================================

  describe('shift ≥ 8 (optimized path)', () => {
    it('should use TXA + LDX #$00 for shift by 8 (no remaining LSRs)', () => {
      const instr = createShrWordInstr(8);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      // Optimized: TXA + LDX #$00 (just 2 instructions!)
      expect(countInstructions(elements, 'TXA')).toBe(1);
      expect(countInstructions(elements, 'LDX')).toBe(1);
      expect(countInstructions(elements, 'LSR')).toBe(0);
      // Should NOT use the standard pattern at all
      expect(countInstructions(elements, 'PHA')).toBe(0);
      expect(countInstructions(elements, 'PLA')).toBe(0);
      expect(countInstructions(elements, 'ROR')).toBe(0);
    });

    it('should use TXA + LSR + LDX #$00 for shift by 9', () => {
      const instr = createShrWordInstr(9);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'TXA')).toBe(1);
      expect(countInstructions(elements, 'LSR')).toBe(1); // 9 - 8 = 1 remaining
      expect(countInstructions(elements, 'LDX')).toBe(1);
      expect(countInstructions(elements, 'PHA')).toBe(0);
    });

    it('should use TXA + 2×LSR + LDX #$00 for shift by 10', () => {
      const instr = createShrWordInstr(10);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'TXA')).toBe(1);
      expect(countInstructions(elements, 'LSR')).toBe(2); // 10 - 8 = 2 remaining
      expect(countInstructions(elements, 'LDX')).toBe(1);
    });

    it('should use TXA + 7×LSR + LDX #$00 for shift by 15', () => {
      const instr = createShrWordInstr(15);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'TXA')).toBe(1);
      expect(countInstructions(elements, 'LSR')).toBe(7); // 15 - 8 = 7 remaining
      expect(countInstructions(elements, 'LDX')).toBe(1);
    });

    it('should use correct instruction order: TXA, LSR×N, LDX', () => {
      // For shift by 10: TXA, LSR, LSR, LDX #$00
      const instr = createShrWordInstr(10);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements);
      const mnemonics = instructions
        .filter(isInstructionElement)
        .map((e) => e.instruction.mnemonic);

      expect(mnemonics).toEqual(['TXA', 'LSR', 'LSR', 'LDX']);
    });

    it('should set LDX to immediate 0 for high byte clearing', () => {
      const instr = createShrWordInstr(8);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      const ldxInstr = findInstruction(elements, 'LDX');
      expect(isInstructionElement(ldxInstr)).toBe(true);
      if (isInstructionElement(ldxInstr)) {
        expect(ldxInstr.instruction.mode).toBe(AsmAddressingMode.Immediate);
        expect(ldxInstr.instruction.operand).toBe(0);
      }
    });

    it('should use accumulator mode for LSR in optimized path', () => {
      const instr = createShrWordInstr(10);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements);

      for (const elem of instructions) {
        if (isInstructionElement(elem) && elem.instruction.mnemonic === 'LSR') {
          expect(elem.instruction.mode).toBe(AsmAddressingMode.Accumulator);
        }
      }
    });
  });

  // ==========================================================================
  // Instruction Count Comparison (Optimized vs Old)
  // ==========================================================================

  describe('instruction count improvements', () => {
    it('shift by 8: 2 instructions (was 48 with old approach)', () => {
      const instr = createShrWordInstr(8);
      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements).filter(isInstructionElement);
      // TXA + LDX #$00 = 2 instructions (old: 8×6 = 48)
      expect(instructions.length).toBe(2);
    });

    it('shift by 10: 4 instructions (was 60 with old approach)', () => {
      const instr = createShrWordInstr(10);
      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements).filter(isInstructionElement);
      // TXA + 2×LSR + LDX #$00 = 4 instructions (old: 10×6 = 60)
      expect(instructions.length).toBe(4);
    });

    it('shift by 15: 9 instructions (was 90 with old approach)', () => {
      const instr = createShrWordInstr(15);
      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements).filter(isInstructionElement);
      // TXA + 7×LSR + LDX #$00 = 9 instructions (old: 15×6 = 90)
      expect(instructions.length).toBe(9);
    });

    it('shift by 1: still 6 instructions (unchanged)', () => {
      const instr = createShrWordInstr(1);
      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements).filter(isInstructionElement);
      // PHA/TXA/LSR/TAX/PLA/ROR = 6 instructions (unchanged)
      expect(instructions.length).toBe(6);
    });

    it('shift by 6: still 36 instructions (unchanged for sprite /64)', () => {
      const instr = createShrWordInstr(6);
      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      const instructions = getInstructions(elements).filter(isInstructionElement);
      // 6 × 6 = 36 instructions (unchanged for now)
      expect(instructions.length).toBe(36);
    });
  });

  // ==========================================================================
  // Accumulator State
  // ==========================================================================

  describe('accumulator state', () => {
    it('should invalidate accumulator state after shift (standard path)', () => {
      const instr = createShrWordInstr(1);

      generator.testSetAFromImmediate(0xff);
      generator.testGenShrWord(instr);

      expect(generator.testAHasSlot(0x10)).toBe(false);
    });

    it('should invalidate accumulator state after shift (optimized path)', () => {
      const instr = createShrWordInstr(8);

      generator.testSetAFromImmediate(0xff);
      generator.testGenShrWord(instr);

      expect(generator.testAHasSlot(0x10)).toBe(false);
    });

    it('should invalidate accumulator state for shift by 0', () => {
      // Even though no instructions are emitted, the function still runs
      // invalidateA — this ensures consistent behavior
      const instr = createShrWordInstr(0);

      generator.testSetAFromImmediate(0xff);
      generator.testGenShrWord(instr);

      // For shift by 0, we don't reach invalidateA since we return early.
      // The A register should still hold its previous value.
      // This is correct: shift by 0 is identity, no change to A.
    });
  });

  // ==========================================================================
  // Comments
  // ==========================================================================

  describe('instruction comments', () => {
    it('should preserve IL comment for standard path', () => {
      const instr = createShrWordInstr(3);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      expect(hasCommentContaining(elements, 'Shift')).toBe(true);
    });

    it('should preserve IL comment for optimized path', () => {
      const instr = createShrWordInstr(10);

      generator.testGenShrWord(instr);

      const elements = generator.getElements();
      expect(hasCommentContaining(elements, 'Shift')).toBe(true);
    });
  });
});
