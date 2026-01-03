/**
 * Semantic Analysis Infrastructure - Core Types and Interfaces
 * Task 1.1: Create Semantic Analysis Infrastructure
 *
 * This file defines the foundational types for the Blend65 semantic analyzer:
 * - Symbol system for tracking variables, functions, modules, types, enums
 * - Type system with Blend65's unique storage classes
 * - Scope hierarchy for lexical scoping
 * - Error reporting with rich source location information
 * - Type compatibility checking utilities
 *
 * Educational Focus:
 * - How compilers represent program symbols internally
 * - Type system design for 6502 development
 * - Lexical scoping and symbol resolution
 * - Compiler error reporting best practices
 */

import { SourcePosition } from '@blend65/lexer';
import type { Expression, TypeAnnotation } from '@blend65/ast';

// ============================================================================
// PHASE 1: CORE SYMBOL SYSTEM
// ============================================================================

/**
 * Base interface for all symbols in the Blend65 symbol table.
 * Every symbol (variable, function, type, etc.) implements this interface.
 *
 * Educational Note:
 * - Symbols are the compiler's internal representation of named entities
 * - Source location tracking enables precise error reporting
 * - Scope tracking enables proper variable resolution
 */
export interface Symbol {
  /** The name of the symbol (e.g., "playerX", "updatePlayer") */
  name: string;

  /** What kind of symbol this is (variable, function, etc.) */
  symbolType: SymbolType;

  /** Where this symbol was defined in the source code */
  sourceLocation: SourcePosition;

  /** Which scope owns this symbol */
  scope: Scope;

  /** Whether this symbol is exported from its module */
  isExported: boolean;
}

/**
 * Discriminator for different symbol types.
 * Used for TypeScript discriminated unions and type checking.
 */
export type SymbolType = 'Variable' | 'Function' | 'Module' | 'Type' | 'Enum';

/**
 * Variable symbol - represents Blend65 variable declarations.
 *
 * Examples:
 * - var counter: byte = 0
 * - zp var playerX: byte
 * - data var palette: byte[16] = [...]
 *
 * Educational Note:
 * - Storage classes are unique to Blend65 for 6502 memory management
 * - Initial values must be compile-time constants for 'data' and 'const'
 */
export interface VariableSymbol extends Symbol {
  symbolType: 'Variable';

  /** The type of the variable (byte, word, boolean, array, etc.) */
  varType: Blend65Type;

  /** Storage class for memory allocation (zp, ram, data, const, io) */
  storageClass: StorageClass | null;

  /** Initial value expression (if provided) */
  initialValue: Expression | null;

  /** Whether this is a local variable (function parameter or local declaration) */
  isLocal: boolean;
}

/**
 * Function symbol - represents Blend65 function declarations.
 *
 * Examples:
 * - function add(a: byte, b: byte): byte
 * - callback function onInterrupt(): void
 *
 * Educational Note:
 * - Callback functions can be assigned to callback variables
 * - Parameter types enable function call validation
 */
export interface FunctionSymbol extends Symbol {
  symbolType: 'Function';

  /** Function parameters with names and types */
  parameters: ParameterInfo[];

  /** Return type (void for no return) */
  returnType: Blend65Type;

  /** Whether this is a callback function */
  isCallback: boolean;
}

/**
 * Module symbol - represents Blend65 module declarations.
 *
 * Examples:
 * - module Game.Main
 * - module c64.sprites
 *
 * Educational Note:
 * - Modules organize code and provide namespace isolation
 * - Qualified names enable hierarchical organization
 */
export interface ModuleSymbol extends Symbol {
  symbolType: 'Module';

  /** Qualified module name parts (e.g., ["Game", "Main"]) */
  qualifiedName: string[];

  /** Symbols exported by this module */
  exports: Map<string, Symbol>;

  /** Modules imported by this module */
  imports: Map<string, ImportInfo>;
}

/**
 * Type symbol - represents Blend65 type declarations.
 *
 * Examples:
 * - type Player extends HasPos ... end type
 * - type Color ... end type
 *
 * Educational Note:
 * - User-defined types for structured data
 * - Inheritance through 'extends' keyword
 */
export interface TypeSymbol extends Symbol {
  symbolType: 'Type';

  /** The actual type definition */
  typeDefinition: Blend65Type;

  /** Base types this type extends */
  extends: Blend65Type[];

  /** Fields in this type */
  fields: TypeFieldInfo[];
}

