/**
 * IL Instructions - Control Flow Instructions Tests
 *
 * Tests for control flow (terminator) instructions:
 * - ILJumpInstruction: Unconditional jump to a target block
 * - ILBranchInstruction: Conditional branch (if condition then A else B)
 * - ILReturnInstruction: Return a value from function
 * - ILReturnVoidInstruction: Return void from function
 *
 * Control flow instructions are terminators - they end basic blocks and
 * transfer control to other blocks or exit the function.
 *
 * @module il/instructions-control-flow.test
 */

import { describe, expect, it } from 'vitest';
import {
  ILOpcode,
  ILJumpInstruction,
  ILBranchInstruction,
  ILReturnInstruction,
  ILReturnVoidInstruction,
} from '../../il/instructions.js';
import { VirtualRegister, ILValueFactory, type ILLabel } from '../../il/values.js';
import { IL_BYTE, IL_WORD, IL_BOOL } from '../../il/types.js';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a test virtual register with the specified type and optional name.
 *
 * @param id - Register ID
 * @param type - IL type for the register
 * @param name - Optional name for the register
 * @returns A new VirtualRegister instance
 */
function createTestRegister(
  id: number,
  type = IL_BYTE,
  name?: string,
): VirtualRegister {
  return new VirtualRegister(id, type, name);
}

/**
 * Creates a test label for a block.
 *
 * @param name - Label name
 * @param blockId - Block ID the label points to
 * @returns A frozen ILLabel object
 */
function createTestLabel(name: string, blockId: number): ILLabel {
  return Object.freeze({
    kind: 'label' as const,
    name,
    blockId,
  });
}

// =============================================================================
// ILJumpInstruction Tests
// =============================================================================

describe('ILJumpInstruction', () => {
  describe('construction', () => {
    it('should create JUMP instruction with target label', () => {
      const target = createTestLabel('loop_start', 1);

      const inst = new ILJumpInstruction(0, target);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.JUMP);
      expect(inst.target).toBe(target);
      expect(inst.result).toBeNull();
    });

    it('should store metadata correctly', () => {
      const target = createTestLabel('loop_start', 1);
      const metadata = {
        location: { line: 10, column: 5, sourceFile: 'test.bl65' },
      };

      const inst = new ILJumpInstruction(0, target, metadata);

      expect(inst.metadata.location?.line).toBe(10);
    });

    it('should handle various target block IDs', () => {
      const target0 = createTestLabel('block0', 0);
      const target100 = createTestLabel('block100', 100);

      const inst0 = new ILJumpInstruction(0, target0);
      const inst100 = new ILJumpInstruction(1, target100);

      expect(inst0.target.blockId).toBe(0);
      expect(inst100.target.blockId).toBe(100);
    });
  });

  describe('getOperands()', () => {
    it('should return [target label] array', () => {
      const target = createTestLabel('loop_start', 1);
      const inst = new ILJumpInstruction(0, target);

      const operands = inst.getOperands();

      expect(operands).toHaveLength(1);
      expect(operands[0]).toBe(target);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return empty array (jump uses no registers)', () => {
      const target = createTestLabel('loop_start', 1);
      const inst = new ILJumpInstruction(0, target);

      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).toHaveLength(0);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false (jump has no side effects)', () => {
      const target = createTestLabel('loop_start', 1);
      const inst = new ILJumpInstruction(0, target);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return true (jump is a terminator)', () => {
      const target = createTestLabel('loop_start', 1);
      const inst = new ILJumpInstruction(0, target);

      expect(inst.isTerminator()).toBe(true);
    });
  });

  describe('getTargetBlockId()', () => {
    it('should return the target block ID', () => {
      const target = createTestLabel('loop_start', 5);
      const inst = new ILJumpInstruction(0, target);

      expect(inst.getTargetBlockId()).toBe(5);
    });
  });

  describe('toString()', () => {
    it('should format JUMP instruction correctly', () => {
      const target = createTestLabel('loop_start', 1);
      const inst = new ILJumpInstruction(0, target);

      expect(inst.toString()).toBe('JUMP loop_start');
    });

    it('should handle various label names', () => {
      const target1 = createTestLabel('if_end', 2);
      const target2 = createTestLabel('block_5', 5);

      const inst1 = new ILJumpInstruction(0, target1);
      const inst2 = new ILJumpInstruction(1, target2);

      expect(inst1.toString()).toBe('JUMP if_end');
      expect(inst2.toString()).toBe('JUMP block_5');
    });
  });
});

