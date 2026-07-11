/**
 * Module-keyed struct/enum declaration collection.
 *
 * Walks the top-level struct and enum declarations of every program and
 * resolves them into fully-qualified type tables — keyed `"Module.Name"`, so
 * two modules may each declare a `struct Point` without colliding (module
 * namespaces, spec Ch 10). Within one module (including across its files) all
 * top-level names share ONE namespace: a duplicate type name, or a type name
 * colliding with a function/variable/constant, is a duplicate declaration
 * (E10003). Each struct/enum also becomes a `struct`/`enum` `Symbol` in its
 * module scope, so annotations, imports (`import { Point } from Gfx;`), and
 * head classification all resolve types through the ordinary scope machinery.
 *
 * Struct layout uses C-style field offsets (no padding on the 6502); array
 * field sizes read literal sizes for now (constant-expression sizes land with
 * the const/type engine, which also replaces the recursive-struct placeholder
 * with a real cycle diagnostic). Enum member values fold through the constant
 * evaluator: a non-constant value is E10230, a value outside 0..255 — or
 * auto-increment running past 255 — is E10143, duplicate member NAMES are
 * E10003, and duplicate VALUES are legal aliases (Ch 09 EN-5).
 *
 * Must run after `collectFunctions` (module scopes + function names exist) and
 * before module-variable collection (so `let S: byte` colliding with
 * `struct S` reports on the variable). This module lives in
 * `@blend65/frontend` and imports `@blend65/core` only — never
 * `@blend65/codegen`.
 */

import { byteSize, DiagCode, ERROR_TYPE, primitive } from "@blend65/core";
import type {
  DiagnosticBag,
  EnumDeclNode,
  EnumType,
  ProgramNode,
  Scope,
  StructDeclNode,
  StructType,
  Symbol,
  Type,
  TypeNode,
} from "@blend65/core";
import { evalConst } from "./const-eval.js";

/**
 * The resolved top-level type tables, keyed by fully-qualified
 * `"Module.Name"`.
 */
export interface DeclarationTables {
  /** FQN → resolved {@link StructType} (fields with offsets + `byteSize`). */
  readonly structTypes: ReadonlyMap<string, StructType>;
  /** FQN → resolved {@link EnumType} (member → backing value). */
  readonly enumTypes: ReadonlyMap<string, EnumType>;
}

/** One module's registered type declarations (bare names, within the module). */
interface ModuleDecls {
  readonly structs: Map<string, StructDeclNode>;
  readonly enums: Map<string, EnumDeclNode>;
}

/**
 * Collects and resolves the top-level struct/enum declarations of all
 * programs into fully-qualified type tables, and declares each as a symbol in
 * its module scope. Never throws.
 *
 * @param programs The parsed program ASTs (one per source file).
 * @param moduleScopeByProgram Each program → its module scope (from collection).
 * @param bag The diagnostic accumulator.
 * @returns The FQN-keyed struct/enum type tables.
 */
