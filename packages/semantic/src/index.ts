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

// Re-export all types and utilities from types.ts
export * from './types.js';

// Re-export symbol table functionality
export * from './symbol-table.js';

// Additional convenience exports for commonly used functionality
export {
  // Core type factories
  createPrimitiveType,
  createArrayType,
  createNamedType,
  createCallbackType,

  // Symbol factories
  createVariableSymbol,
  createFunctionSymbol,
  createModuleSymbol,
  createScope,

  // Type checking utilities
  isAssignmentCompatible,
  areTypesEqual,
  areCallbackTypesCompatible,
  typeToString,
  validateStorageClassUsage,

  // Type guards
  isVariableSymbol,
  isFunctionSymbol,
  isModuleSymbol,
  isTypeSymbol,
  isEnumSymbol,
  isPrimitiveType,
  isArrayType,
  isNamedType,
  isCallbackType
} from './types.js';

// Symbol table exports
export {
  SymbolTable,
  createSymbolTable,
  validateSymbolTable,
  type SymbolTableStatistics
} from './symbol-table.js';

// Type system exports
export {
  TypeChecker,
  type ValidatedParameter,
  type FunctionSignature
} from './type-system.js';

// Variable analyzer exports
export {
  VariableAnalyzer,
  analyzeVariableDeclaration
} from './analyzers/variable-analyzer.js';

/**
 * Package version and metadata
 */
export const PACKAGE_INFO = {
  name: '@blend65/semantic',
  version: '0.1.0',
  description: 'Semantic analysis infrastructure for Blend65 compiler',
  features: [
    'Complete symbol system for Blend65 language constructs',
    'Rich type system with 6502-specific storage classes',
    'Hierarchical scope management for lexical scoping',
    'Comprehensive error reporting with source locations',
    'Type compatibility checking for safe operations',
    'Helper functions and factory methods for consistent usage'
  ]
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
