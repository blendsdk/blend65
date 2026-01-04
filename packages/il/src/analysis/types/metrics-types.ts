/**
 * IL Quality Metrics and Analytics Framework Types
 *
 * Comprehensive type definitions for sophisticated IL quality assessment including:
 * - Complexity metrics (McCabe cyclomatic, instruction complexity, control flow complexity)
 * - Performance prediction models (cycle estimation, memory usage, register pressure)
 * - Optimization readiness scoring (pattern applicability, safety analysis)
 * - Quality gates with definitive pass/fail criteria
 *
 * @fileoverview Core types for IL quality assessment system
 */

import { ILFunction, ILInstruction, ILOperand } from '../../il-types.js';
import { ControlFlowAnalysisResult } from './control-flow-types.js';
import { SixtyTwo6502ValidationResult } from './6502-analysis-types.js';

// =============================================================================
// IL Complexity Assessment
// =============================================================================

/**
 * Comprehensive IL complexity metrics for quality assessment
 */
export interface ILComplexityMetrics {
  readonly cyclomaticComplexity: number;
  readonly instructionComplexity: InstructionComplexityScore;
  readonly controlFlowComplexity: ControlFlowComplexityScore;
  readonly dataFlowComplexity: DataFlowComplexityScore;
  readonly overallComplexityScore: number; // 0-100, lower is better
}

/**
 * Instruction-level complexity analysis
 */
export interface InstructionComplexityScore {
  readonly totalInstructions: number;
  readonly complexInstructionRatio: number;
  readonly temporaryVariableRatio: number;
  readonly branchDensity: number;
  readonly functionCallDensity: number;
  readonly memoryOperationDensity: number;
  readonly arithmeticComplexity: number;
  readonly score: number; // 0-100
}

/**
 * Control flow complexity analysis
 */
export interface ControlFlowComplexityScore {
  readonly basicBlockCount: number;
  readonly edgeCount: number;
  readonly loopNestingDepth: number;
  readonly conditionalBranchCount: number;
  readonly unconditionalJumpCount: number;
  readonly functionCallCount: number;
  readonly returnStatementCount: number;
  readonly complexityRatio: number; // edges / blocks
  readonly score: number; // 0-100
}

/**
 * Data flow complexity analysis
 */
export interface DataFlowComplexityScore {
  readonly variableCount: number;
  readonly defUseChainLength: number;
  readonly maxLiveVariables: number;
  readonly variableInterferenceCount: number;
  readonly memoryAliasComplexity: number;
  readonly dependencyDepth: number;
  readonly score: number; // 0-100
}

/**
 * Complexity classification for optimization guidance
 */
export type ComplexityLevel =
  | 'trivial'    // 0-20: Very simple code
  | 'simple'     // 21-40: Simple code with basic control flow
  | 'moderate'   // 41-60: Moderate complexity
  | 'complex'    // 61-80: Complex code requiring careful optimization
  | 'expert';    // 81-100: Extremely complex, expert-level optimization needed

// =============================================================================
// Performance Prediction System
// =============================================================================

/**
 * Comprehensive performance prediction model for 6502 targets
 */
export interface PerformancePredictionModel {
  readonly estimatedCycles: CycleEstimate;
  readonly memoryUsage: MemoryUsageEstimate;
  readonly registerPressure: RegisterPressureAnalysis;
  readonly bottlenecks: PerformanceBottleneck[];
  readonly performanceScore: number; // 0-100, higher is better
  readonly platformSpecificFactors: PlatformSpecificFactors;
}

/**
 * Cycle count estimation with confidence intervals
 */
export interface CycleEstimate {
  readonly bestCase: number;
  readonly averageCase: number;
  readonly worstCase: number;
  readonly confidence: number; // 0-1 confidence level
  readonly assumptionsMade: ReadonlyArray<string>;
  readonly uncertaintyFactors: ReadonlyArray<UncertaintyFactor>;
}

