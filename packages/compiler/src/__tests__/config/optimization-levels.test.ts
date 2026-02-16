/**
 * Tests for Optimization Level Helpers
 *
 * Tests for normalizeOptimizationLevel, isSizeLevel, isMinSizeLevel,
 * getBaseLevel, and ALL_OPTIMIZATION_LEVELS.
 *
 * @module __tests__/config/optimization-levels.test
 */

import { describe, it, expect } from 'vitest';
import {
  ALL_OPTIMIZATION_LEVELS,
  normalizeOptimizationLevel,
  isSizeLevel,
  isMinSizeLevel,
  getBaseLevel,
  type OptimizationLevelId,
} from '../../config/types.js';

// ============================================================================
// ALL_OPTIMIZATION_LEVELS
// ============================================================================

describe('ALL_OPTIMIZATION_LEVELS', () => {
  it('should contain exactly 10 levels', () => {
    expect(ALL_OPTIMIZATION_LEVELS).toHaveLength(10);
  });

  it('should contain all base levels', () => {
    expect(ALL_OPTIMIZATION_LEVELS).toContain('O0');
    expect(ALL_OPTIMIZATION_LEVELS).toContain('O1');
    expect(ALL_OPTIMIZATION_LEVELS).toContain('O2');
    expect(ALL_OPTIMIZATION_LEVELS).toContain('O3');
  });

  it('should contain all size levels', () => {
    expect(ALL_OPTIMIZATION_LEVELS).toContain('Os');
    expect(ALL_OPTIMIZATION_LEVELS).toContain('Oz');
  });

  it('should contain all composite levels', () => {
    expect(ALL_OPTIMIZATION_LEVELS).toContain('O1s');
    expect(ALL_OPTIMIZATION_LEVELS).toContain('O1z');
    expect(ALL_OPTIMIZATION_LEVELS).toContain('O3s');
    expect(ALL_OPTIMIZATION_LEVELS).toContain('O3z');
  });

  it('should be readonly (frozen)', () => {
    // Attempting to push should throw in strict mode or be silently ignored
    expect(() => {
      (ALL_OPTIMIZATION_LEVELS as string[]).push('O4');
    }).toThrow();
  });
});

// ============================================================================
// normalizeOptimizationLevel
// ============================================================================

describe('normalizeOptimizationLevel', () => {
  describe('valid canonical levels', () => {
    it.each([
      'O0', 'O1', 'O1s', 'O1z', 'O2', 'Os', 'Oz', 'O3', 'O3s', 'O3z',
    ] as const)('should accept %s as-is', (level) => {
      expect(normalizeOptimizationLevel(level)).toBe(level);
    });
  });

  describe('aliases', () => {
    it('should normalize O2s to Os', () => {
      expect(normalizeOptimizationLevel('O2s')).toBe('Os');
    });

    it('should normalize O2z to Oz', () => {
      expect(normalizeOptimizationLevel('O2z')).toBe('Oz');
    });
  });

  describe('invalid combinations', () => {
    it('should reject O0s with helpful message', () => {
      expect(() => normalizeOptimizationLevel('O0s')).toThrow(
        /Invalid optimization level 'O0s'/
      );
      expect(() => normalizeOptimizationLevel('O0s')).toThrow(
        /size optimization requires at least O1/
      );
    });

    it('should reject O0z with helpful message', () => {
      expect(() => normalizeOptimizationLevel('O0z')).toThrow(
        /Invalid optimization level 'O0z'/
      );
      expect(() => normalizeOptimizationLevel('O0z')).toThrow(
        /size optimization requires at least O1/
      );
    });
  });

  describe('unknown levels', () => {
    it('should reject unknown levels', () => {
      expect(() => normalizeOptimizationLevel('O4')).toThrow(
        /Unknown optimization level 'O4'/
      );
    });

    it('should reject empty string', () => {
      expect(() => normalizeOptimizationLevel('')).toThrow(
        /Unknown optimization level/
      );
    });

    it('should reject random strings', () => {
      expect(() => normalizeOptimizationLevel('fast')).toThrow(
        /Unknown optimization level 'fast'/
      );
    });

    it('should include valid levels in error message', () => {
      expect(() => normalizeOptimizationLevel('O4')).toThrow(
        /Valid levels: O0, O1, O1s, O1z, O2, Os, Oz, O3, O3s, O3z/
      );
    });
  });
});

// ============================================================================
// isSizeLevel
// ============================================================================

describe('isSizeLevel', () => {
  describe('non-size levels', () => {
    it.each(['O0', 'O1', 'O2', 'O3'] as OptimizationLevelId[])(
      'should return false for %s',
      (level) => {
        expect(isSizeLevel(level)).toBe(false);
      }
    );
  });

  describe('size levels', () => {
    it.each(['Os', 'Oz', 'O1s', 'O1z', 'O3s', 'O3z'] as OptimizationLevelId[])(
      'should return true for %s',
      (level) => {
        expect(isSizeLevel(level)).toBe(true);
      }
    );
  });
});

// ============================================================================
// isMinSizeLevel
// ============================================================================

describe('isMinSizeLevel', () => {
  describe('non-min-size levels', () => {
    it.each(['O0', 'O1', 'O1s', 'O2', 'Os', 'O3', 'O3s'] as OptimizationLevelId[])(
      'should return false for %s',
      (level) => {
        expect(isMinSizeLevel(level)).toBe(false);
      }
    );
  });

  describe('min-size levels (z suffix)', () => {
    it.each(['Oz', 'O1z', 'O3z'] as OptimizationLevelId[])(
      'should return true for %s',
      (level) => {
        expect(isMinSizeLevel(level)).toBe(true);
      }
    );
  });
});

// ============================================================================
// getBaseLevel
// ============================================================================

describe('getBaseLevel', () => {
  it('should return O0 for O0', () => {
    expect(getBaseLevel('O0')).toBe('O0');
  });

  it('should return O1 for O1 family', () => {
    expect(getBaseLevel('O1')).toBe('O1');
    expect(getBaseLevel('O1s')).toBe('O1');
    expect(getBaseLevel('O1z')).toBe('O1');
  });

  it('should return O2 for O2 family (including Os/Oz aliases)', () => {
    expect(getBaseLevel('O2')).toBe('O2');
    expect(getBaseLevel('Os')).toBe('O2');
    expect(getBaseLevel('Oz')).toBe('O2');
  });

  it('should return O3 for O3 family', () => {
    expect(getBaseLevel('O3')).toBe('O3');
    expect(getBaseLevel('O3s')).toBe('O3');
    expect(getBaseLevel('O3z')).toBe('O3');
  });

  it('should return one of O0, O1, O2, O3 for every level', () => {
    const validBases = ['O0', 'O1', 'O2', 'O3'];
    for (const level of ALL_OPTIMIZATION_LEVELS) {
      expect(validBases).toContain(getBaseLevel(level));
    }
  });
});
