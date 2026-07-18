/**
 * Specification tests for timing-table coverage against the CPU legality table.
 *
 * Every (opcode, mode) pair the NMOS legality table declares legal must have a
 * timing record — a coverage gap would silently under-cost generated code.
 * 65C02-only opcodes are outside the NMOS timing domain and must be rejected
 * at compile time, never costed as a silent 0.
 *
 * This test lives in codegen (which may import core) so the legality table and
 * the timing table can be cross-checked without core depending on codegen.
 */

import { describe, expect, it } from "vitest";
import { getTiming } from "@blend65/core/platform";

import { NMOS_OPCODES } from "./opcode.js";
import { NMOS_6502_TABLE } from "./cpu-table.js";

describe("Specification: timing coverage — every legal NMOS pair is costed", () => {
  it("should return a timing record for every legal (opcode, mode) pair in the NMOS table", () => {
    let pairs = 0;
    for (const opcode of NMOS_OPCODES) {
      const modes = NMOS_6502_TABLE.get(opcode);
      expect(modes, `legality table row missing for ${opcode}`).toBeDefined();
      for (const mode of modes ?? []) {
        const timing = getTiming(opcode, mode);
        expect(timing.baseCycles, `${opcode} ${mode}`).toBeGreaterThan(0);
        expect(timing.bytes, `${opcode} ${mode}`).toBeGreaterThanOrEqual(1);
        pairs += 1;
      }
    }
    // The canonical documented NMOS 6502 matrix has 151 (opcode, mode) pairs.
    expect(pairs).toBe(151);
  });
});

describe("Specification: timing coverage — 65C02 opcodes are outside the domain", () => {
  it("should reject a 65C02-only opcode at compile time and throw at runtime", () => {
    const lookup = () =>
      // @ts-expect-error — STZ is a 65C02 extension; the timing table's opcode
      // parameter admits only NMOS mnemonics.
      getTiming("STZ", "Absolute");
    expect(lookup).toThrowError(/STZ/);
  });
});
