/**
 * Minimal top-level declaration collection.
 *
 * NOT the full Pass-1/Pass-2 checker: this walks only the top-level struct
 * and enum declarations and resolves them into the `StructType`/`EnumType` tables
 * the intrinsic-validation pass and codegen folding (`sizeof`/`offsetof`)
 * consume. It computes C-style field offsets (no padding on 6502) and each
 * struct's `byteSize`. No expression inference, no control-flow analysis, no scope
 * tree beyond module level. Variable and import collection are deferred to the
 * phases whose checks first consume them (length folding; the T4 import
 * boundary) to avoid tables no consumer reads yet.
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` only —
 * never `@blend65/codegen`.
 */

import { byteSize, ERROR_TYPE, primitive } from "@blend65/core";
import type {
  EnumDeclNode,
  EnumType,
  ProgramNode,
  StructDeclNode,
  StructType,
  Type,
  TypeNode,
} from "@blend65/core";

/**
 * The resolved top-level type tables produced by declaration collection. Keyed by
 * declared name (module-qualification is deferred with the rest of the checker).
 */
export interface DeclarationTables {
  /** Struct name → resolved {@link StructType} (fields with offsets + `byteSize`). */
  readonly structTypes: ReadonlyMap<string, StructType>;
  /** Enum name → resolved {@link EnumType} (member → backing value). */
  readonly enumTypes: ReadonlyMap<string, EnumType>;
}

/**
 * Collect and resolve the top-level struct/enum declarations across all programs
 * into type tables. On-demand resolution handles forward references; a
 * recursive struct (an error case, deferred) is broken with {@link ERROR_TYPE}
 * rather than looping.
 *
 * @param programs The parsed program ASTs (one per source file).
 * @returns The resolved struct/enum type tables.
 */
export function collectDeclarationTables(
  programs: readonly ProgramNode[],
): DeclarationTables {
  const structDecls = new Map<string, StructDeclNode>();
  const enumDecls = new Map<string, EnumDeclNode>();
  for (const program of programs) {
    for (const item of program.items) {
      if (item.kind === "StructDecl") {
        structDecls.set(item.name, item);
      } else if (item.kind === "EnumDecl") {
        enumDecls.set(item.name, item);
      }
    }
  }

  const structTypes = new Map<string, StructType>();
  const enumTypes = new Map<string, EnumType>();
  const inProgress = new Set<string>();

  /** Resolve a named type to a struct/enum {@link Type}, or ERROR if unknown. */
  const resolveNamed = (name: string): Type => {
    if (structDecls.has(name)) return resolveStruct(name);
    if (enumDecls.has(name)) return resolveEnum(name);
    return ERROR_TYPE;
  };

  /** Resolve an AST {@link TypeNode} to a semantic {@link Type} (minimal). */
  const resolveType = (node: TypeNode): Type => {
    switch (node.kind) {
      case "PrimitiveType":
        return primitive(node.name);
      case "NamedType":
        return resolveNamed(node.name);
      case "ArrayType": {
        const element = resolveType(node.elementType);
        const size =
          node.size !== null && node.size.kind === "NumericLitExpr" ? node.size.value : 0;
        return { kind: "array", element, size };
      }
      default:
        return ERROR_TYPE;
    }
  };

  function resolveStruct(name: string): StructType {
    const cached = structTypes.get(name);
    if (cached !== undefined) return cached;
    const decl = structDecls.get(name);
    if (decl === undefined || inProgress.has(name)) {
      // Unknown or recursive (an error case, deferred) — a zero-size placeholder.
      return { kind: "struct", name, decl: decl ?? emptyStructDecl(name), fields: new Map(), byteSize: 0 };
    }
    inProgress.add(name);
    const fields = new Map<string, { type: Type; offset: number }>();
    let offset = 0;
    for (const field of decl.fields) {
      const type = resolveType(field.fieldType);
      fields.set(field.name, { type, offset });
      offset += byteSize(type);
    }
    inProgress.delete(name);
    const resolved: StructType = { kind: "struct", name, decl, fields, byteSize: offset };
    structTypes.set(name, resolved);
    return resolved;
  }

  function resolveEnum(name: string): EnumType {
    const cached = enumTypes.get(name);
    if (cached !== undefined) return cached;
    const decl = enumDecls.get(name);
    if (decl === undefined) {
      return { kind: "enum", name, decl: emptyEnumDecl(name), members: new Map() };
    }
    const members = new Map<string, number>();
    let next = 0;
    for (const member of decl.members) {
      if (member.value !== null && member.value.kind === "NumericLitExpr") {
        next = member.value.value;
      }
      members.set(member.name, next);
      next += 1;
    }
    const resolved: EnumType = { kind: "enum", name, decl, members };
    enumTypes.set(name, resolved);
    return resolved;
  }

  for (const name of structDecls.keys()) resolveStruct(name);
  for (const name of enumDecls.keys()) resolveEnum(name);

  return { structTypes, enumTypes };
}

/** A placeholder struct decl node for an unresolved/recursive struct reference. */
function emptyStructDecl(name: string): StructDeclNode {
  const span = { sourceId: 0, start: 0, end: 0 };
  return { kind: "StructDecl", exported: false, name, nameSpan: span, span, fields: [] };
}

/** A placeholder enum decl node for an unresolved enum reference. */
function emptyEnumDecl(name: string): EnumDeclNode {
  const span = { sourceId: 0, start: 0, end: 0 };
  return { kind: "EnumDecl", exported: false, name, nameSpan: span, span, members: [] };
}
