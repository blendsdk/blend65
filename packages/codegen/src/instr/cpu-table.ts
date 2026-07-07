/**
 * The 6502 CPU legality table.
 *
 * Maps each {@link Opcode} to the set of {@link AddressingMode}s legal for it on
 * a given CPU. Two tables are exported:
 *
 * - {@link NMOS_6502_TABLE} — the authoritative NMOS 6502 table (56 mnemonics),
 *   transcribed from the canonical 6502 opcode matrix (the same data ACME, cc65,
 *   and every assembler encode).
 * - {@link W65C02_TABLE} — the NMOS table **plus** the 65C02 extension opcodes
 *   and the extra `ZeroPageIndirect` (`(zp)`) capability on the 8 `(zp)`-capable
 *   opcodes. It is built by cloning the NMOS table and layering extensions, so
 *   the two can never drift.
 *
 * Pure static data + a selector. Validation logic lives in `validate.ts`.
 */

import type { Opcode } from "./opcode.js";
import type { AddressingMode } from "./addressing-mode.js";
import type { CpuVariant } from "./stream.js";

/**
 * Maps each opcode to the set of addressing modes legal for it on a given CPU.
 * A `ReadonlyMap` of `ReadonlySet`s — lookups are O(1) and the data is
 * immutable.
 */
export type CpuTable = ReadonlyMap<Opcode, ReadonlySet<AddressingMode>>;

/**
 * The legal-mode lists for every NMOS 6502 mnemonic, in `[opcode, modes]` rows.
 *
 * Transcribed from the canonical NMOS 6502 opcode matrix. Grouped by family for
 * readability; spec tests (ST-V*) assert representative legal *and* illegal pairs
 * so a transcription slip is caught.
 */
const NMOS_ROWS: readonly (readonly [Opcode, readonly AddressingMode[]])[] = [
  // Load/store accumulator and index registers.
  ["LDA", ["Immediate", "ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX", "AbsoluteY", "IndirectX", "IndirectY"]],
  ["STA", ["ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX", "AbsoluteY", "IndirectX", "IndirectY"]],
  ["LDX", ["Immediate", "ZeroPage", "ZeroPageY", "Absolute", "AbsoluteY"]],
  ["LDY", ["Immediate", "ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX"]],
  ["STX", ["ZeroPage", "ZeroPageY", "Absolute"]],
  ["STY", ["ZeroPage", "ZeroPageX", "Absolute"]],
  // ALU ops sharing the full addressing-mode group.
  ["ADC", ["Immediate", "ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX", "AbsoluteY", "IndirectX", "IndirectY"]],
  ["AND", ["Immediate", "ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX", "AbsoluteY", "IndirectX", "IndirectY"]],
  ["CMP", ["Immediate", "ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX", "AbsoluteY", "IndirectX", "IndirectY"]],
  ["EOR", ["Immediate", "ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX", "AbsoluteY", "IndirectX", "IndirectY"]],
  ["ORA", ["Immediate", "ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX", "AbsoluteY", "IndirectX", "IndirectY"]],
  ["SBC", ["Immediate", "ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX", "AbsoluteY", "IndirectX", "IndirectY"]],
  // Shifts/rotates — accumulator + memory.
  ["ASL", ["Accumulator", "ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX"]],
  ["LSR", ["Accumulator", "ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX"]],
  ["ROL", ["Accumulator", "ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX"]],
  ["ROR", ["Accumulator", "ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX"]],
  // Increment/decrement memory.
  ["INC", ["ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX"]],
  ["DEC", ["ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX"]],
  // Compare index registers.
  ["CPX", ["Immediate", "ZeroPage", "Absolute"]],
  ["CPY", ["Immediate", "ZeroPage", "Absolute"]],
  // Bit test.
  ["BIT", ["ZeroPage", "Absolute"]],
  // Jumps.
  ["JMP", ["Absolute", "Indirect"]],
  ["JSR", ["Absolute"]],
  // Branches (all relative).
  ["BCC", ["Relative"]],
  ["BCS", ["Relative"]],
  ["BEQ", ["Relative"]],
  ["BMI", ["Relative"]],
  ["BNE", ["Relative"]],
  ["BPL", ["Relative"]],
  ["BVC", ["Relative"]],
  ["BVS", ["Relative"]],
  // Implied-only operations (flags, transfers, stack, returns, no-op).
  ["BRK", ["Implied"]],
  ["CLC", ["Implied"]],
  ["CLD", ["Implied"]],
  ["CLI", ["Implied"]],
  ["CLV", ["Implied"]],
  ["DEX", ["Implied"]],
  ["DEY", ["Implied"]],
  ["INX", ["Implied"]],
  ["INY", ["Implied"]],
  ["NOP", ["Implied"]],
  ["PHA", ["Implied"]],
  ["PHP", ["Implied"]],
  ["PLA", ["Implied"]],
  ["PLP", ["Implied"]],
  ["RTI", ["Implied"]],
  ["RTS", ["Implied"]],
  ["SEC", ["Implied"]],
  ["SED", ["Implied"]],
  ["SEI", ["Implied"]],
  ["TAX", ["Implied"]],
  ["TAY", ["Implied"]],
  ["TSX", ["Implied"]],
  ["TXA", ["Implied"]],
  ["TXS", ["Implied"]],
  ["TYA", ["Implied"]],
];

