/**
 * Pattern Library Management System - Registration, Discovery, and Organization
 * Task 1.11: Core Optimization Pattern Infrastructure
 *
 * This file implements the central pattern library that manages all 470+ optimization patterns.
 * It provides efficient pattern registration, discovery, conflict resolution, and performance tracking.
 *
 * Educational Focus:
 * - Scalable pattern organization supporting hundreds of patterns
 * - Efficient pattern discovery algorithms for sub-100ms performance
 * - Conflict detection and resolution between patterns
 * - Dynamic pattern loading and hot-reloading for development
 *
 * Architecture Design:
 * - Hierarchical pattern organization by category and subcategory
 * - Multi-index pattern lookup (by ID, category, platform, etc.)
 * - Pattern dependency and conflict management
 * - Comprehensive performance metrics and statistics
 * - Plugin architecture for extensible pattern sets
 */

import type {
  OptimizationPattern,
  PatternCategory,
  PatternSubcategory,
  PatternPriority,
  PatternComplexity,
  TargetPlatform,
  OptimizationContext,
  PatternPerformanceStatistics,
  OptimizationSystemStatistics,
  MemoryUsageStatistics,
  ValidationResult,
} from './pattern-system';
import type { ASTNode } from '@blend65/ast';
import { SourcePosition } from '@blend65/lexer';

// ============================================================================
// PATTERN LIBRARY CORE INTERFACE
// ============================================================================

/**
 * Central optimization pattern library for managing all 470+ patterns.
 *
 * Performance Goals:
 * - Sub-100ms pattern discovery for any query
 * - Memory usage under 50MB for full pattern library
 * - Zero-allocation pattern lookup in hot paths
 * - Efficient batch processing for AST-wide optimization
 *
 * Scalability Goals:
 * - Support 470+ patterns without performance degradation
 * - Enable hot-reloading of patterns during development
 * - Plugin architecture for third-party pattern sets
 * - Distributed pattern loading for large codebases
 */
export interface OptimizationPatternLibrary {
  /** Library identifier and version information */
  readonly id: string;
  readonly version: string;
  readonly totalPatterns: number;

  // ========================================================================
  // PATTERN REGISTRATION AND MANAGEMENT
  // ========================================================================

  /**
   * Register a new optimization pattern with the library.
   * Performs validation, conflict detection, and index building.
   */
  registerPattern(pattern: OptimizationPattern): PatternRegistrationResult;

  /**
   * Register multiple patterns atomically.
   * All patterns succeed or all fail to maintain consistency.
   */
  registerPatterns(patterns: OptimizationPattern[]): BatchRegistrationResult;

  /**
   * Unregister a pattern from the library.
   * Checks for dependent patterns and handles cleanup.
   */
  unregisterPattern(patternId: string): PatternUnregistrationResult;

  /**
   * Update an existing pattern with new implementation.
   * Maintains pattern identity while updating logic.
   */
  updatePattern(patternId: string, updatedPattern: OptimizationPattern): PatternUpdateResult;

  /**
   * Enable or disable a pattern without removing it.
   * Useful for debugging or conditional optimization.
   */
  setPatternEnabled(patternId: string, enabled: boolean): void;

  /**
   * Get pattern by unique identifier.
   * Returns undefined if pattern not found.
   */
  getPattern(patternId: string): OptimizationPattern | undefined;

  /**
   * Check if a pattern is registered and enabled.
   */
  isPatternEnabled(patternId: string): boolean;

  /**
   * Validate pattern library consistency.
   * Checks for conflicts, missing dependencies, etc.
   */
  validateLibrary(): LibraryValidationResult;

  // ========================================================================
  // PATTERN DISCOVERY AND SEARCH
  // ========================================================================

  /**
   * Find all patterns matching the given criteria.
   * Supports complex queries with multiple filters.
   */
  findPatterns(query: PatternQuery): PatternSearchResult;

  /**
   * Find patterns applicable to a specific AST node type.
   * Optimized for fast lookup during AST traversal.
   */
  findPatternsForNode(nodeType: string, context: OptimizationContext): OptimizationPattern[];

  /**
   * Find patterns by category and subcategory.
   * Efficient hierarchical lookup.
   */
  findPatternsByCategory(
    category: PatternCategory,
    subcategory?: PatternSubcategory
  ): OptimizationPattern[];

  /**
   * Find patterns by target platform.
   * Returns patterns compatible with the specified platform.
   */
  findPatternsByPlatform(platform: TargetPlatform): OptimizationPattern[];

  /**
   * Find patterns by priority level.
   * Useful for applying high-priority optimizations first.
   */
  findPatternsByPriority(minPriority: PatternPriority): OptimizationPattern[];

  /**
   * Find patterns that conflict with a given pattern.
   * Used for conflict resolution during pattern application.
   */
  findConflictingPatterns(patternId: string): OptimizationPattern[];

  /**
   * Find patterns that are enabled by a given pattern.
   * Used for dependency-driven pattern application.
   */
  findEnabledPatterns(patternId: string): OptimizationPattern[];

  /**
   * Get recommended patterns for an optimization context.
   * Uses heuristics and performance data for smart recommendations.
   */
  getRecommendedPatterns(context: OptimizationContext): PatternRecommendation[];

  // ========================================================================
  // PATTERN APPLICATION AND ORCHESTRATION
  // ========================================================================

  /**
   * Apply all applicable patterns to an AST node.
   * Handles conflicts, dependencies, and performance constraints.
   */
  applyPatterns(
    node: ASTNode,
    context: OptimizationContext,
    options?: PatternApplicationOptions
  ): PatternApplicationResult;

  /**
   * Apply patterns in batches for better performance.
   * Groups compatible patterns for efficient processing.
   */
  applyPatternsBatch(
    nodes: ASTNode[],
    context: OptimizationContext,
    options?: BatchApplicationOptions
  ): BatchApplicationResult;

  /**
   * Apply only specific patterns to a node.
   * Useful for targeted optimization or debugging.
   */
  applySpecificPatterns(
    node: ASTNode,
    patternIds: string[],
    context: OptimizationContext
  ): PatternApplicationResult;

  /**
   * Dry run pattern application without modifying AST.
   * Used for impact estimation and validation.
   */
  simulatePatternApplication(
    node: ASTNode,
    patternIds: string[],
    context: OptimizationContext
  ): PatternSimulationResult;

  // ========================================================================
  // PERFORMANCE MONITORING AND STATISTICS
  // ========================================================================

  /**
   * Get performance statistics for a specific pattern.
   */
  getPatternStatistics(patternId: string): PatternPerformanceStatistics | undefined;

  /**
   * Get overall optimization system statistics.
   */
  getSystemStatistics(): OptimizationSystemStatistics;

  /**
   * Get patterns ranked by performance impact.
   * Useful for identifying most valuable optimizations.
   */
  getPatternsByPerformance(): PatternPerformanceRanking[];

