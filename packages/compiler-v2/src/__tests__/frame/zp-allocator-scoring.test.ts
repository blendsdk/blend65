/**
 * ZP Allocator - Scoring Tests
 *
 * Tests for calculateZPScore and related scoring functions.
 *
 * @module __tests__/frame/zp-allocator-scoring
 */

import { describe, it, expect } from 'vitest';
import { TypeKind } from '../../semantic/types.js';
import { SlotKind, ZpDirective, SlotLocation } from '../../frame/enums.js';
import { createFrameSlot, FrameSlot } from '../../frame/types.js';
import {
  calculateZPScore,
  calculateZPScoreWithDetails,
  updateSlotZpScore,
  scoreAllSlots,
  ZP_TYPE_WEIGHTS,
} from '../../frame/allocator/zp-allocator.js';
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

describe('ZP Allocator - Scoring', () => {
  describe('calculateZPScore - Basic Formula', () => {
    it('should calculate score = typeWeight × accessCount × 2^loopDepth', () => {
      // byte (256) × 10 accesses × 2^0 (no loop) = 2560
      const slot = createTestSlot({
        type: BUILTIN_TYPES.BYTE,
        accessCount: 10,
        maxLoopDepth: 0,
      });
      expect(calculateZPScore(slot)).toBe(256 * 10 * 1);
    });

    it('should apply exponential loop multiplier', () => {
      // byte (256) × 1 access × 2^2 = 1024
      const slot = createTestSlot({
        type: BUILTIN_TYPES.BYTE,
        accessCount: 1,
        maxLoopDepth: 2,
      });
      expect(calculateZPScore(slot)).toBe(256 * 1 * 4);
    });

    it('should use minimum access count of 1', () => {
      // Even with 0 accesses, use minimum 1 to preserve type weight
      const slot = createTestSlot({
        type: BUILTIN_TYPES.BYTE,
        accessCount: 0,
        maxLoopDepth: 0,
      });
      expect(calculateZPScore(slot)).toBe(256 * 1 * 1);
    });
  });

  describe('calculateZPScore - Type Weights', () => {
    it('should score bytes at 0x100', () => {
      const slot = createTestSlot({
        type: BUILTIN_TYPES.BYTE,
        accessCount: 1,
        maxLoopDepth: 0,
      });
      expect(calculateZPScore(slot)).toBe(0x100);
    });

    it('should score words at 0x080', () => {
      const slot = createTestSlot({
        type: BUILTIN_TYPES.WORD,
        accessCount: 1,
        maxLoopDepth: 0,
      });
      expect(calculateZPScore(slot)).toBe(0x080);
    });

    it('should score bools same as bytes', () => {
      const slot = createTestSlot({
        type: BUILTIN_TYPES.BOOL,
        accessCount: 1,
        maxLoopDepth: 0,
      });
      expect(calculateZPScore(slot)).toBe(0x100);
    });
  });

  describe('calculateZPScore - Directives', () => {
    it('should return MAX_SAFE_INTEGER for @zp directive', () => {
      const slot = createTestSlot({
        zpDirective: ZpDirective.Zp,
        accessCount: 1,
      });
      expect(calculateZPScore(slot)).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should return 0 for @ram directive', () => {
      const slot = createTestSlot({
        zpDirective: ZpDirective.Ram,
        accessCount: 100,
        maxLoopDepth: 5,
      });
      expect(calculateZPScore(slot)).toBe(0);
    });

    it('should ignore access count for @zp directive', () => {
      const slot1 = createTestSlot({
        zpDirective: ZpDirective.Zp,
        accessCount: 1,
      });
      const slot2 = createTestSlot({
        zpDirective: ZpDirective.Zp,
        accessCount: 1000,
      });
      expect(calculateZPScore(slot1)).toBe(calculateZPScore(slot2));
    });
  });

  describe('calculateZPScore - Arrays', () => {
    it('should return 0 for array types', () => {
      const arrayType = {
        kind: TypeKind.Array,
        name: 'byte[10]',
        size: 10,
        isAssignable: true,
        isSigned: false,
        elementType: BUILTIN_TYPES.BYTE,
        elementCount: 10,
      };
      const slot = createFrameSlot('buffer', SlotKind.Local, arrayType, {
        accessCount: 100,
        maxLoopDepth: 5,
      });
      expect(calculateZPScore(slot)).toBe(0);
    });
  });

  describe('calculateZPScore - Complex Scenarios', () => {
    it('should prioritize hot loop variables', () => {
      // Variable in a triple-nested loop
      const hotVar = createTestSlot({
        type: BUILTIN_TYPES.BYTE,
        accessCount: 5,
        maxLoopDepth: 3, // 2^3 = 8
      });
      // Variable outside loops
      const coldVar = createTestSlot({
        type: BUILTIN_TYPES.BYTE,
        accessCount: 5,
        maxLoopDepth: 0,
      });
      
      // Hot: 256 × 5 × 8 = 10240
      // Cold: 256 × 5 × 1 = 1280
      expect(calculateZPScore(hotVar)).toBe(10240);
      expect(calculateZPScore(coldVar)).toBe(1280);
      expect(calculateZPScore(hotVar)).toBeGreaterThan(calculateZPScore(coldVar));
    });

    it('should give similar scores to pointer with few accesses vs byte with many accesses', () => {
      // This tests the weighting balance
      // Pointer: 2048 × 5 × 1 = 10240
      const pointer = createTestSlot({
        type: BUILTIN_TYPES.STRING, // String is pointer-like
        accessCount: 5,
        maxLoopDepth: 0,
      });
      // Byte: 256 × 40 × 1 = 10240
      const byte = createTestSlot({
        type: BUILTIN_TYPES.BYTE,
        accessCount: 40,
        maxLoopDepth: 0,
      });
      
      expect(calculateZPScore(pointer)).toBe(10240);
      expect(calculateZPScore(byte)).toBe(10240);
    });
  });

  describe('calculateZPScoreWithDetails', () => {
    it('should return detailed breakdown', () => {
      const slot = createTestSlot({
        type: BUILTIN_TYPES.BYTE,
        accessCount: 10,
        maxLoopDepth: 2,
      });
      const details = calculateZPScoreWithDetails(slot);
      
      expect(details.baseTypeWeight).toBe(0x100);
      expect(details.accessCount).toBe(10);
      expect(details.loopMultiplier).toBe(4); // 2^2
      expect(details.typeKind).toBe(TypeKind.Byte);
      expect(details.hasZpDirective).toBe(false);
      expect(details.hasRamDirective).toBe(false);
      expect(details.totalScore).toBe(256 * 10 * 4);
    });

    it('should indicate @zp directive in details', () => {
      const slot = createTestSlot({
        zpDirective: ZpDirective.Zp,
      });
      const details = calculateZPScoreWithDetails(slot);
      
      expect(details.hasZpDirective).toBe(true);
      expect(details.hasRamDirective).toBe(false);
      expect(details.directiveBonus).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should indicate @ram directive in details', () => {
      const slot = createTestSlot({
        zpDirective: ZpDirective.Ram,
      });
      const details = calculateZPScoreWithDetails(slot);
      
      expect(details.hasZpDirective).toBe(false);
      expect(details.hasRamDirective).toBe(true);
      expect(details.totalScore).toBe(0);
    });
  });

  describe('updateSlotZpScore', () => {
    it('should update slot zpScore field', () => {
      const slot = createTestSlot({
        type: BUILTIN_TYPES.BYTE,
        accessCount: 5,
        maxLoopDepth: 1,
      });
      expect(slot.zpScore).toBe(0); // Initial value
      
      updateSlotZpScore(slot);
      
      expect(slot.zpScore).toBe(256 * 5 * 2);
    });

    it('should return the same slot for chaining', () => {
      const slot = createTestSlot({});
      const result = updateSlotZpScore(slot);
      expect(result).toBe(slot);
    });
  });

  describe('scoreAllSlots', () => {
    it('should score all slots and return sorted by score', () => {
      const slots = [
        createTestSlot({ name: 'low', accessCount: 1 }),
        createTestSlot({ name: 'high', accessCount: 100 }),
        createTestSlot({ name: 'mid', accessCount: 10 }),
      ];
      
      const sorted = scoreAllSlots(slots);
      
      expect(sorted[0].name).toBe('high');
      expect(sorted[1].name).toBe('mid');
      expect(sorted[2].name).toBe('low');
    });

    it('should update zpScore on all slots', () => {
      const slots = [
        createTestSlot({ accessCount: 5 }),
        createTestSlot({ accessCount: 10 }),
      ];
      
      scoreAllSlots(slots);
      
      expect(slots[0].zpScore).toBe(256 * 5 * 1);
      expect(slots[1].zpScore).toBe(256 * 10 * 1);
    });

    it('should place @zp directive slots first', () => {
      const slots = [
        createTestSlot({ name: 'normal', accessCount: 1000 }),
        createTestSlot({ name: 'required', zpDirective: ZpDirective.Zp }),
      ];
      
      const sorted = scoreAllSlots(slots);
      
      expect(sorted[0].name).toBe('required');
      expect(sorted[1].name).toBe('normal');
    });

    it('should place @ram directive slots last', () => {
      const slots = [
        createTestSlot({ name: 'forbidden', zpDirective: ZpDirective.Ram }),
        createTestSlot({ name: 'normal', accessCount: 1 }),
      ];
      
      const sorted = scoreAllSlots(slots);
      
      expect(sorted[0].name).toBe('normal');
      expect(sorted[1].name).toBe('forbidden');
    });
  });
});