/**
 * Public entry point for `@blend65/codegen` — the Blend65 back end.
 *
 * v1 surfaces the RD-06 Intermediate Language: the IL data model, the AST→IL
 * lowering (`lowerToIL`), the deterministic textual printer (`printIL`), and the
 * optimizer pipeline seam (`optimizeIL`). RD-07a adds the target-specific 6502
 * Instr model — the typed instruction stream, the CPU legality table + validator,
 * and the canonical ACME serializer (`printInstr`). The consumer-coupled
 * IL→Instr translation and `generateInstr` entry point land in RD-07b; the ACME
 * emitter (RD-09) reuses `printInstr`.
 */

export const VERSION = "0.1.0";

export * from "./il/index.js";
export * from "./instr/index.js";
export * from "./runtime/index.js";
