/**
 * Tests for configuration default values
 *
 * Verifies that default values are correct and consistent.
 */

import { describe, it, expect } from 'vitest';

import {
  DEFAULT_TARGET,
  DEFAULT_OPTIMIZATION,
  DEFAULT_DEBUG_MODE,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_OUT_DIR,
  DEFAULT_LOAD_ADDRESS,
  DEFAULT_INCLUDE_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_EMULATOR_TYPE,
  getDefaultConfig,
  getDefaultCompilerOptions,
  getDefaultEmulatorConfig,
  getValidTargets,
  getValidOptimizationLevels,
  getValidDebugModes,
  getValidOutputFormats,
  getValidEmulatorTypes,
  isTargetImplemented,
  isOutputFormatImplemented,
} from '../../config/index.js';

describe('Configuration Defaults', () => {
  describe('Default Constants', () => {
    it('should have correct default target', () => {
      expect(DEFAULT_TARGET).toBe('c64');
    });

    it('should have correct default optimization level', () => {
      expect(DEFAULT_OPTIMIZATION).toBe('O0');
    });

    it('should have correct default debug mode', () => {
      expect(DEFAULT_DEBUG_MODE).toBe('none');
    });

    it('should have correct default output format', () => {
      expect(DEFAULT_OUTPUT_FORMAT).toBe('prg');
    });

    it('should have correct default output directory', () => {
      expect(DEFAULT_OUT_DIR).toBe('./build');
    });

    it('should have correct default load address (C64 BASIC start)', () => {
      // $0801 = 2049
      expect(DEFAULT_LOAD_ADDRESS).toBe(0x0801);
      expect(DEFAULT_LOAD_ADDRESS).toBe(2049);
    });

    it('should have correct default include patterns', () => {
      expect(DEFAULT_INCLUDE_PATTERNS).toEqual(['**/*.blend']);
    });

    it('should have correct default exclude patterns', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS).toEqual(['node_modules/**', 'build/**', 'dist/**']);
    });

    it('should have correct default emulator type', () => {
      expect(DEFAULT_EMULATOR_TYPE).toBe('vice');
    });
  });

  describe('getDefaultCompilerOptions', () => {
    it('should return all required fields', () => {
      const options = getDefaultCompilerOptions();

      expect(options.target).toBe('c64');
      expect(options.optimization).toBe('O0');
      expect(options.debug).toBe('none');
      expect(options.outDir).toBe('./build');
      expect(options.outFile).toBe('');
      expect(options.outputFormat).toBe('prg');
      expect(options.verbose).toBe(false);
      expect(options.strict).toBe(false);
      expect(options.loadAddress).toBe(0x0801);
    });

    it('should return a new object each time', () => {
      const options1 = getDefaultCompilerOptions();
      const options2 = getDefaultCompilerOptions();

      expect(options1).not.toBe(options2);
      expect(options1).toEqual(options2);
    });
  });

  describe('getDefaultEmulatorConfig', () => {
    it('should return all required fields', () => {
      const config = getDefaultEmulatorConfig();

      expect(config.path).toBe('');
      expect(config.type).toBe('vice');
      expect(config.args).toEqual([]);
      expect(config.autoRun).toBe(true);
      expect(config.waitForExit).toBe(false);
    });

    it('should return a new object each time', () => {
      const config1 = getDefaultEmulatorConfig();
      const config2 = getDefaultEmulatorConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return complete configuration', () => {
      const config = getDefaultConfig();

      // Check compilerOptions
      expect(config.compilerOptions).toBeDefined();
      expect(config.compilerOptions.target).toBe('c64');

      // Check include/exclude
      expect(config.include).toEqual(['**/*.blend']);
      expect(config.exclude).toEqual(['node_modules/**', 'build/**', 'dist/**']);

      // Check rootDir
      expect(config.rootDir).toBe('.');

      // Check emulator
      expect(config.emulator).toBeDefined();
      expect(config.emulator?.type).toBe('vice');
    });

    it('should return a new object each time', () => {
      const config1 = getDefaultConfig();
      const config2 = getDefaultConfig();

      expect(config1).not.toBe(config2);
      expect(config1.compilerOptions).not.toBe(config2.compilerOptions);
    });
  });

  describe('Valid Value Lists', () => {
    it('should return valid targets', () => {
      const targets = getValidTargets();

      expect(targets).toContain('c64');
      expect(targets).toContain('c128');
      expect(targets).toContain('x16');
      expect(targets).toHaveLength(3);
    });

    it('should return valid optimization levels', () => {
      const levels = getValidOptimizationLevels();

      expect(levels).toContain('O0');
      expect(levels).toContain('O1');
      expect(levels).toContain('O2');
      expect(levels).toContain('O3');
      expect(levels).toContain('Os');
      expect(levels).toContain('Oz');
      expect(levels).toHaveLength(6);
    });

    it('should return valid debug modes', () => {
      const modes = getValidDebugModes();

      expect(modes).toContain('none');
      expect(modes).toContain('inline');
      expect(modes).toContain('vice');
      expect(modes).toContain('both');
      expect(modes).toHaveLength(4);
    });

    it('should return valid output formats', () => {
      const formats = getValidOutputFormats();

      expect(formats).toContain('asm');
      expect(formats).toContain('prg');
      expect(formats).toContain('crt');
      expect(formats).toContain('both');
      expect(formats).toHaveLength(4);
    });

    it('should return valid emulator types', () => {
      const types = getValidEmulatorTypes();

      expect(types).toContain('vice');
      expect(types).toContain('x16emu');
      expect(types).toHaveLength(2);
    });
  });

  describe('Implementation Checks', () => {
    describe('isTargetImplemented', () => {
      it('should return true for c64', () => {
        expect(isTargetImplemented('c64')).toBe(true);
      });

      it('should return false for c128', () => {
        expect(isTargetImplemented('c128')).toBe(false);
      });

      it('should return false for x16', () => {
        expect(isTargetImplemented('x16')).toBe(false);
      });
    });

    describe('isOutputFormatImplemented', () => {
      it('should return true for asm', () => {
        expect(isOutputFormatImplemented('asm')).toBe(true);
      });

      it('should return true for prg', () => {
        expect(isOutputFormatImplemented('prg')).toBe(true);
      });

      it('should return true for both', () => {
        expect(isOutputFormatImplemented('both')).toBe(true);
      });

      it('should return false for crt (not implemented)', () => {
        expect(isOutputFormatImplemented('crt')).toBe(false);
      });
    });
  });
});