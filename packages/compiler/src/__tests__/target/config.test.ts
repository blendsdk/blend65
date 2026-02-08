/**
 * Target Config Unit Tests
 *
 * Tests for target configuration validation and zero-page utility functions.
 *
 * @module __tests__/target/config
 */

import { describe, it, expect } from 'vitest';
import { TargetArchitecture, CPUType } from '../../target/architecture.js';
import type { TargetConfig } from '../../target/config.js';
import {
  validateTargetConfig,
  isAddressReserved,
  getReservationReason,
  isAddressSafe,
  doesAllocationFit,
} from '../../target/config.js';

/**
 * Create a minimal valid target config for testing
 */
function createTestConfig(overrides?: Partial<TargetConfig>): TargetConfig {
  return {
    architecture: TargetArchitecture.C64,
    cpu: CPUType.MOS6502,
    clockSpeedMHz: 0.985,
    totalMemory: 65536,
    zeroPage: {
      reservedRanges: [
        { start: 0x00, end: 0x01, reason: 'CPU stack pointer and status' },
      ],
      safeRange: { start: 0x02, end: 0x7f },
      usableBytes: 126,
    },
    graphicsChip: null,
    soundChip: null,
    implemented: true,
    ...overrides,
  };
}

describe('Target Config', () => {
  describe('validateTargetConfig()', () => {
    it('should return empty array for valid config', () => {
      const config = createTestConfig();
      const errors = validateTargetConfig(config);
      expect(errors).toEqual([]);
    });

    it('should detect safe range start > end', () => {
      const config = createTestConfig({
        zeroPage: {
          reservedRanges: [],
          safeRange: { start: 0x80, end: 0x02 },
          usableBytes: 0,
        },
      });
      const errors = validateTargetConfig(config);
      expect(errors.some((e) => e.includes('start') && e.includes('end'))).toBe(true);
    });

    it('should detect safe range out of bounds', () => {
      const config = createTestConfig({
        zeroPage: {
          reservedRanges: [],
          safeRange: { start: 0x00, end: 0x1ff },
          usableBytes: 512,
        },
      });
      const errors = validateTargetConfig(config);
      expect(errors.some((e) => e.includes('out of zero-page bounds'))).toBe(true);
    });

    it('should detect usable bytes mismatch', () => {
      const config = createTestConfig({
        zeroPage: {
          reservedRanges: [],
          safeRange: { start: 0x02, end: 0x7f },
          usableBytes: 999,
        },
      });
      const errors = validateTargetConfig(config);
      expect(errors.some((e) => e.includes('Usable bytes'))).toBe(true);
    });

    it('should detect reserved range start > end', () => {
      const config = createTestConfig({
        zeroPage: {
          reservedRanges: [{ start: 0xff, end: 0x00, reason: 'Invalid' }],
          safeRange: { start: 0x02, end: 0x7f },
          usableBytes: 126,
        },
      });
      const errors = validateTargetConfig(config);
      expect(errors.some((e) => e.includes('Reserved range 0'))).toBe(true);
    });

    it('should detect overlapping reserved ranges', () => {
      const config = createTestConfig({
        zeroPage: {
          reservedRanges: [
            { start: 0x80, end: 0x90, reason: 'Range A' },
            { start: 0x88, end: 0x98, reason: 'Range B' },
          ],
          safeRange: { start: 0x02, end: 0x7f },
          usableBytes: 126,
        },
      });
      const errors = validateTargetConfig(config);
      expect(errors.some((e) => e.includes('overlap'))).toBe(true);
    });

    it('should validate graphics chip if present', () => {
      const config = createTestConfig({
        graphicsChip: {
          name: 'Test',
          baseAddress: 0xd000,
          cyclesPerLine: 0,
          linesPerFrame: 312,
          badlinePenalty: 40,
        },
      });
      const errors = validateTargetConfig(config);
      expect(errors.some((e) => e.includes('cycles per line'))).toBe(true);
    });

    it('should validate sound chip if present', () => {
      const config = createTestConfig({
        soundChip: {
          name: 'Test',
          baseAddress: 0xd400,
          voices: 0,
        },
      });
      const errors = validateTargetConfig(config);
      expect(errors.some((e) => e.includes('voices'))).toBe(true);
    });
  });

  describe('isAddressReserved()', () => {
    const config = createTestConfig({
      zeroPage: {
        reservedRanges: [
          { start: 0x00, end: 0x01, reason: 'CPU' },
          { start: 0x90, end: 0x9f, reason: 'Kernal' },
        ],
        safeRange: { start: 0x02, end: 0x8f },
        usableBytes: 142,
      },
    });

    it('should return true for reserved addresses', () => {
      expect(isAddressReserved(config, 0x00)).toBe(true);
      expect(isAddressReserved(config, 0x01)).toBe(true);
      expect(isAddressReserved(config, 0x90)).toBe(true);
      expect(isAddressReserved(config, 0x9f)).toBe(true);
    });

    it('should return false for unreserved addresses', () => {
      expect(isAddressReserved(config, 0x02)).toBe(false);
      expect(isAddressReserved(config, 0x50)).toBe(false);
      expect(isAddressReserved(config, 0xa0)).toBe(false);
    });
  });

  describe('getReservationReason()', () => {
    const config = createTestConfig({
      zeroPage: {
        reservedRanges: [
          { start: 0x00, end: 0x01, reason: 'CPU registers' },
          { start: 0x90, end: 0x9f, reason: 'Kernal workspace' },
        ],
        safeRange: { start: 0x02, end: 0x8f },
        usableBytes: 142,
      },
    });

    it('should return reason for reserved address', () => {
      expect(getReservationReason(config, 0x00)).toBe('CPU registers');
      expect(getReservationReason(config, 0x95)).toBe('Kernal workspace');
    });

    it('should return undefined for unreserved address', () => {
      expect(getReservationReason(config, 0x50)).toBeUndefined();
    });
  });

  describe('isAddressSafe()', () => {
    const config = createTestConfig();

    it('should return true for addresses in safe range', () => {
      expect(isAddressSafe(config, 0x02)).toBe(true);
      expect(isAddressSafe(config, 0x40)).toBe(true);
      expect(isAddressSafe(config, 0x7f)).toBe(true);
    });

    it('should return false for addresses outside safe range', () => {
      expect(isAddressSafe(config, 0x00)).toBe(false);
      expect(isAddressSafe(config, 0x01)).toBe(false);
      expect(isAddressSafe(config, 0x80)).toBe(false);
      expect(isAddressSafe(config, 0xff)).toBe(false);
    });
  });

  describe('doesAllocationFit()', () => {
    const config = createTestConfig();

    it('should return true for allocation within safe range', () => {
      expect(doesAllocationFit(config, 0x02, 1)).toBe(true);
      expect(doesAllocationFit(config, 0x02, 2)).toBe(true);
      expect(doesAllocationFit(config, 0x7f, 1)).toBe(true);
    });

    it('should return false for allocation exceeding safe range', () => {
      expect(doesAllocationFit(config, 0x7f, 2)).toBe(false);
      expect(doesAllocationFit(config, 0x01, 1)).toBe(false);
    });

    it('should handle word-sized allocations', () => {
      // 2-byte allocation starting at 0x7e should fit (0x7e, 0x7f)
      expect(doesAllocationFit(config, 0x7e, 2)).toBe(true);
      // 2-byte allocation starting at 0x7f would overflow (0x7f, 0x80)
      expect(doesAllocationFit(config, 0x7f, 2)).toBe(false);
    });
  });
});
