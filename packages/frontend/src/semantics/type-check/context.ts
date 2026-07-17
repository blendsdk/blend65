/**
 * The shared context for Pass-3 type checking.
 *
 * A single {@link TypeCheckContext} threads the diagnostic bag and the mutable
 * state Pass 3 fills — expression → resolved {@link Type} (`typeMap`),
 * name-node → resolved {@link Symbol} (`symbolMap`), the per-function
 * {@link FnSignature} cache, and the call-graph edges (with a first-call-site
 * span per edge, for recursion reporting) — through the expression / statement
 * typers. `analyze()` freezes the maps into the model's `typeOf`/`symbolOf`
 * query helpers and the model's call graph. This module holds only the
 * context shape (no logic) so every typer imports it without a cycle.
 */

import type {
  AstNode,
  ConstValue,
  DiagnosticBag,
  ExprNode,
  IntrinsicRegistry,
  Scope,
  SourceSpan,
  Symbol,
  Type,
} from "@blend65/core";
import type { ConstTypeEngine } from "../const-type-engine.js";

/**
 * A function's callable view — parameter names/types and the return type,
 * resolved from its declaration. Functions are not values in the language, so
 * this is deliberately not a {@link Type} variant; it exists only for call
 * checking and is cached per function symbol.
 */
export interface FnSignature {
  /**
   * The declared parameters, in order. `byRef` marks struct/array parameters
   * (they pass by reference); `mutable` is `false` for `const` parameters —
   * the pair drives the const-argument check at call sites.
   */
  readonly params: readonly {
    readonly name: string;
    readonly type: Type;
    readonly byRef: boolean;
    readonly mutable: boolean;
  }[];
  /** The declared return type (`void` for procedures). */
  readonly returnType: Type;
}

/** The mutable state Pass-3 type checking reads and writes. */
export interface TypeCheckContext {
  /** The shared diagnostic accumulator (every check emits here; never throws). */
  readonly bag: DiagnosticBag;
  /** Resolved type of every typed expression, filled during the walk. */
  readonly typeMap: Map<ExprNode, Type>;
  /** Resolved symbol for every name-introducing / name-referencing node. */
  readonly symbolMap: Map<AstNode, Symbol>;
  /** Per-function signature cache, computed on first call-site use. */
  readonly signatures: Map<Symbol, FnSignature>;
  /** The resolved entry-point symbol (calling it directly is an error). */
  readonly mainFunction: Symbol | null;
  /** Call-graph edges: caller → set of resolved user-function callees. */
  readonly callEdges: Map<Symbol, Set<Symbol>>;
  /** First call-site span per edge, anchoring the recursion diagnostic. */
  readonly callSiteSpans: Map<Symbol, Map<Symbol, SourceSpan>>;
  /**
   * User-module name → its (shared) module scope, for resolving qualified
   * `Module.member` access (exported declarations are reachable with full
   * qualification without an import).
   */
  readonly moduleScopes: ReadonlyMap<string, Scope>;
  /**
   * Functions whose address is taken with `&`, filled during the walk. Frozen
   * into the model afterwards so frame planning can mark them escaped.
   */
  readonly addressTakenFunctions: Set<Symbol>;
  /**
   * Evaluated module-const values, filled by the const phase (declaration-
   * order independent). Frozen into the model's `constValues` afterwards.
   */
  readonly constValues: Map<Symbol, ConstValue>;
  /**
   * The intrinsic registry. Platform-contributed intrinsics parse as plain
   * calls without being scope symbols; call typing consults the registry so
   * an unresolved registry name is left to the platform import boundary
   * instead of being misreported as undeclared.
   */
  readonly registry?: IntrinsicRegistry;
  /**
   * The shared const/type engine (constructed after imports, driven in Pass
   * 2). Typing consults it for query-intrinsic folds (`sizeof`/`offsetof`/
   * `length` value typing + constant participation) and for the set of
   * constants a definition cycle already poisoned.
   */
  readonly engine?: ConstTypeEngine;
}