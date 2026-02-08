/**
 * Tests for Slot Location Guards
 *
 * Tests: isZpSlot, isFrameRegionSlot, isRegisterSlot, isValidSlotLocation,
 *        requiresZp, forbiddenFromZp, hasNoZpDirective, isValidZpDirective
 */

import { describe, it, expect } from 'vitest';
import {
  isZpSlot,
  isFrameRegionSlot,
  isRegisterSlot,
  isValidSlotLocation,
  requiresZp,
  forbiddenFromZp,
  hasNoZpDirective,
  isValidZpDirective,
  createFrameSlot,
  SlotKind,
  SlotLocation,
  ZpDirective,
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
// isZpSlot Tests
// ============================================================================

describe('isZpSlot', () => {
  it('returns true for ZP slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x50,
    });
    expect(isZpSlot(slot)).toBe(true);
  });

  it('returns false for frame region slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.FrameRegion,
      address: 0x0200,
    });
    expect(isZpSlot(slot)).toBe(false);
  });

  it('returns false for register slots', () => {
    const slot = createFrameSlot('x', SlotKind.Parameter, BYTE_TYPE, {
      location: SlotLocation.Register,
      register: 'A',
    });
    expect(isZpSlot(slot)).toBe(false);
  });

  it('returns false for default (unallocated) slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(isZpSlot(slot)).toBe(false);
  });
});

// ============================================================================
// isFrameRegionSlot Tests
// ============================================================================

describe('isFrameRegionSlot', () => {
  it('returns true for frame region slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.FrameRegion,
      address: 0x0200,
    });
    expect(isFrameRegionSlot(slot)).toBe(true);
  });

  it('returns true for default (unallocated) slots', () => {
    // Default location is FrameRegion
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(isFrameRegionSlot(slot)).toBe(true);
  });

  it('returns false for ZP slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
    });
    expect(isFrameRegionSlot(slot)).toBe(false);
  });

  it('returns false for register slots', () => {
    const slot = createFrameSlot('x', SlotKind.Parameter, BYTE_TYPE, {
      location: SlotLocation.Register,
    });
    expect(isFrameRegionSlot(slot)).toBe(false);
  });
});

// ============================================================================
// isRegisterSlot Tests
// ============================================================================

describe('isRegisterSlot', () => {
  it('returns true for register slots', () => {
    const slot = createFrameSlot('x', SlotKind.Parameter, BYTE_TYPE, {
      location: SlotLocation.Register,
      register: 'A',
    });
    expect(isRegisterSlot(slot)).toBe(true);
  });

  it('returns true for X register', () => {
    const slot = createFrameSlot('y', SlotKind.Parameter, BYTE_TYPE, {
      location: SlotLocation.Register,
      register: 'X',
    });
    expect(isRegisterSlot(slot)).toBe(true);
  });

  it('returns true for Y register', () => {
    const slot = createFrameSlot('z', SlotKind.Parameter, BYTE_TYPE, {
      location: SlotLocation.Register,
      register: 'Y',
    });
    expect(isRegisterSlot(slot)).toBe(true);
  });

  it('returns false for ZP slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
    });
    expect(isRegisterSlot(slot)).toBe(false);
  });

  it('returns false for frame region slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(isRegisterSlot(slot)).toBe(false);
  });
});

// ============================================================================
// isValidSlotLocation Tests
// ============================================================================

describe('isValidSlotLocation', () => {
  it('returns true for ZeroPage', () => {
    expect(isValidSlotLocation(SlotLocation.ZeroPage)).toBe(true);
  });

  it('returns true for FrameRegion', () => {
    expect(isValidSlotLocation(SlotLocation.FrameRegion)).toBe(true);
  });

  it('returns true for Register', () => {
    expect(isValidSlotLocation(SlotLocation.Register)).toBe(true);
  });

  it('returns false for invalid number', () => {
    expect(isValidSlotLocation(99)).toBe(false);
    expect(isValidSlotLocation(-1)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isValidSlotLocation('ZeroPage')).toBe(false);
    expect(isValidSlotLocation('invalid')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isValidSlotLocation(null)).toBe(false);
    expect(isValidSlotLocation(undefined)).toBe(false);
  });
});

// ============================================================================
// requiresZp Tests
// ============================================================================

describe('requiresZp', () => {
  it('returns true for @zp directive', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE, {
      zpDirective: ZpDirective.Zp,
    });
    expect(requiresZp(slot)).toBe(true);
  });

  it('returns false for @ram directive', () => {
    const slot = createFrameSlot('buffer', SlotKind.Local, BYTE_TYPE, {
      zpDirective: ZpDirective.Ram,
    });
    expect(requiresZp(slot)).toBe(false);
  });

  it('returns false for no directive', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(requiresZp(slot)).toBe(false);
  });
});

