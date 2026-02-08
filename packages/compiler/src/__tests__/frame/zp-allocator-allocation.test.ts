/**
 * ZP Allocator Allocation Tests
 *
 * Tests for the allocate() method and related allocation functionality.
 *
 * @module __tests__/frame/zp-allocator-allocation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ZpAllocator,
  ZpAllocationSummary,
  ZpAllocationError,
} from '../../frame/allocator/zp-allocator.js';
import { ZpPool } from '../../frame/allocator/zp-pool.js';
import { TEST_PLATFORM_CONFIG, C64_PLATFORM_CONFIG } from '../../frame/platform.js';
import { SlotLocation, SlotKind, ZpDirective } from '../../frame/enums.js';
import { FrameSlot, createFrameSlot } from '../../frame/types.js';
import { TypeKind } from '../../semantic/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a byte slot with specified properties.
 */
function createByteSlot(
  name: string,
  options?: {
    zpDirective?: ZpDirective;
    accessCount?: number;
    maxLoopDepth?: number;
  }
): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, {
    kind: TypeKind.Byte,
    name: 'byte',
    size: 1,
    isSigned: false,
    isAssignable: true,
  }, {
    zpDirective: options?.zpDirective ?? ZpDirective.None,
    accessCount: options?.accessCount ?? 1,
    maxLoopDepth: options?.maxLoopDepth ?? 0,
  });
}

/**
 * Create a word slot with specified properties.
 */
function createWordSlot(
  name: string,
  options?: {
    zpDirective?: ZpDirective;
    accessCount?: number;
    maxLoopDepth?: number;
  }
): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, {
    kind: TypeKind.Word,
    name: 'word',
    size: 2,
    isSigned: false,
    isAssignable: true,
  }, {
    zpDirective: options?.zpDirective ?? ZpDirective.None,
    accessCount: options?.accessCount ?? 1,
    maxLoopDepth: options?.maxLoopDepth ?? 0,
  });
}

/**
 * Create an array slot.
 */
function createArraySlot(
  name: string,
  elementCount: number,
  options?: {
    zpDirective?: ZpDirective;
  }
): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, {
    kind: TypeKind.Array,
    name: `byte[${elementCount}]`,
    size: elementCount,
    isSigned: false,
    isAssignable: true,
    elementCount,
    elementType: {
      kind: TypeKind.Byte,
      name: 'byte',
      size: 1,
      isSigned: false,
      isAssignable: true,
    },
  }, {
    zpDirective: options?.zpDirective ?? ZpDirective.None,
  });
}

// ============================================================================
// Basic Allocation Tests
// ============================================================================

describe('ZpAllocator.allocate() - Basic Allocation', () => {
  let allocator: ZpAllocator;

  beforeEach(() => {
    allocator = new ZpAllocator(TEST_PLATFORM_CONFIG);
  });

  it('should allocate a single byte slot to ZP', () => {
    const slot = createByteSlot('counter');
    const result = allocator.allocate([slot]);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.zpAllocatedCount).toBe(1);
    expect(result.frameAllocatedCount).toBe(0);
    expect(result.zpBytesUsed).toBe(1);

    expect(slot.location).toBe(SlotLocation.ZeroPage);
    expect(slot.address).toBeGreaterThanOrEqual(TEST_PLATFORM_CONFIG.zpStart);
    expect(slot.address).toBeLessThan(TEST_PLATFORM_CONFIG.zpEnd);
  });

  it('should allocate a single word slot to ZP', () => {
    const slot = createWordSlot('pointer');
    const result = allocator.allocate([slot]);

    expect(result.success).toBe(true);
    expect(result.zpAllocatedCount).toBe(1);
    expect(result.zpBytesUsed).toBe(2);

    expect(slot.location).toBe(SlotLocation.ZeroPage);
    expect(slot.address).toBeGreaterThanOrEqual(TEST_PLATFORM_CONFIG.zpStart);
  });

  it('should allocate multiple slots to ZP', () => {
    const slots = [
      createByteSlot('a'),
      createByteSlot('b'),
      createWordSlot('ptr'),
    ];

    const result = allocator.allocate(slots);

    expect(result.success).toBe(true);
    expect(result.zpAllocatedCount).toBe(3);
    expect(result.zpBytesUsed).toBe(4); // 1 + 1 + 2

    // All should be in ZP
    for (const slot of slots) {
      expect(slot.location).toBe(SlotLocation.ZeroPage);
    }

    // Addresses should be unique
    const addresses = slots.map(s => s.address);
    const uniqueAddresses = new Set(addresses);
    expect(uniqueAddresses.size).toBe(3);
  });

  it('should return empty results for empty slots array', () => {
    const result = allocator.allocate([]);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.zpAllocatedCount).toBe(0);
    expect(result.frameAllocatedCount).toBe(0);
    expect(result.zpBytesUsed).toBe(0);
  });
});

