/**
 * IL Type System
 *
 * Defines the type representations used in the Intermediate Language.
 * These types mirror the Blend65 type system but are optimized for
 * IL generation and code optimization.
 *
 * Key Design Decisions:
 * - Separate from semantic TypeInfo to allow IL-specific optimizations
 * - Singleton instances for primitive types to enable identity comparison
 * - Size calculations are pre-computed for efficient code generation
 *
 * @module il/types
 */

/**
 * Enumeration of IL type kinds.
 *
 * These correspond to the fundamental types in Blend65's type system,
 * optimized for IL representation and 6502 code generation.
 */
export enum ILTypeKind {
  /** No value - used for void functions and statements */
  Void = 'void',

  /** Boolean type - 1 byte (0 = false, non-zero = true) */
  Bool = 'bool',

  /** 8-bit unsigned integer (0-255) */
  Byte = 'byte',

  /** 16-bit unsigned integer (0-65535) */
  Word = 'word',

  /** Pointer type - 16-bit address */
  Pointer = 'pointer',

  /** Array type - fixed or dynamic size */
  Array = 'array',

  /** Function type - for function pointers/callbacks */
  Function = 'function',
}

/**
 * Base interface for all IL types.
 *
 * Every IL type has a kind (discriminator) and a size in bytes.
 * The size is pre-computed for efficient code generation.
 */
export interface ILType {
  /** Type kind discriminator */
  readonly kind: ILTypeKind;

  /** Size in bytes (0 for void) */
  readonly sizeInBytes: number;
}

/**
 * IL Array type.
 *
 * Represents arrays with a known element type and optional fixed length.
 * Dynamic arrays (length = null) are represented as pointers at runtime.
 */
export interface ILArrayType extends ILType {
  /** Type discriminator - always Array for this interface */
  readonly kind: ILTypeKind.Array;

  /** Type of array elements */
  readonly elementType: ILType;

  /** Array length (null for dynamic/unknown size) */
  readonly length: number | null;
}

/**
 * IL Pointer type.
 *
 * Represents 16-bit pointers to other types.
 * All pointers are 2 bytes (16-bit addresses on 6502).
 */
export interface ILPointerType extends ILType {
  /** Type discriminator - always Pointer for this interface */
  readonly kind: ILTypeKind.Pointer;

  /** Type of the pointed-to value */
  readonly pointeeType: ILType;
}

/**
 * IL Function type.
 *
 * Represents function signatures for function pointers and callbacks.
 * Used for indirect calls and function pointer types.
 */
export interface ILFunctionType extends ILType {
  /** Type discriminator - always Function for this interface */
  readonly kind: ILTypeKind.Function;

  /** Types of function parameters (in order) */
  readonly parameterTypes: readonly ILType[];

  /** Return type of the function */
  readonly returnType: ILType;
}

// =============================================================================
// Singleton Instances for Primitive Types
// =============================================================================

/**
 * Singleton instance for the void type.
 *
 * Used for functions that don't return a value and for statements.
 */
export const IL_VOID: ILType = Object.freeze({
  kind: ILTypeKind.Void,
  sizeInBytes: 0,
});

/**
 * Singleton instance for the boolean type.
 *
 * On 6502, booleans are 1 byte (0 = false, non-zero = true).
 */
export const IL_BOOL: ILType = Object.freeze({
  kind: ILTypeKind.Bool,
  sizeInBytes: 1,
});

/**
 * Singleton instance for the byte type.
 *
 * 8-bit unsigned integer (0-255).
 */
export const IL_BYTE: ILType = Object.freeze({
  kind: ILTypeKind.Byte,
  sizeInBytes: 1,
});

/**
 * Singleton instance for the word type.
 *
 * 16-bit unsigned integer (0-65535).
 */
export const IL_WORD: ILType = Object.freeze({
  kind: ILTypeKind.Word,
  sizeInBytes: 2,
});

// =============================================================================
// Type Factory Functions
// =============================================================================

