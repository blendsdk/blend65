/**
 * Semantic Types for Blend65 Compiler v2
 *
 * Defines the type system types used throughout semantic analysis
 * and expression type annotation.
 */

/**
 * Type kind enumeration
 *
 * v2 simplifies to core 6502 types.
 */
export enum TypeKind {
  /** Unknown type (before analysis) */
  Unknown = 'unknown',

  /** Void type (no value) */
  Void = 'void',

  /** 8-bit unsigned integer (0-255) */
  Byte = 'byte',

  /** 16-bit unsigned integer (0-65535) */
  Word = 'word',

  /** Boolean type (true/false) */
  Bool = 'bool',

  /** String type */
  String = 'string',

  /** Array type */
  Array = 'array',

  /** Function type */
  Function = 'function',

  /** Enum type */
  Enum = 'enum',
}

/**
 * Type compatibility result
 *
 * Used when checking if a value of one type can be assigned to another.
 */
export enum TypeCompatibility {
  /** Types are identical (same kind and properties) */
  Identical = 'Identical',

  /** Types are compatible (can assign without explicit conversion) */
  Compatible = 'Compatible',

  /** Types require explicit conversion (e.g., word ’ byte) */
  RequiresConversion = 'RequiresConversion',

  /** Types are incompatible (cannot convert) */
  Incompatible = 'Incompatible',
}

/**
 * Function signature for function types
 *
 * Describes the parameters and return type of a function.
 */
export interface FunctionSignature {
  /** Parameter types (in order) */
  parameters: TypeInfo[];

  /** Return type */
  returnType: TypeInfo;

  /** Parameter names (for error messages and documentation) */
  parameterNames?: string[];
}

/**
 * Type information structure
 *
 * Used to annotate expressions with their resolved types.
 */
export interface TypeInfo {
  /** The kind of type */
  kind: TypeKind;

  /** Human-readable type name */
  name: string;

  /** Size in bytes (for allocation) */
  size: number;

  /** Whether the type is signed */
  isSigned?: boolean;

  /** Whether the type is assignable (lvalue) */
  isAssignable?: boolean;

  /** For arrays: element type */
  elementType?: TypeInfo;

  /** For arrays: element count */
  elementCount?: number;

  /** For functions: parameter types */
  parameterTypes?: TypeInfo[];

  /** For functions: return type */
  returnType?: TypeInfo;

  /** For enums: member values */
  enumMembers?: Map<string, number>;
}

/**
 * Predefined type constants for convenience
 */
export const BUILTIN_TYPES = {
  UNKNOWN: { kind: TypeKind.Unknown, name: 'unknown', size: 0 } as TypeInfo,
  VOID: { kind: TypeKind.Void, name: 'void', size: 0 } as TypeInfo,
  BYTE: { kind: TypeKind.Byte, name: 'byte', size: 1, isSigned: false } as TypeInfo,
  WORD: { kind: TypeKind.Word, name: 'word', size: 2, isSigned: false } as TypeInfo,
  BOOL: { kind: TypeKind.Bool, name: 'bool', size: 1 } as TypeInfo,
  STRING: { kind: TypeKind.String, name: 'string', size: 2 } as TypeInfo, // pointer size
} as const;