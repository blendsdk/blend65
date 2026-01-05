/**
 * Pattern-Readiness Analytics Integration
 *
 * Sophisticated pattern selection system that connects IL quality metrics with
 * the 470+ optimization pattern library. Provides intelligent pattern applicability
 * analysis, conflict prediction, and priority ranking for optimal optimization results.
 *
 * @fileoverview Pattern-readiness analytics for intelligent optimization
 */
import type { ILProgram } from '../il-types.js';
import type { ILQualityAnalysisResult } from './types/metrics-types.js';
import type { ControlFlowAnalysisResult } from './types/control-flow-types.js';
import type { SixtyTwo6502ValidationResult } from './types/6502-analysis-types.js';
interface OptimizationPattern {
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly description: string;
    readonly priority: number;
    readonly platforms: string[];
    readonly expectedImprovement: {
        readonly improvementPercentage: number;
        readonly cyclesSaved: number;
        readonly bytesSaved: number;
        readonly reliability: string;
    };
}
interface SmartPatternRegistry {
    getPatternsByCategory(category: string): OptimizationPattern[];
}
type TargetPlatform = string;
/**
 * Pattern readiness analysis result
 */
export interface PatternReadinessAnalysisResult {
    readonly applicablePatterns: ReadonlyArray<RankedPatternRecommendation>;
    readonly patternConflicts: ReadonlyArray<PatternConflictPrediction>;
    readonly optimizationStrategy: OptimizationStrategy;
    readonly patternSelectionMetrics: PatternSelectionMetrics;
    readonly applicationOrder: ReadonlyArray<PatternApplicationStep>;
    readonly safetyAssessment: PatternSafetyAssessment;
    readonly analysisMetadata: PatternAnalysisMetadata;
}
/**
 * Ranked pattern recommendation with comprehensive scoring
 */
export interface RankedPatternRecommendation {
    readonly pattern: OptimizationPattern;
    readonly applicabilityScore: number;
    readonly impactScore: number;
    readonly safetyScore: number;
    readonly complexityScore: number;
    readonly overallRank: number;
    readonly confidenceLevel: PatternConfidenceLevel;
    readonly prerequisites: ReadonlyArray<PatternPrerequisite>;
    readonly expectedBenefit: PatternBenefitEstimate;
    readonly applicationContext: PatternApplicationContext;
    readonly riskFactors: ReadonlyArray<PatternRiskFactor>;
}
/**
 * Pattern conflict prediction system
 */
export interface PatternConflictPrediction {
    readonly pattern1Id: string;
    readonly pattern2Id: string;
    readonly conflictType: PatternConflictType;
    readonly conflictSeverity: ConflictSeverity;
    readonly conflictProbability: number;
    readonly impactAssessment: ConflictImpactAssessment;
    readonly resolutionStrategies: ReadonlyArray<ConflictResolutionStrategy>;
    readonly avoidanceRecommendations: ReadonlyArray<string>;
}
/**
 * Optimization strategy generated from pattern analysis
 */
export interface OptimizationStrategy {
    readonly strategyType: OptimizationStrategyType;
    readonly phaseCount: number;
    readonly estimatedDuration: number;
    readonly expectedImprovement: StrategyBenefitEstimate;
    readonly riskProfile: StrategyRiskProfile;
    readonly resourceRequirements: StrategyResourceRequirements;
    readonly alternativeStrategies: ReadonlyArray<AlternativeStrategy>;
}
/**
 * Pattern selection metrics and analytics
 */
export interface PatternSelectionMetrics {
    readonly totalPatternsEvaluated: number;
    readonly applicablePatternsFound: number;
    readonly conflictsDetected: number;
    readonly selectionAccuracy: number;
    readonly analysisCompleteness: number;
    readonly predictionConfidence: number;
    readonly performanceMetrics: SelectionPerformanceMetrics;
}
/**
 * Pattern application step in optimization sequence
 */
