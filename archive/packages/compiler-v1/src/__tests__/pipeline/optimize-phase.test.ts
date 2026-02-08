/**
 * Tests for OptimizePhase
 *
 * Verifies that the OptimizePhase correctly wraps
 * the optimizer for different optimization levels.
 *
 * @module tests/pipeline/optimize-phase
 */

import { describe, it, expect } from 'vitest';

import { OptimizePhase } from '../../pipeline/optimize-phase.js';
import { ILModule } from '../../il/module.js';
import { OptimizationLevel } from '../../optimizer/options.js';

describe('OptimizePhase', () => {
  const phase = new OptimizePhase();

  /**
   * Creates a minimal IL module for testing
   *
   * @param name - Module name
   * @returns Empty ILModule
   */
  function createTestModule(name = 'test'): ILModule {
    return new ILModule(name);
  }

  describe('execute() - basic optimization', () => {
    it('should optimize with O0 level', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.O0);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.module).toBeDefined();
    });

    it('should return optimized module', () => {
      const module = createTestModule('myModule');

      const result = phase.execute(module, OptimizationLevel.O0);

      expect(result.data.module).toBeInstanceOf(ILModule);
    });

    it('should have no diagnostics for empty module', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.O0);

      expect(result.diagnostics).toHaveLength(0);
    });

    it('should track execution time', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.O0);

      expect(result.timeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.timeMs).toBe('number');
    });
  });

  describe('execute() - optimization levels', () => {
    it('should accept O0 level', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.O0);

      expect(result.success).toBe(true);
    });

    it('should accept O1 level', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.O1);

      expect(result.success).toBe(true);
    });

    it('should accept O2 level', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.O2);

      expect(result.success).toBe(true);
    });

    it('should accept O3 level', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.O3);

      expect(result.success).toBe(true);
    });

    it('should accept Os level', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.Os);

      expect(result.success).toBe(true);
    });

    it('should accept Oz level', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.Oz);

      expect(result.success).toBe(true);
    });
  });

  describe('executeWithLevel() - string parsing', () => {
    it('should parse O0 string', () => {
      const module = createTestModule();

      const result = phase.executeWithLevel(module, 'O0');

      expect(result.success).toBe(true);
    });

    it('should parse O1 string', () => {
      const module = createTestModule();

      const result = phase.executeWithLevel(module, 'O1');

      expect(result.success).toBe(true);
    });

    it('should parse O2 string', () => {
      const module = createTestModule();

      const result = phase.executeWithLevel(module, 'O2');

      expect(result.success).toBe(true);
    });

    it('should parse O3 string', () => {
      const module = createTestModule();

      const result = phase.executeWithLevel(module, 'O3');

      expect(result.success).toBe(true);
    });

    it('should parse Os string', () => {
      const module = createTestModule();

      const result = phase.executeWithLevel(module, 'Os');

      expect(result.success).toBe(true);
    });

    it('should parse Oz string', () => {
      const module = createTestModule();

      const result = phase.executeWithLevel(module, 'Oz');

      expect(result.success).toBe(true);
    });

    it('should default to O0 for unknown strings', () => {
      const module = createTestModule();

      const result = phase.executeWithLevel(module, 'unknown');

      // Should not fail, defaults to O0
      expect(result.success).toBe(true);
    });

    it('should default to O0 for empty string', () => {
      const module = createTestModule();

      const result = phase.executeWithLevel(module, '');

      expect(result.success).toBe(true);
    });

    it('should default to O0 for undefined', () => {
      const module = createTestModule();

      // Cast to bypass TypeScript - testing edge case
      const result = phase.executeWithLevel(module, undefined as unknown as string);

      expect(result.success).toBe(true);
    });
  });

  describe('execute() - result structure', () => {
    it('should return OptimizationResult', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.O0);

      expect(result.data).toBeDefined();
      expect(result.data.module).toBeDefined();
    });

    it('should preserve module name', () => {
      const module = createTestModule('preservedName');

      const result = phase.execute(module, OptimizationLevel.O0);

      expect(result.data.module.name).toBe('preservedName');
    });
  });

  describe('execute() - timing', () => {
    it('should have fast execution for empty module', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.O0);

      // Should be fast for empty module
      expect(result.timeMs).toBeLessThan(1000);
    });

    it('should track time consistently', () => {
      const module = createTestModule();

      const result1 = phase.execute(module, OptimizationLevel.O0);
      const result2 = phase.execute(module, OptimizationLevel.O0);

      // Both should have timing
      expect(result1.timeMs).toBeGreaterThanOrEqual(0);
      expect(result2.timeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('execute() - success status', () => {
    it('should always succeed for O0', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.O0);

      expect(result.success).toBe(true);
    });

    it('should always succeed for valid modules', () => {
      const module = createTestModule();

      // Test all levels
      const levels = [
        OptimizationLevel.O0,
        OptimizationLevel.O1,
        OptimizationLevel.O2,
        OptimizationLevel.O3,
        OptimizationLevel.Os,
        OptimizationLevel.Oz,
      ];

      for (const level of levels) {
        const result = phase.execute(module, level);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('execute() - diagnostics', () => {
    it('should have empty diagnostics for valid optimization', () => {
      const module = createTestModule();

      const result = phase.execute(module, OptimizationLevel.O0);

      // Current optimizer doesn't produce diagnostics
      expect(result.diagnostics).toEqual([]);
    });
  });
});