/**
 * Memory usage prediction for 6502 platforms
 */
export interface MemoryUsageEstimate {
  readonly zeroPageUsage: MemorySegmentUsage;
  readonly stackUsage: MemorySegmentUsage;
  readonly ramUsage: MemorySegmentUsage;
  readonly dataUsage: MemorySegmentUsage;
  readonly totalUsage: number;
  readonly utilizationScore: number; // 0-100
}

/**
 * Memory segment usage details
 */
export interface MemorySegmentUsage {
  readonly staticUsage: number;
  readonly dynamicUsage: number;
  readonly peakUsage: number;
  readonly efficiency: number; // 0-1
}

/**
 * Register pressure analysis for 6502 family
 */
export interface RegisterPressureAnalysis {
  readonly accumulatorPressure: RegisterPressureMetric;
  readonly indexXPressure: RegisterPressureMetric;
  readonly indexYPressure: RegisterPressureMetric;
  readonly combinedPressure: RegisterPressureMetric;
  readonly spillProbability: number; // 0-1
  readonly allocationQuality: number; // 0-100
}

/**
 * Individual register pressure metrics
 */
export interface RegisterPressureMetric {
  readonly averagePressure: number;
  readonly peakPressure: number;
  readonly pressureDistribution: ReadonlyArray<number>;
  readonly criticalRegions: ReadonlyArray<PressureRegion>;
}

/**
 * High register pressure region
 */
export interface PressureRegion {
  readonly startBlock: number;
  readonly endBlock: number;
  readonly peakPressure: number;
  readonly duration: number;
  readonly spillCost: number;
}

/**
 * Performance bottleneck identification
 */
export interface PerformanceBottleneck {
  readonly location: BottleneckLocation;
  readonly bottleneckType: BottleneckType;
  readonly severity: BottleneckSeverity;
  readonly impactScore: number; // 0-100
  readonly description: string;
  readonly suggestedOptimizations: ReadonlyArray<string>;
  readonly estimatedSpeedup: number; // Factor improvement if optimized
}

/**
 * Bottleneck location information
 */
export interface BottleneckLocation {
  readonly blockId: number;
  readonly instructionIndex: number;
  readonly instruction: ILInstruction;
  readonly functionName: string;
}

export type BottleneckType =
  | 'memory_access'       // Slow memory operations
  | 'division_operation'  // Expensive division
  | 'multiplication'      // Expensive multiplication
  | 'loop_overhead'       // Loop control overhead
  | 'function_call'       // Function call overhead
  | 'register_spill'      // Register spilling
  | 'cache_miss'          // Cache miss (for advanced targets)
  | 'branch_misprediction' // Branch misprediction
  | 'data_dependency'     // Data dependency stall
  | 'resource_conflict';  // Resource usage conflict

export type BottleneckSeverity =
  | 'minor'     // <10% performance impact
  | 'moderate'  // 10-25% performance impact
  | 'major'     // 25-50% performance impact
  | 'critical'; // >50% performance impact

/**
 * Platform-specific performance factors
 */
export interface PlatformSpecificFactors {
  readonly memoryTiming: MemoryTimingFactors;
  readonly processorFeatures: ProcessorFeatureFactors;
  readonly platformConstraints: PlatformConstraintFactors;
}

/**
 * Memory timing characteristics
 */
export interface MemoryTimingFactors {
  readonly zeroPageCycles: number;
  readonly ramCycles: number;
  readonly ioRegisterCycles: number;
  readonly pageBoundaryCycles: number;
  readonly bankSwitchCycles: number;
}

/**
 * Processor feature characteristics
 */
export interface ProcessorFeatureFactors {
  readonly hasDecimalMode: boolean;
  readonly hasBCDInstructions: boolean;
  readonly hasExtendedInstructions: boolean;
  readonly pipelineDepth: number;
  readonly branchPredictionAccuracy: number;
}

/**
 * Platform constraint factors
 */
