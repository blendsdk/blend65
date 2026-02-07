/**
 * ASM-IL Optimization Pass Factory
 *
 * Creates the appropriate set of optimization passes for a given
 * optimization level. This factory encapsulates the knowledge of
 * which passes run at which level, isolating pass configuration
 * from the optimizer itself.
 *
 * **Pass availability by level:**
 * ```
 * Pass                  O0  O1  O2  O3  Os  Oz
 * ─────────────────────────────────────────────
 * FlagPatterns           -   ✓   ✓   ✓   ✓   ✓
 * StoreLoad              -   ✓   ✓   ✓   ✓   ✓
 * BranchOpt              -   -   ✓   ✓   ✓   ✓
 * TransferOpt            -   -   ✓   ✓   ✓   ✓
 * ZPPromotion            -   -   -   ✓   ✓   ✓
 * Strength6502           -   -   -   ✓   -   -
 * StackOpt               -   -   -   ✓   ✓   ✓
 * SizeOpt                -   -   -   -   ✓   ✓
 * ```
 *
 * **Implementation Note:**
 * Passes are added progressively as they are implemented in Phases 3-6.
 * Until a pass class exists, its slot in the factory is reserved with a
 * comment. The factory structure and level logic are complete — only the
 * pass instantiation lines need to be uncommented as passes are built.
 *
 * @module codegen/asm-il/optimizer/pass-factory
 */

import type { AsmOptimizationPass } from './types.js';
import type { AsmOptimizerOptions } from './options.js';
import { OptimizationLevel } from './options.js';

// ============================================================================
// Pass Imports (uncomment as passes are implemented)
// ============================================================================

// Phase 3: Core Passes (O1)
import { FlagPatternsPass } from './passes/flag-patterns.js';
// import { StoreLoadPass } from './passes/store-load.js';

// Phase 4: Standard Passes (O2)
// import { BranchOptPass } from './passes/branch-opt.js';
// import { TransferOptPass } from './passes/transfer-opt.js';

// Phase 5: Advanced Passes (O3)
// import { ZPPromotionPass } from './passes/zp-promotion.js';
// import { Strength6502Pass } from './passes/strength-6502.js';
// import { StackOptPass } from './passes/stack-opt.js';

// Phase 6: Size Passes (Os/Oz)
// import { SizeOptPass } from './passes/size-opt.js';

// ============================================================================
// Pass Factory
// ============================================================================

/**
 * Creates the appropriate optimization passes for a given optimization level.
 *
 * Pass order matters — earlier passes can create opportunities for later passes:
 * 1. Flag patterns (remove redundant flag operations)
 * 2. Store-load elimination (remove redundant memory operations)
 * 3. Branch optimization (simplify control flow)
 * 4. Transfer optimization (eliminate redundant register transfers)
 * 5. ZP promotion (move hot variables to zero-page)
 * 6. Strength reduction (replace expensive ops with cheaper 6502 equivalents)
 * 7. Stack optimization (eliminate redundant PHA/PLA pairs)
 * 8. Size optimization (reduce code size — Os/Oz only)
 *
 * @param options - Optimizer options (level determines which passes are created)
 * @returns Array of optimization passes in execution order
 *
 * @example
 * ```typescript
 * const options = resolveOptions({ level: OptimizationLevel.O2 });
 * const passes = createPassesForLevel(options);
 * // Returns: [FlagPatternsPass, StoreLoadPass, BranchOptPass, TransferOptPass]
 * ```
 */
export function createPassesForLevel(
  options: AsmOptimizerOptions
): AsmOptimizationPass[] {
  const passes: AsmOptimizationPass[] = [];
  const level = options.level;

  // O0: No optimization — return empty array immediately
  if (level === OptimizationLevel.O0) {
    return passes;
  }

  // ── O1+ passes: Basic patterns ──────────────────────────────────────────
  // These are safe, fast optimizations with no resource requirements.
  passes.push(new FlagPatternsPass());
  // Phase 3, Session 3.2: passes.push(new StoreLoadPass());

  // ── O2+ passes: Standard patterns ──────────────────────────────────────
  // Additional optimizations that handle control flow and register usage.
  if (level !== OptimizationLevel.O1) {
    // Phase 4, Session 4.1: passes.push(new BranchOptPass());
    // Phase 4, Session 4.2: passes.push(new TransferOptPass());
  }

  // ── O3 passes: Aggressive optimization ─────────────────────────────────
  // Uses zero-page slots, strength reduction, and stack optimization.
  // May increase code size in exchange for speed.
  if (level === OptimizationLevel.O3) {
    // Phase 5, Session 5.1: passes.push(new ZPPromotionPass(options.zpSlots));
    // Phase 5, Session 5.2: passes.push(new Strength6502Pass());
    // Phase 5, Session 5.3: passes.push(new StackOptPass());
  }

  // ── Os/Oz passes: Size optimization ────────────────────────────────────
  // Prioritizes smaller code output. Includes ZP promotion (smaller
  // instructions) and stack optimization (fewer save/restore pairs).
  if (level === OptimizationLevel.Os || level === OptimizationLevel.Oz) {
    // Phase 5, Session 5.1: passes.push(new ZPPromotionPass(options.zpSlots));
    // Phase 5, Session 5.3: passes.push(new StackOptPass());
    // Phase 6, Session 6.1: passes.push(new SizeOptPass(level === OptimizationLevel.Oz));
  }

  return passes;
}

/**
 * Get the expected number of passes for a given optimization level.
 *
 * Useful for validation and testing. Returns the count of passes
 * that WILL be active once all phases are implemented.
 *
 * **Current state:** Returns 0 for all levels since no passes are
 * implemented yet. This function returns the ACTUAL count based on
 * what `createPassesForLevel()` currently returns, not the planned count.
 *
 * @param level - The optimization level
 * @returns Number of passes currently created for that level
 */
export function getPassCountForLevel(level: OptimizationLevel): number {
  // Use a dummy options object to count passes
  const dummyOptions: AsmOptimizerOptions = {
    level,
    debug: false,
    zpSlots: [],
    maxIterations: 1,
  };
  return createPassesForLevel(dummyOptions).length;
}

/**
 * Get the planned (future) number of passes for each optimization level.
 *
 * Returns the expected pass count once all optimization passes are
 * implemented across Phases 3-6. Useful for documentation and planning.
 *
 * @returns Map of optimization level to planned pass count
 */
export function getPlannedPassCounts(): Record<OptimizationLevel, number> {
  return {
    [OptimizationLevel.O0]: 0,
    [OptimizationLevel.O1]: 2,  // FlagPatterns + StoreLoad
    [OptimizationLevel.O2]: 4,  // O1 + BranchOpt + TransferOpt
    [OptimizationLevel.O3]: 7,  // O2 + ZPPromotion + Strength6502 + StackOpt
    [OptimizationLevel.Os]: 7,  // O2 + ZPPromotion + StackOpt + SizeOpt
    [OptimizationLevel.Oz]: 7,  // O2 + ZPPromotion + StackOpt + SizeOpt(aggressive)
  };
}
