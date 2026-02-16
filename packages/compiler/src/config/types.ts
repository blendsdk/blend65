/**
 * Configuration Type Definitions
 *
 * Defines the TypeScript interfaces for the Blend65 project configuration
 * system. These types support the `blend65.json` project configuration file,
 * similar to TypeScript's `tsconfig.json`.
 *
 * **Key Interfaces:**
 * - {@link Blend65Config} - Main project configuration
 * - {@link CompilerOptions} - Compiler-specific options
 * - {@link EmulatorConfig} - Emulator configuration for `blend65 run`
 * - {@link ResourceConfig} - Asset pipeline configuration (future)
 *
 * **Integration with Existing Types:**
 * - `CompilerOptions.target` → maps to `TargetArchitecture` enum
 * - `CompilerOptions.optimization` → maps to `OptimizationLevel` enum
 *
 * @module config/types
 * @see {@link ../target/architecture.js!TargetArchitecture}
 * @see {@link ../optimizer/options.js!OptimizationLevel}
 */

/**
 * Target platform identifiers
 *
 * String literals that map to `TargetArchitecture` enum values.
 * Used in JSON configuration files for human-readable target selection.
 *
 * **Note**: Currently only 'c64' is implemented. Other targets
 * ('c128', 'x16') will generate a "not implemented yet" error.
 */
export type TargetPlatform = 'c64' | 'c128' | 'x16';

/**
 * Optimization level identifiers
 *
 * Two-dimensional model: base aggressiveness + optional size modifier.
 *
 * **Base Levels (aggressiveness):**
 * - 'O0': No optimization
 * - 'O1': Basic optimizations (DCE, constant folding)
 * - 'O2': Standard optimizations (all passes, single iteration)
 * - 'O3': Aggressive optimizations (ZP promotion, strength reduction, multi-pass)
 *
 * **Size Modifiers (append to base):**
 * - 's': Optimize for size (disables inlining/unrolling, adds SizeOpt)
 * - 'z': Optimize for minimum size (like 's' + multi-pass iterations)
 *
 * **Composite Levels:**
 * - 'O1s': Basic + size optimization
 * - 'O1z': Basic + minimum size
 * - 'Os': Standard + size (alias for O2s)
 * - 'Oz': Standard + minimum size (alias for O2z)
 * - 'O3s': Aggressive + size optimization
 * - 'O3z': Aggressive + minimum size
 *
 * **Invalid:** O0s, O0z (no optimization + size is contradictory)
 */
export type OptimizationLevelId =
  | 'O0'
  | 'O1' | 'O1s' | 'O1z'
  | 'O2' | 'Os' | 'Oz'     // Os = O2s alias, Oz = O2z alias
  | 'O3' | 'O3s' | 'O3z';

// ============================================================================
// Optimization Level Helpers
// ============================================================================

/**
 * All valid optimization level IDs (canonical forms).
 * Used for validation and iteration.
 */
export const ALL_OPTIMIZATION_LEVELS: readonly OptimizationLevelId[] = Object.freeze([
  'O0', 'O1', 'O1s', 'O1z', 'O2', 'Os', 'Oz', 'O3', 'O3s', 'O3z',
]);

/**
 * Normalize and validate an optimization level string.
 *
 * - Converts aliases: 'O2s' → 'Os', 'O2z' → 'Oz'
 * - Rejects invalid combos: 'O0s', 'O0z'
 * - Returns the canonical OptimizationLevelId
 *
 * @param input - Raw optimization level string from CLI or config
 * @returns Normalized OptimizationLevelId
 * @throws Error if input is invalid
 */
export function normalizeOptimizationLevel(input: string): OptimizationLevelId {
  // Handle aliases — O2s and O2z are the long forms of Os and Oz
  if (input === 'O2s') return 'Os';
  if (input === 'O2z') return 'Oz';

  // Reject invalid combinations — size optimization requires at least O1
  if (input === 'O0s' || input === 'O0z') {
    throw new Error(
      `Invalid optimization level '${input}': size optimization requires at least O1. ` +
      `Use O1s, Os, or O3s instead.`
    );
  }

  // Validate against known levels
  if (!ALL_OPTIMIZATION_LEVELS.includes(input as OptimizationLevelId)) {
    throw new Error(
      `Unknown optimization level '${input}'. ` +
      `Valid levels: ${ALL_OPTIMIZATION_LEVELS.join(', ')}`
    );
  }

  return input as OptimizationLevelId;
}

/**
 * Check if a level uses size optimization.
 *
 * @param level - Optimization level
 * @returns true if level targets code size
 */
export function isSizeLevel(level: OptimizationLevelId): boolean {
  return level === 'Os' || level === 'Oz' ||
         level === 'O1s' || level === 'O1z' ||
         level === 'O3s' || level === 'O3z';
}

/**
 * Check if a level uses minimum-size (z) optimization with iterations.
 *
 * @param level - Optimization level
 * @returns true if level targets minimum code size
 */
export function isMinSizeLevel(level: OptimizationLevelId): boolean {
  return level === 'Oz' || level === 'O1z' || level === 'O3z';
}

