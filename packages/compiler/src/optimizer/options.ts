/**
 * Optimization Options for IL Optimizer
 *
 * Defines optimization levels and configuration options for the IL optimizer.
 * Supports O0 (none) through O3 (aggressive) plus Os (size) and Oz (min size).
 *
 * **Optimization Levels:**
 * - O0: No optimization (debugging, fast compile)
 * - O1: Basic optimizations (DCE, constant folding)
 * - O2: Standard optimizations (all passes, single iteration)
 * - O3: Aggressive optimizations (all passes, multiple iterations)
 * - Os: Size optimizations (all passes tuned for code size)
 * - Oz: Minimum size (aggressive size reduction)
 *
 * @module optimizer/options
 */

// ============================================================================
// Optimization Levels
// ============================================================================

/**
 * Optimization level enum.
 *
 * Each level enables progressively more optimization passes.
 * Higher levels may increase compile time but produce better code.
 *
 * @example
 * ```typescript
 * const options = getDefaultOptions();
 * options.level = 'O2'; // Standard optimization
 * ```
 */
export type OptimizationLevel = 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Oz';

// ============================================================================
// Optimization Options Interface
// ============================================================================

/**
 * Configuration options for the IL optimizer.
 *
 * Controls which optimizations are enabled and how they run.
 * The `level` determines default pass selection, which can be
 * overridden by `enabledPasses` and `disabledPasses`.
 *
 * @example
 * ```typescript
 * // Standard optimization with debug output
 * const options: OptimizationOptions = {
 *   level: 'O2',
 *   debug: true,
 * };
 *
 * // O2 but with copy propagation disabled
 * const options: OptimizationOptions = {
 *   level: 'O2',
 *   disabledPasses: ['copy-prop'],
 * };
 * ```
 */
export interface OptimizationOptions {
  /**
   * Optimization level.
   *
   * Determines the default set of passes to run.
   * @default 'O2'
   */
  level: OptimizationLevel;

  /**
   * Explicitly enabled passes (overrides level defaults).
   *
   * When set, only these passes will run (plus their dependencies).
   * Takes precedence over level-default passes.
   */
  enabledPasses?: string[];

  /**
   * Explicitly disabled passes.
   *
   * These passes will not run even if enabled by the level.
   * Takes precedence over `enabledPasses`.
   */
  disabledPasses?: string[];

  /**
   * Enable debug output.
   *
   * When true, the optimizer logs pass statistics and decisions.
   * @default false
   */
  debug?: boolean;

  /**
   * Maximum iterations for fixed-point optimization.
   *
   * O3 and Oz levels iterate passes until no changes are made
   * or this limit is reached.
   * @default 10
   */
  maxIterations?: number;
}

// ============================================================================
// Default Options
// ============================================================================

/**
 * Get default optimization options.
 *
 * Returns standard O2 configuration suitable for production builds.
 *
 * @returns Default OptimizationOptions
 *
 * @example
 * ```typescript
 * const optimizer = new ILOptimizer(getDefaultOptions());
 * ```
 */
export function getDefaultOptions(): OptimizationOptions {
  return {
    level: 'O2',
    debug: false,
    maxIterations: 10,
  };
}

// ============================================================================
// Pass Configuration Per Level
// ============================================================================

/**
 * Pass configuration for each optimization level.
 *
 * Maps optimization levels to their default pass sets.
 * This is the authoritative source of which passes run at each level.
 *
 * @internal
 */
const LEVEL_PASSES: Record<OptimizationLevel, string[]> = {
  // No optimization - skip all passes
  O0: [],

  // Basic optimizations - safe, fast, high-impact
  O1: ['dce', 'constant-fold'],

  // Standard optimizations - all passes, single iteration
  O2: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole'],

  // Aggressive optimizations - all passes, multiple iterations
  O3: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole'],

  // Size optimization - all passes tuned for code size
  Os: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole'],

  // Minimum size - aggressive size reduction with iterations
  Oz: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole'],
};

/**
 * Get passes enabled for a given optimization level.
 *
 * Returns the default set of passes for the specified level.
 * Does not consider enabledPasses/disabledPasses overrides.
 *
 * @param level - Optimization level
 * @returns Array of pass names enabled for this level
 *
 * @example
 * ```typescript
 * const passes = getPassesForLevel('O2');
 * // ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole']
 * ```
 */
export function getPassesForLevel(level: OptimizationLevel): string[] {
  return [...LEVEL_PASSES[level]]; // Return copy to prevent modification
}

// ============================================================================
// Level Characteristics
// ============================================================================

/**
 * Check if a level uses iterative optimization.
 *
 * O3 and Oz iterate passes until fixed point or maxIterations.
 * Other levels run each pass exactly once.
 *
 * @param level - Optimization level
 * @returns true if level uses iterative optimization
 *
 * @example
 * ```typescript
 * if (shouldIterate(options.level)) {
 *   // Run passes until no changes
 * }
 * ```
 */
export function shouldIterate(level: OptimizationLevel): boolean {
  return level === 'O3' || level === 'Oz';
}

/**
 * Check if a level optimizes for size over speed.
 *
 * Os and Oz prioritize code size over execution speed.
 * This affects pass behavior (prefer shorter sequences).
 *
 * @param level - Optimization level
 * @returns true if level optimizes for size
 *
 * @example
 * ```typescript
 * if (isSizeOptimization(options.level)) {
 *   // Prefer shorter instruction sequences
 * }
 * ```
 */
export function isSizeOptimization(level: OptimizationLevel): boolean {
  return level === 'Os' || level === 'Oz';
}

/**
 * Get the default iteration count for a level.
 *
 * Non-iterative levels return 1 (run each pass once).
 * Iterative levels use maxIterations from options or default 10.
 *
 * @param options - Optimization options
 * @returns Number of iterations for this level
 */
export function getIterationCount(options: OptimizationOptions): number {
  if (!shouldIterate(options.level)) {
    return 1;
  }
  return options.maxIterations ?? 10;
}

// ============================================================================
// Pass Resolution
// ============================================================================

/**
 * Resolve the final set of enabled passes based on options.
 *
 * Applies the following logic:
 * 1. Start with level defaults
 * 2. If enabledPasses is set, use only those passes
 * 3. Remove any passes in disabledPasses
 *
 * @param options - Optimization options
 * @returns Final array of enabled pass names
 *
 * @example
 * ```typescript
 * // O2 with copy-prop disabled
 * const passes = resolveEnabledPasses({
 *   level: 'O2',
 *   disabledPasses: ['copy-prop'],
 * });
 * // ['dce', 'constant-fold', 'constant-prop', 'il-peephole']
 * ```
 */
export function resolveEnabledPasses(options: OptimizationOptions): string[] {
  // Start with level defaults or explicit enabledPasses
  const basePasses = options.enabledPasses ?? getPassesForLevel(options.level);

  // Remove disabled passes
  const disabled = new Set(options.disabledPasses ?? []);
  return basePasses.filter((pass) => !disabled.has(pass));
}