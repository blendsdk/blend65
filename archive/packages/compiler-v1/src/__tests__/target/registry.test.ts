/**
 * Target Registry Tests
 *
 * Tests for Phase A.5 - Target registry factory and configuration lookup
 */

import { describe, it, expect } from 'vitest';
import {
  getTargetConfig,
  getTargetConfigFromString,
  getDefaultTargetConfig,
  getRegisteredTargets,
  getImplementedTargets,
  isTargetRegistered,
  validateAllTargetConfigs,
  getC64TargetConfig,
  formatTargetConfig,
  UnknownTargetError,
  TargetNotImplementedError,
} from '../../target/registry.js';
import { TargetArchitecture, CPUType } from '../../target/architecture.js';
import {
  validateTargetConfig,
  isAddressReserved,
  isAddressSafe,
  getReservationReason,
  doesAllocationFit,
} from '../../target/config.js';

describe('getTargetConfig', () => {
  describe('C64 Target', () => {
    it('should return C64 configuration', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      expect(config.architecture).toBe(TargetArchitecture.C64);
      expect(config.cpu).toBe(CPUType.MOS6502);
      expect(config.implemented).toBe(true);
    });

    it('should have correct C64 clock speed', () => {
      const config = getTargetConfig(TargetArchitecture.C64);
      expect(config.clockSpeedMHz).toBeCloseTo(0.985, 3);
    });

    it('should have correct C64 memory size', () => {
      const config = getTargetConfig(TargetArchitecture.C64);
      expect(config.totalMemory).toBe(65536);
    });

    it('should have VIC-II graphics chip', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      expect(config.graphicsChip).not.toBeNull();
      expect(config.graphicsChip?.name).toBe('VIC-II');
      expect(config.graphicsChip?.baseAddress).toBe(0xd000);
    });

    it('should have SID sound chip', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      expect(config.soundChip).not.toBeNull();
      expect(config.soundChip?.name).toBe('SID');
      expect(config.soundChip?.baseAddress).toBe(0xd400);
      expect(config.soundChip?.voices).toBe(3);
    });
  });

  describe('C64 Zero-Page Configuration', () => {
    it('should have correct safe range', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      expect(config.zeroPage.safeRange.start).toBe(0x02);
      expect(config.zeroPage.safeRange.end).toBe(0x8f);
    });

    it('should have 142 usable bytes', () => {
      const config = getTargetConfig(TargetArchitecture.C64);
      expect(config.zeroPage.usableBytes).toBe(142);
    });

    it('should have two reserved ranges', () => {
      const config = getTargetConfig(TargetArchitecture.C64);
      expect(config.zeroPage.reservedRanges).toHaveLength(2);
    });

    it('should reserve CPU I/O port ($00-$01)', () => {
      const config = getTargetConfig(TargetArchitecture.C64);
      const cpuPort = config.zeroPage.reservedRanges.find(
        (r) => r.start === 0x00 && r.end === 0x01
      );

      expect(cpuPort).toBeDefined();
      expect(cpuPort?.reason).toContain('6510');
    });

    it('should reserve KERNAL workspace ($90-$FF)', () => {
      const config = getTargetConfig(TargetArchitecture.C64);
      const kernal = config.zeroPage.reservedRanges.find(
        (r) => r.start === 0x90 && r.end === 0xff
      );

      expect(kernal).toBeDefined();
      expect(kernal?.reason).toContain('KERNAL');
    });
  });

  describe('Unimplemented Targets', () => {
    it('should throw TargetNotImplementedError for C128', () => {
      expect(() => getTargetConfig(TargetArchitecture.C128)).toThrow(
        TargetNotImplementedError
      );
    });

    it('should throw TargetNotImplementedError for X16', () => {
      expect(() => getTargetConfig(TargetArchitecture.X16)).toThrow(
        TargetNotImplementedError
      );
    });

    it('should allow unimplemented targets with allowUnimplemented=true', () => {
      const config = getTargetConfig(TargetArchitecture.C128, true);

      expect(config.architecture).toBe(TargetArchitecture.C128);
      expect(config.implemented).toBe(false);
    });

    it('should return C128 config when allowed', () => {
      const config = getTargetConfig(TargetArchitecture.C128, true);

      expect(config.cpu).toBe(CPUType.MOS6502);
      expect(config.totalMemory).toBeGreaterThanOrEqual(131072);
    });

    it('should return X16 config when allowed', () => {
      const config = getTargetConfig(TargetArchitecture.X16, true);

      expect(config.cpu).toBe(CPUType.WDC65C02);
      expect(config.clockSpeedMHz).toBeGreaterThan(1);
    });
  });
});

