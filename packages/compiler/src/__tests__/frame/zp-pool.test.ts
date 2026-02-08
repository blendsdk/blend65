/**
 * ZP Pool Tests
 *
 * Comprehensive tests for the Zero Page Pool component.
 * Uses real platform configurations - no mocks per code.md Rule 25.
 *
 * @module tests/frame/zp-pool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ZpPool,
  createZpPool,
  ZpPoolStats,
  ZpAllocationResult,
} from '../../frame/allocator/zp-pool.js';
import {
  C64_PLATFORM_CONFIG,
  X16_PLATFORM_CONFIG,
  TEST_PLATFORM_CONFIG,
  createCustomPlatform,
  PlatformConfig,
} from '../../frame/platform.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a minimal test platform for edge case testing.
 * Very small ZP range to test allocation limits quickly.
 */
function createMinimalPlatform(): PlatformConfig {
  return createCustomPlatform({
    displayName: 'Minimal Test',
    frameRegionStart: 0x0200,
    frameRegionEnd: 0x0220,
    zpStart: 0x10,
    zpEnd: 0x18, // Only 8 bytes
    zpReserved: [],
    zpScratch: {
      start: 0xfc,
      end: 0x100,
      size: 4,
      label: 'scratch',
    },
  });
}

// ============================================================================
// Constructor Tests
// ============================================================================

