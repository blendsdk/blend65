/**
 * Target Architecture Tests
 *
 * Tests for Phase A.2 - Target architecture and CPU type definitions
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

describe('TargetArchitecture Enum', () => {
  describe('Enum Values', () => {
    it('should define C64 target', () => {
      expect(TargetArchitecture.C64).toBe('c64');
    });

    it('should define C128 target', () => {
      expect(TargetArchitecture.C128).toBe('c128');
    });

    it('should define X16 target', () => {
      expect(TargetArchitecture.X16).toBe('x16');
    });

    it('should define Generic target', () => {
      expect(TargetArchitecture.Generic).toBe('generic');
    });

    it('should have exactly 4 target architectures', () => {
      const values = Object.values(TargetArchitecture);
      expect(values).toHaveLength(4);
    });
  });
});

describe('CPUType Enum', () => {
  describe('Enum Values', () => {
    it('should define MOS 6502 CPU', () => {
      expect(CPUType.MOS6502).toBe('6502');
    });

    it('should define WDC 65C02 CPU', () => {
      expect(CPUType.WDC65C02).toBe('65c02');
    });

    it('should define WDC 65816 CPU', () => {
      expect(CPUType.WDC65816).toBe('65816');
    });

    it('should have exactly 3 CPU types', () => {
      const values = Object.values(CPUType);
      expect(values).toHaveLength(3);
    });
  });
});

describe('isTargetImplemented', () => {
  describe('Implemented Targets', () => {
    it('should return true for C64', () => {
      expect(isTargetImplemented(TargetArchitecture.C64)).toBe(true);
    });
  });

  describe('Unimplemented Targets', () => {
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
});

describe('isCPUImplemented', () => {
  describe('Implemented CPUs', () => {
    it('should return true for MOS 6502', () => {
      expect(isCPUImplemented(CPUType.MOS6502)).toBe(true);
    });
  });

  describe('Unimplemented CPUs', () => {
    it('should return false for WDC 65C02', () => {
      expect(isCPUImplemented(CPUType.WDC65C02)).toBe(false);
    });

    it('should return false for WDC 65816', () => {
      expect(isCPUImplemented(CPUType.WDC65816)).toBe(false);
    });
  });
});

describe('getTargetDisplayName', () => {
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

describe('getCPUDisplayName', () => {
  it('should return "MOS 6502/6510" for MOS6502', () => {
    expect(getCPUDisplayName(CPUType.MOS6502)).toBe('MOS 6502/6510');
  });

  it('should return "WDC 65C02" for WDC65C02', () => {
    expect(getCPUDisplayName(CPUType.WDC65C02)).toBe('WDC 65C02');
  });

  it('should return "WDC 65816" for WDC65816', () => {
    expect(getCPUDisplayName(CPUType.WDC65816)).toBe('WDC 65816');
  });
});

describe('parseTargetArchitecture', () => {
  describe('C64 Parsing', () => {
    it('should parse "c64"', () => {
      expect(parseTargetArchitecture('c64')).toBe(TargetArchitecture.C64);
    });

    it('should parse "C64" (uppercase)', () => {
      expect(parseTargetArchitecture('C64')).toBe(TargetArchitecture.C64);
    });

    it('should parse "commodore64"', () => {
      expect(parseTargetArchitecture('commodore64')).toBe(TargetArchitecture.C64);
    });

    it('should parse "COMMODORE64"', () => {
      expect(parseTargetArchitecture('COMMODORE64')).toBe(TargetArchitecture.C64);
    });
  });

  describe('C128 Parsing', () => {
    it('should parse "c128"', () => {
      expect(parseTargetArchitecture('c128')).toBe(TargetArchitecture.C128);
    });

    it('should parse "C128" (uppercase)', () => {
      expect(parseTargetArchitecture('C128')).toBe(TargetArchitecture.C128);
    });

    it('should parse "commodore128"', () => {
      expect(parseTargetArchitecture('commodore128')).toBe(TargetArchitecture.C128);
    });
  });

  describe('X16 Parsing', () => {
    it('should parse "x16"', () => {
      expect(parseTargetArchitecture('x16')).toBe(TargetArchitecture.X16);
    });

    it('should parse "X16" (uppercase)', () => {
      expect(parseTargetArchitecture('X16')).toBe(TargetArchitecture.X16);
    });

    it('should parse "commanderx16"', () => {
      expect(parseTargetArchitecture('commanderx16')).toBe(TargetArchitecture.X16);
    });
  });

  describe('Generic Parsing', () => {
    it('should parse "generic"', () => {
      expect(parseTargetArchitecture('generic')).toBe(TargetArchitecture.Generic);
    });

    it('should parse "6502"', () => {
      expect(parseTargetArchitecture('6502')).toBe(TargetArchitecture.Generic);
    });
  });

  describe('Invalid Parsing', () => {
    it('should return null for invalid target', () => {
      expect(parseTargetArchitecture('invalid')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseTargetArchitecture('')).toBeNull();
    });

    it('should return null for partial match', () => {
      expect(parseTargetArchitecture('c6')).toBeNull();
    });

    it('should ignore non-alphanumeric characters', () => {
      // "c-64" becomes "c64" after normalization
      expect(parseTargetArchitecture('c-64')).toBe(TargetArchitecture.C64);
    });
  });
});

describe('getDefaultTarget', () => {
  it('should return C64 as default target', () => {
    expect(getDefaultTarget()).toBe(TargetArchitecture.C64);
  });
});

describe('getDefaultCPU', () => {
  it('should return MOS6502 for C64', () => {
    expect(getDefaultCPU(TargetArchitecture.C64)).toBe(CPUType.MOS6502);
  });

  it('should return MOS6502 for C128 (8502 is 6502-compatible)', () => {
    expect(getDefaultCPU(TargetArchitecture.C128)).toBe(CPUType.MOS6502);
  });

  it('should return WDC65C02 for X16', () => {
    expect(getDefaultCPU(TargetArchitecture.X16)).toBe(CPUType.WDC65C02);
  });

  it('should return MOS6502 for Generic', () => {
    expect(getDefaultCPU(TargetArchitecture.Generic)).toBe(CPUType.MOS6502);
  });
});