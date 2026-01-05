/**
 * @fileoverview IL Optimization Framework
 *
 * Main optimization framework that intelligently applies 470+ optimization patterns
 * using IL analytics intelligence for optimal 6502 code generation.
 */
import { ILProgram, ILFunction } from '../il-types.js';
import { OptimizationConfig, OptimizationSessionResult, OptimizationPatternRegistry } from './types.js';
/**
 * IL Optimization Framework - Main coordinator for intelligent optimization
 */
export declare class ILOptimizationFramework {
    private readonly analyticsEngine;
    private readonly optimizationPasses;
    constructor(_patternRegistry: OptimizationPatternRegistry);
    /**
     * Optimize an IL program using intelligent pattern application
     */
    optimizeProgram(program: ILProgram, config?: OptimizationConfig): Promise<OptimizationSessionResult>;
    /**
     * Optimize a single function (convenience method)
     */
    optimizeFunction(ilFunction: ILFunction, config?: OptimizationConfig): Promise<OptimizationSessionResult>;
    /**
     * Initialize optimization passes for different optimization levels
     */
    private initializeOptimizationPasses;
    /**
     * Create optimization context for pattern application
     */
    private createOptimizationContext;
    /**
     * Select optimization passes based on analytics and configuration
     */
    private selectOptimizationPasses;
    /**
     * Execute optimization passes iteratively
     */
    private executeOptimizationPasses;
    /**
     * Calculate final optimization metrics
     */
    private calculateFinalMetrics;
    /**
     * Generate optimization summary
     */
    private generateOptimizationSummary;
    /**
     * Create dead code elimination pass
     */
    private createDeadCodeEliminationPass;
    /**
     * Create basic constant folding pass
     */
    private createBasicConstantFoldingPass;
    private createConstantFoldingPass;
    private createBasicFunctionOptimizationPass;
    private createRegisterOptimizationPass;
    private createAdvancedConstantFoldingPass;
    private createAggressiveFunctionOptimizationPass;
    private createAdvancedRegisterOptimizationPass;
    private createSixtyTwoZeroTwoOptimizationPass;
    private createPeepholeOptimizationPass;
    private createSizeOptimizedConstantFoldingPass;
    private createCodeSizeReductionPass;
    private createInitialMetrics;
    private createZeroMetricsChange;
    private isPassEnabled;
    private createPatternSpecificPasses;
    private updateMetrics;
    private calculatePerformanceGrade;
    private calculateTimePerCategory;
    private generateDebugInfo;
    private cloneProgram;
    private calculateEffectiveness;
    private countInstructions;
    private estimateProgramComplexity;
    private calculatePerformanceImprovement;
    private calculateSizeChange;
    private identifyTopPatterns;
    private generateRecommendations;
}
/**
 * Convenience function to optimize an IL program
 */
export declare function optimizeIL(program: ILProgram, patternRegistry: OptimizationPatternRegistry, config?: OptimizationConfig): Promise<OptimizationSessionResult>;
/**
 * Convenience function to optimize a single function
 */
export declare function optimizeFunction(ilFunction: ILFunction, patternRegistry: OptimizationPatternRegistry, config?: OptimizationConfig): Promise<OptimizationSessionResult>;
//# sourceMappingURL=optimization-framework.d.ts.map