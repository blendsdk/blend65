/**
 * Expression and Statement Analysis Implementation
 * Task 1.7: Expression and Statement Analysis Implementation
 *
 * This analyzer provides comprehensive expression and statement validation with
 * maximum optimization metadata collection for human-level peephole optimization.
 *
 * Optimization Intelligence Focus:
 * - Collect all data a human 6502 expert would use for manual optimization
 * - Variable usage patterns for zero page promotion decisions
 * - Expression complexity metrics for inlining decisions
 * - Constant folding opportunities identification
 * - Side effect analysis for code motion optimization
 * - Register allocation hints based on usage patterns
 * - Loop context awareness for optimization decisions
 * - Hardware interaction patterns for 6502-specific optimizations
 *
 * Educational Focus:
 * - How compilers collect optimization metadata during semantic analysis
 * - Expression tree traversal patterns for analysis
 * - Side effect detection algorithms
 * - Performance-critical code identification
 * - 6502-specific optimization opportunity recognition
 */
import { Expression, Statement } from '@blend65/ast';
import { SourcePosition } from '@blend65/lexer';
import { Blend65Type, SemanticError, VariableSymbol, FunctionSymbol } from '../types.js';
import { SymbolTable } from '../symbol-table.js';
import { TypeChecker } from '../type-system.js';
/**
 * Comprehensive optimization metadata for expressions.
 * Collects all information a human expert would consider for optimization.
 */
export interface ExpressionOptimizationData {
    isConstant: boolean;
    constantValue?: number | boolean | string;
    isCompileTimeConstant: boolean;
    usedVariables: VariableReference[];
    hasVariableAccess: boolean;
    variableAccessPattern: VariableAccessPattern;
    hasSideEffects: boolean;
    sideEffects: SideEffectInfo[];
    isPure: boolean;
    complexityScore: number;
    estimatedCycles: number;
    registerPressure: RegisterPressureInfo;
    sixtyTwoHints: SixtyTwoOptimizationHints;
    loopInvariant: boolean;
    loopDependent: boolean;
    hotPathCandidate: boolean;
    depth: number;
    nodeCount: number;
    hasNestedCalls: boolean;
    hasComplexAddressing: boolean;
    constantFoldingCandidate: boolean;
    commonSubexpressionCandidate: boolean;
    deadCodeCandidate: boolean;
    cacheCandidate: boolean;
}
/**
 * Variable reference tracking for optimization analysis.
 */
export interface VariableReference {
    symbol: VariableSymbol;
    accessType: VariableAccessType;
    location: SourcePosition;
    context: ExpressionContext;
    indexExpression?: Expression;
    memberName?: string;
}
/**
 * Types of variable access for optimization analysis.
 */
export type VariableAccessType = 'read' | 'write' | 'modify' | 'address' | 'array_read' | 'array_write' | 'member_read' | 'member_write';
/**
 * Variable access pattern analysis.
 */
export type VariableAccessPattern = 'single_use' | 'multiple_read' | 'read_write' | 'loop_dependent' | 'sequential' | 'random' | 'hot_path';
/**
 * Side effect information for optimization.
 */
export interface SideEffectInfo {
    type: SideEffectType;
    target: string;
    location: SourcePosition;
    severity: 'low' | 'medium' | 'high';
    description: string;
}
export type SideEffectType = 'variable_write' | 'array_write' | 'function_call' | 'hardware_access' | 'memory_access' | 'volatile_access';
/**
 * Register pressure analysis for 6502 optimization.
 */
export interface RegisterPressureInfo {
    estimatedRegistersNeeded: number;
    preferredRegister: PreferredRegister;
    requiresSpillToMemory: boolean;
    canUseZeroPage: boolean;
    temporaryVariablesNeeded: number;
}
export type PreferredRegister = 'A' | 'X' | 'Y' | 'memory' | 'zero_page';
/**
 * 6502-specific optimization hints.
 */
export interface SixtyTwoOptimizationHints {
    addressingMode: AddressingModeHint;
    zeroPageCandidate: boolean;
    absoluteAddressingRequired: boolean;
    accumulatorOperation: boolean;
    indexRegisterUsage: IndexRegisterUsage;
    requiresIndexing: boolean;
    memoryBankPreference: MemoryBank;
    alignmentRequirement: number;
    volatileAccess: boolean;
    branchPredictionHint: BranchPrediction;
    loopOptimizationHint: LoopOptimizationHint;
    inlineCandidate: boolean;
    hardwareRegisterAccess: boolean;
    timingCritical: boolean;
    interruptSafe: boolean;
}
export type AddressingModeHint = 'zero_page' | 'absolute' | 'indexed_x' | 'indexed_y' | 'indirect' | 'immediate';
export type IndexRegisterUsage = 'none' | 'prefer_x' | 'prefer_y' | 'requires_x' | 'requires_y';
export type MemoryBank = 'zero_page' | 'stack' | 'ram' | 'rom' | 'io';
export type BranchPrediction = 'likely_taken' | 'likely_not' | 'unpredictable' | 'always' | 'never';
export type LoopOptimizationHint = 'unroll_candidate' | 'vectorize_candidate' | 'strength_reduce' | 'invariant_motion' | 'induction_variable';
/**
 * Expression analysis context.
 */
