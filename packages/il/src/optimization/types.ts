/**
 * @fileoverview IL Optimization Framework Types
 *
 * Defines types for the IL optimization system that intelligently applies
 * 470+ optimization patterns using analytics intelligence.
 */

import { ILFunction, ILProgram, ILInstruction } from '../il-types.js';
import { ComprehensiveAnalyticsResult } from '../analysis/il-analytics-suite.js';
import { PatternReadinessAnalysisResult } from '../analysis/pattern-readiness-analyzer.js';

/**
 * Optimization pass levels following GCC-style conventions
 */
export enum OptimizationLevel {
  /** No optimization */
  O0 = 'O0',
  /** Basic optimization - dead code elimination, constant folding */
  O1 = 'O1',
  /** Standard optimization - includes O1 + function inlining, loop optimization */
  O2 = 'O2',
  /** Aggressive optimization - includes O2 + 6502-specific patterns, size optimization */
  O3 = 'O3',
  /** Size optimization - prioritize code size over speed */
  Os = 'Os',
  /** Debug optimization - minimal optimization for debugging */
  Og = 'Og',
}

/**
 * Optimization pattern categories matching the 470+ pattern system
 */
export enum OptimizationCategory {
  /** Dead code elimination, unreachable code removal */
  DEAD_CODE = 'dead_code',
  /** Constant folding, constant propagation */
  CONSTANTS = 'constants',
  /** Function inlining, tail call optimization */
  FUNCTIONS = 'functions',
  /** Loop unrolling, loop invariant code motion */
  LOOPS = 'loops',
  /** Register allocation, register coalescing */
  REGISTERS = 'registers',
  /** Zero page optimization, memory layout */
  MEMORY = 'memory',
  /** 6502-specific peephole optimizations */
  PEEPHOLE = 'peephole',
  /** Control flow optimization, branch elimination */
  CONTROL_FLOW = 'control_flow',
  /** Arithmetic optimization, strength reduction */
  ARITHMETIC = 'arithmetic',
  /** Hardware-specific optimizations (VIC-II, SID, CIA) */
  HARDWARE = 'hardware',
  /** Size optimization patterns */
  SIZE = 'size',
  /** Speed optimization patterns */
  SPEED = 'speed',
}

/**
 * Priority levels for optimization pattern application
 */
export enum OptimizationPriority {
  /** Critical optimizations that must be applied */
  CRITICAL = 'critical',
  /** High priority optimizations with significant impact */
  HIGH = 'high',
  /** Medium priority optimizations with moderate impact */
  MEDIUM = 'medium',
  /** Low priority optimizations with minimal impact */
  LOW = 'low',
  /** Optional optimizations that may or may not help */
  OPTIONAL = 'optional',
}

/**
 * Optimization transformation safety levels
 */
export enum OptimizationSafety {
  /** Always safe to apply */
  SAFE = 'safe',
  /** Safe with conditions - requires validation */
  CONDITIONAL = 'conditional',
  /** Potentially unsafe - careful analysis required */
  RISKY = 'risky',
  /** Unsafe - may break semantics */
  UNSAFE = 'unsafe',
}

/**
 * Individual optimization pattern descriptor
 */
export interface OptimizationPattern {
  /** Unique pattern identifier */
  id: string;
  /** Human-readable pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** Pattern category */
  category: OptimizationCategory;
  /** Pattern priority level */
  priority: OptimizationPriority;
  /** Safety level of this pattern */
  safety: OptimizationSafety;
  /** Required optimization level */
  minLevel: OptimizationLevel;
  /** Target 6502 variants (null = all variants) */
  targetVariants?: string[];
  /** Estimated performance impact (cycles saved per application) */
  estimatedCyclesSaved: number;
  /** Estimated size impact (bytes saved/added per application) */
  estimatedSizeImpact: number;
  /** Pattern dependencies - other patterns that must be applied first */
  dependencies: string[];
  /** Pattern conflicts - patterns that cannot be applied together */
  conflicts: string[];
  /** Pattern application function */
  apply: (instructions: ILInstruction[], context: OptimizationContext) => OptimizationResult;
  /** Pattern applicability test */
  isApplicable: (instructions: ILInstruction[], context: OptimizationContext) => boolean;
}

