/**
 * STORE_WORD Tests - CGT3.4
 *
 * Tests for STORE_WORD code generation.
 * Verifies correct STA/STX instruction generation for 16-bit values.
 *
 * @module __tests__/codegen/unit/store-word
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableMemoryOpsGenerator,
  createZpWordSlot,
  createAbsWordSlot,
  createStoreWordInstr,
  findInstruction,
  countInstructions,
} from './_test-helpers.js';
import { AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';

// ============================================================================
// STORE_WORD Tests
// ============================================================================

describe('STORE_WORD', () => {
  let generator: TestableMemoryOpsGenerator;

  beforeEach(() => {
    generator = new TestableMemoryOpsGenerator('test');
  });

  describe('basic code generation', () => {
    it('generates STA and STX for zero page word', () => {
      const slot = createZpWordSlot('pointer', 0x50);
      const instr = createStoreWordInstr(slot);

      generator.testGenStoreWord(instr);

      const elements = generator.getElements();

      // Should have STA for low byte
      expect(countInstructions(elements, 'STA')).toBe(1);
      // Should have STX for high byte
      expect(countInstructions(elements, 'STX')).toBe(1);
    });

    it('generates STA and STX for absolute word', () => {
      const slot = createAbsWordSlot('data', 0x0200);
      const instr = createStoreWordInstr(slot);

      generator.testGenStoreWord(instr);

      const elements = generator.getElements();

      expect(countInstructions(elements, 'STA')).toBe(1);
      expect(countInstructions(elements, 'STX')).toBe(1);
    });
  });

  describe('zero page word addresses', () => {
    it('uses ZP mode for both low and high byte', () => {
      const slot = createZpWordSlot('ptr', 0x50);
      const instr = createStoreWordInstr(slot);

      generator.testGenStoreWord(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      expect(sta).toBeDefined();
      expect(stx).toBeDefined();

      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(sta.instruction.operand).toBe(0x50); // Low byte
      }

      if (stx && isInstructionElement(stx)) {
        expect(stx.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(stx.instruction.operand).toBe(0x51); // High byte (addr+1)
      }
    });

    it('stores to adjacent addresses', () => {
      const slot = createZpWordSlot('vector', 0x20);
      const instr = createStoreWordInstr(slot);

      generator.testGenStoreWord(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.operand).toBe(0x20);
      }
      if (stx && isInstructionElement(stx)) {
        expect(stx.instruction.operand).toBe(0x21);
      }
    });

    it('handles ZP word at boundary ($FE-$FF)', () => {
      const slot = createZpWordSlot('boundary', 0xfe);
      const instr = createStoreWordInstr(slot);

      generator.testGenStoreWord(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.operand).toBe(0xfe);
      }
      if (stx && isInstructionElement(stx)) {
        expect(stx.instruction.operand).toBe(0xff);
      }
    });
  });

  describe('absolute word addresses', () => {
    it('uses absolute mode for both bytes', () => {
      const slot = createAbsWordSlot('data', 0x0200);
      const instr = createStoreWordInstr(slot);

      generator.testGenStoreWord(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      expect(sta).toBeDefined();
      expect(stx).toBeDefined();

      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(sta.instruction.operand).toBe(0x0200);
      }

      if (stx && isInstructionElement(stx)) {
        expect(stx.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(stx.instruction.operand).toBe(0x0201);
      }
    });

    it('stores to screen memory base ($0400)', () => {
      const slot = createAbsWordSlot('screenPtr', 0x0400);
      const instr = createStoreWordInstr(slot);

      generator.testGenStoreWord(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.operand).toBe(0x0400);
      }
      if (stx && isInstructionElement(stx)) {
        expect(stx.instruction.operand).toBe(0x0401);
      }
    });

    it('handles high memory address ($C000)', () => {
      const slot = createAbsWordSlot('rom', 0xc000);
      const instr = createStoreWordInstr(slot);

      generator.testGenStoreWord(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.operand).toBe(0xc000);
      }
      if (stx && isInstructionElement(stx)) {
        expect(stx.instruction.operand).toBe(0xc001);
      }
    });
  });

  describe('accumulator state tracking', () => {
    it('invalidates A state after word store', () => {
      const slot = createZpWordSlot('ptr', 0x50);
      const instr = createStoreWordInstr(slot);

      // Pre-set A to have some value
      generator.testSetAFromImmediate(42);
      expect(generator.testAHasImmediate(42)).toBe(true);

      generator.testGenStoreWord(instr);

      // Word operations are complex, A state is invalidated
      expect(generator.testAHasImmediate(42)).toBe(false);
    });
  });

  describe('instruction ordering', () => {
    it('emits STA before STX', () => {
      const slot = createZpWordSlot('ptr', 0x50);
      const instr = createStoreWordInstr(slot);

      generator.testGenStoreWord(instr);

      const elements = generator.getElements();
      const instructions = elements.filter(isInstructionElement);

      let staIndex = -1;
      let stxIndex = -1;

      instructions.forEach((el, index) => {
        if (isInstructionElement(el)) {
          if (el.instruction.mnemonic === 'STA') staIndex = index;
          if (el.instruction.mnemonic === 'STX') stxIndex = index;
        }
      });

      expect(staIndex).toBeGreaterThanOrEqual(0);
      expect(stxIndex).toBeGreaterThanOrEqual(0);
      expect(staIndex).toBeLessThan(stxIndex);
    });
  });

  describe('multiple stores', () => {
    it('generates both stores for each operation', () => {
      const slot1 = createZpWordSlot('ptr1', 0x50);
      const slot2 = createZpWordSlot('ptr2', 0x52);

      generator.testGenStoreWord(createStoreWordInstr(slot1));
      generator.testGenStoreWord(createStoreWordInstr(slot2));

      const elements = generator.getElements();

      expect(countInstructions(elements, 'STA')).toBe(2);
      expect(countInstructions(elements, 'STX')).toBe(2);
    });

    it('stores to same slot multiple times', () => {
      const slot = createZpWordSlot('ptr', 0x50);

      generator.testGenStoreWord(createStoreWordInstr(slot));
      generator.testGenStoreWord(createStoreWordInstr(slot));

      const elements = generator.getElements();

      // Both stores should emit (no store elimination)
      expect(countInstructions(elements, 'STA')).toBe(2);
      expect(countInstructions(elements, 'STX')).toBe(2);
    });
  });

  describe('C64 hardware vectors', () => {
    it('stores to IRQ vector ($0314)', () => {
      const slot = createAbsWordSlot('irqVec', 0x0314);
      const instr = createStoreWordInstr(slot);

      generator.testGenStoreWord(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.operand).toBe(0x0314);
      }
      if (stx && isInstructionElement(stx)) {
        expect(stx.instruction.operand).toBe(0x0315);
      }
    });

    it('stores to NMI vector ($0318)', () => {
      const slot = createAbsWordSlot('nmiVec', 0x0318);
      const instr = createStoreWordInstr(slot);

      generator.testGenStoreWord(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');
      const stx = findInstruction(elements, 'STX');

      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.operand).toBe(0x0318);
      }
      if (stx && isInstructionElement(stx)) {
        expect(stx.instruction.operand).toBe(0x0319);
      }
    });
  });
});