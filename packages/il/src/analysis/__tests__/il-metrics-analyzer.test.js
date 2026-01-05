/**
 * Tests for IL Quality Metrics and Analytics Framework
 * Task 2.4.3: IL Quality Metrics and Analytics Framework
 *
 * This test suite validates the comprehensive IL quality assessment capabilities
 * including complexity metrics, performance prediction, optimization readiness,
 * and quality gates for optimization decision-making.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ILMetricsAnalyzer, analyzeILQuality } from '../il-metrics-analyzer.js';
import { createILFunction, createILInstruction, ILInstructionType, createILConstant, createILVariable, } from '../../il-types.js';
describe('ILMetricsAnalyzer', () => {
    let analyzer;
    let mockILFunction;
    let mockCFGAnalysis;
    let mockSixtyTwo6502Analysis;
    beforeEach(() => {
        analyzer = new ILMetricsAnalyzer();
        // Create mock IL function
        mockILFunction = createILFunction('testFunction', ['test'], { kind: 'primitive', name: 'byte' }, { line: 1, column: 1, offset: 0 });
        // Add sample instructions
        mockILFunction.instructions = [
            createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant({ kind: 'primitive', name: 'byte' }, 42, 'decimal')], 1),
            createILInstruction(ILInstructionType.ADD, [
                createILVariable('x', { kind: 'primitive', name: 'byte' }),
                createILConstant({ kind: 'primitive', name: 'byte' }, 1, 'decimal'),
            ], 2),
            createILInstruction(ILInstructionType.STORE_VARIABLE, [createILVariable('result', { kind: 'primitive', name: 'byte' })], 3),
            createILInstruction(ILInstructionType.RETURN, [], 4),
        ];
        // Create mock CFG analysis result
        mockCFGAnalysis = {
            cfg: {
                functionName: 'testFunction',
                entryBlock: 0,
                exitBlocks: new Set([1]),
                blocks: new Map([
                    [
                        0,
                        {
                            id: 0,
                            label: 'entry',
                            instructions: mockILFunction.instructions,
                            predecessors: new Set(),
                            successors: new Set([1]),
                            dominatedBlocks: new Set([1]),
                            isLoopHeader: false,
                            isLoopExit: false,
                        },
                    ],
                    [
                        1,
                        {
                            id: 1,
                            label: 'exit',
                            instructions: [],
                            predecessors: new Set([0]),
                            successors: new Set(),
                            dominatedBlocks: new Set(),
                            isLoopHeader: false,
                            isLoopExit: false,
                        },
                    ],
                ]),
                edges: [{ source: 0, target: 1, type: 'fall-through' }],
                isReducible: true,
            },
            dominanceAnalysis: {
                immediateDominators: new Map([[1, 0]]),
                dominanceTree: {
                    root: 0,
                    children: new Map([[0, new Set([1])]]),
                    parent: new Map([[1, 0]]),
                    depth: new Map([
                        [0, 0],
                        [1, 1],
                    ]),
                },
                dominanceFrontiers: new Map(),
                postDominators: new Map(),
                strictlyDominates: new Map(),
            },
            loopAnalysis: {
                naturalLoops: [],
                loopNesting: {
                    outerLoops: new Set(),
                    innerLoops: new Map(),
                    parentLoop: new Map(),
                    nestingDepth: new Map(),
                    maxNestingDepth: 0,
                },
                loopClassification: new Map(),
                inductionVariables: new Map(),
                loopInvariantInstructions: new Map(),
                backEdges: [],
            },
            dataDepAnalysis: {
                defUseChains: new Map(),
                useDefChains: new Map(),
                dependencyGraph: {
                    variables: new Set(['x', 'result']),
                    dependencies: new Map(),
                    transitiveClosure: new Map(),
                    stronglyConnectedComponents: [],
                },
                dataFlowEquations: [],
                memoryDependencies: [],
            },
            liveVarAnalysis: {
                liveIn: new Map(),
                liveOut: new Map(),
                liveRanges: new Map(),
                interferenceGraph: {
                    variables: new Set(['x', 'result']),
                    edges: new Set(),
                    coloringHint: new Map(),
                    spillPriority: new Map(),
                },
                variableLifetimes: new Map(),
            },
            criticalPathAnalysis: {
                criticalPaths: [],
                hotBlocks: [],
                performanceBottlenecks: [],
                optimizationOpportunities: [],
            },
            analysisMetrics: {
                analysisTimeMs: 10,
                memoryUsageBytes: 1000,
                basicBlockCount: 2,
                edgeCount: 1,
                loopCount: 0,
                variableCount: 2,
                accuracyScore: 0.95,
            },
        };
        // Create mock 6502 analysis result
        mockSixtyTwo6502Analysis = {
            isValid: true,
            platformCompatibility: { score: 95, issues: [] },
            performanceAnalysis: {
                totalCycles: 15,
                criticalPathCycles: 15,
                averageCyclesPerInstruction: 3.75,
                hotspotInstructions: [],
                cycleBreakdown: {
                    LOAD_IMMEDIATE: 2,
                    ADD: 3,
                    STORE_VARIABLE: 4,
                    RETURN: 6,
                },
                performanceScore: 85,
            },
            constraintValidation: {
                memoryLayoutValid: true,
                registerUsageValid: true,
                stackUsageValid: true,
                timingConstraintsValid: true,
                hardwareResourcesValid: true,
            },
            optimizationRecommendations: [],
            validationIssues: [],
            analysisMetrics: {
                analysisTimeMs: 5,
                memoryUsageBytes: 500,
                instructionCount: 4,
                basicBlockCount: 2,
                accuracyScore: 0.99,
            },
            targetPlatform: 'c64',
            processorVariant: '6510',
        };
    });
    describe('Basic Functionality', () => {
        it('should create analyzer with default options', () => {
            const newAnalyzer = new ILMetricsAnalyzer();
            expect(newAnalyzer).toBeDefined();
        });
        it('should create analyzer with custom options', () => {
            const options = {
                enableComplexityAnalysis: false,
                enablePerformancePrediction: true,
                optimizationLevel: 'aggressive',
                targetPlatform: 'vic20',
            };
            const newAnalyzer = new ILMetricsAnalyzer(options);
            expect(newAnalyzer).toBeDefined();
        });
        it('should provide convenience function for analysis', () => {
            const result = analyzeILQuality(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result).toBeDefined();
            expect(result.complexityMetrics).toBeDefined();
            expect(result.performancePrediction).toBeDefined();
            expect(result.optimizationReadiness).toBeDefined();
            expect(result.qualityGates).toBeDefined();
        });
    });
    describe('Complexity Analysis', () => {
        it('should calculate McCabe cyclomatic complexity', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result.complexityMetrics.cyclomaticComplexity).toBeGreaterThan(0);
            expect(result.complexityMetrics.cyclomaticComplexity).toBeLessThanOrEqual(10);
        });
        it('should analyze instruction complexity', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            const instructionComplexity = result.complexityMetrics.instructionComplexity;
            expect(instructionComplexity.totalInstructions).toBe(4);
            expect(instructionComplexity.complexInstructionRatio).toBeGreaterThanOrEqual(0);
            expect(instructionComplexity.branchDensity).toBeGreaterThanOrEqual(0);
            expect(instructionComplexity.functionCallDensity).toBeGreaterThanOrEqual(0);
            expect(instructionComplexity.memoryOperationDensity).toBeGreaterThan(0);
            expect(instructionComplexity.arithmeticComplexity).toBeGreaterThan(0);
            expect(instructionComplexity.score).toBeGreaterThanOrEqual(0);
            expect(instructionComplexity.score).toBeLessThanOrEqual(100);
        });
        it('should analyze control flow complexity', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            const controlFlowComplexity = result.complexityMetrics.controlFlowComplexity;
            expect(controlFlowComplexity.basicBlockCount).toBe(2);
            expect(controlFlowComplexity.edgeCount).toBe(1);
            expect(controlFlowComplexity.loopNestingDepth).toBe(0);
            expect(controlFlowComplexity.complexityRatio).toBeGreaterThan(0);
            expect(controlFlowComplexity.score).toBeGreaterThanOrEqual(0);
            expect(controlFlowComplexity.score).toBeLessThanOrEqual(100);
        });
        it('should analyze data flow complexity', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            const dataFlowComplexity = result.complexityMetrics.dataFlowComplexity;
            expect(dataFlowComplexity.variableCount).toBe(2);
            expect(dataFlowComplexity.defUseChainLength).toBeGreaterThan(0);
            expect(dataFlowComplexity.maxLiveVariables).toBeGreaterThan(0);
            expect(dataFlowComplexity.score).toBeGreaterThanOrEqual(0);
            expect(dataFlowComplexity.score).toBeLessThanOrEqual(100);
        });
        it('should calculate overall complexity score', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result.complexityMetrics.overallComplexityScore).toBeGreaterThanOrEqual(0);
            expect(result.complexityMetrics.overallComplexityScore).toBeLessThanOrEqual(100);
        });
        it('should handle empty function gracefully', () => {
            const emptyFunction = createILFunction('emptyFunction', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const result = analyzer.analyzeFunction(emptyFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result.complexityMetrics.instructionComplexity.totalInstructions).toBe(0);
            expect(result.complexityMetrics.instructionComplexity.score).toBe(0);
        });
    });
    describe('Performance Prediction', () => {
        it('should predict cycle estimates', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            const cycles = result.performancePrediction.estimatedCycles;
            expect(cycles.averageCase).toBe(15); // From mock 6502 analysis
            expect(cycles.bestCase).toBeLessThan(cycles.averageCase);
            expect(cycles.worstCase).toBeGreaterThan(cycles.averageCase);
            expect(cycles.confidence).toBeGreaterThan(0);
            expect(cycles.confidence).toBeLessThanOrEqual(1);
            expect(cycles.assumptionsMade).toBeInstanceOf(Array);
        });
        it('should estimate memory usage', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            const memory = result.performancePrediction.memoryUsage;
            expect(memory.totalUsage).toBeGreaterThan(0);
            expect(memory.utilizationScore).toBeGreaterThanOrEqual(0);
            expect(memory.utilizationScore).toBeLessThanOrEqual(100);
            expect(memory.zeroPageUsage.efficiency).toBeGreaterThan(0);
            expect(memory.zeroPageUsage.efficiency).toBeLessThanOrEqual(1);
        });
        it('should analyze register pressure', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            const registerPressure = result.performancePrediction.registerPressure;
            expect(registerPressure.spillProbability).toBeGreaterThanOrEqual(0);
            expect(registerPressure.spillProbability).toBeLessThanOrEqual(1);
            expect(registerPressure.allocationQuality).toBeGreaterThanOrEqual(0);
            expect(registerPressure.allocationQuality).toBeLessThanOrEqual(100);
        });
        it('should calculate performance score', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result.performancePrediction.performanceScore).toBeGreaterThanOrEqual(0);
            expect(result.performancePrediction.performanceScore).toBeLessThanOrEqual(100);
        });
    });
    describe('Optimization Readiness', () => {
        it('should analyze category readiness', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            const categoryReadiness = result.optimizationReadiness.categoryReadiness;
            expect(categoryReadiness.size).toBeGreaterThan(0);
            // Check specific categories
            expect(categoryReadiness.has('arithmetic')).toBe(true);
            expect(categoryReadiness.has('control_flow')).toBe(true);
            expect(categoryReadiness.has('memory')).toBe(true);
            expect(categoryReadiness.has('register')).toBe(true);
            categoryReadiness.forEach((readiness, category) => {
                expect(readiness.readinessScore).toBeGreaterThanOrEqual(0);
                expect(readiness.readinessScore).toBeLessThanOrEqual(100);
                expect(readiness.confidence).toBeGreaterThanOrEqual(0);
                expect(readiness.confidence).toBeLessThanOrEqual(1);
                expect(readiness.estimatedBenefit).toBeGreaterThanOrEqual(0);
                expect(readiness.estimatedBenefit).toBeLessThanOrEqual(100);
            });
        });
        it('should estimate optimization impact', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            const impact = result.optimizationReadiness.impactPotential;
            expect(impact.overallImpact).toBeGreaterThanOrEqual(0);
            expect(impact.overallImpact).toBeLessThanOrEqual(100);
            expect(impact.performanceImpact.confidence).toBeGreaterThanOrEqual(0);
            expect(impact.performanceImpact.confidence).toBeLessThanOrEqual(1);
            expect(impact.performanceImpact.factors).toBeInstanceOf(Array);
        });
        it('should analyze transformation safety', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            const safety = result.optimizationReadiness.transformationSafety;
            expect(safety.overallSafetyScore).toBeGreaterThanOrEqual(0);
            expect(safety.overallSafetyScore).toBeLessThanOrEqual(100);
            expect(safety.semanticSafety.semanticPreservation).toBeGreaterThanOrEqual(0);
            expect(safety.semanticSafety.semanticPreservation).toBeLessThanOrEqual(100);
            expect(safety.performanceSafety.performanceGuarantee).toBeGreaterThanOrEqual(0);
            expect(safety.performanceSafety.performanceGuarantee).toBeLessThanOrEqual(100);
        });
        it('should calculate overall readiness score', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result.optimizationReadiness.overallReadinessScore).toBeGreaterThanOrEqual(0);
            expect(result.optimizationReadiness.overallReadinessScore).toBeLessThanOrEqual(100);
        });
    });
    describe('Quality Gates', () => {
        it('should evaluate quality gates', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            const gates = result.qualityGates.gates;
            expect(gates.length).toBeGreaterThan(0);
            gates.forEach(gate => {
                expect(gate.gateId).toBeDefined();
                expect(gate.gateName).toBeDefined();
                expect(gate.gateType).toBeDefined();
                expect(gate.threshold).toBeDefined();
                expect(gate.actualValue).toBeGreaterThanOrEqual(0);
                expect(['pass', 'warning', 'fail', 'not_applicable']).toContain(gate.status);
                expect(['mandatory', 'important', 'recommended', 'informational']).toContain(gate.importance);
                expect(gate.description).toBeDefined();
            });
        });
        it('should determine overall gate status', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(['pass', 'warning', 'fail', 'not_applicable']).toContain(result.qualityGates.overallStatus);
        });
        it('should calculate quality score', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result.qualityGates.qualityScore).toBeGreaterThanOrEqual(0);
            expect(result.qualityGates.qualityScore).toBeLessThanOrEqual(100);
        });
        it('should generate improvement recommendations', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            result.qualityGates.improvementRecommendations.forEach(rec => {
                expect([
                    'complexity_reduction',
                    'performance_improvement',
                    'memory_optimization',
                    'safety_enhancement',
                    'maintainability',
                    'optimization_readiness',
                    'platform_optimization',
                ]).toContain(rec.recommendationType);
                expect(['critical', 'high', 'medium', 'low', 'optional']).toContain(rec.priority);
                expect(['minimal', 'low', 'moderate', 'high', 'extensive', 'major']).toContain(rec.effort);
                expect(rec.benefit).toBeGreaterThanOrEqual(0);
                expect(rec.benefit).toBeLessThanOrEqual(100);
                expect(rec.description).toBeDefined();
                expect(rec.actionItems).toBeInstanceOf(Array);
                expect(['beginner', 'intermediate', 'advanced', 'expert', 'specialist']).toContain(rec.requiredExpertise);
            });
        });
    });
    describe('Analysis Summary', () => {
        it('should build comprehensive summary', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            const summary = result.summary;
            expect(summary.overallQualityScore).toBeGreaterThanOrEqual(0);
            expect(summary.overallQualityScore).toBeLessThanOrEqual(100);
            expect(['trivial', 'simple', 'moderate', 'complex', 'expert']).toContain(summary.complexityLevel);
            expect(['excellent', 'good', 'acceptable', 'poor', 'critical']).toContain(summary.performanceLevel);
            expect(['minimal', 'low', 'moderate', 'high', 'extreme']).toContain(summary.optimizationPotential);
            expect(summary.recommendedNextSteps).toBeInstanceOf(Array);
            expect(summary.keyFindings).toBeInstanceOf(Array);
            expect(summary.criticalIssues).toBeInstanceOf(Array);
        });
        it('should provide improvement recommendations', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result.recommendations).toBeInstanceOf(Array);
            result.recommendations.forEach(rec => {
                expect(rec.description).toBeDefined();
                expect(rec.priority).toBeDefined();
                expect(rec.effort).toBeDefined();
                expect(rec.benefit).toBeGreaterThanOrEqual(0);
                expect(rec.benefit).toBeLessThanOrEqual(100);
            });
        });
    });
    describe('Analysis Metrics', () => {
        it('should provide analysis performance metrics', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            const metrics = result.analysisMetrics;
            expect(metrics.analysisTimeMs).toBeGreaterThanOrEqual(0);
            expect(metrics.memoryUsageBytes).toBeGreaterThan(0);
            expect(metrics.predictionAccuracy).toBeGreaterThanOrEqual(0);
            expect(metrics.predictionAccuracy).toBeLessThanOrEqual(1);
            expect(metrics.analysisCompleteness).toBeGreaterThanOrEqual(0);
            expect(metrics.analysisCompleteness).toBeLessThanOrEqual(1);
            expect(metrics.confidenceScore).toBeGreaterThanOrEqual(0);
            expect(metrics.confidenceScore).toBeLessThanOrEqual(1);
        });
    });
    describe('Error Handling', () => {
        it('should handle analysis errors gracefully', () => {
            const invalidCFGAnalysis = {
                ...mockCFGAnalysis,
                cfg: null,
            };
            const result = analyzer.analyzeFunction(mockILFunction, invalidCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result).toBeDefined();
            expect(result.summary.criticalIssues.length).toBeGreaterThan(0);
            expect(result.summary.overallQualityScore).toBe(0);
        });
    });
    describe('Configuration Options', () => {
        it('should respect disabled complexity analysis', () => {
            const customAnalyzer = new ILMetricsAnalyzer({
                enableComplexityAnalysis: false,
            });
            const result = customAnalyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result.complexityMetrics.overallComplexityScore).toBe(0);
            expect(result.complexityMetrics.instructionComplexity.totalInstructions).toBe(0);
        });
        it('should respect disabled performance prediction', () => {
            const customAnalyzer = new ILMetricsAnalyzer({
                enablePerformancePrediction: false,
            });
            const result = customAnalyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result.performancePrediction.performanceScore).toBe(100);
            expect(result.performancePrediction.estimatedCycles.averageCase).toBe(0);
        });
        it('should respect disabled optimization readiness', () => {
            const customAnalyzer = new ILMetricsAnalyzer({
                enableOptimizationReadiness: false,
            });
            const result = customAnalyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result.optimizationReadiness.overallReadinessScore).toBe(100);
            expect(result.optimizationReadiness.categoryReadiness.size).toBe(0);
        });
        it('should respect disabled quality gates', () => {
            const customAnalyzer = new ILMetricsAnalyzer({
                enableQualityGates: false,
            });
            const result = customAnalyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            expect(result.qualityGates.gates.length).toBe(0);
            expect(result.qualityGates.qualityScore).toBe(100);
            expect(result.qualityGates.overallStatus).toBe('pass');
        });
        it('should use custom quality thresholds', () => {
            const customAnalyzer = new ILMetricsAnalyzer({
                qualityThresholds: {
                    maxComplexity: 30,
                    minPerformanceScore: 90,
                    maxMemoryUsage: 512,
                    minSafetyScore: 95,
                    minOptimizationReadiness: 80,
                    customThresholds: new Map(),
                },
            });
            const result = customAnalyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            // Verify gates use custom thresholds
            const complexityGate = result.qualityGates.gates.find(g => g.gateId === 'complexity_limit');
            expect(complexityGate?.threshold.maxValue).toBe(30);
        });
    });
    describe('Integration with Task 2.4.1 and 2.4.2', () => {
        it('should integrate CFG analysis results correctly', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            // Should use CFG data for complexity analysis
            expect(result.complexityMetrics.controlFlowComplexity.basicBlockCount).toBe(2);
            expect(result.complexityMetrics.controlFlowComplexity.edgeCount).toBe(1);
            expect(result.complexityMetrics.dataFlowComplexity.variableCount).toBe(2);
        });
        it('should integrate 6502 analysis results correctly', () => {
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            // Should use 6502 data for performance prediction
            expect(result.performancePrediction.estimatedCycles.averageCase).toBe(15);
            expect(result.performancePrediction.platformSpecificFactors.processorFeatures.hasDecimalMode).toBe(true);
        });
    });
    describe('Type Validation', () => {
        it('should export correct types', () => {
            // This test ensures the exported types are available
            const result = analyzer.analyzeFunction(mockILFunction, mockCFGAnalysis, mockSixtyTwo6502Analysis);
            // Verify the result conforms to expected interface
            expect(result).toHaveProperty('complexityMetrics');
            expect(result).toHaveProperty('performancePrediction');
            expect(result).toHaveProperty('optimizationReadiness');
            expect(result).toHaveProperty('qualityGates');
            expect(result).toHaveProperty('analysisMetrics');
            expect(result).toHaveProperty('recommendations');
            expect(result).toHaveProperty('summary');
        });
    });
});
//# sourceMappingURL=il-metrics-analyzer.test.js.map