  /**
   * Get patterns with performance issues.
   * Identifies patterns that may need optimization or removal.
   */
  getProblematicPatterns(): PatternIssueReport[];

  /**
   * Reset all performance statistics.
   * Useful for benchmarking or fresh analysis.
   */
  resetStatistics(): void;

  /**
   * Export performance data for analysis.
   * Supports various formats for external tools.
   */
  exportStatistics(format: StatisticsExportFormat): StatisticsExport;

  // ========================================================================
  // DEBUGGING AND DIAGNOSTICS
  // ========================================================================

  /**
   * Get detailed information about pattern library state.
   * Useful for debugging and system monitoring.
   */
  getDiagnosticInfo(): LibraryDiagnosticInfo;

  /**
   * Get pattern application trace for debugging.
   * Shows exactly what patterns were applied and why.
   */
  getApplicationTrace(): PatternApplicationTrace[];

  /**
   * Enable or disable detailed logging.
   * Controls verbosity of pattern system operations.
   */
  setLoggingLevel(level: LoggingLevel): void;

  /**
   * Validate that pattern library is in consistent state.
   * Performs deep consistency checks for debugging.
   */
  performConsistencyCheck(): ConsistencyCheckResult;
}

// ============================================================================
// PATTERN REGISTRATION TYPES
// ============================================================================

/**
 * Result of pattern registration operation.
 */
export interface PatternRegistrationResult {
  /** Whether registration was successful */
  success: boolean;

  /** Registered pattern ID */
  patternId: string;

  /** Any warnings during registration */
  warnings: RegistrationWarning[];

  /** Conflicts detected with existing patterns */
  conflicts: PatternConflict[];

  /** Dependencies that were automatically resolved */
  resolvedDependencies: string[];

  /** Performance impact of registration */
  registrationImpact: RegistrationImpact;
}

/**
 * Result of batch pattern registration.
 */
export interface BatchRegistrationResult {
  /** Whether entire batch was successful */
  success: boolean;

  /** Number of patterns successfully registered */
  successCount: number;

  /** Number of patterns that failed registration */
  failureCount: number;

  /** Individual registration results */
  results: Map<string, PatternRegistrationResult>;

  /** Global conflicts affecting multiple patterns */
  globalConflicts: GlobalPatternConflict[];

  /** Overall batch performance impact */
  batchImpact: BatchRegistrationImpact;
}

/**
 * Result of pattern unregistration.
 */
export interface PatternUnregistrationResult {
  /** Whether unregistration was successful */
  success: boolean;

  /** Patterns that were dependent on the removed pattern */
  affectedPatterns: string[];

  /** Cleanup actions performed */
  cleanupActions: CleanupAction[];

  /** Any errors during unregistration */
  errors: UnregistrationError[];
}

/**
 * Result of pattern update operation.
 */
export interface PatternUpdateResult {
  /** Whether update was successful */
  success: boolean;

  /** Changes made to the pattern */
  changes: PatternChange[];

  /** Impact on dependent patterns */
  dependencyImpact: DependencyImpact[];

  /** Performance impact of the update */
  updateImpact: UpdateImpact;

  /** Whether library reindexing was required */
  requiresReindexing: boolean;
}

/**
 * Warning during pattern registration.
 */
export interface RegistrationWarning {
  /** Type of warning */
  type: RegistrationWarningType;

  /** Warning message */
  message: string;

  /** Severity level */
  severity: 'Info' | 'Warning' | 'Error';

  /** Suggested remediation */
  remediation?: string;
}

export type RegistrationWarningType =
  | 'DuplicateId' // Pattern ID already exists
  | 'ConflictDetected' // Pattern conflicts with existing patterns
  | 'MissingDependency' // Required dependency not found
  | 'PerformanceImpact' // Pattern may impact performance negatively
  | 'ExperimentalPattern' // Pattern is marked as experimental
  | 'VersionMismatch'; // Pattern version incompatible with library

/**
 * Conflict between patterns.
 */
export interface PatternConflict {
  /** Type of conflict */
  conflictType: ConflictType;

  /** Patterns involved in the conflict */
  conflictingPatterns: string[];

  /** Description of the conflict */
  description: string;

  /** Severity of the conflict */
  severity: ConflictSeverity;

  /** Possible resolutions */
  possibleResolutions: ConflictResolution[];
}

export type ConflictType =
  | 'Mutual' // Patterns cannot be applied together
  | 'Ordering' // Patterns have ordering dependency
  | 'Resource' // Patterns compete for same resources
  | 'Semantic' // Patterns have semantic conflicts
  | 'Performance' // Patterns counteract each other's benefits
  | 'Platform'; // Patterns incompatible on same platform

export type ConflictSeverity = 'Warning' | 'Error' | 'Critical';

/**
 * Possible resolution for pattern conflict.
 */
export interface ConflictResolution {
  /** Type of resolution */
  resolutionType: ResolutionType;

  /** Description of resolution */
  description: string;

  /** Actions required for resolution */
  requiredActions: ResolutionAction[];

  /** Impact of applying this resolution */
  resolutionImpact: ResolutionImpact;
}

export type ResolutionType =
  | 'Disable' // Disable one of the conflicting patterns
  | 'Reorder' // Change application order
  | 'Condition' // Add conditional application logic
  | 'Merge' // Merge patterns into single pattern
  | 'Split' // Split pattern into non-conflicting parts
  | 'Configure'; // Configure patterns to avoid conflict

/**
 * Action required for conflict resolution.
 */
export interface ResolutionAction {
  /** Type of action */
  actionType: 'Disable' | 'Enable' | 'Reorder' | 'Configure' | 'Merge';

  /** Pattern affected by action */
  affectedPattern: string;

  /** Parameters for the action */
  actionParameters: Map<string, any>;

  /** Description of action */
  description: string;
}

/**
 * Impact of conflict resolution.
 */
export interface ResolutionImpact {
  /** Performance impact (positive or negative) */
  performanceImpact: number;

  /** Functionality impact */
  functionalityImpact: FunctionalityImpact;

  /** Maintenance complexity impact */
  complexityImpact: ComplexityImpact;
}

export type FunctionalityImpact = 'None' | 'Minor' | 'Moderate' | 'Major';
export type ComplexityImpact = 'Reduced' | 'Unchanged' | 'Increased';

// ============================================================================
// PATTERN DISCOVERY TYPES
// ============================================================================

/**
 * Query for finding patterns with specific criteria.
 */
export interface PatternQuery {
  /** Pattern categories to include */
  categories?: PatternCategory[];

  /** Pattern subcategories to include */
  subcategories?: PatternSubcategory[];

  /** Target platforms to match */
  platforms?: TargetPlatform[];

  /** Minimum priority level */
  minPriority?: PatternPriority;

