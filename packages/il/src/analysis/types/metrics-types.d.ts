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
import { ILInstruction } from '../../il-types.js';
/**
 * Comprehensive IL complexity metrics for quality assessment
 */
export interface ILComplexityMetrics {
    readonly cyclomaticComplexity: number;
    readonly instructionComplexity: InstructionComplexityScore;
    readonly controlFlowComplexity: ControlFlowComplexityScore;
    readonly dataFlowComplexity: DataFlowComplexityScore;
    readonly overallComplexityScore: number;
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
    readonly score: number;
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
    readonly complexityRatio: number;
    readonly score: number;
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
    readonly score: number;
}
/**
 * Complexity classification for optimization guidance
 */
export type ComplexityLevel = 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';
/**
 * Comprehensive performance prediction model for 6502 targets
 */
export interface PerformancePredictionModel {
    readonly estimatedCycles: CycleEstimate;
    readonly memoryUsage: MemoryUsageEstimate;
    readonly registerPressure: RegisterPressureAnalysis;
    readonly bottlenecks: PerformanceBottleneck[];
    readonly performanceScore: number;
    readonly platformSpecificFactors: PlatformSpecificFactors;
}
/**
 * Cycle count estimation with confidence intervals
 */
export interface CycleEstimate {
    readonly bestCase: number;
    readonly averageCase: number;
    readonly worstCase: number;
    readonly confidence: number;
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
    readonly utilizationScore: number;
}
/**
 * Memory segment usage details
 */
export interface MemorySegmentUsage {
    readonly staticUsage: number;
    readonly dynamicUsage: number;
    readonly peakUsage: number;
    readonly efficiency: number;
}
/**
 * Register pressure analysis for 6502 family
 */
export interface RegisterPressureAnalysis {
    readonly accumulatorPressure: RegisterPressureMetric;
    readonly indexXPressure: RegisterPressureMetric;
    readonly indexYPressure: RegisterPressureMetric;
    readonly combinedPressure: RegisterPressureMetric;
    readonly spillProbability: number;
    readonly allocationQuality: number;
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
    readonly impactScore: number;
    readonly description: string;
    readonly suggestedOptimizations: ReadonlyArray<string>;
    readonly estimatedSpeedup: number;
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
export type BottleneckType = 'memory_access' | 'division_operation' | 'multiplication' | 'loop_overhead' | 'function_call' | 'register_spill' | 'cache_miss' | 'branch_misprediction' | 'data_dependency' | 'resource_conflict';
export type BottleneckSeverity = 'minor' | 'moderate' | 'major' | 'critical';
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
    readonly impact: number;
    readonly description: string;
}
/**
 * Comprehensive optimization readiness analysis
 */
export interface OptimizationReadinessAnalysis {
    readonly categoryReadiness: ReadonlyMap<OptimizationCategory, ReadinessScore>;
    readonly patternApplicability: ReadonlyArray<PatternApplicabilityScore>;
    readonly impactPotential: OptimizationImpactEstimate;
    readonly transformationSafety: TransformationSafetyAnalysis;
    readonly overallReadinessScore: number;
}
/**
 * Optimization category classification
 */
export type OptimizationCategory = 'arithmetic' | 'control_flow' | 'memory' | 'register' | 'loop' | 'constant' | 'dead_code' | 'strength_reduction' | 'inlining' | 'hardware_specific' | 'peephole' | 'scheduling';
/**
 * Readiness score for optimization category
 */
