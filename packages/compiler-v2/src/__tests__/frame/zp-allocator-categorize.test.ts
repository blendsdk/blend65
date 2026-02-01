/**
 * ZP Allocator - Categorize Tests
 *
 * Tests for categorizeSlots and getZpCandidates functions.
 *
 * @module __tests__/frame/zp-allocator-categorize
 */

import { describe, it, expect } from 'vitest';
import { TypeKind } from '../../semantic/types.js';
import { SlotKind, ZpDirective } from '../../frame/enums.js';
import { createFrameSlot, FrameSlot } from '../../frame/types.js';
import {
  categorizeSlots,
  getZpCandidates,
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

describe('ZP Allocator - Categorize', () => {
  describe('categorizeSlots', () => {
    it('should separate slots by directive', () => {
      const slots = [
        createTestSlot({ name: 'auto1', zpDirective: ZpDirective.None }),
        createTestSlot({ name: 'required1', zpDirective: ZpDirective.Zp }),
        createTestSlot({ name: 'forbidden1', zpDirective: ZpDirective.Ram }),
        createTestSlot({ name: 'auto2', zpDirective: ZpDirective.None }),
        createTestSlot({ name: 'required2', zpDirective: ZpDirective.Zp }),
      ];

      const { required, forbidden, automatic } = categorizeSlots(slots);

      expect(required.map((s) => s.name)).toEqual(['required1', 'required2']);
      expect(forbidden.map((s) => s.name)).toEqual(['forbidden1']);
      expect(automatic.map((s) => s.name)).toEqual(['auto1', 'auto2']);
    });

    it('should return empty arrays when no slots match', () => {
      const slots = [
        createTestSlot({ zpDirective: ZpDirective.None }),
        createTestSlot({ zpDirective: ZpDirective.None }),
      ];

      const { required, forbidden, automatic } = categorizeSlots(slots);

      expect(required).toHaveLength(0);
      expect(forbidden).toHaveLength(0);
      expect(automatic).toHaveLength(2);
    });

    it('should handle empty slot array', () => {
      const { required, forbidden, automatic } = categorizeSlots([]);

      expect(required).toHaveLength(0);
      expect(forbidden).toHaveLength(0);
      expect(automatic).toHaveLength(0);
    });

    it('should handle all @zp slots', () => {
      const slots = [
        createTestSlot({ name: 'zp1', zpDirective: ZpDirective.Zp }),
        createTestSlot({ name: 'zp2', zpDirective: ZpDirective.Zp }),
      ];

      const { required, forbidden, automatic } = categorizeSlots(slots);

      expect(required).toHaveLength(2);
      expect(forbidden).toHaveLength(0);
      expect(automatic).toHaveLength(0);
    });

    it('should handle all @ram slots', () => {
      const slots = [
        createTestSlot({ name: 'ram1', zpDirective: ZpDirective.Ram }),
        createTestSlot({ name: 'ram2', zpDirective: ZpDirective.Ram }),
      ];

      const { required, forbidden, automatic } = categorizeSlots(slots);

      expect(required).toHaveLength(0);
      expect(forbidden).toHaveLength(2);
      expect(automatic).toHaveLength(0);
    });
  });

  describe('getZpCandidates', () => {
    it('should return slots sorted by score (highest first)', () => {
      const slots = [
        createTestSlot({ name: 'low', accessCount: 1 }),
        createTestSlot({ name: 'high', accessCount: 100 }),
        createTestSlot({ name: 'mid', accessCount: 10 }),
      ];

      const candidates = getZpCandidates(slots);

      expect(candidates[0].name).toBe('high');
      expect(candidates[1].name).toBe('mid');
      expect(candidates[2].name).toBe('low');
    });

    it('should exclude @ram directive slots', () => {
      const slots = [
        createTestSlot({ name: 'allowed', zpDirective: ZpDirective.None }),
        createTestSlot({ name: 'forbidden', zpDirective: ZpDirective.Ram }),
      ];

      const candidates = getZpCandidates(slots);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].name).toBe('allowed');
    });

    it('should exclude array types', () => {
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
        createFrameSlot('buffer', SlotKind.Local, arrayType),
      ];

      const candidates = getZpCandidates(slots);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].name).toBe('scalar');
    });

    it('should include @zp directive slots (at top of list)', () => {
      const slots = [
        createTestSlot({ name: 'normal', accessCount: 1000 }),
        createTestSlot({ name: 'required', zpDirective: ZpDirective.Zp }),
      ];

      const candidates = getZpCandidates(slots);

      expect(candidates).toHaveLength(2);
      expect(candidates[0].name).toBe('required'); // MAX_SAFE_INTEGER score
      expect(candidates[1].name).toBe('normal');
    });

    it('should handle empty array', () => {
      const candidates = getZpCandidates([]);
      expect(candidates).toHaveLength(0);
    });

    it('should handle all excluded slots (arrays and @ram)', () => {
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
        createTestSlot({ zpDirective: ZpDirective.Ram }),
        createFrameSlot('buffer', SlotKind.Local, arrayType),
      ];

      const candidates = getZpCandidates(slots);

      expect(candidates).toHaveLength(0);
    });

    it('should update zpScore on all slots during scoring', () => {
      const slots = [
        createTestSlot({ accessCount: 5 }),
        createTestSlot({ accessCount: 10 }),
      ];

      getZpCandidates(slots);

      // Both slots should have zpScore set
      expect(slots[0].zpScore).toBeGreaterThan(0);
      expect(slots[1].zpScore).toBeGreaterThan(0);
    });

    it('should preserve order for equal scores', () => {
      const slots = [
        createTestSlot({ name: 'first', accessCount: 5 }),
        createTestSlot({ name: 'second', accessCount: 5 }),
        createTestSlot({ name: 'third', accessCount: 5 }),
      ];

      const candidates = getZpCandidates(slots);

      // All have equal scores, should maintain stable sort
      expect(candidates.map((s) => s.name)).toEqual(['first', 'second', 'third']);
    });
  });
});