/**
 * The authoritative NMOS 6502 legality table.
 *
 * Built once from {@link NMOS_ROWS}. Any opcode outside this map (i.e. a 65C02
 * extension) is illegal on NMOS targets — `isLegalMode` returns `false` for it.
 */
export const NMOS_6502_TABLE: CpuTable = new Map(
  NMOS_ROWS.map(([opcode, modes]) => [opcode, new Set(modes)]),
);

/**
 * The opcodes that gain the 65C02 `(zp)` indirect mode (`ZeroPageIndirect`).
 *
 * On the 65C02 these eight ALU/load/store opcodes can use `($zp)` indirect
 * addressing without an index register — a mode absent on NMOS.
 */
const ZP_INDIRECT_CAPABLE: readonly Opcode[] = [
  "ADC", "AND", "CMP", "EOR", "LDA", "ORA", "SBC", "STA",
];

/**
 * The 65C02-only opcode rows layered on top of the NMOS table.
 *
 * Branch-always, push/pull X/Y, store-zero, test-and-reset/set bits, and
 * wait-for-interrupt — `WAI`, Implied mode, backing the `asm_wai` intrinsic.
 */
const W65C02_EXTRA_ROWS: readonly (readonly [Opcode, readonly AddressingMode[]])[] = [
  ["BRA", ["Relative"]],
  ["STZ", ["ZeroPage", "ZeroPageX", "Absolute", "AbsoluteX"]],
  ["PHX", ["Implied"]],
  ["PHY", ["Implied"]],
  ["PLX", ["Implied"]],
  ["PLY", ["Implied"]],
  ["TRB", ["ZeroPage", "Absolute"]],
  ["TSB", ["ZeroPage", "Absolute"]],
  ["WAI", ["Implied"]],
];

/**
 * Build the 65C02 table by cloning the NMOS table and layering extensions.
 *
 * Cloning (not re-authoring) guarantees the 65C02 table is a strict superset of
 * the NMOS table: every NMOS legal pair stays legal, and we only *add* the
 * `(zp)` mode and the extension opcodes. This keeps the two tables from
 * ever drifting apart.
 *
 * @returns The fully-built 65C02 legality table.
 */
function buildW65C02Table(): CpuTable {
  const table = new Map<Opcode, Set<AddressingMode>>();
  // Clone every NMOS row (fresh Sets so we never mutate the NMOS table's data).
  for (const [opcode, modes] of NMOS_6502_TABLE) {
    table.set(opcode, new Set(modes));
  }
  // Add the 65C02 (zp) ZeroPageIndirect mode to the capable opcodes.
  for (const opcode of ZP_INDIRECT_CAPABLE) {
    table.get(opcode)?.add("ZeroPageIndirect");
  }
  // Layer the 65C02-only opcodes.
  for (const [opcode, modes] of W65C02_EXTRA_ROWS) {
    table.set(opcode, new Set(modes));
  }
  return table;
}

/**
 * The 65C02 legality table — the NMOS table plus 65C02 extensions.
 */
export const W65C02_TABLE: CpuTable = buildW65C02Table();

/**
 * Select the legality table for a CPU variant.
 *
 * @param cpuVariant The target CPU variant.
 * @returns The {@link CpuTable} for that variant.
 */
export function cpuTableFor(cpuVariant: CpuVariant): CpuTable {
  return cpuVariant === "wdc65c02" ? W65C02_TABLE : NMOS_6502_TABLE;
}