// =============================================================================
// ILBranchInstruction Tests
// =============================================================================

describe('ILBranchInstruction', () => {
  describe('construction', () => {
    it('should create BRANCH instruction with condition and targets', () => {
      const condition = createTestRegister(0, IL_BOOL, 'cond');
      const thenTarget = createTestLabel('if_true', 1);
      const elseTarget = createTestLabel('if_false', 2);

      const inst = new ILBranchInstruction(0, condition, thenTarget, elseTarget);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.BRANCH);
      expect(inst.condition).toBe(condition);
      expect(inst.thenTarget).toBe(thenTarget);
      expect(inst.elseTarget).toBe(elseTarget);
      expect(inst.result).toBeNull();
    });

    it('should store metadata correctly', () => {
      const condition = createTestRegister(0, IL_BOOL);
      const thenTarget = createTestLabel('if_true', 1);
      const elseTarget = createTestLabel('if_false', 2);
      const metadata = {
        location: { line: 15, column: 3, sourceFile: 'test.bl65' },
      };

      const inst = new ILBranchInstruction(0, condition, thenTarget, elseTarget, metadata);

      expect(inst.metadata.location?.line).toBe(15);
    });
  });

  describe('getOperands()', () => {
    it('should return [condition, thenTarget, elseTarget] array', () => {
      const condition = createTestRegister(0, IL_BOOL);
      const thenTarget = createTestLabel('if_true', 1);
      const elseTarget = createTestLabel('if_false', 2);

      const inst = new ILBranchInstruction(0, condition, thenTarget, elseTarget);
      const operands = inst.getOperands();

      expect(operands).toHaveLength(3);
      expect(operands[0]).toBe(condition);
      expect(operands[1]).toBe(thenTarget);
      expect(operands[2]).toBe(elseTarget);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return [condition] register', () => {
      const condition = createTestRegister(0, IL_BOOL);
      const thenTarget = createTestLabel('if_true', 1);
      const elseTarget = createTestLabel('if_false', 2);

      const inst = new ILBranchInstruction(0, condition, thenTarget, elseTarget);
      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).toHaveLength(1);
      expect(usedRegs[0]).toBe(condition);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false (branch has no side effects)', () => {
      const condition = createTestRegister(0, IL_BOOL);
      const thenTarget = createTestLabel('if_true', 1);
      const elseTarget = createTestLabel('if_false', 2);

      const inst = new ILBranchInstruction(0, condition, thenTarget, elseTarget);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return true (branch is a terminator)', () => {
      const condition = createTestRegister(0, IL_BOOL);
      const thenTarget = createTestLabel('if_true', 1);
      const elseTarget = createTestLabel('if_false', 2);

      const inst = new ILBranchInstruction(0, condition, thenTarget, elseTarget);

      expect(inst.isTerminator()).toBe(true);
    });
  });

  describe('getThenBlockId()', () => {
    it('should return the then block ID', () => {
      const condition = createTestRegister(0, IL_BOOL);
      const thenTarget = createTestLabel('if_true', 5);
      const elseTarget = createTestLabel('if_false', 6);

      const inst = new ILBranchInstruction(0, condition, thenTarget, elseTarget);

      expect(inst.getThenBlockId()).toBe(5);
    });
  });

  describe('getElseBlockId()', () => {
    it('should return the else block ID', () => {
      const condition = createTestRegister(0, IL_BOOL);
      const thenTarget = createTestLabel('if_true', 5);
      const elseTarget = createTestLabel('if_false', 6);

      const inst = new ILBranchInstruction(0, condition, thenTarget, elseTarget);

      expect(inst.getElseBlockId()).toBe(6);
    });
  });

  describe('getSuccessorBlockIds()', () => {
    it('should return both target block IDs', () => {
      const condition = createTestRegister(0, IL_BOOL);
      const thenTarget = createTestLabel('if_true', 3);
      const elseTarget = createTestLabel('if_false', 4);

      const inst = new ILBranchInstruction(0, condition, thenTarget, elseTarget);
      const successors = inst.getSuccessorBlockIds();

      expect(successors).toHaveLength(2);
      expect(successors).toContain(3);
      expect(successors).toContain(4);
    });
  });

  describe('toString()', () => {
    it('should format BRANCH instruction correctly', () => {
      const condition = createTestRegister(0, IL_BOOL);
      const thenTarget = createTestLabel('if_true', 1);
      const elseTarget = createTestLabel('if_false', 2);

      const inst = new ILBranchInstruction(0, condition, thenTarget, elseTarget);

      expect(inst.toString()).toBe('BRANCH v0, if_true, if_false');
    });

    it('should include condition register name when present', () => {
      const condition = createTestRegister(0, IL_BOOL, 'cond');
      const thenTarget = createTestLabel('if_true', 1);
      const elseTarget = createTestLabel('if_false', 2);

      const inst = new ILBranchInstruction(0, condition, thenTarget, elseTarget);

      expect(inst.toString()).toBe('BRANCH v0:cond, if_true, if_false');
    });
  });
});

