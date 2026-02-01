/**
 * Platform Utility Function Tests
 *
 * Tests for platform utility functions:
 * - isZeroPageAddress
 * - isInZpRange
 * - isInFrameRegion
 * - isZpReserved
 * - isZpScratch
 * - getUsableZpBytes
 * - validatePlatformConfig
 *
 * @module frame/platform.utils.test
 */

import { describe, it, expect } from 'vitest';
import {
  isZeroPageAddress,
  isInZpRange,
  isInFrameRegion,
  isZpReserved,
  isZpScratch,
  getUsableZpBytes,
  validatePlatformConfig,
  C64_PLATFORM_CONFIG,
  X16_PLATFORM_CONFIG,
  TEST_PLATFORM_CONFIG,
  createCustomPlatform,
} from '../../frame/index.js';

describe('isZeroPageAddress', () => {
  describe('valid zero page addresses', () => {
    it('should return true for $00', () => {
      expect(isZeroPageAddress(0x00)).toBe(true);
    });

    it('should return true for $FF', () => {
      expect(isZeroPageAddress(0xff)).toBe(true);
    });

    it('should return true for $50', () => {
      expect(isZeroPageAddress(0x50)).toBe(true);
    });
  });

  describe('invalid zero page addresses', () => {
    it('should return false for $100', () => {
      expect(isZeroPageAddress(0x100)).toBe(false);
    });

    it('should return false for $0200', () => {
      expect(isZeroPageAddress(0x0200)).toBe(false);
    });

    it('should return false for $FFFF', () => {
      expect(isZeroPageAddress(0xffff)).toBe(false);
    });
  });
});

