/**
 * The semantic model — the output of `analyze()` (RD-04 §4.10, R121).
 *
 * A {@link SemanticModel} is the record every downstream phase (SFA frame
 * planning, IL lowering, codegen, the language server) consumes: the global
 * scope, the expression-type and node-symbol maps, the call graph, module init
 * order, constant values, the resolved struct/enum type tables, the entry-point
 * function, and an aggregate error flag — plus three query helpers.
 *
 * PASSTHROUGH CONTRACT (RD-04 plan, D2): in this skeleton, `analyze()` returns a
 * model whose maps/collections are all empty, `mainFunction` is `null`,
 * `hasErrors` is `false`, and `globalScope` is a lone empty global scope. The
 * query helpers return documented safe values. The real four-pass checker
 * (DEFERRED) populates these. See
 * plans/rd-04-semantic-analysis/08-deferred-semantics-ledger.md.
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

/** The resolved semantic information for a whole program (RD-04 §4.10). */
export interface SemanticModel {
  readonly globalScope: Scope;
  /** Resolved type of every typed expression. */
  readonly typeMap: ReadonlyMap<ExprNode, Type>;
  /** Resolved symbol for every name-introducing or name-referencing node. */
  readonly symbolMap: ReadonlyMap<AstNode, Symbol>;
  readonly callGraph: CallGraph;
  /** Module/global initialiser execution order (R-init). */
  readonly initOrder: ReadonlyArray<Symbol>;
  readonly constValues: ReadonlyMap<Symbol, ConstValue>;
  readonly structTypes: ReadonlyMap<string, StructType>;
  readonly enumTypes: ReadonlyMap<string, EnumType>;
  /** The resolved entry-point function, or `null` if none. */
  readonly mainFunction: Symbol | null;
  /** `true` if analysis recorded any error. Passthrough: always `false` (D3). */
  readonly hasErrors: boolean;

  // Query helpers (R121). Passthrough returns defined safe values (D2).

  /** Resolved type of `expr`. Passthrough: {@link ERROR_TYPE}. */
  typeOf(expr: ExprNode): Type;
  /** Resolved symbol for `node`, or `null`. Passthrough: `null`. */
  symbolOf(node: AstNode): Symbol | null;
  /** Enclosing scope of `node`. Passthrough: the global scope. */
  scopeOf(node: AstNode): Scope;
}

/**
 * Builds the empty passthrough {@link SemanticModel} (D2). The lone global scope
 * is created here, and the query helpers close over it so `scopeOf` can return
 * it by reference.
 *
 * DEFERRED(RD-04-checker): the real model is produced by the four-pass analyzer
 * (declaration collection, type resolution, body checking, post-check).
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
    structTypes: new Map(),
    enumTypes: new Map(),
    mainFunction: null,
    hasErrors: false,
    typeOf: () => ERROR_TYPE, // DEFERRED(RD-04-checker): R44 expression typing
    symbolOf: () => null, // DEFERRED(RD-04-checker): R14–R19 name resolution
    scopeOf: () => globalScope, // DEFERRED(RD-04-checker): R7 scope assignment
  };
}
