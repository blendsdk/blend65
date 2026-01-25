/**
 * Type System - Manages all type information and type operations
 *
 * Provides:
 * - Built-in type definitions (byte, word, boolean, void, string)
 * - Type creation (arrays, callbacks)
 * - Type compatibility checking
 * - Type operation result types
 */

import { TypeInfo, TypeKind, TypeCompatibility, FunctionSignature } from './types.js';

/**
 * Type system - manages all type information and operations
 *
 * The TypeSystem provides:
 * 1. Built-in type definitions for Blend65
 * 2. Factory methods for creating complex types (arrays, callbacks)
 * 3. Type compatibility and conversion checking
 * 4. Result type computation for operators
 *
 * @example
 * ```typescript
 * const typeSystem = new TypeSystem();
 * const byteType = typeSystem.getBuiltinType('byte');
 * const arrayType = typeSystem.createArrayType(byteType, 10);
 * ```
 */
export class TypeSystem {
  /** Built-in types (byte, word, boolean, void, string) */
  protected builtinTypes: Map<string, TypeInfo>;

  /**
   * Type compatibility cache for performance
   * Uses numeric keys for faster lookup than string concatenation
   */
  protected compatibilityCache: Map<number, TypeCompatibility>;

  /**
   * Maps TypeInfo objects to unique numeric IDs for cache key generation
   * Uses type name as a stable identifier since TypeInfo instances may vary
   */
  protected typeNameIds: Map<string, number>;

  /** Next available type ID */
  protected nextTypeId: number;

  constructor() {
    this.builtinTypes = new Map();
    this.compatibilityCache = new Map();
    this.typeNameIds = new Map();
    this.nextTypeId = 0;
    this.initializeBuiltinTypes();
  }

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
   * Initialize built-in types for Blend65
   *
   * Built-in types:
   * - byte: 8-bit unsigned integer (0-255)
   * - word: 16-bit unsigned integer (0-65535)
   * - boolean: 8-bit boolean (0 = false, non-zero = true)
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