export interface ExpressionContext {
    currentFunction?: FunctionSymbol;
    loopDepth: number;
    inHotPath: boolean;
    inCondition: boolean;
    inAssignment: boolean;
    hardwareContext?: HardwareContext;
    optimizationLevel: OptimizationLevel;
}
export type HardwareContext = 'interrupt_handler' | 'timing_critical' | 'hardware_access' | 'memory_mapped_io' | 'normal';
export type OptimizationLevel = 'none' | 'size' | 'speed' | 'balanced' | 'aggressive';
/**
 * Statement analysis results.
 */
export interface StatementAnalysisResult {
    statement: Statement;
    expressions: ExpressionAnalysisResult[];
    controlFlow: ControlFlowInfo;
    optimizationData: StatementOptimizationData;
    errors: SemanticError[];
    warnings: SemanticError[];
}
/**
 * Statement optimization metadata.
 */
export interface StatementOptimizationData {
    isTerminal: boolean;
    alwaysExecutes: boolean;
    conditionalExecution: boolean;
    loopStatement: boolean;
    deadCodeCandidate: boolean;
    unreachableCode: boolean;
    constantCondition: boolean;
    emptyStatement: boolean;
    executionFrequency: ExecutionFrequency;
    criticalPath: boolean;
    hotPath: boolean;
    branchInstruction: boolean;
    jumpInstruction: boolean;
    hardwareInteraction: boolean;
}
export type ExecutionFrequency = 'never' | 'rare' | 'normal' | 'frequent' | 'hot';
/**
 * Control flow information.
 */
export interface ControlFlowInfo {
    hasControlFlow: boolean;
    flowType: ControlFlowType;
    targetLabel?: string;
    condition?: Expression;
    branches: BranchInfo[];
}
export type ControlFlowType = 'sequential' | 'conditional' | 'unconditional' | 'loop' | 'return' | 'break' | 'continue';
export interface BranchInfo {
    condition?: Expression;
    target: string;
    probability: number;
}
/**
 * Expression analysis result.
 */
export interface ExpressionAnalysisResult {
    expression: Expression;
    resolvedType: Blend65Type;
    optimizationData: ExpressionOptimizationData;
    errors: SemanticError[];
    warnings: SemanticError[];
}
/**
 * Block analysis result.
 */
export interface BlockAnalysisResult {
    statements: StatementAnalysisResult[];
    blockOptimizationData: BlockOptimizationData;
    errors: SemanticError[];
    warnings: SemanticError[];
}
/**
 * Block-level optimization metadata.
 */
export interface BlockOptimizationData {
    statementCount: number;
    expressionCount: number;
    variableAccesses: VariableReference[];
    deadCodeElimination: DeadCodeInfo[];
    commonSubexpressions: CommonSubexpressionInfo[];
    constantPropagation: ConstantPropagationInfo[];
    loopOptimizations: LoopOptimizationInfo[];
    estimatedCycles: number;
    codeSize: number;
    hotPath: boolean;
    criticalSection: boolean;
}
export interface DeadCodeInfo {
    statement: Statement;
    reason: string;
    canEliminate: boolean;
}
export interface CommonSubexpressionInfo {
    expression: Expression;
    occurrences: SourcePosition[];
    eliminationBenefit: number;
}
export interface ConstantPropagationInfo {
    variable: VariableSymbol;
    constantValue: number | boolean | string;
    propagationSites: SourcePosition[];
}
export interface LoopOptimizationInfo {
    loopType: 'for' | 'while';
    invariantExpressions: Expression[];
    inductionVariables: VariableSymbol[];
    unrollCandidate: boolean;
    strengthReduction: StrengthReductionInfo[];
}
export interface StrengthReductionInfo {
    originalExpression: Expression;
    reducedForm: string;
    benefit: number;
}
/**
 * Comprehensive expression and statement analyzer with maximum optimization
 * metadata collection for human-level peephole optimization decisions.
 */
