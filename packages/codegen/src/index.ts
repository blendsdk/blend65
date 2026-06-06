/**
 * Public entry point for `@blend65/codegen` — the Blend65 back end.
 *
 * v1 surfaces the RD-06 Intermediate Language: the IL data model, the AST→IL
 * lowering (`lowerToIL`), the deterministic textual printer (`printIL`), and the
 * optimizer pipeline seam (`optimizeIL`). RD-07 6502 codegen and the ACME
 * emitter (RD-09) are layered on top of this IL as they land.
 */

export const VERSION = "0.1.0";

export * from "./il/index.js";
