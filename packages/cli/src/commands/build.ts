/**
 * Build Command
 *
 * Compiles Blend65 source files to assembly and optionally binary.
 *
 * **Usage:**
 * ```bash
 * blend65 build [files...] [options]
 * blend65 build src/main.blend -o build/
 * blend65 build -t c64 -O2
 * ```
 *
 * @module commands/build
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CommandModule, ArgumentsCamelCase } from 'yargs';
import chalk from 'chalk';
import { glob } from 'glob';

import { Compiler, normalizeOptimizationLevel, type Blend65Config, type OptimizationLevelId } from '@blend65/compiler';
import { formatDiagnostics, formatSuccess, formatError } from '../output/formatter.js';
import { ExitCode } from '../utils/exit-codes.js';
import type { GlobalOptions } from './types.js';

/**
 * Build command options
 */
export interface BuildOptions extends GlobalOptions {
  /** Source files to compile (positional) */
  files?: string[];

  /** Target platform (c64, c128, x16) */
  target?: string;

  /** Optimization level (O0-O3, Os, Oz) */
  optimization?: string;

  /** Debug information (none, inline, vice, both) */
  debug?: string;

  /** Output directory */
  out?: string;

  /** Output filename */
  outFile?: string;

  /** Optional libraries to load (comma-separated) */
  libraries?: string;
}

/**
 * Build command definition
 */
