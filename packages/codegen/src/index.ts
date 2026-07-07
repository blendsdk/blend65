/**
 * Public entry point for `@blend65/codegen` — the Blend65 back end.
 *
 * This module surfaces the Intermediate Language: the IL data model, the
 * AST→IL lowering (`lowerToIL`), the deterministic textual printer
 * (`printIL`), and the optimizer pipeline seam (`optimizeIL`). It also
 * surfaces the target-specific 6502 Instr model — the typed instruction
 * stream, the CPU legality table + validator, and the canonical ACME
 * serializer (`printInstr`) — along with the consumer-coupled IL→Instr
 * translation and `generateInstr` entry point. The ACME emitter reuses
 * `printInstr` to produce assembler-ready output.
 */

export const VERSION = "0.1.0";

export * from "./il/index.js";
export * from "./instr/index.js";
export * from "./runtime/index.js";
