/**
 * Public barrel for the Intermediate Language (`il/`).
 *
 * Re-exports the complete IL vocabulary — the erased type lattice, the operand
 * union and its constructors/guards, the instruction/terminator unions and
 * opcode tuples, the intrinsic-descriptor placeholder, the CFG records, the
 * AST→IL lowering entry point, the deterministic textual printer, and (via the
 * nested barrel) the optimizer pipeline.
 *
 * `test-fixtures.ts` is intentionally **not** re-exported — it is test-only
 * support, not part of the public API. The IL is strictly back-end: the
 * frontend/language-server never import this.
 */

// Type lattice
export type { ILType } from "./il-type.js";
export { IL_BYTE, IL_SBYTE, IL_WORD, IL_SWORD, ilTypeEquals, ilTypeOfType } from "./il-type.js";

// Operands
export type { ILOperand } from "./operand.js";
export { imm, temp, loc, isImmediate, isTemp, isLocation } from "./operand.js";

// Instructions & terminators
export type { ILInstruction, ILTerminator, ILOp } from "./instruction.js";
export {
  ARITHMETIC_BINARY_OPS,
  BITWISE_BINARY_OPS,
  COMPARISON_OPS,
  CONVERSION_OPS,
  IL_OPS,
} from "./instruction.js";

// Intrinsic descriptor placeholder (superseded additively as the taxonomy grows)
export type { IntrinsicDescriptor } from "./intrinsic-descriptor.js";

// CFG records
export type { BasicBlock, ILFunction, ILProgram, ConstDataEntry } from "./cfg.js";

// Builder + lowering
export { IlFunctionBuilder } from "./builder.js";
export type { LowerInput } from "./lower.js";
export { lowerToIL } from "./lower.js";

// Textual form
export { printIL, ilTypeTag } from "./print-il.js";

// Optimizer pipeline
export type { ILPass } from "./optimizer/index.js";
export { optimizeIL } from "./optimizer/index.js";