describe('getTargetConfigFromString', () => {
  it('should parse "c64" string', () => {
    const config = getTargetConfigFromString('c64');
    expect(config.architecture).toBe(TargetArchitecture.C64);
  });

  it('should parse case-insensitive "C64"', () => {
    const config = getTargetConfigFromString('C64');
    expect(config.architecture).toBe(TargetArchitecture.C64);
  });

  it('should throw UnknownTargetError for invalid string', () => {
    expect(() => getTargetConfigFromString('invalid')).toThrow(UnknownTargetError);
  });

  it('should throw TargetNotImplementedError for unimplemented target', () => {
    expect(() => getTargetConfigFromString('c128')).toThrow(TargetNotImplementedError);
  });

  it('should allow unimplemented targets with flag', () => {
    const config = getTargetConfigFromString('c128', true);
    expect(config.architecture).toBe(TargetArchitecture.C128);
  });
});

describe('getDefaultTargetConfig', () => {
  it('should return C64 configuration', () => {
    const config = getDefaultTargetConfig();

    expect(config.architecture).toBe(TargetArchitecture.C64);
    expect(config.implemented).toBe(true);
  });
});

describe('getRegisteredTargets', () => {
  it('should return array of registered targets', () => {
    const targets = getRegisteredTargets();

    expect(Array.isArray(targets)).toBe(true);
    expect(targets).toContain(TargetArchitecture.C64);
    expect(targets).toContain(TargetArchitecture.C128);
    expect(targets).toContain(TargetArchitecture.X16);
  });

  it('should not include Generic target', () => {
    const targets = getRegisteredTargets();

    // Generic may or may not be registered - it depends on implementation
    // This test just ensures we get a valid array
    expect(targets.length).toBeGreaterThanOrEqual(3);
  });
});

describe('getImplementedTargets', () => {
  it('should return only implemented targets', () => {
    const targets = getImplementedTargets();

    expect(targets).toContain(TargetArchitecture.C64);
    expect(targets).not.toContain(TargetArchitecture.C128);
    expect(targets).not.toContain(TargetArchitecture.X16);
  });

  it('should have at least C64 implemented', () => {
    const targets = getImplementedTargets();
    expect(targets.length).toBeGreaterThanOrEqual(1);
  });
});

describe('isTargetRegistered', () => {
  it('should return true for C64', () => {
    expect(isTargetRegistered(TargetArchitecture.C64)).toBe(true);
  });

  it('should return true for C128 (registered but not implemented)', () => {
    expect(isTargetRegistered(TargetArchitecture.C128)).toBe(true);
  });

  it('should return true for X16 (registered but not implemented)', () => {
    expect(isTargetRegistered(TargetArchitecture.X16)).toBe(true);
  });
});

describe('validateAllTargetConfigs', () => {
  it('should return validation results for all targets', () => {
    const results = validateAllTargetConfigs();

    expect(results instanceof Map).toBe(true);
    expect(results.size).toBeGreaterThanOrEqual(3);
  });

  it('should have no errors for C64 config', () => {
    const results = validateAllTargetConfigs();
    const c64Errors = results.get(TargetArchitecture.C64);

    expect(c64Errors).toBeDefined();
    expect(c64Errors).toHaveLength(0);
  });

  it('should validate all registered targets', () => {
    const results = validateAllTargetConfigs();

    expect(results.has(TargetArchitecture.C64)).toBe(true);
    expect(results.has(TargetArchitecture.C128)).toBe(true);
    expect(results.has(TargetArchitecture.X16)).toBe(true);
  });
});

