/**
 * Tests for configuration merging
 *
 * Verifies that configuration sources are merged with correct precedence:
 * CLI > file config > defaults
 */

import { describe, it, expect } from 'vitest';

import {
  mergeConfig,
  mergeCompilerOptions,
  createMergedConfig,
  resolveCompilerOptions,
  getDefaultCompilerOptions,
} from '../../config/index.js';

describe('Configuration Merger', () => {
  describe('mergeConfig', () => {
    it('should return defaults when no file config or CLI overrides', () => {
      const merged = mergeConfig({ fileConfig: null });

      expect(merged.compilerOptions.target).toBe('c64');
      expect(merged.compilerOptions.optimization).toBe('O0');
      expect(merged.include).toEqual(['**/*.blend']);
    });

    it('should apply file config over defaults', () => {
      const merged = mergeConfig({
        fileConfig: {
          compilerOptions: {
            target: 'c64',
            optimization: 'O2',
          },
          include: ['src/**/*.blend'],
        },
      });

      expect(merged.compilerOptions.optimization).toBe('O2');
      expect(merged.include).toEqual(['src/**/*.blend']);
      // Default values should still be present
      expect(merged.compilerOptions.debug).toBe('none');
    });

    it('should apply CLI overrides over file config', () => {
      const merged = mergeConfig({
        fileConfig: {
          compilerOptions: {
            optimization: 'O2',
            verbose: false,
          },
        },
        cliOverrides: {
          optimization: 'O3',
          verbose: true,
        },
      });

      expect(merged.compilerOptions.optimization).toBe('O3');
      expect(merged.compilerOptions.verbose).toBe(true);
    });

    it('should apply CLI files and clear include/exclude', () => {
      const merged = mergeConfig({
        fileConfig: {
          compilerOptions: {},
          include: ['src/**/*.blend'],
          exclude: ['src/**/*.test.blend'],
        },
        cliFiles: ['main.blend', 'game.blend'],
      });

      expect(merged.files).toEqual(['main.blend', 'game.blend']);
      expect(merged.include).toBeUndefined();
      expect(merged.exclude).toBeUndefined();
    });

    it('should preserve $schema from file config', () => {
      const merged = mergeConfig({
        fileConfig: {
          $schema: 'https://blend65.dev/schema/blend65.json',
          compilerOptions: {},
        },
      });

      expect(merged.$schema).toBe('https://blend65.dev/schema/blend65.json');
    });

    it('should preserve files from file config when no CLI files', () => {
      const merged = mergeConfig({
        fileConfig: {
          compilerOptions: {},
          files: ['explicit.blend'],
        },
      });

      expect(merged.files).toEqual(['explicit.blend']);
    });

    it('should preserve resources from file config', () => {
      const merged = mergeConfig({
        fileConfig: {
          compilerOptions: {},
          resources: {
            sprites: ['assets/*.spr'],
          },
        },
      });

      expect(merged.resources).toEqual({ sprites: ['assets/*.spr'] });
    });

    it('should merge emulator config with defaults', () => {
      const merged = mergeConfig({
        fileConfig: {
          compilerOptions: {},
          emulator: {
            path: '/usr/bin/x64sc',
            autoRun: false,
          },
        },
      });

      expect(merged.emulator?.path).toBe('/usr/bin/x64sc');
      expect(merged.emulator?.autoRun).toBe(false);
      // Default values should be present
      expect(merged.emulator?.type).toBe('vice');
      expect(merged.emulator?.waitForExit).toBe(false);
    });
  });

  describe('mergeCompilerOptions', () => {
    it('should merge three levels of options', () => {
      const defaults = getDefaultCompilerOptions();

      const merged = mergeCompilerOptions(
        defaults,
        { optimization: 'O2', verbose: true },
        { optimization: 'O3' }
      );

      // CLI wins
      expect(merged.optimization).toBe('O3');
      // File config wins over defaults
      expect(merged.verbose).toBe(true);
      // Defaults remain
      expect(merged.target).toBe('c64');
      expect(merged.debug).toBe('none');
    });

    it('should not override with undefined values', () => {
      const defaults = getDefaultCompilerOptions();

      const merged = mergeCompilerOptions(defaults, { optimization: undefined }, { verbose: undefined });

      // Defaults should remain when undefined is passed
      expect(merged.optimization).toBe('O0');
      expect(merged.verbose).toBe(false);
    });

    it('should handle empty objects', () => {
      const defaults = getDefaultCompilerOptions();

      const merged = mergeCompilerOptions(defaults, {}, {});

      expect(merged).toEqual(defaults);
    });
  });

  describe('createMergedConfig', () => {
    it('should be a convenience wrapper for mergeConfig', () => {
      const merged = createMergedConfig(
        { compilerOptions: { optimization: 'O2' } },
        { verbose: true },
        ['main.blend']
      );

      expect(merged.compilerOptions.optimization).toBe('O2');
      expect(merged.compilerOptions.verbose).toBe(true);
      expect(merged.files).toEqual(['main.blend']);
    });

    it('should work with null file config', () => {
      const merged = createMergedConfig(null, { verbose: true });

      expect(merged.compilerOptions.verbose).toBe(true);
      expect(merged.compilerOptions.target).toBe('c64');
    });
  });

  describe('resolveCompilerOptions', () => {
    it('should return defaults for null config', () => {
      const options = resolveCompilerOptions(null);

      expect(options.target).toBe('c64');
      expect(options.optimization).toBe('O0');
    });

    it('should return defaults for empty config', () => {
      const options = resolveCompilerOptions({});

      expect(options.target).toBe('c64');
    });

    it('should merge partial options with defaults', () => {
      const options = resolveCompilerOptions({
        compilerOptions: {
          optimization: 'O2',
        },
      });

      expect(options.optimization).toBe('O2');
      expect(options.target).toBe('c64');
      expect(options.debug).toBe('none');
    });

    it('should return complete required options', () => {
      const options = resolveCompilerOptions({
        compilerOptions: {},
      });

      // All required fields should be present
      expect(options.target).toBeDefined();
      expect(options.optimization).toBeDefined();
      expect(options.debug).toBeDefined();
      expect(options.outDir).toBeDefined();
      expect(options.outFile).toBeDefined();
      expect(options.outputFormat).toBeDefined();
      expect(options.verbose).toBeDefined();
      expect(options.strict).toBeDefined();
      expect(options.loadAddress).toBeDefined();
    });
  });

  describe('Precedence Rules', () => {
    it('should follow CLI > file > defaults precedence', () => {
      const merged = mergeConfig({
        fileConfig: {
          compilerOptions: {
            target: 'c64', // Matches default
            optimization: 'O2', // Overrides default
            debug: 'inline', // Overrides default
          },
        },
        cliOverrides: {
          debug: 'both', // Overrides file config
        },
      });

      expect(merged.compilerOptions.target).toBe('c64'); // Default/file
      expect(merged.compilerOptions.optimization).toBe('O2'); // File
      expect(merged.compilerOptions.debug).toBe('both'); // CLI wins
      expect(merged.compilerOptions.verbose).toBe(false); // Default
    });

    it('should not let lower precedence override higher', () => {
      const defaults = getDefaultCompilerOptions();

      // Start with CLI setting optimization
      const merged = mergeCompilerOptions(
        defaults,
        { optimization: 'O2', verbose: true }, // File config
        { optimization: 'O0' } // CLI explicitly sets back to O0
      );

      // CLI's O0 should override file's O2
      expect(merged.optimization).toBe('O0');
      // File's verbose should remain (not overridden by CLI)
      expect(merged.verbose).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle completely empty input', () => {
      const merged = mergeConfig({
        fileConfig: null,
        cliOverrides: undefined,
        cliFiles: undefined,
      });

      // Should return valid defaults
      expect(merged.compilerOptions).toBeDefined();
      expect(merged.compilerOptions.target).toBe('c64');
    });

    it('should handle false boolean values correctly', () => {
      const merged = mergeConfig({
        fileConfig: {
          compilerOptions: {
            verbose: true,
            strict: true,
          },
        },
        cliOverrides: {
          verbose: false,
        },
      });

      // CLI false should override file true
      expect(merged.compilerOptions.verbose).toBe(false);
      // File config should remain
      expect(merged.compilerOptions.strict).toBe(true);
    });

    it('should handle zero load address', () => {
      const merged = mergeConfig({
        fileConfig: {
          compilerOptions: {
            loadAddress: 0,
          },
        },
      });

      // Zero is a valid address
      expect(merged.compilerOptions.loadAddress).toBe(0);
    });

    it('should handle empty string outFile', () => {
      const merged = mergeConfig({
        fileConfig: {
          compilerOptions: {
            outFile: '',
          },
        },
      });

      // Empty string is valid (means derive from entry)
      expect(merged.compilerOptions.outFile).toBe('');
    });

    it('should handle empty arrays', () => {
      const merged = mergeConfig({
        fileConfig: {
          compilerOptions: {},
          include: [],
          exclude: [],
        },
        cliFiles: [],
      });

      // Empty arrays should be preserved (no CLI files to override)
      expect(merged.include).toEqual([]);
      expect(merged.exclude).toEqual([]);
    });
  });
});