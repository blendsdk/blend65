/**
 * Operand Extraction Tests - CGT2.2
 *
 * Tests for operand extraction helper methods in CodeGeneratorBase.
 * These helpers extract specific operand types from IL instruction operands arrays.
 *
 * @module __tests__/codegen/generator/operands
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGeneratorBase } from '../../../codegen/generator/base.js';
import { ILProgram } from '../../../il/index.js';
import {
  ILOperand,
  SlotOperand,
  ImmediateOperand,
  LabelOperand,
  FunctionOperand,
  AddressOperand,
} from '../../../il/operands.js';
import { AddressingModeHint } from '../../../il/enums.js';
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
  // Expose protected operand extraction methods
  public testGetSlotOperand(operands: ILOperand[], index: number = 0): SlotOperand {
    return this.getSlotOperand(operands, index);
  }

  public testGetImmediateOperand(operands: ILOperand[], index: number = 0): ImmediateOperand {
    return this.getImmediateOperand(operands, index);
  }

  public testGetLabelOperand(operands: ILOperand[], index: number = 0): LabelOperand {
    return this.getLabelOperand(operands, index);
  }

  public testGetFunctionOperand(operands: ILOperand[], index: number = 0): FunctionOperand {
    return this.getFunctionOperand(operands, index);
  }

  public testGetAddressOperand(operands: ILOperand[], index: number = 0): AddressOperand {
    return this.getAddressOperand(operands, index);
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
 * Creates a test frame slot.
 */
function createTestSlot(name: string, options?: Partial<FrameSlot>): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE, {
    location: SlotLocation.ZeroPage,
    address: 0x50,
    ...options,
  });
}

/**
 * Creates a slot operand for testing.
 */
function createSlotOp(slot: FrameSlot, hint?: AddressingModeHint): SlotOperand {
  return {
    kind: 'slot',
    slot,
    addressingHint: hint ?? AddressingModeHint.ZeroPage,
  };
}

/**
 * Creates an immediate operand for testing.
 */
function createImmediateOp(value: number, isWord: boolean = false): ImmediateOperand {
  return {
    kind: 'immediate',
    value,
    isWord,
  };
}

/**
 * Creates a label operand for testing.
 */
function createLabelOp(name: string): LabelOperand {
  return {
    kind: 'label',
    name,
  };
}

/**
 * Creates a function operand for testing.
 */
function createFunctionOp(name: string, isCallback: boolean = false): FunctionOperand {
  return {
    kind: 'function',
    name,
    isCallback,
    coalesceGroup: 0,
  };
}

/**
 * Creates an address operand for testing.
 */
function createAddressOp(address: number, isZeroPage: boolean = false): AddressOperand {
  return {
    kind: 'address',
    address,
    isZeroPage,
  };
}

// ============================================================================
// Slot Operand Tests
// ============================================================================

describe('getSlotOperand', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  describe('valid extraction', () => {
    it('extracts slot operand at index 0', () => {
      const slot = createTestSlot('counter');
      const operands: ILOperand[] = [createSlotOp(slot)];

      const result = generator.testGetSlotOperand(operands, 0);
      expect(result.kind).toBe('slot');
      expect(result.slot).toBe(slot);
    });

    it('extracts slot operand at index 1', () => {
      const slot1 = createTestSlot('x');
      const slot2 = createTestSlot('y');
      const operands: ILOperand[] = [createSlotOp(slot1), createSlotOp(slot2)];

      const result = generator.testGetSlotOperand(operands, 1);
      expect(result.slot).toBe(slot2);
    });

    it('extracts slot operand with addressing hint', () => {
      const slot = createTestSlot('ptr');
      const operands: ILOperand[] = [createSlotOp(slot, AddressingModeHint.Absolute)];

      const result = generator.testGetSlotOperand(operands, 0);
      expect(result.addressingHint).toBe(AddressingModeHint.Absolute);
    });

    it('extracts slot operand with index offset', () => {
      const slot = createTestSlot('buffer');
      const slotOp: SlotOperand = {
        kind: 'slot',
        slot,
        addressingHint: AddressingModeHint.AbsoluteX,
        indexOffset: 5,
      };
      const operands: ILOperand[] = [slotOp];

      const result = generator.testGetSlotOperand(operands, 0);
      expect(result.indexOffset).toBe(5);
    });

    it('extracts slot operand with index slot', () => {
      const bufferSlot = createTestSlot('buffer');
      const indexSlot = createTestSlot('i');
      const slotOp: SlotOperand = {
        kind: 'slot',
        slot: bufferSlot,
        addressingHint: AddressingModeHint.AbsoluteX,
        indexSlot,
      };
      const operands: ILOperand[] = [slotOp];

      const result = generator.testGetSlotOperand(operands, 0);
      expect(result.indexSlot).toBe(indexSlot);
    });
  });

  describe('error handling', () => {
    it('throws when operand is immediate', () => {
      const operands: ILOperand[] = [createImmediateOp(42)];
      expect(() => generator.testGetSlotOperand(operands, 0)).toThrow(
        'Expected slot operand at index 0, got immediate'
      );
    });

    it('throws when operand is label', () => {
      const operands: ILOperand[] = [createLabelOp('loop')];
      expect(() => generator.testGetSlotOperand(operands, 0)).toThrow(
        'Expected slot operand at index 0, got label'
      );
    });

    it('throws when operand is function', () => {
      const operands: ILOperand[] = [createFunctionOp('add')];
      expect(() => generator.testGetSlotOperand(operands, 0)).toThrow(
        'Expected slot operand at index 0, got function'
      );
    });

    it('throws when operand is address', () => {
      const operands: ILOperand[] = [createAddressOp(0xD020)];
      expect(() => generator.testGetSlotOperand(operands, 0)).toThrow(
        'Expected slot operand at index 0, got address'
      );
    });

    it('throws when index is out of bounds', () => {
      const operands: ILOperand[] = [];
      expect(() => generator.testGetSlotOperand(operands, 0)).toThrow(
        'Expected slot operand at index 0, got undefined'
      );
    });

    it('throws with correct index in error message', () => {
      const slot = createTestSlot('x');
      const operands: ILOperand[] = [createSlotOp(slot), createImmediateOp(42)];
      expect(() => generator.testGetSlotOperand(operands, 1)).toThrow(
        'Expected slot operand at index 1, got immediate'
      );
    });
  });
});

