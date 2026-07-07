/**
 * The shared context for Pass-3 type checking.
 *
 * A single {@link TypeCheckContext} threads the diagnostic bag and the two
 * mutable maps that Pass 3 fills — expression → resolved {@link Type}
 * (`typeMap`) and name-node → resolved {@link Symbol} (`symbolMap`) — through the
 * expression / statement typers. `analyze()` freezes these maps into the model's
 * `typeOf`/`symbolOf` query helpers (superseding the earlier empty passthrough).
 * This module holds only the context shape (no logic) so every typer
 * imports it without a cycle.
 */

import type { AstNode, DiagnosticBag, ExprNode, Symbol, Type } from "@blend65/core";

/** The mutable state Pass-3 type checking reads and writes. */
export interface TypeCheckContext {
  /** The shared diagnostic accumulator (every check emits here; never throws). */
  readonly bag: DiagnosticBag;
  /** Resolved type of every typed expression, filled during the walk. */
  readonly typeMap: Map<ExprNode, Type>;
  /** Resolved symbol for every name-introducing / name-referencing node. */
  readonly symbolMap: Map<AstNode, Symbol>;
}
