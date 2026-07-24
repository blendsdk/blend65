import { describe, expect, it, vi } from "vitest";

import {
  deriveCampaignIdentity,
  deriveCaseIdentity,
  deriveConfigurationIdentity,
} from "./case-identity.js";
import { parseReplayEnvelope } from "./replay-input.js";
import { createRevisionRegistry, resolveReplayRevisions } from "./revision-registry.js";

type CampaignInput = Parameters<typeof deriveCampaignIdentity>[0];
type Configuration = Parameters<typeof deriveConfigurationIdentity>[0];
type ReplayEnvelope = Parameters<typeof resolveReplayRevisions>[0];
type IdentityComponent = Parameters<Parameters<typeof resolveReplayRevisions>[1]["resolve"]>[0];
type Sha256Digest = CampaignInput["inventoryDigest"];

const textEncoder = new TextEncoder();

function digest(hexDigit: string): Sha256Digest {
  return `sha256:${hexDigit.repeat(64)}` as Sha256Digest;
}

function identityOf<T>(
  result:
    | { readonly ok: true; readonly identity: T }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] },
): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected identity derivation to succeed");
  }
  return result.identity;
}

function configuration(): Configuration {
  return {
    caseCount: 8,
    maxInvalidCases: 2,
    enabledRuleIds: ["S3-T1", "S3-T2"],
    spellings: ["const", "literal", "local", "parameter"],
    budget: {
      maxModules: 2,
      maxDeclarations: 8,
      maxIrNodes: 64,
      maxStatements: 32,
      maxExpressionDepth: 6,
      maxLoopWork: 64n,
      maxSourceBytes: 4096,
      maxAttempts: 128,
    },
  };
}

function replayEnvelope(): ReplayEnvelope {
  const generationConfiguration = configuration();
  const configurationDigest = identityOf(deriveConfigurationIdentity(generationConfiguration));
  const campaign: CampaignInput = {
    inventorySchemaVersion: 1,
    inventoryVersion: "inventory-v1",
    inventoryDigest: digest("1"),
    specRevision: "spec-v3.0",
    ruleModelVersion: "rule-model-v1",
    ruleModelDigest: digest("2"),
    generator: {
      handlerId: "generator.frontend",
      contractVersion: "1",
      implementationRevision: digest("3"),
    },
    boundaryTransform: {
      handlerId: "transform.boundary-variants",
      contractVersion: "1",
      implementationRevision: digest("4"),
    },
    rendererRevision: digest("5"),
    target: "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: digest("0"),
    configurationDigest,
  };
  const campaignDigest = identityOf(deriveCampaignIdentity(campaign));
  const caseIdentity = identityOf(deriveCaseIdentity(campaignDigest, [1, 2], 0));
  return {
    schemaVersion: 1,
    campaign,
    campaignDigest,
    caseIdentity,
    configuration: generationConfiguration,
  };
}

function wireText(value: unknown): string {
  return JSON.stringify(value, (_key, member: unknown) =>
    typeof member === "bigint" ? member.toString(10) : member,
  );
}

function wireBytes(value: unknown): Uint8Array {
  return textEncoder.encode(wireText(value));
}

function wireObject(value: unknown): Record<string, unknown> {
  return JSON.parse(wireText(value)) as Record<string, unknown>;
}

function expectReplayDiagnostic(
  bytes: Uint8Array,
  code:
    | "replay.input.invalid-json"
    | "replay.input.invalid-utf8"
    | "replay.input.limit"
    | "replay.schema.invalid"
    | "replay.identity.mismatch",
  path?: string,
): void {
  const result = parseReplayEnvelope(bytes);
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected replay input to be rejected");
  }
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      ...(path === undefined ? {} : { path }),
    }),
  );
}

function requestedRevision(envelope: ReplayEnvelope, component: IdentityComponent): Sha256Digest {
  switch (component) {
    case "inventory":
      return envelope.campaign.inventoryDigest;
    case "rule-model":
      return envelope.campaign.ruleModelDigest;
    case "generator":
      return envelope.campaign.generator.implementationRevision;
    case "boundary-transform":
      return envelope.campaign.boundaryTransform.implementationRevision;
    case "renderer":
      return envelope.campaign.rendererRevision;
    case "configuration":
      return envelope.campaign.configurationDigest;
  }
}