export interface PlatformConstraintFactors {
  readonly interruptLatency: number;
  readonly vicInterference: boolean;
  readonly sidInterference: boolean;
  readonly ciaTimingConstraints: boolean;
}

/**
 * Uncertainty factor in predictions
 */
export interface UncertaintyFactor {
  readonly factor: string;
  readonly impact: number; // Impact on prediction accuracy
  readonly description: string;
}

// =============================================================================
// Optimization Readiness Scoring
// =============================================================================

/**
 * Comprehensive optimization readiness analysis
 */
export interface OptimizationReadinessAnalysis {
  readonly categoryReadiness: ReadonlyMap<OptimizationCategory, ReadinessScore>;
  readonly patternApplicability: ReadonlyArray<PatternApplicabilityScore>;
  readonly impactPotential: OptimizationImpactEstimate;
  readonly transformationSafety: TransformationSafetyAnalysis;
  readonly overallReadinessScore: number; // 0-100
}

/**
 * Optimization category classification
 */
export type OptimizationCategory =
  | 'arithmetic'         // Arithmetic optimizations
  | 'control_flow'       // Control flow optimizations
  | 'memory'            // Memory layout optimizations
  | 'register'          // Register allocation optimizations
  | 'loop'              // Loop optimizations
  | 'constant'          // Constant propagation/folding
  | 'dead_code'         // Dead code elimination
  | 'strength_reduction' // Strength reduction
  | 'inlining'          // Function inlining
  | 'hardware_specific' // Hardware-specific optimizations
  | 'peephole'          // Peephole optimizations
  | 'scheduling';       // Instruction scheduling

/**
 * Readiness score for optimization category
 */
export interface ReadinessScore {
  readonly category: OptimizationCategory;
  readonly readinessScore: number; // 0-100
  readonly confidence: number; // 0-1
  readonly blockers: ReadonlyArray<OptimizationBlocker>;
  readonly opportunities: ReadonlyArray<OptimizationOpportunity>;
  readonly recommendedPatterns: ReadonlyArray<string>;
  readonly estimatedBenefit: number; // 0-100
}

/**
 * Optimization blocker identification
 */
export interface OptimizationBlocker {
  readonly blockerType: BlockerType;
  readonly severity: BlockerSeverity;
  readonly description: string;
  readonly location: BottleneckLocation;
  readonly resolution: string;
}

export type BlockerType =
  | 'data_dependency'     // Data dependency prevents optimization
  | 'control_dependency'  // Control dependency prevents optimization
  | 'memory_aliasing'     // Memory aliasing prevents optimization
  | 'side_effects'        // Side effects prevent optimization
  | 'precision_loss'      // Optimization would lose precision
  | 'semantic_change'     // Would change program semantics
  | 'platform_constraint' // Platform constraint prevents optimization
  | 'resource_conflict';  // Resource usage conflict

export type BlockerSeverity =
  | 'soft'      // Can be worked around
  | 'moderate'  // Requires significant effort to resolve
  | 'hard'      // Very difficult to resolve
  | 'absolute'; // Cannot be resolved

/**
 * Optimization opportunity identification
 */
export interface OptimizationOpportunity {
  readonly opportunityType: OpportunityType;
  readonly benefit: number; // 0-100
  readonly complexity: OptimizationComplexity;
  readonly safety: SafetyLevel;
  readonly description: string;
  readonly location: BottleneckLocation;
  readonly requirements: ReadonlyArray<string>;
}

export type OpportunityType =
  | 'constant_folding'      // Compile-time constant evaluation
  | 'loop_unrolling'        // Loop unrolling
  | 'common_subexpression'  // Common subexpression elimination
  | 'dead_code_elimination' // Dead code removal
  | 'strength_reduction'    // Replace expensive ops with cheaper ones
  | 'loop_invariant_motion' // Move invariant code out of loops
  | 'register_promotion'    // Promote memory to registers
  | 'function_inlining'     // Inline function calls
  | 'tail_recursion'        // Convert tail recursion to iteration
  | 'vectorization'         // Vectorize operations (for advanced targets)
  | 'pipeline_optimization' // Optimize for processor pipeline
  | 'memory_layout'         // Improve memory layout
  | 'branch_optimization';  // Optimize branch patterns

