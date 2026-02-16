/**
 * Tests for Optimization Options
 *
 * @module __tests__/optimizer/options.test
 */

import { describe, it, expect } from 'vitest';
import {
  getDefaultOptions,
  getPassesForLevel,
  shouldIterate,
  isSizeOptimization,
  getIterationCount,
  resolveEnabledPasses,
  type OptimizationLevel,
  type OptimizationOptions,
} from '../../optimizer/options.js';

// ============================================================================
// getDefaultOptions Tests
// ============================================================================

describe('getDefaultOptions', () => {
  it('should return O2 as default level', () => {
    const options = getDefaultOptions();
    expect(options.level).toBe('O2');
  });

  it('should have debug disabled by default', () => {
    const options = getDefaultOptions();
    expect(options.debug).toBe(false);
  });

  it('should have maxIterations set to 10', () => {
    const options = getDefaultOptions();
    expect(options.maxIterations).toBe(10);
  });

  it('should not have enabledPasses by default', () => {
    const options = getDefaultOptions();
    expect(options.enabledPasses).toBeUndefined();
  });

  it('should not have disabledPasses by default', () => {
    const options = getDefaultOptions();
    expect(options.disabledPasses).toBeUndefined();
  });
});

// ============================================================================
// getPassesForLevel Tests
// ============================================================================

describe('getPassesForLevel', () => {
  it('should return empty array for O0', () => {
    const passes = getPassesForLevel('O0');
    expect(passes).toEqual([]);
  });

  it('should return basic passes for O1', () => {
    const passes = getPassesForLevel('O1');
    expect(passes).toContain('dce');
    expect(passes).toContain('constant-fold');
    expect(passes).toContain('il-peephole');
    expect(passes).toHaveLength(3);
  });

  it('should return all passes for O2', () => {
    const passes = getPassesForLevel('O2');
    expect(passes).toContain('dce');
    expect(passes).toContain('constant-fold');
    expect(passes).toContain('constant-prop');
    expect(passes).toContain('copy-prop');
    expect(passes).toContain('il-peephole');
    expect(passes).toContain('cse');
    expect(passes).toContain('licm');
    expect(passes).toContain('loop-unroll');
    expect(passes).toHaveLength(8);
  });

  it('should return all passes for O3', () => {
    const passes = getPassesForLevel('O3');
    expect(passes).toContain('dce');
    expect(passes).toContain('constant-fold');
    expect(passes).toContain('constant-prop');
    expect(passes).toContain('copy-prop');
    expect(passes).toContain('il-peephole');
    expect(passes).toContain('cse');
    expect(passes).toContain('licm');
    expect(passes).toContain('loop-unroll');
    expect(passes).toHaveLength(8);
  });

  it('should return all passes for Os', () => {
    const passes = getPassesForLevel('Os');
    expect(passes).toContain('dce');
    expect(passes).toContain('constant-fold');
    expect(passes).toContain('constant-prop');
    expect(passes).toContain('copy-prop');
    expect(passes).toContain('il-peephole');
    expect(passes).toContain('cse');
    expect(passes).toHaveLength(7);
  });

  it('should return all passes for Oz', () => {
    const passes = getPassesForLevel('Oz');
    expect(passes).toContain('dce');
    expect(passes).toContain('constant-fold');
    expect(passes).toContain('constant-prop');
    expect(passes).toContain('copy-prop');
    expect(passes).toContain('il-peephole');
    expect(passes).toContain('cse');
    expect(passes).toHaveLength(7);
  });

  it('should return basic passes for O1s (same as O1)', () => {
    const passes = getPassesForLevel('O1s');
    expect(passes).toContain('dce');
    expect(passes).toContain('constant-fold');
    expect(passes).toContain('il-peephole');
    expect(passes).toHaveLength(3);
  });

  it('should return basic passes for O1z (same as O1)', () => {
    const passes = getPassesForLevel('O1z');
    expect(passes).toContain('dce');
    expect(passes).toContain('constant-fold');
    expect(passes).toContain('il-peephole');
    expect(passes).toHaveLength(3);
  });

  it('should return O3-level passes minus loop-unroll for O3s', () => {
    const passes = getPassesForLevel('O3s');
    expect(passes).toContain('dce');
    expect(passes).toContain('constant-fold');
    expect(passes).toContain('constant-prop');
    expect(passes).toContain('copy-prop');
    expect(passes).toContain('il-peephole');
    expect(passes).toContain('cse');
    expect(passes).toContain('licm');
    expect(passes).not.toContain('loop-unroll');
    expect(passes).toHaveLength(7);
  });

  it('should return O3-level passes minus loop-unroll for O3z', () => {
    const passes = getPassesForLevel('O3z');
    expect(passes).toContain('dce');
    expect(passes).toContain('constant-fold');
    expect(passes).toContain('constant-prop');
    expect(passes).toContain('copy-prop');
    expect(passes).toContain('il-peephole');
    expect(passes).toContain('cse');
    expect(passes).toContain('licm');
    expect(passes).not.toContain('loop-unroll');
    expect(passes).toHaveLength(7);
  });

  it('should return a copy (not original array)', () => {
    const passes1 = getPassesForLevel('O2');
    const passes2 = getPassesForLevel('O2');
    expect(passes1).not.toBe(passes2);
    expect(passes1).toEqual(passes2);
  });
});

// ============================================================================
// shouldIterate Tests
// ============================================================================

