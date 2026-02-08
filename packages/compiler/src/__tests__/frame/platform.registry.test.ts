/**
 * Platform Registry Tests
 *
 * Tests for platform lookup functions:
 * - getPlatformConfig
 * - getAvailablePlatforms
 * - hasPlatform
 *
 * @module frame/platform.registry.test
 */

import { describe, it, expect } from 'vitest';
import {
  getPlatformConfig,
  getAvailablePlatforms,
  hasPlatform,
  C64_PLATFORM_CONFIG,
  X16_PLATFORM_CONFIG,
  TEST_PLATFORM_CONFIG,
} from '../../frame/index.js';

describe('getPlatformConfig', () => {
  describe('known platforms', () => {
    it('should return C64 config for "c64"', () => {
      const config = getPlatformConfig('c64');
      expect(config).toBe(C64_PLATFORM_CONFIG);
    });

    it('should return X16 config for "x16"', () => {
      const config = getPlatformConfig('x16');
      expect(config).toBe(X16_PLATFORM_CONFIG);
    });

    it('should return test config for "test"', () => {
      const config = getPlatformConfig('test');
      expect(config).toBe(TEST_PLATFORM_CONFIG);
    });
  });

  describe('case insensitivity', () => {
    it('should work with uppercase "C64"', () => {
      const config = getPlatformConfig('C64');
      expect(config).toBe(C64_PLATFORM_CONFIG);
    });

    it('should work with uppercase "X16"', () => {
      const config = getPlatformConfig('X16');
      expect(config).toBe(X16_PLATFORM_CONFIG);
    });

    it('should work with mixed case "Test"', () => {
      const config = getPlatformConfig('Test');
      expect(config).toBe(TEST_PLATFORM_CONFIG);
    });

    it('should work with all uppercase', () => {
      expect(getPlatformConfig('C64')).toBe(C64_PLATFORM_CONFIG);
      expect(getPlatformConfig('TEST')).toBe(TEST_PLATFORM_CONFIG);
    });
  });

  describe('unknown platforms', () => {
    it('should throw for unknown platform', () => {
      expect(() => getPlatformConfig('unknown')).toThrow(/Unknown platform/);
    });

    it('should throw with helpful error message', () => {
      expect(() => getPlatformConfig('atari')).toThrow(/Available:/);
    });

    it('should include platform name in error', () => {
      expect(() => getPlatformConfig('nes')).toThrow(/"nes"/);
    });

    it('should list available platforms in error', () => {
      try {
        getPlatformConfig('invalid');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('c64');
        expect(message).toContain('x16');
        expect(message).toContain('test');
      }
    });
  });
});

describe('getAvailablePlatforms', () => {
  it('should return an array', () => {
    const platforms = getAvailablePlatforms();
    expect(Array.isArray(platforms)).toBe(true);
  });

  it('should include "c64"', () => {
    const platforms = getAvailablePlatforms();
    expect(platforms).toContain('c64');
  });

  it('should include "x16"', () => {
    const platforms = getAvailablePlatforms();
    expect(platforms).toContain('x16');
  });

  it('should include "test"', () => {
    const platforms = getAvailablePlatforms();
    expect(platforms).toContain('test');
  });

  it('should have at least 3 platforms', () => {
    const platforms = getAvailablePlatforms();
    expect(platforms.length).toBeGreaterThanOrEqual(3);
  });

  it('should return lowercase names', () => {
    const platforms = getAvailablePlatforms();
    platforms.forEach((platform) => {
      expect(platform).toBe(platform.toLowerCase());
    });
  });
});

describe('hasPlatform', () => {
  describe('existing platforms', () => {
    it('should return true for "c64"', () => {
      expect(hasPlatform('c64')).toBe(true);
    });

    it('should return true for "x16"', () => {
      expect(hasPlatform('x16')).toBe(true);
    });

    it('should return true for "test"', () => {
      expect(hasPlatform('test')).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    it('should return true for "C64"', () => {
      expect(hasPlatform('C64')).toBe(true);
    });

    it('should return true for "X16"', () => {
      expect(hasPlatform('X16')).toBe(true);
    });

    it('should return true for "TEST"', () => {
      expect(hasPlatform('TEST')).toBe(true);
    });
  });

  describe('non-existing platforms', () => {
    it('should return false for "unknown"', () => {
      expect(hasPlatform('unknown')).toBe(false);
    });

    it('should return false for "nes"', () => {
      expect(hasPlatform('nes')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasPlatform('')).toBe(false);
    });

    it('should return false for "atari"', () => {
      expect(hasPlatform('atari')).toBe(false);
    });
  });

  describe('use cases', () => {
    it('should be useful for validation before getPlatformConfig', () => {
      const platformName = 'c64';

      if (hasPlatform(platformName)) {
        const config = getPlatformConfig(platformName);
        expect(config).toBeDefined();
      } else {
        expect.fail('Platform should exist');
      }
    });

    it('should prevent errors for unknown platforms', () => {
      const platformName = 'invalid';

      if (!hasPlatform(platformName)) {
        // Can handle gracefully
        expect(true).toBe(true);
      } else {
        expect.fail('Platform should not exist');
      }
    });
  });
});

describe('TEST_PLATFORM_CONFIG', () => {
  describe('identity', () => {
    it('should have platform "custom"', () => {
      expect(TEST_PLATFORM_CONFIG.platform).toBe('custom');
    });

    it('should have descriptive display name', () => {
      expect(TEST_PLATFORM_CONFIG.displayName).toContain('Test');
    });
  });

  describe('minimal sizes', () => {
    it('should have small frame region (32 bytes)', () => {
      expect(TEST_PLATFORM_CONFIG.frameRegionSize).toBe(32);
    });

    it('should have small ZP region (16 bytes)', () => {
      expect(TEST_PLATFORM_CONFIG.zpAvailable).toBe(16);
    });

    it('should have low max call depth (10)', () => {
      expect(TEST_PLATFORM_CONFIG.maxRecommendedCallDepth).toBe(10);
    });
  });

  describe('use cases', () => {
    it('should be useful for overflow testing', () => {
      // Small frame region makes it easy to test overflow
      expect(TEST_PLATFORM_CONFIG.frameRegionSize).toBeLessThan(100);
    });

    it('should be useful for ZP pressure testing', () => {
      // Small ZP makes it easy to test ZP allocation pressure
      expect(TEST_PLATFORM_CONFIG.zpAvailable).toBeLessThan(32);
    });
  });
});