export type OptimizationComplexity =
  | 'trivial'   // Very easy to implement
  | 'simple'    // Straightforward implementation
  | 'moderate'  // Some implementation complexity
  | 'complex'   // Significant implementation effort
  | 'expert';   // Extremely complex, expert-level

export type SafetyLevel =
  | 'safe'        // No risk of semantic change
  | 'mostly_safe' // Very low risk
  | 'moderate'    // Some risk requiring validation
  | 'risky'       // High risk requiring extensive testing
  | 'dangerous';  // Very high risk

/**
 * Pattern applicability pre-analysis
 */
export interface PatternApplicabilityScore {
  readonly patternId: string;
  readonly patternName: string;
  readonly applicabilityScore: number; // 0-100
  readonly confidence: number; // 0-1
  readonly expectedBenefit: number; // 0-100
  readonly applicationProbability: number; // 0-1
  readonly prerequisites: ReadonlyArray<PatternPrerequisite>;
  readonly conflicts: ReadonlyArray<string>;
  readonly safetyAssessment: SafetyLevel;
}

/**
 * Pattern prerequisite requirement
 */
export interface PatternPrerequisite {
  readonly prerequisiteType: PrerequisiteType;
  readonly description: string;
  readonly satisfied: boolean;
  readonly confidence: number; // 0-1
}

export type PrerequisiteType =
  | 'structural'    // Code structure requirement
  | 'semantic'      // Semantic requirement
  | 'performance'   // Performance requirement
  | 'safety'        // Safety requirement
  | 'platform'      // Platform capability requirement
  | 'resource';     // Resource availability requirement

/**
 * Optimization impact estimation
 */
export interface OptimizationImpactEstimate {
  readonly performanceImpact: ImpactMetric;
  readonly memorySizeImpact: ImpactMetric;
  readonly codeQualityImpact: ImpactMetric;
  readonly maintainabilityImpact: ImpactMetric;
  readonly overallImpact: number; // 0-100
}

/**
 * Individual impact metric
 */
export interface ImpactMetric {
  readonly bestCase: number;
  readonly expectedCase: number;
  readonly worstCase: number;
  readonly confidence: number; // 0-1
  readonly factors: ReadonlyArray<string>;
}

/**
 * Transformation safety analysis
 */
export interface TransformationSafetyAnalysis {
  readonly semanticSafety: SemanticSafetyAnalysis;
  readonly performanceSafety: PerformanceSafetyAnalysis;
  readonly platformSafety: PlatformSafetyAnalysis;
  readonly overallSafetyScore: number; // 0-100
}

/**
 * Semantic safety analysis
 */
export interface SemanticSafetyAnalysis {
  readonly semanticPreservation: number; // 0-100
  readonly dataFlowSafety: number; // 0-100
  readonly controlFlowSafety: number; // 0-100
  readonly sideEffectSafety: number; // 0-100
  readonly riskFactors: ReadonlyArray<RiskFactor>;
}

/**
 * Performance safety analysis
 */
export interface PerformanceSafetyAnalysis {
  readonly performanceGuarantee: number; // 0-100
  readonly worstCaseImpact: number; // Percentage degradation
  readonly regressionRisk: number; // 0-100
  readonly testCoverage: number; // 0-100
}

/**
 * Platform safety analysis
 */
export interface PlatformSafetyAnalysis {
  readonly hardwareCompatibility: number; // 0-100
  readonly memoryConstraintSafety: number; // 0-100
  readonly timingConstraintSafety: number; // 0-100
  readonly interruptSafety: number; // 0-100
}