/**
 * Enum symbol - represents Blend65 enum declarations.
 *
 * Examples:
 * - enum GameState MENU = 1, PLAYING, PAUSED end enum
 * - enum Color RED = 2, GREEN, BLUE = 8 end enum
 *
 * Educational Note:
 * - Enums provide named constants with auto-increment
 * - Useful for state machines and configuration
 */
export interface EnumSymbol extends Symbol {
  symbolType: 'Enum';

  /** Enum members with names and values */
  members: Map<string, EnumMemberInfo>;

  /** The underlying type (usually byte) */
  underlyingType: Blend65Type;
}

// ============================================================================
// PHASE 2: BLEND65 TYPE SYSTEM
// ============================================================================

/**
 * Union type for all types in the Blend65 type system.
 *
 * Educational Note:
 * - Type systems enable compile-time error detection
 * - Different type kinds require different validation rules
 */
export type Blend65Type =
  | PrimitiveType
  | ArrayType
  | NamedType
  | CallbackType;

/**
 * Primitive types built into Blend65.
 *
 * Educational Note:
 * - byte: 8-bit value (0-255), most common 6502 type
 * - word: 16-bit value (0-65535), for addresses and larger values
 * - boolean: true/false, stored as byte
 * - void: no value, only valid for function returns
 * - callback: function pointer type
 */
export interface PrimitiveType {
  kind: 'primitive';
  name: 'byte' | 'word' | 'boolean' | 'void' | 'callback';
}

/**
 * Array type with compile-time size.
 *
 * Examples:
 * - byte[256] (256-byte array)
 * - word[100] (100-word array)
 *
 * Educational Note:
 * - Array sizes must be compile-time constants for 6502
 * - No dynamic arrays in v0.1 (planned for future versions)
 */
export interface ArrayType {
  kind: 'array';
  elementType: Blend65Type;
  size: number; // Must be compile-time constant
}

/**
 * Named type reference (user-defined types).
 *
 * Examples:
 * - Player (references a type declaration)
 * - Color (references an enum)
 *
 * Educational Note:
 * - References are resolved during semantic analysis
 * - Enables forward declarations and recursive types
 */
export interface NamedType {
  kind: 'named';
  name: string;
  resolvedType?: Blend65Type; // Filled in during analysis
}

/**
 * Callback type for function pointers.
 *
 * Examples:
 * - callback: void (no parameters, no return)
 * - callback(byte, byte): word (two byte params, word return)
 *
 * Educational Note:
 * - Enables function pointers and interrupt handlers
 * - Type-safe function assignments
 */
export interface CallbackType {
  kind: 'callback';
  parameterTypes: Blend65Type[];
  returnType: Blend65Type;
}

/**
 * Storage classes for Blend65 variables.
 * Each class maps to different 6502 memory regions.
 *
 * Educational Note:
 * - zp: Zero page ($00-$FF), fastest access, limited space
 * - ram: General RAM, normal access speed
 * - data: Pre-initialized data, compile-time constants
 * - const: Read-only constants, often in ROM
 * - io: Memory-mapped I/O, hardware registers
 */
export type StorageClass = 'zp' | 'ram' | 'data' | 'const' | 'io';

// ============================================================================
// PHASE 3: SCOPE HIERARCHY SYSTEM
// ============================================================================

/**
 * Represents a lexical scope in the Blend65 program.
 * Scopes form a tree structure with nested visibility rules.
 *
 * Educational Note:
 * - Lexical scoping: inner scopes can access outer scope symbols
 * - Symbol resolution walks up the scope chain
 * - Each scope type has different rules
 */
export interface Scope {
  /** What kind of scope this is */
  scopeType: ScopeType;

  /** Parent scope (null for global scope) */
  parent: Scope | null;

  /** Symbols defined directly in this scope */
  symbols: Map<string, Symbol>;

  /** Child scopes contained within this scope */
  children: Scope[];

  /** Optional name for debugging (function name, module name, etc.) */
  name?: string;
}

/**
 * Different types of scopes in Blend65.
 *
 * Educational Note:
 * - Global: Top-level scope, contains all modules
 * - Module: Module scope, contains module's declarations
 * - Function: Function scope, contains parameters and local variables
 * - Block: Block scope, contains local variables within blocks
 */
export type ScopeType = 'Global' | 'Module' | 'Function' | 'Block';

// ============================================================================
// PHASE 4: ERROR REPORTING SYSTEM
// ============================================================================

