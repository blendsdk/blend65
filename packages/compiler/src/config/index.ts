/**
 * Configuration System
 *
 * Provides project configuration support for Blend65 projects.
 * Handles loading, validation, and merging of `blend65.json` files.
 *
 * **Key Components:**
 * - {@link ConfigLoader} - Load config files
 * - {@link ConfigValidator} - Validate configurations
 * - {@link FileResolver} - Resolve source files from patterns
 * - {@link mergeConfig} - Merge configs with CLI overrides
 *
 * **Quick Start:**
 * ```typescript
 * import { ConfigLoader, mergeConfig, FileResolver } from './config/index.js';
 *
 * // Load configuration
 * const loader = new ConfigLoader();
 * const { config, configPath } = loader.loadWithOptions({ cwd: '/project' });
 *
 * // Merge with CLI overrides
 * const merged = mergeConfig({
 *   fileConfig: config,
 *   cliOverrides: { verbose: true },
 * });
 *
 * // Resolve source files
 * const resolver = FileResolver.fromConfigDir(configPath ? dirname(configPath) : '/project');
 * const files = resolver.resolveFiles(merged);
 * ```
 *
 * @module config
 */

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Main configuration types
  Blend65Config,
  CompilerOptions,
  EmulatorConfig,
  ResourceConfig,

  // String literal types
  TargetPlatform,
  OptimizationLevelId,
  DebugMode,
  OutputFormat,
  EmulatorType,

  // Error and options types
  ConfigValidationError,
  ConfigLoadOptions,
} from './types.js';

// =============================================================================
// Default Value Exports
// =============================================================================

export {
  // Constants
  DEFAULT_TARGET,
  DEFAULT_OPTIMIZATION,
  DEFAULT_DEBUG_MODE,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_OUT_DIR,
  DEFAULT_LOAD_ADDRESS,
  DEFAULT_INCLUDE_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_EMULATOR_TYPE,

  // Factory functions
  getDefaultConfig,
  getDefaultCompilerOptions,
  getDefaultEmulatorConfig,

  // Validation helpers
  getValidTargets,
  getValidOptimizationLevels,
  getValidDebugModes,
  getValidOutputFormats,
  getValidEmulatorTypes,

  // Implementation checks
  isTargetImplemented,
  isOutputFormatImplemented,
} from './defaults.js';

// =============================================================================
// Validator Exports
// =============================================================================

export { ConfigValidator, ConfigValidationException } from './validator.js';

// =============================================================================
// Loader Exports
// =============================================================================

export { ConfigLoader, ConfigLoadException, CONFIG_FILE_NAME } from './loader.js';

// =============================================================================
// Merger Exports
// =============================================================================

export type { ConfigMergeOptions } from './merger.js';

export {
  mergeConfig,
  mergeCompilerOptions,
  mergeEmulatorConfig,
  createMergedConfig,
  createDefaultConfig,
  resolveCompilerOptions,
} from './merger.js';

// =============================================================================
// File Resolver Exports
// =============================================================================

export type { FileResolverOptions, FileResolverResult } from './resolver.js';

export { FileResolver, FileResolutionException, resolveConfigFiles } from './resolver.js';