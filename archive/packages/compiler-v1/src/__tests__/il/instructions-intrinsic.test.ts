/**
 * IL Instructions - Intrinsic and Hardware Instructions Tests
 *
 * Tests for intrinsic operations:
 * - ILPeekInstruction: Read byte from memory address (peek)
 * - ILPokeInstruction: Write byte to memory address (poke)
 * - ILHardwareReadInstruction: Read from hardware register
 * - ILHardwareWriteInstruction: Write to hardware register
 * - ILOptBarrierInstruction: Optimization barrier
 *
 * These instructions provide low-level memory and hardware access for C64 development.
 *
 * @module il/instructions-intrinsic.test
 */

import { describe, expect, it } from 'vitest';
import {
  ILOpcode,
  ILPeekInstruction,
  ILPokeInstruction,
  ILHardwareReadInstruction,
  ILHardwareWriteInstruction,
  ILOptBarrierInstruction,
} from '../../il/instructions.js';
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
// ILPeekInstruction Tests
// =============================================================================

describe('ILPeekInstruction', () => {
  describe('construction', () => {
    it('should create INTRINSIC_PEEK instruction', () => {
      const address = createTestRegister(0, IL_WORD, 'addr');
      const result = createTestRegister(1, IL_BYTE, 'val');
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.INTRINSIC_PEEK);
      expect(inst.address).toBe(address);
      expect(inst.result).toBe(result);
    });

    it('should store metadata correctly', () => {
      const address = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_BYTE);
      const metadata = {
        location: { line: 10, column: 5, sourceFile: 'test.bl65' },
      };
      const inst = new ILPeekInstruction(0, address, result, metadata);

      expect(inst.metadata.location?.line).toBe(10);
    });
  });

  describe('getOperands()', () => {
    it('should return [address] array', () => {
      const address = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILPeekInstruction(0, address, result);

      const operands = inst.getOperands();
      expect(operands).toHaveLength(1);
      expect(operands[0]).toBe(address);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return [address] register', () => {
      const address = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILPeekInstruction(0, address, result);

      const usedRegs = inst.getUsedRegisters();
      expect(usedRegs).toHaveLength(1);
      expect(usedRegs[0]).toBe(address);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false (peek has no side effects)', () => {
      const address = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (not a terminator)', () => {
      const address = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format INTRINSIC_PEEK correctly', () => {
      const address = createTestRegister(0, IL_WORD);
      const result = createTestRegister(1, IL_BYTE);
      const inst = new ILPeekInstruction(0, address, result);

      expect(inst.toString()).toBe('v1 = INTRINSIC_PEEK v0');
    });
  });
});

// =============================================================================
// ILPokeInstruction Tests
// =============================================================================

describe('ILPokeInstruction', () => {
  describe('construction', () => {
    it('should create INTRINSIC_POKE instruction', () => {
      const address = createTestRegister(0, IL_WORD);
      const value = createTestRegister(1, IL_BYTE);
      const inst = new ILPokeInstruction(0, address, value);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.INTRINSIC_POKE);
      expect(inst.address).toBe(address);
      expect(inst.value).toBe(value);
      expect(inst.result).toBeNull();
    });

    it('should store metadata correctly', () => {
      const address = createTestRegister(0, IL_WORD);
      const value = createTestRegister(1, IL_BYTE);
      const metadata = {
        location: { line: 15, column: 3, sourceFile: 'test.bl65' },
      };
      const inst = new ILPokeInstruction(0, address, value, metadata);

      expect(inst.metadata.location?.line).toBe(15);
    });
  });

  describe('getOperands()', () => {
    it('should return [address, value] array', () => {
      const address = createTestRegister(0, IL_WORD);
      const value = createTestRegister(1, IL_BYTE);
      const inst = new ILPokeInstruction(0, address, value);

      const operands = inst.getOperands();
      expect(operands).toHaveLength(2);
      expect(operands[0]).toBe(address);
      expect(operands[1]).toBe(value);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return [address, value] registers', () => {
      const address = createTestRegister(0, IL_WORD);
      const value = createTestRegister(1, IL_BYTE);
      const inst = new ILPokeInstruction(0, address, value);

      const usedRegs = inst.getUsedRegisters();
      expect(usedRegs).toHaveLength(2);
      expect(usedRegs).toContain(address);
      expect(usedRegs).toContain(value);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return true (poke writes to memory)', () => {
      const address = createTestRegister(0, IL_WORD);
      const value = createTestRegister(1, IL_BYTE);
      const inst = new ILPokeInstruction(0, address, value);

      expect(inst.hasSideEffects()).toBe(true);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (not a terminator)', () => {
      const address = createTestRegister(0, IL_WORD);
      const value = createTestRegister(1, IL_BYTE);
      const inst = new ILPokeInstruction(0, address, value);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format INTRINSIC_POKE correctly', () => {
      const address = createTestRegister(0, IL_WORD);
      const value = createTestRegister(1, IL_BYTE);
      const inst = new ILPokeInstruction(0, address, value);

      expect(inst.toString()).toBe('INTRINSIC_POKE v0, v1');
    });
  });
});

