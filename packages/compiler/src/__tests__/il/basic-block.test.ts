/**
 * IL BasicBlock Tests
 *
 * Tests for BasicBlock class which represents a sequence of instructions
 * with a single entry point and single exit point.
 *
 * BasicBlocks are the fundamental building blocks of control flow graphs.
 *
 * @module il/basic-block.test
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { BasicBlock } from '../../il/basic-block.js';
import {
  ILOpcode,
  ILConstInstruction,
  ILBinaryInstruction,
  ILJumpInstruction,
  ILBranchInstruction,
  ILReturnInstruction,
  ILReturnVoidInstruction,
} from '../../il/instructions.js';
import { VirtualRegister, type ILLabel } from '../../il/values.js';
import { IL_BYTE, IL_BOOL } from '../../il/types.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestRegister(id: number, type = IL_BYTE, name?: string): VirtualRegister {
  return new VirtualRegister(id, type, name);
}

function createTestLabel(name: string, blockId: number): ILLabel {
  return Object.freeze({ kind: 'label' as const, name, blockId });
}

// =============================================================================
// BasicBlock Construction Tests
// =============================================================================

describe('BasicBlock', () => {
  describe('construction', () => {
    it('should create empty basic block with ID', () => {
      const block = new BasicBlock(0, 'entry');

      expect(block.id).toBe(0);
      expect(block.label).toBe('entry');
      expect(block.getInstructions()).toHaveLength(0);
    });

    it('should support custom labels', () => {
      const block = new BasicBlock(1, 'if_then');

      expect(block.label).toBe('if_then');
    });

    it('should have correct id', () => {
      const block = new BasicBlock(5, 'loop');

      expect(block.id).toBe(5);
    });
  });

  describe('addInstruction()', () => {
    it('should add single instruction', () => {
      const block = new BasicBlock(0, 'entry');
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILConstInstruction(0, 42, IL_BYTE, result);

      block.addInstruction(inst);

      expect(block.getInstructions()).toHaveLength(1);
      expect(block.getInstructions()[0]).toBe(inst);
    });

    it('should add multiple instructions in order', () => {
      const block = new BasicBlock(0, 'entry');
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const v2 = createTestRegister(2, IL_BYTE);

      const inst1 = new ILConstInstruction(0, 10, IL_BYTE, v0);
      const inst2 = new ILConstInstruction(1, 20, IL_BYTE, v1);
      const inst3 = new ILBinaryInstruction(2, ILOpcode.ADD, v0, v1, v2);

      block.addInstruction(inst1);
      block.addInstruction(inst2);
      block.addInstruction(inst3);

      expect(block.getInstructions()).toHaveLength(3);
      expect(block.getInstructions()[0]).toBe(inst1);
      expect(block.getInstructions()[1]).toBe(inst2);
      expect(block.getInstructions()[2]).toBe(inst3);
    });

    it('should throw error when adding instruction after terminator', () => {
      const block = new BasicBlock(0, 'entry');
      const target = createTestLabel('next', 1);
      block.addInstruction(new ILJumpInstruction(0, target));

      const result = createTestRegister(0, IL_BYTE);
      expect(() => {
        block.addInstruction(new ILConstInstruction(1, 42, IL_BYTE, result));
      }).toThrow();
    });
  });

  describe('getTerminator()', () => {
    it('should return undefined for empty block', () => {
      const block = new BasicBlock(0, 'entry');

      expect(block.getTerminator()).toBeUndefined();
    });

    it('should return undefined for block without terminator', () => {
      const block = new BasicBlock(0, 'entry');
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILConstInstruction(0, 42, IL_BYTE, result);
      block.addInstruction(inst);

      expect(block.getTerminator()).toBeUndefined();
    });

    it('should return JUMP terminator', () => {
      const block = new BasicBlock(0, 'entry');
      const target = createTestLabel('next', 1);
      const jump = new ILJumpInstruction(0, target);
      block.addInstruction(jump);

      const terminator = block.getTerminator();
      expect(terminator).toBe(jump);
      expect(terminator?.opcode).toBe(ILOpcode.JUMP);
    });

    it('should return BRANCH terminator', () => {
      const block = new BasicBlock(0, 'entry');
      const cond = createTestRegister(0, IL_BOOL);
      const thenTarget = createTestLabel('then', 1);
      const elseTarget = createTestLabel('else', 2);
      const branch = new ILBranchInstruction(0, cond, thenTarget, elseTarget);
      block.addInstruction(branch);

      const terminator = block.getTerminator();
      expect(terminator).toBe(branch);
      expect(terminator?.opcode).toBe(ILOpcode.BRANCH);
    });

    it('should return RETURN terminator', () => {
      const block = new BasicBlock(0, 'entry');
      const value = createTestRegister(0, IL_BYTE);
      const ret = new ILReturnInstruction(0, value);
      block.addInstruction(ret);

      const terminator = block.getTerminator();
      expect(terminator).toBe(ret);
      expect(terminator?.opcode).toBe(ILOpcode.RETURN);
    });

    it('should return RETURN_VOID terminator', () => {
      const block = new BasicBlock(0, 'entry');
      const retVoid = new ILReturnVoidInstruction(0);
      block.addInstruction(retVoid);

      const terminator = block.getTerminator();
      expect(terminator).toBe(retVoid);
      expect(terminator?.opcode).toBe(ILOpcode.RETURN_VOID);
    });
  });

  describe('hasTerminator()', () => {
    it('should return false for empty block', () => {
      const block = new BasicBlock(0, 'entry');

      expect(block.hasTerminator()).toBe(false);
    });

    it('should return false for block with only non-terminators', () => {
      const block = new BasicBlock(0, 'entry');
      const result = createTestRegister(0, IL_BYTE);
      block.addInstruction(new ILConstInstruction(0, 42, IL_BYTE, result));

      expect(block.hasTerminator()).toBe(false);
    });

    it('should return true for block with JUMP', () => {
      const block = new BasicBlock(0, 'entry');
      const target = createTestLabel('next', 1);
      block.addInstruction(new ILJumpInstruction(0, target));

      expect(block.hasTerminator()).toBe(true);
    });

    it('should return true for block with BRANCH', () => {
      const block = new BasicBlock(0, 'entry');
      const cond = createTestRegister(0, IL_BOOL);
      const thenTarget = createTestLabel('then', 1);
      const elseTarget = createTestLabel('else', 2);
      block.addInstruction(new ILBranchInstruction(0, cond, thenTarget, elseTarget));

      expect(block.hasTerminator()).toBe(true);
    });
  });

  describe('getSuccessors()', () => {
    it('should return empty array for block without successors', () => {
      const block = new BasicBlock(0, 'entry');

      expect(block.getSuccessors()).toEqual([]);
    });

    it('should return successor after linkTo', () => {
      const block1 = new BasicBlock(0, 'entry');
      const block2 = new BasicBlock(1, 'next');
      block1.linkTo(block2);

      const successors = block1.getSuccessors();
      expect(successors).toHaveLength(1);
      expect(successors[0]).toBe(block2);
    });

    it('should return multiple successors', () => {
      const block = new BasicBlock(0, 'entry');
      const thenBlock = new BasicBlock(1, 'then');
      const elseBlock = new BasicBlock(2, 'else');
      block.linkTo(thenBlock);
      block.linkTo(elseBlock);

      const successors = block.getSuccessors();
      expect(successors).toHaveLength(2);
    });
  });

  describe('predecessors', () => {
    it('should start with no predecessors', () => {
      const block = new BasicBlock(0, 'entry');

      expect(block.getPredecessors()).toHaveLength(0);
    });

    it('should allow adding predecessor via linkTo', () => {
      const block1 = new BasicBlock(0, 'entry');
      const block2 = new BasicBlock(1, 'body');
      block1.linkTo(block2);

      expect(block2.getPredecessors()).toHaveLength(1);
      expect(block2.getPredecessors()[0]).toBe(block1);
    });

    it('should allow multiple predecessors', () => {
      const merge = new BasicBlock(2, 'merge');
      const then = new BasicBlock(0, 'then');
      const elseB = new BasicBlock(1, 'else');
      then.linkTo(merge);
      elseB.linkTo(merge);

      expect(merge.getPredecessors()).toHaveLength(2);
    });
  });

  describe('toString()', () => {
    it('should format block with id and label', () => {
      const block = new BasicBlock(0, 'entry');

      const str = block.toString();

      expect(str).toBe('block0:entry');
    });

    it('should format block with different id and label', () => {
      const block = new BasicBlock(5, 'loop_body');

      expect(block.toString()).toBe('block5:loop_body');
    });
  });

  describe('toDetailedString()', () => {
    it('should format empty block', () => {
      const block = new BasicBlock(0, 'entry');

      const str = block.toDetailedString();

      expect(str).toContain('entry:');
    });

    it('should format block with instructions', () => {
      const block = new BasicBlock(0, 'entry');
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      block.addInstruction(new ILConstInstruction(0, 42, IL_BYTE, v0));
      block.addInstruction(new ILConstInstruction(1, 10, IL_BYTE, v1));

      const str = block.toDetailedString();

      expect(str).toContain('entry:');
      expect(str).toContain('CONST');
    });

    it('should format block with terminator', () => {
      const block = new BasicBlock(0, 'entry');
      const target = createTestLabel('next', 1);
      block.addInstruction(new ILJumpInstruction(0, target));

      const str = block.toDetailedString();

      expect(str).toContain('JUMP');
    });
  });

  describe('isEmpty()', () => {
    it('should return true for block with no instructions', () => {
      const block = new BasicBlock(0, 'entry');

      expect(block.isEmpty()).toBe(true);
    });

    it('should return false for block with instructions', () => {
      const block = new BasicBlock(0, 'entry');
      const result = createTestRegister(0, IL_BYTE);
      block.addInstruction(new ILConstInstruction(0, 42, IL_BYTE, result));

      expect(block.isEmpty()).toBe(false);
    });
  });

  describe('label access', () => {
    it('should provide label for block via getLabel()', () => {
      const block = new BasicBlock(5, 'loop_body');
      const label = block.getLabel();

      expect(label.kind).toBe('label');
      expect(label.name).toBe('loop_body');
      expect(label.blockId).toBe(5);
    });
  });

  describe('isEntry()', () => {
    it('should return true for block with no predecessors', () => {
      const block = new BasicBlock(0, 'entry');

      expect(block.isEntry()).toBe(true);
    });

    it('should return false for block with predecessors', () => {
      const entry = new BasicBlock(0, 'entry');
      const body = new BasicBlock(1, 'body');
      entry.linkTo(body);

      expect(body.isEntry()).toBe(false);
    });
  });

  describe('isExit()', () => {
    it('should return false for block without return', () => {
      const block = new BasicBlock(0, 'entry');

      expect(block.isExit()).toBe(false);
    });

    it('should return true for block with RETURN', () => {
      const block = new BasicBlock(0, 'entry');
      const value = createTestRegister(0, IL_BYTE);
      block.addInstruction(new ILReturnInstruction(0, value));

      expect(block.isExit()).toBe(true);
    });

    it('should return true for block with RETURN_VOID', () => {
      const block = new BasicBlock(0, 'entry');
      block.addInstruction(new ILReturnVoidInstruction(0));

      expect(block.isExit()).toBe(true);
    });
  });

  describe('linkTo() and unlinkFrom()', () => {
    it('should establish bidirectional edge with linkTo', () => {
      const a = new BasicBlock(0, 'a');
      const b = new BasicBlock(1, 'b');
      a.linkTo(b);

      expect(a.hasSuccessor(b)).toBe(true);
      expect(b.hasPredecessor(a)).toBe(true);
    });

    it('should remove bidirectional edge with unlinkFrom', () => {
      const a = new BasicBlock(0, 'a');
      const b = new BasicBlock(1, 'b');
      a.linkTo(b);
      a.unlinkFrom(b);

      expect(a.hasSuccessor(b)).toBe(false);
      expect(b.hasPredecessor(a)).toBe(false);
    });
  });
});