/**
 * Shift Operations Unit Tests
 *
 * Tests for SHL_BYTE (shift left) and SHR_BYTE (shift right) code generation.
 * Verifies the shift operations produce correct 6502 assembly.
 *
 * 6502 patterns:
 * - SHL_BYTE: ASL A (repeated count times) - arithmetic shift left
 * - SHR_BYTE: LSR A (repeated count times) - logical shift right
 *
 * @module __tests__/codegen/unit/shift-operations.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableBitwiseOpsGenerator,
  createShlByteInstr,
  createShrByteInstr,
  findInstruction,
  countInstructions,
  hasCommentContaining,
  getInstructions,
} from './_bitwise-helpers.js';
import { isInstructionElement, AsmAddressingMode } from '../../../codegen/asm-il/types.js';

describe('Shift Operations', () => {
  let generator: TestableBitwiseOpsGenerator;

  beforeEach(() => {
    generator = new TestableBitwiseOpsGenerator();
  });

  // ==========================================================================
  // SHL_BYTE - Shift Left (Arithmetic Shift Left)
  // ==========================================================================

  describe('SHL_BYTE', () => {
    describe('basic shift left', () => {
      it('should generate single ASL for shift by 1', () => {
        const instr = createShlByteInstr(1);

        generator.testGenShlByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'ASL')).toBe(1);

        const aslInstr = findInstruction(elements, 'ASL');
        expect(isInstructionElement(aslInstr)).toBe(true);
        if (isInstructionElement(aslInstr)) {
          expect(aslInstr.instruction.mode).toBe(AsmAddressingMode.Accumulator);
        }
      });

      it('should generate two ASL for shift by 2', () => {
        const instr = createShlByteInstr(2);

        generator.testGenShlByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'ASL')).toBe(2);
      });

      it('should generate three ASL for shift by 3', () => {
        const instr = createShlByteInstr(3);

        generator.testGenShlByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'ASL')).toBe(3);
      });

      it('should generate four ASL for shift by 4', () => {
        const instr = createShlByteInstr(4);

        generator.testGenShlByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'ASL')).toBe(4);
      });
    });

    describe('shift counts 1-8', () => {
      it('should handle all shift counts from 1 to 8', () => {
        for (let count = 1; count <= 8; count++) {
          const gen = new TestableBitwiseOpsGenerator();
          const instr = createShlByteInstr(count);

          gen.testGenShlByte(instr);

          const elements = gen.getElements();
          expect(countInstructions(elements, 'ASL')).toBe(count);
        }
      });

      it('should use accumulator mode for all ASL instructions', () => {
        const instr = createShlByteInstr(5);

        generator.testGenShlByte(instr);

        const elements = generator.getElements();
        const instructions = getInstructions(elements);

        for (const elem of instructions) {
          if (isInstructionElement(elem) && elem.instruction.mnemonic === 'ASL') {
            expect(elem.instruction.mode).toBe(AsmAddressingMode.Accumulator);
          }
        }
      });
    });

    describe('edge cases', () => {
      it('should handle shift by 0 (no ASL instructions)', () => {
        const instr = createShlByteInstr(0);

        generator.testGenShlByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'ASL')).toBe(0);
      });

      it('should handle shift by 7', () => {
        const instr = createShlByteInstr(7);

        generator.testGenShlByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'ASL')).toBe(7);
      });

      it('should handle shift by 8 (all bits shifted out)', () => {
        const instr = createShlByteInstr(8);

        generator.testGenShlByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'ASL')).toBe(8);
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after shift', () => {
        const instr = createShlByteInstr(1);

        generator.testSetAFromImmediate(0x40);
        generator.testGenShlByte(instr);

        // Accumulator should be unknown after shift
        expect(generator.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('instruction comments', () => {
      it('should preserve comment from IL instruction', () => {
        const instr = createShlByteInstr(2);

        generator.testGenShlByte(instr);

        const elements = generator.getElements();
        expect(hasCommentContaining(elements, 'Shift')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // SHR_BYTE - Shift Right (Logical Shift Right)
  // ==========================================================================

  describe('SHR_BYTE', () => {
    describe('basic shift right', () => {
      it('should generate single LSR for shift by 1', () => {
        const instr = createShrByteInstr(1);

        generator.testGenShrByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'LSR')).toBe(1);

        const lsrInstr = findInstruction(elements, 'LSR');
        expect(isInstructionElement(lsrInstr)).toBe(true);
        if (isInstructionElement(lsrInstr)) {
          expect(lsrInstr.instruction.mode).toBe(AsmAddressingMode.Accumulator);
        }
      });

      it('should generate two LSR for shift by 2', () => {
        const instr = createShrByteInstr(2);

        generator.testGenShrByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'LSR')).toBe(2);
      });

      it('should generate three LSR for shift by 3', () => {
        const instr = createShrByteInstr(3);

        generator.testGenShrByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'LSR')).toBe(3);
      });

      it('should generate four LSR for shift by 4', () => {
        const instr = createShrByteInstr(4);

        generator.testGenShrByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'LSR')).toBe(4);
      });
    });

    describe('shift counts 1-8', () => {
      it('should handle all shift counts from 1 to 8', () => {
        for (let count = 1; count <= 8; count++) {
          const gen = new TestableBitwiseOpsGenerator();
          const instr = createShrByteInstr(count);

          gen.testGenShrByte(instr);

          const elements = gen.getElements();
          expect(countInstructions(elements, 'LSR')).toBe(count);
        }
      });

      it('should use accumulator mode for all LSR instructions', () => {
        const instr = createShrByteInstr(5);

        generator.testGenShrByte(instr);

        const elements = generator.getElements();
        const instructions = getInstructions(elements);

        for (const elem of instructions) {
          if (isInstructionElement(elem) && elem.instruction.mnemonic === 'LSR') {
            expect(elem.instruction.mode).toBe(AsmAddressingMode.Accumulator);
          }
        }
      });
    });

    describe('edge cases', () => {
      it('should handle shift by 0 (no LSR instructions)', () => {
        const instr = createShrByteInstr(0);

        generator.testGenShrByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'LSR')).toBe(0);
      });

      it('should handle shift by 7', () => {
        const instr = createShrByteInstr(7);

        generator.testGenShrByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'LSR')).toBe(7);
      });

      it('should handle shift by 8 (all bits shifted out)', () => {
        const instr = createShrByteInstr(8);

        generator.testGenShrByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'LSR')).toBe(8);
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after shift', () => {
        const instr = createShrByteInstr(1);

        generator.testSetAFromImmediate(0x80);
        generator.testGenShrByte(instr);

        // Accumulator should be unknown after shift
        expect(generator.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('instruction comments', () => {
      it('should preserve comment from IL instruction', () => {
        const instr = createShrByteInstr(3);

        generator.testGenShrByte(instr);

        const elements = generator.getElements();
        expect(hasCommentContaining(elements, 'Shift')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Mixed Shift Scenarios
  // ==========================================================================

  describe('mixed shift operations', () => {
    it('should handle SHL followed by SHR', () => {
      const instr1 = createShlByteInstr(2);
      const instr2 = createShrByteInstr(2);

      generator.testGenShlByte(instr1);
      generator.testGenShrByte(instr2);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'ASL')).toBe(2);
      expect(countInstructions(elements, 'LSR')).toBe(2);
    });

    it('should handle SHR followed by SHL', () => {
      const instr1 = createShrByteInstr(3);
      const instr2 = createShlByteInstr(1);

      generator.testGenShrByte(instr1);
      generator.testGenShlByte(instr2);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LSR')).toBe(3);
      expect(countInstructions(elements, 'ASL')).toBe(1);
    });

    it('should generate instructions in correct order', () => {
      const instr1 = createShlByteInstr(1);
      const instr2 = createShrByteInstr(1);

      generator.testGenShlByte(instr1);
      generator.testGenShrByte(instr2);

      const elements = generator.getElements();
      const instructions = getInstructions(elements);
      const shiftInstrs = instructions.filter(
        (e) =>
          isInstructionElement(e) &&
          (e.instruction.mnemonic === 'ASL' || e.instruction.mnemonic === 'LSR')
      );

      expect(shiftInstrs.length).toBe(2);
      if (
        isInstructionElement(shiftInstrs[0]) &&
        isInstructionElement(shiftInstrs[1])
      ) {
        expect(shiftInstrs[0].instruction.mnemonic).toBe('ASL');
        expect(shiftInstrs[1].instruction.mnemonic).toBe('LSR');
      }
    });
  });

  // ==========================================================================
  // Shift Operation Properties
  // ==========================================================================

  describe('shift operation properties', () => {
    it('should multiply by 2 with SHL 1', () => {
      // x << 1 = x * 2
      const instr = createShlByteInstr(1);
      generator.testGenShlByte(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'ASL')).toBe(1);
    });

    it('should multiply by 4 with SHL 2', () => {
      // x << 2 = x * 4
      const instr = createShlByteInstr(2);
      generator.testGenShlByte(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'ASL')).toBe(2);
    });

    it('should divide by 2 with SHR 1', () => {
      // x >> 1 = x / 2 (integer division)
      const instr = createShrByteInstr(1);
      generator.testGenShrByte(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LSR')).toBe(1);
    });

    it('should divide by 4 with SHR 2', () => {
      // x >> 2 = x / 4 (integer division)
      const instr = createShrByteInstr(2);
      generator.testGenShrByte(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LSR')).toBe(2);
    });

    it('should extract high nibble with SHR 4', () => {
      // x >> 4 extracts high nibble
      const instr = createShrByteInstr(4);
      generator.testGenShrByte(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LSR')).toBe(4);
    });

    it('should move low nibble to high with SHL 4', () => {
      // x << 4 moves low nibble to high position
      const instr = createShlByteInstr(4);
      generator.testGenShlByte(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'ASL')).toBe(4);
    });
  });
});