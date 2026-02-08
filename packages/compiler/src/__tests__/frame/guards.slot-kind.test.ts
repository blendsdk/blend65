/**
 * Tests for Slot Kind Guards
 *
 * Tests: isParameterSlot, isLocalSlot, isReturnSlot, isTemporarySlot,
 *        isValidSlotKind
 */

import { describe, it, expect } from 'vitest';
import {
  isParameterSlot,
  isLocalSlot,
  isReturnSlot,
  isTemporarySlot,
  isValidSlotKind,
  createFrameSlot,
  createReturnSlot,
  createTemporarySlot,
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
// isParameterSlot Tests
// ============================================================================

describe('isParameterSlot', () => {
  it('returns true for parameter slots', () => {
    const slot = createFrameSlot('x', SlotKind.Parameter, BYTE_TYPE);
    expect(isParameterSlot(slot)).toBe(true);
  });

  it('returns false for local slots', () => {
    const slot = createFrameSlot('x', SlotKind.Local, BYTE_TYPE);
    expect(isParameterSlot(slot)).toBe(false);
  });

  it('returns false for return slots', () => {
    const slot = createReturnSlot(BYTE_TYPE);
    expect(isParameterSlot(slot)).toBe(false);
  });

  it('returns false for temporary slots', () => {
    const slot = createTemporarySlot(0, BYTE_TYPE);
    expect(isParameterSlot(slot)).toBe(false);
  });
});

// ============================================================================
// isLocalSlot Tests
// ============================================================================

describe('isLocalSlot', () => {
  it('returns true for local slots', () => {
    const slot = createFrameSlot('counter', SlotKind.Local, BYTE_TYPE);
    expect(isLocalSlot(slot)).toBe(true);
  });

  it('returns false for parameter slots', () => {
    const slot = createFrameSlot('x', SlotKind.Parameter, BYTE_TYPE);
    expect(isLocalSlot(slot)).toBe(false);
  });

  it('returns false for return slots', () => {
    const slot = createReturnSlot(WORD_TYPE);
    expect(isLocalSlot(slot)).toBe(false);
  });

  it('returns false for temporary slots', () => {
    const slot = createTemporarySlot(1, WORD_TYPE);
    expect(isLocalSlot(slot)).toBe(false);
  });
});

// ============================================================================
// isReturnSlot Tests
// ============================================================================

describe('isReturnSlot', () => {
  it('returns true for return slots', () => {
    const slot = createReturnSlot(BYTE_TYPE);
    expect(isReturnSlot(slot)).toBe(true);
  });

  it('returns true for manually created return slot', () => {
    const slot = createFrameSlot('__return', SlotKind.Return, WORD_TYPE);
    expect(isReturnSlot(slot)).toBe(true);
  });

  it('returns false for parameter slots', () => {
    const slot = createFrameSlot('x', SlotKind.Parameter, BYTE_TYPE);
    expect(isReturnSlot(slot)).toBe(false);
  });

  it('returns false for local slots', () => {
    const slot = createFrameSlot('result', SlotKind.Local, BYTE_TYPE);
    expect(isReturnSlot(slot)).toBe(false);
  });

  it('returns false for temporary slots', () => {
    const slot = createTemporarySlot(0, BYTE_TYPE);
    expect(isReturnSlot(slot)).toBe(false);
  });
});

// ============================================================================
// isTemporarySlot Tests
// ============================================================================

describe('isTemporarySlot', () => {
  it('returns true for temporary slots', () => {
    const slot = createTemporarySlot(0, BYTE_TYPE);
    expect(isTemporarySlot(slot)).toBe(true);
  });

  it('returns true for manually created temporary', () => {
    const slot = createFrameSlot('__temp_5', SlotKind.Temporary, WORD_TYPE);
    expect(isTemporarySlot(slot)).toBe(true);
  });

  it('returns false for parameter slots', () => {
    const slot = createFrameSlot('x', SlotKind.Parameter, BYTE_TYPE);
    expect(isTemporarySlot(slot)).toBe(false);
  });

  it('returns false for local slots', () => {
    const slot = createFrameSlot('temp', SlotKind.Local, BYTE_TYPE);
    expect(isTemporarySlot(slot)).toBe(false);
  });

  it('returns false for return slots', () => {
    const slot = createReturnSlot(BYTE_TYPE);
    expect(isTemporarySlot(slot)).toBe(false);
  });
});

// ============================================================================
// isValidSlotKind Tests
// ============================================================================

describe('isValidSlotKind', () => {
  it('returns true for Parameter', () => {
    expect(isValidSlotKind(SlotKind.Parameter)).toBe(true);
  });

  it('returns true for Local', () => {
    expect(isValidSlotKind(SlotKind.Local)).toBe(true);
  });

  it('returns true for Return', () => {
    expect(isValidSlotKind(SlotKind.Return)).toBe(true);
  });

  it('returns true for Temporary', () => {
    expect(isValidSlotKind(SlotKind.Temporary)).toBe(true);
  });

  it('returns false for invalid number', () => {
    expect(isValidSlotKind(99)).toBe(false);
    expect(isValidSlotKind(-1)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isValidSlotKind('Parameter')).toBe(false);
    expect(isValidSlotKind('invalid')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isValidSlotKind(null)).toBe(false);
    expect(isValidSlotKind(undefined)).toBe(false);
  });

  it('returns false for object', () => {
    expect(isValidSlotKind({})).toBe(false);
    expect(isValidSlotKind({ kind: SlotKind.Local })).toBe(false);
  });
});

// ============================================================================
// Cross-Kind Tests
// ============================================================================

describe('Slot Kind Guards - Cross Tests', () => {
  it('each slot matches exactly one kind guard', () => {
    const parameter = createFrameSlot('p', SlotKind.Parameter, BYTE_TYPE);
    const local = createFrameSlot('l', SlotKind.Local, BYTE_TYPE);
    const ret = createReturnSlot(BYTE_TYPE);
    const temp = createTemporarySlot(0, BYTE_TYPE);

    // Parameter
    expect(isParameterSlot(parameter)).toBe(true);
    expect(isLocalSlot(parameter)).toBe(false);
    expect(isReturnSlot(parameter)).toBe(false);
    expect(isTemporarySlot(parameter)).toBe(false);

    // Local
    expect(isParameterSlot(local)).toBe(false);
    expect(isLocalSlot(local)).toBe(true);
    expect(isReturnSlot(local)).toBe(false);
    expect(isTemporarySlot(local)).toBe(false);

    // Return
    expect(isParameterSlot(ret)).toBe(false);
    expect(isLocalSlot(ret)).toBe(false);
    expect(isReturnSlot(ret)).toBe(true);
    expect(isTemporarySlot(ret)).toBe(false);

    // Temporary
    expect(isParameterSlot(temp)).toBe(false);
    expect(isLocalSlot(temp)).toBe(false);
    expect(isReturnSlot(temp)).toBe(false);
    expect(isTemporarySlot(temp)).toBe(true);
  });
});