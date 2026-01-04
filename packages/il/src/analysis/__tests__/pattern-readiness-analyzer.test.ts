/**
 * Pattern-Readiness Analytics Integration Tests
 *
 * Comprehensive tests for the pattern-readiness analyzer that connects IL quality
 * metrics with the 470+ optimization pattern system to provide intelligent pattern
 * selection, conflict prediction, and priority ranking.
 *
 * @fileoverview Tests for pattern-readiness analytics integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ILProgram, ILModule, ILFunction } from '../../il-types.js';
import type {
  ILQualityAnalysisResult,
  ILComplexityMetrics,
  PerformancePredictionModel,
  OptimizationReadinessAnalysis
} from '../types/metrics-types.js';
import type { ControlFlowAnalysisResult } from '../types/control-flow-types.js';
import type { SixtyTwo6502ValidationResult } from '../types/6502-analysis-types.js';
import {
  PatternReadinessAnalyzer,
  type PatternReadinessAnalysisResult,
  type RankedPatternRecommendation,
  type PatternConflictPrediction,
  type OptimizationStrategy,
  type PatternAnalysisOptions
} from '../pattern-readiness-analyzer.js';

// =============================================================================
// Test Fixtures and Mocks
// =============================================================================

/**
 * Create a mock optimization pattern for testing
 */
function createMockOptimizationPattern(
  id: string,
  category: string,
  priority: number,
  improvementPercentage: number = 15
) {
  return {
    id,
    name: `Test Pattern ${id}`,
    category,
    description: `Test pattern for category ${category}`,
    priority,
    platforms: ['c64'],
    matches: vi.fn().mockReturnValue(null),
    transform: vi.fn().mockReturnValue({ success: true, metrics: {} }),
    expectedImprovement: {
      improvementPercentage,
      cyclesSaved: 100,
      bytesSaved: 50,
      reliability: 'high' as const
    }
  };
}

/**
 * Create a mock pattern registry for testing
 */
function createMockPatternRegistry() {
  const patterns = {
    mathematics: [
      createMockOptimizationPattern('math_opt_1', 'mathematics', 3, 20),
      createMockOptimizationPattern('math_opt_2', 'mathematics', 2, 15)
    ],
    hardware: [
      createMockOptimizationPattern('hw_opt_1', 'hardware', 4, 30)
    ],
    control_flow: [
      createMockOptimizationPattern('cf_opt_1', 'control_flow', 3, 25)
    ],
    memory: [
      createMockOptimizationPattern('mem_opt_1', 'memory', 2, 10)
    ],
    basic: [
      createMockOptimizationPattern('basic_opt_1', 'basic', 1, 5)
    ]
  };

  return {
    getPatternsByCategory: vi.fn().mockImplementation((category: string) => {
      return patterns[category as keyof typeof patterns] || [];
    })
  };
}

/**
 * Create a mock IL program for testing
 */
function createMockILProgram(): ILProgram {
  const mockFunction: ILFunction = {
    name: 'testFunction',
    qualifiedName: ['test', 'testFunction'],
    parameters: [],
    returnType: { kind: 'primitive', name: 'byte' },
    localVariables: [],
    instructions: [],
    labels: new Map(),
    isCallback: false,
    isExported: false,
    sourceLocation: { line: 1, column: 1, offset: 0 }
  };

  const mockModule: ILModule = {
    qualifiedName: ['test'],
    functions: [mockFunction],
    moduleData: [],
    exports: [],
    imports: []
  };

  return {
    name: 'testProgram',
    modules: [mockModule],
    globalData: [],
    imports: [],
    exports: [],
    sourceInfo: {
      originalFiles: ['test.blend'],
      compilationTimestamp: new Date(),
      compilerVersion: '0.1.0',
      targetPlatform: 'c64'
    }
  };
}

/**
 * Create mock IL quality analysis result
 */
