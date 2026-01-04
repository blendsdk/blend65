/**
 * Metrics Collection Types - Data Collection and Measurement Types
 * Task 1.11: Core Optimization Pattern Infrastructure
 *
 * This file defines all types related to metrics data collection, measurement,
 * and storage. It provides comprehensive type definitions for capturing
 * performance, effectiveness, and quality metrics.
 *
 * Educational Focus:
 * - Metrics data collection and measurement techniques
 * - Performance monitoring and resource tracking
 * - Quality and effectiveness measurement systems
 * - Comprehensive audit trails and diagnostic data
 */

import { SourcePosition } from '@blend65/lexer';
import type { TargetPlatform, TransformationImpact } from './pattern-system';

// ============================================================================
// CORE COLLECTION TYPES
// ============================================================================

/**
 * Result of matching metrics collection.
 */
export interface MatchingMetricsCollection {
  /** Collection timestamp */
  timestamp: Date;

  /** Pattern being matched */
  patternId: string;

  /** Matching performance metrics */
  performanceMetrics: MatchingPerformanceMetrics;

  /** Matching accuracy metrics */
  accuracyMetrics: MatchingAccuracyMetrics;

  /** Resource usage metrics */
  resourceMetrics: MatchingResourceMetrics;

  /** Context information */
  contextMetrics: MatchingContextMetrics;

  /** Collection metadata */
  metadata: MetricsCollectionMetadata;
}

/**
 * Performance metrics for pattern matching.
 */
export interface MatchingPerformanceMetrics {
  /** Total matching time (microseconds) */
  totalMatchingTime: number;

  /** Average time per node (microseconds) */
  averageTimePerNode: number;

  /** Nodes processed */
  nodesProcessed: number;

  /** Matching throughput (nodes/second) */
  matchingThroughput: number;

  /** Cache hit rate */
  cacheHitRate: number;

  /** Cache efficiency */
  cacheEfficiency: number;

  /** Performance bottlenecks */
  bottlenecks: PerformanceBottleneck[];

  /** Performance variance */
  performanceVariance: PerformanceVarianceMetrics;
}

/**
 * Performance variance metrics.
 */
export interface PerformanceVarianceMetrics {
  /** Standard deviation of matching times */
  standardDeviation: number;

  /** Minimum matching time */
  minimumTime: number;

  /** Maximum matching time */
  maximumTime: number;

  /** Median matching time */
  medianTime: number;

  /** 95th percentile time */
  p95Time: number;

  /** 99th percentile time */
  p99Time: number;

  /** Variance causes */
  varianceCauses: VarianceCause[];
}

/**
 * Cause of performance variance.
 */
export interface VarianceCause {
  /** Cause type */
  causeType: VarianceCauseType;

  /** Cause description */
  description: string;

  /** Impact magnitude */
  impact: number;

  /** Frequency of occurrence */
  frequency: number;

  /** Mitigation available */
  mitigationAvailable: boolean;
}

export type VarianceCauseType =
  | 'NodeComplexity' // Node complexity varies
  | 'CacheMiss' // Cache miss causes variance
  | 'MemoryPressure' // Memory pressure affects performance
  | 'ContextLookup' // Context lookup times vary
  | 'PatternComplexity' // Pattern complexity affects time
  | 'SystemLoad'; // System load causes variance

/**
 * Performance bottleneck information.
 */
export interface PerformanceBottleneck {
  /** Bottleneck type */
  bottleneckType: BottleneckType;

  /** Bottleneck description */
  description: string;

  /** Performance impact (percentage) */
  performanceImpact: number;

  /** Occurrence frequency */
  frequency: number;

  /** Bottleneck location */
  location: BottleneckLocation;

  /** Optimization suggestions */
  optimizationSuggestions: string[];
}

export type BottleneckType =
  | 'CPUBound' // CPU-intensive operation
  | 'MemoryBound' // Memory bandwidth limited
  | 'CacheBound' // Cache performance limited
  | 'IOBound' // I/O limited
  | 'AlgorithmicComplexity' // Algorithm complexity issue
  | 'ContainerOverhead'; // Data structure overhead

/**
 * Location of performance bottleneck.
 */
export interface BottleneckLocation {
  /** Function or method name */
  functionName?: string;

  /** Source location if available */
  sourceLocation?: SourcePosition;

  /** Component identifier */
  component: string;

  /** Operation type */
  operationType: string;
}

/**
 * Accuracy metrics for pattern matching.
 */
export interface MatchingAccuracyMetrics {
  /** Total patterns matched */
  totalMatches: number;

  /** High confidence matches (>90%) */
  highConfidenceMatches: number;

  /** Medium confidence matches (70-90%) */
  mediumConfidenceMatches: number;

  /** Low confidence matches (<70%) */
  lowConfidenceMatches: number;

  /** Average confidence score */
  averageConfidence: number;

  /** False positive rate estimate */
  falsePositiveRate: number;

  /** False negative rate estimate */
  falseNegativeRate: number;

  /** Match quality distribution */
  qualityDistribution: MatchQualityDistribution;
}

/**
 * Distribution of match quality.
 */
export interface MatchQualityDistribution {
  /** Excellent matches (95-100% confidence) */
  excellent: number;

  /** Good matches (85-94% confidence) */
  good: number;

  /** Fair matches (70-84% confidence) */
  fair: number;

  /** Poor matches (50-69% confidence) */
  poor: number;

  /** Very poor matches (<50% confidence) */
  veryPoor: number;
}

/**
 * Resource usage metrics for matching.
 */
export interface MatchingResourceMetrics {
  /** Peak memory usage (bytes) */
  peakMemoryUsage: number;

  /** Average memory usage (bytes) */
  averageMemoryUsage: number;

  /** Memory allocations */
  memoryAllocations: number;

  /** Memory deallocations */
  memoryDeallocations: number;

  /** CPU utilization (percentage) */
  cpuUtilization: number;

  /** Cache utilization */
  cacheUtilization: CacheUtilizationMetrics;

  /** Resource efficiency score (0-100) */
  resourceEfficiency: number;
}

/**
 * Cache utilization metrics.
 */
export interface CacheUtilizationMetrics {
  /** Cache size used (bytes) */
  cacheSize: number;

  /** Cache hit rate (percentage) */
  hitRate: number;

  /** Cache miss rate (percentage) */
  missRate: number;

  /** Cache efficiency (0-100) */
  efficiency: number;

  /** Cache thrashing detected */
  thrashingDetected: boolean;

  /** Cache pressure level */
  pressureLevel: CachePressureLevel;
}

export type CachePressureLevel = 'Low' | 'Moderate' | 'High' | 'Critical' | 'Thrashing';

/**
 * Context metrics for matching.
 */
export interface MatchingContextMetrics {
  /** AST size metrics */
  astSizeMetrics: ASTSizeMetrics;

  /** Symbol table size metrics */
  symbolTableSizeMetrics: SymbolTableSizeMetrics;

  /** Optimization context complexity */
  contextComplexity: ContextComplexityMetrics;