// =============================================================================
// ILReturnInstruction Tests
// =============================================================================

describe('ILReturnInstruction', () => {
  describe('construction', () => {
    it('should create RETURN instruction with byte value', () => {
      const value = createTestRegister(0, IL_BYTE, 'result');

      const inst = new ILReturnInstruction(0, value);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.RETURN);
      expect(inst.value).toBe(value);
      expect(inst.result).toBeNull();
    });

    it('should create RETURN instruction with word value', () => {
      const value = createTestRegister(0, IL_WORD);

      const inst = new ILReturnInstruction(0, value);

      expect(inst.value.type).toBe(IL_WORD);
    });

    it('should create RETURN instruction with bool value', () => {
      const value = createTestRegister(0, IL_BOOL);

      const inst = new ILReturnInstruction(0, value);

      expect(inst.value.type).toBe(IL_BOOL);
    });

    it('should store metadata correctly', () => {
      const value = createTestRegister(0, IL_BYTE);
      const metadata = {
        location: { line: 20, column: 3, sourceFile: 'test.bl65' },
      };

      const inst = new ILReturnInstruction(0, value, metadata);

      expect(inst.metadata.location?.line).toBe(20);
    });
  });

  describe('getOperands()', () => {
    it('should return [value] array', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILReturnInstruction(0, value);

      const operands = inst.getOperands();

      expect(operands).toHaveLength(1);
      expect(operands[0]).toBe(value);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return [value] register', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILReturnInstruction(0, value);

      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).toHaveLength(1);
      expect(usedRegs[0]).toBe(value);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false (return has no side effects)', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILReturnInstruction(0, value);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return true (return is a terminator)', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILReturnInstruction(0, value);

      expect(inst.isTerminator()).toBe(true);
    });
  });

  describe('toString()', () => {
    it('should format RETURN instruction correctly', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILReturnInstruction(0, value);

      expect(inst.toString()).toBe('RETURN v0');
    });

    it('should include register name when present', () => {
      const value = createTestRegister(5, IL_BYTE, 'result');
      const inst = new ILReturnInstruction(0, value);

      expect(inst.toString()).toBe('RETURN v5:result');
    });
  });

  describe('value access', () => {
    it('should provide value register access', () => {
      const value = createTestRegister(3, IL_WORD, 'retval');
      const inst = new ILReturnInstruction(0, value);

      expect(inst.value).toBe(value);
      expect(inst.value.id).toBe(3);
      expect(inst.value.type).toBe(IL_WORD);
      expect(inst.value.name).toBe('retval');
    });
  });
});

