/**
 * IL Validation System for Blend65
 * Task 2.4: Implement IL Validation
 *
 * This file implements comprehensive validation for generated Blend65 IL.
 * The validator ensures IL correctness before optimization and code generation,
 * detecting errors in instruction validity, control flow, variable lifecycle,
 * function calls, register usage, and type consistency.
 *
 * Key Responsibilities:
 * - Validate all IL instruction types and operand compatibility
 * - Ensure control flow graph integrity and reachability analysis
 * - Verify variable definition before use and scope compliance
 * - Validate function call conventions and signature compatibility
 * - Check 6502 register allocation hints and usage patterns
 * - Ensure type consistency across instruction sequences
 *
 * Educational Focus:
 * - How compilers validate intermediate representations for correctness
 * - Control flow analysis and dead code detection in IL
 * - Variable lifecycle management and scope validation
 * - 6502-specific validation considerations for optimization
 * - Type safety enforcement in intermediate language
 */
import type { SourcePosition } from '@blend65/lexer';
import type { ILProgram, ILModule, ILFunction, ILInstruction, ILOperand, ControlFlowGraph } from './il-types';
import { ILInstructionType } from './il-types';
/**
 * Types of IL validation errors.
 */
export declare enum ILValidationErrorType {
    INVALID_INSTRUCTION_TYPE = "INVALID_INSTRUCTION_TYPE",
    INVALID_OPERAND_COUNT = "INVALID_OPERAND_COUNT",
    INVALID_OPERAND_TYPE = "INVALID_OPERAND_TYPE",
    INCOMPATIBLE_RESULT_TYPE = "INCOMPATIBLE_RESULT_TYPE",
    INVALID_BRANCH_TARGET = "INVALID_BRANCH_TARGET",
    UNREACHABLE_CODE = "UNREACHABLE_CODE",
    INVALID_CONTROL_FLOW = "INVALID_CONTROL_FLOW",
    MISSING_RETURN_STATEMENT = "MISSING_RETURN_STATEMENT",
    UNDEFINED_VARIABLE = "UNDEFINED_VARIABLE",
    VARIABLE_USED_BEFORE_DEFINED = "VARIABLE_USED_BEFORE_DEFINED",
    INVALID_VARIABLE_SCOPE = "INVALID_VARIABLE_SCOPE",
    TEMPORARY_LIFECYCLE_ERROR = "TEMPORARY_LIFECYCLE_ERROR",
    INVALID_FUNCTION_CALL = "INVALID_FUNCTION_CALL",
    PARAMETER_COUNT_MISMATCH = "PARAMETER_COUNT_MISMATCH",
    PARAMETER_TYPE_MISMATCH = "PARAMETER_TYPE_MISMATCH",
    INVALID_RETURN_TYPE = "INVALID_RETURN_TYPE",
    INVALID_REGISTER_USAGE = "INVALID_REGISTER_USAGE",
    REGISTER_CONFLICT = "REGISTER_CONFLICT",
    INVALID_ADDRESSING_MODE = "INVALID_ADDRESSING_MODE",
    TYPE_MISMATCH = "TYPE_MISMATCH",
    INVALID_TYPE_CONVERSION = "INVALID_TYPE_CONVERSION",
    STORAGE_CLASS_VIOLATION = "STORAGE_CLASS_VIOLATION"
}
/**
 * Severity levels for validation errors.
 */
export declare enum ILValidationSeverity {
    ERROR = "ERROR",// Critical error that prevents compilation
    WARNING = "WARNING",// Non-critical issue that should be addressed
    INFO = "INFO"
}
/**
 * IL validation error information.
 */
export interface ILValidationError {
    /** Error type classification */
    type: ILValidationErrorType;
    /** Error severity level */
    severity: ILValidationSeverity;
    /** Human-readable error message */
    message: string;
    /** Source location if available */
    sourceLocation?: SourcePosition;
    /** Instruction ID where error occurred */
    instructionId?: number;
    /** Function where error occurred */
    functionName?: string;
    /** Module where error occurred */
    moduleName?: string;
    /** Additional context information */
    context?: ValidationErrorContext;
}
/**
 * Additional context for validation errors.
 */
export interface ValidationErrorContext {
    /** Related instruction */
    instruction?: ILInstruction;
    /** Related operands */
    operands?: ILOperand[];
    /** Expected type or value */
    expected?: string;
    /** Actual type or value */
    actual?: string;
    /** Suggested fix */
    suggestion?: string;
}
/**
 * Result of IL validation.
 */
