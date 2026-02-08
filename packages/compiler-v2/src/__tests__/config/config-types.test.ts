/**
 * Config Types Unit Tests
 *
 * Tests for the configuration type definitions and interfaces.
 * Validates that config objects conform to their type contracts.
 *
 * @module __tests__/config/config-types
 */

import { describe, it, expect } from 'vitest';
import type {
  TargetPlatform,
  OptimizationLevelId,
  DebugMode,
  OutputFormat,
  EmulatorType,
  CompilerOptions,
  EmulatorConfig,
  Blend65Config,
  ConfigValidationError,
  ConfigLoadOptions,
} from '../../config/types.js';

describe('Config Types', () => {
  describe('TargetPlatform', () => {
    it('should accept valid target platforms', () => {
      const platforms: TargetPlatform[] = ['c64', 'c128', 'x16'];
      expect(platforms).toHaveLength(3);
      expect(platforms).toContain('c64');
      expect(platforms).toContain('c128');
      expect(platforms).toContain('x16');
    });
  });

  describe('OptimizationLevelId', () => {
    it('should accept all optimization levels', () => {
      const levels: OptimizationLevelId[] = ['O0', 'O1', 'O2', 'O3', 'Os', 'Oz'];
      expect(levels).toHaveLength(6);
    });
  });

  describe('DebugMode', () => {
    it('should accept all debug modes', () => {
      const modes: DebugMode[] = ['none', 'inline', 'vice', 'both'];
      expect(modes).toHaveLength(4);
    });
  });

  describe('OutputFormat', () => {
    it('should accept all output formats', () => {
      const formats: OutputFormat[] = ['asm', 'prg', 'crt', 'both'];
      expect(formats).toHaveLength(4);
    });
  });

  describe('EmulatorType', () => {
    it('should accept all emulator types', () => {
      const types: EmulatorType[] = ['vice', 'x16emu'];
      expect(types).toHaveLength(2);
    });
  });

  describe('CompilerOptions', () => {
    it('should allow empty options (all optional)', () => {
      const options: CompilerOptions = {};
      expect(options).toBeDefined();
    });

    it('should accept fully specified options', () => {
      const options: CompilerOptions = {
        target: 'c64',
        optimization: 'O0',
        debug: 'both',
        outDir: './build',
        outFile: 'game.prg',
        outputFormat: 'prg',
        verbose: true,
        strict: false,
        loadAddress: 0x0801,
        libraries: ['sid', 'sprites'],
      };
      expect(options.target).toBe('c64');
      expect(options.optimization).toBe('O0');
      expect(options.loadAddress).toBe(0x0801);
      expect(options.libraries).toEqual(['sid', 'sprites']);
    });

    it('should accept partial options', () => {
      const options: CompilerOptions = {
        target: 'c64',
        verbose: true,
      };
      expect(options.target).toBe('c64');
      expect(options.outDir).toBeUndefined();
    });
  });

  describe('EmulatorConfig', () => {
    it('should allow empty config', () => {
      const config: EmulatorConfig = {};
      expect(config).toBeDefined();
    });

    it('should accept fully specified config', () => {
      const config: EmulatorConfig = {
        path: '/usr/bin/x64sc',
        type: 'vice',
        args: ['-autostartprgmode', '1'],
        autoRun: true,
        waitForExit: false,
      };
      expect(config.path).toBe('/usr/bin/x64sc');
      expect(config.type).toBe('vice');
      expect(config.args).toHaveLength(2);
    });
  });

  describe('Blend65Config', () => {
    it('should require compilerOptions', () => {
      const config: Blend65Config = {
        compilerOptions: {},
      };
      expect(config.compilerOptions).toBeDefined();
    });

    it('should accept fully specified config', () => {
      const config: Blend65Config = {
        $schema: 'https://blend65.dev/schema/blend65.json',
        compilerOptions: {
          target: 'c64',
          optimization: 'O1',
          outDir: './build',
        },
        include: ['src/**/*.blend'],
        exclude: ['node_modules'],
        files: ['src/main.blend'],
        rootDir: './src',
        emulator: {
          path: '/usr/bin/x64sc',
          type: 'vice',
        },
        resources: {
          sprites: ['assets/sprites/**/*.spd'],
          music: ['assets/music/**/*.sid'],
          charsets: ['assets/charsets/**/*.bin'],
        },
      };
      expect(config.compilerOptions.target).toBe('c64');
      expect(config.include).toContain('src/**/*.blend');
      expect(config.emulator?.type).toBe('vice');
    });
  });

  describe('ConfigValidationError', () => {
    it('should describe validation errors', () => {
      const error: ConfigValidationError = {
        path: 'compilerOptions.target',
        message: 'Invalid target platform',
        value: 'amiga',
      };
      expect(error.path).toBe('compilerOptions.target');
      expect(error.message).toContain('Invalid');
      expect(error.value).toBe('amiga');
    });
  });

  describe('ConfigLoadOptions', () => {
    it('should allow empty load options', () => {
      const options: ConfigLoadOptions = {};
      expect(options).toBeDefined();
    });

    it('should accept fully specified load options', () => {
      const options: ConfigLoadOptions = {
        configPath: './blend65.json',
        cwd: '/home/user/project',
        cliOverrides: { target: 'c64', verbose: true },
        cliFiles: ['main.blend'],
        cliLibraries: ['sid'],
      };
      expect(options.configPath).toBe('./blend65.json');
      expect(options.cliOverrides?.target).toBe('c64');
      expect(options.cliLibraries).toContain('sid');
    });
  });
});
