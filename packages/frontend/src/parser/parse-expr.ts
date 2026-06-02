/**
 * Expression-parser entry points (RD-03 §4.9; FR-37..45).
 *
 * Phase 3 shipped a minimal primary-only parser here; Phase 5 replaced it with
 * the full 14-level Pratt parser in {@link ./pratt}. This module now re-exports
 * those entry points so the declaration / type / statement layers that imported
 * `parsePrimaryExpr` keep their call sites unchanged while transparently gaining
 * the complete operator grammar (FR-11 additive evolution).
 *
 * - {@link parsePrimaryExpr} — a full expression with struct literals disabled
 *   (`Ident { … }` is treated as a bare identifier, leaving `{` to the statement
 *   layer). The default used by conditions, loop bounds, and array sizes.
 * - {@link parseExpression} — the binding-power parser, with an explicit
 *   `allowStructLiteral` flag for initialiser contexts (FR-45).
 */

export { parseExpression, parsePrimaryExpr } from "./pratt.js";