export function collectDeclarationTables(
  programs: readonly ProgramNode[],
  moduleScopeByProgram: ReadonlyMap<ProgramNode, Scope>,
  bag: DiagnosticBag,
): DeclarationTables {
  // Sweep A — register declarations per module; duplicates within a module
  // (same file or another file of the merged module, and names functions
  // already took) are E10003, first-wins.
  const byModule = new Map<string, ModuleDecls>();
  const scopeByModule = new Map<string, Scope>();
  for (const program of programs) {
    const moduleName = program.moduleDecl?.name;
    const moduleScope = moduleScopeByProgram.get(program);
    if (moduleName === undefined || moduleScope === undefined) continue;
    let decls = byModule.get(moduleName);
    if (decls === undefined) {
      decls = { structs: new Map(), enums: new Map() };
      byModule.set(moduleName, decls);
      scopeByModule.set(moduleName, moduleScope);
    }

    for (const item of program.items) {
      if (item.kind !== "StructDecl" && item.kind !== "EnumDecl") continue;
      const taken =
        decls.structs.has(item.name) ||
        decls.enums.has(item.name) ||
        moduleScope.symbols.has(item.name);
      if (taken) {
        bag.addError(
          DiagCode.DuplicateDecl,
          item.nameSpan,
          `Duplicate declaration '${item.name}' in this module`,
        );
        continue;
      }
      if (item.kind === "StructDecl") decls.structs.set(item.name, item);
      else decls.enums.set(item.name, item);
    }
  }

  // Sweep B — resolve every registered declaration into the FQN tables.
  // Same-module names and dotted `Mod.Name` field references resolve here;
  // import-bound bare names in field positions resolve once sizing moves onto
  // the lazy const/type engine (imports are not bound yet at this point).
  const structTypes = new Map<string, StructType>();
  const enumTypes = new Map<string, EnumType>();
  const inProgress = new Set<string>();

  /** Resolve `name` as seen from `moduleName` (bare or dotted). */
  const resolveNamed = (moduleName: string, name: string): Type => {
    const dot = name.lastIndexOf(".");
    const targetModule = dot >= 0 ? name.slice(0, dot) : moduleName;
    const typeName = dot >= 0 ? name.slice(dot + 1) : name;
    const decls = byModule.get(targetModule);
    if (decls === undefined) return ERROR_TYPE;
    if (decls.structs.has(typeName)) return resolveStruct(targetModule, typeName);
    if (decls.enums.has(typeName)) return resolveEnum(targetModule, typeName);
    return ERROR_TYPE;
  };

  /** Resolve a field's AST type node (literal array sizes for now). */
  const resolveFieldType = (moduleName: string, node: TypeNode, bagRef: DiagnosticBag): Type => {
    switch (node.kind) {
      case "PrimitiveType": {
        if (node.name === "void") {
          bagRef.addError(
            DiagCode.VoidTypeNotAllowed,
            node.span,
            "'void' is not a value type — a struct field cannot be 'void'",
          );
          return ERROR_TYPE;
        }
        return primitive(node.name);
      }
      case "NamedType": {
        const resolved = resolveNamed(moduleName, node.name);
        if (resolved.kind === "error") {
          bagRef.addError(DiagCode.UnknownType, node.span, `Unknown type '${node.name}'`);
        }
        return resolved;
      }
      case "ArrayType": {
        const element = resolveFieldType(moduleName, node.elementType, bagRef);
        if (element.kind === "error") return ERROR_TYPE;
        const size =
          node.size !== null && node.size.kind === "NumericLitExpr" ? node.size.value : 0;
        return { kind: "array", element, size };
      }
      default:
        return ERROR_TYPE;
    }
  };

  function resolveStruct(moduleName: string, name: string): StructType {
    const fqn = `${moduleName}.${name}`;
    const cached = structTypes.get(fqn);
    if (cached !== undefined) return cached;
    const decl = byModule.get(moduleName)?.structs.get(name);
    if (decl === undefined || inProgress.has(fqn)) {
      // Unknown, or a recursive layout — the placeholder keeps resolution
      // total; the const/type engine replaces this with a loud cycle
      // diagnostic carrying the full path.
      return {
        kind: "struct",
        name,
        decl: decl ?? emptyStructDecl(name),
        fields: new Map(),
        byteSize: 0,
      };
    }
    inProgress.add(fqn);
    const fields = new Map<string, { type: Type; offset: number }>();
    let offset = 0;
    for (const field of decl.fields) {
      if (fields.has(field.name)) {
        bag.addError(
          DiagCode.DuplicateDecl,
          field.nameSpan,
          `Duplicate field '${field.name}' in struct '${name}'`,
        );
        continue;
      }
      const type = resolveFieldType(moduleName, field.fieldType, bag);
      fields.set(field.name, { type, offset });
      offset += byteSize(type);
    }
    inProgress.delete(fqn);
    const resolved: StructType = { kind: "struct", name, decl, fields, byteSize: offset };
    structTypes.set(fqn, resolved);
    return resolved;
  }

  function resolveEnum(moduleName: string, name: string): EnumType {
    const fqn = `${moduleName}.${name}`;
    const cached = enumTypes.get(fqn);
    if (cached !== undefined) return cached;
    const decl = byModule.get(moduleName)?.enums.get(name);
    if (decl === undefined) {
      return { kind: "enum", name, decl: emptyEnumDecl(name), members: new Map() };
    }
    const members = new Map<string, number>();
    let next = 0;
    for (const member of decl.members) {
      if (members.has(member.name)) {
        bag.addError(
          DiagCode.DuplicateDecl,
          member.nameSpan,
          `Duplicate member '${member.name}' in enum '${name}'`,
        );
        continue;
      }
      if (member.value !== null) {
        const result = evalConst(member.value);
        if (result.kind === "value" && typeof result.value === "number") {
          next = result.value;
        } else {
          bag.addError(
            DiagCode.EnumValueNotConst,
            member.value.span,
            `Enum member '${member.name}' must have a compile-time constant value`,
          );
          members.set(member.name, 0);
          next = 1;
          continue;
        }
      }
      if (next < 0 || next > 255) {
        bag.addError(
          DiagCode.EnumBackingOutOfRange,
          member.nameSpan,
          `Enum member '${member.name}' has backing value ${next} — enum values must fit 0..255`,
        );
        members.set(member.name, 0);
        next = 1;
        continue;
      }
      members.set(member.name, next);
      next += 1;
    }
    const resolved: EnumType = { kind: "enum", name, decl, members };
    enumTypes.set(fqn, resolved);
    return resolved;
  }

  for (const [moduleName, decls] of byModule) {
    for (const name of decls.structs.keys()) resolveStruct(moduleName, name);
    for (const name of decls.enums.keys()) resolveEnum(moduleName, name);
  }

  // Sweep C — declare each resolved type as a symbol in its module scope
  // (one namespace: annotations, imports, and head classification all resolve
  // through the scope). Sweep A already rejected duplicates, so every set
  // here is first-wins-clean.
  for (const [moduleName, decls] of byModule) {
    const moduleScope = scopeByModule.get(moduleName);
    if (moduleScope === undefined) continue;
    for (const [name, decl] of decls.structs) {
      declareTypeSymbol(moduleScope, name, "struct", structTypes.get(`${moduleName}.${name}`), decl);
    }
    for (const [name, decl] of decls.enums) {
      declareTypeSymbol(moduleScope, name, "enum", enumTypes.get(`${moduleName}.${name}`), decl);
    }
  }

  return { structTypes, enumTypes };
}

/** Declares one struct/enum symbol into its module scope. */
function declareTypeSymbol(
  moduleScope: Scope,
  name: string,
  kind: "struct" | "enum",
  type: Type | undefined,
  decl: StructDeclNode | EnumDeclNode,
): void {
  if (moduleScope.symbols.has(name)) return; // first-wins (sweep A reported)
  const sym: Symbol = {
    name,
    kind,
    type: type ?? ERROR_TYPE,
    decl,
    scope: moduleScope,
    exported: decl.exported,
    mutable: false,
    byRef: false,
  };
  moduleScope.symbols.set(name, sym);
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
