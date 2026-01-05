/**
 * Variable Declaration Analysis for Blend65 Semantic Analysis
 * Task 1.4: Implement Variable Declaration Analysis
 * Task 1.8: Enhanced Variable Usage Analysis (NEW)
 *
 * This analyzer validates variable declarations according to the Blend65 language specification,
 * including storage class validation, type checking, initialization validation, and scope restrictions.
 *
 * Task 1.8 Enhancement: Comprehensive optimization metadata collection for zero page promotion
 * and register allocation decisions with 6502-specific optimization hints.
 *
 * Integrates with existing TypeChecker and SymbolTable infrastructure from Tasks 1.1-1.3.
 * Uses Task 1.7 ExpressionAnalyzer variable reference tracking for optimization analysis.
 */
import { VariableDeclaration, StorageClass } from '@blend65/ast';
import { VariableSymbol, SemanticResult, ScopeType, VariableOptimizationMetadata, VariableUsageStatistics, ZeroPageCandidateInfo, RegisterCandidateInfo, VariableLifetimeInfo } from '../types.js';
import { SymbolTable } from '../symbol-table.js';
import { TypeChecker } from '../type-system.js';
import { ExpressionAnalysisResult } from './expression-analyzer.js';
/**
 * Variable analyzer that validates variable declarations and creates variable symbols
 */
export declare class VariableAnalyzer {
    private symbolTable;
    private typeChecker;
    constructor(symbolTable: SymbolTable, typeChecker: TypeChecker);
    /**
     * Analyze a variable declaration and create a variable symbol
     * Performs comprehensive validation according to Blend65 language specification
     */
    analyzeVariableDeclaration(varDecl: VariableDeclaration, currentScope: ScopeType): SemanticResult<VariableSymbol>;
    /**
     * Validate storage class usage according to Blend65 language specification
     */
    private validateStorageClassUsage;
    /**
     * Check for duplicate variable declarations in current scope
     */
    private checkDuplicateDeclaration;
    /**
     * Validate variable initialization expression
     */
    private validateInitialization;
    /**
     * Check that const and data storage classes have required initializers
     */
    private checkRequiredInitialization;
    /**
     * Validate that initializer is a compile-time constant (for data/const storage)
     */
    private validateConstantInitializer;
    /**
     * Determine if an expression is a compile-time constant
     */
    private isCompileTimeConstant;
    /**
     * Collect comprehensive usage metadata for all variables from expression analysis results.
     * Integrates with Task 1.7 ExpressionAnalyzer VariableReference tracking.
     *
     * @param variables - All variable symbols to analyze
     * @param expressionResults - Expression analysis results containing variable references
     * @returns Aggregated usage metadata for optimization decisions
     */
    collectVariableUsageMetadata(variables: VariableSymbol[], expressionResults: ExpressionAnalysisResult[]): Map<string, VariableUsageStatistics>;
    /**
     * Analyze variables for zero page promotion candidates.
     * Zero page access is faster on 6502 (3 cycles vs 4+ cycles).
     *
     * @param variables - All variable symbols to analyze
     * @returns Array of zero page candidate analysis results
     */
    analyzeZeroPageCandidates(variables: VariableSymbol[]): ZeroPageCandidateInfo[];
    /**
     * Analyze a single variable for zero page promotion.
     */
    private analyzeZeroPageCandidate;
    /**
     * Analyze variables for register allocation candidates.
     * 6502 has A, X, Y registers available for short-lived variables.
     *
     * @param variables - All variable symbols to analyze
     * @returns Array of register allocation candidate analysis
     */
    analyzeRegisterCandidates(variables: VariableSymbol[]): RegisterCandidateInfo[];
    /**
     * Analyze a single variable for register allocation.
     */
    private analyzeRegisterCandidate;
    /**
     * Analyze variable lifetimes for interference detection.
     * This is a simplified implementation - full lifetime analysis requires CFG.
     *
     * @param variables - All variable symbols to analyze
     * @param cfg - Optional control flow graph (not implemented yet)
     * @returns Lifetime analysis for interference detection
     */
    analyzeVariableLifetimes(variables: VariableSymbol[], _cfg?: any): VariableLifetimeInfo[];
    /**
     * Build comprehensive optimization metadata for variables.
     * Combines all analysis results into complete metadata.
     *
     * @param variables - All variable symbols to analyze
     * @param usageData - Usage statistics from expression analysis
     * @returns Complete optimization metadata for all variables
     */
    buildVariableOptimizationMetadata(variables: VariableSymbol[], usageData: Map<string, VariableUsageStatistics>): Map<string, VariableOptimizationMetadata>;
    /**
     * Generate 6502-specific optimization hints for a variable.
     */
    private generate6502Hints;
    /**
     * Generate memory layout information for a variable.
     */
    private generateMemoryLayoutInfo;
    /**
     * Calculate variable size in bytes for 6502 memory layout.
     */
    private calculateVariableSizeInBytes;
    /**
     * Get comprehensive analysis statistics
     */
    getAnalysisStatistics(): {
        variablesAnalyzed: number;
        storageClassUsage: Record<StorageClass | 'none', number>;
        exportedVariables: number;
        errorsDetected: number;
    };
}
/**
 * Convenience function to create and use a variable analyzer
 */
export declare function analyzeVariableDeclaration(varDecl: VariableDeclaration, symbolTable: SymbolTable, typeChecker: TypeChecker, currentScope: ScopeType): SemanticResult<VariableSymbol>;
//# sourceMappingURL=variable-analyzer.d.ts.map