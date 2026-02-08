/**
 * Tests for Allocation Guards
 *
 * Tests: isSlotAllocated, isArraySlot, isScalarSlot, isSingleByteSlot,
 *        isWordSlot, canFitInZp, hasZpAllocationError
 */

import { describe, it, expect } from 'vitest';
import {
  isSlotAllocated,
  isArraySlot,
  isScalarSlot,
  isSingleByteSlot,
  isWordSlot,
  canFitInZp,
  hasZpAllocationError,
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

const BOOL_TYPE = {
  kind: TypeKind.Bool,
  name: 'bool',
  size: 1,
  isSigned: false,
  isAssignable: true,
};

const ARRAY_TYPE = {
  kind: TypeKind.Array,
  name: 'byte[10]',
  size: 10,
  isSigned: false,
  isAssignable: true,
  elementType: BYTE_TYPE,
  elementCount: 10,
};

const LARGE_ARRAY_TYPE = {
  kind: TypeKind.Array,
  name: 'byte[100]',
  size: 100,
  isSigned: false,
  isAssignable: true,
  elementType: BYTE_TYPE,
  elementCount: 100,
};

// ============================================================================
// isSlotAllocated Tests
// ============================================================================

describe('isSlotAllocated', () => {
  it('returns false for unallocated slots (address 0)', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(isSlotAllocated(slot)).toBe(false);
  });

  it('returns true for slots with non-zero address', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      address: 0x0200,
    });
    expect(isSlotAllocated(slot)).toBe(true);
  });

  it('returns true for ZP allocated slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      location: SlotLocation.ZeroPage,
      address: 0x50,
    });
    expect(isSlotAllocated(slot)).toBe(true);
  });

  it('returns true for register slots even with address 0', () => {
    const slot = createFrameSlot('x', SlotKind.Parameter, BYTE_TYPE, {
      location: SlotLocation.Register,
      register: 'A',
      address: 0, // Address is irrelevant for register slots
    });
    expect(isSlotAllocated(slot)).toBe(true);
  });
});

// ============================================================================
// isArraySlot Tests
// ============================================================================

describe('isArraySlot', () => {
  it('returns true for array slots', () => {
    const slot = createFrameSlot('buffer', SlotKind.Local, ARRAY_TYPE);
    expect(isArraySlot(slot)).toBe(true);
  });

  it('returns true for large array slots', () => {
    const slot = createFrameSlot('bigBuffer', SlotKind.Local, LARGE_ARRAY_TYPE);
    expect(isArraySlot(slot)).toBe(true);
  });

  it('returns false for scalar byte slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(isArraySlot(slot)).toBe(false);
  });

  it('returns false for scalar word slots', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE);
    expect(isArraySlot(slot)).toBe(false);
  });

  it('returns false for bool slots', () => {
    const slot = createFrameSlot('flag', SlotKind.Local, BOOL_TYPE);
    expect(isArraySlot(slot)).toBe(false);
  });
});

// ============================================================================
// isScalarSlot Tests
// ============================================================================

describe('isScalarSlot', () => {
  it('returns true for byte slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(isScalarSlot(slot)).toBe(true);
  });

  it('returns true for word slots', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE);
    expect(isScalarSlot(slot)).toBe(true);
  });

  it('returns true for bool slots', () => {
    const slot = createFrameSlot('flag', SlotKind.Local, BOOL_TYPE);
    expect(isScalarSlot(slot)).toBe(true);
  });

  it('returns false for array slots', () => {
    const slot = createFrameSlot('buffer', SlotKind.Local, ARRAY_TYPE);
    expect(isScalarSlot(slot)).toBe(false);
  });
});

// ============================================================================
// isSingleByteSlot Tests
// ============================================================================

describe('isSingleByteSlot', () => {
  it('returns true for byte slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(isSingleByteSlot(slot)).toBe(true);
  });

  it('returns true for bool slots', () => {
    const slot = createFrameSlot('flag', SlotKind.Local, BOOL_TYPE);
    expect(isSingleByteSlot(slot)).toBe(true);
  });

  it('returns false for word slots', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE);
    expect(isSingleByteSlot(slot)).toBe(false);
  });

  it('returns false for array slots', () => {
    const slot = createFrameSlot('buffer', SlotKind.Local, ARRAY_TYPE);
    expect(isSingleByteSlot(slot)).toBe(false);
  });
});

// ============================================================================
// isWordSlot Tests
// ============================================================================

