/**
 * The 6502 addressing-mode set — RD-07 §4.1, R4 (+ D8).
 *
 * Like the opcode set, modes are declared as an `as const` value tuple so the
 * {@link AddressingMode} string union is generated from the runtime value set
 * and cannot drift. The order is fixed and meaningful: it is the canonical
 * documented order (03-01) that spec test ST-M3 pins.
 *
 * Pure data — no behavior. Which (opcode, mode) pairs are *legal* is the CPU
 * table's job (03-02); this module only enumerates the representable modes.
 */

/**
 * The 14 addressing modes the model represents (R4 + D8).
 *
 * Modes 0–12 are the classic NMOS 6502 addressing modes. The 14th,
 * `ZeroPageIndirect` (`(zp)`), is the 65C02 indirect-without-index mode (D8);
 * it is representable here but gated to `wdc65c02` by the CPU table. It is kept
 * distinct from `Indirect` (`JMP ($FFFC)`), which is a 3-byte absolute indirect.
 */
export const ADDRESSING_MODES = [
  "Implied", // CLC, RTS, ...
  "Accumulator", // ASL A
  "Immediate", // LDA #$42
  "ZeroPage", // LDA $02
  "ZeroPageX", // LDA $02,X
  "ZeroPageY", // LDX $02,Y
  "Absolute", // LDA $D020
  "AbsoluteX", // LDA $0400,X
  "AbsoluteY", // LDA $0400,Y
  "Indirect", // JMP ($FFFC)  — 16-bit absolute indirect (3 bytes)
  "IndirectX", // LDA ($02,X)
  "IndirectY", // LDA ($02),Y
  "Relative", // BEQ label
  "ZeroPageIndirect", // LDA ($02)  — 65C02 (zp), 8-bit indirect (2 bytes); gated (D8)
] as const;

/** The typed union of all addressing modes (R4 + D8). */
export type AddressingMode = (typeof ADDRESSING_MODES)[number];