/**
 * Represents a semantic error found during analysis.
 *
 * Educational Note:
 * - Rich error information helps developers fix problems quickly
 * - Source location enables IDE integration and precise error highlighting
 * - Suggestions provide actionable guidance
 */
export interface SemanticError {
  /** What category of error this is */
  errorType: SemanticErrorType;

  /** Human-readable error message */
  message: string;

  /** Where the error occurred in the source code */
  location: SourcePosition;

  /** Optional suggestions for fixing the error */
  suggestions?: string[];

  /** Related errors (for complex multi-part errors) */
  relatedErrors?: SemanticError[];
}

/**
 * Categories of semantic errors.
 *
 * Educational Note:
 * - Different error types enable different error recovery strategies
 * - IDE tooling can provide different icons/colors per error type
 * - Error categories help with compiler debugging
 */
export type SemanticErrorType =
  | 'UndefinedSymbol'      // Using a symbol that doesn't exist
  | 'DuplicateSymbol'      // Defining a symbol that already exists
  | 'TypeMismatch'         // Type incompatibility (e.g., assigning string to byte)
  | 'InvalidStorageClass'  // Invalid storage class usage
  | 'ImportNotFound'       // Imported symbol doesn't exist
  | 'ExportNotFound'       // Exported symbol doesn't exist
  | 'InvalidScope'         // Symbol used in wrong scope
  | 'ConstantRequired'     // Compile-time constant required
  | 'CallbackMismatch'     // Callback function signature mismatch
  | 'ArrayBounds'          // Array access out of bounds
  | 'InvalidOperation'     // Invalid operation for type
  | 'CircularDependency';  // Circular module dependencies

/**
 * Result type for operations that can fail with semantic errors.
 *
 * Educational Note:
 * - Result types make error handling explicit and type-safe
 * - Prevents accidentally ignoring errors
 * - Enables compiler phases to continue after non-fatal errors
 */
export type SemanticResult<T> = {
  success: true;
  data: T;
  warnings?: SemanticError[];
} | {
  success: false;
  errors: SemanticError[];
  warnings?: SemanticError[];
};

// ============================================================================
// HELPER TYPES AND INTERFACES
// ============================================================================

/**
 * Information about a function parameter.
 */
export interface ParameterInfo {
  name: string;
  type: Blend65Type;
  optional: boolean;
  defaultValue: Expression | null;
}

/**
 * Information about a type field.
 */
export interface TypeFieldInfo {
  name: string;
  type: Blend65Type;
  optional: boolean;
}

/**
 * Information about an enum member.
 */
export interface EnumMemberInfo {
  name: string;
  value: number; // Computed value
  explicitValue: Expression | null; // Original expression if provided
}

/**
 * Information about an import.
 */
export interface ImportInfo {
  /** Name imported from the module */
  importedName: string;

  /** Local name (same as imported if no alias) */
  localName: string;

  /** Source module qualified name */
  sourceModule: string[];

  /** Resolved symbol (filled during analysis) */
  resolvedSymbol?: Symbol;
}

// ============================================================================
// PHASE 5: UTILITY FUNCTIONS AND TYPE GUARDS
// ============================================================================

/**
 * Type guard functions for symbol types.
 * Enables safe type narrowing in TypeScript.
 */
export function isVariableSymbol(symbol: Symbol): symbol is VariableSymbol {
  return symbol.symbolType === 'Variable';
}

export function isFunctionSymbol(symbol: Symbol): symbol is FunctionSymbol {
  return symbol.symbolType === 'Function';
}

export function isModuleSymbol(symbol: Symbol): symbol is ModuleSymbol {
  return symbol.symbolType === 'Module';
}

export function isTypeSymbol(symbol: Symbol): symbol is TypeSymbol {
  return symbol.symbolType === 'Type';
}

export function isEnumSymbol(symbol: Symbol): symbol is EnumSymbol {
  return symbol.symbolType === 'Enum';
}

/**
 * Type guard functions for Blend65 types.
 */
export function isPrimitiveType(type: Blend65Type): type is PrimitiveType {
  return type.kind === 'primitive';
}

export function isArrayType(type: Blend65Type): type is ArrayType {
  return type.kind === 'array';
}

export function isNamedType(type: Blend65Type): type is NamedType {
  return type.kind === 'named';
}

export function isCallbackType(type: Blend65Type): type is CallbackType {
  return type.kind === 'callback';
}

