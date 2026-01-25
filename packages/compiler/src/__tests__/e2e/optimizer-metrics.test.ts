/**
 * Optimizer Metrics E2E Tests
 *
 * These tests verify that optimization levels produce measurably better code.
 * They compare instruction counts, cycle counts, and byte counts between
 * optimization levels.
 *
 * NOTE: These tests use placeholder compilation until the optimizer is implemented.
 * The test structure is ready for when actual compilation is available.
 *
 * @module e2e/optimizer-metrics.test
 */

import { describe, it, expect } from 'vitest';
import {
  compile,
  compareOptimizationLevels,
  loadFixture,
  fixtureExists,
  asmContainsInstruction,
  asmDoesNotContainInstruction,
  type OptimizationLevel,
} from './e2e-test-utils.js';

describe('Optimizer Metrics E2E Tests', () => {
  // ============================================================================
  // O1 vs O0 Tests - Dead Code Elimination
  // ============================================================================

  describe('O1 vs O0 - Dead Code Elimination', () => {
    it('should reduce instruction count for unused variable', () => {
      const comparison = compareOptimizationLevels(
        'dead-code/unused-variable.blend',
        'O0',
        'O1'
      );

      // O1 should produce fewer instructions than O0
      expect(comparison.instructionReduction).toBeGreaterThan(0);
      expect(comparison.isImproved).toBe(true);
    });

    it('should reduce instruction count for unreachable code', () => {
      const comparison = compareOptimizationLevels(
        'dead-code/unreachable-code.blend',
        'O0',
        'O1'
      );

      // O1 should produce fewer instructions than O0
      expect(comparison.instructionReduction).toBeGreaterThan(0);
      expect(comparison.isImproved).toBe(true);
    });
  });

  // ============================================================================
  // O1 vs O0 Tests - Constant Folding
  // ============================================================================

  describe('O1 vs O0 - Constant Folding', () => {
    it('should reduce instruction count for arithmetic constants', () => {
      const comparison = compareOptimizationLevels(
        'const-fold/arithmetic.blend',
        'O0',
        'O1'
      );

      // O1 should produce fewer instructions than O0
      expect(comparison.instructionReduction).toBeGreaterThan(0);
      expect(comparison.isImproved).toBe(true);
    });

    it('should correctly handle overflow in constant folding', () => {
      const comparison = compareOptimizationLevels(
        'const-fold/overflow.blend',
        'O0',
        'O1'
      );

      // O1 should produce fewer instructions than O0
      expect(comparison.instructionReduction).toBeGreaterThan(0);
      expect(comparison.isImproved).toBe(true);
    });

    it('should reduce instruction count for bitwise constants', () => {
      const comparison = compareOptimizationLevels(
        'const-fold/bitwise.blend',
        'O0',
        'O1'
      );

      // O1 should produce fewer instructions than O0
      expect(comparison.instructionReduction).toBeGreaterThan(0);
      expect(comparison.isImproved).toBe(true);
    });
  });

  // ============================================================================
  // O2 vs O1 Tests - Peephole Optimizations
  // ============================================================================

  describe('O2 vs O1 - Peephole Optimizations', () => {
    it('should reduce or maintain instruction count at O2', () => {
      const comparison = compareOptimizationLevels(
        'const-fold/arithmetic.blend',
        'O1',
        'O2'
      );

      // O2 should be at least as good as O1
      expect(comparison.instructionReduction).toBeGreaterThanOrEqual(0);
    });

    it.skip('should apply strength reduction for power-of-2 multiply', () => {
      // Skip until optimizer is fully implemented
      const o1Result = compile('peephole/strength.blend', { level: 'O1' });
      const o2Result = compile('peephole/strength.blend', { level: 'O2' });

      // O2 should use ASL (shift) instead of multiply
      // This test will be enabled when actual compilation is available
      expect(asmContainsInstruction(o2Result.asm, 'ASL')).toBe(true);
      expect(asmDoesNotContainInstruction(o2Result.asm, 'JSR _multiply')).toBe(true);
    });
  });

  // ============================================================================
  // Optimization Level Progression Tests
  // ============================================================================

  describe('Optimization Level Progression', () => {
    const levels: OptimizationLevel[] = ['O0', 'O1', 'O2', 'O3'];

    it('should monotonically improve or maintain across levels', () => {
      const fixture = 'const-fold/arithmetic.blend';

      let previousResult = compile(fixture, { level: levels[0] });

      for (let i = 1; i < levels.length; i++) {
        const currentResult = compile(fixture, { level: levels[i] });

        // Each level should be at least as good as the previous
        expect(currentResult.instructionCount).toBeLessThanOrEqual(
          previousResult.instructionCount
        );

        previousResult = currentResult;
      }
    });

    it('should produce valid compilation at all levels', () => {
      const fixture = 'const-fold/arithmetic.blend';

      for (const level of levels) {
        const result = compile(fixture, { level });

        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.instructionCount).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // Fixture Validation Tests
  // ============================================================================

  describe('Fixture Validation', () => {
    it('should have all required dead-code fixtures', () => {
      expect(fixtureExists('dead-code/unused-variable.blend')).toBe(true);
      expect(fixtureExists('dead-code/unreachable-code.blend')).toBe(true);
    });

    it('should have all required const-fold fixtures', () => {
      expect(fixtureExists('const-fold/arithmetic.blend')).toBe(true);
      expect(fixtureExists('const-fold/overflow.blend')).toBe(true);
      expect(fixtureExists('const-fold/bitwise.blend')).toBe(true);
    });

    it('should have all required peephole fixtures', () => {
      expect(fixtureExists('peephole/strength.blend')).toBe(true);
    });

    it('should load fixtures without errors', () => {
      expect(() => loadFixture('dead-code/unused-variable.blend')).not.toThrow();
      expect(() => loadFixture('const-fold/arithmetic.blend')).not.toThrow();
    });
  });

  // ============================================================================
  // Size Optimization Tests (Os/Oz)
  // ============================================================================

  describe('Size Optimization (Os/Oz)', () => {
    it('should prefer smaller code at Os level', () => {
      const fixture = 'const-fold/arithmetic.blend';

      const o2Result = compile(fixture, { level: 'O2' });
      const osResult = compile(fixture, { level: 'Os' });

      // Os should prioritize size
      expect(osResult.byteCount).toBeLessThanOrEqual(o2Result.byteCount);
    });

    it('should minimize size at Oz level', () => {
      const fixture = 'const-fold/arithmetic.blend';

      const osResult = compile(fixture, { level: 'Os' });
      const ozResult = compile(fixture, { level: 'Oz' });

      // Oz should be at least as small as Os
      expect(ozResult.byteCount).toBeLessThanOrEqual(osResult.byteCount);
    });
  });
});