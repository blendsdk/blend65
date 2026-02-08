/**
 * OR Operations Unit Tests
 *
 * Tests for OR_BYTE and OR_IMM code generation.
 * Verifies the bitwise OR operations produce correct 6502 assembly.
 *
 * 6502 patterns:
 * - OR_BYTE: ORA addr (with zero page or absolute addressing)
 * - OR_IMM: ORA #imm (immediate addressing)
 *
 * @module __tests__/codegen/unit/or-operations.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableBitwiseOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createOrByteInstr,
  createOrImmInstr,
  findInstruction,
  countInstructions,
  hasCommentContaining,
  getInstructions,
} from './_bitwise-helpers.js';
import { isInstructionElement, AsmAddressingMode } from '../../../codegen/asm-il/types.js';

describe('OR Operations', () => {
  let generator: TestableBitwiseOpsGenerator;

  beforeEach(() => {
    generator = new TestableBitwiseOpsGenerator();
  });

  // ==========================================================================
  // OR_BYTE - Logical OR with Slot
  // ==========================================================================

  describe('OR_BYTE', () => {
    describe('zero page addressing', () => {
      it('should generate ORA with zero page addressing', () => {
        const slot = createZpSlot('flags', 0x10);
        const instr = createOrByteInstr(slot);

        generator.testGenOrByte(instr);

        const elements = generator.getElements();
        const oraInstr = findInstruction(elements, 'ORA');

        expect(oraInstr).toBeDefined();
        expect(isInstructionElement(oraInstr)).toBe(true);
        if (isInstructionElement(oraInstr)) {
          expect(oraInstr.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
          expect(oraInstr.instruction.operand).toBe(0x10);
        }
      });

      it('should generate single ORA instruction for ZP', () => {
        const slot = createZpSlot('bits', 0x20);
        const instr = createOrByteInstr(slot);

        generator.testGenOrByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'ORA')).toBe(1);
      });

      it('should handle ZP address 0x00', () => {
        const slot = createZpSlot('lowMem', 0x00);
        const instr = createOrByteInstr(slot);

        generator.testGenOrByte(instr);

        const elements = generator.getElements();
        const oraInstr = findInstruction(elements, 'ORA');
        expect(isInstructionElement(oraInstr)).toBe(true);
        if (isInstructionElement(oraInstr)) {
          expect(oraInstr.instruction.operand).toBe(0x00);
        }
      });

      it('should handle ZP address 0xFF', () => {
        const slot = createZpSlot('highZp', 0xff);
        const instr = createOrByteInstr(slot);

        generator.testGenOrByte(instr);

        const elements = generator.getElements();
        const oraInstr = findInstruction(elements, 'ORA');
        expect(isInstructionElement(oraInstr)).toBe(true);
        if (isInstructionElement(oraInstr)) {
          expect(oraInstr.instruction.operand).toBe(0xff);
        }
      });

      it('should preserve comment from IL instruction', () => {
        const slot = createZpSlot('bitFlags', 0x30);
        const instr = createOrByteInstr(slot);

        generator.testGenOrByte(instr);

        const elements = generator.getElements();
        expect(hasCommentContaining(elements, 'OR')).toBe(true);
      });
    });

    describe('absolute addressing', () => {
      it('should generate ORA with absolute addressing', () => {
        const slot = createAbsSlot('globalFlags', 0x0200);
        const instr = createOrByteInstr(slot);

        generator.testGenOrByte(instr);

        const elements = generator.getElements();
        const oraInstr = findInstruction(elements, 'ORA');

        expect(oraInstr).toBeDefined();
        expect(isInstructionElement(oraInstr)).toBe(true);
        if (isInstructionElement(oraInstr)) {
          expect(oraInstr.instruction.mode).toBe(AsmAddressingMode.Absolute);
          expect(oraInstr.instruction.operand).toBe(0x0200);
        }
      });

      it('should handle frame region addresses', () => {
        const slot = createAbsSlot('frameVar', 0x0300);
        const instr = createOrByteInstr(slot);

        generator.testGenOrByte(instr);

        const elements = generator.getElements();
        const oraInstr = findInstruction(elements, 'ORA');
        expect(isInstructionElement(oraInstr)).toBe(true);
        if (isInstructionElement(oraInstr)) {
          expect(oraInstr.instruction.operand).toBe(0x0300);
        }
      });

      it('should handle high memory addresses', () => {
        const slot = createAbsSlot('highMem', 0xc000);
        const instr = createOrByteInstr(slot);

        generator.testGenOrByte(instr);

        const elements = generator.getElements();
        const oraInstr = findInstruction(elements, 'ORA');
        expect(isInstructionElement(oraInstr)).toBe(true);
        if (isInstructionElement(oraInstr)) {
          expect(oraInstr.instruction.operand).toBe(0xc000);
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after OR', () => {
        const slot = createZpSlot('flags', 0x10);
        const instr = createOrByteInstr(slot);

        // Set known accumulator state
        generator.testSetAFromImmediate(0x00);
        expect(generator.testAHasSlot(0x10)).toBe(false);

        generator.testGenOrByte(instr);

        // Accumulator should be unknown after OR
        expect(generator.testAHasSlot(0x10)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // OR_IMM - Logical OR with Immediate
  // ==========================================================================

  describe('OR_IMM', () => {
    describe('basic immediate OR', () => {
      it('should generate ORA with immediate value', () => {
        const instr = createOrImmInstr(0x80);

        generator.testGenOrImm(instr);

        const elements = generator.getElements();
        const oraInstr = findInstruction(elements, 'ORA');

        expect(oraInstr).toBeDefined();
        expect(isInstructionElement(oraInstr)).toBe(true);
        if (isInstructionElement(oraInstr)) {
          expect(oraInstr.instruction.mode).toBe(AsmAddressingMode.Immediate);
          expect(oraInstr.instruction.operand).toBe(0x80);
        }
      });

      it('should generate single ORA instruction', () => {
        const instr = createOrImmInstr(0x01);

        generator.testGenOrImm(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'ORA')).toBe(1);
      });
    });

    describe('common bit set patterns', () => {
      it('should handle setting low nibble (0x0F)', () => {
        const instr = createOrImmInstr(0x0f);

        generator.testGenOrImm(instr);

        const elements = generator.getElements();
        const oraInstr = findInstruction(elements, 'ORA');
        expect(isInstructionElement(oraInstr)).toBe(true);
        if (isInstructionElement(oraInstr)) {
          expect(oraInstr.instruction.operand).toBe(0x0f);
        }
      });

      it('should handle setting high nibble (0xF0)', () => {
        const instr = createOrImmInstr(0xf0);

        generator.testGenOrImm(instr);

        const elements = generator.getElements();
        const oraInstr = findInstruction(elements, 'ORA');
        expect(isInstructionElement(oraInstr)).toBe(true);
        if (isInstructionElement(oraInstr)) {
          expect(oraInstr.instruction.operand).toBe(0xf0);
        }
      });

      it('should handle single bit set values', () => {
        const bitValues = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];

        for (const value of bitValues) {
          const gen = new TestableBitwiseOpsGenerator();
          const instr = createOrImmInstr(value);

          gen.testGenOrImm(instr);

          const elements = gen.getElements();
          const oraInstr = findInstruction(elements, 'ORA');
          expect(isInstructionElement(oraInstr)).toBe(true);
          if (isInstructionElement(oraInstr)) {
            expect(oraInstr.instruction.operand).toBe(value);
          }
        }
      });

      it('should handle OR with 0x00 (no change)', () => {
        const instr = createOrImmInstr(0x00);

        generator.testGenOrImm(instr);

        const elements = generator.getElements();
        const oraInstr = findInstruction(elements, 'ORA');
        expect(isInstructionElement(oraInstr)).toBe(true);
        if (isInstructionElement(oraInstr)) {
          expect(oraInstr.instruction.operand).toBe(0x00);
        }
      });

      it('should handle OR with 0xFF (set all bits)', () => {
        const instr = createOrImmInstr(0xff);

        generator.testGenOrImm(instr);

        const elements = generator.getElements();
        const oraInstr = findInstruction(elements, 'ORA');
        expect(isInstructionElement(oraInstr)).toBe(true);
        if (isInstructionElement(oraInstr)) {
          expect(oraInstr.instruction.operand).toBe(0xff);
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after OR immediate', () => {
        const instr = createOrImmInstr(0x80);

        generator.testSetAFromImmediate(0x00);
        generator.testGenOrImm(instr);

        // Accumulator should be unknown after OR
        expect(generator.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('instruction comments', () => {
      it('should preserve comment from IL instruction', () => {
        const instr = createOrImmInstr(0xaa);

        generator.testGenOrImm(instr);

        const elements = generator.getElements();
        expect(hasCommentContaining(elements, 'OR')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Mixed Scenarios
  // ==========================================================================

  describe('multiple OR operations', () => {
    it('should handle consecutive OR_BYTE operations', () => {
      const slot1 = createZpSlot('flags1', 0x10);
      const slot2 = createZpSlot('flags2', 0x20);
      const instr1 = createOrByteInstr(slot1);
      const instr2 = createOrByteInstr(slot2);

      generator.testGenOrByte(instr1);
      generator.testGenOrByte(instr2);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'ORA')).toBe(2);

      const instructions = getInstructions(elements);
      const oraInstrs = instructions.filter(
        (e) => isInstructionElement(e) && e.instruction.mnemonic === 'ORA'
      );

      expect(oraInstrs.length).toBe(2);
      if (isInstructionElement(oraInstrs[0]) && isInstructionElement(oraInstrs[1])) {
        expect(oraInstrs[0].instruction.operand).toBe(0x10);
        expect(oraInstrs[1].instruction.operand).toBe(0x20);
      }
    });

    it('should handle mixed OR_BYTE and OR_IMM', () => {
      const slot = createZpSlot('flags', 0x10);
      const instr1 = createOrByteInstr(slot);
      const instr2 = createOrImmInstr(0x80);

      generator.testGenOrByte(instr1);
      generator.testGenOrImm(instr2);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'ORA')).toBe(2);

      const instructions = getInstructions(elements);
      const oraInstrs = instructions.filter(
        (e) => isInstructionElement(e) && e.instruction.mnemonic === 'ORA'
      );

      expect(oraInstrs.length).toBe(2);
      if (isInstructionElement(oraInstrs[0]) && isInstructionElement(oraInstrs[1])) {
        expect(oraInstrs[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(oraInstrs[1].instruction.mode).toBe(AsmAddressingMode.Immediate);
      }
    });
  });
});