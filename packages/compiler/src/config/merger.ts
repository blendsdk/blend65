/**
 * Configuration Merger
 *
 * Merges configuration from multiple sources with proper precedence:
 * CLI flags > blend65.json > defaults
 *
 * This ensures that:
 * - Users always have sensible defaults
 * - Project config overrides defaults
 * - CLI flags override everything (for quick testing)
 *
 * @module config/merger
 */

import type { Blend65Config, CompilerOptions, EmulatorConfig } from './types.js';

import { getDefaultConfig, getDefaultCompilerOptions, getDefaultEmulatorConfig } from './defaults.js';

/**
 * Options for merging configuration
 */
export interface ConfigMergeOptions {
  /**
   * Configuration loaded from file (blend65.json)
   *
   * May be partial - missing values use defaults.
   */
  fileConfig: Partial<Blend65Config> | null;

  /**
   * CLI overrides for compiler options
   *
   * Values from command-line flags.
   * These take highest precedence.
   */
  cliOverrides?: Partial<CompilerOptions>;

  /**
   * Files specified on command line
   *
   * Explicit file list from CLI arguments.
   * Overrides include/exclude/files from config.
   */
  cliFiles?: string[];
}

/**
 * Merge configuration from multiple sources
 *
 * Applies the following precedence:
 * 1. CLI overrides (highest)
 * 2. File config (blend65.json)
 * 3. Defaults (lowest)
 *
 * @param options - Merge options containing sources
 * @returns Fully merged configuration
 *
 * @example
 * ```typescript
 * const merged = mergeConfig({
 *   fileConfig: loadedConfig,
 *   cliOverrides: { target: 'c64', verbose: true },
 *   cliFiles: ['src/main.blend'],
 * });
 * ```
 */
export function mergeConfig(options: ConfigMergeOptions): Blend65Config {
  const defaultCompilerOpts = getDefaultCompilerOptions();
  const defaultEmulatorOpts = getDefaultEmulatorConfig();
  const defaults = getDefaultConfig();
  const fileConfig = options.fileConfig ?? {};

  // Merge compiler options: defaults < file < CLI
  const compilerOptions = mergeCompilerOptions(
    defaultCompilerOpts,
    fileConfig.compilerOptions ?? {},
    options.cliOverrides ?? {}
  );

  // Merge emulator config: defaults < file
  const emulator = mergeEmulatorConfig(defaultEmulatorOpts, fileConfig.emulator);

  // Build merged config
  const merged: Blend65Config = {
    compilerOptions,
    include: fileConfig.include ?? defaults.include,
    exclude: fileConfig.exclude ?? defaults.exclude,
    rootDir: fileConfig.rootDir ?? defaults.rootDir,
    emulator,
  };

  // Copy optional fields from file config
  if (fileConfig.$schema) {
    merged.$schema = fileConfig.$schema;
  }

  if (fileConfig.files) {
    merged.files = fileConfig.files;
  }

  if (fileConfig.resources) {
    merged.resources = fileConfig.resources;
  }

  // CLI files override all file patterns
  if (options.cliFiles && options.cliFiles.length > 0) {
    merged.files = options.cliFiles;
    // Clear include/exclude since we're using explicit files
    merged.include = undefined;
    merged.exclude = undefined;
  }

  return merged;
}

/**
 * Merge compiler options from multiple sources
 *
 * Handles the three-way merge of:
 * 1. Default values
 * 2. File config values
 * 3. CLI override values
 *
 * Only defined values override - undefined values are skipped.
 *
 * @param defaults - Default compiler options
 * @param fileOptions - Options from config file
 * @param cliOverrides - Options from CLI flags
 * @returns Merged compiler options
 */
export function mergeCompilerOptions(
  defaults: Required<CompilerOptions>,
  fileOptions: Partial<CompilerOptions>,
  cliOverrides: Partial<CompilerOptions>
): Required<CompilerOptions> {
  // Start with defaults
  const merged: Required<CompilerOptions> = { ...defaults };

  // Apply file options (only defined values)
  applyDefinedValues(merged, fileOptions);

  // Apply CLI overrides (only defined values)
  applyDefinedValues(merged, cliOverrides);

  return merged;
}

/**
 * Merge emulator configuration
 *
 * Handles two-way merge of defaults and file config.
 * CLI overrides for emulator are not supported.
 *
 * @param defaults - Default emulator config
 * @param fileConfig - Emulator config from file
 * @returns Merged emulator configuration
 */
export function mergeEmulatorConfig(
  defaults: Required<EmulatorConfig> | undefined,
  fileConfig: EmulatorConfig | undefined
): Required<EmulatorConfig> | undefined {
  // No defaults and no file config
  if (!defaults && !fileConfig) {
    return undefined;
  }

  // Get effective defaults
  const effectiveDefaults = defaults ?? getDefaultEmulatorConfig();

  // No file config, use defaults
  if (!fileConfig) {
    return effectiveDefaults;
  }

  // Merge file config into defaults
  const merged: Required<EmulatorConfig> = { ...effectiveDefaults };
  applyDefinedValues(merged, fileConfig);

  return merged;
}

/**
 * Apply defined values from source to target
 *
 * Only copies values that are not undefined.
 * This preserves existing values in target when source doesn't define them.
 *
 * @param target - Object to update
 * @param source - Object with values to apply
 */
function applyDefinedValues<T extends Record<string, unknown>>(target: T, source: Partial<T>): void {
  for (const key of Object.keys(source) as Array<keyof T>) {
    const value = source[key];
    if (value !== undefined) {
      target[key] = value as T[keyof T];
    }
  }
}

/**
 * Create a config with CLI overrides applied
 *
 * Convenience function for common use case of:
 * - Loading config from file
 * - Applying CLI overrides
 * - Getting final merged config
 *
 * @param fileConfig - Config loaded from file (or null)
 * @param cliOverrides - CLI override options
 * @param cliFiles - Files specified on CLI
 * @returns Fully merged configuration
 *
 * @example
 * ```typescript
 * const config = createMergedConfig(
 *   loadedFromFile,
 *   { verbose: true, optimization: 'O2' },
 *   ['main.blend']
 * );
 * ```
 */
export function createMergedConfig(
  fileConfig: Partial<Blend65Config> | null,
  cliOverrides?: Partial<CompilerOptions>,
  cliFiles?: string[]
): Blend65Config {
  return mergeConfig({
    fileConfig,
    cliOverrides,
    cliFiles,
  });
}

/**
 * Create a default configuration
 *
 * Returns a fully populated configuration with all default values.
 * Useful as a starting point for programmatic configuration.
 *
 * @returns Default configuration
 *
 * @example
 * ```typescript
 * const config = createDefaultConfig();
 * config.compilerOptions.target = 'c64';
 * config.include = ['src/**\/*.blend'];
 * ```
 */
export function createDefaultConfig(): Blend65Config {
  return getDefaultConfig();
}

/**
 * Extract effective compiler options
 *
 * Given a (possibly partial) config, returns fully resolved
 * compiler options with all defaults filled in.
 *
 * @param config - Partial or full configuration
 * @returns Fully resolved compiler options
 */
export function resolveCompilerOptions(config: Partial<Blend65Config> | null): Required<CompilerOptions> {
  const defaults = getDefaultCompilerOptions();

  if (!config || !config.compilerOptions) {
    return defaults;
  }

  return mergeCompilerOptions(defaults, config.compilerOptions, {});
}