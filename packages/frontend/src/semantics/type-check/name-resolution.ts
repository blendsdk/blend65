/**
 * Innermost-first name resolution for the RD-18 Slice 3b scalar type engine
 * (FR-2; RD-04 §4.2 R14–R16).
 *
 * A reference resolves against the lexical scope chain from the innermost scope
 * outward: function-body scope → enclosing module scope → global scope (R15
 * boundary — the walk stays inside `@blend65/core` scope objects). The lookup is
 * pure; the caller decides what to do with a miss (Pass 3 emits E10100 and
 * poisons the reference).
 */

import type { Scope, Symbol } from "@blend65/core";

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