// ============================================================================
// Directive Handling Tests
// ============================================================================

describe('ZpAllocator.allocate() - Directive Handling', () => {
  let allocator: ZpAllocator;

  beforeEach(() => {
    allocator = new ZpAllocator(TEST_PLATFORM_CONFIG);
  });

  describe('@zp directive', () => {
    it('should allocate @zp slots to ZP first', () => {
      const slots = [
        createByteSlot('normal'),
        createByteSlot('required', { zpDirective: ZpDirective.Zp }),
      ];

      const result = allocator.allocate(slots);

      expect(result.success).toBe(true);
      expect(result.requiredCount).toBe(1);

      // @zp slot must be in ZP
      const requiredSlot = slots.find(s => s.name === 'required')!;
      expect(requiredSlot.location).toBe(SlotLocation.ZeroPage);
    });

    it('should allocate multiple @zp slots before automatic slots', () => {
      const slots = [
        createByteSlot('auto1'),
        createByteSlot('zp1', { zpDirective: ZpDirective.Zp }),
        createByteSlot('auto2'),
        createWordSlot('zp2', { zpDirective: ZpDirective.Zp }),
      ];

      const result = allocator.allocate(slots);

      expect(result.success).toBe(true);
      expect(result.requiredCount).toBe(2);

      // Both @zp slots must be in ZP
      expect(slots[1].location).toBe(SlotLocation.ZeroPage);
      expect(slots[3].location).toBe(SlotLocation.ZeroPage);
    });

    it('should report error when @zp slot cannot fit', () => {
      // Create an allocator with a small pool that we can exhaust
      const smallConfig = {
        ...TEST_PLATFORM_CONFIG,
        zpStart: 0x10,
        zpEnd: 0x12, // Only 2 bytes available
        zpReserved: [],
        zpScratch: { start: 0xFF, end: 0xFF }, // No scratch in this test
      };
      const smallAllocator = new ZpAllocator(smallConfig);

      // Try to allocate 3 bytes when only 2 are available
      const slots = [
        createWordSlot('ptr', { zpDirective: ZpDirective.Zp }), // 2 bytes
        createByteSlot('extra', { zpDirective: ZpDirective.Zp }), // 1 more byte - won't fit
      ];

      const result = smallAllocator.allocate(slots);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].slot.name).toBe('extra');
      expect(result.errors[0].requestedSize).toBe(1);
      expect(result.errors[0].message).toContain('@zp variable "extra"');
    });
  });

  describe('@ram directive', () => {
    it('should never allocate @ram slots to ZP', () => {
      const slots = [
        createByteSlot('normal'),
        createByteSlot('forbidden', { zpDirective: ZpDirective.Ram }),
      ];

      const result = allocator.allocate(slots);

      expect(result.success).toBe(true);
      expect(result.forbiddenCount).toBe(1);

      // @ram slot must be in frame region
      const forbiddenSlot = slots.find(s => s.name === 'forbidden')!;
      expect(forbiddenSlot.location).toBe(SlotLocation.FrameRegion);
    });

    it('should count @ram slots in frameAllocatedCount', () => {
      const slots = [
        createByteSlot('a', { zpDirective: ZpDirective.Ram }),
        createByteSlot('b', { zpDirective: ZpDirective.Ram }),
      ];

      const result = allocator.allocate(slots);

      expect(result.success).toBe(true);
      expect(result.frameAllocatedCount).toBe(2);
      expect(result.zpAllocatedCount).toBe(0);
    });
  });

  describe('automatic (no directive)', () => {
    it('should allocate by score when no directives', () => {
      // Create slots with different scores
      const lowScore = createByteSlot('low', { accessCount: 1, maxLoopDepth: 0 });
      const highScore = createByteSlot('high', { accessCount: 10, maxLoopDepth: 2 });

      const result = allocator.allocate([lowScore, highScore]);

      expect(result.success).toBe(true);
      expect(result.automaticCount).toBe(2);

      // Both should be in ZP (plenty of space)
      expect(lowScore.location).toBe(SlotLocation.ZeroPage);
      expect(highScore.location).toBe(SlotLocation.ZeroPage);
    });
  });
});

