/**
 * IL Instructions - Constant Instructions Tests
 *
 * Tests for constant and undefined value instructions:
 * - ILConstInstruction: Loads a constant value into a register
 * - ILUndefInstruction: Creates an undefined/uninitialized value
 *
 * These instructions form the foundation for value creation in IL.
 *
 * @module il/instructions-const.test
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  ILOpcode,
  ILConstInstruction,
  ILUndefInstruction,
} from '../../il/instructions.js';
import { VirtualRegister, ILValueFactory } from '../../il/values.js';
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
// ILConstInstruction Tests
// =============================================================================

describe('ILConstInstruction', () => {
  describe('construction', () => {
    it('should create const instruction with byte value 0', () => {
      const result = createTestRegister(0, IL_BYTE, 'v0');
      const inst = new ILConstInstruction(0, 0, IL_BYTE, result);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.CONST);
      expect(inst.value).toBe(0);
      expect(inst.type).toBe(IL_BYTE);
      expect(inst.result).toBe(result);
    });

    it('should create const instruction with byte value 255 (max byte)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILConstInstruction(0, 255, IL_BYTE, result);

      expect(inst.value).toBe(255);
      expect(inst.type).toBe(IL_BYTE);
    });

    it('should create const instruction with word value 0', () => {
      const result = createTestRegister(0, IL_WORD);
      const inst = new ILConstInstruction(0, 0, IL_WORD, result);

      expect(inst.value).toBe(0);
      expect(inst.type).toBe(IL_WORD);
    });

    it('should create const instruction with word value 65535 (max word)', () => {
      const result = createTestRegister(0, IL_WORD);
      const inst = new ILConstInstruction(0, 65535, IL_WORD, result);

      expect(inst.value).toBe(65535);
      expect(inst.type).toBe(IL_WORD);
    });

    it('should create const instruction with hex value (hardware address)', () => {
      const result = createTestRegister(0, IL_WORD);
      // 0xD020 is VIC-II border color register
      const inst = new ILConstInstruction(0, 0xd020, IL_WORD, result);

      expect(inst.value).toBe(0xd020);
      expect(inst.type).toBe(IL_WORD);
    });

    it('should create const instruction with bool value true (1)', () => {
      const result = createTestRegister(0, IL_BOOL);
      const inst = new ILConstInstruction(0, 1, IL_BOOL, result);

      expect(inst.value).toBe(1);
      expect(inst.type).toBe(IL_BOOL);
    });

    it('should create const instruction with bool value false (0)', () => {
      const result = createTestRegister(0, IL_BOOL);
      const inst = new ILConstInstruction(0, 0, IL_BOOL, result);

      expect(inst.value).toBe(0);
      expect(inst.type).toBe(IL_BOOL);
    });

    it('should store metadata correctly', () => {
      const result = createTestRegister(0, IL_BYTE);
      const metadata = {
        location: { line: 10, column: 5, sourceFile: 'test.bl65' },
        sourceExpression: '42',
      };
      const inst = new ILConstInstruction(0, 42, IL_BYTE, result, metadata);

      expect(inst.metadata).toBe(metadata);
      expect(inst.metadata.location?.line).toBe(10);
      expect(inst.metadata.sourceExpression).toBe('42');
    });

    it('should handle instruction ID correctly', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILConstInstruction(42, 100, IL_BYTE, result);

      expect(inst.id).toBe(42);
    });
  });

  describe('getOperands()', () => {
    it('should return empty array (no operands)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILConstInstruction(0, 42, IL_BYTE, result);

      const operands = inst.getOperands();

      expect(operands).toEqual([]);
      expect(operands.length).toBe(0);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return empty array (no used registers)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILConstInstruction(0, 42, IL_BYTE, result);

      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).toEqual([]);
      expect(usedRegs.length).toBe(0);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false (no side effects)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILConstInstruction(0, 42, IL_BYTE, result);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (not a terminator)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILConstInstruction(0, 42, IL_BYTE, result);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format small byte values as decimal', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILConstInstruction(0, 42, IL_BYTE, result);

      expect(inst.toString()).toBe('v0 = CONST 42');
    });

    it('should format zero correctly', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILConstInstruction(0, 0, IL_BYTE, result);

      expect(inst.toString()).toBe('v0 = CONST 0');
    });

    it('should format 255 (max byte) as decimal', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILConstInstruction(0, 255, IL_BYTE, result);

      expect(inst.toString()).toBe('v0 = CONST 255');
    });

    it('should format values >= 256 as hex', () => {
      const result = createTestRegister(0, IL_WORD);
      const inst = new ILConstInstruction(0, 256, IL_WORD, result);

      expect(inst.toString()).toBe('v0 = CONST $100');
    });

    it('should format hardware addresses as hex', () => {
      const result = createTestRegister(0, IL_WORD);
      const inst = new ILConstInstruction(0, 0xd020, IL_WORD, result);

      expect(inst.toString()).toBe('v0 = CONST $D020');
    });

    it('should format max word value as hex', () => {
      const result = createTestRegister(0, IL_WORD);
      const inst = new ILConstInstruction(0, 65535, IL_WORD, result);

      expect(inst.toString()).toBe('v0 = CONST $FFFF');
    });

    it('should include register name when present', () => {
      const result = createTestRegister(5, IL_BYTE, 'counter');
      const inst = new ILConstInstruction(0, 42, IL_BYTE, result);

      expect(inst.toString()).toBe('v5:counter = CONST 42');
    });
  });

  describe('result register', () => {
    it('should have correct result register', () => {
      const result = createTestRegister(3, IL_WORD, 'addr');
      const inst = new ILConstInstruction(0, 0x1000, IL_WORD, result);

      expect(inst.result).toBe(result);
      expect(inst.result?.id).toBe(3);
      expect(inst.result?.type).toBe(IL_WORD);
      expect(inst.result?.name).toBe('addr');
    });
  });
});

// =============================================================================
// ILUndefInstruction Tests
// =============================================================================

describe('ILUndefInstruction', () => {
  describe('construction', () => {
    it('should create undef instruction with byte type', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILUndefInstruction(0, IL_BYTE, result);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.UNDEF);
      expect(inst.type).toBe(IL_BYTE);
      expect(inst.result).toBe(result);
    });

    it('should create undef instruction with word type', () => {
      const result = createTestRegister(0, IL_WORD);
      const inst = new ILUndefInstruction(0, IL_WORD, result);

      expect(inst.type).toBe(IL_WORD);
    });

    it('should create undef instruction with bool type', () => {
      const result = createTestRegister(0, IL_BOOL);
      const inst = new ILUndefInstruction(0, IL_BOOL, result);

      expect(inst.type).toBe(IL_BOOL);
    });

    it('should store metadata correctly', () => {
      const result = createTestRegister(0, IL_BYTE);
      const metadata = {
        location: { line: 5, column: 3, sourceFile: 'test.bl65' },
        sourceExpression: 'let x: byte',
      };
      const inst = new ILUndefInstruction(0, IL_BYTE, result, metadata);

      expect(inst.metadata).toBe(metadata);
      expect(inst.metadata.sourceExpression).toBe('let x: byte');
    });

    it('should handle instruction ID correctly', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILUndefInstruction(99, IL_BYTE, result);

      expect(inst.id).toBe(99);
    });
  });

  describe('getOperands()', () => {
    it('should return empty array (no operands)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILUndefInstruction(0, IL_BYTE, result);

      const operands = inst.getOperands();

      expect(operands).toEqual([]);
      expect(operands.length).toBe(0);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return empty array (no used registers)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILUndefInstruction(0, IL_BYTE, result);

      const usedRegs = inst.getUsedRegisters();

      expect(usedRegs).toEqual([]);
      expect(usedRegs.length).toBe(0);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false (no side effects)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILUndefInstruction(0, IL_BYTE, result);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (not a terminator)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILUndefInstruction(0, IL_BYTE, result);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format as UNDEF', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILUndefInstruction(0, IL_BYTE, result);

      expect(inst.toString()).toBe('v0 = UNDEF');
    });

    it('should include register name when present', () => {
      const result = createTestRegister(3, IL_WORD, 'uninit');
      const inst = new ILUndefInstruction(0, IL_WORD, result);

      expect(inst.toString()).toBe('v3:uninit = UNDEF');
    });
  });

  describe('result register', () => {
    it('should have correct result register', () => {
      const result = createTestRegister(5, IL_BYTE, 'temp');
      const inst = new ILUndefInstruction(0, IL_BYTE, result);

      expect(inst.result).toBe(result);
      expect(inst.result?.id).toBe(5);
      expect(inst.result?.type).toBe(IL_BYTE);
      expect(inst.result?.name).toBe('temp');
    });
  });
});