describe("closed replay input", () => {
  it("accepts a complete normalized envelope with digest-verified configuration", () => {
    const result = parseReplayEnvelope(wireBytes(replayEnvelope()));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected replay envelope to parse");
    }
    expect(result.envelope.configuration.budget.maxLoopWork).toBe(64n);
    expect(result.diagnostics).toEqual([]);
  });

  it("rejects duplicate and unknown properties", () => {
    const valid = wireText(replayEnvelope());
    const duplicate = valid.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1');
    expectReplayDiagnostic(
      textEncoder.encode(duplicate),
      "replay.schema.invalid",
      "/schemaVersion",
    );

    const unknown = wireObject(replayEnvelope());
    unknown.unexpected = true;
    expectReplayDiagnostic(wireBytes(unknown), "replay.schema.invalid", "/unexpected");
  });

  it("rejects oversized, too-deep and excessive collection inputs", () => {
    expectReplayDiagnostic(new Uint8Array(1024 * 1024 + 1).fill(0x20), "replay.input.limit");

    const oversizedString = wireObject(replayEnvelope());
    const oversizedCampaign = oversizedString.campaign as Record<string, unknown>;
    oversizedCampaign.inventoryVersion = "x".repeat(513);
    expectReplayDiagnostic(
      wireBytes(oversizedString),
      "replay.input.limit",
      "/campaign/inventoryVersion",
    );

    const excessivePath = wireObject(replayEnvelope());
    const excessiveCase = excessivePath.caseIdentity as Record<string, unknown>;
    excessiveCase.generationPath = Array.from({ length: 65 }, (_, index) => index);
    expectReplayDiagnostic(
      wireBytes(excessivePath),
      "replay.input.limit",
      "/caseIdentity/generationPath",
    );

    const excessiveSpellings = wireObject(replayEnvelope());
    const excessiveConfiguration = excessiveSpellings.configuration as Record<string, unknown>;
    excessiveConfiguration.spellings = Array.from({ length: 33 }, () => "literal");
    expectReplayDiagnostic(
      wireBytes(excessiveSpellings),
      "replay.input.limit",
      "/configuration/spellings",
    );

    const tooDeep = wireObject(replayEnvelope());
    let cursor: Record<string, unknown> = tooDeep;
    for (let depth = 0; depth < 13; depth += 1) {
      const nested: Record<string, unknown> = {};
      cursor.nested = nested;
      cursor = nested;
    }
    expectReplayDiagnostic(wireBytes(tooDeep), "replay.input.limit");
  });

  it("rejects malformed bytes, unsupported IDs and path-like values", () => {
    expectReplayDiagnostic(textEncoder.encode("{"), "replay.input.invalid-json");
    expectReplayDiagnostic(
      new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x7d]),
      "replay.input.invalid-utf8",
    );

    const unsupportedVersion = wireObject(replayEnvelope());
    unsupportedVersion.schemaVersion = 2;
    expectReplayDiagnostic(
      wireBytes(unsupportedVersion),
      "replay.schema.invalid",
      "/schemaVersion",
    );

    const unsupportedTarget = wireObject(replayEnvelope());
    const targetCampaign = unsupportedTarget.campaign as Record<string, unknown>;
    targetCampaign.target = "host";
    expectReplayDiagnostic(
      wireBytes(unsupportedTarget),
      "replay.schema.invalid",
      "/campaign/target",
    );

    const unsupportedAlgorithm = wireObject(replayEnvelope());
    const algorithmCampaign = unsupportedAlgorithm.campaign as Record<string, unknown>;
    algorithmCampaign.prngAlgorithm = "host-random";
    expectReplayDiagnostic(
      wireBytes(unsupportedAlgorithm),
      "replay.schema.invalid",
      "/campaign/prngAlgorithm",
    );

    const pathLikeHandler = wireObject(replayEnvelope());
    const pathCampaign = pathLikeHandler.campaign as Record<string, unknown>;
    const generator = pathCampaign.generator as Record<string, unknown>;
    generator.handlerId = "../generator.frontend";
    expectReplayDiagnostic(
      wireBytes(pathLikeHandler),
      "replay.schema.invalid",
      "/campaign/generator/handlerId",
    );

    const invalidLogicalPath = wireObject(replayEnvelope());
    const invalidCase = invalidLogicalPath.caseIdentity as Record<string, unknown>;
    invalidCase.generationPath = [1, -1];
    expectReplayDiagnostic(
      wireBytes(invalidLogicalPath),
      "replay.schema.invalid",
      "/caseIdentity/generationPath/1",
    );
  });

  it("rejects configuration content that does not match its identity", () => {
    const mismatch = wireObject(replayEnvelope());
    const replayConfiguration = mismatch.configuration as Record<string, unknown>;
    replayConfiguration.caseCount = 9;

    expectReplayDiagnostic(
      wireBytes(mismatch),
      "replay.identity.mismatch",
      "/campaign/configurationDigest",
    );
  });
});

describe("exact replay revision resolution", () => {
  it("builds a registry only for unique exact component and revision pairs", () => {
    const entry = {
      component: "renderer" as const,
      revision: digest("5"),
      value: { render: vi.fn() },
    };
    const result = createRevisionRegistry([entry, entry]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected duplicate revision entries to be rejected");
    }
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "replay.schema.invalid",
        path: "/entries/1",
      }),
    );
  });

  it.each([
    "inventory",
    "rule-model",
    "generator",
    "boundary-transform",
    "renderer",
    "configuration",
  ] as const)(
    "names an absent %s revision and never probes a current fallback",
    (missingComponent) => {
      const envelope = replayEnvelope();
      const fallbackRevision = digest("f");
      const fallbackImplementation = vi.fn();
      const resolve = vi.fn((component: IdentityComponent, revision: Sha256Digest) => {
        if (component === missingComponent && revision === fallbackRevision) {
          fallbackImplementation();
          return {};
        }
        if (component === missingComponent && revision === requestedRevision(envelope, component)) {
          return undefined;
        }
        return {};
      });
      const registry = {
        resolve,
      } as Parameters<typeof resolveReplayRevisions>[1];

      const result = resolveReplayRevisions(envelope, registry);

      expect(result).toEqual({
        ok: false,
        kind: "replay-incompatible",
        missing: missingComponent,
      });
      expect(resolve).toHaveBeenCalledWith(
        missingComponent,
        requestedRevision(envelope, missingComponent),
      );
      expect(resolve).not.toHaveBeenCalledWith(missingComponent, fallbackRevision);
      expect(fallbackImplementation).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty("resolved");
    },
  );
});