export interface ILValidationResult {
    /** Whether validation passed */
    isValid: boolean;
    /** All validation errors found */
    errors: ILValidationError[];
    /** Validation warnings */
    warnings: ILValidationError[];
    /** Informational messages */
    info: ILValidationError[];
    /** Validation statistics */
    statistics: ILValidationStatistics;
    /** Control flow analysis result */
    controlFlowAnalysis?: ControlFlowAnalysisResult;
}
/**
 * Validation statistics.
 */
export interface ILValidationStatistics {
    /** Total instructions validated */
    totalInstructions: number;
    /** Total functions validated */
    totalFunctions: number;
    /** Total modules validated */
    totalModules: number;
    /** Instructions by type count */
    instructionsByType: Map<ILInstructionType, number>;
    /** Variables validated */
    variablesValidated: number;
    /** Temporaries validated */
    temporariesValidated: number;
    /** Control flow paths analyzed */
    controlFlowPaths: number;
}
/**
 * Control flow analysis result.
 */
export interface ControlFlowAnalysisResult {
    /** Control flow graph */
    controlFlowGraph: ControlFlowGraph;
    /** Reachable instructions */
    reachableInstructions: Set<number>;
    /** Unreachable code blocks */
    unreachableBlocks: number[];
    /** Dead code instructions */
    deadInstructions: number[];
    /** Function has proper returns */
    hasProperReturns: boolean;
}
/**
 * Main IL validator implementation.
 * Performs comprehensive validation of IL programs for correctness.
 */
export declare class ILValidator {
    private context;
    constructor();
    /**
     * Validate a complete IL program.
     */
    validateProgram(program: ILProgram): ILValidationResult;
    /**
     * Validate a single IL module.
     */
    validateModule(module: ILModule): ILValidationResult;
    /**
     * Validate a single IL function.
     */
    validateFunction(func: ILFunction): ILValidationResult;
    private validateInstructionSequence;
    private validateInstruction;
    private validateLoadImmediate;
    private validateLoadMemory;
    private validateStoreMemory;
    private validateCopy;
    private validateArithmeticOperation;
    private validateLogicalOperation;
    private validateUnaryOperation;
    private validateBitwiseOperation;
    private validateBitwiseUnaryOperation;
    private validateShiftOperation;
    private validateComparisonOperation;
    private validateBranch;
    private validateConditionalBranch;
    private validateFunctionCall;
    private validateReturn;
    private validateDeclareLocal;
    private validateLoadVariable;
    private validateStoreVariable;
    private validateLoadArray;
    private validateStoreArray;
    private validateArrayAddress;
    private validateLabel;
    private validateNop;
    private validateComment;
    private validate6502MemoryOperation;
    private validateRegisterOperation;
    private validateFlagOperation;
    private validateOperandCount;
    private validateValueOperand;
    private validateMemoryAddress;
    private validateNumericOperand;
    private validateBooleanOperand;
    private validateIntegerOperand;
    private validateBranchTarget;
    private validate6502Hints;
    private areTypesCompatible;
    private areBlend65TypesCompatible;
    private isBooleanType;
    private isVoidType;
    private getValueTypeString;
    private addVariableDefinition;
    private validateVariableAccess;
    private createValidationContext;
    private resetFunctionContext;
    private buildFunctionLabels;
    private validateFunctionSignature;
    private validateFunctionParameters;
    private validateLocalVariables;
    private performControlFlowAnalysis;
    private analyzeReachability;
    private resolveBranchTarget;
    private validateVariableLifecycle;
    private validateGlobalData;
    private validateImportsExports;
    private validateModuleData;
    private updateInstructionStatistics;
    private addError;
    private createValidationResult;
}
/**
 * Create a new IL validator instance.
 */
export declare function createILValidator(): ILValidator;
/**
 * Validate an IL program and return detailed results.
 * Convenience function for one-shot validation.
 */
export declare function validateILProgram(program: ILProgram): ILValidationResult;
/**
 * Validate an IL module and return detailed results.
 * Convenience function for module-level validation.
 */
export declare function validateILModule(module: ILModule): ILValidationResult;
/**
 * Validate an IL function and return detailed results.
 * Convenience function for function-level validation.
 */
export declare function validateILFunction(func: ILFunction): ILValidationResult;
//# sourceMappingURL=il-validator.d.ts.map