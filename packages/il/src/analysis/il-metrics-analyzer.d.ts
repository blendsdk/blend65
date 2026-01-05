/**
 * IL Quality Metrics and Analytics Framework for Blend65
 *
 * Implements Task 2.4.3: IL Quality Metrics and Analytics Framework
 *
 * This module provides comprehensive IL quality assessment capabilities including:
 * - McCabe cyclomatic complexity and advanced complexity metrics
 * - Cycle-accurate performance prediction for 6502 targets
 * - Optimization readiness scoring for 470+ pattern system
 * - Quality gates with definitive pass/fail criteria
 * - Comprehensive improvement recommendations
 * - Integration with control flow and 6502-specific analysis
 *
 * @fileoverview Main coordinator for IL quality assessment system
 */
import { ILFunction } from '../il-types.js';
import { ControlFlowAnalysisResult } from './types/control-flow-types.js';
import { SixtyTwo6502ValidationResult } from './types/6502-analysis-types.js';
import { ILQualityAnalysisResult, QualityAnalysisOptions } from './types/metrics-types.js';
/**
 * IL Quality Metrics and Analytics Analyzer
 *
 * Main coordinator class that orchestrates comprehensive quality assessment
 * of IL functions, providing complexity metrics, performance predictions,
 * optimization readiness scoring, and quality gates for optimization decisions.
 */
export declare class ILMetricsAnalyzer {
    private readonly options;
    private analysisMetrics;
    constructor(options?: Partial<QualityAnalysisOptions>);
    /**
     * Perform comprehensive quality metrics analysis on an IL function
     *
     * @param ilFunction The IL function to analyze
     * @param cfgAnalysis Control flow analysis result from Task 2.4.1
     * @param sixtyTwo6502Analysis 6502-specific analysis result from Task 2.4.2
     * @returns Complete quality metrics analysis result
     */
    analyzeFunction(ilFunction: ILFunction, cfgAnalysis: ControlFlowAnalysisResult, sixtyTwo6502Analysis: SixtyTwo6502ValidationResult): ILQualityAnalysisResult;
    /**
     * Perform comprehensive complexity analysis
     */
    private performComplexityAnalysis;
    /**
     * Calculate McCabe cyclomatic complexity from CFG
     */
    private calculateCyclomaticComplexity;
    /**
     * Analyze instruction-level complexity
     */
    private analyzeInstructionComplexity;
    /**
     * Analyze control flow complexity
     */
    private analyzeControlFlowComplexity;
    /**
     * Analyze data flow complexity
     */
    private analyzeDataFlowComplexity;
    /**
     * Calculate overall complexity score from individual components
     */
    private calculateOverallComplexityScore;
    /**
     * Perform performance prediction analysis
     */
    private performPerformancePrediction;
    /**
     * Perform optimization readiness analysis
     */
    private performOptimizationReadinessAnalysis;
    /**
     * Perform quality gate analysis
     */
    private performQualityGateAnalysis;
    /**
     * Helper methods for analysis implementation
     */
    private isComplexInstruction;
    private isBranchInstruction;
    private isMemoryOperation;
    private isArithmeticOperation;
    private isTemporaryVariable;
    private calculateAverageDefUseChainLength;
    private calculateMaxLiveVariables;
    private calculateDependencyDepth;
    private extractCycleEstimates;
    private estimateMemoryUsage6502;
    private analyzeRegisterPressure;
    private identifyPerformanceBottlenecks;
    private calculatePerformanceScore;
    private extractPlatformSpecificFactors;
    private analyzeCategoryReadiness;
    private analyzePatternApplicability;
    private estimateOptimizationImpact;
    private analyzeTransformationSafety;
    private calculateOverallReadinessScore;
    private evaluateQualityGates;
    private determineOverallGateStatus;
    private calculateQualityScore;
    private generateGateImprovementRecommendations;
    private getRecommendationType;
    private getDefaultQualityThresholds;
    private mergeMetrics;
    private estimateMemoryUsage;
    private estimatePredictionAccuracy;
    private calculateAnalysisCompleteness;
    private calculateOverallConfidence;
    private generateImprovementRecommendations;
    private buildQualityAnalysisSummary;
    private createEmptyComplexityMetrics;
    private createEmptyPerformancePrediction;
    private createEmptyOptimizationReadiness;
    private createEmptyQualityGates;
    private createErrorResult;
}
/**
 * Convenience function to perform IL quality metrics analysis
 *
 * @param ilFunction IL function to analyze
 * @param cfgAnalysis Control flow analysis result from Task 2.4.1
 * @param sixtyTwo6502Analysis 6502-specific analysis result from Task 2.4.2
 * @param options Analysis configuration options
 * @returns Complete quality metrics analysis result
 */
export declare function analyzeILQuality(ilFunction: ILFunction, cfgAnalysis: ControlFlowAnalysisResult, sixtyTwo6502Analysis: SixtyTwo6502ValidationResult, options?: Partial<QualityAnalysisOptions>): ILQualityAnalysisResult;
/**
 * Export types for external use
 */
export type { ILQualityAnalysisResult, QualityAnalysisOptions, QualityAnalysisMetrics, ILComplexityMetrics, PerformancePredictionModel, OptimizationReadinessAnalysis, } from './types/metrics-types.js';
//# sourceMappingURL=il-metrics-analyzer.d.ts.map