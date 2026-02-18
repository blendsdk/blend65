/**
 * ASM-IL Pass Factory Tests
 *
 * Tests for createPassesForLevel, getPassCountForLevel,
 * and getPlannedPassCounts functions.
 *
 * Note: Since no optimization passes are implemented yet (Phases 3-6),
 * all levels currently return empty pass arrays. These tests verify the
 * factory structure, level logic, and planned counts. Tests will be
 * updated as passes are implemented.
 */

import { describe, it, expect } from 'vitest';
import {
  createPassesForLevel,
  getPassCountForLevel,
  getPlannedPassCounts,
} from '../../../../codegen/asm-il/optimizer/pass-factory.js';
import {
  OptimizationLevel,
  getAllLevels,
  resolveOptions,
} from '../../../../codegen/asm-il/optimizer/options.js';
import type { AsmOptimizerOptions } from '../../../../codegen/asm-il/optimizer/options.js';

/**
 * Helper to create options for a given level with defaults.
 */
function optionsForLevel(level: OptimizationLevel): AsmOptimizerOptions {
  return resolveOptions({ level });
}

describe('ASM-IL Pass Factory', () => {
  // ========================================================================
  // createPassesForLevel
  // ========================================================================

  describe('createPassesForLevel', () => {
    it('should return empty array for O0 (no optimization)', () => {
      const passes = createPassesForLevel(optionsForLevel(OptimizationLevel.O0));
      expect(passes).toEqual([]);
    });

    it('should return an array for every level', () => {
      // Verify no errors thrown for any level
      const levels = getAllLevels();
      for (const level of levels) {
        const passes = createPassesForLevel(optionsForLevel(level));
        expect(Array.isArray(passes)).toBe(true);
      }
    });

    it('should return a fresh array each time (no shared references)', () => {
      const passes1 = createPassesForLevel(optionsForLevel(OptimizationLevel.O2));
      const passes2 = createPassesForLevel(optionsForLevel(OptimizationLevel.O2));
      expect(passes1).not.toBe(passes2);
    });

    // Pass counts reflect currently implemented passes:
    // - FlagPatternsPass: O1+ (Phase 3, Session 3.1)
    // - StoreLoadPass: O1+ (Phase 3, Session 3.2)
    // Remaining passes will be added in Phases 4-6.

    it('should return 3 passes for O1 (FlagPatterns + StoreLoad + LongBranchExpansion)', () => {
      const passes = createPassesForLevel(optionsForLevel(OptimizationLevel.O1));
      expect(passes).toHaveLength(3);
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('long-branch-expansion');
    });

    it('should return 8 passes for O2 (O1 + BranchOpt + TransferOpt + CompareBranch + IndexedAddr + RegisterPromote + LongBranchExpansion)', () => {
      const passes = createPassesForLevel(optionsForLevel(OptimizationLevel.O2));
      expect(passes).toHaveLength(8);
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('branch-opt');
      expect(passes[3].name).toBe('transfer-opt');
      expect(passes[4].name).toBe('compare-branch');
      expect(passes[5].name).toBe('indexed-addr');
      expect(passes[6].name).toBe('register-promote');
      expect(passes[7].name).toBe('long-branch-expansion');
    });

    it('should return 11 passes for O3 (O2 + ZPPromotion + Strength6502 + StackOpt + LongBranchExpansion)', () => {
      const passes = createPassesForLevel(optionsForLevel(OptimizationLevel.O3));
      expect(passes).toHaveLength(11);
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('branch-opt');
      expect(passes[3].name).toBe('transfer-opt');
      expect(passes[4].name).toBe('compare-branch');
      expect(passes[5].name).toBe('indexed-addr');
      expect(passes[6].name).toBe('register-promote');
      expect(passes[7].name).toBe('zp-promotion');
      expect(passes[8].name).toBe('6502-strength');
      expect(passes[9].name).toBe('stack-opt');
      expect(passes[10].name).toBe('long-branch-expansion');
    });

    it('should return 11 passes for Os (O2 + ZPPromotion + StackOpt + SizeOpt + LongBranchExpansion)', () => {
      const passes = createPassesForLevel(optionsForLevel(OptimizationLevel.Os));
      expect(passes).toHaveLength(11);
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('branch-opt');
      expect(passes[3].name).toBe('transfer-opt');
      expect(passes[4].name).toBe('compare-branch');
      expect(passes[5].name).toBe('indexed-addr');
      expect(passes[6].name).toBe('register-promote');
      expect(passes[7].name).toBe('zp-promotion');
      expect(passes[8].name).toBe('stack-opt');
      expect(passes[9].name).toBe('size-opt');
      expect(passes[10].name).toBe('long-branch-expansion');
    });

    it('should return 11 passes for Oz (O2 + ZPPromotion + StackOpt + SizeOpt-aggressive + LongBranchExpansion)', () => {
      const passes = createPassesForLevel(optionsForLevel(OptimizationLevel.Oz));
      expect(passes).toHaveLength(11);
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('branch-opt');
      expect(passes[3].name).toBe('transfer-opt');
      expect(passes[4].name).toBe('compare-branch');
      expect(passes[5].name).toBe('indexed-addr');
      expect(passes[6].name).toBe('register-promote');
      expect(passes[7].name).toBe('zp-promotion');
      expect(passes[8].name).toBe('stack-opt');
      expect(passes[9].name).toBe('size-opt');
      expect(passes[10].name).toBe('long-branch-expansion');
    });

    it('should return 6 passes for O1s (O1 + ZPPromotion + StackOpt + SizeOpt + LongBranchExpansion)', () => {
      const passes = createPassesForLevel(optionsForLevel(OptimizationLevel.O1s));
      expect(passes).toHaveLength(6);
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('zp-promotion');
      expect(passes[3].name).toBe('stack-opt');
      expect(passes[4].name).toBe('size-opt');
      expect(passes[5].name).toBe('long-branch-expansion');
    });

    it('should return 6 passes for O1z (same as O1s, more iterations)', () => {
      const passes = createPassesForLevel(optionsForLevel(OptimizationLevel.O1z));
      expect(passes).toHaveLength(6);
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('zp-promotion');
      expect(passes[3].name).toBe('stack-opt');
      expect(passes[4].name).toBe('size-opt');
      expect(passes[5].name).toBe('long-branch-expansion');
    });

    it('should return 11 passes for O3s (O2 + ZPPromotion + StackOpt + SizeOpt + LongBranchExpansion)', () => {
      const passes = createPassesForLevel(optionsForLevel(OptimizationLevel.O3s));
      expect(passes).toHaveLength(11);
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('branch-opt');
      expect(passes[3].name).toBe('transfer-opt');
      expect(passes[4].name).toBe('compare-branch');
      expect(passes[5].name).toBe('indexed-addr');
      expect(passes[6].name).toBe('register-promote');
      expect(passes[7].name).toBe('zp-promotion');
      expect(passes[8].name).toBe('stack-opt');
      expect(passes[9].name).toBe('size-opt');
      expect(passes[10].name).toBe('long-branch-expansion');
    });

    it('should return 11 passes for O3z (same passes as O3s, more iterations)', () => {
      const passes = createPassesForLevel(optionsForLevel(OptimizationLevel.O3z));
      expect(passes).toHaveLength(11);
      expect(passes[0].name).toBe('flag-patterns');
      expect(passes[1].name).toBe('store-load');
      expect(passes[2].name).toBe('branch-opt');
      expect(passes[3].name).toBe('transfer-opt');
      expect(passes[4].name).toBe('compare-branch');
      expect(passes[5].name).toBe('indexed-addr');
      expect(passes[6].name).toBe('register-promote');
      expect(passes[7].name).toBe('zp-promotion');
      expect(passes[8].name).toBe('stack-opt');
      expect(passes[9].name).toBe('size-opt');
      expect(passes[10].name).toBe('long-branch-expansion');
    });

    it('should accept custom zpSlots in options', () => {
      // Verify the factory doesn't crash with custom zpSlots
      const options = resolveOptions({
        level: OptimizationLevel.O3,
        zpSlots: [0x60, 0x61, 0x62],
      });
      const passes = createPassesForLevel(options);
      expect(Array.isArray(passes)).toBe(true);
    });
  });

  // ========================================================================
  // getPassCountForLevel
  // ========================================================================

  describe('getPassCountForLevel', () => {
    it('should return 0 for O0', () => {
      expect(getPassCountForLevel(OptimizationLevel.O0)).toBe(0);
    });

    it('should return a number for every level', () => {
      const levels = getAllLevels();
      for (const level of levels) {
        const count = getPassCountForLevel(level);
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    it('should match the length of createPassesForLevel output', () => {
      // Ensure getPassCountForLevel is consistent with createPassesForLevel
      const levels = getAllLevels();
      for (const level of levels) {
        const count = getPassCountForLevel(level);
        const passes = createPassesForLevel(optionsForLevel(level));
        expect(count).toBe(passes.length);
      }
    });
  });

  // ========================================================================
  // getPlannedPassCounts
  // ========================================================================

  describe('getPlannedPassCounts', () => {
    it('should return planned counts for all levels', () => {
      const planned = getPlannedPassCounts();
      const levels = getAllLevels();
      for (const level of levels) {
        expect(planned[level]).toBeDefined();
        expect(typeof planned[level]).toBe('number');
      }
    });

    it('should plan 0 passes for O0', () => {
      const planned = getPlannedPassCounts();
      expect(planned[OptimizationLevel.O0]).toBe(0);
    });

    it('should plan 3 passes for O1 (FlagPatterns + StoreLoad + LongBranchExpansion)', () => {
      const planned = getPlannedPassCounts();
      expect(planned[OptimizationLevel.O1]).toBe(3);
    });

    it('should plan 8 passes for O2 (O1 + BranchOpt + TransferOpt + CompareBranch + IndexedAddr + RegisterPromote + LongBranchExpansion)', () => {
      const planned = getPlannedPassCounts();
      expect(planned[OptimizationLevel.O2]).toBe(8);
    });

    it('should plan 11 passes for O3 (O2 + ZP + Strength + Stack + LongBranchExpansion)', () => {
      const planned = getPlannedPassCounts();
      expect(planned[OptimizationLevel.O3]).toBe(11);
    });

    it('should plan 11 passes for Os (O2 + ZP + Stack + Size + LongBranchExpansion)', () => {
      const planned = getPlannedPassCounts();
      expect(planned[OptimizationLevel.Os]).toBe(11);
    });

    it('should plan 11 passes for Oz (O2 + ZP + Stack + Size-aggressive + LongBranchExpansion)', () => {
      const planned = getPlannedPassCounts();
      expect(planned[OptimizationLevel.Oz]).toBe(11);
    });

    it('should show O0 < O1 < O2 pass count progression', () => {
      const planned = getPlannedPassCounts();
      expect(planned[OptimizationLevel.O0]).toBeLessThan(planned[OptimizationLevel.O1]);
      expect(planned[OptimizationLevel.O1]).toBeLessThan(planned[OptimizationLevel.O2]);
    });
  });
});
