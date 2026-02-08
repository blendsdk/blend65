/**
 * ASM-IL Optimizer (Pass Manager) Tests
 *
 * Tests for the AsmOptimizer class: pass execution, fixed-point iteration,
 * statistics tracking, fluent API, and edge cases.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AsmOptimizer,
  createAsmOptimizer,
} from '../../../../codegen/asm-il/optimizer/asm-optimizer.js';
import { PassThroughPass } from '../../../../codegen/asm-il/optimizer/pass-through.js';
import type {
  AsmOptimizationPass,
  AsmOptimizationPassResult,
} from '../../../../codegen/asm-il/optimizer/types.js';
import { createUnchangedPassResult } from '../../../../codegen/asm-il/optimizer/types.js';
import type { AsmILProgram } from '../../../../codegen/asm-il/types.js';
import { createAsmILProgram } from '../../../../codegen/asm-il/types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock pass that reports changes a specified number of times,
 * then stops. Useful for testing fixed-point iteration.
 */
function createCountingPass(
  name: string,
  changeCount: number
): AsmOptimizationPass {
  let callCount = 0;

  return {
    name,
    isTransform: true,
    run(program: AsmILProgram): AsmOptimizationPassResult {
      callCount++;
      const shouldChange = callCount <= changeCount;

      if (shouldChange) {
        // Return a NEW program object to signal change
        return {
          program: { ...program, moduleName: `${program.moduleName}_opt${callCount}` },
          changed: true,
          stats: {
            patternsMatched: 1,
            instructionsRemoved: 1,
            instructionsAdded: 0,
            estimatedCyclesSaved: 2,
            estimatedBytesSaved: 1,
          },
        };
      }

      // Return unchanged result
      return createUnchangedPassResult(program);
    },
  };
}

/**
 * Creates a pass that always changes the program.
 * Used to test iteration limit enforcement.
 */