/**
 * Creates an array type with the specified element type and optional length.
 *
 * For fixed-size arrays, the size is calculated as elementType.sizeInBytes * length.
 * For dynamic arrays (length = null), the size is 2 bytes (pointer).
 *
 * @param elementType - Type of array elements
 * @param length - Array length (null for dynamic size)
 * @returns A new ILArrayType instance
 *
 * @example
 * ```typescript
 * // Fixed-size byte array of 10 elements
 * const byteArray10 = createArrayType(IL_BYTE, 10);
 * // byteArray10.sizeInBytes === 10
 *
 * // Dynamic word array
 * const dynamicWordArray = createArrayType(IL_WORD, null);
 * // dynamicWordArray.sizeInBytes === 2 (pointer size)
 * ```
 */
export function createArrayType(elementType: ILType, length: number | null): ILArrayType {
  // Validate length if provided
  if (length !== null && length < 0) {
    throw new Error(`Array length cannot be negative: ${length}`);
  }

  return Object.freeze({
    kind: ILTypeKind.Array,
    elementType,
    length,
    // Dynamic arrays are represented as pointers (2 bytes)
    // Fixed arrays have their full size calculated
    sizeInBytes: length !== null ? elementType.sizeInBytes * length : 2,
  });
}

/**
 * Creates a pointer type to the specified target type.
 *
 * All pointers are 2 bytes (16-bit addresses) on the 6502.
 *
 * @param pointeeType - Type of the pointed-to value
 * @returns A new ILPointerType instance
 *
 * @example
 * ```typescript
 * // Pointer to byte
 * const bytePtr = createPointerType(IL_BYTE);
 *
 * // Pointer to word
 * const wordPtr = createPointerType(IL_WORD);
 * ```
 */
export function createPointerType(pointeeType: ILType): ILPointerType {
  return Object.freeze({
    kind: ILTypeKind.Pointer,
    pointeeType,
    sizeInBytes: 2, // 16-bit addresses on 6502
  });
}

/**
 * Creates a function type with the specified parameter and return types.
 *
 * Function types are 2 bytes (function pointer) when stored.
 *
 * @param parameterTypes - Types of function parameters in order
 * @param returnType - Return type of the function
 * @returns A new ILFunctionType instance
 *
 * @example
 * ```typescript
 * // Function: (byte, byte) -> word
 * const addFunc = createFunctionType([IL_BYTE, IL_BYTE], IL_WORD);
 *
 * // Function: () -> void
 * const voidFunc = createFunctionType([], IL_VOID);
 * ```
 */
export function createFunctionType(
  parameterTypes: readonly ILType[],
  returnType: ILType,
): ILFunctionType {
  return Object.freeze({
    kind: ILTypeKind.Function,
    parameterTypes: Object.freeze([...parameterTypes]),
    returnType,
    sizeInBytes: 2, // Function pointer size
  });
}

// =============================================================================
// Type Utility Functions
// =============================================================================

/**
 * Checks if two IL types are structurally equal.
 *
 * For primitive types (void, bool, byte, word), this compares kinds.
 * For complex types (array, pointer, function), this recursively compares structure.
 *
 * @param a - First type to compare
 * @param b - Second type to compare
 * @returns true if types are structurally equal, false otherwise
 *
 * @example
 * ```typescript
 * typesEqual(IL_BYTE, IL_BYTE) // true
 * typesEqual(IL_BYTE, IL_WORD) // false
 * typesEqual(createArrayType(IL_BYTE, 10), createArrayType(IL_BYTE, 10)) // true
 * typesEqual(createArrayType(IL_BYTE, 10), createArrayType(IL_BYTE, 20)) // false
 * ```
 */
