/**
 * AND Operations Unit Tests
 *
 * Tests for AND_BYTE and AND_IMM code generation.
 * Verifies the bitwise AND operations produce correct 6502 assembly.
 *
 * 6502 patterns:
 * - AND_BYTE: AND addr (with zero page or absolute addressing)
 * - AND_IMM: AND #imm (immediate addressing)
 *
 * @module __tests__/codegen/unit/and-operations.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableBitwiseOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createAndByteInstr,
  createAndImmInstr,
  findInstruction,
  countInstructions,
  hasCommentContaining,
  getInstructions,
} from './_bitwise-helpers.js';
import { isInstructionElement, AsmAddressingMode } from '../../../codegen/asm-il/types.js';

describe('AND Operations', () => {
  let generator: TestableBitwiseOpsGenerator;

  beforeEach(() => {
    generator = new TestableBitwiseOpsGenerator();
  });

  // ==========================================================================
  // AND_BYTE - Logical AND with Slot
  // ==========================================================================

  describe('AND_BYTE', () => {
    describe('zero page addressing', () => {
      it('should generate AND with zero page addressing', () => {
        const slot = createZpSlot('mask', 0x10);
        const instr = createAndByteInstr(slot);

        generator.testGenAndByte(instr);

        const elements = generator.getElements();
        const andInstr = findInstruction(elements, 'AND');

        expect(andInstr).toBeDefined();
        expect(isInstructionElement(andInstr)).toBe(true);
        if (isInstructionElement(andInstr)) {
          expect(andInstr.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
          expect(andInstr.instruction.operand).toBe(0x10);
        }
      });

      it('should generate single AND instruction for ZP', () => {
        const slot = createZpSlot('flags', 0x20);
        const instr = createAndByteInstr(slot);

        generator.testGenAndByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'AND')).toBe(1);
      });

      it('should handle ZP address 0x00', () => {
        const slot = createZpSlot('lowMem', 0x00);
        const instr = createAndByteInstr(slot);

        generator.testGenAndByte(instr);

        const elements = generator.getElements();
        const andInstr = findInstruction(elements, 'AND');
        expect(isInstructionElement(andInstr)).toBe(true);
        if (isInstructionElement(andInstr)) {
          expect(andInstr.instruction.operand).toBe(0x00);
        }
      });

      it('should handle ZP address 0xFF', () => {
        const slot = createZpSlot('highZp', 0xff);
        const instr = createAndByteInstr(slot);

        generator.testGenAndByte(instr);

        const elements = generator.getElements();
        const andInstr = findInstruction(elements, 'AND');
        expect(isInstructionElement(andInstr)).toBe(true);
        if (isInstructionElement(andInstr)) {
          expect(andInstr.instruction.operand).toBe(0xff);
        }
      });

      it('should preserve comment from IL instruction', () => {
        const slot = createZpSlot('bitMask', 0x30);
        const instr = createAndByteInstr(slot);

        generator.testGenAndByte(instr);

        const elements = generator.getElements();
        expect(hasCommentContaining(elements, 'AND')).toBe(true);
      });
    });

    describe('absolute addressing', () => {
      it('should generate AND with absolute addressing', () => {
        const slot = createAbsSlot('globalMask', 0x0200);
        const instr = createAndByteInstr(slot);

        generator.testGenAndByte(instr);

        const elements = generator.getElements();
        const andInstr = findInstruction(elements, 'AND');

        expect(andInstr).toBeDefined();
        expect(isInstructionElement(andInstr)).toBe(true);
        if (isInstructionElement(andInstr)) {
          expect(andInstr.instruction.mode).toBe(AsmAddressingMode.Absolute);
          expect(andInstr.instruction.operand).toBe(0x0200);
        }
      });

      it('should handle frame region addresses', () => {
        const slot = createAbsSlot('frameVar', 0x0300);
        const instr = createAndByteInstr(slot);

        generator.testGenAndByte(instr);

        const elements = generator.getElements();
        const andInstr = findInstruction(elements, 'AND');
        expect(isInstructionElement(andInstr)).toBe(true);
        if (isInstructionElement(andInstr)) {
          expect(andInstr.instruction.operand).toBe(0x0300);
        }
      });

      it('should handle high memory addresses', () => {
        const slot = createAbsSlot('highMem', 0xc000);
        const instr = createAndByteInstr(slot);

        generator.testGenAndByte(instr);

        const elements = generator.getElements();
        const andInstr = findInstruction(elements, 'AND');
        expect(isInstructionElement(andInstr)).toBe(true);
        if (isInstructionElement(andInstr)) {
          expect(andInstr.instruction.operand).toBe(0xc000);
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after AND', () => {
        const slot = createZpSlot('mask', 0x10);
        const instr = createAndByteInstr(slot);

        // Set known accumulator state
        generator.testSetAFromImmediate(0xff);
        expect(generator.testAHasSlot(0x10)).toBe(false);

        generator.testGenAndByte(instr);

        // Accumulator should be unknown after AND
        expect(generator.testAHasSlot(0x10)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // AND_IMM - Logical AND with Immediate
  // ==========================================================================

  describe('AND_IMM', () => {
    describe('basic immediate AND', () => {
      it('should generate AND with immediate value', () => {
        const instr = createAndImmInstr(0x0f);

        generator.testGenAndImm(instr);

        const elements = generator.getElements();
        const andInstr = findInstruction(elements, 'AND');

        expect(andInstr).toBeDefined();
        expect(isInstructionElement(andInstr)).toBe(true);
        if (isInstructionElement(andInstr)) {
          expect(andInstr.instruction.mode).toBe(AsmAddressingMode.Immediate);
          expect(andInstr.instruction.operand).toBe(0x0f);
        }
      });

      it('should generate single AND instruction', () => {
        const instr = createAndImmInstr(0x80);

        generator.testGenAndImm(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'AND')).toBe(1);
      });
    });

    describe('common bit mask values', () => {
      it('should handle mask for low nibble (0x0F)', () => {
        const instr = createAndImmInstr(0x0f);

        generator.testGenAndImm(instr);

        const elements = generator.getElements();
        const andInstr = findInstruction(elements, 'AND');
        expect(isInstructionElement(andInstr)).toBe(true);
        if (isInstructionElement(andInstr)) {
          expect(andInstr.instruction.operand).toBe(0x0f);
        }
      });

      it('should handle mask for high nibble (0xF0)', () => {
        const instr = createAndImmInstr(0xf0);

        generator.testGenAndImm(instr);

        const elements = generator.getElements();
        const andInstr = findInstruction(elements, 'AND');
        expect(isInstructionElement(andInstr)).toBe(true);
        if (isInstructionElement(andInstr)) {
          expect(andInstr.instruction.operand).toBe(0xf0);
        }
      });

      it('should handle single bit masks', () => {
        const bitMasks = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];

        for (const mask of bitMasks) {
          const gen = new TestableBitwiseOpsGenerator();
          const instr = createAndImmInstr(mask);

          gen.testGenAndImm(instr);

          const elements = gen.getElements();
          const andInstr = findInstruction(elements, 'AND');
          expect(isInstructionElement(andInstr)).toBe(true);
          if (isInstructionElement(andInstr)) {
            expect(andInstr.instruction.operand).toBe(mask);
          }
        }
      });

      it('should handle AND with 0x00 (clear all bits)', () => {
        const instr = createAndImmInstr(0x00);

        generator.testGenAndImm(instr);

        const elements = generator.getElements();
        const andInstr = findInstruction(elements, 'AND');
        expect(isInstructionElement(andInstr)).toBe(true);
        if (isInstructionElement(andInstr)) {
          expect(andInstr.instruction.operand).toBe(0x00);
        }
      });

      it('should handle AND with 0xFF (preserve all bits)', () => {
        const instr = createAndImmInstr(0xff);

        generator.testGenAndImm(instr);

        const elements = generator.getElements();
        const andInstr = findInstruction(elements, 'AND');
        expect(isInstructionElement(andInstr)).toBe(true);
        if (isInstructionElement(andInstr)) {
          expect(andInstr.instruction.operand).toBe(0xff);
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after AND immediate', () => {
        const instr = createAndImmInstr(0x0f);

        generator.testSetAFromImmediate(0xff);
        generator.testGenAndImm(instr);

        // Accumulator should be unknown after AND
        expect(generator.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('instruction comments', () => {
      it('should preserve comment from IL instruction', () => {
        const instr = createAndImmInstr(0x55);

        generator.testGenAndImm(instr);

        const elements = generator.getElements();
        expect(hasCommentContaining(elements, 'AND')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Mixed Scenarios
  // ==========================================================================

  describe('multiple AND operations', () => {
    it('should handle consecutive AND_BYTE operations', () => {
      const slot1 = createZpSlot('mask1', 0x10);
      const slot2 = createZpSlot('mask2', 0x20);
      const instr1 = createAndByteInstr(slot1);
      const instr2 = createAndByteInstr(slot2);

      generator.testGenAndByte(instr1);
      generator.testGenAndByte(instr2);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'AND')).toBe(2);

      const instructions = getInstructions(elements);
      const andInstrs = instructions.filter(
        (e) => isInstructionElement(e) && e.instruction.mnemonic === 'AND'
      );

      expect(andInstrs.length).toBe(2);
      if (isInstructionElement(andInstrs[0]) && isInstructionElement(andInstrs[1])) {
        expect(andInstrs[0].instruction.operand).toBe(0x10);
        expect(andInstrs[1].instruction.operand).toBe(0x20);
      }
    });

    it('should handle mixed AND_BYTE and AND_IMM', () => {
      const slot = createZpSlot('mask', 0x10);
      const instr1 = createAndByteInstr(slot);
      const instr2 = createAndImmInstr(0x0f);

      generator.testGenAndByte(instr1);
      generator.testGenAndImm(instr2);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'AND')).toBe(2);

      const instructions = getInstructions(elements);
      const andInstrs = instructions.filter(
        (e) => isInstructionElement(e) && e.instruction.mnemonic === 'AND'
      );

      expect(andInstrs.length).toBe(2);
      if (isInstructionElement(andInstrs[0]) && isInstructionElement(andInstrs[1])) {
        expect(andInstrs[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(andInstrs[1].instruction.mode).toBe(AsmAddressingMode.Immediate);
      }
    });
  });
});