/**
 * Optimization Metrics System - Core Interface
 * Task 1.11: Core Optimization Pattern Infrastructure (Emergency Fix)
 *
 * This file provides a simplified metrics interface to fix build issues.
 * The comprehensive metrics system will be rebuilt using smart modular architecture.
 *
 * Educational Focus:
 * - Basic performance measurement for optimization patterns
 * - Foundation for comprehensive metrics system
 * - Clean separation of concerns for future expansion
 */

// ============================================================================
// BASIC METRICS TYPES
// ============================================================================

/**
 * Basic pattern performance metrics.
 */
export interface PatternPerformanceMetrics {
  /** Pattern identifier */
  patternId: string;

  /** Execution time in milliseconds */
  executionTime: number;

  /** Memory usage in bytes */
  memoryUsage: number;

  /** Success/failure status */
  success: boolean;

  /** Performance improvement percentage */
  improvementPercentage: number;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Basic metrics collection result.
 */
export interface MetricsCollectionResult {
  /** Collection success status */
  success: boolean;

  /** Number of metrics collected */
  metricsCount: number;

  /** Collection errors, if any */
  errors?: string[];
}

/**
 * Basic metrics configuration.
 */
export interface MetricsConfiguration {
  /** Enable/disable metrics collection */
  enabled: boolean;

  /** Collection interval in milliseconds */
  collectionInterval: number;

  /** Maximum number of stored metrics */
  maxStoredMetrics: number;
}

// ============================================================================
// SIMPLIFIED METRICS COLLECTOR INTERFACE
// ============================================================================

/**
 * Simplified optimization metrics collector.
 *
 * This is a temporary simplified version to fix build issues.
 * The full comprehensive metrics system will be implemented
 * using smart modular architecture.
 */
export interface OptimizationMetricsCollector {
  /** Metrics collector configuration */
  readonly config: MetricsConfiguration;

  /**
   * Record pattern performance metrics.
   */
  recordPatternMetrics(metrics: PatternPerformanceMetrics): MetricsCollectionResult;

  /**
   * Get all collected metrics.
   */
  getAllMetrics(): PatternPerformanceMetrics[];

  /**
   * Get metrics for a specific pattern.
   */
  getPatternMetrics(patternId: string): PatternPerformanceMetrics[];

  /**
   * Clear all collected metrics.
   */
  clearMetrics(): void;

  /**
   * Get basic performance summary.
   */
  getPerformanceSummary(): {
    totalPatterns: number;
    averageExecutionTime: number;
    successRate: number;
    totalImprovements: number;
  };
}

/**
 * Simple metrics collector implementation.
 */
export class SimpleMetricsCollector implements OptimizationMetricsCollector {
  private metrics: PatternPerformanceMetrics[] = [];

  constructor(public readonly config: MetricsConfiguration) {}

  recordPatternMetrics(metrics: PatternPerformanceMetrics): MetricsCollectionResult {
    if (!this.config.enabled) {
      return { success: true, metricsCount: 0 };
    }

    this.metrics.push(metrics);

    // Enforce storage limit
    if (this.metrics.length > this.config.maxStoredMetrics) {
      this.metrics = this.metrics.slice(-this.config.maxStoredMetrics);
    }

    return { success: true, metricsCount: 1 };
  }

  getAllMetrics(): PatternPerformanceMetrics[] {
    return [...this.metrics];
  }

  getPatternMetrics(patternId: string): PatternPerformanceMetrics[] {
    return this.metrics.filter(m => m.patternId === patternId);
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  getPerformanceSummary() {
    const successfulMetrics = this.metrics.filter(m => m.success);

    return {
      totalPatterns: new Set(this.metrics.map(m => m.patternId)).size,
      averageExecutionTime:
        successfulMetrics.length > 0
          ? successfulMetrics.reduce((sum, m) => sum + m.executionTime, 0) /
            successfulMetrics.length
          : 0,
      successRate:
        this.metrics.length > 0 ? (successfulMetrics.length / this.metrics.length) * 100 : 0,
      totalImprovements: successfulMetrics.reduce((sum, m) => sum + m.improvementPercentage, 0),
    };
  }
}

/**
 * Create a default metrics collector.
 */
export function createMetricsCollector(
  config?: Partial<MetricsConfiguration>
): OptimizationMetricsCollector {
  const defaultConfig: MetricsConfiguration = {
    enabled: true,
    collectionInterval: 100,
    maxStoredMetrics: 1000,
  };

  return new SimpleMetricsCollector({ ...defaultConfig, ...config });
}

// ============================================================================
// FUTURE COMPREHENSIVE SYSTEM PLACEHOLDER
// ============================================================================

/**
 * TODO: Comprehensive Metrics System Implementation
 *
 * The full metrics system will include:
 *
 * 1. Smart Modular Architecture:
 *    - Small, focused type files (50-300 lines each)
 *    - Lazy loading of metrics modules
 *    - Memory-efficient pattern loading
 *
 * 2. Comprehensive Analytics:
 *    - Real-time trend analysis
 *    - Performance predictions
 *    - Optimization recommendations
 *    - Professional reporting
 *
 * 3. Advanced Features:
 *    - Benchmark comparisons
 *    - Cross-pattern analysis
 *    - Platform-specific metrics
 *    - Export capabilities
 *
 * This will be implemented using the smart modular approach
 * designed to avoid the large file and export conflict issues.
 */