  /** Platform-specific metrics */
  platformMetrics: PlatformSpecificMetrics;
}

/**
 * AST size metrics.
 */
export interface ASTSizeMetrics {
  /** Total AST nodes */
  totalNodes: number;

  /** AST depth */
  astDepth: number;

  /** Node type distribution */
  nodeTypeDistribution: Map<string, number>;

  /** AST complexity score */
  complexityScore: number;

  /** Estimated memory footprint */
  estimatedMemoryFootprint: number;
}

/**
 * Symbol table size metrics.
 */
export interface SymbolTableSizeMetrics {
  /** Total symbols */
  totalSymbols: number;

  /** Symbols by type */
  symbolsByType: Map<string, number>;

  /** Scope count */
  scopeCount: number;

  /** Average scope depth */
  averageScopeDepth: number;

  /** Symbol table complexity */
  symbolTableComplexity: number;
}

/**
 * Context complexity metrics.
 */
export interface ContextComplexityMetrics {
  /** Optimization level */
  optimizationLevel: number;

  /** Active patterns count */
  activePatternsCount: number;

  /** Applied transformations count */
  appliedTransformationsCount: number;

  /** Context complexity score */
  complexityScore: number;

  /** Context processing overhead */
  processingOverhead: number;
}

/**
 * Platform-specific metrics.
 */
export interface PlatformSpecificMetrics {
  /** Target platform */
  targetPlatform: TargetPlatform;

  /** Platform features used */
  platformFeaturesUsed: string[];

  /** Platform constraints active */
  activeConstraints: string[];

  /** Platform optimization opportunities */
  optimizationOpportunities: number;

  /** Platform compatibility score */
  compatibilityScore: number;
}

/**
 * Metadata for metrics collection.
 */
export interface MetricsCollectionMetadata {
  /** Collection method */
  collectionMethod: MetricsCollectionMethod;

  /** Collection accuracy */
  collectionAccuracy: MetricsAccuracy;

  /** Collection overhead */
  collectionOverhead: number;

  /** Data quality score */
  dataQualityScore: number;

  /** Collection warnings */
  collectionWarnings: MetricsCollectionWarning[];
}

export type MetricsCollectionMethod = 'HighPrecision' | 'Standard' | 'LowOverhead' | 'Sampling';
export type MetricsAccuracy = 'High' | 'Standard' | 'Approximate' | 'Estimate';

/**
 * Warning during metrics collection.
 */
export interface MetricsCollectionWarning {
  /** Warning type */
  warningType: MetricsWarningType;

  /** Warning message */
  message: string;

  /** Warning severity */
  severity: MetricsWarningSeverity;

  /** Impact on data quality */
  dataQualityImpact: DataQualityImpact;
}

export type MetricsWarningType =
  | 'HighOverhead' // Metrics collection overhead too high
  | 'DataLoss' // Some metrics data was lost
  | 'InaccurateTimings' // Timing measurements may be inaccurate
  | 'MemoryPressure' // Memory pressure affecting collection
  | 'SamplingBias'; // Sampling may introduce bias

export type MetricsWarningSeverity = 'Info' | 'Warning' | 'Error' | 'Critical';
export type DataQualityImpact = 'None' | 'Minor' | 'Moderate' | 'Major' | 'Severe';

// ============================================================================
// TRANSFORMATION METRICS TYPES
// ============================================================================

/**
 * Result of transformation metrics collection.
 */
export interface TransformationMetricsCollection {
  /** Collection timestamp */
  timestamp: Date;

  /** Pattern being transformed */
  patternId: string;

  /** Transformation performance metrics */
  performanceMetrics: TransformationPerformanceMetrics;

  /** Transformation effectiveness metrics */
  effectivenessMetrics: TransformationEffectivenessMetrics;

  /** Resource usage metrics */
  resourceMetrics: TransformationResourceMetrics;

  /** Quality metrics */
  qualityMetrics: TransformationQualityMetrics;

  /** Collection metadata */
  metadata: MetricsCollectionMetadata;
}

/**
 * Performance metrics for transformations.
 */
export interface TransformationPerformanceMetrics {
  /** Total transformation time (milliseconds) */
  totalTransformationTime: number;

  /** Transformation phases timing */
  phaseTimings: TransformationPhaseTimings;

  /** Transformation throughput */
  throughput: TransformationThroughput;

  /** Resource efficiency */
  resourceEfficiency: TransformationResourceEfficiency;

  /** Performance bottlenecks */
  bottlenecks: TransformationBottleneck[];

  /** Performance variance */
  variance: TransformationPerformanceVariance;
}

/**
 * Timing breakdown for transformation phases.
 */
export interface TransformationPhaseTimings {
  /** Analysis phase time */
  analysisTime: number;

  /** Preparation phase time */
  preparationTime: number;

  /** Transformation phase time */
  transformationTime: number;

  /** Validation phase time */
  validationTime: number;

  /** Cleanup phase time */
  cleanupTime: number;

  /** Phase timing distribution */
  phaseDistribution: PhaseTimingDistribution;
}

/**
 * Distribution of time across phases.
 */
export interface PhaseTimingDistribution {
  /** Analysis percentage */
  analysisPercentage: number;

  /** Preparation percentage */
  preparationPercentage: number;

  /** Transformation percentage */
  transformationPercentage: number;

  /** Validation percentage */
  validationPercentage: number;

  /** Cleanup percentage */
  cleanupPercentage: number;
}

/**
 * Transformation throughput metrics.
 */
export interface TransformationThroughput {
  /** Nodes transformed per second */
  nodesPerSecond: number;

  /** Patterns applied per second */
  patternsPerSecond: number;

  /** Bytes processed per second */
  bytesPerSecond: number;

  /** Throughput efficiency score */
  efficiencyScore: number;

  /** Throughput trends */
  trends: ThroughputTrend[];
}

/**
 * Throughput trend information.
 */
export interface ThroughputTrend {
  /** Trend metric */
  metric: ThroughputMetric;

  /** Trend direction */
  direction: ThroughputDirection;

  /** Trend magnitude */
  magnitude: number;

  /** Trend confidence */
  confidence: number;
}

export type ThroughputMetric =
  | 'NodesPerSecond'
  | 'PatternsPerSecond'
  | 'BytesPerSecond'
  | 'EfficiencyScore';
export type ThroughputDirection = 'Increasing' | 'Stable' | 'Decreasing' | 'Volatile';

/**
 * Resource efficiency for transformations.
 */
export interface TransformationResourceEfficiency {
  /** Memory efficiency (0-100) */
  memoryEfficiency: number;

  /** CPU efficiency (0-100) */
  cpuEfficiency: number;

  /** Cache efficiency (0-100) */
  cacheEfficiency: number;

  /** I/O efficiency (0-100) */
  ioEfficiency: number;

  /** Overall efficiency score */
  overallEfficiency: number;

  /** Efficiency trends */
  efficiencyTrends: EfficiencyTrend[];
}

/**
 * Efficiency trend information.
 */
export interface EfficiencyTrend {
  /** Resource type */
  resourceType: EfficiencyResourceType;