export declare class ExpressionAnalyzer {
    private symbolTable;
    private typeChecker;
    private errors;
    private warnings;
    private optimizationMetadata;
    private statementMetadata;
    constructor(symbolTable: SymbolTable, typeChecker: TypeChecker);
    /**
     * Get the type checker instance.
     */
    getTypeChecker(): TypeChecker;
    /**
     * Analyze an expression with comprehensive optimization metadata collection.
     */
    analyzeExpression(expr: Expression, context: ExpressionContext): ExpressionAnalysisResult;
    /**
     * Analyze a statement with optimization metadata collection.
     */
    analyzeStatement(stmt: Statement, context: ExpressionContext): StatementAnalysisResult;
    /**
     * Analyze a block of statements.
     */
    analyzeBlock(statements: Statement[], context: ExpressionContext): BlockAnalysisResult;
    /**
     * Determine the type of an expression.
     */
    private analyzeExpressionType;
    /**
     * Analyze binary expression type and collect optimization metadata.
     */
    private analyzeBinaryExpressionType;
    /**
     * Analyze unary expression type.
     */
    private analyzeUnaryExpressionType;
    /**
     * Analyze assignment expression type.
     */
    private analyzeAssignmentExpressionType;
    /**
     * Analyze call expression type.
     */
    private analyzeCallExpressionType;
    /**
     * Analyze member expression type.
     */
    private analyzeMemberExpressionType;
    /**
     * Analyze index expression type (array access).
     */
    private analyzeIndexExpressionType;
    /**
     * Analyze identifier type.
     */
    private analyzeIdentifierType;
    /**
     * Analyze literal type.
     */
    private analyzeLiteralType;
    /**
     * Analyze array literal type.
     */
    private analyzeArrayLiteralType;
    /**
     * Collect comprehensive optimization metadata for an expression.
     */
    private collectExpressionMetadata;
    /**
     * Calculate the depth of an expression tree.
     */
    private calculateExpressionDepth;
    /**
     * Count total nodes in an expression tree.
     */
    private countExpressionNodes;
    /**
     * Recursively collect variable references from an expression.
     */
    private collectVariableReferences;
    /**
     * Analyze variable access patterns for optimization.
     */
    private analyzeVariableAccessPattern;
    /**
     * Analyze constant properties of an expression.
     */
    private analyzeConstantProperties;
    /**
     * Analyze side effects in an expression.
     */
    private analyzeSideEffects;
    /**
     * Propagate side effects from sub-expressions.
     */
    private propagateSideEffectsFromSubExpressions;
    /**
     * Get all sub-expressions of an expression.
     */
    private getSubExpressions;
    /**
     * Analyze performance characteristics of an expression.
     */
    private analyzePerformanceCharacteristics;
    /**
     * Calculate complexity score for an expression.
     */
    private calculateComplexityScore;
    /**
     * Estimate 6502 execution cycles for an expression.
     */
    private estimateExecutionCycles;
    /**
     * Analyze register pressure for 6502.
     */
    private analyzeRegisterPressure;
    /**
     * Determine preferred register for an expression.
     */
    private determinePreferredRegister;
    /**
     * Collect 6502-specific optimization hints.
     */
    private collect6502OptimizationHints;
    /**
     * Determine addressing mode for an expression.
     */
    private determineAddressingMode;
    /**
     * Check if expression is a zero page candidate.
     */
    private isZeroPageCandidate;
    /**
     * Check if expression requires absolute addressing.
     */
    private requiresAbsoluteAddressing;
    /**
     * Check if expression is an accumulator operation.
     */
    private isAccumulatorOperation;
    /**
     * Analyze index register usage.
     */
    private analyzeIndexRegisterUsage;
    /**
     * Check if expression requires indexing.
     */
    private requiresIndexing;
    /**
     * Determine memory bank preference.
     */
    private determineMemoryBankPreference;
    /**
     * Get loop optimization hint for an expression.
     */
    private getLoopOptimizationHint;
    /**
     * Check if expression is inline candidate.
     */
    private isInlineCandidate;
    /**
     * Analyze loop context for an expression.
     */
    private analyzeLoopContext;
    /**
     * Identify optimization opportunities.
     */
    private identifyOptimizationOpportunities;
    /**
     * Extract and analyze all expressions from a statement.
     */
    private extractAndAnalyzeExpressions;
    /**
     * Analyze control flow for a statement.
     */
    private analyzeControlFlow;
    /**
     * Collect statement-level optimization metadata.
     */
    private collectStatementMetadata;
    /**
     * Collect block-level optimization metadata.
     */
    private collectBlockMetadata;
    /**
     * Determine execution frequency based on context.
     */
    private determineExecutionFrequency;
    /**
     * Create default optimization metadata for expressions.
     */
    private createDefaultOptimizationData;
    /**
     * Create default control flow information.
     */
    private createDefaultControlFlow;
    /**
     * Create default statement optimization metadata.
     */
    private createDefaultStatementOptimizationData;
    /**
     * Create default block optimization metadata.
     */
    private createDefaultBlockOptimizationData;
    /**
     * Add semantic error to the error list.
     */
    private addError;
    /**
     * Add semantic warning to the warning list.
     */
    private addWarning;
    /**
     * Get all accumulated errors.
     */
    getErrors(): SemanticError[];
    /**
     * Get all accumulated warnings.
     */
    getWarnings(): SemanticError[];
    /**
     * Clear all errors and warnings.
     */
    clearErrors(): void;
    /**
     * Get optimization metadata for an expression.
     */
    getOptimizationMetadata(expr: Expression): ExpressionOptimizationData | undefined;
    /**
     * Get statement metadata.
     */
    getStatementMetadata(stmt: Statement): StatementOptimizationData | undefined;
}
/**
 * Create expression context with optional overrides.
 */
export declare function createExpressionContext(options?: Partial<ExpressionContext>): ExpressionContext;
//# sourceMappingURL=expression-analyzer.d.ts.map