/**
 * Type System Infrastructure for Blend65 Semantic Analysis
 * Task 1.3: Create Type System Infrastructure
 *
 * This file implements the core type checking functionality for the Blend65 compiler:
 * - Blend65 type representations and validation
 * - Type compatibility checking with 6502-specific rules
 * - Storage class validation (zp, ram, data, const, io)
 * - Array type checking with compile-time size validation
 * - Function signature type checking including callback functions
 * - Type promotion and conversion rules
 *
 * Educational Focus:
 * - How compilers implement type checking systems
 * - Type safety in 6502 assembly generation
 * - Storage class semantics for memory-mapped hardware
 * - Function type compatibility with callbacks
 */
import { SourcePosition } from '@blend65/lexer';
import type { Expression, TypeAnnotation, ArrayLiteral, FunctionDeclaration, NamedType, StorageClass } from '@blend65/ast';
import { Blend65Type, ScopeType, SemanticError, SemanticResult, Symbol } from './types.js';
/**
 * Validated function parameter with resolved types.
 */
export interface ValidatedParameter {
    name: string;
    type: Blend65Type;
    hasDefaultValue: boolean;
}
/**
 * Function signature with resolved parameter and return types.
 */
export interface FunctionSignature {
    parameters: ValidatedParameter[];
    returnType: Blend65Type;
    isCallback: boolean;
}
/**
 * Main type checking engine for Blend65.
 *
 * Educational Note:
 * - Type checking ensures program correctness before code generation
 * - Prevents runtime errors that would be difficult to debug in 6502 assembly
 * - Enforces storage class semantics for optimal memory usage
 * - Validates callback function compatibility for interrupt handlers
 */
export declare class TypeChecker {
    /** Accumulated errors during type checking */
    private errors;
    /** Current scope type for storage class validation */
    private currentScopeType;
    /** Symbol lookup function for type resolution */
    private symbolLookup;
    /**
     * Initialize type checker with symbol lookup capability.
     */
    constructor(symbolLookup: (name: string) => Symbol | null);
    /**
     * Set current scope type for storage class validation.
     */
    setCurrentScope(scopeType: ScopeType): void;
    /**
     * Get accumulated errors.
     */
    getErrors(): SemanticError[];
    /**
     * Clear accumulated errors.
     */
    clearErrors(): void;
    /**
     * Add an error to the error list.
     */
    private addError;
    /**
     * Get the addError method for validation.
     */
    getAddError(): (error: SemanticError) => void;
    /**
     * Convert AST type annotation to internal Blend65Type representation.
     *
     * Educational Note:
     * - AST types are parser output, internal types are semantic analysis input
     * - Type resolution converts string references to concrete types
     * - Array size validation ensures compile-time constants
     */
    convertASTTypeToBlend65Type(astType: TypeAnnotation, location: SourcePosition): SemanticResult<Blend65Type>;
    /**
     * Evaluate a compile-time constant expression.
     */
    private evaluateConstantExpression;
    /**
     * Resolve named type references to concrete types.
     *
     * Educational Note:
     * - Named types enable forward declarations and user-defined types
     * - Type resolution happens after symbol table construction
     * - Recursive type checking prevents infinite loops
     */
    resolveNamedType(namedType: NamedType, location: SourcePosition, visited?: Set<string>): SemanticResult<Blend65Type>;
    /**
     * Get the concrete type from a potentially named type.
     */
    getConcreteType(type: Blend65Type, location: SourcePosition): SemanticResult<Blend65Type>;
    /**
     * Check if source type can be assigned to target type.
     *
     * Educational Note:
     * - Assignment compatibility is stricter than general type compatibility
     * - Blend65 uses explicit conversions to prevent 6502 assembly errors
     * - Storage classes affect assignment compatibility
     */
    checkAssignmentCompatibility(target: Blend65Type, source: Blend65Type, location: SourcePosition): SemanticResult<void>;
    /**
     * Check specific type compatibility rules.
     */
    private checkSpecificCompatibility;
    /**
     * Check primitive type compatibility.
     */
    private checkPrimitiveCompatibility;
    /**
     * Check array type compatibility.
     */
    private checkArrayCompatibility;
    /**
     * Check callback type compatibility.
     */
    private checkCallbackCompatibility;
    /**
     * Validate storage class usage for variables.
     *
     * Educational Note:
     * - Storage classes determine memory layout in 6502 assembly
     * - 'zp' uses zero page for fastest access
     * - 'const' and 'data' require compile-time initialization
     * - 'io' represents memory-mapped hardware registers
     */
    validateVariableStorageClass(storageClass: StorageClass | null, varType: Blend65Type, hasInitializer: boolean, location: SourcePosition): SemanticResult<void>;
    /**
     * Validate storage class compatibility with type.
     */
    private validateStorageClassForType;
    /**
     * Get the size in bytes of a type.
     */
    getTypeSize(type: Blend65Type, location: SourcePosition): SemanticResult<number>;
    /**
     * Validate array access with bounds checking where possible.
     *
     * Educational Note:
     * - Compile-time bounds checking prevents 6502 memory corruption
     * - Runtime bounds checking can be added for dynamic indices
     * - Array access validation prevents buffer overflows
     */
    checkArrayAccess(arrayType: any, indexExpression: Expression, location: SourcePosition): SemanticResult<Blend65Type>;
    /**
     * Validate array literal initialization.
     */
    checkArrayLiteralType(arrayLiteral: ArrayLiteral, expectedType: any, location: SourcePosition): SemanticResult<void>;
    /**
     * Validate function signature for consistency and correctness.
     *
     * Educational Note:
     * - Function signatures define contracts between callers and callees
     * - Parameter types enable compile-time validation of function calls
     * - Return type validation ensures proper value handling
     */
    validateFunctionSignature(functionDecl: FunctionDeclaration, location: SourcePosition): SemanticResult<FunctionSignature>;
    /**
     * Validate callback function specific requirements.
     */
    private validateCallbackFunction;
    /**
     * Check function call compatibility with function signature.
     */
    checkFunctionCall(signature: FunctionSignature, argumentTypes: Blend65Type[], location: SourcePosition): SemanticResult<Blend65Type>;
    /**
     * Infer the type of an expression.
     *
     * Educational Note:
     * - Type inference determines expression types from context
     * - Enables type checking without explicit type annotations
     * - Essential for validating complex expressions
     */
    checkExpressionType(expression: Expression): SemanticResult<Blend65Type>;
    /**
     * Check identifier type by looking up in symbol table.
     */
    private checkIdentifierType;
    /**
     * Infer literal type from value.
     */
    private inferLiteralType;
    /**
     * Check binary expression type.
     */
    private checkBinaryExpressionType;
    /**
     * Check arithmetic operation type compatibility.
     */
    private checkArithmeticOperation;
    /**
     * Check comparison operation type compatibility.
     */
    private checkComparisonOperation;
    /**
     * Check logical operation type compatibility.
     */
    private checkLogicalOperation;
    /**
     * Check unary expression type.
     */
    private checkUnaryExpressionType;
    /**
     * Check call expression type.
     */
    private checkCallExpressionType;
    /**
     * Check member expression type (simplified).
     */
    private checkMemberExpressionType;
    /**
     * Check index expression type.
     */
    private checkIndexExpressionType;
    /**
     * Check array literal expression type.
     */
    private checkArrayLiteralExpressionType;
}
//# sourceMappingURL=type-system.d.ts.map