// =============================================================================
// ILHardwareReadInstruction Tests
// =============================================================================

describe('ILHardwareReadInstruction', () => {
  describe('construction', () => {
    it('should create HARDWARE_READ instruction for VIC-II', () => {
      const result = createTestRegister(0, IL_BYTE);
      // $D020 is VIC-II border color register
      const inst = new ILHardwareReadInstruction(0, 0xd020, result);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.HARDWARE_READ);
      expect(inst.address).toBe(0xd020);
      expect(inst.result).toBe(result);
    });

    it('should create HARDWARE_READ for SID register', () => {
      const result = createTestRegister(0, IL_BYTE);
      // $D418 is SID master volume register
      const inst = new ILHardwareReadInstruction(0, 0xd418, result);

      expect(inst.address).toBe(0xd418);
    });

    it('should store metadata correctly', () => {
      const result = createTestRegister(0, IL_BYTE);
      const metadata = {
        location: { line: 20, column: 5, sourceFile: 'test.bl65' },
      };
      const inst = new ILHardwareReadInstruction(0, 0xd020, result, metadata);

      expect(inst.metadata.location?.line).toBe(20);
    });
  });

  describe('getOperands()', () => {
    it('should return empty array (address is not a value)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILHardwareReadInstruction(0, 0xd020, result);

      expect(inst.getOperands()).toHaveLength(0);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return empty array', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILHardwareReadInstruction(0, 0xd020, result);

      expect(inst.getUsedRegisters()).toHaveLength(0);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return false (read has no side effects)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILHardwareReadInstruction(0, 0xd020, result);

      expect(inst.hasSideEffects()).toBe(false);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (not a terminator)', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILHardwareReadInstruction(0, 0xd020, result);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format HARDWARE_READ with hex address', () => {
      const result = createTestRegister(0, IL_BYTE);
      const inst = new ILHardwareReadInstruction(0, 0xd020, result);

      expect(inst.toString()).toBe('v0 = HARDWARE_READ $D020');
    });

    it('should format various hardware addresses', () => {
      const result = createTestRegister(0, IL_BYTE);

      const vic = new ILHardwareReadInstruction(0, 0xd000, result);
      const sid = new ILHardwareReadInstruction(1, 0xd400, result);
      const cia = new ILHardwareReadInstruction(2, 0xdc00, result);

      expect(vic.toString()).toContain('$D000');
      expect(sid.toString()).toContain('$D400');
      expect(cia.toString()).toContain('$DC00');
    });
  });
});

// =============================================================================
// ILHardwareWriteInstruction Tests
// =============================================================================

