import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  encodeAssetsEvidence,
  encodeBuildEvidence,
  encodeCostsEvidence,
  encodeDebugEvidence,
  encodeMemoryEvidence,
  validateAssetsEvidence,
  validateBuildEvidence,
  validateCostsEvidence,
  validateDebugEvidence,
  validateMemoryEvidence,
} from "./evidence.js";
import type {
  AssetsEvidence,
  BuildEvidence,
  CostsEvidence,
  DebugEvidence,
  MemoryEvidence,
} from "./evidence-types.js";

const ZERO_HASH = "0".repeat(64);
const ONE_HASH = "1".repeat(64);
const GENERATION_A = "11111111-1111-4111-8111-111111111111";
const GENERATION_B = "22222222-2222-4222-8222-222222222222";

function sha256(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const fields = Object.entries(value).sort(([left], [right]) =>
      Buffer.compare(Buffer.from(left), Buffer.from(right)),
    );
    return `{${fields.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function identity(name: string) {
  return Object.freeze({ name, version: "1.0.0", sha256: ZERO_HASH });
}

function buildEvidence(generationId = GENERATION_A, hostPath = "/usr/bin/acme"): BuildEvidence {
  const artifacts = [
    [".asm", "assembly"],
    [".assets.json", "assets"],
    [".costs.json", "costs"],
    [".debug.json", "debug"],
    [".labels", "labels"],
    [".memory.json", "memory"],
    ["game.prg", "primary"],
  ] as const;
  return Object.freeze({
    kind: "blend65.build",
    schemaVersion: 1,
    generationId,
    semanticInputs: Object.freeze({
      projectName: "game",
      sourceRoot: "src",
      entryModule: "main",
      assetSearchPaths: Object.freeze(["assets"]),
      manifest: Object.freeze({ path: "blend65.json", bytes: 2, sha256: ZERO_HASH }),
      sources: Object.freeze([
        Object.freeze({ path: "src/main.blend", bytes: 1, sha256: ONE_HASH }),
      ]),
      assets: Object.freeze([]),
      compiler: identity("blend65"),
      specification: identity("blend65-language"),
      expertSkill: identity("blend65-domain-expert"),
      target: Object.freeze({
        profileId: "c64-pal-prg-kernal-6581",
        cpuId: "nmos-6510",
        emitterId: "acme-0.97",
        packagerId: "cbm-prg",
      }),
      options: Object.freeze({
        optimization: "none" as const,
        boundsCheck: false,
        divisionZeroCheck: false,
      }),
      overrides: Object.freeze([]),
    }),
    portableTools: Object.freeze([
      Object.freeze({
        name: "acme",
        version: "0.97",
        semanticOptions: Object.freeze(["--cpu=6502", "--strict-segments", "--format=cbm"]),
      }),
    ]),
    hostProvenance: Object.freeze({
      platform: "linux" as const,
      architecture: "x64" as const,
      nodeVersion: "22.0.0",
      tools: Object.freeze([
        Object.freeze({ name: "acme", canonicalPath: hostPath, sha256: ONE_HASH }),
      ]),
      durationMilliseconds: "Unknown" as const,
      peakRssBytes: "Unknown" as const,
    }),
    package: Object.freeze({
      kind: "prg" as const,
      artifactPath: "game.prg",
      loadAddress: 0x0801,
      endAddress: 0x0802,
    }),
    artifacts: Object.freeze(
      artifacts.map(([path, kind]) => Object.freeze({ path, kind, bytes: 1, sha256: ZERO_HASH })),
    ),
  });
}

function assetsEvidence(): AssetsEvidence {
  return Object.freeze({ kind: "blend65.assets", schemaVersion: 1, assets: Object.freeze([]) });
}

function memoryEvidence(): MemoryEvidence {
  return Object.freeze({
    kind: "blend65.memory",
    schemaVersion: 1,
    profileId: "c64-pal-prg-kernal-6581",
    sfaClosureSha256: sha256("[]"),
    acmeReconciled: true,
    runtimeMemorySafety: "proved",
    residencies: Object.freeze([]),
    unboundedEffects: Object.freeze([]),
    intervals: Object.freeze([]),
    views: Object.freeze([]),
    stackDomains: Object.freeze([]),
  });
}

function costsEvidence(): CostsEvidence {
  return Object.freeze({
    kind: "blend65.costs",
    schemaVersion: 1,
    mode: "none",
    totals: Object.freeze({
      programBytes: 0,
      pathCycles: Object.freeze([]),
      resources: Object.freeze([
        Object.freeze({ kind: "standard" as const, id: "zeroPage", value: 0 }),
        Object.freeze({ kind: "standard" as const, id: "residentRam", value: 0 }),
        Object.freeze({ kind: "standard" as const, id: "hardwareStack", value: 0 }),
        Object.freeze({ kind: "standard" as const, id: "scratch", value: 0 }),
      ]),
    }),
    entries: Object.freeze([]),
    decisions: Object.freeze([]),
  });
}

function debugEvidence(): DebugEvidence {
  return Object.freeze({
    kind: "blend65.debug",
    schemaVersion: 1,
    compiler: identity("blend65"),
    specification: identity("blend65-language"),
    expertSkill: identity("blend65-domain-expert"),
    profileId: "c64-pal-prg-kernal-6581",
    cpuId: "nmos-6510",
    optimization: "none",
    safety: Object.freeze({ boundsCheck: false, divisionZeroCheck: false }),
    primaryArtifact: Object.freeze({ path: "game.prg", kind: "primary", sha256: ZERO_HASH }),
    tools: Object.freeze([]),
    sources: Object.freeze([]),
    assets: Object.freeze([]),
    addressSpaces: Object.freeze([]),
    functions: Object.freeze([]),
    contexts: Object.freeze([]),
    symbols: Object.freeze([]),
    locations: Object.freeze([]),
    ranges: Object.freeze([]),
    optimizations: Object.freeze([]),
    loadUnits: Object.freeze([]),
  });
}

describe("canonical artifact evidence", () => {
  // Each sidecar is a closed versioned schema with one canonical UTF-8 byte representation.
  it("should round-trip all five sidecars with exact canonical JSON", () => {
    const cases = [
      ["build", buildEvidence(), encodeBuildEvidence, validateBuildEvidence],
      ["assets", assetsEvidence(), encodeAssetsEvidence, validateAssetsEvidence],
      ["memory", memoryEvidence(), encodeMemoryEvidence, validateMemoryEvidence],
      ["costs", costsEvidence(), encodeCostsEvidence, validateCostsEvidence],
      ["debug", debugEvidence(), encodeDebugEvidence, validateDebugEvidence],
    ] as const;

    for (const [name, value, encode, validate] of cases) {
      const encoded = encode(value);
      expect(encoded.kind, name).toBe("complete");
      if (encoded.kind !== "complete") throw new Error(`Expected ${name} encoding`);
      const text = Buffer.from(encoded.bytes).toString("utf8");
      expect(text, name).toBe(`${canonicalJson(value)}\n`);
      expect(text.endsWith("\n"), name).toBe(true);
      expect(text.endsWith("\n\n"), name).toBe(false);
      expect(encoded.sha256, name).toBe(sha256(encoded.bytes));
      const validated = validate(encoded.bytes);
      expect(validated.kind, name).toBe("complete");
      if (validated.kind !== "complete") throw new Error(`Expected ${name} validation`);
      expect(validated.value, name).toEqual(value);
      expect(encode(validated.value), name).toEqual(encoded);
    }
  });

  // Host paths and timings are non-portable; changing them cannot change the portable projection.
  it("should isolate generation identity and host provenance from portable build evidence", () => {
    const first = encodeBuildEvidence(buildEvidence(GENERATION_A, "/usr/bin/acme"));
    const second = encodeBuildEvidence(buildEvidence(GENERATION_B, "C:\\tools\\acme.exe"));
    expect(first.kind).toBe("complete");
    expect(second.kind).toBe("complete");
    if (first.kind !== "complete" || second.kind !== "complete") {
      throw new Error("Expected build evidence encoding");
    }
    const a = validateBuildEvidence(first.bytes);
    const b = validateBuildEvidence(second.bytes);
    if (a.kind !== "complete" || b.kind !== "complete") {
      throw new Error("Expected build evidence validation");
    }
    const { generationId: generationA, hostProvenance: hostA, ...portableA } = a.value;
    const { generationId: generationB, hostProvenance: hostB, ...portableB } = b.value;
    expect(generationA).toBe(GENERATION_A);
    expect(generationB).toBe(GENERATION_B);
    expect(hostA).not.toEqual(hostB);
    expect(portableA).toEqual(portableB);
    expect(first.bytes).not.toEqual(second.bytes);
  });

  // Missing, extra, mistyped, duplicated, unsupported and out-of-range fields fail closed.
  it("should reject every non-canonical or invalid sidecar shape", () => {
    const encoders = [
      encodeBuildEvidence,
      encodeAssetsEvidence,
      encodeMemoryEvidence,
      encodeCostsEvidence,
      encodeDebugEvidence,
    ] as const;
    for (const encode of encoders) {
      expect(encode({ kind: "wrong", schemaVersion: 1 })).toEqual(
        expect.objectContaining({ kind: "error", reason: "malformed" }),
      );
      expect(encode({ kind: "wrong", schemaVersion: 1, extra: true })).toEqual(
        expect.objectContaining({ kind: "error", reason: "malformed" }),
      );
    }

    const unknown = { ...assetsEvidence(), extra: true };
    expect(encodeAssetsEvidence(unknown)).toEqual(
      expect.objectContaining({ kind: "error", reason: "malformed" }),
    );
    expect(
      encodeAssetsEvidence({ kind: "blend65.assets", schemaVersion: "1", assets: [] }),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));
    expect(
      encodeCostsEvidence({
        ...costsEvidence(),
        totals: { ...costsEvidence().totals, programBytes: -1 },
      }),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));
    expect(
      validateAssetsEvidence(
        Buffer.from(
          '{"kind":"blend65.assets","kind":"blend65.assets","schemaVersion":1,"assets":[]}\n',
        ),
      ),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));
    expect(
      validateAssetsEvidence(
        Buffer.from('{"assets":[],"kind":"blend65.assets","schemaVersion":2}\n'),
      ),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "unsupported-version" }));
  });
});