export interface ReadinessScore {
    readonly category: OptimizationCategory;
    readonly readinessScore: number;
    readonly confidence: number;
    readonly blockers: ReadonlyArray<OptimizationBlocker>;
    readonly opportunities: ReadonlyArray<OptimizationOpportunity>;
    readonly recommendedPatterns: ReadonlyArray<string>;
    readonly estimatedBenefit: number;
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
export type BlockerType = 'data_dependency' | 'control_dependency' | 'memory_aliasing' | 'side_effects' | 'precision_loss' | 'semantic_change' | 'platform_constraint' | 'resource_conflict';
export type BlockerSeverity = 'soft' | 'moderate' | 'hard' | 'absolute';
/**
 * Optimization opportunity identification
 */
export interface OptimizationOpportunity {
    readonly opportunityType: OpportunityType;
    readonly benefit: number;
    readonly complexity: OptimizationComplexity;
    readonly safety: SafetyLevel;
    readonly description: string;
    readonly location: BottleneckLocation;
    readonly requirements: ReadonlyArray<string>;
}
export type OpportunityType = 'constant_folding' | 'loop_unrolling' | 'common_subexpression' | 'dead_code_elimination' | 'strength_reduction' | 'loop_invariant_motion' | 'register_promotion' | 'function_inlining' | 'tail_recursion' | 'vectorization' | 'pipeline_optimization' | 'memory_layout' | 'branch_optimization';
export type OptimizationComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';
export type SafetyLevel = 'safe' | 'mostly_safe' | 'moderate' | 'risky' | 'dangerous';
/**
 * Pattern applicability pre-analysis
 */
export interface PatternApplicabilityScore {
    readonly patternId: string;
    readonly patternName: string;
    readonly applicabilityScore: number;
    readonly confidence: number;
    readonly expectedBenefit: number;
    readonly applicationProbability: number;
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
    readonly confidence: number;
}
export type PrerequisiteType = 'structural' | 'semantic' | 'performance' | 'safety' | 'platform' | 'resource';
/**
 * Optimization impact estimation
 */
export interface OptimizationImpactEstimate {
    readonly performanceImpact: ImpactMetric;
    readonly memorySizeImpact: ImpactMetric;
    readonly codeQualityImpact: ImpactMetric;
    readonly maintainabilityImpact: ImpactMetric;
    readonly overallImpact: number;
}
/**
 * Individual impact metric
 */
export interface ImpactMetric {
    readonly bestCase: number;
    readonly expectedCase: number;
    readonly worstCase: number;
    readonly confidence: number;
    readonly factors: ReadonlyArray<string>;
}
/**
 * Transformation safety analysis
 */
export interface TransformationSafetyAnalysis {
    readonly semanticSafety: SemanticSafetyAnalysis;
    readonly performanceSafety: PerformanceSafetyAnalysis;
    readonly platformSafety: PlatformSafetyAnalysis;
    readonly overallSafetyScore: number;
}
/**
 * Semantic safety analysis
 */
export interface SemanticSafetyAnalysis {
    readonly semanticPreservation: number;
    readonly dataFlowSafety: number;
    readonly controlFlowSafety: number;
    readonly sideEffectSafety: number;
    readonly riskFactors: ReadonlyArray<RiskFactor>;
}
/**
 * Performance safety analysis
 */
export interface PerformanceSafetyAnalysis {
    readonly performanceGuarantee: number;
    readonly worstCaseImpact: number;
    readonly regressionRisk: number;
    readonly testCoverage: number;
}
/**
 * Platform safety analysis
 */
export interface PlatformSafetyAnalysis {
    readonly hardwareCompatibility: number;
    readonly memoryConstraintSafety: number;
    readonly timingConstraintSafety: number;
    readonly interruptSafety: number;
}
/**
 * Risk factor identification
 */
export interface RiskFactor {
    readonly riskType: RiskType;
    readonly severity: RiskSeverity;
    readonly probability: number;
    readonly description: string;
    readonly mitigation: string;
}
export type RiskType = 'semantic_change' | 'performance_regression' | 'memory_corruption' | 'timing_violation' | 'hardware_conflict' | 'interrupt_interference' | 'precision_loss' | 'overflow_risk';
export type RiskSeverity = 'negligible' | 'minor' | 'moderate' | 'major' | 'critical';
/**
 * Quality gate analysis with pass/fail criteria
 */
export interface QualityGateAnalysis {
    readonly gates: ReadonlyArray<QualityGate>;
    readonly overallStatus: QualityGateStatus;
    readonly qualityScore: number;
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
export type QualityGateType = 'complexity_limit' | 'performance_minimum' | 'memory_limit' | 'safety_minimum' | 'optimization_readiness' | 'maintainability' | 'testability' | 'platform_compliance';
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
export type ThresholdDirection = 'higher_better' | 'lower_better' | 'target_value';
export type QualityGateStatus = 'pass' | 'warning' | 'fail' | 'not_applicable';
export type GateImportance = 'mandatory' | 'important' | 'recommended' | 'informational';
/**
 * Improvement recommendation
 */
export interface ImprovementRecommendation {
    readonly recommendationType: RecommendationType;
    readonly priority: RecommendationPriority;
    readonly effort: ImplementationEffort;
    readonly benefit: number;
    readonly description: string;
    readonly actionItems: ReadonlyArray<string>;
    readonly requiredExpertise: ExpertiseLevel;
}
export type RecommendationType = 'complexity_reduction' | 'performance_improvement' | 'memory_optimization' | 'safety_enhancement' | 'maintainability' | 'optimization_readiness' | 'platform_optimization';
export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low' | 'optional';
export type ImplementationEffort = 'minimal' | 'low' | 'moderate' | 'high' | 'extensive' | 'major';
export type ExpertiseLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'specialist';
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
    readonly predictionAccuracy: number;
    readonly analysisCompleteness: number;
    readonly confidenceScore: number;
}
/**
 * Executive summary of quality analysis
 */
export interface QualityAnalysisSummary {
    readonly overallQualityScore: number;
    readonly complexityLevel: ComplexityLevel;
    readonly performanceLevel: PerformanceLevel;
    readonly optimizationPotential: OptimizationPotential;
    readonly recommendedNextSteps: ReadonlyArray<string>;
    readonly keyFindings: ReadonlyArray<string>;
    readonly criticalIssues: ReadonlyArray<string>;
}
export type PerformanceLevel = 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
export type OptimizationPotential = 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';
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
export type OptimizationLevel = 'none' | 'basic' | 'standard' | 'aggressive' | 'maximum';
export type AnalysisDepth = 'quick' | 'standard' | 'thorough' | 'exhaustive';
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
//# sourceMappingURL=metrics-types.d.ts.map