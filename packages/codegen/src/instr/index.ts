/**
 * Public barrel for the RD-07a Instr model (`instr/`).
 *
 * Re-exports the complete target-specific 6502 instruction vocabulary — the
 * opcode/addressing-mode value tuples and types, the symbolic operand union with
 * its constructors/guards, the stream-entry/stream records with their
 * constructors/guards, the `CpuVariant` primitive, the CPU legality table +
 * validator, and the canonical ACME serializer + byte sizer.
 *
 * `test-fixtures.ts` is intentionally **not** re-exported — it is test-only
 * support, not part of the public API (07-testing-strategy.md). Like `il/`, the
 * Instr model is strictly back-end: the frontend/language-server never import it
 * (R15/AR-20).
 */

// Opcodes (§4.1)
export type { Opcode } from "./opcode.js";
export { OPCODES, NMOS_OPCODES, W65C02_OPCODES } from "./opcode.js";

// Addressing modes (§4.1)
export type { AddressingMode } from "./addressing-mode.js";
export { ADDRESSING_MODES } from "./addressing-mode.js";

// Operands (§4.2)
export type { InstrOperand } from "./operand.js";
export {
  none,
  imm8,
  symbolRef,
  labelRef,
  zpSlot,
  isImmediateOperand,
  isSymbolRef,
  isLabelRef,
  isZpSlot,
} from "./operand.js";

// Stream entries & container (§4.3)
export type { CpuVariant, AcmeDirective, StreamEntry, InstrStream } from "./stream.js";
export { instr, label, directive, isInstr, isLabel, isDirective } from "./stream.js";

// CPU legality table (§4.8)
export type { CpuTable } from "./cpu-table.js";
export { NMOS_6502_TABLE, W65C02_TABLE, cpuTableFor } from "./cpu-table.js";

// Validator (§4.8)
export { isLegalMode, validateStream } from "./validate.js";

// Canonical ACME serializer + byte sizing (§3.8 / Ch 11 §6)
export { printInstr, instrByteSize } from "./print-instr.js";

// IL→Instr translation entry point + program container (RD-07b, §4.3/§4.7)
export type { InstrProgram } from "./instr-program.js";
export { generateInstr, programByteSize } from "./instr-program.js";

