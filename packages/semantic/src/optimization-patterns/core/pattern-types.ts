/**
 * Core Pattern Types - Foundation Types for Optimization Patterns
 * Smart Modular Architecture - Core types only (under 300 lines)
 *
 * This file contains only the essential core types for the pattern system.
 * Other specialized types are in separate focused files.
 */

import type { ASTNode } from '@blend65/ast';

// ============================================================================
// CORE PATTERN SYSTEM TYPES
// ============================================================================

/**
 * Pattern categories for organization.
 */
export enum PatternCategory {
  MATHEMATICS = 'mathematics',
  HARDWARE = 'hardware',
  CONTROL_FLOW = 'control_flow',
  MEMORY = 'memory',
  BASIC = 'basic',
}

/**
 * Target platforms for optimization.
 */
export enum TargetPlatform {
  C64 = 'c64',
  C128 = 'c128',
  VIC20 = 'vic20',
  APPLE_II = 'apple_ii',
  GENERIC_6502 = 'generic_6502',
}

/**
 * Pattern priority levels.
 */
export enum PatternPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Core optimization pattern interface.
 */
export interface OptimizationPattern {
  /** Unique pattern identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Pattern category */
  category: PatternCategory;

  /** Pattern description */
  description: string;

  /** Pattern priority */
  priority: PatternPriority;

  /** Target platforms */
  platforms: TargetPlatform[];

  /** Pattern matcher function */
  matches: (node: ASTNode) => PatternMatch | null;

  /** Pattern transformer function */
  transform: (match: PatternMatch) => TransformationResult;

  /** Expected performance improvement */
  expectedImprovement: PerformanceImprovement;
}

/**
 * Pattern match result.
 */
export interface PatternMatch {
  /** Pattern that matched */
  patternId: string;

  /** Matched AST node */
  node: ASTNode;

  /** Match confidence (0-1) */
  confidence: number;

  /** Captured values during matching */
  captures: Map<string, any>;

  /** Location information */
  location: {
    line: number;
    column: number;
    file?: string;
  };
}

/**
 * Pattern transformation result.
 */
export interface TransformationResult {
  /** Success status */
  success: boolean;

  /** Transformed AST node */
  transformedNode?: ASTNode;

  /** Error message if failed */
  error?: string;

  /** Performance metrics */
  metrics: TransformationMetrics;
}

/**
 * Performance improvement data.
 */
export interface PerformanceImprovement {
  /** Expected cycles saved */
  cyclesSaved: number;

  /** Expected bytes saved */
  bytesSaved: number;

  /** Improvement percentage */
  improvementPercentage: number;

  /** Reliability of estimate */
  reliability: 'low' | 'medium' | 'high' | 'guaranteed';
}

/**
 * Transformation metrics.
 */
export interface TransformationMetrics {
  /** Transformation time in ms */
  transformationTime: number;

  /** Memory used during transformation */
  memoryUsed: number;

  /** Success status */
  success: boolean;
}

// ============================================================================
// PATTERN LOADING AND MANAGEMENT
// ============================================================================

/**
 * Pattern loading result.
 */
export interface PatternLoadResult {
  /** Load success status */
  success: boolean;

  /** Number of patterns loaded */
  patternsLoaded: number;

  /** Any loading errors */
  errors?: string[];
}

/**
 * Pattern registry configuration.
 */
export interface PatternRegistryConfig {
  /** Maximum patterns to keep in memory */
  maxActivePatterns: number;

  /** Enable lazy loading */
  lazyLoading: boolean;

  /** Pattern cache size */
  cacheSize: number;

  /** Enable pattern metrics collection */
  enableMetrics: boolean;
}

/**
 * Pattern application context.
 */
export interface PatternApplicationContext {
  /** Target platform */
  platform: TargetPlatform;

  /** Optimization level */
  optimizationLevel: 'basic' | 'standard' | 'aggressive';

  /** Enable unsafe optimizations */
  enableUnsafe: boolean;

  /** Pattern filter function */
  patternFilter?: (pattern: OptimizationPattern) => boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Simple pattern matcher interface.
 */
export interface PatternMatcher {
  matches(node: ASTNode): boolean;
  confidence(): number;
}

/**
 * Simple pattern transformer interface.
 */
export interface PatternTransformer {
  transform(node: ASTNode): ASTNode | null;
}

/**
 * Pattern validation result.
 */
export interface PatternValidationResult {
  valid: boolean;
  issues: string[];
}
