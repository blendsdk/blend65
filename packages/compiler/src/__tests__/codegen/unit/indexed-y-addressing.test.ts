/**
 * Y-Indexed Addressing Tests
 *
 * Tests for LOAD_BYTE and STORE_BYTE with indexedByY flag.
 * Verifies that array accesses using the Y register emit
 * absoluteY addressing mode (LDA base,Y / STA base,Y).
 *
 * These tests verify the fix for the bug where genLoadByte()
 * and genStoreByte() ignored the indexedByY flag, causing
 * array reads/writes to load from the base address only.
 *
 * @module __tests__/codegen/unit/indexed-y-addressing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestableMemoryOpsGenerator,
  createZpSlot,
  createAbsSlot,
  createSlotOp,
  getInstructions,
  findInstruction,
  countInstructions,
} from './_test-helpers.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { ILOperand, SlotOperand } from '../../../il/operands.js';
import { FrameSlot, createFrameSlot } from '../../../frame/types.js';
import { SlotKind, SlotLocation } from '../../../frame/enums.js';
import { BUILTIN_TYPES } from '../../../semantic/types.js';
import {
  AsmAddressingMode,
  isInstructionElement,
} from '../../../codegen/asm-il/types.js';

// ============================================================================
// Helper: Create Y-indexed slot operand
// ============================================================================

/**
 * Creates a slot operand with indexedByY set to true.
 *
 * Simulates what the IL builder's loadIndexedY() and storeIndexedY()
 * produce: a LOAD_BYTE/STORE_BYTE with a slot operand marked for
 * Y-register indexed addressing.
 *
 * @param slot - Base array slot
 * @returns SlotOperand with indexedByY = true
 */
function createYIndexedSlotOp(slot: FrameSlot): SlotOperand {
  const baseOp = createSlotOp(slot);
  // Add the indexedByY flag as the builder does
  return { ...baseOp, indexedByY: true };
}

/**
 * Creates a LOAD_BYTE instruction with Y-indexed addressing.
 *
 * @param slot - Base array slot
 * @returns IL instruction with indexedByY operand
 */
function createYIndexedLoadInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.LOAD_BYTE,
    operands: [createYIndexedSlotOp(slot)] as ILOperand[],
    comment: `Load ${slot.name}[Y]`,
  };
}

/**
 * Creates a STORE_BYTE instruction with Y-indexed addressing.
 *
 * @param slot - Base array slot
 * @returns IL instruction with indexedByY operand
 */
function createYIndexedStoreInstr(slot: FrameSlot): ILInstruction {
  return {
    opcode: ILOpcode.STORE_BYTE,
    operands: [createYIndexedSlotOp(slot)] as ILOperand[],
    comment: `Store to ${slot.name}[Y]`,
  };
}

/**
 * Creates an array slot for testing.
 *
 * @param name - Slot name
 * @param address - Base address
 * @param location - ZP or FrameRegion
 * @param size - Array size in bytes
 * @returns FrameSlot configured as an array
 */
function createArraySlot(
  name: string,
  address: number,
  location: SlotLocation,
  size: number = 8,
): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE, {
    location,
    address,
    isArray: true,
    arrayLength: size,
  });
}

// ============================================================================
// Y-Indexed LOAD_BYTE Tests
// ============================================================================

