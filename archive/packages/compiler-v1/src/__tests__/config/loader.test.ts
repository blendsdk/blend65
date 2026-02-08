/**
 * Tests for configuration loading
 *
 * Tests file discovery, JSON parsing, and validation integration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  ConfigLoader,
  ConfigLoadException,
  ConfigValidationException,
  CONFIG_FILE_NAME,
} from '../../config/index.js';

describe('ConfigLoader', () => {
  const loader = new ConfigLoader();
  let testDir: string;

  // Create a temporary test directory before each test
  beforeEach(() => {
    testDir = resolve(tmpdir(), `blend65-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  // Clean up test directory after each test
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a config file in the test directory
   */
  function createConfigFile(content: object, filename: string = CONFIG_FILE_NAME): string {
    const path = join(testDir, filename);
    writeFileSync(path, JSON.stringify(content, null, 2));
    return path;
  }

  describe('CONFIG_FILE_NAME', () => {
    it('should be blend65.json', () => {
      expect(CONFIG_FILE_NAME).toBe('blend65.json');
    });
  });

  describe('load()', () => {
    it('should load valid configuration file', () => {
      const configPath = createConfigFile({
        compilerOptions: {
          target: 'c64',
          optimization: 'O2',
        },
      });

      const config = loader.load(configPath);

      expect(config.compilerOptions.target).toBe('c64');
      expect(config.compilerOptions.optimization).toBe('O2');
    });

    it('should throw ConfigLoadException for missing file', () => {
      const missingPath = join(testDir, 'missing.json');

      expect(() => loader.load(missingPath)).toThrow(ConfigLoadException);
      expect(() => loader.load(missingPath)).toThrow(/not found/i);
    });

    it('should throw ConfigLoadException for invalid JSON', () => {
      const path = join(testDir, 'invalid.json');
      writeFileSync(path, '{ invalid json }');

      expect(() => loader.load(path)).toThrow(ConfigLoadException);
      expect(() => loader.load(path)).toThrow(/Invalid JSON/i);
    });

    it('should throw ConfigValidationException for invalid config', () => {
      const configPath = createConfigFile({
        compilerOptions: {
          target: 'invalid-target',
        },
      });

      expect(() => loader.load(configPath)).toThrow(ConfigValidationException);
    });

    it('should load minimal config', () => {
      const configPath = createConfigFile({
        compilerOptions: {},
      });

      const config = loader.load(configPath);

      expect(config.compilerOptions).toBeDefined();
    });

    it('should load full config with all fields', () => {
      const configPath = createConfigFile({
        $schema: 'https://blend65.dev/schema/blend65.json',
        compilerOptions: {
          target: 'c64',
          optimization: 'O2',
          debug: 'both',
          outDir: './dist',
          outFile: 'game.prg',
          outputFormat: 'both',
          verbose: true,
          strict: true,
          loadAddress: 0x1000,
        },
        include: ['src/**/*.blend'],
        exclude: ['test/**/*.blend'],
        files: ['main.blend'],
        rootDir: './src',
        emulator: {
          path: '/usr/bin/x64sc',
          type: 'vice',
          args: ['-autostartprgmode', '1'],
          autoRun: true,
          waitForExit: false,
        },
        resources: {
          sprites: ['assets/*.spr'],
        },
      });

      const config = loader.load(configPath);

      expect(config.$schema).toBe('https://blend65.dev/schema/blend65.json');
      expect(config.compilerOptions.target).toBe('c64');
      expect(config.compilerOptions.loadAddress).toBe(0x1000);
      expect(config.include).toEqual(['src/**/*.blend']);
      expect(config.emulator?.path).toBe('/usr/bin/x64sc');
      expect(config.resources?.sprites).toEqual(['assets/*.spr']);
    });
  });

  describe('loadWithErrors()', () => {
    it('should return config and empty errors for valid config', () => {
      const configPath = createConfigFile({
        compilerOptions: {},
      });

      const result = loader.loadWithErrors(configPath);

      expect(result.config).toBeDefined();
      expect(result.errors).toEqual([]);
    });

    it('should return config and errors for invalid config', () => {
      const configPath = createConfigFile({
        compilerOptions: {
          target: 'invalid',
        },
      });

      const result = loader.loadWithErrors(configPath);

      expect(result.config).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].path).toBe('compilerOptions.target');
    });

    it('should throw for missing file', () => {
      const missingPath = join(testDir, 'missing.json');

      expect(() => loader.loadWithErrors(missingPath)).toThrow(ConfigLoadException);
    });

    it('should throw for invalid JSON', () => {
      const path = join(testDir, 'invalid.json');
      writeFileSync(path, '{ broken }');

      expect(() => loader.loadWithErrors(path)).toThrow(ConfigLoadException);
    });
  });

  describe('findConfigFile()', () => {
    it('should find config in explicit path', () => {
      const configPath = createConfigFile({ compilerOptions: {} });

      const found = loader.findConfigFile(configPath);

      expect(found).toBe(configPath);
    });

    it('should throw for missing explicit path', () => {
      const missingPath = join(testDir, 'missing.json');

      expect(() => loader.findConfigFile(missingPath)).toThrow(ConfigLoadException);
    });

    it('should find config in current directory', () => {
      createConfigFile({ compilerOptions: {} });

      const found = loader.findConfigFile(undefined, testDir);

      expect(found).toBe(join(testDir, CONFIG_FILE_NAME));
    });

    it('should return null when no config found', () => {
      const found = loader.findConfigFile(undefined, testDir);

      expect(found).toBeNull();
    });

    it('should resolve relative explicit paths', () => {
      createConfigFile({ compilerOptions: {} }, 'custom.json');

      const found = loader.findConfigFile('custom.json', testDir);

      expect(found).toBe(resolve(testDir, 'custom.json'));
    });
  });

  describe('loadWithOptions()', () => {
    it('should load config with explicit path', () => {
      const configPath = createConfigFile({ compilerOptions: {} });

      const result = loader.loadWithOptions({ configPath });

      expect(result.config).not.toBeNull();
      expect(result.configPath).toBe(configPath);
    });

    it('should load config from cwd', () => {
      createConfigFile({ compilerOptions: {} });

      const result = loader.loadWithOptions({ cwd: testDir });

      expect(result.config).not.toBeNull();
      expect(result.configPath).toBe(join(testDir, CONFIG_FILE_NAME));
    });

    it('should return null when no config found', () => {
      const result = loader.loadWithOptions({ cwd: testDir });

      expect(result.config).toBeNull();
      expect(result.configPath).toBeNull();
    });
  });

  describe('getConfigDir()', () => {
    it('should return directory containing config file', () => {
      const configPath = join(testDir, 'subdir', 'blend65.json');
      mkdirSync(join(testDir, 'subdir'), { recursive: true });
      writeFileSync(configPath, JSON.stringify({ compilerOptions: {} }));

      const dir = loader.getConfigDir(configPath);

      expect(dir).toBe(resolve(testDir, 'subdir'));
    });

    it('should handle relative paths', () => {
      const dir = loader.getConfigDir('project/blend65.json');

      expect(dir).toContain('project');
    });
  });

  describe('ConfigLoadException', () => {
    it('should include config path', () => {
      const missingPath = join(testDir, 'missing.json');

      try {
        loader.load(missingPath);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigLoadException);
        const exception = e as ConfigLoadException;
        expect(exception.configPath).toBe(missingPath);
      }
    });

    it('should include cause for JSON errors', () => {
      const path = join(testDir, 'invalid.json');
      writeFileSync(path, '{ broken json');

      try {
        loader.load(path);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigLoadException);
        const exception = e as ConfigLoadException;
        expect(exception.cause).toBeInstanceOf(SyntaxError);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty JSON object', () => {
      const configPath = createConfigFile({});

      // Should throw validation error (missing compilerOptions)
      expect(() => loader.load(configPath)).toThrow(ConfigValidationException);
    });

    it('should handle JSON with extra fields', () => {
      const configPath = createConfigFile({
        compilerOptions: {},
        unknownField: 'ignored',
        anotherUnknown: { nested: true },
      });

      // Should not throw - extra fields are allowed
      const config = loader.load(configPath);
      expect(config.compilerOptions).toBeDefined();
    });

    it('should handle deeply nested paths', () => {
      const deepDir = join(testDir, 'a', 'b', 'c', 'd');
      mkdirSync(deepDir, { recursive: true });
      const configPath = join(deepDir, CONFIG_FILE_NAME);
      writeFileSync(configPath, JSON.stringify({ compilerOptions: {} }));

      const config = loader.load(configPath);
      expect(config).toBeDefined();
    });

    it('should handle Unicode in config values', () => {
      const configPath = createConfigFile({
        compilerOptions: {
          outDir: './output/游戏',
        },
      });

      const config = loader.load(configPath);
      expect(config.compilerOptions.outDir).toBe('./output/游戏');
    });
  });
});