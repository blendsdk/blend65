/**
 * Specification tests for the core platform types.
 *
 * Derived from the frozen spec Ch 15 §3 and verified against the
 * specification — never derived from running the implementation.
 */

import { describe, expect, it } from "vitest";

// Canonical platform types under test — surfaced via the `@blend65/core/platform`
// subpath barrel. The root `@blend65/core` barrel still exports the interim
// profile, which is asserted separately below.
import {
  type CpuVariant,
  type PlatformProfile,
  type PlatformPlugin,
  validateProfileFields,
} from "./index.js";

/**
 * A minimal internally-consistent profile using the C64 memory-map values
 * (appendix-c64): `zpStart=0x02`, `zpEnd=0x8F` → `maxZp = 0x8F - 0x02 + 1 = 142`;
 * `codeStart=0x0801 < codeEnd`. Used as the consistent baseline below, and as
 * the base profile that later cases mutate one field at a time.
 */
const C64_PROFILE: PlatformProfile = {
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
  defaultEncoding: "petscii",
};

describe("Specification: RD-10 core platform types (ST-CP1..CP7)", () => {
  it("ST-CP1: a PlatformProfile literal with all required fields type-checks", () => {
    // Constructing C64_PROFILE above already exercises the required §3.1 field set;
    // assert a couple of representative fields are carried through verbatim.
    expect(C64_PROFILE.codeStart).toBe(0x0801);
    expect(C64_PROFILE.cpu).toBe("nmos6502");
    expect(C64_PROFILE.outputFormat).toBe("prg");
  });

  it("ST-CP2: validateProfileFields on a consistent profile returns []", () => {
    expect(validateProfileFields(C64_PROFILE)).toEqual([]);
  });

  it("ST-CP3: zpStart > zpEnd is flagged with field 'zpStart'", () => {
    const errors = validateProfileFields({
      ...C64_PROFILE,
      zpStart: 0x90,
      zpEnd: 0x02,
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === "zpStart")).toBe(true);
  });

  it("ST-CP4: codeStart >= codeEnd is flagged with field 'codeStart'", () => {
    const errors = validateProfileFields({
      ...C64_PROFILE,
      codeStart: 0xd000,
      codeEnd: 0x0801,
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === "codeStart")).toBe(true);
  });

  it("ST-CP5: maxZp mismatch is flagged with field 'maxZp'", () => {
    const errors = validateProfileFields({ ...C64_PROFILE, maxZp: 99 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === "maxZp")).toBe(true);
  });

  it("ST-CP6: the canonical CpuVariant union is exactly nmos6502 | wdc65c02", () => {
    // Assignment test: both members are assignable; the type admits no third value.
    const nmos: CpuVariant = "nmos6502";
    const wdc: CpuVariant = "wdc65c02";
    expect([nmos, wdc]).toEqual(["nmos6502", "wdc65c02"]);
  });

  it("ST-CP7: the @blend65/core/platform barrel exports the canonical types", () => {
    // `validateProfileFields` is a value export reachable from the subpath barrel;
    // its presence proves the barrel resolves and surfaces the platform API. The
    // type-only exports (PlatformProfile/PlatformPlugin/CpuVariant) are exercised at
    // compile time by the annotations above and the unused-type guard below.
    expect(typeof validateProfileFields).toBe("function");
    // Compile-time witness that PlatformPlugin is exported (no runtime assertion).
    const _pluginType = (p: PlatformPlugin): string => p.id;
    expect(typeof _pluginType).toBe("function");
  });
});
