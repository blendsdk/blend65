/**
 * The NMOS 6502 instruction timing table.
 *
 * Pure data + lookup for the documented cost of every legal NMOS
 * (opcode, addressing-mode) pair: byte size, base cycles, page-cross penalty,
 * and branch-taken penalty. Transcribed from the canonical NMOS 6502 datasheet
 * timings (the same data VICE and every cycle-exact emulator encode).
 *
 * One table for every consumer — budget assertions, parity scripts, and
 * per-function cost estimates all read the same records. No I/O, no platform
 * imports: like the opcode/mode tuples this module is pure data, so it can
 * live in core and be shared without dependency cycles.
 */

import { NMOS_OPCODES } from "../instr-model/opcode.js";
import type { AddressingMode } from "../instr-model/addressing-mode.js";

/** Cost record for one legal NMOS (opcode, addressing-mode) pair. */
export interface InstrTiming {
  /** Encoded instruction size in bytes (opcode + operand). */
  readonly bytes: 1 | 2 | 3;
  /** Documented cycle count before any penalty applies. */
  readonly baseCycles: number;
  /**
   * +1 when the effective address crosses a page boundary; 0 where the access
   * time is fixed (e.g. STA abs,X always performs the extra cycle). For
   * branches this is the additional +1 when a TAKEN branch crosses a page.
   */
  readonly pageCrossPenalty: 0 | 1;
  /** +1 when a branch is taken (0 for non-branches). */
  readonly branchTakenPenalty: 0 | 1;
}

/**
 * The NMOS subset of the opcode union — the timing table's key domain.
 *
 * Narrowing the key type makes a lookup with a 65C02-only mnemonic a
 * compile-time error rather than a silent zero-cost answer.
 */
export type NmosOpcode = (typeof NMOS_OPCODES)[number];

/**
 * One transcribed datasheet row: opcode, mode, bytes, base cycles, page-cross
 * penalty. The branch-taken penalty is not stored per row — it is implied by
 * the `Relative` mode (branches are the only relative-mode instructions).
 */
type TimingRow = readonly [
  NmosOpcode,
  AddressingMode,
  InstrTiming["bytes"],
  number,
  InstrTiming["pageCrossPenalty"],
];

/**
 * The 151 documented NMOS (opcode, mode) pairs, grouped by instruction family
 * for auditability against the datasheet matrix. Each row is
 * `[opcode, mode, bytes, baseCycles, pageCrossPenalty]`.
 */
