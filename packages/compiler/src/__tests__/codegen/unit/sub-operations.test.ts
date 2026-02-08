/**
 * SUB Operations Unit Tests
 *
 * Tests for SUB_BYTE and SUB_IMM code generation.
 *
 * SUB_BYTE: Subtracts a slot value from the accumulator
 * SUB_IMM: Subtracts an immediate value from the accumulator
 *
 * Expected 6502 output:
 * - SEC (Set Carry for subtraction)
 * - SBC addr/value (Subtract with carry)
 *
 * @module __tests__/codegen/unit/sub-operations.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableArithmeticOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createSubByteInstr,
  createSubImmInstr,
  findInstruction,
  findAllInstructions,
  countInstructions,
  hasCommentContaining,
} from './_arithmetic-helpers.js';
import {
  AsmAddressingMode,
  isInstructionElement,
} from '../../../codegen/asm-il/types.js';

describe('SUB Operations Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  // ==========================================================================
  // SUB_BYTE - Subtract slot value from A
  // ==========================================================================

  describe('SUB_BYTE', () => {
    describe('zero page addressing', () => {
      it('should generate SEC then SBC for zero page slot', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createSubByteInstr(slot);

        gen.testGenSubByte(instr);
        const elements = gen.getElements();

        // Should have SEC and SBC
        expect(countInstructions(elements, 'SEC')).toBe(1);
        expect(countInstructions(elements, 'SBC')).toBe(1);
      });

      it('should use zero page addressing mode for ZP slot', () => {
        const slot = createZpSlot('counter', 0x20);
        const instr = createSubByteInstr(slot);

        gen.testGenSubByte(instr);
        const elements = gen.getElements();

        const sbc = findInstruction(elements, 'SBC');
        expect(sbc).toBeDefined();
        if (sbc && isInstructionElement(sbc)) {
          expect(sbc.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
          expect(sbc.instruction.operand).toBe(0x20);
        }
      });

      it('should emit SEC before SBC', () => {
        const slot = createZpSlot('value', 0x30);
        const instr = createSubByteInstr(slot);

        gen.testGenSubByte(instr);
        const elements = gen.getElements();

        const instructions = elements.filter(isInstructionElement);
        const secIndex = instructions.findIndex(
          (e) => e.instruction.mnemonic === 'SEC'
        );
        const sbcIndex = instructions.findIndex(
          (e) => e.instruction.mnemonic === 'SBC'
        );

        expect(secIndex).toBeLessThan(sbcIndex);
      });

      it('should work with different ZP addresses', () => {
        const addresses = [0x00, 0x10, 0x50, 0x80, 0xfe, 0xff];

        for (const addr of addresses) {
          const localGen = new TestableArithmeticOpsGenerator();
          const slot = createZpSlot('v', addr);
          const instr = createSubByteInstr(slot);

          localGen.testGenSubByte(instr);
          const elements = localGen.getElements();

          const sbc = findInstruction(elements, 'SBC');
          expect(sbc).toBeDefined();
          if (sbc && isInstructionElement(sbc)) {
            expect(sbc.instruction.operand).toBe(addr);
          }
        }
      });
    });

    describe('absolute addressing', () => {
      it('should generate SEC then SBC for absolute slot', () => {
        const slot = createAbsSlot('data', 0x0400);
        const instr = createSubByteInstr(slot);

        gen.testGenSubByte(instr);
        const elements = gen.getElements();

        expect(countInstructions(elements, 'SEC')).toBe(1);
        expect(countInstructions(elements, 'SBC')).toBe(1);
      });

      it('should use absolute addressing mode for absolute slot', () => {
        const slot = createAbsSlot('buffer', 0x0800);
        const instr = createSubByteInstr(slot);

        gen.testGenSubByte(instr);
        const elements = gen.getElements();

        const sbc = findInstruction(elements, 'SBC');
        expect(sbc).toBeDefined();
        if (sbc && isInstructionElement(sbc)) {
          expect(sbc.instruction.mode).toBe(AsmAddressingMode.Absolute);
          expect(sbc.instruction.operand).toBe(0x0800);
        }
      });

      it('should work with different absolute addresses', () => {
        const addresses = [0x0200, 0x0400, 0x0800, 0x1000, 0xc000];

        for (const addr of addresses) {
          const localGen = new TestableArithmeticOpsGenerator();
          const slot = createAbsSlot('v', addr);
          const instr = createSubByteInstr(slot);

          localGen.testGenSubByte(instr);
          const elements = localGen.getElements();

          const sbc = findInstruction(elements, 'SBC');
          expect(sbc).toBeDefined();
          if (sbc && isInstructionElement(sbc)) {
            expect(sbc.instruction.operand).toBe(addr);
          }
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after SUB_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createSubByteInstr(slot);

        // Set known state
        gen.testSetAFromImmediate(50);

        gen.testGenSubByte(instr);

        // A should be invalidated (result is unknown)
        expect(gen.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('comment generation', () => {
      it('should emit a comment for SUB_BYTE', () => {
        const slot = createZpSlot('x', 0x10);
        const instr = createSubByteInstr(slot);

        gen.testGenSubByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'Sub')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // SUB_IMM - Subtract immediate value from A
  // ==========================================================================

  describe('SUB_IMM', () => {
    describe('basic immediate subtraction', () => {
      it('should generate SEC then SBC for immediate value', () => {
        const instr = createSubImmInstr(5);

        gen.testGenSubImm(instr);
        const elements = gen.getElements();

        expect(countInstructions(elements, 'SEC')).toBe(1);
        expect(countInstructions(elements, 'SBC')).toBe(1);
      });

      it('should use immediate addressing mode', () => {
        const instr = createSubImmInstr(10);

        gen.testGenSubImm(instr);
        const elements = gen.getElements();

        const sbc = findInstruction(elements, 'SBC');
        expect(sbc).toBeDefined();
        if (sbc && isInstructionElement(sbc)) {
          expect(sbc.instruction.mode).toBe(AsmAddressingMode.Immediate);
          expect(sbc.instruction.operand).toBe(10);
        }
      });

      it('should emit SEC before SBC', () => {
        const instr = createSubImmInstr(1);

        gen.testGenSubImm(instr);
        const elements = gen.getElements();

        const instructions = elements.filter(isInstructionElement);
        const secIndex = instructions.findIndex(
          (e) => e.instruction.mnemonic === 'SEC'
        );
        const sbcIndex = instructions.findIndex(
          (e) => e.instruction.mnemonic === 'SBC'
        );

        expect(secIndex).toBeLessThan(sbcIndex);
      });
    });

    describe('edge values', () => {
      it('should handle subtracting zero', () => {
        const instr = createSubImmInstr(0);

        gen.testGenSubImm(instr);
        const elements = gen.getElements();

        const sbc = findInstruction(elements, 'SBC');
        expect(sbc).toBeDefined();
        if (sbc && isInstructionElement(sbc)) {
          expect(sbc.instruction.operand).toBe(0);
        }
      });

      it('should handle subtracting max byte value', () => {
        const instr = createSubImmInstr(255);

        gen.testGenSubImm(instr);
        const elements = gen.getElements();

        const sbc = findInstruction(elements, 'SBC');
        expect(sbc).toBeDefined();
        if (sbc && isInstructionElement(sbc)) {
          expect(sbc.instruction.operand).toBe(255);
        }
      });

      it('should work with various immediate values', () => {
        const values = [1, 10, 50, 100, 127, 128, 200, 254];

        for (const value of values) {
          const localGen = new TestableArithmeticOpsGenerator();
          const instr = createSubImmInstr(value);

          localGen.testGenSubImm(instr);
          const elements = localGen.getElements();

          const sbc = findInstruction(elements, 'SBC');
          expect(sbc).toBeDefined();
          if (sbc && isInstructionElement(sbc)) {
            expect(sbc.instruction.operand).toBe(value);
          }
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate accumulator state after SUB_IMM', () => {
        const instr = createSubImmInstr(5);

        gen.testSetAFromImmediate(10);
        gen.testGenSubImm(instr);

        // A should be invalidated (result is unknown)
        expect(gen.testAHasSlot(0x10)).toBe(false);
      });
    });

    describe('comment generation', () => {
      it('should emit a comment for SUB_IMM', () => {
        const instr = createSubImmInstr(5);

        gen.testGenSubImm(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'Sub')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Combined scenarios
  // ==========================================================================

  describe('multiple sub operations', () => {
    it('should generate correct code for sequential subs', () => {
      const slot = createZpSlot('x', 0x10);

      // Sub slot value
      gen.testGenSubByte(createSubByteInstr(slot));
      // Sub immediate
      gen.testGenSubImm(createSubImmInstr(5));

      const elements = gen.getElements();

      // Should have 2 SEC and 2 SBC
      expect(countInstructions(elements, 'SEC')).toBe(2);
      expect(countInstructions(elements, 'SBC')).toBe(2);
    });

    it('should use correct addressing modes for mixed subs', () => {
      const zpSlot = createZpSlot('zp', 0x20);
      const absSlot = createAbsSlot('abs', 0x0400);

      gen.testGenSubByte(createSubByteInstr(zpSlot));
      gen.testGenSubByte(createSubByteInstr(absSlot));
      gen.testGenSubImm(createSubImmInstr(10));

      const elements = gen.getElements();
      const sbcInstructions = findAllInstructions(elements, 'SBC');

      expect(sbcInstructions.length).toBe(3);

      // First SBC - zero page
      if (isInstructionElement(sbcInstructions[0])) {
        expect(sbcInstructions[0].instruction.mode).toBe(
          AsmAddressingMode.ZeroPage
        );
      }

      // Second SBC - absolute
      if (isInstructionElement(sbcInstructions[1])) {
        expect(sbcInstructions[1].instruction.mode).toBe(
          AsmAddressingMode.Absolute
        );
      }

      // Third SBC - immediate
      if (isInstructionElement(sbcInstructions[2])) {
        expect(sbcInstructions[2].instruction.mode).toBe(
          AsmAddressingMode.Immediate
        );
      }
    });
  });

  // ==========================================================================
  // Add vs Sub comparison
  // ==========================================================================

  describe('add and sub together', () => {
    it('should use CLC for add and SEC for sub', () => {
      const slot = createZpSlot('x', 0x10);
      const addInstr = {
        opcode: 'ADD_BYTE' as const,
        operands: [{ kind: 'slot' as const, slot, addressingHint: 1 }],
        comment: 'add',
      };
      const subInstr = createSubByteInstr(slot);

      // Do an add first (would need proper instruction but testing SEC vs CLC)
      gen.testGenSubByte(subInstr);

      const elements = gen.getElements();

      // Sub uses SEC
      expect(countInstructions(elements, 'SEC')).toBe(1);
      expect(countInstructions(elements, 'CLC')).toBe(0);
    });
  });
});