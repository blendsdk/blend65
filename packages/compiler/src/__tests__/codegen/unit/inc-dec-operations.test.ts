/**
 * INC and DEC Operations Unit Tests
 *
 * Tests for INC_BYTE and DEC_BYTE code generation.
 *
 * INC_BYTE: Increments a memory location by 1
 * DEC_BYTE: Decrements a memory location by 1
 *
 * These operations use the 6502's native INC and DEC instructions
 * which operate directly on memory:
 * - INC addr (increment memory)
 * - DEC addr (decrement memory)
 *
 * @module __tests__/codegen/unit/inc-dec-operations.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableArithmeticOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createIncByteInstr,
  createDecByteInstr,
  findInstruction,
  findAllInstructions,
  countInstructions,
  hasCommentContaining,
} from './_arithmetic-helpers.js';
import {
  AsmAddressingMode,
  isInstructionElement,
} from '../../../codegen/asm-il/types.js';

describe('INC/DEC Operations Code Generation', () => {
  let gen: TestableArithmeticOpsGenerator;

  beforeEach(() => {
    gen = new TestableArithmeticOpsGenerator();
  });

  // ==========================================================================
  // INC_BYTE - Increment memory location
  // ==========================================================================

  describe('INC_BYTE', () => {
    describe('basic instruction generation', () => {
      it('should generate INC instruction for zero page slot', () => {
        const slot = createZpSlot('counter', 0x10);
        const instr = createIncByteInstr(slot);

        gen.testGenIncByte(instr);
        const elements = gen.getElements();

        expect(countInstructions(elements, 'INC')).toBe(1);
      });

      it('should generate INC instruction for absolute slot', () => {
        const slot = createAbsSlot('counter', 0x0400);
        const instr = createIncByteInstr(slot);

        gen.testGenIncByte(instr);
        const elements = gen.getElements();

        expect(countInstructions(elements, 'INC')).toBe(1);
      });

      it('should not generate unnecessary LDA or STA', () => {
        const slot = createZpSlot('counter', 0x10);
        const instr = createIncByteInstr(slot);

        gen.testGenIncByte(instr);
        const elements = gen.getElements();

        // INC operates directly on memory, no LDA/STA needed
        expect(countInstructions(elements, 'LDA')).toBe(0);
        expect(countInstructions(elements, 'STA')).toBe(0);
      });
    });

    describe('zero page addressing', () => {
      it('should use zero page addressing mode for ZP slot', () => {
        const slot = createZpSlot('x', 0x20);
        const instr = createIncByteInstr(slot);

        gen.testGenIncByte(instr);
        const elements = gen.getElements();

        const inc = findInstruction(elements, 'INC');
        expect(inc).toBeDefined();
        if (inc && isInstructionElement(inc)) {
          expect(inc.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
          expect(inc.instruction.operand).toBe(0x20);
        }
      });

      it('should work with different ZP addresses', () => {
        const addresses = [0x00, 0x10, 0x50, 0x80, 0xfe, 0xff];

        for (const addr of addresses) {
          const localGen = new TestableArithmeticOpsGenerator();
          const slot = createZpSlot('v', addr);
          const instr = createIncByteInstr(slot);

          localGen.testGenIncByte(instr);
          const elements = localGen.getElements();

          const inc = findInstruction(elements, 'INC');
          expect(inc).toBeDefined();
          if (inc && isInstructionElement(inc)) {
            expect(inc.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
            expect(inc.instruction.operand).toBe(addr);
          }
        }
      });
    });

    describe('absolute addressing', () => {
      it('should use absolute addressing mode for absolute slot', () => {
        const slot = createAbsSlot('buffer', 0x0800);
        const instr = createIncByteInstr(slot);

        gen.testGenIncByte(instr);
        const elements = gen.getElements();

        const inc = findInstruction(elements, 'INC');
        expect(inc).toBeDefined();
        if (inc && isInstructionElement(inc)) {
          expect(inc.instruction.mode).toBe(AsmAddressingMode.Absolute);
          expect(inc.instruction.operand).toBe(0x0800);
        }
      });

      it('should work with different absolute addresses', () => {
        const addresses = [0x0200, 0x0400, 0x0800, 0x1000, 0xc000];

        for (const addr of addresses) {
          const localGen = new TestableArithmeticOpsGenerator();
          const slot = createAbsSlot('v', addr);
          const instr = createIncByteInstr(slot);

          localGen.testGenIncByte(instr);
          const elements = localGen.getElements();

          const inc = findInstruction(elements, 'INC');
          expect(inc).toBeDefined();
          if (inc && isInstructionElement(inc)) {
            expect(inc.instruction.mode).toBe(AsmAddressingMode.Absolute);
            expect(inc.instruction.operand).toBe(addr);
          }
        }
      });
    });

    describe('accumulator state', () => {
      it('should not affect accumulator state', () => {
        const slot = createZpSlot('counter', 0x10);
        const otherSlot = createZpSlot('other', 0x20);
        const instr = createIncByteInstr(slot);

        // Set A to a known value from another slot
        gen.testSetAFromSlot(0x20);
        expect(gen.testAHasSlot(0x20)).toBe(true);

        gen.testGenIncByte(instr);

        // A should still have the other slot value
        // INC operates on memory, not A
        expect(gen.testAHasSlot(0x20)).toBe(true);
      });
    });

    describe('comment generation', () => {
      it('should emit a comment for INC_BYTE', () => {
        const slot = createZpSlot('counter', 0x10);
        const instr = createIncByteInstr(slot);

        gen.testGenIncByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'Inc')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // DEC_BYTE - Decrement memory location
  // ==========================================================================

  describe('DEC_BYTE', () => {
    describe('basic instruction generation', () => {
      it('should generate DEC instruction for zero page slot', () => {
        const slot = createZpSlot('counter', 0x10);
        const instr = createDecByteInstr(slot);

        gen.testGenDecByte(instr);
        const elements = gen.getElements();

        expect(countInstructions(elements, 'DEC')).toBe(1);
      });

      it('should generate DEC instruction for absolute slot', () => {
        const slot = createAbsSlot('counter', 0x0400);
        const instr = createDecByteInstr(slot);

        gen.testGenDecByte(instr);
        const elements = gen.getElements();

        expect(countInstructions(elements, 'DEC')).toBe(1);
      });

      it('should not generate unnecessary LDA or STA', () => {
        const slot = createZpSlot('counter', 0x10);
        const instr = createDecByteInstr(slot);

        gen.testGenDecByte(instr);
        const elements = gen.getElements();

        // DEC operates directly on memory, no LDA/STA needed
        expect(countInstructions(elements, 'LDA')).toBe(0);
        expect(countInstructions(elements, 'STA')).toBe(0);
      });
    });

    describe('zero page addressing', () => {
      it('should use zero page addressing mode for ZP slot', () => {
        const slot = createZpSlot('x', 0x20);
        const instr = createDecByteInstr(slot);

        gen.testGenDecByte(instr);
        const elements = gen.getElements();

        const dec = findInstruction(elements, 'DEC');
        expect(dec).toBeDefined();
        if (dec && isInstructionElement(dec)) {
          expect(dec.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
          expect(dec.instruction.operand).toBe(0x20);
        }
      });

      it('should work with different ZP addresses', () => {
        const addresses = [0x00, 0x10, 0x50, 0x80, 0xfe, 0xff];

        for (const addr of addresses) {
          const localGen = new TestableArithmeticOpsGenerator();
          const slot = createZpSlot('v', addr);
          const instr = createDecByteInstr(slot);

          localGen.testGenDecByte(instr);
          const elements = localGen.getElements();

          const dec = findInstruction(elements, 'DEC');
          expect(dec).toBeDefined();
          if (dec && isInstructionElement(dec)) {
            expect(dec.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
            expect(dec.instruction.operand).toBe(addr);
          }
        }
      });
    });

    describe('absolute addressing', () => {
      it('should use absolute addressing mode for absolute slot', () => {
        const slot = createAbsSlot('buffer', 0x0800);
        const instr = createDecByteInstr(slot);

        gen.testGenDecByte(instr);
        const elements = gen.getElements();

        const dec = findInstruction(elements, 'DEC');
        expect(dec).toBeDefined();
        if (dec && isInstructionElement(dec)) {
          expect(dec.instruction.mode).toBe(AsmAddressingMode.Absolute);
          expect(dec.instruction.operand).toBe(0x0800);
        }
      });

      it('should work with different absolute addresses', () => {
        const addresses = [0x0200, 0x0400, 0x0800, 0x1000, 0xc000];

        for (const addr of addresses) {
          const localGen = new TestableArithmeticOpsGenerator();
          const slot = createAbsSlot('v', addr);
          const instr = createDecByteInstr(slot);

          localGen.testGenDecByte(instr);
          const elements = localGen.getElements();

          const dec = findInstruction(elements, 'DEC');
          expect(dec).toBeDefined();
          if (dec && isInstructionElement(dec)) {
            expect(dec.instruction.mode).toBe(AsmAddressingMode.Absolute);
            expect(dec.instruction.operand).toBe(addr);
          }
        }
      });
    });

    describe('accumulator state', () => {
      it('should invalidate A if it held the decremented slot', () => {
        const slot = createZpSlot('counter', 0x10);
        const instr = createDecByteInstr(slot);

        // Set A to the slot being decremented
        gen.testSetAFromSlot(0x10);
        expect(gen.testAHasSlot(0x10)).toBe(true);

        gen.testGenDecByte(instr);

        // A should be invalidated (memory changed)
        expect(gen.testAHasSlot(0x10)).toBe(false);
      });

      it('should not affect A if it held a different slot', () => {
        const slot = createZpSlot('counter', 0x10);
        const instr = createDecByteInstr(slot);

        // Set A to a different slot
        gen.testSetAFromSlot(0x20);
        expect(gen.testAHasSlot(0x20)).toBe(true);

        gen.testGenDecByte(instr);

        // A should still have the other slot value
        expect(gen.testAHasSlot(0x20)).toBe(true);
      });
    });

    describe('comment generation', () => {
      it('should emit a comment for DEC_BYTE', () => {
        const slot = createZpSlot('counter', 0x10);
        const instr = createDecByteInstr(slot);

        gen.testGenDecByte(instr);
        const elements = gen.getElements();

        expect(hasCommentContaining(elements, 'Dec')).toBe(true);
      });
    });
  });

  // ==========================================================================
  // INC vs DEC comparison
  // ==========================================================================

  describe('INC vs DEC', () => {
    it('should generate INC for INC_BYTE', () => {
      const slot = createZpSlot('x', 0x10);
      gen.testGenIncByte(createIncByteInstr(slot));
      const elements = gen.getElements();

      expect(countInstructions(elements, 'INC')).toBe(1);
      expect(countInstructions(elements, 'DEC')).toBe(0);
    });

    it('should generate DEC for DEC_BYTE', () => {
      const slot = createZpSlot('x', 0x10);
      gen.testGenDecByte(createDecByteInstr(slot));
      const elements = gen.getElements();

      expect(countInstructions(elements, 'DEC')).toBe(1);
      expect(countInstructions(elements, 'INC')).toBe(0);
    });

    it('should use same addressing mode selection logic', () => {
      const zpSlot = createZpSlot('zp', 0x20);
      const absSlot = createAbsSlot('abs', 0x0400);

      // Test INC with both slot types
      const incGenZp = new TestableArithmeticOpsGenerator();
      incGenZp.testGenIncByte(createIncByteInstr(zpSlot));
      const incZpElements = incGenZp.getElements();

      const incGenAbs = new TestableArithmeticOpsGenerator();
      incGenAbs.testGenIncByte(createIncByteInstr(absSlot));
      const incAbsElements = incGenAbs.getElements();

      // Test DEC with both slot types
      const decGenZp = new TestableArithmeticOpsGenerator();
      decGenZp.testGenDecByte(createDecByteInstr(zpSlot));
      const decZpElements = decGenZp.getElements();

      const decGenAbs = new TestableArithmeticOpsGenerator();
      decGenAbs.testGenDecByte(createDecByteInstr(absSlot));
      const decAbsElements = decGenAbs.getElements();

      // ZP slots should use ZeroPage mode
      const incZp = findInstruction(incZpElements, 'INC');
      const decZp = findInstruction(decZpElements, 'DEC');
      if (incZp && isInstructionElement(incZp)) {
        expect(incZp.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
      if (decZp && isInstructionElement(decZp)) {
        expect(decZp.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }

      // Absolute slots should use Absolute mode
      const incAbs = findInstruction(incAbsElements, 'INC');
      const decAbs = findInstruction(decAbsElements, 'DEC');
      if (incAbs && isInstructionElement(incAbs)) {
        expect(incAbs.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
      if (decAbs && isInstructionElement(decAbs)) {
        expect(decAbs.instruction.mode).toBe(AsmAddressingMode.Absolute);
      }
    });
  });

  // ==========================================================================
  // Combined scenarios
  // ==========================================================================

  describe('multiple inc/dec operations', () => {
    it('should generate independent instructions for each operation', () => {
      const slot1 = createZpSlot('x', 0x10);
      const slot2 = createZpSlot('y', 0x20);

      gen.testGenIncByte(createIncByteInstr(slot1));
      gen.testGenDecByte(createDecByteInstr(slot2));

      const elements = gen.getElements();

      expect(countInstructions(elements, 'INC')).toBe(1);
      expect(countInstructions(elements, 'DEC')).toBe(1);
    });

    it('should target correct addresses for each operation', () => {
      const slot1 = createZpSlot('x', 0x10);
      const slot2 = createZpSlot('y', 0x20);

      gen.testGenIncByte(createIncByteInstr(slot1));
      gen.testGenDecByte(createDecByteInstr(slot2));

      const elements = gen.getElements();

      const inc = findInstruction(elements, 'INC');
      const dec = findInstruction(elements, 'DEC');

      expect(inc).toBeDefined();
      expect(dec).toBeDefined();

      if (inc && isInstructionElement(inc)) {
        expect(inc.instruction.operand).toBe(0x10);
      }
      if (dec && isInstructionElement(dec)) {
        expect(dec.instruction.operand).toBe(0x20);
      }
    });

    it('should handle incrementing same slot multiple times', () => {
      const slot = createZpSlot('counter', 0x10);

      gen.testGenIncByte(createIncByteInstr(slot));
      gen.testGenIncByte(createIncByteInstr(slot));
      gen.testGenIncByte(createIncByteInstr(slot));

      const elements = gen.getElements();

      expect(countInstructions(elements, 'INC')).toBe(3);
    });

    it('should handle decrementing same slot multiple times', () => {
      const slot = createZpSlot('counter', 0x10);

      gen.testGenDecByte(createDecByteInstr(slot));
      gen.testGenDecByte(createDecByteInstr(slot));
      gen.testGenDecByte(createDecByteInstr(slot));

      const elements = gen.getElements();

      expect(countInstructions(elements, 'DEC')).toBe(3);
    });
  });

  // ==========================================================================
  // Loop counter patterns
  // ==========================================================================

  describe('loop counter patterns', () => {
    it('should work for typical for-loop counter increment', () => {
      // Simulating: for (let i = 0; i < 10; i++)
      const counter = createZpSlot('i', 0x10);
      const instr = createIncByteInstr(counter);

      gen.testGenIncByte(instr);
      const elements = gen.getElements();

      // Should produce a simple INC instruction
      expect(countInstructions(elements, 'INC')).toBe(1);
      const inc = findInstruction(elements, 'INC');
      if (inc && isInstructionElement(inc)) {
        expect(inc.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });

    it('should work for typical while-loop counter decrement', () => {
      // Simulating: while (count > 0) { count--; }
      const counter = createZpSlot('count', 0x10);
      const instr = createDecByteInstr(counter);

      gen.testGenDecByte(instr);
      const elements = gen.getElements();

      // Should produce a simple DEC instruction
      expect(countInstructions(elements, 'DEC')).toBe(1);
      const dec = findInstruction(elements, 'DEC');
      if (dec && isInstructionElement(dec)) {
        expect(dec.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });
  });
});