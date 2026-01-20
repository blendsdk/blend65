/**
 * IL Instructions - Call Instructions Tests
 *
 * Tests for function call instructions:
 * - ILCallInstruction: Call function and capture return value
 * - ILCallVoidInstruction: Call function without return value
 *
 * Call instructions have side effects because they may modify global state.
 *
 * @module il/instructions-call.test
 */

import { describe, expect, it } from 'vitest';
import { ILOpcode, ILCallInstruction, ILCallVoidInstruction } from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
import { IL_BYTE, IL_WORD } from '../../il/types.js';

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
// ILCallInstruction Tests
// =============================================================================

describe('ILCallInstruction', () => {
  describe('construction', () => {
    it('should create CALL instruction with no arguments', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILCallInstruction(0, 'getRandom', [], result);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.CALL);
      expect(inst.functionName).toBe('getRandom');
      expect(inst.args).toHaveLength(0);
      expect(inst.result).toBe(result);
    });

    it('should create CALL instruction with single argument', () => {
      const arg = createTestRegister(0, IL_BYTE, 'x');
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILCallInstruction(0, 'increment', [arg], result);

      expect(inst.functionName).toBe('increment');
      expect(inst.args).toHaveLength(1);
      expect(inst.args[0]).toBe(arg);
    });

    it('should create CALL instruction with multiple arguments', () => {
      const arg1 = createTestRegister(0, IL_BYTE);
      const arg2 = createTestRegister(1, IL_BYTE);
      const arg3 = createTestRegister(2, IL_BYTE);
      const result = createTestRegister(3, IL_BYTE);
      const inst = new ILCallInstruction(0, 'add3', [arg1, arg2, arg3], result);

      expect(inst.args).toHaveLength(3);
      expect(inst.args[0]).toBe(arg1);
      expect(inst.args[1]).toBe(arg2);
      expect(inst.args[2]).toBe(arg3);
    });

    it('should store metadata correctly', () => {
      const result = createTestRegister(0, IL_BYTE);
      const metadata = {
        location: { line: 10, column: 5, sourceFile: 'test.bl65' },
      };
      const inst = new ILCallInstruction(0, 'func', [], result, metadata);

      expect(inst.metadata.location?.line).toBe(10);
    });
  });

  describe('getOperands()', () => {
    it('should return all arguments', () => {
      const arg1 = createTestRegister(0, IL_BYTE);
      const arg2 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const inst = new ILCallInstruction(0, 'add', [arg1, arg2], result);

      const operands = inst.getOperands();
      expect(operands).toHaveLength(2);
      expect(operands[0]).toBe(arg1);
      expect(operands[1]).toBe(arg2);
    });

    it('should return empty array for no-arg call', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILCallInstruction(0, 'getTime', [], result);

      expect(inst.getOperands()).toHaveLength(0);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return all argument registers', () => {
      const arg1 = createTestRegister(0, IL_BYTE);
      const arg2 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const inst = new ILCallInstruction(0, 'add', [arg1, arg2], result);

      const usedRegs = inst.getUsedRegisters();
      expect(usedRegs).toHaveLength(2);
      expect(usedRegs).toContain(arg1);
      expect(usedRegs).toContain(arg2);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return true (calls have side effects)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILCallInstruction(0, 'getTime', [], result);

      expect(inst.hasSideEffects()).toBe(true);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (calls are not terminators)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILCallInstruction(0, 'getTime', [], result);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format CALL with no args correctly', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILCallInstruction(0, 'getTime', [], result);

      expect(inst.toString()).toBe('v0 = CALL getTime, []');
    });

    it('should format CALL with single arg correctly', () => {
      const arg = createTestRegister(0, IL_BYTE);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILCallInstruction(0, 'increment', [arg], result);

      expect(inst.toString()).toBe('v1 = CALL increment, [v0]');
    });

    it('should format CALL with multiple args correctly', () => {
      const arg1 = createTestRegister(0, IL_BYTE);
      const arg2 = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);
      const inst = new ILCallInstruction(0, 'add', [arg1, arg2], result);

      expect(inst.toString()).toBe('v2 = CALL add, [v0, v1]');
    });

    it('should include register names when present', () => {
      const arg = createTestRegister(0, IL_BYTE, 'x');
      const result = createTestRegister(1, IL_BYTE, 'ret');
      const inst = new ILCallInstruction(0, 'double', [arg], result);

      expect(inst.toString()).toBe('v1:ret = CALL double, [v0:x]');
    });
  });

  describe('result access', () => {
    it('should provide result register access', () => {
      const result = createTestRegister(5, IL_WORD, 'retval');
      const inst = new ILCallInstruction(0, 'getAddr', [], result);

      expect(inst.result).toBe(result);
      expect(inst.result?.id).toBe(5);
      expect(inst.result?.type).toBe(IL_WORD);
      expect(inst.result?.name).toBe('retval');
    });
  });
});

