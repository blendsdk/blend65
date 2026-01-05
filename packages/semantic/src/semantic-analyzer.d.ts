/**
 * Main Semantic Analyzer for Blend65
 * Task 1.10: Main Semantic Analyzer Integration
 *
 * Complete semantic analysis orchestrator that integrates all specialized analyzers:
 * - ModuleAnalyzer (Task 1.4): Cross-file module analysis and import/export resolution
 * - VariableAnalyzer (Task 1.6 + 1.8): Variable declaration analysis with optimization metadata
 * - FunctionAnalyzer (Task 1.5 + 1.9): Function declaration analysis with optimization metadata
 * - ExpressionAnalyzer (Task 1.7): Expression and statement analysis with comprehensive optimization data
 *
 * Task 1.10 Integration Features:
 * - Complete analyzer coordination with variable, function, expression, and module analyzers
 * - Cross-analyzer optimization coordination (register allocation interference, etc.)
 * - Comprehensive semantic analysis result aggregation
 * - Complete semantic analysis pipeline with all components
 * - Performance-optimized analysis with optimization metadata collection
 *
 * Educational Focus:
 * - How semantic analysis phases integrate in modern compilers
 * - Cross-analyzer coordination for optimization metadata
 * - Complete semantic validation pipeline construction
 * - Performance optimization metadata aggregation for code generation
 */
import { Program, Expression } from '@blend65/ast';
import { SemanticResult, SemanticError, VariableSymbol, FunctionSymbol, VariableOptimizationMetadata, FunctionOptimizationMetadata } from './types.js';
import { SymbolTable } from './symbol-table.js';
/**
 * Comprehensive semantic analysis result aggregating all analyzer results.
 * Task 1.10: Complete semantic analysis result structure.
 */
export interface ComprehensiveSemanticAnalysisResult {
    /** Unified symbol table with all symbols from all analyzers */
    symbolTable: SymbolTable;
    /** Module analysis results with import/export resolution */
    moduleAnalysis: {
        crossFileImports: Map<string, string[]>;
        moduleExports: Map<string, string[]>;
        dependencyGraph: Map<string, Set<string>>;
        circularDependencies: string[][];
    };
    /** Variable analysis results with optimization metadata */
    variableAnalysis: {
        variables: VariableSymbol[];
        optimizationMetadata: Map<string, VariableOptimizationMetadata>;
        zeroPageCandidates: string[];
        registerCandidates: string[];
        usageStatistics: Map<string, any>;
    };
    /** Function analysis results with optimization metadata */
    functionAnalysis: {
        functions: FunctionSymbol[];
        optimizationMetadata: Map<string, FunctionOptimizationMetadata>;
        inliningCandidates: string[];
        callbackFunctions: string[];
        callStatistics: Map<string, any>;
    };
    /** Expression analysis results with comprehensive optimization data */
    expressionAnalysis: {
        totalExpressions: number;
        constantExpressions: Expression[];
        variableReferences: Map<string, any[]>;
        optimizationOpportunities: any[];
        performanceMetrics: any;
    };
    /** Cross-analyzer optimization coordination results */
    crossAnalyzerOptimization: {
        registerInterference: Map<string, string[]>;
        optimizationConflicts: any[];
        coordinatedOptimizations: any[];
        globalOptimizationScore: number;
    };
    /** Performance and quality metrics */
    analysisMetrics: {
        totalSymbols: number;
        analysisTime: number;
        optimizationCoverage: number;
        qualityScore: number;
    };
}
/**
 * Complete semantic analyzer integrating all specialized analyzers.
 * Task 1.10: Main semantic analyzer with full analyzer integration.
 */
