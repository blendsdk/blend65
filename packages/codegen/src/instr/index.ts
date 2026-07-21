/**
 * Public barrel for the Instr model (`instr/`).
 *
 * Re-exports the complete target-specific 6502 instruction vocabulary — the
 * opcode/addressing-mode value tuples and types, the symbolic operand union with
 * its constructors/guards, the stream-entry/stream records with their
 * constructors/guards, the `CpuVariant` primitive, the CPU legality table +
 * validator, and the canonical ACME serializer + byte sizer.
 *
 * `test-fixtures.ts` is intentionally **not** re-exported — it is test-only
 * support, not part of the public API. Like `il/`, the Instr model is strictly
 * back-end: the frontend/language-server never import it.
 */

// Opcodes
export type { Opcode } from "./opcode.js";
export { OPCODES, NMOS_OPCODES, W65C02_OPCODES } from "./opcode.js";

// Addressing modes
export type { AddressingMode } from "./addressing-mode.js";
export { ADDRESSING_MODES } from "./addressing-mode.js";

// Operands
export type { InstrOperand } from "./operand.js";
export {
  none,
  imm8,
  symbolRef,
  symbolExpr,
  labelRef,
  zpSlot,
  isImmediateOperand,
  isSymbolRef,
  isSymbolExprOperand,
  isLabelRef,
  isZpSlot,
} from "./operand.js";

// Stream entries & container
export type { CpuVariant, AcmeDirective, StreamEntry, InstrStream } from "./stream.js";
export { instr, label, directive, isInstr, isLabel, isDirective } from "./stream.js";

// CPU legality table
export type { CpuTable } from "./cpu-table.js";
export { NMOS_6502_TABLE, W65C02_TABLE, cpuTableFor } from "./cpu-table.js";

// Validator
export { isLegalMode, validateStream } from "./validate.js";

// Canonical ACME serializer + byte sizing
export { printInstr, instrByteSize, hex16 } from "./print-instr.js";

// Whole-program ACME serializer
export { serializeToAcme } from "./serialize-acme.js";

// IL→Instr translation entry point + program container
// + the platform-preamble assembler wrapper (Half A).
export type { InstrProgram } from "./instr-program.js";
export { generateInstr, assembleProgram, programByteSize } from "./instr-program.js";

// Per-function straight-line cost summaries for the resource report.
export type { FunctionCostSummary } from "./function-costs.js";
export { summarizeFunctionCosts, NO_TIMING_DATA_LABEL } from "./function-costs.js";

// Peephole optimizer (passthrough v1)
export type { PeepholeRule, PeepholeOptions, InstrEntry } from "./peephole.js";
export { optimizeInstr, validateProgramStructure, V1_RULES } from "./peephole.js";

// Branch relaxation — the unconditional post-translation range fix.
export { relaxBranches } from "./relax-branches.js";
