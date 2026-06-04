/**
 * The lexical scope tree for Blend65 semantic analysis (RD-04 §4.2, R7–R8).
 *
 * A {@link Scope} is a node in a tree of name environments: the global scope at
 * the root, then module/function/block scopes nested beneath it. Each scope owns
 * a `Map` of the symbols declared directly in it and a link to its parent for
 * lexical name resolution.
 *
 * PASSTHROUGH NOTE (RD-04 plan, D2): the skeleton builds only the lone empty
 * global scope (via {@link createScope}); the real nested-scope construction is
 * DEFERRED(RD-04-checker). The shape is defined here so the model and the future
 * checker share one representation.
 */

import type { AstNode } from "../ast/index.js";
import type { Symbol } from "./symbol.js";

/** The four kinds of lexical scope (RD-04 §4.2). */
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
