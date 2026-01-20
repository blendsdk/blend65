/**
 * IL Instructions - Binary Instructions Tests
 *
 * Tests for binary (two-operand) instructions:
 * - Arithmetic: ADD, SUB, MUL, DIV, MOD
 * - Bitwise: AND, OR, XOR, SHL, SHR
 * - Comparison: CMP_EQ, CMP_NE, CMP_LT, CMP_LE, CMP_GT, CMP_GE
 *
 * Binary instructions take two operand registers and produce one result register.
 * Format: result = OPCODE left, right
 *
 * @module il/instructions-binary.test
 */

import { describe, expect, it } from 'vitest';
import { ILOpcode, ILBinaryInstruction } from '../../il/instructions.js';
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
// ILBinaryInstruction Tests - Arithmetic Operations
// =============================================================================

describe('ILBinaryInstruction - Arithmetic', () => {
  describe('ADD instruction', () => {
    it('should create ADD instruction with byte operands', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.ADD);
      expect(inst.left).toBe(left);
      expect(inst.right).toBe(right);
      expect(inst.result).toBe(result);
    });

    it('should create ADD instruction with word operands', () => {
      const left = createTestRegister(0, IL_WORD);
      const right = createTestRegister(1, IL_WORD);
      const result = createTestRegister(2, IL_WORD);

      const inst = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);

      expect(inst.left.type).toBe(IL_WORD);
      expect(inst.right.type).toBe(IL_WORD);
      expect(inst.result?.type).toBe(IL_WORD);
    });
  });

  describe('SUB instruction', () => {
    it('should create SUB instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.SUB, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.SUB);
      expect(inst.left).toBe(left);
      expect(inst.right).toBe(right);
    });
  });

  describe('MUL instruction', () => {
    it('should create MUL instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.MUL, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.MUL);
    });
  });

  describe('DIV instruction', () => {
    it('should create DIV instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.DIV, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.DIV);
    });
  });

  describe('MOD instruction', () => {
    it('should create MOD instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.MOD, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.MOD);
    });
  });
});

// =============================================================================
// ILBinaryInstruction Tests - Bitwise Operations
// =============================================================================

describe('ILBinaryInstruction - Bitwise', () => {
  describe('AND instruction', () => {
    it('should create AND instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.AND, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.AND);
      expect(inst.left).toBe(left);
      expect(inst.right).toBe(right);
    });
  });

  describe('OR instruction', () => {
    it('should create OR instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.OR, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.OR);
    });
  });

  describe('XOR instruction', () => {
    it('should create XOR instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.XOR, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.XOR);
    });
  });

  describe('SHL instruction', () => {
    it('should create SHL (shift left) instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.SHL, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.SHL);
    });
  });

  describe('SHR instruction', () => {
    it('should create SHR (shift right) instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.SHR, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.SHR);
    });
  });
});

// =============================================================================
// ILBinaryInstruction Tests - Comparison Operations
// =============================================================================

describe('ILBinaryInstruction - Comparison', () => {
  describe('CMP_EQ instruction', () => {
    it('should create CMP_EQ instruction with bool result', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BOOL);

      const inst = new ILBinaryInstruction(0, ILOpcode.CMP_EQ, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.CMP_EQ);
      expect(inst.result?.type).toBe(IL_BOOL);
    });
  });

  describe('CMP_NE instruction', () => {
    it('should create CMP_NE instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BOOL);

      const inst = new ILBinaryInstruction(0, ILOpcode.CMP_NE, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.CMP_NE);
    });
  });

  describe('CMP_LT instruction', () => {
    it('should create CMP_LT instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BOOL);

      const inst = new ILBinaryInstruction(0, ILOpcode.CMP_LT, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.CMP_LT);
    });
  });

  describe('CMP_LE instruction', () => {
    it('should create CMP_LE instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BOOL);

      const inst = new ILBinaryInstruction(0, ILOpcode.CMP_LE, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.CMP_LE);
    });
  });

  describe('CMP_GT instruction', () => {
    it('should create CMP_GT instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BOOL);

      const inst = new ILBinaryInstruction(0, ILOpcode.CMP_GT, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.CMP_GT);
    });
  });

  describe('CMP_GE instruction', () => {
    it('should create CMP_GE instruction', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BOOL);

      const inst = new ILBinaryInstruction(0, ILOpcode.CMP_GE, left, right, result);

      expect(inst.opcode).toBe(ILOpcode.CMP_GE);
    });
  });
});

// =============================================================================
// ILBinaryInstruction Tests - Common Methods
// =============================================================================

