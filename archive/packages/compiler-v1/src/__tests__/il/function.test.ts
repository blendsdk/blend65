/**
 * IL Function Tests - Part 1: Construction and Block Management
 *
 * Tests for ILFunction class which represents a function in the IL representation.
 * An ILFunction contains basic blocks forming the control flow graph.
 *
 * Test Categories:
 * - Construction: Function creation with various parameters
 * - Block Management: Creating, getting, and removing blocks
 *
 * @module il/function.test
 */

import { describe, expect, it } from 'vitest';
import { ILFunction, ILStorageClass } from '../../il/function.js';
import { IL_BYTE, IL_WORD, IL_BOOL, IL_VOID } from '../../il/types.js';
import {
  ILConstInstruction,
  ILJumpInstruction,
  ILReturnInstruction,
  ILReturnVoidInstruction,
} from '../../il/instructions.js';
import { VirtualRegister, type ILLabel } from '../../il/values.js';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a test register for instruction operands.
 *
 * @param id - Register ID
 * @param type - IL type (defaults to IL_BYTE)
 * @param name - Optional register name
 * @returns A new VirtualRegister
 */
function createTestRegister(id: number, type = IL_BYTE, name?: string): VirtualRegister {
  return new VirtualRegister(id, type, name);
}

/**
 * Creates a test label for jump targets.
 *
 * @param name - Label name
 * @param blockId - Target block ID
 * @returns A frozen ILLabel
 */
function createTestLabel(name: string, blockId: number): ILLabel {
  return Object.freeze({ kind: 'label' as const, name, blockId });
}

// =============================================================================
// ILFunction Construction Tests
// =============================================================================

