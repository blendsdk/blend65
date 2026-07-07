/**
 * Implementation tests for `validateProfileFields` edge cases.
 *
 * Written after the implementation: these probe internal behavior the spec
 * tests do not pin — multiple simultaneous errors and the `zpStart === zpEnd`
 * boundary — rather than re-asserting the specification oracle.
 */

import { describe, expect, it } from "vitest";

import type { PlatformProfile } from "./platform-profile.js";
import { validateProfileFields } from "./validate-profile.js";

/**
 * A consistent baseline profile (C64 memory-map values). `maxZp = 142` matches
 * `zpEnd(0x8F) - zpStart(0x02) + 1`.
 */
const BASE: PlatformProfile = {
  platformId: "c64",
  codeStart: 0x0801,
  codeEnd: 0xcfff,
  dataStart: 0xc000,
  dataEnd: 0xcfff,
  ramStart: 0x0801,
  ramEnd: 0xcfff,
  zpStart: 0x02,
  zpEnd: 0x8f,
  stackReserve: 16,
  maxBinarySize: 0xc7ff,
  maxRam: 0xc7ff,
  maxZp: 142,
  stackBudget: 240,
  outputFormat: "prg",
  loadAddress: 0x0801,
  cpu: "nmos6502",
  zpArgBlockSize: 8,
};

describe("validateProfileFields — edge cases (impl)", () => {
  it("collects multiple simultaneous errors in one pass", () => {
    // Break all three invariants at once: zpStart>zpEnd, codeStart>=codeEnd,
    // and a maxZp that matches neither window.
    const errors = validateProfileFields({
      ...BASE,
      zpStart: 0x90,
      zpEnd: 0x02,
      codeStart: 0xd000,
      codeEnd: 0x0801,
      maxZp: 999,
    });
    const fields = errors.map((e) => e.field).sort();
    expect(fields).toEqual(["codeStart", "maxZp", "zpStart"]);
  });

  it("accepts the boundary zpStart === zpEnd (single-byte ZP window)", () => {
    // A one-byte zero-page window is valid: zpStart <= zpEnd holds, and
    // maxZp must equal exactly 1 (zpEnd - zpStart + 1).
    const errors = validateProfileFields({
      ...BASE,
      zpStart: 0x10,
      zpEnd: 0x10,
      maxZp: 1,
    });
    expect(errors).toEqual([]);
  });

  it("flags maxZp when the single-byte window budget is wrong", () => {
    const errors = validateProfileFields({
      ...BASE,
      zpStart: 0x10,
      zpEnd: 0x10,
      maxZp: 2,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.field).toBe("maxZp");
  });

  it("includes the offending values in the diagnostic message", () => {
    const errors = validateProfileFields({ ...BASE, maxZp: 99 });
    expect(errors).toHaveLength(1);
    // Message names both the supplied and expected ZP budget for actionability.
    expect(errors[0]?.message).toContain("99");
    expect(errors[0]?.message).toContain("142");
  });
});
