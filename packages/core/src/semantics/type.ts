/**
 * The resolved semantic type representation for Blend65.
 *
 * Where the AST `TypeNode` union is *syntactic* (what the parser produced from
 * source text), the `Type` union here is *semantic* (the resolved type a name or
 * expression denotes after analysis). It is pure data — no checker logic — so it
 * lives in `@blend65/core` and is shared by `frontend` and `language-server`
 * without either importing `codegen`.
 *
 * The analyzer never *produces* these types yet (it returns an empty model),
 * but the vocabulary must exist so the model contract, the type utilities, and
 * the future checker all have a shared representation.
 */

import type { StructDeclNode, EnumDeclNode } from "../ast/index.js";

/**
 * The six primitive type names. Reuses the AST's `PrimitiveTypeName` spelling
 * verbatim — note `"boolean"` (not `'bool'`) and the inclusion of `"void"`.
 */
export type PrimitiveName = "byte" | "sbyte" | "word" | "sword" | "boolean" | "void";

/** A primitive type: one of the six built-in scalar names. */
export interface PrimitiveType {
  readonly kind: "primitive";
  readonly name: PrimitiveName;
}

/** A fixed-size array type `element[size]`. */
export interface ArrayType {
  readonly kind: "array";
  readonly element: Type;
  /** Compile-time constant element count, >= 1 (validated by the deferred checker). */
  readonly size: number;
}

/** A resolved struct type, carrying its declaration and laid-out fields. */
export interface StructType {
  readonly kind: "struct";
  readonly name: string;
  readonly decl: StructDeclNode;
  /** Field name -> resolved field type and its byte offset within the struct. */
  readonly fields: ReadonlyMap<string, { type: Type; offset: number }>;
  /** Total size of the struct in bytes. */
  readonly byteSize: number;
}

/** A resolved enum type, carrying its declaration and member backing values. */
export interface EnumType {
  readonly kind: "enum";
  readonly name: string;
  readonly decl: EnumDeclNode;
  /** Member name -> its backing integer value. */
  readonly members: ReadonlyMap<string, number>;
}

/**
 * The poison type used for cascade suppression: once a sub-expression fails
 * to type-check, it is assigned `ErrorType` so dependent expressions don't
 * report a flood of follow-on errors. The *interface* is in scope now; the
 * *propagation behavior* is not implemented yet.
 */
export interface ErrorType {
  readonly kind: "error";
}

/** The resolved semantic type of any name or expression. */
export type Type = PrimitiveType | ArrayType | StructType | EnumType | ErrorType;

/**
 * The shared poison-type singleton. Using one frozen instance lets the
 * model's `typeOf()` passthrough and the future checker compare by reference.
 */
export const ERROR_TYPE: ErrorType = { kind: "error" };

/**
 * Constructs a {@link PrimitiveType} for the given name.
 *
 * @param name One of the six primitive names (spelled `"boolean"`).
 * @returns A primitive type record.
 */
export function primitive(name: PrimitiveName): PrimitiveType {
  return { kind: "primitive", name };
}