// ============================================================================
// Immediate Operand Tests
// ============================================================================

describe('getImmediateOperand', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  describe('valid extraction', () => {
    it('extracts immediate operand at index 0', () => {
      const operands: ILOperand[] = [createImmediateOp(42)];

      const result = generator.testGetImmediateOperand(operands, 0);
      expect(result.kind).toBe('immediate');
      expect(result.value).toBe(42);
    });

    it('extracts immediate operand at index 1', () => {
      const slot = createTestSlot('x');
      const operands: ILOperand[] = [createSlotOp(slot), createImmediateOp(100)];

      const result = generator.testGetImmediateOperand(operands, 1);
      expect(result.value).toBe(100);
    });

    it('extracts byte immediate (isWord: false)', () => {
      const operands: ILOperand[] = [createImmediateOp(255, false)];

      const result = generator.testGetImmediateOperand(operands, 0);
      expect(result.isWord).toBe(false);
    });

    it('extracts word immediate (isWord: true)', () => {
      const operands: ILOperand[] = [createImmediateOp(0x1234, true)];

      const result = generator.testGetImmediateOperand(operands, 0);
      expect(result.value).toBe(0x1234);
      expect(result.isWord).toBe(true);
    });

    it('extracts immediate value 0', () => {
      const operands: ILOperand[] = [createImmediateOp(0)];

      const result = generator.testGetImmediateOperand(operands, 0);
      expect(result.value).toBe(0);
    });
  });

  describe('error handling', () => {
    it('throws when operand is slot', () => {
      const slot = createTestSlot('x');
      const operands: ILOperand[] = [createSlotOp(slot)];
      expect(() => generator.testGetImmediateOperand(operands, 0)).toThrow(
        'Expected immediate operand at index 0, got slot'
      );
    });

    it('throws when operand is label', () => {
      const operands: ILOperand[] = [createLabelOp('loop')];
      expect(() => generator.testGetImmediateOperand(operands, 0)).toThrow(
        'Expected immediate operand at index 0, got label'
      );
    });

    it('throws when index is out of bounds', () => {
      const operands: ILOperand[] = [];
      expect(() => generator.testGetImmediateOperand(operands, 0)).toThrow(
        'Expected immediate operand at index 0, got undefined'
      );
    });
  });
});

// ============================================================================
// Label Operand Tests
// ============================================================================