export declare class SemanticAnalyzer {
    private symbolTable;
    private typeChecker;
    private errors;
    private warnings;
    private moduleAnalyzer;
    private variableAnalyzer;
    private functionAnalyzer;
    private expressionAnalyzer;
    private analysisStartTime;
    private allExpressionResults;
    private allVariables;
    private allFunctions;
    constructor();
    /**
     * Task 1.10: Comprehensive semantic analysis with full analyzer integration.
     *
     * Complete Analysis Pipeline:
     * 1. Module registration and dependency resolution (ModuleAnalyzer)
     * 2. Variable declaration analysis with optimization metadata (VariableAnalyzer)
     * 3. Function declaration analysis with optimization metadata (FunctionAnalyzer)
     * 4. Expression analysis with comprehensive optimization data (ExpressionAnalyzer)
     * 5. Cross-analyzer optimization coordination
     * 6. Comprehensive result aggregation
     *
     * @param programs Array of parsed AST programs to analyze
     * @returns Comprehensive semantic analysis result
     */
    analyzeComprehensive(programs: Program[]): SemanticResult<ComprehensiveSemanticAnalysisResult>;
    /**
     * Legacy API compatibility: Analyze programs with original API.
     * Task 1.10: Maintain backward compatibility while providing enhanced results.
     */
    analyze(programs: Program[]): SemanticResult<SymbolTable>;
    /**
     * Reset analyzer state for fresh analysis.
     * Called at the beginning of each analyze() call.
     */
    private reset;
    /**
     * Phase 1: Integrate Module Analysis (Task 1.4)
     * Performs cross-file module analysis and import/export resolution.
     */
    private integrateModuleAnalysis;
    /**
     * Phase 2: Integrate Declaration Analysis (Tasks 1.5-1.6 + 1.8-1.9)
     * Analyzes variable and function declarations with optimization metadata.
     */
    private integrateDeclarationAnalysis;
    /**
     * Process an individual declaration using appropriate analyzer.
     */
    private processDeclaration;
    /**
     * Phase 3: Integrate Expression Analysis (Task 1.7)
     * Analyzes expressions and statements with comprehensive optimization data.
     */
    private integrateExpressionAnalysis;
    /**
     * Phase 4: Cross-Analyzer Optimization Coordination (Task 1.10)
     * Coordinates optimization metadata between analyzers for better decisions.
     */
    private coordinateOptimizationMetadata;
    /**
     * Phase 5: Build Comprehensive Analysis Result (Task 1.10)
     * Aggregates all analysis results into comprehensive result structure.
     */
    private buildComprehensiveResult;
    /**
     * Add an error to the error collection.
     */
    private addError;
    /**
     * Add a warning to the warning collection.
     */
    private addWarning;
    /**
     * Get the addError method for validation.
     */
    getAddError(): (error: SemanticError) => void;
    /**
     * Get the addWarning method for validation.
     */
    getAddWarning(): (warning: SemanticError) => void;
    /**
     * Get current symbol table (for testing and debugging).
     */
    getSymbolTable(): SymbolTable;
    /**
     * Get current errors (for testing and debugging).
     */
    getErrors(): SemanticError[];
    /**
     * Get current warnings (for testing and debugging).
     */
    getWarnings(): SemanticError[];
}
/**
 * Task 1.10: Comprehensive single-file analysis with full optimization metadata.
 */
export declare function analyzeComprehensiveProgram(program: Program): SemanticResult<ComprehensiveSemanticAnalysisResult>;
/**
 * Task 1.10: Comprehensive multi-file analysis with full optimization metadata.
 */
export declare function analyzeComprehensivePrograms(programs: Program[]): SemanticResult<ComprehensiveSemanticAnalysisResult>;
/**
 * Convenience function for single-file analysis.
 * Wraps a single program in an array for the multi-program API.
 */
export declare function analyzeProgram(program: Program): SemanticResult<SymbolTable>;
/**
 * Convenience function for multi-file analysis.
 * Explicit multi-program analysis for clarity.
 */
export declare function analyzePrograms(programs: Program[]): SemanticResult<SymbolTable>;
//# sourceMappingURL=semantic-analyzer.d.ts.map