describe('shouldIterate', () => {
  it('should return false for O0', () => {
    expect(shouldIterate('O0')).toBe(false);
  });

  it('should return false for O1', () => {
    expect(shouldIterate('O1')).toBe(false);
  });

  it('should return false for O2', () => {
    expect(shouldIterate('O2')).toBe(false);
  });

  it('should return true for O3', () => {
    expect(shouldIterate('O3')).toBe(true);
  });

  it('should return false for Os', () => {
    expect(shouldIterate('Os')).toBe(false);
  });

  it('should return true for Oz', () => {
    expect(shouldIterate('Oz')).toBe(true);
  });

  it('should return false for O1s', () => {
    expect(shouldIterate('O1s')).toBe(false);
  });

  it('should return true for O1z (z = multi-iteration)', () => {
    expect(shouldIterate('O1z')).toBe(true);
  });

  it('should return false for O3s', () => {
    expect(shouldIterate('O3s')).toBe(false);
  });

  it('should return true for O3z (z = multi-iteration)', () => {
    expect(shouldIterate('O3z')).toBe(true);
  });
});

// ============================================================================
// isSizeOptimization Tests
// ============================================================================

describe('isSizeOptimization', () => {
  it('should return false for O0', () => {
    expect(isSizeOptimization('O0')).toBe(false);
  });

  it('should return false for O1', () => {
    expect(isSizeOptimization('O1')).toBe(false);
  });

  it('should return false for O2', () => {
    expect(isSizeOptimization('O2')).toBe(false);
  });

  it('should return false for O3', () => {
    expect(isSizeOptimization('O3')).toBe(false);
  });

  it('should return true for Os', () => {
    expect(isSizeOptimization('Os')).toBe(true);
  });

  it('should return true for Oz', () => {
    expect(isSizeOptimization('Oz')).toBe(true);
  });
});

// ============================================================================
// getIterationCount Tests
// ============================================================================

describe('getIterationCount', () => {
  it('should return 1 for O0', () => {
    expect(getIterationCount({ level: 'O0' })).toBe(1);
  });

  it('should return 1 for O1', () => {
    expect(getIterationCount({ level: 'O1' })).toBe(1);
  });

  it('should return 1 for O2', () => {
    expect(getIterationCount({ level: 'O2' })).toBe(1);
  });

  it('should return maxIterations for O3', () => {
    expect(getIterationCount({ level: 'O3', maxIterations: 5 })).toBe(5);
  });

  it('should return 10 (default) for O3 without maxIterations', () => {
    expect(getIterationCount({ level: 'O3' })).toBe(10);
  });

  it('should return 1 for Os', () => {
    expect(getIterationCount({ level: 'Os' })).toBe(1);
  });

  it('should return maxIterations for Oz', () => {
    expect(getIterationCount({ level: 'Oz', maxIterations: 3 })).toBe(3);
  });

  it('should return 10 (default) for Oz without maxIterations', () => {
    expect(getIterationCount({ level: 'Oz' })).toBe(10);
  });
});

// ============================================================================
// resolveEnabledPasses Tests
// ============================================================================

describe('resolveEnabledPasses', () => {
  it('should return level defaults when no overrides', () => {
    const passes = resolveEnabledPasses({ level: 'O2' });
    expect(passes).toEqual(getPassesForLevel('O2'));
  });

  it('should use enabledPasses when provided', () => {
    const passes = resolveEnabledPasses({
      level: 'O2',
      enabledPasses: ['dce', 'constant-fold'],
    });
    expect(passes).toEqual(['dce', 'constant-fold']);
  });

  it('should filter out disabledPasses from level defaults', () => {
    const passes = resolveEnabledPasses({
      level: 'O2',
      disabledPasses: ['copy-prop'],
    });
    expect(passes).toContain('dce');
    expect(passes).toContain('constant-fold');
    expect(passes).toContain('constant-prop');
    expect(passes).toContain('il-peephole');
    expect(passes).not.toContain('copy-prop');
  });

  it('should filter out disabledPasses from enabledPasses', () => {
    const passes = resolveEnabledPasses({
      level: 'O2',
      enabledPasses: ['dce', 'constant-fold', 'copy-prop'],
      disabledPasses: ['copy-prop'],
    });
    expect(passes).toEqual(['dce', 'constant-fold']);
  });

  it('should return empty array for O0', () => {
    const passes = resolveEnabledPasses({ level: 'O0' });
    expect(passes).toEqual([]);
  });

  it('should handle empty disabledPasses array', () => {
    const passes = resolveEnabledPasses({
      level: 'O1',
      disabledPasses: [],
    });
    expect(passes).toEqual(getPassesForLevel('O1'));
  });

  it('should handle disabling all passes', () => {
    const passes = resolveEnabledPasses({
      level: 'O1',
      disabledPasses: ['dce', 'constant-fold', 'il-peephole'],
    });
    expect(passes).toEqual([]);
  });
});

// ============================================================================
// Type Tests
// ============================================================================

describe('OptimizationLevel type', () => {
  it('should accept all 10 valid levels', () => {
    const levels: OptimizationLevel[] = ['O0', 'O1', 'O1s', 'O1z', 'O2', 'Os', 'Oz', 'O3', 'O3s', 'O3z'];
    expect(levels).toHaveLength(10);
  });
});

describe('OptimizationOptions interface', () => {
  it('should accept minimal options', () => {
    const options: OptimizationOptions = { level: 'O2' };
    expect(options.level).toBe('O2');
  });

  it('should accept full options', () => {
    const options: OptimizationOptions = {
      level: 'O3',
      enabledPasses: ['dce'],
      disabledPasses: ['copy-prop'],
      debug: true,
      maxIterations: 5,
    };
    expect(options.level).toBe('O3');
    expect(options.enabledPasses).toEqual(['dce']);
    expect(options.disabledPasses).toEqual(['copy-prop']);
    expect(options.debug).toBe(true);
    expect(options.maxIterations).toBe(5);
  });
});