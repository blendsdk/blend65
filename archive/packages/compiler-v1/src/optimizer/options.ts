/**
 * Optimizer Options - Configuration for the optimization pipeline
 *
 * Currently only supports O0 (no optimization) as a pass-through stub.
 * Full optimization levels (O1-O3, Os, Oz) will be implemented later.
 *
 * @module optimizer/options
 */

/**
 * Optimization level enumeration.
 *
 * Determines which optimization passes are enabled.
 *
 * @remarks
 * Currently only O0 is implemented as a pass-through.
 * Future optimization levels:
 * - O1: Basic optimizations (dead code elimination, constant folding)
 * - O2: Standard optimizations (default for release builds)
 * - O3: Aggressive optimizations (may increase code size)
 * - Os: Size optimization (minimize code size)
 * - Oz: Minimum size (aggressive size reduction)
 */
export enum OptimizationLevel {
  /** No optimization - IL passes through unchanged */
  O0 = 0,

  /** Basic optimizations (not yet implemented) */
  O1 = 1,

  /** Standard optimizations (not yet implemented) */
  O2 = 2,

  /** Aggressive optimizations (not yet implemented) */
  O3 = 3,

  /** Size optimization (not yet implemented) */
  Os = 10,

  /** Minimum size optimization (not yet implemented) */
  Oz = 11,
}

/**
 * Optimization options interface.
 *
 * Configures the optimizer behavior.
 *
 * @example
 * ```typescript
 * // Default options (O0 - no optimization)
 * const options = createDefaultOptions();
 *
 * // Custom options
 * const options: OptimizationOptions = {
 *   level: OptimizationLevel.O0,
 *   verbose: true,
 * };
 * ```
 */
export interface OptimizationOptions {
  /**
   * Optimization level.
   * Currently only O0 is supported.
   */
  level: OptimizationLevel;

  /**
   * Enable verbose output for debugging.
   * When true, the optimizer will log information about passes.
   */
  verbose?: boolean;

  /**
   * Target identifier for target-specific optimizations.
   * e.g., 'c64', 'c128', 'x16'
   */
  targetId?: string;
}

/**
 * Creates default optimization options (O0 - no optimization).
 *
 * @returns Default OptimizationOptions with O0 level
 *
 * @example
 * ```typescript
 * const options = createDefaultOptions();
 * console.log(options.level); // OptimizationLevel.O0
 * ```
 */
export function createDefaultOptions(): OptimizationOptions {
  return {
    level: OptimizationLevel.O0,
    verbose: false,
  };
}

/**
 * Creates optimization options for a specific level.
 *
 * @param level - The optimization level
 * @returns OptimizationOptions for the specified level
 *
 * @remarks
 * Currently all levels behave the same (pass-through) since
 * optimization passes are not yet implemented.
 *
 * @example
 * ```typescript
 * const options = createOptionsForLevel(OptimizationLevel.O2);
 * ```
 */
export function createOptionsForLevel(level: OptimizationLevel): OptimizationOptions {
  return {
    level,
    verbose: false,
  };
}

/**
 * Checks if the given optimization level is implemented.
 *
 * @param level - The optimization level to check
 * @returns true if the level is implemented (currently only O0)
 */
export function isLevelImplemented(level: OptimizationLevel): boolean {
  // Currently only O0 is implemented (pass-through)
  return level === OptimizationLevel.O0;
}