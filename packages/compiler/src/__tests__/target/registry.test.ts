/**
 * Target Registry Unit Tests
 *
 * Tests for the target registry factory functions and error handling.
 *
 * @module __tests__/target/registry
 */

import { describe, it, expect } from 'vitest';
import { TargetArchitecture, CPUType } from '../../target/architecture.js';
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

describe('Target Registry', () => {
  describe('getTargetConfig()', () => {
    it('should return C64 config', () => {
      const config = getTargetConfig(TargetArchitecture.C64);
      expect(config.architecture).toBe(TargetArchitecture.C64);
      expect(config.cpu).toBe(CPUType.MOS6502);
      expect(config.implemented).toBe(true);
    });

    it('should throw TargetNotImplementedError for C128', () => {
      expect(() => getTargetConfig(TargetArchitecture.C128)).toThrow(
        TargetNotImplementedError,
      );
    });

    it('should throw TargetNotImplementedError for X16', () => {
      expect(() => getTargetConfig(TargetArchitecture.X16)).toThrow(
        TargetNotImplementedError,
      );
    });

    it('should return unimplemented config when allowUnimplemented is true', () => {
      const config = getTargetConfig(TargetArchitecture.C128, true);
      expect(config.architecture).toBe(TargetArchitecture.C128);
      expect(config.implemented).toBe(false);
    });
  });

  describe('getTargetConfigFromString()', () => {
    it('should parse "c64" string', () => {
      const config = getTargetConfigFromString('c64');
      expect(config.architecture).toBe(TargetArchitecture.C64);
    });

    it('should parse "C64" case-insensitively', () => {
      const config = getTargetConfigFromString('C64');
      expect(config.architecture).toBe(TargetArchitecture.C64);
    });

    it('should throw UnknownTargetError for invalid string', () => {
      expect(() => getTargetConfigFromString('amiga')).toThrow(UnknownTargetError);
    });

    it('should throw TargetNotImplementedError for unimplemented target string', () => {
      expect(() => getTargetConfigFromString('c128')).toThrow(
        TargetNotImplementedError,
      );
    });

    it('should allow unimplemented targets when flag is set', () => {
      const config = getTargetConfigFromString('x16', true);
      expect(config.architecture).toBe(TargetArchitecture.X16);
    });
  });

  describe('getDefaultTargetConfig()', () => {
    it('should return C64 config as default', () => {
      const config = getDefaultTargetConfig();
      expect(config.architecture).toBe(TargetArchitecture.C64);
      expect(config.implemented).toBe(true);
    });

    it('should include C64 hardware details', () => {
      const config = getDefaultTargetConfig();
      expect(config.graphicsChip).not.toBeNull();
      expect(config.graphicsChip?.name).toContain('VIC');
      expect(config.soundChip).not.toBeNull();
      expect(config.soundChip?.name).toContain('SID');
    });
  });

  describe('getRegisteredTargets()', () => {
    it('should return all registered targets', () => {
      const targets = getRegisteredTargets();
      expect(targets).toContain(TargetArchitecture.C64);
      expect(targets).toContain(TargetArchitecture.C128);
      expect(targets).toContain(TargetArchitecture.X16);
    });

    it('should return at least 3 targets', () => {
      expect(getRegisteredTargets().length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getImplementedTargets()', () => {
    it('should include C64', () => {
      const targets = getImplementedTargets();
      expect(targets).toContain(TargetArchitecture.C64);
    });

    it('should not include unimplemented targets', () => {
      const targets = getImplementedTargets();
      expect(targets).not.toContain(TargetArchitecture.C128);
      expect(targets).not.toContain(TargetArchitecture.X16);
    });
  });

  describe('isTargetRegistered()', () => {
    it('should return true for registered targets', () => {
      expect(isTargetRegistered(TargetArchitecture.C64)).toBe(true);
      expect(isTargetRegistered(TargetArchitecture.C128)).toBe(true);
      expect(isTargetRegistered(TargetArchitecture.X16)).toBe(true);
    });

    it('should return false for Generic (not registered)', () => {
      expect(isTargetRegistered(TargetArchitecture.Generic)).toBe(false);
    });
  });

  describe('validateAllTargetConfigs()', () => {
    it('should validate all registered configs', () => {
      const results = validateAllTargetConfigs();
      expect(results.size).toBeGreaterThan(0);
    });

    it('should report no errors for C64 config', () => {
      const results = validateAllTargetConfigs();
      const c64Errors = results.get(TargetArchitecture.C64);
      expect(c64Errors).toEqual([]);
    });
  });

  describe('getC64TargetConfig()', () => {
    it('should return PAL config by default', () => {
      const config = getC64TargetConfig();
      expect(config.architecture).toBe(TargetArchitecture.C64);
      // PAL has 312 lines per frame
      expect(config.graphicsChip?.linesPerFrame).toBe(312);
    });

    it('should return NTSC config when flag is set', () => {
      const config = getC64TargetConfig(true);
      expect(config.architecture).toBe(TargetArchitecture.C64);
      // NTSC has 262 lines per frame
      expect(config.graphicsChip?.linesPerFrame).toBe(262);
    });
  });

  describe('formatTargetConfig()', () => {
    it('should format C64 config as readable string', () => {
      const config = getDefaultTargetConfig();
      const formatted = formatTargetConfig(config);

      expect(formatted).toContain('Commodore 64');
      expect(formatted).toContain('MHz');
      expect(formatted).toContain('Zero-Page');
      expect(formatted).toContain('Implemented: Yes');
    });

    it('should include graphics chip info', () => {
      const config = getDefaultTargetConfig();
      const formatted = formatTargetConfig(config);
      expect(formatted).toContain('Graphics:');
      expect(formatted).toContain('VIC');
    });

    it('should include sound chip info', () => {
      const config = getDefaultTargetConfig();
      const formatted = formatTargetConfig(config);
      expect(formatted).toContain('Sound:');
      expect(formatted).toContain('SID');
    });
  });

  describe('Error classes', () => {
    it('UnknownTargetError should have correct name', () => {
      const error = new UnknownTargetError('amiga');
      expect(error.name).toBe('UnknownTargetError');
      expect(error.message).toContain('amiga');
      expect(error.message).toContain('Unknown target');
    });

    it('TargetNotImplementedError should have correct name', () => {
      const error = new TargetNotImplementedError(TargetArchitecture.C128);
      expect(error.name).toBe('TargetNotImplementedError');
      expect(error.message).toContain('not yet implemented');
      expect(error.message).toContain('c128');
    });
  });
});