/**
 * Helper functions for creating common types.
 *
 * Educational Note:
 * - Factory functions provide consistent type creation
 * - Reduces boilerplate and potential errors
 * - Centralized type creation for easy modification
 */
export function createPrimitiveType(name: PrimitiveType['name']): PrimitiveType {
  return { kind: 'primitive', name };
}

export function createArrayType(elementType: Blend65Type, size: number): ArrayType {
  return { kind: 'array', elementType, size };
}

export function createNamedType(name: string): NamedType {
  return { kind: 'named', name };
}

export function createCallbackType(parameterTypes: Blend65Type[], returnType: Blend65Type): CallbackType {
  return { kind: 'callback', parameterTypes, returnType };
}

/**
 * Type compatibility checking functions.
 *
 * Educational Note:
 * - Assignment compatibility: can we assign source to target?
 * - Type equality: are two types exactly the same?
 * - Implicit conversion: can we automatically convert between types?
 */

/**
 * Check if a source type can be assigned to a target type.
 *
 * Rules:
 * - Same types are always compatible
 * - byte/word are NOT implicitly compatible (explicit in 6502 code)
 * - Arrays must have same element type and size
 * - Callbacks must have same signature
 * - Named types require resolution
 */
export function isAssignmentCompatible(target: Blend65Type, source: Blend65Type): boolean {
  // Same type is always compatible
  if (areTypesEqual(target, source)) {
    return true;
  }

  // Primitive type compatibility
  if (isPrimitiveType(target) && isPrimitiveType(source)) {
    // byte and word are NOT implicitly compatible in Blend65
    // This forces explicit conversions, making 6502 code clearer
    return false;
  }

  // Array type compatibility
  if (isArrayType(target) && isArrayType(source)) {
    return target.size === source.size &&
           isAssignmentCompatible(target.elementType, source.elementType);
  }

  // Callback type compatibility
  if (isCallbackType(target) && isCallbackType(source)) {
    return areCallbackTypesCompatible(target, source);
  }

  // Named types require resolution (handled in semantic analyzer)
  if (isNamedType(target) || isNamedType(source)) {
    // This will be handled by the semantic analyzer after type resolution
    return false; // Conservative approach for now
  }

  return false;
}

/**
 * Check if two types are exactly equal.
 */
export function areTypesEqual(type1: Blend65Type, type2: Blend65Type): boolean {
  if (type1.kind !== type2.kind) {
    return false;
  }

  switch (type1.kind) {
    case 'primitive':
      return type1.name === (type2 as PrimitiveType).name;

    case 'array':
      const array2 = type2 as ArrayType;
      return type1.size === array2.size &&
             areTypesEqual(type1.elementType, array2.elementType);

    case 'named':
      return type1.name === (type2 as NamedType).name;

    case 'callback':
      return areCallbackTypesCompatible(type1, type2 as CallbackType);

    default:
      return false;
  }
}

/**
 * Check if two callback types are compatible.
 * Callback types are compatible if they have the same signature.
 */
