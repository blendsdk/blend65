/**
 * The 6502 opcode (mnemonic) set.
 *
 * Opcodes are declared as `as const` value tuples (mirroring the IL's `IL_OPS`)
 * so the {@link Opcode} string union is *generated* from the runtime value set
 * and can never drift from it. The NMOS and 65C02 subsets are exported
 * separately so the CPU legality table can partition legality by variant:
 * NMOS targets reject the 65C02-only mnemonics entirely.
 *
 * This module is pure data — no behavior. Validation lives in `validate.ts`,
 * serialization in `print-instr.ts`.
 *
 * Lives in `@blend65/core` (`instr-model/`) so the platform plugin interface
 * (which lives in core) can reference the stream model without a
 * core→codegen dependency; `@blend65/codegen` re-exports it unchanged.
 */

/**
 * The 56 NMOS 6502 mnemonics, in canonical alphabetical order.
 *
 * This is the universal instruction set available on every 6502 target. Any
 * opcode outside this set is a 65C02 extension and is gated behind
 * `cpuVariant === "wdc65c02"` by the CPU table.
 */
export const NMOS_OPCODES = [
  "ADC", "AND", "ASL", "BCC", "BCS", "BEQ", "BIT", "BMI", "BNE", "BPL",
  "BRK", "BVC", "BVS", "CLC", "CLD", "CLI", "CLV", "CMP", "CPX", "CPY",
  "DEC", "DEX", "DEY", "EOR", "INC", "INX", "INY", "JMP", "JSR", "LDA",
  "LDX", "LDY", "LSR", "NOP", "ORA", "PHA", "PHP", "PLA", "PLP", "ROL",
  "ROR", "RTI", "RTS", "SBC", "SEC", "SED", "SEI", "STA", "STX", "STY",
  "TAX", "TAY", "TSX", "TXA", "TXS", "TYA",
] as const;

/**
 * The 9 65C02-only mnemonics — legal only when `cpuVariant === "wdc65c02"`.
 *
 * These are the WDC 65C02 additions Blend65 models (push/pull X/Y, branch-always,
 * store-zero, test-and-reset/set bits, and wait-for-interrupt). On an NMOS target
 * they are illegal and the validator raises an ICE if codegen ever emits one.
 *
 * `WAI` is included to back the 65C02-gated `asm_wai` intrinsic.
 */
export const W65C02_OPCODES = [
  "BRA", "PHX", "PHY", "PLX", "PLY", "STZ", "TRB", "TSB", "WAI",
] as const;

/**
 * Every opcode the model can represent (NMOS ∪ 65C02).
 *
 * The full union the {@link Opcode} type is derived from. Variant gating is a
 * *legality* concern (the CPU table), not a *representability* concern: the model
 * can hold any opcode; the validator decides whether it is legal on the target.
 */
export const OPCODES = [...NMOS_OPCODES, ...W65C02_OPCODES] as const;

/** The typed union of all 6502 mnemonics. */
export type Opcode = (typeof OPCODES)[number];