const TIMING_ROWS: readonly TimingRow[] = [
  // Load accumulator.
  ["LDA", "Immediate", 2, 2, 0],
  ["LDA", "ZeroPage", 2, 3, 0],
  ["LDA", "ZeroPageX", 2, 4, 0],
  ["LDA", "Absolute", 3, 4, 0],
  ["LDA", "AbsoluteX", 3, 4, 1],
  ["LDA", "AbsoluteY", 3, 4, 1],
  ["LDA", "IndirectX", 2, 6, 0],
  ["LDA", "IndirectY", 2, 5, 1],
  // Store accumulator — writes always pay the indexing cycle, so no penalty.
  ["STA", "ZeroPage", 2, 3, 0],
  ["STA", "ZeroPageX", 2, 4, 0],
  ["STA", "Absolute", 3, 4, 0],
  ["STA", "AbsoluteX", 3, 5, 0],
  ["STA", "AbsoluteY", 3, 5, 0],
  ["STA", "IndirectX", 2, 6, 0],
  ["STA", "IndirectY", 2, 6, 0],
  // Load/store index registers.
  ["LDX", "Immediate", 2, 2, 0],
  ["LDX", "ZeroPage", 2, 3, 0],
  ["LDX", "ZeroPageY", 2, 4, 0],
  ["LDX", "Absolute", 3, 4, 0],
  ["LDX", "AbsoluteY", 3, 4, 1],
  ["LDY", "Immediate", 2, 2, 0],
  ["LDY", "ZeroPage", 2, 3, 0],
  ["LDY", "ZeroPageX", 2, 4, 0],
  ["LDY", "Absolute", 3, 4, 0],
  ["LDY", "AbsoluteX", 3, 4, 1],
  ["STX", "ZeroPage", 2, 3, 0],
  ["STX", "ZeroPageY", 2, 4, 0],
  ["STX", "Absolute", 3, 4, 0],
  ["STY", "ZeroPage", 2, 3, 0],
  ["STY", "ZeroPageX", 2, 4, 0],
  ["STY", "Absolute", 3, 4, 0],
  // ALU ops — all six share the read-op timing group.
  ["ADC", "Immediate", 2, 2, 0],
  ["ADC", "ZeroPage", 2, 3, 0],
  ["ADC", "ZeroPageX", 2, 4, 0],
  ["ADC", "Absolute", 3, 4, 0],
  ["ADC", "AbsoluteX", 3, 4, 1],
  ["ADC", "AbsoluteY", 3, 4, 1],
  ["ADC", "IndirectX", 2, 6, 0],
  ["ADC", "IndirectY", 2, 5, 1],
  ["AND", "Immediate", 2, 2, 0],
  ["AND", "ZeroPage", 2, 3, 0],
  ["AND", "ZeroPageX", 2, 4, 0],
  ["AND", "Absolute", 3, 4, 0],
  ["AND", "AbsoluteX", 3, 4, 1],
  ["AND", "AbsoluteY", 3, 4, 1],
  ["AND", "IndirectX", 2, 6, 0],
  ["AND", "IndirectY", 2, 5, 1],
  ["CMP", "Immediate", 2, 2, 0],
  ["CMP", "ZeroPage", 2, 3, 0],
  ["CMP", "ZeroPageX", 2, 4, 0],
  ["CMP", "Absolute", 3, 4, 0],
  ["CMP", "AbsoluteX", 3, 4, 1],
  ["CMP", "AbsoluteY", 3, 4, 1],
  ["CMP", "IndirectX", 2, 6, 0],
  ["CMP", "IndirectY", 2, 5, 1],
  ["EOR", "Immediate", 2, 2, 0],
  ["EOR", "ZeroPage", 2, 3, 0],
  ["EOR", "ZeroPageX", 2, 4, 0],
  ["EOR", "Absolute", 3, 4, 0],
  ["EOR", "AbsoluteX", 3, 4, 1],
  ["EOR", "AbsoluteY", 3, 4, 1],
  ["EOR", "IndirectX", 2, 6, 0],
  ["EOR", "IndirectY", 2, 5, 1],
  ["ORA", "Immediate", 2, 2, 0],
  ["ORA", "ZeroPage", 2, 3, 0],
  ["ORA", "ZeroPageX", 2, 4, 0],
  ["ORA", "Absolute", 3, 4, 0],
  ["ORA", "AbsoluteX", 3, 4, 1],
  ["ORA", "AbsoluteY", 3, 4, 1],
  ["ORA", "IndirectX", 2, 6, 0],
  ["ORA", "IndirectY", 2, 5, 1],
  ["SBC", "Immediate", 2, 2, 0],
  ["SBC", "ZeroPage", 2, 3, 0],
  ["SBC", "ZeroPageX", 2, 4, 0],
  ["SBC", "Absolute", 3, 4, 0],
  ["SBC", "AbsoluteX", 3, 4, 1],
  ["SBC", "AbsoluteY", 3, 4, 1],
  ["SBC", "IndirectX", 2, 6, 0],
  ["SBC", "IndirectY", 2, 5, 1],
  // Shifts/rotates — read-modify-write, abs,X cost is fixed at 7.
  ["ASL", "Accumulator", 1, 2, 0],
  ["ASL", "ZeroPage", 2, 5, 0],
  ["ASL", "ZeroPageX", 2, 6, 0],
  ["ASL", "Absolute", 3, 6, 0],
  ["ASL", "AbsoluteX", 3, 7, 0],
  ["LSR", "Accumulator", 1, 2, 0],
  ["LSR", "ZeroPage", 2, 5, 0],
  ["LSR", "ZeroPageX", 2, 6, 0],
  ["LSR", "Absolute", 3, 6, 0],
  ["LSR", "AbsoluteX", 3, 7, 0],
  ["ROL", "Accumulator", 1, 2, 0],
  ["ROL", "ZeroPage", 2, 5, 0],
  ["ROL", "ZeroPageX", 2, 6, 0],
  ["ROL", "Absolute", 3, 6, 0],
  ["ROL", "AbsoluteX", 3, 7, 0],
  ["ROR", "Accumulator", 1, 2, 0],
  ["ROR", "ZeroPage", 2, 5, 0],
  ["ROR", "ZeroPageX", 2, 6, 0],
  ["ROR", "Absolute", 3, 6, 0],
  ["ROR", "AbsoluteX", 3, 7, 0],
  // Increment/decrement memory — read-modify-write.
  ["INC", "ZeroPage", 2, 5, 0],
  ["INC", "ZeroPageX", 2, 6, 0],
  ["INC", "Absolute", 3, 6, 0],
  ["INC", "AbsoluteX", 3, 7, 0],
  ["DEC", "ZeroPage", 2, 5, 0],
  ["DEC", "ZeroPageX", 2, 6, 0],
  ["DEC", "Absolute", 3, 6, 0],
  ["DEC", "AbsoluteX", 3, 7, 0],
  // Compare index registers.
  ["CPX", "Immediate", 2, 2, 0],
  ["CPX", "ZeroPage", 2, 3, 0],
  ["CPX", "Absolute", 3, 4, 0],
  ["CPY", "Immediate", 2, 2, 0],
  ["CPY", "ZeroPage", 2, 3, 0],
  ["CPY", "Absolute", 3, 4, 0],
  // Bit test.
  ["BIT", "ZeroPage", 2, 3, 0],
  ["BIT", "Absolute", 3, 4, 0],
  // Jumps and subroutine linkage.
  ["JMP", "Absolute", 3, 3, 0],
  ["JMP", "Indirect", 3, 5, 0],
  ["JSR", "Absolute", 3, 6, 0],
  // Branches: 2 cycles not taken, +1 taken, +1 more taken-across-page.
  ["BCC", "Relative", 2, 2, 1],
  ["BCS", "Relative", 2, 2, 1],
  ["BEQ", "Relative", 2, 2, 1],
  ["BMI", "Relative", 2, 2, 1],
  ["BNE", "Relative", 2, 2, 1],
  ["BPL", "Relative", 2, 2, 1],
  ["BVC", "Relative", 2, 2, 1],
  ["BVS", "Relative", 2, 2, 1],
  // Implied-only operations.
  ["BRK", "Implied", 1, 7, 0],
  ["CLC", "Implied", 1, 2, 0],
  ["CLD", "Implied", 1, 2, 0],
  ["CLI", "Implied", 1, 2, 0],
  ["CLV", "Implied", 1, 2, 0],
  ["DEX", "Implied", 1, 2, 0],
  ["DEY", "Implied", 1, 2, 0],
  ["INX", "Implied", 1, 2, 0],
  ["INY", "Implied", 1, 2, 0],
  ["NOP", "Implied", 1, 2, 0],
  ["PHA", "Implied", 1, 3, 0],
  ["PHP", "Implied", 1, 3, 0],
  ["PLA", "Implied", 1, 4, 0],
  ["PLP", "Implied", 1, 4, 0],
  ["RTI", "Implied", 1, 6, 0],
  ["RTS", "Implied", 1, 6, 0],
  ["SEC", "Implied", 1, 2, 0],
  ["SED", "Implied", 1, 2, 0],
  ["SEI", "Implied", 1, 2, 0],
  ["TAX", "Implied", 1, 2, 0],
  ["TAY", "Implied", 1, 2, 0],
  ["TSX", "Implied", 1, 2, 0],
  ["TXA", "Implied", 1, 2, 0],
  ["TXS", "Implied", 1, 2, 0],
  ["TYA", "Implied", 1, 2, 0],
];