  /** Trend direction */
  direction: EfficiencyDirection;

  /** Improvement potential */
  improvementPotential: number;

  /** Trend analysis */
  analysis: EfficiencyTrendAnalysis;
}

export type EfficiencyResourceType = 'Memory' | 'CPU' | 'Cache' | 'IO' | 'Overall';
export type EfficiencyDirection = 'Improving' | 'Stable' | 'Degrading';

/**
 * Analysis of efficiency trends.
 */
export interface EfficiencyTrendAnalysis {
  /** Root causes */
  rootCauses: string[];

  /** Contributing factors */
  contributingFactors: EfficiencyFactor[];

  /** Improvement recommendations */
  improvementRecommendations: EfficiencyImprovement[];

  /** Trend projection */
  projection: EfficiencyProjection;
}

/**
 * Factor affecting efficiency.
 */
export interface EfficiencyFactor {
  /** Factor name */
  factorName: string;

  /** Factor impact */
  impact: EfficiencyFactorImpact;

  /** Factor controllability */
  controllability: FactorControllability;

  /** Optimization potential */
  optimizationPotential: number;
}

export type EfficiencyFactorImpact = 'Negligible' | 'Minor' | 'Moderate' | 'Major' | 'Critical';
export type FactorControllability =
  | 'Uncontrollable'
  | 'Difficult'
  | 'Moderate'
  | 'Easy'
  | 'FullControl';

/**
 * Efficiency improvement recommendation.
 */
export interface EfficiencyImprovement {
  /** Improvement description */
  description: string;

  /** Expected efficiency gain */
  expectedGain: number;

  /** Implementation effort */
  implementationEffort: EfficiencyImprovementEffort;

  /** Implementation priority */
  priority: EfficiencyImprovementPriority;
}

export type EfficiencyImprovementEffort = 'Minimal' | 'Low' | 'Medium' | 'High' | 'Extensive';
export type EfficiencyImprovementPriority = 'Low' | 'Medium' | 'High' | 'Critical' | 'Essential';

/**
 * Efficiency projection.
 */
export interface EfficiencyProjection {
  /** Projected efficiency in 1 month */
  oneMonth: number;

  /** Projected efficiency in 3 months */
  threeMonths: number;

  /** Projected efficiency in 6 months */
  sixMonths: number;

  /** Projection confidence */
  confidence: number;

  /** Key assumptions */
  assumptions: string[];
}

/**
 * Bottleneck specific to transformations.
 */
export interface TransformationBottleneck {
  /** Bottleneck type */
  bottleneckType: TransformationBottleneckType;

  /** Bottleneck description */
  description: string;

  /** Time impact (milliseconds) */
  timeImpact: number;

  /** Frequency of occurrence */
  frequency: number;

  /** Bottleneck severity */
  severity: BottleneckSeverity;

  /** Optimization potential */
  optimizationPotential: BottleneckOptimizationPotential;
}

export type TransformationBottleneckType =
  | 'NodeCreation' // Creating new AST nodes is slow
  | 'NodeModification' // Modifying AST nodes is slow
  | 'SymbolLookup' // Symbol table lookups are slow
  | 'TypeChecking' // Type checking is slow
  | 'ValidationOverhead' // Validation is taking too long
  | 'MemoryAllocation'; // Memory allocation is slow

export type BottleneckSeverity = 'Minor' | 'Moderate' | 'Major' | 'Critical' | 'Blocking';

/**
 * Optimization potential for bottleneck.
 */
export interface BottleneckOptimizationPotential {
  /** Potential improvement (percentage) */
  potentialImprovement: number;

  /** Optimization difficulty */
  difficulty: OptimizationDifficulty;

  /** Optimization approaches */
  approaches: BottleneckOptimizationApproach[];

  /** Expected benefits */
  expectedBenefits: BottleneckOptimizationBenefit[];
}

export type OptimizationDifficulty = 'Easy' | 'Moderate' | 'Hard' | 'VeryHard' | 'Extreme';

/**
 * Approach for optimizing bottleneck.
 */
export interface BottleneckOptimizationApproach {
  /** Approach name */
  approachName: string;

  /** Approach description */
  description: string;

  /** Expected improvement */
  expectedImprovement: number;

  /** Implementation complexity */
  complexity: ApproachComplexity;

  /** Implementation risk */
  risk: ApproachRisk;
}

export type ApproachComplexity = 'Simple' | 'Moderate' | 'Complex' | 'VeryComplex';
export type ApproachRisk = 'Low' | 'Medium' | 'High' | 'VeryHigh';

/**
 * Benefit of bottleneck optimization.
 */
export interface BottleneckOptimizationBenefit {
  /** Benefit type */
  benefitType: BottleneckBenefitType;

  /** Benefit magnitude */
  magnitude: number;

  /** Benefit confidence */
  confidence: number;

  /** Benefit timeline */
  timeline: BenefitRealizationTimeline;
}

export type BottleneckBenefitType =
  | 'Performance'
  | 'Throughput'
  | 'Efficiency'
  | 'Scalability'
  | 'UserExperience';
export type BenefitRealizationTimeline = 'Immediate' | 'Short' | 'Medium' | 'Long';

/**
 * Performance variance for transformations.
 */
export interface TransformationPerformanceVariance {
  /** Time variance */
  timeVariance: PerformanceVarianceMetrics;

  /** Quality variance */
  qualityVariance: QualityVarianceMetrics;

  /** Resource usage variance */
  resourceVariance: ResourceVarianceMetrics;

  /** Variance root causes */
  rootCauses: VarianceRootCause[];
}

/**
 * Quality variance metrics.
 */
export interface QualityVarianceMetrics {
  /** Performance improvement variance */
  improvementVariance: number;

  /** Code quality variance */
  qualityVariance: number;

  /** Validation success variance */
  validationVariance: number;

  /** Quality consistency score */
  consistencyScore: number;
}

/**
 * Resource usage variance metrics.
 */
export interface ResourceVarianceMetrics {
  /** Memory usage variance */
  memoryVariance: number;

  /** CPU usage variance */
  cpuVariance: number;

  /** Cache usage variance */
  cacheVariance: number;

  /** Resource predictability score */
  predictabilityScore: number;
}

/**
 * Root cause of performance variance.
 */
export interface VarianceRootCause {
  /** Cause category */
  category: VarianceCategory;

  /** Cause description */
  description: string;

  /** Contribution to variance */
  contribution: number;

  /** Controllability */
  controllability: CauseControllability;

  /** Mitigation strategies */
  mitigationStrategies: VarianceMitigationStrategy[];
}

export type VarianceCategory =
  | 'InputData'
  | 'SystemLoad'
  | 'AlgorithmicComplexity'
  | 'ResourceContention'
  | 'ExternalFactors';
export type CauseControllability =
  | 'FullyControllable'
  | 'PartiallyControllable'
  | 'MinimallyControllable'
  | 'Uncontrollable';

/**
 * Variance mitigation strategy.
 */
