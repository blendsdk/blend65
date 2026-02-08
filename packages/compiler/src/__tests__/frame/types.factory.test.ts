/**
 * Tests for FrameSlot factory functions
 *
 * Tests for createFrameSlot, createReturnSlot, createTemporarySlot, and getTypeSize.
 */

import { describe, it, expect } from 'vitest';
import {
  createFrameSlot,
  createReturnSlot,
  createTemporarySlot,
  getTypeSize,
} from '../../frame/types.js';
import { SlotLocation, SlotKind, ZpDirective } from '../../frame/enums.js';
import { TypeKind, TypeInfo, BUILTIN_TYPES } from '../../semantic/types.js';

describe('getTypeSize', () => {
  describe('Primitive Types', () => {
    it('should return 1 for byte type', () => {
      expect(getTypeSize(BUILTIN_TYPES.BYTE)).toBe(1);
    });

    it('should return 1 for bool type', () => {
      expect(getTypeSize(BUILTIN_TYPES.BOOL)).toBe(1);
    });

    it('should return 2 for word type', () => {
      expect(getTypeSize(BUILTIN_TYPES.WORD)).toBe(2);
    });

    it('should return 0 for void type', () => {
      expect(getTypeSize(BUILTIN_TYPES.VOID)).toBe(0);
    });

    it('should return 2 for string type (pointer size)', () => {
      expect(getTypeSize(BUILTIN_TYPES.STRING)).toBe(2);
    });
  });

  describe('Array Types', () => {
    it('should calculate size for byte array', () => {
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        name: 'byte[10]',
        size: 10,
        elementType: BUILTIN_TYPES.BYTE,
        elementCount: 10,
      };
      expect(getTypeSize(arrayType)).toBe(10);
    });

    it('should calculate size for word array', () => {
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        name: 'word[5]',
        size: 10,
        elementType: BUILTIN_TYPES.WORD,
        elementCount: 5,
      };
      expect(getTypeSize(arrayType)).toBe(10);
    });

    it('should return 0 for unsized array', () => {
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        name: 'byte[]',
        size: 0,
        // No elementType or elementCount
      };
      expect(getTypeSize(arrayType)).toBe(0);
    });

    it('should handle large arrays', () => {
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        name: 'byte[256]',
        size: 256,
        elementType: BUILTIN_TYPES.BYTE,
        elementCount: 256,
      };
      expect(getTypeSize(arrayType)).toBe(256);
    });
  });

  describe('Unknown Types', () => {
    it('should return 1 for unknown type without size', () => {
      expect(getTypeSize(BUILTIN_TYPES.UNKNOWN)).toBe(1);
    });

    it('should use type.size for types with explicit size', () => {
      const customType: TypeInfo = {
        kind: TypeKind.Unknown,
        name: 'custom',
        size: 4,
      };
      expect(getTypeSize(customType)).toBe(4);
    });
  });
});