describe('isInZpRange', () => {
  describe('C64 platform', () => {
    it('should return true for $02 (start)', () => {
      expect(isInZpRange(0x02, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return true for $8F (last valid)', () => {
      expect(isInZpRange(0x8f, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return false for $00 (reserved)', () => {
      expect(isInZpRange(0x00, C64_PLATFORM_CONFIG)).toBe(false);
    });

    it('should return false for $01 (reserved)', () => {
      expect(isInZpRange(0x01, C64_PLATFORM_CONFIG)).toBe(false);
    });

    it('should return false for $90 (end, exclusive)', () => {
      expect(isInZpRange(0x90, C64_PLATFORM_CONFIG)).toBe(false);
    });

    it('should return false for $FB (scratch area)', () => {
      // $FB is outside the available range ($02-$90)
      expect(isInZpRange(0xfb, C64_PLATFORM_CONFIG)).toBe(false);
    });
  });

  describe('X16 platform', () => {
    it('should return true for $22 (start)', () => {
      expect(isInZpRange(0x22, X16_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return true for $7F (last valid)', () => {
      expect(isInZpRange(0x7f, X16_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return false for $21 (reserved)', () => {
      expect(isInZpRange(0x21, X16_PLATFORM_CONFIG)).toBe(false);
    });

    it('should return false for $80 (end, exclusive)', () => {
      expect(isInZpRange(0x80, X16_PLATFORM_CONFIG)).toBe(false);
    });
  });
});

describe('isInFrameRegion', () => {
  describe('C64 platform', () => {
    it('should return true for $0200 (start)', () => {
      expect(isInFrameRegion(0x0200, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return true for $03FF (last valid)', () => {
      expect(isInFrameRegion(0x03ff, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return false for $0400 (end, exclusive)', () => {
      expect(isInFrameRegion(0x0400, C64_PLATFORM_CONFIG)).toBe(false);
    });

    it('should return false for $01FF (before region)', () => {
      expect(isInFrameRegion(0x01ff, C64_PLATFORM_CONFIG)).toBe(false);
    });

    it('should return false for $0800', () => {
      expect(isInFrameRegion(0x0800, C64_PLATFORM_CONFIG)).toBe(false);
    });
  });

  describe('X16 platform', () => {
    it('should return true for $0400 (start)', () => {
      expect(isInFrameRegion(0x0400, X16_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return true for $07FF (last valid)', () => {
      expect(isInFrameRegion(0x07ff, X16_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return false for $0800 (end, exclusive)', () => {
      expect(isInFrameRegion(0x0800, X16_PLATFORM_CONFIG)).toBe(false);
    });
  });
});

describe('isZpReserved', () => {
  describe('C64 platform', () => {
    it('should return true for $00', () => {
      expect(isZpReserved(0x00, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return true for $01', () => {
      expect(isZpReserved(0x01, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return false for $02', () => {
      expect(isZpReserved(0x02, C64_PLATFORM_CONFIG)).toBe(false);
    });

    it('should return false for $50', () => {
      expect(isZpReserved(0x50, C64_PLATFORM_CONFIG)).toBe(false);
    });
  });

  describe('X16 platform', () => {
    it('should return true for $00', () => {
      expect(isZpReserved(0x00, X16_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return true for $21', () => {
      expect(isZpReserved(0x21, X16_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return false for $22', () => {
      expect(isZpReserved(0x22, X16_PLATFORM_CONFIG)).toBe(false);
    });
  });
});

describe('isZpScratch', () => {
  describe('C64 platform', () => {
    it('should return true for $FB (start)', () => {
      expect(isZpScratch(0xfb, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return true for $FE (last valid)', () => {
      expect(isZpScratch(0xfe, C64_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return false for $FF (end, exclusive)', () => {
      expect(isZpScratch(0xff, C64_PLATFORM_CONFIG)).toBe(false);
    });

    it('should return false for $FA', () => {
      expect(isZpScratch(0xfa, C64_PLATFORM_CONFIG)).toBe(false);
    });

    it('should return false for $50', () => {
      expect(isZpScratch(0x50, C64_PLATFORM_CONFIG)).toBe(false);
    });
  });

  describe('X16 platform', () => {
    it('should return true for $7C (start)', () => {
      expect(isZpScratch(0x7c, X16_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return true for $7F (last valid)', () => {
      expect(isZpScratch(0x7f, X16_PLATFORM_CONFIG)).toBe(true);
    });

    it('should return false for $80 (end, exclusive)', () => {
      expect(isZpScratch(0x80, X16_PLATFORM_CONFIG)).toBe(false);
    });
  });
});

describe('getUsableZpBytes', () => {
  describe('C64 platform', () => {
    it('should return 142 bytes (scratch is outside ZP range)', () => {
      // C64 scratch ($FB-$FF) is outside available range ($02-$90)
      expect(getUsableZpBytes(C64_PLATFORM_CONFIG)).toBe(142);
    });
  });

  describe('X16 platform', () => {
    it('should return 90 bytes (scratch is inside ZP range)', () => {
      // X16 scratch ($7C-$80) is inside available range ($22-$80)
      // So usable = 94 - 4 = 90
      expect(getUsableZpBytes(X16_PLATFORM_CONFIG)).toBe(90);
    });
  });

  describe('test platform', () => {
    it('should return 12 bytes (scratch is inside ZP range)', () => {
      // Test scratch ($1C-$20) is inside available range ($10-$20)
      // So usable = 16 - 4 = 12
      expect(getUsableZpBytes(TEST_PLATFORM_CONFIG)).toBe(12);
    });
  });

  describe('custom platform', () => {
    it('should calculate correctly when scratch is inside range', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
        zpScratch: {
          start: 0x70,
          end: 0x80,
          size: 16,
          label: 'large_scratch',
        },
      });

      // Available = 112 bytes, scratch = 16 bytes
      // Usable = 112 - 16 = 96
      expect(getUsableZpBytes(platform)).toBe(96);
    });

    it('should not subtract scratch when outside range', () => {
      const platform = createCustomPlatform({
        displayName: 'Test',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x60,
        zpScratch: {
          start: 0x70,
          end: 0x80,
          size: 16,
          label: 'outside_scratch',
        },
      });

      // Scratch is outside ZP range, so full 80 bytes available
      expect(getUsableZpBytes(platform)).toBe(80);
    });
  });
});

describe('validatePlatformConfig', () => {
  describe('valid configurations', () => {
    it('should pass for C64_PLATFORM_CONFIG', () => {
      const errors = validatePlatformConfig(C64_PLATFORM_CONFIG);
      expect(errors).toHaveLength(0);
    });

    it('should pass for X16_PLATFORM_CONFIG', () => {
      const errors = validatePlatformConfig(X16_PLATFORM_CONFIG);
      expect(errors).toHaveLength(0);
    });

    it('should pass for TEST_PLATFORM_CONFIG', () => {
      const errors = validatePlatformConfig(TEST_PLATFORM_CONFIG);
      expect(errors).toHaveLength(0);
    });

    it('should pass for valid custom platform', () => {
      const platform = createCustomPlatform({
        displayName: 'Valid Custom',
        frameRegionStart: 0x0200,
        frameRegionEnd: 0x0400,
        zpStart: 0x10,
        zpEnd: 0x80,
      });

      const errors = validatePlatformConfig(platform);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid configurations', () => {
    it('should detect frame region size mismatch', () => {
      const invalid = {
        ...C64_PLATFORM_CONFIG,
        frameRegionSize: 999, // Wrong size
      };

      const errors = validatePlatformConfig(invalid);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Frame region size mismatch');
    });

    it('should detect ZP available mismatch', () => {
      const invalid = {
        ...C64_PLATFORM_CONFIG,
        zpAvailable: 999, // Wrong size
      };

      const errors = validatePlatformConfig(invalid);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('ZP available size mismatch');
    });

    it('should detect ZP end exceeding limit', () => {
      const invalid = {
        ...C64_PLATFORM_CONFIG,
        zpEnd: 0x110, // Exceeds $100
      };

      const errors = validatePlatformConfig(invalid);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('exceeds zero page limit'))).toBe(
        true,
      );
    });

    it('should detect scratch size mismatch', () => {
      const invalid = {
        ...C64_PLATFORM_CONFIG,
        zpScratch: {
          ...C64_PLATFORM_CONFIG.zpScratch,
          size: 99, // Wrong size
        },
      };

      const errors = validatePlatformConfig(invalid);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Scratch size mismatch');
    });

    it('should detect non-standard hardware stack size', () => {
      const invalid = {
        ...C64_PLATFORM_CONFIG,
        hwStackEnd: 0x0180, // Only 128 bytes, not 256
      };

      const errors = validatePlatformConfig(invalid);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Hardware stack size');
    });
  });
});