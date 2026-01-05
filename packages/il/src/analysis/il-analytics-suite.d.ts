/**
 * IL Analytics Suite - Comprehensive Integration of All Analytics Components
 *
 * This module provides a unified interface for all IL analytics capabilities,
 * coordinating control flow analysis, 6502-specific validation, quality metrics,
 * and pattern readiness analysis into a cohesive analytics system.
 *
 * Features:
 * - Performance benchmarking and validation
 * - Accuracy validation against known standards
 * - Integration testing framework
 * - Memory efficiency monitoring
 * - Complete analytics pipeline coordination
 */
import { ILProgram, ILFunction } from '../il-types.js';
import type { ControlFlowAnalysisResult } from './types/control-flow-types.js';
import type { SixtyTwo6502ValidationResult } from './types/6502-analysis-types.js';
import type { ILComplexityMetrics, PatternApplicabilityScore } from './types/metrics-types.js';
/**
 * Comprehensive analytics result containing all analysis outputs
 */
export interface ComprehensiveAnalyticsResult {
    /** Control flow analysis results */
    controlFlow: ControlFlowAnalysisResult;
    /** 6502-specific analysis results */
    sixtyTwoZeroTwo: SixtyTwo6502ValidationResult;
    /** IL quality metrics and complexity analysis */
    qualityMetrics: ILComplexityMetrics;
    /** Pattern readiness and applicability analysis */
    patternReadiness: PatternApplicabilityScore[];
    /** Overall analytics summary */
    summary: AnalyticsSummary;
    /** Performance metadata */
    performanceMetrics: AnalyticsPerformanceMetrics;
}
/**
 * Analytics summary with overall scores and recommendations
 */
export interface AnalyticsSummary {
    /** Overall IL quality score (0-100) */
    overallQualityScore: number;
    /** Overall optimization readiness score (0-100) */
    optimizationReadinessScore: number;
    /** Performance prediction confidence (0-100) */
    performancePredictionConfidence: number;
    /** Top optimization recommendations */
    topRecommendations: OptimizationRecommendation[];
    /** Critical issues requiring attention */
    criticalIssues: AnalyticsIssue[];
    /** Analytics confidence level */
    confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
}
/**
 * Optimization recommendation from analytics
 */
export interface OptimizationRecommendation {
    /** Recommendation type */
    type: 'PERFORMANCE' | 'MEMORY' | 'PATTERN' | 'ARCHITECTURE';
    /** Priority level */
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    /** Recommendation description */
    description: string;
    /** Expected benefit if implemented */
    expectedBenefit: number;
    /** Implementation difficulty */
    implementationDifficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
    /** Specific pattern recommendations */
    recommendedPatterns?: string[];
}
/**
 * Analytics issue requiring attention
 */
export interface AnalyticsIssue {
    /** Issue severity */
    severity: 'ERROR' | 'WARNING' | 'INFO';
    /** Issue category */
    category: 'PERFORMANCE' | 'CORRECTNESS' | 'MAINTAINABILITY' | 'OPTIMIZATION';
    /** Issue description */
    description: string;
    /** Location in IL program */
    location?: {
        functionName?: string;
        instructionIndex?: number;
        basicBlockId?: number;
    };
    /** Suggested resolution */
    suggestedResolution?: string;
}
/**
 * Performance metrics for analytics execution
 */
export interface AnalyticsPerformanceMetrics {
    /** Total analysis time in milliseconds */
    totalAnalysisTime: number;
    /** Analysis time breakdown by component */
    componentTiming: {
        controlFlow: number;
        sixtyTwoZeroTwo: number;
        qualityMetrics: number;
        patternReadiness: number;
        integration: number;
    };
    /** Memory usage during analysis */
    memoryUsage: {
        peakMemoryMB: number;
        averageMemoryMB: number;
        memoryEfficiencyScore: number;
    };
    /** Performance grade */
    performanceGrade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
}
/**
 * Performance benchmarks for validation
 */
