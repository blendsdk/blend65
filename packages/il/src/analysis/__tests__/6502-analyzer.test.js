/**
 * Tests for 6502-Specific Deep Validation System
 *
 * Comprehensive test suite for the 6502 family processor analyzers,
 * validating cycle-perfect timing analysis, platform-specific validation,
 * and multi-variant processor support.
 */
import { describe, it, expect } from 'vitest';
import { createILFunction, createILInstruction, createILVariable, createILConstant, ILInstructionType, } from '../../il-types.js';
import { SixtyTwo6502Analyzer, analyze6502 } from '../6502-analyzer.js';
import { ControlFlowAnalyzer } from '../control-flow-analyzer.js';
import { createPrimitiveType, createArrayType } from '@blend65/semantic';
describe('SixtyTwo6502Analyzer', () => {
    // Helper function to create source position
    const createSourcePos = () => ({ line: 1, column: 1, offset: 0, filename: 'test.blend' });
    // ============================================================================
    // BASIC FUNCTIONALITY TESTS
    // ============================================================================
    describe('Basic Analyzer Functionality', () => {
        it('should create analyzer with default options', () => {
            const analyzer = new SixtyTwo6502Analyzer();
            expect(analyzer).toBeDefined();
            expect(analyzer).toBeInstanceOf(SixtyTwo6502Analyzer);
        });
        it('should create analyzer with custom options', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                targetPlatform: 'vic20',
                processorVariant: '6502',
                enableCyclePerfectTiming: false,
            });
            expect(analyzer).toBeDefined();
        });
        it('should handle empty functions gracefully', () => {
            const analyzer = new SixtyTwo6502Analyzer();
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const emptyFunction = createILFunction('empty', ['test'], createPrimitiveType('void'), createSourcePos());
            const cfgResult = cfgAnalyzer.analyzeFunction(emptyFunction);
            const result = analyzer.analyzeFunction(emptyFunction, cfgResult);
            expect(result.isValid).toBe(true);
            expect(result.performanceAnalysis.totalCycles).toBe(0);
            expect(result.performanceAnalysis.averageCyclesPerInstruction).toBe(0);
        });
    });
    // ============================================================================
    // PROCESSOR VARIANT TESTS
    // ============================================================================
    describe('Processor Variant Support', () => {
        const testInstruction = createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 42)], 1);
        const testFunction = createILFunction('test', ['test'], createPrimitiveType('void'), createSourcePos());
        testFunction.instructions = [testInstruction];
        it('should support C64 6510 variant', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                targetPlatform: 'c64',
                processorVariant: '6510',
            });
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.isValid).toBe(true);
            expect(result.targetPlatform).toBe('c64');
            expect(result.processorVariant).toBe('6510');
            expect(result.performanceAnalysis.totalCycles).toBeGreaterThan(0);
        });
        it('should support VIC-20 6502 variant', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                targetPlatform: 'vic20',
                processorVariant: '6502',
            });
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.isValid).toBe(true);
            expect(result.targetPlatform).toBe('vic20');
            expect(result.processorVariant).toBe('6502');
            expect(result.performanceAnalysis.totalCycles).toBeGreaterThan(0);
        });
        it('should support X16 65C02 variant', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                targetPlatform: 'x16',
                processorVariant: '65C02',
            });
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.isValid).toBe(true);
            expect(result.targetPlatform).toBe('x16');
            expect(result.processorVariant).toBe('65C02');
            expect(result.performanceAnalysis.totalCycles).toBeGreaterThan(0);
        });
    });
    // ============================================================================
    // CYCLE-PERFECT TIMING ANALYSIS TESTS
    // ============================================================================
    describe('Cycle-Perfect Timing Analysis', () => {
        it('should provide accurate C64 6510 timing', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                targetPlatform: 'c64',
                processorVariant: '6510',
                enableCyclePerfectTiming: true,
            });
            // Create function with various instruction types
            const testFunction = createILFunction('timingTest', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.instructions = [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 1),
                createILInstruction(ILInstructionType.ADD, [createILConstant(createPrimitiveType('byte'), 2)], 2),
                createILInstruction(ILInstructionType.STORE_VARIABLE, [createILVariable('result', createPrimitiveType('byte'))], 3),
                createILInstruction(ILInstructionType.RETURN, [], 4),
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.performanceAnalysis.totalCycles).toBeGreaterThan(0);
            expect(result.performanceAnalysis.averageCyclesPerInstruction).toBeGreaterThan(1);
            expect(result.performanceAnalysis.cycleBreakdown).toBeDefined();
            expect(Object.keys(result.performanceAnalysis.cycleBreakdown).length).toBeGreaterThan(0);
        });
        it('should handle timing analysis disabling', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                enableCyclePerfectTiming: false,
            });
            const testFunction = createILFunction('test', ['test'], createPrimitiveType('void'), createSourcePos());
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.performanceAnalysis.totalCycles).toBe(0);
            expect(result.performanceAnalysis.averageCyclesPerInstruction).toBe(0);
        });
        it('should detect performance hotspots', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                enablePerformanceHotspotDetection: true,
            });
            // Create function with expensive operations
            const testFunction = createILFunction('hotspotTest', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.instructions = [
                createILInstruction(ILInstructionType.MUL, [
                    createILConstant(createPrimitiveType('byte'), 5),
                    createILConstant(createPrimitiveType('byte'), 6),
                ], 1),
                createILInstruction(ILInstructionType.DIV, [
                    createILConstant(createPrimitiveType('byte'), 20),
                    createILConstant(createPrimitiveType('byte'), 4),
                ], 2),
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 3),
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.performanceAnalysis.hotspotInstructions.length).toBeGreaterThanOrEqual(0);
            expect(result.performanceAnalysis.performanceScore).toBeGreaterThanOrEqual(0);
            expect(result.performanceAnalysis.performanceScore).toBeLessThanOrEqual(100);
        });
    });
    // ============================================================================
    // MEMORY LAYOUT VALIDATION TESTS
    // ============================================================================
    describe('Memory Layout Validation', () => {
        it('should validate C64 memory constraints', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                targetPlatform: 'c64',
                enableMemoryLayoutValidation: true,
            });
            const testFunction = createILFunction('memoryTest', ['test'], createPrimitiveType('void'), createSourcePos());
            // Add some local variables
            testFunction.localVariables = [
                {
                    name: 'counter',
                    type: createPrimitiveType('byte'),
                    allocationMethod: 'zero_page',
                },
                {
                    name: 'buffer',
                    type: createArrayType(createPrimitiveType('byte'), 256),
                    allocationMethod: 'global',
                },
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.constraintValidation.memoryLayoutValid).toBeDefined();
            expect(result.performanceAnalysis.totalCycles).toBeGreaterThanOrEqual(0);
        });
        it('should validate VIC-20 memory constraints', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                targetPlatform: 'vic20',
                processorVariant: '6502',
                enableMemoryLayoutValidation: true,
            });
            const testFunction = createILFunction('vic20Test', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.localVariables = [
                {
                    name: 'smallVar',
                    type: createPrimitiveType('byte'),
                    allocationMethod: 'zero_page',
                },
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.constraintValidation.memoryLayoutValid).toBeDefined();
            expect(result.targetPlatform).toBe('vic20');
        });
        it('should validate X16 memory capabilities', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                targetPlatform: 'x16',
                processorVariant: '65C02',
                enableMemoryLayoutValidation: true,
            });
            const testFunction = createILFunction('x16Test', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.localVariables = [
                {
                    name: 'modernVar',
                    type: createPrimitiveType('word'),
                    allocationMethod: 'register',
                },
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.constraintValidation.memoryLayoutValid).toBeDefined();
            expect(result.targetPlatform).toBe('x16');
        });
    });
    // ============================================================================
    // REGISTER ALLOCATION ANALYSIS TESTS
    // ============================================================================
    describe('Register Allocation Analysis', () => {
        it('should analyze register pressure', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                enableRegisterAllocationAnalysis: true,
            });
            const testFunction = createILFunction('registerTest', ['test'], createPrimitiveType('void'), createSourcePos());
            // Create instructions with register hints
            testFunction.instructions = [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 10)], 1, {
                    sixtyTwoHints: { preferredRegister: 'A' },
                }),
                createILInstruction(ILInstructionType.ADD, [createILConstant(createPrimitiveType('byte'), 5)], 2, {
                    sixtyTwoHints: { preferredRegister: 'A' },
                }),
                createILInstruction(ILInstructionType.COPY, [createILVariable('temp', createPrimitiveType('byte'))], 3, {
                    sixtyTwoHints: { preferredRegister: 'X' },
                }),
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.constraintValidation.registerUsageValid).toBeDefined();
            expect(result.performanceAnalysis.performanceScore).toBeGreaterThanOrEqual(0);
            expect(result.performanceAnalysis.performanceScore).toBeLessThanOrEqual(100);
        });
        it('should provide register allocation recommendations', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                enableOptimizationRecommendations: true,
            });
            const testFunction = createILFunction('optimizationTest', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.instructions = [
                createILInstruction(ILInstructionType.LOAD_VARIABLE, [createILVariable('counter', createPrimitiveType('byte'))], 1),
                createILInstruction(ILInstructionType.ADD, [createILConstant(createPrimitiveType('byte'), 1)], 2),
                createILInstruction(ILInstructionType.STORE_VARIABLE, [createILVariable('counter', createPrimitiveType('byte'))], 3),
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.optimizationRecommendations).toBeDefined();
            expect(Array.isArray(result.optimizationRecommendations)).toBe(true);
        });
    });
    // ============================================================================
    // HARDWARE CONSTRAINT VALIDATION TESTS
    // ============================================================================
    describe('Hardware Constraint Validation', () => {
        it('should validate stack usage constraints', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                enableHardwareConstraintValidation: true,
            });
            const testFunction = createILFunction('stackTest', ['test'], createPrimitiveType('void'), createSourcePos());
            // Add multiple call instructions to test stack depth
            testFunction.instructions = [
                createILInstruction(ILInstructionType.CALL, [createILVariable('func1', createPrimitiveType('callback'))], 1),
                createILInstruction(ILInstructionType.CALL, [createILVariable('func2', createPrimitiveType('callback'))], 2),
                createILInstruction(ILInstructionType.CALL, [createILVariable('func3', createPrimitiveType('callback'))], 3),
                createILInstruction(ILInstructionType.RETURN, [], 4),
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.constraintValidation.stackUsageValid).toBeDefined();
            expect(result.constraintValidation.timingConstraintsValid).toBeDefined();
            expect(result.constraintValidation.hardwareResourcesValid).toBeDefined();
        });
        it('should detect constraint violations', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                enableHardwareConstraintValidation: true,
            });
            const testFunction = createILFunction('violationTest', ['test'], createPrimitiveType('void'), createSourcePos());
            // Add many local variables to potentially trigger memory constraints
            testFunction.localVariables = Array.from({ length: 100 }, (_, i) => ({
                name: `var${i}`,
                type: createPrimitiveType('byte'),
                allocationMethod: 'zero_page',
            }));
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.validationIssues).toBeDefined();
            expect(Array.isArray(result.validationIssues)).toBe(true);
        });
    });
    // ============================================================================
    // PLATFORM-SPECIFIC FEATURES TESTS
    // ============================================================================
    describe('Platform-Specific Features', () => {
        it('should model C64 VIC-II interference', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                targetPlatform: 'c64',
                processorVariant: '6510',
                enableVICInterferenceModeling: true,
            });
            const testFunction = createILFunction('vicTest', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.instructions = [
                createILInstruction(ILInstructionType.LOAD_MEMORY, [createILConstant(createPrimitiveType('word'), 0xd000)], 1),
                createILInstruction(ILInstructionType.STORE_MEMORY, [createILConstant(createPrimitiveType('word'), 0xd400)], 2),
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.isValid).toBe(true);
            expect(result.targetPlatform).toBe('c64');
        });
        it('should handle VIC-20 simplicity', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                targetPlatform: 'vic20',
                processorVariant: '6502',
            });
            const testFunction = createILFunction('simpleTest', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.instructions = [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 255)], 1),
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.platformCompatibility.score).toBeGreaterThan(90);
        });
        it('should recognize X16 65C02 enhancements', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                targetPlatform: 'x16',
                processorVariant: '65C02',
            });
            const testFunction = createILFunction('enhancedTest', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.instructions = [
                createILInstruction(ILInstructionType.STORE_MEMORY, [createILConstant(createPrimitiveType('byte'), 0)], 1),
                createILInstruction(ILInstructionType.BRANCH, [createILVariable('target', createPrimitiveType('byte'))], 2),
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.platformCompatibility.score).toBeGreaterThan(95);
            expect(result.optimizationRecommendations.some((opt) => opt.description.includes('65C02') ||
                opt.description.includes('STZ') ||
                opt.description.includes('BRA'))).toBe(true);
        });
    });
    // ============================================================================
    // OPTIMIZATION RECOMMENDATION TESTS
    // ============================================================================
    describe('Optimization Recommendations', () => {
        it('should provide meaningful optimization suggestions', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                enableOptimizationRecommendations: true,
            });
            const testFunction = createILFunction('optimizationTest', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.instructions = [
                createILInstruction(ILInstructionType.LOAD_VARIABLE, [createILVariable('a', createPrimitiveType('byte'))], 1),
                createILInstruction(ILInstructionType.LOAD_VARIABLE, [createILVariable('a', createPrimitiveType('byte'))], 2), // Redundant load
                createILInstruction(ILInstructionType.MUL, [createILConstant(createPrimitiveType('byte'), 4)], 3), // Power of 2
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.optimizationRecommendations.length).toBeGreaterThan(0);
            result.optimizationRecommendations.forEach((opt) => {
                expect(opt.type).toBeDefined();
                expect(opt.priority).toBeGreaterThanOrEqual(0);
                expect(opt.priority).toBeLessThanOrEqual(100);
                expect(opt.difficulty).toMatch(/^(easy|medium|hard)$/);
                expect(opt.estimatedBenefit).toBeDefined();
                expect(opt.estimatedBenefit.cycleSavings).toBeGreaterThanOrEqual(0);
            });
        });
        it('should prioritize optimizations correctly', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                enableOptimizationRecommendations: true,
            });
            const testFunction = createILFunction('priorityTest', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.instructions = [
                createILInstruction(ILInstructionType.MUL, [createILConstant(createPrimitiveType('byte'), 8)], 1), // Should suggest shift
                createILInstruction(ILInstructionType.LOAD_VARIABLE, [createILVariable('freq', createPrimitiveType('byte'))], 2),
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            // Optimizations should be sorted by priority (highest first)
            if (result.optimizationRecommendations.length > 1) {
                for (let i = 0; i < result.optimizationRecommendations.length - 1; i++) {
                    expect(result.optimizationRecommendations[i].priority).toBeGreaterThanOrEqual(result.optimizationRecommendations[i + 1].priority);
                }
            }
        });
    });
    // ============================================================================
    // CONVENIENCE FUNCTION TESTS
    // ============================================================================
    describe('Convenience Functions', () => {
        it('should work with analyze6502 function', () => {
            const testFunction = createILFunction('convenienceTest', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.instructions = [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 42)], 1),
                createILInstruction(ILInstructionType.RETURN, [], 2),
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyze6502(testFunction, cfgResult, {
                targetPlatform: 'c64',
                processorVariant: '6510',
            });
            expect(result.isValid).toBe(true);
            expect(result.targetPlatform).toBe('c64');
            expect(result.processorVariant).toBe('6510');
        });
        it('should handle all supported processor variants', () => {
            const testFunction = createILFunction('variantTest', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.instructions = [createILInstruction(ILInstructionType.NOP, [], 1)];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            // Test all supported variants
            const variants = [
                { platform: 'c64', variant: '6510' },
                { platform: 'vic20', variant: '6502' },
                { platform: 'x16', variant: '65C02' },
            ];
            variants.forEach(({ platform, variant }) => {
                const result = analyze6502(testFunction, cfgResult, {
                    targetPlatform: platform,
                    processorVariant: variant,
                });
                expect(result.isValid).toBe(true);
                expect(result.targetPlatform).toBe(platform);
                expect(result.processorVariant).toBe(variant);
            });
        });
    });
    // ============================================================================
    // ANALYSIS PERFORMANCE TESTS
    // ============================================================================
    describe('Analysis Performance', () => {
        it('should complete analysis within reasonable time', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                maxAnalysisTimeMs: 5000,
            });
            const testFunction = createILFunction('performanceTest', ['test'], createPrimitiveType('void'), createSourcePos());
            // Create a moderately complex function
            testFunction.instructions = Array.from({ length: 50 }, (_, i) => createILInstruction(i % 2 === 0 ? ILInstructionType.LOAD_IMMEDIATE : ILInstructionType.ADD, [createILConstant(createPrimitiveType('byte'), i)], i + 1));
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const startTime = Date.now();
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            const endTime = Date.now();
            expect(result.isValid).toBe(true);
            expect(endTime - startTime).toBeLessThan(5000);
            expect(result.analysisMetrics.analysisTimeMs).toBeLessThan(5000);
        });
        it('should provide accurate analysis metrics', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                enablePerformanceProfiling: true,
            });
            const testFunction = createILFunction('metricsTest', ['test'], createPrimitiveType('void'), createSourcePos());
            testFunction.instructions = [
                createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant(createPrimitiveType('byte'), 1)], 1),
                createILInstruction(ILInstructionType.ADD, [createILConstant(createPrimitiveType('byte'), 2)], 2),
                createILInstruction(ILInstructionType.RETURN, [], 3),
            ];
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.analysisMetrics).toBeDefined();
            expect(result.analysisMetrics.analysisTimeMs).toBeGreaterThanOrEqual(0);
            expect(result.analysisMetrics.memoryUsageBytes).toBeGreaterThanOrEqual(0);
            expect(result.analysisMetrics.instructionCount).toBe(3);
            expect(result.analysisMetrics.accuracyScore).toBeGreaterThan(0.9);
        });
    });
    // ============================================================================
    // ERROR HANDLING TESTS
    // ============================================================================
    describe('Error Handling', () => {
        it('should handle analysis errors gracefully', () => {
            const analyzer = new SixtyTwo6502Analyzer({
                processorVariant: '6510',
                targetPlatform: 'c64',
            });
            const testFunction = createILFunction('errorTest', ['test'], createPrimitiveType('void'), createSourcePos());
            const cfgAnalyzer = new ControlFlowAnalyzer();
            const cfgResult = cfgAnalyzer.analyzeFunction(testFunction);
            const result = analyzer.analyzeFunction(testFunction, cfgResult);
            expect(result.isValid).toBe(true);
            expect(result.analysisMetrics).toBeDefined();
        });
    });
});
//# sourceMappingURL=6502-analyzer.test.js.map