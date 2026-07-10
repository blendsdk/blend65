/**
 * Innermost-first name resolution for the scalar type engine.
 *
 * A reference resolves against the lexical scope chain from the innermost scope
 * outward: function-body scope → enclosing module scope → global scope. The
 * walk stays inside `@blend65/core` scope objects, keeping the frontend
 * independent of codegen. The lookup is pure; the caller decides what to do
 * with a miss (Pass 3 emits E10100 and poisons the reference).
 */

import type {
  AstNode,
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
