/**
 * Tests: DataSegmentBuilder
 *
 * Verifies that the DataSegmentBuilder correctly:
 * - Evaluates constant initializers (numeric, boolean, expressions)
 * - Packs scalar values into byte/word representations
 * - Packs array literals into sequential bytes
 * - Handles multiple @data entries sorted by address
 * - Reports errors for missing initializers
 *
 * Uses lightweight mock Expression objects that implement the minimal
 * interface needed by the constant evaluator (getNodeType, getValue, etc.).
 *
 * @module __tests__/codegen/data-segment
 */

import { describe, it, expect } from 'vitest';
import { DataSegmentBuilder } from '../../codegen/data-segment.js';
import { createGlobalSlot } from '../../frame/types-global.js';
import type { GlobalSlot } from '../../frame/types-global.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';
import { ASTNodeType, type Expression } from '../../ast/base.js';

// ============================================================================
// Mock Expression Factories
// ============================================================================

/**
 * Creates a mock NumericLiteral expression.
 * Implements the minimal interface used by DataSegmentBuilder.
 */
function mockNumericLiteral(value: number): Expression {
  return {
    getNodeType: () => ASTNodeType.LITERAL_EXPR,
    getValue: () => value,
  } as unknown as Expression;
}

/**
 * Creates a mock BooleanLiteral expression.
 */
function mockBooleanLiteral(value: boolean): Expression {
  return {
    getNodeType: () => ASTNodeType.LITERAL_EXPR,
    getValue: () => value,
  } as unknown as Expression;
}

/**
 * Creates a mock UnaryExpression.
 */
function mockUnaryExpression(operator: string, operand: Expression): Expression {
  return {
    getNodeType: () => 'UnaryExpression',
    getOperator: () => operator,
    getOperand: () => operand,
  } as unknown as Expression;
}

/**
 * Creates a mock BinaryExpression.
 */
function mockBinaryExpression(operator: string, left: Expression, right: Expression): Expression {
  return {
    getNodeType: () => 'BinaryExpression',
    getOperator: () => operator,
    getLeft: () => left,
    getRight: () => right,
  } as unknown as Expression;
}

/**
 * Creates a mock ArrayLiteral expression.
 */
function mockArrayLiteral(elements: Expression[]): Expression {
  return {
    getNodeType: () => ASTNodeType.ARRAY_LITERAL_EXPR,
    getElements: () => elements,
  } as unknown as Expression;
}

// ============================================================================
// Helper: Create @data GlobalSlot
// ============================================================================

/**
 * Creates a @data global slot with an initializer for testing.
 */
function createDataSlot(
  name: string,
  address: number,
  initializer: Expression,
  options?: { size?: number; moduleName?: string },
): GlobalSlot {
  const slot = createGlobalSlot(
    name,
    options?.moduleName ?? 'Test',
    'data',
    BUILTIN_TYPES.BYTE,
    options?.size ?? 1,
    { isConst: true, initializer },
  );
  // Assign the address (normally done by GlobalAllocator)
  slot.address = address;
  return slot;
}

/**
 * Creates a @data word global slot with initializer.
 */
function createDataWordSlot(
  name: string,
  address: number,
  initializer: Expression,
): GlobalSlot {
  const slot = createGlobalSlot(
    name,
    'Test',
    'data',
    BUILTIN_TYPES.WORD,
    2,
    { isConst: true, initializer },
  );
  slot.address = address;
  return slot;
}

// ============================================================================
// Tests: Scalar Constant Evaluation
// ============================================================================

describe('DataSegmentBuilder: Scalar Constants', () => {
  it('should pack a byte numeric literal', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    const slot = createDataSlot('myConst', 0x2000, mockNumericLiteral(42));
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.errors).toHaveLength(0);
    expect(result.totalSize).toBe(1);
    expect(result.bytes).toEqual(Uint8Array.from([42]));
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].name).toBe('myConst');
    expect(result.entries[0].address).toBe(0x2000);
  });

  it('should pack hex value ($FF → 255)', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    const slot = createDataSlot('mask', 0x2000, mockNumericLiteral(0xFF));
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.errors).toHaveLength(0);
    expect(result.bytes).toEqual(Uint8Array.from([0xFF]));
  });

  it('should pack zero value', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    const slot = createDataSlot('zero', 0x2000, mockNumericLiteral(0));
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.bytes).toEqual(Uint8Array.from([0]));
  });

  it('should pack word value as little-endian', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    const slot = createDataWordSlot('addr', 0x2000, mockNumericLiteral(0x1234));
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.errors).toHaveLength(0);
    expect(result.totalSize).toBe(2);
    // Little-endian: low byte first
    expect(result.bytes).toEqual(Uint8Array.from([0x34, 0x12]));
  });

  it('should pack boolean true as 1', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    const slot = createDataSlot('flag', 0x2000, mockBooleanLiteral(true));
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.bytes).toEqual(Uint8Array.from([1]));
  });

  it('should pack boolean false as 0', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    const slot = createDataSlot('flag', 0x2000, mockBooleanLiteral(false));
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.bytes).toEqual(Uint8Array.from([0]));
  });

  it('should evaluate negation (-42)', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    const expr = mockUnaryExpression('-', mockNumericLiteral(42));
    const slot = createDataSlot('neg', 0x2000, expr);
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    // -42 masked to byte range: (-42) & 0xFF = 214
    expect(result.bytes).toEqual(Uint8Array.from([(-42) & 0xFF]));
  });

  it('should evaluate binary addition (10 + 20)', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    const expr = mockBinaryExpression('+', mockNumericLiteral(10), mockNumericLiteral(20));
    const slot = createDataSlot('sum', 0x2000, expr);
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.bytes).toEqual(Uint8Array.from([30]));
  });

  it('should evaluate bitwise OR ($F0 | $0F = $FF)', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    const expr = mockBinaryExpression('|', mockNumericLiteral(0xF0), mockNumericLiteral(0x0F));
    const slot = createDataSlot('bits', 0x2000, expr);
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.bytes).toEqual(Uint8Array.from([0xFF]));
  });
});