  /** Maximum complexity level */
  maxComplexity?: PatternComplexity;

  /** Whether to include experimental patterns */
  includeExperimental?: boolean;

  /** Text search in pattern names/descriptions */
  textSearch?: string;

  /** Custom filter predicate */
  customFilter?: (pattern: OptimizationPattern) => boolean;

  /** Maximum number of results */
  limit?: number;

  /** Result sorting criteria */
  sortBy?: PatternSortCriteria;
}

/**
 * Sorting criteria for pattern search results.
 */
export type PatternSortCriteria =
  | 'Priority' // Sort by priority (high to low)
  | 'Performance' // Sort by performance impact
  | 'Complexity' // Sort by complexity (low to high)
  | 'Alphabetical' // Sort alphabetically by name
  | 'Category' // Sort by category then subcategory
  | 'RecentlyUsed'; // Sort by recent usage statistics

/**
 * Result of pattern search operation.
 */
export interface PatternSearchResult {
  /** Patterns matching the query */
  patterns: OptimizationPattern[];

  /** Total number of matches (before limit) */
  totalMatches: number;

  /** Time taken for search (milliseconds) */
  searchTime: number;

  /** Cache hit rate for this search */
  cacheHitRate: number;

  /** Search performance metrics */
  searchMetrics: SearchMetrics;
}

/**
 * Performance metrics for pattern search.
 */
export interface SearchMetrics {
  /** Index lookup time (microseconds) */
  indexLookupTime: number;

  /** Filter application time (microseconds) */
  filterTime: number;

  /** Sorting time (microseconds) */
  sortTime: number;

  /** Memory allocations during search */
  memoryAllocations: number;

  /** Cache operations performed */
  cacheOperations: CacheOperationStats;
}

/**
 * Cache operation statistics.
 */
export interface CacheOperationStats {
  /** Number of cache hits */
  hits: number;

  /** Number of cache misses */
  misses: number;

  /** Cache entries created */
  creations: number;

  /** Cache entries evicted */
  evictions: number;
}

/**
 * Pattern recommendation with rationale.
 */
export interface PatternRecommendation {
  /** Recommended pattern */
  pattern: OptimizationPattern;

  /** Confidence in recommendation (0-100) */
  confidence: number;

  /** Expected benefit of applying this pattern */
  expectedBenefit: number;

  /** Rationale for recommendation */
  rationale: RecommendationRationale;

  /** Prerequisites for applying this pattern */
  prerequisites: string[];

  /** Priority ranking among recommendations */
  priority: number;
}

/**
 * Rationale for pattern recommendation.
 */
export interface RecommendationRationale {
  /** Primary reason for recommendation */
  primaryReason: RecommendationReason;

  /** Supporting factors */
  supportingFactors: RecommendationFactor[];

  /** Historical performance data */
  historicalData: HistoricalPerformanceData;

  /** Context-specific factors */
  contextFactors: ContextFactor[];
}

export type RecommendationReason =
  | 'HighImpact' // Pattern has historically high impact
  | 'FrequentlyApplicable' // Pattern applies to many similar cases
  | 'LowComplexity' // Pattern is simple to apply safely
  | 'ContextMatch' // Pattern perfect for current context
  | 'ComplementaryPattern' // Pattern works well with others
  | 'HotPath'; // Pattern optimizes hot execution path

/**
 * Factor supporting pattern recommendation.
 */
export interface RecommendationFactor {
  /** Type of factor */
  factorType: string;

  /** Weight of this factor (0-100) */
  weight: number;

  /** Description of factor */
  description: string;

  /** Evidence supporting this factor */
  evidence: any;
}

/**
 * Historical performance data for pattern.
 */
export interface HistoricalPerformanceData {
  /** Average performance improvement achieved */
  averageImprovement: number;

  /** Success rate (0-100) */
  successRate: number;

  /** Number of times applied */
  applicationCount: number;

  /** Performance trend over time */
  performanceTrend: PerformanceTrend;

  /** Similar context performance */
  similarContextPerformance: number;
}

export type PerformanceTrend = 'Improving' | 'Stable' | 'Declining';

/**
 * Context-specific factor influencing recommendation.
 */
export interface ContextFactor {
  /** Factor name */
  factor: string;

  /** Factor value */
  value: any;

  /** Impact on recommendation */
  impact: 'Positive' | 'Negative' | 'Neutral';

  /** Factor weight */
  weight: number;
}

// ============================================================================
// PATTERN APPLICATION TYPES
// ============================================================================

/**
 * Options for pattern application.
 */
export interface PatternApplicationOptions {
  /** Maximum number of patterns to apply */
  maxPatterns?: number;

  /** Patterns to exclude from application */
  excludePatterns?: string[];

  /** Only apply patterns with minimum priority */
  minPriority?: PatternPriority;

  /** Stop after first successful application */
  stopAfterFirst?: boolean;

  /** Whether to apply experimental patterns */
  allowExperimental?: boolean;

  /** Maximum time to spend on optimization */
  timeoutMs?: number;

  /** Whether to perform validation after each pattern */
  validateEach?: boolean;

  /** Conflict resolution strategy */
  conflictResolution?: ConflictResolutionStrategy;
}

export type ConflictResolutionStrategy =
  | 'Skip' // Skip conflicting patterns
  | 'HighestPriority' // Apply highest priority pattern
  | 'BestBenefit' // Apply pattern with best expected benefit
  | 'Manual' // Require manual conflict resolution
  | 'Automatic'; // Use automatic conflict resolution

/**
 * Options for batch pattern application.
 */
export interface BatchApplicationOptions extends PatternApplicationOptions {
  /** Number of nodes to process concurrently */
  batchSize?: number;

  /** Whether to use parallel processing */
  useParallel?: boolean;

  /** Progress callback for long operations */
  progressCallback?: (progress: BatchProgress) => void;

  /** Whether to continue after individual failures */
  continueOnError?: boolean;
}

/**
 * Progress information for batch operations.
 */
export interface BatchProgress {
  /** Number of nodes processed */
  processedCount: number;

  /** Total number of nodes to process */
  totalCount: number;

  /** Number of successful applications */
  successCount: number;

  /** Number of failed applications */
  failureCount: number;

  /** Estimated time remaining (milliseconds) */
  estimatedTimeRemaining: number;

  /** Current processing rate (nodes/second) */
  processingRate: number;
}

/**
 * Result of pattern application operation.
 */
export interface PatternApplicationResult {
  /** Whether application was successful */
  success: boolean;

  /** Patterns that were successfully applied */
  appliedPatterns: AppliedPattern[];

  /** Patterns that failed to apply */
  failedPatterns: FailedPattern[];

  /** Conflicts encountered during application */
  conflicts: PatternConflict[];

  /** Overall performance improvement achieved */
  totalImprovement: number;

  /** Total time spent on application */
  totalTime: number;

