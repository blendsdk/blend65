/**
 * Type System for Blend65 Compiler v2
 *
 * Provides:
 * - Built-in type definitions (byte, word, bool, void, string)
 * - Type creation (arrays, functions)
 * - Type compatibility checking
 * - Type operation result types
 *
 * @module semantic/type-system
 */

import {
  TypeInfo,
  TypeKind,
  TypeCompatibility,
  BUILTIN_TYPES,
} from './types.js';

/**
 * Type system - manages all type information and operations
 *
 * The TypeSystem provides:
 * 1. Built-in type definitions for Blend65
 * 2. Factory methods for creating complex types (arrays, functions)
 * 3. Type compatibility and conversion checking
 * 4. Result type computation for operators
 *
 * @example
 * ```typescript
 * const typeSystem = new TypeSystem();
 * const byteType = typeSystem.getBuiltinType('byte');
 * const arrayType = typeSystem.createArrayType(byteType!, 10);
 * ```
 */
export class TypeSystem {
  /** Built-in types (byte, word, bool, void, string) */
  protected builtinTypes: Map<string, TypeInfo>;

  /**
   * Type compatibility cache for performance
   * Uses numeric keys for faster lookup than string concatenation
   */
  protected compatibilityCache: Map<number, TypeCompatibility>;

  /**
   * Maps type names to unique numeric IDs for cache key generation
   * Uses type name as a stable identifier since TypeInfo instances may vary
   */
  protected typeNameIds: Map<string, number>;

  /** Next available type ID */
  protected nextTypeId: number;

