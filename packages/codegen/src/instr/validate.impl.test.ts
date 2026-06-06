/**
 * Implementation tests for the RD-07a CPU table + validator.
 *
 * These cover internal invariants beyond the specification oracles
 * (validate.spec.test.ts): table completeness (every NMOS opcode has a non-empty
 * mode set), `isLegalMode` totality across the full opcode × mode grid (never
 * throws), and the 65C02 ⊇ NMOS superset property (D8). They guard against
 * transcription slips and accidental table drift.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, makeSpan } from "@blend65/core";

import { OPCODES, NMOS_OPCODES } from "./opcode.js";
import { ADDRESSING_MODES } from "./addressing-mode.js";
import { NMOS_6502_TABLE, W65C02_TABLE, cpuTableFor } from "./cpu-table.js";
import { isLegalMode, validateStream } from "./validate.js";
import { instr } from "./stream.js";
import { none } from "./operand.js";

describe("CpuTable completeness", () => {
  it("should have a non-empty legal-mode set for every NMOS opcode", () => {
    for (const opcode of NMOS_OPCODES) {
      const modes = NMOS_6502_TABLE.get(opcode);
      expect(modes, `NMOS table missing ${opcode}`).toBeDefined();
      expect(modes?.size ?? 0).toBeGreaterThan(0);
    }
  });

  it("should not contain any 65C02-only opcode in the NMOS table", () => {
    // STZ/BRA/PHX/... must be absent from the NMOS table entirely.
    expect(NMOS_6502_TABLE.has("STZ")).toBe(false);
    expect(NMOS_6502_TABLE.has("BRA")).toBe(false);
    expect(NMOS_6502_TABLE.has("PHX")).toBe(false);
  });

  it("should expose every 65C02-only opcode in the 65C02 table", () => {
    for (const opcode of ["BRA", "PHX", "PHY", "PLX", "PLY", "STZ", "TRB", "TSB"] as const) {
      const modes = W65C02_TABLE.get(opcode);
      expect(modes, `65C02 table missing ${opcode}`).toBeDefined();
      expect(modes?.size ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("65C02 table is a strict superset of NMOS (D8)", () => {
  it("should keep every NMOS legal pair legal on 65C02", () => {
    for (const [opcode, modes] of NMOS_6502_TABLE) {
      for (const mode of modes) {
        expect(
          isLegalMode(opcode, mode, "wdc65c02"),
          `${opcode} ${mode} legal on NMOS but not 65C02`,
        ).toBe(true);
      }
    }
  });

  it("should add ZeroPageIndirect to exactly the (zp)-capable opcodes", () => {
    const capable = ["ADC", "AND", "CMP", "EOR", "LDA", "ORA", "SBC", "STA"] as const;
    for (const opcode of capable) {
      expect(isLegalMode(opcode, "ZeroPageIndirect", "wdc65c02")).toBe(true);
      expect(isLegalMode(opcode, "ZeroPageIndirect", "nmos6502")).toBe(false);
    }
    // A non-capable opcode (LDX) must NOT gain ZeroPageIndirect on 65C02.
    expect(isLegalMode("LDX", "ZeroPageIndirect", "wdc65c02")).toBe(false);
  });
});

describe("isLegalMode totality (never throws over the full grid)", () => {
  it("should return a boolean for every opcode × mode × variant combination", () => {
    for (const opcode of OPCODES) {
      for (const mode of ADDRESSING_MODES) {
        for (const variant of ["nmos6502", "wdc65c02"] as const) {
          expect(typeof isLegalMode(opcode, mode, variant)).toBe("boolean");
        }
      }
    }
  });
});

describe("cpuTableFor selection", () => {
  it("should return the NMOS table for nmos6502 and the 65C02 table for wdc65c02", () => {
    expect(cpuTableFor("nmos6502")).toBe(NMOS_6502_TABLE);
    expect(cpuTableFor("wdc65c02")).toBe(W65C02_TABLE);
  });
});

describe("validateStream accumulates multiple ICEs", () => {
  it("should report one ICE per illegal instruction in the stream", () => {
    const bag = createDiagnosticBag();
    // Distinct spans so the two ICEs are not deduplicated by the bag (the bag
    // collapses identical span-less ICEs on (code, null) — a bag policy, not a
    // validator concern). Distinct spans verify the validator visits each entry.
    validateStream(
      {
        symbol: "buggy",
        segment: "code",
        entries: [
          instr("LDA", "Implied", none(), makeSpan(0, 0, 1)), // illegal
          instr("RTS", "Implied", none(), makeSpan(0, 1, 2)), // legal
          instr("JSR", "ZeroPage", none(), makeSpan(0, 2, 3)), // illegal
        ],
      },
      "nmos6502",
      bag,
    );
    expect(bag.getErrors()).toHaveLength(2);
  });

  it("should leave the bag clean for a fully legal stream", () => {
    const bag = createDiagnosticBag();
    validateStream(
      { symbol: "ok", segment: "code", entries: [instr("RTS", "Implied", none())] },
      "nmos6502",
      bag,
    );
    expect(bag.hasErrors()).toBe(false);
  });
});