export interface PatternApplicationStep {
    readonly stepNumber: number;
    readonly patternsToApply: ReadonlyArray<string>;
    readonly expectedDuration: number;
    readonly prerequisites: ReadonlyArray<string>;
    readonly validationRequired: boolean;
    readonly rollbackStrategy: RollbackStrategy;
    readonly successCriteria: ReadonlyArray<SuccessCriterion>;
}
/**
 * Pattern safety assessment
 */
export interface PatternSafetyAssessment {
    readonly overallSafetyScore: number;
    readonly safePatternCount: number;
    readonly riskyPatternCount: number;
    readonly unsafePatternCount: number;
    readonly safetyRecommendations: ReadonlyArray<SafetyRecommendation>;
    readonly requiredValidation: ReadonlyArray<ValidationRequirement>;
}
/**
 * Pattern analysis metadata
 */
export interface PatternAnalysisMetadata {
    readonly analysisTimestamp: number;
    readonly analysisVersion: string;
    readonly inputQualityScore: number;
    readonly patternLibraryVersion: string;
    readonly platformTarget: TargetPlatform;
    readonly analysisOptions: PatternAnalysisOptions;
}
export type PatternConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
export interface PatternPrerequisite {
    readonly prerequisiteId: string;
    readonly description: string;
    readonly satisfied: boolean;
    readonly satisfactionConfidence: number;
    readonly blockingFactor: number;
}
export interface PatternBenefitEstimate {
    readonly performanceGain: number;
    readonly memorySaving: number;
    readonly cyclesSaved: number;
    readonly codeQualityImprovement: number;
    readonly confidenceInterval: BenefitConfidenceInterval;
}
export interface BenefitConfidenceInterval {
    readonly lowerBound: number;
    readonly upperBound: number;
    readonly confidence: number;
}
export interface PatternApplicationContext {
    readonly functionContext: string;
    readonly blockContext: number[];
    readonly dependencyContext: string[];
    readonly performanceContext: PerformanceContextInfo;
    readonly safetyContext: SafetyContextInfo;
}
export interface PatternRiskFactor {
    readonly riskType: PatternRiskType;
    readonly severity: RiskSeverity;
    readonly probability: number;
    readonly mitigation: string;
    readonly acceptanceRecommendation: string;
}
export type PatternRiskType = 'semantic_change' | 'performance_regression' | 'memory_corruption' | 'timing_violation' | 'platform_incompatibility' | 'maintenance_complexity';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type PatternConflictType = 'direct_conflict' | 'resource_conflict' | 'ordering_dependency' | 'semantic_conflict' | 'performance_conflict' | 'safety_conflict';
export type ConflictSeverity = 'minor' | 'moderate' | 'major' | 'blocking';
export interface ConflictImpactAssessment {
    readonly performanceImpact: number;
    readonly safetyImpact: number;
    readonly complexityIncrease: number;
    readonly maintenanceImpact: number;
}
export interface ConflictResolutionStrategy {
    readonly strategyId: string;
    readonly description: string;
    readonly successProbability: number;
    readonly implementationComplexity: ResolutionComplexity;
    readonly expectedOutcome: ConflictResolutionOutcome;
}
export type ResolutionComplexity = 'simple' | 'moderate' | 'complex' | 'expert';
export interface ConflictResolutionOutcome {
    readonly conflictResolved: boolean;
    readonly performanceImpact: number;
    readonly safetyImpact: number;
    readonly implementationEffort: number;
}
export type OptimizationStrategyType = 'aggressive' | 'balanced' | 'conservative' | 'incremental' | 'experimental';
export interface StrategyBenefitEstimate {
    readonly performanceImprovement: number;
    readonly memorySaving: number;
    readonly codeQualityGain: number;
    readonly developmentTimeImpact: number;
}
export interface StrategyRiskProfile {
    readonly overallRisk: RiskLevel;
    readonly semanticRisk: RiskLevel;
    readonly performanceRisk: RiskLevel;
    readonly maintenanceRisk: RiskLevel;
    readonly mitigationStrategies: ReadonlyArray<string>;
}
export type RiskLevel = 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';
export interface StrategyResourceRequirements {
    readonly analysisTime: number;
    readonly memoryRequirement: number;
    readonly expertiseLevel: ExpertiseRequirement;
    readonly toolingRequirements: ReadonlyArray<string>;
}
export type ExpertiseRequirement = 'basic' | 'intermediate' | 'advanced' | 'expert';
export interface AlternativeStrategy {
    readonly strategyId: string;
    readonly description: string;
    readonly tradeoffs: StrategyTradeoffs;
    readonly suitability: number;
}
export interface StrategyTradeoffs {
    readonly performanceVsSafety: number;
    readonly speedVsMemory: number;
    readonly simplicityVsOptimality: number;
}
export interface SelectionPerformanceMetrics {
    readonly selectionTimeMs: number;
    readonly memoryUsageBytes: number;
    readonly cacheHitRate: number;
    readonly predictionAccuracy: number;
}
export interface RollbackStrategy {
    readonly strategyType: RollbackStrategyType;
    readonly rollbackComplexity: RollbackComplexity;
    readonly dataToPreserve: ReadonlyArray<string>;
    readonly rollbackTime: number;
}
export type RollbackStrategyType = 'automatic' | 'manual' | 'checkpoint' | 'version_control';
export type RollbackComplexity = 'trivial' | 'simple' | 'moderate' | 'complex';
export interface SuccessCriterion {
    readonly criterionId: string;
    readonly description: string;
    readonly metricName: string;
    readonly expectedValue: number;
    readonly tolerance: number;
    readonly priority: CriterionPriority;
}
export type CriterionPriority = 'required' | 'important' | 'optional';
export interface SafetyRecommendation {
    readonly recommendationId: string;
    readonly description: string;
    readonly importance: SafetyImportance;
    readonly implementationGuidance: string;
    readonly validationMethod: string;
}
export type SafetyImportance = 'critical' | 'important' | 'recommended' | 'optional';
export interface ValidationRequirement {
    readonly validationType: ValidationType;
    readonly description: string;
    readonly automationPossible: boolean;
    readonly estimatedEffort: number;
    readonly requiredExpertise: ExpertiseRequirement;
}
export type ValidationType = 'functional' | 'performance' | 'safety' | 'compatibility';
export interface PatternAnalysisOptions {
    readonly enableConflictPrediction: boolean;
    readonly enableSafetyAnalysis: boolean;
    readonly riskTolerance: RiskTolerance;
    readonly optimizationGoals: OptimizationGoals;
    readonly platformConstraints: PlatformConstraints;
}
export type RiskTolerance = 'risk_averse' | 'balanced' | 'risk_accepting' | 'experimental';
export interface OptimizationGoals {
    readonly prioritizePerformance: boolean;
    readonly prioritizeMemory: boolean;
    readonly prioritizeSafety: boolean;
    readonly prioritizeMaintainability: boolean;
    readonly targetImprovement: number;
}
export interface PlatformConstraints {
    readonly memoryConstraints: MemoryConstraints;
    readonly timingConstraints: TimingConstraints;
    readonly hardwareConstraints: HardwareConstraints;
}
export interface MemoryConstraints {
    readonly maxZeroPageUsage: number;
    readonly maxRamUsage: number;
    readonly maxStackUsage: number;
}
export interface TimingConstraints {
    readonly maxCycleCount: number;
    readonly interruptLatencyMax: number;
    readonly realTimeRequirements: boolean;
}
export interface HardwareConstraints {
    readonly platform: TargetPlatform;
    readonly availableRegisters: string[];
    readonly specialInstructions: string[];
    readonly memoryBanking: boolean;
}
export interface PerformanceContextInfo {
    readonly criticalPath: boolean;
    readonly executionFrequency: ExecutionFrequency;
    readonly performanceTarget: number;
}
export type ExecutionFrequency = 'rare' | 'occasional' | 'frequent' | 'continuous' | 'critical';
export interface SafetyContextInfo {
    readonly safetyRequirement: SafetyRequirement;
    readonly validationLevel: ValidationLevel;
    readonly testCoverage: number;
}
export type SafetyRequirement = 'none' | 'basic' | 'standard' | 'high' | 'critical';
export type ValidationLevel = 'basic' | 'standard' | 'thorough' | 'exhaustive';
/**
 * Pattern-Readiness Analytics Integration System
 *
 * Sophisticated analyzer that connects IL quality metrics with the optimization
 * pattern library to provide intelligent pattern selection recommendations.
 */
