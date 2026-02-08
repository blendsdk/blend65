/**
 * X16 Platform Configuration Tests
 *
 * Tests for the Commander X16 platform configuration.
 *
 * @module frame/platform.x16.test
 */

import { describe, it, expect } from 'vitest';
import {
  X16_PLATFORM_CONFIG,
  validatePlatformConfig,
} from '../../frame/index.js';

describe('X16_PLATFORM_CONFIG', () => {
  describe('identity', () => {
    it('should have platform "x16"', () => {
      expect(X16_PLATFORM_CONFIG.platform).toBe('x16');
    });

    it('should have display name "Commander X16"', () => {
      expect(X16_PLATFORM_CONFIG.displayName).toBe('Commander X16');
    });
  });

  describe('frame region', () => {
    it('should start at $0400', () => {
      expect(X16_PLATFORM_CONFIG.frameRegionStart).toBe(0x0400);
    });

    it('should end at $0800', () => {
      expect(X16_PLATFORM_CONFIG.frameRegionEnd).toBe(0x0800);
    });

    it('should have 1024 bytes (1KB)', () => {
      expect(X16_PLATFORM_CONFIG.frameRegionSize).toBe(1024);
    });

    it('should have consistent size calculation', () => {
      const calculatedSize =
        X16_PLATFORM_CONFIG.frameRegionEnd -
        X16_PLATFORM_CONFIG.frameRegionStart;
      expect(X16_PLATFORM_CONFIG.frameRegionSize).toBe(calculatedSize);
    });

    it('should have larger frame region than C64', () => {
      // X16 has more RAM
      expect(X16_PLATFORM_CONFIG.frameRegionSize).toBeGreaterThan(512);
    });
  });

  describe('zero page', () => {
    it('should start at $22', () => {
      expect(X16_PLATFORM_CONFIG.zpStart).toBe(0x22);
    });

    it('should end at $80', () => {
      expect(X16_PLATFORM_CONFIG.zpEnd).toBe(0x80);
    });

    it('should have 94 bytes available', () => {
      expect(X16_PLATFORM_CONFIG.zpAvailable).toBe(94);
    });

    it('should have consistent size calculation', () => {
      const calculatedSize =
        X16_PLATFORM_CONFIG.zpEnd - X16_PLATFORM_CONFIG.zpStart;
      expect(X16_PLATFORM_CONFIG.zpAvailable).toBe(calculatedSize);
    });

    it('should reserve $00-$21 (34 addresses)', () => {
      expect(X16_PLATFORM_CONFIG.zpReserved).toHaveLength(0x22); // 34 addresses
    });

    it('should include $00 in reserved addresses', () => {
      expect(X16_PLATFORM_CONFIG.zpReserved).toContain(0x00);
    });

    it('should include $21 in reserved addresses', () => {
      expect(X16_PLATFORM_CONFIG.zpReserved).toContain(0x21);
    });

    it('should NOT include $22 in reserved (first available)', () => {
      expect(X16_PLATFORM_CONFIG.zpReserved).not.toContain(0x22);
    });
  });

  describe('compiler scratch', () => {
    it('should start at $7C', () => {
      expect(X16_PLATFORM_CONFIG.zpScratch.start).toBe(0x7c);
    });

    it('should end at $80', () => {
      expect(X16_PLATFORM_CONFIG.zpScratch.end).toBe(0x80);
    });

    it('should have 4 bytes', () => {
      expect(X16_PLATFORM_CONFIG.zpScratch.size).toBe(4);
    });

    it('should have label "compiler_scratch"', () => {
      expect(X16_PLATFORM_CONFIG.zpScratch.label).toBe('compiler_scratch');
    });

    it('should have consistent size calculation', () => {
      const calculatedSize =
        X16_PLATFORM_CONFIG.zpScratch.end - X16_PLATFORM_CONFIG.zpScratch.start;
      expect(X16_PLATFORM_CONFIG.zpScratch.size).toBe(calculatedSize);
    });

    it('should be at end of ZP region', () => {
      expect(X16_PLATFORM_CONFIG.zpScratch.end).toBe(X16_PLATFORM_CONFIG.zpEnd);
    });
  });

  describe('hardware stack', () => {
    it('should start at $0100', () => {
      expect(X16_PLATFORM_CONFIG.hwStackStart).toBe(0x0100);
    });

    it('should end at $0200', () => {
      expect(X16_PLATFORM_CONFIG.hwStackEnd).toBe(0x0200);
    });

    it('should have 256 bytes', () => {
      const stackSize =
        X16_PLATFORM_CONFIG.hwStackEnd - X16_PLATFORM_CONFIG.hwStackStart;
      expect(stackSize).toBe(256);
    });

    it('should recommend max call depth of 40', () => {
      expect(X16_PLATFORM_CONFIG.maxRecommendedCallDepth).toBe(40);
    });
  });

  describe('type information', () => {
    it('should have pointer size of 2', () => {
      expect(X16_PLATFORM_CONFIG.pointerSize).toBe(2);
    });

    it('should have alignment of 1 (no alignment)', () => {
      expect(X16_PLATFORM_CONFIG.alignment).toBe(1);
    });
  });

  describe('validation', () => {
    it('should pass validation', () => {
      const errors = validatePlatformConfig(X16_PLATFORM_CONFIG);
      expect(errors).toHaveLength(0);
    });
  });
});