// ============================================================================
// Array Handling Tests
// ============================================================================

describe('ZpAllocator.allocate() - Array Handling', () => {
  let allocator: ZpAllocator;

  beforeEach(() => {
    allocator = new ZpAllocator(TEST_PLATFORM_CONFIG);
  });

  it('should never allocate arrays to ZP', () => {
    const slot = createArraySlot('buffer', 16);
    const result = allocator.allocate([slot]);

    expect(result.success).toBe(true);
    expect(result.frameAllocatedCount).toBe(1);
    expect(result.zpAllocatedCount).toBe(0);
    expect(slot.location).toBe(SlotLocation.FrameRegion);
  });

  it('should allocate non-array slots while skipping arrays', () => {
    const slots = [
      createByteSlot('counter'),
      createArraySlot('buffer', 32),
      createWordSlot('pointer'),
    ];

    const result = allocator.allocate(slots);

    expect(result.success).toBe(true);
    expect(result.zpAllocatedCount).toBe(2);
    expect(result.frameAllocatedCount).toBe(1);

    expect(slots[0].location).toBe(SlotLocation.ZeroPage);
    expect(slots[1].location).toBe(SlotLocation.FrameRegion);
    expect(slots[2].location).toBe(SlotLocation.ZeroPage);
  });
});

// ============================================================================
// ZP Full Tests
// ============================================================================

describe('ZpAllocator.allocate() - ZP Full Behavior', () => {
  it('should fallback to frame region when ZP is full', () => {
    // Create a small ZP pool with 3 bytes
    const smallConfig = {
      ...TEST_PLATFORM_CONFIG,
      zpStart: 0x10,
      zpEnd: 0x13, // 3 bytes available
      zpReserved: [],
      zpScratch: { start: 0xFF, end: 0xFF },
    };
    const allocator = new ZpAllocator(smallConfig);

    // Create slots that exceed ZP capacity
    // Byte slots have higher score (256) than word slots (128)
    // So bytes are allocated first, then words
    const slots = [
      createByteSlot('byte1'), // 1 byte, score 256 -> ZP
      createByteSlot('byte2'), // 1 byte, score 256 -> ZP
      createByteSlot('byte3'), // 1 byte, score 256 -> ZP (fills 3 bytes)
      createByteSlot('extra'), // 1 byte, score 256 -> frame (no space)
    ];

    const result = allocator.allocate(slots);

    expect(result.success).toBe(true);
    expect(result.zpAllocatedCount).toBe(3);
    expect(result.frameAllocatedCount).toBe(1);

    // First 3 should be in ZP, last one in frame
    // Note: allocation order is by score, but all have same score
    // so they are allocated in array order
    const zpSlots = slots.filter(s => s.location === SlotLocation.ZeroPage);
    const frameSlots = slots.filter(s => s.location === SlotLocation.FrameRegion);

    expect(zpSlots).toHaveLength(3);
    expect(frameSlots).toHaveLength(1);
  });

  it('should allocate high-score slots first when ZP is limited', () => {
    // Create a small ZP pool with only 1 byte
    const smallConfig = {
      ...TEST_PLATFORM_CONFIG,
      zpStart: 0x10,
      zpEnd: 0x11, // 1 byte only
      zpReserved: [],
      zpScratch: { start: 0xFF, end: 0xFF },
    };
    const allocator = new ZpAllocator(smallConfig);

    // Create slots with different scores
    // Low: 256 * 1 * 1 = 256
    // High: 256 * 100 * 8 = 204800
    const lowScore = createByteSlot('low', { accessCount: 1, maxLoopDepth: 0 });
    const highScore = createByteSlot('high', { accessCount: 100, maxLoopDepth: 3 });

    // Pass low score first in array - should still allocate high score to ZP
    const result = allocator.allocate([lowScore, highScore]);

    expect(result.success).toBe(true);

    // High score should be in ZP (allocated first by score)
    expect(highScore.location).toBe(SlotLocation.ZeroPage);

    // Low score should be in frame (no ZP space left after high score)
    expect(lowScore.location).toBe(SlotLocation.FrameRegion);
  });
});