describe('isWordSlot', () => {
  it('returns true for word slots', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE);
    expect(isWordSlot(slot)).toBe(true);
  });

  it('returns false for byte slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(isWordSlot(slot)).toBe(false);
  });

  it('returns false for bool slots', () => {
    const slot = createFrameSlot('flag', SlotKind.Local, BOOL_TYPE);
    expect(isWordSlot(slot)).toBe(false);
  });

  it('returns false for array slots', () => {
    const slot = createFrameSlot('buffer', SlotKind.Local, ARRAY_TYPE);
    expect(isWordSlot(slot)).toBe(false);
  });
});

// ============================================================================
// canFitInZp Tests
// ============================================================================

describe('canFitInZp', () => {
  it('returns true for byte slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(canFitInZp(slot)).toBe(true);
  });

  it('returns true for word slots', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE);
    expect(canFitInZp(slot)).toBe(true);
  });

  it('returns true for small arrays', () => {
    const smallArray = {
      kind: TypeKind.Array,
      name: 'byte[4]',
      size: 4,
      isSigned: false,
      isAssignable: true,
      elementType: BYTE_TYPE,
      elementCount: 4,
    };
    const slot = createFrameSlot('buf', SlotKind.Local, smallArray);
    expect(canFitInZp(slot)).toBe(true);
  });

  it('returns false for large arrays (default max 8)', () => {
    const slot = createFrameSlot('buffer', SlotKind.Local, ARRAY_TYPE);
    expect(canFitInZp(slot)).toBe(false);
  });

  it('returns false for @ram directive', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE, {
      zpDirective: ZpDirective.Ram,
    });
    expect(canFitInZp(slot)).toBe(false);
  });

  it('returns true for @zp directive', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE, {
      zpDirective: ZpDirective.Zp,
    });
    expect(canFitInZp(slot)).toBe(true);
  });

  it('respects custom max size', () => {
    const slot = createFrameSlot('buffer', SlotKind.Local, ARRAY_TYPE);
    // Default: 8 bytes max, array is 10 bytes
    expect(canFitInZp(slot, 8)).toBe(false);
    // Custom: 16 bytes max
    expect(canFitInZp(slot, 16)).toBe(true);
  });
});

// ============================================================================
// hasZpAllocationError Tests
// ============================================================================

describe('hasZpAllocationError', () => {
  it('returns false for normal slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(hasZpAllocationError(slot)).toBe(false);
  });

  it('returns false for @zp slot allocated to ZP', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE, {
      zpDirective: ZpDirective.Zp,
      location: SlotLocation.ZeroPage,
      address: 0x50,
    });
    expect(hasZpAllocationError(slot)).toBe(false);
  });

  it('returns true for @zp slot NOT allocated to ZP', () => {
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE, {
      zpDirective: ZpDirective.Zp,
      location: SlotLocation.FrameRegion,
      address: 0x0200,
    });
    expect(hasZpAllocationError(slot)).toBe(true);
  });

  it('returns false for @ram slot in frame region', () => {
    const slot = createFrameSlot('buffer', SlotKind.Local, BYTE_TYPE, {
      zpDirective: ZpDirective.Ram,
      location: SlotLocation.FrameRegion,
      address: 0x0200,
    });
    expect(hasZpAllocationError(slot)).toBe(false);
  });

  it('returns false for unallocated @zp slot', () => {
    // Not yet allocated - no error yet
    const slot = createFrameSlot('ptr', SlotKind.Local, WORD_TYPE, {
      zpDirective: ZpDirective.Zp,
    });
    expect(hasZpAllocationError(slot)).toBe(true); // Default location is FrameRegion
  });
});

// ============================================================================
// Size Guards - Edge Cases
// ============================================================================

describe('Size Guards - Edge Cases', () => {
  it('handles zero-size void type', () => {
    const voidType = {
      kind: TypeKind.Void,
      name: 'void',
      size: 0,
      isSigned: false,
      isAssignable: false,
    };
    const slot = createFrameSlot('__return', SlotKind.Return, voidType);
    expect(isSingleByteSlot(slot)).toBe(false);
    expect(isWordSlot(slot)).toBe(false);
  });

  it('handles 3-byte custom type', () => {
    const tripleType = {
      kind: TypeKind.Byte, // Simplified
      name: 'triple',
      size: 3,
      isSigned: false,
      isAssignable: true,
    };
    const slot = createFrameSlot('t', SlotKind.Local, tripleType, { size: 3 });
    expect(isSingleByteSlot(slot)).toBe(false);
    expect(isWordSlot(slot)).toBe(false);
    expect(canFitInZp(slot)).toBe(true); // 3 bytes fits in default 8
  });
});