// ============================================================================
// forbiddenFromZp Tests
// ============================================================================

describe('forbiddenFromZp', () => {
  it('returns true for @ram directive', () => {
    const slot = createFrameSlot('buffer', SlotKind.Local, BYTE_TYPE, {
      zpDirective: ZpDirective.Ram,
    });
    expect(forbiddenFromZp(slot)).toBe(true);
  });

  it('returns false for @zp directive', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE, {
      zpDirective: ZpDirective.Zp,
    });
    expect(forbiddenFromZp(slot)).toBe(false);
  });

  it('returns false for no directive', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(forbiddenFromZp(slot)).toBe(false);
  });
});

// ============================================================================
// hasNoZpDirective Tests
// ============================================================================

describe('hasNoZpDirective', () => {
  it('returns true for no directive', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(hasNoZpDirective(slot)).toBe(true);
  });

  it('returns false for @zp directive', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE, {
      zpDirective: ZpDirective.Zp,
    });
    expect(hasNoZpDirective(slot)).toBe(false);
  });

  it('returns false for @ram directive', () => {
    const slot = createFrameSlot('buffer', SlotKind.Local, BYTE_TYPE, {
      zpDirective: ZpDirective.Ram,
    });
    expect(hasNoZpDirective(slot)).toBe(false);
  });
});

// ============================================================================
// isValidZpDirective Tests
// ============================================================================

describe('isValidZpDirective', () => {
  it('returns true for None', () => {
    expect(isValidZpDirective(ZpDirective.None)).toBe(true);
  });

  it('returns true for Zp', () => {
    expect(isValidZpDirective(ZpDirective.Zp)).toBe(true);
  });

  it('returns true for Ram', () => {
    expect(isValidZpDirective(ZpDirective.Ram)).toBe(true);
  });

  it('returns false for invalid number', () => {
    expect(isValidZpDirective(99)).toBe(false);
    expect(isValidZpDirective(-1)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isValidZpDirective('Zp')).toBe(false);
    expect(isValidZpDirective('invalid')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isValidZpDirective(null)).toBe(false);
    expect(isValidZpDirective(undefined)).toBe(false);
  });
});

// ============================================================================
// Cross-Location Tests
// ============================================================================

describe('Slot Location Guards - Cross Tests', () => {
  it('each location matches exactly one location guard', () => {
    const zpSlot = createFrameSlot('a', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
    });
    const frameSlot = createFrameSlot('b', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.FrameRegion,
    });
    const regSlot = createFrameSlot('c', SlotKind.Parameter, BYTE_TYPE, {
      location: SlotLocation.Register,
    });

    // ZeroPage
    expect(isZpSlot(zpSlot)).toBe(true);
    expect(isFrameRegionSlot(zpSlot)).toBe(false);
    expect(isRegisterSlot(zpSlot)).toBe(false);

    // FrameRegion
    expect(isZpSlot(frameSlot)).toBe(false);
    expect(isFrameRegionSlot(frameSlot)).toBe(true);
    expect(isRegisterSlot(frameSlot)).toBe(false);

    // Register
    expect(isZpSlot(regSlot)).toBe(false);
    expect(isFrameRegionSlot(regSlot)).toBe(false);
    expect(isRegisterSlot(regSlot)).toBe(true);
  });

  it('directive guards are mutually exclusive', () => {
    const noDir = createFrameSlot('a', SlotKind.Local, BYTE_TYPE);
    const zpDir = createFrameSlot('b', SlotKind.Local, BYTE_TYPE, {
      zpDirective: ZpDirective.Zp,
    });
    const ramDir = createFrameSlot('c', SlotKind.Local, BYTE_TYPE, {
      zpDirective: ZpDirective.Ram,
    });

    // No directive
    expect(hasNoZpDirective(noDir)).toBe(true);
    expect(requiresZp(noDir)).toBe(false);
    expect(forbiddenFromZp(noDir)).toBe(false);

    // @zp directive
    expect(hasNoZpDirective(zpDir)).toBe(false);
    expect(requiresZp(zpDir)).toBe(true);
    expect(forbiddenFromZp(zpDir)).toBe(false);

    // @ram directive
    expect(hasNoZpDirective(ramDir)).toBe(false);
    expect(requiresZp(ramDir)).toBe(false);
    expect(forbiddenFromZp(ramDir)).toBe(true);
  });
});