// ============================================================================
// Summary Statistics Tests
// ============================================================================

describe('ZpAllocator.allocate() - Summary Statistics', () => {
  let allocator: ZpAllocator;

  beforeEach(() => {
    allocator = new ZpAllocator(TEST_PLATFORM_CONFIG);
  });

  it('should report correct counts for mixed slots', () => {
    const slots = [
      createByteSlot('zp1', { zpDirective: ZpDirective.Zp }),
      createByteSlot('zp2', { zpDirective: ZpDirective.Zp }),
      createByteSlot('ram1', { zpDirective: ZpDirective.Ram }),
      createByteSlot('auto1'),
      createByteSlot('auto2'),
      createByteSlot('auto3'),
    ];

    const result = allocator.allocate(slots);

    expect(result.requiredCount).toBe(2);
    expect(result.forbiddenCount).toBe(1);
    expect(result.automaticCount).toBe(3);

    // Total should match: 2 required + 1 forbidden + 3 automatic = 6
    expect(result.zpAllocatedCount + result.frameAllocatedCount).toBe(6);
  });

  it('should track zpBytesUsed correctly', () => {
    const slots = [
      createByteSlot('a'), // 1 byte
      createWordSlot('b'), // 2 bytes
      createByteSlot('c'), // 1 byte
    ];

    const result = allocator.allocate(slots);

    expect(result.zpBytesUsed).toBe(4);
  });

  it('should include pool stats in summary', () => {
    const slots = [createByteSlot('counter')];
    const result = allocator.allocate(slots);

    expect(result.poolStats).toBeDefined();
    expect(result.poolStats.bytesUsed).toBe(1);
    expect(result.poolStats.bytesFree).toBeGreaterThan(0);
  });
});

// ============================================================================
// tryAllocateSlot Tests
// ============================================================================

describe('ZpAllocator.tryAllocateSlot()', () => {
  let allocator: ZpAllocator;

  beforeEach(() => {
    allocator = new ZpAllocator(TEST_PLATFORM_CONFIG);
  });

  it('should allocate byte slot successfully', () => {
    const slot = createByteSlot('counter');

    const success = allocator.tryAllocateSlot(slot);

    expect(success).toBe(true);
    expect(slot.location).toBe(SlotLocation.ZeroPage);
    expect(slot.address).toBeGreaterThanOrEqual(TEST_PLATFORM_CONFIG.zpStart);
  });

  it('should allocate word slot successfully', () => {
    const slot = createWordSlot('pointer');

    const success = allocator.tryAllocateSlot(slot);

    expect(success).toBe(true);
    expect(slot.location).toBe(SlotLocation.ZeroPage);
  });

  it('should reject array slots', () => {
    const slot = createArraySlot('buffer', 16);

    const success = allocator.tryAllocateSlot(slot);

    expect(success).toBe(false);
    // Location should remain default (FrameRegion)
    expect(slot.location).toBe(SlotLocation.FrameRegion);
  });

  it('should return false when ZP is full', () => {
    const smallConfig = {
      ...TEST_PLATFORM_CONFIG,
      zpStart: 0x10,
      zpEnd: 0x11, // Only 1 byte
      zpReserved: [],
      zpScratch: { start: 0xFF, end: 0xFF },
    };
    const smallAllocator = new ZpAllocator(smallConfig);

    // First allocation should succeed
    const slot1 = createByteSlot('first');
    expect(smallAllocator.tryAllocateSlot(slot1)).toBe(true);

    // Second allocation should fail (no space)
    const slot2 = createByteSlot('second');
    expect(smallAllocator.tryAllocateSlot(slot2)).toBe(false);
  });
});

