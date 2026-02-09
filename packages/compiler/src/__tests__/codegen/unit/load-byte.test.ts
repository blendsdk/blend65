/**
 * LOAD_BYTE Tests - CGT3.1
 *
 * Tests for LOAD_BYTE code generation.
 * Verifies correct LDA instruction generation with proper addressing modes.
 *
 * @module __tests__/codegen/unit/load-byte
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableMemoryOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createLoadByteInstr,
  getInstructions,
  findInstruction,
  countInstructions,
  hasCommentContaining,
} from './_test-helpers.js';
import { AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';

// ============================================================================
// LOAD_BYTE Basic Tests
// ============================================================================

describe('LOAD_BYTE', () => {
  let generator: TestableMemoryOpsGenerator;

  beforeEach(() => {
    generator = new TestableMemoryOpsGenerator('test');
  });

  describe('basic code generation', () => {
    it('generates LDA for zero page slot', () => {
      const slot = createZpSlot('counter', 0x50);
      const instr = createLoadByteInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(lda.instruction.operand).toBe(0x50);
      }
    });

    it('generates LDA for absolute slot', () => {
      const slot = createAbsSlot('data', 0x0200);
      const instr = createLoadByteInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(lda.instruction.operand).toBe(0x0200);
      }
    });

    it('generates exactly one LDA instruction', () => {
      const slot = createZpSlot('x', 0x02);
      const instr = createLoadByteInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });
  });

  describe('zero page addresses', () => {
    it('uses ZP mode for address $00', () => {
      const slot = createZpSlot('first', 0x00);
      const instr = createLoadByteInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(lda.instruction.operand).toBe(0x00);
      }
    });

    it('uses ZP mode for address $FF', () => {
      const slot = createZpSlot('last', 0xff);
      const instr = createLoadByteInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(lda.instruction.operand).toBe(0xff);
      }
    });

    it('uses ZP mode for typical ZP address $50', () => {
      const slot = createZpSlot('mid', 0x50);
      const instr = createLoadByteInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });
  });

  describe('absolute addresses', () => {
    it('uses absolute mode for address $0100', () => {
      const slot = createAbsSlot('stack', 0x0100);
      const instr = createLoadByteInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(lda.instruction.operand).toBe(0x0100);
      }
    });

    it('uses absolute mode for address $0200 (frame region)', () => {
      const slot = createAbsSlot('frame', 0x0200);
      const instr = createLoadByteInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(lda.instruction.operand).toBe(0x0200);
      }
    });

    it('uses absolute mode for high address $C000', () => {
      const slot = createAbsSlot('basic', 0xc000);
      const instr = createLoadByteInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(lda.instruction.operand).toBe(0xc000);
      }
    });

    it('handles max address $FFFF', () => {
      const slot = createAbsSlot('kernal', 0xffff);
      const instr = createLoadByteInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(lda.instruction.operand).toBe(0xffff);
      }
    });
  });

  describe('accumulator state tracking', () => {
    it('updates A state after loading from slot', () => {
      const slot = createZpSlot('counter', 0x50);
      const instr = createLoadByteInstr(slot);

      expect(generator.testAHasSlot(0x50)).toBe(false);

      generator.testGenLoadByte(instr);

      expect(generator.testAHasSlot(0x50)).toBe(true);
    });

    it('skips LDA when A already has the slot value', () => {
      const slot = createZpSlot('counter', 0x50);
      const instr = createLoadByteInstr(slot);

      // Pre-set A to have this slot value
      generator.testSetAFromSlot(0x50);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      // Should not emit LDA since A already has the value
      expect(countInstructions(elements, 'LDA')).toBe(0);
    });

    it('does not emit misleading comment when skipping redundant load', () => {
      // BUG-003 fix: removed "A already has" comments because they can be
      // misleading at branch convergence points. The optimization still works.
      const slot = createZpSlot('counter', 0x50);
      const instr = createLoadByteInstr(slot);

      // Pre-set A to have this slot value
      generator.testSetAFromSlot(0x50);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      expect(hasCommentContaining(elements, 'A already has')).toBe(false);
      // Verify the optimization still works (no LDA emitted)
      expect(countInstructions(elements, 'LDA')).toBe(0);
    });

    it('loads when A has different slot', () => {
      const slot1 = createZpSlot('counter', 0x50);
      const slot2 = createZpSlot('other', 0x60);
      const instr = createLoadByteInstr(slot1);

      // Pre-set A to have different slot value
      generator.testSetAFromSlot(0x60);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      // Should emit LDA since A has different value
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });

    it('loads after A is invalidated', () => {
      const slot = createZpSlot('counter', 0x50);
      const instr = createLoadByteInstr(slot);

      // Pre-set then invalidate
      generator.testSetAFromSlot(0x50);
      generator.testInvalidateA();

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      // Should emit LDA since A was invalidated
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });
  });

  describe('multiple loads', () => {
    it('optimizes sequential loads of same slot', () => {
      const slot = createZpSlot('counter', 0x50);

      // First load
      generator.testGenLoadByte(createLoadByteInstr(slot));
      // Second load of same slot (should be skipped)
      generator.testGenLoadByte(createLoadByteInstr(slot));

      const elements = generator.getElements();
      // Only first load should generate LDA
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });

    it('loads both when different slots', () => {
      const slot1 = createZpSlot('x', 0x50);
      const slot2 = createZpSlot('y', 0x51);

      generator.testGenLoadByte(createLoadByteInstr(slot1));
      generator.testGenLoadByte(createLoadByteInstr(slot2));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(2);
    });

    it('reloads after different slot loaded', () => {
      const slot1 = createZpSlot('x', 0x50);
      const slot2 = createZpSlot('y', 0x51);

      // Load x, then y, then x again
      generator.testGenLoadByte(createLoadByteInstr(slot1));
      generator.testGenLoadByte(createLoadByteInstr(slot2));
      generator.testGenLoadByte(createLoadByteInstr(slot1));

      const elements = generator.getElements();
      // All three should generate LDA (each invalidates previous)
      expect(countInstructions(elements, 'LDA')).toBe(3);
    });
  });

  describe('C64 common addresses', () => {
    it('loads from screen memory ($0400)', () => {
      const slot = createAbsSlot('screen', 0x0400);
      const instr = createLoadByteInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x0400);
      }
    });

    it('loads from BASIC start ($0801)', () => {
      const slot = createAbsSlot('basic', 0x0801);
      const instr = createLoadByteInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.operand).toBe(0x0801);
      }
    });
  });
});