// =============================================================================
// ILCallVoidInstruction Tests
// =============================================================================

describe('ILCallVoidInstruction', () => {
  describe('construction', () => {
    it('should create CALL_VOID instruction with no arguments', () => {
      const inst = new ILCallVoidInstruction(0, 'clearScreen', []);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.CALL_VOID);
      expect(inst.functionName).toBe('clearScreen');
      expect(inst.args).toHaveLength(0);
      expect(inst.result).toBeNull();
    });

    it('should create CALL_VOID instruction with single argument', () => {
      const arg = createTestRegister(0, IL_BYTE, 'ch');
      const inst = new ILCallVoidInstruction(0, 'printChar', [arg]);

      expect(inst.functionName).toBe('printChar');
      expect(inst.args).toHaveLength(1);
      expect(inst.args[0]).toBe(arg);
      expect(inst.result).toBeNull();
    });

    it('should create CALL_VOID instruction with multiple arguments', () => {
      const arg1 = createTestRegister(0, IL_BYTE);
      const arg2 = createTestRegister(1, IL_BYTE);
      const inst = new ILCallVoidInstruction(0, 'setPosition', [arg1, arg2]);

      expect(inst.args).toHaveLength(2);
    });

    it('should store metadata correctly', () => {
      const metadata = {
        location: { line: 20, column: 3, sourceFile: 'test.bl65' },
      };
      const inst = new ILCallVoidInstruction(0, 'init', [], metadata);

      expect(inst.metadata.location?.line).toBe(20);
    });
  });

  describe('getOperands()', () => {
    it('should return all arguments', () => {
      const arg1 = createTestRegister(0, IL_BYTE);
      const arg2 = createTestRegister(1, IL_BYTE);
      const inst = new ILCallVoidInstruction(0, 'setPixel', [arg1, arg2]);

      const operands = inst.getOperands();
      expect(operands).toHaveLength(2);
      expect(operands[0]).toBe(arg1);
      expect(operands[1]).toBe(arg2);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return all argument registers', () => {
      const arg1 = createTestRegister(0, IL_BYTE);
      const arg2 = createTestRegister(1, IL_BYTE);
      const inst = new ILCallVoidInstruction(0, 'setPixel', [arg1, arg2]);

      const usedRegs = inst.getUsedRegisters();
      expect(usedRegs).toHaveLength(2);
      expect(usedRegs).toContain(arg1);
      expect(usedRegs).toContain(arg2);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return true (void calls have side effects)', () => {
      const inst = new ILCallVoidInstruction(0, 'clearScreen', []);

      expect(inst.hasSideEffects()).toBe(true);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (void calls are not terminators)', () => {
      const inst = new ILCallVoidInstruction(0, 'clearScreen', []);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format CALL_VOID with no args correctly', () => {
      const inst = new ILCallVoidInstruction(0, 'clearScreen', []);

      expect(inst.toString()).toBe('CALL_VOID clearScreen, []');
    });

    it('should format CALL_VOID with args correctly', () => {
      const arg = createTestRegister(0, IL_BYTE);
      const inst = new ILCallVoidInstruction(0, 'printChar', [arg]);

      expect(inst.toString()).toBe('CALL_VOID printChar, [v0]');
    });
  });

  describe('result is null', () => {
    it('should always have null result', () => {
      const arg = createTestRegister(0, IL_BYTE);
      const inst = new ILCallVoidInstruction(0, 'doSomething', [arg]);

      expect(inst.result).toBeNull();
    });
  });
});

// =============================================================================
// Call Instructions - Comparison Tests
// =============================================================================

describe('Call Instructions - Comparison', () => {
  it('both call types should have side effects', () => {
    const result = createTestRegister(0, IL_BYTE);
    const call = new ILCallInstruction(0, 'func', [], result);
    const callVoid = new ILCallVoidInstruction(1, 'voidFunc', []);

    expect(call.hasSideEffects()).toBe(true);
    expect(callVoid.hasSideEffects()).toBe(true);
  });

  it('neither call type should be a terminator', () => {
    const result = createTestRegister(0, IL_BYTE);
    const call = new ILCallInstruction(0, 'func', [], result);
    const callVoid = new ILCallVoidInstruction(1, 'voidFunc', []);

    expect(call.isTerminator()).toBe(false);
    expect(callVoid.isTerminator()).toBe(false);
  });

  it('CALL should have result, CALL_VOID should have null result', () => {
    const result = createTestRegister(0, IL_BYTE);
    const call = new ILCallInstruction(0, 'func', [], result);
    const callVoid = new ILCallVoidInstruction(1, 'voidFunc', []);

    expect(call.result).not.toBeNull();
    expect(callVoid.result).toBeNull();
  });
});