export declare class PatternReadinessAnalyzer {
    private patternRegistry;
    private options;
    constructor(patternRegistry: SmartPatternRegistry, options?: PatternAnalysisOptions);
    /**
     * Analyze pattern readiness for an IL program with comprehensive intelligence.
     */
    analyzePatternReadiness(program: ILProgram, qualityAnalysis: ILQualityAnalysisResult, cfgAnalysis: ControlFlowAnalysisResult, sixtyTwoAnalysis: SixtyTwo6502ValidationResult): PatternReadinessAnalysisResult;
    /**
     * Analyze which patterns from the 470+ pattern library are applicable.
     */
    private analyzePatternApplicability;
    /**
     * Evaluate a single pattern for applicability.
     */
    private evaluatePatternApplicability;
    /**
     * Calculate applicability score for a pattern.
     */
    private calculateApplicabilityScore;
    /**
     * Calculate potential impact score for a pattern.
     */
    private calculatePatternImpact;
    /**
     * Calculate safety score for a pattern.
     */
    private calculatePatternSafety;
    /**
     * Calculate complexity score for pattern application.
     */
    private calculatePatternComplexity;
    /**
     * Calculate overall rank combining all scores.
     */
    private calculateOverallRank;
    /**
     * Get scoring weights based on optimization goals.
     */
    private getWeightsFromGoals;
    /**
     * Predict conflicts between patterns.
     */
    private predictPatternConflicts;
    /**
     * Analyze conflict between two patterns.
     */
    private analyzePatternConflict;
    /**
     * Generate optimization strategy based on pattern analysis.
     */
    private generateOptimizationStrategy;
    /**
     * Get default analysis options.
     */
    private getDefaultOptions;
    /**
     * Generate application sequence for patterns.
     */
    private generateApplicationSequence;
    /**
     * Assess pattern safety.
     */
    private assessPatternSafety;
    /**
     * Create basic safety assessment for when safety analysis is disabled.
     */
    private createBasicSafetyAssessment;
    /**
     * Collect pattern selection metrics.
     */
    private collectSelectionMetrics;
    /**
     * Create analysis metadata.
     */
    private createAnalysisMetadata;
    /**
     * Map pattern category to optimization category.
     */
    private mapToOptimizationCategory;
    /**
     * Determine confidence level for pattern recommendation.
     */
    private determineConfidenceLevel;
    /**
     * Analyze pattern prerequisites.
     */
    private analyzePatternPrerequisites;
    /**
     * Estimate pattern benefit.
     */
    private estimatePatternBenefit;
    /**
     * Create application context for pattern.
     */
    private createApplicationContext;
    /**
     * Identify pattern risks.
     */
    private identifyPatternRisks;
    private determineStrategyType;
    private estimateStrategyBenefit;
    private assessStrategyRisk;
    private calculateResourceRequirements;
    private generateAlternativeStrategies;
    private scoreToRiskLevel;
    private estimatePhaseTime;
    private extractPrerequisites;
    private createRollbackStrategy;
    private createSuccessCriteria;
    private generateSafetyRecommendations;
    private determineValidationRequirements;
    private estimateAccuracy;
    private calculatePredictionConfidence;
    private determineConflictType;
    private calculateConflictProbability;
    private assessConflictSeverity;
    private assessConflictImpact;
    private generateResolutionStrategies;
    private generateAvoidanceRecommendations;
}
export {};
//# sourceMappingURL=pattern-readiness-analyzer.d.ts.map