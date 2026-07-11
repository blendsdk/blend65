/**
 * Innermost-first name resolution for the scalar type engine.
 *
 * A reference resolves against the lexical scope chain from the innermost scope
 * outward: function-body scope → enclosing module scope → global scope. The
 * walk stays inside `@blend65/core` scope objects, keeping the frontend
 * independent of codegen. The lookup is pure; the caller decides what to do
 * with a miss (Pass 3 emits E10100 and poisons the reference).
 *
 * `resolveQualified` resolves `Module.member` access: exported declarations are
 * reachable with full qualification without an import (frozen spec Ch 10 §4.4).
 * A value symbol shadowing the head name wins over the module (innermost
 * binding — the expression stays on the caller's field-access path); an
 * unknown head is undeclared (E10100); a missing or non-exported member —
 * even when qualified from inside the same module — is not exported (E10012).
 */

import { DiagCode } from "@blend65/core";
import type {
  AstNode,
  DiagnosticBag,
  FieldAccessExprNode,
  FunctionDeclNode,
  InterruptDeclNode,
  Scope,
  Symbol,
} from "@blend65/core";

/**
 * Resolves `name` to its {@link Symbol} using innermost-first lexical lookup,
 * starting at `scope` and walking `parent` links to the global root.
 *
 * @param name The identifier to resolve.
 * @param scope The innermost scope the reference appears in.
 * @returns The resolved symbol, or `null` if the name is not declared in scope.
 */
export function resolveName(name: string, scope: Scope): Symbol | null {
  for (let s: Scope | null = scope; s !== null; s = s.parent) {
    const sym = s.symbols.get(name);
    if (sym !== undefined) return sym;
  }
  return null;
}

/**
 * The outcome of resolving a `Module.member` expression.
 *
 * - `not-qualified` — the expression is not module access at all: the object
 *   is not a single identifier, or that identifier resolves to a VALUE symbol
 *   in scope (which wins over any module of the same name). The caller keeps
 *   its ordinary field-access behavior.
 * - `resolved` — the head names a user module and the member is an exported
 *   symbol of it; `symbol` is the very symbol the module's scope declares.
 * - `poisoned` — the head or member failed to resolve; the diagnostic has
 *   already been emitted here, so the caller only needs to poison the type.
 */
export type QualifiedResolution =
  | { readonly status: "not-qualified" }
  | { readonly status: "resolved"; readonly symbol: Symbol }
  | { readonly status: "poisoned" };

/**
 * Resolves a `Module.member` field access against the user-module map (see
 * the module doc for the ladder). Emits E10100/E10012; never throws.
 *
 * @param expr The field-access expression to resolve.
 * @param scope The innermost scope the expression appears in.
 * @param moduleScopes User-module name → its (shared) module scope.
 * @param bag The diagnostic accumulator (E10100 unknown head; E10012 member).
 * @returns The resolution outcome.
 */
export function resolveQualified(
  expr: FieldAccessExprNode,
  scope: Scope,
  moduleScopes: ReadonlyMap<string, Scope>,
  bag: DiagnosticBag,
): QualifiedResolution {
  // Only a single-identifier head can name a module (module names are single
  // identifiers by grammar); nested chains keep their field-access behavior.
  if (expr.object.kind !== "IdentExpr") return { status: "not-qualified" };
  const head = expr.object;

  // A value symbol in scope wins over a module of the same name.
  if (resolveName(head.name, scope) !== null) return { status: "not-qualified" };

  // Not a value and not a user module → the head is genuinely undeclared.
  // (Platform namespaces are not user modules; qualified access is a
  // user-module feature, so a platform id lands here too.)
  const moduleScope = moduleScopes.get(head.name);
  if (moduleScope === undefined) {
    bag.addError(
      DiagCode.UndeclaredIdentifier,
      head.span,
      `Undeclared identifier '${head.name}'`,
    );
    return { status: "poisoned" };
  }

  // The member must exist AND be exported — qualification reaches only the
  // module's public surface, even from inside the module itself.
  const member = moduleScope.symbols.get(expr.field);
  if (member === undefined || !member.exported) {
    bag.addError(
      DiagCode.ImportNonExported,
      expr.fieldSpan,
      `'${expr.field}' is not exported from module '${head.name}'`,
    );
    return { status: "poisoned" };
  }

  return { status: "resolved", symbol: member };
}

/**
 * The function/interrupt symbol whose body encloses `scope`, or `null` when
 * the scope chain holds no function (module-level context). Walks to the
 * nearest `function` scope, then reads that declaration's symbol from its
 * enclosing module scope — the flat scope model guarantees expressions are
 * typed with the function body scope (or a descendant) as `scope`.
 *
 * @param scope The innermost scope an expression/statement appears in.
 * @returns The enclosing function's symbol, or `null`.
 */
export function enclosingFunctionSymbol(scope: Scope): Symbol | null {
  for (let s: Scope | null = scope; s !== null; s = s.parent) {
    if (s.kind !== "function") continue;
    const decl = s.node;
    const moduleScope = s.parent;
    if (decl === null || moduleScope === null || !isFunctionLikeDecl(decl)) return null;
    return moduleScope.symbols.get(decl.name) ?? null;
  }
  return null;
}

/** Narrows a scope's introducing node to a function-like declaration. */
function isFunctionLikeDecl(node: AstNode): node is FunctionDeclNode | InterruptDeclNode {
  return node.kind === "FunctionDecl" || node.kind === "InterruptDecl";
}
