/**
 * ZP Allocator - Class Tests
 *
 * Tests for ZpAllocator class methods.
 *
 * @module __tests__/frame/zp-allocator-class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeKind } from '../../semantic/types.js';
import { SlotKind, ZpDirective } from '../../frame/enums.js';
import { createFrameSlot, FrameSlot } from '../../frame/types.js';
import {
  ZpAllocator,
  createZpAllocator,
} from '../../frame/allocator/zp-allocator.js';
import { ZpPool } from '../../frame/allocator/zp-pool.js';
import {
  C64_PLATFORM_CONFIG,
  X16_PLATFORM_CONFIG,
  TEST_PLATFORM_CONFIG,
} from '../../frame/platform.js';
import { BUILTIN_TYPES } from '../../semantic/types.js';

/**
 * Helper to create a test slot with specified properties.
 */
function createTestSlot(options: {
  name?: string;
  type?: typeof BUILTIN_TYPES.BYTE;
  accessCount?: number;
  maxLoopDepth?: number;
  zpDirective?: ZpDirective;
}): FrameSlot {
  const type = options.type || BUILTIN_TYPES.BYTE;
  return createFrameSlot(options.name || 'test', SlotKind.Local, type, {
    accessCount: options.accessCount ?? 1,
    maxLoopDepth: options.maxLoopDepth ?? 0,
    zpDirective: options.zpDirective ?? ZpDirective.None,
  });
}