  /** Validation results if validation was performed */
  validationResults?: ValidationResult[];

  /** Application trace for debugging */
  applicationTrace?: PatternApplicationStep[];
}

/**
 * Information about successfully applied pattern.
 */
export interface AppliedPattern {
  /** Pattern that was applied */
  patternId: string;

  /** Performance improvement achieved */
  improvementAchieved: number;

  /** Time taken to apply pattern */
  applicationTime: number;

  /** AST nodes that were modified */
  modifiedNodes: ASTNode[];

  /** Additional metadata about application */
  applicationMetadata: Map<string, any>;
}

/**
 * Information about pattern that failed to apply.
 */
export interface FailedPattern {
  /** Pattern that failed to apply */
  patternId: string;

  /** Reason for failure */
  failureReason: FailureReason;

  /** Error details */
  error: PatternApplicationError;

  /** Time spent before failure */
  timeSpent: number;

  /** Recovery suggestions */
  recoverySuggestions: string[];
}

export type FailureReason =
  | 'PrerequisiteNotMet' // Required prerequisites not satisfied
  | 'SafetyViolation' // Pattern application would violate safety
  | 'ConflictDetected' // Pattern conflicts with already applied pattern
  | 'ValidationFailed' // Pattern validation failed
  | 'TimeoutExceeded' // Pattern application took too long
  | 'ResourceExhausted' // Insufficient resources for application
  | 'InternalError'; // Unexpected internal error

/**
 * Error during pattern application.
 */
export interface PatternApplicationError {
  /** Error type */
  errorType: string;

  /** Error message */
  message: string;

  /** Location where error occurred */
  location?: SourcePosition;

  /** Stack trace for debugging */
  stackTrace?: string;

  /** Additional error details */
  details: Map<string, any>;
}

/**
 * Individual step in pattern application trace.
 */
export interface PatternApplicationStep {
  /** Step number in sequence */
  stepNumber: number;

  /** Type of step */
  stepType: ApplicationStepType;

  /** Pattern being processed */
  patternId: string;

  /** Timestamp when step started */
  timestamp: Date;

  /** Duration of step (milliseconds) */
  duration: number;

  /** Step result */
  result: ApplicationStepResult;

  /** Additional step details */
  details: Map<string, any>;
}

export type ApplicationStepType =
  | 'PatternMatch' // Pattern matching phase
  | 'PrerequisiteCheck' // Prerequisite validation
  | 'SafetyCheck' // Safety condition verification
  | 'ConflictCheck' // Conflict detection
  | 'Transformation' // AST transformation
  | 'Validation' // Post-transformation validation
  | 'Rollback'; // Rollback due to failure

export type ApplicationStepResult = 'Success' | 'Warning' | 'Failure' | 'Skipped';

/**
 * Result of batch pattern application.
 */
export interface BatchApplicationResult {
  /** Overall success status */
  overallSuccess: boolean;

  /** Number of nodes successfully processed */
  successfulNodes: number;

  /** Number of nodes that failed processing */
  failedNodes: number;

  /** Total patterns applied across all nodes */
  totalPatternsApplied: number;

  /** Total performance improvement achieved */
  totalPerformanceImprovement: number;

  /** Total time spent on batch operation */
  totalTime: number;

  /** Individual node results */
  nodeResults: Map<ASTNode, PatternApplicationResult>;

  /** Batch-level conflicts and issues */
  batchIssues: BatchIssue[];

  /** Final batch statistics */
  batchStatistics: BatchStatistics;
}

/**
 * Issue affecting entire batch operation.
 */
export interface BatchIssue {
  /** Issue type */
  issueType: BatchIssueType;

  /** Issue description */
  description: string;

  /** Severity of issue */
  severity: 'Info' | 'Warning' | 'Error' | 'Critical';

  /** Affected nodes */
  affectedNodes: ASTNode[];

  /** Suggested remediation */
  remediation?: string;
}

export type BatchIssueType =
  | 'ResourceExhaustion' // Ran out of memory or other resources
  | 'TimeoutExceeded' // Batch operation took too long
  | 'ConflictSpread' // Conflicts propagated across nodes
  | 'ValidationFailure' // Batch validation failed
  | 'PerformanceRegression'; // Batch caused overall performance regression

/**
 * Statistics for batch operation.
 */
export interface BatchStatistics {
  /** Processing rate (nodes per second) */
  processingRate: number;

  /** Success rate (percentage) */
  successRate: number;

  /** Average patterns applied per node */
  averagePatternsPerNode: number;

  /** Average improvement per node */
  averageImprovementPerNode: number;

  /** Resource utilization during batch */
  resourceUtilization: ResourceUtilization;

  /** Performance distribution across nodes */
  performanceDistribution: PerformanceDistribution;
}

/**
 * Resource utilization during batch processing.
 */
export interface ResourceUtilization {
  /** Peak memory usage (bytes) */
  peakMemoryUsage: number;

  /** Average memory usage (bytes) */
  averageMemoryUsage: number;

  /** Peak CPU utilization (percentage) */
  peakCpuUsage: number;

  /** Average CPU utilization (percentage) */
  averageCpuUsage: number;

  /** I/O operations performed */
  ioOperations: number;
}

/**
 * Performance improvement distribution.
 */
export interface PerformanceDistribution {
  /** Minimum improvement achieved */
  minimum: number;

  /** Maximum improvement achieved */
  maximum: number;

  /** Average improvement */
  average: number;

  /** Standard deviation */
  standardDeviation: number;

  /** Performance buckets */
  buckets: PerformanceBucket[];
}

/**
 * Performance bucket for distribution analysis.
 */
export interface PerformanceBucket {
  /** Lower bound of bucket */
  lowerBound: number;

  /** Upper bound of bucket */
  upperBound: number;

  /** Number of nodes in this bucket */
  nodeCount: number;

  /** Percentage of total nodes */
  percentage: number;
}

/**
 * Result of pattern simulation (dry run).
 */
export interface PatternSimulationResult {
  /** Estimated performance improvement */
  estimatedImprovement: number;

  /** Patterns that would be applied */
  applicablePatterns: string[];

  /** Patterns that would be skipped */
  skippedPatterns: SkippedPattern[];

  /** Estimated time for actual application */
  estimatedApplicationTime: number;

  /** Potential risks or issues */
  potentialRisks: SimulationRisk[];

  /** Confidence in simulation accuracy */
  simulationConfidence: number;
}

/**
 * Information about pattern skipped during simulation.
 */
export interface SkippedPattern {
  /** Pattern that would be skipped */
  patternId: string;

  /** Reason for skipping */
  skipReason: string;

  /** Whether skip is due to conflict */
  isConflict: boolean;

  /** Alternative patterns that could be applied */
  alternatives: string[];
}

/**
 * Potential risk identified during simulation.
 */
