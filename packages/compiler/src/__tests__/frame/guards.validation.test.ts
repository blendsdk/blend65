/**
 * Tests for Validation Guards
 *
 * Tests: isAddressValidForLocation, overlapsScratchRegion, overlapsReservedZp,
 *        validateSlotAllocation, describeSlot
 */

import { describe, it, expect } from 'vitest';
import {
  isAddressValidForLocation,
  overlapsScratchRegion,
  overlapsReservedZp,
  validateSlotAllocation,
  describeSlot,
  createFrameSlot,
  SlotKind,
  SlotLocation,
  ZpDirective,
  C64_PLATFORM_CONFIG,
  X16_PLATFORM_CONFIG,
  TEST_PLATFORM_CONFIG,
} from '../../frame/index.js';
import { TypeKind } from '../../semantic/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const BYTE_TYPE = {
  kind: TypeKind.Byte,
  name: 'byte',
  size: 1,
  isSigned: false,
  isAssignable: true,
};

const WORD_TYPE = {
  kind: TypeKind.Word,
  name: 'word',
  size: 2,
  isSigned: false,
  isAssignable: true,
};

// ============================================================================
// isAddressValidForLocation Tests
// ============================================================================

describe('isAddressValidForLocation', () => {
  describe('ZeroPage location', () => {
    it('accepts valid ZP address', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
        location: SlotLocation.ZeroPage,
        address: 0x50,
      });
      expect(isAddressValidForLocation(slot, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('accepts ZP address 0', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
        location: SlotLocation.ZeroPage,
        address: 0x00,
      });
      expect(isAddressValidForLocation(slot, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('accepts ZP address 0xFF', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
        location: SlotLocation.ZeroPage,
        address: 0xff,
      });
      expect(isAddressValidForLocation(slot, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('rejects address outside ZP', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
        location: SlotLocation.ZeroPage,
        address: 0x0200,
      });
      expect(isAddressValidForLocation(slot, C64_PLATFORM_CONFIG)).toBe(false);
    });
  });

  describe('FrameRegion location', () => {
    it('accepts address 0 (unallocated)', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
        location: SlotLocation.FrameRegion,
        address: 0,
      });
      expect(isAddressValidForLocation(slot, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('accepts valid frame region address', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
        location: SlotLocation.FrameRegion,
        address: 0x0200, // C64 frame region start
      });
      expect(isAddressValidForLocation(slot, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('accepts address at end of frame region', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
        location: SlotLocation.FrameRegion,
        address: 0x03ff, // Just before C64 frame region end
      });
      expect(isAddressValidForLocation(slot, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('rejects address outside frame region', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
        location: SlotLocation.FrameRegion,
        address: 0x0800, // Outside C64 frame region
      });
      expect(isAddressValidForLocation(slot, C64_PLATFORM_CONFIG)).toBe(false);
    });
  });

  describe('Register location', () => {
    it('always returns true for register slots', () => {
      const slot = createFrameSlot('x', SlotKind.Parameter, BYTE_TYPE, {
        location: SlotLocation.Register,
        register: 'A',
        address: 0, // Address doesn't matter
      });
      expect(isAddressValidForLocation(slot, C64_PLATFORM_CONFIG)).toBe(true);
    });
  });
});

// ============================================================================
// overlapsScratchRegion Tests
// ============================================================================

describe('overlapsScratchRegion', () => {
  it('returns false for non-ZP slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.FrameRegion,
      address: 0x0200,
    });
    expect(overlapsScratchRegion(slot, C64_PLATFORM_CONFIG)).toBe(false);
  });

  it('returns false for ZP slot not overlapping scratch', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x50, // Well away from $FB-$FF scratch
    });
    expect(overlapsScratchRegion(slot, C64_PLATFORM_CONFIG)).toBe(false);
  });

  it('returns true for ZP slot at scratch start', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0xfb, // C64 scratch starts at $FB
    });
    expect(overlapsScratchRegion(slot, C64_PLATFORM_CONFIG)).toBe(true);
  });

  it('returns true for ZP slot overlapping into scratch', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0xfa, // 2-byte slot at $FA would extend into $FB (scratch)
    });
    expect(overlapsScratchRegion(slot, C64_PLATFORM_CONFIG)).toBe(true);
  });

  it('returns false for ZP slot just before scratch', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0xfa, // Just before $FB scratch
    });
    expect(overlapsScratchRegion(slot, C64_PLATFORM_CONFIG)).toBe(false);
  });

  it('works with X16 platform', () => {
    // X16 scratch: $7C-$80
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x7c, // X16 scratch starts at $7C
    });
    expect(overlapsScratchRegion(slot, X16_PLATFORM_CONFIG)).toBe(true);
  });
});

// ============================================================================
// overlapsReservedZp Tests
// ============================================================================

