/**
 * Public barrel for the pure-data 6502 Instr/stream model
 * (`@blend65/core/instr-model`).
 *
 * Re-exports the opcode/addressing-mode value tuples and types, the symbolic
 * operand union with its constructors/guards, the stream-entry/stream records
 * with their constructors/guards, and the canonical `CpuVariant` primitive.
 *
 * This model lives in `@blend65/core` so the `PlatformPlugin` interface
 * (which lives in core) can reference `StreamEntry`/`AcmeDirective` without a
 * core→codegen dependency. `@blend65/codegen` re-exports every symbol here
 * from its own `instr/` barrel, so all import paths and tests resolve **by
 * value** unchanged — only the definition site moved.
 *
 * This barrel is surfaced to other packages through the single
 * `@blend65/core/platform` subpath (no second package export is added); see
 * `../platform/index.ts`.
 */

// CPU variant primitive
export type { CpuVariant } from "./cpu-variant.js";

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
  labelRef,
  zpSlot,
  isImmediateOperand,
  isSymbolRef,
  isLabelRef,
  isZpSlot,
} from "./operand.js";

// Stream entries & container
export type { AcmeDirective, StreamEntry, InstrStream } from "./stream.js";
export { instr, label, directive, isInstr, isLabel, isDirective } from "./stream.js";