describe('Y-Indexed LOAD_BYTE', () => {
  let generator: TestableMemoryOpsGenerator;

  beforeEach(() => {
    generator = new TestableMemoryOpsGenerator('test');
  });

  describe('absoluteY addressing mode', () => {
    it('generates LDA absoluteY for ZP base array', () => {
      // Even though base is in ZP, 6502 LDA does NOT support zeroPageY.
      // Must always use absoluteY for Y-indexed LDA.
      const slot = createArraySlot('buffer', 0x08, SlotLocation.ZeroPage);
      const instr = createYIndexedLoadInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
        expect(lda.instruction.operand).toBe(0x08);
      }
    });

    it('generates LDA absoluteY for absolute base array', () => {
      const slot = createArraySlot('data', 0x0400, SlotLocation.FrameRegion);
      const instr = createYIndexedLoadInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
        expect(lda.instruction.operand).toBe(0x0400);
      }
    });

    it('generates exactly one LDA for Y-indexed load', () => {
      const slot = createArraySlot('arr', 0x0200, SlotLocation.FrameRegion);
      const instr = createYIndexedLoadInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });
  });

  describe('accumulator state invalidation', () => {
    it('invalidates A after Y-indexed load', () => {
      // Y-indexed loads produce variable results, so A state must
      // be invalidated to prevent incorrect redundant load elimination.
      const slot = createArraySlot('arr', 0x08, SlotLocation.ZeroPage);
      const instr = createYIndexedLoadInstr(slot);

      generator.testGenLoadByte(instr);

      // A should be unknown now (not tracking any specific slot)
      expect(generator.testAHasSlot(0x08)).toBe(false);
      expect(generator.testAHasImmediate(0)).toBe(false);
    });

    it('does NOT skip Y-indexed load even if A was set to base address', () => {
      // Even if A was tracking the base slot address, a Y-indexed load
      // must still emit LDA because the actual address is base+Y.
      const slot = createArraySlot('arr', 0x08, SlotLocation.ZeroPage);

      // Pre-set A as if we loaded from base address
      generator.testSetAFromSlot(0x08);

      const instr = createYIndexedLoadInstr(slot);
      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      // Must still emit LDA because it's an indexed access
      expect(countInstructions(elements, 'LDA')).toBe(1);
    });

    it('requires reload after Y-indexed load', () => {
      const slot = createArraySlot('arr', 0x08, SlotLocation.ZeroPage);
      const plainSlot = createZpSlot('counter', 0x08);

      // Do Y-indexed load (invalidates A)
      generator.testGenLoadByte(createYIndexedLoadInstr(slot));
      // Then plain load of same base address (must re-emit LDA)
      generator.testGenLoadByte({
        opcode: ILOpcode.LOAD_BYTE,
        operands: [createSlotOp(plainSlot)] as ILOperand[],
        comment: 'Load counter',
      });

      const elements = generator.getElements();
      // Both loads must generate LDA instructions
      expect(countInstructions(elements, 'LDA')).toBe(2);
    });
  });

  describe('C64 typical array patterns', () => {
    it('handles sprite data array read (ZP base)', () => {
      // Typical: let spriteData: byte[64]; spriteData[i]
      const slot = createArraySlot('spriteData', 0x10, SlotLocation.ZeroPage, 64);
      const instr = createYIndexedLoadInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
        expect(lda.instruction.operand).toBe(0x10);
      }
    });

    it('handles screen memory array read', () => {
      // Typical: reading from screen buffer in frame region
      const slot = createArraySlot('screen', 0x0400, SlotLocation.FrameRegion, 40);
      const instr = createYIndexedLoadInstr(slot);

      generator.testGenLoadByte(instr);

      const elements = generator.getElements();
      const lda = findInstruction(elements, 'LDA');

      expect(lda).toBeDefined();
      if (lda && isInstructionElement(lda)) {
        expect(lda.instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
        expect(lda.instruction.operand).toBe(0x0400);
      }
    });
  });
});

// ============================================================================
// Y-Indexed STORE_BYTE Tests
// ============================================================================

describe('Y-Indexed STORE_BYTE', () => {
  let generator: TestableMemoryOpsGenerator;

  beforeEach(() => {
    generator = new TestableMemoryOpsGenerator('test');
  });

  describe('absoluteY addressing mode', () => {
    it('generates STA absoluteY for ZP base array', () => {
      // 6502 STA also does NOT support zeroPageY — must use absoluteY.
      const slot = createArraySlot('buffer', 0x08, SlotLocation.ZeroPage);
      const instr = createYIndexedStoreInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
        expect(sta.instruction.operand).toBe(0x08);
      }
    });

    it('generates STA absoluteY for absolute base array', () => {
      const slot = createArraySlot('data', 0x0400, SlotLocation.FrameRegion);
      const instr = createYIndexedStoreInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
        expect(sta.instruction.operand).toBe(0x0400);
      }
    });

    it('generates exactly one STA for Y-indexed store', () => {
      const slot = createArraySlot('arr', 0x0200, SlotLocation.FrameRegion);
      const instr = createYIndexedStoreInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      expect(countInstructions(elements, 'STA')).toBe(1);
    });
  });

  describe('accumulator state invalidation', () => {
    it('invalidates A after Y-indexed store', () => {
      // After STA base,Y, we can't track what slot A corresponds to
      // because the destination was dynamic.
      const slot = createArraySlot('arr', 0x08, SlotLocation.ZeroPage);

      // Pre-set A state
      generator.testSetAFromImmediate(42);

      const instr = createYIndexedStoreInstr(slot);
      generator.testGenStoreByte(instr);

      // A should be invalidated after Y-indexed store
      expect(generator.testAHasImmediate(42)).toBe(false);
    });
  });

  describe('C64 typical array patterns', () => {
    it('handles sprite data array write (ZP base)', () => {
      const slot = createArraySlot('spriteData', 0x10, SlotLocation.ZeroPage, 64);
      const instr = createYIndexedStoreInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
        expect(sta.instruction.operand).toBe(0x10);
      }
    });

    it('handles screen memory array write', () => {
      const slot = createArraySlot('screen', 0x0400, SlotLocation.FrameRegion, 40);
      const instr = createYIndexedStoreInstr(slot);

      generator.testGenStoreByte(instr);

      const elements = generator.getElements();
      const sta = findInstruction(elements, 'STA');

      expect(sta).toBeDefined();
      if (sta && isInstructionElement(sta)) {
        expect(sta.instruction.mode).toBe(AsmAddressingMode.AbsoluteY);
        expect(sta.instruction.operand).toBe(0x0400);
      }
    });
  });
});
