/**
 * Declared-type annotation resolution — the type-resolution pass.
 *
 * Collection assigns every variable/constant symbol a provisional type
 * (primitive annotations resolve immediately; named and array annotations
 * cannot resolve until imports are bound). This pass runs once imports ARE
 * bound and finalizes each symbol's type in place through the full resolver:
 * module-local names, import-bound aliases, and dotted `Mod.Type` forms all
 * resolve; `void` in a value position is E10156, unknown names E10151,
 * non-exported cross-module types E10012, and an unsized `[]` annotation
 * without an initialiser is E10110 (nothing determines its size).
 *
 * Symbol identity is preserved — the type field is patched, never the symbol
 * replaced — because downstream maps (initializers, const values, call edges)
 * key by the symbol object.
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` only —
 * never `@blend65/codegen`.
 */

import { DiagCode } from "@blend65/core";
import type {
  AstNode,
  ConstDeclNode,
  DiagnosticBag,
  LetDeclNode,
  Scope,
  Symbol,
} from "@blend65/core";
import { resolveTypeNode } from "./type-check/type-resolution.js";
import type { TypeResolverContext } from "./type-check/type-resolution.js";

/** Narrows a symbol's declaring node to a let/const declaration. */
function isVarDecl(node: AstNode): node is LetDeclNode | ConstDeclNode {
  return node.kind === "LetDecl" || node.kind === "ConstDecl";
}

/**
 * Finalizes the declared types of module-level and function-local
 * variable/constant symbols (see the module doc). Never throws.
 *
 * @param moduleScopes User-module name → its shared module scope.
 * @param scopeByNode Function decl → its body scope (holding params + locals).
 * @param bag The diagnostic accumulator.
 */
export function resolveDeclaredTypes(
  moduleScopes: ReadonlyMap<string, Scope>,
  scopeByNode: ReadonlyMap<AstNode, Scope>,
  bag: DiagnosticBag,
): void {
  for (const moduleScope of moduleScopes.values()) {
    const ctx: TypeResolverContext = { moduleScope, moduleScopes, bag };
    for (const sym of moduleScope.symbols.values()) {
      // Import-bound aliases point at symbols declared in ANOTHER module's
      // scope — the declaring module finalizes them; resolving here twice
      // would double-report.
      if (sym.scope !== moduleScope) continue;
      finalizeSymbol(sym, ctx);
    }
  }

  for (const bodyScope of scopeByNode.values()) {
    const moduleScope = bodyScope.parent;
    if (moduleScope === null || moduleScope.kind !== "module") continue;
    const ctx: TypeResolverContext = { moduleScope, moduleScopes, bag };
    for (const sym of bodyScope.symbols.values()) {
      finalizeSymbol(sym, ctx);
    }
  }
}

/** Re-resolves one symbol's declared annotation and patches its type. */
function finalizeSymbol(sym: Symbol, ctx: TypeResolverContext): void {
  if (sym.kind !== "variable" && sym.kind !== "constant") return;
  const decl = sym.decl;
  if (!isVarDecl(decl)) return;
  const annotation = decl.declaredType;
  if (annotation === null) return; // inferred/missing — other checks own it

  switch (annotation.kind) {
    case "PrimitiveType":
      if (annotation.name === "void") {
        ctx.bag.addError(
          DiagCode.VoidTypeNotAllowed,
          annotation.span,
          "'void' is not a value type — a variable cannot be 'void'",
        );
      }
      return; // provisional resolution already handled primitives
    case "NamedType":
    case "ArrayType": {
      sym.type = resolveTypeNode(annotation, ctx);
      // An unsized `[]` annotation needs an initialiser to determine its
      // size; without one the declaration is unsizable.
      if (
        annotation.kind === "ArrayType" &&
        annotation.size === null &&
        decl.initialiser === null
      ) {
        ctx.bag.addError(
          DiagCode.ArraySizeNotConst,
          annotation.span,
          "An unsized array declaration needs an initialiser to determine its size",
        );
      }
      return;
    }
    default:
      return; // ErrorType — the parser already reported
  }
}