describe('ILBinaryInstruction - Methods', () => {
  describe('getOperands()', () => {
    it('should return [left, right] operands', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);
      const operands = inst.getOperands();

      expect(operands).toHaveLength(2);
      expect(operands[0]).toBe(left);
      expect(operands[1]).toBe(right);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return [left, right] registers', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);
      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).toHaveLength(2);
      expect(usedRegs[0]).toBe(left);
      expect(usedRegs[1]).toBe(right);
    });

    it('should not include result register in used registers', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);
      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).not.toContain(result);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false for arithmetic operations', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const add = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);
      const sub = new ILBinaryInstruction(1, ILOpcode.SUB, left, right, result);
      const mul = new ILBinaryInstruction(2, ILOpcode.MUL, left, right, result);
      const div = new ILBinaryInstruction(3, ILOpcode.DIV, left, right, result);
      const mod = new ILBinaryInstruction(4, ILOpcode.MOD, left, right, result);

      expect(add.hasSideEffects()).toBe(false);
      expect(sub.hasSideEffects()).toBe(false);
      expect(mul.hasSideEffects()).toBe(false);
      expect(div.hasSideEffects()).toBe(false);
      expect(mod.hasSideEffects()).toBe(false);
    });

    it('should return false for bitwise operations', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const and = new ILBinaryInstruction(0, ILOpcode.AND, left, right, result);
      const or = new ILBinaryInstruction(1, ILOpcode.OR, left, right, result);
      const xor = new ILBinaryInstruction(2, ILOpcode.XOR, left, right, result);
      const shl = new ILBinaryInstruction(3, ILOpcode.SHL, left, right, result);
      const shr = new ILBinaryInstruction(4, ILOpcode.SHR, left, right, result);

      expect(and.hasSideEffects()).toBe(false);
      expect(or.hasSideEffects()).toBe(false);
      expect(xor.hasSideEffects()).toBe(false);
      expect(shl.hasSideEffects()).toBe(false);
      expect(shr.hasSideEffects()).toBe(false);
    });

    it('should return false for comparison operations', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BOOL);

      const eq = new ILBinaryInstruction(0, ILOpcode.CMP_EQ, left, right, result);
      const ne = new ILBinaryInstruction(1, ILOpcode.CMP_NE, left, right, result);
      const lt = new ILBinaryInstruction(2, ILOpcode.CMP_LT, left, right, result);
      const le = new ILBinaryInstruction(3, ILOpcode.CMP_LE, left, right, result);
      const gt = new ILBinaryInstruction(4, ILOpcode.CMP_GT, left, right, result);
      const ge = new ILBinaryInstruction(5, ILOpcode.CMP_GE, left, right, result);

      expect(eq.hasSideEffects()).toBe(false);
      expect(ne.hasSideEffects()).toBe(false);
      expect(lt.hasSideEffects()).toBe(false);
      expect(le.hasSideEffects()).toBe(false);
      expect(gt.hasSideEffects()).toBe(false);
      expect(ge.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (binary instructions are not terminators)', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const add = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);
      const cmp = new ILBinaryInstruction(1, ILOpcode.CMP_EQ, left, right, result);

      expect(add.isTerminator()).toBe(false);
      expect(cmp.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format arithmetic instruction correctly', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);

      expect(inst.toString()).toBe('v2 = ADD v0, v1');
    });

    it('should format comparison instruction correctly', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BOOL);

      const inst = new ILBinaryInstruction(0, ILOpcode.CMP_LT, left, right, result);

      expect(inst.toString()).toBe('v2 = CMP_LT v0, v1');
    });

    it('should include register names when present', () => {
      const left = createTestRegister(0, IL_BYTE, 'x');
      const right = createTestRegister(1, IL_BYTE, 'y');
      const result = createTestRegister(2, IL_BYTE, 'sum');

      const inst = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);

      expect(inst.toString()).toBe('v2:sum = ADD v0:x, v1:y');
    });

    it('should format all arithmetic operations', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      expect(new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result).toString())
        .toContain('ADD');
      expect(new ILBinaryInstruction(0, ILOpcode.SUB, left, right, result).toString())
        .toContain('SUB');
      expect(new ILBinaryInstruction(0, ILOpcode.MUL, left, right, result).toString())
        .toContain('MUL');
      expect(new ILBinaryInstruction(0, ILOpcode.DIV, left, right, result).toString())
        .toContain('DIV');
      expect(new ILBinaryInstruction(0, ILOpcode.MOD, left, right, result).toString())
        .toContain('MOD');
    });

    it('should format all bitwise operations', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      expect(new ILBinaryInstruction(0, ILOpcode.AND, left, right, result).toString())
        .toContain('AND');
      expect(new ILBinaryInstruction(0, ILOpcode.OR, left, right, result).toString())
        .toContain('OR');
      expect(new ILBinaryInstruction(0, ILOpcode.XOR, left, right, result).toString())
        .toContain('XOR');
      expect(new ILBinaryInstruction(0, ILOpcode.SHL, left, right, result).toString())
        .toContain('SHL');
      expect(new ILBinaryInstruction(0, ILOpcode.SHR, left, right, result).toString())
        .toContain('SHR');
    });
  });

  describe('operand access', () => {
    it('should provide left operand access', () => {
      const left = createTestRegister(0, IL_BYTE, 'a');
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);

      expect(inst.left).toBe(left);
      expect(inst.left.id).toBe(0);
      expect(inst.left.name).toBe('a');
    });

    it('should provide right operand access', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE, 'b');
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);

      expect(inst.right).toBe(right);
      expect(inst.right.id).toBe(1);
      expect(inst.right.name).toBe('b');
    });

    it('should provide result register access', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE, 'sum');

      const inst = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);

      expect(inst.result).toBe(result);
      expect(inst.result?.id).toBe(2);
      expect(inst.result?.name).toBe('sum');
    });
  });

  describe('metadata', () => {
    it('should store source location metadata', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const metadata = {
        location: { line: 15, column: 10, sourceFile: 'test.bl65' },
        sourceExpression: 'a + b',
      };

      const inst = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result, metadata);

      expect(inst.metadata.location?.line).toBe(15);
      expect(inst.metadata.location?.column).toBe(10);
      expect(inst.metadata.sourceExpression).toBe('a + b');
    });

    it('should handle empty metadata', () => {
      const left = createTestRegister(0, IL_BYTE);
      const right = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      const inst = new ILBinaryInstruction(0, ILOpcode.ADD, left, right, result);

      expect(inst.metadata).toBeDefined();
      expect(inst.metadata.location).toBeUndefined();
    });
  });
});