/**
 * Address Mode Selection Tests - CGT2.3
 *
 * Tests for address mode selection helper methods in CodeGeneratorBase.
 * These helpers determine the optimal 6502 addressing mode based on slot
 * location (ZP vs absolute) and operand type.
 *
 * @module __tests__/codegen/generator/address-mode
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGeneratorBase } from '../../../codegen/generator/base.js';
import { ILProgram } from '../../../il/index.js';
import { AddressOperand } from '../../../il/operands.js';
import { createFrameSlot, FrameSlot } from '../../../frame/types.js';
import { SlotKind, SlotLocation, ZpDirective } from '../../../frame/enums.js';
import { BUILTIN_TYPES } from '../../../semantic/types.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Test subclass to expose protected methods for testing.
 */
class TestableCodeGeneratorBase extends CodeGeneratorBase {
  // Expose protected address mode methods
  public testGetLoadMode(slot: FrameSlot): 'zeroPage' | 'absolute' {
    return this.getLoadMode(slot);
  }

  public testGetStoreMode(slot: FrameSlot): 'zeroPage' | 'absolute' {
    return this.getStoreMode(slot);
  }

  public testGetAddressMode(addr: AddressOperand): 'zeroPage' | 'absolute' {
    return this.getAddressMode(addr);
  }

  // Expose protected label management methods
  public testUniqueLabel(prefix: string): string {
    return this.uniqueLabel(prefix);
  }

  public testLocalLabel(name: string): string {
    return this.localLabel(name);
  }

  // Override abstract methods
  public generate(_program: ILProgram): never {
    throw new Error('Not implemented for testing');
  }
}

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Creates a zero page slot for testing.
 */
function createZpSlot(name: string, address: number = 0x50): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE, {
    location: SlotLocation.ZeroPage,
    address,
    zpDirective: ZpDirective.Zp,
  });
}

/**
 * Creates a frame region (absolute) slot for testing.
 */
function createAbsoluteSlot(name: string, address: number = 0x0200): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE, {
    location: SlotLocation.FrameRegion,
    address,
    zpDirective: ZpDirective.None,
  });
}

/**
 * Creates a register slot for testing.
 */
function createRegisterSlot(name: string, register: 'A' | 'X' | 'Y'): FrameSlot {
  return createFrameSlot(name, SlotKind.Parameter, BUILTIN_TYPES.BYTE, {
    location: SlotLocation.Register,
    address: 0,
    register,
  });
}

/**
 * Creates an address operand for testing.
 */
function createAddressOp(address: number, isZeroPage: boolean): AddressOperand {
  return {
    kind: 'address',
    address,
    isZeroPage,
  };
}

// ============================================================================
// getLoadMode Tests
// ============================================================================

describe('getLoadMode', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  describe('zero page slots', () => {
    it('returns zeroPage for ZP slot', () => {
      const slot = createZpSlot('counter', 0x50);
      expect(generator.testGetLoadMode(slot)).toBe('zeroPage');
    });

    it('returns zeroPage for ZP slot at address 0x02', () => {
      const slot = createZpSlot('ptr', 0x02);
      expect(generator.testGetLoadMode(slot)).toBe('zeroPage');
    });

    it('returns zeroPage for ZP slot at address 0x8F', () => {
      const slot = createZpSlot('data', 0x8f);
      expect(generator.testGetLoadMode(slot)).toBe('zeroPage');
    });
  });

  describe('absolute slots', () => {
    it('returns absolute for frame region slot', () => {
      const slot = createAbsoluteSlot('buffer', 0x0200);
      expect(generator.testGetLoadMode(slot)).toBe('absolute');
    });

    it('returns absolute for slot at address 0x0300', () => {
      const slot = createAbsoluteSlot('data', 0x0300);
      expect(generator.testGetLoadMode(slot)).toBe('absolute');
    });

    it('returns absolute for slot at high address', () => {
      const slot = createAbsoluteSlot('sprite', 0x4000);
      expect(generator.testGetLoadMode(slot)).toBe('absolute');
    });
  });

  describe('register slots', () => {
    it('returns absolute for register slot (not in ZP)', () => {
      const slot = createRegisterSlot('param', 'A');
      // Register slots have location=Register, which is not ZP
      expect(generator.testGetLoadMode(slot)).toBe('absolute');
    });
  });

  describe('different slot kinds', () => {
    it('returns zeroPage for ZP parameter slot', () => {
      const slot = createFrameSlot('x', SlotKind.Parameter, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.ZeroPage,
        address: 0x50,
      });
      expect(generator.testGetLoadMode(slot)).toBe('zeroPage');
    });

    it('returns zeroPage for ZP local slot', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.ZeroPage,
        address: 0x50,
      });
      expect(generator.testGetLoadMode(slot)).toBe('zeroPage');
    });

    it('returns zeroPage for ZP return slot', () => {
      const slot = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.ZeroPage,
        address: 0x50,
      });
      expect(generator.testGetLoadMode(slot)).toBe('zeroPage');
    });

    it('returns zeroPage for ZP temporary slot', () => {
      const slot = createFrameSlot('__temp_0', SlotKind.Temporary, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.ZeroPage,
        address: 0x50,
      });
      expect(generator.testGetLoadMode(slot)).toBe('zeroPage');
    });
  });

  describe('different types', () => {
    it('returns zeroPage for byte ZP slot', () => {
      const slot = createFrameSlot('b', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.ZeroPage,
        address: 0x50,
      });
      expect(generator.testGetLoadMode(slot)).toBe('zeroPage');
    });

    it('returns zeroPage for word ZP slot', () => {
      const slot = createFrameSlot('w', SlotKind.Local, BUILTIN_TYPES.WORD, {
        location: SlotLocation.ZeroPage,
        address: 0x50,
      });
      expect(generator.testGetLoadMode(slot)).toBe('zeroPage');
    });

    it('returns zeroPage for bool ZP slot', () => {
      const slot = createFrameSlot('flag', SlotKind.Local, BUILTIN_TYPES.BOOL, {
        location: SlotLocation.ZeroPage,
        address: 0x50,
      });
      expect(generator.testGetLoadMode(slot)).toBe('zeroPage');
    });
  });
});