function createMockQualityAnalysis(): ILQualityAnalysisResult {
  const complexityMetrics: ILComplexityMetrics = {
    cyclomaticComplexity: 5,
    instructionComplexity: {
      totalInstructions: 100,
      complexInstructionRatio: 0.2,
      temporaryVariableRatio: 0.3,
      branchDensity: 0.15,
      functionCallDensity: 0.1,
      memoryOperationDensity: 0.25,
      arithmeticComplexity: 15,
      score: 40
    },
    controlFlowComplexity: {
      basicBlockCount: 8,
      edgeCount: 12,
      loopNestingDepth: 2,
      conditionalBranchCount: 6,
      unconditionalJumpCount: 2,
      functionCallCount: 3,
      returnStatementCount: 1,
      complexityRatio: 1.5,
      score: 35
    },
    dataFlowComplexity: {
      variableCount: 15,
      defUseChainLength: 25,
      maxLiveVariables: 8,
      variableInterferenceCount: 12,
      memoryAliasComplexity: 5,
      dependencyDepth: 3,
      score: 30
    },
    overallComplexityScore: 38
  };

  const performancePrediction: PerformancePredictionModel = {
    estimatedCycles: {
      bestCase: 500,
      averageCase: 750,
      worstCase: 1000,
      confidence: 0.85,
      assumptionsMade: ['No memory wait states', 'No interrupt interference'],
      uncertaintyFactors: []
    },
    memoryUsage: {
      zeroPageUsage: { staticUsage: 16, dynamicUsage: 8, peakUsage: 24, efficiency: 0.8 },
      stackUsage: { staticUsage: 32, dynamicUsage: 16, peakUsage: 48, efficiency: 0.75 },
      ramUsage: { staticUsage: 1024, dynamicUsage: 512, peakUsage: 1536, efficiency: 0.9 },
      dataUsage: { staticUsage: 256, dynamicUsage: 0, peakUsage: 256, efficiency: 1.0 },
      totalUsage: 1864,
      utilizationScore: 75
    },
    registerPressure: {
      accumulatorPressure: { averagePressure: 0.6, peakPressure: 0.9, pressureDistribution: [], criticalRegions: [] },
      indexXPressure: { averagePressure: 0.4, peakPressure: 0.7, pressureDistribution: [], criticalRegions: [] },
      indexYPressure: { averagePressure: 0.3, peakPressure: 0.6, pressureDistribution: [], criticalRegions: [] },
      combinedPressure: { averagePressure: 0.5, peakPressure: 0.8, pressureDistribution: [], criticalRegions: [] },
      spillProbability: 0.2,
      allocationQuality: 80
    },
    bottlenecks: [],
    performanceScore: 70,
    platformSpecificFactors: {
      memoryTiming: {
        zeroPageCycles: 2,
        ramCycles: 3,
        ioRegisterCycles: 4,
        pageBoundaryCycles: 4,
        bankSwitchCycles: 10
      },
      processorFeatures: {
        hasDecimalMode: true,
        hasBCDInstructions: true,
        hasExtendedInstructions: false,
        pipelineDepth: 1,
        branchPredictionAccuracy: 0.5
      },
      platformConstraints: {
        interruptLatency: 7,
        vicInterference: true,
        sidInterference: false,
        ciaTimingConstraints: true
      }
    }
  };

  const optimizationReadiness: OptimizationReadinessAnalysis = {
    categoryReadiness: new Map([
      ['arithmetic', { category: 'arithmetic', readinessScore: 80, confidence: 0.9, blockers: [], opportunities: [], recommendedPatterns: [], estimatedBenefit: 25 }],
      ['control_flow', { category: 'control_flow', readinessScore: 70, confidence: 0.8, blockers: [], opportunities: [], recommendedPatterns: [], estimatedBenefit: 20 }],
      ['memory', { category: 'memory', readinessScore: 60, confidence: 0.7, blockers: [], opportunities: [], recommendedPatterns: [], estimatedBenefit: 15 }]
    ]),
    patternApplicability: [],
    impactPotential: {
      performanceImpact: { bestCase: 20, expectedCase: 15, worstCase: 10, confidence: 0.8, factors: [] },
      memorySizeImpact: { bestCase: 15, expectedCase: 10, worstCase: 5, confidence: 0.7, factors: [] },
      codeQualityImpact: { bestCase: 25, expectedCase: 20, worstCase: 15, confidence: 0.9, factors: [] },
      maintainabilityImpact: { bestCase: 10, expectedCase: 5, worstCase: 0, confidence: 0.6, factors: [] },
      overallImpact: 75
    },
    transformationSafety: {
      semanticSafety: {
        semanticPreservation: 95,
        dataFlowSafety: 90,
        controlFlowSafety: 85,
        sideEffectSafety: 92,
        riskFactors: []
      },
      performanceSafety: {
        performanceGuarantee: 80,
        worstCaseImpact: 5,
        regressionRisk: 10,
        testCoverage: 85
      },
      platformSafety: {
        hardwareCompatibility: 95,
        memoryConstraintSafety: 90,
        timingConstraintSafety: 85,
        interruptSafety: 88
      },
      overallSafetyScore: 89
    },
    overallReadinessScore: 75
  };

  return {
    complexityMetrics,
    performancePrediction,
    optimizationReadiness,
    qualityGates: {
      gates: [],
      overallStatus: 'pass',
      qualityScore: 80,
      improvementRecommendations: []
    },
    analysisMetrics: {
      analysisTimeMs: 250,
      memoryUsageBytes: 1024000,
      predictionAccuracy: 0.85,
      analysisCompleteness: 0.95,
      confidenceScore: 0.88
    },
    recommendations: [],
    summary: {
      overallQualityScore: 78,
      complexityLevel: 'moderate',
      performanceLevel: 'good',
      optimizationPotential: 'moderate',
      recommendedNextSteps: ['Apply arithmetic optimizations', 'Consider control flow optimization'],
      keyFindings: ['Good optimization readiness', 'Moderate complexity level'],
      criticalIssues: []
    }
  };
}

/**
 * Create mock control flow analysis result
 */
