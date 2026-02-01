/**
 * Tests for FrameSlot and ZpScoreBreakdown interfaces
 *
 * Tests that the interfaces are correctly defined and can be used
 * to create valid frame slot objects.
 */

import { describe, it, expect } from 'vitest';
import {
  FrameSlot,
  ZpScoreBreakdown,
} from '../../frame/types.js';
import { SlotLocation, SlotKind, ZpDirective } from '../../frame/enums.js';
import { TypeKind, BUILTIN_TYPES } from '../../semantic/types.js';

describe('FrameSlot Interface', () => {
  describe('Basic Information Fields', () => {
    it('should allow creating a slot with name field', () => {
      const slot: FrameSlot = {
        name: 'counter',
        kind: SlotKind.Local,
        type: BUILTIN_TYPES.BYTE,
        size: 1,
        zpDirective: ZpDirective.None,
        location: SlotLocation.FrameRegion,
        address: 0x0200,
        offset: 0,
        accessCount: 0,
        maxLoopDepth: 0,
        zpScore: 0,
        isArrayElement: false,
      };
      expect(slot.name).toBe('counter');
    });

    it('should allow creating a slot with all SlotKind values', () => {
      const kinds = [SlotKind.Parameter, SlotKind.Local, SlotKind.Return, SlotKind.Temporary];
      kinds.forEach(kind => {
        const slot: FrameSlot = {
          name: 'test',
          kind,
          type: BUILTIN_TYPES.BYTE,
          size: 1,
          zpDirective: ZpDirective.None,
          location: SlotLocation.FrameRegion,
          address: 0,
          offset: 0,
          accessCount: 0,
          maxLoopDepth: 0,
          zpScore: 0,
          isArrayElement: false,
        };
        expect(slot.kind).toBe(kind);
      });
    });

    it('should store TypeInfo correctly', () => {
      const slot: FrameSlot = {
        name: 'ptr',
        kind: SlotKind.Local,
        type: BUILTIN_TYPES.WORD,
        size: 2,
        zpDirective: ZpDirective.None,
        location: SlotLocation.FrameRegion,
        address: 0,
        offset: 0,
        accessCount: 0,
        maxLoopDepth: 0,
        zpScore: 0,
        isArrayElement: false,
      };
      expect(slot.type.kind).toBe(TypeKind.Word);
      expect(slot.type.size).toBe(2);
    });

    it('should allow specifying size independent of type', () => {
      // Array type with custom size
      const arrayType = {
        kind: TypeKind.Array,
        name: 'byte[10]',
        size: 10,
        elementType: BUILTIN_TYPES.BYTE,
        elementCount: 10,
      };
      const slot: FrameSlot = {
        name: 'buffer',
        kind: SlotKind.Local,
        type: arrayType,
        size: 10,
        zpDirective: ZpDirective.None,
        location: SlotLocation.FrameRegion,
        address: 0,
        offset: 0,
        accessCount: 0,
        maxLoopDepth: 0,
        zpScore: 0,
        isArrayElement: true,
        arraySize: 10,
      };
      expect(slot.size).toBe(10);
    });
  });

  describe('Zero Page Handling Fields', () => {
    it('should allow all ZpDirective values', () => {
      const directives = [ZpDirective.None, ZpDirective.Zp, ZpDirective.Ram];
      directives.forEach(zpDirective => {
        const slot: FrameSlot = {
          name: 'test',
          kind: SlotKind.Local,
          type: BUILTIN_TYPES.BYTE,
          size: 1,
          zpDirective,
          location: SlotLocation.FrameRegion,
          address: 0,
          offset: 0,
          accessCount: 0,
          maxLoopDepth: 0,
          zpScore: 0,
          isArrayElement: false,
        };
        expect(slot.zpDirective).toBe(zpDirective);
      });
    });
  });

  describe('Allocation Result Fields', () => {
    it('should allow all SlotLocation values', () => {
      const locations = [SlotLocation.ZeroPage, SlotLocation.FrameRegion, SlotLocation.Register];
      locations.forEach(location => {
        const slot: FrameSlot = {
          name: 'test',
          kind: SlotKind.Local,
          type: BUILTIN_TYPES.BYTE,
          size: 1,
          zpDirective: ZpDirective.None,
          location,
          address: 0,
          offset: 0,
          accessCount: 0,
          maxLoopDepth: 0,
          zpScore: 0,
          isArrayElement: false,
        };
        expect(slot.location).toBe(location);
      });
    });

    it('should allow setting address for ZP slots', () => {
      const slot: FrameSlot = {
        name: 'fastPtr',
        kind: SlotKind.Local,
        type: BUILTIN_TYPES.WORD,
        size: 2,
        zpDirective: ZpDirective.Zp,
        location: SlotLocation.ZeroPage,
        address: 0x02, // ZP address
        offset: 0,
        accessCount: 0,
        maxLoopDepth: 0,
        zpScore: 0,
        isArrayElement: false,
      };
      expect(slot.address).toBe(0x02);
      expect(slot.location).toBe(SlotLocation.ZeroPage);
    });

    it('should allow setting address and offset for frame region slots', () => {
      const slot: FrameSlot = {
        name: 'local',
        kind: SlotKind.Local,
        type: BUILTIN_TYPES.BYTE,
        size: 1,
        zpDirective: ZpDirective.None,
        location: SlotLocation.FrameRegion,
        address: 0x0205,
        offset: 5,
        accessCount: 0,
        maxLoopDepth: 0,
        zpScore: 0,
        isArrayElement: false,
      };
      expect(slot.address).toBe(0x0205);
      expect(slot.offset).toBe(5);
    });

    it('should allow optional register field for register slots', () => {
      const slot: FrameSlot = {
        name: 'x',
        kind: SlotKind.Parameter,
        type: BUILTIN_TYPES.BYTE,
        size: 1,
        zpDirective: ZpDirective.None,
        location: SlotLocation.Register,
        address: 0,
        offset: 0,
        register: 'A',
        accessCount: 0,
        maxLoopDepth: 0,
        zpScore: 0,
        isArrayElement: false,
      };
      expect(slot.register).toBe('A');
    });

    it('should allow X and Y register names', () => {
      const registers = ['A', 'X', 'Y'];
      registers.forEach(reg => {
        const slot: FrameSlot = {
          name: 'param',
          kind: SlotKind.Parameter,
          type: BUILTIN_TYPES.BYTE,
          size: 1,
          zpDirective: ZpDirective.None,
          location: SlotLocation.Register,
          address: 0,
          offset: 0,
          register: reg,
          accessCount: 0,
          maxLoopDepth: 0,
          zpScore: 0,
          isArrayElement: false,
        };
        expect(slot.register).toBe(reg);
      });
    });
  });

  describe('Analysis Data Fields', () => {
    it('should allow setting accessCount', () => {
      const slot: FrameSlot = {
        name: 'hotVar',
        kind: SlotKind.Local,
        type: BUILTIN_TYPES.BYTE,
        size: 1,
        zpDirective: ZpDirective.None,
        location: SlotLocation.FrameRegion,
        address: 0,
        offset: 0,
        accessCount: 42,
        maxLoopDepth: 0,
        zpScore: 0,
        isArrayElement: false,
      };
      expect(slot.accessCount).toBe(42);
    });

    it('should allow setting maxLoopDepth', () => {
      const slot: FrameSlot = {
        name: 'loopVar',
        kind: SlotKind.Local,
        type: BUILTIN_TYPES.BYTE,
        size: 1,
        zpDirective: ZpDirective.None,
        location: SlotLocation.FrameRegion,
        address: 0,
        offset: 0,
        accessCount: 10,
        maxLoopDepth: 3,
        zpScore: 0,
        isArrayElement: false,
      };
      expect(slot.maxLoopDepth).toBe(3);
    });

    it('should allow setting zpScore', () => {
      const slot: FrameSlot = {
        name: 'scoredVar',
        kind: SlotKind.Local,
        type: BUILTIN_TYPES.WORD,
        size: 2,
        zpDirective: ZpDirective.None,
        location: SlotLocation.FrameRegion,
        address: 0,
        offset: 0,
        accessCount: 15,
        maxLoopDepth: 2,
        zpScore: 120,
        isArrayElement: false,
      };
      expect(slot.zpScore).toBe(120);
    });
  });

  describe('Array Handling Fields', () => {
    it('should allow isArrayElement to be true for arrays', () => {
      const arrayType = {
        kind: TypeKind.Array,
        name: 'byte[16]',
        size: 16,
        elementType: BUILTIN_TYPES.BYTE,
        elementCount: 16,
      };
      const slot: FrameSlot = {
        name: 'buffer',
        kind: SlotKind.Local,
        type: arrayType,
        size: 16,
        zpDirective: ZpDirective.Ram, // Arrays typically @ram
        location: SlotLocation.FrameRegion,
        address: 0x0200,
        offset: 0,
        accessCount: 5,
        maxLoopDepth: 1,
        zpScore: 0,
        isArrayElement: true,
        arraySize: 16,
      };
      expect(slot.isArrayElement).toBe(true);
      expect(slot.arraySize).toBe(16);
    });

    it('should allow arraySize to be undefined for non-arrays', () => {
      const slot: FrameSlot = {
        name: 'scalar',
        kind: SlotKind.Local,
        type: BUILTIN_TYPES.BYTE,
        size: 1,
        zpDirective: ZpDirective.None,
        location: SlotLocation.FrameRegion,
        address: 0,
        offset: 0,
        accessCount: 0,
        maxLoopDepth: 0,
        zpScore: 0,
        isArrayElement: false,
      };
      expect(slot.isArrayElement).toBe(false);
      expect(slot.arraySize).toBeUndefined();
    });
  });

  describe('Real-World Slot Examples', () => {
    it('should represent a typical byte parameter', () => {
      const slot: FrameSlot = {
        name: 'x',
        kind: SlotKind.Parameter,
        type: BUILTIN_TYPES.BYTE,
        size: 1,
        zpDirective: ZpDirective.None,
        location: SlotLocation.FrameRegion,
        address: 0x0200,
        offset: 0,
        accessCount: 3,
        maxLoopDepth: 0,
        zpScore: 26, // 20 (byte type) + 6 (3 * 2 access)
        isArrayElement: false,
      };
      expect(slot.kind).toBe(SlotKind.Parameter);
      expect(slot.size).toBe(1);
    });

    it('should represent a ZP-required pointer local', () => {
      const slot: FrameSlot = {
        name: 'ptr',
        kind: SlotKind.Local,
        type: BUILTIN_TYPES.WORD,
        size: 2,
        zpDirective: ZpDirective.Zp,
        location: SlotLocation.ZeroPage,
        address: 0xFB, // ZP address
        offset: 0,
        accessCount: 10,
        maxLoopDepth: 2,
        zpScore: 10110, // 10000 (directive) + 50 (word) + 20 (access) + 40 (loop)
        isArrayElement: false,
      };
      expect(slot.zpDirective).toBe(ZpDirective.Zp);
      expect(slot.location).toBe(SlotLocation.ZeroPage);
    });

    it('should represent a return value slot', () => {
      const slot: FrameSlot = {
        name: '__return',
        kind: SlotKind.Return,
        type: BUILTIN_TYPES.WORD,
        size: 2,
        zpDirective: ZpDirective.None,
        location: SlotLocation.FrameRegion,
        address: 0x0200,
        offset: 0,
        accessCount: 1,
        maxLoopDepth: 0,
        zpScore: 52, // 50 (word) + 2 (access)
        isArrayElement: false,
      };
      expect(slot.name).toBe('__return');
      expect(slot.kind).toBe(SlotKind.Return);
    });

    it('should represent a temporary slot', () => {
      const slot: FrameSlot = {
        name: '__temp_0',
        kind: SlotKind.Temporary,
        type: BUILTIN_TYPES.WORD,
        size: 2,
        zpDirective: ZpDirective.None,
        location: SlotLocation.FrameRegion,
        address: 0x0202,
        offset: 2,
        accessCount: 2,
        maxLoopDepth: 1,
        zpScore: 74, // 50 (word) + 4 (access) + 20 (loop)
        isArrayElement: false,
      };
      expect(slot.name).toBe('__temp_0');
      expect(slot.kind).toBe(SlotKind.Temporary);
    });
  });
});