export function typesEqual(a: ILType, b: ILType): boolean {
  // Different kinds are never equal
  if (a.kind !== b.kind) {
    return false;
  }

  // Compare array types
  if (a.kind === ILTypeKind.Array && b.kind === ILTypeKind.Array) {
    const aArray = a as ILArrayType;
    const bArray = b as ILArrayType;
    return typesEqual(aArray.elementType, bArray.elementType) && aArray.length === bArray.length;
  }

  // Compare pointer types
  if (a.kind === ILTypeKind.Pointer && b.kind === ILTypeKind.Pointer) {
    const aPtr = a as ILPointerType;
    const bPtr = b as ILPointerType;
    return typesEqual(aPtr.pointeeType, bPtr.pointeeType);
  }

  // Compare function types
  if (a.kind === ILTypeKind.Function && b.kind === ILTypeKind.Function) {
    const aFunc = a as ILFunctionType;
    const bFunc = b as ILFunctionType;

    // Check return type
    if (!typesEqual(aFunc.returnType, bFunc.returnType)) {
      return false;
    }

    // Check parameter count
    if (aFunc.parameterTypes.length !== bFunc.parameterTypes.length) {
      return false;
    }

    // Check each parameter type
    for (let i = 0; i < aFunc.parameterTypes.length; i++) {
      if (!typesEqual(aFunc.parameterTypes[i], bFunc.parameterTypes[i])) {
        return false;
      }
    }

    return true;
  }

  // Primitive types with same kind are equal
  return true;
}

/**
 * Checks if a type is a primitive (non-composite) type.
 *
 * Primitive types are: void, bool, byte, word.
 * Non-primitive types are: array, pointer, function.
 *
 * @param type - Type to check
 * @returns true if type is primitive, false otherwise
 */
export function isPrimitiveType(type: ILType): boolean {
  return (
    type.kind === ILTypeKind.Void ||
    type.kind === ILTypeKind.Bool ||
    type.kind === ILTypeKind.Byte ||
    type.kind === ILTypeKind.Word
  );
}

/**
 * Checks if a type is numeric (can be used in arithmetic operations).
 *
 * Numeric types are: byte, word.
 * Non-numeric types are: void, bool, array, pointer, function.
 *
 * @param type - Type to check
 * @returns true if type is numeric, false otherwise
 */
export function isNumericType(type: ILType): boolean {
  return type.kind === ILTypeKind.Byte || type.kind === ILTypeKind.Word;
}

/**
 * Checks if a type is an array type.
 *
 * @param type - Type to check
 * @returns true if type is an array type
 */
export function isArrayType(type: ILType): type is ILArrayType {
  return type.kind === ILTypeKind.Array;
}

/**
 * Checks if a type is a pointer type.
 *
 * @param type - Type to check
 * @returns true if type is a pointer type
 */
export function isPointerType(type: ILType): type is ILPointerType {
  return type.kind === ILTypeKind.Pointer;
}

/**
 * Checks if a type is a function type.
 *
 * @param type - Type to check
 * @returns true if type is a function type
 */
export function isFunctionType(type: ILType): type is ILFunctionType {
  return type.kind === ILTypeKind.Function;
}

/**
 * Returns a human-readable string representation of a type.
 *
 * @param type - Type to convert to string
 * @returns Human-readable type string
 *
 * @example
 * ```typescript
 * typeToString(IL_BYTE) // "byte"
 * typeToString(createArrayType(IL_BYTE, 10)) // "byte[10]"
 * typeToString(createPointerType(IL_WORD)) // "*word"
 * typeToString(createFunctionType([IL_BYTE], IL_VOID)) // "(byte) -> void"
 * ```
 */
export function typeToString(type: ILType): string {
  switch (type.kind) {
    case ILTypeKind.Void:
      return 'void';
    case ILTypeKind.Bool:
      return 'bool';
    case ILTypeKind.Byte:
      return 'byte';
    case ILTypeKind.Word:
      return 'word';
    case ILTypeKind.Array: {
      const arrayType = type as ILArrayType;
      const lengthStr = arrayType.length !== null ? arrayType.length.toString() : '';
      return `${typeToString(arrayType.elementType)}[${lengthStr}]`;
    }
    case ILTypeKind.Pointer: {
      const ptrType = type as ILPointerType;
      return `*${typeToString(ptrType.pointeeType)}`;
    }
    case ILTypeKind.Function: {
      const funcType = type as ILFunctionType;
      const params = funcType.parameterTypes.map(typeToString).join(', ');
      return `(${params}) -> ${typeToString(funcType.returnType)}`;
    }
    default:
      return 'unknown';
  }
}