// =============================================================================
// ILReturnVoidInstruction Tests
// =============================================================================

describe('ILReturnVoidInstruction', () => {
  describe('construction', () => {
    it('should create RETURN_VOID instruction', () => {
      const inst = new ILReturnVoidInstruction(0);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.RETURN_VOID);
      expect(inst.result).toBeNull();
    });

    it('should store metadata correctly', () => {
      const metadata = {
        location: { line: 25, column: 3, sourceFile: 'test.bl65' },
      };

      const inst = new ILReturnVoidInstruction(0, metadata);

      expect(inst.metadata.location?.line).toBe(25);
    });

    it('should handle instruction ID correctly', () => {
      const inst = new ILReturnVoidInstruction(99);

      expect(inst.id).toBe(99);
    });
  });

  describe('getOperands()', () => {
    it('should return empty array (no operands)', () => {
      const inst = new ILReturnVoidInstruction(0);
      const operands = inst.getOperands();

      expect(operands).toHaveLength(0);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return empty array (no used registers)', () => {
      const inst = new ILReturnVoidInstruction(0);
      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).toHaveLength(0);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false (return void has no side effects)', () => {
      const inst = new ILReturnVoidInstruction(0);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return true (return void is a terminator)', () => {
      const inst = new ILReturnVoidInstruction(0);

      expect(inst.isTerminator()).toBe(true);
    });
  });

  describe('toString()', () => {
    it('should format RETURN_VOID instruction correctly', () => {
      const inst = new ILReturnVoidInstruction(0);

      expect(inst.toString()).toBe('RETURN_VOID');
    });
  });
});

// =============================================================================
// Terminator Comparison Tests
// =============================================================================

describe('Control Flow Instructions - Terminator Comparison', () => {
  it('all control flow instructions should be terminators', () => {
    const target = createTestLabel('block1', 1);
    const condition = createTestRegister(0, IL_BOOL);
    const value = createTestRegister(1, IL_BYTE);
    const thenTarget = createTestLabel('then', 2);
    const elseTarget = createTestLabel('else', 3);

    const jump = new ILJumpInstruction(0, target);
    const branch = new ILBranchInstruction(1, condition, thenTarget, elseTarget);
    const ret = new ILReturnInstruction(2, value);
    const retVoid = new ILReturnVoidInstruction(3);

    expect(jump.isTerminator()).toBe(true);
    expect(branch.isTerminator()).toBe(true);
    expect(ret.isTerminator()).toBe(true);
    expect(retVoid.isTerminator()).toBe(true);
  });

  it('control flow instructions should have no side effects', () => {
    const target = createTestLabel('block1', 1);
    const condition = createTestRegister(0, IL_BOOL);
    const value = createTestRegister(1, IL_BYTE);
    const thenTarget = createTestLabel('then', 2);
    const elseTarget = createTestLabel('else', 3);

    const jump = new ILJumpInstruction(0, target);
    const branch = new ILBranchInstruction(1, condition, thenTarget, elseTarget);
    const ret = new ILReturnInstruction(2, value);
    const retVoid = new ILReturnVoidInstruction(3);

    expect(jump.hasSideEffects()).toBe(false);
    expect(branch.hasSideEffects()).toBe(false);
    expect(ret.hasSideEffects()).toBe(false);
    expect(retVoid.hasSideEffects()).toBe(false);
  });

  it('control flow instructions should have null result', () => {
    const target = createTestLabel('block1', 1);
    const condition = createTestRegister(0, IL_BOOL);
    const value = createTestRegister(1, IL_BYTE);
    const thenTarget = createTestLabel('then', 2);
    const elseTarget = createTestLabel('else', 3);

    const jump = new ILJumpInstruction(0, target);
    const branch = new ILBranchInstruction(1, condition, thenTarget, elseTarget);
    const ret = new ILReturnInstruction(2, value);
    const retVoid = new ILReturnVoidInstruction(3);

    expect(jump.result).toBeNull();
    expect(branch.result).toBeNull();
    expect(ret.result).toBeNull();
    expect(retVoid.result).toBeNull();
  });
});