export interface VarianceMitigationStrategy {
  /** Strategy name */
  strategyName: string;

  /** Strategy description */
  description: string;

  /** Expected variance reduction */
  expectedReduction: number;

  /** Implementation effort */
  implementationEffort: VarianceMitigationEffort;

  /** Strategy effectiveness */
  effectiveness: VarianceMitigationEffectiveness;
}

export type VarianceMitigationEffort = 'Minimal' | 'Low' | 'Medium' | 'High' | 'Extensive';
export type VarianceMitigationEffectiveness = 'Low' | 'Medium' | 'High' | 'VeryHigh' | 'Excellent';

/**
 * Effectiveness metrics for transformations.
 */
export interface TransformationEffectivenessMetrics {
  /** Actual performance improvement achieved */
  actualImprovement: TransformationImpact;

  /** Expected vs actual comparison */
  expectationComparison: ExpectationComparison;

  /** Transformation success rate */
  successRate: number;

  /** Validation pass rate */
  validationPassRate: number;

  /** Rollback rate */
  rollbackRate: number;

  /** Effectiveness trends */
  effectivenessTrends: EffectivenessTrend[];

  /** Quality impact */
  qualityImpact: TransformationQualityImpact;
}

/**
 * Comparison of expected vs actual results.
 */
export interface ExpectationComparison {
  /** Predicted improvement */
  predictedImprovement: number;

  /** Actual improvement */
  actualImprovement: number;

  /** Prediction accuracy */
  predictionAccuracy: number;

  /** Prediction error analysis */
  errorAnalysis: PredictionErrorAnalysis;

  /** Expectation alignment score */
  alignmentScore: number;
}

/**
 * Analysis of prediction errors.
 */
export interface PredictionErrorAnalysis {
  /** Error magnitude */
  errorMagnitude: number;

  /** Error direction */
  errorDirection: PredictionErrorDirection;

  /** Error patterns */
  errorPatterns: PredictionErrorPattern[];

  /** Error causes */
  errorCauses: PredictionErrorCause[];

  /** Correction recommendations */
  correctionRecommendations: string[];
}

export type PredictionErrorDirection = 'Overestimated' | 'Underestimated' | 'Variable';

/**
 * Pattern of prediction errors.
 */
export interface PredictionErrorPattern {
  /** Pattern description */
  description: string;

  /** Pattern frequency */
  frequency: number;

  /** Pattern impact */
  impact: PredictionErrorImpact;

  /** Pattern detection method */
  detectionMethod: PatternDetectionMethod;
}

export type PredictionErrorImpact = 'Low' | 'Medium' | 'High' | 'Critical';
export type PatternDetectionMethod = 'Statistical' | 'MachineLearning' | 'Heuristic' | 'Manual';

/**
 * Cause of prediction error.
 */
export interface PredictionErrorCause {
  /** Cause type */
  causeType: PredictionErrorCauseType;

  /** Cause description */
  description: string;

  /** Cause frequency */
  frequency: number;

  /** Mitigation difficulty */
  mitigationDifficulty: MitigationDifficulty;
}

export type PredictionErrorCauseType =
  | 'InsufficientData' // Not enough historical data
  | 'ChangedConditions' // Conditions changed from training data
  | 'ModelLimitations' // Model has inherent limitations
  | 'MeasurementError' // Measurement accuracy issues
  | 'ExternalFactors'; // External factors not considered

export type MitigationDifficulty = 'Easy' | 'Moderate' | 'Hard' | 'VeryHard' | 'Impossible';

/**
 * Effectiveness trend information.
 */
export interface EffectivenessTrend {
  /** Trend metric */
  metric: EffectivenessTrendMetric;

  /** Trend direction */
  direction: EffectivenessTrendDirection;

  /** Trend strength */
  strength: TrendStrength;

  /** Trend analysis */
  analysis: EffectivenessTrendAnalysis;
}

export type EffectivenessTrendMetric =
  | 'SuccessRate'
  | 'ImprovementMagnitude'
  | 'ValidationRate'
  | 'RollbackRate';
export type EffectivenessTrendDirection = 'Improving' | 'Stable' | 'Declining' | 'Volatile';
export type TrendStrength = 'Weak' | 'Moderate' | 'Strong' | 'VeryStrong';

/**
 * Analysis of effectiveness trends.
 */
export interface EffectivenessTrendAnalysis {
  /** Trend drivers */
  drivers: EffectivenessTrendDriver[];

  /** Trend projections */
  projections: EffectivenessTrendProjection[];

  /** Intervention recommendations */
  interventionRecommendations: EffectivenessIntervention[];

  /** Trend confidence */
  confidence: number;
}

/**
 * Driver of effectiveness trends.
 */
export interface EffectivenessTrendDriver {
  /** Driver name */
  driverName: string;

  /** Driver impact */
  impact: TrendDriverImpact;

  /** Driver predictability */
  predictability: DriverPredictability;

  /** Driver control level */
  controlLevel: DriverControlLevel;
}

export type TrendDriverImpact = 'Negligible' | 'Minor' | 'Moderate' | 'Major' | 'Dominant';
export type DriverPredictability =
  | 'Predictable'
  | 'MostlyPredictable'
  | 'SomewhatPredictable'
  | 'Unpredictable';
export type DriverControlLevel = 'FullControl' | 'PartialControl' | 'LimitedControl' | 'NoControl';

/**
 * Projection of effectiveness trends.
 */
export interface EffectivenessTrendProjection {
  /** Time horizon */
  timeHorizon: TimeHorizon;

  /** Projected value */
  projectedValue: number;

  /** Projection confidence */
  confidence: number;

  /** Key assumptions */
  assumptions: ProjectionAssumption[];

  /** Risk factors */
  riskFactors: ProjectionRiskFactor[];
}

export type TimeHorizon = 'OneWeek' | 'OneMonth' | 'ThreeMonths' | 'SixMonths' | 'OneYear';

/**
 * Assumption used in projection.
 */
export interface ProjectionAssumption {
  /** Assumption description */
  description: string;

  /** Assumption validity */
  validity: AssumptionValidity;

  /** Impact if assumption is wrong */
  impactIfWrong: AssumptionImpact;

  /** Monitoring strategy */
  monitoringStrategy: AssumptionMonitoringStrategy;
}

export type AssumptionValidity =
  | 'VeryLikely'
  | 'Likely'
  | 'Uncertain'
  | 'Unlikely'
  | 'VeryUnlikely';
export type AssumptionImpact = 'Negligible' | 'Minor' | 'Moderate' | 'Major' | 'Critical';
export type AssumptionMonitoringStrategy =
  | 'Continuous'
  | 'Periodic'
  | 'Triggered'
  | 'Manual'
  | 'None';

/**
 * Risk factor for projections.
 */
export interface ProjectionRiskFactor {
  /** Risk description */
  description: string;

  /** Risk probability */
  probability: number;

  /** Risk impact on projection */
  projectionImpact: number;

  /** Risk mitigation */
  mitigation: ProjectionRiskMitigation;
}

/**
 * Mitigation for projection risks.
 */
