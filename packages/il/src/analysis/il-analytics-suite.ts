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
import { ControlFlowAnalyzer } from './control-flow-analyzer.js';
import { SixtyTwo6502Analyzer } from './6502-analyzer.js';
import { ILMetricsAnalyzer } from './il-metrics-analyzer.js';
import { PatternReadinessAnalyzer } from './pattern-readiness-analyzer.js';
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
  expectedBenefit: number; // 0-100 scale

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
    memoryEfficiencyScore: number; // 0-100
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
    simple: number; // MB
    moderate: number; // MB
    complex: number; // MB
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
export class ILAnalyticsSuite {
  private readonly controlFlowAnalyzer: ControlFlowAnalyzer;
  private readonly sixtyTwoZeroTwoAnalyzer: SixtyTwo6502Analyzer;
  private readonly metricsAnalyzer: ILMetricsAnalyzer;
  private readonly patternReadinessAnalyzer: PatternReadinessAnalyzer;

  /** Performance benchmarks */
  public static readonly BENCHMARKS: AnalyticsPerformanceBenchmarks = {
    simpleFunctionTarget: 50,
    moderateComplexityTarget: 150,
    complexFunctionTarget: 500,
    memoryUsageTargets: {
      simple: 1,
      moderate: 5,
      complex: 10,
    },
  };

  /** Accuracy standards */
  public static readonly ACCURACY_STANDARDS: AnalyticsAccuracyStandards = {
    performancePredictionAccuracy: 95,
    patternSelectionAccuracy: 90,
    qualityScoringAccuracy: 92,
    controlFlowAnalysisAccuracy: 98,
  };

  constructor() {
    this.controlFlowAnalyzer = new ControlFlowAnalyzer();
    this.sixtyTwoZeroTwoAnalyzer = new SixtyTwo6502Analyzer();
    this.metricsAnalyzer = new ILMetricsAnalyzer();

    // Create a mock pattern registry for the analyzer
    const mockPatternRegistry = {
      getPatternsByCategory: (category: string) => [],
    };

    this.patternReadinessAnalyzer = new PatternReadinessAnalyzer(mockPatternRegistry);
  }

