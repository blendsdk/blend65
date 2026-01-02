/**
 * Type System AST Node Types for Blend65
 *
 * Defines Blend65's type system including:
 * - Primitive types (byte, word, boolean, void)
 * - Array types with fixed sizes
 * - Record types (struct-like)
 * - Storage class annotations
 * - Type annotations and constraints
 */

import { Blend65ASTNode, Expression } from './core.js';

/**
 * Base interface for all type annotations
 */
export interface TypeAnnotation extends Blend65ASTNode {
  type: string;
}

/**
 * Primitive types in Blend65
 * - byte: 8-bit unsigned integer (0-255)
 * - word: 16-bit unsigned integer (0-65535)
 * - boolean: true/false values
 * - void: used for functions that don't return values
 */
export interface PrimitiveType extends TypeAnnotation {
  type: 'PrimitiveType';
  name: 'byte' | 'word' | 'boolean' | 'void';
}

/**
 * Array type with fixed size
 * Examples: byte[8], word[256], Player[4]
 * Size must be a compile-time constant expression
 */
export interface ArrayType extends TypeAnnotation {
  type: 'ArrayType';
  elementType: TypeAnnotation;
  size: Expression;           // Must resolve to compile-time constant
}

/**
 * Record type (struct-like user-defined type)
 * Examples: Player, Sprite, GameState
 */
export interface RecordType extends TypeAnnotation {
  type: 'RecordType';
  name: string;
  fields: RecordField[];
  extends: RecordType[];      // Support for inheritance
}

/**
 * Field within a record type
 */
export interface RecordField extends Blend65ASTNode {
  type: 'RecordField';
  name: string;
  fieldType: TypeAnnotation;
  offset?: number;            // Optional explicit memory offset
}

/**
 * Named type reference
 * Used to reference user-defined types by name
 */
export interface NamedType extends TypeAnnotation {
  type: 'NamedType';
  name: string;
}

/**
 * Function type for function pointers/references
 * Example: function(byte, byte): word
 */
export interface FunctionType extends TypeAnnotation {
  type: 'FunctionType';
  parameters: TypeAnnotation[];
  returnType: TypeAnnotation;
}

/**
 * Pointer type for memory references
 * Examples: *byte, *word, *Player
 * Note: May be limited in Blend65 v0.1
 */
export interface PointerType extends TypeAnnotation {
  type: 'PointerType';
  targetType: TypeAnnotation;
}

/**
 * Storage class specification
 * Determines where variables are allocated in memory
 */
export type StorageClass = 'zp' | 'ram' | 'data' | 'const' | 'io';

/**
 * Storage-qualified type
 * Combines a type with a storage class specification
 */
export interface StorageQualifiedType extends TypeAnnotation {
  type: 'StorageQualifiedType';
  storageClass: StorageClass;
  baseType: TypeAnnotation;
}

/**
 * Memory placement constraint
 * Specifies exact memory address: @ $D000
 */
export interface MemoryPlacement extends Blend65ASTNode {
  type: 'MemoryPlacement';
  address: Expression;        // Must resolve to compile-time constant
}

/**
 * Type constraint for generic-like behavior
 * May be used in future versions for parameterized types
 */
export interface TypeConstraint extends Blend65ASTNode {
  type: 'TypeConstraint';
  name: string;
  bounds: TypeAnnotation[];
}

/**
 * Union of all type-related AST nodes
 */
export type TypeSystemNode =
  | PrimitiveType
  | ArrayType
  | RecordType
  | RecordField
  | NamedType
  | FunctionType
  | PointerType
  | StorageQualifiedType
  | MemoryPlacement
  | TypeConstraint;

/**
 * Helper type for all valid type annotations
 */
export type Blend65Type =
  | PrimitiveType
  | ArrayType
  | RecordType
  | NamedType
  | FunctionType
  | PointerType
  | StorageQualifiedType;

/**
 * Type utilities for compile-time type checking
 */
export namespace TypeUtils {

  /**
   * Check if a type is a primitive type
   */
  export function isPrimitive(type: TypeAnnotation): type is PrimitiveType {
    return type.type === 'PrimitiveType';
  }

  /**
   * Check if a type is an array type
   */
  export function isArray(type: TypeAnnotation): type is ArrayType {
    return type.type === 'ArrayType';
  }

  /**
   * Check if a type is a record type
   */
  export function isRecord(type: TypeAnnotation): type is RecordType {
    return type.type === 'RecordType';
  }

  /**
   * Check if a type is storage-qualified
   */
  export function hasStorageClass(type: TypeAnnotation): type is StorageQualifiedType {
    return type.type === 'StorageQualifiedType';
  }

  /**
   * Get the base type, stripping storage qualifiers
   */
  export function getBaseType(type: TypeAnnotation): TypeAnnotation {
    if (hasStorageClass(type)) {
      return type.baseType;
    }
    return type;
  }

  /**
   * Get storage class if present
   */
  export function getStorageClass(type: TypeAnnotation): StorageClass | null {
    if (hasStorageClass(type)) {
      return type.storageClass;
    }
    return null;
  }
}
