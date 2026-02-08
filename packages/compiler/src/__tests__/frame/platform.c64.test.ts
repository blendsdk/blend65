/**
 * C64 Platform Configuration Tests
 *
 * Tests for the Commodore 64 platform configuration.
 *
 * @module frame/platform.c64.test
 */

import { describe, it, expect } from 'vitest';
import {
  C64_PLATFORM_CONFIG,
  validatePlatformConfig,
} from '../../frame/index.js';

describe('C64_PLATFORM_CONFIG', () => {
  describe('identity', () => {
    it('should have platform "c64"', () => {
      expect(C64_PLATFORM_CONFIG.platform).toBe('c64');
    });

    it('should have display name "Commodore 64"', () => {
      expect(C64_PLATFORM_CONFIG.displayName).toBe('Commodore 64');
    });
  });

  describe('frame region', () => {
    it('should start at $0200', () => {
      expect(C64_PLATFORM_CONFIG.frameRegionStart).toBe(0x0200);
    });

    it('should end at $0400', () => {
      expect(C64_PLATFORM_CONFIG.frameRegionEnd).toBe(0x0400);
    });

    it('should have 512 bytes', () => {
      expect(C64_PLATFORM_CONFIG.frameRegionSize).toBe(512);
    });

    it('should have consistent size calculation', () => {
      const calculatedSize =
        C64_PLATFORM_CONFIG.frameRegionEnd -
        C64_PLATFORM_CONFIG.frameRegionStart;
      expect(C64_PLATFORM_CONFIG.frameRegionSize).toBe(calculatedSize);
    });
  });

  describe('zero page', () => {
    it('should start at $02', () => {
      expect(C64_PLATFORM_CONFIG.zpStart).toBe(0x02);
    });

    it('should end at $90', () => {
      expect(C64_PLATFORM_CONFIG.zpEnd).toBe(0x90);
    });

    it('should have 142 bytes available', () => {
      expect(C64_PLATFORM_CONFIG.zpAvailable).toBe(142);
    });

    it('should have consistent size calculation', () => {
      const calculatedSize =
        C64_PLATFORM_CONFIG.zpEnd - C64_PLATFORM_CONFIG.zpStart;
      expect(C64_PLATFORM_CONFIG.zpAvailable).toBe(calculatedSize);
    });

    it('should reserve $00 and $01', () => {
      expect(C64_PLATFORM_CONFIG.zpReserved).toContain(0x00);
      expect(C64_PLATFORM_CONFIG.zpReserved).toContain(0x01);
    });

    it('should have exactly 2 reserved addresses', () => {
      expect(C64_PLATFORM_CONFIG.zpReserved).toHaveLength(2);
    });
  });

  describe('compiler scratch', () => {
    it('should start at $FB', () => {
      expect(C64_PLATFORM_CONFIG.zpScratch.start).toBe(0xfb);
    });

    it('should end at $FF', () => {
      expect(C64_PLATFORM_CONFIG.zpScratch.end).toBe(0xff);
    });

    it('should have 4 bytes', () => {
      expect(C64_PLATFORM_CONFIG.zpScratch.size).toBe(4);
    });

    it('should have label "compiler_scratch"', () => {
      expect(C64_PLATFORM_CONFIG.zpScratch.label).toBe('compiler_scratch');
    });

    it('should have consistent size calculation', () => {
      const calculatedSize =
        C64_PLATFORM_CONFIG.zpScratch.end -
        C64_PLATFORM_CONFIG.zpScratch.start;
      expect(C64_PLATFORM_CONFIG.zpScratch.size).toBe(calculatedSize);
    });
  });

  describe('hardware stack', () => {
    it('should start at $0100', () => {
      expect(C64_PLATFORM_CONFIG.hwStackStart).toBe(0x0100);
    });

    it('should end at $0200', () => {
      expect(C64_PLATFORM_CONFIG.hwStackEnd).toBe(0x0200);
    });

    it('should have 256 bytes', () => {
      const stackSize =
        C64_PLATFORM_CONFIG.hwStackEnd - C64_PLATFORM_CONFIG.hwStackStart;
      expect(stackSize).toBe(256);
    });

    it('should recommend max call depth of 40', () => {
      expect(C64_PLATFORM_CONFIG.maxRecommendedCallDepth).toBe(40);
    });
  });

  describe('type information', () => {
    it('should have pointer size of 2', () => {
      expect(C64_PLATFORM_CONFIG.pointerSize).toBe(2);
    });

    it('should have alignment of 1 (no alignment)', () => {
      expect(C64_PLATFORM_CONFIG.alignment).toBe(1);
    });
  });

  describe('validation', () => {
    it('should pass validation', () => {
      const errors = validatePlatformConfig(C64_PLATFORM_CONFIG);
      expect(errors).toHaveLength(0);
    });
  });
});