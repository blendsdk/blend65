/**
 * Tests for IL Type Guards
 *
 * @module __tests__/il/guards.test
 */

import { describe, it, expect } from 'vitest';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import { createFrameSlot } from '../../frame/types.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import { ILOpcode } from '../../il/enums.js';
import {
  createSlotOperand,
  createImmediateOperand,
  createLabelOperand,
  createFunctionOperand,
  createAddressOperand,
  createInstruction,
} from '../../il/factories.js';
import {
  isSlotOperand,
  isImmediateOperand,
  isLabelOperand,
  isFunctionOperand,
  isAddressOperand,
  isZeroPageInstruction,
  isLoadInstruction,
  isStoreInstruction,
  isArithmeticInstruction,
  isBitwiseInstruction,
  isComparisonInstruction,
  isControlFlowInstruction,
  isConditionalJumpInstruction,
  isFunctionInstruction,
  isRegisterTransferInstruction,
  isStackInstruction,
  isIntrinsicInstruction,
  isLabelInstruction,
  hasSideEffects,
} from '../../il/guards.js';

describe('Operand Type Guards', () => {
  describe('isSlotOperand', () => {
    it('should return true for slot operands', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      const op = createSlotOperand(slot);

      expect(isSlotOperand(op)).toBe(true);
    });

    it('should return false for non-slot operands', () => {
      const immOp = createImmediateOperand(42);
      const labelOp = createLabelOperand('test');

      expect(isSlotOperand(immOp)).toBe(false);
      expect(isSlotOperand(labelOp)).toBe(false);
    });
  });

  describe('isImmediateOperand', () => {
    it('should return true for immediate operands', () => {
      const op = createImmediateOperand(42);

      expect(isImmediateOperand(op)).toBe(true);
    });

    it('should return false for non-immediate operands', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      const slotOp = createSlotOperand(slot);

      expect(isImmediateOperand(slotOp)).toBe(false);
    });
  });

  describe('isLabelOperand', () => {
    it('should return true for label operands', () => {
      const op = createLabelOperand('loop_start');

      expect(isLabelOperand(op)).toBe(true);
    });

    it('should return false for non-label operands', () => {
      const immOp = createImmediateOperand(42);

      expect(isLabelOperand(immOp)).toBe(false);
    });
  });

  describe('isFunctionOperand', () => {
    it('should return true for function operands', () => {
      const op = createFunctionOperand('doSomething');

      expect(isFunctionOperand(op)).toBe(true);
    });

    it('should return false for non-function operands', () => {
      const labelOp = createLabelOperand('test');

      expect(isFunctionOperand(labelOp)).toBe(false);
    });
  });

  describe('isAddressOperand', () => {
    it('should return true for address operands', () => {
      const op = createAddressOperand(0xd020);

      expect(isAddressOperand(op)).toBe(true);
    });

    it('should return false for non-address operands', () => {
      const immOp = createImmediateOperand(42);

      expect(isAddressOperand(immOp)).toBe(false);
    });
  });
});