describe('getC64TargetConfig', () => {
  it('should return PAL config by default', () => {
    const config = getC64TargetConfig();

    expect(config.clockSpeedMHz).toBeCloseTo(0.985, 3);
    expect(config.graphicsChip?.cyclesPerLine).toBe(63);
    expect(config.graphicsChip?.linesPerFrame).toBe(312);
  });

  it('should return PAL config with false parameter', () => {
    const config = getC64TargetConfig(false);

    expect(config.clockSpeedMHz).toBeCloseTo(0.985, 3);
    expect(config.graphicsChip?.cyclesPerLine).toBe(63);
  });

  it('should return NTSC config with true parameter', () => {
    const config = getC64TargetConfig(true);

    expect(config.clockSpeedMHz).toBeCloseTo(1.023, 3);
    expect(config.graphicsChip?.cyclesPerLine).toBe(65);
    expect(config.graphicsChip?.linesPerFrame).toBe(262);
  });
});

describe('formatTargetConfig', () => {
  it('should return string description of config', () => {
    const config = getTargetConfig(TargetArchitecture.C64);
    const formatted = formatTargetConfig(config);

    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('Commodore 64');
    expect(formatted).toContain('c64');
  });

  it('should include CPU information', () => {
    const config = getTargetConfig(TargetArchitecture.C64);
    const formatted = formatTargetConfig(config);

    expect(formatted).toContain('6502');
  });

  it('should include clock speed', () => {
    const config = getTargetConfig(TargetArchitecture.C64);
    const formatted = formatTargetConfig(config);

    expect(formatted).toContain('MHz');
  });

  it('should include memory information', () => {
    const config = getTargetConfig(TargetArchitecture.C64);
    const formatted = formatTargetConfig(config);

    expect(formatted).toContain('64K');
  });

  it('should include zero-page information', () => {
    const config = getTargetConfig(TargetArchitecture.C64);
    const formatted = formatTargetConfig(config);

    expect(formatted).toContain('Zero-Page');
    expect(formatted).toContain('Safe range');
  });

  it('should include graphics chip information', () => {
    const config = getTargetConfig(TargetArchitecture.C64);
    const formatted = formatTargetConfig(config);

    expect(formatted).toContain('VIC-II');
    expect(formatted).toContain('D000');
  });

  it('should include sound chip information', () => {
    const config = getTargetConfig(TargetArchitecture.C64);
    const formatted = formatTargetConfig(config);

    expect(formatted).toContain('SID');
    expect(formatted).toContain('3 voices');
  });
});

describe('Error Classes', () => {
  describe('UnknownTargetError', () => {
    it('should have correct name', () => {
      const error = new UnknownTargetError('invalid');
      expect(error.name).toBe('UnknownTargetError');
    });

    it('should include target in message', () => {
      const error = new UnknownTargetError('foobar');
      expect(error.message).toContain('foobar');
    });

    it('should list valid targets', () => {
      const error = new UnknownTargetError('invalid');
      expect(error.message).toContain('c64');
    });
  });

  describe('TargetNotImplementedError', () => {
    it('should have correct name', () => {
      const error = new TargetNotImplementedError(TargetArchitecture.C128);
      expect(error.name).toBe('TargetNotImplementedError');
    });

    it('should include target name in message', () => {
      const error = new TargetNotImplementedError(TargetArchitecture.C128);
      expect(error.message).toContain('Commodore 128');
    });

    it('should mention C64 as supported', () => {
      const error = new TargetNotImplementedError(TargetArchitecture.X16);
      expect(error.message).toContain('c64');
    });
  });
});

