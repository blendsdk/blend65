/**
 * STORE_BYTE Tests - CGT3.2
 *
 * Tests for STORE_BYTE code generation.
 * Verifies correct STA instruction generation with proper addressing modes.
 *
 * @module __tests__/codegen/unit/store-byte
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableMemoryOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createStoreByteInstr,
  findInstruction,
  countInstructions,
} from './_test-helpers.js';
import { AsmAddressingMode, isInstructionElement } from '../../../codegen/asm-il/types.js';

// ============================================================================
// STORE_BYTE Basic Tests
// ============================================================================

describe('STORE_BYTE', () => {
  let generator: TestableMemoryOpsGenerator;

  beforeEach(() => {
    generator = new TestableMemoryOpsGenerator('test');
  });

  describe('basic code generation', () => {
    it('generates STA for zero page slot', () => {
      const slot = createZpSlot('counter', 0x50);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(sta.instruction.operand).toBe(0x50);
      }
    });

    it('generates STA for absolute slot', () => {
      const slot = createAbsSlot('data', 0x0200);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(sta.instruction.operand).toBe(0x0200);
      }
    });

    it('generates exactly one STA instruction', () => {
      const slot = createZpSlot('x', 0x02);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'STA')).toBe(1);
    });
  });

  describe('zero page addresses', () => {
    it('uses ZP mode for address $00', () => {
      const slot = createZpSlot('first', 0x00);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(sta.instruction.operand).toBe(0x00);
      }
    });

    it('uses ZP mode for address $FF', () => {
      const slot = createZpSlot('last', 0xff);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
        expect(sta.instruction.operand).toBe(0xff);
      }
    });

    it('uses ZP mode for typical ZP address $50', () => {
      const slot = createZpSlot('mid', 0x50);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.ZeroPage);
      }
    });
  });

  describe('absolute addresses', () => {
    it('uses absolute mode for address $0100', () => {
      const slot = createAbsSlot('stack', 0x0100);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(sta.instruction.operand).toBe(0x0100);
      }
    });

    it('uses absolute mode for address $0200 (frame region)', () => {
      const slot = createAbsSlot('frame', 0x0200);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(sta.instruction.operand).toBe(0x0200);
      }
    });

    it('uses absolute mode for high address $C000', () => {
      const slot = createAbsSlot('basic', 0xc000);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(sta.instruction.operand).toBe(0xc000);
      }
    });

    it('handles max address $FFFF', () => {
      const slot = createAbsSlot('kernal', 0xffff);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(sta.instruction.operand).toBe(0xffff);
      }
    });
  });

  describe('accumulator state tracking', () => {
    it('updates A state after storing to slot', () => {
      const slot = createZpSlot('counter', 0x50);
      const instr = createStoreByteInstr(slot);

      // Store does not invalidate A (A still has same value)
      generator.testSetAFromImmediate(42);
      generator.testGenStoreByte(instr);

      // After store, A is associated with the stored address
      expect(generator.testAHasSlot(0x50)).toBe(true);
    });

    it('A tracks the slot after store', () => {
      const slot = createZpSlot('result', 0x60);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      // A now knows it has the value at address 0x60
      expect(generator.testAHasSlot(0x60)).toBe(true);
    });

    it('store always emits STA (no store elimination)', () => {
      const slot = createZpSlot('counter', 0x50);

      // Even if we know A has the value at this address,
      // we must still emit STA (stores cannot be eliminated)
      generator.testSetAFromSlot(0x50);
      generator.testGenStoreByte(createStoreByteInstr(slot));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'STA')).toBe(1);
    });
  });

  describe('multiple stores', () => {
    it('generates STA for each store operation', () => {
      const slot1 = createZpSlot('x', 0x50);
      const slot2 = createZpSlot('y', 0x51);

      generator.testGenStoreByte(createStoreByteInstr(slot1));
      generator.testGenStoreByte(createStoreByteInstr(slot2));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'STA')).toBe(2);
    });

    it('generates STA even for same slot stored twice', () => {
      const slot = createZpSlot('counter', 0x50);

      // Must store each time (memory could have changed externally)
      generator.testGenStoreByte(createStoreByteInstr(slot));
      generator.testGenStoreByte(createStoreByteInstr(slot));

      const elements = generator.getElements();
      expect(countInstructions(elements, 'STA')).toBe(2);
    });
  });

  describe('C64 common addresses', () => {
    it('stores to screen memory ($0400)', () => {
      const slot = createAbsSlot('screen', 0x0400);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.operand).toBe(0x0400);
      }
    });

    it('stores to color RAM ($D800)', () => {
      const slot = createAbsSlot('color', 0xd800);
      const instr = createStoreByteInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.Absolute);
        expect(sta.instruction.operand).toBe(0xd800);
      }
    });
  });
});