/**
 * Target Architecture Unit Tests
 *
 * Tests for target architecture enums, parsing, and utility functions.
 *
 * @module __tests__/target/architecture
 */

import { describe, it, expect } from 'vitest';
import {
  TargetArchitecture,
  CPUType,
  isTargetImplemented,
  isCPUImplemented,
  getTargetDisplayName,
  getCPUDisplayName,
  parseTargetArchitecture,
  getDefaultTarget,
  getDefaultCPU,
} from '../../target/architecture.js';

describe('Target Architecture', () => {
  describe('TargetArchitecture enum', () => {
    it('should define C64', () => {
      expect(TargetArchitecture.C64).toBe('c64');
    });

    it('should define C128', () => {
      expect(TargetArchitecture.C128).toBe('c128');
    });

    it('should define X16', () => {
      expect(TargetArchitecture.X16).toBe('x16');
    });

    it('should define Generic', () => {
      expect(TargetArchitecture.Generic).toBe('generic');
    });
  });

  describe('CPUType enum', () => {
    it('should define MOS6502', () => {
      expect(CPUType.MOS6502).toBe('6502');
    });

    it('should define WDC65C02', () => {
      expect(CPUType.WDC65C02).toBe('65c02');
    });

    it('should define WDC65816', () => {
      expect(CPUType.WDC65816).toBe('65816');
    });
  });

  describe('isTargetImplemented()', () => {
    it('should return true for C64', () => {
      expect(isTargetImplemented(TargetArchitecture.C64)).toBe(true);
    });

    it('should return false for C128', () => {
      expect(isTargetImplemented(TargetArchitecture.C128)).toBe(false);
    });

    it('should return false for X16', () => {
      expect(isTargetImplemented(TargetArchitecture.X16)).toBe(false);
    });

    it('should return false for Generic', () => {
      expect(isTargetImplemented(TargetArchitecture.Generic)).toBe(false);
    });
  });

  describe('isCPUImplemented()', () => {
    it('should return true for MOS6502', () => {
      expect(isCPUImplemented(CPUType.MOS6502)).toBe(true);
    });

    it('should return false for WDC65C02', () => {
      expect(isCPUImplemented(CPUType.WDC65C02)).toBe(false);
    });

    it('should return false for WDC65816', () => {
      expect(isCPUImplemented(CPUType.WDC65816)).toBe(false);
    });
  });

  describe('getTargetDisplayName()', () => {
    it('should return "Commodore 64" for C64', () => {
      expect(getTargetDisplayName(TargetArchitecture.C64)).toBe('Commodore 64');
    });

    it('should return "Commodore 128" for C128', () => {
      expect(getTargetDisplayName(TargetArchitecture.C128)).toBe('Commodore 128');
    });

    it('should return "Commander X16" for X16', () => {
      expect(getTargetDisplayName(TargetArchitecture.X16)).toBe('Commander X16');
    });

    it('should return "Generic 6502" for Generic', () => {
      expect(getTargetDisplayName(TargetArchitecture.Generic)).toBe('Generic 6502');
    });
  });

  describe('getCPUDisplayName()', () => {
    it('should return display name for MOS6502', () => {
      expect(getCPUDisplayName(CPUType.MOS6502)).toBe('MOS 6502/6510');
    });

    it('should return display name for WDC65C02', () => {
      expect(getCPUDisplayName(CPUType.WDC65C02)).toBe('WDC 65C02');
    });

    it('should return display name for WDC65816', () => {
      expect(getCPUDisplayName(CPUType.WDC65816)).toBe('WDC 65816');
    });
  });

  describe('parseTargetArchitecture()', () => {
    it('should parse "c64"', () => {
      expect(parseTargetArchitecture('c64')).toBe(TargetArchitecture.C64);
    });

    it('should parse "C64" (case insensitive)', () => {
      expect(parseTargetArchitecture('C64')).toBe(TargetArchitecture.C64);
    });

    it('should parse "commodore64"', () => {
      expect(parseTargetArchitecture('commodore64')).toBe(TargetArchitecture.C64);
    });

    it('should parse "c128"', () => {
      expect(parseTargetArchitecture('c128')).toBe(TargetArchitecture.C128);
    });

    it('should parse "commodore128"', () => {
      expect(parseTargetArchitecture('commodore128')).toBe(TargetArchitecture.C128);
    });

    it('should parse "x16"', () => {
      expect(parseTargetArchitecture('x16')).toBe(TargetArchitecture.X16);
    });

    it('should parse "commanderx16"', () => {
      expect(parseTargetArchitecture('commanderx16')).toBe(TargetArchitecture.X16);
    });

    it('should parse "generic"', () => {
      expect(parseTargetArchitecture('generic')).toBe(TargetArchitecture.Generic);
    });

    it('should parse "6502" as Generic', () => {
      expect(parseTargetArchitecture('6502')).toBe(TargetArchitecture.Generic);
    });

    it('should return null for unknown targets', () => {
      expect(parseTargetArchitecture('amiga')).toBeNull();
      expect(parseTargetArchitecture('atari')).toBeNull();
      expect(parseTargetArchitecture('')).toBeNull();
    });
  });

  describe('getDefaultTarget()', () => {
    it('should return C64', () => {
      expect(getDefaultTarget()).toBe(TargetArchitecture.C64);
    });
  });

  describe('getDefaultCPU()', () => {
    it('should return MOS6502 for C64', () => {
      expect(getDefaultCPU(TargetArchitecture.C64)).toBe(CPUType.MOS6502);
    });

    it('should return MOS6502 for C128', () => {
      expect(getDefaultCPU(TargetArchitecture.C128)).toBe(CPUType.MOS6502);
    });

    it('should return WDC65C02 for X16', () => {
      expect(getDefaultCPU(TargetArchitecture.X16)).toBe(CPUType.WDC65C02);
    });

    it('should return MOS6502 for Generic', () => {
      expect(getDefaultCPU(TargetArchitecture.Generic)).toBe(CPUType.MOS6502);
    });
  });
});