/**
 * Risk factor identification
 */
export interface RiskFactor {
  readonly riskType: RiskType;
  readonly severity: RiskSeverity;
  readonly probability: number; // 0-1
  readonly description: string;
  readonly mitigation: string;
}

export type RiskType =
  | 'semantic_change'     // Unintended semantic change
  | 'performance_regression' // Performance degradation
  | 'memory_corruption'   // Memory corruption risk
  | 'timing_violation'    // Timing constraint violation
  | 'hardware_conflict'   // Hardware resource conflict
  | 'interrupt_interference' // Interrupt handling interference
  | 'precision_loss'      // Numerical precision loss
  | 'overflow_risk';      // Arithmetic overflow risk

export type RiskSeverity =
  | 'negligible'  // Virtually no impact
  | 'minor'       // Minor impact
  | 'moderate'    // Moderate impact
  | 'major'       // Major impact
  | 'critical';   // Critical impact

// =============================================================================
// Quality Gates and Assessment
// =============================================================================

/**
 * Quality gate analysis with pass/fail criteria
 */
export interface QualityGateAnalysis {
  readonly gates: ReadonlyArray<QualityGate>;
  readonly overallStatus: QualityGateStatus;
  readonly qualityScore: number; // 0-100
  readonly improvementRecommendations: ReadonlyArray<ImprovementRecommendation>;
}

/**
 * Individual quality gate
 */
export interface QualityGate {
  readonly gateId: string;
  readonly gateName: string;
  readonly gateType: QualityGateType;
  readonly threshold: QualityThreshold;
  readonly actualValue: number;
  readonly status: QualityGateStatus;
  readonly importance: GateImportance;
  readonly description: string;
}

export type QualityGateType =
  | 'complexity_limit'     // Complexity threshold
  | 'performance_minimum'  // Performance minimum requirement
  | 'memory_limit'         // Memory usage limit
  | 'safety_minimum'       // Safety score minimum
  | 'optimization_readiness' // Optimization readiness threshold
  | 'maintainability'      // Maintainability score
  | 'testability'         // Testability assessment
  | 'platform_compliance'; // Platform compliance

/**
 * Quality threshold definition
 */
export interface QualityThreshold {
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly targetValue?: number;
  readonly unit: string;
  readonly direction: ThresholdDirection;
}

export type ThresholdDirection =
  | 'higher_better'  // Higher values are better
  | 'lower_better'   // Lower values are better
  | 'target_value';  // Closer to target is better

export type QualityGateStatus =
  | 'pass'           // Gate passed
  | 'warning'        // Gate passed with warnings
  | 'fail'           // Gate failed
  | 'not_applicable'; // Gate not applicable

export type GateImportance =
  | 'mandatory'      // Must pass
  | 'important'      // Should pass
  | 'recommended'    // Good to pass
  | 'informational'; // For information only

/**
 * Improvement recommendation
 */
export interface ImprovementRecommendation {
  readonly recommendationType: RecommendationType;
  readonly priority: RecommendationPriority;
  readonly effort: ImplementationEffort;
  readonly benefit: number; // 0-100
  readonly description: string;
  readonly actionItems: ReadonlyArray<string>;
  readonly requiredExpertise: ExpertiseLevel;
}

export type RecommendationType =
  | 'complexity_reduction'    // Reduce code complexity
  | 'performance_improvement' // Improve performance
  | 'memory_optimization'     // Optimize memory usage
  | 'safety_enhancement'      // Enhance safety
  | 'maintainability'        // Improve maintainability
  | 'optimization_readiness' // Improve optimization readiness
  | 'platform_optimization'; // Platform-specific optimization

export type RecommendationPriority =
  | 'critical'  // Must be addressed
  | 'high'      // Should be addressed soon
  | 'medium'    // Should be addressed
  | 'low'       // Nice to address
  | 'optional'; // Optional improvement

