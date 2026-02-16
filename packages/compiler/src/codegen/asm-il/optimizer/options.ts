/**
 * ASM-IL Optimizer Options
 *
 * Defines optimization levels and their default configurations.
 * The optimization level system maps CLI flags (O0, O1, O2, O3, Os, Oz)
 * to specific optimizer configurations controlling which passes run,
 * how many iterations are allowed, and what resources are available.
 *
 * **Level Hierarchy:**
 * - O0: No optimization (pass-through)
 * - O1: Basic optimizations (flag patterns, store-load)
 * - O2: Standard optimizations (O1 + branches, transfers)
 * - O3: Aggressive optimizations (O2 + ZP promotion, strength reduction, stack)
 * - Os: Size-optimized (O2 + ZP promotion, stack, size-specific)
 * - Oz: Minimum size (Os + aggressive size, more iterations)
 *
 * @module codegen/asm-il/optimizer/options
 */

// ============================================================================
// Optimization Level Enum
// ============================================================================

/**
 * Optimization level enum matching CLI flags.
 *
 * Each level enables a progressively larger set of optimization passes.
 * The levels follow a GCC/LLVM-style naming convention familiar to
 * systems programmers.
 *
 * - **O0**: No optimization — useful for debugging, output matches input 1:1
 * - **O1**: Basic patterns — safe, fast, no extra resources needed
 * - **O2**: Standard patterns — good balance of speed and optimization
 * - **O3**: Aggressive — uses ZP slots, multiple iterations, may increase size
 * - **Os**: Size-optimized — prioritizes smaller code over speed
 * - **Oz**: Minimum size — most aggressive size reduction, may sacrifice speed
 */
export enum OptimizationLevel {
  /** No optimization — pass-through mode */
  O0 = 'O0',

  /** Basic optimization — flag patterns, store-load elimination */
  O1 = 'O1',

  /** Basic + size — O1 passes + ZP promotion, SizeOpt */
  O1s = 'O1s',

  /** Basic + min-size — like O1s but multi-iteration */
  O1z = 'O1z',

  /** Standard optimization — O1 + branch optimization, transfer patterns */
  O2 = 'O2',

  /** Size-optimized — O2 + ZP promotion, stack, size-specific passes */
  Os = 'Os',

  /** Minimum size — Os + aggressive size reduction, more iterations */
  Oz = 'Oz',

  /** Aggressive optimization — O2 + ZP promotion, strength reduction, stack */
  O3 = 'O3',

  /** Aggressive + size — O3 passes + ZP promotion, SizeOpt, no Strength6502 */
  O3s = 'O3s',

  /** Aggressive + min-size — like O3s but multi-iteration */
  O3z = 'O3z',
}

// ============================================================================
// Optimizer Options Interface
// ============================================================================

/**
 * Configuration options for the ASM-IL optimizer.
 *
 * These options control the high-level behavior of the optimizer,
 * including which optimization level to use, available zero-page
 * slots for promotion, and iteration limits.
 *
 * The options are translated into a concrete AsmOptimizerConfig
 * (with specific passes) by the AsmILOptimizer class and pass factory.
 */
export interface AsmOptimizerOptions {
  /** Optimization level — determines which passes are enabled */
  level: OptimizationLevel;

  /** Enable debug logging for optimizer internals */
  debug: boolean;

  /**
   * Available zero-page addresses for variable promotion.
   *
   * Only used by O3, Os, and Oz levels. The ZP promotion pass
   * moves frequently-accessed variables to zero-page addresses
   * for faster access (3 cycles vs 4 cycles, 2 bytes vs 3 bytes).
   *
   * These must be free ZP addresses not used by the C64 system,
   * BASIC, or the Blend65 runtime.
   */
  zpSlots: number[];

  /**
   * Maximum fixed-point iterations.
   *
   * Higher values allow more aggressive optimization at the cost
   * of compile time. Values by level:
   * - O0/O1/O2/Os: 1 (single pass)
   * - O3/Oz: 5 (multiple passes for maximum optimization)
   */
  maxIterations: number;
}

// ============================================================================
// Default Options Per Level
// ============================================================================

/**
 * Default optimizer options for each optimization level.
 *
 * These defaults define the "out of the box" behavior for each level.
 * Users can override individual fields when constructing an AsmILOptimizer.
 *
 * **Zero-page slot allocation (0x50-0x57):**
 * Addresses $50-$57 are commonly free on the C64 when not using
 * BASIC floating-point routines. O3 uses all 8 slots for maximum
 * promotion, while Os/Oz use 4 slots (balancing size savings with
 * ZP pressure).
 */
