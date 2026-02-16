/**
 * ASM-IL Optimizer Options Tests
 *
 * Tests for OptimizationLevel enum, DEFAULT_OPTIONS configuration,
 * and helper functions: getDefaultOptions, resolveOptions,
 * isOptimizationEnabled, getAllLevels.
 */

import { describe, it, expect } from 'vitest';
import {
  OptimizationLevel,
  DEFAULT_OPTIONS,
  getDefaultOptions,
  resolveOptions,
  isOptimizationEnabled,
  getAllLevels,
} from '../../../../codegen/asm-il/optimizer/options.js';
import type { AsmOptimizerOptions } from '../../../../codegen/asm-il/optimizer/options.js';

describe('ASM-IL Optimizer Options', () => {
  // ========================================================================
  // OptimizationLevel Enum
  // ========================================================================

  describe('OptimizationLevel', () => {
    it('should have all 6 optimization levels', () => {
      expect(OptimizationLevel.O0).toBe('O0');
      expect(OptimizationLevel.O1).toBe('O1');
      expect(OptimizationLevel.O2).toBe('O2');
      expect(OptimizationLevel.O3).toBe('O3');
      expect(OptimizationLevel.Os).toBe('Os');
      expect(OptimizationLevel.Oz).toBe('Oz');
    });

    it('should have exactly 10 values', () => {
      // Filter out reverse mappings (numeric keys) from TS enums
      const values = Object.values(OptimizationLevel);
      expect(values).toHaveLength(10);
    });
  });

  // ========================================================================
  // DEFAULT_OPTIONS
  // ========================================================================

  describe('DEFAULT_OPTIONS', () => {
    it('should have an entry for every optimization level', () => {
      const levels = getAllLevels();
      for (const level of levels) {
        expect(DEFAULT_OPTIONS[level]).toBeDefined();
        expect(DEFAULT_OPTIONS[level].level).toBe(level);
      }
    });

    describe('O0 defaults', () => {
      it('should have no ZP slots', () => {
        expect(DEFAULT_OPTIONS[OptimizationLevel.O0].zpSlots).toEqual([]);
      });

      it('should have 1 max iteration', () => {
        expect(DEFAULT_OPTIONS[OptimizationLevel.O0].maxIterations).toBe(1);
      });

      it('should have debug disabled', () => {
        expect(DEFAULT_OPTIONS[OptimizationLevel.O0].debug).toBe(false);
      });
    });

    describe('O1 defaults', () => {
      it('should have no ZP slots', () => {
        expect(DEFAULT_OPTIONS[OptimizationLevel.O1].zpSlots).toEqual([]);
      });

      it('should have 1 max iteration', () => {
        expect(DEFAULT_OPTIONS[OptimizationLevel.O1].maxIterations).toBe(1);
      });
    });

    describe('O2 defaults', () => {
      it('should have no ZP slots', () => {
        expect(DEFAULT_OPTIONS[OptimizationLevel.O2].zpSlots).toEqual([]);
      });

      it('should have 1 max iteration', () => {
        expect(DEFAULT_OPTIONS[OptimizationLevel.O2].maxIterations).toBe(1);
      });
    });

    describe('O3 defaults', () => {
      it('should have 8 ZP slots ($50-$57)', () => {
        const slots = DEFAULT_OPTIONS[OptimizationLevel.O3].zpSlots;
        expect(slots).toHaveLength(8);
        expect(slots[0]).toBe(0x50);
        expect(slots[7]).toBe(0x57);
      });

      it('should have 5 max iterations for aggressive optimization', () => {
        expect(DEFAULT_OPTIONS[OptimizationLevel.O3].maxIterations).toBe(5);
      });
    });

    describe('Os defaults', () => {
      it('should have 4 ZP slots ($50-$53)', () => {
        const slots = DEFAULT_OPTIONS[OptimizationLevel.Os].zpSlots;
        expect(slots).toHaveLength(4);
        expect(slots[0]).toBe(0x50);
        expect(slots[3]).toBe(0x53);
      });

      it('should have 1 max iteration', () => {
        expect(DEFAULT_OPTIONS[OptimizationLevel.Os].maxIterations).toBe(1);
      });
    });

    describe('Oz defaults', () => {
      it('should have 4 ZP slots ($50-$53)', () => {
        const slots = DEFAULT_OPTIONS[OptimizationLevel.Oz].zpSlots;
        expect(slots).toHaveLength(4);
        expect(slots[0]).toBe(0x50);
        expect(slots[3]).toBe(0x53);
      });

      it('should have 5 max iterations for aggressive size optimization', () => {
        expect(DEFAULT_OPTIONS[OptimizationLevel.Oz].maxIterations).toBe(5);
      });
    });

    it('should have debug disabled for all levels by default', () => {
      const levels = getAllLevels();
      for (const level of levels) {
        expect(DEFAULT_OPTIONS[level].debug).toBe(false);
      }
    });
  });

  // ========================================================================
  // getDefaultOptions
  // ========================================================================

  describe('getDefaultOptions', () => {
    it('should return correct defaults for each level', () => {
      const levels = getAllLevels();
      for (const level of levels) {
        const options = getDefaultOptions(level);
        expect(options.level).toBe(level);
        expect(options.debug).toBe(DEFAULT_OPTIONS[level].debug);
        expect(options.maxIterations).toBe(DEFAULT_OPTIONS[level].maxIterations);
        expect(options.zpSlots).toEqual(DEFAULT_OPTIONS[level].zpSlots);
      }
    });

    it('should return a fresh copy each time (no shared mutation)', () => {
      const opts1 = getDefaultOptions(OptimizationLevel.O3);
      const opts2 = getDefaultOptions(OptimizationLevel.O3);

      // Should be equal in value but different objects
      expect(opts1).toEqual(opts2);
      expect(opts1).not.toBe(opts2);

      // zpSlots should also be separate arrays
      expect(opts1.zpSlots).not.toBe(opts2.zpSlots);
    });

    it('should not mutate DEFAULT_OPTIONS when modifying returned copy', () => {
      const options = getDefaultOptions(OptimizationLevel.O3);
      const originalSlots = [...DEFAULT_OPTIONS[OptimizationLevel.O3].zpSlots];

      // Mutate the returned copy
      options.zpSlots.push(0x99);
      options.debug = true;

      // Original DEFAULT_OPTIONS should be unaffected
      expect(DEFAULT_OPTIONS[OptimizationLevel.O3].zpSlots).toEqual(originalSlots);
      expect(DEFAULT_OPTIONS[OptimizationLevel.O3].debug).toBe(false);
    });
  });

  // ========================================================================
  // resolveOptions
  // ========================================================================

  describe('resolveOptions', () => {
    it('should default to O2 when no overrides provided', () => {
      const options = resolveOptions();
      expect(options.level).toBe(OptimizationLevel.O2);
    });

    it('should use the specified level', () => {
      const options = resolveOptions({ level: OptimizationLevel.O3 });
      expect(options.level).toBe(OptimizationLevel.O3);
    });

    it('should merge with level defaults', () => {
      // O3 defaults to 5 maxIterations and 8 ZP slots
      const options = resolveOptions({ level: OptimizationLevel.O3 });
      expect(options.maxIterations).toBe(5);
      expect(options.zpSlots).toHaveLength(8);
    });

    it('should allow overriding individual fields', () => {
      const options = resolveOptions({
        level: OptimizationLevel.O3,
        debug: true,
        maxIterations: 10,
      });

      expect(options.level).toBe(OptimizationLevel.O3);
      expect(options.debug).toBe(true);
      expect(options.maxIterations).toBe(10);
      // zpSlots should still come from O3 defaults
      expect(options.zpSlots).toHaveLength(8);
    });

    it('should allow overriding zpSlots', () => {
      const customSlots = [0x60, 0x61];
      const options = resolveOptions({
        level: OptimizationLevel.Os,
        zpSlots: customSlots,
      });

      expect(options.zpSlots).toEqual([0x60, 0x61]);
    });

    it('should return a fresh zpSlots copy (no shared mutation)', () => {
      const customSlots = [0x60, 0x61];
      const options = resolveOptions({
        level: OptimizationLevel.O2,
        zpSlots: customSlots,
      });

      // Should be equal but not same reference
      expect(options.zpSlots).toEqual(customSlots);
      expect(options.zpSlots).not.toBe(customSlots);
    });

    it('should produce fresh zpSlots from defaults when not overridden', () => {
      const opts1 = resolveOptions({ level: OptimizationLevel.O3 });
      const opts2 = resolveOptions({ level: OptimizationLevel.O3 });

      expect(opts1.zpSlots).toEqual(opts2.zpSlots);
      expect(opts1.zpSlots).not.toBe(opts2.zpSlots);
    });

    it('should fill all required fields', () => {
      const options = resolveOptions({ level: OptimizationLevel.O1 });

      // All fields should be defined
      expect(options.level).toBeDefined();
      expect(options.debug).toBeDefined();
      expect(options.zpSlots).toBeDefined();
      expect(options.maxIterations).toBeDefined();
    });
  });

  // ========================================================================
  // isOptimizationEnabled
  // ========================================================================

  describe('isOptimizationEnabled', () => {
    it('should return false for O0', () => {
      expect(isOptimizationEnabled(OptimizationLevel.O0)).toBe(false);
    });

    it('should return true for O1', () => {
      expect(isOptimizationEnabled(OptimizationLevel.O1)).toBe(true);
    });

    it('should return true for O2', () => {
      expect(isOptimizationEnabled(OptimizationLevel.O2)).toBe(true);
    });

    it('should return true for O3', () => {
      expect(isOptimizationEnabled(OptimizationLevel.O3)).toBe(true);
    });

    it('should return true for Os', () => {
      expect(isOptimizationEnabled(OptimizationLevel.Os)).toBe(true);
    });

    it('should return true for Oz', () => {
      expect(isOptimizationEnabled(OptimizationLevel.Oz)).toBe(true);
    });
  });

  // ========================================================================
  // getAllLevels
  // ========================================================================

  describe('getAllLevels', () => {
    it('should return all 10 levels', () => {
      const levels = getAllLevels();
      expect(levels).toHaveLength(10);
    });

    it('should return levels in order', () => {
      const levels = getAllLevels();
      expect(levels).toEqual([
        OptimizationLevel.O0,
        OptimizationLevel.O1, OptimizationLevel.O1s, OptimizationLevel.O1z,
        OptimizationLevel.O2, OptimizationLevel.Os, OptimizationLevel.Oz,
        OptimizationLevel.O3, OptimizationLevel.O3s, OptimizationLevel.O3z,
      ]);
    });

    it('should return a fresh array each call', () => {
      const levels1 = getAllLevels();
      const levels2 = getAllLevels();
      expect(levels1).toEqual(levels2);
      expect(levels1).not.toBe(levels2);
    });
  });
});