describe('ZpPool', () => {
  describe('constructor', () => {
    it('should create pool from C64 platform config', () => {
      const pool = new ZpPool(C64_PLATFORM_CONFIG);

      expect(pool.getConfig()).toBe(C64_PLATFORM_CONFIG);
      expect(pool.getRange()).toEqual({
        start: 0x02,
        end: 0x90,
      });
    });

    it('should create pool from X16 platform config', () => {
      const pool = new ZpPool(X16_PLATFORM_CONFIG);

      expect(pool.getConfig()).toBe(X16_PLATFORM_CONFIG);
      expect(pool.getRange()).toEqual({
        start: 0x22,
        end: 0x80,
      });
    });

    it('should create pool from test platform config', () => {
      const pool = new ZpPool(TEST_PLATFORM_CONFIG);

      expect(pool.getConfig()).toBe(TEST_PLATFORM_CONFIG);
      expect(pool.getRange()).toEqual({
        start: 0x10,
        end: 0x20,
      });
    });

    it('should mark reserved addresses as unavailable', () => {
      const pool = new ZpPool(C64_PLATFORM_CONFIG);

      // CPU indirect pointers are reserved
      expect(pool.isAvailable(0x00)).toBe(false);
      expect(pool.isAvailable(0x01)).toBe(false);

      // Address in available range should be available
      expect(pool.isAvailable(0x02)).toBe(true);
    });

    it('should mark scratch region as unavailable', () => {
      const pool = new ZpPool(C64_PLATFORM_CONFIG);

      // Scratch region $FB-$FF
      expect(pool.isAvailable(0xfb)).toBe(false);
      expect(pool.isAvailable(0xfc)).toBe(false);
      expect(pool.isAvailable(0xfd)).toBe(false);
      expect(pool.isAvailable(0xfe)).toBe(false);
    });

    it('should mark addresses outside range as unavailable', () => {
      const pool = new ZpPool(C64_PLATFORM_CONFIG);

      // Before start
      expect(pool.isAvailable(0x01)).toBe(false);

      // After end ($90 and beyond)
      expect(pool.isAvailable(0x90)).toBe(false);
      expect(pool.isAvailable(0xa0)).toBe(false);
      expect(pool.isAvailable(0xff)).toBe(false);
    });
  });

  // ============================================================================
  // createZpPool Factory Tests
  // ============================================================================

  describe('createZpPool', () => {
    it('should create pool using factory function', () => {
      const pool = createZpPool(C64_PLATFORM_CONFIG);

      expect(pool).toBeInstanceOf(ZpPool);
      expect(pool.getConfig()).toBe(C64_PLATFORM_CONFIG);
    });
  });

  // ============================================================================
  // canAllocate Tests
  // ============================================================================

  describe('canAllocate', () => {
    let pool: ZpPool;

    beforeEach(() => {
      pool = new ZpPool(TEST_PLATFORM_CONFIG);
    });

    it('should return true when bytes are available', () => {
      expect(pool.canAllocate(1)).toBe(true);
      expect(pool.canAllocate(2)).toBe(true);
      expect(pool.canAllocate(8)).toBe(true);
    });

    it('should return false for zero or negative size', () => {
      expect(pool.canAllocate(0)).toBe(false);
      expect(pool.canAllocate(-1)).toBe(false);
    });

    it('should return false when insufficient space', () => {
      const minPool = new ZpPool(createMinimalPlatform());

      // Only 8 bytes available
      expect(minPool.canAllocate(8)).toBe(true);
      expect(minPool.canAllocate(9)).toBe(false);
      expect(minPool.canAllocate(100)).toBe(false);
    });

    it('should not modify pool state', () => {
      const statsBefore = pool.getStats();

      pool.canAllocate(4);

      const statsAfter = pool.getStats();
      expect(statsAfter.bytesUsed).toBe(statsBefore.bytesUsed);
    });

    it('should consider fragmentation', () => {
      const minPool = new ZpPool(createMinimalPlatform());

      // Allocate 2 bytes, then 2 more, creating a gap
      minPool.allocate(2);
      const middle = minPool.allocate(2);
      minPool.allocate(2);

      // Free the middle block
      minPool.free(middle.address, 2);

      // Should be able to allocate 2 bytes (in the freed space)
      expect(minPool.canAllocate(2)).toBe(true);

      // Should NOT be able to allocate 4 contiguous bytes (fragmented)
      expect(minPool.canAllocate(4)).toBe(false);
    });
  });

  // ============================================================================
  // allocate Tests
  // ============================================================================

  describe('allocate', () => {
    let pool: ZpPool;

    beforeEach(() => {
      pool = new ZpPool(TEST_PLATFORM_CONFIG);
    });

    it('should allocate single byte', () => {
      const result = pool.allocate(1);

      expect(result.success).toBe(true);
      expect(result.address).toBe(0x10); // First available address
      expect(result.error).toBeUndefined();
    });

    it('should allocate multiple bytes contiguously', () => {
      const result = pool.allocate(4);

      expect(result.success).toBe(true);
      expect(result.address).toBe(0x10);

      // All 4 addresses should be allocated
      expect(pool.isAllocated(0x10)).toBe(true);
      expect(pool.isAllocated(0x11)).toBe(true);
      expect(pool.isAllocated(0x12)).toBe(true);
      expect(pool.isAllocated(0x13)).toBe(true);
    });

    it('should allocate sequentially', () => {
      const first = pool.allocate(2);
      const second = pool.allocate(2);
      const third = pool.allocate(2);

      expect(first.address).toBe(0x10);
      expect(second.address).toBe(0x12);
      expect(third.address).toBe(0x14);
    });

    it('should fail for zero size', () => {
      const result = pool.allocate(0);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid allocation size');
    });

    it('should fail for negative size', () => {
      const result = pool.allocate(-1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid allocation size');
    });

    it('should fail when pool is exhausted', () => {
      const minPool = new ZpPool(createMinimalPlatform());

      // Exhaust the pool (8 bytes)
      minPool.allocate(8);

      const result = minPool.allocate(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot allocate');
    });

    it('should fail when insufficient contiguous space', () => {
      const minPool = new ZpPool(createMinimalPlatform());

      // Allocate in a pattern that creates fragmentation
      minPool.allocate(2); // $10-$11
      const mid = minPool.allocate(2); // $12-$13
      minPool.allocate(2); // $14-$15
      // Remaining: $16-$17

      // Free middle block
      minPool.free(mid.address, 2);
      // Now: $10-$11 used, $12-$13 free, $14-$15 used, $16-$17 free

      // Try to allocate 3 contiguous bytes - should fail
      const result = minPool.allocate(3);

      expect(result.success).toBe(false);
      expect(result.error).toContain('largest block');
    });

    it('should update statistics after allocation', () => {
      const statsBefore = pool.getStats();

      pool.allocate(4);

      const statsAfter = pool.getStats();
      expect(statsAfter.bytesUsed).toBe(statsBefore.bytesUsed + 4);
      expect(statsAfter.bytesFree).toBe(statsBefore.bytesFree - 4);
    });
  });

  // ============================================================================
  // allocateAt Tests
  // ============================================================================

  describe('allocateAt', () => {
    let pool: ZpPool;

    beforeEach(() => {
      pool = new ZpPool(TEST_PLATFORM_CONFIG);
    });

    it('should allocate at specific address', () => {
      const result = pool.allocateAt(0x15, 2);

      expect(result.success).toBe(true);
      expect(result.address).toBe(0x15);

      expect(pool.isAllocated(0x15)).toBe(true);
      expect(pool.isAllocated(0x16)).toBe(true);
    });

    it('should fail for reserved addresses', () => {
      const c64Pool = new ZpPool(C64_PLATFORM_CONFIG);

      // $00 is reserved (CPU indirect)
      const result = c64Pool.allocateAt(0x00, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('reserved');
    });

    it('should fail for already allocated addresses', () => {
      pool.allocateAt(0x15, 2);

      const result = pool.allocateAt(0x15, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already allocated');
    });

    it('should fail for addresses outside ZP', () => {
      const result = pool.allocateAt(0x100, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside ZP');
    });

    it('should fail for negative addresses', () => {
      const result = pool.allocateAt(-1, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside ZP');
    });

    it('should fail if range extends outside ZP', () => {
      const result = pool.allocateAt(0xff, 2);

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside ZP');
    });

    it('should fail for addresses outside allocatable range', () => {
      // Test platform: zpStart=0x10, zpEnd=0x20
      const result = pool.allocateAt(0x08, 1); // Before zpStart

      expect(result.success).toBe(false);
      expect(result.error).toContain('outside allocatable range');
    });
  });

  // ============================================================================
  // free Tests
  // ============================================================================

  describe('free', () => {
    let pool: ZpPool;

    beforeEach(() => {
      pool = new ZpPool(TEST_PLATFORM_CONFIG);
    });

    it('should free allocated addresses', () => {
      const result = pool.allocate(2);
      expect(pool.isAllocated(result.address)).toBe(true);

      pool.free(result.address, 2);

      expect(pool.isAllocated(result.address)).toBe(false);
      expect(pool.isAllocated(result.address + 1)).toBe(false);
    });

    it('should allow reallocation after free', () => {
      const first = pool.allocate(4);
      pool.free(first.address, 4);

      const second = pool.allocate(4);

      expect(second.success).toBe(true);
      expect(second.address).toBe(first.address); // Same address reused
    });

    it('should handle free of non-allocated addresses gracefully', () => {
      // Should not throw
      expect(() => pool.free(0x15, 2)).not.toThrow();
    });

    it('should not free reserved addresses', () => {
      const c64Pool = new ZpPool(C64_PLATFORM_CONFIG);

      // Try to free reserved addresses - should not make them available
      c64Pool.free(0x00, 2);

      expect(c64Pool.isAvailable(0x00)).toBe(false);
      expect(c64Pool.isAvailable(0x01)).toBe(false);
    });

    it('should update statistics after free', () => {
      const result = pool.allocate(4);
      const statsAllocated = pool.getStats();

      pool.free(result.address, 4);
      const statsFreed = pool.getStats();

      expect(statsFreed.bytesUsed).toBe(statsAllocated.bytesUsed - 4);
      expect(statsFreed.bytesFree).toBe(statsAllocated.bytesFree + 4);
    });
  });

  // ============================================================================
  // isAllocated Tests
  // ============================================================================

  describe('isAllocated', () => {
    let pool: ZpPool;

    beforeEach(() => {
      pool = new ZpPool(TEST_PLATFORM_CONFIG);
    });

    it('should return false for unallocated address', () => {
      expect(pool.isAllocated(0x10)).toBe(false);
    });

    it('should return true for allocated address', () => {
      pool.allocate(1);
      expect(pool.isAllocated(0x10)).toBe(true);
    });

    it('should return false for out-of-range addresses', () => {
      expect(pool.isAllocated(-1)).toBe(false);
      expect(pool.isAllocated(256)).toBe(false);
      expect(pool.isAllocated(1000)).toBe(false);
    });
  });

  // ============================================================================
  // isAvailable Tests
  // ============================================================================

  describe('isAvailable', () => {
    let pool: ZpPool;

    beforeEach(() => {
      pool = new ZpPool(TEST_PLATFORM_CONFIG);
    });

    it('should return true for unallocated addresses in range', () => {
      expect(pool.isAvailable(0x10)).toBe(true);
      // Note: 0x1C-0x1F is scratch region in TEST_PLATFORM_CONFIG
      expect(pool.isAvailable(0x1b)).toBe(true);
    });

    it('should return false for allocated addresses', () => {
      pool.allocate(1);
      expect(pool.isAvailable(0x10)).toBe(false);
    });

    it('should return false for addresses outside range', () => {
      // Before zpStart
      expect(pool.isAvailable(0x0f)).toBe(false);
      // At/after zpEnd
      expect(pool.isAvailable(0x20)).toBe(false);
    });

    it('should return false for out-of-bounds addresses', () => {
      expect(pool.isAvailable(-1)).toBe(false);
      expect(pool.isAvailable(256)).toBe(false);
    });
  });

  // ============================================================================
  // reset Tests
  // ============================================================================

  describe('reset', () => {
    let pool: ZpPool;

    beforeEach(() => {
      pool = new ZpPool(TEST_PLATFORM_CONFIG);
    });

    it('should clear all allocations', () => {
      pool.allocate(4);
      pool.allocate(4);

      expect(pool.getStats().bytesUsed).toBeGreaterThan(0);

      pool.reset();

      expect(pool.getStats().bytesUsed).toBe(0);
    });

    it('should allow full reallocation after reset', () => {
      // Fill the pool
      const stats = pool.getStats();
      pool.allocate(stats.bytesTotal);

      expect(pool.canAllocate(1)).toBe(false);

      pool.reset();

      expect(pool.canAllocate(stats.bytesTotal)).toBe(true);
    });

    it('should preserve reserved addresses after reset', () => {
      const c64Pool = new ZpPool(C64_PLATFORM_CONFIG);

      c64Pool.allocate(10);
      c64Pool.reset();

      // Reserved addresses should still be unavailable
      expect(c64Pool.isAvailable(0x00)).toBe(false);
      expect(c64Pool.isAvailable(0x01)).toBe(false);
    });
  });

  // ============================================================================
  // getStats Tests
  // ============================================================================

  describe('getStats', () => {
    it('should return correct initial statistics', () => {
      const pool = new ZpPool(TEST_PLATFORM_CONFIG);
      const stats = pool.getStats();

      // Test platform: zpStart=0x10, zpEnd=0x20, scratch=$1C-$20 within range
      // Effective: $10-$1B = 12 bytes
      expect(stats.bytesTotal).toBe(12);
      expect(stats.bytesUsed).toBe(0);
      expect(stats.bytesFree).toBe(12);
      expect(stats.utilizationPercent).toBe(0);
      expect(stats.freeRegions).toBe(1);
      expect(stats.largestFreeBlock).toBe(12);
    });

    it('should track bytes used correctly', () => {
      const pool = new ZpPool(TEST_PLATFORM_CONFIG);

      pool.allocate(4);
      const stats = pool.getStats();

      expect(stats.bytesUsed).toBe(4);
      expect(stats.bytesFree).toBe(8); // 12 - 4
    });

    it('should calculate utilization percentage', () => {
      const pool = new ZpPool(TEST_PLATFORM_CONFIG);

      pool.allocate(6); // Half of 12 bytes
      const stats = pool.getStats();

      expect(stats.utilizationPercent).toBe(50);
    });

    it('should track fragmentation (free regions)', () => {
      const minPool = new ZpPool(createMinimalPlatform());

      // Create fragmented pattern: allocated, free, allocated
      minPool.allocate(2); // $10-$11
      const middle = minPool.allocate(2); // $12-$13
      minPool.allocate(2); // $14-$15

      // Free middle
      minPool.free(middle.address, 2);

      const stats = minPool.getStats();

      // Should have 2 free regions: $12-$13 and $16-$17
      expect(stats.freeRegions).toBe(2);
    });

    it('should track largest free block', () => {
      const minPool = new ZpPool(createMinimalPlatform());

      // Allocate first 2 bytes, leaving 6 free
      minPool.allocate(2);
      const stats = minPool.getStats();

      expect(stats.largestFreeBlock).toBe(6);
    });

    it('should handle fully allocated pool', () => {
      const minPool = new ZpPool(createMinimalPlatform());
      const total = minPool.getStats().bytesTotal;

      minPool.allocate(total);
      const stats = minPool.getStats();

      expect(stats.bytesUsed).toBe(total);
      expect(stats.bytesFree).toBe(0);
      expect(stats.utilizationPercent).toBe(100);
      expect(stats.freeRegions).toBe(0);
      expect(stats.largestFreeBlock).toBe(0);
    });
  });

  // ============================================================================
  // getAllocatedAddresses Tests
  // ============================================================================

  describe('getAllocatedAddresses', () => {
    let pool: ZpPool;

    beforeEach(() => {
      pool = new ZpPool(TEST_PLATFORM_CONFIG);
    });

    it('should return empty array initially', () => {
      const addresses = pool.getAllocatedAddresses();
      expect(addresses).toEqual([]);
    });

    it('should return allocated addresses', () => {
      pool.allocate(2);
      pool.allocate(2);

      const addresses = pool.getAllocatedAddresses();

      expect(addresses).toEqual([0x10, 0x11, 0x12, 0x13]);
    });

    it('should not include freed addresses', () => {
      const first = pool.allocate(2);
      pool.allocate(2);
      pool.free(first.address, 2);

      const addresses = pool.getAllocatedAddresses();

      expect(addresses).toEqual([0x12, 0x13]);
    });
  });

  // ============================================================================
  // Platform-Specific Tests
  // ============================================================================

  describe('C64 platform', () => {
    let pool: ZpPool;

    beforeEach(() => {
      pool = new ZpPool(C64_PLATFORM_CONFIG);
    });

    it('should have correct ZP range', () => {
      const range = pool.getRange();
      expect(range.start).toBe(0x02);
      expect(range.end).toBe(0x90);
    });

    it('should have correct available bytes', () => {
      const stats = pool.getStats();
      expect(stats.bytesTotal).toBe(142); // 0x90 - 0x02
    });

    it('should allocate from start of range', () => {
      const result = pool.allocate(1);
      expect(result.address).toBe(0x02);
    });

    it('should not allocate at KERNAL workspace addresses', () => {
      // Fill the usable range
      const stats = pool.getStats();
      pool.allocate(stats.bytesTotal);

      // $90+ should not be allocated
      expect(pool.isAllocated(0x90)).toBe(false);
      expect(pool.isAllocated(0xa0)).toBe(false);
    });
  });

  describe('X16 platform', () => {
    let pool: ZpPool;

    beforeEach(() => {
      pool = new ZpPool(X16_PLATFORM_CONFIG);
    });

    it('should have correct ZP range', () => {
      const range = pool.getRange();
      expect(range.start).toBe(0x22);
      expect(range.end).toBe(0x80);
    });

    it('should have correct available bytes', () => {
      const stats = pool.getStats();
      // X16: zpStart=0x22, zpEnd=0x80 (94 bytes)
      // But scratch=$7C-$80 is within range, so effective = 94 - 4 = 90 bytes
      expect(stats.bytesTotal).toBe(90);
    });

    it('should allocate from start of range', () => {
      const result = pool.allocate(1);
      expect(result.address).toBe(0x22);
    });

    it('should not allocate at system workspace', () => {
      // System addresses $00-$21 should be unavailable
      expect(pool.isAvailable(0x00)).toBe(false);
      expect(pool.isAvailable(0x10)).toBe(false);
      expect(pool.isAvailable(0x21)).toBe(false);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle single-byte pool', () => {
      const config = createCustomPlatform({
        displayName: 'Single Byte',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0220,
        zpStart: 0x50,
        zpEnd: 0x51, // Only 1 byte
        zpReserved: [],
        zpScratch: {
          start: 0xfc,
          end: 0x100,
          size: 4,
          label: 'scratch',
        },
      });
      const pool = new ZpPool(config);

      expect(pool.canAllocate(1)).toBe(true);
      expect(pool.canAllocate(2)).toBe(false);

      const result = pool.allocate(1);
      expect(result.success).toBe(true);
      expect(result.address).toBe(0x50);
    });

    it('should handle allocation of full pool size', () => {
      const minPool = new ZpPool(createMinimalPlatform());
      const stats = minPool.getStats();

      const result = minPool.allocate(stats.bytesTotal);

      expect(result.success).toBe(true);
      expect(minPool.canAllocate(1)).toBe(false);
    });

    it('should handle interleaved allocate/free operations', () => {
      const pool = new ZpPool(TEST_PLATFORM_CONFIG);

      const a = pool.allocate(2);
      const b = pool.allocate(2);
      pool.free(a.address, 2);
      const c = pool.allocate(2);
      pool.free(b.address, 2);
      const d = pool.allocate(4);

      expect(c.address).toBe(a.address); // Reuses freed space
      expect(d.success).toBe(true);
    });

    it('should handle word-aligned allocations for indirect addressing', () => {
      const pool = new ZpPool(C64_PLATFORM_CONFIG);

      // Allocate 2-byte word (for indirect Y addressing)
      const result = pool.allocate(2);

      expect(result.success).toBe(true);
      // Verify both bytes are contiguous (important for (ptr),Y)
      expect(pool.isAllocated(result.address)).toBe(true);
      expect(pool.isAllocated(result.address + 1)).toBe(true);
    });
  });
});