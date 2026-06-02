/**
 * Public barrel for the Blend65 token vocabulary.
 *
 * Re-exports the {@link TokenKind} namespace and the {@link Token} record so
 * downstream packages (the lexer in `@blend65/frontend`, the parser in
 * `@blend65/frontend`) import the token model from `@blend65/core` rather than
 * reaching into individual files (FR-38).
 */

export { TokenKind } from "./token-kind.js";
export type { TokenKindValue } from "./token-kind.js";

export type { Token } from "./token.js";
