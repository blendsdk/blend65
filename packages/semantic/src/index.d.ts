/**
 * Semantic Analysis Package for Blend65
 * Task 1.1: Create Semantic Analysis Infrastructure
 *
 * This package provides the foundational types and utilities for semantic analysis
 * of Blend65 programs, including symbol management, type checking, scope resolution,
 * and error reporting.
 *
 * Main exports:
 * - Symbol system for tracking variables, functions, modules, types, enums
 * - Type system with 6502-specific storage classes
 * - Scope hierarchy for lexical scoping
 * - Error reporting with rich source location information
 * - Type compatibility checking utilities
 * - Factory functions for creating symbols and types
 * - Type guards for safe type narrowing
 */
export * from './types.js';
export * from './symbol-table.js';
export { createPrimitiveType, createArrayType, createNamedType, createCallbackType, createVariableSymbol, createFunctionSymbol, createModuleSymbol, createScope, isAssignmentCompatible, areTypesEqual, areCallbackTypesCompatible, typeToString, validateStorageClassUsage, isVariableSymbol, isFunctionSymbol, isModuleSymbol, isTypeSymbol, isEnumSymbol, isPrimitiveType, isArrayType, isNamedType, isCallbackType, } from './types.js';
export { SymbolTable, createSymbolTable, validateSymbolTable, type SymbolTableStatistics, } from './symbol-table.js';
export { TypeChecker, type ValidatedParameter, type FunctionSignature } from './type-system.js';
export { VariableAnalyzer, analyzeVariableDeclaration } from './analyzers/variable-analyzer.js';
export { FunctionAnalyzer } from './analyzers/function-analyzer.js';
export { ModuleAnalyzer } from './analyzers/module-analyzer.js';
export { SemanticAnalyzer, analyzeProgram, analyzePrograms } from './semantic-analyzer.js';
/**
 * Package version and metadata
 */
export declare const PACKAGE_INFO: {
    name: string;
    version: string;
    description: string;
    features: string[];
};
/**
 * Educational summary of what this package provides:
 *
 * 1. SYMBOL SYSTEM
 *    - VariableSymbol: Tracks variables with storage classes (zp, ram, data, const, io)
 *    - FunctionSymbol: Tracks functions including callback functions
 *    - ModuleSymbol: Tracks modules with import/export information
 *    - TypeSymbol: Tracks user-defined types
 *    - EnumSymbol: Tracks enumeration types
 *
 * 2. TYPE SYSTEM
 *    - PrimitiveType: byte, word, boolean, void, callback
 *    - ArrayType: Fixed-size arrays with compile-time bounds
 *    - NamedType: References to user-defined types
 *    - CallbackType: Function pointer types with type-safe signatures
 *    - StorageClass: 6502-specific memory allocation (zp, ram, data, const, io)
 *
 * 3. SCOPE SYSTEM
 *    - Hierarchical scope management (Global → Module → Function → Block)
 *    - Symbol resolution with proper lexical scoping rules
 *    - Parent-child scope relationships
 *
 * 4. ERROR SYSTEM
 *    - Rich semantic error types with source location information
 *    - Helpful error messages with suggestions
 *    - Result types for explicit error handling
 *
 * 5. UTILITIES
 *    - Type compatibility checking (assignment, equality, callback compatibility)
 *    - Type string representation for debugging
 *    - Storage class validation with 6502-specific rules
 *    - Factory functions for consistent object creation
 *    - Type guards for safe TypeScript type narrowing
 *
 * This foundation enables the complete semantic analyzer implementation for Blend65,
 * providing the building blocks for symbol table management, type checking, scope
 * resolution, and error reporting in a 6502-targeted compiler.
 */
//# sourceMappingURL=index.d.ts.map