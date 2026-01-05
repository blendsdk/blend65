/**
 * Function Declaration Analysis for Blend65 Semantic Analysis
 * Task 1.5: Implement Function Declaration Analysis
 *
 * This analyzer validates function declarations according to the Blend65 language specification,
 * including function signature validation, callback function support, parameter type checking,
 * and function call validation.
 *
 * Key Features:
 * - Function signature validation with callback support
 * - Parameter and return type checking
 * - Callback function assignment validation
 * - Function call argument compatibility
 * - Export handling for module system
 * - Duplicate function detection
 *
 * Educational Focus:
 * - How compilers validate function contracts
 * - Callback function type checking for interrupt handlers
 * - Function overloading and signature matching
 * - Symbol table integration for function resolution
 */
import { FunctionDeclaration, Expression } from '@blend65/ast';
import { FunctionSymbol, VariableSymbol, Blend65Type, SemanticResult, ScopeType } from '../types.js';
import { SymbolTable } from '../symbol-table.js';
import { TypeChecker } from '../type-system.js';
/**
 * Function analyzer that validates function declarations and creates function symbols.
 * Provides comprehensive validation for both regular functions and v0.3 callback functions.
 */
export declare class FunctionAnalyzer {
    private symbolTable;
    private typeChecker;
    constructor(symbolTable: SymbolTable, typeChecker: TypeChecker);
    /**
     * Analyze a function declaration and create a function symbol.
     * Performs comprehensive validation according to Blend65 language specification.
     *
     * Educational Note:
     * - Function declarations define the contract between caller and callee
     * - Callback functions enable interrupt handlers and function pointers
     * - Parameter validation prevents runtime type errors in 6502 assembly
     */
    analyzeFunctionDeclaration(funcDecl: FunctionDeclaration, currentScope: ScopeType): SemanticResult<FunctionSymbol>;
    /**
     * Validate callback function assignment compatibility.
     *
     * Educational Note:
     * - Callback variables can only hold callback functions
     * - Signature must match exactly for type safety
     * - Essential for interrupt handlers and function dispatch tables
     */
    validateCallbackAssignment(targetType: Blend65Type, sourceFunction: FunctionSymbol, location: {
        line: number;
        column: number;
        offset: number;
    }): SemanticResult<void>;
    /**
     * Validate function call with argument type checking.
     *
     * Educational Note:
     * - Function calls must match the declared signature exactly
     * - Argument types are checked for compatibility
     * - Return type is inferred from function signature
     */
    validateFunctionCall(functionSymbol: FunctionSymbol, args: Expression[], location: {
        line: number;
        column: number;
        offset: number;
    }): SemanticResult<Blend65Type>;
    /**
     * Validate callback function call through callback variable.
     */
    validateCallbackCall(callbackVariable: VariableSymbol, args: Expression[], location: {
        line: number;
        column: number;
        offset: number;
    }): SemanticResult<Blend65Type>;
    /**
     * Check for duplicate function declarations in current scope.
     */
    private checkDuplicateFunctionDeclaration;
    /**
     * Validate callback function specific restrictions.
     */
    private validateCallbackFunctionDeclaration;
    /**
     * Validate parameter names for uniqueness.
     */
    private validateParameterNames;
    /**
     * Perform additional function-level validations.
     */
    private performAdditionalValidations;
    /**
     * Collect comprehensive function call metadata from expression analysis results.
     * Integrates with Task 1.7 ExpressionAnalyzer function call tracking.
     *
     * Educational Note:
     * - Function call metadata drives inlining and call optimization decisions
     * - Call site analysis identifies hot paths and optimization opportunities
     * - Integration with expression analyzer provides complete call information
     */
    collectFunctionCallMetadata(functions: FunctionSymbol[], _expressionResults?: any[]): Map<string, any>;
    /**
     * Analyze functions for inlining candidates based on size, complexity, and call patterns.
     *
     * Educational Note:
     * - Small, frequently called functions are prime inlining candidates
     * - Function complexity affects inlining decision (simple logic preferred)
     * - Call frequency and hot path analysis determine inlining priority
     * - 6502 code size constraints limit aggressive inlining
     */
    analyzeFunctionInliningCandidates(functions: FunctionSymbol[]): any[];
    /**
     * Analyze callback function optimization opportunities.
     *
     * Educational Note:
     * - Callback functions have unique optimization challenges (indirect calls)
     * - Interrupt handlers require special timing and register preservation
     * - Function pointer dispatch can be optimized with jump tables
     * - 6502 indirect calls have higher overhead than direct calls
     */
    analyzeCallbackOptimization(functions: FunctionSymbol[]): any[];
    /**
     * Analyze function call optimization opportunities.
     *
     * Educational Note:
     * - Parameter passing optimization reduces call overhead
     * - Register allocation coordination between caller and callee
     * - Stack usage optimization for 6502 limited stack space
     * - Calling convention optimization for performance
     */
    analyzeFunctionCallOptimization(functions: FunctionSymbol[], _callSites?: any[]): any;
    /**
     * Build comprehensive function optimization metadata for a function.
     *
     * Educational Note:
     * - Combines all optimization analyses into actionable metadata
     * - Provides prioritized optimization recommendations
     * - Includes 6502-specific performance characteristics
     * - Enables data-driven optimization decisions in code generation
     */
    buildFunctionOptimizationMetadata(functionSymbol: FunctionSymbol, callData?: any, _expressionResults?: any[]): any;
    /**
     * Analyze individual function for inlining potential.
     */
    private analyzeFunctionInlining;
    /**
     * Analyze callback function for optimization opportunities.
     */
    private analyzeCallbackFunction;
    /**
     * Analyze function calling convention optimization.
     */
    private analyzeFunctionCallConvention;
    /**
     * Calculate function complexity metrics.
     */
    private calculateFunctionComplexity;
    /**
     * Build call statistics for a function.
     */
    private buildCallStatistics;
    /**
     * Generate 6502-specific optimization hints.
     */
    private generate6502OptimizationHints;
    /**
     * Create default callback optimization for non-callback functions.
     */
    private createDefaultCallbackOptimization;
    /**
     * Create function performance profile.
     */
    private createFunctionPerformanceProfile;
    private analyzeParameterPassing;
    private analyzeReturnOptimization;
    private analyzeFunctionRegisterUsage;
    private analyzeStackUsage;
    private analyzeCallingConvention;
    private analyzeInterruptOptimization;
    private generateRegisterAssignments;
    private analyzeGlobalCallOptimizations;
    /**
     * Get comprehensive analysis statistics for debugging and reporting.
     * Enhanced for Task 1.9 with optimization metadata tracking.
     */
    getAnalysisStatistics(): {
        functionsAnalyzed: number;
        callbackFunctions: number;
        exportedFunctions: number;
        averageParameterCount: number;
        functionsByReturnType: Record<string, number>;
        errorsDetected: number;
        optimizationCandidates: number;
        inliningCandidates: number;
    };
}
/**
 * Convenience function to create and use a function analyzer.
 */
export declare function analyzeFunctionDeclaration(funcDecl: FunctionDeclaration, symbolTable: SymbolTable, typeChecker: TypeChecker, currentScope: ScopeType): SemanticResult<FunctionSymbol>;
/**
 * Convenience function for callback assignment validation.
 */
export declare function validateCallbackAssignment(targetType: Blend65Type, sourceFunction: FunctionSymbol, symbolTable: SymbolTable, typeChecker: TypeChecker, location: {
    line: number;
    column: number;
    offset: number;
}): SemanticResult<void>;
/**
 * Convenience function for function call validation.
 */
export declare function validateFunctionCall(functionSymbol: FunctionSymbol, args: Expression[], symbolTable: SymbolTable, typeChecker: TypeChecker, location: {
    line: number;
    column: number;
    offset: number;
}): SemanticResult<Blend65Type>;
//# sourceMappingURL=function-analyzer.d.ts.map