export interface SimulationRisk {
  /** Risk type */
  riskType: SimulationRiskType;

  /** Risk description */
  description: string;

  /** Probability of risk (0-100) */
  probability: number;

  /** Impact if risk occurs */
  impact: RiskImpact;

  /** Mitigation strategies */
  mitigation: string[];
}

export type SimulationRiskType =
  | 'PerformanceRegression' // Pattern might hurt performance
  | 'SemanticChange' // Risk of changing program semantics
  | 'ResourceOveruse' // Might exceed resource limits
  | 'ConflictEscalation' // Conflicts might cascade
  | 'ValidationFailure'; // Post-application validation might fail

export type RiskImpact = 'Low' | 'Medium' | 'High' | 'Critical';

// ============================================================================
// PERFORMANCE AND DIAGNOSTICS TYPES
// ============================================================================

/**
 * Performance ranking of patterns.
 */
export interface PatternPerformanceRanking {
  /** Pattern identifier */
  patternId: string;

  /** Performance rank (1 = best performing) */
  rank: number;

  /** Performance score (0-100) */
  score: number;

  /** Average improvement delivered */
  averageImprovement: number;

  /** Success rate */
  successRate: number;

  /** Application frequency */
  applicationFrequency: number;

  /** Trend analysis */
  trend: PerformanceTrend;
}

/**
 * Report of pattern with performance issues.
 */
export interface PatternIssueReport {
  /** Pattern with issues */
  patternId: string;

  /** Issues detected */
  issues: PatternIssue[];

  /** Severity of most critical issue */
  overallSeverity: 'Warning' | 'Error' | 'Critical';

  /** Recommended actions */
  recommendedActions: RecommendedAction[];

  /** Impact if issues are not addressed */
  impactIfIgnored: RiskImpact;

  /** Trend of issue severity over time */
  issueTrend: IssueTrend;
}

/**
 * Individual issue with a pattern.
 */
export interface PatternIssue {
  /** Issue type */
  issueType: PatternIssueType;

  /** Issue description */
  description: string;

  /** Severity level */
  severity: 'Warning' | 'Error' | 'Critical';

  /** Evidence supporting this issue */
  evidence: IssueEvidence[];

  /** Suggested remediation */
  remediation: string;

  /** Issue detection timestamp */
  detectedAt: Date;
}

export type PatternIssueType =
  | 'LowSuccessRate' // Pattern fails to apply successfully often
  | 'PerformanceRegression' // Pattern causes performance regression
  | 'HighComplexity' // Pattern is overly complex
  | 'FrequentConflicts' // Pattern conflicts with many other patterns
  | 'ResourceHog' // Pattern uses excessive resources
  | 'Outdated' // Pattern is outdated or superseded
  | 'Buggy'; // Pattern has implementation bugs

/**
 * Evidence supporting a pattern issue.
 */
export interface IssueEvidence {
  /** Type of evidence */
  evidenceType: 'Statistics' | 'UserReport' | 'Benchmark' | 'Analysis';

  /** Evidence description */
  description: string;

  /** Evidence data */
  data: any;

  /** Confidence in evidence (0-100) */
  confidence: number;
}

export type IssueTrend = 'Improving' | 'Stable' | 'Worsening';

/**
 * Recommended action to address pattern issues.
 */
export interface RecommendedAction {
  /** Action type */
  actionType: RecommendedActionType;

  /** Action description */
  description: string;

  /** Priority level */
  priority: 'Low' | 'Medium' | 'High' | 'Critical';

  /** Estimated effort to implement */
  estimatedEffort: EffortLevel;

  /** Expected benefit */
  expectedBenefit: BenefitLevel;

  /** Steps to implement action */
  implementationSteps: string[];
}

export type RecommendedActionType =
  | 'Disable' // Disable the problematic pattern
  | 'Update' // Update pattern implementation
  | 'Replace' // Replace with better pattern
  | 'Optimize' // Optimize pattern performance
  | 'Document' // Add better documentation
  | 'Test' // Add more comprehensive tests
  | 'Monitor'; // Increase monitoring and alerts

export type EffortLevel = 'Trivial' | 'Low' | 'Medium' | 'High' | 'Very_High';
export type BenefitLevel = 'None' | 'Low' | 'Medium' | 'High' | 'Very_High';

/**
 * Statistics export format.
 */
export type StatisticsExportFormat = 'JSON' | 'CSV' | 'XML' | 'YAML' | 'Binary';

/**
 * Exported statistics data.
 */
export interface StatisticsExport {
  /** Export format */
  format: StatisticsExportFormat;

  /** Export timestamp */
  timestamp: Date;

  /** Exported data */
  data: string | Uint8Array;

  /** Export metadata */
  metadata: ExportMetadata;

  /** Compression used */
  compression?: CompressionType;
}

/**
 * Metadata about statistics export.
 */
export interface ExportMetadata {
  /** Number of patterns included */
  patternCount: number;

  /** Time range of statistics */
  timeRange: TimeRange;

  /** Data size (bytes) */
  dataSize: number;

  /** Export version */
  version: string;

  /** Custom metadata */
  customMetadata: Map<string, any>;
}

/**
 * Time range for statistics.
 */
export interface TimeRange {
  /** Start time */
  startTime: Date;

  /** End time */
  endTime: Date;

  /** Duration (milliseconds) */
  duration: number;
}

export type CompressionType = 'none' | 'gzip' | 'brotli' | 'lz4';

/**
 * Diagnostic information about pattern library.
 */
export interface LibraryDiagnosticInfo {
  /** Library version and build info */
  libraryInfo: LibraryInfo;

  /** Current library state */
  libraryState: LibraryState;

  /** Performance metrics */
  performanceMetrics: LibraryPerformanceMetrics;

  /** Memory usage statistics */
  memoryUsage: MemoryUsageStatistics;

  /** Index status and statistics */
  indexStatus: IndexStatus;

  /** Pattern distribution */
  patternDistribution: PatternDistribution;

  /** Active conflicts and issues */
  activeIssues: ActiveIssue[];

  /** System health indicators */
  healthIndicators: HealthIndicator[];
}

/**
 * Library version and build information.
 */
export interface LibraryInfo {
  /** Library version */
  version: string;

  /** Build timestamp */
  buildTimestamp: Date;

  /** Git commit hash */
  commitHash: string;

  /** Supported specification version */
  specificationVersion: string;

  /** Build configuration */
  buildConfiguration: BuildConfiguration;
}

/**
 * Build configuration information.
 */
export interface BuildConfiguration {
  /** Debug mode enabled */
  debugMode: boolean;

  /** Optimization level */
  optimizationLevel: number;

  /** Feature flags */
  featureFlags: Map<string, boolean>;

  /** Compiler version used */
  compilerVersion: string;
}

/**
 * Current state of pattern library.
 */
export interface LibraryState {
  /** Total patterns registered */
  totalPatterns: number;

