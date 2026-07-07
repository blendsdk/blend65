/**
 * The lexical scope tree for Blend65 semantic analysis.
 *
 * A {@link Scope} is a node in a tree of name environments: the global scope at
 * the root, then module/function/block scopes nested beneath it. Each scope owns
 * a `Map` of the symbols declared directly in it and a link to its parent for
 * lexical name resolution.
 *
 * Only the lone empty global scope is currently built (via {@link createScope});
 * real nested-scope construction is not implemented yet. The shape is defined
 * here so the model and the future checker share one representation.
 */

import type { AstNode } from "../ast/index.js";
import type { Symbol } from "./symbol.js";

/** The four kinds of lexical scope. */
export type ScopeKind = "global" | "module" | "function" | "block";

/** A node in the lexical scope tree. */
export interface Scope {
  readonly kind: ScopeKind;
  /** The enclosing scope, or `null` for the global root. */
  readonly parent: Scope | null;
  /** Child scopes nested directly within this one. */
  readonly children: Scope[];
  /** Symbols declared directly in this scope, keyed by name. */
  readonly symbols: Map<string, Symbol>;
  /** The AST node that introduced this scope (module/function/block); null for global. */
  readonly node: AstNode | null;
}

/**
 * Constructs an empty {@link Scope}. The passthrough uses this to build the
 * single global scope of the empty model; the future checker uses it for every
 * nested scope it creates.
 *
 * @param kind The scope kind.
 * @param parent The enclosing scope, or `null` for the global root.
 * @param node The AST node introducing the scope, or `null` for global.
 * @returns A fresh scope with no children and no symbols.
 */
export function createScope(kind: ScopeKind, parent: Scope | null, node: AstNode | null): Scope {
  return { kind, parent, children: [], symbols: new Map(), node };
}
