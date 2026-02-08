/**
 * ASM-IL Optimizer Types Tests
 *
 * Tests for type helper functions: createEmptyTransformStats,
 * createUnchangedPassResult, createEmptyPassStatistics, accumulatePassStats.
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyTransformStats,
  createUnchangedPassResult,
  createEmptyPassStatistics,
  accumulatePassStats,
  DEFAULT_ASM_OPTIMIZER_CONFIG,
} from '../../../../codegen/asm-il/optimizer/types.js';
import type {
  AsmPassTransformStats,
  AsmOptimizationPassResult,
  AsmPassStatistics,
} from '../../../../codegen/asm-il/optimizer/types.js';
import { createAsmILProgram } from '../../../../codegen/asm-il/types.js';

describe('ASM-IL Optimizer Types', () => {
  // ========================================================================
  // DEFAULT_ASM_OPTIMIZER_CONFIG
  // ========================================================================

  describe('DEFAULT_ASM_OPTIMIZER_CONFIG', () => {
    it('should have optimization disabled by default', () => {
      expect(DEFAULT_ASM_OPTIMIZER_CONFIG.enabled).toBe(false);
    });

    it('should have empty passes array', () => {
      expect(DEFAULT_ASM_OPTIMIZER_CONFIG.passes).toEqual([]);
    });

    it('should default to 1 iteration', () => {
      expect(DEFAULT_ASM_OPTIMIZER_CONFIG.maxIterations).toBe(1);
    });

    it('should have debug disabled by default', () => {
      expect(DEFAULT_ASM_OPTIMIZER_CONFIG.debug).toBe(false);
    });
  });

  // ========================================================================
  // createEmptyTransformStats
  // ========================================================================

  describe('createEmptyTransformStats', () => {
    it('should return stats with all zeros', () => {
      const stats = createEmptyTransformStats();

      expect(stats.patternsMatched).toBe(0);
      expect(stats.instructionsRemoved).toBe(0);
      expect(stats.instructionsAdded).toBe(0);
      expect(stats.estimatedCyclesSaved).toBe(0);
      expect(stats.estimatedBytesSaved).toBe(0);
    });

    it('should not include debugInfo by default', () => {
      const stats = createEmptyTransformStats();
      expect(stats.debugInfo).toBeUndefined();
    });

    it('should return a fresh object each time', () => {
      const stats1 = createEmptyTransformStats();
      const stats2 = createEmptyTransformStats();
      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  // ========================================================================
  // createUnchangedPassResult
  // ========================================================================

  describe('createUnchangedPassResult', () => {
    it('should return the same program reference', () => {
      const program = createAsmILProgram('test');
      const result = createUnchangedPassResult(program);

      // Same reference — critical for fixed-point convergence detection
      expect(result.program).toBe(program);
    });

    it('should mark changed as false', () => {
      const program = createAsmILProgram('test');
      const result = createUnchangedPassResult(program);
      expect(result.changed).toBe(false);
    });

    it('should include empty transform stats', () => {
      const program = createAsmILProgram('test');
      const result = createUnchangedPassResult(program);

      expect(result.stats.patternsMatched).toBe(0);
      expect(result.stats.instructionsRemoved).toBe(0);
      expect(result.stats.instructionsAdded).toBe(0);
      expect(result.stats.estimatedCyclesSaved).toBe(0);
      expect(result.stats.estimatedBytesSaved).toBe(0);
    });
  });

  // ========================================================================
  // createEmptyPassStatistics
  // ========================================================================

  describe('createEmptyPassStatistics', () => {
    it('should use the provided name', () => {
      const stats = createEmptyPassStatistics('flag-patterns');
      expect(stats.name).toBe('flag-patterns');
    });

    it('should initialize all counters to zero', () => {
      const stats = createEmptyPassStatistics('test-pass');

      expect(stats.transformationRounds).toBe(0);
      expect(stats.totalPatternsMatched).toBe(0);
      expect(stats.totalInstructionsRemoved).toBe(0);
      expect(stats.totalInstructionsAdded).toBe(0);
      expect(stats.totalCyclesSaved).toBe(0);
      expect(stats.totalBytesSaved).toBe(0);
      expect(stats.timeMs).toBe(0);
    });

    it('should return a fresh object each time', () => {
      const stats1 = createEmptyPassStatistics('pass-a');
      const stats2 = createEmptyPassStatistics('pass-a');
      expect(stats1).not.toBe(stats2);
    });
  });

  // ========================================================================
  // accumulatePassStats
  // ========================================================================

  describe('accumulatePassStats', () => {
    /**
     * Helper to create a pass result with specific stats.
     */
    function makePassResult(
      changed: boolean,
      stats: Partial<AsmPassTransformStats> = {}
    ): AsmOptimizationPassResult {
      return {
        program: createAsmILProgram('test'),
        changed,
        stats: {
          patternsMatched: stats.patternsMatched ?? 0,
          instructionsRemoved: stats.instructionsRemoved ?? 0,
          instructionsAdded: stats.instructionsAdded ?? 0,
          estimatedCyclesSaved: stats.estimatedCyclesSaved ?? 0,
          estimatedBytesSaved: stats.estimatedBytesSaved ?? 0,
          debugInfo: stats.debugInfo,
        },
      };
    }

    it('should increment transformationRounds when pass changed', () => {
      const aggregate = createEmptyPassStatistics('test');
      const result = makePassResult(true, { patternsMatched: 2 });

      accumulatePassStats(aggregate, result, 1.5);

      expect(aggregate.transformationRounds).toBe(1);
    });

    it('should NOT increment transformationRounds when pass unchanged', () => {
      const aggregate = createEmptyPassStatistics('test');
      const result = makePassResult(false);

      accumulatePassStats(aggregate, result, 1.0);

      expect(aggregate.transformationRounds).toBe(0);
    });

    it('should accumulate patterns matched', () => {
      const aggregate = createEmptyPassStatistics('test');

      accumulatePassStats(aggregate, makePassResult(true, { patternsMatched: 3 }), 1);
      accumulatePassStats(aggregate, makePassResult(true, { patternsMatched: 5 }), 1);

      expect(aggregate.totalPatternsMatched).toBe(8);
    });

    it('should accumulate instructions removed', () => {
      const aggregate = createEmptyPassStatistics('test');

      accumulatePassStats(aggregate, makePassResult(true, { instructionsRemoved: 2 }), 1);
      accumulatePassStats(aggregate, makePassResult(true, { instructionsRemoved: 4 }), 1);

      expect(aggregate.totalInstructionsRemoved).toBe(6);
    });

    it('should accumulate instructions added', () => {
      const aggregate = createEmptyPassStatistics('test');

      accumulatePassStats(aggregate, makePassResult(true, { instructionsAdded: 1 }), 1);
      accumulatePassStats(aggregate, makePassResult(true, { instructionsAdded: 3 }), 1);

      expect(aggregate.totalInstructionsAdded).toBe(4);
    });

    it('should accumulate cycles and bytes saved', () => {
      const aggregate = createEmptyPassStatistics('test');

      accumulatePassStats(
        aggregate,
        makePassResult(true, { estimatedCyclesSaved: 10, estimatedBytesSaved: 5 }),
        1
      );
      accumulatePassStats(
        aggregate,
        makePassResult(true, { estimatedCyclesSaved: 20, estimatedBytesSaved: 8 }),
        1
      );

      expect(aggregate.totalCyclesSaved).toBe(30);
      expect(aggregate.totalBytesSaved).toBe(13);
    });

    it('should accumulate time in milliseconds', () => {
      const aggregate = createEmptyPassStatistics('test');

      accumulatePassStats(aggregate, makePassResult(false), 2.5);
      accumulatePassStats(aggregate, makePassResult(false), 3.7);

      expect(aggregate.timeMs).toBeCloseTo(6.2, 5);
    });

    it('should handle mixed changed/unchanged results', () => {
      const aggregate = createEmptyPassStatistics('mixed');

      // Round 1: changed
      accumulatePassStats(
        aggregate,
        makePassResult(true, { patternsMatched: 2, instructionsRemoved: 1 }),
        1.0
      );
      // Round 2: unchanged
      accumulatePassStats(
        aggregate,
        makePassResult(false, { patternsMatched: 0 }),
        0.5
      );
      // Round 3: changed
      accumulatePassStats(
        aggregate,
        makePassResult(true, { patternsMatched: 1, instructionsRemoved: 3 }),
        2.0
      );

      expect(aggregate.transformationRounds).toBe(2);
      expect(aggregate.totalPatternsMatched).toBe(3);
      expect(aggregate.totalInstructionsRemoved).toBe(4);
      expect(aggregate.timeMs).toBeCloseTo(3.5, 5);
    });
  });
});