  /** Enabled patterns */
  enabledPatterns: number;

  /** Disabled patterns */
  disabledPatterns: number;

  /** Experimental patterns */
  experimentalPatterns: number;

  /** Patterns with issues */
  problematicPatterns: number;

  /** Active pattern conflicts */
  activeConflicts: number;

  /** Library consistency status */
  consistencyStatus: ConsistencyStatus;
}

export type ConsistencyStatus = 'Consistent' | 'MinorIssues' | 'MajorIssues' | 'Corrupted';

/**
 * Performance metrics for pattern library.
 */
export interface LibraryPerformanceMetrics {
  /** Average pattern lookup time (microseconds) */
  averageLookupTime: number;

  /** Pattern registration time (milliseconds) */
  averageRegistrationTime: number;

  /** Index rebuild time (milliseconds) */
  averageIndexRebuildTime: number;

  /** Cache hit rate (percentage) */
  cacheHitRate: number;

  /** Operations per second */
  operationsPerSecond: number;

  /** Performance trend */
  performanceTrend: PerformanceTrend;
}

/**
 * Index status and statistics.
 */
export interface IndexStatus {
  /** Whether indexes are up to date */
  upToDate: boolean;

  /** Last rebuild timestamp */
  lastRebuildTime: Date;

  /** Index sizes */
  indexSizes: Map<string, number>;

  /** Index efficiency metrics */
  indexEfficiency: Map<string, IndexEfficiencyMetric>;

  /** Pending index updates */
  pendingUpdates: number;
}

/**
 * Efficiency metric for an index.
 */
export interface IndexEfficiencyMetric {
  /** Average lookup time (microseconds) */
  averageLookupTime: number;

  /** Memory usage (bytes) */
  memoryUsage: number;

  /** Cache hit rate */
  cacheHitRate: number;

  /** Index fragmentation level */
  fragmentationLevel: number;
}

/**
 * Distribution of patterns across categories.
 */
export interface PatternDistribution {
  /** Patterns by category */
  byCategory: Map<PatternCategory, number>;

  /** Patterns by subcategory */
  bySubcategory: Map<PatternSubcategory, number>;

  /** Patterns by platform */
  byPlatform: Map<TargetPlatform, number>;

  /** Patterns by priority */
  byPriority: Map<PatternPriority, number>;

  /** Patterns by complexity */
  byComplexity: Map<PatternComplexity, number>;
}

/**
 * Active issue in pattern library.
 */
export interface ActiveIssue {
  /** Issue type */
  issueType: ActiveIssueType;

  /** Issue description */
  description: string;

  /** Affected patterns */
  affectedPatterns: string[];

  /** Issue severity */
  severity: 'Info' | 'Warning' | 'Error' | 'Critical';

  /** First detected timestamp */
  detectedAt: Date;

  /** Suggested resolution */
  suggestedResolution: string;
}

export type ActiveIssueType =
  | 'ConflictCascade' // Conflicts spreading between patterns
  | 'PerformanceDrift' // Overall performance degradation
  | 'MemoryLeak' // Memory usage growing over time
  | 'IndexCorruption' // Index corruption detected
  | 'ConsistencyViolation' // Library consistency violation
  | 'ResourceExhaustion'; // Running low on system resources

/**
 * System health indicator.
 */
export interface HealthIndicator {
  /** Indicator name */
  name: string;

  /** Current status */
  status: HealthStatus;

  /** Indicator value */
  value: number;

  /** Value units */
  units: string;

  /** Healthy range */
  healthyRange: ValueRange;

  /** Trend over time */
  trend: HealthTrend;

  /** Last updated timestamp */
  lastUpdated: Date;
}

export type HealthStatus = 'Healthy' | 'Warning' | 'Critical';

/**
 * Value range for health indicators.
 */
export interface ValueRange {
  /** Minimum healthy value */
  min: number;

  /** Maximum healthy value */
  max: number;

  /** Optimal value */
  optimal: number;
}

export type HealthTrend = 'Improving' | 'Stable' | 'Degrading';

/**
 * Pattern application trace entry.
 */
export interface PatternApplicationTrace {
  /** Trace entry ID */
  id: string;

  /** Timestamp */
  timestamp: Date;

  /** Operation type */
  operation: TraceOperation;

  /** Pattern ID */
  patternId: string;

  /** AST node affected */
  nodeId?: string;

  /** Operation result */
  result: TraceResult;

  /** Performance impact */
  performanceImpact: number;

  /** Additional trace data */
  traceData: Map<string, any>;
}

export type TraceOperation =
  | 'PatternMatch'
  | 'PatternApply'
  | 'PatternSkip'
  | 'ConflictDetected'
  | 'ValidationFailed'
  | 'TransformationRolledBack';

export type TraceResult = 'Success' | 'Warning' | 'Error' | 'Skipped';

/**
 * Logging level for pattern system.
 */
export type LoggingLevel = 'None' | 'Error' | 'Warning' | 'Info' | 'Debug' | 'Verbose';

/**
 * Result of consistency check.
 */
export interface ConsistencyCheckResult {
  /** Overall consistency status */
  overallStatus: ConsistencyStatus;

  /** Individual check results */
  checks: ConsistencyCheck[];

  /** Issues found */
  issuesFound: ConsistencyIssue[];

  /** Recommended actions */
  recommendedActions: ConsistencyAction[];

  /** Check duration */
  checkDuration: number;

  /** Check timestamp */
  checkTimestamp: Date;
}

/**
 * Individual consistency check.
 */
export interface ConsistencyCheck {
  /** Check name */
  checkName: string;

  /** Check description */
  description: string;

  /** Check result */
  result: ConsistencyCheckStatus;

  /** Issues found by this check */
  issuesFound: number;

  /** Check duration */
  duration: number;
}

export type ConsistencyCheckStatus = 'Passed' | 'Warning' | 'Failed' | 'Skipped';

/**
 * Consistency issue found during check.
 */
export interface ConsistencyIssue {
  /** Issue type */
  issueType: ConsistencyIssueType;

  /** Issue description */
  description: string;

  /** Affected entities */
  affectedEntities: string[];

  /** Issue severity */
  severity: 'Warning' | 'Error' | 'Critical';

  /** Repair strategy */
  repairStrategy: RepairStrategy;
}

export type ConsistencyIssueType =
  | 'OrphanedDependency' // Pattern depends on non-existent pattern
  | 'CircularDependency' // Circular dependency detected
  | 'ConflictLoop' // Circular conflict detected
  | 'IndexMismatch' // Index out of sync with data
  | 'DuplicateId' // Duplicate pattern IDs found
  | 'MissingMetadata'; // Required metadata missing

/**
 * Strategy for repairing consistency issues.
 */
export interface RepairStrategy {
  /** Strategy type */
  strategyType: RepairStrategyType;

