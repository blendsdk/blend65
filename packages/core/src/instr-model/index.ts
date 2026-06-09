/**
 * Public barrel for the relocated pure-data 6502 Instr/stream model
 * (`@blend65/core/instr-model`) — RD-10 D7/D8.
 *
 * Re-exports the opcode/addressing-mode value tuples and types, the symbolic
 * operand union with its constructors/guards, the stream-entry/stream records
 * with their constructors/guards, and the canonical `CpuVariant` primitive (D2).
 *
 * This is the model RD-07a originally defined in `@blend65/codegen/src/instr/`.
 * It was promoted to `@blend65/core` (D7) so the `PlatformPlugin` interface
 * (which lives in core, R2/AR-20) can reference `StreamEntry`/`AcmeDirective`
 * without a core→codegen dependency. `@blend65/codegen` re-exports every symbol
 * here from its own `instr/` barrel, so all shipped RD-07a/07b import paths and
 * tests resolve **by value** unchanged — only the definition site moved.
 *
 * Per D8 this barrel is surfaced to other packages through the single
 * `@blend65/core/platform` subpath (no second package export is added); see
 * `../platform/index.ts`.
 */

// CPU variant primitive (§4.3, D2)
export type { CpuVariant } from "./cpu-variant.js";

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
export type { AcmeDirective, StreamEntry, InstrStream } from "./stream.js";
export { instr, label, directive, isInstr, isLabel, isDirective } from "./stream.js";