// ============================================================================
// getStoreMode Tests
// ============================================================================

describe('getStoreMode', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  describe('zero page slots', () => {
    it('returns zeroPage for ZP slot', () => {
      const slot = createZpSlot('counter', 0x50);
      expect(generator.testGetStoreMode(slot)).toBe('zeroPage');
    });

    it('returns zeroPage for ZP slot at various addresses', () => {
      const addresses = [0x02, 0x50, 0x8f];
      for (const addr of addresses) {
        const slot = createZpSlot('x', addr);
        expect(generator.testGetStoreMode(slot)).toBe('zeroPage');
      }
    });
  });

  describe('absolute slots', () => {
    it('returns absolute for frame region slot', () => {
      const slot = createAbsoluteSlot('buffer', 0x0200);
      expect(generator.testGetStoreMode(slot)).toBe('absolute');
    });

    it('returns absolute for slot at various addresses', () => {
      const addresses = [0x0200, 0x0300, 0x4000, 0x8000];
      for (const addr of addresses) {
        const slot = createAbsoluteSlot('x', addr);
        expect(generator.testGetStoreMode(slot)).toBe('absolute');
      }
    });
  });

  describe('symmetry with getLoadMode', () => {
    it('getLoadMode and getStoreMode return same result for ZP slot', () => {
      const slot = createZpSlot('x', 0x50);
      expect(generator.testGetLoadMode(slot)).toBe(generator.testGetStoreMode(slot));
    });

    it('getLoadMode and getStoreMode return same result for absolute slot', () => {
      const slot = createAbsoluteSlot('x', 0x0200);
      expect(generator.testGetLoadMode(slot)).toBe(generator.testGetStoreMode(slot));
    });
  });
});

// ============================================================================
// getAddressMode Tests
// ============================================================================

describe('getAddressMode', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  describe('zero page addresses', () => {
    it('returns zeroPage for ZP address operand', () => {
      const addr = createAddressOp(0x50, true);
      expect(generator.testGetAddressMode(addr)).toBe('zeroPage');
    });

    it('returns zeroPage for ZP address at 0x02', () => {
      const addr = createAddressOp(0x02, true);
      expect(generator.testGetAddressMode(addr)).toBe('zeroPage');
    });

    it('returns zeroPage for ZP address at 0xFF', () => {
      const addr = createAddressOp(0xff, true);
      expect(generator.testGetAddressMode(addr)).toBe('zeroPage');
    });
  });

  describe('absolute addresses', () => {
    it('returns absolute for non-ZP address operand', () => {
      const addr = createAddressOp(0xd020, false);
      expect(generator.testGetAddressMode(addr)).toBe('absolute');
    });

    it('returns absolute for common C64 hardware addresses', () => {
      const addresses = [
        0xd020, // Border color
        0xd021, // Background color
        0xdc00, // CIA1 data port A
        0xdc01, // CIA1 data port B
        0xd000, // Sprite 0 X
      ];

      for (const address of addresses) {
        const addr = createAddressOp(address, false);
        expect(generator.testGetAddressMode(addr)).toBe('absolute');
      }
    });

    it('returns absolute for frame region address', () => {
      const addr = createAddressOp(0x0200, false);
      expect(generator.testGetAddressMode(addr)).toBe('absolute');
    });

    it('returns absolute for high memory address', () => {
      const addr = createAddressOp(0x8000, false);
      expect(generator.testGetAddressMode(addr)).toBe('absolute');
    });
  });

  describe('isZeroPage flag determines mode', () => {
    it('low address with isZeroPage=true returns zeroPage', () => {
      const addr = createAddressOp(0x50, true);
      expect(generator.testGetAddressMode(addr)).toBe('zeroPage');
    });

    it('low address with isZeroPage=false returns absolute', () => {
      // Even if address is in ZP range, flag determines mode
      const addr = createAddressOp(0x50, false);
      expect(generator.testGetAddressMode(addr)).toBe('absolute');
    });

    it('address 0 with isZeroPage=true returns zeroPage', () => {
      const addr = createAddressOp(0x00, true);
      expect(generator.testGetAddressMode(addr)).toBe('zeroPage');
    });
  });
});