describe('ILHardwareWriteInstruction', () => {
  describe('construction', () => {
    it('should create HARDWARE_WRITE instruction', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILHardwareWriteInstruction(0, 0xd020, value);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.HARDWARE_WRITE);
      expect(inst.address).toBe(0xd020);
      expect(inst.value).toBe(value);
      expect(inst.result).toBeNull();
    });

    it('should store metadata correctly', () => {
      const value = createTestRegister(0, IL_BYTE);
      const metadata = {
        location: { line: 25, column: 3, sourceFile: 'test.bl65' },
      };
      const inst = new ILHardwareWriteInstruction(0, 0xd020, value, metadata);

      expect(inst.metadata.location?.line).toBe(25);
    });
  });

  describe('getOperands()', () => {
    it('should return [value] array', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILHardwareWriteInstruction(0, 0xd020, value);

      const operands = inst.getOperands();
      expect(operands).toHaveLength(1);
      expect(operands[0]).toBe(value);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return [value] register', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILHardwareWriteInstruction(0, 0xd020, value);

      const usedRegs = inst.getUsedRegisters();
      expect(usedRegs).toHaveLength(1);
      expect(usedRegs[0]).toBe(value);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return true (hardware write has side effects)', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILHardwareWriteInstruction(0, 0xd020, value);

      expect(inst.hasSideEffects()).toBe(true);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (not a terminator)', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILHardwareWriteInstruction(0, 0xd020, value);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format HARDWARE_WRITE with hex address', () => {
      const value = createTestRegister(0, IL_BYTE);
      const inst = new ILHardwareWriteInstruction(0, 0xd020, value);

      expect(inst.toString()).toBe('HARDWARE_WRITE $D020, v0');
    });
  });
});

// =============================================================================
// ILOptBarrierInstruction Tests
// =============================================================================

describe('ILOptBarrierInstruction', () => {
  describe('construction', () => {
    it('should create OPT_BARRIER instruction', () => {
      const inst = new ILOptBarrierInstruction(0);

      expect(inst.id).toBe(0);
      expect(inst.opcode).toBe(ILOpcode.OPT_BARRIER);
      expect(inst.result).toBeNull();
    });

    it('should store metadata correctly', () => {
      const metadata = {
        location: { line: 30, column: 1, sourceFile: 'test.bl65' },
        rasterCritical: true,
      };
      const inst = new ILOptBarrierInstruction(0, metadata);

      expect(inst.metadata.location?.line).toBe(30);
      expect(inst.metadata.rasterCritical).toBe(true);
    });
  });

  describe('getOperands()', () => {
    it('should return empty array', () => {
      const inst = new ILOptBarrierInstruction(0);

      expect(inst.getOperands()).toHaveLength(0);
    });
  });

  describe('getUsedRegisters()', () => {
    it('should return empty array', () => {
      const inst = new ILOptBarrierInstruction(0);

      expect(inst.getUsedRegisters()).toHaveLength(0);
    });
  });

  describe('hasSideEffects()', () => {
    it('should return true (barrier prevents optimizations)', () => {
      const inst = new ILOptBarrierInstruction(0);

      expect(inst.hasSideEffects()).toBe(true);
    });
  });

  describe('isTerminator()', () => {
    it('should return false (not a terminator)', () => {
      const inst = new ILOptBarrierInstruction(0);

      expect(inst.isTerminator()).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should format OPT_BARRIER correctly', () => {
      const inst = new ILOptBarrierInstruction(0);

      expect(inst.toString()).toBe('OPT_BARRIER');
    });
  });
});

// =============================================================================
// Intrinsic Instructions - Side Effects Comparison
// =============================================================================

describe('Intrinsic Instructions - Side Effects', () => {
  it('read operations should not have side effects', () => {
    const addr = createTestRegister(0, IL_WORD);
    const result = createTestRegister(1, IL_BYTE);

    const peek = new ILPeekInstruction(0, addr, result);
    const hwRead = new ILHardwareReadInstruction(1, 0xd020, result);

    expect(peek.hasSideEffects()).toBe(false);
    expect(hwRead.hasSideEffects()).toBe(false);
  });

  it('write operations should have side effects', () => {
    const addr = createTestRegister(0, IL_WORD);
    const value = createTestRegister(1, IL_BYTE);

    const poke = new ILPokeInstruction(0, addr, value);
    const hwWrite = new ILHardwareWriteInstruction(1, 0xd020, value);
    const barrier = new ILOptBarrierInstruction(2);

    expect(poke.hasSideEffects()).toBe(true);
    expect(hwWrite.hasSideEffects()).toBe(true);
    expect(barrier.hasSideEffects()).toBe(true);
  });
});