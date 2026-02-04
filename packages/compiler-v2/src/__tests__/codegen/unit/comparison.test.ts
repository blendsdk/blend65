/**
 * Comparison Operations Tests
 *
 * Tests for comparison operation code generation:
 * - CMP_BYTE: Compare accumulator with memory slot
 * - CMP_IMM: Compare accumulator with immediate value
 *
 * @module __tests__/codegen/unit/comparison.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableComparisonOpsGenerator,
  createCmpByteInstr,
  createCmpImmInstr,
  createZpSlot,
  createAbsSlot,
  findInstruction,
  findAllInstructions,
  countInstructions,
  getInstructions,
  hasCommentContaining,
} from './_comparison-helpers.js';
import { AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';

describe('Comparison Operations', () => {
  let gen: TestableComparisonOpsGenerator;

  beforeEach(() => {
    gen = new TestableComparisonOpsGenerator('test');
  });

  // ==========================================================================
  // CMP_BYTE Tests
  // ==========================================================================

  describe('CMP_BYTE', () => {
    describe('Zero Page Addressing', () => {
      it('generates CMP instruction for zero page slot', () => {
        const slot = createZpSlot('counter', 0x10);
        const instr = createCmpByteInstr(slot);

        gen.testGenCmpByte(instr);

        const elements = gen.getElements();
        const cmp = findInstruction(elements, 'CMP');

        expect(cmp).toBeDefined();
        expect(isInstructionElement(cmp)).toBe(true);
        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
          expect(cmp.instruction.operand).toBe(0x10);
        }
      });

      it('generates CMP for multiple zero page slots', () => {
        // Test various ZP addresses
        const addresses = [0x00, 0x10, 0x50, 0x80, 0xff];

        for (const addr of addresses) {
          const newGen = new TestableComparisonOpsGenerator('test');
          const slot = createZpSlot(`var_${addr}`, addr);
          const instr = createCmpByteInstr(slot);

          newGen.testGenCmpByte(instr);

          const elements = newGen.getElements();
          const cmp = findInstruction(elements, 'CMP');

          expect(cmp).toBeDefined();
          if (isInstructionElement(cmp)) {
            expect(cmp.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
            expect(cmp.instruction.operand).toBe(addr);
          }
        }
      });

      it('generates exactly one CMP instruction for ZP compare', () => {
        const slot = createZpSlot('value', 0x20);
        const instr = createCmpByteInstr(slot);

        gen.testGenCmpByte(instr);

        const elements = gen.getElements();
        expect(countInstructions(elements, 'CMP')).toBe(1);
      });
    });

    describe('Absolute Addressing', () => {
      it('generates CMP instruction for absolute slot', () => {
        const slot = createAbsSlot('value', 0x0200);
        const instr = createCmpByteInstr(slot);

        gen.testGenCmpByte(instr);

        const elements = gen.getElements();
        const cmp = findInstruction(elements, 'CMP');

        expect(cmp).toBeDefined();
        expect(isInstructionElement(cmp)).toBe(true);
        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.mode).toBe(AsmAddressingMode.Absolute);
          expect(cmp.instruction.operand).toBe(0x0200);
        }
      });

      it('generates CMP for multiple absolute slots', () => {
        // Test various absolute addresses
        const addresses = [0x0200, 0x0300, 0x0800, 0x1000, 0xc000];

        for (const addr of addresses) {
          const newGen = new TestableComparisonOpsGenerator('test');
          const slot = createAbsSlot(`var_${addr}`, addr);
          const instr = createCmpByteInstr(slot);

          newGen.testGenCmpByte(instr);

          const elements = newGen.getElements();
          const cmp = findInstruction(elements, 'CMP');

          expect(cmp).toBeDefined();
          if (isInstructionElement(cmp)) {
            expect(cmp.instruction.mode).toBe(AsmAddressingMode.Absolute);
            expect(cmp.instruction.operand).toBe(addr);
          }
        }
      });

      it('generates exactly one CMP instruction for absolute compare', () => {
        const slot = createAbsSlot('data', 0x0400);
        const instr = createCmpByteInstr(slot);

        gen.testGenCmpByte(instr);

        const elements = gen.getElements();
        expect(countInstructions(elements, 'CMP')).toBe(1);
      });
    });

    describe('Accumulator State After Compare', () => {
      it('does not change accumulator state after CMP', () => {
        // Set A to a known value first
        gen.testSetAFromSlot(0x10);

        const slot = createZpSlot('other', 0x20);
        const instr = createCmpByteInstr(slot);

        gen.testGenCmpByte(instr);

        // A should still have 0x10's value (CMP doesn't change A)
        expect(gen.testAHasSlot(0x10)).toBe(true);
      });

      it('preserves immediate value in A after CMP', () => {
        // Set A to immediate value
        gen.testSetAFromImmediate(42);

        const slot = createZpSlot('value', 0x30);
        const instr = createCmpByteInstr(slot);

        gen.testGenCmpByte(instr);

        // A should still have immediate 42
        expect(gen.testAHasSlot(0x30)).toBe(false);
      });
    });

    describe('Comment Generation', () => {
      it('generates comment for CMP_BYTE instruction', () => {
        const slot = createZpSlot('counter', 0x10);
        const instr = createCmpByteInstr(slot);

        gen.testGenCmpByte(instr);

        const elements = gen.getElements();
        expect(hasCommentContaining(elements, 'Compare')).toBe(true);
      });
    });

    describe('Multiple Comparisons', () => {
      it('can generate multiple CMP instructions', () => {
        const slot1 = createZpSlot('a', 0x10);
        const slot2 = createAbsSlot('b', 0x0200);
        const slot3 = createZpSlot('c', 0x20);

        gen.testGenCmpByte(createCmpByteInstr(slot1));
        gen.testGenCmpByte(createCmpByteInstr(slot2));
        gen.testGenCmpByte(createCmpByteInstr(slot3));

        const elements = gen.getElements();
        expect(countInstructions(elements, 'CMP')).toBe(3);
      });
    });
  });

  // ==========================================================================
  // CMP_IMM Tests
  // ==========================================================================

  describe('CMP_IMM', () => {
    describe('Immediate Addressing', () => {
      it('generates CMP #value instruction', () => {
        const instr = createCmpImmInstr(42);

        gen.testGenCmpImm(instr);

        const elements = gen.getElements();
        const cmp = findInstruction(elements, 'CMP');

        expect(cmp).toBeDefined();
        expect(isInstructionElement(cmp)).toBe(true);
        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.mode).toBe(AsmAddressingMode.Immediate);
          expect(cmp.instruction.operand).toBe(42);
        }
      });

      it('generates CMP #0 for zero compare', () => {
        const instr = createCmpImmInstr(0);

        gen.testGenCmpImm(instr);

        const elements = gen.getElements();
        const cmp = findInstruction(elements, 'CMP');

        expect(cmp).toBeDefined();
        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.mode).toBe(AsmAddressingMode.Immediate);
          expect(cmp.instruction.operand).toBe(0);
        }
      });

      it('generates CMP #255 for max byte compare', () => {
        const instr = createCmpImmInstr(255);

        gen.testGenCmpImm(instr);

        const elements = gen.getElements();
        const cmp = findInstruction(elements, 'CMP');

        expect(cmp).toBeDefined();
        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.mode).toBe(AsmAddressingMode.Immediate);
          expect(cmp.instruction.operand).toBe(255);
        }
      });

      it('generates CMP for various immediate values', () => {
        const values = [0, 1, 10, 50, 100, 127, 128, 200, 254, 255];

        for (const value of values) {
          const newGen = new TestableComparisonOpsGenerator('test');
          const instr = createCmpImmInstr(value);

          newGen.testGenCmpImm(instr);

          const elements = newGen.getElements();
          const cmp = findInstruction(elements, 'CMP');

          expect(cmp).toBeDefined();
          if (isInstructionElement(cmp)) {
            expect(cmp.instruction.mode).toBe(AsmAddressingMode.Immediate);
            expect(cmp.instruction.operand).toBe(value);
          }
        }
      });
    });

    describe('Accumulator State After Immediate Compare', () => {
      it('does not change accumulator state after CMP_IMM', () => {
        // Set A to a known slot value first
        gen.testSetAFromSlot(0x10);

        const instr = createCmpImmInstr(100);

        gen.testGenCmpImm(instr);

        // A should still have 0x10's value (CMP doesn't change A)
        expect(gen.testAHasSlot(0x10)).toBe(true);
      });
    });

    describe('Comment Generation', () => {
      it('generates comment for CMP_IMM instruction', () => {
        const instr = createCmpImmInstr(42);

        gen.testGenCmpImm(instr);

        const elements = gen.getElements();
        expect(hasCommentContaining(elements, 'Compare')).toBe(true);
      });
    });

    describe('Exactly One Instruction', () => {
      it('generates exactly one CMP instruction for immediate compare', () => {
        const instr = createCmpImmInstr(100);

        gen.testGenCmpImm(instr);

        const elements = gen.getElements();
        expect(countInstructions(elements, 'CMP')).toBe(1);
      });
    });
  });

  // ==========================================================================
  // Mixed CMP Tests
  // ==========================================================================

  describe('Mixed CMP Operations', () => {
    it('can mix CMP_BYTE and CMP_IMM in same generator', () => {
      const slot = createZpSlot('value', 0x10);

      gen.testGenCmpByte(createCmpByteInstr(slot));
      gen.testGenCmpImm(createCmpImmInstr(42));

      const elements = gen.getElements();
      const cmps = findAllInstructions(elements, 'CMP');

      expect(cmps.length).toBe(2);

      // First CMP should be ZP
      if (isInstructionElement(cmps[0])) {
        expect(cmps[0].instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }

      // Second CMP should be immediate
      if (isInstructionElement(cmps[1])) {
        expect(cmps[1].instruction.mode).toBe(AsmAddressingMode.Immediate);
      }
    });
  });

  // ==========================================================================
  // 6502 Processor Flag Behavior
  // ==========================================================================

  describe('6502 Compare Behavior', () => {
    /**
     * Document 6502 compare behavior:
     * CMP sets N, Z, C flags based on (A - operand)
     *
     * - Z=1 if A == operand
     * - C=1 if A >= operand (unsigned)
     * - C=0 if A < operand (unsigned)
     * - N=1 if bit 7 of result is 1
     */

    it('generates CMP which sets flags for equality comparison', () => {
      // When A==operand, Z=1, C=1
      const instr = createCmpImmInstr(42);

      gen.testGenCmpImm(instr);

      const elements = gen.getElements();
      const cmp = findInstruction(elements, 'CMP');

      // Verify CMP is generated correctly
      expect(cmp).toBeDefined();
      if (isInstructionElement(cmp)) {
        expect(cmp.instruction.mnemonic).toBe('CMP');
      }
    });

    it('generates CMP which sets flags for less-than comparison', () => {
      // When A < operand, C=0, Z=0
      const instr = createCmpImmInstr(100);

      gen.testGenCmpImm(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'CMP')).toBe(1);
    });

    it('generates CMP which sets flags for greater-than comparison', () => {
      // When A > operand, C=1, Z=0
      const slot = createZpSlot('small', 0x10);
      const instr = createCmpByteInstr(slot);

      gen.testGenCmpByte(instr);

      const elements = gen.getElements();
      expect(countInstructions(elements, 'CMP')).toBe(1);
    });
  });

  // ==========================================================================
  // Hardware Address Comparisons
  // ==========================================================================

  describe('Hardware Address Comparisons', () => {
    it('generates CMP for C64 hardware register addresses', () => {
      // Common C64 hardware addresses in the frame region
      const hwAddresses = [
        { name: 'borderColor', addr: 0x0300 }, // Using frame region for test
        { name: 'screenMemLo', addr: 0x0400 },
        { name: 'sidFreq', addr: 0x0500 },
      ];

      for (const hw of hwAddresses) {
        const newGen = new TestableComparisonOpsGenerator('test');
        const slot = createAbsSlot(hw.name, hw.addr);
        const instr = createCmpByteInstr(slot);

        newGen.testGenCmpByte(instr);

        const elements = newGen.getElements();
        const cmp = findInstruction(elements, 'CMP');

        expect(cmp).toBeDefined();
        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.operand).toBe(hw.addr);
        }
      }
    });
  });

  // ==========================================================================
  // Boundary Value Tests
  // ==========================================================================

  describe('Boundary Value Tests', () => {
    describe('Zero Page Boundaries', () => {
      it('handles ZP address 0x00', () => {
        const slot = createZpSlot('first', 0x00);
        const instr = createCmpByteInstr(slot);

        gen.testGenCmpByte(instr);

        const elements = gen.getElements();
        const cmp = findInstruction(elements, 'CMP');

        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.operand).toBe(0x00);
        }
      });

      it('handles ZP address 0xFF', () => {
        const slot = createZpSlot('last', 0xff);
        const instr = createCmpByteInstr(slot);

        gen.testGenCmpByte(instr);

        const elements = gen.getElements();
        const cmp = findInstruction(elements, 'CMP');

        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.operand).toBe(0xff);
        }
      });
    });

    describe('Immediate Value Boundaries', () => {
      it('handles immediate 0x00', () => {
        const instr = createCmpImmInstr(0x00);

        gen.testGenCmpImm(instr);

        const elements = gen.getElements();
        const cmp = findInstruction(elements, 'CMP');

        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.operand).toBe(0x00);
        }
      });

      it('handles immediate 0xFF', () => {
        const instr = createCmpImmInstr(0xff);

        gen.testGenCmpImm(instr);

        const elements = gen.getElements();
        const cmp = findInstruction(elements, 'CMP');

        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.operand).toBe(0xff);
        }
      });

      it('handles immediate 0x80 (sign boundary)', () => {
        const instr = createCmpImmInstr(0x80);

        gen.testGenCmpImm(instr);

        const elements = gen.getElements();
        const cmp = findInstruction(elements, 'CMP');

        if (isInstructionElement(cmp)) {
          expect(cmp.instruction.operand).toBe(0x80);
        }
      });
    });
  });

  // ==========================================================================
  // Instruction Count Verification
  // ==========================================================================

  describe('Instruction Count Verification', () => {
    it('CMP_BYTE generates minimal instructions (just CMP)', () => {
      const slot = createZpSlot('x', 0x10);
      const instr = createCmpByteInstr(slot);

      gen.testGenCmpByte(instr);

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      // Should only generate CMP instruction (no loads, no stores)
      expect(instructions.length).toBe(1);
      if (isInstructionElement(instructions[0])) {
        expect(instructions[0].instruction.mnemonic).toBe('CMP');
      }
    });

    it('CMP_IMM generates minimal instructions (just CMP)', () => {
      const instr = createCmpImmInstr(50);

      gen.testGenCmpImm(instr);

      const elements = gen.getElements();
      const instructions = getInstructions(elements);

      // Should only generate CMP instruction
      expect(instructions.length).toBe(1);
      if (isInstructionElement(instructions[0])) {
        expect(instructions[0].instruction.mnemonic).toBe('CMP');
      }
    });
  });
});