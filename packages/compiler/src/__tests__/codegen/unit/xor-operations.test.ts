/**
 * XOR Operations Unit Tests
 *
 * Tests for XOR_BYTE and XOR_IMM code generation.
 * Verifies the bitwise XOR operations produce correct 6502 assembly.
 *
 * 6502 patterns:
 * - XOR_BYTE: EOR addr (with zero page or absolute addressing)
 * - XOR_IMM: EOR #imm (immediate addressing)
 *
 * @module __tests__/codegen/unit/xor-operations.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableBitwiseOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createXorByteInstr,
  createXorImmInstr,
  findInstruction,
  countInstructions,
  hasCommentContaining,
  getInstructions,
} from './_bitwise-helpers.js';
import { isInstructionElement, AsmAddressingMode } from '../../../codegen/asm-il/types.js';

describe('XOR Operations', () => {
  let generator: TestableBitwiseOpsGenerator;

  beforeEach(() => {
    generator = new TestableBitwiseOpsGenerator();
  });

  // ==========================================================================
  // XOR_BYTE - Exclusive OR with Slot
  // ==========================================================================

  describe('XOR_BYTE', () => {
    describe('zero page addressing', () => {
      it('should generate EOR with zero page addressing', () => {
        const slot = createZpSlot('toggle', 0x10);
        const instr = createXorByteInstr(slot);

        generator.testGenXorByte(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');

        expect(eorInstr).toBeDefined();
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
          expect(eorInstr.instruction.operand).toBe(0x10);
        }
      });

      it('should generate single EOR instruction for ZP', () => {
        const slot = createZpSlot('xorMask', 0x20);
        const instr = createXorByteInstr(slot);

        generator.testGenXorByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'EOR')).toBe(1);
      });

      it('should handle ZP address 0x00', () => {
        const slot = createZpSlot('lowMem', 0x00);
        const instr = createXorByteInstr(slot);

        generator.testGenXorByte(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.operand).toBe(0x00);
        }
      });

      it('should handle ZP address 0xFF', () => {
        const slot = createZpSlot('highZp', 0xff);
        const instr = createXorByteInstr(slot);

        generator.testGenXorByte(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.operand).toBe(0xff);
        }
      });

      it('should preserve comment from IL instruction', () => {
        const slot = createZpSlot('toggleBits', 0x30);
        const instr = createXorByteInstr(slot);

        generator.testGenXorByte(instr);

        const elements = generator.getElements();
        expect(hasCommentContaining(elements, 'XOR')).toBe(true);
      });
    });

    describe('absolute addressing', () => {
      it('should generate EOR with absolute addressing', () => {
        const slot = createAbsSlot('globalToggle', 0x0200);
        const instr = createXorByteInstr(slot);

        generator.testGenXorByte(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');

        expect(eorInstr).toBeDefined();
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.mode).toBe(AsmAddressingMode.Absolute);
          expect(eorInstr.instruction.operand).toBe(0x0200);
        }
      });

      it('should handle frame region addresses', () => {
        const slot = createAbsSlot('frameVar', 0x0300);
        const instr = createXorByteInstr(slot);

        generator.testGenXorByte(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.operand).toBe(0x0300);
        }
      });

      it('should handle high memory addresses', () => {
        const slot = createAbsSlot('highMem', 0xc000);
        const instr = createXorByteInstr(slot);

        generator.testGenXorByte(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.operand).toBe(0xc000);
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after XOR', () => {
        const slot = createZpSlot('toggle', 0x10);
        const instr = createXorByteInstr(slot);

        // Set known accumulator state
        generator.testSetAFromImmediate(0xaa);
        expect(generator.testAHasSlot(0x10)).toBe(false);

        generator.testGenXorByte(instr);

        // Accumulator should be unknown after XOR
        expect(generator.testAHasSlot(0x10)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // XOR_IMM - Exclusive OR with Immediate
  // ==========================================================================

  describe('XOR_IMM', () => {
    describe('basic immediate XOR', () => {
      it('should generate EOR with immediate value', () => {
        const instr = createXorImmInstr(0xff);

        generator.testGenXorImm(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');

        expect(eorInstr).toBeDefined();
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.mode).toBe(AsmAddressingMode.Immediate);
          expect(eorInstr.instruction.operand).toBe(0xff);
        }
      });

      it('should generate single EOR instruction', () => {
        const instr = createXorImmInstr(0x55);

        generator.testGenXorImm(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'EOR')).toBe(1);
      });
    });

    describe('common XOR patterns', () => {
      it('should handle toggle low nibble (0x0F)', () => {
        const instr = createXorImmInstr(0x0f);

        generator.testGenXorImm(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.operand).toBe(0x0f);
        }
      });

      it('should handle toggle high nibble (0xF0)', () => {
        const instr = createXorImmInstr(0xf0);

        generator.testGenXorImm(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.operand).toBe(0xf0);
        }
      });

      it('should handle single bit toggle values', () => {
        const bitValues = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];

        for (const value of bitValues) {
          const gen = new TestableBitwiseOpsGenerator();
          const instr = createXorImmInstr(value);

          gen.testGenXorImm(instr);

          const elements = gen.getElements();
          const eorInstr = findInstruction(elements, 'EOR');
          expect(isInstructionElement(eorInstr)).toBe(true);
          if (isInstructionElement(eorInstr)) {
            expect(eorInstr.instruction.operand).toBe(value);
          }
        }
      });

      it('should handle XOR with 0x00 (no change)', () => {
        const instr = createXorImmInstr(0x00);

        generator.testGenXorImm(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.operand).toBe(0x00);
        }
      });

      it('should handle XOR with 0xFF (invert all bits)', () => {
        const instr = createXorImmInstr(0xff);

        generator.testGenXorImm(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.operand).toBe(0xff);
        }
      });

      it('should handle alternating bit pattern 0xAA', () => {
        const instr = createXorImmInstr(0xaa);

        generator.testGenXorImm(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.operand).toBe(0xaa);
        }
      });

      it('should handle alternating bit pattern 0x55', () => {
        const instr = createXorImmInstr(0x55);

        generator.testGenXorImm(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.operand).toBe(0x55);
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after XOR immediate', () => {
        const instr = createXorImmInstr(0xff);

        generator.testSetAFromImmediate(0xaa);
        generator.testGenXorImm(instr);

        // Accumulator should be unknown after XOR
        expect(generator.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('instruction comments', () => {
      it('should preserve comment from IL instruction', () => {
        const instr = createXorImmInstr(0x5a);

        generator.testGenXorImm(instr);

        const elements = generator.getElements();
        expect(hasCommentContaining(elements, 'XOR')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Mixed Scenarios
  // ==========================================================================

  describe('multiple XOR operations', () => {
    it('should handle consecutive XOR_BYTE operations', () => {
      const slot1 = createZpSlot('toggle1', 0x10);
      const slot2 = createZpSlot('toggle2', 0x20);
      const instr1 = createXorByteInstr(slot1);
      const instr2 = createXorByteInstr(slot2);

      generator.testGenXorByte(instr1);
      generator.testGenXorByte(instr2);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'EOR')).toBe(2);

      const instructions = getInstructions(elements);
      const eorInstrs = instructions.filter(
        (e) => isInstructionElement(e) && e.instruction.mnemonic === 'EOR'
      );

      expect(eorInstrs.length).toBe(2);
      if (isInstructionElement(eorInstrs[0]) && isInstructionElement(eorInstrs[1])) {
        expect(eorInstrs[0].instruction.operand).toBe(0x10);
        expect(eorInstrs[1].instruction.operand).toBe(0x20);
      }
    });

    it('should handle mixed XOR_BYTE and XOR_IMM', () => {
      const slot = createZpSlot('toggle', 0x10);
      const instr1 = createXorByteInstr(slot);
      const instr2 = createXorImmInstr(0xff);

      generator.testGenXorByte(instr1);
      generator.testGenXorImm(instr2);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'EOR')).toBe(2);

      const instructions = getInstructions(elements);
      const eorInstrs = instructions.filter(
        (e) => isInstructionElement(e) && e.instruction.mnemonic === 'EOR'
      );

      expect(eorInstrs.length).toBe(2);
      if (isInstructionElement(eorInstrs[0]) && isInstructionElement(eorInstrs[1])) {
        expect(eorInstrs[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(eorInstrs[1].instruction.mode).toBe(AsmAddressingMode.Immediate);
      }
    });

    it('should handle double XOR to restore original value', () => {
      // XOR with same value twice returns to original
      const instr1 = createXorImmInstr(0xff);
      const instr2 = createXorImmInstr(0xff);

      generator.testGenXorImm(instr1);
      generator.testGenXorImm(instr2);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'EOR')).toBe(2);

      const instructions = getInstructions(elements);
      const eorInstrs = instructions.filter(
        (e) => isInstructionElement(e) && e.instruction.mnemonic === 'EOR'
      );

      expect(eorInstrs.length).toBe(2);
      // Both should XOR with 0xFF
      if (isInstructionElement(eorInstrs[0]) && isInstructionElement(eorInstrs[1])) {
        expect(eorInstrs[0].instruction.operand).toBe(0xff);
        expect(eorInstrs[1].instruction.operand).toBe(0xff);
      }
    });
  });
});