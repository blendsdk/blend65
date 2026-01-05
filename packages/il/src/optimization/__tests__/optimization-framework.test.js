/**
 * @fileoverview IL Optimization Framework Tests
 *
 * Comprehensive test suite for the IL optimization framework that validates
 * intelligent pattern application using analytics intelligence.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ILOptimizationFramework, optimizeIL, optimizeFunction, } from '../optimization-framework.js';
import { createDefaultPatternRegistry } from '../pattern-registry.js';
import { OptimizationLevel, OptimizationCategory, DEFAULT_OPTIMIZATION_CONFIG, } from '../types.js';
import { createILProgram, createILModule, createILFunction, createILInstruction, createILConstant, ILInstructionType, } from '../../il-types.js';
describe('ILOptimizationFramework', () => {
    let framework;
    let patternRegistry;
    let testProgram;
    let testFunction;
    beforeEach(() => {
        patternRegistry = createDefaultPatternRegistry();
        framework = new ILOptimizationFramework(patternRegistry);
        // Create test function with some basic instructions
        testFunction = createILFunction('testFunction', ['Test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
        // Add some test instructions
        testFunction.instructions = [
            createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant({ kind: 'primitive', name: 'byte' }, 5)], 1),
            createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant({ kind: 'primitive', name: 'byte' }, 3)], 2),
            createILInstruction(ILInstructionType.ADD, [], 3),
            createILInstruction(ILInstructionType.NOP, [], 4),
            createILInstruction(ILInstructionType.RETURN, [], 5),
        ];
        // Create test program
        testProgram = createILProgram('TestProgram');
        const testModule = createILModule(['Test']);
        testModule.functions = [testFunction];
        testProgram.modules = [testModule];
    });
    describe('Framework Initialization', () => {
        it('should initialize with pattern registry', () => {
            expect(framework).toBeDefined();
            expect(patternRegistry).toBeDefined();
        });
        it('should have optimization passes configured for all levels', async () => {
            // Test O0 (no optimization)
            const configO0 = {
                ...DEFAULT_OPTIMIZATION_CONFIG,
                level: OptimizationLevel.O0,
            };
            const resultO0 = await framework.optimizeProgram(testProgram, configO0);
            expect(resultO0.passResults.length).toBe(0);
            // Test O1 (basic optimization)
            const configO1 = {
                ...DEFAULT_OPTIMIZATION_CONFIG,
                level: OptimizationLevel.O1,
            };
            const resultO1 = await framework.optimizeProgram(testProgram, configO1);
            expect(resultO1.passResults.length).toBeGreaterThan(0);
        });
    });
    describe('Program Optimization', () => {
        it('should optimize IL program successfully', async () => {
            const result = await framework.optimizeProgram(testProgram);
            expect(result).toBeDefined();
            expect(result.optimizedProgram).toBeDefined();
            expect(result.metrics).toBeDefined();
            expect(result.summary).toBeDefined();
            expect(result.config).toBeDefined();
            expect(result.timing).toBeDefined();
        });
        it('should provide meaningful optimization metrics', async () => {
            const result = await framework.optimizeProgram(testProgram);
            expect(result.metrics.totalCyclesSaved).toBeGreaterThanOrEqual(0);
            expect(result.metrics.patternsApplied).toBeGreaterThanOrEqual(0);
            expect(result.metrics.passesCompleted).toBeGreaterThanOrEqual(0);
            expect(result.metrics.optimizationTime).toBeGreaterThan(0);
            expect(result.metrics.performanceGrade).toMatch(/^[ABCDF][\+]?$/);
        });
        it('should generate optimization summary', async () => {
            const result = await framework.optimizeProgram(testProgram);
            expect(result.summary.originalComplexity).toBeGreaterThan(0);
            expect(result.summary.finalComplexity).toBeGreaterThanOrEqual(0);
            expect(result.summary.performanceImprovement).toBeGreaterThanOrEqual(0);
            expect(result.summary.recommendations).toBeInstanceOf(Array);
        });
        it('should respect optimization configuration', async () => {
            const config = {
                level: OptimizationLevel.O3,
                targetVariant: 'c64-6510',
                maxPasses: 5,
                timeLimit: 1000,
                enabledCategories: new Set([OptimizationCategory.DEAD_CODE]),
                disabledPatterns: new Set(['constant-folding-basic']),
                sizeSpeedTradeoff: 0.8,
                enableExperimental: false,
                debug: {
                    logDecisions: true,
                    generateReports: true,
                    validateCorrectness: true,
                },
            };
            const result = await framework.optimizeProgram(testProgram, config);
            expect(result.config).toEqual(config);
            expect(result.passResults.length).toBeLessThanOrEqual(config.maxPasses * 10); // Reasonable upper bound
        });
        it('should handle empty programs gracefully', async () => {
            const emptyProgram = createILProgram('EmptyProgram');
            await expect(framework.optimizeProgram(emptyProgram)).rejects.toThrow();
        });
        it('should provide timing information', async () => {
            const result = await framework.optimizeProgram(testProgram);
            expect(result.timing.totalTime).toBeGreaterThan(0);
            expect(result.timing.timePerCategory).toBeDefined();
            expect(result.timing.timePerPass).toBeInstanceOf(Array);
            // Check that timing adds up reasonably
            const totalPassTime = result.timing.timePerPass.reduce((sum, time) => sum + time, 0);
            expect(totalPassTime).toBeLessThanOrEqual(result.timing.totalTime);
        });
    });
    describe('Function Optimization', () => {
        it('should optimize single function', async () => {
            const result = await framework.optimizeFunction(testFunction);
            expect(result).toBeDefined();
            expect(result.optimizedProgram).toBeDefined();
            expect(result.optimizedProgram.modules).toHaveLength(1);
            expect(result.optimizedProgram.modules[0].functions).toHaveLength(1);
        });
        it('should handle functions with no instructions', async () => {
            const emptyFunction = createILFunction('emptyFunction', ['Test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const result = await framework.optimizeFunction(emptyFunction);
            expect(result.metrics.patternsApplied).toBe(0);
        });
        it('should optimize functions with different complexities', async () => {
            // Simple function
            const simpleFunction = createILFunction('simple', ['Test'], { kind: 'primitive', name: 'byte' }, { line: 1, column: 1, offset: 0 });
            simpleFunction.instructions = [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant({ kind: 'primitive', name: 'byte' }, 42)], 1),
                createILInstruction(ILInstructionType.RETURN, [], 2),
            ];
            const simpleResult = await framework.optimizeFunction(simpleFunction);
            expect(simpleResult.summary.originalComplexity).toBeLessThan(testFunction.instructions.length * 10);
            // Complex function with more instructions
            const complexFunction = createILFunction('complex', ['Test'], { kind: 'primitive', name: 'byte' }, { line: 1, column: 1, offset: 0 });
            complexFunction.instructions = Array(20)
                .fill(null)
                .map((_, i) => createILInstruction(ILInstructionType.NOP, [], i + 1));
            const complexResult = await framework.optimizeFunction(complexFunction);
            expect(complexResult.summary.originalComplexity).toBeGreaterThan(simpleResult.summary.originalComplexity);
        });
    });
    describe('Optimization Levels', () => {
        it('should apply different optimizations based on level', async () => {
            const configs = [
                { ...DEFAULT_OPTIMIZATION_CONFIG, level: OptimizationLevel.O0 },
                { ...DEFAULT_OPTIMIZATION_CONFIG, level: OptimizationLevel.O1 },
                { ...DEFAULT_OPTIMIZATION_CONFIG, level: OptimizationLevel.O2 },
                { ...DEFAULT_OPTIMIZATION_CONFIG, level: OptimizationLevel.O3 },
            ];
            const results = await Promise.all(configs.map(config => framework.optimizeProgram(testProgram, config)));
            // O0 should have fewer optimizations than O1, O2, O3
            expect(results[0].passResults.length).toBeLessThanOrEqual(results[1].passResults.length);
            expect(results[1].passResults.length).toBeLessThanOrEqual(results[2].passResults.length);
            expect(results[2].passResults.length).toBeLessThanOrEqual(results[3].passResults.length);
        });
        it('should respect size optimization (Os)', async () => {
            const sizeConfig = {
                ...DEFAULT_OPTIMIZATION_CONFIG,
                level: OptimizationLevel.Os,
                sizeSpeedTradeoff: 0.0, // Fully favor size
            };
            const speedConfig = {
                ...DEFAULT_OPTIMIZATION_CONFIG,
                level: OptimizationLevel.O3,
                sizeSpeedTradeoff: 1.0, // Fully favor speed
            };
            const sizeResult = await framework.optimizeProgram(testProgram, sizeConfig);
            const speedResult = await framework.optimizeProgram(testProgram, speedConfig);
            // Both should complete successfully
            expect(sizeResult.performanceGrade).toMatch(/^[ABCDF][\+]?$/);
            expect(speedResult.performanceGrade).toMatch(/^[ABCDF][\+]?$/);
        });
    });
    describe('Analytics Integration', () => {
        it('should use analytics for optimization decisions', async () => {
            const result = await framework.optimizeProgram(testProgram);
            // Verify analytics was used
            expect(result.debug?.analyticsAccuracy).toBeDefined();
            expect(result.debug?.analyticsAccuracy.analyticsEffectiveness).toBeGreaterThan(0);
        });
        it('should provide pattern statistics', async () => {
            const result = await framework.optimizeProgram(testProgram);
            expect(result.debug?.patternStatistics).toBeDefined();
            expect(result.debug?.patternStatistics.mostFrequentPatterns).toBeInstanceOf(Array);
            expect(result.debug?.patternStatistics.mostEffectivePatterns).toBeInstanceOf(Array);
        });
        it('should identify performance bottlenecks', async () => {
            const result = await framework.optimizeProgram(testProgram);
            expect(result.debug?.bottlenecks).toBeDefined();
            expect(result.debug?.bottlenecks.slowestCategories).toBeInstanceOf(Array);
            expect(result.debug?.bottlenecks.slowestFunctions).toBeInstanceOf(Array);
        });
    });
    describe('Error Handling', () => {
        it('should handle optimization failures gracefully', async () => {
            // Create program that might cause optimization issues
            const problematicProgram = createILProgram('ProblematicProgram');
            const problematicModule = createILModule(['Problematic']);
            const problematicFunction = createILFunction('problematic', ['Problematic'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            // Add potentially problematic instructions
            problematicFunction.instructions = [createILInstruction(ILInstructionType.RETURN, [], 1)];
            problematicModule.functions = [problematicFunction];
            problematicProgram.modules = [problematicModule];
            const result = await framework.optimizeProgram(problematicProgram);
            // Should complete without throwing
            expect(result).toBeDefined();
            expect(result.metrics).toBeDefined();
        });
        it('should respect time limits', async () => {
            const timeoutConfig = {
                ...DEFAULT_OPTIMIZATION_CONFIG,
                timeLimit: 10, // Very short time limit
            };
            const start = Date.now();
            const result = await framework.optimizeProgram(testProgram, timeoutConfig);
            const duration = Date.now() - start;
            expect(result).toBeDefined();
            // Should not exceed time limit by too much
            expect(duration).toBeLessThan(timeoutConfig.timeLimit + 100);
        });
        it('should handle disabled patterns correctly', async () => {
            const configWithDisabledPatterns = {
                ...DEFAULT_OPTIMIZATION_CONFIG,
                disabledPatterns: new Set(['dead-code-elimination', 'constant-folding-basic']),
            };
            const result = await framework.optimizeProgram(testProgram, configWithDisabledPatterns);
            // Should still complete but with fewer optimizations
            expect(result).toBeDefined();
            expect(result.metrics.patternsApplied).toBeGreaterThanOrEqual(0);
        });
    });
    describe('Performance Validation', () => {
        it('should complete optimization within reasonable time', async () => {
            const start = Date.now();
            const result = await framework.optimizeProgram(testProgram);
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(5000); // 5 seconds max for test program
            expect(result.timing.totalTime).toBeLessThan(5000);
        });
        it('should provide accurate performance metrics', async () => {
            const result = await framework.optimizeProgram(testProgram);
            // Metrics should be realistic
            expect(result.metrics.effectiveness).toBeGreaterThanOrEqual(0);
            expect(result.metrics.effectiveness).toBeLessThanOrEqual(100);
            expect(result.metrics.optimizationTime).toBeGreaterThanOrEqual(0);
        });
        it('should handle large programs efficiently', async () => {
            // Create a larger test program
            const largeFunction = createILFunction('largeFunction', ['Large'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            // Add many instructions
            largeFunction.instructions = Array(100)
                .fill(null)
                .map((_, i) => createILInstruction(i % 2 === 0 ? ILInstructionType.NOP : ILInstructionType.LOAD_IMMEDIATE, i % 2 === 0 ? [] : [createILConstant({ kind: 'primitive', name: 'byte' }, i)], i + 1));
            const largeProgram = createILProgram('LargeProgram');
            const largeModule = createILModule(['Large']);
            largeModule.functions = [largeFunction];
            largeProgram.modules = [largeModule];
            const start = Date.now();
            const result = await framework.optimizeProgram(largeProgram);
            const duration = Date.now() - start;
            expect(result).toBeDefined();
            expect(duration).toBeLessThan(10000); // 10 seconds max for large program
            expect(result.metrics.patternsApplied).toBeGreaterThan(0); // Should find some optimizations
        });
    });
    describe('Pattern Application', () => {
        it('should apply dead code elimination patterns', async () => {
            // Create program with NOPs
            const programWithNops = createILProgram('NopProgram');
            const module = createILModule(['Nop']);
            const func = createILFunction('nopFunction', ['Nop'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            func.instructions = [
                createILInstruction(ILInstructionType.NOP, [], 1),
                createILInstruction(ILInstructionType.NOP, [], 2),
                createILInstruction(ILInstructionType.RETURN, [], 3),
            ];
            module.functions = [func];
            programWithNops.modules = [module];
            const result = await framework.optimizeProgram(programWithNops);
            // Should remove NOPs
            expect(result.optimizedProgram.modules[0].functions[0].instructions.length).toBeLessThan(3);
            expect(result.metrics.patternsApplied).toBeGreaterThan(0);
            expect(result.summary.topPatterns.some(p => p.patternId.includes('dead-code'))).toBe(true);
        });
        it('should apply constant folding patterns', async () => {
            // Test program already has constant folding opportunities
            const result = await framework.optimizeProgram(testProgram);
            // Should apply constant folding if pattern is available
            if (result.metrics.patternsApplied > 0) {
                expect(result.summary.topPatterns.length).toBeGreaterThan(0);
            }
        });
        it('should track applied patterns correctly', async () => {
            const result = await framework.optimizeProgram(testProgram);
            for (const passResult of result.passResults) {
                if (passResult.success) {
                    expect(passResult.appliedPatterns).toBeInstanceOf(Array);
                    expect(passResult.metricsChange).toBeDefined();
                    expect(passResult.executionTime).toBeGreaterThanOrEqual(0);
                }
            }
        });
    });
    describe('Integration with Analytics', () => {
        it('should use IL analytics for optimization decisions', async () => {
            const result = await framework.optimizeProgram(testProgram);
            // Verify analytics integration
            expect(result.debug?.analyticsAccuracy).toBeDefined();
            expect(result.debug?.analyticsAccuracy.performancePredictionAccuracy).toBeGreaterThan(0);
            expect(result.debug?.analyticsAccuracy.patternApplicabilityAccuracy).toBeGreaterThan(0);
        });
        it('should provide optimization recommendations based on analytics', async () => {
            const result = await framework.optimizeProgram(testProgram);
            expect(result.summary.recommendations).toBeInstanceOf(Array);
            // Should have meaningful recommendations
            if (result.summary.recommendations.length > 0) {
                result.summary.recommendations.forEach(rec => {
                    expect(typeof rec).toBe('string');
                    expect(rec.length).toBeGreaterThan(0);
                });
            }
        });
    });
    describe('Convenience Functions', () => {
        it('should optimize IL program using convenience function', async () => {
            const result = await optimizeIL(testProgram, patternRegistry);
            expect(result).toBeDefined();
            expect(result.optimizedProgram).toBeDefined();
            expect(result.metrics).toBeDefined();
        });
        it('should optimize function using convenience function', async () => {
            const result = await optimizeFunction(testFunction, patternRegistry);
            expect(result).toBeDefined();
            expect(result.optimizedProgram).toBeDefined();
            expect(result.optimizedProgram.modules[0].functions).toHaveLength(1);
        });
        it('should use default configuration when none provided', async () => {
            const result = await optimizeIL(testProgram, patternRegistry);
            expect(result.config).toEqual(DEFAULT_OPTIMIZATION_CONFIG);
        });
    });
    describe('Debug Features', () => {
        it('should generate debug information when enabled', async () => {
            const debugConfig = {
                ...DEFAULT_OPTIMIZATION_CONFIG,
                debug: {
                    logDecisions: true,
                    generateReports: true,
                    validateCorrectness: true,
                },
            };
            const result = await framework.optimizeProgram(testProgram, debugConfig);
            expect(result.debug).toBeDefined();
            expect(result.debug?.analyticsAccuracy).toBeDefined();
            expect(result.debug?.patternStatistics).toBeDefined();
            expect(result.debug?.bottlenecks).toBeDefined();
        });
        it('should not generate debug information when disabled', async () => {
            const noDebugConfig = {
                ...DEFAULT_OPTIMIZATION_CONFIG,
                debug: {
                    logDecisions: false,
                    generateReports: false,
                    validateCorrectness: false,
                },
            };
            const result = await framework.optimizeProgram(testProgram, noDebugConfig);
            expect(result.debug).toBeUndefined();
        });
    });
    describe('Optimization Effectiveness', () => {
        it('should measure optimization effectiveness', async () => {
            const result = await framework.optimizeProgram(testProgram);
            expect(result.metrics.effectiveness).toBeGreaterThanOrEqual(0);
            expect(result.metrics.effectiveness).toBeLessThanOrEqual(100);
            // Performance grade should correspond to effectiveness
            const effectiveness = result.metrics.effectiveness;
            const grade = result.performanceGrade;
            if (effectiveness >= 90) {
                expect(grade).toMatch(/^A[\+]?$/);
            }
            else if (effectiveness >= 60) {
                expect(grade).toMatch(/^[AB]/);
            }
        });
        it('should provide meaningful top patterns', async () => {
            const result = await framework.optimizeProgram(testProgram);
            result.summary.topPatterns.forEach(pattern => {
                expect(pattern.patternId).toBeDefined();
                expect(pattern.name).toBeDefined();
                expect(pattern.applications).toBeGreaterThan(0);
                expect(pattern.cyclesSaved).toBeGreaterThanOrEqual(0);
            });
        });
        it('should calculate performance improvement correctly', async () => {
            const result = await framework.optimizeProgram(testProgram);
            expect(result.summary.performanceImprovement).toBeGreaterThanOrEqual(0);
            expect(result.summary.performanceImprovement).toBeLessThanOrEqual(100);
            // Size change should be reasonable
            expect(Math.abs(result.summary.sizeChange)).toBeLessThan(testFunction.instructions.length * 10);
        });
    });
    describe('Complex Optimization Scenarios', () => {
        it('should handle multi-module programs', async () => {
            const multiModuleProgram = createILProgram('MultiModule');
            // Create multiple modules
            const module1 = createILModule(['Module1']);
            const module2 = createILModule(['Module2']);
            const func1 = createILFunction('func1', ['Module1'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const func2 = createILFunction('func2', ['Module2'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            func1.instructions = [
                createILInstruction(ILInstructionType.NOP, [], 1),
                createILInstruction(ILInstructionType.RETURN, [], 2),
            ];
            func2.instructions = [
                createILInstruction(ILInstructionType.NOP, [], 1),
                createILInstruction(ILInstructionType.RETURN, [], 2),
            ];
            module1.functions = [func1];
            module2.functions = [func2];
            multiModuleProgram.modules = [module1, module2];
            const result = await framework.optimizeProgram(multiModuleProgram);
            expect(result).toBeDefined();
            expect(result.optimizedProgram.modules).toHaveLength(2);
        });
        it('should handle functions with callback patterns', async () => {
            const callbackFunction = createILFunction('callbackFunction', ['Callback'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            callbackFunction.isCallback = true;
            callbackFunction.instructions = [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant({ kind: 'primitive', name: 'byte' }, 1)], 1),
                createILInstruction(ILInstructionType.RETURN, [], 2),
            ];
            const result = await framework.optimizeFunction(callbackFunction);
            expect(result).toBeDefined();
            expect(result.optimizedProgram.modules[0].functions[0].isCallback).toBe(true);
        });
    });
});
//# sourceMappingURL=optimization-framework.test.js.map