export type ImplementationEffort =
  | 'minimal'   // <1 hour
  | 'low'       // 1-4 hours
  | 'moderate'  // 0.5-2 days
  | 'high'      // 2-5 days
  | 'extensive' // >1 week
  | 'major';    // >1 month

export type ExpertiseLevel =
  | 'beginner'     // Basic programming knowledge
  | 'intermediate' // Some optimization experience
  | 'advanced'     // Significant optimization expertise
  | 'expert'       // Deep compiler/optimization expertise
  | 'specialist';  // Domain-specific expert knowledge

// =============================================================================
// Main Analysis Result Types
// =============================================================================

/**
 * Complete IL quality metrics and analytics result
 */
export interface ILQualityAnalysisResult {
  readonly complexityMetrics: ILComplexityMetrics;
  readonly performancePrediction: PerformancePredictionModel;
  readonly optimizationReadiness: OptimizationReadinessAnalysis;
  readonly qualityGates: QualityGateAnalysis;
  readonly analysisMetrics: QualityAnalysisMetrics;
  readonly recommendations: ReadonlyArray<ImprovementRecommendation>;
  readonly summary: QualityAnalysisSummary;
}

/**
 * Analysis performance and quality metrics
 */
export interface QualityAnalysisMetrics {
  readonly analysisTimeMs: number;
  readonly memoryUsageBytes: number;
  readonly predictionAccuracy: number; // 0-1
  readonly analysisCompleteness: number; // 0-1
  readonly confidenceScore: number; // 0-1
}

/**
 * Executive summary of quality analysis
 */
export interface QualityAnalysisSummary {
  readonly overallQualityScore: number; // 0-100
  readonly complexityLevel: ComplexityLevel;
  readonly performanceLevel: PerformanceLevel;
  readonly optimizationPotential: OptimizationPotential;
  readonly recommendedNextSteps: ReadonlyArray<string>;
  readonly keyFindings: ReadonlyArray<string>;
  readonly criticalIssues: ReadonlyArray<string>;
}

export type PerformanceLevel =
  | 'excellent'  // 90-100: Excellent performance
  | 'good'       // 70-89: Good performance
  | 'acceptable' // 50-69: Acceptable performance
  | 'poor'       // 30-49: Poor performance
  | 'critical';  // 0-29: Critical performance issues

export type OptimizationPotential =
  | 'minimal'    // <10% potential improvement
  | 'low'        // 10-25% potential improvement
  | 'moderate'   // 25-50% potential improvement
  | 'high'       // 50-100% potential improvement
  | 'extreme';   // >100% potential improvement

/**
 * Analysis configuration options
 */
export interface QualityAnalysisOptions {
  readonly enableComplexityAnalysis: boolean;
  readonly enablePerformancePrediction: boolean;
  readonly enableOptimizationReadiness: boolean;
  readonly enableQualityGates: boolean;
  readonly enableDetailedRecommendations: boolean;
  readonly targetPlatform: string;
  readonly optimizationLevel: OptimizationLevel;
  readonly qualityThresholds: QualityThresholdSet;
  readonly analysisDepth: AnalysisDepth;
}

export type OptimizationLevel =
  | 'none'        // No optimization
  | 'basic'       // Basic optimizations only
  | 'standard'    // Standard optimization level
  | 'aggressive'  // Aggressive optimizations
  | 'maximum';    // Maximum optimization

export type AnalysisDepth =
  | 'quick'       // Fast analysis with reduced accuracy
  | 'standard'    // Standard analysis
  | 'thorough'    // Thorough analysis
  | 'exhaustive'; // Exhaustive analysis

/**
 * Quality threshold configuration set
 */
export interface QualityThresholdSet {
  readonly maxComplexity: number;
  readonly minPerformanceScore: number;
  readonly maxMemoryUsage: number;
  readonly minSafetyScore: number;
  readonly minOptimizationReadiness: number;
  readonly customThresholds: ReadonlyMap<string, QualityThreshold>;
}
