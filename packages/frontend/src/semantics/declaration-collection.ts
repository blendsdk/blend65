/**
 * Module-keyed struct/enum declaration REGISTRATION.
 *
 * Walks the top-level struct and enum declarations of every program,
 * registers them per module, and declares each as a `struct`/`enum` `Symbol`
 * in its module scope so annotations, imports (`import { Point } from Gfx;`),
 * and head classification all resolve types through the ordinary scope
 * machinery. Within one module (including across its files) all top-level
 * names share ONE namespace: a duplicate type name, or a type name colliding
 * with a function, is a duplicate declaration (E10003); variables collected
 * later collide against these symbols symmetrically.
 *
 * Layout computation (field offsets, byte sizes, enum member values) does
 * NOT happen here — the const/type engine computes it lazily once imports
 * are bound, because array-size expressions, struct layouts, and module
 * constants are mutually recursive. The symbols declared here carry a
 * placeholder type the engine patches in place.
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` only —
 * never `@blend65/codegen`.
 */

import { DiagCode, ERROR_TYPE } from "@blend65/core";
import type {
  DiagnosticBag,
  EnumDeclNode,
  EnumType,
  ProgramNode,
  Scope,
  StructDeclNode,
  StructType,
  Symbol,
} from "@blend65/core";

/**
 * The struct/enum type tables, keyed by fully-qualified `"Module.Name"`.
 * Registration returns them EMPTY; the const/type engine fills them.
 */
export interface DeclarationTables {
  /** FQN → resolved {@link StructType} (fields with offsets + `byteSize`). */
  readonly structTypes: ReadonlyMap<string, StructType>;
  /** FQN → resolved {@link EnumType} (member → backing value). */
  readonly enumTypes: ReadonlyMap<string, EnumType>;
}

/** One module's registered type declarations plus its scope. */
export interface ModuleTypeRegistry {
  readonly structs: Map<string, StructDeclNode>;
  readonly enums: Map<string, EnumDeclNode>;
  readonly scope: Scope;
}

/** The registration result: empty FQN tables + the per-module registries. */
export interface DeclarationRegistration extends DeclarationTables {
  /** Module name → its registered struct/enum declarations. */
  readonly registries: ReadonlyMap<string, ModuleTypeRegistry>;
  /** The mutable FQN tables (the engine fills these very instances). */
  readonly mutableStructTypes: Map<string, StructType>;
  readonly mutableEnumTypes: Map<string, EnumType>;
}

/**
 * Registers the top-level struct/enum declarations of all programs and
 * declares their module-scope symbols. Never throws.
 *
 * @param programs The parsed program ASTs (one per source file).
 * @param moduleScopeByProgram Each program → its module scope (from collection).
 * @param bag The diagnostic accumulator (E10003 on duplicates).
 * @returns The registries + the (engine-filled) FQN type tables.
 */
export function collectDeclarationTables(
  programs: readonly ProgramNode[],
  moduleScopeByProgram: ReadonlyMap<ProgramNode, Scope>,
  bag: DiagnosticBag,
): DeclarationRegistration {
  const registries = new Map<string, ModuleTypeRegistry>();
  for (const program of programs) {
    const moduleName = program.moduleDecl?.name;
    const moduleScope = moduleScopeByProgram.get(program);
    if (moduleName === undefined || moduleScope === undefined) continue;
    let registry = registries.get(moduleName);
    if (registry === undefined) {
      registry = { structs: new Map(), enums: new Map(), scope: moduleScope };
      registries.set(moduleName, registry);
    }

    for (const item of program.items) {
      if (item.kind !== "StructDecl" && item.kind !== "EnumDecl") continue;
      const taken =
        registry.structs.has(item.name) ||
        registry.enums.has(item.name) ||
        moduleScope.symbols.has(item.name);
      if (taken) {
        bag.addError(
          DiagCode.DuplicateDecl,
          item.nameSpan,
          `Duplicate declaration '${item.name}' in this module`,
        );
        continue;
      }
      if (item.kind === "StructDecl") registry.structs.set(item.name, item);
      else registry.enums.set(item.name, item);
      declareTypeSymbol(moduleScope, item);
    }
  }

  const mutableStructTypes = new Map<string, StructType>();
  const mutableEnumTypes = new Map<string, EnumType>();
  return {
    structTypes: mutableStructTypes,
    enumTypes: mutableEnumTypes,
    registries,
    mutableStructTypes,
    mutableEnumTypes,
  };
}

/**
 * Declares one struct/enum symbol into its module scope with a placeholder
 * type — the const/type engine patches the real layout in once computed.
 */
function declareTypeSymbol(moduleScope: Scope, decl: StructDeclNode | EnumDeclNode): void {
  const sym: Symbol = {
    name: decl.name,
    kind: decl.kind === "StructDecl" ? "struct" : "enum",
    type: ERROR_TYPE,
    decl,
    scope: moduleScope,
    exported: decl.exported,
    mutable: false,
    byRef: false,
  };
  moduleScope.symbols.set(decl.name, sym);
}
