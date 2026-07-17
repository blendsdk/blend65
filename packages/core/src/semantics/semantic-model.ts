/**
 * The semantic model — the output of `analyze()`.
 *
 * A {@link SemanticModel} is the record every downstream phase (SFA frame
 * planning, IL lowering, codegen, the language server) consumes: the global
 * scope, the expression-type and node-symbol maps, the call graph, module init
 * order, constant values, the resolved struct/enum type tables, the entry-point
 * function, and an aggregate error flag — plus three query helpers.
 *
 * In this skeleton, `analyze()` returns a model whose maps/collections are all
 * empty, `mainFunction` is `null`, `hasErrors` is `false`, and `globalScope` is
 * a lone empty global scope. The query helpers return documented safe values.
 * The real four-pass checker, not yet implemented, will populate these.
 */

import type { ExprNode, AstNode } from "../ast/index.js";
import type { Type, StructType, EnumType } from "./type.js";
import { ERROR_TYPE } from "./type.js";
import type { Scope } from "./scope.js";
import { createScope } from "./scope.js";
import type { Symbol } from "./symbol.js";
import type { ConstValue } from "./const-value.js";
import type { CallGraph } from "./call-graph.js";
import { emptyCallGraph } from "./call-graph.js";

/** The resolved semantic information for a whole program. */
export interface SemanticModel {
  readonly globalScope: Scope;
  /** Resolved type of every typed expression. */
  readonly typeMap: ReadonlyMap<ExprNode, Type>;
  /** Resolved symbol for every name-introducing or name-referencing node. */
  readonly symbolMap: ReadonlyMap<AstNode, Symbol>;
  readonly callGraph: CallGraph;
  /** Module/global initialiser execution order. */
  readonly initOrder: ReadonlyArray<Symbol>;
  readonly constValues: ReadonlyMap<Symbol, ConstValue>;
  /**
   * The by-reference parameters accessed THROUGH their pointer — an element
   * or field access rooted at the parameter, or a whole-struct copy with the
   * parameter as either endpoint. Frame planning binds a zero-page pointer
   * pair to exactly this set, and lowering emits the one-time frame→pair
   * prologue copy from the same set — one predicate keeps the two in
   * lockstep. Dead and pass-through-only by-ref parameters are excluded
   * (they read only their 2-byte frame home).
   */
  readonly pairAccessedParams: ReadonlySet<Symbol>;
  /**
   * Functions whose address is taken with `&` — bare, or as a qualified
   * exported `Module.fn`. An address-taken function can be invoked through a
   * hardware vector or a platform callback the compiler cannot see, so frame
   * planning marks these escaped and never shares their frame memory.
   */
  readonly addressTakenFunctions: ReadonlySet<Symbol>;
  readonly structTypes: ReadonlyMap<string, StructType>;
  readonly enumTypes: ReadonlyMap<string, EnumType>;
  /**
   * Embedded assets by symbol FQN (`Module.name` → canonical absolute
   * asset path) — the invalidation edge a watching host needs to know
   * which compilation inputs live outside the source set. Empty when the
   * program embeds nothing.
   */
  readonly embeddedAssets: ReadonlyMap<string, string>;
  /** The resolved entry-point function, or `null` if none. */
  readonly mainFunction: Symbol | null;
  /** `true` if analysis recorded any error. Passthrough: always `false`. */
  readonly hasErrors: boolean;

  // Query helpers. Passthrough returns defined safe values.

  /** Resolved type of `expr`. Passthrough: {@link ERROR_TYPE}. */
  typeOf(expr: ExprNode): Type;
  /** Resolved symbol for `node`, or `null`. Passthrough: `null`. */
  symbolOf(node: AstNode): Symbol | null;
  /** Enclosing scope of `node`. Passthrough: the global scope. */
  scopeOf(node: AstNode): Scope;
}

/**
 * Builds the empty passthrough {@link SemanticModel}. The lone global scope is
 * created here, and the query helpers close over it so `scopeOf` can return it
 * by reference.
 *
 * The real model, produced by the four-pass analyzer (declaration collection,
 * type resolution, body checking, post-check), is not implemented yet.
 *
 * @returns A structurally valid, semantically empty model.
 */
export function createEmptyModel(): SemanticModel {
  const globalScope = createScope("global", null, null);
  return {
    globalScope,
    typeMap: new Map(),
    symbolMap: new Map(),
    callGraph: emptyCallGraph(),
    initOrder: [],
    constValues: new Map(),
    pairAccessedParams: new Set(),
    addressTakenFunctions: new Set(),
    structTypes: new Map(),
    enumTypes: new Map(),
    embeddedAssets: new Map(),
    mainFunction: null,
    hasErrors: false,
    typeOf: () => ERROR_TYPE, // Expression typing is not implemented yet
    symbolOf: () => null, // Name resolution is not implemented yet
    scopeOf: () => globalScope, // Scope assignment is not implemented yet
  };
}
