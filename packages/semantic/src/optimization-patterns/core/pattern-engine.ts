/**
 * Smart Pattern Engine - Core Optimization Engine
 * Smart Modular Architecture - Engine implementation (under 200 lines)
 *
 * This file implements the core pattern engine that:
 * - Integrates with existing semantic analyzer
 * - Applies optimization patterns during analysis
 * - Maintains synchronous compatibility
 * - Provides simple, clean API
 */

import type { ASTNode, Expression } from '@blend65/ast';
import type {
  OptimizationPattern,
  PatternMatch,
  TransformationResult,
  PatternApplicationContext,
} from './pattern-types';
import { PatternCategory, TargetPlatform } from './pattern-types';
import { SmartPatternRegistry, createPatternRegistry } from './pattern-registry';
import { createMetricsCollector, type OptimizationMetricsCollector } from './optimization-metrics';

// ============================================================================
// PATTERN ENGINE
// ============================================================================

/**
 * Core optimization pattern engine.
 */
export class OptimizationPatternEngine {
  private registry: SmartPatternRegistry;
  private metrics: OptimizationMetricsCollector;
  private enabled: boolean = true;

  constructor() {
    this.registry = createPatternRegistry({
      maxActivePatterns: 30, // Conservative memory usage
      lazyLoading: true,
      enableMetrics: true,
    });

    this.metrics = createMetricsCollector({
      enabled: true,
      maxStoredMetrics: 500,
    });
  }

  /**
   * Apply optimization patterns to an AST node.
   */
  optimizeNode(node: ASTNode, context: PatternApplicationContext): OptimizationResult {
    if (!this.enabled) {
      return {
        originalNode: node,
        optimizedNode: node,
        patternsApplied: [],
        totalOptimizationTime: 0,
        success: true,
      };
    }

    const startTime = Date.now();
    const appliedPatterns: AppliedPattern[] = [];
    let currentNode = node;

    try {
      // Load patterns for the target platform
      const relevantPatterns = this.getRelevantPatterns(context);

      // Try to apply each pattern
      for (const pattern of relevantPatterns) {
        const match = pattern.matches(currentNode);

        if (match && match.confidence > 0.5) {
          const transformResult = pattern.transform(match);

          if (transformResult.success && transformResult.transformedNode) {
            // Record successful optimization
            appliedPatterns.push({
              patternId: pattern.id,
              patternName: pattern.name,
              match,
              result: transformResult,
              improvement: pattern.expectedImprovement,
            });

            // Record metrics
            this.metrics.recordPatternMetrics({
              patternId: pattern.id,
              executionTime: transformResult.metrics.transformationTime,
              memoryUsage: transformResult.metrics.memoryUsed,
              success: true,
              improvementPercentage: pattern.expectedImprovement.improvementPercentage,
              timestamp: new Date(),
            });

            // Update current node for next pattern
            currentNode = transformResult.transformedNode;
          }
        }
      }

      const totalTime = Date.now() - startTime;

      return {
        originalNode: node,
        optimizedNode: currentNode,
        patternsApplied: appliedPatterns,
        totalOptimizationTime: totalTime,
        success: true,
      };
    } catch (error) {
      return {
        originalNode: node,
        optimizedNode: currentNode,
        patternsApplied: appliedPatterns,
        totalOptimizationTime: Date.now() - startTime,
        success: false,
        error: `Pattern optimization failed: ${error}`,
      };
    }
  }

  /**
   * Get optimization statistics.
   */
  getOptimizationStats() {
    return {
      patternMetrics: this.metrics.getPerformanceSummary(),
      registryStats: this.registry.getStats(),
      engineEnabled: this.enabled,
    };
  }

  /**
   * Enable/disable the optimization engine.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Clear optimization data.
   */
  reset(): void {
    this.metrics.clearMetrics();
    this.registry.clearPatterns();
  }

  // ========================================================================
  // PRIVATE IMPLEMENTATION
  // ========================================================================

  /**
   * Get patterns relevant to the current context.
   */
  private getRelevantPatterns(context: PatternApplicationContext): OptimizationPattern[] {
    const patterns: OptimizationPattern[] = [];

    // Load basic patterns first (always useful)
    patterns.push(...this.registry.getPatternsByCategory(PatternCategory.BASIC));

    // Load patterns based on optimization level
    if (context.optimizationLevel === 'standard' || context.optimizationLevel === 'aggressive') {
      patterns.push(...this.registry.getPatternsByCategory(PatternCategory.MATHEMATICS));
    }

    if (context.optimizationLevel === 'aggressive') {
      patterns.push(...this.registry.getPatternsByCategory(PatternCategory.HARDWARE));
      patterns.push(...this.registry.getPatternsByCategory(PatternCategory.CONTROL_FLOW));
    }

    // Filter by platform
    const platformPatterns = patterns.filter(
      pattern =>
        pattern.platforms.includes(context.platform) ||
        pattern.platforms.includes(TargetPlatform.GENERIC_6502)
    );

    // Apply user filter if provided
    if (context.patternFilter) {
      return platformPatterns.filter(context.patternFilter);
    }

    return platformPatterns;
  }
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Optimization result.
 */
export interface OptimizationResult {
  originalNode: ASTNode;
  optimizedNode: ASTNode;
  patternsApplied: AppliedPattern[];
  totalOptimizationTime: number;
  success: boolean;
  error?: string;
}

/**
 * Applied pattern information.
 */
export interface AppliedPattern {
  patternId: string;
  patternName: string;
  match: PatternMatch;
  result: TransformationResult;
  improvement: any; // PerformanceImprovement type
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a default optimization engine.
 */
export function createOptimizationEngine(): OptimizationPatternEngine {
  return new OptimizationPatternEngine();
}

/**
 * Quick optimize function for simple use cases.
 */
export function optimizeExpression(
  expression: Expression,
  platform: TargetPlatform = TargetPlatform.C64
): OptimizationResult {
  const engine = createOptimizationEngine();
  return engine.optimizeNode(expression, {
    platform,
    optimizationLevel: 'standard',
    enableUnsafe: false,
  });
}
