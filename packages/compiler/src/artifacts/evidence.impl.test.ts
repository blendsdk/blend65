import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  encodeAssetsEvidence,
  encodeBuildEvidence,
  encodeCostsEvidence,
  encodeDebugEvidence,
  encodeMemoryEvidence,
} from "./evidence.js";
import { canonicalEvidenceJson } from "./evidence-validation.js";

const ZERO_HASH = "0".repeat(64);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function identity(name: string) {
  return { name, version: "1.0.0", sha256: ZERO_HASH };
}

function selectedAsset() {
  const projection = {
    handler: "fixture",
    handlerVersion: "1",
    selector: "first",
    logicalType: "const byte",
    shape: [1],
    outputSha256: ZERO_HASH,
  };
  return {
    id: sha256(canonicalEvidenceJson(projection)),
    inputs: [],
    ...projection,
    payloadBytes: 1,
    emittedBytes: 1,
    aliases: [],
    constraints: [],
    placement: {
      kind: "single",
      range: {
        addressSpaceId: "cpu",
        start: 0x2000,
        end: 0x2001,
        alignmentBytes: 1,
        paddingBeforeBytes: 0,
        residencyId: "always",
        visibility: [],
        writableRanges: [],
      },
    },
  };
}

function emptyDebug() {
  return {
    kind: "blend65.debug",
    schemaVersion: 1,
    compiler: identity("blend65"),
    specification: identity("blend65-language"),
    expertSkill: identity("blend65-domain-expert"),
    profileId: "c64-pal-prg-kernal-6581",
    cpuId: "nmos-6510",
    optimization: "none",
    safety: { boundsCheck: false, divisionZeroCheck: false },
    primaryArtifact: { path: "game.prg", kind: "primary", sha256: ZERO_HASH },
    tools: [],
    sources: [],
    assets: [],
    addressSpaces: [],
    functions: [],
    contexts: [],
    symbols: [],
    locations: [],
    ranges: [],
    optimizations: [],
    loadUnits: [],
  };
}

