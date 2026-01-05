/**
 * IL Analytics Suite Integration Tests
 *
 * Comprehensive testing of the unified IL analytics system including:
 * - Performance validation against benchmarks
 * - Accuracy validation against known standards
 * - Integration testing across all analytics components
 * - Memory efficiency validation
 * - End-to-end analytics pipeline testing
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ILAnalyticsSuite } from '../il-analytics-suite.js';
import { ILInstructionType, createILConstant, createILInstruction, createILVariable, } from '../../il-types.js';
import { createPrimitiveType } from '@blend65/semantic';
describe('ILAnalyticsSuite', () => {
    let analyticsSuite;
    beforeEach(() => {
        analyticsSuite = new ILAnalyticsSuite();
    });
    describe('Basic Integration', () => {
        it('should create analytics suite with all components', () => {
            expect(analyticsSuite).toBeDefined();
            expect(analyticsSuite).toBeInstanceOf(ILAnalyticsSuite);
        });
        it('should have performance benchmarks defined', () => {
            expect(ILAnalyticsSuite.BENCHMARKS).toBeDefined();
            expect(ILAnalyticsSuite.BENCHMARKS.simpleFunctionTarget).toBe(50);
            expect(ILAnalyticsSuite.BENCHMARKS.moderateComplexityTarget).toBe(150);
            expect(ILAnalyticsSuite.BENCHMARKS.complexFunctionTarget).toBe(500);
        });
        it('should have accuracy standards defined', () => {
            expect(ILAnalyticsSuite.ACCURACY_STANDARDS).toBeDefined();
            expect(ILAnalyticsSuite.ACCURACY_STANDARDS.performancePredictionAccuracy).toBe(95);
            expect(ILAnalyticsSuite.ACCURACY_STANDARDS.patternSelectionAccuracy).toBe(90);
        });
    });
    describe('Single Function Analysis', () => {
        it('should analyze simple IL function', async () => {
            // Create test function
            const testFunction = createTestFunction('simpleFunction', [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 42)], 1),
                createILInstruction(ILInstructionType.RETURN, [], 2),
            ]);
            const result = await analyticsSuite.analyzeFunction(testFunction);
            expect(result).toBeDefined();
            expect(result.controlFlow).toBeDefined();
            expect(result.sixtyTwoZeroTwo).toBeDefined();
            expect(result.qualityMetrics).toBeDefined();
            expect(result.patternReadiness).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(result.performanceMetrics).toBeDefined();
        });
        it('should provide meaningful analytics summary', async () => {
            const testFunction = createTestFunction('testFunction', [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 10)], 1),
                createILInstruction(ILInstructionType.ADD, [createILConstant(createPrimitiveType('byte'), 5)], 2),
                createILInstruction(ILInstructionType.RETURN, [], 3),
            ]);
            const result = await analyticsSuite.analyzeFunction(testFunction);
            expect(result.summary.overallQualityScore).toBeGreaterThanOrEqual(0);
            expect(result.summary.overallQualityScore).toBeLessThanOrEqual(100);
            expect(result.summary.confidenceLevel).toMatch(/LOW|MEDIUM|HIGH|VERY_HIGH/);
            expect(Array.isArray(result.summary.topRecommendations)).toBe(true);
            expect(Array.isArray(result.summary.criticalIssues)).toBe(true);
        });
        it('should measure performance metrics', async () => {
            const testFunction = createTestFunction('perfTest', [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 1),
                createILInstruction(ILInstructionType.RETURN, [], 2),
            ]);
            const result = await analyticsSuite.analyzeFunction(testFunction);
            expect(result.performanceMetrics.totalAnalysisTime).toBeGreaterThanOrEqual(0);
            expect(result.performanceMetrics.componentTiming.controlFlow).toBeGreaterThanOrEqual(0);
            expect(result.performanceMetrics.componentTiming.sixtyTwoZeroTwo).toBeGreaterThanOrEqual(0);
            expect(result.performanceMetrics.componentTiming.qualityMetrics).toBeGreaterThanOrEqual(0);
            expect(result.performanceMetrics.componentTiming.patternReadiness).toBeGreaterThanOrEqual(0);
            expect(result.performanceMetrics.performanceGrade).toMatch(/A\+|A|B\+|B|C\+|C|D|F/);
        });
    });
    describe('Program Analysis', () => {
        it('should analyze IL program with multiple functions', async () => {
            const program = createTestProgram([
                createTestFunction('main', [
                    createILInstruction(ILInstructionType.CALL, [createILVariable('helper', createPrimitiveType('callback'))], 1),
                    createILInstruction(ILInstructionType.RETURN, [], 2),
                ]),
                createTestFunction('helper', [
                    createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 100)], 1),
                    createILInstruction(ILInstructionType.RETURN, [], 2),
                ]),
            ]);
            const result = await analyticsSuite.analyzeProgram(program);
            expect(result).toBeDefined();
            expect(result.summary.overallQualityScore).toBeGreaterThanOrEqual(0);
            expect(result.performanceMetrics.totalAnalysisTime).toBeGreaterThanOrEqual(0);
        });
        it('should handle empty program gracefully', async () => {
            const emptyProgram = createTestProgram([]);
            await expect(analyticsSuite.analyzeProgram(emptyProgram)).rejects.toThrow();
        });
        it('should classify program complexity correctly', async () => {
            // Simple program
            const simpleProgram = createTestProgram([
                createTestFunction('simple', [
                    createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 1),
                    createILInstruction(ILInstructionType.RETURN, [], 2),
                ]),
            ]);
            const simpleResult = await analyticsSuite.analyzeProgram(simpleProgram);
            expect(simpleResult.performanceMetrics.totalAnalysisTime).toBeLessThanOrEqual(ILAnalyticsSuite.BENCHMARKS.simpleFunctionTarget);
            // Moderate program
            const moderateInstructions = Array.from({ length: 100 }, (_, i) => createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), i)], i + 1));
            moderateInstructions.push(createILInstruction(ILInstructionType.RETURN, [], moderateInstructions.length + 1));
            const moderateProgram = createTestProgram([
                createTestFunction('moderate', moderateInstructions),
            ]);
            const moderateResult = await analyticsSuite.analyzeProgram(moderateProgram);
            expect(moderateResult.performanceMetrics.totalAnalysisTime).toBeLessThanOrEqual(ILAnalyticsSuite.BENCHMARKS.moderateComplexityTarget);
        });
    });
    describe('Performance Validation', () => {
        it('should validate performance against benchmarks', async () => {
            const testPrograms = [
                createTestProgram([
                    createTestFunction('simple', [
                        createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 1),
                        createILInstruction(ILInstructionType.RETURN, [], 2),
                    ]),
                ]),
            ];
            const validation = await analyticsSuite.validatePerformance(testPrograms);
            expect(validation).toBeDefined();
            expect(validation.overallPassed).toBeDefined();
            expect(validation.averagePerformanceMargin).toBeGreaterThanOrEqual(-100);
            expect(Array.isArray(validation.results)).toBe(true);
            expect(validation.recommendation).toBeDefined();
        });
        it('should identify performance issues', async () => {
            const testPrograms = [
                createTestProgram([
                    createTestFunction('simple', [
                        createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 1),
                        createILInstruction(ILInstructionType.RETURN, [], 2),
                    ]),
                ]),
            ];
            const validation = await analyticsSuite.validatePerformance(testPrograms);
            for (const result of validation.results) {
                expect(result.programName).toBeDefined();
                expect(result.complexity).toMatch(/Simple|Moderate|Complex/);
                expect(result.actualTime).toBeGreaterThanOrEqual(0);
                expect(result.targetTime).toBeGreaterThan(0);
                expect(typeof result.passed).toBe('boolean');
                expect(typeof result.performanceMargin).toBe('number');
                expect(result.memoryUsage).toBeGreaterThanOrEqual(0);
            }
        });
    });
    describe('Accuracy Validation', () => {
        it('should validate accuracy against reference data', async () => {
            const referenceData = [
                {
                    testName: 'simple-function-test',
                    program: createTestProgram([
                        createTestFunction('test', [
                            createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 42)], 1),
                            createILInstruction(ILInstructionType.RETURN, [], 2),
                        ]),
                    ]),
                    expectedCycles: 10,
                    expectedPatterns: ['load-immediate-optimization'],
                    expectedQualityScore: 85,
                },
            ];
            const validation = await analyticsSuite.validateAccuracy(referenceData);
            expect(validation).toBeDefined();
            expect(validation.overallAccuracy).toBeGreaterThanOrEqual(0);
            expect(validation.overallAccuracy).toBeLessThanOrEqual(100);
            expect(typeof validation.meetsStandards).toBe('boolean');
            expect(Array.isArray(validation.accuracyMetrics)).toBe(true);
            expect(validation.recommendation).toBeDefined();
        });
        it('should provide detailed accuracy metrics', async () => {
            const referenceData = [
                {
                    testName: 'accuracy-test',
                    program: createTestProgram([
                        createTestFunction('accuracy', [
                            createILInstruction(ILInstructionType.ADD, [
                                createILConstant(createPrimitiveType('byte'), 1),
                                createILConstant(createPrimitiveType('byte'), 2),
                            ], 1),
                            createILInstruction(ILInstructionType.RETURN, [], 2),
                        ]),
                    ]),
                    expectedCycles: 15,
                    expectedPatterns: ['arithmetic-optimization'],
                    expectedQualityScore: 75,
                },
            ];
            const validation = await analyticsSuite.validateAccuracy(referenceData);
            expect(validation.accuracyMetrics).toHaveLength(1);
            const metric = validation.accuracyMetrics[0];
            expect(metric.testName).toBe('accuracy-test');
            expect(metric.performanceAccuracy).toBeGreaterThanOrEqual(0);
            expect(metric.patternAccuracy).toBeGreaterThanOrEqual(0);
            expect(metric.qualityAccuracy).toBeGreaterThanOrEqual(0);
            expect(metric.overallAccuracy).toBeGreaterThanOrEqual(0);
        });
    });
    describe('Analytics Integration', () => {
        it('should integrate all analytics components seamlessly', async () => {
            const complexFunction = createTestFunction('complex', [
                createILInstruction(ILInstructionType.LOAD_VARIABLE, [createILVariable('counter', createPrimitiveType('byte'))], 1),
                createILInstruction(ILInstructionType.COMPARE_LT, [createILConstant(createPrimitiveType('byte'), 10)], 2),
                createILInstruction(ILInstructionType.BRANCH_IF_FALSE, [createILConstant(createPrimitiveType('callback'), 'end')], 3),
                createILInstruction(ILInstructionType.ADD, [createILConstant(createPrimitiveType('byte'), 1)], 4),
                createILInstruction(ILInstructionType.STORE_VARIABLE, [createILVariable('counter', createPrimitiveType('byte'))], 5),
                createILInstruction(ILInstructionType.BRANCH, [createILConstant(createPrimitiveType('callback'), 'loop')], 6),
                createILInstruction(ILInstructionType.LABEL, [createILConstant(createPrimitiveType('callback'), 'end')], 7),
                createILInstruction(ILInstructionType.RETURN, [], 8),
            ]);
            const result = await analyticsSuite.analyzeFunction(complexFunction);
            // Verify all components provided results
            expect(result.controlFlow.cfg).toBeDefined();
            expect(result.sixtyTwoZeroTwo.performanceAnalysis).toBeDefined();
            expect(result.qualityMetrics.cyclomaticComplexity).toBeGreaterThan(0);
            expect(Array.isArray(result.patternReadiness)).toBe(true);
            // Verify integration worked
            expect(result.summary.overallQualityScore).toBeGreaterThan(0);
            expect(result.summary.optimizationReadinessScore).toBeGreaterThan(0);
            expect(result.summary.performancePredictionConfidence).toBeGreaterThan(0);
        });
        it('should provide optimization recommendations', async () => {
            const testFunction = createTestFunction('optimizable', [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 0)], 1),
                createILInstruction(ILInstructionType.ADD, [createILConstant(createPrimitiveType('byte'), 0)], 2), // Useless add
                createILInstruction(ILInstructionType.MUL, [createILConstant(createPrimitiveType('byte'), 1)], 3), // Useless multiply
                createILInstruction(ILInstructionType.RETURN, [], 4),
            ]);
            const result = await analyticsSuite.analyzeFunction(testFunction);
            expect(Array.isArray(result.summary.topRecommendations)).toBe(true);
            // Should have recommendations for optimization
            result.summary.topRecommendations.forEach(rec => {
                expect(rec.type).toMatch(/PERFORMANCE|MEMORY|PATTERN|ARCHITECTURE/);
                expect(rec.priority).toMatch(/CRITICAL|HIGH|MEDIUM|LOW/);
                expect(rec.description).toBeDefined();
                expect(rec.expectedBenefit).toBeGreaterThanOrEqual(0);
                expect(rec.expectedBenefit).toBeLessThanOrEqual(100);
                expect(rec.implementationDifficulty).toMatch(/EASY|MEDIUM|HARD|EXPERT/);
            });
        });
        it('should identify critical issues', async () => {
            // Create function with very high complexity
            const highComplexityInstructions = Array.from({ length: 200 }, (_, i) => {
                if (i % 10 === 0) {
                    return createILInstruction(ILInstructionType.BRANCH_IF_TRUE, [createILConstant(createPrimitiveType('callback'), `label_${i}`)], i + 1);
                }
                return createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), i % 256)], i + 1);
            });
            highComplexityInstructions.push(createILInstruction(ILInstructionType.RETURN, [], highComplexityInstructions.length + 1));
            const complexFunction = createTestFunction('highComplexity', highComplexityInstructions);
            const result = await analyticsSuite.analyzeFunction(complexFunction);
            expect(Array.isArray(result.summary.criticalIssues)).toBe(true);
            // Verify issue structure
            result.summary.criticalIssues.forEach(issue => {
                expect(issue.severity).toMatch(/ERROR|WARNING|INFO/);
                expect(issue.category).toMatch(/PERFORMANCE|CORRECTNESS|MAINTAINABILITY|OPTIMIZATION/);
                expect(issue.description).toBeDefined();
            });
        });
    });
    describe('Performance Benchmarking', () => {
        it('should meet performance benchmarks for simple programs', async () => {
            const simplePrograms = [
                createTestProgram([
                    createTestFunction('simple1', [
                        createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 1),
                        createILInstruction(ILInstructionType.RETURN, [], 2),
                    ]),
                ]),
                createTestProgram([
                    createTestFunction('simple2', [
                        createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 2)], 1),
                        createILInstruction(ILInstructionType.ADD, [createILConstant(createPrimitiveType('byte'), 3)], 2),
                        createILInstruction(ILInstructionType.RETURN, [], 3),
                    ]),
                ]),
            ];
            const validation = await analyticsSuite.validatePerformance(simplePrograms);
            expect(validation.overallPassed).toBe(true);
            expect(validation.averagePerformanceMargin).toBeGreaterThan(0);
            expect(validation.recommendation).toContain('performing optimally');
        });
        it('should provide performance breakdown by component', async () => {
            const testProgram = createTestProgram([
                createTestFunction('breakdown', [
                    createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 42)], 1),
                    createILInstruction(ILInstructionType.RETURN, [], 2),
                ]),
            ]);
            const result = await analyticsSuite.analyzeProgram(testProgram);
            const timing = result.performanceMetrics.componentTiming;
            expect(timing.controlFlow).toBeGreaterThanOrEqual(0);
            expect(timing.sixtyTwoZeroTwo).toBeGreaterThanOrEqual(0);
            expect(timing.qualityMetrics).toBeGreaterThanOrEqual(0);
            expect(timing.patternReadiness).toBeGreaterThanOrEqual(0);
            expect(timing.integration).toBeGreaterThanOrEqual(0);
            // Total should be sum of components
            const expectedTotal = timing.controlFlow +
                timing.sixtyTwoZeroTwo +
                timing.qualityMetrics +
                timing.patternReadiness +
                timing.integration;
            expect(result.performanceMetrics.totalAnalysisTime).toBeGreaterThanOrEqual(expectedTotal * 0.8);
        });
    });
    describe('Memory Efficiency', () => {
        it('should track memory usage during analysis', async () => {
            const testFunction = createTestFunction('memoryTest', [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 1),
                createILInstruction(ILInstructionType.RETURN, [], 2),
            ]);
            const result = await analyticsSuite.analyzeFunction(testFunction);
            expect(result.performanceMetrics.memoryUsage.peakMemoryMB).toBeGreaterThanOrEqual(0);
            expect(result.performanceMetrics.memoryUsage.averageMemoryMB).toBeGreaterThanOrEqual(0);
            expect(result.performanceMetrics.memoryUsage.memoryEfficiencyScore).toBeGreaterThanOrEqual(0);
            expect(result.performanceMetrics.memoryUsage.memoryEfficiencyScore).toBeLessThanOrEqual(100);
        });
        it('should meet memory efficiency targets', async () => {
            const testProgram = createTestProgram([
                createTestFunction('efficiency', [
                    createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 1),
                    createILInstruction(ILInstructionType.RETURN, [], 2),
                ]),
            ]);
            const result = await analyticsSuite.analyzeProgram(testProgram);
            // Should not exceed simple program memory targets
            expect(result.performanceMetrics.memoryUsage.peakMemoryMB).toBeLessThanOrEqual(ILAnalyticsSuite.BENCHMARKS.memoryUsageTargets.simple);
        });
    });
    describe('Analytics Coordination', () => {
        it('should coordinate all analytics phases properly', async () => {
            const testFunction = createTestFunction('coordination', [
                createILInstruction(ILInstructionType.LOAD_VARIABLE, [createILVariable('x', createPrimitiveType('byte'))], 1),
                createILInstruction(ILInstructionType.ADD, [createILVariable('y', createPrimitiveType('byte'))], 2),
                createILInstruction(ILInstructionType.STORE_VARIABLE, [createILVariable('z', createPrimitiveType('byte'))], 3),
                createILInstruction(ILInstructionType.RETURN, [], 4),
            ]);
            const result = await analyticsSuite.analyzeFunction(testFunction);
            // Verify each phase contributed to the analysis
            expect(result.controlFlow.cfg.blocks.size).toBeGreaterThan(0);
            expect(result.sixtyTwoZeroTwo.isValid).toBeDefined();
            expect(result.qualityMetrics.cyclomaticComplexity).toBeGreaterThan(0);
            expect(Array.isArray(result.patternReadiness)).toBe(true);
            // Verify summary integrates all results
            expect(result.summary.overallQualityScore).toBeGreaterThan(0);
            expect(result.summary.confidenceLevel).toBeDefined();
        });
        it('should handle analysis errors gracefully', async () => {
            // Create function that might cause analysis issues
            const problematicFunction = createTestFunction('problematic', [
            // Empty function to potentially trigger edge cases
            ]);
            const result = await analyticsSuite.analyzeFunction(problematicFunction);
            // Should still provide valid results even for edge cases
            expect(result).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(result.performanceMetrics).toBeDefined();
        });
    });
    describe('Quality Assessment', () => {
        it('should assess overall quality correctly', async () => {
            const highQualityFunction = createTestFunction('highQuality', [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 42)], 1),
                createILInstruction(ILInstructionType.RETURN, [], 2),
            ]);
            const result = await analyticsSuite.analyzeFunction(highQualityFunction);
            // High quality function should have good scores
            expect(result.summary.overallQualityScore).toBeGreaterThan(30);
            expect(result.summary.optimizationReadinessScore).toBeGreaterThanOrEqual(0);
            expect(result.summary.performancePredictionConfidence).toBeGreaterThan(0);
        });
        it('should provide confidence levels', async () => {
            const testFunction = createTestFunction('confidence', [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 1),
                createILInstruction(ILInstructionType.RETURN, [], 2),
            ]);
            const result = await analyticsSuite.analyzeFunction(testFunction);
            expect(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).toContain(result.summary.confidenceLevel);
        });
        it('should provide performance grades', async () => {
            const testFunction = createTestFunction('grading', [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 1),
                createILInstruction(ILInstructionType.RETURN, [], 2),
            ]);
            const result = await analyticsSuite.analyzeFunction(testFunction);
            expect(['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']).toContain(result.performanceMetrics.performanceGrade);
        });
    });
    describe('Edge Cases and Error Handling', () => {
        it('should handle functions with no instructions', async () => {
            const emptyFunction = createTestFunction('empty', []);
            const result = await analyticsSuite.analyzeFunction(emptyFunction);
            expect(result).toBeDefined();
            expect(result.summary.overallQualityScore).toBeGreaterThanOrEqual(0);
        });
        it('should handle programs with empty modules', async () => {
            const emptyModuleProgram = {
                name: 'empty-module-test',
                modules: [],
                globalData: [],
                imports: [],
                exports: [],
                sourceInfo: {
                    originalFiles: ['test'],
                    compilationTimestamp: new Date(),
                    compilerVersion: '0.1.0',
                    targetPlatform: 'c64',
                },
            };
            await expect(analyticsSuite.analyzeProgram(emptyModuleProgram)).rejects.toThrow('no modules');
        });
        it('should handle modules with no functions', async () => {
            const noFunctionsProgram = {
                name: 'no-functions-test',
                modules: [
                    {
                        qualifiedName: ['Test'],
                        functions: [],
                        moduleData: [],
                        exports: [],
                        imports: [],
                    },
                ],
                globalData: [],
                imports: [],
                exports: [],
                sourceInfo: {
                    originalFiles: ['test'],
                    compilationTimestamp: new Date(),
                    compilerVersion: '0.1.0',
                    targetPlatform: 'c64',
                },
            };
            await expect(analyticsSuite.analyzeProgram(noFunctionsProgram)).rejects.toThrow('no functions');
        });
    });
    describe('Integration Performance', () => {
        it('should complete analysis within time limits', async () => {
            const testFunction = createTestFunction('timeLimit', [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 1),
                createILInstruction(ILInstructionType.ADD, [createILConstant(createPrimitiveType('byte'), 2)], 2),
                createILInstruction(ILInstructionType.STORE_VARIABLE, [createILVariable('result', createPrimitiveType('byte'))], 3),
                createILInstruction(ILInstructionType.RETURN, [], 4),
            ]);
            const startTime = Date.now();
            const result = await analyticsSuite.analyzeFunction(testFunction);
            const endTime = Date.now();
            // Should complete within reasonable time (1 second for simple function)
            expect(endTime - startTime).toBeLessThan(1000);
            // Analytics should report similar timing
            expect(result.performanceMetrics.totalAnalysisTime).toBeLessThan(100);
        });
    });
});
// =============================================================================
// Test Helper Functions
// =============================================================================
/**
 * Create a test IL function with given instructions
 */
function createTestFunction(name, instructions) {
    return {
        name,
        qualifiedName: ['Test', name],
        parameters: [],
        returnType: createPrimitiveType('void'),
        localVariables: [],
        instructions,
        labels: new Map(),
        isCallback: false,
        isExported: false,
        sourceLocation: { line: 1, column: 1, offset: 0 },
    };
}
/**
 * Create a test IL program with given functions
 */
function createTestProgram(functions) {
    return {
        name: 'test-program',
        modules: [
            {
                qualifiedName: ['Test'],
                functions,
                moduleData: [],
                exports: [],
                imports: [],
            },
        ],
        globalData: [],
        imports: [],
        exports: [],
        sourceInfo: {
            originalFiles: ['test.blend'],
            compilationTimestamp: new Date(),
            compilerVersion: '0.1.0',
            targetPlatform: 'c64',
        },
    };
}
/**
 * Create test IL variable
 */
function createTestVariable(name, type = 'byte') {
    return createILVariable(name, createPrimitiveType(type));
}
/**
 * Create test IL constant
 */
function createTestConstant(value, type = 'byte') {
    return createILConstant(createPrimitiveType(type), value);
}
//# sourceMappingURL=il-analytics-suite.test.js.map