    // boolean: 8-bit boolean (0 = false, non-zero = true)
    // In 6502, boolean is just a byte with special semantics
    this.builtinTypes.set('boolean', {
      kind: TypeKind.Boolean,
      name: 'boolean',
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

  /**
   * Get a built-in type by name
   *
   * @param name - Type name ('byte', 'word', 'boolean', 'void', 'string')
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
      arraySize: size,
    };
  }

  /**
   * Create a callback/function pointer type
   *
   * @param signature - Function signature
   * @returns Callback type information
   *
   * @example
   * ```typescript
   * // (byte, word) => void
   * const callbackType = typeSystem.createCallbackType({
   *   parameters: [byteType, wordType],
   *   returnType: voidType,
   *   parameterNames: ['a', 'b'],
   * });
   * ```
   */
  public createCallbackType(signature: FunctionSignature): TypeInfo {
    // Generate human-readable name
    const paramStr = signature.parameters.map(p => p.name).join(', ');
    const name = `(${paramStr}) => ${signature.returnType.name}`;

    return {
      kind: TypeKind.Callback,
      name,
      size: 2, // Function pointer is 16-bit address
      isSigned: false,
      isAssignable: true,
      signature,
    };
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
   * - boolean ↔ byte are compatible (boolean is byte)
   * - Array types must have compatible elements and sizes
   * - Callback types must have compatible signatures
   *
   * Uses numeric cache keys for performance (faster than string concatenation).
   *
   * @param from - Source type
   * @param to - Target type
   * @returns Compatibility result
   */
  public checkCompatibility(from: TypeInfo, to: TypeInfo): TypeCompatibility {
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
    // boolean → byte (boolean is just a byte)
    else if (from.kind === TypeKind.Boolean && to.kind === TypeKind.Byte) {
      result = TypeCompatibility.Compatible;
    }
    // byte → boolean (any non-zero = true)
    else if (from.kind === TypeKind.Byte && to.kind === TypeKind.Boolean) {
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
    // Callback types must match signatures
    else if (from.kind === TypeKind.Callback && to.kind === TypeKind.Callback) {
      result = this.checkSignatureCompatibility(from.signature!, to.signature!);
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
    // Check element type compatibility
    const elementCompat = this.checkCompatibility(from.elementType!, to.elementType!);

    if (elementCompat !== TypeCompatibility.Identical) {
      // Element types must be identical for arrays
      return TypeCompatibility.Incompatible;
    }

    // Check array sizes
    // Can assign to unsized array (to.arraySize === undefined)
    // Cannot assign different sized arrays
    if (to.arraySize !== undefined && from.arraySize !== to.arraySize) {
      return TypeCompatibility.Incompatible;
    }

    return TypeCompatibility.Compatible;
  }

  /**
   * Check function signature compatibility
   *
   * Signatures are compatible if:
   * - Same number of parameters
   * - Parameter types are contravariant (target can accept more general types)
   * - Return type is covariant (source can return more specific type)
   *
   * @param from - Source signature
   * @param to - Target signature
   * @returns Compatibility result
   */
  protected checkSignatureCompatibility(
    from: FunctionSignature,
    to: FunctionSignature
  ): TypeCompatibility {
    // Must have same number of parameters
    if (from.parameters.length !== to.parameters.length) {
      return TypeCompatibility.Incompatible;
    }

    // Check parameter types (contravariant)
    // Target parameters can be more general than source
    for (let i = 0; i < from.parameters.length; i++) {
      const compat = this.checkCompatibility(to.parameters[i], from.parameters[i]);
      if (compat === TypeCompatibility.Incompatible) {
        return TypeCompatibility.Incompatible;
      }
    }

    // Check return type (covariant)
    // Source return can be more specific than target
    const returnCompat = this.checkCompatibility(from.returnType, to.returnType);
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
   * Get the result type of a binary operation
   *
   * @param left - Left operand type
   * @param right - Right operand type
   * @param operator - Binary operator
   * @returns Result type of the operation
   */
  public getBinaryOperationType(left: TypeInfo, right: TypeInfo, operator: string): TypeInfo {
    // Arithmetic operators (+, -, *, /, %)
    if (['+', '-', '*', '/', '%'].includes(operator)) {
      // word + word = word
      // word + byte = word
      // byte + word = word
      if (left.kind === TypeKind.Word || right.kind === TypeKind.Word) {
        return this.getBuiltinType('word')!;
      }
      // byte + byte = byte
      return this.getBuiltinType('byte')!;
    }

    // Comparison operators (==, !=, <, >, <=, >=)
    if (['==', '!=', '<', '>', '<=', '>='].includes(operator)) {
      return this.getBuiltinType('boolean')!;
    }

    // Logical operators (&&, ||)
    if (['&&', '||'].includes(operator)) {
      return this.getBuiltinType('boolean')!;
    }

    // Bitwise operators (&, |, ^, <<, >>)
    if (['&', '|', '^', '<<', '>>'].includes(operator)) {
      // word & word = word
      // word & byte = word (operands promoted)
      if (left.kind === TypeKind.Word || right.kind === TypeKind.Word) {
        return this.getBuiltinType('word')!;
      }
      // byte & byte = byte
      return this.getBuiltinType('byte')!;
    }

    // Unknown operator - return unknown type
    return {
      kind: TypeKind.Unknown,
      name: 'unknown',
      size: 0,
      isSigned: false,
      isAssignable: false,
    };
  }

  /**
   * Get the result type of a unary operation
   *
   * @param operand - Operand type
   * @param operator - Unary operator
   * @returns Result type of the operation
   */
  public getUnaryOperationType(operand: TypeInfo, operator: string): TypeInfo {
    // Logical NOT (!)
    if (operator === '!') {
      return this.getBuiltinType('boolean')!;
    }

    // Bitwise NOT (~)
    if (operator === '~') {
      return operand; // Same type as operand
    }

    // Negation (-)
    if (operator === '-') {
      return operand; // Same type as operand
    }

    // Address-of (@)
    if (operator === '@') {
      return this.getBuiltinType('word')!; // Address is 16-bit
    }

    // Unknown operator - return unknown type
    return {
      kind: TypeKind.Unknown,
      name: 'unknown',
      size: 0,
      isSigned: false,
      isAssignable: false,
    };
  }

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