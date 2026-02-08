/**
 * MUL Operations Unit Tests
 *
 * Tests for MUL_BYTE and MUL_IMM code generation.
 *
 * MUL_BYTE: Multiplies accumulator by a slot value
 * MUL_IMM: Multiplies accumulator by an immediate value
 *
 * Since the 6502 has no native multiply instruction, these operations
 * use software routines (__mul8) with temp storage:
 * - Save A (multiplicand) to $FE
 * - Load multiplier to $FF
 * - Restore A and call __mul8
 *
 * @module __tests__/codegen/unit/mul-operations.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableArithmeticOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createMulByteInstr,
  createMulImmInstr,
  findInstruction,
  findAllInstructions,
  countInstructions,
  hasCommentContaining,
} from './_arithmetic-helpers.js';
import {
  AsmAddressingMode,
  isInstructionElement,
} from '../../../codegen/asm-il/types.js';

describe('MUL Operations Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  // ==========================================================================
  // MUL_BYTE - Multiply A by slot value
  // ==========================================================================

  describe('MUL_BYTE', () => {
    describe('instruction sequence', () => {
      it('should generate correct sequence for MUL_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createMulByteInstr(slot);

        gen.testGenMulByte(instr);
        const elements = gen.getElements();

        // Expected: STA $FE, LDA slot, STA $FF, LDA $FE, JSR __mul8
        expect(countInstructions(elements, 'STA')).toBeGreaterThanOrEqual(2);
        expect(countInstructions(elements, 'LDA')).toBeGreaterThanOrEqual(2);
        expect(countInstructions(elements, 'JSR')).toBe(1);
      });

      it('should save multiplicand to $FE first', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createMulByteInstr(slot);

        gen.testGenMulByte(instr);
        const elements = gen.getElements();

        const staInstructions = findAllInstructions(elements, 'STA');
        expect(staInstructions.length).toBeGreaterThanOrEqual(2);

        // First STA should be to $FE
        if (isInstructionElement(staInstructions[0])) {
          expect(staInstructions[0].instruction.operand).toBe(0xfe);
        }
      });

      it('should load multiplier from slot', () => {
        const slot = createZpSlot('mult', 0x20);
        const instr = createMulByteInstr(slot);

        gen.testGenMulByte(instr);
        const elements = gen.getElements();

        // Find LDA that loads from slot address
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadFromSlot = ldaInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0x20
        );
        expect(loadFromSlot).toBeDefined();
      });

      it('should store multiplier to $FF', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createMulByteInstr(slot);

        gen.testGenMulByte(instr);
        const elements = gen.getElements();

        const staInstructions = findAllInstructions(elements, 'STA');
        const storeToFF = staInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0xff
        );
        expect(storeToFF).toBeDefined();
      });

      it('should restore multiplicand from $FE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createMulByteInstr(slot);

        gen.testGenMulByte(instr);
        const elements = gen.getElements();

        // Find LDA that loads from $FE
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadFromFE = ldaInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0xfe
        );
        expect(loadFromFE).toBeDefined();
      });

      it('should call __mul8 routine', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createMulByteInstr(slot);

        gen.testGenMulByte(instr);
        const elements = gen.getElements();

        const jsr = findInstruction(elements, 'JSR');
        expect(jsr).toBeDefined();
        if (jsr && isInstructionElement(jsr)) {
          expect(jsr.instruction.labelOperand).toBe('__mul8');
        }
      });
    });

    describe('zero page vs absolute', () => {
      it('should use zero page addressing for ZP slot', () => {
        const slot = createZpSlot('zp', 0x30);
        const instr = createMulByteInstr(slot);

        gen.testGenMulByte(instr);
        const elements = gen.getElements();

        // Find LDA that loads from slot
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadFromSlot = ldaInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0x30
        );
        expect(loadFromSlot).toBeDefined();
        if (loadFromSlot && isInstructionElement(loadFromSlot)) {
          expect(loadFromSlot.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        }
      });

      it('should use absolute addressing for absolute slot', () => {
        const slot = createAbsSlot('abs', 0x0400);
        const instr = createMulByteInstr(slot);

        gen.testGenMulByte(instr);
        const elements = gen.getElements();

        // Find LDA that loads from slot
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadFromSlot = ldaInstructions.find(
          (e) => isInstructionElement(e) && e.instruction.operand === 0x0400
        );
        expect(loadFromSlot).toBeDefined();
        if (loadFromSlot && isInstructionElement(loadFromSlot)) {
          expect(loadFromSlot.instruction.mode).toBe(AsmAddressingMode.Absolute);
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after MUL_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createMulByteInstr(slot);

        gen.testSetAFromImmediate(5);
        gen.testGenMulByte(instr);

        // A should be invalidated (result is unknown)
        expect(gen.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('comment generation', () => {
      it('should emit a comment for MUL_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createMulByteInstr(slot);

        gen.testGenMulByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'Mul')).toBe(true);
      });

      it('should emit multiplicand comment', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createMulByteInstr(slot);

        gen.testGenMulByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'multiplicand')).toBe(true);
      });

      it('should emit multiplier comment', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createMulByteInstr(slot);

        gen.testGenMulByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'multiplier')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // MUL_IMM - Multiply A by immediate value
  // ==========================================================================

  describe('MUL_IMM', () => {
    describe('instruction sequence', () => {
      it('should generate correct sequence for MUL_IMM', () => {
        const instr = createMulImmInstr(5);

        gen.testGenMulImm(instr);
        const elements = gen.getElements();

        // Expected: STA $FE, LDA #imm, STA $FF, LDA $FE, JSR __mul8
        expect(countInstructions(elements, 'STA')).toBeGreaterThanOrEqual(2);
        expect(countInstructions(elements, 'LDA')).toBeGreaterThanOrEqual(2);
        expect(countInstructions(elements, 'JSR')).toBe(1);
      });

      it('should save multiplicand to $FE first', () => {
        const instr = createMulImmInstr(10);

        gen.testGenMulImm(instr);
        const elements = gen.getElements();

        const staInstructions = findAllInstructions(elements, 'STA');
        expect(staInstructions.length).toBeGreaterThanOrEqual(2);

        // First STA should be to $FE
        if (isInstructionElement(staInstructions[0])) {
          expect(staInstructions[0].instruction.operand).toBe(0xfe);
        }
      });

      it('should load multiplier as immediate', () => {
        const instr = createMulImmInstr(7);

        gen.testGenMulImm(instr);
        const elements = gen.getElements();

        // Find LDA with immediate value 7
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadImm = ldaInstructions.find(
          (e) =>
            isInstructionElement(e) &&
            e.instruction.mode === AsmAddressingMode.Immediate &&
            e.instruction.operand === 7
        );
        expect(loadImm).toBeDefined();
      });

      it('should call __mul8 routine', () => {
        const instr = createMulImmInstr(5);

        gen.testGenMulImm(instr);
        const elements = gen.getElements();

        const jsr = findInstruction(elements, 'JSR');
        expect(jsr).toBeDefined();
        if (jsr && isInstructionElement(jsr)) {
          expect(jsr.instruction.labelOperand).toBe('__mul8');
        }
      });
    });

    describe('edge values', () => {
      it('should handle multiplying by zero', () => {
        const instr = createMulImmInstr(0);

        gen.testGenMulImm(instr);
        const elements = gen.getElements();

        // Find LDA with immediate 0
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadZero = ldaInstructions.find(
          (e) =>
            isInstructionElement(e) &&
            e.instruction.mode === AsmAddressingMode.Immediate &&
            e.instruction.operand === 0
        );
        expect(loadZero).toBeDefined();
      });

      it('should handle multiplying by one', () => {
        const instr = createMulImmInstr(1);

        gen.testGenMulImm(instr);
        const elements = gen.getElements();

        // Find LDA with immediate 1
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadOne = ldaInstructions.find(
          (e) =>
            isInstructionElement(e) &&
            e.instruction.mode === AsmAddressingMode.Immediate &&
            e.instruction.operand === 1
        );
        expect(loadOne).toBeDefined();
      });

      it('should handle multiplying by max byte value', () => {
        const instr = createMulImmInstr(255);

        gen.testGenMulImm(instr);
        const elements = gen.getElements();

        // Find LDA with immediate 255
        const ldaInstructions = findAllInstructions(elements, 'LDA');
        const loadMax = ldaInstructions.find(
          (e) =>
            isInstructionElement(e) &&
            e.instruction.mode === AsmAddressingMode.Immediate &&
            e.instruction.operand === 255
        );
        expect(loadMax).toBeDefined();
      });

      it('should work with various immediate values', () => {
        const values = [2, 5, 10, 16, 32, 64, 100, 128];

        for (const value of values) {
          const localGen = new TestableArithmeticOpsGenerator();
          const instr = createMulImmInstr(value);

          localGen.testGenMulImm(instr);
          const elements = localGen.getElements();

          // Find LDA with this immediate
          const ldaInstructions = findAllInstructions(elements, 'LDA');
          const loadValue = ldaInstructions.find(
            (e) =>
              isInstructionElement(e) &&
              e.instruction.mode === AsmAddressingMode.Immediate &&
              e.instruction.operand === value
          );
          expect(loadValue).toBeDefined();
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after MUL_IMM', () => {
        const instr = createMulImmInstr(5);

        gen.testSetAFromImmediate(10);
        gen.testGenMulImm(instr);

        // A should be invalidated (result is unknown)
        expect(gen.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('comment generation', () => {
      it('should emit a comment for MUL_IMM', () => {
        const instr = createMulImmInstr(5);

        gen.testGenMulImm(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'Mul')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Combined scenarios
  // ==========================================================================

  describe('multiple mul operations', () => {
    it('should generate independent sequences for each multiply', () => {
      const slot = createZpSlot('x', 0x10);

      gen.testGenMulByte(createMulByteInstr(slot));
      gen.testGenMulImm(createMulImmInstr(5));

      const elements = gen.getElements();

      // Should have 2 JSR calls
      expect(countInstructions(elements, 'JSR')).toBe(2);
    });
  });

  // ==========================================================================
  // Implementation detail verification
  // ==========================================================================

  describe('temp storage usage', () => {
    it('should use $FE for multiplicand temp storage', () => {
      const slot = createZpSlot('x', 0x10);
      const instr = createMulByteInstr(slot);

      gen.testGenMulByte(instr);
      const elements = gen.getElements();

      // Should have STA $FE and LDA $FE
      const staInstructions = findAllInstructions(elements, 'STA');
      const storeToFE = staInstructions.find(
        (e) => isInstructionElement(e) && e.instruction.operand === 0xfe
      );
      expect(storeToFE).toBeDefined();

      const ldaInstructions = findAllInstructions(elements, 'LDA');
      const loadFromFE = ldaInstructions.find(
        (e) => isInstructionElement(e) && e.instruction.operand === 0xfe
      );
      expect(loadFromFE).toBeDefined();
    });

    it('should use $FF for multiplier temp storage', () => {
      const slot = createZpSlot('x', 0x10);
      const instr = createMulByteInstr(slot);

      gen.testGenMulByte(instr);
      const elements = gen.getElements();

      const staInstructions = findAllInstructions(elements, 'STA');
      const storeToFF = staInstructions.find(
        (e) => isInstructionElement(e) && e.instruction.operand === 0xff
      );
      expect(storeToFF).toBeDefined();
    });
  });
});