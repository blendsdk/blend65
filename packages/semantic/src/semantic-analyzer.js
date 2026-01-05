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
import { createSymbolTable } from './symbol-table.js';
import { TypeChecker } from './type-system.js';
// Import all individual analyzers
import { ModuleAnalyzer } from './analyzers/module-analyzer.js';
import { VariableAnalyzer } from './analyzers/variable-analyzer.js';
import { FunctionAnalyzer } from './analyzers/function-analyzer.js';
import { ExpressionAnalyzer, createExpressionContext, } from './analyzers/expression-analyzer.js';
/**
 * Complete semantic analyzer integrating all specialized analyzers.
 * Task 1.10: Main semantic analyzer with full analyzer integration.
 */
export class SemanticAnalyzer {
    symbolTable;
    typeChecker;
    errors;
    warnings;
    // Individual analyzer instances - Task 1.10 Integration
    moduleAnalyzer;
    variableAnalyzer;
    functionAnalyzer;
    expressionAnalyzer;
    // Analysis state tracking
    analysisStartTime = 0;
    allExpressionResults = [];
    allVariables = [];
    allFunctions = [];
    constructor() {
        this.symbolTable = createSymbolTable();
        this.typeChecker = new TypeChecker((name) => this.symbolTable.lookupSymbol(name));
        this.errors = [];
        this.warnings = [];
        // Initialize individual analyzers with shared infrastructure
        this.moduleAnalyzer = new ModuleAnalyzer(this.symbolTable);
        this.variableAnalyzer = new VariableAnalyzer(this.symbolTable, this.typeChecker);
        this.functionAnalyzer = new FunctionAnalyzer(this.symbolTable, this.typeChecker);
        this.expressionAnalyzer = new ExpressionAnalyzer(this.symbolTable, this.typeChecker);
    }
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
    analyzeComprehensive(programs) {
        this.analysisStartTime = Date.now();
        this.reset();
        try {
            // Phase 1: Module Analysis (Task 1.4 Integration)
            const moduleResults = this.integrateModuleAnalysis(programs);
            if (!moduleResults.success) {
                return { success: false, errors: moduleResults.errors };
            }
            // Phase 2: Declaration Analysis Integration (Tasks 1.5-1.6 + 1.8-1.9)
            const declarationResults = this.integrateDeclarationAnalysis(programs);
            if (!declarationResults.success) {
                return { success: false, errors: declarationResults.errors };
            }
            // Phase 3: Expression Analysis Integration (Task 1.7)
            const expressionResults = this.integrateExpressionAnalysis(programs);
            if (!expressionResults.success) {
                return { success: false, errors: expressionResults.errors };
            }
            // Phase 4: Cross-Analyzer Optimization Coordination (Task 1.10 New)
            const optimizationResults = this.coordinateOptimizationMetadata();
            // Phase 5: Comprehensive Result Aggregation (Task 1.10 New)
            const comprehensiveResult = this.buildComprehensiveResult(moduleResults.data, declarationResults.data, expressionResults.data, optimizationResults);
            // Return comprehensive result
            return {
                success: true,
                data: comprehensiveResult,
                warnings: this.warnings.length > 0 ? this.warnings : undefined,
            };
        }
        catch (error) {
            const internalError = {
                errorType: 'InvalidOperation',
                message: `Comprehensive semantic analysis failed: ${error instanceof Error ? error.message : String(error)}`,
                location: { line: 0, column: 0, offset: 0 },
                suggestions: ['This is an internal compiler error - please report this issue'],
            };
            return {
                success: false,
                errors: [...this.errors, internalError],
                warnings: this.warnings.length > 0 ? this.warnings : undefined,
            };
        }
    }
    /**
     * Legacy API compatibility: Analyze programs with original API.
     * Task 1.10: Maintain backward compatibility while providing enhanced results.
     */
    analyze(programs) {
        // Use comprehensive analysis internally
        const comprehensiveResult = this.analyzeComprehensive(programs);
        if (!comprehensiveResult.success) {
            return {
                success: false,
                errors: comprehensiveResult.errors,
                warnings: comprehensiveResult.warnings,
            };
        }
        // Return just the symbol table for backward compatibility
        return {
            success: true,
            data: comprehensiveResult.data.symbolTable,
            warnings: comprehensiveResult.warnings,
        };
    }
    /**
     * Reset analyzer state for fresh analysis.
     * Called at the beginning of each analyze() call.
     */
    reset() {
        this.symbolTable = createSymbolTable();
        this.typeChecker = new TypeChecker((name) => this.symbolTable.lookupSymbol(name));
        this.errors = [];
        this.warnings = [];
        // Reset analyzer instances with new infrastructure
        this.moduleAnalyzer = new ModuleAnalyzer(this.symbolTable);
        this.variableAnalyzer = new VariableAnalyzer(this.symbolTable, this.typeChecker);
        this.functionAnalyzer = new FunctionAnalyzer(this.symbolTable, this.typeChecker);
        this.expressionAnalyzer = new ExpressionAnalyzer(this.symbolTable, this.typeChecker);
        // Reset analysis state
        this.allExpressionResults = [];
        this.allVariables = [];
        this.allFunctions = [];
    }
    // ============================================================================
    // TASK 1.10: ANALYZER INTEGRATION METHODS
    // ============================================================================
    /**
     * Phase 1: Integrate Module Analysis (Task 1.4)
     * Performs cross-file module analysis and import/export resolution.
     */
    integrateModuleAnalysis(programs) {
        try {
            // Use ModuleAnalyzer for comprehensive module system analysis
            const moduleErrors = this.moduleAnalyzer.analyzeModuleSystem(programs);
            if (moduleErrors.length > 0) {
                this.errors.push(...moduleErrors);
                return {
                    success: false,
                    errors: moduleErrors,
                };
            }
            // Build module analysis results
            const moduleAnalysisData = {
                crossFileImports: new Map(),
                moduleExports: new Map(),
                dependencyGraph: new Map(),
                circularDependencies: [],
            };
            // Extract module information from programs
            for (const program of programs) {
                if (program.module) {
                    const moduleName = program.module.name.parts.join('.');
                    // Extract imports
                    const imports = program.imports.map(imp => imp.source.parts.join('.'));
                    moduleAnalysisData.crossFileImports.set(moduleName, imports);
                    // Extract exports
                    const exports = program.exports.map(exp => {
                        const decl = exp.declaration;
                        return decl.name || 'unknown';
                    });
                    moduleAnalysisData.moduleExports.set(moduleName, exports);
                    // Build dependency graph
                    moduleAnalysisData.dependencyGraph.set(moduleName, new Set(imports));
                }
            }
            return {
                success: true,
                data: moduleAnalysisData,
            };
        }
        catch (error) {
            const moduleError = {
                errorType: 'InvalidOperation',
                message: `Module analysis integration failed: ${error instanceof Error ? error.message : String(error)}`,
                location: { line: 0, column: 0, offset: 0 },
                suggestions: ['Check module declarations and import/export syntax'],
            };
            return {
                success: false,
                errors: [moduleError],
            };
        }
    }
    /**
     * Phase 2: Integrate Declaration Analysis (Tasks 1.5-1.6 + 1.8-1.9)
     * Analyzes variable and function declarations with optimization metadata.
     */
    integrateDeclarationAnalysis(programs) {
        try {
            // Process all declarations across all programs
            for (const program of programs) {
                if (!program.module)
                    continue;
                const moduleName = program.module.name.parts.join('.');
                // Enter module scope for declaration processing
                this.symbolTable.enterScope('Module', moduleName);
                // Process each declaration in the program body
                for (const declaration of program.body) {
                    const declarationResult = this.processDeclaration(declaration);
                    if (!declarationResult.success) {
                        this.errors.push(...declarationResult.errors);
                    }
                }
                // Exit module scope
                this.symbolTable.exitScope();
            }
            // Collect optimization metadata after all declarations are processed
            const variableOptimizationMetadata = this.variableAnalyzer.buildVariableOptimizationMetadata(this.allVariables, this.variableAnalyzer.collectVariableUsageMetadata(this.allVariables, this.allExpressionResults));
            // Collect function optimization metadata
            const functionOptimizationMetadata = new Map();
            for (const func of this.allFunctions) {
                const metadata = this.functionAnalyzer.buildFunctionOptimizationMetadata(func, this.functionAnalyzer.collectFunctionCallMetadata(this.allFunctions, this.allExpressionResults), this.allExpressionResults);
                functionOptimizationMetadata.set(func.name, metadata);
                func.optimizationMetadata = metadata;
            }
            // Build declaration analysis results
            const declarationAnalysisData = {
                variables: this.allVariables,
                functions: this.allFunctions,
                variableOptimizationMetadata,
                functionOptimizationMetadata,
            };
            return {
                success: true,
                data: declarationAnalysisData,
            };
        }
        catch (error) {
            const declarationError = {
                errorType: 'InvalidOperation',
                message: `Declaration analysis integration failed: ${error instanceof Error ? error.message : String(error)}`,
                location: { line: 0, column: 0, offset: 0 },
                suggestions: ['Check variable and function declarations'],
            };
            return {
                success: false,
                errors: [declarationError],
            };
        }
    }
    /**
     * Process an individual declaration using appropriate analyzer.
     */
    processDeclaration(declaration) {
        switch (declaration.type) {
            case 'VariableDeclaration':
                const varResult = this.variableAnalyzer.analyzeVariableDeclaration(declaration, 'Global' // Module-level variables are in global scope
                );
                if (varResult.success) {
                    this.allVariables.push(varResult.data);
                }
                return varResult;
            case 'FunctionDeclaration':
                const funcResult = this.functionAnalyzer.analyzeFunctionDeclaration(declaration, 'Global' // Module-level functions are in global scope
                );
                if (funcResult.success) {
                    this.allFunctions.push(funcResult.data);
                }
                return funcResult;
            default:
                return {
                    success: false,
                    errors: [
                        {
                            errorType: 'InvalidOperation',
                            message: `Unsupported declaration type: ${declaration.type}`,
                            location: declaration.metadata?.start || { line: 0, column: 0, offset: 0 },
                            suggestions: ['Use supported declaration types: variable or function'],
                        },
                    ],
                };
        }
    }
    /**
     * Phase 3: Integrate Expression Analysis (Task 1.7)
     * Analyzes expressions and statements with comprehensive optimization data.
     */
    integrateExpressionAnalysis(programs) {
        try {
            let totalExpressions = 0;
            const constantExpressions = [];
            const variableReferences = new Map();
            const optimizationOpportunities = [];
            // Process expressions in all programs
            for (const program of programs) {
                if (!program.module)
                    continue;
                // Create expression context for this module
                const context = createExpressionContext({
                    optimizationLevel: 'balanced',
                });
                // Process expressions in function bodies (when available)
                for (const declaration of program.body) {
                    if (declaration.type === 'FunctionDeclaration') {
                        const funcDecl = declaration;
                        if (funcDecl.body) {
                            const statementsResult = this.expressionAnalyzer.analyzeBlock(funcDecl.body, context);
                            // Aggregate expression results
                            for (const stmtResult of statementsResult.statements) {
                                this.allExpressionResults.push(...stmtResult.expressions);
                                totalExpressions += stmtResult.expressions.length;
                                // Collect constant expressions
                                for (const exprResult of stmtResult.expressions) {
                                    if (exprResult.optimizationData.isConstant) {
                                        constantExpressions.push(exprResult.expression);
                                    }
                                    // Collect variable references
                                    for (const varRef of exprResult.optimizationData.usedVariables) {
                                        const varName = varRef.symbol.name;
                                        if (!variableReferences.has(varName)) {
                                            variableReferences.set(varName, []);
                                        }
                                        variableReferences.get(varName).push(varRef);
                                    }
                                    // Collect optimization opportunities
                                    if (exprResult.optimizationData.constantFoldingCandidate) {
                                        optimizationOpportunities.push({
                                            type: 'constant_folding',
                                            expression: exprResult.expression,
                                            benefit: 'compile_time_evaluation',
                                        });
                                    }
                                    if (exprResult.optimizationData.commonSubexpressionCandidate) {
                                        optimizationOpportunities.push({
                                            type: 'common_subexpression_elimination',
                                            expression: exprResult.expression,
                                            benefit: 'reduced_computation',
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // Build expression analysis results
            const expressionAnalysisData = {
                totalExpressions,
                constantExpressions,
                variableReferences,
                optimizationOpportunities,
                performanceMetrics: {
                    totalCycles: this.allExpressionResults.reduce((sum, result) => sum + result.optimizationData.estimatedCycles, 0),
                    complexity: this.allExpressionResults.reduce((sum, result) => sum + result.optimizationData.complexityScore, 0) / Math.max(1, totalExpressions),
                    registerPressure: this.allExpressionResults.reduce((sum, result) => sum + result.optimizationData.registerPressure.estimatedRegistersNeeded, 0) / Math.max(1, totalExpressions),
                },
            };
            return {
                success: true,
                data: expressionAnalysisData,
            };
        }
        catch (error) {
            const expressionError = {
                errorType: 'InvalidOperation',
                message: `Expression analysis integration failed: ${error instanceof Error ? error.message : String(error)}`,
                location: { line: 0, column: 0, offset: 0 },
                suggestions: ['Check expression syntax and usage'],
            };
            return {
                success: false,
                errors: [expressionError],
            };
        }
    }
    /**
     * Phase 4: Cross-Analyzer Optimization Coordination (Task 1.10)
     * Coordinates optimization metadata between analyzers for better decisions.
     */
    coordinateOptimizationMetadata() {
        try {
            const registerInterference = new Map();
            const optimizationConflicts = [];
            const coordinatedOptimizations = [];
            // Analyze register allocation conflicts between variables and functions
            for (const variable of this.allVariables) {
                if (variable.optimizationMetadata?.registerCandidate.isCandidate) {
                    const interfering = [];
                    // Check for interference with other variables
                    for (const otherVar of this.allVariables) {
                        if (otherVar.name !== variable.name &&
                            otherVar.optimizationMetadata?.registerCandidate.isCandidate &&
                            otherVar.optimizationMetadata.registerCandidate.preferredRegister ===
                                variable.optimizationMetadata.registerCandidate.preferredRegister) {
                            interfering.push(otherVar.name);
                        }
                    }
                    // Check for interference with function register usage
                    for (const func of this.allFunctions) {
                        if (func.optimizationMetadata?.sixtyTwoHints?.registerStrategy) {
                            const funcRegisters = func.optimizationMetadata.sixtyTwoHints.registerStrategy.registerAssignments.map(assignment => assignment.register);
                            if (funcRegisters.includes(variable.optimizationMetadata.registerCandidate.preferredRegister)) {
                                interfering.push(`function_${func.name}`);
                            }
                        }
                    }
                    if (interfering.length > 0) {
                        registerInterference.set(variable.name, interfering);
                    }
                }
            }
            // Identify optimization conflicts
            for (const variable of this.allVariables) {
                if (variable.optimizationMetadata?.zeroPageCandidate.isCandidate) {
                    // Check if variable is marked for both zero page and register allocation
                    if (variable.optimizationMetadata.registerCandidate.isCandidate) {
                        optimizationConflicts.push({
                            type: 'zero_page_register_conflict',
                            variable: variable.name,
                            conflict: 'Variable cannot be both in zero page and register allocated',
                            resolution: 'Prefer register allocation for higher performance',
                        });
                    }
                }
            }
            // Generate coordinated optimizations
            for (const func of this.allFunctions) {
                if (func.optimizationMetadata?.inliningCandidate.isCandidate) {
                    coordinatedOptimizations.push({
                        type: 'function_inlining',
                        target: func.name,
                        benefit: func.optimizationMetadata.inliningCandidate.estimatedBenefit,
                        cost: func.optimizationMetadata.inliningCandidate.estimatedCost,
                        priority: func.optimizationMetadata.inliningCandidate.inliningScore,
                    });
                }
            }
            // Calculate global optimization score
            let globalOptimizationScore = 0;
            const totalOptimizations = this.allVariables.length + this.allFunctions.length;
            if (totalOptimizations > 0) {
                // Score based on optimization coverage
                const optimizedVariables = this.allVariables.filter(v => v.optimizationMetadata?.zeroPageCandidate.isCandidate ||
                    v.optimizationMetadata?.registerCandidate.isCandidate).length;
                const optimizedFunctions = this.allFunctions.filter(f => f.optimizationMetadata?.inliningCandidate.isCandidate ||
                    f.optimizationMetadata?.callOptimization).length;
                globalOptimizationScore =
                    ((optimizedVariables + optimizedFunctions) / totalOptimizations) * 100;
            }
            return {
                registerInterference,
                optimizationConflicts,
                coordinatedOptimizations,
                globalOptimizationScore,
            };
        }
        catch (error) {
            // Return default optimization coordination results on error
            return {
                registerInterference: new Map(),
                optimizationConflicts: [],
                coordinatedOptimizations: [],
                globalOptimizationScore: 0,
            };
        }
    }
    /**
     * Phase 5: Build Comprehensive Analysis Result (Task 1.10)
     * Aggregates all analysis results into comprehensive result structure.
     */
    buildComprehensiveResult(moduleAnalysis, declarationAnalysis, expressionAnalysis, optimizationCoordination) {
        // Calculate analysis metrics
        const analysisTime = Date.now() - this.analysisStartTime;
        const totalSymbols = this.allVariables.length + this.allFunctions.length;
        // Calculate optimization coverage
        const optimizedVariables = this.allVariables.filter(v => v.optimizationMetadata?.zeroPageCandidate.isCandidate ||
            v.optimizationMetadata?.registerCandidate.isCandidate).length;
        const optimizedFunctions = this.allFunctions.filter(f => f.optimizationMetadata?.inliningCandidate.isCandidate).length;
        const optimizationCoverage = totalSymbols > 0 ? ((optimizedVariables + optimizedFunctions) / totalSymbols) * 100 : 0;
        // Calculate quality score based on error count and optimization coverage
        const qualityScore = Math.max(0, 100 - this.errors.length * 10) * (optimizationCoverage / 100);
        return {
            symbolTable: this.symbolTable,
            moduleAnalysis: {
                crossFileImports: moduleAnalysis.crossFileImports,
                moduleExports: moduleAnalysis.moduleExports,
                dependencyGraph: moduleAnalysis.dependencyGraph,
                circularDependencies: moduleAnalysis.circularDependencies,
            },
            variableAnalysis: {
                variables: declarationAnalysis.variables,
                optimizationMetadata: declarationAnalysis.variableOptimizationMetadata,
                zeroPageCandidates: this.allVariables
                    .filter(v => v.optimizationMetadata?.zeroPageCandidate.isCandidate)
                    .map(v => v.name),
                registerCandidates: this.allVariables
                    .filter(v => v.optimizationMetadata?.registerCandidate.isCandidate)
                    .map(v => v.name),
                usageStatistics: this.variableAnalyzer.collectVariableUsageMetadata(this.allVariables, this.allExpressionResults),
            },
            functionAnalysis: {
                functions: declarationAnalysis.functions,
                optimizationMetadata: declarationAnalysis.functionOptimizationMetadata,
                inliningCandidates: this.allFunctions
                    .filter(f => f.optimizationMetadata?.inliningCandidate.isCandidate)
                    .map(f => f.name),
                callbackFunctions: this.allFunctions.filter(f => f.isCallback).map(f => f.name),
                callStatistics: this.functionAnalyzer.collectFunctionCallMetadata(this.allFunctions, this.allExpressionResults),
            },
            expressionAnalysis: {
                totalExpressions: expressionAnalysis.totalExpressions,
                constantExpressions: expressionAnalysis.constantExpressions,
                variableReferences: expressionAnalysis.variableReferences,
                optimizationOpportunities: expressionAnalysis.optimizationOpportunities,
                performanceMetrics: expressionAnalysis.performanceMetrics,
            },
            crossAnalyzerOptimization: {
                registerInterference: optimizationCoordination.registerInterference,
                optimizationConflicts: optimizationCoordination.optimizationConflicts,
                coordinatedOptimizations: optimizationCoordination.coordinatedOptimizations,
                globalOptimizationScore: optimizationCoordination.globalOptimizationScore,
            },
            analysisMetrics: {
                totalSymbols,
                analysisTime,
                optimizationCoverage,
                qualityScore,
            },
        };
    }
    /**
     * Add an error to the error collection.
     */
    addError(error) {
        this.errors.push(error);
    }
    /**
     * Add a warning to the warning collection.
     */
    addWarning(warning) {
        this.warnings.push(warning);
    }
    /**
     * Get the addError method for validation.
     */
    getAddError() {
        return this.addError.bind(this);
    }
    /**
     * Get the addWarning method for validation.
     */
    getAddWarning() {
        return this.addWarning.bind(this);
    }
    /**
     * Get current symbol table (for testing and debugging).
     */
    getSymbolTable() {
        return this.symbolTable;
    }
    /**
     * Get current errors (for testing and debugging).
     */
    getErrors() {
        return [...this.errors];
    }
    /**
     * Get current warnings (for testing and debugging).
     */
    getWarnings() {
        return [...this.warnings];
    }
}
// ============================================================================
// TASK 1.10: CONVENIENCE FUNCTIONS FOR COMPREHENSIVE ANALYSIS
// ============================================================================
/**
 * Task 1.10: Comprehensive single-file analysis with full optimization metadata.
 */
export function analyzeComprehensiveProgram(program) {
    const analyzer = new SemanticAnalyzer();
    return analyzer.analyzeComprehensive([program]);
}
/**
 * Task 1.10: Comprehensive multi-file analysis with full optimization metadata.
 */
export function analyzeComprehensivePrograms(programs) {
    const analyzer = new SemanticAnalyzer();
    return analyzer.analyzeComprehensive(programs);
}
/**
 * Convenience function for single-file analysis.
 * Wraps a single program in an array for the multi-program API.
 */
export function analyzeProgram(program) {
    const analyzer = new SemanticAnalyzer();
    return analyzer.analyze([program]);
}
/**
 * Convenience function for multi-file analysis.
 * Explicit multi-program analysis for clarity.
 */
export function analyzePrograms(programs) {
    const analyzer = new SemanticAnalyzer();
    return analyzer.analyze(programs);
}
//# sourceMappingURL=semantic-analyzer.js.map