// ============================================================================
// Label Management Tests
// ============================================================================

describe('uniqueLabel', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  it('generates label with prefix and counter', () => {
    const label = generator.testUniqueLabel('loop');
    expect(label).toBe('loop_0');
  });

  it('increments counter for subsequent calls', () => {
    const label1 = generator.testUniqueLabel('loop');
    const label2 = generator.testUniqueLabel('loop');
    const label3 = generator.testUniqueLabel('loop');

    expect(label1).toBe('loop_0');
    expect(label2).toBe('loop_1');
    expect(label3).toBe('loop_2');
  });

  it('uses same counter for different prefixes', () => {
    const loop = generator.testUniqueLabel('loop');
    const end = generator.testUniqueLabel('end');
    const ifElse = generator.testUniqueLabel('if');

    expect(loop).toBe('loop_0');
    expect(end).toBe('end_1');
    expect(ifElse).toBe('if_2');
  });

  it('handles various prefixes', () => {
    const prefixes = ['while', 'for', 'do', 'switch', 'case', 'default', 'func'];

    for (let i = 0; i < prefixes.length; i++) {
      const label = generator.testUniqueLabel(prefixes[i]);
      expect(label).toBe(`${prefixes[i]}_${i}`);
    }
  });

  it('handles empty prefix', () => {
    const label = generator.testUniqueLabel('');
    expect(label).toBe('_0');
  });
});

describe('localLabel', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  it('prefixes name with dot', () => {
    const label = generator.testLocalLabel('loop');
    expect(label).toBe('.loop');
  });

  it('handles various names', () => {
    const names = ['done', 'skip', 'else', 'end', 'continue', 'break'];

    for (const name of names) {
      const label = generator.testLocalLabel(name);
      expect(label).toBe(`.${name}`);
    }
  });

  it('handles names with underscores', () => {
    const label = generator.testLocalLabel('loop_body');
    expect(label).toBe('.loop_body');
  });

  it('handles single character names', () => {
    const label = generator.testLocalLabel('x');
    expect(label).toBe('.x');
  });

  it('handles names already starting with dot', () => {
    // This adds another dot, which might be intentional or not
    const label = generator.testLocalLabel('.nested');
    expect(label).toBe('..nested');
  });
});

// ============================================================================
// Combined Address Mode Selection Scenarios
// ============================================================================

describe('Address Mode Selection Scenarios', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  describe('C64 memory map scenarios', () => {
    it('selects ZP for low-address frequently-accessed variables', () => {
      // Variables in ZP range ($02-$8F) should use ZP addressing
      const counter = createZpSlot('counter', 0x50);
      expect(generator.testGetLoadMode(counter)).toBe('zeroPage');
      expect(generator.testGetStoreMode(counter)).toBe('zeroPage');
    });

    it('selects absolute for frame variables in low RAM', () => {
      // Frame region at $0200-$03FF uses absolute addressing
      const buffer = createAbsoluteSlot('buffer', 0x0200);
      expect(generator.testGetLoadMode(buffer)).toBe('absolute');
      expect(generator.testGetStoreMode(buffer)).toBe('absolute');
    });

    it('selects absolute for hardware registers', () => {
      // VIC-II, SID, CIA registers are in high memory
      const borderColor = createAddressOp(0xd020, false);
      expect(generator.testGetAddressMode(borderColor)).toBe('absolute');
    });
  });

  describe('code generation implications', () => {
    it('ZP mode saves 1 cycle and 1 byte vs absolute', () => {
      // ZP: LDA $50 = 3 cycles, 2 bytes
      // ABS: LDA $0200 = 4 cycles, 3 bytes
      const zpSlot = createZpSlot('fast', 0x50);
      const absSlot = createAbsoluteSlot('slow', 0x0200);

      // Verify ZP slot uses efficient mode
      expect(generator.testGetLoadMode(zpSlot)).toBe('zeroPage');
      // Verify absolute slot uses larger mode
      expect(generator.testGetLoadMode(absSlot)).toBe('absolute');
    });

    it('mode selection is deterministic', () => {
      // Same slot should always return same mode
      const slot = createZpSlot('x', 0x50);

      const mode1 = generator.testGetLoadMode(slot);
      const mode2 = generator.testGetLoadMode(slot);
      const mode3 = generator.testGetLoadMode(slot);

      expect(mode1).toBe(mode2);
      expect(mode2).toBe(mode3);
    });
  });
});

// ============================================================================
// Reset Tests
// ============================================================================

describe('CodeGeneratorBase Reset', () => {
  it('resets label counter on new instance', () => {
    const gen1 = new TestableCodeGeneratorBase('test1');
    gen1.testUniqueLabel('loop');
    gen1.testUniqueLabel('loop');
    // gen1 counter is now at 2

    // New instance starts fresh
    const gen2 = new TestableCodeGeneratorBase('test2');
    const label = gen2.testUniqueLabel('loop');
    expect(label).toBe('loop_0');
  });
});