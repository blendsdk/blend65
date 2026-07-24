import { describe, expect, it, vi } from "vitest";

import {
  canonicalUnsignedDecimal,
  copyUint8Array,
  encodeCanonicalIdentity,
  generationConfigurationFields,
  hashCanonicalIdentity,
  isSha256Digest,
  normalizeGenerationConfiguration,
  normalizeGenerationPath,
} from "./canonical-identity.js";

function validConfiguration() {
  return {
    caseCount: 4,
    maxInvalidCases: 1,
    enabledRuleIds: ["S3-T1", "S3-T2"],
    spellings: ["const", "literal", "local", "parameter"],
    budget: {
      maxModules: 1,
      maxDeclarations: 4,
      maxIrNodes: 32,
      maxStatements: 16,
      maxExpressionDepth: 4,
      maxLoopWork: 32n,
      maxSourceBytes: 2048,
      maxAttempts: 64,
    },
  };
}

describe("canonical identity encoding", () => {
  it("uses u32-BE domain, count, name and value lengths in exact field order", () => {
    const encoded = encodeCanonicalIdentity("blend65-case-v1", [
      { name: "a", value: "xy" },
      { name: "b", value: Uint8Array.of(0xff) },
    ]);
    const prefix = [
      0,
      0,
      0,
      15,
      ...new TextEncoder().encode("blend65-case-v1"),
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      1,
      0x61,
      0,
      0,
      0,
      2,
      0x78,
      0x79,
      0,
      0,
      0,
      1,
      0x62,
      0,
      0,
      0,
      1,
      0xff,
    ];

    expect([...encoded]).toEqual(prefix);
    expect(hashCanonicalIdentity(encoded)).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("normalizes a configuration into frozen fixed-order fields", () => {
    const result = normalizeGenerationConfiguration(validConfiguration());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Object.isFrozen(result.configuration)).toBe(true);
    expect(Object.isFrozen(result.configuration.enabledRuleIds)).toBe(true);
    expect(Object.isFrozen(result.configuration.spellings)).toBe(true);
    expect(Object.isFrozen(result.configuration.budget)).toBe(true);
    expect(generationConfigurationFields(result.configuration).map((field) => field.name)).toEqual([
      "caseCount",
      "maxInvalidCases",
      "enabledRuleIds",
      "spellings",
      "budget.maxModules",
      "budget.maxDeclarations",
      "budget.maxIrNodes",
      "budget.maxStatements",
      "budget.maxExpressionDepth",
      "budget.maxLoopWork",
      "budget.maxSourceBytes",
      "budget.maxAttempts",
    ]);
    expect(canonicalUnsignedDecimal(result.configuration.budget.maxLoopWork)).toBe("32");
  });

  it.each([
    [{ ...validConfiguration(), extra: true }, "/configuration"],
    [{ ...validConfiguration(), caseCount: 0 }, "/configuration/caseCount"],
    [{ ...validConfiguration(), maxInvalidCases: 5 }, "/configuration/maxInvalidCases"],
    [{ ...validConfiguration(), enabledRuleIds: ["../rule"] }, "/configuration/enabledRuleIds/0"],
    [
      { ...validConfiguration(), enabledRuleIds: ["S3-T2", "S3-T1"] },
      "/configuration/enabledRuleIds",
    ],
    [
      { ...validConfiguration(), enabledRuleIds: ["S3-T1", "S3-T1"] },
      "/configuration/enabledRuleIds",
    ],
    [{ ...validConfiguration(), spellings: ["future"] }, "/configuration/spellings/0"],
    [{ ...validConfiguration(), spellings: ["literal", "const"] }, "/configuration/spellings"],
    [
      {
        ...validConfiguration(),
        budget: { ...validConfiguration().budget, maxModules: 0 },
      },
      "/configuration/budget/maxModules",
    ],
  ])("rejects non-canonical configuration data at %s", (input, path) => {
    expect(normalizeGenerationConfiguration(input)).toMatchObject({
      ok: false,
      problem: { path },
    });
  });

  it("rejects exotic and accessor-backed configuration inputs without invoking accessors", () => {
    let calls = 0;
    const accessor = validConfiguration();
    Object.defineProperty(accessor, "caseCount", {
      enumerable: true,
      get: () => {
        calls += 1;
        return 4;
      },
    });
    const hostile = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new TypeError("blocked");
        },
      },
    );

    expect(normalizeGenerationConfiguration(accessor).ok).toBe(false);
    expect(calls).toBe(0);
    expect(normalizeGenerationConfiguration(hostile).ok).toBe(false);
  });

  it("validates bounded paths, digests and isolated byte copies", () => {
    expect(normalizeGenerationPath([0, 0xffff_ffff], "/path", 2)).toMatchObject({
      ok: true,
      encoded: "0.4294967295",
    });
    expect(normalizeGenerationPath([0, 1], "/path", 1)).toMatchObject({
      ok: false,
      problem: { path: "/path" },
    });
    expect(normalizeGenerationPath([0, -1], "/path", 2)).toMatchObject({
      ok: false,
      problem: { path: "/path/1" },
    });
    expect(normalizeGenerationPath({}, "/path", 2)).toMatchObject({
      ok: false,
      problem: { path: "/path" },
    });
    expect(isSha256Digest(`sha256:${"a".repeat(64)}`)).toBe(true);
    expect(isSha256Digest(`sha256:${"A".repeat(64)}`)).toBe(false);

    const original = Uint8Array.of(1, 2);
    const copy = copyUint8Array(original, 2);
    expect(copy).toEqual(original);
    original[0] = 9;
    expect(copy).toEqual(Uint8Array.of(1, 2));
    expect(copyUint8Array(original, 3)).toBeUndefined();
    expect(copyUint8Array({})).toBeUndefined();
    const hostileBytes = new Proxy(new Uint8Array(), {
      get: () => {
        throw new TypeError("blocked");
      },
    });
    expect(copyUint8Array(hostileBytes)).toBeUndefined();
  });

  it("checks intrinsic byte length before invoking the copy primitive", () => {
    const bytes = new Uint8Array(31);
    Object.defineProperty(bytes, "byteLength", {
      configurable: true,
      get: () => {
        throw new TypeError("untrusted override");
      },
    });
    const slice = vi.spyOn(Uint8Array.prototype, "slice");
    try {
      expect(copyUint8Array(bytes, 32)).toBeUndefined();
      expect(slice).not.toHaveBeenCalled();
    } finally {
      slice.mockRestore();
    }
  });

  it("enforces closed collection maxima before iterating values", () => {
    expect(
      normalizeGenerationConfiguration({
        ...validConfiguration(),
        enabledRuleIds: Array.from({ length: 4_097 }, (_, index) => `S${index}`),
      }),
    ).toMatchObject({
      ok: false,
      problem: { path: "/configuration/enabledRuleIds" },
    });
    expect(
      normalizeGenerationConfiguration({
        ...validConfiguration(),
        spellings: Array.from({ length: 33 }, () => "literal"),
      }),
    ).toMatchObject({
      ok: false,
      problem: { path: "/configuration/spellings" },
    });
  });
});