export function areCallbackTypesCompatible(callback1: CallbackType, callback2: CallbackType): boolean {
  // Same return type
  if (!areTypesEqual(callback1.returnType, callback2.returnType)) {
    return false;
  }

  // Same number of parameters
  if (callback1.parameterTypes.length !== callback2.parameterTypes.length) {
    return false;
  }

  // All parameter types match
  for (let i = 0; i < callback1.parameterTypes.length; i++) {
    if (!areTypesEqual(callback1.parameterTypes[i], callback2.parameterTypes[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Get a human-readable string representation of a type.
 * Useful for error messages and debugging.
 */
export function typeToString(type: Blend65Type): string {
  switch (type.kind) {
    case 'primitive':
      return type.name;

    case 'array':
      return `${typeToString(type.elementType)}[${type.size}]`;

    case 'named':
      return type.name;

    case 'callback':
      const params = type.parameterTypes.map(t => typeToString(t)).join(', ');
      const returnStr = type.returnType.kind === 'primitive' && type.returnType.name === 'void'
        ? '' : `: ${typeToString(type.returnType)}`;
      return `callback(${params})${returnStr}`;

    default:
      return 'unknown';
  }
}

/**
 * Validate storage class usage.
 * Different storage classes have different constraints.
 */
export function validateStorageClassUsage(
  storageClass: StorageClass,
  scope: ScopeType,
  hasInitializer: boolean
): SemanticResult<void> {

  // Storage classes only allowed at global/module scope
  if (scope === 'Function' || scope === 'Block') {
    return {
      success: false,
      errors: [{
        errorType: 'InvalidStorageClass',
        message: `Storage class '${storageClass}' not allowed in ${scope.toLowerCase()} scope. Storage classes are only valid for global variables.`,
        location: { line: 0, column: 0, offset: 0 }, // Will be filled by caller
        suggestions: [
          'Remove the storage class to create a local variable',
          'Move the variable declaration to module level to use storage classes'
        ]
      }]
    };
  }

  // 'const' and 'data' require initializers
  if ((storageClass === 'const' || storageClass === 'data') && !hasInitializer) {
    return {
      success: false,
      errors: [{
        errorType: 'ConstantRequired',
        message: `Variables with '${storageClass}' storage class must have an initializer.`,
        location: { line: 0, column: 0, offset: 0 },
        suggestions: [
          `Add an initializer: var name: type = value`,
          `Use 'ram' or 'zp' storage class for uninitialized variables`
        ]
      }]
    };
  }

  // 'io' variables cannot have initializers
  if (storageClass === 'io' && hasInitializer) {
    return {
      success: false,
      errors: [{
        errorType: 'InvalidStorageClass',
        message: `Variables with 'io' storage class cannot have initializers. They represent memory-mapped hardware registers.`,
        location: { line: 0, column: 0, offset: 0 },
        suggestions: [
          'Remove the initializer for io variables',
          'Use a different storage class if you need initialization'
        ]
      }]
    };
  }

  return { success: true, data: undefined };
}

// ============================================================================
// SYMBOL CREATION HELPER FUNCTIONS
// ============================================================================

/**
 * Helper functions for creating symbols with proper defaults.
 * These will be used by the semantic analyzer to create symbols consistently.
 */

export function createVariableSymbol(
  name: string,
  varType: Blend65Type,
  scope: Scope,
  location: SourcePosition,
  options: {
    storageClass?: StorageClass;
    initialValue?: Expression;
    isExported?: boolean;
    isLocal?: boolean;
  } = {}
): VariableSymbol {
  return {
    name,
    symbolType: 'Variable',
    sourceLocation: location,
    scope,
    isExported: options.isExported ?? false,
    varType,
    storageClass: options.storageClass ?? null,
    initialValue: options.initialValue ?? null,
    isLocal: options.isLocal ?? false
  };
}

export function createFunctionSymbol(
  name: string,
  parameters: ParameterInfo[],
  returnType: Blend65Type,
  scope: Scope,
  location: SourcePosition,
  options: {
    isCallback?: boolean;
    isExported?: boolean;
  } = {}
): FunctionSymbol {
  return {
    name,
    symbolType: 'Function',
    sourceLocation: location,
    scope,
    isExported: options.isExported ?? false,
    parameters,
    returnType,
    isCallback: options.isCallback ?? false
  };
}

export function createModuleSymbol(
  name: string,
  qualifiedName: string[],
  scope: Scope,
  location: SourcePosition
): ModuleSymbol {
  return {
    name,
    symbolType: 'Module',
    sourceLocation: location,
    scope,
    isExported: false, // Modules themselves are not exported
    qualifiedName,
    exports: new Map(),
    imports: new Map()
  };
}

export function createScope(
  scopeType: ScopeType,
  parent: Scope | null = null,
  name?: string
): Scope {
  return {
    scopeType,
    parent,
    symbols: new Map(),
    children: [],
    name
  };
}

// ============================================================================
// EXPORTS FOR SEMANTIC ANALYZER
// ============================================================================

/**
 * Main exports for use by other packages.
 * This is the public API of the semantic analysis infrastructure.
 *
 * Note: All types are already exported individually where they are defined.
 * This section serves as documentation of the complete API.
 */

/**
 * Summary of what we've built:
 *
 * 1. Complete symbol system for all Blend65 constructs
 * 2. Rich type system with 6502-specific storage classes
 * 3. Hierarchical scope management for lexical scoping
 * 4. Comprehensive error reporting with source locations
 * 5. Type compatibility checking for safe operations
 * 6. Helper functions and factory methods for consistent usage
 *
 * This foundation enables:
 * - Task 1.2: Symbol table implementation
 * - Task 1.3: Type system implementation
 * - Task 1.4+: All semantic analysis phases
 * - Eventually: Complete compilation to 6502 assembly
 *
 * The educational journey continues with implementing the semantic analyzer
 * that uses these types to validate real Blend65 programs!
 */