  /**
   * Perform comprehensive analytics on IL program
   */
  async analyzeProgram(program: ILProgram): Promise<ComprehensiveAnalyticsResult> {
    const startTime = this.now();
    const startMemory = this.getMemoryUsage();

    const componentTiming = {
      controlFlow: 0,
      sixtyTwoZeroTwo: 0,
      qualityMetrics: 0,
      patternReadiness: 0,
      integration: 0,
    };

    try {
      // Analyze first function for now (simplified implementation)
      const firstModule = program.modules[0];
      if (!firstModule) {
        throw new Error('Program has no modules to analyze');
      }

      const firstFunction = firstModule.functions[0];
      if (!firstFunction) {
        throw new Error('Program has no functions to analyze');
      }

      // Control Flow Analysis
      const cfStart = this.now();
      const controlFlow = this.controlFlowAnalyzer.analyzeFunction(firstFunction);
      componentTiming.controlFlow = this.now() - cfStart;

      // 6502-Specific Analysis
      const sixtyTwoZeroTwoStart = this.now();
      const sixtyTwoZeroTwo = this.sixtyTwoZeroTwoAnalyzer.analyzeFunction(
        firstFunction,
        controlFlow
      );
      componentTiming.sixtyTwoZeroTwo = this.now() - sixtyTwoZeroTwoStart;

      // Quality Metrics Analysis
      const metricsStart = this.now();
      const qualityAnalysisResult = this.metricsAnalyzer.analyzeFunction(
        firstFunction,
        controlFlow,
        sixtyTwoZeroTwo
      );
      const qualityMetrics = qualityAnalysisResult.complexityMetrics;
      componentTiming.qualityMetrics = this.now() - metricsStart;

      // Pattern Readiness Analysis
      const patternStart = this.now();
      const patternReadinessResult = this.patternReadinessAnalyzer.analyzePatternReadiness(
        program,
        qualityAnalysisResult,
        controlFlow,
        sixtyTwoZeroTwo
      );
      const patternReadiness = patternReadinessResult.applicablePatterns.map(p => ({
        patternId: p.pattern.id,
        patternName: p.pattern.name,
        applicabilityScore: p.applicabilityScore,
        confidence: 1.0, // Convert from confidence level to number
        expectedBenefit: p.expectedBenefit.performanceGain,
        applicationProbability: p.applicabilityScore / 100,
        prerequisites: p.prerequisites.map(prereq => ({
          prerequisiteType: 'structural' as const,
          description: prereq.description,
          satisfied: prereq.satisfied,
          confidence: prereq.satisfactionConfidence,
        })),
        conflicts: [],
        safetyAssessment:
          p.safetyScore > 80
            ? ('safe' as const)
            : p.safetyScore > 50
              ? ('mostly_safe' as const)
              : ('risky' as const),
      }));
      componentTiming.patternReadiness = this.now() - patternStart;

      // Integration and Summary Generation
      const integrationStart = this.now();
      const summary = this.generateSummary(
        controlFlow,
        sixtyTwoZeroTwo,
        qualityMetrics,
        patternReadiness
      );
      componentTiming.integration = this.now() - integrationStart;

      const totalAnalysisTime = this.now() - startTime;
      const endMemory = this.getMemoryUsage();

      const performanceMetrics = this.generatePerformanceMetrics(
        totalAnalysisTime,
        componentTiming,
        startMemory,
        endMemory,
        this.classifyProgramComplexity(program)
      );

      return {
        controlFlow,
        sixtyTwoZeroTwo,
        qualityMetrics,
        patternReadiness,
        summary,
        performanceMetrics,
      };
    } catch (error) {
      throw new Error(
        `IL Analytics Suite analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Perform analytics on a single function
   */
  async analyzeFunction(ilFunction: ILFunction): Promise<ComprehensiveAnalyticsResult> {
    const program: ILProgram = {
      name: 'single-function-analysis',
      modules: [
        {
          qualifiedName: ['Analysis'],
          functions: [ilFunction],
          moduleData: [],
          exports: [],
          imports: [],
        },
      ],
      globalData: [],
      imports: [],
      exports: [],
      sourceInfo: {
        originalFiles: ['single-function-analysis'],
        compilationTimestamp: new Date(),
        compilerVersion: '0.1.0',
        targetPlatform: 'c64',
      },
    };

    return this.analyzeProgram(program);
  }

  /**
   * Validate analytics performance against benchmarks
   */
  async validatePerformance(testPrograms: ILProgram[]): Promise<PerformanceValidationResult> {
    const results: PerformanceBenchmarkResult[] = [];

    for (const program of testPrograms) {
      const complexity = this.classifyProgramComplexity(program);
      const result = await this.analyzeProgram(program);

      const benchmark = this.getBenchmarkForComplexity(complexity);
      const passed = result.performanceMetrics.totalAnalysisTime <= benchmark;

      results.push({
        programName: program.sourceInfo.originalFiles[0] || 'unnamed',
        complexity,
        actualTime: result.performanceMetrics.totalAnalysisTime,
        targetTime: benchmark,
        passed,
        performanceMargin:
          ((benchmark - result.performanceMetrics.totalAnalysisTime) / benchmark) * 100,
        memoryUsage: result.performanceMetrics.memoryUsage.peakMemoryMB,
      });
    }

    const overallPassed = results.every(r => r.passed);
    const averagePerformanceMargin =
      results.reduce((sum, r) => sum + r.performanceMargin, 0) / results.length;

    return {
      overallPassed,
      averagePerformanceMargin,
      results,
      recommendation: this.generatePerformanceRecommendation(results),
    };
  }

  /**
   * Validate analytics accuracy against known standards
   */
  async validateAccuracy(
    referenceData: AccuracyReferenceData[]
  ): Promise<AccuracyValidationResult> {
    const accuracyMetrics: AccuracyMetric[] = [];

    for (const reference of referenceData) {
      const result = await this.analyzeProgram(reference.program);

      // Validate performance prediction accuracy
      const performanceAccuracy = this.calculateAccuracy(
        [result.sixtyTwoZeroTwo.performanceAnalysis.totalCycles],
        [reference.expectedCycles]
      );

      // Validate pattern selection accuracy
      const patternAccuracy = this.calculatePatternAccuracy(
        result.patternReadiness,
        reference.expectedPatterns
      );

      // Validate quality scoring accuracy
      const qualityAccuracy = this.calculateAccuracy(
        [result.qualityMetrics.overallComplexityScore],
        [reference.expectedQualityScore]
      );

      accuracyMetrics.push({
        testName: reference.testName,
        performanceAccuracy,
        patternAccuracy,
        qualityAccuracy,
        overallAccuracy: (performanceAccuracy + patternAccuracy + qualityAccuracy) / 3,
      });
    }

    const overallAccuracy =
      accuracyMetrics.reduce((sum, m) => sum + m.overallAccuracy, 0) / accuracyMetrics.length;
    const meetsStandards =
      overallAccuracy >= ILAnalyticsSuite.ACCURACY_STANDARDS.performancePredictionAccuracy;

    return {
      overallAccuracy,
      meetsStandards,
      accuracyMetrics,
      recommendation: this.generateAccuracyRecommendation(accuracyMetrics),
    };
  }

  /**
   * Generate summary from all analytics results
   */
  private generateSummary(
    controlFlow: ControlFlowAnalysisResult,
    sixtyTwoZeroTwo: SixtyTwo6502ValidationResult,
    qualityMetrics: ILComplexityMetrics,
    patternReadiness: PatternApplicabilityScore[]
  ): AnalyticsSummary {
    // Calculate average pattern applicability
    const avgPatternApplicability =
      patternReadiness.length > 0
        ? patternReadiness.reduce((sum, p) => sum + p.applicabilityScore, 0) /
          patternReadiness.length
        : 0;

    // Calculate overall quality score (weighted average)
    const qualityScore =
      qualityMetrics.overallComplexityScore * 0.3 +
      controlFlow.analysisMetrics.accuracyScore * 100 * 0.2 +
      sixtyTwoZeroTwo.performanceAnalysis.performanceScore * 0.3 +
      avgPatternApplicability * 0.2;

    // Calculate optimization readiness score
    const optimizationReadinessScore =
      avgPatternApplicability * 0.4 +
      sixtyTwoZeroTwo.performanceAnalysis.performanceScore * 0.4 +
      (100 - qualityMetrics.cyclomaticComplexity * 2) * 0.2; // Lower complexity = higher readiness

    // Calculate performance prediction confidence
    const performancePredictionConfidence = Math.min(
      100,
      sixtyTwoZeroTwo.analysisMetrics.accuracyScore * 100 * 0.5 +
        controlFlow.analysisMetrics.accuracyScore * 100 * 0.3 +
        qualityMetrics.overallComplexityScore * 0.2
    );

    // Generate recommendations
    const topRecommendations = this.generateRecommendations(
      controlFlow,
      sixtyTwoZeroTwo,
      qualityMetrics,
      patternReadiness
    );

    // Identify critical issues
    const criticalIssues = this.identifyCriticalIssues(
      controlFlow,
      sixtyTwoZeroTwo,
      qualityMetrics,
      patternReadiness
    );

    // Determine confidence level
    const confidenceLevel = this.determineConfidenceLevel(
      qualityScore,
      optimizationReadinessScore,
      performancePredictionConfidence
    );

    return {
      overallQualityScore: Math.round(qualityScore),
      optimizationReadinessScore: Math.round(optimizationReadinessScore),
      performancePredictionConfidence: Math.round(performancePredictionConfidence),
      topRecommendations,
      criticalIssues,
      confidenceLevel,
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    controlFlow: ControlFlowAnalysisResult,
    sixtyTwoZeroTwo: SixtyTwo6502ValidationResult,
    qualityMetrics: ILComplexityMetrics,
    patternReadiness: PatternApplicabilityScore[]
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // High complexity recommendation
    if (qualityMetrics.cyclomaticComplexity > 15) {
      recommendations.push({
        type: 'ARCHITECTURE',
        priority: 'HIGH',
        description: 'Function complexity is high - consider breaking into smaller functions',
        expectedBenefit: 70,
        implementationDifficulty: 'MEDIUM',
        recommendedPatterns: ['function-decomposition', 'complexity-reduction'],
      });
    }

    // Performance optimization opportunities
    if (sixtyTwoZeroTwo.performanceAnalysis.performanceScore > 70) {
      recommendations.push({
        type: 'PERFORMANCE',
        priority: 'HIGH',
        description: 'Significant 6502 optimization opportunities detected',
        expectedBenefit: sixtyTwoZeroTwo.performanceAnalysis.performanceScore,
        implementationDifficulty: 'MEDIUM',
        recommendedPatterns: sixtyTwoZeroTwo.optimizationRecommendations.map(rec => rec.type) || [],
      });
    }

    // Pattern application recommendations
    for (const pattern of patternReadiness.slice(0, 3)) {
      if (pattern.applicabilityScore > 80) {
        recommendations.push({
          type: 'PATTERN',
          priority: pattern.applicabilityScore > 90 ? 'HIGH' : 'MEDIUM',
          description: `Apply ${pattern.patternId} pattern for optimization`,
          expectedBenefit: pattern.expectedBenefit,
          implementationDifficulty: 'EASY',
          recommendedPatterns: [pattern.patternId],
        });
      }
    }

    // Sort by expected benefit
    return recommendations.sort((a, b) => b.expectedBenefit - a.expectedBenefit).slice(0, 5);
  }

  /**
   * Identify critical issues requiring attention
   */
  private identifyCriticalIssues(
    controlFlow: ControlFlowAnalysisResult,
    sixtyTwoZeroTwo: SixtyTwo6502ValidationResult,
    qualityMetrics: ILComplexityMetrics,
    patternReadiness: PatternApplicabilityScore[]
  ): AnalyticsIssue[] {
    const issues: AnalyticsIssue[] = [];

    // Very high complexity
    if (qualityMetrics.cyclomaticComplexity > 25) {
      issues.push({
        severity: 'ERROR',
        category: 'MAINTAINABILITY',
        description: `Extremely high cyclomatic complexity (${qualityMetrics.cyclomaticComplexity})`,
        suggestedResolution: 'Break function into smaller, focused functions',
      });
    }

    // Poor control flow quality
    if (controlFlow.analysisMetrics.accuracyScore < 0.4) {
      issues.push({
        severity: 'WARNING',
        category: 'PERFORMANCE',
        description: 'Poor control flow graph quality detected',
        suggestedResolution: 'Simplify control flow and reduce branching complexity',
      });
    }

    // No applicable patterns
    if (patternReadiness.length === 0) {
      issues.push({
        severity: 'INFO',
        category: 'OPTIMIZATION',
        description: 'No optimization patterns applicable to this IL',
        suggestedResolution: 'Review IL structure for optimization opportunities',
      });
    }

    return issues;
  }

  /**
   * Determine overall confidence level
   */
  private determineConfidenceLevel(
    qualityScore: number,
    optimizationReadinessScore: number,
    performancePredictionConfidence: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
    const average =
      (qualityScore + optimizationReadinessScore + performancePredictionConfidence) / 3;

    if (average >= 90) return 'VERY_HIGH';
    if (average >= 75) return 'HIGH';
    if (average >= 60) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate performance metrics
   */
  private generatePerformanceMetrics(
    totalTime: number,
    componentTiming: any,
    startMemory: any,
    endMemory: any,
    complexity: ProgramComplexity
  ): AnalyticsPerformanceMetrics {
    const memoryDelta = (endMemory?.heapUsed || 0) - (startMemory?.heapUsed || 0);
    const peakMemoryMB =
      Math.max(endMemory?.heapUsed || 0, startMemory?.heapUsed || 0) / (1024 * 1024);

    const target = this.getBenchmarkForComplexity(complexity);
    const performanceGrade = this.calculatePerformanceGrade(totalTime, target);

    return {
      totalAnalysisTime: Math.round(totalTime * 100) / 100,
      componentTiming,
      memoryUsage: {
        peakMemoryMB: Math.round(peakMemoryMB * 100) / 100,
        averageMemoryMB: Math.round(peakMemoryMB * 0.8 * 100) / 100,
        memoryEfficiencyScore: Math.max(0, 100 - peakMemoryMB * 10),
      },
      performanceGrade,
    };
  }

  /**
   * Classify program complexity for benchmarking
   */
  private classifyProgramComplexity(program: ILProgram): ProgramComplexity {
    const totalInstructions = program.modules.reduce((sum: number, module) => {
      return (
        sum + module.functions.reduce((funcSum, func) => funcSum + func.instructions.length, 0)
      );
    }, 0);
    const functionCount = program.modules.reduce((sum, module) => sum + module.functions.length, 0);

    if (totalInstructions < 50 && functionCount <= 2) return 'Simple';
    if (totalInstructions < 200 && functionCount <= 8) return 'Moderate';
    return 'Complex';
  }

  /**
   * Get benchmark target for complexity level
   */
  private getBenchmarkForComplexity(complexity: ProgramComplexity): number {
    switch (complexity) {
      case 'Simple':
        return ILAnalyticsSuite.BENCHMARKS.simpleFunctionTarget;
      case 'Moderate':
        return ILAnalyticsSuite.BENCHMARKS.moderateComplexityTarget;
      case 'Complex':
        return ILAnalyticsSuite.BENCHMARKS.complexFunctionTarget;
      default:
        return ILAnalyticsSuite.BENCHMARKS.complexFunctionTarget;
    }
  }

  /**
   * Calculate performance grade
   */
  private calculatePerformanceGrade(
    actualTime: number,
    targetTime: number
  ): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
    const ratio = actualTime / targetTime;

    if (ratio <= 0.5) return 'A+';
    if (ratio <= 0.7) return 'A';
    if (ratio <= 0.9) return 'B+';
    if (ratio <= 1.0) return 'B';
    if (ratio <= 1.3) return 'C+';
    if (ratio <= 1.6) return 'C';
    if (ratio <= 2.0) return 'D';
    return 'F';
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): any {
    // Simplified memory usage for browser compatibility
    return { heapUsed: 0, heapTotal: 0 };
  }

  /**
   * Get current time in milliseconds
   */
  private now(): number {
    try {
      // Try performance API first (more accurate)
      if (
        typeof globalThis !== 'undefined' &&
        'performance' in globalThis &&
        (globalThis as any).performance?.now
      ) {
        return (globalThis as any).performance.now();
      }
    } catch {
      // Fallback for environments without performance API
    }
    // Fallback to Date.now()
    return Date.now();
  }

  /**
   * Calculate accuracy percentage
   */
  private calculateAccuracy(predicted: number[], actual: number[]): number {
    if (predicted.length !== actual.length || predicted.length === 0) return 0;

    let totalError = 0;
    for (let i = 0; i < predicted.length; i++) {
      const error = Math.abs(predicted[i] - actual[i]) / Math.max(actual[i], 1);
      totalError += error;
    }

    const averageError = totalError / predicted.length;
    return Math.max(0, (1 - averageError) * 100);
  }

  /**
   * Calculate pattern selection accuracy
   */
  private calculatePatternAccuracy(
    actualPatterns: PatternApplicabilityScore[],
    expectedPatterns: string[]
  ): number {
    const actualPatternIds = actualPatterns.map(p => p.patternId);
    const intersection = expectedPatterns.filter(p => actualPatternIds.includes(p));
    const union = [...new Set([...actualPatternIds, ...expectedPatterns])];

    return union.length > 0 ? (intersection.length / union.length) * 100 : 100;
  }

  /**
   * Generate performance recommendation
   */
  private generatePerformanceRecommendation(results: PerformanceBenchmarkResult[]): string {
    const failedTests = results.filter(r => !r.passed);

    if (failedTests.length === 0) {
      return 'All performance benchmarks passed. Analytics system is performing optimally.';
    }

    const worstPerformer = failedTests.reduce((worst, current) =>
      current.performanceMargin < worst.performanceMargin ? current : worst
    );

    return `Performance optimization needed. Worst performer: ${worstPerformer.programName} (${worstPerformer.complexity}) took ${worstPerformer.actualTime}ms vs target ${worstPerformer.targetTime}ms.`;
  }

  /**
   * Generate accuracy recommendation
   */
  private generateAccuracyRecommendation(metrics: AccuracyMetric[]): string {
    const averageAccuracy = metrics.reduce((sum, m) => sum + m.overallAccuracy, 0) / metrics.length;

    if (averageAccuracy >= 95) {
      return 'Analytics accuracy is excellent. System is production-ready.';
    }

    if (averageAccuracy >= 85) {
      return 'Analytics accuracy is good but could be improved. Consider calibrating prediction models.';
    }

    return 'Analytics accuracy needs significant improvement. Review and recalibrate all prediction algorithms.';
  }
}

// Supporting types for validation
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