describe('getLabelOperand', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  describe('valid extraction', () => {
    it('extracts label operand at index 0', () => {
      const operands: ILOperand[] = [createLabelOp('loop_start')];

      const result = generator.testGetLabelOperand(operands, 0);
      expect(result.kind).toBe('label');
      expect(result.name).toBe('loop_start');
    });

    it('extracts label operand at index 1', () => {
      const slot = createTestSlot('x');
      const operands: ILOperand[] = [createSlotOp(slot), createLabelOp('end')];

      const result = generator.testGetLabelOperand(operands, 1);
      expect(result.name).toBe('end');
    });

    it('extracts label with various names', () => {
      const names = ['loop', 'if_else', 'while_body', 'func_return', '.local'];

      for (const name of names) {
        const operands: ILOperand[] = [createLabelOp(name)];
        const result = generator.testGetLabelOperand(operands, 0);
        expect(result.name).toBe(name);
      }
    });
  });

  describe('error handling', () => {
    it('throws when operand is slot', () => {
      const slot = createTestSlot('x');
      const operands: ILOperand[] = [createSlotOp(slot)];
      expect(() => generator.testGetLabelOperand(operands, 0)).toThrow(
        'Expected label operand at index 0, got slot'
      );
    });

    it('throws when operand is immediate', () => {
      const operands: ILOperand[] = [createImmediateOp(42)];
      expect(() => generator.testGetLabelOperand(operands, 0)).toThrow(
        'Expected label operand at index 0, got immediate'
      );
    });

    it('throws when index is out of bounds', () => {
      const operands: ILOperand[] = [];
      expect(() => generator.testGetLabelOperand(operands, 0)).toThrow(
        'Expected label operand at index 0, got undefined'
      );
    });
  });
});

// ============================================================================
// Function Operand Tests
// ============================================================================

describe('getFunctionOperand', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  describe('valid extraction', () => {
    it('extracts function operand at index 0', () => {
      const operands: ILOperand[] = [createFunctionOp('add')];

      const result = generator.testGetFunctionOperand(operands, 0);
      expect(result.kind).toBe('function');
      expect(result.name).toBe('add');
    });

    it('extracts function operand with isCallback true', () => {
      const operands: ILOperand[] = [createFunctionOp('irqHandler', true)];

      const result = generator.testGetFunctionOperand(operands, 0);
      expect(result.isCallback).toBe(true);
    });

    it('extracts function operand with isCallback false', () => {
      const operands: ILOperand[] = [createFunctionOp('regularFunc', false)];

      const result = generator.testGetFunctionOperand(operands, 0);
      expect(result.isCallback).toBe(false);
    });

    it('extracts function operand with coalesce group', () => {
      const funcOp: FunctionOperand = {
        kind: 'function',
        name: 'util',
        isCallback: false,
        coalesceGroup: 5,
      };
      const operands: ILOperand[] = [funcOp];

      const result = generator.testGetFunctionOperand(operands, 0);
      expect(result.coalesceGroup).toBe(5);
    });
  });

  describe('error handling', () => {
    it('throws when operand is slot', () => {
      const slot = createTestSlot('x');
      const operands: ILOperand[] = [createSlotOp(slot)];
      expect(() => generator.testGetFunctionOperand(operands, 0)).toThrow(
        'Expected function operand at index 0, got slot'
      );
    });

    it('throws when operand is label', () => {
      const operands: ILOperand[] = [createLabelOp('loop')];
      expect(() => generator.testGetFunctionOperand(operands, 0)).toThrow(
        'Expected function operand at index 0, got label'
      );
    });

    it('throws when index is out of bounds', () => {
      const operands: ILOperand[] = [];
      expect(() => generator.testGetFunctionOperand(operands, 0)).toThrow(
        'Expected function operand at index 0, got undefined'
      );
    });
  });
});

// ============================================================================
// Address Operand Tests
// ============================================================================

describe('getAddressOperand', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  describe('valid extraction', () => {
    it('extracts address operand at index 0', () => {
      const operands: ILOperand[] = [createAddressOp(0xD020)];

      const result = generator.testGetAddressOperand(operands, 0);
      expect(result.kind).toBe('address');
      expect(result.address).toBe(0xD020);
    });

    it('extracts zero page address', () => {
      const operands: ILOperand[] = [createAddressOp(0x50, true)];

      const result = generator.testGetAddressOperand(operands, 0);
      expect(result.address).toBe(0x50);
      expect(result.isZeroPage).toBe(true);
    });

    it('extracts absolute address', () => {
      const operands: ILOperand[] = [createAddressOp(0xD021, false)];

      const result = generator.testGetAddressOperand(operands, 0);
      expect(result.address).toBe(0xD021);
      expect(result.isZeroPage).toBe(false);
    });

    it('extracts address at index 1', () => {
      const slot = createTestSlot('x');
      const operands: ILOperand[] = [createSlotOp(slot), createAddressOp(0xD022)];

      const result = generator.testGetAddressOperand(operands, 1);
      expect(result.address).toBe(0xD022);
    });

    it('extracts common C64 hardware addresses', () => {
      const addresses = [
        { addr: 0xD020, name: 'border color' },
        { addr: 0xD021, name: 'background color' },
        { addr: 0xDC00, name: 'CIA1 data port A' },
        { addr: 0xDC01, name: 'CIA1 data port B' },
        { addr: 0xD000, name: 'sprite 0 X' },
      ];

      for (const { addr } of addresses) {
        const operands: ILOperand[] = [createAddressOp(addr)];
        const result = generator.testGetAddressOperand(operands, 0);
        expect(result.address).toBe(addr);
      }
    });
  });

  describe('error handling', () => {
    it('throws when operand is slot', () => {
      const slot = createTestSlot('x');
      const operands: ILOperand[] = [createSlotOp(slot)];
      expect(() => generator.testGetAddressOperand(operands, 0)).toThrow(
        'Expected address operand at index 0, got slot'
      );
    });

    it('throws when operand is immediate', () => {
      const operands: ILOperand[] = [createImmediateOp(0xD020)];
      expect(() => generator.testGetAddressOperand(operands, 0)).toThrow(
        'Expected address operand at index 0, got immediate'
      );
    });

    it('throws when index is out of bounds', () => {
      const operands: ILOperand[] = [];
      expect(() => generator.testGetAddressOperand(operands, 0)).toThrow(
        'Expected address operand at index 0, got undefined'
      );
    });
  });
});

