/**
 * Tests for configuration validation
 *
 * Verifies that the ConfigValidator correctly validates
 * and rejects invalid configurations.
 */

import { describe, it, expect } from 'vitest';

import { ConfigValidator, ConfigValidationException } from '../../config/index.js';

describe('ConfigValidator', () => {
  const validator = new ConfigValidator();

  describe('validate() - throwing validation', () => {
    it('should accept valid minimal config', () => {
      const config = {
        compilerOptions: {},
      };

      expect(() => validator.validate(config)).not.toThrow();
    });

    it('should accept valid full config', () => {
      const config = {
        $schema: 'https://blend65.dev/schema/blend65.json',
        compilerOptions: {
          target: 'c64',
          optimization: 'O0',
          debug: 'both',
          outDir: './build',
          outFile: 'game.prg',
          outputFormat: 'prg',
          verbose: true,
          strict: false,
          loadAddress: 0x0801,
        },
        include: ['src/**/*.blend'],
        exclude: ['src/**/*.test.blend'],
        files: ['main.blend'],
        rootDir: './src',
        emulator: {
          path: '/usr/local/bin/x64sc',
          type: 'vice',
          args: ['-autostartprgmode', '1'],
          autoRun: true,
          waitForExit: false,
        },
      };

      expect(() => validator.validate(config)).not.toThrow();
    });

    it('should throw ConfigValidationException for invalid config', () => {
      const config = {
        compilerOptions: {
          target: 'invalid',
        },
      };

      expect(() => validator.validate(config)).toThrow(ConfigValidationException);
    });

    it('should reject non-object config', () => {
      expect(() => validator.validate(null)).toThrow(ConfigValidationException);
      expect(() => validator.validate(undefined)).toThrow(ConfigValidationException);
      expect(() => validator.validate('string')).toThrow(ConfigValidationException);
      expect(() => validator.validate(123)).toThrow(ConfigValidationException);
      expect(() => validator.validate([])).toThrow(ConfigValidationException);
    });
  });

  describe('getErrors() - non-throwing validation', () => {
    it('should return empty array for valid config', () => {
      const config = {
        compilerOptions: {},
      };

      const errors = validator.getErrors(config);
      expect(errors).toEqual([]);
    });

    it('should return errors for invalid config', () => {
      const config = {
        compilerOptions: {
          target: 'invalid',
        },
      };

      const errors = validator.getErrors(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].path).toBe('compilerOptions.target');
    });
  });

  describe('Required fields', () => {
    it('should require compilerOptions', () => {
      const config = {};

      const errors = validator.getErrors(config);
      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions',
          message: 'compilerOptions is required',
        })
      );
    });

    it('should accept compilerOptions with no properties', () => {
      const config = {
        compilerOptions: {},
      };

      const errors = validator.getErrors(config);
      expect(errors).toEqual([]);
    });
  });

  describe('Target validation', () => {
    it('should accept valid targets', () => {
      expect(validator.getErrors({ compilerOptions: { target: 'c64' } })).toEqual([]);
    });

    it('should reject invalid targets', () => {
      const errors = validator.getErrors({ compilerOptions: { target: 'invalid' } });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.target',
          message: expect.stringContaining('Invalid target'),
        })
      );
    });

    it('should warn about unimplemented targets', () => {
      const errorsC128 = validator.getErrors({ compilerOptions: { target: 'c128' } });
      expect(errorsC128).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.target',
          message: expect.stringContaining('not implemented yet'),
        })
      );

      const errorsX16 = validator.getErrors({ compilerOptions: { target: 'x16' } });
      expect(errorsX16).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.target',
          message: expect.stringContaining('not implemented yet'),
        })
      );
    });

    it('should reject non-string targets', () => {
      const errors = validator.getErrors({ compilerOptions: { target: 123 } });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.target',
          message: expect.stringContaining('must be a string'),
        })
      );
    });
  });

  describe('Optimization level validation', () => {
    const validLevels = ['O0', 'O1', 'O2', 'O3', 'Os', 'Oz'];

    it.each(validLevels)('should accept optimization level %s', (level) => {
      const errors = validator.getErrors({ compilerOptions: { optimization: level } });
      expect(errors).toEqual([]);
    });

    it('should reject invalid optimization levels', () => {
      const errors = validator.getErrors({ compilerOptions: { optimization: 'O4' } });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.optimization',
          message: expect.stringContaining('Invalid optimization level'),
        })
      );
    });
  });

  describe('Debug mode validation', () => {
    const validModes = ['none', 'inline', 'vice', 'both'];

    it.each(validModes)('should accept debug mode %s', (mode) => {
      const errors = validator.getErrors({ compilerOptions: { debug: mode } });
      expect(errors).toEqual([]);
    });

    it('should reject invalid debug modes', () => {
      const errors = validator.getErrors({ compilerOptions: { debug: 'all' } });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.debug',
          message: expect.stringContaining('Invalid debug mode'),
        })
      );
    });
  });

  describe('Output format validation', () => {
    it('should accept valid output formats', () => {
      expect(validator.getErrors({ compilerOptions: { outputFormat: 'asm' } })).toEqual([]);
      expect(validator.getErrors({ compilerOptions: { outputFormat: 'prg' } })).toEqual([]);
      expect(validator.getErrors({ compilerOptions: { outputFormat: 'both' } })).toEqual([]);
    });

    it('should warn about unimplemented output formats', () => {
      const errors = validator.getErrors({ compilerOptions: { outputFormat: 'crt' } });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.outputFormat',
          message: expect.stringContaining('not implemented yet'),
        })
      );
    });

    it('should reject invalid output formats', () => {
      const errors = validator.getErrors({ compilerOptions: { outputFormat: 'exe' } });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.outputFormat',
          message: expect.stringContaining('Invalid output format'),
        })
      );
    });
  });

  describe('Load address validation', () => {
    it('should accept valid load addresses', () => {
      expect(validator.getErrors({ compilerOptions: { loadAddress: 0x0801 } })).toEqual([]);
      expect(validator.getErrors({ compilerOptions: { loadAddress: 0 } })).toEqual([]);
      expect(validator.getErrors({ compilerOptions: { loadAddress: 0xffff } })).toEqual([]);
    });

    it('should reject non-integer load addresses', () => {
      const errors = validator.getErrors({ compilerOptions: { loadAddress: 2049.5 } });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.loadAddress',
          message: expect.stringContaining('must be an integer'),
        })
      );
    });

    it('should reject out-of-range load addresses', () => {
      const errorsNegative = validator.getErrors({ compilerOptions: { loadAddress: -1 } });
      expect(errorsNegative).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.loadAddress',
          message: expect.stringContaining('between 0 and 65535'),
        })
      );

      const errorsTooLarge = validator.getErrors({ compilerOptions: { loadAddress: 0x10000 } });
      expect(errorsTooLarge).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.loadAddress',
          message: expect.stringContaining('between 0 and 65535'),
        })
      );
    });

    it('should reject non-number load addresses', () => {
      const errors = validator.getErrors({ compilerOptions: { loadAddress: '2049' } });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.loadAddress',
          message: expect.stringContaining('must be a number'),
        })
      );
    });
  });

  describe('Boolean field validation', () => {
    it('should accept boolean verbose', () => {
      expect(validator.getErrors({ compilerOptions: { verbose: true } })).toEqual([]);
      expect(validator.getErrors({ compilerOptions: { verbose: false } })).toEqual([]);
    });

    it('should reject non-boolean verbose', () => {
      const errors = validator.getErrors({ compilerOptions: { verbose: 'yes' } });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.verbose',
          message: expect.stringContaining('must be a boolean'),
        })
      );
    });

    it('should accept boolean strict', () => {
      expect(validator.getErrors({ compilerOptions: { strict: true } })).toEqual([]);
      expect(validator.getErrors({ compilerOptions: { strict: false } })).toEqual([]);
    });
  });

  describe('String field validation', () => {
    it('should accept string outDir', () => {
      expect(validator.getErrors({ compilerOptions: { outDir: './build' } })).toEqual([]);
    });

    it('should reject non-string outDir', () => {
      const errors = validator.getErrors({ compilerOptions: { outDir: 123 } });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'compilerOptions.outDir',
          message: expect.stringContaining('must be a string'),
        })
      );
    });
  });

  describe('Array field validation', () => {
    it('should accept string arrays for include', () => {
      expect(validator.getErrors({ compilerOptions: {}, include: ['*.blend'] })).toEqual([]);
    });

    it('should reject non-array include', () => {
      const errors = validator.getErrors({ compilerOptions: {}, include: '*.blend' });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'include',
          message: expect.stringContaining('must be an array'),
        })
      );
    });

    it('should reject arrays with non-string elements', () => {
      const errors = validator.getErrors({ compilerOptions: {}, include: ['valid', 123, 'also-valid'] });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'include[1]',
          message: expect.stringContaining('must be a string'),
        })
      );
    });
  });

  describe('Emulator config validation', () => {
    it('should accept valid emulator config', () => {
      const config = {
        compilerOptions: {},
        emulator: {
          path: '/usr/local/bin/x64sc',
          type: 'vice',
          args: ['-autostartprgmode', '1'],
          autoRun: true,
          waitForExit: false,
        },
      };

      expect(validator.getErrors(config)).toEqual([]);
    });

    it('should reject non-object emulator config', () => {
      const errors = validator.getErrors({ compilerOptions: {}, emulator: 'x64sc' });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'emulator',
          message: expect.stringContaining('must be an object'),
        })
      );
    });

    it('should reject invalid emulator type', () => {
      const errors = validator.getErrors({
        compilerOptions: {},
        emulator: { type: 'mame' },
      });

      expect(errors).toContainEqual(
        expect.objectContaining({
          path: 'emulator.type',
          message: expect.stringContaining('Invalid emulator type'),
        })
      );
    });
  });

  describe('Multiple errors', () => {
    it('should return all validation errors', () => {
      const config = {
        compilerOptions: {
          target: 'invalid',
          optimization: 'O99',
          debug: 'full',
          loadAddress: 'not-a-number',
        },
        include: 'not-an-array',
      };

      const errors = validator.getErrors(config);

      // Should have multiple errors
      expect(errors.length).toBeGreaterThan(1);

      // Should have errors for different paths
      const paths = errors.map((e) => e.path);
      expect(paths).toContain('compilerOptions.target');
      expect(paths).toContain('compilerOptions.optimization');
    });
  });

  describe('ConfigValidationException', () => {
    it('should contain all errors', () => {
      const config = {
        compilerOptions: {
          target: 'invalid',
          optimization: 'O99',
        },
      };

      try {
        validator.validate(config);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigValidationException);
        const exception = e as ConfigValidationException;
        expect(exception.errors.length).toBeGreaterThan(1);
      }
    });

    it('should have formatted message', () => {
      const config = {
        compilerOptions: {
          target: 'invalid',
        },
      };

      try {
        validator.validate(config);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigValidationException);
        const exception = e as ConfigValidationException;
        expect(exception.message).toContain('Configuration validation failed');
        expect(exception.message).toContain('compilerOptions.target');
      }
    });
  });
});