  /** Strategy description */
  description: string;

  /** Automatic repair possible */
  canAutoRepair: boolean;

  /** Estimated repair time */
  estimatedRepairTime: number;

  /** Risk of repair */
  repairRisk: RiskLevel;
}

export type RepairStrategyType =
  | 'Remove' // Remove problematic entity
  | 'Update' // Update entity to fix issue
  | 'Rebuild' // Rebuild affected indexes
  | 'Reset' // Reset to known good state
  | 'Manual'; // Requires manual intervention

export type RiskLevel = 'None' | 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Action to fix consistency issues.
 */
export interface ConsistencyAction {
  /** Action type */
  actionType: ConsistencyActionType;

  /** Action description */
  description: string;

  /** Target entities */
  targetEntities: string[];

  /** Action priority */
  priority: ActionPriority;

  /** Estimated impact */
  estimatedImpact: ActionImpact;
}

export type ConsistencyActionType =
  | 'RebuildIndexes' // Rebuild all indexes
  | 'RemoveOrphans' // Remove orphaned dependencies
  | 'ResolveConflicts' // Resolve pattern conflicts
  | 'ValidateMetadata' // Validate and fix metadata
  | 'ResetLibrary'; // Reset library to clean state

export type ActionPriority = 'Low' | 'Medium' | 'High' | 'Immediate';

/**
 * Estimated impact of consistency action.
 */
export interface ActionImpact {
  /** Performance impact */
  performanceImpact: ImpactLevel;

  /** Data loss risk */
  dataLossRisk: RiskLevel;

  /** Downtime required */
  downtimeRequired: number; // milliseconds

  /** Affected functionality */
  affectedFunctionality: string[];
}

export type ImpactLevel = 'None' | 'Minimal' | 'Moderate' | 'Significant' | 'Major';

/**
 * Registration impact assessment.
 */
export interface RegistrationImpact {
  /** Memory usage increase (bytes) */
  memoryIncrease: number;

  /** Index rebuild time (milliseconds) */
  indexRebuildTime: number;

  /** Performance impact on lookup */
  lookupPerformanceImpact: number;

  /** Cache invalidation required */
  cacheInvalidationRequired: boolean;
}

/**
 * Global conflict affecting multiple patterns.
 */
export interface GlobalPatternConflict {
  /** Conflict description */
  description: string;

  /** All patterns involved */
  involvedPatterns: string[];

  /** Conflict severity */
  severity: ConflictSeverity;

  /** System-wide impact */
  systemImpact: SystemImpact;

  /** Global resolution strategies */
  resolutionStrategies: GlobalResolutionStrategy[];
}

/**
 * System-wide impact of conflicts.
 */
export interface SystemImpact {
  /** Performance degradation */
  performanceDegradation: number;

  /** Functionality loss */
  functionalityLoss: FunctionalityLoss;

  /** Stability risk */
  stabilityRisk: RiskLevel;

  /** Affected components */
  affectedComponents: string[];
}

/**
 * Functionality loss assessment.
 */
export interface FunctionalityLoss {
  /** Percentage of functionality lost */
  lossPercentage: number;

  /** Critical functionality affected */
  criticalFunctionality: string[];

  /** Workarounds available */
  workaroundsAvailable: boolean;

  /** Alternative patterns available */
  alternativePatternsAvailable: string[];
}

/**
 * Global resolution strategy.
 */
export interface GlobalResolutionStrategy {
  /** Strategy name */
  strategyName: string;

  /** Strategy description */
  description: string;

  /** Affected patterns */
  affectedPatterns: string[];

  /** Implementation steps */
  implementationSteps: GlobalResolutionStep[];

  /** Expected outcome */
  expectedOutcome: ResolutionOutcome;
}

/**
 * Step in global resolution strategy.
 */
export interface GlobalResolutionStep {
  /** Step order */
  stepOrder: number;

  /** Step description */
  description: string;

  /** Step type */
  stepType: GlobalStepType;

  /** Target patterns */
  targetPatterns: string[];

  /** Step parameters */
  parameters: Map<string, any>;
}

export type GlobalStepType =
  | 'DisablePattern'
  | 'ModifyPattern'
  | 'ReorderPatterns'
  | 'CreateGroup'
  | 'SplitPattern'
  | 'MergePatterns';

/**
 * Expected outcome of resolution.
 */
export interface ResolutionOutcome {
  /** Conflicts resolved */
  conflictsResolved: number;

  /** Performance improvement */
  performanceImprovement: number;

  /** Functionality restored */
  functionalityRestored: number;

  /** New issues introduced */
  newIssuesIntroduced: number;

  /** Overall success probability */
  successProbability: number;
}

/**
 * Batch registration impact.
 */
export interface BatchRegistrationImpact {
  /** Total memory increase */
  totalMemoryIncrease: number;

  /** Total registration time */
  totalRegistrationTime: number;

  /** System performance impact */
  systemPerformanceImpact: number;

  /** Resource utilization peak */
  resourceUtilizationPeak: ResourcePeak;

  /** Recovery time needed */
  recoveryTime: number;
}

/**
 * Resource utilization peak.
 */
export interface ResourcePeak {
  /** Peak memory usage */
  peakMemory: number;

  /** Peak CPU usage */
  peakCpu: number;

  /** Peak I/O operations */
  peakIo: number;

  /** Duration of peak */
  peakDuration: number;
}

/**
 * Cleanup action during unregistration.
 */
export interface CleanupAction {
  /** Action type */
  actionType: CleanupActionType;

  /** Action description */
  description: string;

  /** Resources cleaned */
  resourcesCleaned: CleanupResource[];

  /** Action success */
  success: boolean;

  /** Time taken */
  timeTaken: number;
}

export type CleanupActionType =
  | 'RemoveFromIndex'
  | 'ClearCache'
  | 'UpdateDependencies'
  | 'CleanupMemory'
  | 'InvalidateReferences';

/**
 * Resource cleaned during unregistration.
 */
export interface CleanupResource {
  /** Resource type */
  resourceType: string;

  /** Resource identifier */
  resourceId: string;

  /** Size freed (bytes) */
  sizeFreed: number;

  /** Cleanup status */
  status: CleanupStatus;
}

export type CleanupStatus = 'Success' | 'Warning' | 'Failed' | 'Skipped';

/**
 * Error during pattern unregistration.
 */
export interface UnregistrationError {
  /** Error type */
  errorType: UnregistrationErrorType;

  /** Error message */
  message: string;

  /** Affected pattern */
  affectedPattern: string;

  /** Error severity */
  severity: 'Warning' | 'Error' | 'Critical';

  /** Recovery suggestions */
  recoverySuggestions: string[];
}

export type UnregistrationErrorType =
  | 'DependencyViolation' // Other patterns depend on this one
  | 'ResourceLocked' // Resources are locked and cannot be freed
  | 'IndexUpdateFailed' // Failed to update indexes
  | 'CacheCorruption' // Cache corruption detected
  | 'InternalError'; // Unexpected internal error

