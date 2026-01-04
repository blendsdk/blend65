/**
 * Smart Pattern Engine Tests
 * Tests for the smart modular architecture pattern engine
 */

import { describe, it, expect } from 'vitest';
import { createOptimizationEngine } from '../pattern-engine';
import { TargetPlatform } from '../pattern-types';
import type { BinaryExpr } from '@blend65/ast';

describe('OptimizationPatternEngine', () => {
  describe('Basic functionality', () => {
    it('should create engine successfully', () => {
      const engine = createOptimizationEngine();
      expect(engine).toBeDefined();
    });

    it('should return stats', () => {
      const engine = createOptimizationEngine();
      const stats = engine.getOptimizationStats();

      expect(stats).toBeDefined();
      expect(stats.engineEnabled).toBe(true);
      expect(stats.registryStats).toBeDefined();
      expect(stats.patternMetrics).toBeDefined();
    });

    it('should enable/disable optimization', () => {
      const engine = createOptimizationEngine();

      engine.setEnabled(false);
      let stats = engine.getOptimizationStats();
      expect(stats.engineEnabled).toBe(false);

      engine.setEnabled(true);
      stats = engine.getOptimizationStats();
      expect(stats.engineEnabled).toBe(true);
    });
  });

  describe('Pattern optimization', () => {
    it('should handle optimization when disabled', () => {
      const engine = createOptimizationEngine();
      engine.setEnabled(false);

      // Create a simple binary expression
      const testNode: BinaryExpr = {
        type: 'BinaryExpr',
        operator: '*',
        left: {
          type: 'Identifier',
          name: 'x',
        },
        right: {
          type: 'Literal',
          value: 4,
          raw: '4',
        },
      };

      const result = engine.optimizeNode(testNode, {
        platform: TargetPlatform.C64,
        optimizationLevel: 'standard',
        enableUnsafe: false,
      });

      expect(result.success).toBe(true);
      expect(result.patternsApplied).toHaveLength(0);
      expect(result.originalNode).toBe(testNode);
      expect(result.optimizedNode).toBe(testNode);
    });

    it('should attempt optimization when enabled', () => {
      const engine = createOptimizationEngine();
      engine.setEnabled(true);

      // Create a simple binary expression
      const testNode: BinaryExpr = {
        type: 'BinaryExpr',
        operator: '*',
        left: {
          type: 'Identifier',
          name: 'x',
        },
        right: {
          type: 'Literal',
          value: 4,
          raw: '4',
        },
      };

      const result = engine.optimizeNode(testNode, {
        platform: TargetPlatform.C64,
        optimizationLevel: 'standard',
        enableUnsafe: false,
      });

      expect(result.success).toBe(true);
      expect(result.originalNode).toBe(testNode);
      expect(result.optimizedNode).toBeDefined();
      expect(result.totalOptimizationTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory management', () => {
    it('should reset successfully', () => {
      const engine = createOptimizationEngine();

      // Reset should not throw
      expect(() => engine.reset()).not.toThrow();

      const stats = engine.getOptimizationStats();
      expect(stats.patternMetrics.totalPatterns).toBe(0);
    });
  });
});