export const buildCommand: CommandModule<GlobalOptions, BuildOptions> = {
  command: 'build [files...]',
  describe: 'Compile Blend65 source files',

  builder: (yargs) => {
    return yargs
      .positional('files', {
        describe: 'Source files to compile (supports globs)',
        type: 'string',
        array: true,
      })
      .option('target', {
        alias: 't',
        type: 'string',
        description: 'Target platform',
        choices: ['c64', 'c128', 'x16'] as const,
        default: 'c64',
      })
      .option('optimization', {
        alias: 'O',
        type: 'string',
        description: 'Optimization level',
        choices: ['0', '1', '1s', '1z', '2', 's', 'z', '3', '3s', '3z'] as const,
        default: '0',
      })
      .option('debug', {
        alias: 'd',
        type: 'string',
        description: 'Debug information',
        choices: ['none', 'inline', 'vice', 'both'] as const,
        default: 'none',
      })
      .option('out', {
        alias: 'o',
        type: 'string',
        description: 'Output directory',
        default: './build',
      })
      .option('outFile', {
        type: 'string',
        description: 'Output filename (without extension)',
      })
      .option('libraries', {
        alias: 'l',
        type: 'string',
        description: 'Optional libraries to load (comma-separated)',
      })
      .example('$0 build src/main.blend', 'Build single file')
      .example('$0 build src/**/*.blend', 'Build multiple files')
      .example('$0 build -O2', 'Standard optimization')
      .example('$0 build -Os', 'Optimize for size')
      .example('$0 build -O3z', 'Aggressive minimum size')
      .example('$0 build -t c64 -O2 -o dist/', 'Full build options')
      .example('$0 build --libraries=sid,sprites', 'Build with optional libraries')
      .epilog(
        [
          'Optimization Levels:',
          '',
          '  Base Levels (aggressiveness):',
          '    0     No optimization (default)',
          '    1     Basic (DCE, constant folding, inlining)',
          '    2     Standard (all analysis passes)',
          '    3     Aggressive (ZP promotion, strength reduction, multi-pass)',
          '',
          '  Size Modifiers (append s or z to base level):',
          '    +s    Optimize for size (disables inlining/unrolling, adds SizeOpt)',
          '    +z    Minimum size (like s + multiple iterations)',
          '',
          '  Examples:  -O1  -O1s  -O3z  -Os (same as -O2s)',
          '  All levels: 0, 1, 1s, 1z, 2, s(=2s), z(=2z), 3, 3s, 3z',
        ].join('\n'),
      );
  },

  handler: async (args: ArgumentsCamelCase<BuildOptions>): Promise<void> => {
    const startTime = Date.now();

    try {
      // Resolve source files
      const files = await resolveFiles(args.files);

      if (files.length === 0) {
        console.error(formatError('No source files found'));
        console.log(chalk.gray('Specify files: blend65 build src/main.blend'));
        console.log(chalk.gray('Or use globs:  blend65 build "src/**/*.blend"'));
        process.exitCode = ExitCode.FILE_NOT_FOUND;
        return;
      }

      if (args.verbose) {
        console.log(chalk.gray('Files to compile:'));
        files.forEach((f) => console.log(chalk.gray(`  - ${f}`)));
      }

      console.log(chalk.blue('Compiling'), files.length, 'file(s)...');

      // Build configuration
      const config = buildConfig(args);

      // Compile
      const compiler = new Compiler();
      const result = compiler.compile({ files, config });

      // Report diagnostics
      if (result.diagnostics.length > 0) {
        console.log('');
        console.log(formatDiagnostics(result.diagnostics));
        console.log('');
      }

      // Handle result
      if (result.success) {
        const elapsed = Date.now() - startTime;
        console.log(formatSuccess(`Build succeeded in ${elapsed} ms`));

        // Write output files
        await writeOutputFiles(result, args);

        process.exitCode = ExitCode.SUCCESS;
      } else {
        const errorCount = result.diagnostics.filter((d) => d.severity === 'error').length;
        const warningCount = result.diagnostics.filter((d) => d.severity === 'warning').length;

        let message = `Build failed with ${errorCount} error(s)`;
        if (warningCount > 0) {
          message += ` and ${warningCount} warning(s)`;
        }
        console.log(formatError(message));

        process.exitCode = ExitCode.COMPILATION_ERROR;
      }
    } catch (error) {
      console.error(formatError(`Build failed: ${error}`));
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

/**
 * Parse libraries string into array
 *
 * Splits comma-separated library names into an array.
 * Trims whitespace and filters empty strings.
 *
 * @param librariesArg - Comma-separated library names
 * @returns Array of library names
 *
 * @example
 * parseLibraries('sid,sprites') // ['sid', 'sprites']
 * parseLibraries('sid, sprites') // ['sid', 'sprites']
 * parseLibraries(undefined) // []
 */
function parseLibraries(librariesArg: string | undefined): string[] {
  if (!librariesArg) return [];
  return librariesArg
    .split(',')
    .map((lib) => lib.trim())
    .filter((lib) => lib.length > 0);
}

/**
 * Resolve the optimization level from CLI arguments
 *
 * Handles two edge cases:
 * 1. Duplicate flags (e.g., `-O1 -O2`) — yargs passes an array; we take the last value
 * 2. Prepends 'O' prefix — CLI accepts bare levels ('0','1','s','z') and converts
 *    to the compiler's expected format ('O0','O1','Os','Oz')
 *
 * @param opt - Raw optimization value from yargs (string or string[] if duplicated)
 * @returns Valid OptimizationLevelId for the compiler (e.g., 'O0', 'O2', 'Os')
 */
function resolveOptimizationLevel(opt: unknown): OptimizationLevelId {
  // BUG-007: Handle duplicate flags — yargs may pass an array when flag is repeated
  const raw = Array.isArray(opt) ? opt[opt.length - 1] : opt;
  const level = typeof raw === 'string' ? raw : '0';

  // Prepend 'O' and normalize via the canonical validation function.
  // This handles aliases (O2s→Os, O2z→Oz) and rejects invalid combos (O0s, O0z).
  return normalizeOptimizationLevel(`O${level}`);
}

/**
 * Build configuration from CLI options
 *
 * Converts CLI arguments into a Blend65Config object for the compiler.
 * The optimization level is resolved via {@link resolveOptimizationLevel}
 * to handle the 'O' prefix prepending and duplicate flag edge cases.
 *
 * @param args - CLI arguments
 * @returns Blend65 configuration
 */
function buildConfig(args: ArgumentsCamelCase<BuildOptions>): Blend65Config {
  return {
    compilerOptions: {
      target: (args.target as 'c64' | 'c128' | 'x16') || 'c64',
      optimization: resolveOptimizationLevel(args.optimization),
      debug: (args.debug as 'none' | 'inline' | 'vice' | 'both') || 'none',
      outDir: args.out || './build',
      outFile: args.outFile,
      outputFormat: 'both',
      verbose: args.verbose || false,
      strict: false,
      libraries: parseLibraries(args.libraries),
    },
  };
}

/**
 * Write output files to disk
 *
 * @param result - Compilation result
 * @param args - CLI arguments
 */
async function writeOutputFiles(
  result: { success: boolean; output?: { assembly?: string; binary?: Uint8Array; viceLabels?: string } },
  args: ArgumentsCamelCase<BuildOptions>,
): Promise<void> {
  const outDir = args.out || './build';

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Determine output filename
  const baseName = args.outFile || getBaseName(args.files?.[0]) || 'output';

  // Write assembly
  if (result.output?.assembly) {
    const asmPath = path.join(outDir, `${baseName}.asm`);
    fs.writeFileSync(asmPath, result.output.assembly);
    console.log(chalk.gray(`  → ${asmPath}`));
  }

  // Write binary
  if (result.output?.binary) {
    const prgPath = path.join(outDir, `${baseName}.prg`);
    fs.writeFileSync(prgPath, result.output.binary);
    console.log(chalk.gray(`  → ${prgPath} (${result.output.binary.length} bytes)`));
  }

  // Write VICE labels
  if (result.output?.viceLabels) {
    const labelsPath = path.join(outDir, `${baseName}.labels`);
    fs.writeFileSync(labelsPath, result.output.viceLabels);
    console.log(chalk.gray(`  → ${labelsPath}`));
  }
}

/**
 * Get base name from file path (without extension)
 *
 * @param filePath - File path
 * @returns Base name
 */
function getBaseName(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  const base = path.basename(filePath);
  const ext = path.extname(base);
  return base.slice(0, -ext.length) || base;
}