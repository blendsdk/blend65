/**
 * 6502-Specific Deep Validation System for Blend65 IL
 *
 * Implements Task 2.4.2: 6502-Specific Deep Validation System
 *
 * This module provides comprehensive 6502 family processor validation capabilities
 * for the Blend65 IL system, including:
 * - Cycle-perfect timing analysis for all 6502 variants
 * - Platform-specific memory layout validation
 * - Register interference analysis and allocation optimization
 * - Hardware constraint validation for real 6502 systems
 * - Performance hotspot detection with 6502-aware optimization
 * - Extensible architecture supporting 6502/6510/65C02/65816
 *
 * @fileoverview Main coordinator for hardware-aware IL validation system
 */
import { ILFunction } from '../il-types.js';
import { ControlFlowAnalysisResult } from './types/control-flow-types.js';
import { SixtyTwo6502ValidationResult, SixtyTwo6502AnalysisOptions } from './types/6502-analysis-types.js';
/**
 * Main 6502-Specific Deep Validation Analyzer
 *
 * Orchestrates comprehensive hardware-aware validation of IL functions,
 * providing cycle-perfect timing analysis and platform-specific optimization
 * recommendations for all supported 6502 family processors.
 */
export declare class SixtyTwo6502Analyzer {
    private readonly options;
    private readonly variantAnalyzers;
    private analysisMetrics;
    constructor(options?: Partial<SixtyTwo6502AnalysisOptions>);
    /**
     * Perform comprehensive 6502-specific validation on an IL function
     *
     * @param ilFunction The IL function to analyze
     * @param cfgAnalysis Control flow analysis result from previous analysis
     * @returns Complete 6502-specific validation result
     */
    analyzeFunction(ilFunction: ILFunction, cfgAnalysis: ControlFlowAnalysisResult): SixtyTwo6502ValidationResult;
    /**
     * Get the appropriate analyzer for the target platform
     */
    private getAnalyzerForTarget;
    /**
     * Perform cycle-perfect timing analysis
     */
    private performTimingAnalysis;
    /**
     * Perform memory layout validation
     */
    private performMemoryLayoutValidation;
    /**
     * Perform register allocation analysis
     */
    private performRegisterAllocationAnalysis;
    /**
     * Perform performance hotspot detection
     */
    private performPerformanceHotspotDetection;
    /**
     * Perform hardware constraint validation
     */
    private performHardwareConstraintValidation;
    /**
     * Generate optimization recommendations
     */
    private generateOptimizationRecommendations;
    /**
     * Helper methods for creating empty results when analysis is disabled
     */
    private createEmptyTimingResult;
    private createEmptyMemoryValidationResult;
    private createEmptyRegisterAnalysisResult;
    private createEmptyHotspotAnalysisResult;
    private createEmptyConstraintValidationResult;
    /**
     * Utility methods
     */
    private mergeMetrics;
    private estimateMemoryUsage;
    private aggregateValidationIssues;
    private buildPlatformCompatibilityReport;
    private createErrorResult;
}
/**
 * Convenience function to perform 6502-specific analysis on an IL function
 *
 * @param ilFunction IL function to analyze
 * @param cfgAnalysis Control flow analysis result
 * @param options Analysis configuration options
 * @returns Complete 6502-specific validation result
 */
export declare function analyze6502(ilFunction: ILFunction, cfgAnalysis: ControlFlowAnalysisResult, options?: Partial<SixtyTwo6502AnalysisOptions>): SixtyTwo6502ValidationResult;
/**
 * Export types for external use
 */
export type { SixtyTwo6502ValidationResult, SixtyTwo6502AnalysisOptions, ProcessorVariant, PlatformTarget, CycleTimingResult, } from './types/6502-analysis-types.js';
//# sourceMappingURL=6502-analyzer.d.ts.map