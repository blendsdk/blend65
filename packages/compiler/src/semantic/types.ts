/**
 * Type System Data Structures
 *
 * Defines the type information used throughout semantic analysis.
 * These types represent Blend65's type system and type checking rules.
 */

/**
 * Type kinds in Blend65 type system
 */
export enum TypeKind {
  /** 8-bit unsigned integer (0-255) */
  Byte = 'byte',

  /** 16-bit unsigned integer (0-65535) */
  Word = 'word',

  /** 8-bit boolean (0 = false, non-zero = true) */
  Boolean = 'boolean',

  /** No value (function return type) */
  Void = 'void',

  /** String literal (compile-time only) */
  String = 'string',

  /** Function pointer / callback type */
  Callback = 'callback',

  /** Array type */
  Array = 'array',

  /** Module/namespace type (for imported modules with exported members) */
  Module = 'module',

  /** Unknown/error type */
  Unknown = 'unknown',
}

/**
 * Function signature for callbacks and functions
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
 * Type compatibility result
 */
export enum TypeCompatibility {
  /** Types are identical (same kind and properties) */
  Identical = 'Identical',

  /** Types are compatible (can assign without explicit conversion) */
  Compatible = 'Compatible',

  /** Types require explicit conversion (e.g., word → byte) */
  RequiresConversion = 'RequiresConversion',

  /** Types are incompatible (cannot convert) */
  Incompatible = 'Incompatible',
}

/**
 * Type metadata for additional type information
 */
export interface TypeMetadata {
  /** Is this type from a specific module? */
  sourceModule?: string;

  /** Custom metadata for advanced features */
  [key: string]: unknown;
}

/**
 * Represents complete type information
 *
 * This is the core type representation used throughout
 * semantic analysis and code generation.
 */
export interface TypeInfo {
  /** Type kind */
  kind: TypeKind;

  /** Type name (for display and debugging) */
  name: string;

  /** Size in bytes (0 for void, string, or unsized arrays) */
  size: number;

  /** Is this type signed? (always false for 6502) */
  isSigned: boolean;

  /** Can this type be assigned to? */
  isAssignable: boolean;

  /** Array element type (for array types) */
  elementType?: TypeInfo;

  /** Array size (for fixed-size arrays, undefined for dynamic) */
  arraySize?: number;

  /** Function signature (for callback types) */
  signature?: FunctionSignature;

  /** Module members (for module types) - maps member name to type */
  members?: Map<string, TypeInfo>;

  /** Additional type metadata */
  metadata?: TypeMetadata;
}