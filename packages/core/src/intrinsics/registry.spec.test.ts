/**
 * Specification tests for the intrinsic registry.
 *
 * Derived EXCLUSIVELY from the frozen specification — never from reading the
 * implementation (IMMUTABLE ORACLE RULE). Written BEFORE `registry.ts`/
 * `catalog.ts` exist (red phase). If the implementation disagrees with a case
 * here, the implementation is wrong.
 */

import { describe, expect, it } from "vitest";

import type { PlatformProfile } from "../platform/platform-profile.js";
import type { IntrinsicDescriptor } from "./descriptor.js";
import { createIntrinsicRegistry } from "./registry.js";

/**
 * A minimal internally-consistent C64 profile (NMOS 6502) built from the
 * appendix-c64 memory map (mirrors `platform-profile.spec.test.ts`). Only `cpu`
 * and `platformId` matter for availability; the rest satisfies the required-field
 * set. `asm_wai` must be UNAVAILABLE here (NMOS target).
 */
const C64_PROFILE: PlatformProfile = {
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
  platformId: "c64",
  defaultEncoding: "petscii",
};

/**
 * A minimal Commander X16 profile (WDC 65C02). `asm_wai` must be AVAILABLE here
 * (65C02 target). Same memory-map skeleton; only `cpu`/`platformId` differ.
 */
const CX16_PROFILE: PlatformProfile = {
  ...C64_PROFILE,
  cpu: "wdc65c02",
  platformId: "cx16",
};

describe("Specification: RD-17 intrinsic registry (ST-1..ST-4)", () => {
  it("ST-1: get('peek') returns the T2 (addr: word): byte inline descriptor, cost 4 cyc / 3 bytes", () => {
    const registry = createIntrinsicRegistry();
    const peek = registry.get("peek");

    expect(peek).toBeDefined();
    expect(peek?.tier).toBe("T2");
    expect(peek?.loweringStrategy).toBe("inline");
    expect(peek?.signature.params).toHaveLength(1);
    expect(peek?.signature.params[0]?.name).toBe("addr");
    expect(peek?.signature.params[0]?.type).toBe("word");
    expect(peek?.signature.returnType).toBe("byte");
    expect(peek?.costMetadata.cycles).toBe(4);
    expect(peek?.costMetadata.bytes).toBe(3);
  });

  it("ST-2: register() a second descriptor named 'peek' throws Error (AR-P9)", () => {
    const registry = createIntrinsicRegistry();
    const duplicate: IntrinsicDescriptor = {
      name: "peek",
      tier: "T2",
      signature: { params: [{ name: "addr", type: "word" }], returnType: "byte" },
      availability: () => true,
      loweringStrategy: "inline",
      costMetadata: { cycles: 4, bytes: 3, zpBytes: 0 },
      clobberList: ["A"],
      description: "duplicate",
    };

    expect(() => registry.register(duplicate)).toThrow(Error);
  });

  it("ST-3: isReserved is true for user-visible names, false for __rt_* and user identifiers", () => {
    const registry = createIntrinsicRegistry();

    expect(registry.isReserved("poke")).toBe(true);
    expect(registry.isReserved("__rt_mul8")).toBe(false);
    expect(registry.isReserved("myFn")).toBe(false);
  });

  it("ST-4: getAvailable excludes asm_wai on c64 (NMOS) and includes it on cx16 (65C02)", () => {
    const registry = createIntrinsicRegistry();

    const c64Names = registry.getAvailable(C64_PROFILE).map((d) => d.name);
    const cx16Names = registry.getAvailable(CX16_PROFILE).map((d) => d.name);

    expect(c64Names).not.toContain("asm_wai");
    expect(cx16Names).toContain("asm_wai");
  });
});