describe('createFrameSlot', () => {
  describe('Basic Creation', () => {
    it('should create a parameter slot with defaults', () => {
      const slot = createFrameSlot('x', SlotKind.Parameter, BUILTIN_TYPES.BYTE);

      expect(slot.name).toBe('x');
      expect(slot.kind).toBe(SlotKind.Parameter);
      expect(slot.type).toBe(BUILTIN_TYPES.BYTE);
      expect(slot.size).toBe(1);
    });

    it('should create a local slot with defaults', () => {
      const slot = createFrameSlot('counter', SlotKind.Local, BUILTIN_TYPES.WORD);

      expect(slot.name).toBe('counter');
      expect(slot.kind).toBe(SlotKind.Local);
      expect(slot.type).toBe(BUILTIN_TYPES.WORD);
      expect(slot.size).toBe(2);
    });

    it('should create a return slot with defaults', () => {
      const slot = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.BYTE);

      expect(slot.name).toBe('__return');
      expect(slot.kind).toBe(SlotKind.Return);
    });

    it('should create a temporary slot with defaults', () => {
      const slot = createFrameSlot('__temp_0', SlotKind.Temporary, BUILTIN_TYPES.WORD);

      expect(slot.name).toBe('__temp_0');
      expect(slot.kind).toBe(SlotKind.Temporary);
    });
  });

  describe('Default Values', () => {
    it('should default zpDirective to None', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(slot.zpDirective).toBe(ZpDirective.None);
    });

    it('should default location to FrameRegion', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(slot.location).toBe(SlotLocation.FrameRegion);
    });

    it('should default address to 0', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(slot.address).toBe(0);
    });

    it('should default offset to 0', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(slot.offset).toBe(0);
    });

    it('should default accessCount to 0', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(slot.accessCount).toBe(0);
    });

    it('should default maxLoopDepth to 0', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(slot.maxLoopDepth).toBe(0);
    });

    it('should default zpScore to 0', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(slot.zpScore).toBe(0);
    });

    it('should default isArrayElement to false for non-arrays', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(slot.isArrayElement).toBe(false);
    });

    it('should default arraySize to undefined for non-arrays', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(slot.arraySize).toBeUndefined();
    });
  });

  describe('Array Type Detection', () => {
    it('should set isArrayElement true for array types', () => {
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        name: 'byte[10]',
        size: 10,
        elementType: BUILTIN_TYPES.BYTE,
        elementCount: 10,
      };
      const slot = createFrameSlot('buffer', SlotKind.Local, arrayType);

      expect(slot.isArrayElement).toBe(true);
    });

    it('should set arraySize from type elementCount', () => {
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        name: 'word[25]',
        size: 50,
        elementType: BUILTIN_TYPES.WORD,
        elementCount: 25,
      };
      const slot = createFrameSlot('data', SlotKind.Local, arrayType);

      expect(slot.arraySize).toBe(25);
    });

    it('should calculate size correctly for arrays', () => {
      const arrayType: TypeInfo = {
        kind: TypeKind.Array,
        name: 'byte[16]',
        size: 16,
        elementType: BUILTIN_TYPES.BYTE,
        elementCount: 16,
      };
      const slot = createFrameSlot('buffer', SlotKind.Local, arrayType);

      expect(slot.size).toBe(16);
    });
  });

  describe('Options Override', () => {
    it('should allow overriding zpDirective', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
      });
      expect(slot.zpDirective).toBe(ZpDirective.Zp);
    });

    it('should allow overriding location', () => {
      const slot = createFrameSlot('x', SlotKind.Parameter, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.Register,
      });
      expect(slot.location).toBe(SlotLocation.Register);
    });

    it('should allow overriding address', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        address: 0xFB,
      });
      expect(slot.address).toBe(0xFB);
    });

    it('should allow overriding offset', () => {
      const slot = createFrameSlot('local', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        offset: 5,
      });
      expect(slot.offset).toBe(5);
    });

    it('should allow overriding register', () => {
      const slot = createFrameSlot('param', SlotKind.Parameter, BUILTIN_TYPES.BYTE, {
        location: SlotLocation.Register,
        register: 'A',
      });
      expect(slot.register).toBe('A');
    });

    it('should allow overriding accessCount', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        accessCount: 15,
      });
      expect(slot.accessCount).toBe(15);
    });

    it('should allow overriding maxLoopDepth', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        maxLoopDepth: 3,
      });
      expect(slot.maxLoopDepth).toBe(3);
    });

    it('should allow overriding zpScore', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.WORD, {
        zpScore: 150,
      });
      expect(slot.zpScore).toBe(150);
    });

    it('should allow overriding isArrayElement', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE, {
        isArrayElement: true,
        arraySize: 5,
      });
      expect(slot.isArrayElement).toBe(true);
      expect(slot.arraySize).toBe(5);
    });

    it('should allow multiple overrides at once', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD, {
        zpDirective: ZpDirective.Zp,
        location: SlotLocation.ZeroPage,
        address: 0x02,
        accessCount: 20,
        maxLoopDepth: 2,
        zpScore: 10090,
      });

      expect(slot.zpDirective).toBe(ZpDirective.Zp);
      expect(slot.location).toBe(SlotLocation.ZeroPage);
      expect(slot.address).toBe(0x02);
      expect(slot.accessCount).toBe(20);
      expect(slot.maxLoopDepth).toBe(2);
      expect(slot.zpScore).toBe(10090);
    });
  });

  describe('Type Size Calculation', () => {
    it('should calculate size 1 for byte', () => {
      const slot = createFrameSlot('x', SlotKind.Local, BUILTIN_TYPES.BYTE);
      expect(slot.size).toBe(1);
    });

    it('should calculate size 1 for bool', () => {
      const slot = createFrameSlot('flag', SlotKind.Local, BUILTIN_TYPES.BOOL);
      expect(slot.size).toBe(1);
    });

    it('should calculate size 2 for word', () => {
      const slot = createFrameSlot('ptr', SlotKind.Local, BUILTIN_TYPES.WORD);
      expect(slot.size).toBe(2);
    });

    it('should calculate size 0 for void', () => {
      const slot = createFrameSlot('__return', SlotKind.Return, BUILTIN_TYPES.VOID);
      expect(slot.size).toBe(0);
    });
  });
});