// ============================================================================
// Mixed Operand Arrays Tests
// ============================================================================

describe('Mixed Operand Arrays', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  it('extracts from array with all operand types', () => {
    const slot = createTestSlot('x');
    const operands: ILOperand[] = [
      createSlotOp(slot),
      createImmediateOp(42),
      createLabelOp('target'),
      createFunctionOp('helper'),
      createAddressOp(0xD020),
    ];

    expect(generator.testGetSlotOperand(operands, 0).slot).toBe(slot);
    expect(generator.testGetImmediateOperand(operands, 1).value).toBe(42);
    expect(generator.testGetLabelOperand(operands, 2).name).toBe('target');
    expect(generator.testGetFunctionOperand(operands, 3).name).toBe('helper');
    expect(generator.testGetAddressOperand(operands, 4).address).toBe(0xD020);
  });

  it('handles typical POKE operands (address + immediate)', () => {
    const operands: ILOperand[] = [createAddressOp(0xD020), createImmediateOp(0)];

    const addr = generator.testGetAddressOperand(operands, 0);
    const value = generator.testGetImmediateOperand(operands, 1);

    expect(addr.address).toBe(0xD020);
    expect(value.value).toBe(0);
  });

  it('handles typical POKE operands (address + slot)', () => {
    const colorSlot = createTestSlot('color');
    const operands: ILOperand[] = [createAddressOp(0xD020), createSlotOp(colorSlot)];

    const addr = generator.testGetAddressOperand(operands, 0);
    const slot = generator.testGetSlotOperand(operands, 1);

    expect(addr.address).toBe(0xD020);
    expect(slot.slot.name).toBe('color');
  });

  it('handles typical binary operation operands (slot + slot)', () => {
    const leftSlot = createTestSlot('left');
    const rightSlot = createTestSlot('right');
    const operands: ILOperand[] = [createSlotOp(leftSlot), createSlotOp(rightSlot)];

    const left = generator.testGetSlotOperand(operands, 0);
    const right = generator.testGetSlotOperand(operands, 1);

    expect(left.slot.name).toBe('left');
    expect(right.slot.name).toBe('right');
  });

  it('handles typical binary operation operands (slot + immediate)', () => {
    const xSlot = createTestSlot('x');
    const operands: ILOperand[] = [createSlotOp(xSlot), createImmediateOp(5)];

    const slot = generator.testGetSlotOperand(operands, 0);
    const imm = generator.testGetImmediateOperand(operands, 1);

    expect(slot.slot.name).toBe('x');
    expect(imm.value).toBe(5);
  });
});

// ============================================================================
// Default Index Tests
// ============================================================================

describe('Default Index Parameter', () => {
  let generator: TestableCodeGeneratorBase;

  beforeEach(() => {
    generator = new TestableCodeGeneratorBase('test');
  });

  it('getSlotOperand defaults to index 0', () => {
    const slot = createTestSlot('x');
    const operands: ILOperand[] = [createSlotOp(slot)];

    // Call without index parameter
    const result = generator.testGetSlotOperand(operands);
    expect(result.slot).toBe(slot);
  });

  it('getImmediateOperand defaults to index 0', () => {
    const operands: ILOperand[] = [createImmediateOp(42)];

    const result = generator.testGetImmediateOperand(operands);
    expect(result.value).toBe(42);
  });

  it('getLabelOperand defaults to index 0', () => {
    const operands: ILOperand[] = [createLabelOp('target')];

    const result = generator.testGetLabelOperand(operands);
    expect(result.name).toBe('target');
  });

  it('getFunctionOperand defaults to index 0', () => {
    const operands: ILOperand[] = [createFunctionOp('helper')];

    const result = generator.testGetFunctionOperand(operands);
    expect(result.name).toBe('helper');
  });

  it('getAddressOperand defaults to index 0', () => {
    const operands: ILOperand[] = [createAddressOp(0xD020)];

    const result = generator.testGetAddressOperand(operands);
    expect(result.address).toBe(0xD020);
  });
});