export interface ProjectionRiskMitigation {
  /** Mitigation approach */
  approach: RiskMitigationApproach;

  /** Mitigation effectiveness */
  effectiveness: number;

  /** Implementation cost */
  implementationCost: RiskMitigationCost;

  /** Mitigation timeline */
  timeline: RiskMitigationTimeline;
}

export type RiskMitigationApproach = 'Prevention' | 'Monitoring' | 'Contingency' | 'Acceptance';
export type RiskMitigationCost = 'None' | 'Low' | 'Medium' | 'High' | 'VeryHigh';
export type RiskMitigationTimeline = 'Immediate' | 'Short' | 'Medium' | 'Long';

/**
 * Intervention recommendation for effectiveness.
 */
export interface EffectivenessIntervention {
  /** Intervention type */
  interventionType: InterventionType;

  /** Intervention description */
  description: string;

  /** Expected effectiveness improvement */
  expectedImprovement: number;

  /** Intervention urgency */
  urgency: InterventionUrgency;

  /** Implementation guidance */
  implementationGuidance: string[];
}

export type InterventionType =
  | 'ProcessImprovement' // Improve development process
  | 'ToolUpgrade' // Upgrade tools or techniques
  | 'TrainingProgram' // Training for development team
  | 'QualityGate' // Add quality gates
  | 'AutomationIncrease' // Increase automation level
  | 'ResourceReallocation'; // Reallocate resources

export type InterventionUrgency = 'Low' | 'Medium' | 'High' | 'Critical' | 'Immediate';

/**
 * Quality impact of transformation.
 */
export interface TransformationQualityImpact {
  /** Code quality impact */
  codeQualityImpact: CodeQualityImpact;

  /** Maintainability impact */
  maintainabilityImpact: MaintainabilityImpact;

  /** Readability impact */
  readabilityImpact: ReadabilityImpact;

  /** Performance impact */
  performanceImpact: PerformanceQualityImpact;

  /** Overall quality score change */
  overallQualityChange: number;
}

/**
 * Code quality impact.
 */
export interface CodeQualityImpact {
  /** Quality metric changes */
  metricChanges: QualityMetricChange[];

  /** Quality trends */
  qualityTrends: CodeQualityTrend[];

  /** Quality issues introduced */
  issuesIntroduced: number;

  /** Quality issues resolved */
  issuesResolved: number;
}

/**
 * Change in quality metric.
 */
export interface QualityMetricChange {
  /** Metric name */
  metricName: string;

  /** Before value */
  beforeValue: number;

  /** After value */
  afterValue: number;

  /** Change magnitude */
  changeMagnitude: number;

  /** Change significance */
  significance: ChangeSignificance;
}

export type ChangeSignificance = 'Negligible' | 'Minor' | 'Moderate' | 'Significant' | 'Major';

/**
 * Code quality trend.
 */
export interface CodeQualityTrend {
  /** Trend metric */
  metric: CodeQualityTrendMetric;

  /** Trend direction */
  direction: QualityTrendDirection;

  /** Trend velocity */
  velocity: number;

  /** Trend projection */
  projection: QualityTrendProjection;
}

export type CodeQualityTrendMetric =
  | 'Complexity'
  | 'Maintainability'
  | 'Readability'
  | 'Testability'
  | 'Documentation';
export type QualityTrendDirection = 'Improving' | 'Stable' | 'Declining' | 'Volatile';

/**
 * Quality trend projection.
 */
export interface QualityTrendProjection {
  /** Projected quality score */
  projectedScore: number;

  /** Projection timeframe */
  timeframe: number;

  /** Projection confidence */
  confidence: number;

  /** Key influencing factors */
  influencingFactors: QualityInfluencingFactor[];
}

/**
 * Factor influencing quality trends.
 */
export interface QualityInfluencingFactor {
  /** Factor name */
  factorName: string;

  /** Factor weight */
  weight: number;

  /** Factor trend */
  trend: FactorTrendDirection;

  /** Factor controllability */
  controllability: FactorControllability;
}

export type FactorTrendDirection = 'Positive' | 'Neutral' | 'Negative';

/**
 * Maintainability impact assessment.
 */
export interface MaintainabilityImpact {
  /** Complexity change */
  complexityChange: number;

  /** Dependencies change */
  dependenciesChange: number;

  /** Documentation quality change */
  documentationChange: number;

  /** Test coverage change */
  testCoverageChange: number;

  /** Overall maintainability score */
  overallScore: number;
}

/**
 * Readability impact assessment.
 */
export interface ReadabilityImpact {
  /** Code clarity change */
  clarityChange: number;

  /** Naming quality change */
  namingQualityChange: number;

  /** Structure clarity change */
  structureClarityChange: number;

  /** Comment quality change */
  commentQualityChange: number;

  /** Overall readability score */
  overallScore: number;
}

/**
 * Performance quality impact.
 */
export interface PerformanceQualityImpact {
  /** Performance improvement */
  improvement: number;

  /** Performance consistency */
  consistency: number;

  /** Performance predictability */
  predictability: number;

  /** Performance maintainability */
  maintainability: number;

  /** Overall performance quality */
  overallQuality: number;
}

/**
 * Resource metrics for transformations.
 */
export interface TransformationResourceMetrics {
  /** Memory usage metrics */
  memoryUsage: TransformationMemoryUsage;

  /** CPU usage metrics */
  cpuUsage: TransformationCPUUsage;

  /** I/O usage metrics */
  ioUsage: TransformationIOUsage;

  /** Cache usage metrics */
  cacheUsage: TransformationCacheUsage;

  /** Resource efficiency analysis */
  efficiencyAnalysis: ResourceEfficiencyAnalysis;
}

/**
 * Memory usage for transformations.
 */
export interface TransformationMemoryUsage {
  /** Peak memory usage */
  peakUsage: number;

  /** Average memory usage */
  averageUsage: number;

  /** Memory allocation pattern */
  allocationPattern: MemoryAllocationPattern;

  /** Memory efficiency */
  efficiency: MemoryEfficiency;

  /** Memory leaks detected */
  leaksDetected: MemoryLeakInfo[];
}

export type MemoryAllocationPattern = 'Steady' | 'Bursty' | 'Growing' | 'Oscillating' | 'Random';

/**
 * Memory efficiency metrics.
 */
export interface MemoryEfficiency {
  /** Utilization efficiency */
  utilizationEfficiency: number;

  /** Allocation efficiency */
  allocationEfficiency: number;

  /** Fragmentation level */
  fragmentationLevel: number;

  /** Waste percentage */
  wastePercentage: number;
}

/**
 * Memory leak information.
 */
export interface MemoryLeakInfo {
  /** Leak location */
  location: SourcePosition;

  /** Leak size estimate */
  sizeEstimate: number;

  /** Leak growth rate */
  growthRate: number;

  /** Leak severity */
  severity: MemoryLeakSeverity;

  /** Fix recommendations */
  fixRecommendations: string[];
}

export type MemoryLeakSeverity = 'Minor' | 'Moderate' | 'Major' | 'Critical' | 'Severe';