  /**
   * Create a new TypeSystem instance
   *
   * Initializes built-in types and empty caches.
   */
  constructor() {
    this.builtinTypes = new Map();
    this.compatibilityCache = new Map();
    this.typeNameIds = new Map();
    this.nextTypeId = 0;
    this.initializeBuiltinTypes();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize built-in types for Blend65
   *
   * Built-in types:
   * - byte: 8-bit unsigned integer (0-255)
   * - word: 16-bit unsigned integer (0-65535)
   * - bool: 8-bit boolean (0 = false, non-zero = true)
   * - void: no value (function return type)
   * - string: string literal (compile-time only)
   */
  protected initializeBuiltinTypes(): void {
    // byte: 8-bit unsigned integer (0-255)
    this.builtinTypes.set('byte', {
      kind: TypeKind.Byte,
      name: 'byte',
      size: 1,
      isSigned: false,
      isAssignable: true,
    });

    // word: 16-bit unsigned integer (0-65535)
    this.builtinTypes.set('word', {
      kind: TypeKind.Word,
      name: 'word',
      size: 2,
      isSigned: false,
      isAssignable: true,
    });

    // bool: 8-bit boolean (0 = false, non-zero = true)
    // In 6502, boolean is just a byte with special semantics
    this.builtinTypes.set('bool', {
      kind: TypeKind.Bool,
      name: 'bool',
      size: 1,
      isSigned: false,
      isAssignable: true,
    });

    // void: no value (function return type only)
    this.builtinTypes.set('void', {
      kind: TypeKind.Void,
      name: 'void',
      size: 0,
      isSigned: false,
      isAssignable: false,
    });

    // string: string literal (compile-time only, not a runtime type)
    this.builtinTypes.set('string', {
      kind: TypeKind.String,
      name: 'string',
      size: 0, // Variable size, determined at compile time
      isSigned: false,
      isAssignable: false, // String literals are immutable
    });
  }

  // ============================================================================
  // Built-in Type Access
  // ============================================================================

  /**
   * Get a built-in type by name
   *
   * @param name - Type name ('byte', 'word', 'bool', 'void', 'string')
   * @returns TypeInfo for the built-in type, or undefined if not found
   */
  public getBuiltinType(name: string): TypeInfo | undefined {
    return this.builtinTypes.get(name);
  }

  /**
   * Check if a type name is a built-in type
   *
   * @param name - Type name to check
   * @returns True if the name refers to a built-in type
   */
  public isBuiltinType(name: string): boolean {
    return this.builtinTypes.has(name);
  }

  /**
   * Get all built-in type names
   *
   * @returns Array of built-in type names
   */
  public getBuiltinTypeNames(): string[] {
    return Array.from(this.builtinTypes.keys());
  }

  // ============================================================================
  // Type Creation
  // ============================================================================

  /**
   * Create an array type
   *
   * @param elementType - Type of array elements
   * @param size - Array size (undefined for unsized/dynamic arrays)
   * @returns Array type information
   *
   * @example
   * ```typescript
   * // byte[10] - fixed-size array of 10 bytes
   * const fixedArray = typeSystem.createArrayType(byteType, 10);
   *
   * // byte[] - unsized array
   * const unsizedArray = typeSystem.createArrayType(byteType);
   * ```
   */
  public createArrayType(elementType: TypeInfo, size?: number): TypeInfo {
    const sizePart = size !== undefined ? `[${size}]` : '[]';
    const name = `${elementType.name}${sizePart}`;

    return {
      kind: TypeKind.Array,
      name,
      size: size !== undefined ? elementType.size * size : 0,
      isSigned: false,
      isAssignable: true,
      elementType,
      elementCount: size,
    };
  }

  /**
   * Create a function type
   *
   * @param parameterTypes - Array of parameter types (in order)
   * @param returnType - Return type of the function
   * @param parameterNames - Optional parameter names (for documentation)
   * @returns Function type information
   *
   * @example
   * ```typescript
   * // (byte, word) => void
   * const funcType = typeSystem.createFunctionType(
   *   [byteType, wordType],
   *   voidType,
   *   ['a', 'b']
   * );
   * ```
   */
  public createFunctionType(
    parameterTypes: TypeInfo[],
    returnType: TypeInfo,
    _parameterNames?: string[]
  ): TypeInfo {
    // Generate human-readable name
    const paramStr = parameterTypes.map((p) => p.name).join(', ');
    const name = `(${paramStr}) => ${returnType.name}`;

    return {
      kind: TypeKind.Function,
      name,
      size: 2, // Function pointer is 16-bit address
      isSigned: false,
      isAssignable: true,
      parameterTypes,
      returnType,
    };
  }

  /**
   * Create an enum type
   *
   * @param name - Name of the enum
   * @param members - Map of member names to their values
   * @returns Enum type information
   *
   * @example
   * ```typescript
   * const colorEnum = typeSystem.createEnumType('Color', new Map([
   *   ['Red', 0],
   *   ['Green', 1],
   *   ['Blue', 2],
   * ]));
   * ```
   */
  public createEnumType(name: string, members: Map<string, number>): TypeInfo {
    return {
      kind: TypeKind.Enum,
      name,
      size: 1, // Enums are byte-sized
      isSigned: false,
      isAssignable: true,
      enumMembers: members,
    };
  }

  // ============================================================================
  // Type Compatibility
  // ============================================================================

  /**
   * Get a unique numeric ID for a type name
   *
   * This enables efficient cache key generation using bit-packed integers
   * instead of string concatenation, which is faster for lookups.
   *
   * @param typeName - Name of the type
   * @returns Unique numeric ID for the type
   */
  protected getTypeNameId(typeName: string): number {
    let id = this.typeNameIds.get(typeName);
    if (id === undefined) {
      id = this.nextTypeId++;
      this.typeNameIds.set(typeName, id);
    }
    return id;
  }

  /**
   * Generate a cache key from two type IDs
   *
   * Uses bit packing: (fromId << 16) | toId
   * This allows up to 65,535 unique types before overflow.
   * Given Blend65's type system, this is more than sufficient.
   *
   * @param fromId - Source type ID
   * @param toId - Target type ID
   * @returns Numeric cache key
   */
  protected getCacheKey(fromId: number, toId: number): number {
    return (fromId << 16) | toId;
  }

  /**
   * Check type compatibility
   *
   * Determines if a value of type 'from' can be assigned to type 'to'.
   *
   * Rules:
   * - Identical types are identical
   * - byte → word is compatible (widening)
   * - word → byte requires explicit conversion (narrowing)
   * - bool ↔ byte are compatible (bool is byte)
   * - Array types must have compatible elements and sizes
   * - Function types must have compatible signatures
   * - Unknown type accepts anything (for compile-time intrinsics)
   *
   * Uses numeric cache keys for performance (faster than string concatenation).
   *
   * @param from - Source type
   * @param to - Target type
   * @returns Compatibility result
   */
  public checkCompatibility(from: TypeInfo, to: TypeInfo): TypeCompatibility {
    // Special case: Unknown 'any' type accepts any value
    // This is used for compile-time intrinsics like sizeof() and length()
    // that need to accept special parameter types (type names, arrays)
    if (to.kind === TypeKind.Unknown && to.name === 'any') {
      return TypeCompatibility.Compatible;
    }

    // Check cache first for performance using numeric key
    const fromId = this.getTypeNameId(from.name);
    const toId = this.getTypeNameId(to.name);
    const cacheKey = this.getCacheKey(fromId, toId);
    const cached = this.compatibilityCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    let result: TypeCompatibility;

    // Same type = identical
    if (from.kind === to.kind && from.name === to.name) {
      result = TypeCompatibility.Identical;
    }
    // byte → word (widening conversion, always safe)
    else if (from.kind === TypeKind.Byte && to.kind === TypeKind.Word) {
      result = TypeCompatibility.Compatible;
    }
    // bool → byte (bool is just a byte)
    else if (from.kind === TypeKind.Bool && to.kind === TypeKind.Byte) {
      result = TypeCompatibility.Compatible;
    }
    // byte → bool (any non-zero = true)
    else if (from.kind === TypeKind.Byte && to.kind === TypeKind.Bool) {
      result = TypeCompatibility.Compatible;
    }
    // word → byte (narrowing, requires explicit conversion)
    else if (from.kind === TypeKind.Word && to.kind === TypeKind.Byte) {
      result = TypeCompatibility.RequiresConversion;
    }
    // Array types must match element types and sizes
    else if (from.kind === TypeKind.Array && to.kind === TypeKind.Array) {
      result = this.checkArrayCompatibility(from, to);
    }
    // Function types must match signatures
    else if (from.kind === TypeKind.Function && to.kind === TypeKind.Function) {
      result = this.checkFunctionCompatibility(from, to);
    }
    // Everything else is incompatible
    else {
      result = TypeCompatibility.Incompatible;
    }

    // Cache the result
    this.compatibilityCache.set(cacheKey, result);
    return result;
  }

  /**
   * Check array type compatibility
   *
   * Arrays are compatible if:
   * - Element types are compatible
   * - Sizes match (or target is unsized)
   *
   * @param from - Source array type
   * @param to - Target array type
   * @returns Compatibility result
   */
  protected checkArrayCompatibility(from: TypeInfo, to: TypeInfo): TypeCompatibility {
    // Both must have element types
    if (!from.elementType || !to.elementType) {
      return TypeCompatibility.Incompatible;
    }

    // Check element type compatibility
    const elementCompat = this.checkCompatibility(from.elementType, to.elementType);

    if (elementCompat !== TypeCompatibility.Identical) {
      // Element types must be identical for arrays
      return TypeCompatibility.Incompatible;
    }

    // Check array sizes
    // Can assign to unsized array (to.elementCount === undefined)
    // Cannot assign different sized arrays
    if (to.elementCount !== undefined && from.elementCount !== to.elementCount) {
      return TypeCompatibility.Incompatible;
    }

    return TypeCompatibility.Compatible;
  }

  /**
   * Check function type compatibility
   *
   * Functions are compatible if:
   * - Same number of parameters
   * - Parameter types are contravariant (target can accept more general types)
   * - Return type is covariant (source can return more specific type)
   *
   * @param from - Source function type
   * @param to - Target function type
   * @returns Compatibility result
   */
  protected checkFunctionCompatibility(from: TypeInfo, to: TypeInfo): TypeCompatibility {
    const fromParams = from.parameterTypes || [];
    const toParams = to.parameterTypes || [];

    // Must have same number of parameters
    if (fromParams.length !== toParams.length) {
      return TypeCompatibility.Incompatible;
    }

    // Check parameter types (contravariant)
    // Target parameters can be more general than source
    for (let i = 0; i < fromParams.length; i++) {
      const compat = this.checkCompatibility(toParams[i], fromParams[i]);
      if (compat === TypeCompatibility.Incompatible) {
        return TypeCompatibility.Incompatible;
      }
    }

    // Check return type (covariant)
    // Source return can be more specific than target
    const fromReturn = from.returnType || BUILTIN_TYPES.VOID;
    const toReturn = to.returnType || BUILTIN_TYPES.VOID;
    const returnCompat = this.checkCompatibility(fromReturn, toReturn);
    if (returnCompat === TypeCompatibility.Incompatible) {
      return TypeCompatibility.Incompatible;
    }

    return TypeCompatibility.Compatible;
  }

  /**
   * Check if a value of type 'from' can be assigned to type 'to'
   *
   * @param from - Source type
   * @param to - Target type
   * @returns True if assignment is allowed without explicit conversion
   */
  public canAssign(from: TypeInfo, to: TypeInfo): boolean {
    const compat = this.checkCompatibility(from, to);
    return compat === TypeCompatibility.Identical || compat === TypeCompatibility.Compatible;
  }

  /**
   * Check if types are equal
   *
   * @param a - First type
   * @param b - Second type
   * @returns True if types are identical
   */
  public areTypesEqual(a: TypeInfo, b: TypeInfo): boolean {
    return this.checkCompatibility(a, b) === TypeCompatibility.Identical;
  }

  // ============================================================================
  // Operator Type Resolution
  // ============================================================================

  /**
   * Get the result type of a binary operation
   *
   * @param left - Left operand type
   * @param right - Right operand type
   * @param operator - Binary operator
   * @returns Result type of the operation, or undefined if invalid
   */
  public getBinaryOperationType(
    left: TypeInfo,
    right: TypeInfo,
    operator: string
  ): TypeInfo | undefined {
    // Arithmetic operators (+, -, *, /, %)
    if (['+', '-', '*', '/', '%'].includes(operator)) {
      // Must be numeric types
      if (!this.isNumericType(left) || !this.isNumericType(right)) {
        return undefined;
      }
      // word + word = word
      // word + byte = word
      // byte + word = word
      if (left.kind === TypeKind.Word || right.kind === TypeKind.Word) {
        return this.getBuiltinType('word');
      }
      // byte + byte = byte
      return this.getBuiltinType('byte');
    }

    // Comparison operators (==, !=, <, >, <=, >=)
    if (['==', '!=', '<', '>', '<=', '>='].includes(operator)) {
      // Result is always bool
      return this.getBuiltinType('bool');
    }

    // Logical operators (&&, ||)
    if (['&&', '||'].includes(operator)) {
      // Operands should be bool-like (byte or bool)
      return this.getBuiltinType('bool');
    }

    // Bitwise operators (&, |, ^, <<, >>)
    if (['&', '|', '^', '<<', '>>'].includes(operator)) {
      // Must be numeric types
      if (!this.isNumericType(left) || !this.isNumericType(right)) {
        return undefined;
      }
      // word & word = word
      // word & byte = word (operands promoted)
      if (left.kind === TypeKind.Word || right.kind === TypeKind.Word) {
        return this.getBuiltinType('word');
      }
      // byte & byte = byte
      return this.getBuiltinType('byte');
    }

    // Assignment operators (=, +=, -=, etc.)
    if (['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='].includes(operator)) {
      // Result is the type of the left operand
      return left;
    }

    // Unknown operator
    return undefined;
  }

  /**
   * Get the result type of a unary operation
   *
   * @param operand - Operand type
   * @param operator - Unary operator
   * @returns Result type of the operation, or undefined if invalid
   */
  public getUnaryOperationType(operand: TypeInfo, operator: string): TypeInfo | undefined {
    // Logical NOT (!)
    if (operator === '!') {
      return this.getBuiltinType('bool');
    }

    // Bitwise NOT (~)
    if (operator === '~') {
      // Must be numeric
      if (!this.isNumericType(operand)) {
        return undefined;
      }
      return operand; // Same type as operand
    }

    // Negation (-)
    if (operator === '-') {
      // Must be numeric
      if (!this.isNumericType(operand)) {
        return undefined;
      }
      return operand; // Same type as operand
    }

    // Unary plus (+)
    if (operator === '+') {
      // Must be numeric
      if (!this.isNumericType(operand)) {
        return undefined;
      }
      return operand; // Same type as operand
    }

    // Address-of (@)
    if (operator === '@') {
      return this.getBuiltinType('word'); // Address is 16-bit
    }

    // Prefix/postfix increment (++)
    if (operator === '++') {
      // Must be numeric
      if (!this.isNumericType(operand)) {
        return undefined;
      }
      return operand; // Same type as operand
    }

    // Prefix/postfix decrement (--)
    if (operator === '--') {
      // Must be numeric
      if (!this.isNumericType(operand)) {
        return undefined;
      }
      return operand; // Same type as operand
    }

    // Unknown operator
    return undefined;
  }

  // ============================================================================
  // Type Predicates
  // ============================================================================

  /**
   * Check if a type is numeric (byte or word)
   *
   * @param type - Type to check
   * @returns True if the type is byte or word
   */
  public isNumericType(type: TypeInfo): boolean {
    return type.kind === TypeKind.Byte || type.kind === TypeKind.Word;
  }

  /**
   * Check if a type is an integer type (byte, word, or bool)
   *
   * @param type - Type to check
   * @returns True if the type is byte, word, or bool
   */
  public isIntegerType(type: TypeInfo): boolean {
    return type.kind === TypeKind.Byte || type.kind === TypeKind.Word || type.kind === TypeKind.Bool;
  }

  /**
   * Check if a type is an array type
   *
   * @param type - Type to check
   * @returns True if the type is an array
   */
  public isArrayType(type: TypeInfo): boolean {
    return type.kind === TypeKind.Array;
  }

  /**
   * Check if a type is a function type
   *
   * @param type - Type to check
   * @returns True if the type is a function
   */
  public isFunctionType(type: TypeInfo): boolean {
    return type.kind === TypeKind.Function;
  }

  /**
   * Check if a type is void
   *
   * @param type - Type to check
   * @returns True if the type is void
   */
  public isVoidType(type: TypeInfo): boolean {
    return type.kind === TypeKind.Void;
  }

  /**
   * Check if a type is unknown
   *
   * @param type - Type to check
   * @returns True if the type is unknown
   */
  public isUnknownType(type: TypeInfo): boolean {
    return type.kind === TypeKind.Unknown;
  }

  // ============================================================================
  // Type Utilities
  // ============================================================================

  /**
   * Get the element type of an array type
   *
   * @param type - Array type
   * @returns Element type, or undefined if not an array
   */
  public getArrayElementType(type: TypeInfo): TypeInfo | undefined {
    if (type.kind !== TypeKind.Array) {
      return undefined;
    }
    return type.elementType;
  }

  /**
   * Get the size of an array type
   *
   * @param type - Array type
   * @returns Array size, or undefined if unsized or not an array
   */
  public getArraySize(type: TypeInfo): number | undefined {
    if (type.kind !== TypeKind.Array) {
      return undefined;
    }
    return type.elementCount;
  }

  /**
   * Get the return type of a function type
   *
   * @param type - Function type
   * @returns Return type, or undefined if not a function
   */
  public getFunctionReturnType(type: TypeInfo): TypeInfo | undefined {
    if (type.kind !== TypeKind.Function) {
      return undefined;
    }
    return type.returnType;
  }

  /**
   * Get the parameter types of a function type
   *
   * @param type - Function type
   * @returns Array of parameter types, or undefined if not a function
   */
  public getFunctionParameterTypes(type: TypeInfo): TypeInfo[] | undefined {
    if (type.kind !== TypeKind.Function) {
      return undefined;
    }
    return type.parameterTypes;
  }

  /**
   * Get a human-readable description of a type
   *
   * @param type - Type to describe
   * @returns Human-readable type name
   */
  public getTypeDescription(type: TypeInfo): string {
    return type.name;
  }

  /**
   * Get the size in bytes of a type
   *
   * @param type - Type to get size of
   * @returns Size in bytes
   */
  public getTypeSize(type: TypeInfo): number {
    return type.size;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear compatibility cache (useful for testing)
   *
   * Also clears the type name ID mappings to ensure a fresh state.
   */
  public clearCache(): void {
    this.compatibilityCache.clear();
    this.typeNameIds.clear();
    this.nextTypeId = 0;
  }
}