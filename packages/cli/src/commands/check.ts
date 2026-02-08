/**
 * Check Command
 *
 * Checks syntax and types without generating output.
 * Useful for IDE integration and quick validation.
 *
 * **Usage:**
 * ```bash
 * blend65 check [files...] [options]
 * blend65 check src/**\/*.blend
 * blend65 check --strict
 * ```
 *
 * @module commands/check
 */

import * as fs from 'fs';
import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import { glob } from 'glob';

import { Compiler, type Blend65Config } from '@blend65/compiler';
import { formatDiagnostics, formatSuccess, formatError } from '../output/formatter.js';
import { ExitCode } from '../utils/exit-codes.js';
import type { GlobalOptions } from './types.js';

/**
 * Check command options
 */
export interface CheckOptions extends GlobalOptions {
  /** Source files to check (positional) */
  files?: string[];

  /** Treat warnings as errors */
  strict?: boolean;
}

/**
 * Check command definition
 */
export const checkCommand: CommandModule<GlobalOptions, CheckOptions> = {
  command: 'check [files...]',
  describe: 'Check syntax and types without building',

  builder: (yargs) => {
    return yargs
      .positional('files', {
        describe: 'Source files to check (supports globs)',
        type: 'string',
        array: true,
      })
      .option('strict', {
        type: 'boolean',
        description: 'Treat warnings as errors',
        default: false,
      })
      .example('$0 check src/main.blend', 'Check single file')
      .example('$0 check src/**/*.blend', 'Check multiple files')
      .example('$0 check --strict', 'Fail on warnings');
  },

  handler: async (args: ArgumentsCamelCase<CheckOptions>): Promise<void> => {
    const startTime = Date.now();

    try {
      // Resolve source files
      const files = await resolveFiles(args.files);

      if (files.length === 0) {
        console.error(formatError('No source files found'));
        console.log(chalk.gray('Specify files: blend65 check src/main.blend'));
        console.log(chalk.gray('Or use globs:  blend65 check "src/**/*.blend"'));
        process.exitCode = ExitCode.FILE_NOT_FOUND;
        return;
      }

      if (args.verbose) {
        console.log(chalk.gray('Files to check:'));
        files.forEach((f) => console.log(chalk.gray(`  - ${f}`)));
      }

      console.log(chalk.blue('Checking'), files.length, 'file(s)...');

      // Build minimal configuration for checking
      const config: Blend65Config = {
        compilerOptions: {
          target: 'c64',
          optimization: 'O0',
          debug: 'none',
          outDir: './build',
          outputFormat: 'asm',
          verbose: args.verbose || false,
          strict: args.strict || false,
        },
      };

      // Compile (check only - stops after semantic phase)
      const compiler = new Compiler();
      const result = compiler.check(files, config);

      // Report diagnostics
      if (result.diagnostics.length > 0) {
        console.log('');
        console.log(formatDiagnostics(result.diagnostics));
        console.log('');
      }

      // Count errors and warnings
      const errorCount = result.diagnostics.filter((d) => d.severity === 'error').length;
      const warningCount = result.diagnostics.filter((d) => d.severity === 'warning').length;

      // Determine success based on strict mode
      const hasErrors = errorCount > 0;
      const hasWarnings = warningCount > 0;
      const failOnWarnings = args.strict && hasWarnings;

      const elapsed = Date.now() - startTime;

      if (!hasErrors && !failOnWarnings) {
        let message = `No errors found in ${files.length} file(s)`;
        if (hasWarnings) {
          message += ` (${warningCount} warning(s))`;
        }
        message += ` [${elapsed} ms]`;
        console.log(formatSuccess(message));
        process.exitCode = ExitCode.SUCCESS;
      } else {
        let message = `Found ${errorCount} error(s)`;
        if (hasWarnings) {
          message += ` and ${warningCount} warning(s)`;
        }
        if (failOnWarnings && !hasErrors) {
          message += ' (--strict mode: warnings treated as errors)';
        }
        console.log(formatError(message));
        process.exitCode = ExitCode.COMPILATION_ERROR;
      }
    } catch (error) {
      console.error(formatError(`Check failed: ${error}`));
      if (args.verbose && error instanceof Error) {
        console.error(chalk.gray(error.stack));
      }
      process.exitCode = ExitCode.INTERNAL_ERROR;
    }
  },
};

/**
 * Resolve source files from arguments
 *
 * Expands glob patterns and validates file existence.
 *
 * @param filesArg - File arguments from CLI
 * @returns Resolved file paths
 */
async function resolveFiles(filesArg: string[] | undefined): Promise<string[]> {
  // If no files specified, try to find blend65.json
  if (!filesArg || filesArg.length === 0) {
    // Try to load files from blend65.json if it exists
    if (fs.existsSync('blend65.json')) {
      try {
        const configText = fs.readFileSync('blend65.json', 'utf-8');
        const configData = JSON.parse(configText);
        if (configData.files && Array.isArray(configData.files)) {
          return configData.files;
        }
        if (configData.include && Array.isArray(configData.include)) {
          const patterns = configData.include;
          const excludePatterns = configData.exclude || [];
          return expandGlobs(patterns, excludePatterns);
        }
      } catch {
        // Ignore config errors, fall through to empty check
      }
    }
    return [];
  }

  // Expand glob patterns
  return expandGlobs(filesArg, []);
}

/**
 * Expand glob patterns to file paths
 *
 * @param patterns - Glob patterns
 * @param exclude - Patterns to exclude
 * @returns Resolved file paths
 */
async function expandGlobs(patterns: string[], exclude: string[]): Promise<string[]> {
  const files: string[] = [];

  for (const pattern of patterns) {
    // Check if it's a literal file path
    if (!pattern.includes('*') && !pattern.includes('?')) {
      if (fs.existsSync(pattern)) {
        files.push(pattern);
      }
      continue;
    }

    // Expand glob
    const matches = await glob(pattern, {
      ignore: exclude,
      nodir: true,
    });
    files.push(...matches);
  }

  // Remove duplicates and sort
  return [...new Set(files)].sort();
}