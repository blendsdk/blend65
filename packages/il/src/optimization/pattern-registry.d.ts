/**
 * @fileoverview Optimization Pattern Registry
 *
 * Registry implementation for managing 470+ optimization patterns.
 * Provides pattern discovery, organization, and intelligent selection capabilities.
 */
import { OptimizationPattern, OptimizationPatternRegistry, OptimizationCategory, OptimizationLevel, OptimizationPriority, OptimizationSafety, OptimizationContext, OptimizationResult } from './types.js';
import { ILInstruction } from '../il-types.js';
/**
 * Implementation of optimization pattern registry
 */
export declare class OptimizationPatternRegistryImpl implements OptimizationPatternRegistry {
    private readonly patterns;
    private readonly categoryIndex;
    private readonly levelIndex;
    constructor();
    /**
     * Register a new optimization pattern
     */
    register(pattern: OptimizationPattern): void;
    /**
     * Get pattern by ID
     */
    get(id: string): OptimizationPattern | undefined;
    /**
     * Get all patterns for a category
     */
    getByCategory(category: OptimizationCategory): OptimizationPattern[];
    /**
     * Get all patterns suitable for a level
     */
    getByLevel(level: OptimizationLevel): OptimizationPattern[];
    /**
     * Get all registered patterns
     */
    getAll(): OptimizationPattern[];
    /**
     * Check if pattern exists
     */
    has(id: string): boolean;
    /**
     * Remove a pattern
     */
    unregister(id: string): boolean;
    /**
     * Clear all patterns
     */
    clear(): void;
    /**
     * Initialize built-in optimization patterns
     */
    private initializeBuiltinPatterns;
    /**
     * Register dead code elimination patterns
     */
    private registerDeadCodePatterns;
    /**
     * Register constant folding patterns
     */
    private registerConstantFoldingPatterns;
    /**
     * Register function optimization patterns
     */
    private registerFunctionOptimizationPatterns;
    /**
     * Register register optimization patterns
     */
    private registerRegisterOptimizationPatterns;
    /**
     * Register 6502-specific patterns
     */
    private registerSixtyTwoZeroTwoPatterns;
    /**
     * Register peephole optimization patterns
     */
    private registerPeepholePatterns;
    /**
     * Helper method to check for constant arithmetic patterns
     */
    private isConstantArithmeticPattern;
    /**
     * Helper method to create zero metrics change
     */
    private createZeroMetricsChange;
}
/**
 * Create a default pattern registry with built-in patterns
 */
export declare function createDefaultPatternRegistry(): OptimizationPatternRegistry;
/**
 * Pattern development utilities for creating custom patterns
 */
export declare class PatternBuilder {
    private pattern;
    setId(id: string): PatternBuilder;
    setName(name: string): PatternBuilder;
    setDescription(description: string): PatternBuilder;
    setCategory(category: OptimizationCategory): PatternBuilder;
    setPriority(priority: OptimizationPriority): PatternBuilder;
    setSafety(safety: OptimizationSafety): PatternBuilder;
    setMinLevel(level: OptimizationLevel): PatternBuilder;
    setTargetVariants(variants: string[]): PatternBuilder;
    setEstimatedCyclesSaved(cycles: number): PatternBuilder;
    setEstimatedSizeImpact(size: number): PatternBuilder;
    setDependencies(dependencies: string[]): PatternBuilder;
    setConflicts(conflicts: string[]): PatternBuilder;
    setApplyFunction(apply: (instructions: ILInstruction[], context: OptimizationContext) => OptimizationResult): PatternBuilder;
    setApplicabilityTest(isApplicable: (instructions: ILInstruction[], context: OptimizationContext) => boolean): PatternBuilder;
    build(): OptimizationPattern;
}
/**
 * Convenience function to start building a pattern
 */
export declare function createPattern(): PatternBuilder;
//# sourceMappingURL=pattern-registry.d.ts.map