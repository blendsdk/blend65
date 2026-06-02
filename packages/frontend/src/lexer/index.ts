/**
 * Public barrel for the Blend65 lexer (spec Ch 01).
 *
 * Re-exports the `lex` entry point, its `LexResult` type, and the `KEYWORD_MAP`.
 * The token vocabulary itself (`TokenKind`, `Token`) lives in `@blend65/core`
 * and is imported from there, so downstream packages depend on a single source
 * of token truth (FR-38).
 */
export { lex } from "./lexer.js";
export type { LexResult } from "./lexer.js";
export { KEYWORD_MAP } from "./keyword-map.js";