/**
 * Get the base aggressiveness level (stripping size modifier).
 *
 * @param level - Optimization level
 * @returns Base level: 'O0', 'O1', 'O2', or 'O3'
 */
export function getBaseLevel(level: OptimizationLevelId): 'O0' | 'O1' | 'O2' | 'O3' {
  if (level === 'O0') return 'O0';
  if (level === 'O1' || level === 'O1s' || level === 'O1z') return 'O1';
  if (level === 'O2' || level === 'Os' || level === 'Oz') return 'O2';
  // O3, O3s, O3z
  return 'O3';
}

/**
 * Debug information generation mode
 *
 * Controls what debug information is generated during compilation.
 *
 * - 'none': No debug info (smallest output)
 * - 'inline': Comments in generated assembly
 * - 'vice': VICE label file (.lbl) for debugging
 * - 'both': Inline comments + VICE labels
 */
export type DebugMode = 'none' | 'inline' | 'vice' | 'both';

/**
 * Output format for compiled programs
 *
 * Determines what files are generated by the compiler.
 *
 * - 'asm': Assembly source only (.asm)
 * - 'prg': C64 executable (.prg) - requires ACME assembler
 * - 'crt': Cartridge image (.crt) - not yet implemented
 * - 'both': Assembly + PRG files
 */
export type OutputFormat = 'asm' | 'prg' | 'crt' | 'both';

/**
 * Emulator type for argument formatting
 *
 * Identifies the emulator type for correct command-line argument formatting.
 *
 * - 'vice': VICE emulator (x64sc, x64, x128)
 * - 'x16emu': Commander X16 emulator
 */
export type EmulatorType = 'vice' | 'x16emu';

/**
 * Compiler-specific options
 *
 * Configures how the Blend65 compiler processes and generates code.
 * These options can be set in `blend65.json` and overridden via CLI flags.
 *
 * @example
 * ```typescript
 * const options: CompilerOptions = {
 *   target: 'c64',
 *   optimization: 'O0',
 *   debug: 'both',
 *   outDir: './build',
 *   outFile: 'game.prg',
 *   verbose: true,
 * };
 * ```
 */
export interface CompilerOptions {
  /**
   * Target platform
   * @default "c64"
   */
  target?: TargetPlatform;

  /**
   * Optimization level
   * @default "O0"
   */
  optimization?: OptimizationLevelId;

  /**
   * Debug information generation
   * @default "none"
   */
  debug?: DebugMode;

  /**
   * Output directory for compiled files
   * @default "./build"
   */
  outDir?: string;

  /**
   * Output filename (without path)
   * @example "game.prg"
   */
  outFile?: string;

  /**
   * Output format
   * @default "prg"
   */
  outputFormat?: OutputFormat;

  /**
   * Enable verbose compiler output
   * @default false
   */
  verbose?: boolean;

  /**
   * Enable strict mode (warnings as errors)
   * @default false
   */
  strict?: boolean;

  /**
   * Program load address
   * @default 2049 (0x0801)
   */
  loadAddress?: number;

  /**
   * Optional libraries to load
   * @example ["sid", "sprites"]
   */
  libraries?: string[];
}

/**
 * Emulator configuration
 *
 * Configures how `blend65 run` launches the emulator.
 * Supports VICE and Commander X16 emulators.
 */
export interface EmulatorConfig {
  /** Path to emulator executable */
  path?: string;

  /** Emulator type */
  type?: EmulatorType;

  /** Additional command-line arguments */
  args?: string[];

  /** Automatically run program after loading */
  autoRun?: boolean;

  /** Wait for emulator to exit */
  waitForExit?: boolean;
}

/**
 * Resource configuration (future)
 *
 * Configuration for the asset pipeline.
 * Specifies patterns for resource files that should be
 * processed and included in the build.
 */
export interface ResourceConfig {
  /** Sprite file patterns */
  sprites?: string[];

  /** Music file patterns */
  music?: string[];

  /** Character set patterns */
  charsets?: string[];
}

/**
 * Blend65 project configuration
 *
 * Main configuration interface for `blend65.json` project files.
 * Similar to TypeScript's `tsconfig.json`.
 */
export interface Blend65Config {
  /** JSON Schema reference for IDE support */
  $schema?: string;

  /** Compiler options */
  compilerOptions: CompilerOptions;

  /** Glob patterns for source files to include */
  include?: string[];

  /** Glob patterns for files to exclude */
  exclude?: string[];

  /** Explicit list of files to compile */
  files?: string[];

  /** Root directory for source files */
  rootDir?: string;

  /** Emulator configuration */
  emulator?: EmulatorConfig;

  /** Resource file mappings (future) */
  resources?: ResourceConfig;
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  /** JSON path to the invalid property */
  path: string;

  /** Human-readable error message */
  message: string;

  /** The invalid value that caused the error */
  value: unknown;
}

/**
 * Options for loading configuration
 */
export interface ConfigLoadOptions {
  /** Explicit path to configuration file */
  configPath?: string;

  /** Working directory for file resolution */
  cwd?: string;

  /** CLI overrides for compiler options */
  cliOverrides?: Partial<CompilerOptions>;

  /** Files specified on command line */
  cliFiles?: string[];

  /** Libraries specified on command line */
  cliLibraries?: string[];
}