describe("version-1 evidence invariants", () => {
  it("should reject nested unknown fields and selected-asset identity disagreement", () => {
    const valid = selectedAsset();
    expect(
      encodeAssetsEvidence({ kind: "blend65.assets", schemaVersion: 1, assets: [valid] }).kind,
    ).toBe("complete");
    expect(
      encodeAssetsEvidence({
        kind: "blend65.assets",
        schemaVersion: 1,
        assets: [{ ...valid, placement: { ...valid.placement, extra: true } }],
      }),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));
    expect(
      encodeAssetsEvidence({
        kind: "blend65.assets",
        schemaVersion: 1,
        assets: [{ ...valid, id: "1".repeat(64) }],
      }),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));
  });

  it("should reject an SFA closure hash which does not identify the final projection", () => {
    expect(
      encodeMemoryEvidence({
        kind: "blend65.memory",
        schemaVersion: 1,
        profileId: "c64-pal-prg-kernal-6581",
        sfaClosureSha256: ZERO_HASH,
        acmeReconciled: true,
        runtimeMemorySafety: "proved",
        residencies: [],
        unboundedEffects: [],
        intervals: [],
        views: [],
        stackDomains: [],
      }),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));
  });

  it("should reject cost totals which disagree with their program accounting entries", () => {
    expect(
      encodeCostsEvidence({
        kind: "blend65.costs",
        schemaVersion: 1,
        mode: "none",
        totals: {
          programBytes: 1,
          pathCycles: [],
          resources: [
            { kind: "standard", id: "zeroPage", value: 0 },
            { kind: "standard", id: "residentRam", value: 0 },
            { kind: "standard", id: "hardwareStack", value: 0 },
            { kind: "standard", id: "scratch", value: 0 },
          ],
        },
        entries: [],
        decisions: [],
      }),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));
  });

  it("should reject dangling indexed debug references", () => {
    expect(
      encodeDebugEvidence({
        ...emptyDebug(),
        ranges: [
          {
            machine: { addressSpaceIndex: 0, start: 0x0801, end: 0x0802 },
            origin: { kind: "generated", cause: "startup" },
            owner: { kind: "platform", name: "startup" },
            optimizationIndexes: [],
          },
        ],
      }),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));
  });

  it("should require constant availability to match the represented primitive width", () => {
    const symbol = {
      name: "score",
      qualifiedName: "main.score",
      kind: "global",
      type: "word",
      byteWidth: 2,
      shape: [],
      scope: "main",
      origin: { kind: "generated", cause: "platform" },
      linkage: "internal",
      labels: [],
      locationIndexes: [0],
    };
    const location = {
      symbolIndex: 0,
      liveRangeIndexes: [],
      availability: { kind: "constant", bytesHex: "0000" },
    };
    expect(
      encodeDebugEvidence({ ...emptyDebug(), symbols: [symbol], locations: [location] }).kind,
    ).toBe("complete");
    expect(
      encodeDebugEvidence({
        ...emptyDebug(),
        symbols: [symbol],
        locations: [{ ...location, availability: { kind: "constant", bytesHex: "00" } }],
      }),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));
    expect(
      encodeDebugEvidence({
        ...emptyDebug(),
        symbols: [{ ...symbol, type: "word " }],
        locations: [location],
      }),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));

    const aggregate = { ...symbol, type: "Player", byteWidth: 3 };
    const aggregateLocation = {
      ...location,
      availability: { kind: "constant", bytesHex: "000000" },
    };
    expect(
      encodeDebugEvidence({
        ...emptyDebug(),
        symbols: [aggregate],
        locations: [aggregateLocation],
      }).kind,
    ).toBe("complete");
    expect(
      encodeDebugEvidence({
        ...emptyDebug(),
        symbols: [aggregate],
        locations: [{ ...aggregateLocation, availability: { kind: "constant", bytesHex: "0000" } }],
      }),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));
  });

  it("should reject an empty physical asset placement", () => {
    const value = selectedAsset();
    expect(
      encodeAssetsEvidence({
        kind: "blend65.assets",
        schemaVersion: 1,
        assets: [
          {
            ...value,
            payloadBytes: 0,
            emittedBytes: 0,
            placement: {
              kind: "single",
              range: { ...value.placement.range, end: value.placement.range.start },
            },
          },
        ],
      }),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));
  });

  it("should reject duplicate build artifact roles and a nested package extension", () => {
    const build = {
      kind: "blend65.build",
      schemaVersion: 1,
      generationId: "11111111-1111-4111-8111-111111111111",
      semanticInputs: {
        projectName: "game",
        sourceRoot: "src",
        entryModule: "main",
        assetSearchPaths: [],
        manifest: { path: "blend65.json", bytes: 1, sha256: ZERO_HASH },
        sources: [],
        assets: [],
        compiler: identity("blend65"),
        specification: identity("blend65-language"),
        expertSkill: identity("blend65-domain-expert"),
        target: {
          profileId: "c64-pal-prg-kernal-6581",
          cpuId: "nmos-6510",
          emitterId: "acme-0.97",
          packagerId: "cbm-prg",
        },
        options: { optimization: "none", boundsCheck: false, divisionZeroCheck: false },
        overrides: [],
      },
      portableTools: [],
      hostProvenance: {
        platform: "linux",
        architecture: "x64",
        nodeVersion: "22.0.0",
        tools: [],
        durationMilliseconds: "Unknown",
        peakRssBytes: "Unknown",
      },
      package: {
        kind: "prg",
        artifactPath: "a.prg",
        loadAddress: 0x0801,
        endAddress: 0x0802,
      },
      artifacts: [
        { path: "a.prg", kind: "primary", bytes: 3, sha256: ZERO_HASH },
        { path: "b.prg", kind: "primary", bytes: 3, sha256: ZERO_HASH },
      ],
    };
    expect(encodeBuildEvidence(build)).toEqual(
      expect.objectContaining({ kind: "error", reason: "malformed" }),
    );
    expect(
      encodeBuildEvidence({
        ...build,
        package: { ...build.package, extension: true },
        artifacts: [build.artifacts[0]],
      }),
    ).toEqual(expect.objectContaining({ kind: "error", reason: "malformed" }));
  });
});
