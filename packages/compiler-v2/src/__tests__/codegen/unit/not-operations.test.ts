/**
 * NOT Operations Unit Tests
 *
 * Tests for NOT_BYTE code generation.
 * Verifies the bitwise NOT (complement) operation produces correct 6502 assembly.
 *
 * 6502 pattern:
 * - NOT_BYTE: EOR #$FF (XOR with all 1s inverts all bits)
 *
 * @module __tests__/codegen/unit/not-operations.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableBitwiseOpsGenerator,
  createNotByteInstr,
  findInstruction,
  countInstructions,
  hasCommentContaining,
} from './_bitwise-helpers.js';
import { isInstructionElement, AsmAddressingMode } from '../../../codegen/asm-il/types.js';

describe('NOT Operations', () => {
  let generator: TestableBitwiseOpsGenerator;

  beforeEach(() => {
    generator = new TestableBitwiseOpsGenerator();
  });

  // ==========================================================================
  // NOT_BYTE - Bitwise Complement
  // ==========================================================================

  describe('NOT_BYTE', () => {
    describe('basic NOT operation', () => {
      it('should generate EOR #$FF for bitwise NOT', () => {
        const instr = createNotByteInstr();

        generator.testGenNotByte(instr);

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
        const instr = createNotByteInstr();

        generator.testGenNotByte(instr);

        const elements = generator.getElements();
        expect(countInstructions(elements, 'EOR')).toBe(1);
      });

      it('should use immediate addressing mode', () => {
        const instr = createNotByteInstr();

        generator.testGenNotByte(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.mode).toBe(AsmAddressingMode.Immediate);
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after NOT', () => {
        const instr = createNotByteInstr();

        // Set known accumulator state
        generator.testSetAFromImmediate(0x55);

        generator.testGenNotByte(instr);

        // Accumulator should be unknown after NOT
        // (value is now ~0x55 = 0xAA, but we track slots, not values)
        expect(generator.testAHasSlot(0x10)).toBe(false);
      });

      it('should work regardless of initial accumulator state', () => {
        const instr = createNotByteInstr();

        // Unknown accumulator state
        generator.testInvalidateA();

        generator.testGenNotByte(instr);

        const elements = generator.getElements();
        const eorInstr = findInstruction(elements, 'EOR');
        expect(isInstructionElement(eorInstr)).toBe(true);
        if (isInstructionElement(eorInstr)) {
          expect(eorInstr.instruction.operand).toBe(0xff);
        }
      });
    });

    describe('instruction comments', () => {
      it('should preserve comment from IL instruction', () => {
        const instr = createNotByteInstr();

        generator.testGenNotByte(instr);

        const elements = generator.getElements();
        expect(hasCommentContaining(elements, 'NOT')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Multiple NOT Operations
  // ==========================================================================

  describe('multiple NOT operations', () => {
    it('should handle consecutive NOT operations', () => {
      const instr1 = createNotByteInstr();
      const instr2 = createNotByteInstr();

      generator.testGenNotByte(instr1);
      generator.testGenNotByte(instr2);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'EOR')).toBe(2);
    });

    it('should double NOT return to original value (mathematically)', () => {
      // NOT(NOT(x)) = x
      // This tests that we generate two EOR #$FF instructions
      const instr1 = createNotByteInstr();
      const instr2 = createNotByteInstr();

      generator.testGenNotByte(instr1);
      generator.testGenNotByte(instr2);

      const elements = generator.getElements();
      const eorInstrs = elements.filter(
        (e) => isInstructionElement(e) && e.instruction.mnemonic === 'EOR'
      );

      expect(eorInstrs.length).toBe(2);

      // Both should be EOR #$FF
      for (const eor of eorInstrs) {
        if (isInstructionElement(eor)) {
          expect(eor.instruction.mode).toBe(AsmAddressingMode.Immediate);
          expect(eor.instruction.operand).toBe(0xff);
        }
      }
    });

    it('should handle triple NOT operations', () => {
      // NOT(NOT(NOT(x))) = NOT(x)
      const instr1 = createNotByteInstr();
      const instr2 = createNotByteInstr();
      const instr3 = createNotByteInstr();

      generator.testGenNotByte(instr1);
      generator.testGenNotByte(instr2);
      generator.testGenNotByte(instr3);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'EOR')).toBe(3);
    });
  });

  // ==========================================================================
  // NOT Operation Properties
  // ==========================================================================

  describe('NOT operation properties', () => {
    it('should generate minimal instruction count', () => {
      const instr = createNotByteInstr();

      generator.testGenNotByte(instr);

      const elements = generator.getElements();
      // NOT should be a single instruction (EOR #$FF)
      const instrCount = elements.filter((e) => isInstructionElement(e)).length;
      expect(instrCount).toBe(1);
    });

    it('should not require any memory access', () => {
      const instr = createNotByteInstr();

      generator.testGenNotByte(instr);

      const elements = generator.getElements();
      const eorInstr = findInstruction(elements, 'EOR');

      // Should use immediate mode, not memory access
      if (isInstructionElement(eorInstr)) {
        expect(eorInstr.instruction.mode).toBe(AsmAddressingMode.Immediate);
        // No LDA or STA required
        expect(countInstructions(elements, 'LDA')).toBe(0);
        expect(countInstructions(elements, 'STA')).toBe(0);
      }
    });

    it('should be self-inverse (mathematically)', () => {
      // This is a mathematical property test:
      // For any byte x: ~(~x) = x
      // We verify we generate the correct instruction that achieves this

      const instr = createNotByteInstr();
      generator.testGenNotByte(instr);

      const elements = generator.getElements();
      const eorInstr = findInstruction(elements, 'EOR');

      // EOR #$FF is the correct implementation of NOT
      // because: x EOR $FF inverts all bits
      expect(isInstructionElement(eorInstr)).toBe(true);
      if (isInstructionElement(eorInstr)) {
        expect(eorInstr.instruction.operand).toBe(0xff);
      }
    });
  });
});