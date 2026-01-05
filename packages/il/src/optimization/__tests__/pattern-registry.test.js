/**
 * @fileoverview Optimization Pattern Registry Tests
 *
 * Test suite for the optimization pattern registry that validates
 * pattern management, discovery, and organization capabilities.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { OptimizationPatternRegistryImpl, createDefaultPatternRegistry, createPattern, } from '../pattern-registry.js';
import { OptimizationCategory, OptimizationLevel, OptimizationPriority, OptimizationSafety, } from '../types.js';
import { ILInstructionType } from '../../il-types.js';
describe('OptimizationPatternRegistry', () => {
    let registry;
    let testPattern;
    beforeEach(() => {
        registry = new OptimizationPatternRegistryImpl();
        testPattern = {
            id: 'test-pattern',
            name: 'Test Pattern',
            description: 'A test optimization pattern',
            category: OptimizationCategory.CONSTANTS,
            priority: OptimizationPriority.MEDIUM,
            safety: OptimizationSafety.SAFE,
            minLevel: OptimizationLevel.O1,
            estimatedCyclesSaved: 3,
            estimatedSizeImpact: -2,
            dependencies: [],
            conflicts: [],
            apply: (instructions, context) => ({
                success: true,
                metricsChange: {
                    cyclesDelta: -3,
                    sizeDelta: -2,
                    memoryDelta: 0,
                    registerPressureDelta: 0,
                    complexityDelta: 0,
                },
                warnings: [],
                debug: {
                    applicationAttempts: [],
                    timePerCategory: {},
                    analyticsUsed: {
                        complexity: false,
                        performance: false,
                        patternReadiness: false,
                        sixtytwofiveAnalysis: false,
                    },
                    decisionLog: [],
                },
            }),
            isApplicable: (instructions, context) => true,
        };
    });
    describe('Basic Registry Operations', () => {
        it('should register patterns correctly', () => {
            registry.register(testPattern);
            expect(registry.has(testPattern.id)).toBe(true);
            expect(registry.get(testPattern.id)).toEqual(testPattern);
        });
        it('should retrieve patterns by ID', () => {
            registry.register(testPattern);
            const retrieved = registry.get(testPattern.id);
            expect(retrieved).toEqual(testPattern);
            const notFound = registry.get('non-existent');
            expect(notFound).toBeUndefined();
        });
        it('should unregister patterns correctly', () => {
            registry.register(testPattern);
            expect(registry.has(testPattern.id)).toBe(true);
            const success = registry.unregister(testPattern.id);
            expect(success).toBe(true);
            expect(registry.has(testPattern.id)).toBe(false);
            const failedUnregister = registry.unregister('non-existent');
            expect(failedUnregister).toBe(false);
        });
        it('should clear all patterns', () => {
            registry.register(testPattern);
            expect(registry.getAll().length).toBeGreaterThan(0);
            registry.clear();
            expect(registry.getAll()).toHaveLength(0);
            expect(registry.has(testPattern.id)).toBe(false);
        });
        it('should get all registered patterns', () => {
            const pattern1 = { ...testPattern, id: 'pattern1' };
            const pattern2 = { ...testPattern, id: 'pattern2' };
            registry.register(pattern1);
            registry.register(pattern2);
            const allPatterns = registry.getAll();
            expect(allPatterns.length).toBeGreaterThanOrEqual(2);
            expect(allPatterns.some(p => p.id === 'pattern1')).toBe(true);
            expect(allPatterns.some(p => p.id === 'pattern2')).toBe(true);
        });
    });
    describe('Category-Based Retrieval', () => {
        it('should retrieve patterns by category', () => {
            const constantPattern = {
                ...testPattern,
                id: 'const1',
                category: OptimizationCategory.CONSTANTS,
            };
            const deadCodePattern = {
                ...testPattern,
                id: 'dead1',
                category: OptimizationCategory.DEAD_CODE,
            };
            registry.register(constantPattern);
            registry.register(deadCodePattern);
            const constantPatterns = registry.getByCategory(OptimizationCategory.CONSTANTS);
            const deadCodePatterns = registry.getByCategory(OptimizationCategory.DEAD_CODE);
            expect(constantPatterns.some(p => p.id === 'const1')).toBe(true);
            expect(deadCodePatterns.some(p => p.id === 'dead1')).toBe(true);
            expect(constantPatterns.some(p => p.id === 'dead1')).toBe(false);
        });
        it('should return empty array for unused categories', () => {
            registry.register(testPattern);
            const emptyCategory = registry.getByCategory(OptimizationCategory.HARDWARE);
            expect(emptyCategory).toHaveLength(0);
        });
        it('should handle multiple patterns in same category', () => {
            const pattern1 = { ...testPattern, id: 'const1', category: OptimizationCategory.CONSTANTS };
            const pattern2 = { ...testPattern, id: 'const2', category: OptimizationCategory.CONSTANTS };
            const pattern3 = { ...testPattern, id: 'const3', category: OptimizationCategory.CONSTANTS };
            registry.register(pattern1);
            registry.register(pattern2);
            registry.register(pattern3);
            const constantPatterns = registry.getByCategory(OptimizationCategory.CONSTANTS);
            expect(constantPatterns.length).toBeGreaterThanOrEqual(3);
        });
    });
    describe('Level-Based Retrieval', () => {
        it('should retrieve patterns by optimization level', () => {
            const o1Pattern = { ...testPattern, id: 'o1', minLevel: OptimizationLevel.O1 };
            const o2Pattern = { ...testPattern, id: 'o2', minLevel: OptimizationLevel.O2 };
            const o3Pattern = { ...testPattern, id: 'o3', minLevel: OptimizationLevel.O3 };
            registry.register(o1Pattern);
            registry.register(o2Pattern);
            registry.register(o3Pattern);
            const o1Patterns = registry.getByLevel(OptimizationLevel.O1);
            const o2Patterns = registry.getByLevel(OptimizationLevel.O2);
            const o3Patterns = registry.getByLevel(OptimizationLevel.O3);
            // O1 should include only O1 patterns
            expect(o1Patterns.some(p => p.id === 'o1')).toBe(true);
            expect(o1Patterns.some(p => p.id === 'o2')).toBe(false);
            // O2 should include O1 and O2 patterns
            expect(o2Patterns.some(p => p.id === 'o1')).toBe(true);
            expect(o2Patterns.some(p => p.id === 'o2')).toBe(true);
            expect(o2Patterns.some(p => p.id === 'o3')).toBe(false);
            // O3 should include all patterns
            expect(o3Patterns.some(p => p.id === 'o1')).toBe(true);
            expect(o3Patterns.some(p => p.id === 'o2')).toBe(true);
            expect(o3Patterns.some(p => p.id === 'o3')).toBe(true);
        });
        it('should handle invalid optimization levels', () => {
            registry.register(testPattern);
            const invalidLevel = 'INVALID';
            const patterns = registry.getByLevel(invalidLevel);
            expect(patterns).toHaveLength(0);
        });
    });
    describe('Built-in Patterns', () => {
        it('should initialize with built-in patterns', () => {
            const patterns = registry.getAll();
            expect(patterns.length).toBeGreaterThan(0);
            // Should have basic patterns
            expect(patterns.some(p => p.category === OptimizationCategory.DEAD_CODE)).toBe(true);
            expect(patterns.some(p => p.category === OptimizationCategory.CONSTANTS)).toBe(true);
        });
        it('should have working dead code elimination patterns', () => {
            const deadCodePatterns = registry.getByCategory(OptimizationCategory.DEAD_CODE);
            expect(deadCodePatterns.length).toBeGreaterThan(0);
            const nopPattern = deadCodePatterns.find(p => p.id.includes('nop'));
            expect(nopPattern).toBeDefined();
            expect(nopPattern?.safety).toBe(OptimizationSafety.SAFE);
            expect(nopPattern?.priority).toBe(OptimizationPriority.HIGH);
        });
        it('should have working constant folding patterns', () => {
            const constantPatterns = registry.getByCategory(OptimizationCategory.CONSTANTS);
            expect(constantPatterns.length).toBeGreaterThan(0);
            const arithmeticPattern = constantPatterns.find(p => p.id.includes('arithmetic'));
            expect(arithmeticPattern).toBeDefined();
            expect(arithmeticPattern?.safety).toBe(OptimizationSafety.SAFE);
        });
        it('should have 6502-specific patterns', () => {
            const memoryPatterns = registry.getByCategory(OptimizationCategory.MEMORY);
            expect(memoryPatterns.length).toBeGreaterThan(0);
            const zeroPagePattern = memoryPatterns.find(p => p.id.includes('6502'));
            expect(zeroPagePattern).toBeDefined();
            expect(zeroPagePattern?.targetVariants).toContain('c64-6510');
        });
    });
    describe('Pattern Validation', () => {
        it('should validate pattern structure on registration', () => {
            // Valid pattern should register successfully
            expect(() => registry.register(testPattern)).not.toThrow();
            // Pattern with missing required fields should be handled gracefully
            const incompletePattern = { ...testPattern };
            delete incompletePattern.id;
            // Registry itself doesn't validate - that's handled by PatternBuilder
            expect(() => registry.register(incompletePattern)).not.toThrow();
        });
        it('should handle pattern conflicts and dependencies', () => {
            const pattern1 = { ...testPattern, id: 'pattern1', conflicts: ['pattern2'] };
            const pattern2 = { ...testPattern, id: 'pattern2', dependencies: ['pattern1'] };
            registry.register(pattern1);
            registry.register(pattern2);
            expect(registry.get('pattern1')?.conflicts).toContain('pattern2');
            expect(registry.get('pattern2')?.dependencies).toContain('pattern1');
        });
        it('should handle target variant specifications', () => {
            const c64Pattern = { ...testPattern, id: 'c64-only', targetVariants: ['c64-6510'] };
            const universalPattern = { ...testPattern, id: 'universal' };
            registry.register(c64Pattern);
            registry.register(universalPattern);
            expect(registry.get('c64-only')?.targetVariants).toContain('c64-6510');
            expect(registry.get('universal')?.targetVariants).toBeUndefined();
        });
    });
    describe('Default Registry', () => {
        it('should create default registry with patterns', () => {
            const defaultRegistry = createDefaultPatternRegistry();
            expect(defaultRegistry).toBeDefined();
            expect(defaultRegistry.getAll().length).toBeGreaterThan(0);
            // Should have patterns for basic categories
            expect(defaultRegistry.getByCategory(OptimizationCategory.DEAD_CODE).length).toBeGreaterThan(0);
            expect(defaultRegistry.getByCategory(OptimizationCategory.CONSTANTS).length).toBeGreaterThan(0);
        });
    });
});
describe('PatternBuilder', () => {
    let builder;
    let testRegistry;
    let builderTestPattern;
    beforeEach(() => {
        builder = createPattern();
        testRegistry = new OptimizationPatternRegistryImpl();
        builderTestPattern = {
            id: 'builder-test-pattern',
            name: 'Builder Test Pattern',
            description: 'A test optimization pattern for builder tests',
            category: OptimizationCategory.CONSTANTS,
            priority: OptimizationPriority.MEDIUM,
            safety: OptimizationSafety.SAFE,
            minLevel: OptimizationLevel.O1,
            estimatedCyclesSaved: 3,
            estimatedSizeImpact: -2,
            dependencies: [],
            conflicts: [],
            apply: (instructions, context) => ({
                success: true,
                metricsChange: {
                    cyclesDelta: -3,
                    sizeDelta: -2,
                    memoryDelta: 0,
                    registerPressureDelta: 0,
                    complexityDelta: 0,
                },
                warnings: [],
                debug: {
                    applicationAttempts: [],
                    timePerCategory: {},
                    analyticsUsed: {
                        complexity: false,
                        performance: false,
                        patternReadiness: false,
                        sixtytwofiveAnalysis: false,
                    },
                    decisionLog: [],
                },
            }),
            isApplicable: (instructions, context) => true,
        };
    });
    describe('Pattern Creation', () => {
        it('should build complete pattern with all fields', () => {
            const pattern = builder
                .setId('test-builder-pattern')
                .setName('Test Builder Pattern')
                .setDescription('Pattern created with builder')
                .setCategory(OptimizationCategory.ARITHMETIC)
                .setPriority(OptimizationPriority.HIGH)
                .setSafety(OptimizationSafety.SAFE)
                .setMinLevel(OptimizationLevel.O2)
                .setTargetVariants(['c64-6510'])
                .setEstimatedCyclesSaved(5)
                .setEstimatedSizeImpact(-3)
                .setDependencies(['dep1'])
                .setConflicts(['conflict1'])
                .setApplyFunction((instructions, context) => ({
                success: true,
                metricsChange: {
                    cyclesDelta: -5,
                    sizeDelta: -3,
                    memoryDelta: 0,
                    registerPressureDelta: 0,
                    complexityDelta: 0,
                },
                warnings: [],
                debug: {
                    applicationAttempts: [],
                    timePerCategory: {},
                    analyticsUsed: {
                        complexity: false,
                        performance: false,
                        patternReadiness: false,
                        sixtytwofiveAnalysis: false,
                    },
                    decisionLog: [],
                },
            }))
                .setApplicabilityTest((instructions, context) => true)
                .build();
            expect(pattern.id).toBe('test-builder-pattern');
            expect(pattern.name).toBe('Test Builder Pattern');
            expect(pattern.description).toBe('Pattern created with builder');
            expect(pattern.category).toBe(OptimizationCategory.ARITHMETIC);
            expect(pattern.priority).toBe(OptimizationPriority.HIGH);
            expect(pattern.safety).toBe(OptimizationSafety.SAFE);
            expect(pattern.minLevel).toBe(OptimizationLevel.O2);
            expect(pattern.targetVariants).toEqual(['c64-6510']);
            expect(pattern.estimatedCyclesSaved).toBe(5);
            expect(pattern.estimatedSizeImpact).toBe(-3);
            expect(pattern.dependencies).toEqual(['dep1']);
            expect(pattern.conflicts).toEqual(['conflict1']);
            expect(pattern.apply).toBeDefined();
            expect(pattern.isApplicable).toBeDefined();
        });
        it('should use default values for optional fields', () => {
            const pattern = builder
                .setId('minimal-pattern')
                .setName('Minimal Pattern')
                .setDescription('Minimal pattern with defaults')
                .setCategory(OptimizationCategory.DEAD_CODE)
                .setPriority(OptimizationPriority.LOW)
                .setSafety(OptimizationSafety.SAFE)
                .setMinLevel(OptimizationLevel.O1)
                .setApplyFunction((instructions, context) => ({
                success: false,
                metricsChange: {
                    cyclesDelta: 0,
                    sizeDelta: 0,
                    memoryDelta: 0,
                    registerPressureDelta: 0,
                    complexityDelta: 0,
                },
                warnings: [],
                debug: {
                    applicationAttempts: [],
                    timePerCategory: {},
                    analyticsUsed: {
                        complexity: false,
                        performance: false,
                        patternReadiness: false,
                        sixtytwofiveAnalysis: false,
                    },
                    decisionLog: [],
                },
            }))
                .setApplicabilityTest((instructions, context) => false)
                .build();
            expect(pattern.estimatedCyclesSaved).toBe(0);
            expect(pattern.estimatedSizeImpact).toBe(0);
            expect(pattern.dependencies).toEqual([]);
            expect(pattern.conflicts).toEqual([]);
            expect(pattern.targetVariants).toBeUndefined();
        });
        it('should validate required fields', () => {
            // Missing ID
            expect(() => {
                createPattern()
                    .setName('Test')
                    .setDescription('Test')
                    .setCategory(OptimizationCategory.CONSTANTS)
                    .setPriority(OptimizationPriority.MEDIUM)
                    .setSafety(OptimizationSafety.SAFE)
                    .setMinLevel(OptimizationLevel.O1)
                    .setApplyFunction(() => ({}))
                    .setApplicabilityTest(() => true)
                    .build();
            }).toThrow('Pattern ID is required');
            // Missing apply function
            expect(() => {
                createPattern()
                    .setId('test')
                    .setName('Test')
                    .setDescription('Test')
                    .setCategory(OptimizationCategory.CONSTANTS)
                    .setPriority(OptimizationPriority.MEDIUM)
                    .setSafety(OptimizationSafety.SAFE)
                    .setMinLevel(OptimizationLevel.O1)
                    .setApplicabilityTest(() => true)
                    .build();
            }).toThrow('Pattern apply function is required');
        });
    });
    describe('Fluent Interface', () => {
        it('should support method chaining', () => {
            expect(() => {
                builder
                    .setId('chained')
                    .setName('Chained')
                    .setDescription('Chained pattern')
                    .setCategory(OptimizationCategory.FUNCTIONS)
                    .setPriority(OptimizationPriority.HIGH)
                    .setSafety(OptimizationSafety.CONDITIONAL)
                    .setMinLevel(OptimizationLevel.O2);
            }).not.toThrow();
            // Each method should return the builder
            const result = builder.setId('test');
            expect(result).toBe(builder);
        });
    });
    describe('Pattern Functionality', () => {
        it('should create patterns with working apply functions', () => {
            let applyCalled = false;
            const workingPattern = builder
                .setId('working-pattern')
                .setName('Working Pattern')
                .setDescription('Pattern with working apply function')
                .setCategory(OptimizationCategory.CONSTANTS)
                .setPriority(OptimizationPriority.MEDIUM)
                .setSafety(OptimizationSafety.SAFE)
                .setMinLevel(OptimizationLevel.O1)
                .setApplyFunction((instructions, context) => {
                applyCalled = true;
                return {
                    success: true,
                    metricsChange: {
                        cyclesDelta: -1,
                        sizeDelta: 0,
                        memoryDelta: 0,
                        registerPressureDelta: 0,
                        complexityDelta: 0,
                    },
                    warnings: [],
                    debug: {
                        applicationAttempts: [],
                        timePerCategory: {},
                        analyticsUsed: {
                            complexity: false,
                            performance: false,
                            patternReadiness: false,
                            sixtytwofiveAnalysis: false,
                        },
                        decisionLog: [],
                    },
                };
            })
                .setApplicabilityTest((instructions, context) => true)
                .build();
            const result = workingPattern.apply([], {});
            expect(applyCalled).toBe(true);
            expect(result.success).toBe(true);
            expect(result.metricsChange.cyclesDelta).toBe(-1);
        });
        it('should create patterns with working applicability tests', () => {
            let testCalled = false;
            const testablePattern = builder
                .setId('testable-pattern')
                .setName('Testable Pattern')
                .setDescription('Pattern with working applicability test')
                .setCategory(OptimizationCategory.LOOPS)
                .setPriority(OptimizationPriority.LOW)
                .setSafety(OptimizationSafety.CONDITIONAL)
                .setMinLevel(OptimizationLevel.O1)
                .setApplyFunction((instructions, context) => ({
                success: false,
                metricsChange: {
                    cyclesDelta: 0,
                    sizeDelta: 0,
                    memoryDelta: 0,
                    registerPressureDelta: 0,
                    complexityDelta: 0,
                },
                warnings: [],
                debug: {
                    applicationAttempts: [],
                    timePerCategory: {},
                    analyticsUsed: {
                        complexity: false,
                        performance: false,
                        patternReadiness: false,
                        sixtytwofiveAnalysis: false,
                    },
                    decisionLog: [],
                },
            }))
                .setApplicabilityTest((instructions, context) => {
                testCalled = true;
                return instructions.length > 0;
            })
                .build();
            const isApplicable = testablePattern.isApplicable([{}], {});
            expect(testCalled).toBe(true);
            expect(isApplicable).toBe(true);
        });
    });
    describe('Built-in Pattern Behavior', () => {
        it('should have functional NOP elimination pattern', () => {
            const deadCodePatterns = testRegistry.getByCategory(OptimizationCategory.DEAD_CODE);
            const nopPattern = deadCodePatterns.find((p) => p.id.includes('nop'));
            expect(nopPattern).toBeDefined();
            // Test applicability
            const instructionsWithNop = [
                { type: ILInstructionType.NOP, operands: [], id: 1 },
                { type: ILInstructionType.RETURN, operands: [], id: 2 },
            ];
            const isApplicable = nopPattern.isApplicable(instructionsWithNop, {});
            expect(isApplicable).toBe(true);
            // Test application
            const result = nopPattern.apply(instructionsWithNop, {});
            expect(result.success).toBe(true);
            expect(result.instructions?.length).toBeLessThan(instructionsWithNop.length);
        });
        it('should have functional constant folding pattern', () => {
            const constantPatterns = testRegistry.getByCategory(OptimizationCategory.CONSTANTS);
            const arithmeticPattern = constantPatterns.find((p) => p.id.includes('arithmetic'));
            expect(arithmeticPattern).toBeDefined();
            // Test with constant arithmetic sequence
            const instructionsWithConstants = [
                {
                    type: ILInstructionType.LOAD_IMMEDIATE,
                    operands: [
                        {
                            valueType: 'constant',
                            type: { kind: 'primitive', name: 'byte' },
                            value: 5,
                            representation: 'decimal',
                        },
                    ],
                    id: 1,
                },
                {
                    type: ILInstructionType.LOAD_IMMEDIATE,
                    operands: [
                        {
                            valueType: 'constant',
                            type: { kind: 'primitive', name: 'byte' },
                            value: 3,
                            representation: 'decimal',
                        },
                    ],
                    id: 2,
                },
                {
                    type: ILInstructionType.ADD,
                    operands: [],
                    id: 3,
                },
            ];
            const isApplicable = arithmeticPattern.isApplicable(instructionsWithConstants, {});
            expect(isApplicable).toBe(true);
        });
    });
    describe('Registry Performance', () => {
        it('should handle large numbers of patterns efficiently', () => {
            const startTime = Date.now();
            // Register many patterns
            for (let i = 0; i < 100; i++) {
                const pattern = {
                    ...builderTestPattern,
                    id: `pattern-${i}`,
                    category: i % 2 === 0 ? OptimizationCategory.CONSTANTS : OptimizationCategory.DEAD_CODE,
                };
                testRegistry.register(pattern);
            }
            const registrationTime = Date.now() - startTime;
            expect(registrationTime).toBeLessThan(100); // Should be very fast
            // Retrieval should also be fast
            const retrievalStart = Date.now();
            const allPatterns = testRegistry.getAll();
            const constantPatterns = testRegistry.getByCategory(OptimizationCategory.CONSTANTS);
            const o1Patterns = testRegistry.getByLevel(OptimizationLevel.O1);
            const retrievalTime = Date.now() - retrievalStart;
            expect(retrievalTime).toBeLessThan(50);
            expect(allPatterns.length).toBeGreaterThanOrEqual(100);
            expect(constantPatterns.length).toBeGreaterThan(0);
            expect(o1Patterns.length).toBeGreaterThan(0);
        });
        it('should maintain performance with frequent operations', () => {
            // Register some patterns
            for (let i = 0; i < 50; i++) {
                testRegistry.register({ ...builderTestPattern, id: `perf-pattern-${i}` });
            }
            const startTime = Date.now();
            // Perform many operations
            for (let i = 0; i < 100; i++) {
                testRegistry.has(`perf-pattern-${i % 50}`);
                testRegistry.get(`perf-pattern-${i % 50}`);
                testRegistry.getByCategory(OptimizationCategory.CONSTANTS);
                testRegistry.getByLevel(OptimizationLevel.O1);
            }
            const operationTime = Date.now() - startTime;
            expect(operationTime).toBeLessThan(100); // Should handle frequent operations efficiently
        });
    });
    describe('Error Handling', () => {
        it('should handle missing patterns gracefully', () => {
            expect(testRegistry.get('non-existent')).toBeUndefined();
            expect(testRegistry.has('non-existent')).toBe(false);
            expect(testRegistry.unregister('non-existent')).toBe(false);
        });
        it('should handle empty categories gracefully', () => {
            const emptyCategory = testRegistry.getByCategory(OptimizationCategory.SIZE);
            expect(emptyCategory).toBeInstanceOf(Array);
            expect(emptyCategory.length).toBe(0);
        });
        it('should handle pattern overwriting', () => {
            testRegistry.register(builderTestPattern);
            expect(testRegistry.get(builderTestPattern.id)).toEqual(builderTestPattern);
            const modifiedPattern = { ...builderTestPattern, name: 'Modified Test Pattern' };
            testRegistry.register(modifiedPattern);
            expect(testRegistry.get(builderTestPattern.id)?.name).toBe('Modified Test Pattern');
        });
    });
});
//# sourceMappingURL=pattern-registry.test.js.map