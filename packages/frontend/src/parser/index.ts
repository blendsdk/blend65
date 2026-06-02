/**
 * Public barrel for the Blend65 parser (RD-03, spec Ch 04).
 *
 * Re-exports the `parse` entry point and its `ParseInput`/`ParseResult` types.
 * The AST node vocabulary itself (`ProgramNode`, the node interfaces, the
 * visitor, `walkNode`/`walkChildren`, `RESERVED_BUILTINS`) lives in
 * `@blend65/core` and is imported from there, so `frontend` and
 * `language-server` share one source of AST truth without importing
 * `@blend65/codegen` (R15/AR-20).
 */
export { parse } from "./parser.js";
export type { ParseInput, ParseResult } from "./parser.js";
export { createCursor } from "./cursor.js";
export type { Cursor } from "./cursor.js";
