/**
 * Configuration Default Values
 *
 * Provides default values for all configuration options.
 * These defaults are used when values are not specified in
 * `blend65.json` or CLI arguments.
 *
 * **Design Principles:**
 * - Safe defaults (no data loss)
 * - Development-friendly (verbose output, debug info)
 * - Consistent with common expectations
 *
 * @module config/defaults
 */

import type {
  Blend65Config,
  CompilerOptions,
  EmulatorConfig,
  TargetPlatform,
  OptimizationLevelId,
  DebugMode,
  OutputFormat,
  EmulatorType,
} from './types.js';

/**
 * Default target platform
 *
 * The C64 is the primary target for Blend65.
 */
export const DEFAULT_TARGET: TargetPlatform = 'c64';

/**
 * Default optimization level
 *
 * O0 (no optimization) is the default for:
 * - Faster compilation during development
 * - Easier debugging
 * - Predictable code generation
 */
export const DEFAULT_OPTIMIZATION: OptimizationLevelId = 'O0';

/**
 * Default debug mode
 *
 * 'none' by default to produce clean output.
 * Development setups should explicitly enable debug info.
 */
export const DEFAULT_DEBUG_MODE: DebugMode = 'none';

/**
 * Default output format
 *
 * 'prg' produces a runnable C64 executable.
 * This is the most common use case.
 */
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = 'prg';

/**
 * Default output directory
 *
 * './build' keeps output separate from source.
 */
export const DEFAULT_OUT_DIR = './build';

/**
 * Default load address (C64 BASIC start)
 *
 * $0801 (2049) is the standard BASIC start address.
 * Programs load here for automatic RUN support.
 */
export const DEFAULT_LOAD_ADDRESS = 0x0801;

/**
 * Default include patterns
 *
 * Includes all .blend files in the project.
 */
export const DEFAULT_INCLUDE_PATTERNS: string[] = ['**/*.blend'];

/**
 * Default exclude patterns
 *
 * Excludes common directories that shouldn't be compiled:
 * - node_modules: npm dependencies
 * - build: output directory
 * - dist: alternative output directory
 */
export const DEFAULT_EXCLUDE_PATTERNS: string[] = ['node_modules/**', 'build/**', 'dist/**'];

/**
 * Default emulator type
 *
 * VICE is the most common C64 emulator.
 */
export const DEFAULT_EMULATOR_TYPE: EmulatorType = 'vice';

/**
 * Creates default compiler options
 *
 * Returns a complete `CompilerOptions` object with all
 * default values filled in.
 *
 * @returns Default compiler options
 *
 * @example
 * ```typescript
 * const defaults = getDefaultCompilerOptions();
 * console.log(defaults.target);      // 'c64'
 * console.log(defaults.optimization); // 'O0'
 * console.log(defaults.debug);       // 'none'
 * ```
 */
export function getDefaultCompilerOptions(): Required<CompilerOptions> {
  return {
    target: DEFAULT_TARGET,
    optimization: DEFAULT_OPTIMIZATION,
    debug: DEFAULT_DEBUG_MODE,
    outDir: DEFAULT_OUT_DIR,
    outFile: '', // Empty string means "derive from entry file"
    outputFormat: DEFAULT_OUTPUT_FORMAT,
    verbose: false,
    strict: false,
    loadAddress: DEFAULT_LOAD_ADDRESS,
    libraries: [], // Empty array - libraries are opt-in via config or CLI
  };
}

/**
 * Creates default emulator configuration
 *
 * Returns a complete `EmulatorConfig` object with all
 * default values filled in.
 *
 * @returns Default emulator configuration
 *
 * @example
 * ```typescript
 * const defaults = getDefaultEmulatorConfig();
 * console.log(defaults.type);    // 'vice'
 * console.log(defaults.autoRun); // true
 * ```
 */
export function getDefaultEmulatorConfig(): Required<EmulatorConfig> {
  return {
    path: '', // Empty string means "search PATH"
    type: DEFAULT_EMULATOR_TYPE,
    args: [],
    autoRun: true,
    waitForExit: false,
  };
}

/**
 * Creates default project configuration
 *
 * Returns a complete `Blend65Config` object with all
 * default values filled in. This is the baseline
 * configuration that gets merged with user settings.
 *
 * @returns Default project configuration
 *
 * @example
 * ```typescript
 * const defaults = getDefaultConfig();
 *
 * // Use as base for merging
 * const merged = {
 *   ...defaults,
 *   ...userConfig,
 *   compilerOptions: {
 *     ...defaults.compilerOptions,
 *     ...userConfig.compilerOptions,
 *   },
 * };
 * ```
 */
export function getDefaultConfig(): Blend65Config {
  return {
    compilerOptions: getDefaultCompilerOptions(),
    include: DEFAULT_INCLUDE_PATTERNS,
    exclude: DEFAULT_EXCLUDE_PATTERNS,
    rootDir: '.',
    emulator: getDefaultEmulatorConfig(),
  };
}

/**
 * Get all valid target platforms
 *
 * Returns an array of all valid target platform identifiers.
 * Useful for validation error messages.
 *
 * @returns Array of valid targets
 */
export function getValidTargets(): TargetPlatform[] {
  return ['c64', 'c128', 'x16'];
}

/**
 * Get all valid optimization levels
 *
 * Returns an array of all valid optimization level identifiers.
 * Useful for validation error messages.
 *
 * @returns Array of valid optimization levels
 */
export function getValidOptimizationLevels(): OptimizationLevelId[] {
  return ['O0', 'O1', 'O2', 'O3', 'Os', 'Oz'];
}

/**
 * Get all valid debug modes
 *
 * Returns an array of all valid debug mode identifiers.
 * Useful for validation error messages.
 *
 * @returns Array of valid debug modes
 */
export function getValidDebugModes(): DebugMode[] {
  return ['none', 'inline', 'vice', 'both'];
}

/**
 * Get all valid output formats
 *
 * Returns an array of all valid output format identifiers.
 * Useful for validation error messages.
 *
 * @returns Array of valid output formats
 */
export function getValidOutputFormats(): OutputFormat[] {
  return ['asm', 'prg', 'crt', 'both'];
}

/**
 * Get all valid emulator types
 *
 * Returns an array of all valid emulator type identifiers.
 * Useful for validation error messages.
 *
 * @returns Array of valid emulator types
 */
export function getValidEmulatorTypes(): EmulatorType[] {
  return ['vice', 'x16emu'];
}

/**
 * Check if a target is implemented
 *
 * Currently only 'c64' is implemented.
 * Other targets exist for forward compatibility.
 *
 * @param target - Target to check
 * @returns True if target is implemented
 */
export function isTargetImplemented(target: TargetPlatform): boolean {
  return target === 'c64';
}

/**
 * Check if an output format is implemented
 *
 * Currently 'crt' (cartridge) is not implemented.
 *
 * @param format - Output format to check
 * @returns True if format is implemented
 */
export function isOutputFormatImplemented(format: OutputFormat): boolean {
  return format !== 'crt';
}