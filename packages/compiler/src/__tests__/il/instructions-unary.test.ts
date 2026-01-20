/**
 * IL Instructions - Unary Instructions Tests
 *
 * Tests for unary (single-operand) instructions:
 * - NEG: Arithmetic negation (-operand)
 * - NOT: Bitwise NOT (~operand)
 * - LOGICAL_NOT: Logical NOT (!operand)
 *
 * Unary instructions take one operand register and produce one result register.
 * Format: result = OPCODE operand
 *
 * @module il/instructions-unary.test
 */

import { describe, expect, it } from 'vitest';
import { ILOpcode, ILUnaryInstruction } from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
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

// =============================================================================
// ILUnaryInstruction Tests - NEG (Arithmetic Negation)
// =============================================================================

describe('ILUnaryInstruction - NEG', () => {
  describe('construction', () => {
    it('should create NEG instruction with byte operand', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.NEG);
      expect(inst.operand).toBe(operand);
      expect(inst.result).toBe(result);
    });

    it('should create NEG instruction with word operand', () => {
      const operand = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_WORD);

      const inst = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result);

      expect(inst.operand.type).toBe(IL_WORD);
      expect(inst.result?.type).toBe(IL_WORD);
    });

    it('should store metadata correctly', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);
      const metadata = {
        location: { line: 10, column: 5, sourceFile: 'test.bl65' },
        sourceExpression: '-x',
      };

      const inst = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result, metadata);

      expect(inst.metadata.sourceExpression).toBe('-x');
      expect(inst.metadata.location?.line).toBe(10);
    });
  });

  describe('toString()', () => {
    it('should format NEG instruction correctly', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result);

      expect(inst.toString()).toBe('v1 = NEG v0');
    });

    it('should include register names when present', () => {
      const operand = createTestRegister(0, IL_BYTE, 'x');
      const result = createTestRegister(1, IL_BYTE, 'neg_x');

      const inst = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result);

      expect(inst.toString()).toBe('v1:neg_x = NEG v0:x');
    });
  });
});

// =============================================================================
// ILUnaryInstruction Tests - NOT (Bitwise NOT)
// =============================================================================

describe('ILUnaryInstruction - NOT', () => {
  describe('construction', () => {
    it('should create NOT instruction with byte operand', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILUnaryInstruction(0, ILOpcode.NOT, operand, result);

      expect(inst.opcode).toBe(ILOpcode.NOT);
      expect(inst.operand).toBe(operand);
      expect(inst.result).toBe(result);
    });

    it('should create NOT instruction with word operand', () => {
      const operand = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_WORD);

      const inst = new ILUnaryInstruction(0, ILOpcode.NOT, operand, result);

      expect(inst.operand.type).toBe(IL_WORD);
      expect(inst.result?.type).toBe(IL_WORD);
    });
  });

  describe('toString()', () => {
    it('should format NOT instruction correctly', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILUnaryInstruction(0, ILOpcode.NOT, operand, result);

      expect(inst.toString()).toBe('v1 = NOT v0');
    });
  });
});

// =============================================================================
// ILUnaryInstruction Tests - LOGICAL_NOT
// =============================================================================

describe('ILUnaryInstruction - LOGICAL_NOT', () => {
  describe('construction', () => {
    it('should create LOGICAL_NOT instruction with bool operand', () => {
      const operand = createTestRegister(0, IL_BOOL);
      const result = createTestRegister(1, IL_BOOL);

      const inst = new ILUnaryInstruction(0, ILOpcode.LOGICAL_NOT, operand, result);

      expect(inst.opcode).toBe(ILOpcode.LOGICAL_NOT);
      expect(inst.operand.type).toBe(IL_BOOL);
      expect(inst.result?.type).toBe(IL_BOOL);
    });

    it('should create LOGICAL_NOT instruction with byte operand', () => {
      // Logical NOT can be applied to byte (0 = false, else true)
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BOOL);

      const inst = new ILUnaryInstruction(0, ILOpcode.LOGICAL_NOT, operand, result);

      expect(inst.opcode).toBe(ILOpcode.LOGICAL_NOT);
      expect(inst.operand.type).toBe(IL_BYTE);
      expect(inst.result?.type).toBe(IL_BOOL);
    });
  });

  describe('toString()', () => {
    it('should format LOGICAL_NOT instruction correctly', () => {
      const operand = createTestRegister(0, IL_BOOL);
      const result = createTestRegister(1, IL_BOOL);

      const inst = new ILUnaryInstruction(0, ILOpcode.LOGICAL_NOT, operand, result);

      expect(inst.toString()).toBe('v1 = LOGICAL_NOT v0');
    });
  });
});