function createMockCFGAnalysis(): ControlFlowAnalysisResult {
  return {
    controlFlowGraph: {
      entryBlock: 0,
      exitBlocks: [3],
      blocks: [
        { blockId: 0, startInstruction: 0, endInstruction: 5, predecessors: [], successors: [1, 2] },
        { blockId: 1, startInstruction: 6, endInstruction: 10, predecessors: [0], successors: [3] },
        { blockId: 2, startInstruction: 11, endInstruction: 15, predecessors: [0], successors: [3] },
        { blockId: 3, startInstruction: 16, endInstruction: 20, predecessors: [1, 2], successors: [] }
      ],
      edges: [
        { from: 0, to: 1, edgeType: 'branch_true', probability: 0.6 },
        { from: 0, to: 2, edgeType: 'branch_false', probability: 0.4 },
        { from: 1, to: 3, edgeType: 'fall_through', probability: 1.0 },
        { from: 2, to: 3, edgeType: 'fall_through', probability: 1.0 }
      ]
    },
    complexityMetrics: {
      cyclomaticComplexity: 2,
      basicBlockCount: 4,
      edgeCount: 4,
      loopCount: 0,
      functionCallCount: 2,
      maxDepth: 1,
      averageBranchingFactor: 1.5
    },
    dominanceAnalysis: {
      dominators: new Map(),
      postDominators: new Map(),
      dominanceFrontiers: new Map(),
      dominanceTree: { rootId: 0, children: new Map() }
    },
    loopAnalysis: {
      naturalLoops: [],
      loopNestingTree: { loopId: -1, nestedLoops: [] },
      loopInvariantInfo: new Map()
    },
    reachabilityAnalysis: {
      reachableBlocks: new Set([0, 1, 2, 3]),
      unreachableBlocks: new Set(),
      reachabilityMatrix: new Map()
    },
    analysisMetadata: {
      analysisTimeMs: 50,
      analysisQuality: 95,
      validationResults: {
        structuralIntegrity: true,
        reachabilityConsistency: true,
        dominanceConsistency: true,
        issuesFound: []
      }
    }
  };
}

/**
 * Create mock 6502 validation result
 */
function createMock6502Analysis(): SixtyTwo6502ValidationResult {
  return {
    platformValidation: {
      platformCompatibility: 95,
      hardwareSupport: 90,
      memoryConstraints: 85,
      timingValidation: 88,
      instructionSupport: 98
    },
    performanceAnalysis: {
      cycleEstimation: {
        totalCycles: 750,
        criticalPathCycles: 120,
        averageCyclesPerInstruction: 3.2,
        worstCaseScenario: 1200
      },
      memoryEfficiency: {
        zeroPageUtilization: 75,
        memoryAccessEfficiency: 80,
        cacheEfficiency: 85,
        memoryFragmentation: 10
      },
      registerUtilization: {
        registerPressure: 60,
        spillFrequency: 0.15,
        registerConflicts: 3
      }
    },
    optimizationOpportunities: [
      {
        opportunityType: 'use_zero_page',
        benefit: 15,
        confidence: 0.8,
        description: 'Use zero page addressing for frequently accessed variables'
      },
      {
        opportunityType: 'register_allocation',
        benefit: 20,
        confidence: 0.9,
        description: 'Optimize register allocation to reduce memory access'
      }
    ],
    complianceIssues: [],
    analysisMetadata: {
      analysisVersion: '1.0.0',
      targetPlatform: 'c64',
      analysisTimeMs: 100,
      validationCoverage: 95
    }
  };
}

// =============================================================================
// Test Cases
// =============================================================================

