/**
 * Tests for IL Factory Functions
 *
 * @module __tests__/il/factories.test
 */

import { describe, it, expect } from 'vitest';
import { SlotKind, SlotLocation, ZpDirective } from '../../frame/enums.js';
import { createFrame } from '../../frame/allocator/frame-calculator.js';
import { createFrameSlot } from '../../frame/types.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import { AddressingModeHint, ILOpcode } from '../../il/enums.js';
import {
  createSlotOperand,
  createImmediateOperand,
  createLabelOperand,
  createFunctionOperand,
  createAddressOperand,
  createInstruction,
  createInstructionCost,
  createDefUse,
  createOptimizationHints,
  createILLoop,
  createILFunction,
  createILProgram,
} from '../../il/factories.js';

describe('Operand Factory Functions', () => {
  describe('createSlotOperand', () => {
    it('should create a slot operand with ZP hint for ZP slots', () => {
      const slot = createFrameSlot('counter', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.ZeroPage,
        address: 0x02,
      });

      const op = createSlotOperand(slot);

      expect(op.kind).toBe('slot');
      expect(op.slot).toBe(slot);
      expect(op.addressingHint).toBe(AddressingModeHint.ZeroPage);
    });

    it('should create a slot operand with Absolute hint for frame region slots', () => {
      const slot = createFrameSlot('value', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.FrameRegion,
        address: 0x0200,
      });

      const op = createSlotOperand(slot);

      expect(op.kind).toBe('slot');
      expect(op.addressingHint).toBe(AddressingModeHint.Absolute);
    });

    it('should allow overriding addressing hint', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        location: SlotLocation.ZeroPage,
        address: 0x02,
      });

      const op = createSlotOperand(slot, AddressingModeHint.IndirectY);

      expect(op.addressingHint).toBe(AddressingModeHint.IndirectY);
    });

    it('should support array index offset', () => {
      const slot = createFrameSlot('buffer', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.FrameRegion,
        address: 0x0200,
      });

      const op = createSlotOperand(slot, undefined, 5);

      expect(op.indexOffset).toBe(5);
    });

    it('should support dynamic index slot', () => {
      const arraySlot = createFrameSlot('buffer', SlotKind.Local, BUILTIN_TYPES.BYTE);
      const indexSlot = createFrameSlot('i', SlotKind.Local, BUILTIN_TYPES.BYTE);

      const op = createSlotOperand(arraySlot, undefined, undefined, indexSlot);

      expect(op.indexSlot).toBe(indexSlot);
    });
  });

  describe('createImmediateOperand', () => {
    it('should create a byte immediate operand', () => {
      const op = createImmediateOperand(42);

      expect(op.kind).toBe('immediate');
      expect(op.value).toBe(42);
      expect(op.isWord).toBe(false);
    });

    it('should create a word immediate operand', () => {
      const op = createImmediateOperand(0x1000, true);

      expect(op.kind).toBe('immediate');
      expect(op.value).toBe(0x1000);
      expect(op.isWord).toBe(true);
    });
  });

  describe('createLabelOperand', () => {
    it('should create a label operand', () => {
      const op = createLabelOperand('loop_start');

      expect(op.kind).toBe('label');
      expect(op.name).toBe('loop_start');
    });
  });

  describe('createFunctionOperand', () => {
    it('should create a function operand with defaults', () => {
      const op = createFunctionOperand('updateGame');

      expect(op.kind).toBe('function');
      expect(op.name).toBe('updateGame');
      expect(op.isCallback).toBe(false);
      expect(op.coalesceGroup).toBe(-1);
    });

    it('should create a callback function operand', () => {
      const op = createFunctionOperand('handleIrq', true, 2);

      expect(op.isCallback).toBe(true);
      expect(op.coalesceGroup).toBe(2);
    });
  });

  describe('createAddressOperand', () => {
    it('should auto-detect zero page for low addresses', () => {
      const op = createAddressOperand(0x02);

      expect(op.kind).toBe('address');
      expect(op.address).toBe(0x02);
      expect(op.isZeroPage).toBe(true);
    });

    it('should auto-detect non-zero page for high addresses', () => {
      const op = createAddressOperand(0xd020);

      expect(op.address).toBe(0xd020);
      expect(op.isZeroPage).toBe(false);
    });

    it('should allow overriding ZP detection', () => {
      const op = createAddressOperand(0xff, false);

      expect(op.address).toBe(0xff);
      expect(op.isZeroPage).toBe(false);
    });
  });
});