describe('Instruction Classification Guards', () => {
  describe('isZeroPageInstruction', () => {
    it('should return true for instructions with ZP slot operands', () => {
      const zpSlot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.ZeroPage,
        address: 0x02,
      });
      const slotOp = createSlotOperand(zpSlot);
      const instr = createInstruction(ILOpcode.LOAD_BYTE, [slotOp]);

      expect(isZeroPageInstruction(instr)).toBe(true);
    });

    it('should return true for instructions with ZP address operands', () => {
      const addrOp = createAddressOperand(0x02);
      const instr = createInstruction(ILOpcode.PEEK, [addrOp]);

      expect(isZeroPageInstruction(instr)).toBe(true);
    });

    it('should return false for non-ZP instructions', () => {
      const frameSlot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.FrameRegion,
        address: 0x0200,
      });
      const slotOp = createSlotOperand(frameSlot);
      const instr = createInstruction(ILOpcode.LOAD_BYTE, [slotOp]);

      expect(isZeroPageInstruction(instr)).toBe(false);
    });
  });

  describe('isLoadInstruction', () => {
    it('should return true for load instructions', () => {
      expect(isLoadInstruction(createInstruction(ILOpcode.LOAD_BYTE))).toBe(true);
      expect(isLoadInstruction(createInstruction(ILOpcode.LOAD_WORD))).toBe(true);
      expect(isLoadInstruction(createInstruction(ILOpcode.LOAD_IMM))).toBe(true);
      expect(isLoadInstruction(createInstruction(ILOpcode.PEEK))).toBe(true);
    });

    it('should return false for non-load instructions', () => {
      expect(isLoadInstruction(createInstruction(ILOpcode.STORE_BYTE))).toBe(false);
      expect(isLoadInstruction(createInstruction(ILOpcode.ADD_BYTE))).toBe(false);
    });
  });

  describe('isStoreInstruction', () => {
    it('should return true for store instructions', () => {
      expect(isStoreInstruction(createInstruction(ILOpcode.STORE_BYTE))).toBe(true);
      expect(isStoreInstruction(createInstruction(ILOpcode.STORE_WORD))).toBe(true);
      expect(isStoreInstruction(createInstruction(ILOpcode.POKE))).toBe(true);
    });

    it('should return false for non-store instructions', () => {
      expect(isStoreInstruction(createInstruction(ILOpcode.LOAD_BYTE))).toBe(false);
    });
  });

  describe('isArithmeticInstruction', () => {
    it('should return true for arithmetic instructions', () => {
      expect(isArithmeticInstruction(createInstruction(ILOpcode.ADD_BYTE))).toBe(true);
      expect(isArithmeticInstruction(createInstruction(ILOpcode.SUB_BYTE))).toBe(true);
      expect(isArithmeticInstruction(createInstruction(ILOpcode.MUL_BYTE))).toBe(true);
      expect(isArithmeticInstruction(createInstruction(ILOpcode.INC_BYTE))).toBe(true);
    });

    it('should return false for non-arithmetic instructions', () => {
      expect(isArithmeticInstruction(createInstruction(ILOpcode.AND_BYTE))).toBe(false);
    });
  });

  describe('isBitwiseInstruction', () => {
    it('should return true for bitwise instructions', () => {
      expect(isBitwiseInstruction(createInstruction(ILOpcode.AND_BYTE))).toBe(true);
      expect(isBitwiseInstruction(createInstruction(ILOpcode.OR_BYTE))).toBe(true);
      expect(isBitwiseInstruction(createInstruction(ILOpcode.XOR_BYTE))).toBe(true);
      expect(isBitwiseInstruction(createInstruction(ILOpcode.SHL_BYTE))).toBe(true);
    });

    it('should return false for non-bitwise instructions', () => {
      expect(isBitwiseInstruction(createInstruction(ILOpcode.ADD_BYTE))).toBe(false);
    });
  });

  describe('isComparisonInstruction', () => {
    it('should return true for comparison instructions', () => {
      expect(isComparisonInstruction(createInstruction(ILOpcode.CMP_BYTE))).toBe(true);
      expect(isComparisonInstruction(createInstruction(ILOpcode.CMP_IMM))).toBe(true);
    });

    it('should return false for non-comparison instructions', () => {
      expect(isComparisonInstruction(createInstruction(ILOpcode.JUMP_EQ))).toBe(false);
    });
  });

  describe('isControlFlowInstruction', () => {
    it('should return true for control flow instructions', () => {
      expect(isControlFlowInstruction(createInstruction(ILOpcode.LABEL))).toBe(true);
      expect(isControlFlowInstruction(createInstruction(ILOpcode.JUMP))).toBe(true);
      expect(isControlFlowInstruction(createInstruction(ILOpcode.JUMP_EQ))).toBe(true);
    });

    it('should return false for non-control flow instructions', () => {
      expect(isControlFlowInstruction(createInstruction(ILOpcode.CALL))).toBe(false);
    });
  });

  describe('isConditionalJumpInstruction', () => {
    it('should return true for conditional jump instructions', () => {
      expect(isConditionalJumpInstruction(createInstruction(ILOpcode.JUMP_EQ))).toBe(true);
      expect(isConditionalJumpInstruction(createInstruction(ILOpcode.JUMP_NE))).toBe(true);
      expect(isConditionalJumpInstruction(createInstruction(ILOpcode.JUMP_LT))).toBe(true);
    });

    it('should return false for unconditional jump', () => {
      expect(isConditionalJumpInstruction(createInstruction(ILOpcode.JUMP))).toBe(false);
    });
  });

  describe('isFunctionInstruction', () => {
    it('should return true for function instructions', () => {
      expect(isFunctionInstruction(createInstruction(ILOpcode.CALL))).toBe(true);
      expect(isFunctionInstruction(createInstruction(ILOpcode.RETURN))).toBe(true);
    });

    it('should return false for non-function instructions', () => {
      expect(isFunctionInstruction(createInstruction(ILOpcode.JUMP))).toBe(false);
    });
  });

  describe('isRegisterTransferInstruction', () => {
    it('should return true for register transfer instructions', () => {
      expect(isRegisterTransferInstruction(createInstruction(ILOpcode.TRANSFER_AX))).toBe(true);
      expect(isRegisterTransferInstruction(createInstruction(ILOpcode.TRANSFER_XA))).toBe(true);
    });

    it('should return false for non-transfer instructions', () => {
      expect(isRegisterTransferInstruction(createInstruction(ILOpcode.LOAD_BYTE))).toBe(false);
    });
  });

  describe('isStackInstruction', () => {
    it('should return true for stack instructions', () => {
      expect(isStackInstruction(createInstruction(ILOpcode.PUSH_A))).toBe(true);
      expect(isStackInstruction(createInstruction(ILOpcode.POP_A))).toBe(true);
    });

    it('should return false for non-stack instructions', () => {
      expect(isStackInstruction(createInstruction(ILOpcode.LOAD_BYTE))).toBe(false);
    });
  });

  describe('isIntrinsicInstruction', () => {
    it('should return true for intrinsic instructions', () => {
      expect(isIntrinsicInstruction(createInstruction(ILOpcode.PEEK))).toBe(true);
      expect(isIntrinsicInstruction(createInstruction(ILOpcode.POKE))).toBe(true);
      expect(isIntrinsicInstruction(createInstruction(ILOpcode.HI))).toBe(true);
      expect(isIntrinsicInstruction(createInstruction(ILOpcode.LO))).toBe(true);
    });

    it('should return false for non-intrinsic instructions', () => {
      expect(isIntrinsicInstruction(createInstruction(ILOpcode.LOAD_BYTE))).toBe(false);
    });
  });

  describe('isLabelInstruction', () => {
    it('should return true for label instructions', () => {
      expect(isLabelInstruction(createInstruction(ILOpcode.LABEL))).toBe(true);
    });

    it('should return false for non-label instructions', () => {
      expect(isLabelInstruction(createInstruction(ILOpcode.JUMP))).toBe(false);
    });
  });

  describe('hasSideEffects', () => {
    it('should return true for store instructions', () => {
      expect(hasSideEffects(createInstruction(ILOpcode.STORE_BYTE))).toBe(true);
      expect(hasSideEffects(createInstruction(ILOpcode.POKE))).toBe(true);
    });

    it('should return true for call instruction', () => {
      expect(hasSideEffects(createInstruction(ILOpcode.CALL))).toBe(true);
    });

    it('should return true for stack instructions', () => {
      expect(hasSideEffects(createInstruction(ILOpcode.PUSH_A))).toBe(true);
    });

    it('should return false for pure instructions', () => {
      expect(hasSideEffects(createInstruction(ILOpcode.LOAD_BYTE))).toBe(false);
      expect(hasSideEffects(createInstruction(ILOpcode.ADD_BYTE))).toBe(false);
      expect(hasSideEffects(createInstruction(ILOpcode.CMP_IMM))).toBe(false);
    });
  });
});