describe('ZP Allocator - Class', () => {
  describe('constructor', () => {
    it('should create allocator from PlatformConfig', () => {
      const allocator = new ZpAllocator(C64_PLATFORM_CONFIG);

      expect(allocator.getConfig()).toBe(C64_PLATFORM_CONFIG);
      expect(allocator.getPool()).toBeInstanceOf(ZpPool);
    });

    it('should create allocator from existing ZpPool', () => {
      const pool = new ZpPool(X16_PLATFORM_CONFIG);
      const allocator = new ZpAllocator(pool);

      expect(allocator.getPool()).toBe(pool);
      expect(allocator.getConfig()).toBe(X16_PLATFORM_CONFIG);
    });

    it('should work with TEST_PLATFORM_CONFIG', () => {
      const allocator = new ZpAllocator(TEST_PLATFORM_CONFIG);

      expect(allocator.getConfig()).toBe(TEST_PLATFORM_CONFIG);
    });
  });

  describe('calculateScore', () => {
    let allocator: ZpAllocator;

    beforeEach(() => {
      allocator = new ZpAllocator(C64_PLATFORM_CONFIG);
    });

    it('should calculate score for a slot', () => {
      const slot = createTestSlot({
        type: BUILTIN_TYPES.BYTE,
        accessCount: 10,
        maxLoopDepth: 1,
      });

      const score = allocator.calculateScore(slot);

      expect(score).toBe(256 * 10 * 2); // typeWeight × accessCount × 2^loopDepth
    });

    it('should return MAX_SAFE_INTEGER for @zp directive', () => {
      const slot = createTestSlot({ zpDirective: ZpDirective.Zp });

      expect(allocator.calculateScore(slot)).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should return 0 for @ram directive', () => {
      const slot = createTestSlot({ zpDirective: ZpDirective.Ram });

      expect(allocator.calculateScore(slot)).toBe(0);
    });
  });

  describe('calculateScoreWithDetails', () => {
    let allocator: ZpAllocator;

    beforeEach(() => {
      allocator = new ZpAllocator(C64_PLATFORM_CONFIG);
    });

    it('should return detailed breakdown', () => {
      const slot = createTestSlot({
        type: BUILTIN_TYPES.WORD,
        accessCount: 5,
        maxLoopDepth: 2,
      });

      const details = allocator.calculateScoreWithDetails(slot);

      expect(details.baseTypeWeight).toBe(0x080); // Word weight
      expect(details.accessCount).toBe(5);
      expect(details.loopMultiplier).toBe(4); // 2^2
      expect(details.typeKind).toBe(TypeKind.Word);
      expect(details.totalScore).toBe(128 * 5 * 4);
    });
  });

  describe('scoreSlots', () => {
    let allocator: ZpAllocator;

    beforeEach(() => {
      allocator = new ZpAllocator(C64_PLATFORM_CONFIG);
    });

    it('should score all slots and return sorted', () => {
      const slots = [
        createTestSlot({ name: 'low', accessCount: 1 }),
        createTestSlot({ name: 'high', accessCount: 100 }),
        createTestSlot({ name: 'mid', accessCount: 10 }),
      ];

      const sorted = allocator.scoreSlots(slots);

      expect(sorted[0].name).toBe('high');
      expect(sorted[1].name).toBe('mid');
      expect(sorted[2].name).toBe('low');
    });

    it('should update zpScore field on original slots', () => {
      const slots = [createTestSlot({ accessCount: 5 })];

      allocator.scoreSlots(slots);

      expect(slots[0].zpScore).toBe(256 * 5 * 1);
    });
  });

  describe('getZpCandidates', () => {
    let allocator: ZpAllocator;

    beforeEach(() => {
      allocator = new ZpAllocator(C64_PLATFORM_CONFIG);
    });

    it('should return candidates excluding @ram and arrays', () => {
      const arrayType = {
        kind: TypeKind.Array,
        name: 'byte[10]',
        size: 10,
        isAssignable: true,
        isSigned: false,
        elementType: BUILTIN_TYPES.BYTE,
        elementCount: 10,
      };
      const slots = [
        createTestSlot({ name: 'scalar' }),
        createTestSlot({ name: 'forbidden', zpDirective: ZpDirective.Ram }),
        createFrameSlot('buffer', SlotKind.Local, arrayType),
      ];

      const candidates = allocator.getZpCandidates(slots);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].name).toBe('scalar');
    });
  });

  describe('categorizeSlots', () => {
    let allocator: ZpAllocator;

    beforeEach(() => {
      allocator = new ZpAllocator(C64_PLATFORM_CONFIG);
    });

    it('should categorize slots by directive', () => {
      const slots = [
        createTestSlot({ name: 'auto', zpDirective: ZpDirective.None }),
        createTestSlot({ name: 'required', zpDirective: ZpDirective.Zp }),
        createTestSlot({ name: 'forbidden', zpDirective: ZpDirective.Ram }),
      ];

      const { required, forbidden, automatic } = allocator.categorizeSlots(slots);

      expect(required).toHaveLength(1);
      expect(required[0].name).toBe('required');
      expect(forbidden).toHaveLength(1);
      expect(forbidden[0].name).toBe('forbidden');
      expect(automatic).toHaveLength(1);
      expect(automatic[0].name).toBe('auto');
    });
  });

  describe('getAllocationOrder', () => {
    let allocator: ZpAllocator;

    beforeEach(() => {
      allocator = new ZpAllocator(C64_PLATFORM_CONFIG);
    });

    it('should return required slots first, then automatic by score', () => {
      const slots = [
        createTestSlot({ name: 'highAuto', accessCount: 100 }),
        createTestSlot({ name: 'lowAuto', accessCount: 1 }),
        createTestSlot({ name: 'required', zpDirective: ZpDirective.Zp }),
      ];

      const order = allocator.getAllocationOrder(slots);

      expect(order[0].name).toBe('required');
      expect(order[1].name).toBe('highAuto');
      expect(order[2].name).toBe('lowAuto');
    });

    it('should exclude @ram slots from allocation order', () => {
      const slots = [
        createTestSlot({ name: 'normal' }),
        createTestSlot({ name: 'forbidden', zpDirective: ZpDirective.Ram }),
      ];

      const order = allocator.getAllocationOrder(slots);

      expect(order).toHaveLength(1);
      expect(order[0].name).toBe('normal');
    });

    it('should handle multiple required slots', () => {
      const slots = [
        createTestSlot({ name: 'req1', zpDirective: ZpDirective.Zp }),
        createTestSlot({ name: 'auto', accessCount: 1000 }),
        createTestSlot({ name: 'req2', zpDirective: ZpDirective.Zp }),
      ];

      const order = allocator.getAllocationOrder(slots);

      // All required first (in original order)
      expect(order[0].name).toBe('req1');
      expect(order[1].name).toBe('req2');
      expect(order[2].name).toBe('auto');
    });

    it('should handle empty slots array', () => {
      const order = allocator.getAllocationOrder([]);

      expect(order).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should reset the underlying pool', () => {
      const allocator = new ZpAllocator(TEST_PLATFORM_CONFIG);
      const pool = allocator.getPool();

      // Allocate some bytes
      pool.allocate(5);
      expect(pool.getStats().bytesUsed).toBe(5);

      // Reset
      allocator.reset();

      expect(pool.getStats().bytesUsed).toBe(0);
    });
  });

  describe('createZpAllocator factory', () => {
    it('should create allocator from config', () => {
      const allocator = createZpAllocator(C64_PLATFORM_CONFIG);

      expect(allocator).toBeInstanceOf(ZpAllocator);
      expect(allocator.getConfig()).toBe(C64_PLATFORM_CONFIG);
    });
  });
});