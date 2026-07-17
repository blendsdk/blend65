/**
 * Literal text processing: the escape decoder shared by the compile path
 * and the language server. Surfaced through the root `@blend65/core` barrel.
 */

export type { LiteralSegment } from "./literal-decode.js";
export { decodeLiteral } from "./literal-decode.js";
