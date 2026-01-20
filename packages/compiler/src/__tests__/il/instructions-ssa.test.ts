/**
 * IL Instructions - SSA (Phi) Instruction Tests
 *
 * Tests for SSA phi instructions:
 * - ILPhiInstruction: Merges values from different control flow paths
 *
 * Phi instructions are placed at the beginning of basic blocks with multiple
 * predecessors to select the correct value based on which predecessor block
 * was executed before reaching this block.
 *
 * @module il/instructions-ssa.test
 */

import { describe, expect, it } from 'vitest';
import { ILOpcode, ILPhiInstruction } from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
import { IL_BYTE, IL_WORD, IL_BOOL } from '../../il/types.js';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a test virtual register with the specified type and optional name.
 */
function createTestRegister(id: number, type = IL_BYTE, name?: string): VirtualRegister {
  return new VirtualRegister(id, type, name);
}

// =============================================================================
// ILPhiInstruction Tests
// =============================================================================

describe('ILPhiInstruction', () => {
  describe('construction', () => {
    it('should create PHI instruction with two sources', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.PHI);
      expect(inst.sources).toHaveLength(2);
      expect(inst.result).toBe(result);
    });

    it('should create PHI instruction with three sources', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const v2 = createTestRegister(2, IL_BYTE);
      const result = createTestRegister(3, IL_BYTE);
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
        { value: v2, blockId: 2 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      expect(inst.sources).toHaveLength(3);
    });

    it('should create PHI instruction with word type', () => {
      const v0 = createTestRegister(0, IL_WORD);
      const v1 = createTestRegister(1, IL_WORD);
      const result = createTestRegister(2, IL_WORD);
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      expect(inst.result?.type).toBe(IL_WORD);
    });

    it('should store metadata correctly', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ];
      const metadata = {
        location: { line: 10, column: 5, sourceFile: 'test.bl65' },
      };

      const inst = new ILPhiInstruction(0, sources, result, metadata);

      expect(inst.metadata.location?.line).toBe(10);
    });
  });

  describe('getOperands()', () => {
    it('should return all source values', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);
      const operands = inst.getOperands();

      expect(operands).toHaveLength(2);
      expect(operands[0]).toBe(v0);
      expect(operands[1]).toBe(v1);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return all source registers', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);
      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).toHaveLength(2);
      expect(usedRegs).toContain(v0);
      expect(usedRegs).toContain(v1);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false (phi has no side effects)', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (phi is not a terminator)', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('getValueForBlock()', () => {
    it('should return correct value for each block', () => {
      const v0 = createTestRegister(0, IL_BYTE, 'then_val');
      const v1 = createTestRegister(1, IL_BYTE, 'else_val');
      const result = createTestRegister(2, IL_BYTE);
      const sources = [
        { value: v0, blockId: 5 },
        { value: v1, blockId: 6 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      expect(inst.getValueForBlock(5)).toBe(v0);
      expect(inst.getValueForBlock(6)).toBe(v1);
    });

    it('should return undefined for unknown block', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      expect(inst.getValueForBlock(99)).toBeUndefined();
    });
  });

  describe('getPredecessorBlockIds()', () => {
    it('should return all predecessor block IDs', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const v2 = createTestRegister(2, IL_BYTE);
      const result = createTestRegister(3, IL_BYTE);
      const sources = [
        { value: v0, blockId: 3 },
        { value: v1, blockId: 5 },
        { value: v2, blockId: 7 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);
      const preds = inst.getPredecessorBlockIds();

      expect(preds).toHaveLength(3);
      expect(preds).toContain(3);
      expect(preds).toContain(5);
      expect(preds).toContain(7);
    });
  });

  describe('toString()', () => {
    it('should format PHI instruction correctly', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      expect(inst.toString()).toBe('v2 = PHI [(v0, block0), (v1, block1)]');
    });

    it('should format PHI with register names', () => {
      const v0 = createTestRegister(0, IL_BYTE, 'then');
      const v1 = createTestRegister(1, IL_BYTE, 'else');
      const result = createTestRegister(2, IL_BYTE, 'merged');
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      expect(inst.toString()).toBe('v2:merged = PHI [(v0:then, block0), (v1:else, block1)]');
    });

    it('should format PHI with three sources', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const v2 = createTestRegister(2, IL_BYTE);
      const result = createTestRegister(3, IL_BYTE);
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
        { value: v2, blockId: 2 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      expect(inst.toString()).toBe('v3 = PHI [(v0, block0), (v1, block1), (v2, block2)]');
    });
  });

  describe('sources access', () => {
    it('should provide sources array access', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const sources = [
        { value: v0, blockId: 3 },
        { value: v1, blockId: 4 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      expect(inst.sources[0].value).toBe(v0);
      expect(inst.sources[0].blockId).toBe(3);
      expect(inst.sources[1].value).toBe(v1);
      expect(inst.sources[1].blockId).toBe(4);
    });

    it('sources should be readonly', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      // The sources array is readonly, so this should be type-safe
      expect(inst.sources).toHaveLength(2);
    });
  });

  describe('result access', () => {
    it('should provide result register access', () => {
      const v0 = createTestRegister(0, IL_BYTE);
      const v1 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(5, IL_WORD, 'merged');
      const sources = [
        { value: v0, blockId: 0 },
        { value: v1, blockId: 1 },
      ];

      const inst = new ILPhiInstruction(0, sources, result);

      expect(inst.result).toBe(result);
      expect(inst.result?.id).toBe(5);
      expect(inst.result?.type).toBe(IL_WORD);
      expect(inst.result?.name).toBe('merged');
    });
  });
});