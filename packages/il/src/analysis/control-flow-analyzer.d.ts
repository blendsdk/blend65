/**
 * Advanced Control Flow Graph Analyzer for Blend65 IL
 *
 * Implements Task 2.4.1: Advanced Control Flow Graph Analytics
 *
 * This module provides sophisticated control flow graph analysis capabilities
 * for the Blend65 IL system, including:
 * - Dominance analysis with immediate dominators and dominance trees
 * - Advanced loop detection with natural loops and nesting analysis
 * - Data dependency analysis with def-use chains and variable dependency graphs
 * - Live variable analysis with precise lifetime tracking
 * - Critical path analysis for performance hotspot identification
 * - Basic block analysis with frequency estimation
 *
 * @fileoverview Main coordinator for god-level IL analytics system
 */
import { ILFunction } from '../il-types.js';
import { ControlFlowAnalysisResult, CFGAnalysisOptions } from './types/control-flow-types.js';
/**
 * Advanced Control Flow Graph Analyzer
 *
 * Main coordinator class that orchestrates sophisticated CFG analysis
 * for IL functions, providing comprehensive data flow and control flow
 * information for optimization pattern selection and code generation.
 */
export declare class ControlFlowAnalyzer {
    private readonly options;
    private analysisMetrics;
    constructor(options?: Partial<CFGAnalysisOptions>);
    /**
     * Perform comprehensive control flow graph analysis on an IL function
     *
     * @param ilFunction The IL function to analyze
     * @returns Complete CFG analysis result with all requested analyses
     */
    analyzeFunction(ilFunction: ILFunction): ControlFlowAnalysisResult;
    /**
     * Build control flow graph from IL function
     */
    private buildControlFlowGraph;
    /**
     * Perform dominance analysis on control flow graph
     */
    private performDominanceAnalysis;
    /**
     * Perform loop analysis on control flow graph
     */
    private performLoopAnalysis;
    /**
     * Perform data dependency analysis on control flow graph
     */
    private performDataDependencyAnalysis;
    /**
     * Create empty analyses when disabled
     */
    private createEmptyDominanceAnalysis;
    private createEmptyLoopAnalysis;
    private createEmptyDataDependencyAnalysis;
    private createEmptyLiveVariableAnalysis;
    private createEmptyCriticalPathAnalysis;
    /**
     * Helper methods for analysis implementations
     */
    private checkReducibility;
    private mergeMetrics;
    /**
     * Count unique variables referenced in the CFG
     */
    private countVariables;
    private computeDominanceFrontiers;
    private computePostDominators;
    private buildStrictlyDominatesRelation;
    private buildLoopNestingTree;
    private classifyLoops;
    private analyzeInductionVariables;
    private findLoopInvariantInstructions;
    private buildDefUseChains;
    private buildUseDefChains;
    private buildVariableDependencyGraph;
    private generateDataFlowEquations;
    private analyzeMemoryDependencies;
    private performLiveVariableAnalysis;
    private performCriticalPathAnalysis;
}
/**
 * Convenience function to perform CFG analysis on an IL function
 *
 * @param ilFunction IL function to analyze
 * @param options Analysis configuration options
 * @returns Complete CFG analysis result
 */
export declare function analyzeCFG(ilFunction: ILFunction, options?: Partial<CFGAnalysisOptions>): ControlFlowAnalysisResult;
/**
 * Export types for external use
 */
export type { ControlFlowAnalysisResult, CFGAnalysisOptions, CFGAnalysisMetrics, } from './types/control-flow-types.js';
//# sourceMappingURL=control-flow-analyzer.d.ts.map