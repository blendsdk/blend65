/**
 * Tests for IL Builder
 *
 * @module __tests__/il/builder.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SlotKind, SlotLocation } from '../../frame/enums.js';
import { createFrameSlot } from '../../frame/types.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import { ILOpcode } from '../../il/enums.js';
import { ILBuilder, computeInstructionCost, computeDefUse } from '../../il/builder/index.js';
import { createInstruction, createSlotOperand } from '../../il/factories.js';
import { isSlotOperand, isImmediateOperand, isLabelOperand } from '../../il/guards.js';

describe('ILBuilder', () => {
  let builder: ILBuilder;

  beforeEach(() => {
    builder = new ILBuilder();
  });

  describe('Label Management', () => {
    it('should generate unique label names', () => {
      const label1 = builder.newLabel();
      const label2 = builder.newLabel();
      const label3 = builder.newLabel('custom');

      expect(label1).toBe('L0');
      expect(label2).toBe('L1');
      expect(label3).toBe('custom2');
    });

    it('should emit label instruction', () => {
      builder.label('test_label');
      const instructions = builder.getInstructions();

      expect(instructions).toHaveLength(1);
      expect(instructions[0].opcode).toBe(ILOpcode.LABEL);
      expect(isLabelOperand(instructions[0].operands[0])).toBe(true);
    });
  });

  describe('Memory Operations', () => {
    it('should emit loadSlot instruction', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      builder.loadSlot(slot, 'load x');

      const instructions = builder.getInstructions();
      expect(instructions).toHaveLength(1);
      expect(instructions[0].opcode).toBe(ILOpcode.LOAD_BYTE);
      expect(instructions[0].comment).toBe('load x');
      expect(isSlotOperand(instructions[0].operands[0])).toBe(true);
    });

    it('should emit storeSlot instruction', () => {
      const slot = createFrameSlot('y', SlotKind.Local, BUILTIN_TYPES.BYTE);
      builder.storeSlot(slot);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.STORE_BYTE);
    });

    it('should emit loadImm instruction', () => {
      builder.loadImm(42);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.LOAD_IMM);
      expect(isImmediateOperand(instructions[0].operands[0])).toBe(true);
    });

    it('should emit word operations', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD);

      builder.loadSlotWord(slot);
      builder.storeSlotWord(slot);
      builder.loadImmWord(0x1000);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.LOAD_WORD);
      expect(instructions[1].opcode).toBe(ILOpcode.STORE_WORD);
      expect(instructions[2].opcode).toBe(ILOpcode.LOAD_IMM_WORD);
    });
  });

  describe('Arithmetic Operations', () => {
    it('should emit add/sub slot operations', () => {
      const slot = createFrameSlot('n', SlotKind.Local, BUILTIN_TYPES.BYTE);

      builder.addSlot(slot);
      builder.subSlot(slot);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.ADD_BYTE);
      expect(instructions[1].opcode).toBe(ILOpcode.SUB_BYTE);
    });

    it('should emit add/sub immediate operations', () => {
      builder.addImm(5);
      builder.subImm(3);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.ADD_IMM);
      expect(instructions[1].opcode).toBe(ILOpcode.SUB_IMM);
    });

    it('should emit inc/dec operations', () => {
      const slot = createFrameSlot('counter', SlotKind.Local, BUILTIN_TYPES.BYTE);

      builder.incSlot(slot);
      builder.decSlot(slot);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.INC_BYTE);
      expect(instructions[1].opcode).toBe(ILOpcode.DEC_BYTE);
    });

    it('should emit mul/div/mod operations', () => {
      const slot = createFrameSlot('n', SlotKind.Local, BUILTIN_TYPES.BYTE);

      builder.mulSlot(slot);
      builder.divSlot(slot);
      builder.modSlot(slot);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.MUL_BYTE);
      expect(instructions[1].opcode).toBe(ILOpcode.DIV_BYTE);
      expect(instructions[2].opcode).toBe(ILOpcode.MOD_BYTE);
    });
  });

  describe('Bitwise Operations', () => {
    it('should emit and/or/xor slot operations', () => {
      const slot = createFrameSlot('mask', SlotKind.Local, BUILTIN_TYPES.BYTE);

      builder.andSlot(slot);
      builder.orSlot(slot);
      builder.xorSlot(slot);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.AND_BYTE);
      expect(instructions[1].opcode).toBe(ILOpcode.OR_BYTE);
      expect(instructions[2].opcode).toBe(ILOpcode.XOR_BYTE);
    });

    it('should emit and/or/xor immediate operations', () => {
      builder.andImm(0x0f);
      builder.orImm(0x80);
      builder.xorImm(0xff);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.AND_IMM);
      expect(instructions[1].opcode).toBe(ILOpcode.OR_IMM);
      expect(instructions[2].opcode).toBe(ILOpcode.XOR_IMM);
    });

    it('should emit not/shl/shr operations', () => {
      builder.not();
      builder.shl(2);
      builder.shr(1);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.NOT_BYTE);
      expect(instructions[1].opcode).toBe(ILOpcode.SHL_BYTE);
      expect(instructions[2].opcode).toBe(ILOpcode.SHR_BYTE);
    });
  });

  describe('Comparison Operations', () => {
    it('should emit cmpSlot operation', () => {
      const slot = createFrameSlot('limit', SlotKind.Local, BUILTIN_TYPES.BYTE);
      builder.cmpSlot(slot);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.CMP_BYTE);
    });

    it('should emit cmpImm operation', () => {
      builder.cmpImm(10);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.CMP_IMM);
    });
  });

  describe('Control Flow', () => {
    it('should emit jump operation', () => {
      builder.jump('target');

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.JUMP);
    });

    it('should emit conditional jumps', () => {
      builder.jumpEq('eq');
      builder.jumpNe('ne');
      builder.jumpLt('lt');
      builder.jumpLe('le');
      builder.jumpGe('ge');
      builder.jumpGt('gt');

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.JUMP_EQ);
      expect(instructions[1].opcode).toBe(ILOpcode.JUMP_NE);
      expect(instructions[2].opcode).toBe(ILOpcode.JUMP_LT);
      expect(instructions[3].opcode).toBe(ILOpcode.JUMP_LE);
      expect(instructions[4].opcode).toBe(ILOpcode.JUMP_GE);
      expect(instructions[5].opcode).toBe(ILOpcode.JUMP_GT);
    });
  });

  describe('Function Operations', () => {
    it('should emit call operation', () => {
      builder.call('myFunc');

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.CALL);
    });

    it('should emit return operation', () => {
      builder.return_();

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.RETURN);
    });
  });

  describe('Register Transfers', () => {
    it('should emit transfer operations', () => {
      builder.transferAX();
      builder.transferAY();
      builder.transferXA();
      builder.transferYA();

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.TRANSFER_AX);
      expect(instructions[1].opcode).toBe(ILOpcode.TRANSFER_AY);
      expect(instructions[2].opcode).toBe(ILOpcode.TRANSFER_XA);
      expect(instructions[3].opcode).toBe(ILOpcode.TRANSFER_YA);
    });
  });

  describe('Stack Operations', () => {
    it('should emit push/pop operations', () => {
      builder.pushA();
      builder.popA();

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.PUSH_A);
      expect(instructions[1].opcode).toBe(ILOpcode.POP_A);
    });
  });

  describe('Intrinsics', () => {
    it('should emit peek/poke operations', () => {
      builder.peek(0xd020);
      builder.poke(0xd021);
      builder.peekw(0x0314);
      builder.pokew(0x0316);

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.PEEK);
      expect(instructions[1].opcode).toBe(ILOpcode.POKE);
      expect(instructions[2].opcode).toBe(ILOpcode.PEEKW);
      expect(instructions[3].opcode).toBe(ILOpcode.POKEW);
    });

    it('should emit hi/lo operations', () => {
      builder.hi();
      builder.lo();

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.HI);
      expect(instructions[1].opcode).toBe(ILOpcode.LO);
    });
  });

  describe('Utility Methods', () => {
    it('should clear instructions', () => {
      builder.loadImm(1);
      builder.loadImm(2);
      expect(builder.getInstructionCount()).toBe(2);

      builder.clear();
      expect(builder.getInstructionCount()).toBe(0);
    });

    it('should emit nop', () => {
      builder.nop();

      const instructions = builder.getInstructions();
      expect(instructions[0].opcode).toBe(ILOpcode.NOP);
    });
  });
});

describe('computeInstructionCost', () => {
  it('should return base cost for immediate operations', () => {
    const instr = createInstruction(ILOpcode.LOAD_IMM);
    const cost = computeInstructionCost(instr);

    expect(cost.cycles).toBe(2);
    expect(cost.bytes).toBe(2);
    expect(cost.memoryAccesses).toBe(0);
  });

  it('should reduce cost for ZP slot access', () => {
    const zpSlot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
      location: SlotLocation.ZeroPage,
      address: 0x02,
    });
    const slotOp = createSlotOperand(zpSlot);
    const instr = createInstruction(ILOpcode.LOAD_BYTE, [slotOp]);
    const cost = computeInstructionCost(instr);

    expect(cost.cycles).toBeLessThan(3); // Less than base cost
    expect(cost.bytes).toBeLessThan(2);
  });
});

describe('computeDefUse', () => {
  it('should identify uses in load operations', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
    const slotOp = createSlotOperand(slot);
    const instr = createInstruction(ILOpcode.LOAD_BYTE, [slotOp]);
    const defUse = computeDefUse(instr);

    expect(defUse.uses).toContain('x');
    expect(defUse.defs).not.toContain('x');
  });

  it('should identify defs in store operations', () => {
    const slot = createFrameSlot('y', SlotKind.Local, BUILTIN_TYPES.BYTE);
    const slotOp = createSlotOperand(slot);
    const instr = createInstruction(ILOpcode.STORE_BYTE, [slotOp]);
    const defUse = computeDefUse(instr);

    expect(defUse.defs).toContain('y');
    expect(defUse.uses).not.toContain('y');
  });

  it('should identify both def and use in inc/dec operations', () => {
    const slot = createFrameSlot('counter', SlotKind.Local, BUILTIN_TYPES.BYTE);
    const slotOp = createSlotOperand(slot);
    const instr = createInstruction(ILOpcode.INC_BYTE, [slotOp]);
    const defUse = computeDefUse(instr);

    expect(defUse.defs).toContain('counter');
    expect(defUse.uses).toContain('counter');
  });
});