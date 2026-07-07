/**
 * Specification test for the ZP arg-block floor check.
 *
 * Derived exclusively from the requirement that the core ABI guarantees a
 * ≥4-byte ZP arg-block on every platform, enforced in profile validation —
 * never from reading the implementation.
 */

import { describe, expect, it } from "vitest";

import type { PlatformProfile } from "./platform-profile.js";
import { validateProfileFields } from "./validate-profile.js";

/**
 * A minimal internally-consistent C64 profile whose `zpArgBlockSize` is below the
 * floor of 4. Every other field is consistent so the ONLY flagged problem is
 * the arg-block floor.
 */
const UNDERSIZED_PROFILE: PlatformProfile = {
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
  zpArgBlockSize: 3,
  platformId: "c64",
};

describe("Specification: RD-17 ZP arg-block floor (ST-6)", () => {
  it("ST-6: zpArgBlockSize: 3 is flagged with an error naming the >= 4 floor", () => {
    const errors = validateProfileFields(UNDERSIZED_PROFILE);

    const argBlockError = errors.find((e) => e.field === "zpArgBlockSize");
    expect(argBlockError).toBeDefined();
    expect(argBlockError?.message).toContain("4");
  });

  it("ST-6: zpArgBlockSize: 4 (exact floor) is accepted", () => {
    const errors = validateProfileFields({ ...UNDERSIZED_PROFILE, zpArgBlockSize: 4 });
    expect(errors.some((e) => e.field === "zpArgBlockSize")).toBe(false);
  });
});