/**
 * CPU usage for transformations.
 */
export interface TransformationCPUUsage {
  /** Peak CPU utilization */
  peakUtilization: number;

  /** Average CPU utilization */
  averageUtilization: number;

  /** CPU usage pattern */
  usagePattern: CPUUsagePattern;

  /** CPU efficiency */
  efficiency: CPUEfficiency;

  /** CPU hotspots */
  hotspots: CPUHotspot[];
}

export type CPUUsagePattern = 'Steady' | 'Bursty' | 'Cyclic' | 'Spike' | 'Irregular';

/**
 * CPU efficiency metrics.
 */
export interface CPUEfficiency {
  /** Instruction efficiency */
  instructionEfficiency: number;

  /** Branch prediction efficiency */
  branchPredictionEfficiency: number;

  /** Cache utilization efficiency */
  cacheUtilizationEfficiency: number;

  /** Parallelization efficiency */
  parallelizationEfficiency: number;
}

/**
 * CPU hotspot information.
 */
export interface CPUHotspot {
  /** Hotspot location */
  location: SourcePosition;

  /** CPU utilization percentage */
  utilizationPercentage: number;

  /** Hotspot duration */
  duration: number;

  /** Hotspot frequency */
  frequency: number;

  /** Optimization recommendations */
  optimizationRecommendations: string[];
}

/**
 * I/O usage for transformations.
 */
export interface TransformationIOUsage {
  /** Total I/O operations */
  totalOperations: number;

  /** I/O throughput (operations/second) */
  throughput: number;

  /** I/O latency metrics */
  latencyMetrics: IOLatencyMetrics;

  /** I/O efficiency */
  efficiency: IOEfficiency;

  /** I/O patterns */
  patterns: IOPatternAnalysis[];
}

/**
 * I/O latency metrics.
 */
export interface IOLatencyMetrics {
  /** Average latency */
  averageLatency: number;

  /** Minimum latency */
  minimumLatency: number;

  /** Maximum latency */
  maximumLatency: number;

  /** Latency distribution */
  latencyDistribution: LatencyDistribution;

  /** Latency spikes */
  latencySpikes: LatencySpike[];
}

/**
 * Distribution of I/O latencies.
 */
export interface LatencyDistribution {
  /** P50 latency */
  p50: number;

  /** P95 latency */
  p95: number;

  /** P99 latency */
  p99: number;

  /** P99.9 latency */
  p999: number;

  /** Standard deviation */
  standardDeviation: number;
}

/**
 * I/O latency spike information.
 */
export interface LatencySpike {
  /** Spike timestamp */
  timestamp: Date;

  /** Spike magnitude */
  magnitude: number;

  /** Spike duration */
  duration: number;

  /** Spike cause */
  cause: LatencySpikeCause;
}

export type LatencySpikeCause =
  | 'SystemLoad'
  | 'ResourceContention'
  | 'GarbageCollection'
  | 'NetworkDelay'
  | 'DiskIO'
  | 'Unknown';

/**
 * I/O efficiency metrics.
 */
export interface IOEfficiency {
  /** Bandwidth utilization */
  bandwidthUtilization: number;

  /** Operation efficiency */
  operationEfficiency: number;

  /** Queue efficiency */
  queueEfficiency: number;

  /** Overall I/O efficiency */
  overallEfficiency: number;
}

/**
 * I/O pattern analysis.
 */
export interface IOPatternAnalysis {
  /** Pattern type */
  patternType: IOPatternType;

  /** Pattern frequency */
  frequency: number;

  /** Pattern efficiency */
  efficiency: number;

  /** Optimization recommendations */
  optimizations: IOOptimizationRecommendation[];
}

export type IOPatternType = 'Sequential' | 'Random' | 'Burst' | 'Streaming' | 'Batched';

/**
 * I/O optimization recommendation.
 */
export interface IOOptimizationRecommendation {
  /** Recommendation description */
  description: string;

  /** Expected improvement */
  expectedImprovement: number;

  /** Implementation effort */
  implementationEffort: OptimizationImplementationEffort;

  /** Implementation risk */
  risk: OptimizationRisk;
}

export type OptimizationImplementationEffort = 'Minimal' | 'Low' | 'Medium' | 'High' | 'VeryHigh';
export type OptimizationRisk = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Cache usage for transformations.
 */
export interface TransformationCacheUsage {
  /** Cache operations count */
  operationsCount: number;

  /** Cache hit rate */
  hitRate: number;

  /** Cache efficiency */
  efficiency: number;

  /** Cache utilization */
  utilization: number;

  /** Cache performance */
  performance: CachePerformanceDetails;
}

/**
 * Cache performance details.
 */
export interface CachePerformanceDetails {
  /** Average access time */
  averageAccessTime: number;

  /** Cache throughput */
  throughput: number;

  /** Cache pressure */
  pressure: CachePressureLevel;

  /** Performance trends */
  trends: CachePerformanceTrend[];
}

/**
 * Cache performance trend.
 */
export interface CachePerformanceTrend {
  /** Trend metric */
  metric: CacheMetric;

  /** Trend direction */
  direction: CacheTrendDirection;

  /** Trend analysis */
  analysis: string;
}

export type CacheMetric = 'HitRate' | 'AccessTime' | 'Throughput' | 'Efficiency';
export type CacheTrendDirection = 'Improving' | 'Stable' | 'Degrading';

/**
 * Resource efficiency analysis.
 */
export interface ResourceEfficiencyAnalysis {
  /** Overall efficiency score */
  overallScore: number;

  /** Component efficiency scores */
  componentScores: Map<string, number>;

  /** Efficiency bottlenecks */
  bottlenecks: EfficiencyBottleneck[];

  /** Improvement opportunities */
  improvementOpportunities: EfficiencyOpportunity[];
}

/**
 * Efficiency bottleneck.
 */
export interface EfficiencyBottleneck {
  /** Bottleneck name */
  name: string;

  /** Efficiency impact */
  impact: number;

  /** Bottleneck cause */
  cause: string;

  /** Resolution strategy */
  resolutionStrategy: string;
}

/**
 * Efficiency improvement opportunity.
 */
export interface EfficiencyOpportunity {
  /** Opportunity description */
  description: string;

  /** Potential gain */
  potentialGain: number;

  /** Implementation effort */
  effort: EfficiencyImprovementEffort;

  /** Success probability */
  successProbability: number;
}

/**
 * Quality metrics for transformations.
 */
export interface TransformationQualityMetrics {
  /** Quality before transformation */
  qualityBefore: QualityScore;

  /** Quality after transformation */
  qualityAfter: QualityScore;

  /** Quality improvement */
  qualityImprovement: QualityImprovement;

  /** Quality regression risks */
  regressionRisks: QualityRegressionRisk[];

  /** Quality validation results */
  validationResults: QualityValidationResult[];
}

/**
 * Quality score assessment.
 */
export interface QualityScore {
  /** Overall quality score */
  overallScore: number;

  /** Component scores */
  componentScores: Map<string, number>;

