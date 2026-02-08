/**
 * IL Instructions - Memory Instructions Tests
 *
 * Tests for memory access instructions:
 * - ILLoadVarInstruction: Load a variable's value into a register
 * - ILStoreVarInstruction: Store a register value into a variable
 * - ILLoadArrayInstruction: Load an array element into a register
 * - ILStoreArrayInstruction: Store a value into an array element
 *
 * Memory instructions provide the interface between virtual registers
 * and named storage (variables and arrays).
 *
 * @module il/instructions-memory.test
 */

import { describe, expect, it } from 'vitest';
import {
  ILOpcode,
  ILLoadVarInstruction,
  ILStoreVarInstruction,
  ILLoadArrayInstruction,
  ILStoreArrayInstruction,
} from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
import { IL_BYTE, IL_WORD } from '../../il/types.js';

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
// ILLoadVarInstruction Tests
// =============================================================================

describe('ILLoadVarInstruction', () => {
  describe('construction', () => {
    it('should create LOAD_VAR instruction with variable name', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILLoadVarInstruction(0, 'counter', result);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.LOAD_VAR);
      expect(inst.variableName).toBe('counter');
      expect(inst.result).toBe(result);
    });

    it('should handle various variable names', () => {
      const result = createTestRegister(0, IL_BYTE);

      const inst1 = new ILLoadVarInstruction(0, 'x', result);
      const inst2 = new ILLoadVarInstruction(1, '_private', result);
      const inst3 = new ILLoadVarInstruction(2, 'playerScore', result);

      expect(inst1.variableName).toBe('x');
      expect(inst2.variableName).toBe('_private');
      expect(inst3.variableName).toBe('playerScore');
    });

    it('should store metadata correctly', () => {
      const result = createTestRegister(0, IL_BYTE);
      const metadata = {
        location: { line: 10, column: 5, sourceFile: 'test.bl65' },
        addressingMode: 'ZeroPage',
      };

      const inst = new ILLoadVarInstruction(0, 'counter', result, metadata);

      expect(inst.metadata.location?.line).toBe(10);
      expect(inst.metadata.addressingMode).toBe('ZeroPage');
    });
  });

  describe('getOperands()', () => {
    it('should return empty array (variable name is not a value)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILLoadVarInstruction(0, 'counter', result);

      expect(inst.getOperands()).toHaveLength(0);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return empty array (no used registers)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILLoadVarInstruction(0, 'counter', result);

      expect(inst.getUsedRegisters()).toHaveLength(0);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false (load has no side effects)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILLoadVarInstruction(0, 'counter', result);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (not a terminator)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILLoadVarInstruction(0, 'counter', result);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format LOAD_VAR instruction correctly', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILLoadVarInstruction(0, 'counter', result);

      expect(inst.toString()).toBe('v0 = LOAD_VAR counter');
    });

    it('should include result register name when present', () => {
      const result = createTestRegister(0, IL_BYTE, 'val');
      const inst = new ILLoadVarInstruction(0, 'counter', result);

      expect(inst.toString()).toBe('v0:val = LOAD_VAR counter');
    });
  });
});

// =============================================================================
// ILStoreVarInstruction Tests
// =============================================================================

