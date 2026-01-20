/**
 * IL Values Test Suite
 *
 * Tests for the IL value system including:
 * - VirtualRegister class (creation, toString, equals)
 * - ILConstant interface (creation, properties)
 * - ILLabel interface (creation, properties)
 * - Type guards (isVirtualRegister, isILConstant, isILLabel)
 * - ILValueFactory (register/constant/label creation)
 * - Utility functions (valueToString, getValueType)
 *
 * @module il/values.test
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  VirtualRegister,
  ILValueFactory,
  isVirtualRegister,
  isILConstant,
  isILLabel,
  valueToString,
  getValueType,
  type ILConstant,
  type ILLabel,
} from '../../il/values.js';
import { IL_BYTE, IL_WORD, IL_BOOL, IL_VOID, createArrayType } from '../../il/types.js';

// =============================================================================
// VirtualRegister Class
// =============================================================================

describe('VirtualRegister', () => {
  describe('construction', () => {
    it('should create register with id and type', () => {
      const reg = new VirtualRegister(0, IL_BYTE);
      expect(reg.id).toBe(0);
      expect(reg.type).toBe(IL_BYTE);
      expect(reg.name).toBeUndefined();
    });

    it('should create register with optional name', () => {
      const reg = new VirtualRegister(1, IL_BYTE, 'counter');
      expect(reg.id).toBe(1);
      expect(reg.type).toBe(IL_BYTE);
      expect(reg.name).toBe('counter');
    });

    it('should create register with word type', () => {
      const reg = new VirtualRegister(2, IL_WORD);
      expect(reg.type).toBe(IL_WORD);
    });

    it('should create register with bool type', () => {
      const reg = new VirtualRegister(3, IL_BOOL);
      expect(reg.type).toBe(IL_BOOL);
    });

    it('should create register with array type', () => {
      const arrType = createArrayType(IL_BYTE, 10);
      const reg = new VirtualRegister(4, arrType);
      expect(reg.type).toBe(arrType);
    });

    it('should handle sequential register IDs', () => {
      const reg0 = new VirtualRegister(0, IL_BYTE);
      const reg1 = new VirtualRegister(1, IL_BYTE);
      const reg2 = new VirtualRegister(2, IL_BYTE);
      expect(reg0.id).toBe(0);
      expect(reg1.id).toBe(1);
      expect(reg2.id).toBe(2);
    });

    it('should handle large register IDs', () => {
      const reg = new VirtualRegister(1000, IL_BYTE);
      expect(reg.id).toBe(1000);
    });

    it('should handle special characters in name', () => {
      const reg = new VirtualRegister(0, IL_BYTE, '_internal_var');
      expect(reg.name).toBe('_internal_var');
    });
  });

  describe('toString()', () => {
    it('should format register without name as "v{id}"', () => {
      const reg = new VirtualRegister(0, IL_BYTE);
      expect(reg.toString()).toBe('v0');
    });

    it('should format register with name as "v{id}:{name}"', () => {
      const reg = new VirtualRegister(5, IL_WORD, 'counter');
      expect(reg.toString()).toBe('v5:counter');
    });

    it('should handle large IDs in toString', () => {
      const reg = new VirtualRegister(999, IL_BYTE);
      expect(reg.toString()).toBe('v999');
    });
  });

  describe('equals()', () => {
    it('should return true for same id registers', () => {
      const reg1 = new VirtualRegister(0, IL_BYTE);
      const reg2 = new VirtualRegister(0, IL_WORD); // Same ID, different type
      expect(reg1.equals(reg2)).toBe(true);
    });

    it('should return false for different id registers', () => {
      const reg1 = new VirtualRegister(0, IL_BYTE);
      const reg2 = new VirtualRegister(1, IL_BYTE);
      expect(reg1.equals(reg2)).toBe(false);
    });

    it('should return true for self comparison', () => {
      const reg = new VirtualRegister(0, IL_BYTE, 'x');
      expect(reg.equals(reg)).toBe(true);
    });
  });

  describe('readonly properties', () => {
    it('should have readonly id', () => {
      const reg = new VirtualRegister(0, IL_BYTE);
      // TypeScript enforces readonly at compile time
      expect(reg.id).toBe(0);
    });

    it('should have readonly type', () => {
      const reg = new VirtualRegister(0, IL_BYTE);
      expect(reg.type).toBe(IL_BYTE);
    });

    it('should have readonly name', () => {
      const reg = new VirtualRegister(0, IL_BYTE, 'x');
      expect(reg.name).toBe('x');
    });
  });
});

// =============================================================================
// ILConstant Creation
// =============================================================================

describe('ILConstant', () => {
  let factory: ILValueFactory;

  beforeEach(() => {
    factory = new ILValueFactory();
  });

  describe('creation', () => {
    it('should create byte constant with value 0', () => {
      const c = factory.createConstant(0, IL_BYTE);
      expect(c.kind).toBe('constant');
      expect(c.value).toBe(0);
      expect(c.type).toBe(IL_BYTE);
    });

    it('should create byte constant with value 255', () => {
      const c = factory.createConstant(255, IL_BYTE);
      expect(c.value).toBe(255);
      expect(c.type).toBe(IL_BYTE);
    });

    it('should create word constant with value 0', () => {
      const c = factory.createConstant(0, IL_WORD);
      expect(c.value).toBe(0);
      expect(c.type).toBe(IL_WORD);
    });

    it('should create word constant with value 65535', () => {
      const c = factory.createConstant(65535, IL_WORD);
      expect(c.value).toBe(65535);
      expect(c.type).toBe(IL_WORD);
    });

    it('should create bool constant (true = 1)', () => {
      const c = factory.createConstant(1, IL_BOOL);
      expect(c.value).toBe(1);
      expect(c.type).toBe(IL_BOOL);
    });

    it('should create bool constant (false = 0)', () => {
      const c = factory.createConstant(0, IL_BOOL);
      expect(c.value).toBe(0);
      expect(c.type).toBe(IL_BOOL);
    });

    it('should allow negative constant values', () => {
      // IL allows negative values - validation happens elsewhere
      const c = factory.createConstant(-1, IL_BYTE);
      expect(c.value).toBe(-1);
    });
  });

  describe('immutability', () => {
    it('should return frozen constant', () => {
      const c = factory.createConstant(42, IL_BYTE);
      expect(Object.isFrozen(c)).toBe(true);
    });
  });
});

// =============================================================================
// ILLabel Creation
// =============================================================================

describe('ILLabel', () => {
  let factory: ILValueFactory;

  beforeEach(() => {
    factory = new ILValueFactory();
  });

  describe('createLabel', () => {
    it('should create label with name and blockId', () => {
      const label = factory.createLabel('entry');
      expect(label.kind).toBe('label');
      expect(label.name).toBe('entry');
      expect(label.blockId).toBe(0);
    });

    it('should increment block ID for sequential labels', () => {
      const label1 = factory.createLabel('block1');
      const label2 = factory.createLabel('block2');
      expect(label1.blockId).toBe(0);
      expect(label2.blockId).toBe(1);
    });

    it('should handle labels with special characters', () => {
      const label = factory.createLabel('_internal_block');
      expect(label.name).toBe('_internal_block');
    });

    it('should handle labels with numeric suffix', () => {
      const label = factory.createLabel('loop_123');
      expect(label.name).toBe('loop_123');
    });

    it('should return frozen label', () => {
      const label = factory.createLabel('test');
      expect(Object.isFrozen(label)).toBe(true);
    });
  });

  describe('createUniqueLabel', () => {
    it('should create label with prefix and unique suffix', () => {
      const label = factory.createUniqueLabel('loop_start');
      expect(label.name).toBe('loop_start_0');
      expect(label.blockId).toBe(0);
    });

    it('should increment ID for sequential unique labels', () => {
      const label1 = factory.createUniqueLabel('block');
      const label2 = factory.createUniqueLabel('block');
      expect(label1.name).toBe('block_0');
      expect(label2.name).toBe('block_1');
    });

    it('should return frozen label', () => {
      const label = factory.createUniqueLabel('test');
      expect(Object.isFrozen(label)).toBe(true);
    });
  });

  describe('createLabelForBlock', () => {
    it('should create label with specific block ID', () => {
      const label = factory.createLabelForBlock('existing_block', 42);
      expect(label.name).toBe('existing_block');
      expect(label.blockId).toBe(42);
    });

    it('should not increment internal counter', () => {
      factory.createLabelForBlock('block', 100);
      const nextLabel = factory.createLabel('next');
      expect(nextLabel.blockId).toBe(0); // Counter wasn't incremented
    });

    it('should return frozen label', () => {
      const label = factory.createLabelForBlock('test', 0);
      expect(Object.isFrozen(label)).toBe(true);
    });
  });
});

// =============================================================================
// Type Guards
// =============================================================================

describe('Type Guards', () => {
  let factory: ILValueFactory;
  let register: VirtualRegister;
  let constant: ILConstant;
  let label: ILLabel;

  beforeEach(() => {
    factory = new ILValueFactory();
    register = factory.createRegister(IL_BYTE, 'x');
    constant = factory.createConstant(42, IL_BYTE);
    label = factory.createLabel('test');
  });

  describe('isVirtualRegister', () => {
    it('should return true for VirtualRegister', () => {
      expect(isVirtualRegister(register)).toBe(true);
    });

    it('should return false for ILConstant', () => {
      expect(isVirtualRegister(constant)).toBe(false);
    });

    it('should return false for ILLabel', () => {
      expect(isVirtualRegister(label)).toBe(false);
    });
  });

  describe('isILConstant', () => {
    it('should return false for VirtualRegister', () => {
      expect(isILConstant(register)).toBe(false);
    });

    it('should return true for ILConstant', () => {
      expect(isILConstant(constant)).toBe(true);
    });

    it('should return false for ILLabel', () => {
      expect(isILConstant(label)).toBe(false);
    });
  });

  describe('isILLabel', () => {
    it('should return false for VirtualRegister', () => {
      expect(isILLabel(register)).toBe(false);
    });

    it('should return false for ILConstant', () => {
      expect(isILLabel(constant)).toBe(false);
    });

    it('should return true for ILLabel', () => {
      expect(isILLabel(label)).toBe(true);
    });
  });
});

// =============================================================================
// ILValueFactory
// =============================================================================

describe('ILValueFactory', () => {
  let factory: ILValueFactory;

  beforeEach(() => {
    factory = new ILValueFactory();
  });

  describe('createRegister', () => {
    it('should create register with incrementing ID', () => {
      const reg1 = factory.createRegister(IL_BYTE);
      const reg2 = factory.createRegister(IL_BYTE);
      const reg3 = factory.createRegister(IL_BYTE);
      expect(reg1.id).toBe(0);
      expect(reg2.id).toBe(1);
      expect(reg3.id).toBe(2);
    });

    it('should create register with specified type', () => {
      const reg = factory.createRegister(IL_WORD);
      expect(reg.type).toBe(IL_WORD);
    });

    it('should create register with optional name', () => {
      const reg = factory.createRegister(IL_BYTE, 'counter');
      expect(reg.name).toBe('counter');
    });
  });

  describe('createConstant', () => {
    it('should create constant with value and type', () => {
      const c = factory.createConstant(100, IL_BYTE);
      expect(c.kind).toBe('constant');
      expect(c.value).toBe(100);
      expect(c.type).toBe(IL_BYTE);
    });
  });

  describe('reset', () => {
    it('should reset register counter to 0', () => {
      factory.createRegister(IL_BYTE);
      factory.createRegister(IL_BYTE);
      factory.reset();
      const reg = factory.createRegister(IL_BYTE);
      expect(reg.id).toBe(0);
    });

    it('should reset label counter to 0', () => {
      factory.createLabel('block1');
      factory.createLabel('block2');
      factory.reset();
      const label = factory.createLabel('block');
      expect(label.blockId).toBe(0);
    });
  });

  describe('counter access', () => {
    it('getNextRegisterId should return next ID without incrementing', () => {
      expect(factory.getNextRegisterId()).toBe(0);
      factory.createRegister(IL_BYTE);
      expect(factory.getNextRegisterId()).toBe(1);
    });

    it('getNextLabelId should return next ID without incrementing', () => {
      expect(factory.getNextLabelId()).toBe(0);
      factory.createLabel('test');
      expect(factory.getNextLabelId()).toBe(1);
    });

    it('getRegisterCount should return number of allocated registers', () => {
      expect(factory.getRegisterCount()).toBe(0);
      factory.createRegister(IL_BYTE);
      factory.createRegister(IL_WORD);
      expect(factory.getRegisterCount()).toBe(2);
    });

    it('getLabelCount should return number of created labels', () => {
      expect(factory.getLabelCount()).toBe(0);
      factory.createLabel('a');
      factory.createUniqueLabel('b');
      expect(factory.getLabelCount()).toBe(2);
    });
  });

  describe('multiple factories independence', () => {
    it('should maintain independent counters', () => {
      const factory1 = new ILValueFactory();
      const factory2 = new ILValueFactory();

      factory1.createRegister(IL_BYTE);
      factory1.createRegister(IL_BYTE);
      factory1.createRegister(IL_BYTE);

      const reg = factory2.createRegister(IL_BYTE);
      expect(reg.id).toBe(0); // Independent from factory1
    });
  });

  describe('many allocations', () => {
    it('should handle many register allocations', () => {
      for (let i = 0; i < 100; i++) {
        const reg = factory.createRegister(IL_BYTE);
        expect(reg.id).toBe(i);
      }
      expect(factory.getRegisterCount()).toBe(100);
    });

    it('should handle many label allocations', () => {
      for (let i = 0; i < 100; i++) {
        const label = factory.createLabel(`block${i}`);
        expect(label.blockId).toBe(i);
      }
      expect(factory.getLabelCount()).toBe(100);
    });
  });

  describe('label uniqueness guarantee', () => {
    it('should create unique labels with same prefix', () => {
      const labels = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const label = factory.createUniqueLabel('loop');
        expect(labels.has(label.name)).toBe(false);
        labels.add(label.name);
      }
      expect(labels.size).toBe(10);
    });
  });
});

// =============================================================================
// Utility Functions
// =============================================================================

describe('valueToString', () => {
  let factory: ILValueFactory;

  beforeEach(() => {
    factory = new ILValueFactory();
  });

  it('should format VirtualRegister without name', () => {
    const reg = new VirtualRegister(0, IL_BYTE);
    expect(valueToString(reg)).toBe('v0');
  });

  it('should format VirtualRegister with name', () => {
    const reg = new VirtualRegister(5, IL_BYTE, 'counter');
    expect(valueToString(reg)).toBe('v5:counter');
  });

  it('should format ILConstant as its value', () => {
    const c = factory.createConstant(42, IL_BYTE);
    expect(valueToString(c)).toBe('42');
  });

  it('should format ILLabel with prefix', () => {
    const label = factory.createLabel('loop');
    expect(valueToString(label)).toBe('label:loop');
  });
});

describe('getValueType', () => {
  let factory: ILValueFactory;

  beforeEach(() => {
    factory = new ILValueFactory();
  });

  it('should return type for VirtualRegister', () => {
    const reg = new VirtualRegister(0, IL_BYTE);
    expect(getValueType(reg)).toBe(IL_BYTE);
  });

  it('should return type for VirtualRegister with word type', () => {
    const reg = new VirtualRegister(0, IL_WORD);
    expect(getValueType(reg)).toBe(IL_WORD);
  });

  it('should return type for ILConstant', () => {
    const c = factory.createConstant(42, IL_BYTE);
    expect(getValueType(c)).toBe(IL_BYTE);
  });

  it('should return undefined for ILLabel', () => {
    const label = factory.createLabel('test');
    expect(getValueType(label)).toBeUndefined();
  });
});