describe('createReturnSlot', () => {
  it('should create a return slot with __return name', () => {
    const slot = createReturnSlot(BUILTIN_TYPES.BYTE);
    expect(slot.name).toBe('__return');
  });

  it('should create a return slot with Return kind', () => {
    const slot = createReturnSlot(BUILTIN_TYPES.WORD);
    expect(slot.kind).toBe(SlotKind.Return);
  });

  it('should set correct type', () => {
    const slot = createReturnSlot(BUILTIN_TYPES.WORD);
    expect(slot.type).toBe(BUILTIN_TYPES.WORD);
  });

  it('should calculate correct size', () => {
    const byteSlot = createReturnSlot(BUILTIN_TYPES.BYTE);
    expect(byteSlot.size).toBe(1);

    const wordSlot = createReturnSlot(BUILTIN_TYPES.WORD);
    expect(wordSlot.size).toBe(2);
  });

  it('should allow options override', () => {
    const slot = createReturnSlot(BUILTIN_TYPES.WORD, {
      location: SlotLocation.ZeroPage,
      address: 0xFD,
    });
    expect(slot.location).toBe(SlotLocation.ZeroPage);
    expect(slot.address).toBe(0xFD);
  });

  it('should create void return slot with size 0', () => {
    const slot = createReturnSlot(BUILTIN_TYPES.VOID);
    expect(slot.size).toBe(0);
    expect(slot.name).toBe('__return');
  });
});

describe('createTemporarySlot', () => {
  it('should create a temporary slot with __temp_N name', () => {
    const slot = createTemporarySlot(0, BUILTIN_TYPES.WORD);
    expect(slot.name).toBe('__temp_0');
  });

  it('should increment index in name', () => {
    expect(createTemporarySlot(0, BUILTIN_TYPES.WORD).name).toBe('__temp_0');
    expect(createTemporarySlot(1, BUILTIN_TYPES.WORD).name).toBe('__temp_1');
    expect(createTemporarySlot(5, BUILTIN_TYPES.WORD).name).toBe('__temp_5');
    expect(createTemporarySlot(99, BUILTIN_TYPES.WORD).name).toBe('__temp_99');
  });

  it('should create a temporary slot with Temporary kind', () => {
    const slot = createTemporarySlot(0, BUILTIN_TYPES.WORD);
    expect(slot.kind).toBe(SlotKind.Temporary);
  });

  it('should set correct type', () => {
    const slot = createTemporarySlot(0, BUILTIN_TYPES.BYTE);
    expect(slot.type).toBe(BUILTIN_TYPES.BYTE);
  });

  it('should calculate correct size', () => {
    const byteSlot = createTemporarySlot(0, BUILTIN_TYPES.BYTE);
    expect(byteSlot.size).toBe(1);

    const wordSlot = createTemporarySlot(0, BUILTIN_TYPES.WORD);
    expect(wordSlot.size).toBe(2);
  });

  it('should allow options override', () => {
    const slot = createTemporarySlot(0, BUILTIN_TYPES.WORD, {
      accessCount: 3,
      maxLoopDepth: 1,
    });
    expect(slot.accessCount).toBe(3);
    expect(slot.maxLoopDepth).toBe(1);
  });

  it('should have default values like regular slots', () => {
    const slot = createTemporarySlot(0, BUILTIN_TYPES.WORD);
    expect(slot.zpDirective).toBe(ZpDirective.None);
    expect(slot.location).toBe(SlotLocation.FrameRegion);
    expect(slot.address).toBe(0);
    expect(slot.offset).toBe(0);
  });
});