describe('overlapsReservedZp', () => {
  it('returns false for non-ZP slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.FrameRegion,
      address: 0x00, // Even if address is 0
    });
    expect(overlapsReservedZp(slot, C64_PLATFORM_CONFIG)).toBe(false);
  });

  it('returns true for ZP slot at reserved address', () => {
    // C64 reserved: $00, $01
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x00,
    });
    expect(overlapsReservedZp(slot, C64_PLATFORM_CONFIG)).toBe(true);
  });

  it('returns true for ZP slot spanning reserved address', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x01, // 2-byte slot at $01 includes $01 (reserved)
    });
    expect(overlapsReservedZp(slot, C64_PLATFORM_CONFIG)).toBe(true);
  });

  it('returns false for ZP slot not overlapping reserved', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x50,
    });
    expect(overlapsReservedZp(slot, C64_PLATFORM_CONFIG)).toBe(false);
  });

  it('works with X16 platform (more reserved)', () => {
    // X16 reserved: $00-$21 (34 bytes)
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x20, // $20 is reserved on X16
    });
    expect(overlapsReservedZp(slot, X16_PLATFORM_CONFIG)).toBe(true);
  });

  it('works with test platform (no reserved)', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x10,
    });
    expect(overlapsReservedZp(slot, TEST_PLATFORM_CONFIG)).toBe(false);
  });
});

// ============================================================================
// validateSlotAllocation Tests
// ============================================================================

describe('validateSlotAllocation', () => {
  it('returns valid for correctly allocated slot', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.FrameRegion,
      address: 0x0200,
    });
    const result = validateSlotAllocation(slot, C64_PLATFORM_CONFIG);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid for correctly allocated ZP slot', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x50,
    });
    const result = validateSlotAllocation(slot, C64_PLATFORM_CONFIG);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects invalid address for location', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x0200, // Not in ZP!
    });
    const result = validateSlotAllocation(slot, C64_PLATFORM_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('invalid for location'))).toBe(
      true,
    );
  });

  it('detects @zp directive violation', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE, {
      zpDirective: ZpDirective.Zp,
      location: SlotLocation.FrameRegion,
      address: 0x0200,
    });
    const result = validateSlotAllocation(slot, C64_PLATFORM_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('@zp directive'))).toBe(true);
  });

  it('detects @ram directive violation', () => {
    const slot = createFrameSlot('buffer', SlotKind.Local, BYTE_TYPE, {
      zpDirective: ZpDirective.Ram,
      location: SlotLocation.ZeroPage,
      address: 0x50,
    });
    const result = validateSlotAllocation(slot, C64_PLATFORM_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('@ram directive'))).toBe(true);
  });

  it('detects scratch region overlap', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0xfb, // C64 scratch
    });
    const result = validateSlotAllocation(slot, C64_PLATFORM_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('scratch region'))).toBe(true);
  });

  it('detects reserved ZP overlap', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x00,
    });
    const result = validateSlotAllocation(slot, C64_PLATFORM_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('reserved zero page'))).toBe(
      true,
    );
  });

  it('detects frame region overflow', () => {
    const slot = createFrameSlot('buffer', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.FrameRegion,
      address: 0x03ff, // Last byte of C64 frame region
      size: 2, // But slot is 2 bytes, extends to $0400
    });
    // Override size for this test
    (slot as any).size = 2;
    const result = validateSlotAllocation(slot, C64_PLATFORM_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('extends beyond'))).toBe(true);
  });

  it('can return multiple errors', () => {
    const slot = createFrameSlot('bad', SlotKind.Local, BYTE_TYPE, {
      zpDirective: ZpDirective.Zp,
      location: SlotLocation.FrameRegion,
      address: 0x0800, // Outside frame region
    });
    const result = validateSlotAllocation(slot, C64_PLATFORM_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// describeSlot Tests
// ============================================================================

describe('describeSlot', () => {
  it('describes local byte slot', () => {
    const slot = createFrameSlot('counter', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.FrameRegion,
      address: 0x0200,
    });
    const desc = describeSlot(slot);
    expect(desc).toContain('local');
    expect(desc).toContain("'counter'");
    expect(desc).toContain('byte');
    expect(desc).toContain('1 bytes');
    expect(desc).toContain('$0200');
  });

  it('describes parameter in register', () => {
    const slot = createFrameSlot('x', SlotKind.Parameter, BYTE_TYPE, {
      location: SlotLocation.Register,
      register: 'A',
    });
    const desc = describeSlot(slot);
    expect(desc).toContain('parameter');
    expect(desc).toContain("'x'");
    expect(desc).toContain('register A');
  });

  it('describes unallocated slot', () => {
    const slot = createFrameSlot('pending', SlotKind.Local, WORD_TYPE);
    const desc = describeSlot(slot);
    expect(desc).toContain('local');
    expect(desc).toContain("'pending'");
    expect(desc).toContain('unallocated');
  });

  it('describes ZP slot', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x50,
    });
    const desc = describeSlot(slot);
    expect(desc).toContain('local');
    expect(desc).toContain("'ptr'");
    expect(desc).toContain('word');
    expect(desc).toContain('2 bytes');
    expect(desc).toContain('$0050');
    expect(desc).toContain('zp'); // String enum value
  });

  it('describes return slot', () => {
    const slot = createFrameSlot('__return', SlotKind.Return, BYTE_TYPE, {
      location: SlotLocation.FrameRegion,
      address: 0x0210,
    });
    const desc = describeSlot(slot);
    expect(desc).toContain('return');
    expect(desc).toContain("'__return'");
  });

  it('describes temporary slot', () => {
    const slot = createFrameSlot('__temp_0', SlotKind.Temporary, WORD_TYPE, {
      location: SlotLocation.FrameRegion,
      address: 0x0220,
    });
    const desc = describeSlot(slot);
    expect(desc).toContain('temporary');
    expect(desc).toContain("'__temp_0'");
  });
});