describe('ILStoreVarInstruction', () => {
  describe('construction', () => {
    it('should create STORE_VAR instruction', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILStoreVarInstruction(0, 'counter', value);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.STORE_VAR);
      expect(inst.variableName).toBe('counter');
      expect(inst.value).toBe(value);
      expect(inst.result).toBeNull();
    });

    it('should store metadata correctly', () => {
      const value = createTestRegister(0, IL_BYTE);
      const metadata = {
        location: { line: 15, column: 3, sourceFile: 'test.bl65' },
      };

      const inst = new ILStoreVarInstruction(0, 'counter', value, metadata);

      expect(inst.metadata.location?.line).toBe(15);
    });
  });

  describe('getOperands()', () => {
    it('should return [value] array', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILStoreVarInstruction(0, 'counter', value);

      const operands = inst.getOperands();
      expect(operands).toHaveLength(1);
      expect(operands[0]).toBe(value);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return [value] register', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILStoreVarInstruction(0, 'counter', value);

      const usedRegs = inst.getUsedRegisters();
      expect(usedRegs).toHaveLength(1);
      expect(usedRegs[0]).toBe(value);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return true (store has side effects)', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILStoreVarInstruction(0, 'counter', value);

      expect(inst.hasSideEffects()).toBe(true);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (not a terminator)', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILStoreVarInstruction(0, 'counter', value);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format STORE_VAR instruction correctly', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILStoreVarInstruction(0, 'counter', value);

      expect(inst.toString()).toBe('STORE_VAR counter, v0');
    });

    it('should include value register name when present', () => {
      const value = createTestRegister(0, IL_BYTE, 'newVal');
      const inst = new ILStoreVarInstruction(0, 'counter', value);

      expect(inst.toString()).toBe('STORE_VAR counter, v0:newVal');
    });
  });
});

// =============================================================================
// ILLoadArrayInstruction Tests
// =============================================================================

describe('ILLoadArrayInstruction', () => {
  describe('construction', () => {
    it('should create LOAD_ARRAY instruction', () => {
      const index = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILLoadArrayInstruction(0, 'buffer', index, result);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.LOAD_ARRAY);
      expect(inst.arrayName).toBe('buffer');
      expect(inst.index).toBe(index);
      expect(inst.result).toBe(result);
    });

    it('should handle word index for large arrays', () => {
      const index = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILLoadArrayInstruction(0, 'largeBuffer', index, result);

      expect(inst.index.type).toBe(IL_WORD);
    });

    it('should store metadata correctly', () => {
      const index = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);
      const metadata = {
        location: { line: 20, column: 8, sourceFile: 'test.bl65' },
      };

      const inst = new ILLoadArrayInstruction(0, 'buffer', index, result, metadata);

      expect(inst.metadata.location?.line).toBe(20);
    });
  });

  describe('getOperands()', () => {
    it('should return [index] array', () => {
      const index = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILLoadArrayInstruction(0, 'buffer', index, result);

      const operands = inst.getOperands();
      expect(operands).toHaveLength(1);
      expect(operands[0]).toBe(index);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return [index] register', () => {
      const index = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILLoadArrayInstruction(0, 'buffer', index, result);

      const usedRegs = inst.getUsedRegisters();
      expect(usedRegs).toHaveLength(1);
      expect(usedRegs[0]).toBe(index);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false (load has no side effects)', () => {
      const index = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILLoadArrayInstruction(0, 'buffer', index, result);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (not a terminator)', () => {
      const index = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILLoadArrayInstruction(0, 'buffer', index, result);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format LOAD_ARRAY instruction correctly', () => {
      const index = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILLoadArrayInstruction(0, 'buffer', index, result);

      expect(inst.toString()).toBe('v1 = LOAD_ARRAY buffer, v0');
    });

    it('should include register names when present', () => {
      const index = createTestRegister(0, IL_BYTE, 'i');
      const result = createTestRegister(1, IL_BYTE, 'elem');
      const inst = new ILLoadArrayInstruction(0, 'buffer', index, result);

      expect(inst.toString()).toBe('v1:elem = LOAD_ARRAY buffer, v0:i');
    });
  });
});

// =============================================================================
// ILStoreArrayInstruction Tests
// =============================================================================