/**
 * Context information for optimization pattern application
 */
export interface OptimizationContext {
  /** Current function being optimized */
  currentFunction: ILFunction;
  /** Full program context */
  program: ILProgram;
  /** Analytics results for intelligent decisions */
  analytics: ComprehensiveAnalyticsResult;
  /** Pattern applicability analysis */
  patternAnalysis: PatternReadinessAnalysisResult;
  /** Current optimization level */
  optimizationLevel: OptimizationLevel;
  /** Target 6502 variant */
  targetVariant: string;
  /** Optimization configuration */
  config: OptimizationConfig;
  /** Previously applied patterns (for conflict detection) */
  appliedPatterns: Set<string>;
  /** Performance metrics from previous optimizations */
  performanceMetrics: OptimizationMetrics;
}

/**
 * Configuration for optimization process
 */
export interface OptimizationConfig {
  /** Target optimization level */
  level: OptimizationLevel;
  /** Target 6502 processor variant */
  targetVariant: string;
  /** Maximum optimization passes */
  maxPasses: number;
  /** Maximum time allowed for optimization (ms) */
  timeLimit: number;
  /** Enable/disable specific categories */
  enabledCategories: Set<OptimizationCategory>;
  /** Disabled patterns by ID */
  disabledPatterns: Set<string>;
  /** Prioritize size vs speed (0.0 = size, 1.0 = speed) */
  sizeSpeedTradeoff: number;
  /** Enable experimental patterns */
  enableExperimental: boolean;
  /** Debugging options */
  debug: {
    /** Log optimization decisions */
    logDecisions: boolean;
    /** Generate optimization reports */
    generateReports: boolean;
    /** Validate optimization correctness */
    validateCorrectness: boolean;
  };
}

/**
 * Result of applying an optimization pattern
 */
export interface OptimizationResult {
  /** Whether the optimization was successful */
  success: boolean;
  /** Optimized instructions (if successful) */
  instructions?: ILInstruction[];
  /** Performance metrics change */
  metricsChange: OptimizationMetricsChange;
  /** Applied pattern information */
  appliedPattern?: {
    /** Pattern ID */
    id: string;
    /** Pattern name */
    name: string;
    /** Number of applications */
    applications: number;
  };
  /** Error information (if failed) */
  error?: OptimizationError;
  /** Warnings generated during optimization */
  warnings: OptimizationWarning[];
  /** Debug information */
  debug?: OptimizationDebugInfo;
}

/**
 * Change in performance metrics after optimization
 */
export interface OptimizationMetricsChange {
  /** Change in cycle count (negative = improvement) */
  cyclesDelta: number;
  /** Change in code size (negative = smaller) */
  sizeDelta: number;
  /** Change in memory usage (negative = less memory) */
  memoryDelta: number;
  /** Change in register pressure (negative = less pressure) */
  registerPressureDelta: number;
  /** Change in complexity score (negative = simpler) */
  complexityDelta: number;
}

/**
 * Cumulative optimization metrics
 */
export interface OptimizationMetrics {
  /** Total cycles saved */
  totalCyclesSaved: number;
  /** Total size change */
  totalSizeChange: number;
  /** Total memory saved */
  totalMemorySaved: number;
  /** Number of patterns applied */
  patternsApplied: number;
  /** Optimization passes completed */
  passesCompleted: number;
  /** Time spent optimizing (ms) */
  optimizationTime: number;
  /** Performance grade (A-F) */
  performanceGrade: string;
  /** Optimization effectiveness (0-100) */
  effectiveness: number;
}

/**
 * Optimization error information
 */
