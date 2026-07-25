import { describe, expect, it, vi } from "vitest";

import {
  deriveCampaignIdentity,
  deriveCaseIdentity,
  deriveConfigurationIdentity,
  type CampaignIdentityInput,
  type GenerationConfiguration,
  type Sha256Digest,
} from "./case-identity.js";
import { parseReplayEnvelope } from "./replay-input.js";

const encoder = new TextEncoder();

function digest(character: string): Sha256Digest {
  return `sha256:${character.repeat(64)}`;
}

function identityOf<T>(
  result:
    | { readonly ok: true; readonly identity: T }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] },
): T {
  if (!result.ok) throw new Error("expected identity");
  return result.identity;
}

function configuration(): GenerationConfiguration {
  return {
    caseCount: 2,
    maxInvalidCases: 1,
    enabledRuleIds: ["S3-T1"],
    spellings: ["const", "literal"],
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

function envelope() {
  const config = configuration();
  const campaign: CampaignIdentityInput = {
    inventorySchemaVersion: 1,
    inventoryVersion: "inventory-v1",
    inventoryDigest: digest("1"),
    specRevision: "spec-v3.0",
    ruleModelVersion: "models-v1",
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
    configurationDigest: identityOf(deriveConfigurationIdentity(config)),
  };
  const campaignDigest = identityOf(deriveCampaignIdentity(campaign));
  return {
    schemaVersion: 1,
    campaign,
    campaignDigest,
    caseIdentity: identityOf(deriveCaseIdentity(campaignDigest, [1], 0)),
    configuration: config,
  };
}

function json(value: unknown): string {
  return JSON.stringify(value, (_key, member: unknown) =>
    typeof member === "bigint" ? member.toString(10) : member,
  );
}

function bytes(value: unknown): Uint8Array {
  return encoder.encode(json(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function object(): Record<string, unknown> {
  const parse: (text: string) => unknown = JSON.parse;
  const value = parse(json(envelope()));
  if (!isRecord(value)) {
    throw new Error("expected object");
  }
  return value;
}

describe("replay input identity closure", () => {
  it("returns deeply frozen normalized identity data", () => {
    const result = parseReplayEnvelope(bytes(envelope()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Object.isFrozen(result.envelope)).toBe(true);
    expect(Object.isFrozen(result.envelope.campaign)).toBe(true);
    expect(Object.isFrozen(result.envelope.campaign.generator)).toBe(true);
    expect(Object.isFrozen(result.envelope.caseIdentity)).toBe(true);
    expect(Object.isFrozen(result.envelope.caseIdentity.generationPath)).toBe(true);
    expect(Object.isFrozen(result.envelope.configuration)).toBe(true);
    expect(result.envelope.configuration.budget.maxLoopWork).toBe(32n);
  });

  it.each([
    [
      "campaign digest",
      "/campaignDigest",
      (value: Record<string, unknown>) => {
        value.campaignDigest = digest("f");
      },
    ],
    [
      "configuration digest",
      "/campaignDigest",
      (value: Record<string, unknown>) => {
        const campaign = value.campaign;
        if (isRecord(campaign)) {
          campaign.configurationDigest = digest("f");
        }
      },
    ],
    [
      "case campaign",
      "/caseIdentity/campaignDigest",
      (value: Record<string, unknown>) => {
        const caseIdentity = value.caseIdentity;
        if (isRecord(caseIdentity)) {
          caseIdentity.campaignDigest = digest("f");
        }
      },
    ],
    [
      "case digest",
      "/caseIdentity/digest",
      (value: Record<string, unknown>) => {
        const caseIdentity = value.caseIdentity;
        if (isRecord(caseIdentity)) {
          caseIdentity.digest = digest("f");
        }
      },
    ],
  ])("rejects mismatched %s at its stable path", (_name, path, mutate) => {
    const value = object();
    mutate(value);
    expect(parseReplayEnvelope(bytes(value))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.identity.mismatch", path }],
    });
  });

  it.each([
    [
      "/schemaVersion",
      (value: Record<string, unknown>) => {
        value.schemaVersion = 2;
      },
    ],
    [
      "/campaign",
      (value: Record<string, unknown>) => {
        const campaign = value.campaign;
        if (isRecord(campaign)) {
          campaign.extra = true;
        }
      },
    ],
    [
      "/configuration/budget/maxLoopWork",
      (value: Record<string, unknown>) => {
        const config = value.configuration;
        if (isRecord(config)) {
          const budget = config.budget;
          if (isRecord(budget)) {
            budget.maxLoopWork = "01";
          }
        }
      },
    ],
    [
      "/caseIdentity/ordinal",
      (value: Record<string, unknown>) => {
        const caseIdentity = value.caseIdentity;
        if (isRecord(caseIdentity)) {
          caseIdentity.ordinal = -1;
        }
      },
    ],
  ])("rejects closed schema corruption at %s", (path, mutate) => {
    const value = object();
    mutate(value);
    expect(parseReplayEnvelope(bytes(value))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.schema.invalid", path }],
    });
  });

  it.each([
    [
      "/campaign/inventorySchemaVersion",
      (value: Record<string, unknown>) => {
        const campaign = value.campaign;
        if (isRecord(campaign)) campaign.inventorySchemaVersion = 2;
      },
    ],
    [
      "/campaign/inventoryVersion",
      (value: Record<string, unknown>) => {
        const campaign = value.campaign;
        if (isRecord(campaign)) campaign.inventoryVersion = "";
      },
    ],
    [
      "/campaign/inventoryDigest",
      (value: Record<string, unknown>) => {
        const campaign = value.campaign;
        if (isRecord(campaign)) campaign.inventoryDigest = "bad";
      },
    ],
    [
      "/campaign/generator",
      (value: Record<string, unknown>) => {
        const campaign = value.campaign;
        if (isRecord(campaign)) campaign.generator = null;
      },
    ],
    [
      "/campaign/generator/contractVersion",
      (value: Record<string, unknown>) => {
        const campaign = value.campaign;
        if (isRecord(campaign) && isRecord(campaign.generator)) {
          campaign.generator.contractVersion = "";
        }
      },
    ],
    [
      "/campaign/generator/implementationRevision",
      (value: Record<string, unknown>) => {
        const campaign = value.campaign;
        if (isRecord(campaign) && isRecord(campaign.generator)) {
          campaign.generator.implementationRevision = "bad";
        }
      },
    ],
    [
      "/campaign/boundaryTransform",
      (value: Record<string, unknown>) => {
        const campaign = value.campaign;
        if (isRecord(campaign)) campaign.boundaryTransform = null;
      },
    ],
    [
      "/configuration",
      (value: Record<string, unknown>) => {
        value.configuration = null;
      },
    ],
    [
      "/configuration/budget",
      (value: Record<string, unknown>) => {
        const configuration = value.configuration;
        if (isRecord(configuration)) configuration.budget = null;
      },
    ],
    [
      "/configuration/budget/maxLoopWork",
      (value: Record<string, unknown>) => {
        const configuration = value.configuration;
        if (isRecord(configuration) && isRecord(configuration.budget)) {
          configuration.budget.maxLoopWork = 1;
        }
      },
    ],
    [
      "/configuration/budget/maxModules",
      (value: Record<string, unknown>) => {
        const configuration = value.configuration;
        if (isRecord(configuration) && isRecord(configuration.budget)) {
          configuration.budget.maxModules = 0;
        }
      },
    ],
    [
      "/caseIdentity",
      (value: Record<string, unknown>) => {
        value.caseIdentity = null;
      },
    ],
    [
      "/caseIdentity/campaignDigest",
      (value: Record<string, unknown>) => {
        const caseIdentity = value.caseIdentity;
        if (isRecord(caseIdentity)) caseIdentity.campaignDigest = "bad";
      },
    ],
    [
      "/caseIdentity/generationPath",
      (value: Record<string, unknown>) => {
        const caseIdentity = value.caseIdentity;
        if (isRecord(caseIdentity)) caseIdentity.generationPath = {};
      },
    ],
    [
      "/caseIdentity/generationPath/0",
      (value: Record<string, unknown>) => {
        const caseIdentity = value.caseIdentity;
        if (isRecord(caseIdentity)) caseIdentity.generationPath = [1.5];
      },
    ],
    [
      "/caseIdentity/digest",
      (value: Record<string, unknown>) => {
        const caseIdentity = value.caseIdentity;
        if (isRecord(caseIdentity)) caseIdentity.digest = "bad";
      },
    ],
    [
      "/campaignDigest",
      (value: Record<string, unknown>) => {
        value.campaignDigest = "bad";
      },
    ],
  ])("rejects malformed replay substructure at %s", (path, mutate) => {
    const value = object();
    mutate(value);
    expect(parseReplayEnvelope(bytes(value))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.schema.invalid", path }],
    });
  });

  it("rejects missing closed fields at the envelope and case levels", () => {
    const missingEnvelope = object();
    delete missingEnvelope.configuration;
    expect(parseReplayEnvelope(bytes(missingEnvelope))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.schema.invalid", path: "/configuration" }],
    });

    const missingCase = object();
    const caseIdentity = missingCase.caseIdentity;
    if (isRecord(caseIdentity)) delete caseIdentity.ordinal;
    expect(parseReplayEnvelope(bytes(missingCase))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.schema.invalid", path: "/caseIdentity" }],
    });
  });

  it.each([
    ["maxModules", "/configuration/budget/maxModules"],
    ["maxDeclarations", "/configuration/budget/maxDeclarations"],
    ["maxIrNodes", "/configuration/budget/maxIrNodes"],
    ["maxStatements", "/configuration/budget/maxStatements"],
    ["maxExpressionDepth", "/configuration/budget/maxExpressionDepth"],
    ["maxSourceBytes", "/configuration/budget/maxSourceBytes"],
    ["maxAttempts", "/configuration/budget/maxAttempts"],
  ])("rejects non-numeric %s before identity derivation", (field, path) => {
    const value = object();
    const configuration = value.configuration;
    if (isRecord(configuration) && isRecord(configuration.budget)) {
      configuration.budget[field] = "1";
    }
    expect(parseReplayEnvelope(bytes(value))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.schema.invalid", path }],
    });
  });

  it("enforces total-value and key-string limits before materialization", () => {
    const tooMany = { values: Array.from({ length: 4_097 }, () => 0) };
    expect(parseReplayEnvelope(bytes(tooMany))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.input.limit" }],
    });
    const longKey = JSON.stringify({ ["x".repeat(513)]: true });
    expect(parseReplayEnvelope(encoder.encode(longKey))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.input.limit" }],
    });
  });

  it("rejects comments, trailing syntax, roots and exotic byte arrays as data", () => {
    expect(parseReplayEnvelope(encoder.encode("/*x*/{}"))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.input.invalid-json" }],
    });
    expect(parseReplayEnvelope(encoder.encode('{"schemaVersion":1,}'))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.input.invalid-json" }],
    });
    expect(parseReplayEnvelope(encoder.encode("[]"))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.schema.invalid" }],
    });
    const hostile = new Proxy(new Uint8Array(), {
      getPrototypeOf: () => {
        throw new TypeError("blocked");
      },
    });
    expect(parseReplayEnvelope(hostile)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "replay.input.invalid-json" }],
    });
  });

  it("rejects oversized typed arrays before allocating a defensive copy", () => {
    const oversized = new Uint8Array(1_048_577);
    const slice = vi.spyOn(Uint8Array.prototype, "slice");
    try {
      expect(parseReplayEnvelope(oversized)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "replay.input.limit", path: "" }],
      });
      expect(slice).not.toHaveBeenCalled();
    } finally {
      slice.mockRestore();
    }
  });
});
