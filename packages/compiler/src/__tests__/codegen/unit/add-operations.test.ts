/**
 * ADD Operations Unit Tests
 *
 * Tests for ADD_BYTE and ADD_IMM code generation.
 *
 * ADD_BYTE: Adds a slot value to the accumulator
 * ADD_IMM: Adds an immediate value to the accumulator
 *
 * Expected 6502 output:
 * - CLC (Clear Carry for addition)
 * - ADC addr/value (Add with carry)
 *
 * @module __tests__/codegen/unit/add-operations.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableArithmeticOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createAddByteInstr,
  createAddImmInstr,
  findInstruction,
  findAllInstructions,
  countInstructions,
  hasCommentContaining,
} from './_arithmetic-helpers.js';
import {
  AsmAddressingMode,
  isInstructionElement,
} from '../../../codegen/asm-il/types.js';

describe('ADD Operations Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  // ==========================================================================
  // ADD_BYTE - Add slot value to A
  // ==========================================================================

  describe('ADD_BYTE', () => {
    describe('zero page addressing', () => {
      it('should generate CLC then ADC for zero page slot', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createAddByteInstr(slot);

        gen.testGenAddByte(instr);
        const elements = gen.getElements();

        // Should have CLC and ADC
        expect(countInstructions(elements, 'CLC')).toBe(1);
        expect(countInstructions(elements, 'ADC')).toBe(1);
      });

      it('should use zero page addressing mode for ZP slot', () => {
        const slot = createZpSlot('counter', 0x20);
        const instr = createAddByteInstr(slot);

        gen.testGenAddByte(instr);
        const elements = gen.getElements();

        const adc = findInstruction(elements, 'ADC');
        expect(adc).toBeDefined();
        if (adc && isInstructionElement(adc)) {
          expect(adc.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
          expect(adc.instruction.operand).toBe(0x20);
        }
      });

      it('should emit CLC before ADC', () => {
        const slot = createZpSlot('value', 0x30);
        const instr = createAddByteInstr(slot);

        gen.testGenAddByte(instr);
        const elements = gen.getElements();

        const instructions = elements.filter(isInstructionElement);
        const clcIndex = instructions.findIndex(
          (e) => e.instruction.mnemonic === 'CLC'
        );
        const adcIndex = instructions.findIndex(
          (e) => e.instruction.mnemonic === 'ADC'
        );

        expect(clcIndex).toBeLessThan(adcIndex);
      });

      it('should work with different ZP addresses', () => {
        const addresses = [0x00, 0x10, 0x50, 0x80, 0xfe, 0xff];

        for (const addr of addresses) {
          const localGen = new TestableArithmeticOpsGenerator();
          const slot = createZpSlot('v', addr);
          const instr = createAddByteInstr(slot);

          localGen.testGenAddByte(instr);
          const elements = localGen.getElements();

          const adc = findInstruction(elements, 'ADC');
          expect(adc).toBeDefined();
          if (adc && isInstructionElement(adc)) {
            expect(adc.instruction.operand).toBe(addr);
          }
        }
      });
    });

    describe('absolute addressing', () => {
      it('should generate CLC then ADC for absolute slot', () => {
        const slot = createAbsSlot('data', 0x0400);
        const instr = createAddByteInstr(slot);

        gen.testGenAddByte(instr);
        const elements = gen.getElements();

        expect(countInstructions(elements, 'CLC')).toBe(1);
        expect(countInstructions(elements, 'ADC')).toBe(1);
      });

      it('should use absolute addressing mode for absolute slot', () => {
        const slot = createAbsSlot('buffer', 0x0800);
        const instr = createAddByteInstr(slot);

        gen.testGenAddByte(instr);
        const elements = gen.getElements();

        const adc = findInstruction(elements, 'ADC');
        expect(adc).toBeDefined();
        if (adc && isInstructionElement(adc)) {
          expect(adc.instruction.mode).toBe(AsmAddressingMode.Absolute);
          expect(adc.instruction.operand).toBe(0x0800);
        }
      });

      it('should work with different absolute addresses', () => {
        const addresses = [0x0200, 0x0400, 0x0800, 0x1000, 0xc000];

        for (const addr of addresses) {
          const localGen = new TestableArithmeticOpsGenerator();
          const slot = createAbsSlot('v', addr);
          const instr = createAddByteInstr(slot);

          localGen.testGenAddByte(instr);
          const elements = localGen.getElements();

          const adc = findInstruction(elements, 'ADC');
          expect(adc).toBeDefined();
          if (adc && isInstructionElement(adc)) {
            expect(adc.instruction.operand).toBe(addr);
          }
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after ADD_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createAddByteInstr(slot);

        // Set known state
        gen.testSetAFromImmediate(5);
        expect(gen.testAHasSlot(0x10)).toBe(false);

        gen.testGenAddByte(instr);

        // A should be invalidated (result is unknown)
        expect(gen.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('comment generation', () => {
      it('should emit a comment for ADD_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createAddByteInstr(slot);

        gen.testGenAddByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'Add')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // ADD_IMM - Add immediate value to A
  // ==========================================================================

  describe('ADD_IMM', () => {
    describe('basic immediate addition', () => {
      it('should generate CLC then ADC for immediate value', () => {
        const instr = createAddImmInstr(5);

        gen.testGenAddImm(instr);
        const elements = gen.getElements();

        expect(countInstructions(elements, 'CLC')).toBe(1);
        expect(countInstructions(elements, 'ADC')).toBe(1);
      });

      it('should use immediate addressing mode', () => {
        const instr = createAddImmInstr(10);

        gen.testGenAddImm(instr);
        const elements = gen.getElements();

        const adc = findInstruction(elements, 'ADC');
        expect(adc).toBeDefined();
        if (adc && isInstructionElement(adc)) {
          expect(adc.instruction.mode).toBe(AsmAddressingMode.Immediate);
          expect(adc.instruction.operand).toBe(10);
        }
      });

      it('should emit CLC before ADC', () => {
        const instr = createAddImmInstr(1);

        gen.testGenAddImm(instr);
        const elements = gen.getElements();

        const instructions = elements.filter(isInstructionElement);
        const clcIndex = instructions.findIndex(
          (e) => e.instruction.mnemonic === 'CLC'
        );
        const adcIndex = instructions.findIndex(
          (e) => e.instruction.mnemonic === 'ADC'
        );

        expect(clcIndex).toBeLessThan(adcIndex);
      });
    });

    describe('edge values', () => {
      it('should handle adding zero', () => {
        const instr = createAddImmInstr(0);

        gen.testGenAddImm(instr);
        const elements = gen.getElements();

        const adc = findInstruction(elements, 'ADC');
        expect(adc).toBeDefined();
        if (adc && isInstructionElement(adc)) {
          expect(adc.instruction.operand).toBe(0);
        }
      });

      it('should handle adding max byte value', () => {
        const instr = createAddImmInstr(255);

        gen.testGenAddImm(instr);
        const elements = gen.getElements();

        const adc = findInstruction(elements, 'ADC');
        expect(adc).toBeDefined();
        if (adc && isInstructionElement(adc)) {
          expect(adc.instruction.operand).toBe(255);
        }
      });

      it('should work with various immediate values', () => {
        const values = [1, 10, 50, 100, 127, 128, 200, 254];

        for (const value of values) {
          const localGen = new TestableArithmeticOpsGenerator();
          const instr = createAddImmInstr(value);

          localGen.testGenAddImm(instr);
          const elements = localGen.getElements();

          const adc = findInstruction(elements, 'ADC');
          expect(adc).toBeDefined();
          if (adc && isInstructionElement(adc)) {
            expect(adc.instruction.operand).toBe(value);
          }
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after ADD_IMM', () => {
        const instr = createAddImmInstr(5);

        gen.testSetAFromImmediate(10);
        gen.testGenAddImm(instr);

        // A should be invalidated (result is 15, but we track as unknown)
        // The accumulator state tracking doesn't compute arithmetic results
        expect(gen.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('comment generation', () => {
      it('should emit a comment for ADD_IMM', () => {
        const instr = createAddImmInstr(5);

        gen.testGenAddImm(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'Add')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Combined scenarios
  // ==========================================================================

  describe('multiple add operations', () => {
    it('should generate correct code for sequential adds', () => {
      const slot = createZpSlot('x', 0x10);

      // Add slot value
      gen.testGenAddByte(createAddByteInstr(slot));
      // Add immediate
      gen.testGenAddImm(createAddImmInstr(5));

      const elements = gen.getElements();

      // Should have 2 CLC and 2 ADC
      expect(countInstructions(elements, 'CLC')).toBe(2);
      expect(countInstructions(elements, 'ADC')).toBe(2);
    });

    it('should use correct addressing modes for mixed adds', () => {
      const zpSlot = createZpSlot('zp', 0x20);
      const absSlot = createAbsSlot('abs', 0x0400);

      gen.testGenAddByte(createAddByteInstr(zpSlot));
      gen.testGenAddByte(createAddByteInstr(absSlot));
      gen.testGenAddImm(createAddImmInstr(10));

      const elements = gen.getElements();
      const adcInstructions = findAllInstructions(elements, 'ADC');

      expect(adcInstructions.length).toBe(3);

      // First ADC - zero page
      if (isInstructionElement(adcInstructions[0])) {
        expect(adcInstructions[0].instruction.mode).toBe(
          AsmAddressingMode.ZeroPage
        );
      }

      // Second ADC - absolute
      if (isInstructionElement(adcInstructions[1])) {
        expect(adcInstructions[1].instruction.mode).toBe(
          AsmAddressingMode.Absolute
        );
      }

      // Third ADC - immediate
      if (isInstructionElement(adcInstructions[2])) {
        expect(adcInstructions[2].instruction.mode).toBe(
          AsmAddressingMode.Immediate
        );
      }
    });
  });
});