describe('ILStoreArrayInstruction', () => {
  describe('construction', () => {
    it('should create STORE_ARRAY instruction', () => {
      const index = createTestRegister(0, IL_BYTE);
      const value = createTestRegister(1, IL_BYTE);
      const inst = new ILStoreArrayInstruction(0, 'buffer', index, value);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.STORE_ARRAY);
      expect(inst.arrayName).toBe('buffer');
      expect(inst.index).toBe(index);
      expect(inst.value).toBe(value);
      expect(inst.result).toBeNull();
    });

    it('should store metadata correctly', () => {
      const index = createTestRegister(0, IL_BYTE);
      const value = createTestRegister(1, IL_BYTE);
      const metadata = {
        location: { line: 25, column: 3, sourceFile: 'test.bl65' },
      };

      const inst = new ILStoreArrayInstruction(0, 'buffer', index, value, metadata);

      expect(inst.metadata.location?.line).toBe(25);
    });
  });

  describe('getOperands()', () => {
    it('should return [index, value] array', () => {
      const index = createTestRegister(0, IL_BYTE);
      const value = createTestRegister(1, IL_BYTE);
      const inst = new ILStoreArrayInstruction(0, 'buffer', index, value);

      const operands = inst.getOperands();
      expect(operands).toHaveLength(2);
      expect(operands[0]).toBe(index);
      expect(operands[1]).toBe(value);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return [index, value] registers', () => {
      const index = createTestRegister(0, IL_BYTE);
      const value = createTestRegister(1, IL_BYTE);
      const inst = new ILStoreArrayInstruction(0, 'buffer', index, value);

      const usedRegs = inst.getUsedRegisters();
      expect(usedRegs).toHaveLength(2);
      expect(usedRegs[0]).toBe(index);
      expect(usedRegs[1]).toBe(value);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return true (store has side effects)', () => {
      const index = createTestRegister(0, IL_BYTE);
      const value = createTestRegister(1, IL_BYTE);
      const inst = new ILStoreArrayInstruction(0, 'buffer', index, value);

      expect(inst.hasSideEffects()).toBe(true);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (not a terminator)', () => {
      const index = createTestRegister(0, IL_BYTE);
      const value = createTestRegister(1, IL_BYTE);
      const inst = new ILStoreArrayInstruction(0, 'buffer', index, value);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format STORE_ARRAY instruction correctly', () => {
      const index = createTestRegister(0, IL_BYTE);
      const value = createTestRegister(1, IL_BYTE);
      const inst = new ILStoreArrayInstruction(0, 'buffer', index, value);

      expect(inst.toString()).toBe('STORE_ARRAY buffer, v0, v1');
    });

    it('should include register names when present', () => {
      const index = createTestRegister(0, IL_BYTE, 'i');
      const value = createTestRegister(1, IL_BYTE, 'newVal');
      const inst = new ILStoreArrayInstruction(0, 'buffer', index, value);

      expect(inst.toString()).toBe('STORE_ARRAY buffer, v0:i, v1:newVal');
    });
  });
});

// =============================================================================
// Memory Instructions - Side Effects Comparison
// =============================================================================

describe('Memory Instructions - Side Effects', () => {
  it('load instructions should have no side effects', () => {
    const result = createTestRegister(0, IL_BYTE);
    const index = createTestRegister(1, IL_BYTE);

    const loadVar = new ILLoadVarInstruction(0, 'x', result);
    const loadArray = new ILLoadArrayInstruction(1, 'arr', index, result);

    expect(loadVar.hasSideEffects()).toBe(false);
    expect(loadArray.hasSideEffects()).toBe(false);
  });

  it('store instructions should have side effects', () => {
    const value = createTestRegister(0, IL_BYTE);
    const index = createTestRegister(1, IL_BYTE);

    const storeVar = new ILStoreVarInstruction(0, 'x', value);
    const storeArray = new ILStoreArrayInstruction(1, 'arr', index, value);

    expect(storeVar.hasSideEffects()).toBe(true);
    expect(storeArray.hasSideEffects()).toBe(true);
  });

  it('no memory instructions should be terminators', () => {
    const result = createTestRegister(0, IL_BYTE);
    const value = createTestRegister(1, IL_BYTE);
    const index = createTestRegister(2, IL_BYTE);

    const loadVar = new ILLoadVarInstruction(0, 'x', result);
    const storeVar = new ILStoreVarInstruction(1, 'x', value);
    const loadArray = new ILLoadArrayInstruction(2, 'arr', index, result);
    const storeArray = new ILStoreArrayInstruction(3, 'arr', index, value);

    expect(loadVar.isTerminator()).toBe(false);
    expect(storeVar.isTerminator()).toBe(false);
    expect(loadArray.isTerminator()).toBe(false);
    expect(storeArray.isTerminator()).toBe(false);
  });
});