  /** Score confidence */
  confidence: number;

  /** Score methodology */
  methodology: QualityScoreMethodology;
}

export type QualityScoreMethodology = 'Automated' | 'Manual' | 'Hybrid' | 'Statistical';

/**
 * Quality improvement measurement.
 */
export interface QualityImprovement {
  /** Improvement magnitude */
  magnitude: number;

  /** Improvement areas */
  areas: QualityImprovementArea[];

  /** Improvement confidence */
  confidence: number;

  /** Improvement validation */
  validation: QualityImprovementValidation;
}

/**
 * Quality improvement area.
 */
export interface QualityImprovementArea {
  /** Area name */
  areaName: string;

  /** Improvement amount */
  improvement: number;

  /** Area importance */
  importance: AreaImportance;

  /** Measurement reliability */
  reliability: MeasurementReliability;
}

export type AreaImportance = 'Low' | 'Medium' | 'High' | 'Critical';
export type MeasurementReliability = 'Low' | 'Medium' | 'High' | 'VeryHigh';

/**
 * Quality improvement validation.
 */
export interface QualityImprovementValidation {
  /** Validation method */
  method: QualityValidationMethod;

  /** Validation result */
  result: QualityValidationResultType;

  /** Validation confidence */
  confidence: number;

  /** Validation issues */
  issues: QualityValidationIssue[];
}

export type QualityValidationMethod = 'Automated' | 'Manual' | 'PeerReview' | 'Statistical';
export type QualityValidationResultType = 'Confirmed' | 'Likely' | 'Uncertain' | 'Disputed';

/**
 * Quality validation issue.
 */
export interface QualityValidationIssue {
  /** Issue description */
  description: string;

  /** Issue severity */
  severity: QualityIssueSeverity;

  /** Issue impact */
  impact: QualityIssueImpact;

  /** Resolution required */
  resolutionRequired: boolean;
}

export type QualityIssueSeverity = 'Minor' | 'Moderate' | 'Major' | 'Critical';
export type QualityIssueImpact = 'Local' | 'Component' | 'Module' | 'System';

/**
 * Quality regression risk.
 */
export interface QualityRegressionRisk {
  /** Risk description */
  description: string;

  /** Risk probability */
  probability: number;

  /** Risk impact */
  impact: QualityRegressionImpact;

  /** Risk mitigation */
  mitigation: QualityRiskMitigation;
}

export type QualityRegressionImpact = 'Minor' | 'Moderate' | 'Major' | 'Severe';

/**
 * Quality risk mitigation.
 */
export interface QualityRiskMitigation {
  /** Mitigation strategy */
  strategy: string;

  /** Mitigation effectiveness */
  effectiveness: number;

  /** Implementation cost */
  cost: MitigationCost;
}

export type MitigationCost = 'Low' | 'Medium' | 'High' | 'VeryHigh';

/**
 * Quality validation result.
 */
export interface QualityValidationResult {
  /** Validation area */
  area: string;

  /** Validation passed */
  passed: boolean;

  /** Validation score */
  score: number;

  /** Validation details */
  details: string[];
}

// ============================================================================
// VALIDATION AND SESSION METRICS
// ============================================================================

/**
 * Validation metrics collection.
 */
export interface ValidationMetricsCollection {
  /** Collection timestamp */
  timestamp: Date;

  /** Pattern being validated */
  patternId: string;

  /** Validation performance */
  validationPerformance: ValidationPerformanceMetrics;

  /** Validation accuracy */
  validationAccuracy: ValidationAccuracyMetrics;

  /** Resource usage */
  resourceUsage: ValidationResourceUsage;

  /** Collection metadata */
  metadata: MetricsCollectionMetadata;
}

/**
 * Validation performance metrics.
 */
export interface ValidationPerformanceMetrics {
  /** Total validation time */
  totalValidationTime: number;

  /** Validation throughput */
  validationThroughput: number;

  /** Validation bottlenecks */
  bottlenecks: ValidationBottleneck[];

  /** Validation efficiency */
  efficiency: ValidationEfficiency;
}

/**
 * Validation bottleneck.
 */
export interface ValidationBottleneck {
  /** Bottleneck type */
  bottleneckType: string;

  /** Bottleneck description */
  description: string;

  /** Performance impact */
  impact: number;

  /** Occurrence frequency */
  frequency: number;
}

/**
 * Validation efficiency metrics.
 */
export interface ValidationEfficiency {
  /** Overall efficiency */
  overallEfficiency: number;

  /** Component efficiency */
  componentEfficiency: Map<string, number>;

  /** Improvement potential */
  improvementPotential: number;
}

/**
 * Validation accuracy metrics.
 */
export interface ValidationAccuracyMetrics {
  /** Accuracy score */
  accuracyScore: number;

  /** False positive rate */
  falsePositiveRate: number;

  /** False negative rate */
  falseNegativeRate: number;

  /** Confidence distribution */
  confidenceDistribution: ConfidenceDistribution;
}

/**
 * Confidence distribution.
 */
export interface ConfidenceDistribution {
  /** High confidence validations */
  high: number;

  /** Medium confidence validations */
  medium: number;

  /** Low confidence validations */
  low: number;
}

/**
 * Validation resource usage.
 */
export interface ValidationResourceUsage {
  /** Memory usage */
  memoryUsage: number;

  /** CPU usage */
  cpuUsage: number;

  /** I/O usage */
  ioUsage: number;

  /** Resource efficiency */
  resourceEfficiency: number;
}

/**
 * Optimization session data.
 */
export interface OptimizationSessionData {
  /** Session identifier */
  sessionId: string;

  /** Session start time */
  startTime: Date;

  /** Session end time */
  endTime: Date;

  /** Patterns applied */
  patternsApplied: string[];

  /** Total improvement achieved */
  totalImprovement: number;

  /** Session metrics */
  sessionMetrics: SessionMetrics;
}

/**
 * Session metrics summary.
 */
export interface SessionMetrics {
  /** Total patterns processed */
  totalPatterns: number;

  /** Successful patterns */
  successfulPatterns: number;

  /** Failed patterns */
  failedPatterns: number;

  /** Average improvement per pattern */
  averageImprovement: number;

  /** Session duration */
  sessionDuration: number;
}

/**
 * Session metrics collection.
 */
export interface SessionMetricsCollection {
  /** Session identifier */
  sessionId: string;

  /** Collection timestamp */
  timestamp: Date;

  /** Session summary */
  sessionSummary: SessionSummaryMetrics;

  /** Performance metrics */
  performanceMetrics: SessionPerformanceMetrics;

  /** Quality metrics */
  qualityMetrics: SessionQualityMetrics;

  /** Resource metrics */
  resourceMetrics: SessionResourceMetrics;
}

/**
 * Session summary metrics.
 */
export interface SessionSummaryMetrics {
  /** Total optimizations attempted */
  totalOptimizations: number;

  /** Success rate */
  successRate: number;

  /** Average improvement */
  averageImprovement: number;

  /** Session efficiency */
  sessionEfficiency: number;
}