// ============================================================================
// Tests: Array Packing
// ============================================================================

describe('DataSegmentBuilder: Array Packing', () => {
  it('should pack a simple byte array', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    const elements = [1, 2, 3, 4, 5].map(v => mockNumericLiteral(v));
    const slot = createDataSlot('colors', 0x2000, mockArrayLiteral(elements), { size: 5 });
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.errors).toHaveLength(0);
    expect(result.totalSize).toBe(5);
    expect(result.bytes).toEqual(Uint8Array.from([1, 2, 3, 4, 5]));
  });

  it('should pack hex values in array', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    const elements = [0x00, 0xFF, 0xAA, 0x55].map(v => mockNumericLiteral(v));
    const slot = createDataSlot('pattern', 0x2000, mockArrayLiteral(elements), { size: 4 });
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.bytes).toEqual(Uint8Array.from([0x00, 0xFF, 0xAA, 0x55]));
  });

  it('should pack a 63-byte sprite array', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    // Create 63-byte sprite data (typical C64 sprite)
    const spriteBytes = Array.from({ length: 63 }, (_, i) => i % 256);
    const elements = spriteBytes.map(v => mockNumericLiteral(v));
    const slot = createDataSlot('sprite', 0x2000, mockArrayLiteral(elements), { size: 63 });
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.totalSize).toBe(63);
    expect(result.bytes.length).toBe(63);
    expect(result.bytes[0]).toBe(0);
    expect(result.bytes[62]).toBe(62);
  });

  it('should pack empty array as zero bytes', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();
    const slot = createDataSlot('empty', 0x2000, mockArrayLiteral([]), { size: 0 });
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.totalSize).toBe(0);
    expect(result.bytes.length).toBe(0);
  });
});

// ============================================================================
// Tests: Multiple Entries
// ============================================================================

describe('DataSegmentBuilder: Multiple Entries', () => {
  it('should concatenate multiple @data entries by address order', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();

    // Two entries at different addresses
    const slot1 = createDataSlot('first', 0x2000, mockNumericLiteral(0xAA));
    const slot2 = createDataSlot('second', 0x2001, mockNumericLiteral(0xBB));
    globals.set(slot1.qualifiedName, slot1);
    globals.set(slot2.qualifiedName, slot2);

    const result = builder.build(globals);

    expect(result.totalSize).toBe(2);
    expect(result.bytes).toEqual(Uint8Array.from([0xAA, 0xBB]));
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].address).toBe(0x2000);
    expect(result.entries[1].address).toBe(0x2001);
  });

  it('should only process @data globals (ignore @zp, @ram, default)', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();

    // @data entry
    const dataSlot = createDataSlot('myData', 0x2000, mockNumericLiteral(42));
    globals.set(dataSlot.qualifiedName, dataSlot);

    // @zp entry (should be ignored)
    const zpSlot = createGlobalSlot('fast', 'Test', 'zp', BUILTIN_TYPES.BYTE, 1, {
      initializer: mockNumericLiteral(0),
    });
    zpSlot.address = 0x02;
    globals.set(zpSlot.qualifiedName, zpSlot);

    // @ram entry (should be ignored)
    const ramSlot = createGlobalSlot('counter', 'Test', 'ram', BUILTIN_TYPES.BYTE, 1, {
      initializer: mockNumericLiteral(0),
    });
    ramSlot.address = 0x0400;
    globals.set(ramSlot.qualifiedName, ramSlot);

    const result = builder.build(globals);

    // Only the @data entry should be in the result
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].name).toBe('myData');
    expect(result.totalSize).toBe(1);
  });

  it('should sort entries by address regardless of insertion order', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();

    // Insert in reverse address order
    const slot3 = createDataSlot('third', 0x2010, mockNumericLiteral(0xCC), { moduleName: 'A' });
    const slot1 = createDataSlot('first', 0x2000, mockNumericLiteral(0xAA), { moduleName: 'B' });
    const slot2 = createDataSlot('second', 0x2005, mockNumericLiteral(0xBB), { moduleName: 'C' });
    globals.set(slot3.qualifiedName, slot3);
    globals.set(slot1.qualifiedName, slot1);
    globals.set(slot2.qualifiedName, slot2);

    const result = builder.build(globals);

    expect(result.entries[0].address).toBe(0x2000);
    expect(result.entries[1].address).toBe(0x2005);
    expect(result.entries[2].address).toBe(0x2010);
    expect(result.bytes).toEqual(Uint8Array.from([0xAA, 0xBB, 0xCC]));
  });
});

// ============================================================================
// Tests: Error Handling
// ============================================================================

describe('DataSegmentBuilder: Error Handling', () => {
  it('should report error for @data without initializer', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();

    // Create @data slot without initializer
    const slot = createGlobalSlot('noInit', 'Test', 'data', BUILTIN_TYPES.BYTE, 1, {
      isConst: true,
      // no initializer
    });
    slot.address = 0x2000;
    globals.set(slot.qualifiedName, slot);

    const result = builder.build(globals);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('no initializer');
    expect(result.entries).toHaveLength(0);
    expect(result.totalSize).toBe(0);
  });

  it('should return empty result for no @data globals', () => {
    const builder = new DataSegmentBuilder();
    const globals = new Map<string, GlobalSlot>();

    const result = builder.build(globals);

    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(0);
    expect(result.totalSize).toBe(0);
    expect(result.bytes.length).toBe(0);
  });
});