export interface OptimizationError {
  /** Error type */
  type: OptimizationErrorType;
  /** Error message */
  message: string;
  /** Pattern that caused the error */
  patternId?: string;
  /** Source location information */
  location?: {
    /** Function name */
    function: string;
    /** Instruction index */
    instruction?: number;
  };
  /** Error severity */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Types of optimization errors
 */
export enum OptimizationErrorType {
  /** Pattern application failed */
  PATTERN_APPLICATION_FAILED = 'pattern_application_failed',
  /** Pattern conflicts detected */
  PATTERN_CONFLICT = 'pattern_conflict',
  /** Invalid optimization configuration */
  INVALID_CONFIG = 'invalid_config',
  /** Optimization time limit exceeded */
  TIME_LIMIT_EXCEEDED = 'time_limit_exceeded',
  /** Memory limit exceeded during optimization */
  MEMORY_LIMIT_EXCEEDED = 'memory_limit_exceeded',
  /** Semantic correctness validation failed */
  CORRECTNESS_VALIDATION_FAILED = 'correctness_validation_failed',
  /** Unknown pattern referenced */
  UNKNOWN_PATTERN = 'unknown_pattern',
  /** Circular pattern dependency */
  CIRCULAR_DEPENDENCY = 'circular_dependency',
}

/**
 * Optimization warning information
 */
export interface OptimizationWarning {
  /** Warning type */
  type: OptimizationWarningType;
  /** Warning message */
  message: string;
  /** Pattern that generated the warning */
  patternId?: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high';
}

/**
 * Types of optimization warnings
 */
export enum OptimizationWarningType {
  /** Pattern skipped due to safety concerns */
  PATTERN_SKIPPED_UNSAFE = 'pattern_skipped_unsafe',
  /** Pattern had minimal impact */
  MINIMAL_IMPACT = 'minimal_impact',
  /** Pattern may affect debugging */
  DEBUGGING_IMPACT = 'debugging_impact',
  /** Pattern may affect timing */
  TIMING_IMPACT = 'timing_impact',
  /** Pattern uses experimental features */
  EXPERIMENTAL_FEATURE = 'experimental_feature',
}

/**
 * Debug information for optimization
 */
export interface OptimizationDebugInfo {
  /** Pattern application attempts */
  applicationAttempts: {
    /** Pattern ID */
    patternId: string;
    /** Number of attempts */
    attempts: number;
    /** Number of successes */
    successes: number;
    /** Reasons for failures */
    failures: string[];
  }[];
  /** Time spent per pattern category */
  timePerCategory: Record<OptimizationCategory, number>;
  /** Analytics data used for decisions */
  analyticsUsed: {
    /** Complexity metrics used */
    complexity: boolean;
    /** Performance predictions used */
    performance: boolean;
    /** Pattern readiness used */
    patternReadiness: boolean;
    /** 6502 analysis used */
    sixtytwofiveAnalysis: boolean;
  };
  /** Optimization decision log */
  decisionLog: OptimizationDecision[];
}

/**
 * Individual optimization decision
 */
export interface OptimizationDecision {
  /** Decision timestamp */
  timestamp: number;
  /** Pattern being considered */
  patternId: string;
  /** Decision made */
  decision: 'apply' | 'skip' | 'defer';
  /** Reason for decision */
  reason: string;
  /** Analytics data that influenced decision */
  analyticsInfluence: string[];
  /** Estimated impact */
  estimatedImpact: OptimizationMetricsChange;
}

/**
 * Optimization pass configuration
 */
export interface OptimizationPass {
  /** Pass name */
  name: string;
  /** Pass description */
  description: string;
  /** Pass priority */
  priority: number;
  /** Patterns to apply in this pass */
  patterns: string[];
  /** Pass execution function */
  execute: (program: ILProgram, context: OptimizationContext) => OptimizationPassResult;
}

/**
 * Result of an optimization pass
 */
export interface OptimizationPassResult {
  /** Whether the pass was successful */
  success: boolean;
  /** Modified program */
  program?: ILProgram;
  /** Metrics change for this pass */
  metricsChange: OptimizationMetricsChange;
  /** Patterns applied in this pass */
  appliedPatterns: string[];
  /** Pass execution time (ms) */
  executionTime: number;
  /** Whether another pass would be beneficial */
  shouldRunAgain: boolean;
  /** Errors encountered during the pass */
  errors: OptimizationError[];
  /** Warnings generated during the pass */
  warnings: OptimizationWarning[];
}

/**
 * Complete optimization session result
 */
export interface OptimizationSessionResult {
  /** Final optimized program */
  optimizedProgram: ILProgram;
  /** Overall optimization metrics */
  metrics: OptimizationMetrics;
  /** All optimization passes executed */
  passResults: OptimizationPassResult[];
  /** Final performance grade */
  performanceGrade: string;
  /** Optimization summary */
  summary: OptimizationSummary;
  /** Session configuration used */
  config: OptimizationConfig;
  /** Session timing information */
  timing: {
    /** Total session time (ms) */
    totalTime: number;
    /** Time per optimization category (ms) */
    timePerCategory: Record<OptimizationCategory, number>;
    /** Time per pass (ms) */
    timePerPass: number[];
  };
  /** Session debug information */
  debug?: OptimizationSessionDebugInfo;
}

/**
 * High-level optimization summary
 */
export interface OptimizationSummary {
  /** Original program complexity */
  originalComplexity: number;
  /** Final program complexity */
  finalComplexity: number;
  /** Performance improvement percentage */
  performanceImprovement: number;
  /** Size change percentage */
  sizeChange: number;
  /** Number of patterns successfully applied */
  successfulPatterns: number;
  /** Number of patterns attempted */
  attemptedPatterns: number;
  /** Top 5 most impactful patterns */
  topPatterns: {
    /** Pattern ID */
    patternId: string;
    /** Pattern name */
    name: string;
    /** Number of applications */
    applications: number;
    /** Cycle savings */
    cyclesSaved: number;
  }[];
  /** Recommendations for further optimization */
  recommendations: string[];
}

/**
 * Session-level debug information
 */
export interface OptimizationSessionDebugInfo {
  /** Analytics accuracy validation */
  analyticsAccuracy: {
    /** Performance prediction accuracy */
    performancePredictionAccuracy: number;
    /** Pattern applicability accuracy */
    patternApplicabilityAccuracy: number;
    /** Overall analytics effectiveness */
    analyticsEffectiveness: number;
  };
  /** Pattern application statistics */
  patternStatistics: {
    /** Most frequently applied patterns */
    mostFrequentPatterns: string[];
    /** Most effective patterns */
    mostEffectivePatterns: string[];
    /** Patterns that failed most often */
    problematicPatterns: string[];
  };
  /** Optimization bottlenecks */
  bottlenecks: {
    /** Slowest optimization categories */
    slowestCategories: OptimizationCategory[];
    /** Functions that took longest to optimize */
    slowestFunctions: string[];
    /** Patterns that took longest to apply */
    slowestPatterns: string[];
  };
}

/**
 * Factory function type for creating optimization patterns
 */
export type OptimizationPatternFactory = () => OptimizationPattern;

/**
 * Registry for optimization patterns
 */
export interface OptimizationPatternRegistry {
  /** Register a new pattern */
  register(pattern: OptimizationPattern): void;
  /** Get pattern by ID */
  get(id: string): OptimizationPattern | undefined;
  /** Get all patterns for a category */
  getByCategory(category: OptimizationCategory): OptimizationPattern[];
  /** Get all patterns suitable for a level */
  getByLevel(level: OptimizationLevel): OptimizationPattern[];
  /** Get all registered patterns */
  getAll(): OptimizationPattern[];
  /** Check if pattern exists */
  has(id: string): boolean;
  /** Remove a pattern */
  unregister(id: string): boolean;
  /** Clear all patterns */
  clear(): void;
}

/**
 * Default optimization configuration
 */
export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  level: OptimizationLevel.O2,
  targetVariant: 'c64-6510',
  maxPasses: 10,
  timeLimit: 30000, // 30 seconds
  enabledCategories: new Set([
    OptimizationCategory.DEAD_CODE,
    OptimizationCategory.CONSTANTS,
    OptimizationCategory.FUNCTIONS,
    OptimizationCategory.LOOPS,
    OptimizationCategory.REGISTERS,
    OptimizationCategory.MEMORY,
    OptimizationCategory.PEEPHOLE,
    OptimizationCategory.CONTROL_FLOW,
    OptimizationCategory.ARITHMETIC,
  ]),
  disabledPatterns: new Set(),
  sizeSpeedTradeoff: 0.7, // Slightly favor speed
  enableExperimental: false,
  debug: {
    logDecisions: false,
    generateReports: true,
    validateCorrectness: true,
  },
};