/**
 * Build the nested lookup table once from the transcribed rows.
 *
 * A duplicate (opcode, mode) row is a transcription error and fails loudly at
 * module load — a silent overwrite could mask two conflicting datasheet
 * readings.
 *
 * @returns The immutable opcode → mode → timing lookup.
 */
function buildTimingTable(): ReadonlyMap<NmosOpcode, ReadonlyMap<AddressingMode, InstrTiming>> {
  const table = new Map<NmosOpcode, Map<AddressingMode, InstrTiming>>();
  for (const [opcode, mode, bytes, baseCycles, pageCrossPenalty] of TIMING_ROWS) {
    const row = table.get(opcode) ?? new Map<AddressingMode, InstrTiming>();
    if (row.has(mode)) {
      throw new Error(`duplicate NMOS timing row: ${opcode} ${mode}`);
    }
    row.set(mode, {
      bytes,
      baseCycles,
      pageCrossPenalty,
      // Branches are the only relative-mode instructions, so the taken
      // penalty is implied by the mode rather than stored per row.
      branchTakenPenalty: mode === "Relative" ? 1 : 0,
    });
    table.set(opcode, row);
  }
  return table;
}

/** The immutable NMOS timing lookup, opcode → mode → record. */
const NMOS_TIMING_TABLE = buildTimingTable();

/**
 * Look up the documented NMOS 6502 cost of an (opcode, addressing-mode) pair.
 *
 * The opcode axis is narrowed to {@link NmosOpcode}, so a 65C02-only mnemonic
 * fails at compile time. The mode axis cannot be narrowed by type alone, so an
 * illegal mode for the opcode throws a loud error naming both keys — a lookup
 * never answers `undefined` or a silent zero cost.
 *
 * @param opcode The NMOS mnemonic to cost.
 * @param mode The addressing mode used by the instruction.
 * @returns The documented {@link InstrTiming} record for the pair.
 * @throws {Error} When `mode` is not legal for `opcode` on the NMOS 6502.
 * @example
 * getTiming("LDA", "AbsoluteX"); // { bytes: 3, baseCycles: 4, pageCrossPenalty: 1, branchTakenPenalty: 0 }
 */
export function getTiming(opcode: NmosOpcode, mode: AddressingMode): InstrTiming {
  const timing = NMOS_TIMING_TABLE.get(opcode)?.get(mode);
  if (timing === undefined) {
    throw new Error(`no NMOS 6502 timing for ${opcode} ${mode}: the pair is not a documented legal combination`);
  }
  return timing;
}