describe('ZpScoreBreakdown Interface', () => {
  describe('Field Structure', () => {
    it('should allow creating a breakdown with all fields', () => {
      const breakdown: ZpScoreBreakdown = {
        typeWeight: 50,
        accessBonus: 30,
        loopBonus: 40,
        directiveBonus: 0,
        totalScore: 120,
      };
      expect(breakdown.totalScore).toBe(120);
    });

    it('should represent breakdown for a byte variable', () => {
      const breakdown: ZpScoreBreakdown = {
        typeWeight: 20, // Byte type
        accessBonus: 10, // 5 accesses * 2
        loopBonus: 0, // Not in loop
        directiveBonus: 0, // No directive
        totalScore: 30,
      };
      expect(breakdown.typeWeight).toBe(20);
      expect(breakdown.accessBonus).toBe(10);
    });

    it('should represent breakdown for @zp word variable', () => {
      const breakdown: ZpScoreBreakdown = {
        typeWeight: 50, // Word type (pointer benefit)
        accessBonus: 20, // 10 accesses * 2
        loopBonus: 40, // Loop depth 2 * 20
        directiveBonus: 10000, // @zp directive
        totalScore: 10110,
      };
      expect(breakdown.directiveBonus).toBe(10000);
      expect(breakdown.totalScore).toBe(10110);
    });

    it('should have consistent totalScore calculation', () => {
      const breakdown: ZpScoreBreakdown = {
        typeWeight: 20,
        accessBonus: 8,
        loopBonus: 60,
        directiveBonus: 0,
        totalScore: 88,
      };
      const calculatedTotal =
        breakdown.typeWeight +
        breakdown.accessBonus +
        breakdown.loopBonus +
        breakdown.directiveBonus;
      expect(breakdown.totalScore).toBe(calculatedTotal);
    });
  });
});