/**
 * Session performance metrics.
 */
export interface SessionPerformanceMetrics {
  /** Total session time */
  totalSessionTime: number;

  /** Optimization time */
  optimizationTime: number;

  /** Validation time */
  validationTime: number;

  /** Overhead time */
  overhead: number;
}

/**
 * Session quality metrics.
 */
export interface SessionQualityMetrics {
  /** Quality improvement */
  qualityImprovement: number;

  /** Issues introduced */
  issuesIntroduced: number;

  /** Issues resolved */
  issuesResolved: number;

  /** Quality score */
  qualityScore: number;
}

/**
 * Session resource metrics.
 */
export interface SessionResourceMetrics {
  /** Peak memory usage */
  peakMemoryUsage: number;

  /** Average CPU usage */
  averageCpuUsage: number;

  /** Total I/O operations */
  totalIoOperations: number;

  /** Resource efficiency */
  resourceEfficiency: number;
}

// ============================================================================
// SYSTEM METRICS TYPES
// ============================================================================

/**
 * System performance data.
 */
export interface SystemPerformanceData {
  /** Data timestamp */
  timestamp: Date;

  /** System load metrics */
  systemLoad: SystemLoadMetrics;

  /** Memory usage metrics */
  memoryUsage: SystemMemoryMetrics;

  /** CPU usage metrics */
  cpuUsage: SystemCPUMetrics;

  /** I/O metrics */
  ioMetrics: SystemIOMetrics;
}

/**
 * System load metrics.
 */
export interface SystemLoadMetrics {
  /** Load average */
  loadAverage: number;

  /** Process count */
  processCount: number;

  /** Thread count */
  threadCount: number;

  /** System stress level */
  systemStress: SystemStressLevel;
}

export type SystemStressLevel = 'Low' | 'Moderate' | 'High' | 'Critical' | 'Overloaded';

/**
 * System memory metrics.
 */
export interface SystemMemoryMetrics {
  /** Total memory */
  totalMemory: number;

  /** Used memory */
  usedMemory: number;

  /** Free memory */
  freeMemory: number;

  /** Memory pressure */
  memoryPressure: MemoryPressureLevel;
}

export type MemoryPressureLevel = 'Low' | 'Moderate' | 'High' | 'Critical' | 'Thrashing';

/**
 * System CPU metrics.
 */
export interface SystemCPUMetrics {
  /** CPU utilization percentage */
  cpuUtilization: number;

  /** Per-core utilization */
  coreUtilization: number[];

  /** CPU temperature */
  cpuTemperature: number;

  /** CPU throttling detected */
  throttling: boolean;
}

/**
 * System I/O metrics.
 */
export interface SystemIOMetrics {
  /** Disk utilization */
  diskUtilization: number;

  /** Network utilization */
  networkUtilization: number;

  /** I/O wait time */
  ioWaitTime: number;

  /** I/O throughput */
  ioThroughput: number;
}

/**
 * System metrics collection.
 */
export interface SystemMetricsCollection {
  /** Collection timestamp */
  timestamp: Date;

  /** System health metrics */
  systemHealth: SystemHealthMetrics;

  /** Resource utilization */
  resourceUtilization: SystemResourceUtilization;

  /** Performance indicators */
  performanceIndicators: SystemPerformanceIndicators;

  /** System alerts */
  alerts: SystemAlert[];
}

/**
 * System health metrics.
 */
export interface SystemHealthMetrics {
  /** Overall health score */
  overallHealth: HealthScore;

  /** Component health */
  componentHealth: Map<string, HealthScore>;

  /** Health trends */
  healthTrends: HealthTrend[];

  /** Risk factors */
  riskFactors: SystemRiskFactor[];
}

export type HealthScore = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';

/**
 * Health trend information.
 */
export interface HealthTrend {
  /** Component name */
  component: string;

  /** Trend direction */
  direction: TrendDirection;

  /** Trend velocity */
  velocity: number;

  /** Trend confidence */
  confidence: number;
}

export type TrendDirection = 'Improving' | 'Stable' | 'Declining' | 'Volatile';

/**
 * System risk factor.
 */
export interface SystemRiskFactor {
  /** Risk type */
  riskType: string;

  /** Risk severity */
  severity: RiskSeverity;

  /** Risk probability */
  probability: number;

  /** Risk mitigation */
  mitigation: string;
}

export type RiskSeverity = 'Low' | 'Medium' | 'High' | 'Critical' | 'Fatal';

/**
 * System resource utilization.
 */
export interface SystemResourceUtilization {
  /** Memory utilization */
  memoryUtilization: ResourceUtilizationMetric;

  /** CPU utilization */
  cpuUtilization: ResourceUtilizationMetric;

  /** I/O utilization */
  ioUtilization: ResourceUtilizationMetric;

  /** Overall utilization */
  overallUtilization: number;
}

/**
 * Resource utilization metric.
 */
export interface ResourceUtilizationMetric {
  /** Current utilization */
  current: number;

  /** Average utilization */
  average: number;

  /** Peak utilization */
  peak: number;

  /** Utilization trend */
  trend: UtilizationTrend;
}

export type UtilizationTrend = 'Increasing' | 'Stable' | 'Decreasing';

/**
 * System performance indicators.
 */
export interface SystemPerformanceIndicators {
  /** System throughput */
  throughput: number;

  /** System latency */
  latency: number;

  /** Error rate */
  errorRate: number;

  /** System availability */
  availability: number;
}

/**
 * System alert information.
 */
export interface SystemAlert {
  /** Alert type */
  alertType: SystemAlertType;

  /** Alert severity */
  severity: AlertSeverity;

  /** Alert message */
  message: string;

  /** Alert timestamp */
  timestamp: Date;

  /** Alert acknowledged */
  acknowledged: boolean;
}

export type SystemAlertType = 'Performance' | 'Resource' | 'Error' | 'Security' | 'Maintenance';
export type AlertSeverity = 'Info' | 'Warning' | 'Error' | 'Critical' | 'Emergency';

// ============================================================================
// EXPORTS AND SUMMARY
// ============================================================================

/**
 * Summary of Metrics Collection Types:
 *
 * This comprehensive collection system provides detailed type definitions
 * for capturing all aspects of optimization pattern performance and effectiveness.
 *
 * Key Collection Areas:
 * 1. Pattern Matching: Performance, accuracy, and resource usage metrics
 * 2. Transformations: Effectiveness, quality, and resource efficiency metrics
 * 3. Validation: Accuracy, performance, and resource usage metrics
 * 4. Sessions: End-to-end optimization performance tracking
 * 5. System: Overall system health and performance monitoring
 *
 * Quality Features:
 * - Comprehensive performance variance analysis
 * - Detailed bottleneck identification and optimization guidance
 * - Quality impact assessment and trend analysis
 * - Resource efficiency monitoring and optimization recommendations
 * - Professional-grade audit trails and diagnostic capabilities
 *
 * This collection system provides the data foundation for the world's
 * most advanced 6502 optimization pattern library analytics.
 */
