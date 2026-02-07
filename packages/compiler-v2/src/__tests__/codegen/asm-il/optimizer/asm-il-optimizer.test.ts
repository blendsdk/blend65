/**
 * ASM-IL Optimizer (Level-Based) Tests
 *
 * Tests for the AsmILOptimizer class and createAsmILOptimizer factory.
 * Verifies level-based configuration, pass delegation, options resolution,
 * and the optimize() pass-through behavior for all levels.
 */

import { describe, it, expect } from 'vitest';
import {
  AsmILOptimizer,
  createAsmILOptimizer,
} from '../../../../codegen/asm-il/optimizer/asm-il-optimizer.js';
import {
  OptimizationLevel,
  getAllLevels,
} from '../../../../codegen/asm-il/optimizer/options.js';
import { createAsmILProgram } from '../../../../codegen/asm-il/types.js';

describe('AsmILOptimizer (Level-Based)', () => {
  // ========================================================================
  // Constructor & Defaults
  // ========================================================================

  describe('constructor', () => {
    it('should default to O2 when no options provided', () => {
      const optimizer = new AsmILOptimizer();
      expect(optimizer.getLevel()).toBe(OptimizationLevel.O2);
    });

    it('should accept a specific optimization level', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      expect(optimizer.getLevel()).toBe(OptimizationLevel.O3);
    });

    it('should construct without errors for every level', () => {
      const levels = getAllLevels();
      for (const level of levels) {
        const optimizer = new AsmILOptimizer({ level });
        expect(optimizer.getLevel()).toBe(level);
      }
    });

    it('should merge user overrides with level defaults', () => {
      const optimizer = new AsmILOptimizer({
        level: OptimizationLevel.O3,
        debug: true,
        maxIterations: 10,
      });

      expect(optimizer.isDebugEnabled()).toBe(true);
      expect(optimizer.getMaxIterations()).toBe(10);
      // zpSlots should come from O3 defaults (8 slots)
      expect(optimizer.getZpSlots()).toHaveLength(8);
    });

    it('should allow custom zpSlots override', () => {
      const customSlots = [0x60, 0x61];
      const optimizer = new AsmILOptimizer({
        level: OptimizationLevel.O3,
        zpSlots: customSlots,
      });

      expect(optimizer.getZpSlots()).toEqual([0x60, 0x61]);
    });
  });

  // ========================================================================
  // isEnabled
  // ========================================================================

  describe('isEnabled', () => {
    it('should return false for O0 (no optimization)', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O0 });
      expect(optimizer.isEnabled()).toBe(false);
    });

    it('should return true for all non-O0 levels', () => {
      const enabledLevels = [
        OptimizationLevel.O1,
        OptimizationLevel.O2,
        OptimizationLevel.O3,
        OptimizationLevel.Os,
        OptimizationLevel.Oz,
      ];

      for (const level of enabledLevels) {
        const optimizer = new AsmILOptimizer({ level });
        expect(optimizer.isEnabled()).toBe(true);
      }
    });
  });

  // ========================================================================
  // getOptions
  // ========================================================================

  describe('getOptions', () => {
    it('should return resolved options matching the level', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      const options = optimizer.getOptions();

      expect(options.level).toBe(OptimizationLevel.O3);
      expect(options.maxIterations).toBe(5);
      expect(options.zpSlots).toHaveLength(8);
    });

    it('should return a defensive copy (no external mutation)', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      const opts1 = optimizer.getOptions();
      const opts2 = optimizer.getOptions();

      // Equal values but different objects
      expect(opts1).toEqual(opts2);
      expect(opts1).not.toBe(opts2);
      expect(opts1.zpSlots).not.toBe(opts2.zpSlots);
    });

    it('should not be affected by external mutation of returned copy', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      const options = optimizer.getOptions();

      // Mutate the returned copy
      options.zpSlots.push(0x99);
      options.debug = true;

      // Optimizer's internal options should be unaffected
      const freshOptions = optimizer.getOptions();
      expect(freshOptions.debug).toBe(false);
      expect(freshOptions.zpSlots).not.toContain(0x99);
    });
  });

  // ========================================================================
  // getZpSlots
  // ========================================================================

  describe('getZpSlots', () => {
    it('should return empty array for O0', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O0 });
      expect(optimizer.getZpSlots()).toEqual([]);
    });

    it('should return 8 slots for O3 default', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      const slots = optimizer.getZpSlots();
      expect(slots).toHaveLength(8);
      expect(slots[0]).toBe(0x50);
      expect(slots[7]).toBe(0x57);
    });

    it('should return a defensive copy', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      const slots1 = optimizer.getZpSlots();
      const slots2 = optimizer.getZpSlots();

      expect(slots1).toEqual(slots2);
      expect(slots1).not.toBe(slots2);
    });
  });

  // ========================================================================
  // getPasses
  // ========================================================================

  describe('getPasses', () => {
    it('should return an array for every level', () => {
      const levels = getAllLevels();
      for (const level of levels) {
        const optimizer = new AsmILOptimizer({ level });
        const passes = optimizer.getPasses();
        expect(Array.isArray(passes)).toBe(true);
      }
    });

    it('should return empty passes for O0', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O0 });
      expect(optimizer.getPasses()).toHaveLength(0);
    });

    // FlagPatternsPass is now active for all O1+ levels (Phase 3, Session 3.1)
    it('should return 1 pass for O2 (FlagPatternsPass active)', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O2 });
      const passes = optimizer.getPasses();
      expect(passes).toHaveLength(1);
      expect(passes[0].name).toBe('flag-patterns');
    });
  });

  // ========================================================================
  // getMaxIterations
  // ========================================================================

  describe('getMaxIterations', () => {
    it('should return 1 for O0', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O0 });
      expect(optimizer.getMaxIterations()).toBe(1);
    });

    it('should return 1 for O1', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O1 });
      expect(optimizer.getMaxIterations()).toBe(1);
    });

    it('should return 5 for O3', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O3 });
      expect(optimizer.getMaxIterations()).toBe(5);
    });

    it('should return 5 for Oz', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.Oz });
      expect(optimizer.getMaxIterations()).toBe(5);
    });

    it('should respect user override', () => {
      const optimizer = new AsmILOptimizer({
        level: OptimizationLevel.O1,
        maxIterations: 7,
      });
      expect(optimizer.getMaxIterations()).toBe(7);
    });
  });

  // ========================================================================
  // optimize
  // ========================================================================

  describe('optimize', () => {
    it('should return pass-through result for O0 level', () => {
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O0 });
      const program = createAsmILProgram('test');

      const result = optimizer.optimize(program);

      expect(result.changed).toBe(false);
      expect(result.iterations).toBe(0);
      expect(result.program).toBe(program); // Same reference
      expect(result.passStats.size).toBe(0);
    });

    it('should return unchanged result for empty program', () => {
      // An empty program (no sections/instructions) has nothing to optimize
      const optimizer = new AsmILOptimizer({ level: OptimizationLevel.O2 });
      const program = createAsmILProgram('test');

      const result = optimizer.optimize(program);

      expect(result.changed).toBe(false);
      expect(result.program).toBe(program);
    });

    it('should return a valid result structure for every level', () => {
      const levels = getAllLevels();
      const program = createAsmILProgram('test');

      for (const level of levels) {
        const optimizer = new AsmILOptimizer({ level });
        const result = optimizer.optimize(program);

        // All results should have the required structure
        expect(result).toHaveProperty('program');
        expect(result).toHaveProperty('changed');
        expect(result).toHaveProperty('iterations');
        expect(result).toHaveProperty('passStats');
        expect(result.passStats instanceof Map).toBe(true);
      }
    });
  });

  // ========================================================================
  // Isolation (multiple instances)
  // ========================================================================

  describe('instance isolation', () => {
    it('should not share state between instances', () => {
      const opt1 = new AsmILOptimizer({ level: OptimizationLevel.O0 });
      const opt2 = new AsmILOptimizer({ level: OptimizationLevel.O3 });

      expect(opt1.getLevel()).toBe(OptimizationLevel.O0);
      expect(opt2.getLevel()).toBe(OptimizationLevel.O3);
      expect(opt1.isEnabled()).toBe(false);
      expect(opt2.isEnabled()).toBe(true);
      expect(opt1.getMaxIterations()).toBe(1);
      expect(opt2.getMaxIterations()).toBe(5);
    });

    it('should not share zpSlots between instances', () => {
      const opt1 = new AsmILOptimizer({
        level: OptimizationLevel.O3,
        zpSlots: [0x50],
      });
      const opt2 = new AsmILOptimizer({
        level: OptimizationLevel.O3,
        zpSlots: [0x60, 0x61],
      });

      expect(opt1.getZpSlots()).toEqual([0x50]);
      expect(opt2.getZpSlots()).toEqual([0x60, 0x61]);
    });
  });

  // ========================================================================
  // createAsmILOptimizer Factory
  // ========================================================================

  describe('createAsmILOptimizer', () => {
    it('should default to O2 when called with no arguments', () => {
      const optimizer = createAsmILOptimizer();
      expect(optimizer.getLevel()).toBe(OptimizationLevel.O2);
    });

    it('should accept a specific level', () => {
      const optimizer = createAsmILOptimizer(OptimizationLevel.O3);
      expect(optimizer.getLevel()).toBe(OptimizationLevel.O3);
    });

    it('should accept level with option overrides', () => {
      const optimizer = createAsmILOptimizer(OptimizationLevel.Os, {
        zpSlots: [0x60, 0x61],
        debug: true,
      });

      expect(optimizer.getLevel()).toBe(OptimizationLevel.Os);
      expect(optimizer.getZpSlots()).toEqual([0x60, 0x61]);
      expect(optimizer.isDebugEnabled()).toBe(true);
    });

    it('should return an AsmILOptimizer instance', () => {
      const optimizer = createAsmILOptimizer();
      expect(optimizer).toBeInstanceOf(AsmILOptimizer);
    });

    it('should create independent instances each call', () => {
      const opt1 = createAsmILOptimizer(OptimizationLevel.O1);
      const opt2 = createAsmILOptimizer(OptimizationLevel.O3);

      expect(opt1).not.toBe(opt2);
      expect(opt1.getLevel()).toBe(OptimizationLevel.O1);
      expect(opt2.getLevel()).toBe(OptimizationLevel.O3);
    });
  });
});