export const DEFAULT_OPTIONS: Record<OptimizationLevel, AsmOptimizerOptions> = {
  // O0: No optimization — everything disabled
  [OptimizationLevel.O0]: {
    level: OptimizationLevel.O0,
    debug: false,
    zpSlots: [],
    maxIterations: 1,
  },

  // O1: Basic patterns — single pass, no ZP slots
  [OptimizationLevel.O1]: {
    level: OptimizationLevel.O1,
    debug: false,
    zpSlots: [],
    maxIterations: 1,
  },

  // O1s: Basic + size — SizeOpt, ZP promotion, single pass
  [OptimizationLevel.O1s]: {
    level: OptimizationLevel.O1s,
    debug: false,
    zpSlots: [0x50, 0x51, 0x52, 0x53],
    maxIterations: 1,
  },

  // O1z: Basic + min-size — like O1s but multi-iteration
  [OptimizationLevel.O1z]: {
    level: OptimizationLevel.O1z,
    debug: false,
    zpSlots: [0x50, 0x51, 0x52, 0x53],
    maxIterations: 5,
  },

  // O2: Standard patterns — single pass, no ZP slots
  [OptimizationLevel.O2]: {
    level: OptimizationLevel.O2,
    debug: false,
    zpSlots: [],
    maxIterations: 1,
  },

  // O3: Aggressive — multiple iterations, 8 ZP slots
  [OptimizationLevel.O3]: {
    level: OptimizationLevel.O3,
    debug: false,
    zpSlots: [0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57],
    maxIterations: 5,
  },

  // Os: Size-optimized — single pass, 4 ZP slots
  [OptimizationLevel.Os]: {
    level: OptimizationLevel.Os,
    debug: false,
    zpSlots: [0x50, 0x51, 0x52, 0x53],
    maxIterations: 1,
  },

  // Oz: Minimum size — multiple iterations, 4 ZP slots
  [OptimizationLevel.Oz]: {
    level: OptimizationLevel.Oz,
    debug: false,
    zpSlots: [0x50, 0x51, 0x52, 0x53],
    maxIterations: 5,
  },

  // O3s: Aggressive + size — ZP promotion, SizeOpt, no Strength6502, single pass
  [OptimizationLevel.O3s]: {
    level: OptimizationLevel.O3s,
    debug: false,
    zpSlots: [0x50, 0x51, 0x52, 0x53],
    maxIterations: 1,
  },

  // O3z: Aggressive + min-size — like O3s but multi-iteration
  [OptimizationLevel.O3z]: {
    level: OptimizationLevel.O3z,
    debug: false,
    zpSlots: [0x50, 0x51, 0x52, 0x53],
    maxIterations: 5,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the default options for a given optimization level.
 *
 * Returns a fresh copy to prevent shared mutation.
 *
 * @param level - The optimization level
 * @returns A copy of the default options for that level
 */
export function getDefaultOptions(level: OptimizationLevel): AsmOptimizerOptions {
  const defaults = DEFAULT_OPTIONS[level];
  return {
    ...defaults,
    zpSlots: [...defaults.zpSlots],
  };
}

/**
 * Merge user-provided partial options with defaults for the specified level.
 *
 * The level is determined by: explicit `level` in overrides → fallback to O2.
 * All other fields fall back to the defaults for that level.
 *
 * @param overrides - Partial options to merge
 * @returns Complete options with all fields filled
 */
export function resolveOptions(
  overrides: Partial<AsmOptimizerOptions> = {}
): AsmOptimizerOptions {
  const level = overrides.level ?? OptimizationLevel.O2;
  const defaults = getDefaultOptions(level);
  return {
    ...defaults,
    ...overrides,
    // Ensure zpSlots is always a fresh copy
    zpSlots: overrides.zpSlots
      ? [...overrides.zpSlots]
      : [...defaults.zpSlots],
  };
}

/**
 * Check whether a given optimization level enables any optimization.
 *
 * O0 is the only level that disables all optimization passes.
 *
 * @param level - The optimization level to check
 * @returns true if optimization is enabled (any level except O0)
 */
export function isOptimizationEnabled(level: OptimizationLevel): boolean {
  return level !== OptimizationLevel.O0;
}

/**
 * Get all optimization levels as an ordered array.
 *
 * Useful for iteration, validation, and UI display.
 *
 * @returns Array of all OptimizationLevel values in order
 */
export function getAllLevels(): OptimizationLevel[] {
  return [
    OptimizationLevel.O0,
    OptimizationLevel.O1, OptimizationLevel.O1s, OptimizationLevel.O1z,
    OptimizationLevel.O2, OptimizationLevel.Os, OptimizationLevel.Oz,
    OptimizationLevel.O3, OptimizationLevel.O3s, OptimizationLevel.O3z,
  ];
}