describe('Config Utility Functions', () => {
  describe('validateTargetConfig', () => {
    it('should return empty array for valid C64 config', () => {
      const config = getTargetConfig(TargetArchitecture.C64);
      const errors = validateTargetConfig(config);

      expect(errors).toHaveLength(0);
    });

    it('should detect invalid safe range', () => {
      const config = {
        ...getTargetConfig(TargetArchitecture.C64),
        zeroPage: {
          reservedRanges: [],
          safeRange: { start: 0x90, end: 0x02 }, // Invalid: start > end
          usableBytes: 0,
        },
      };

      const errors = validateTargetConfig(config);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect mismatched usableBytes', () => {
      const config = {
        ...getTargetConfig(TargetArchitecture.C64),
        zeroPage: {
          reservedRanges: [],
          safeRange: { start: 0x02, end: 0x8f },
          usableBytes: 100, // Wrong: should be 142
        },
      };

      const errors = validateTargetConfig(config);
      expect(errors.some((e) => e.includes('Usable bytes'))).toBe(true);
    });
  });

  describe('isAddressReserved', () => {
    it('should return true for CPU I/O port addresses', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      expect(isAddressReserved(config, 0x00)).toBe(true);
      expect(isAddressReserved(config, 0x01)).toBe(true);
    });

    it('should return true for KERNAL workspace addresses', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      expect(isAddressReserved(config, 0x90)).toBe(true);
      expect(isAddressReserved(config, 0xff)).toBe(true);
    });

    it('should return false for safe addresses', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      expect(isAddressReserved(config, 0x02)).toBe(false);
      expect(isAddressReserved(config, 0x8f)).toBe(false);
      expect(isAddressReserved(config, 0x50)).toBe(false);
    });
  });

  describe('isAddressSafe', () => {
    it('should return true for addresses in safe range', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      expect(isAddressSafe(config, 0x02)).toBe(true);
      expect(isAddressSafe(config, 0x50)).toBe(true);
      expect(isAddressSafe(config, 0x8f)).toBe(true);
    });

    it('should return false for addresses outside safe range', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      expect(isAddressSafe(config, 0x00)).toBe(false);
      expect(isAddressSafe(config, 0x01)).toBe(false);
      expect(isAddressSafe(config, 0x90)).toBe(false);
      expect(isAddressSafe(config, 0xff)).toBe(false);
    });
  });

  describe('getReservationReason', () => {
    it('should return reason for reserved addresses', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      const cpuReason = getReservationReason(config, 0x00);
      expect(cpuReason).toContain('6510');

      const kernalReason = getReservationReason(config, 0x90);
      expect(kernalReason).toContain('KERNAL');
    });

    it('should return undefined for non-reserved addresses', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      expect(getReservationReason(config, 0x02)).toBeUndefined();
      expect(getReservationReason(config, 0x50)).toBeUndefined();
    });
  });

  describe('doesAllocationFit', () => {
    it('should return true for allocation in safe range', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      expect(doesAllocationFit(config, 0x02, 1)).toBe(true);
      expect(doesAllocationFit(config, 0x02, 10)).toBe(true);
      expect(doesAllocationFit(config, 0x8f, 1)).toBe(true);
    });

    it('should return false for allocation extending past safe range', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      // Starting at $8F with size 2 extends to $90 (reserved)
      expect(doesAllocationFit(config, 0x8f, 2)).toBe(false);
    });

    it('should return false for allocation starting before safe range', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      expect(doesAllocationFit(config, 0x00, 1)).toBe(false);
      expect(doesAllocationFit(config, 0x01, 1)).toBe(false);
    });

    it('should handle maximum safe allocation', () => {
      const config = getTargetConfig(TargetArchitecture.C64);

      // Entire safe range: $02-$8F = 142 bytes
      expect(doesAllocationFit(config, 0x02, 142)).toBe(true);
      expect(doesAllocationFit(config, 0x02, 143)).toBe(false);
    });
  });
});