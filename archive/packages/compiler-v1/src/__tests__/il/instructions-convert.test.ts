/**
 * IL Instructions - Type Conversion Instructions Tests
 *
 * Tests for type conversion instructions:
 * - ZERO_EXTEND: Extend byte to word (zero-fill high byte)
 * - TRUNCATE: Truncate word to byte (take low byte)
 * - BOOL_TO_BYTE: Convert bool to byte (0 or 1)
 * - BYTE_TO_BOOL: Convert byte to bool (0 = false, else true)
 *
 * Type conversion instructions convert values between IL types.
 * Format: result = OPCODE source
 *
 * @module il/instructions-convert.test
 */

import { describe, expect, it } from 'vitest';
import { ILOpcode, ILConvertInstruction } from '../../il/instructions.js';
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
// ILConvertInstruction Tests - ZERO_EXTEND
// =============================================================================

describe('ILConvertInstruction - ZERO_EXTEND', () => {
  describe('construction', () => {
    it('should create ZERO_EXTEND instruction (byte → word)', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);

      const inst = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.ZERO_EXTEND);
      expect(inst.source).toBe(source);
      expect(inst.source.type).toBe(IL_BYTE);
      expect(inst.targetType).toBe(IL_WORD);
      expect(inst.result).toBe(result);
      expect(inst.result?.type).toBe(IL_WORD);
    });

    it('should store metadata correctly', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);
      const metadata = {
        location: { line: 5, column: 10, sourceFile: 'test.bl65' },
        coercion: {
          kind: 'extend',
          sourceType: IL_BYTE,
          targetType: IL_WORD,
        },
      };

      const inst = new ILConvertInstruction(
        0,
        ILOpcode.ZERO_EXTEND,
        source,
        IL_WORD,
        result,
        metadata,
      );

      expect(inst.metadata.coercion?.kind).toBe('extend');
      expect(inst.metadata.coercion?.sourceType).toBe(IL_BYTE);
      expect(inst.metadata.coercion?.targetType).toBe(IL_WORD);
    });
  });

  describe('toString()', () => {
    it('should format ZERO_EXTEND instruction correctly', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);

      const inst = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);

      expect(inst.toString()).toBe('v1 = ZERO_EXTEND v0');
    });

    it('should include register names when present', () => {
      const source = createTestRegister(0, IL_BYTE, 'counter');
      const result = createTestRegister(1, IL_WORD, 'extended');

      const inst = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);

      expect(inst.toString()).toBe('v1:extended = ZERO_EXTEND v0:counter');
    });
  });
});

// =============================================================================
// ILConvertInstruction Tests - TRUNCATE
// =============================================================================

describe('ILConvertInstruction - TRUNCATE', () => {
  describe('construction', () => {
    it('should create TRUNCATE instruction (word → byte)', () => {
      const source = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILConvertInstruction(0, ILOpcode.TRUNCATE, source, IL_BYTE, result);

      expect(inst.opcode).toBe(ILOpcode.TRUNCATE);
      expect(inst.source.type).toBe(IL_WORD);
      expect(inst.targetType).toBe(IL_BYTE);
      expect(inst.result?.type).toBe(IL_BYTE);
    });
  });

  describe('toString()', () => {
    it('should format TRUNCATE instruction correctly', () => {
      const source = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILConvertInstruction(0, ILOpcode.TRUNCATE, source, IL_BYTE, result);

      expect(inst.toString()).toBe('v1 = TRUNCATE v0');
    });
  });
});

// =============================================================================
// ILConvertInstruction Tests - BOOL_TO_BYTE
// =============================================================================

describe('ILConvertInstruction - BOOL_TO_BYTE', () => {
  describe('construction', () => {
    it('should create BOOL_TO_BYTE instruction', () => {
      const source = createTestRegister(0, IL_BOOL);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILConvertInstruction(0, ILOpcode.BOOL_TO_BYTE, source, IL_BYTE, result);

      expect(inst.opcode).toBe(ILOpcode.BOOL_TO_BYTE);
      expect(inst.source.type).toBe(IL_BOOL);
      expect(inst.targetType).toBe(IL_BYTE);
      expect(inst.result?.type).toBe(IL_BYTE);
    });
  });

  describe('toString()', () => {
    it('should format BOOL_TO_BYTE instruction correctly', () => {
      const source = createTestRegister(0, IL_BOOL);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILConvertInstruction(0, ILOpcode.BOOL_TO_BYTE, source, IL_BYTE, result);

      expect(inst.toString()).toBe('v1 = BOOL_TO_BYTE v0');
    });
  });
});

// =============================================================================
// ILConvertInstruction Tests - BYTE_TO_BOOL
// =============================================================================

describe('ILConvertInstruction - BYTE_TO_BOOL', () => {
  describe('construction', () => {
    it('should create BYTE_TO_BOOL instruction', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BOOL);

      const inst = new ILConvertInstruction(0, ILOpcode.BYTE_TO_BOOL, source, IL_BOOL, result);

      expect(inst.opcode).toBe(ILOpcode.BYTE_TO_BOOL);
      expect(inst.source.type).toBe(IL_BYTE);
      expect(inst.targetType).toBe(IL_BOOL);
      expect(inst.result?.type).toBe(IL_BOOL);
    });
  });

  describe('toString()', () => {
    it('should format BYTE_TO_BOOL instruction correctly', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BOOL);

      const inst = new ILConvertInstruction(0, ILOpcode.BYTE_TO_BOOL, source, IL_BOOL, result);

      expect(inst.toString()).toBe('v1 = BYTE_TO_BOOL v0');
    });
  });
});

