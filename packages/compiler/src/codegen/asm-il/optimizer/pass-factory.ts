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
 * CompareBranch          -   -   ✓   ✓   ✓   ✓
 * IndexedAddr            -   -   ✓   ✓   ✓   ✓
 * RegisterPromote        -   -   ✓   ✓   ✓   ✓
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
import { StoreLoadPass } from './passes/store-load.js';

// Phase 4: Standard Passes (O2)
import { BranchOptPass } from './passes/branch-opt.js';
import { TransferOptPass } from './passes/transfer-opt.js';
import { CompareBranchPass } from './passes/compare-branch.js';
import { IndexedAddrPass } from './passes/indexed-addr.js';

// Phase 5: Advanced Passes (O3)
import { ZPPromotionPass } from './passes/zp-promotion.js';
import { Strength6502Pass } from './passes/strength-6502.js';
import { StackOptPass } from './passes/stack-opt.js';

// Phase 6: Size Passes (Os/Oz)
import { SizeOptPass } from './passes/size-opt.js';

// Phase 7: Register Promotion (O2+)
import { RegisterPromotePass } from './passes/register-promote.js';

// Phase 8: Safety Passes (O1+ — runs last)
import { LongBranchExpansionPass } from './passes/long-branch-expansion.js';

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
  passes.push(new StoreLoadPass());

  // ── O2+ passes: Standard patterns ──────────────────────────────────────
  // Additional optimizations that handle control flow and register usage.
  // Includes: O2, Os, Oz, O3, O3s, O3z (NOT O1, O1s, O1z)
  const isO2Plus = level !== OptimizationLevel.O1 &&
                   level !== OptimizationLevel.O1s &&
                   level !== OptimizationLevel.O1z;
  if (isO2Plus) {
    passes.push(new BranchOptPass());
    passes.push(new TransferOptPass());
    passes.push(new CompareBranchPass());
    passes.push(new IndexedAddrPass());
    passes.push(new RegisterPromotePass());
  }

  // ── O3 speed passes: Aggressive optimization ───────────────────────────
  // Uses zero-page slots, strength reduction, and stack optimization.
  // May increase code size in exchange for speed.
  if (level === OptimizationLevel.O3) {
    passes.push(new ZPPromotionPass(options.zpSlots));
    passes.push(new Strength6502Pass());
    passes.push(new StackOptPass());
  }

  // ── Size-focused levels: ZP promotion + StackOpt + SizeOpt ─────────────
  // Prioritizes smaller code output. Includes ZP promotion (smaller
  // instructions) and stack optimization (fewer save/restore pairs).
  // Applies to: O1s, O1z, Os, Oz, O3s, O3z
  const isSizeLevel = level === OptimizationLevel.Os || level === OptimizationLevel.Oz ||
                      level === OptimizationLevel.O1s || level === OptimizationLevel.O1z ||
                      level === OptimizationLevel.O3s || level === OptimizationLevel.O3z;
  if (isSizeLevel) {
    passes.push(new ZPPromotionPass(options.zpSlots));
    passes.push(new StackOptPass());
    // z suffix = aggressive SizeOpt
    const isAggressive = level === OptimizationLevel.Oz ||
                         level === OptimizationLevel.O1z ||
                         level === OptimizationLevel.O3z;
    passes.push(new SizeOptPass(isAggressive));
  }

  // ── Safety pass: Long-branch expansion (ALL O1+ levels) ────────────────
  // MUST run LAST — after all other passes (especially branch-opt which
  // does the inverse transformation). Ensures no conditional branch targets
  // exceed the 6502's ±127 byte range by expanding them to JMP-based patterns.
  passes.push(new LongBranchExpansionPass());

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
    [OptimizationLevel.O1]: 3,   // FlagPatterns + StoreLoad + LongBranchExpansion
    [OptimizationLevel.O1s]: 6,  // O1(2) + ZPPromotion + StackOpt + SizeOpt + LongBranchExpansion
    [OptimizationLevel.O1z]: 6,  // Same passes as O1s, more iterations
    [OptimizationLevel.O2]: 8,   // O1 + BranchOpt + TransferOpt + CompareBranch + IndexedAddr + RegisterPromote + LongBranchExpansion
    [OptimizationLevel.Os]: 11,  // O2 + ZPPromotion + StackOpt + SizeOpt + LongBranchExpansion
    [OptimizationLevel.Oz]: 11,  // O2 + ZPPromotion + StackOpt + SizeOpt(aggressive) + LongBranchExpansion
    [OptimizationLevel.O3]: 11,  // O2 + ZPPromotion + Strength6502 + StackOpt + LongBranchExpansion
    [OptimizationLevel.O3s]: 11, // O2(7) + ZPPromotion + StackOpt + SizeOpt + LongBranchExpansion
    [OptimizationLevel.O3z]: 11, // Same passes as O3s, more iterations
  };
}
