/**
 * Public barrel for the RD-06 Intermediate Language (`il/`).
 *
 * Re-exports the complete IL vocabulary — the erased type lattice, the operand
 * union and its constructors/guards, the instruction/terminator unions and
 * opcode tuples, the intrinsic-descriptor placeholder, the CFG records, the
 * AST→IL lowering entry point, the deterministic textual printer, and (via the
 * nested barrel) the optimizer pipeline.
 *
 * `test-fixtures.ts` is intentionally **not** re-exported — it is test-only
 * support, not part of the public API (07-testing-strategy.md). The IL is
 * strictly back-end: the frontend/language-server never import this (R15/AR-20).
 */

// Type lattice (§4.1)
export type { ILType } from "./il-type.js";
export { IL_BYTE, IL_SBYTE, IL_WORD, IL_SWORD, ilTypeEquals, ilTypeOfType } from "./il-type.js";

// Operands (§4.2)
export type { ILOperand } from "./operand.js";
export { imm, temp, loc, isImmediate, isTemp, isLocation } from "./operand.js";

// Instructions & terminators (§4.3)
export type { ILInstruction, ILTerminator, ILOp } from "./instruction.js";
export {
  ARITHMETIC_BINARY_OPS,
  BITWISE_BINARY_OPS,
  COMPARISON_OPS,
  CONVERSION_OPS,
  IL_OPS,
} from "./instruction.js";

// Intrinsic descriptor placeholder (RD-17 supersedes additively)
export type { IntrinsicDescriptor } from "./intrinsic-descriptor.js";

// CFG records (§4.4–§4.5)
export type { BasicBlock, ILFunction, ILProgram, ConstDataEntry } from "./cfg.js";

// Builder + lowering (§4.4/§4.12)
export { IlFunctionBuilder } from "./builder.js";
export type { LowerInput } from "./lower.js";
export { lowerToIL } from "./lower.js";

// Textual form (§4.6)
export { printIL, ilTypeTag } from "./print-il.js";

// Optimizer pipeline (§4.11)
export type { ILPass } from "./optimizer/index.js";
export { optimizeIL } from "./optimizer/index.js";