describe('ILFunction', () => {
  describe('construction - happy path', () => {
    it('should create function with name only', () => {
      const func = new ILFunction('init', [], IL_VOID);

      expect(func.name).toBe('init');
      expect(func.parameters).toHaveLength(0);
      expect(func.returnType).toBe(IL_VOID);
    });

    it('should create function with single parameter', () => {
      const func = new ILFunction(
        'increment',
        [{ name: 'value', type: IL_BYTE }],
        IL_BYTE,
      );

      expect(func.name).toBe('increment');
      expect(func.parameters).toHaveLength(1);
      expect(func.parameters[0].name).toBe('value');
      expect(func.parameters[0].type).toBe(IL_BYTE);
      expect(func.returnType).toBe(IL_BYTE);
    });

    it('should create function with multiple parameters', () => {
      const func = new ILFunction(
        'add',
        [
          { name: 'a', type: IL_BYTE },
          { name: 'b', type: IL_BYTE },
        ],
        IL_BYTE,
      );

      expect(func.parameters).toHaveLength(2);
      expect(func.parameters[0].name).toBe('a');
      expect(func.parameters[1].name).toBe('b');
    });

    it('should create function with word return type', () => {
      const func = new ILFunction(
        'getAddress',
        [],
        IL_WORD,
      );

      expect(func.returnType).toBe(IL_WORD);
    });

    it('should create function with bool return type', () => {
      const func = new ILFunction(
        'isActive',
        [],
        IL_BOOL,
      );

      expect(func.returnType).toBe(IL_BOOL);
    });

    it('should create function with mixed parameter types', () => {
      const func = new ILFunction(
        'process',
        [
          { name: 'index', type: IL_BYTE },
          { name: 'address', type: IL_WORD },
          { name: 'enabled', type: IL_BOOL },
        ],
        IL_VOID,
      );

      expect(func.parameters).toHaveLength(3);
      expect(func.parameters[0].type).toBe(IL_BYTE);
      expect(func.parameters[1].type).toBe(IL_WORD);
      expect(func.parameters[2].type).toBe(IL_BOOL);
    });

    it('should automatically create entry block', () => {
      const func = new ILFunction('test', [], IL_VOID);

      const entryBlock = func.getEntryBlock();
      expect(entryBlock).toBeDefined();
      expect(entryBlock.label).toBe('entry');
      expect(entryBlock.id).toBe(0);
    });

    it('should create parameter registers', () => {
      const func = new ILFunction(
        'add',
        [
          { name: 'a', type: IL_BYTE },
          { name: 'b', type: IL_WORD },
        ],
        IL_BYTE,
      );

      const paramRegs = func.getParameterRegisters();
      expect(paramRegs).toHaveLength(2);
      expect(paramRegs[0].type).toBe(IL_BYTE);
      expect(paramRegs[1].type).toBe(IL_WORD);
    });

    it('should default return type to void', () => {
      const func = new ILFunction('noReturn', []);

      expect(func.returnType.kind).toBe('void');
    });
  });

  describe('construction - edge cases', () => {
    it('should handle empty string function name', () => {
      const func = new ILFunction('', [], IL_VOID);

      expect(func.name).toBe('');
    });

    it('should handle very long function name', () => {
      const longName = 'a'.repeat(1000);
      const func = new ILFunction(longName, [], IL_VOID);

      expect(func.name).toBe(longName);
    });

    it('should handle function name with special characters', () => {
      const func = new ILFunction('init_system_v2', [], IL_VOID);

      expect(func.name).toBe('init_system_v2');
    });

    it('should handle maximum reasonable parameters (10)', () => {
      const params = Array.from({ length: 10 }, (_, i) => ({
        name: `p${i}`,
        type: IL_BYTE,
      }));
      const func = new ILFunction('manyParams', params, IL_VOID);

      expect(func.parameters).toHaveLength(10);
      expect(func.getParameterRegisters()).toHaveLength(10);
    });

    it('should handle parameters with same name (edge case)', () => {
      // This is valid at IL level - semantic analysis prevents this
      const func = new ILFunction(
        'duplicate',
        [
          { name: 'x', type: IL_BYTE },
          { name: 'x', type: IL_BYTE },
        ],
        IL_VOID,
      );

      expect(func.parameters).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Block Management Tests
  // ===========================================================================

  describe('block management - createBlock()', () => {
    it('should create additional block', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const block = func.createBlock('loop');

      expect(block.label).toBe('loop');
      expect(func.getBlockCount()).toBe(2); // entry + loop
    });

    it('should create blocks with sequential IDs', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const block1 = func.createBlock('first');
      const block2 = func.createBlock('second');
      const block3 = func.createBlock('third');

      expect(block1.id).toBe(1); // entry is 0
      expect(block2.id).toBe(2);
      expect(block3.id).toBe(3);
    });

    it('should create many blocks', () => {
      const func = new ILFunction('test', [], IL_VOID);

      for (let i = 0; i < 100; i++) {
        func.createBlock(`block_${i}`);
      }

      expect(func.getBlockCount()).toBe(101); // entry + 100
    });
  });

  describe('block management - getBlock()', () => {
    it('should get entry block by ID', () => {
      const func = new ILFunction('test', [], IL_VOID);

      const block = func.getBlock(0);

      expect(block).toBeDefined();
      expect(block?.label).toBe('entry');
    });

    it('should get created block by ID', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const created = func.createBlock('myblock');

      const retrieved = func.getBlock(created.id);

      expect(retrieved).toBe(created);
    });

    it('should return undefined for non-existent block', () => {
      const func = new ILFunction('test', [], IL_VOID);

      const block = func.getBlock(999);

      expect(block).toBeUndefined();
    });
  });

  describe('block management - getBlocks()', () => {
    it('should return all blocks', () => {
      const func = new ILFunction('test', [], IL_VOID);
      func.createBlock('a');
      func.createBlock('b');

      const blocks = func.getBlocks();

      expect(blocks).toHaveLength(3);
    });

    it('should return blocks as array copy', () => {
      const func = new ILFunction('test', [], IL_VOID);

      const blocks1 = func.getBlocks();
      const blocks2 = func.getBlocks();

      expect(blocks1).not.toBe(blocks2);
    });
  });

  describe('block management - removeBlock()', () => {
    it('should remove non-entry block', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const block = func.createBlock('removable');

      const result = func.removeBlock(block.id);

      expect(result).toBe(true);
      expect(func.getBlock(block.id)).toBeUndefined();
    });

    it('should throw when removing entry block', () => {
      const func = new ILFunction('test', [], IL_VOID);

      expect(() => func.removeBlock(0)).toThrow();
    });

    it('should return false for non-existent block', () => {
      const func = new ILFunction('test', [], IL_VOID);

      const result = func.removeBlock(999);

      expect(result).toBe(false);
    });

    it('should unlink CFG edges when removing block', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const middle = func.createBlock('middle');
      const end = func.createBlock('end');

      entry.linkTo(middle);
      middle.linkTo(end);

      func.removeBlock(middle.id);

      expect(entry.getSuccessors()).not.toContain(middle);
      expect(end.getPredecessors()).not.toContain(middle);
    });
  });

  describe('block management - getBlockCount()', () => {
    it('should return 1 for new function (entry block)', () => {
      const func = new ILFunction('test', [], IL_VOID);

      expect(func.getBlockCount()).toBe(1);
    });

    it('should increase with each created block', () => {
      const func = new ILFunction('test', [], IL_VOID);

      func.createBlock('a');
      expect(func.getBlockCount()).toBe(2);

      func.createBlock('b');
      expect(func.getBlockCount()).toBe(3);
    });

    it('should decrease when block is removed', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const block = func.createBlock('temp');

      func.removeBlock(block.id);

      expect(func.getBlockCount()).toBe(1);
    });
  });

  // ===========================================================================
  // CFG Traversal Tests
  // ===========================================================================

  describe('CFG traversal - getExitBlocks()', () => {
    it('should return empty array when no return instructions', () => {
      const func = new ILFunction('test', [], IL_VOID);

      const exits = func.getExitBlocks();

      expect(exits).toHaveLength(0);
    });

    it('should return block with RETURN instruction', () => {
      const func = new ILFunction('test', [], IL_BYTE);
      const entry = func.getEntryBlock();
      const value = createTestRegister(0, IL_BYTE);
      entry.addInstruction(new ILReturnInstruction(0, value));

      const exits = func.getExitBlocks();

      expect(exits).toHaveLength(1);
      expect(exits[0]).toBe(entry);
    });

    it('should return block with RETURN_VOID instruction', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      entry.addInstruction(new ILReturnVoidInstruction(0));

      const exits = func.getExitBlocks();

      expect(exits).toHaveLength(1);
    });

    it('should return multiple exit blocks', () => {
      const func = new ILFunction('test', [], IL_BYTE);
      const entry = func.getEntryBlock();
      const thenBlock = func.createBlock('then');
      const elseBlock = func.createBlock('else');

      // Add return to both branches
      const v1 = createTestRegister(0, IL_BYTE);
      const v2 = createTestRegister(1, IL_BYTE);
      thenBlock.addInstruction(new ILReturnInstruction(0, v1));
      elseBlock.addInstruction(new ILReturnInstruction(1, v2));

      const exits = func.getExitBlocks();

      expect(exits).toHaveLength(2);
    });
  });

  describe('CFG traversal - getReachableBlocks()', () => {
    it('should return only entry block for unlinked function', () => {
      const func = new ILFunction('test', [], IL_VOID);
      func.createBlock('unreachable');

      const reachable = func.getReachableBlocks();

      expect(reachable.size).toBe(1);
      expect(reachable.has(0)).toBe(true);
    });

    it('should return all linked blocks', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const next = func.createBlock('next');
      entry.linkTo(next);

      const reachable = func.getReachableBlocks();

      expect(reachable.size).toBe(2);
      expect(reachable.has(entry.id)).toBe(true);
      expect(reachable.has(next.id)).toBe(true);
    });

    it('should traverse diamond pattern CFG', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const thenBlock = func.createBlock('then');
      const elseBlock = func.createBlock('else');
      const merge = func.createBlock('merge');

      entry.linkTo(thenBlock);
      entry.linkTo(elseBlock);
      thenBlock.linkTo(merge);
      elseBlock.linkTo(merge);

      const reachable = func.getReachableBlocks();

      expect(reachable.size).toBe(4);
    });

    it('should traverse loop pattern CFG', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const loopHeader = func.createBlock('loop_header');
      const loopBody = func.createBlock('loop_body');
      const exit = func.createBlock('exit');

      entry.linkTo(loopHeader);
      loopHeader.linkTo(loopBody);
      loopHeader.linkTo(exit);
      loopBody.linkTo(loopHeader);

      const reachable = func.getReachableBlocks();

      expect(reachable.size).toBe(4);
    });
  });

  describe('CFG traversal - getUnreachableBlocks()', () => {
    it('should return empty array when all blocks reachable', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const next = func.createBlock('next');
      entry.linkTo(next);

      const unreachable = func.getUnreachableBlocks();

      expect(unreachable).toHaveLength(0);
    });

    it('should return unlinked blocks', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const deadBlock = func.createBlock('dead');

      const unreachable = func.getUnreachableBlocks();

      expect(unreachable).toHaveLength(1);
      expect(unreachable[0]).toBe(deadBlock);
    });

    it('should return multiple unreachable blocks', () => {
      const func = new ILFunction('test', [], IL_VOID);
      func.createBlock('dead1');
      func.createBlock('dead2');
      func.createBlock('dead3');

      const unreachable = func.getUnreachableBlocks();

      expect(unreachable).toHaveLength(3);
    });
  });

  describe('CFG traversal - getBlocksInReversePostorder()', () => {
    it('should return entry block first', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const next = func.createBlock('next');
      entry.linkTo(next);

      const order = func.getBlocksInReversePostorder();

      expect(order[0]).toBe(entry);
    });

    it('should visit predecessors before successors', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const a = func.createBlock('a');
      const b = func.createBlock('b');
      entry.linkTo(a);
      a.linkTo(b);

      const order = func.getBlocksInReversePostorder();
      const indexEntry = order.indexOf(entry);
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);

      expect(indexEntry).toBeLessThan(indexA);
      expect(indexA).toBeLessThan(indexB);
    });

    it('should handle diamond CFG correctly', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const thenBlock = func.createBlock('then');
      const elseBlock = func.createBlock('else');
      const merge = func.createBlock('merge');

      entry.linkTo(thenBlock);
      entry.linkTo(elseBlock);
      thenBlock.linkTo(merge);
      elseBlock.linkTo(merge);

      const order = func.getBlocksInReversePostorder();

      // Entry must be first
      expect(order[0]).toBe(entry);
      // Merge must be last (visited after both branches)
      expect(order[order.length - 1]).toBe(merge);
    });
  });

  describe('CFG traversal - getBlocksInPostorder()', () => {
    it('should return entry block last for linear CFG', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const next = func.createBlock('next');
      entry.linkTo(next);

      const order = func.getBlocksInPostorder();

      expect(order[order.length - 1]).toBe(entry);
    });

    it('should visit successors before predecessors', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const a = func.createBlock('a');
      const b = func.createBlock('b');
      entry.linkTo(a);
      a.linkTo(b);

      const order = func.getBlocksInPostorder();
      const indexEntry = order.indexOf(entry);
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);

      expect(indexB).toBeLessThan(indexA);
      expect(indexA).toBeLessThan(indexEntry);
    });
  });

  // ===========================================================================
  // Dominator Tree Tests
  // ===========================================================================

  describe('dominator tree - computeDominators()', () => {
    it('should compute dominators for single block', () => {
      const func = new ILFunction('test', [], IL_VOID);

      const idom = func.computeDominators();

      // Entry block dominates itself
      expect(idom.get(0)).toBe(0);
    });

    it('should compute dominators for linear CFG', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const a = func.createBlock('a');
      const b = func.createBlock('b');
      entry.linkTo(a);
      a.linkTo(b);

      const idom = func.computeDominators();

      expect(idom.get(entry.id)).toBe(entry.id); // Entry dominates itself
      expect(idom.get(a.id)).toBe(entry.id);     // Entry dominates a
      expect(idom.get(b.id)).toBe(a.id);         // a dominates b
    });

    it('should compute dominators for diamond CFG', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const thenBlock = func.createBlock('then');
      const elseBlock = func.createBlock('else');
      const merge = func.createBlock('merge');

      entry.linkTo(thenBlock);
      entry.linkTo(elseBlock);
      thenBlock.linkTo(merge);
      elseBlock.linkTo(merge);

      const idom = func.computeDominators();

      expect(idom.get(thenBlock.id)).toBe(entry.id);
      expect(idom.get(elseBlock.id)).toBe(entry.id);
      // Merge is dominated by entry (both paths come from entry)
      expect(idom.get(merge.id)).toBe(entry.id);
    });

    it('should compute dominators for loop CFG', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const loopHeader = func.createBlock('loop_header');
      const loopBody = func.createBlock('loop_body');

      entry.linkTo(loopHeader);
      loopHeader.linkTo(loopBody);
      loopBody.linkTo(loopHeader);

      const idom = func.computeDominators();

      expect(idom.get(loopHeader.id)).toBe(entry.id);
      expect(idom.get(loopBody.id)).toBe(loopHeader.id);
    });
  });

  describe('dominator tree - computeDominanceFrontier()', () => {
    it('should compute empty frontier for linear CFG', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const a = func.createBlock('a');
      entry.linkTo(a);

      const frontier = func.computeDominanceFrontier();

      expect(frontier.get(entry.id)?.size).toBe(0);
      expect(frontier.get(a.id)?.size).toBe(0);
    });

    it('should compute frontier for diamond CFG', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const thenBlock = func.createBlock('then');
      const elseBlock = func.createBlock('else');
      const merge = func.createBlock('merge');

      entry.linkTo(thenBlock);
      entry.linkTo(elseBlock);
      thenBlock.linkTo(merge);
      elseBlock.linkTo(merge);

      const frontier = func.computeDominanceFrontier();

      // Both branches have merge in their frontier
      expect(frontier.get(thenBlock.id)?.has(merge.id)).toBe(true);
      expect(frontier.get(elseBlock.id)?.has(merge.id)).toBe(true);
    });

    it('should compute frontier for loop CFG', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const loopHeader = func.createBlock('loop_header');
      const loopBody = func.createBlock('loop_body');

      entry.linkTo(loopHeader);
      loopHeader.linkTo(loopBody);
      loopBody.linkTo(loopHeader);

      const frontier = func.computeDominanceFrontier();

      // Loop body has loop header in its frontier (back edge)
      expect(frontier.get(loopBody.id)?.has(loopHeader.id)).toBe(true);
    });
  });

  // ===========================================================================
  // Parameter Access Tests
  // ===========================================================================

  describe('parameter access - getParameterRegister()', () => {
    it('should get parameter by index', () => {
      const func = new ILFunction(
        'test',
        [
          { name: 'a', type: IL_BYTE },
          { name: 'b', type: IL_WORD },
        ],
        IL_VOID,
      );

      const param0 = func.getParameterRegister(0);
      const param1 = func.getParameterRegister(1);

      expect(param0?.type).toBe(IL_BYTE);
      expect(param1?.type).toBe(IL_WORD);
    });

    it('should return undefined for out of bounds index', () => {
      const func = new ILFunction('test', [{ name: 'x', type: IL_BYTE }], IL_VOID);

      expect(func.getParameterRegister(5)).toBeUndefined();
      expect(func.getParameterRegister(-1)).toBeUndefined();
    });
  });

  describe('parameter access - getParameterRegisterByName()', () => {
    it('should get parameter by name', () => {
      const func = new ILFunction(
        'test',
        [
          { name: 'count', type: IL_BYTE },
          { name: 'address', type: IL_WORD },
        ],
        IL_VOID,
      );

      const count = func.getParameterRegisterByName('count');
      const address = func.getParameterRegisterByName('address');

      expect(count?.type).toBe(IL_BYTE);
      expect(address?.type).toBe(IL_WORD);
    });

    it('should return undefined for non-existent parameter name', () => {
      const func = new ILFunction('test', [{ name: 'x', type: IL_BYTE }], IL_VOID);

      expect(func.getParameterRegisterByName('notexist')).toBeUndefined();
    });
  });

  // ===========================================================================
  // Function Properties Tests
  // ===========================================================================

  describe('function properties - getFunctionType()', () => {
    it('should return function type with correct signature', () => {
      const func = new ILFunction(
        'add',
        [
          { name: 'a', type: IL_BYTE },
          { name: 'b', type: IL_BYTE },
        ],
        IL_BYTE,
      );

      const funcType = func.getFunctionType();

      expect(funcType.kind).toBe('function');
      expect(funcType.parameterTypes).toHaveLength(2);
      expect(funcType.returnType).toBe(IL_BYTE);
    });
  });

  describe('function properties - isVoid()', () => {
    it('should return true for void function', () => {
      const func = new ILFunction('init', [], IL_VOID);

      expect(func.isVoid()).toBe(true);
    });

    it('should return false for non-void function', () => {
      const func = new ILFunction('getValue', [], IL_BYTE);

      expect(func.isVoid()).toBe(false);
    });
  });

  describe('function properties - exported flag', () => {
    it('should default to not exported', () => {
      const func = new ILFunction('test', [], IL_VOID);

      expect(func.getExported()).toBe(false);
    });

    it('should set and get exported flag', () => {
      const func = new ILFunction('test', [], IL_VOID);

      func.setExported(true);
      expect(func.getExported()).toBe(true);

      func.setExported(false);
      expect(func.getExported()).toBe(false);
    });
  });

  describe('function properties - interrupt flag', () => {
    it('should default to not interrupt', () => {
      const func = new ILFunction('test', [], IL_VOID);

      expect(func.getInterrupt()).toBe(false);
    });

    it('should set and get interrupt flag', () => {
      const func = new ILFunction('irqHandler', [], IL_VOID);

      func.setInterrupt(true);
      expect(func.getInterrupt()).toBe(true);
    });
  });

  describe('function properties - parameter storage hints', () => {
    it('should set and get storage hint', () => {
      const func = new ILFunction('test', [{ name: 'fast', type: IL_BYTE }], IL_VOID);

      func.setParameterStorageHint('fast', ILStorageClass.ZeroPage);

      expect(func.getParameterStorageHint('fast')).toBe(ILStorageClass.ZeroPage);
    });

    it('should return undefined for parameter without hint', () => {
      const func = new ILFunction('test', [{ name: 'x', type: IL_BYTE }], IL_VOID);

      expect(func.getParameterStorageHint('x')).toBeUndefined();
    });
  });

  // ===========================================================================
  // Analysis Helpers Tests
  // ===========================================================================

  describe('analysis helpers - getInstructionCount()', () => {
    it('should return 0 for empty function', () => {
      const func = new ILFunction('test', [], IL_VOID);

      expect(func.getInstructionCount()).toBe(0);
    });

    it('should count instructions across all blocks', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const other = func.createBlock('other');

      const v1 = createTestRegister(0, IL_BYTE);
      const v2 = createTestRegister(1, IL_BYTE);
      entry.addInstruction(new ILConstInstruction(0, 42, IL_BYTE, v1));
      other.addInstruction(new ILConstInstruction(1, 10, IL_BYTE, v2));

      expect(func.getInstructionCount()).toBe(2);
    });
  });

  describe('analysis helpers - getRegisterCount()', () => {
    it('should return parameter count for new function', () => {
      const func = new ILFunction(
        'test',
        [{ name: 'a', type: IL_BYTE }],
        IL_VOID,
      );

      // Parameters create registers
      expect(func.getRegisterCount()).toBeGreaterThanOrEqual(1);
    });

    it('should increase when creating registers', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const initialCount = func.getRegisterCount();

      func.createRegister(IL_BYTE, 'temp');

      expect(func.getRegisterCount()).toBe(initialCount + 1);
    });
  });

  describe('analysis helpers - validateCFG()', () => {
    it('should return empty array for valid CFG', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      entry.addInstruction(new ILReturnVoidInstruction(0));

      const errors = func.validateCFG();

      expect(errors).toHaveLength(0);
    });

    it('should report missing terminator', () => {
      const func = new ILFunction('test', [], IL_VOID);
      // Entry has no terminator

      const errors = func.validateCFG();

      expect(errors.some((e) => e.includes('terminator'))).toBe(true);
    });

    it('should report unreachable blocks', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      entry.addInstruction(new ILReturnVoidInstruction(0));
      func.createBlock('unreachable'); // Not linked

      const errors = func.validateCFG();

      expect(errors.some((e) => e.includes('unreachable'))).toBe(true);
    });
  });

  // ===========================================================================
  // Debugging Tests
  // ===========================================================================

  describe('debugging - toString()', () => {
    it('should format function signature', () => {
      const func = new ILFunction(
        'add',
        [
          { name: 'a', type: IL_BYTE },
          { name: 'b', type: IL_BYTE },
        ],
        IL_BYTE,
      );

      const str = func.toString();

      expect(str).toContain('add');
      expect(str).toContain('a');
      expect(str).toContain('b');
      expect(str).toContain('byte');
    });

    it('should format void function', () => {
      const func = new ILFunction('init', [], IL_VOID);

      const str = func.toString();

      expect(str).toContain('init');
      expect(str).toContain('void');
    });
  });

  describe('debugging - toDetailedString()', () => {
    it('should include function name', () => {
      const func = new ILFunction('myFunc', [], IL_VOID);

      const str = func.toDetailedString();

      expect(str).toContain('myFunc');
    });

    it('should include exported marker', () => {
      const func = new ILFunction('exported', [], IL_VOID);
      func.setExported(true);

      const str = func.toDetailedString();

      expect(str).toContain('export');
    });

    it('should include interrupt marker', () => {
      const func = new ILFunction('irq', [], IL_VOID);
      func.setInterrupt(true);

      const str = func.toDetailedString();

      expect(str).toContain('interrupt');
    });

    it('should include block information', () => {
      const func = new ILFunction('test', [], IL_VOID);

      const str = func.toDetailedString();

      expect(str).toContain('entry');
    });
  });
});