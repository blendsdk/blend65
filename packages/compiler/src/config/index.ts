/**
 * Configuration System
 *
 * Provides project configuration types for Blend65 projects.
 * Handles the `blend65.json` configuration file structure.
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
// Value Exports (constants and functions)
// =============================================================================

export {
  ALL_OPTIMIZATION_LEVELS,
  normalizeOptimizationLevel,
  isSizeLevel,
  isMinSizeLevel,
  getBaseLevel,
} from './types.js';