// =============================================================================
// ILConvertInstruction Tests - Common Methods
// =============================================================================

describe('ILConvertInstruction - Methods', () => {
  describe('getOperands()', () => {
    it('should return [source] array', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);

      const inst = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);
      const operands = inst.getOperands();

      expect(operands).toHaveLength(1);
      expect(operands[0]).toBe(source);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return [source] register', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);

      const inst = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);
      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).toHaveLength(1);
      expect(usedRegs[0]).toBe(source);
    });

    it('should not include result register in used registers', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);

      const inst = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);
      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).not.toContain(result);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false for ZERO_EXTEND', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);

      const inst = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);

      expect(inst.hasSideEffects()).toBe(false);
    });

    it('should return false for TRUNCATE', () => {
      const source = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILConvertInstruction(0, ILOpcode.TRUNCATE, source, IL_BYTE, result);

      expect(inst.hasSideEffects()).toBe(false);
    });

    it('should return false for BOOL_TO_BYTE', () => {
      const source = createTestRegister(0, IL_BOOL);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILConvertInstruction(0, ILOpcode.BOOL_TO_BYTE, source, IL_BYTE, result);

      expect(inst.hasSideEffects()).toBe(false);
    });

    it('should return false for BYTE_TO_BOOL', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BOOL);

      const inst = new ILConvertInstruction(0, ILOpcode.BYTE_TO_BOOL, source, IL_BOOL, result);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (convert instructions are not terminators)', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);

      const zeroExt = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);
      const trunc = new ILConvertInstruction(
        1,
        ILOpcode.TRUNCATE,
        createTestRegister(0, IL_WORD),
        IL_BYTE,
        createTestRegister(1, IL_BYTE),
      );
      const boolToByte = new ILConvertInstruction(
        2,
        ILOpcode.BOOL_TO_BYTE,
        createTestRegister(0, IL_BOOL),
        IL_BYTE,
        createTestRegister(1, IL_BYTE),
      );
      const byteToBool = new ILConvertInstruction(
        3,
        ILOpcode.BYTE_TO_BOOL,
        createTestRegister(0, IL_BYTE),
        IL_BOOL,
        createTestRegister(1, IL_BOOL),
      );

      expect(zeroExt.isTerminator()).toBe(false);
      expect(trunc.isTerminator()).toBe(false);
      expect(boolToByte.isTerminator()).toBe(false);
      expect(byteToBool.isTerminator()).toBe(false);
    });
  });

  describe('source register access', () => {
    it('should provide source register access', () => {
      const source = createTestRegister(0, IL_BYTE, 'val');
      const result = createTestRegister(1, IL_WORD);

      const inst = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);

      expect(inst.source).toBe(source);
      expect(inst.source.id).toBe(0);
      expect(inst.source.name).toBe('val');
      expect(inst.source.type).toBe(IL_BYTE);
    });
  });

  describe('target type access', () => {
    it('should provide target type access', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);

      const inst = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);

      expect(inst.targetType).toBe(IL_WORD);
    });

    it('should have correct target type for TRUNCATE', () => {
      const source = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILConvertInstruction(0, ILOpcode.TRUNCATE, source, IL_BYTE, result);

      expect(inst.targetType).toBe(IL_BYTE);
    });

    it('should have correct target type for BOOL_TO_BYTE', () => {
      const source = createTestRegister(0, IL_BOOL);
      const result = createTestRegister(1, IL_BYTE);

      const inst = new ILConvertInstruction(0, ILOpcode.BOOL_TO_BYTE, source, IL_BYTE, result);

      expect(inst.targetType).toBe(IL_BYTE);
    });

    it('should have correct target type for BYTE_TO_BOOL', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BOOL);

      const inst = new ILConvertInstruction(0, ILOpcode.BYTE_TO_BOOL, source, IL_BOOL, result);

      expect(inst.targetType).toBe(IL_BOOL);
    });
  });

  describe('result register access', () => {
    it('should provide result register access', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD, 'extended');

      const inst = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);

      expect(inst.result).toBe(result);
      expect(inst.result?.id).toBe(1);
      expect(inst.result?.name).toBe('extended');
      expect(inst.result?.type).toBe(IL_WORD);
    });
  });

  describe('instruction ID', () => {
    it('should store instruction ID correctly', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);

      const inst = new ILConvertInstruction(99, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);

      expect(inst.id).toBe(99);
    });
  });

  describe('metadata', () => {
    it('should store coercion metadata', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);
      const metadata = {
        coercion: {
          kind: 'implicit',
          sourceType: IL_BYTE,
          targetType: IL_WORD,
        },
      };

      const inst = new ILConvertInstruction(
        0,
        ILOpcode.ZERO_EXTEND,
        source,
        IL_WORD,
        result,
        metadata,
      );

      expect(inst.metadata.coercion?.kind).toBe('implicit');
    });

    it('should handle empty metadata', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);

      const inst = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, source, IL_WORD, result);

      expect(inst.metadata).toBeDefined();
      expect(inst.metadata.coercion).toBeUndefined();
    });

    it('should store source location metadata', () => {
      const source = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_WORD);
      const metadata = {
        location: { line: 25, column: 12, sourceFile: 'test.bl65' },
      };

      const inst = new ILConvertInstruction(
        0,
        ILOpcode.ZERO_EXTEND,
        source,
        IL_WORD,
        result,
        metadata,
      );

      expect(inst.metadata.location?.line).toBe(25);
      expect(inst.metadata.location?.column).toBe(12);
    });
  });
});