// ============================================================================
// canAllocateSlot Tests
// ============================================================================

describe('ZpAllocator.canAllocateSlot()', () => {
  let allocator: ZpAllocator;

  beforeEach(() => {
    allocator = new ZpAllocator(TEST_PLATFORM_CONFIG);
  });

  it('should return true for byte slot with space', () => {
    const slot = createByteSlot('counter');
    expect(allocator.canAllocateSlot(slot)).toBe(true);
  });

  it('should return true for word slot with space', () => {
    const slot = createWordSlot('pointer');
    expect(allocator.canAllocateSlot(slot)).toBe(true);
  });

  it('should return false for array slots', () => {
    const slot = createArraySlot('buffer', 16);
    expect(allocator.canAllocateSlot(slot)).toBe(false);
  });

  it('should return false for @ram directive slots', () => {
    const slot = createByteSlot('forbidden', { zpDirective: ZpDirective.Ram });
    expect(allocator.canAllocateSlot(slot)).toBe(false);
  });

  it('should return true for @zp directive slots with space', () => {
    const slot = createByteSlot('required', { zpDirective: ZpDirective.Zp });
    expect(allocator.canAllocateSlot(slot)).toBe(true);
  });

  it('should return false when ZP is full', () => {
    const smallConfig = {
      ...TEST_PLATFORM_CONFIG,
      zpStart: 0x10,
      zpEnd: 0x11, // Only 1 byte
      zpReserved: [],
      zpScratch: { start: 0xFF, end: 0xFF },
    };
    const smallAllocator = new ZpAllocator(smallConfig);

    // Exhaust ZP
    const slot1 = createByteSlot('first');
    smallAllocator.tryAllocateSlot(slot1);

    // Now canAllocateSlot should return false
    const slot2 = createByteSlot('second');
    expect(smallAllocator.canAllocateSlot(slot2)).toBe(false);
  });
});

// ============================================================================
// Reset Tests
// ============================================================================

describe('ZpAllocator.allocate() after reset()', () => {
  it('should allow reallocation after reset', () => {
    const allocator = new ZpAllocator(TEST_PLATFORM_CONFIG);

    // First allocation
    const slots1 = [createByteSlot('a'), createByteSlot('b')];
    const result1 = allocator.allocate(slots1);
    expect(result1.zpBytesUsed).toBe(2);

    // Reset
    allocator.reset();

    // Addresses should be reusable
    const slots2 = [createByteSlot('c')];
    const result2 = allocator.allocate(slots2);

    expect(result2.success).toBe(true);
    // First address should be available again
    expect(slots2[0].address).toBe(slots1[0].address);
  });
});

// ============================================================================
// C64 Platform Tests
// ============================================================================

describe('ZpAllocator.allocate() - C64 Platform', () => {
  let allocator: ZpAllocator;

  beforeEach(() => {
    allocator = new ZpAllocator(C64_PLATFORM_CONFIG);
  });

  it('should allocate within C64 ZP range', () => {
    const slot = createByteSlot('counter');
    const result = allocator.allocate([slot]);

    expect(result.success).toBe(true);
    expect(slot.address).toBeGreaterThanOrEqual(C64_PLATFORM_CONFIG.zpStart);
    expect(slot.address).toBeLessThan(C64_PLATFORM_CONFIG.zpEnd);
  });

  it('should respect C64 reserved addresses', () => {
    // Allocate many bytes to check reserved addresses aren't used
    const slots: FrameSlot[] = [];
    for (let i = 0; i < 50; i++) {
      slots.push(createByteSlot(`var${i}`));
    }

    const result = allocator.allocate(slots);

    // Check no allocated address is in reserved list
    for (const slot of slots) {
      if (slot.location === SlotLocation.ZeroPage) {
        expect(C64_PLATFORM_CONFIG.zpReserved).not.toContain(slot.address);
      }
    }
  });
});