/**
 * Platform Factory Tests
 *
 * Tests for createCustomPlatform function.
 *
 * @module frame/platform.factory.test
 */

import { describe, it, expect } from 'vitest';
import {
  createCustomPlatform,
  validatePlatformConfig,
} from '../../frame/index.js';

describe('createCustomPlatform', () => {
  describe('basic creation', () => {
    it('should create a valid custom platform', () => {
      const platform = createCustomPlatform({
        displayName: 'My Custom System',
        frameRegionStart: 0x0300,
        frameRegionEnd: 0x0500,
        zpStart: 0x10,
        zpEnd: 0x80,
      });

      expect(platform.platform).toBe('custom');
      expect(platform.displayName).toBe('My Custom System');
    });

    it('should calculate frame region size correctly', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0300,
        frameRegionEnd: 0x0500,
        zpStart: 0x10,
        zpEnd: 0x80,
      });

      expect(platform.frameRegionSize).toBe(0x0200); // 512 bytes
    });

    it('should calculate ZP available correctly', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
      });

      expect(platform.zpAvailable).toBe(0x70); // 112 bytes
    });
  });

  describe('defaults', () => {
    it('should default zpReserved to empty array', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
      });

      expect(platform.zpReserved).toHaveLength(0);
    });

    it('should default zpScratch to last 4 bytes of ZP', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
      });

      expect(platform.zpScratch.start).toBe(0x7c); // 0x80 - 4
      expect(platform.zpScratch.end).toBe(0x80);
      expect(platform.zpScratch.size).toBe(4);
    });

    it('should default hardware stack to $0100-$0200', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
      });

      expect(platform.hwStackStart).toBe(0x0100);
      expect(platform.hwStackEnd).toBe(0x0200);
    });

    it('should default maxRecommendedCallDepth to 40', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
      });

      expect(platform.maxRecommendedCallDepth).toBe(40);
    });

    it('should default pointerSize to 2', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
      });

      expect(platform.pointerSize).toBe(2);
    });

    it('should default alignment to 1', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
      });

      expect(platform.alignment).toBe(1);
    });
  });

  describe('custom options', () => {
    it('should accept custom zpReserved', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
        zpReserved: [0x00, 0x01, 0x02],
      });

      expect(platform.zpReserved).toHaveLength(3);
      expect(platform.zpReserved).toContain(0x00);
      expect(platform.zpReserved).toContain(0x01);
      expect(platform.zpReserved).toContain(0x02);
    });

    it('should accept custom zpScratch', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
        zpScratch: {
          start: 0x70,
          end: 0x78,
          size: 8,
          label: 'my_scratch',
        },
      });

      expect(platform.zpScratch.start).toBe(0x70);
      expect(platform.zpScratch.end).toBe(0x78);
      expect(platform.zpScratch.size).toBe(8);
      expect(platform.zpScratch.label).toBe('my_scratch');
    });

    it('should accept custom maxRecommendedCallDepth', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
        maxRecommendedCallDepth: 20,
      });

      expect(platform.maxRecommendedCallDepth).toBe(20);
    });
  });

  describe('validation', () => {
    it('should throw for invalid frame region (end <= start)', () => {
      expect(() =>
        createCustomPlatform({
          displayName: 'Invalid',
          frameRegionStart: 0x0400,
          frameRegionEnd: 0x0200, // Less than start
          zpStart: 0x10,
          zpEnd: 0x80,
        }),
      ).toThrow(/Invalid frame region/);
    });

    it('should throw for invalid ZP region (end <= start)', () => {
      expect(() =>
        createCustomPlatform({
          displayName: 'Invalid',
          frameRegionStart: 0x0200,
          frameRegionEnd: 0x0400,
          zpStart: 0x80,
          zpEnd: 0x10, // Less than start
        }),
      ).toThrow(/Invalid ZP region/);
    });

    it('should throw for ZP end exceeding $100', () => {
      expect(() =>
        createCustomPlatform({
          displayName: 'Invalid',
          frameRegionStart: 0x0200,
          frameRegionEnd: 0x0400,
          zpStart: 0x10,
          zpEnd: 0x110, // Exceeds ZP limit
        }),
      ).toThrow(/exceeds zero page limit/);
    });

    it('should pass validatePlatformConfig', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
      });

      const errors = validatePlatformConfig(platform);
      expect(errors).toHaveLength(0);
    });
  });

  describe('use cases', () => {
    it('should create C64 with KERNAL disabled', () => {
      const platform = createCustomPlatform({
        displayName: 'C64 (KERNAL Disabled)',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0800, // More RAM available
        zpStart: 0x02,
        zpEnd: 0xfa, // Can use KERNAL workspace
        zpReserved: [0x00, 0x01],
      });

      expect(platform.frameRegionSize).toBe(0x0600); // 1536 bytes
      expect(platform.zpAvailable).toBe(0xf8); // 248 bytes
    });

    it('should create minimal test platform', () => {
      const platform = createCustomPlatform({
        displayName: 'Minimal Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0210, // Just 16 bytes
        zpStart: 0x10,
        zpEnd: 0x18, // Just 8 bytes
        maxRecommendedCallDepth: 5,
      });

      expect(platform.frameRegionSize).toBe(16);
      expect(platform.zpAvailable).toBe(8);
      expect(platform.maxRecommendedCallDepth).toBe(5);
    });
  });
});