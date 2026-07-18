/**
 * Implementation tests for the NMOS 6502 timing table.
 *
 * Structural invariants over the whole table — byte sizes implied by the
 * addressing mode, penalty placement, cycle bounds, and record count. These
 * complement the specification tests, which pin individual reference records.
 */

import { describe, expect, it } from "vitest";

import { ADDRESSING_MODES, NMOS_OPCODES } from "../instr-model/index.js";
import type { AddressingMode } from "../instr-model/index.js";
import { getTiming } from "./index.js";
import type { InstrTiming, NmosOpcode } from "./index.js";

/** Probe one pair, mapping the illegal-pair throw to `null` for enumeration. */
function timingOrNull(opcode: NmosOpcode, mode: AddressingMode): InstrTiming | null {
  try {
    return getTiming(opcode, mode);
  } catch {
    return null;
  }
}

/** Every (opcode, mode, timing) record the table answers, by exhaustive probe. */
function allRecords(): { opcode: NmosOpcode; mode: AddressingMode; timing: InstrTiming }[] {
  const records: { opcode: NmosOpcode; mode: AddressingMode; timing: InstrTiming }[] = [];
  for (const opcode of NMOS_OPCODES) {
    for (const mode of ADDRESSING_MODES) {
      const timing = timingOrNull(opcode, mode);
      if (timing !== null) {
        records.push({ opcode, mode, timing });
      }
    }
  }
  return records;
}

/** The encoded instruction size each addressing mode implies. */
const BYTES_BY_MODE: Record<AddressingMode, 1 | 2 | 3> = {
  Implied: 1,
  Accumulator: 1,
  Immediate: 2,
  ZeroPage: 2,
  ZeroPageX: 2,
  ZeroPageY: 2,
  IndirectX: 2,
  IndirectY: 2,
  Relative: 2,
  ZeroPageIndirect: 2,
  Absolute: 3,
  AbsoluteX: 3,
  AbsoluteY: 3,
  Indirect: 3,
};

describe("Implementation: NMOS timing table invariants", () => {
  const records = allRecords();

  it("should answer exactly the 151 documented pairs, covering every NMOS opcode", () => {
    expect(records).toHaveLength(151);
    const covered = new Set(records.map((r) => r.opcode));
    expect(covered.size).toBe(NMOS_OPCODES.length);
  });

  it("should never answer for the 65C02-only ZeroPageIndirect mode", () => {
    expect(records.some((r) => r.mode === "ZeroPageIndirect")).toBe(false);
  });

  it("should report the byte size implied by each addressing mode", () => {
    for (const { opcode, mode, timing } of records) {
      expect(timing.bytes, `${opcode} ${mode}`).toBe(BYTES_BY_MODE[mode]);
    }
  });

  it("should keep base cycles within the documented 2..7 range", () => {
    for (const { opcode, mode, timing } of records) {
      expect(timing.baseCycles, `${opcode} ${mode}`).toBeGreaterThanOrEqual(2);
      expect(timing.baseCycles, `${opcode} ${mode}`).toBeLessThanOrEqual(7);
    }
  });

  it("should place the branch-taken penalty on relative mode only", () => {
    for (const { opcode, mode, timing } of records) {
      expect(timing.branchTakenPenalty, `${opcode} ${mode}`).toBe(mode === "Relative" ? 1 : 0);
    }
  });

  it("should place page-cross penalties only on indexed reads and taken branches", () => {
    // Only these modes can cross a page during effective-address formation
    // (plus Relative for taken branches); everywhere else the cost is fixed.
    const variableModes: readonly AddressingMode[] = [
      "AbsoluteX",
      "AbsoluteY",
      "IndirectY",
      "Relative",
    ];
    // Stores and read-modify-write instructions always perform the extra
    // cycle, so their indexed forms are fixed-cost.
    const fixedCostOpcodes: readonly NmosOpcode[] = [
      "STA", "STX", "STY", "ASL", "LSR", "ROL", "ROR", "INC", "DEC",
    ];
    for (const { opcode, mode, timing } of records) {
      const expected =
        variableModes.includes(mode) && !fixedCostOpcodes.includes(opcode) ? 1 : 0;
      expect(timing.pageCrossPenalty, `${opcode} ${mode}`).toBe(expected);
    }
  });
});