/**
 * Change made to a pattern during update.
 */
export interface PatternChange {
  /** Change type */
  changeType: PatternChangeType;

  /** Field that changed */
  field: string;

  /** Old value */
  oldValue: any;

  /** New value */
  newValue: any;

  /** Impact of this change */
  impact: ChangeImpact;
}

export type PatternChangeType =
  | 'Added' // New field added
  | 'Modified' // Existing field modified
  | 'Removed' // Field removed
  | 'Renamed'; // Field renamed

/**
 * Impact of a pattern change.
 */
export interface ChangeImpact {
  /** Impact on performance */
  performanceImpact: number;

  /** Impact on compatibility */
  compatibilityImpact: CompatibilityImpact;

  /** Impact on dependencies */
  dependencyImpact: DependencyChangeImpact;

  /** Validation required */
  validationRequired: boolean;
}

export type CompatibilityImpact = 'None' | 'Minor' | 'Major' | 'Breaking';

/**
 * Impact on pattern dependencies.
 */
export interface DependencyImpact {
  /** Affected dependent patterns */
  affectedPatterns: string[];

  /** Type of impact */
  impactType: DependencyImpactType;

  /** Severity of impact */
  severity: ImpactSeverity;

  /** Required actions */
  requiredActions: DependencyAction[];
}

export type DependencyImpactType =
  | 'InterfaceChanged' // Pattern interface changed
  | 'BehaviorChanged' // Pattern behavior changed
  | 'PrerequisitesChanged' // Prerequisites changed
  | 'ConflictsChanged'; // Conflict relationships changed

export type ImpactSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Impact on individual dependency.
 */
export interface DependencyChangeImpact {
  /** Dependency pattern */
  dependencyPattern: string;

  /** Impact type */
  impactType: DependencyImpactType;

  /** Impact severity */
  severity: ImpactSeverity;

  /** Automatic resolution possible */
  canAutoResolve: boolean;

  /** Required manual actions */
  manualActions: string[];
}

/**
 * Action required for dependency resolution.
 */
export interface DependencyAction {
  /** Action type */
  actionType: DependencyActionType;

  /** Target pattern */
  targetPattern: string;

  /** Action description */
  description: string;

  /** Estimated effort */
  estimatedEffort: EffortLevel;

  /** Priority */
  priority: ActionPriority;
}

export type DependencyActionType =
  | 'UpdateInterface' // Update dependent pattern interface
  | 'UpdateBehavior' // Update dependent pattern behavior
  | 'AddPrerequisite' // Add new prerequisite
  | 'RemovePrerequisite' // Remove prerequisite
  | 'ResolveConflict'; // Resolve new conflict

/**
 * Update impact assessment.
 */
export interface UpdateImpact {
  /** Performance impact */
  performanceImpact: number;

  /** Memory impact */
  memoryImpact: number;

  /** Compatibility impact */
  compatibilityImpact: CompatibilityImpact;

  /** System stability impact */
  stabilityImpact: StabilityImpact;

  /** Rollback complexity */
  rollbackComplexity: ComplexityLevel;
}

export type StabilityImpact = 'Improved' | 'Unchanged' | 'Degraded';
export type ComplexityLevel = 'Trivial' | 'Simple' | 'Moderate' | 'Complex' | 'Very_Complex';

/**
 * Library validation result.
 */
export interface LibraryValidationResult {
  /** Overall validation status */
  overallStatus: ValidationStatus;

  /** Individual validation results */
  validationResults: LibraryValidationCheck[];

  /** Issues found */
  issuesFound: LibraryValidationIssue[];

  /** Performance impact */
  performanceImpact: ValidationPerformanceImpact;

  /** Validation duration */
  validationDuration: number;

  /** Validation timestamp */
  validationTimestamp: Date;
}

export type ValidationStatus = 'Valid' | 'Warning' | 'Invalid' | 'Error';

/**
 * Individual library validation check.
 */
export interface LibraryValidationCheck {
  /** Check name */
  checkName: string;

  /** Check description */
  description: string;

  /** Check result */
  result: ValidationCheckResult;

  /** Check duration */
  duration: number;

  /** Issues found */
  issuesFound: number;
}

export type ValidationCheckResult = 'Passed' | 'Warning' | 'Failed' | 'Skipped' | 'Error';

/**
 * Issue found during library validation.
 */
export interface LibraryValidationIssue {
  /** Issue type */
  issueType: LibraryValidationIssueType;

  /** Issue description */
  description: string;

  /** Affected patterns */
  affectedPatterns: string[];

  /** Issue severity */
  severity: 'Info' | 'Warning' | 'Error' | 'Critical';

  /** Suggested fix */
  suggestedFix: string;

  /** Auto-fix available */
  autoFixAvailable: boolean;
}

export type LibraryValidationIssueType =
  | 'ConflictDetected' // Pattern conflicts found
  | 'MissingDependency' // Missing dependencies
  | 'OrphanedPattern' // Patterns with no references
  | 'InvalidConfiguration' // Invalid pattern configuration
  | 'PerformanceIssue' // Performance problems detected
  | 'MemoryLeak' // Memory leaks detected
  | 'CorruptedData'; // Data corruption detected

/**
 * Performance impact of validation.
 */
export interface ValidationPerformanceImpact {
  /** CPU usage during validation */
  cpuUsage: number;

  /** Memory usage during validation */
  memoryUsage: number;

  /** I/O operations performed */
  ioOperations: number;

  /** Impact on concurrent operations */
  concurrentOperationImpact: number;
}

// ============================================================================
// EXPORTS AND SUMMARY
// ============================================================================

/**
 * Summary of the Pattern Library Management System:
 *
 * This comprehensive interface and type system provides the foundation for
 * managing the world's most advanced 6502 optimization pattern library.
 *
 * Key Capabilities:
 * 1. Scalable pattern registration and management for 470+ patterns
 * 2. Efficient pattern discovery with sub-100ms performance targets
 * 3. Sophisticated conflict detection and resolution
 * 4. Comprehensive performance monitoring and analytics
 * 5. Advanced debugging and diagnostic capabilities
 * 6. Robust batch processing and parallel optimization
 * 7. Hot-reloading and dynamic pattern updates
 *
 * Architecture Highlights:
 * - Multi-index pattern lookup for optimal performance
 * - Pattern dependency and conflict management
 * - Comprehensive metrics and statistics collection
 * - Plugin architecture for extensible pattern sets
 * - Advanced caching and optimization strategies
 * - Complete audit trails and debugging support
 *
 * This system enables professional-grade pattern management that scales
 * to handle hundreds of optimization patterns while maintaining excellent
 * performance and providing rich diagnostic capabilities.
 */