export interface AnalyticsPerformanceBenchmarks {
    /** Simple function analysis target (ms) */
    simpleFunctionTarget: number;
    /** Moderate complexity analysis target (ms) */
    moderateComplexityTarget: number;
    /** Complex function analysis target (ms) */
    complexFunctionTarget: number;
    /** Memory usage targets */
    memoryUsageTargets: {
        simple: number;
        moderate: number;
        complex: number;
    };
}
/**
 * Accuracy validation standards
 */
export interface AnalyticsAccuracyStandards {
    /** Performance prediction accuracy target (%) */
    performancePredictionAccuracy: 95;
    /** Pattern selection accuracy target (%) */
    patternSelectionAccuracy: 90;
    /** Quality scoring accuracy target (%) */
    qualityScoringAccuracy: 92;
    /** Control flow analysis accuracy target (%) */
    controlFlowAnalysisAccuracy: 98;
}
/**
 * IL Analytics Suite - Main coordinator for comprehensive IL analysis
 */
export declare class ILAnalyticsSuite {
    private readonly controlFlowAnalyzer;
    private readonly sixtyTwoZeroTwoAnalyzer;
    private readonly metricsAnalyzer;
    private readonly patternReadinessAnalyzer;
    /** Performance benchmarks */
    static readonly BENCHMARKS: AnalyticsPerformanceBenchmarks;
    /** Accuracy standards */
    static readonly ACCURACY_STANDARDS: AnalyticsAccuracyStandards;
    constructor();
    /**
     * Perform comprehensive analytics on IL program
     */
    analyzeProgram(program: ILProgram): Promise<ComprehensiveAnalyticsResult>;
    /**
     * Perform analytics on a single function
     */
    analyzeFunction(ilFunction: ILFunction): Promise<ComprehensiveAnalyticsResult>;
    /**
     * Validate analytics performance against benchmarks
     */
    validatePerformance(testPrograms: ILProgram[]): Promise<PerformanceValidationResult>;
    /**
     * Validate analytics accuracy against known standards
     */
    validateAccuracy(referenceData: AccuracyReferenceData[]): Promise<AccuracyValidationResult>;
    /**
     * Generate summary from all analytics results
     */
    private generateSummary;
    /**
     * Generate optimization recommendations
     */
    private generateRecommendations;
    /**
     * Identify critical issues requiring attention
     */
    private identifyCriticalIssues;
    /**
     * Determine overall confidence level
     */
    private determineConfidenceLevel;
    /**
     * Generate performance metrics
     */
    private generatePerformanceMetrics;
    /**
     * Classify program complexity for benchmarking
     */
    private classifyProgramComplexity;
    /**
     * Get benchmark target for complexity level
     */
    private getBenchmarkForComplexity;
    /**
     * Calculate performance grade
     */
    private calculatePerformanceGrade;
    /**
     * Get current memory usage
     */
    private getMemoryUsage;
    /**
     * Get current time in milliseconds
     */
    private now;
    /**
     * Calculate accuracy percentage
     */
    private calculateAccuracy;
    /**
     * Calculate pattern selection accuracy
     */
    private calculatePatternAccuracy;
    /**
     * Generate performance recommendation
     */
    private generatePerformanceRecommendation;
    /**
     * Generate accuracy recommendation
     */
    private generateAccuracyRecommendation;
}
type ProgramComplexity = 'Simple' | 'Moderate' | 'Complex';
interface PerformanceValidationResult {
    overallPassed: boolean;
    averagePerformanceMargin: number;
    results: PerformanceBenchmarkResult[];
    recommendation: string;
}
interface PerformanceBenchmarkResult {
    programName: string;
    complexity: ProgramComplexity;
    actualTime: number;
    targetTime: number;
    passed: boolean;
    performanceMargin: number;
    memoryUsage: number;
}
interface AccuracyValidationResult {
    overallAccuracy: number;
    meetsStandards: boolean;
    accuracyMetrics: AccuracyMetric[];
    recommendation: string;
}
interface AccuracyMetric {
    testName: string;
    performanceAccuracy: number;
    patternAccuracy: number;
    qualityAccuracy: number;
    overallAccuracy: number;
}
interface AccuracyReferenceData {
    testName: string;
    program: ILProgram;
    expectedCycles: number;
    expectedPatterns: string[];
    expectedQualityScore: number;
}
export {};
//# sourceMappingURL=il-analytics-suite.d.ts.map