// =============================================================================
// ILUnaryInstruction Tests - Common Methods
// =============================================================================

describe('ILUnaryInstruction - Methods', () => {
  describe('getOperands()', () => {
    it('should return [operand] array', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result);
      const operands = inst.getOperands();

      expect(operands).toHaveLength(1);
      expect(operands[0]).toBe(operand);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return [operand] register', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result);
      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).toHaveLength(1);
      expect(usedRegs[0]).toBe(operand);
    });

    it('should not include result register in used registers', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result);
      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).not.toContain(result);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false for NEG instruction', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result);

      expect(inst.hasSideEffects()).toBe(false);
    });

    it('should return false for NOT instruction', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILUnaryInstruction(0, ILOpcode.NOT, operand, result);

      expect(inst.hasSideEffects()).toBe(false);
    });

    it('should return false for LOGICAL_NOT instruction', () => {
      const operand = createTestRegister(0, IL_BOOL);
      const result = createTestRegister(1, IL_BOOL);

      const inst = new ILUnaryInstruction(0, ILOpcode.LOGICAL_NOT, operand, result);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (unary instructions are not terminators)', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);

      const neg = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result);
      const not = new ILUnaryInstruction(1, ILOpcode.NOT, operand, result);
      const logicalNot = new ILUnaryInstruction(2, ILOpcode.LOGICAL_NOT, operand, result);

      expect(neg.isTerminator()).toBe(false);
      expect(not.isTerminator()).toBe(false);
      expect(logicalNot.isTerminator()).toBe(false);
    });
  });

  describe('operand access', () => {
    it('should provide operand access', () => {
      const operand = createTestRegister(0, IL_BYTE, 'x');
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result);

      expect(inst.operand).toBe(operand);
      expect(inst.operand.id).toBe(0);
      expect(inst.operand.name).toBe('x');
      expect(inst.operand.type).toBe(IL_BYTE);
    });

    it('should provide result register access', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE, 'neg');

      const inst = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result);

      expect(inst.result).toBe(result);
      expect(inst.result?.id).toBe(1);
      expect(inst.result?.name).toBe('neg');
    });
  });

  describe('instruction ID', () => {
    it('should store instruction ID correctly', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILUnaryInstruction(42, ILOpcode.NEG, operand, result);

      expect(inst.id).toBe(42);
    });
  });

  describe('metadata', () => {
    it('should store source location metadata', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);
      const metadata = {
        location: { line: 20, column: 8, sourceFile: 'test.bl65' },
        sourceExpression: '~mask',
      };

      const inst = new ILUnaryInstruction(0, ILOpcode.NOT, operand, result, metadata);

      expect(inst.metadata.location?.line).toBe(20);
      expect(inst.metadata.location?.column).toBe(8);
      expect(inst.metadata.sourceExpression).toBe('~mask');
    });

    it('should handle empty metadata', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILUnaryInstruction(0, ILOpcode.NEG, operand, result);

      expect(inst.metadata).toBeDefined();
      expect(inst.metadata.location).toBeUndefined();
    });

    it('should support m6502 hints metadata', () => {
      const operand = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);
      const metadata = {
        m6502Hints: {
          preferredRegister: 'A' as const,
        },
      };

      const inst = new ILUnaryInstruction(0, ILOpcode.NOT, operand, result, metadata);

      expect(inst.metadata.m6502Hints?.preferredRegister).toBe('A');
    });
  });
});