describe('Instruction Factory Functions', () => {
  describe('createInstruction', () => {
    it('should create a simple instruction', () => {
      const instr = createInstruction(ILOpcode.RETURN);

      expect(instr.opcode).toBe(ILOpcode.RETURN);
      expect(instr.operands).toEqual([]);
    });

    it('should create an instruction with operands', () => {
      const slotOp = createSlotOperand(
        createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE)
      );
      const instr = createInstruction(ILOpcode.LOAD_BYTE, [slotOp]);

      expect(instr.opcode).toBe(ILOpcode.LOAD_BYTE);
      expect(instr.operands).toHaveLength(1);
      expect(instr.operands[0]).toBe(slotOp);
    });

    it('should create an instruction with options', () => {
      const instr = createInstruction(ILOpcode.NOP, [], {
        comment: 'Delay for timing',
      });

      expect(instr.comment).toBe('Delay for timing');
    });
  });

  describe('createInstructionCost', () => {
    it('should create an instruction cost', () => {
      const cost = createInstructionCost(3, 2, 1);

      expect(cost.cycles).toBe(3);
      expect(cost.bytes).toBe(2);
      expect(cost.memoryAccesses).toBe(1);
    });
  });

  describe('createDefUse', () => {
    it('should create def-use information', () => {
      const defUse = createDefUse(['x'], ['y', 'z']);

      expect(defUse.defs).toEqual(['x']);
      expect(defUse.uses).toEqual(['y', 'z']);
    });
  });

  describe('createOptimizationHints', () => {
    it('should create optimization hints with defaults', () => {
      const hints = createOptimizationHints();

      expect(hints.isHotPath).toBe(false);
      expect(hints.isFrequentAccess).toBe(false);
      expect(hints.canCoalesce).toBe(false);
      expect(hints.isDead).toBe(false);
    });

    it('should create optimization hints with custom values', () => {
      const hints = createOptimizationHints({
        isHotPath: true,
        isFrequentAccess: true,
      });

      expect(hints.isHotPath).toBe(true);
      expect(hints.isFrequentAccess).toBe(true);
      expect(hints.canCoalesce).toBe(false);
    });
  });
});

describe('Structure Factory Functions', () => {
  describe('createILLoop', () => {
    it('should create a simple loop', () => {
      const loop = createILLoop('while_0', 'while_0_exit', 1);

      expect(loop.headerLabel).toBe('while_0');
      expect(loop.exitLabel).toBe('while_0_exit');
      expect(loop.depth).toBe(1);
      expect(loop.isCountedLoop).toBe(false);
    });

    it('should create a counted loop', () => {
      const counterSlot = createFrameSlot('i', SlotKind.Local, BUILTIN_TYPES.BYTE);
      const loop = createILLoop('for_0', 'for_0_exit', 1, {
        isCountedLoop: true,
        counterSlot,
        boundValue: 10,
        estimatedIterations: 10,
      });

      expect(loop.isCountedLoop).toBe(true);
      expect(loop.counterSlot).toBe(counterSlot);
      expect(loop.boundValue).toBe(10);
      expect(loop.estimatedIterations).toBe(10);
    });
  });

  describe('createILFunction', () => {
    it('should create an IL function', () => {
      const frame = createFrame('main', {
        isExported: true,
        isCallback: false,
      });

      const func = createILFunction('main', frame);

      expect(func.name).toBe('main');
      expect(func.frame).toBe(frame);
      expect(func.instructions).toEqual([]);
      expect(func.isExported).toBe(true);
      expect(func.isCallback).toBe(false);
      expect(func.loops).toEqual([]);
      expect(func.maxLoopDepth).toBe(0);
    });

    it('should create an IL function with options', () => {
      const frame = createFrame('handler');
      const func = createILFunction('handler', frame, {
        isCallback: true,
        maxLoopDepth: 2,
      });

      expect(func.isCallback).toBe(true);
      expect(func.maxLoopDepth).toBe(2);
    });
  });

  describe('createILProgram', () => {
    it('should create an IL program', () => {
      const program = createILProgram('game');

      expect(program.moduleName).toBe('game');
      expect(program.functions).toEqual([]);
      expect(program.globalInit).toEqual([]);
      expect(program.entryPoint).toBe('main');
      expect(program.instructionCount).toBe(0);
      expect(program.totalEstimatedCycles).toBe(0);
    });

    it('should create an IL program with options', () => {
      const frame = createFrame('start');
      const func = createILFunction('start', frame);

      const program = createILProgram('app', {
        functions: [func],
        entryPoint: 'start',
        instructionCount: 50,
        totalEstimatedCycles: 1000,
      });

      expect(program.functions).toHaveLength(1);
      expect(program.entryPoint).toBe('start');
      expect(program.instructionCount).toBe(50);
      expect(program.totalEstimatedCycles).toBe(1000);
    });
  });
});