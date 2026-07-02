/**
 * Implementation tests for the RD-17 intrinsic registry & catalog.
 *
 * Unlike the spec tier, these MAY read the implementation. They cover internals:
 * `getAvailable` filtering across all five real platform CPU variants, TypeRef
 * shape coverage, the internal `__rt_*` routines' registered-but-not-reserved
 * behaviour, and registry set-size growth.
 */

import { describe, expect, it } from "vitest";

import type { PlatformProfile } from "../platform/platform-profile.js";
import { RESERVED_BUILTINS } from "../ast/reserved-builtins.js";
import { CORE_INTRINSICS, RT_ROUTINES } from "./catalog.js";
import type { IntrinsicDescriptor, TypeRef } from "./descriptor.js";
import { createIntrinsicRegistry } from "./registry.js";

/** A canonical-shaped profile skeleton; per-platform variants override cpu/id. */
const BASE_PROFILE: PlatformProfile = {
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

/** The five shipped platforms by (id, cpu) — only cx16 is a 65C02 (R24). */
const REAL_PROFILES: readonly PlatformProfile[] = [
  { ...BASE_PROFILE, platformId: "c64", cpu: "nmos6502" },
  { ...BASE_PROFILE, platformId: "c64u", cpu: "nmos6502" },
  { ...BASE_PROFILE, platformId: "cx16", cpu: "wdc65c02" },
  { ...BASE_PROFILE, platformId: "a800xl", cpu: "nmos6502" },
  { ...BASE_PROFILE, platformId: "a7800", cpu: "nmos6502" },
];

describe("IntrinsicRegistry — getAvailable across the five real platforms", () => {
  it("exposes asm_wai only on the 65C02 platform (cx16)", () => {
    const registry = createIntrinsicRegistry();
    for (const profile of REAL_PROFILES) {
      const hasWai = registry.getAvailable(profile).some((d) => d.name === "asm_wai");
      expect(hasWai, profile.platformId).toBe(profile.cpu === "wdc65c02");
    }
  });

  it("keeps every non-gated intrinsic available on every platform", () => {
    const registry = createIntrinsicRegistry();
    const gated = new Set(["asm_wai"]);
    const alwaysOn = registry.getAll().filter((d) => !gated.has(d.name));
    for (const profile of REAL_PROFILES) {
      const available = new Set(registry.getAvailable(profile).map((d) => d.name));
      for (const d of alwaysOn) {
        expect(available.has(d.name), `${d.name} on ${profile.platformId}`).toBe(true);
      }
    }
  });

  it("includes the internal __rt_* routines in getAvailable (availability = all)", () => {
    const registry = createIntrinsicRegistry();
    const names = registry.getAvailable(REAL_PROFILES[0]!).map((d) => d.name);
    expect(names).toContain("__rt_mul8");
    expect(names).toContain("__rt_div16");
  });
});

describe("IntrinsicRegistry — internal routines vs reserved names", () => {
  it("registers __rt_* routines (get) but never reports them reserved (isReserved)", () => {
    const registry = createIntrinsicRegistry();
    for (const routine of RT_ROUTINES) {
      expect(registry.get(routine.name), routine.name).toBeDefined();
      expect(registry.isReserved(routine.name), routine.name).toBe(false);
    }
  });

  it("reports every user-visible catalog name as reserved", () => {
    const registry = createIntrinsicRegistry();
    for (const descriptor of CORE_INTRINSICS) {
      expect(registry.isReserved(descriptor.name), descriptor.name).toBe(true);
    }
  });

  it("mirrors RESERVED_BUILTINS exactly for the reserved user-visible names", () => {
    const registry = createIntrinsicRegistry();
    for (const name of RESERVED_BUILTINS) {
      expect(registry.isReserved(name), name).toBe(true);
    }
    // No user-visible catalog name is missing from RESERVED_BUILTINS and vice versa.
    expect(new Set(CORE_INTRINSICS.map((d) => d.name))).toEqual(new Set(RESERVED_BUILTINS));
  });
});

describe("IntrinsicRegistry — set growth & duplicate protection", () => {
  it("getAll holds the 23 user-visible + 4 internal routines (27 total)", () => {
    const registry = createIntrinsicRegistry();
    expect(CORE_INTRINSICS).toHaveLength(23);
    expect(RT_ROUTINES).toHaveLength(4);
    expect(registry.getAll()).toHaveLength(27);
  });

  it("merges platform T4 descriptors on top of the core catalog", () => {
    const t4: IntrinsicDescriptor = {
      name: "fix_probe",
      tier: "T4",
      signature: { params: [], returnType: "void" },
      availability: (p) => p.platformId === "c64",
      loweringStrategy: "call",
      costMetadata: { cycles: "varies", bytes: "varies", zpBytes: 0 },
      clobberList: ["A"],
      description: "test fixture",
      asmModulePath: "runtime/fix_probe.asm",
    };
    const registry = createIntrinsicRegistry([t4]);
    expect(registry.get("fix_probe")).toBeDefined();
    expect(registry.isReserved("fix_probe")).toBe(true);
    expect(registry.getAll()).toHaveLength(28);
  });

  it("throws on a duplicate core name passed as a platform descriptor (AR-P9)", () => {
    const dupe: IntrinsicDescriptor = {
      name: "peek",
      tier: "T2",
      signature: { params: [{ name: "addr", type: "word" }], returnType: "byte" },
      availability: () => true,
      loweringStrategy: "inline",
      costMetadata: { cycles: 4, bytes: 3, zpBytes: 0 },
      clobberList: ["A"],
      description: "dupe",
    };
    expect(() => createIntrinsicRegistry([dupe])).toThrow(Error);
  });
});

describe("IntrinsicDescriptor — TypeRef shapes in the catalog", () => {
  it("covers the scalar TypeRef spellings used by the catalog signatures", () => {
    const seen = new Set<string>();
    for (const d of [...CORE_INTRINSICS, ...RT_ROUTINES]) {
      for (const p of d.signature.params) {
        if (typeof p.type === "string") seen.add(p.type);
      }
      if (typeof d.signature.returnType === "string") seen.add(d.signature.returnType);
    }
    // The catalog uses these scalar spellings; 'boolean' matches the semantic type
    // system (RD-17 §4.1).
    expect(seen.has("byte")).toBe(true);
    expect(seen.has("word")).toBe(true);
    expect(seen.has("void")).toBe(true);
  });

  it("admits the compound pointer/array TypeRef shapes (ABI marshalling view)", () => {
    const ptr: TypeRef = { kind: "pointer", elementType: "byte" };
    const arr: TypeRef = { kind: "array", elementType: { kind: "pointer", elementType: "word" } };
    expect(typeof ptr).toBe("object");
    expect(arr).toMatchObject({ kind: "array" });
  });
});