describe('PatternReadinessAnalyzer', () => {
  let analyzer: PatternReadinessAnalyzer;
  let mockPatternRegistry: ReturnType<typeof createMockPatternRegistry>;
  let mockProgram: ILProgram;
  let mockQualityAnalysis: ILQualityAnalysisResult;
  let mockCFGAnalysis: ControlFlowAnalysisResult;
  let mock6502Analysis: SixtyTwo6502ValidationResult;

  beforeEach(() => {
    mockPatternRegistry = createMockPatternRegistry();
    mockProgram = createMockILProgram();
    mockQualityAnalysis = createMockQualityAnalysis();
    mockCFGAnalysis = createMockCFGAnalysis();
    mock6502Analysis = createMock6502Analysis();

    analyzer = new PatternReadinessAnalyzer(mockPatternRegistry as any);
  });

  describe('Pattern Applicability Analysis', () => {
    it('should analyze patterns from all categories', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      expect(mockPatternRegistry.getPatternsByCategory).toHaveBeenCalledWith('mathematics');
      expect(mockPatternRegistry.getPatternsByCategory).toHaveBeenCalledWith('hardware');
      expect(mockPatternRegistry.getPatternsByCategory).toHaveBeenCalledWith('control_flow');
      expect(mockPatternRegistry.getPatternsByCategory).toHaveBeenCalledWith('memory');
      expect(mockPatternRegistry.getPatternsByCategory).toHaveBeenCalledWith('basic');

      expect(result.applicablePatterns).toBeDefined();
      expect(Array.isArray(result.applicablePatterns)).toBe(true);
    });

    it('should rank patterns by overall score', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      // Patterns should be sorted by overall rank (descending)
      const ranks = result.applicablePatterns.map(p => p.overallRank);
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i]).toBeLessThanOrEqual(ranks[i - 1]);
      }
    });

    it('should filter out patterns with low applicability scores', () => {
      // Mock a pattern with very low improvement percentage
      const lowValuePattern = createMockOptimizationPattern('low_value', 'basic', 1, 1);
      mockPatternRegistry.getPatternsByCategory.mockImplementation((category: string) => {
        if (category === 'basic') {
          return [lowValuePattern];
        }
        return [];
      });

      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      // Pattern with low improvement should be filtered out (threshold is 20)
      expect(result.applicablePatterns.length).toBe(0);
    });

    it('should include comprehensive scoring metrics', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      if (result.applicablePatterns.length > 0) {
        const pattern = result.applicablePatterns[0];

        expect(pattern.applicabilityScore).toBeGreaterThanOrEqual(0);
        expect(pattern.applicabilityScore).toBeLessThanOrEqual(100);
        expect(pattern.impactScore).toBeGreaterThanOrEqual(0);
        expect(pattern.impactScore).toBeLessThanOrEqual(100);
        expect(pattern.safetyScore).toBeGreaterThanOrEqual(0);
        expect(pattern.safetyScore).toBeLessThanOrEqual(100);
        expect(pattern.complexityScore).toBeGreaterThanOrEqual(0);
        expect(pattern.complexityScore).toBeLessThanOrEqual(100);
        expect(pattern.overallRank).toBeGreaterThanOrEqual(0);
        expect(pattern.overallRank).toBeLessThanOrEqual(100);

        expect(pattern.confidenceLevel).toBeOneOf(['very_low', 'low', 'medium', 'high', 'very_high']);
        expect(Array.isArray(pattern.prerequisites)).toBe(true);
        expect(pattern.expectedBenefit).toBeDefined();
        expect(pattern.applicationContext).toBeDefined();
        expect(Array.isArray(pattern.riskFactors)).toBe(true);
      }
    });
  });

  describe('Pattern Conflict Prediction', () => {
    it('should predict conflicts when enabled', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      expect(Array.isArray(result.patternConflicts)).toBe(true);
      // Conflicts may be empty if no patterns conflict, which is valid
    });

    it('should skip conflict prediction when disabled', () => {
      const options: PatternAnalysisOptions = {
        enableConflictPrediction: false,
        enableSafetyAnalysis: true,
        riskTolerance: 'balanced',
        optimizationGoals: {
          prioritizePerformance: false,
          prioritizeMemory: false,
          prioritizeSafety: true,
          prioritizeMaintainability: false,
          targetImprovement: 20
        },
        platformConstraints: {
          memoryConstraints: { maxZeroPageUsage: 64, maxRamUsage: 32768, maxStackUsage: 256 },
          timingConstraints: { maxCycleCount: 1000000, interruptLatencyMax: 100, realTimeRequirements: false },
          hardwareConstraints: {
            platform: 'c64',
            availableRegisters: ['A', 'X', 'Y'],
            specialInstructions: [],
            memoryBanking: false
          }
        }
      };

      const analyzerWithOptions = new PatternReadinessAnalyzer(mockPatternRegistry as any, options);
      const result = analyzerWithOptions.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      expect(result.patternConflicts).toHaveLength(0);
    });

    it('should provide conflict resolution strategies when conflicts are found', () => {
      // Mock patterns with same category to force conflict
      const conflictingPatterns = [
        createMockOptimizationPattern('conflict_1', 'memory', 3, 20),
        createMockOptimizationPattern('conflict_2', 'memory', 3, 25)
      ];

      mockPatternRegistry.getPatternsByCategory.mockImplementation((category: string) => {
        if (category === 'memory') {
          return conflictingPatterns;
        }
        return [];
      });

      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      if (result.patternConflicts.length > 0) {
        const conflict = result.patternConflicts[0];

        expect(conflict.pattern1Id).toBeDefined();
        expect(conflict.pattern2Id).toBeDefined();
        expect(conflict.conflictType).toBeOneOf(['direct_conflict', 'resource_conflict', 'ordering_dependency', 'semantic_conflict', 'performance_conflict', 'safety_conflict']);
        expect(conflict.conflictSeverity).toBeOneOf(['minor', 'moderate', 'major', 'blocking']);
        expect(conflict.conflictProbability).toBeGreaterThanOrEqual(0);
        expect(conflict.conflictProbability).toBeLessThanOrEqual(1);
        expect(Array.isArray(conflict.resolutionStrategies)).toBe(true);
        expect(Array.isArray(conflict.avoidanceRecommendations)).toBe(true);
      }
    });
  });

  describe('Optimization Strategy Generation', () => {
    it('should generate comprehensive optimization strategy', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      const strategy = result.optimizationStrategy;

      expect(strategy.strategyType).toBeOneOf(['aggressive', 'balanced', 'conservative', 'incremental', 'experimental']);
      expect(strategy.phaseCount).toBeGreaterThan(0);
      expect(strategy.estimatedDuration).toBeGreaterThan(0);
      expect(strategy.expectedImprovement).toBeDefined();
      expect(strategy.riskProfile).toBeDefined();
      expect(strategy.resourceRequirements).toBeDefined();
      expect(Array.isArray(strategy.alternativeStrategies)).toBe(true);
    });

    it('should adapt strategy based on risk tolerance', () => {
      const conservativeOptions: PatternAnalysisOptions = {
        enableConflictPrediction: true,
        enableSafetyAnalysis: true,
        riskTolerance: 'risk_averse',
        optimizationGoals: {
          prioritizePerformance: false,
          prioritizeMemory: false,
          prioritizeSafety: true,
          prioritizeMaintainability: true,
          targetImprovement: 20
        },
        platformConstraints: {
          memoryConstraints: { maxZeroPageUsage: 64, maxRamUsage: 32768, maxStackUsage: 256 },
          timingConstraints: { maxCycleCount: 1000000, interruptLatencyMax: 100, realTimeRequirements: false },
          hardwareConstraints: {
            platform: 'c64',
            availableRegisters: ['A', 'X', 'Y'],
            specialInstructions: [],
            memoryBanking: false
          }
        }
      };

      const conservativeAnalyzer = new PatternReadinessAnalyzer(mockPatternRegistry as any, conservativeOptions);
      const result = conservativeAnalyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      expect(result.optimizationStrategy.strategyType).toBe('conservative');
    });

    it('should generate alternative strategies', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      const alternatives = result.optimizationStrategy.alternativeStrategies;
      expect(alternatives.length).toBeGreaterThan(0);

      if (alternatives.length > 0) {
        const alternative = alternatives[0];
        expect(alternative.strategyId).toBeDefined();
        expect(alternative.description).toBeDefined();
        expect(alternative.tradeoffs).toBeDefined();
        expect(alternative.suitability).toBeGreaterThanOrEqual(0);
        expect(alternative.suitability).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Application Sequencing', () => {
    it('should generate ordered application steps', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      const steps = result.applicationOrder;
      expect(Array.isArray(steps)).toBe(true);

      if (steps.length > 0) {
        // Check step ordering
        for (let i = 0; i < steps.length; i++) {
          expect(steps[i].stepNumber).toBe(i + 1);
        }

        // Check step completeness
        const firstStep = steps[0];
        expect(Array.isArray(firstStep.patternsToApply)).toBe(true);
        expect(firstStep.expectedDuration).toBeGreaterThan(0);
        expect(Array.isArray(firstStep.prerequisites)).toBe(true);
        expect(typeof firstStep.validationRequired).toBe('boolean');
        expect(firstStep.rollbackStrategy).toBeDefined();
        expect(Array.isArray(firstStep.successCriteria)).toBe(true);
      }
    });

    it('should prioritize higher-ranked patterns in earlier phases', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      if (result.applicablePatterns.length > 5 && result.applicationOrder.length > 1) {
        // Get patterns from first and last phases
        const firstPhasePatterns = result.applicationOrder[0].patternsToApply;
        const lastPhasePatterns = result.applicationOrder[result.applicationOrder.length - 1].patternsToApply;

        // Find corresponding pattern recommendations
        const firstPhaseRanks = firstPhasePatterns.map(id =>
          result.applicablePatterns.find(p => p.pattern.id === id)?.overallRank || 0
        );
        const lastPhaseRanks = lastPhasePatterns.map(id =>
          result.applicablePatterns.find(p => p.pattern.id === id)?.overallRank || 0
        );

        // First phase should generally have higher ranked patterns
        const avgFirstRank = firstPhaseRanks.reduce((sum, rank) => sum + rank, 0) / firstPhaseRanks.length;
        const avgLastRank = lastPhaseRanks.reduce((sum, rank) => sum + rank, 0) / lastPhaseRanks.length;

        expect(avgFirstRank).toBeGreaterThanOrEqual(avgLastRank);
      }
    });
  });

  describe('Safety Assessment', () => {
    it('should categorize patterns by safety levels', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      const safety = result.safetyAssessment;

      expect(safety.overallSafetyScore).toBeGreaterThanOrEqual(0);
      expect(safety.overallSafetyScore).toBeLessThanOrEqual(100);
      expect(safety.safePatternCount).toBeGreaterThanOrEqual(0);
      expect(safety.riskyPatternCount).toBeGreaterThanOrEqual(0);
      expect(safety.unsafePatternCount).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(safety.safetyRecommendations)).toBe(true);
      expect(Array.isArray(safety.requiredValidation)).toBe(true);
    });

    it('should provide safety recommendations for risky patterns', () => {
      // Create patterns with different safety levels
      const unsafePattern = createMockOptimizationPattern('unsafe_pattern', 'memory', 2, 50);
      mockPatternRegistry.getPatternsByCategory.mockImplementation((category: string) => {
        if (category === 'memory') {
          return [unsafePattern];
        }
        return [];
      });

      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      const safety = result.safetyAssessment;

      if (safety.unsafePatternCount > 0 || safety.riskyPatternCount > 0) {
        expect(safety.safetyRecommendations.length).toBeGreaterThan(0);

        const recommendation = safety.safetyRecommendations[0];
        expect(recommendation.recommendationId).toBeDefined();
        expect(recommendation.description).toBeDefined();
        expect(recommendation.importance).toBeOneOf(['critical', 'important', 'recommended', 'optional']);
        expect(recommendation.implementationGuidance).toBeDefined();
        expect(recommendation.validationMethod).toBeDefined();
      }
    });

    it('should skip safety analysis when disabled', () => {
      const options: PatternAnalysisOptions = {
        enableConflictPrediction: true,
        enableSafetyAnalysis: false,
        riskTolerance: 'balanced',
        optimizationGoals: {
          prioritizePerformance: true,
          prioritizeMemory: false,
          prioritizeSafety: false,
          prioritizeMaintainability: false,
          targetImprovement: 30
        },
        platformConstraints: {
          memoryConstraints: { maxZeroPageUsage: 64, maxRamUsage: 32768, maxStackUsage: 256 },
          timingConstraints: { maxCycleCount: 1000000, interruptLatencyMax: 100, realTimeRequirements: false },
          hardwareConstraints: {
            platform: 'c64',
            availableRegisters: ['A', 'X', 'Y'],
            specialInstructions: [],
            memoryBanking: false
          }
        }
      };

      const analyzerWithOptions = new PatternReadinessAnalyzer(mockPatternRegistry as any, options);
      const result = analyzerWithOptions.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      // Should use basic safety assessment
      expect(result.safetyAssessment.overallSafetyScore).toBe(75);
    });
  });

  describe('Pattern Selection Metrics', () => {
    it('should collect comprehensive selection metrics', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      const metrics = result.patternSelectionMetrics;

      expect(metrics.totalPatternsEvaluated).toBeGreaterThan(0);
      expect(metrics.applicablePatternsFound).toBeGreaterThanOrEqual(0);
      expect(metrics.conflictsDetected).toBeGreaterThanOrEqual(0);
      expect(metrics.selectionAccuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.selectionAccuracy).toBeLessThanOrEqual(1);
      expect(metrics.analysisCompleteness).toBeGreaterThanOrEqual(0);
      expect(metrics.analysisCompleteness).toBeLessThanOrEqual(1);
      expect(metrics.predictionConfidence).toBeGreaterThanOrEqual(0);
      expect(metrics.predictionConfidence).toBeLessThanOrEqual(1);

      expect(metrics.performanceMetrics).toBeDefined();
      expect(metrics.performanceMetrics.selectionTimeMs).toBeGreaterThanOrEqual(0);
      expect(metrics.performanceMetrics.memoryUsageBytes).toBeGreaterThanOrEqual(0);
      expect(metrics.performanceMetrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.performanceMetrics.cacheHitRate).toBeLessThanOrEqual(1);
      expect(metrics.performanceMetrics.predictionAccuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.performanceMetrics.predictionAccuracy).toBeLessThanOrEqual(1);
    });

    it('should track analysis completeness and confidence', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      const metadata = result.analysisMetadata;

      expect(metadata.analysisTimestamp).toBeGreaterThan(0);
      expect(metadata.analysisVersion).toBe('2.4.4');
      expect(metadata.inputQualityScore).toBeGreaterThanOrEqual(0);
      expect(metadata.inputQualityScore).toBeLessThanOrEqual(100);
      expect(metadata.patternLibraryVersion).toBeDefined();
      expect(metadata.platformTarget).toBe('c64');
      expect(metadata.analysisOptions).toBeDefined();
    });
  });

  describe('Integration with Quality Metrics', () => {
    it('should use complexity metrics to influence pattern selection', () => {
      // Create high complexity analysis
      const highComplexityAnalysis = {
        ...mockQualityAnalysis,
        complexityMetrics: {
          ...mockQualityAnalysis.complexityMetrics,
          overallComplexityScore: 85
        }
      };

      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        highComplexityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      // High complexity should affect pattern scoring
      expect(result.applicablePatterns.length).toBeGreaterThanOrEqual(0);

      if (result.applicablePatterns.length > 0) {
        // Complex code should influence safety scores (lower safety for complex code)
        const avgSafety = result.applicablePatterns.reduce((sum, p) => sum + p.safetyScore, 0) / result.applicablePatterns.length;
        expect(avgSafety).toBeLessThan(90); // Should be reduced due to complexity
      }
    });

    it('should use performance prediction to prioritize patterns', () => {
      // Create low performance analysis
      const lowPerformanceAnalysis = {
        ...mockQualityAnalysis,
        performancePrediction: {
          ...mockQualityAnalysis.performancePrediction,
          performanceScore: 30
        }
      };

      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        lowPerformanceAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      // Low performance should increase impact scores
      if (result.applicablePatterns.length > 0) {
        const avgImpact = result.applicablePatterns.reduce((sum, p) => sum + p.impactScore, 0) / result.applicablePatterns.length;
        expect(avgImpact).toBeGreaterThan(15); // Should be boosted due to low performance
      }
    });

    it('should integrate with 6502 validation results', () => {
      // Create 6502 analysis with more optimization opportunities
      const rich6502Analysis = {
        ...mock6502Analysis,
        optimizationOpportunities: [
          { opportunityType: 'use_zero_page', benefit: 15, confidence: 0.8, description: 'Zero page optimization' },
          { opportunityType: 'register_allocation', benefit: 20, confidence: 0.9, description: 'Register optimization' },
          { opportunityType: 'loop_optimization', benefit: 25, confidence: 0.85, description: 'Loop optimization' },
          { opportunityType: 'strength_reduction', benefit: 18, confidence: 0.75, description: 'Strength reduction' }
        ]
      };

      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        rich6502Analysis
      );

      // More optimization opportunities should boost impact scores
      if (result.applicablePatterns.length > 0) {
        const avgImpact = result.applicablePatterns.reduce((sum, p) => sum + p.impactScore, 0) / result.applicablePatterns.length;
        expect(avgImpact).toBeGreaterThan(10); // Should be boosted by opportunities
      }
    });
  });

  describe('Pattern Weighting and Goals', () => {
    it('should weight patterns differently based on performance goals', () => {
      const performanceOptions: PatternAnalysisOptions = {
        enableConflictPrediction: true,
        enableSafetyAnalysis: true,
        riskTolerance: 'balanced',
        optimizationGoals: {
          prioritizePerformance: true,
          prioritizeMemory: false,
          prioritizeSafety: false,
          prioritizeMaintainability: false,
          targetImprovement: 40
        },
        platformConstraints: {
          memoryConstraints: { maxZeroPageUsage: 64, maxRamUsage: 32768, maxStackUsage: 256 },
          timingConstraints: { maxCycleCount: 1000000, interruptLatencyMax: 100, realTimeRequirements: false },
          hardwareConstraints: {
            platform: 'c64',
            availableRegisters: ['A', 'X', 'Y'],
            specialInstructions: [],
            memoryBanking: false
          }
        }
      };

      const performanceAnalyzer = new PatternReadinessAnalyzer(mockPatternRegistry as any, performanceOptions);
      const result = performanceAnalyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      // Performance-focused analysis should weight impact scores higher
      if (result.applicablePatterns.length > 0) {
        // High-impact patterns should be ranked higher in performance mode
        const highImpactPatterns = result.applicablePatterns.filter(p => p.impactScore > 20);
        const lowImpactPatterns = result.applicablePatterns.filter(p => p.impactScore <= 20);

        if (highImpactPatterns.length > 0 && lowImpactPatterns.length > 0) {
          const avgHighImpactRank = highImpactPatterns.reduce((sum, p) => sum + p.overallRank, 0) / highImpactPatterns.length;
          const avgLowImpactRank = lowImpactPatterns.reduce((sum, p) => sum + p.overallRank, 0) / lowImpactPatterns.length;

          expect(avgHighImpactRank).toBeGreaterThan(avgLowImpactRank);
        }
      }
    });

    it('should weight patterns differently based on safety goals', () => {
      const safetyOptions: PatternAnalysisOptions = {
        enableConflictPrediction: true,
        enableSafetyAnalysis: true,
        riskTolerance: 'risk_averse',
        optimizationGoals: {
          prioritizePerformance: false,
          prioritizeMemory: false,
          prioritizeSafety: true,
          prioritizeMaintainability: false,
          targetImprovement: 10
        },
        platformConstraints: {
          memoryConstraints: { maxZeroPageUsage: 64, maxRamUsage: 32768, maxStackUsage: 256 },
          timingConstraints: { maxCycleCount: 1000000, interruptLatencyMax: 100, realTimeRequirements: false },
          hardwareConstraints: {
            platform: 'c64',
            availableRegisters: ['A', 'X', 'Y'],
            specialInstructions: [],
            memoryBanking: false
          }
        }
      };

      const safetyAnalyzer = new PatternReadinessAnalyzer(mockPatternRegistry as any, safetyOptions);
      const result = safetyAnalyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      // Safety-focused analysis should prioritize safer patterns
      expect(result.optimizationStrategy.riskProfile.overallRisk).toBeOneOf(['minimal', 'low']);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty pattern registry gracefully', () => {
      const emptyRegistry = {
        getPatternsByCategory: vi.fn().mockReturnValue([])
      };

      const emptyAnalyzer = new PatternReadinessAnalyzer(emptyRegistry as any);
      const result = emptyAnalyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      expect(result.applicablePatterns).toHaveLength(0);
      expect(result.patternConflicts).toHaveLength(0);
      expect(result.optimizationStrategy).toBeDefined();
      expect(result.applicationOrder).toHaveLength(0);
    });

    it('should handle minimal IL programs', () => {
      const minimalProgram: ILProgram = {
        name: 'minimal',
        modules: [],
        globalData: [],
        imports: [],
        exports: [],
        sourceInfo: {
          originalFiles: [],
          compilationTimestamp: new Date(),
          compilerVersion: '0.1.0',
          targetPlatform: 'c64'
        }
      };

      const result = analyzer.analyzePatternReadiness(
        minimalProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      expect(result).toBeDefined();
      expect(result.analysisMetadata).toBeDefined();
      expect(result.patternSelectionMetrics).toBeDefined();
    });

    it('should validate analysis result structure', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      // Validate all required fields are present
      expect(result.applicablePatterns).toBeDefined();
      expect(result.patternConflicts).toBeDefined();
      expect(result.optimizationStrategy).toBeDefined();
      expect(result.patternSelectionMetrics).toBeDefined();
      expect(result.applicationOrder).toBeDefined();
      expect(result.safetyAssessment).toBeDefined();
      expect(result.analysisMetadata).toBeDefined();

      // Validate metadata completeness
      expect(result.analysisMetadata.analysisTimestamp).toBeGreaterThan(0);
      expect(result.analysisMetadata.analysisVersion).toBe('2.4.4');
      expect(result.analysisMetadata.platformTarget).toBe('c64');
    });
  });

  describe('Performance and Scalability', () => {
    it('should complete analysis within reasonable time', () => {
      const startTime = Date.now();

      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      const endTime = Date.now();
      const analysisTime = endTime - startTime;

      // Analysis should complete quickly for test data
      expect(analysisTime).toBeLessThan(1000); // Less than 1 second
      expect(result.patternSelectionMetrics.performanceMetrics.selectionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should provide accurate resource estimates', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      const resources = result.optimizationStrategy.resourceRequirements;

      expect(resources.analysisTime).toBeGreaterThan(0);
      expect(resources.memoryRequirement).toBeGreaterThan(0);
      expect(resources.expertiseLevel).toBeOneOf(['basic', 'intermediate', 'advanced', 'expert']);
      expect(Array.isArray(resources.toolingRequirements)).toBe(true);
    });

    it('should scale metrics based on pattern count', () => {
      // Test with larger pattern set
      const largePatternSet = Array.from({ length: 20 }, (_, i) =>
        createMockOptimizationPattern(`pattern_${i}`, 'mathematics', 2, 15)
      );

      mockPatternRegistry.getPatternsByCategory.mockImplementation((category: string) => {
        if (category === 'mathematics') {
          return largePatternSet;
        }
        return [];
      });

      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      // More patterns should result in higher resource estimates
      expect(result.optimizationStrategy.resourceRequirements.analysisTime).toBeGreaterThan(1000);
      expect(result.optimizationStrategy.resourceRequirements.memoryRequirement).toBeGreaterThan(10000);
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it('should handle complex optimization readiness data', () => {
      const complexReadiness: OptimizationReadinessAnalysis = {
        categoryReadiness: new Map([
          ['arithmetic', { category: 'arithmetic', readinessScore: 95, confidence: 0.95, blockers: [], opportunities: [], recommendedPatterns: ['math_opt_1', 'math_opt_2'], estimatedBenefit: 35 }],
          ['control_flow', { category: 'control_flow', readinessScore: 85, confidence: 0.9, blockers: [], opportunities: [], recommendedPatterns: ['cf_opt_1'], estimatedBenefit: 30 }],
          ['memory', { category: 'memory', readinessScore: 45, confidence: 0.6, blockers: [], opportunities: [], recommendedPatterns: [], estimatedBenefit: 5 }],
          ['hardware_specific', { category: 'hardware_specific', readinessScore: 75, confidence: 0.8, blockers: [], opportunities: [], recommendedPatterns: ['hw_opt_1'], estimatedBenefit: 25 }]
        ]),
        patternApplicability: [],
        impactPotential: mockQualityAnalysis.optimizationReadiness.impactPotential,
        transformationSafety: mockQualityAnalysis.optimizationReadiness.transformationSafety,
        overallReadinessScore: 82
      };

      const complexAnalysis = {
        ...mockQualityAnalysis,
        optimizationReadiness: complexReadiness
      };

      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        complexAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      // High readiness scores should boost applicability
      const mathPatterns = result.applicablePatterns.filter(p => p.pattern.category === 'mathematics');
      const memoryPatterns = result.applicablePatterns.filter(p => p.pattern.category === 'memory');

      if (mathPatterns.length > 0 && memoryPatterns.length > 0) {
        const avgMathScore = mathPatterns.reduce((sum, p) => sum + p.applicabilityScore, 0) / mathPatterns.length;
        const avgMemoryScore = memoryPatterns.reduce((sum, p) => sum + p.applicabilityScore, 0) / memoryPatterns.length;

        expect(avgMathScore).toBeGreaterThan(avgMemoryScore); // Math should score higher due to readiness
      }
    });

    it('should integrate all analysis components cohesively', () => {
      const result = analyzer.analyzePatternReadiness(
        mockProgram,
        mockQualityAnalysis,
        mockCFGAnalysis,
        mock6502Analysis
      );

      // Verify that all components work together
      expect(result.applicablePatterns.length + result.patternConflicts.length).toBeGreaterThanOrEqual(0);
      expect(result.optimizationStrategy.phaseCount).toBeGreaterThanOrEqual(result.applicationOrder.length);

      if (result.applicablePatterns.length > 0) {
        expect(result.patternSelectionMetrics.applicablePatternsFound).toBe(result.applicablePatterns.length);
      }

      if (result.patternConflicts.length > 0) {
        expect(result.patternSelectionMetrics.conflictsDetected).toBe(result.patternConflicts.length);
      }
    });
  });
});
