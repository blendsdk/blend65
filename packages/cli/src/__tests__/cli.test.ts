/**
 * CLI Tests
 *
 * Basic tests for the Blend65 CLI.
 *
 * @module __tests__/cli.test
 */

import { describe, it, expect } from 'vitest';
import { Blend65CLI } from '../cli.js';
import { ExitCode } from '../utils/exit-codes.js';

describe('Blend65CLI', () => {
  describe('constructor', () => {
    it('should create a CLI instance', () => {
      const cli = new Blend65CLI();
      expect(cli).toBeInstanceOf(Blend65CLI);
    });
  });

  describe('run', () => {
    it('should show help with --help flag', async () => {
      const cli = new Blend65CLI();
      // Note: yargs exits on --help, so we catch the output
      // This test verifies the CLI doesn't crash
      process.exitCode = undefined;
      await cli.run(['--help']);
      // Help exits with code 0
      expect(process.exitCode).toBeUndefined();
    });

    it('should show version with --version flag', async () => {
      const cli = new Blend65CLI();
      process.exitCode = undefined;
      await cli.run(['--version']);
      expect(process.exitCode).toBeUndefined();
    });

    it('should return error when no command specified', async () => {
      const cli = new Blend65CLI();
      process.exitCode = undefined;
      await cli.run([]);
      expect(process.exitCode).toBe(ExitCode.CONFIG_ERROR);
    });
  });
});

describe('ExitCode', () => {
  it('should have SUCCESS as 0', () => {
    expect(ExitCode.SUCCESS).toBe(0);
  });

  it('should have COMPILATION_ERROR as 1', () => {
    expect(ExitCode.COMPILATION_ERROR).toBe(1);
  });

  it('should have CONFIG_ERROR as 2', () => {
    expect(ExitCode.CONFIG_ERROR).toBe(2);
  });

  it('should have FILE_NOT_FOUND as 3', () => {
    expect(ExitCode.FILE_NOT_FOUND).toBe(3);
  });

  it('should have EMULATOR_ERROR as 4', () => {
    expect(ExitCode.EMULATOR_ERROR).toBe(4);
  });

  it('should have INTERNAL_ERROR as 5', () => {
    expect(ExitCode.INTERNAL_ERROR).toBe(5);
  });
});