function createAlwaysChangingPass(name: string): AsmOptimizationPass {
  let callCount = 0;

  return {
    name,
    isTransform: true,
    run(program: AsmILProgram): AsmOptimizationPassResult {
      callCount++;
      return {
        program: { ...program, moduleName: `${program.moduleName}_v${callCount}` },
        changed: true,
        stats: {
          patternsMatched: 1,
          instructionsRemoved: 0,
          instructionsAdded: 0,
          estimatedCyclesSaved: 0,
          estimatedBytesSaved: 0,
        },
      };
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('AsmOptimizer', () => {
  // ========================================================================
  // Construction
  // ========================================================================

  describe('construction', () => {
    it('should create with default config', () => {
      const optimizer = new AsmOptimizer();
      expect(optimizer.isEnabled()).toBe(false);
      expect(optimizer.getPasses()).toEqual([]);
      expect(optimizer.getMaxIterations()).toBe(1);
      expect(optimizer.isDebugEnabled()).toBe(false);
    });

    it('should create with partial config', () => {
      const optimizer = new AsmOptimizer({ enabled: true, maxIterations: 3 });
      expect(optimizer.isEnabled()).toBe(true);
      expect(optimizer.getMaxIterations()).toBe(3);
      expect(optimizer.getPasses()).toEqual([]);
    });

    it('should create with passes', () => {
      const pass = new PassThroughPass();
      const optimizer = new AsmOptimizer({
        enabled: true,
        passes: [pass],
      });
      expect(optimizer.getPasses()).toHaveLength(1);
      expect(optimizer.getPasses()[0]).toBe(pass);
    });
  });

  // ========================================================================
  // Factory Function
  // ========================================================================

  describe('createAsmOptimizer', () => {
    it('should create optimizer with no args', () => {
      const optimizer = createAsmOptimizer();
      expect(optimizer).toBeInstanceOf(AsmOptimizer);
      expect(optimizer.isEnabled()).toBe(false);
    });

    it('should create optimizer with config', () => {
      const optimizer = createAsmOptimizer({ enabled: true });
      expect(optimizer.isEnabled()).toBe(true);
    });
  });

  // ========================================================================
  // Pass-Through Behavior
  // ========================================================================

  describe('pass-through', () => {
    it('should return input unchanged when disabled', () => {
      const optimizer = createAsmOptimizer({ enabled: false });
      const program = createAsmILProgram('test');
      const result = optimizer.optimize(program);

      expect(result.program).toBe(program);
      expect(result.changed).toBe(false);
      expect(result.iterations).toBe(0);
      expect(result.passStats.size).toBe(0);
    });

    it('should return input unchanged when no passes configured', () => {
      const optimizer = createAsmOptimizer({ enabled: true, passes: [] });
      const program = createAsmILProgram('test');
      const result = optimizer.optimize(program);

      expect(result.program).toBe(program);
      expect(result.changed).toBe(false);
      expect(result.iterations).toBe(0);
    });
  });

  // ========================================================================
  // Single Pass Execution
  // ========================================================================

  describe('single pass execution', () => {
    it('should run a single pass that makes no changes', () => {
      const pass = new PassThroughPass();
      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [pass],
        maxIterations: 1,
      });
      const program = createAsmILProgram('test');
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(false);
      expect(result.iterations).toBe(1);
      expect(result.passStats.has('pass-through')).toBe(true);
    });

    it('should run a pass that makes changes', () => {
      const pass = createCountingPass('test-pass', 1);
      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [pass],
        maxIterations: 1,
      });
      const program = createAsmILProgram('test');
      const result = optimizer.optimize(program);

      expect(result.changed).toBe(true);
      expect(result.iterations).toBe(1);
      expect(result.program.moduleName).toBe('test_opt1');
    });

    it('should track pass statistics', () => {
      const pass = createCountingPass('counted-pass', 1);
      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [pass],
        maxIterations: 1,
      });
      const result = optimizer.optimize(createAsmILProgram('test'));

      const stats = result.passStats.get('counted-pass');
      expect(stats).toBeDefined();
      expect(stats!.name).toBe('counted-pass');
      expect(stats!.transformationRounds).toBe(1);
      expect(stats!.totalPatternsMatched).toBe(1);
      expect(stats!.totalInstructionsRemoved).toBe(1);
      expect(stats!.timeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // Multiple Pass Execution
  // ========================================================================

  describe('multiple passes', () => {
    it('should run passes in order', () => {
      const order: string[] = [];

      const passA: AsmOptimizationPass = {
        name: 'pass-a',
        isTransform: true,
        run(program) {
          order.push('a');
          return createUnchangedPassResult(program);
        },
      };
      const passB: AsmOptimizationPass = {
        name: 'pass-b',
        isTransform: true,
        run(program) {
          order.push('b');
          return createUnchangedPassResult(program);
        },
      };

      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [passA, passB],
      });
      optimizer.optimize(createAsmILProgram('test'));

      expect(order).toEqual(['a', 'b']);
    });

    it('should track stats for each pass independently', () => {
      const passA = createCountingPass('pass-a', 1);
      const passB = new PassThroughPass();

      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [passA, passB],
        maxIterations: 1,
      });
      const result = optimizer.optimize(createAsmILProgram('test'));

      expect(result.passStats.has('pass-a')).toBe(true);
      expect(result.passStats.has('pass-through')).toBe(true);
      expect(result.passStats.get('pass-a')!.transformationRounds).toBe(1);
      expect(result.passStats.get('pass-through')!.transformationRounds).toBe(0);
    });
  });

  // ========================================================================
  // Fixed-Point Iteration
  // ========================================================================

  describe('fixed-point iteration', () => {
    it('should stop after one iteration when no changes', () => {
      const pass = new PassThroughPass();
      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [pass],
        maxIterations: 5,
      });
      const result = optimizer.optimize(createAsmILProgram('test'));

      // Only 1 iteration because no changes were made
      expect(result.iterations).toBe(1);
      expect(result.changed).toBe(false);
    });

    it('should iterate when changes occur and stop at fixed-point', () => {
      // Pass makes changes for 2 rounds, then stops
      const pass = createCountingPass('converging-pass', 2);
      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [pass],
        maxIterations: 5,
      });
      const result = optimizer.optimize(createAsmILProgram('test'));

      // Should do 3 iterations: change, change, no-change (fixed-point)
      expect(result.iterations).toBe(3);
      expect(result.changed).toBe(true);
    });

    it('should respect maxIterations limit', () => {
      const pass = createAlwaysChangingPass('infinite-pass');
      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [pass],
        maxIterations: 3,
      });
      const result = optimizer.optimize(createAsmILProgram('test'));

      // Should stop at exactly 3 iterations
      expect(result.iterations).toBe(3);
      expect(result.changed).toBe(true);
    });

    it('should accumulate stats across iterations', () => {
      const pass = createCountingPass('multi-round', 3);
      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [pass],
        maxIterations: 5,
      });
      const result = optimizer.optimize(createAsmILProgram('test'));

      const stats = result.passStats.get('multi-round')!;
      // 3 rounds changed, 1 unchanged (fixed-point), total 4 iterations
      expect(stats.transformationRounds).toBe(3);
      expect(stats.totalPatternsMatched).toBe(3);
      expect(stats.totalInstructionsRemoved).toBe(3);
    });

    it('should propagate changes between passes across iterations', () => {
      // PassA changes once, PassB changes once
      // After 1 iteration: both changed → iterate again
      // After 2nd iteration: neither changes → fixed-point
      const passA = createCountingPass('pass-a', 1);
      const passB = createCountingPass('pass-b', 1);

      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [passA, passB],
        maxIterations: 5,
      });
      const result = optimizer.optimize(createAsmILProgram('test'));

      // Iteration 1: A changes, B changes → iterate
      // Iteration 2: A doesn't change, B doesn't change → fixed-point
      expect(result.iterations).toBe(2);
      expect(result.changed).toBe(true);
    });
  });

  // ========================================================================
  // Fluent API
  // ========================================================================

  describe('fluent API', () => {
    it('should support addPass chaining', () => {
      const optimizer = createAsmOptimizer()
        .addPass(new PassThroughPass());

      expect(optimizer.getPasses()).toHaveLength(1);
    });

    it('should support setEnabled chaining', () => {
      const optimizer = createAsmOptimizer()
        .setEnabled(true)
        .addPass(new PassThroughPass());

      expect(optimizer.isEnabled()).toBe(true);
      expect(optimizer.getPasses()).toHaveLength(1);
    });

    it('should support setMaxIterations chaining', () => {
      const optimizer = createAsmOptimizer()
        .setMaxIterations(5)
        .setEnabled(true);

      expect(optimizer.getMaxIterations()).toBe(5);
      expect(optimizer.isEnabled()).toBe(true);
    });

    it('should support setDebug chaining', () => {
      const optimizer = createAsmOptimizer()
        .setDebug(true);

      expect(optimizer.isDebugEnabled()).toBe(true);
    });

    it('should support removePass by name', () => {
      const pass = new PassThroughPass();
      const optimizer = createAsmOptimizer({ passes: [pass] });

      expect(optimizer.getPasses()).toHaveLength(1);
      optimizer.removePass('pass-through');
      expect(optimizer.getPasses()).toHaveLength(0);
    });

    it('should handle removePass for non-existent pass gracefully', () => {
      const optimizer = createAsmOptimizer();
      optimizer.removePass('non-existent'); // Should not throw
      expect(optimizer.getPasses()).toHaveLength(0);
    });
  });

  // ========================================================================
  // Debug Logging
  // ========================================================================

  describe('debug logging', () => {
    it('should log when debug is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [new PassThroughPass()],
        debug: true,
      });
      optimizer.optimize(createAsmILProgram('test'));

      expect(consoleSpy).toHaveBeenCalled();
      // Should include optimizer prefix
      const calls = consoleSpy.mock.calls.map((c) => c[0]);
      expect(calls.some((msg) => msg.includes('[AsmILOptimizer]'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should NOT log when debug is disabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [new PassThroughPass()],
        debug: false,
      });
      optimizer.optimize(createAsmILProgram('test'));

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('edge cases', () => {
    it('should handle maxIterations of 1 correctly', () => {
      const pass = createCountingPass('one-shot', 10);
      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [pass],
        maxIterations: 1,
      });
      const result = optimizer.optimize(createAsmILProgram('test'));

      // Only 1 iteration allowed
      expect(result.iterations).toBe(1);
      expect(result.changed).toBe(true);
    });

    it('should handle program with no sections', () => {
      const optimizer = createAsmOptimizer({
        enabled: true,
        passes: [new PassThroughPass()],
      });
      const program = createAsmILProgram('empty');
      const result = optimizer.optimize(program);

      expect(result.program).toBe(program);
      expect(result.changed).toBe(false);
    });
  });
});
