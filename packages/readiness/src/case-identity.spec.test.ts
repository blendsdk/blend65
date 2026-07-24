import { describe, expect, it, vi } from "vitest";

import {
  createIdentityCollisionRegistry,
  deriveCampaignIdentity,
  deriveCaseIdentity,
  deriveConfigurationIdentity,
} from "./case-identity.js";
import { drawBoundedInteger, drawCounterBlock } from "./deterministic-choice.js";
import {
  deriveImplementationRevision,
  validateImplementationRevision,
} from "./implementation-revision.js";

type CampaignInput = Parameters<typeof deriveCampaignIdentity>[0];
type Configuration = Parameters<typeof deriveConfigurationIdentity>[0];
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

function choiceOf<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] },
): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected deterministic choice to succeed");
  }
  return result.value;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bigEndian256(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let remaining = value;
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  expect(remaining).toBe(0n);
  return bytes;
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

function campaignInput(changes: Partial<CampaignInput> = {}): CampaignInput {
  const configurationDigest = identityOf(deriveConfigurationIdentity(configuration()));
  return {
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
    ...changes,
  };
}

describe("deterministic counter choices", () => {
  it("matches the published counter block and bounded integer", () => {
    const input = {
      seed: digest("0"),
      generationPath: [1, 2],
      drawOrdinal: 0n,
      blockIndex: 0n,
    };

    const block = choiceOf(drawCounterBlock(input));
    expect(hex(block)).toBe("441053163d1086217c3a5af54508abc0ba51d534a26f62c9b6a2fb1e306bbe51");

    const bounded = choiceOf(
      drawBoundedInteger({
        seed: input.seed,
        generationPath: input.generationPath,
        drawOrdinal: input.drawOrdinal,
        upperExclusive: 1000n,
      }),
    );
    expect(bounded).toBe(425n);
  });

  it("rejects an out-of-range block and consumes the next counter block", () => {
    const upperExclusive = 1000n;
    const range = 1n << 256n;
    const limit = (range / upperExclusive) * upperExclusive;
    const preimages: Uint8Array[] = [];
    const blockDigest = vi.fn((preimage: Uint8Array) => {
      preimages.push(preimage.slice());
      return preimages.length === 1 ? bigEndian256(limit) : bigEndian256(1425n);
    });

    const result = drawBoundedInteger(
      {
        seed: digest("0"),
        generationPath: [1, 2],
        drawOrdinal: 0n,
        upperExclusive,
      },
      blockDigest,
    );

    expect(choiceOf(result)).toBe(425n);
    expect(blockDigest).toHaveBeenCalledTimes(2);
    expect(preimages[1]).not.toEqual(preimages[0]);
  });

  it("keeps an existing sibling path stable when another branch is visited", () => {
    const seed = digest("a");
    const existingDraw = {
      seed,
      generationPath: [4, 1],
      drawOrdinal: 7n,
      blockIndex: 0n,
    };
    const before = choiceOf(drawCounterBlock(existingDraw));

    choiceOf(
      drawCounterBlock({
        ...existingDraw,
        generationPath: [4, 0],
      }),
    );

    const after = choiceOf(drawCounterBlock(existingDraw));
    expect(after).toEqual(before);

    const campaignDigest = identityOf(deriveCampaignIdentity(campaignInput()));
    const registry = createIdentityCollisionRegistry();
    const firstCase = identityOf(deriveCaseIdentity(campaignDigest, [4, 1], 7, registry));
    identityOf(deriveCaseIdentity(campaignDigest, [4, 0], 7, registry));
    const repeatedCase = identityOf(deriveCaseIdentity(campaignDigest, [4, 1], 7, registry));
    expect(repeatedCase.digest).toBe(firstCase.digest);
  });
});

describe("campaign and case identity", () => {
  it("changes or rejects identity when any campaign field changes", () => {
    const baseline = campaignInput();
    const baselineDigest = identityOf(deriveCampaignIdentity(baseline));
    const mutations: readonly [string, (input: CampaignInput) => CampaignInput][] = [
      [
        "inventorySchemaVersion",
        (input) =>
          ({
            ...input,
            inventorySchemaVersion: 2,
          }) as unknown as CampaignInput,
      ],
      ["inventoryVersion", (input) => ({ ...input, inventoryVersion: "inventory-v2" })],
      ["inventoryDigest", (input) => ({ ...input, inventoryDigest: digest("6") })],
      ["specRevision", (input) => ({ ...input, specRevision: "spec-v3.1" })],
      ["ruleModelVersion", (input) => ({ ...input, ruleModelVersion: "rule-model-v2" })],
      ["ruleModelDigest", (input) => ({ ...input, ruleModelDigest: digest("7") })],
      [
        "generator.handlerId",
        (input) => ({
          ...input,
          generator: { ...input.generator, handlerId: "generator.runtime" },
        }),
      ],
      [
        "generator.contractVersion",
        (input) => ({
          ...input,
          generator: { ...input.generator, contractVersion: "2" },
        }),
      ],
      [
        "generator.implementationRevision",
        (input) => ({
          ...input,
          generator: {
            ...input.generator,
            implementationRevision: digest("8"),
          },
        }),
      ],
      [
        "boundaryTransform.handlerId",
        (input) => ({
          ...input,
          boundaryTransform: {
            ...input.boundaryTransform,
            handlerId: "transform.boundary-alternate",
          },
        }),
      ],
      [
        "boundaryTransform.contractVersion",
        (input) => ({
          ...input,
          boundaryTransform: {
            ...input.boundaryTransform,
            contractVersion: "2",
          },
        }),
      ],
      [
        "boundaryTransform.implementationRevision",
        (input) => ({
          ...input,
          boundaryTransform: {
            ...input.boundaryTransform,
            implementationRevision: digest("9"),
          },
        }),
      ],
      ["rendererRevision", (input) => ({ ...input, rendererRevision: digest("a") })],
      ["target", (input) => ({ ...input, target: "c64u" })],
      [
        "prngAlgorithm",
        (input) =>
          ({
            ...input,
            prngAlgorithm: "blend65-sha256-ctr-v2",
          }) as unknown as CampaignInput,
      ],
      ["seed", (input) => ({ ...input, seed: digest("b") })],
      ["configurationDigest", (input) => ({ ...input, configurationDigest: digest("c") })],
    ];

    for (const [field, mutate] of mutations) {
      const result = deriveCampaignIdentity(mutate(baseline));
      if (result.ok) {
        expect(result.identity, field).not.toBe(baselineDigest);
      } else {
        expect(result.diagnostics, field).toContainEqual(
          expect.objectContaining({ code: "identity.input.invalid" }),
        );
      }
    }
  });

  it("separates equal paths and ordinals across every named shaping identity", () => {
    const baseline = campaignInput();
    const variants: CampaignInput[] = [
      baseline,
      {
        ...baseline,
        generator: { ...baseline.generator, handlerId: "generator.runtime" },
      },
      {
        ...baseline,
        generator: {
          ...baseline.generator,
          implementationRevision: digest("6"),
        },
      },
      {
        ...baseline,
        boundaryTransform: {
          ...baseline.boundaryTransform,
          handlerId: "transform.boundary-alternate",
        },
      },
      {
        ...baseline,
        boundaryTransform: {
          ...baseline.boundaryTransform,
          implementationRevision: digest("7"),
        },
      },
      { ...baseline, target: "cx16" },
      { ...baseline, configurationDigest: digest("8") },
    ];

    const caseDigests = variants.map((variant) => {
      const campaignDigest = identityOf(deriveCampaignIdentity(variant));
      return identityOf(deriveCaseIdentity(campaignDigest, [3, 5], 11)).digest;
    });

    expect(new Set(caseDigests).size).toBe(caseDigests.length);
  });

  it("rejects unequal canonical preimages when an injected digest collides", () => {
    const registry = createIdentityCollisionRegistry(() => new Uint8Array(32).fill(0x5a));
    const campaignDigest = digest("d");
    const first = deriveCaseIdentity(campaignDigest, [0], 0, registry);
    const collision = deriveCaseIdentity(campaignDigest, [1], 0, registry);

    expect(first.ok).toBe(true);
    expect(collision).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "identity.collision",
          path: "/digest",
        }),
      ],
    });
    expect(collision).not.toHaveProperty("identity");
  });
});

describe("implementation revision freshness", () => {
  it("rejects changed dependency bytes while the claimed revision stays fixed", () => {
    const metadata = {
      contractVersion: "1",
      entryPath: "packages/readiness/src/handler.ts",
      files: [
        {
          path: "packages/readiness/src/dependency.ts",
          content: textEncoder.encode("export const value = 1;\r\n"),
        },
        {
          path: "packages/readiness/src/handler.ts",
          content: textEncoder.encode(
            'import { value } from "./dependency.js";\r\nexport { value };\r\n',
          ),
        },
      ],
    };
    const derived = deriveImplementationRevision(metadata);
    expect(derived.ok).toBe(true);
    if (!derived.ok) {
      throw new Error("expected implementation revision derivation to succeed");
    }

    expect(
      validateImplementationRevision({
        claimedRevision: derived.revision,
        metadata,
      }).ok,
    ).toBe(true);

    const stale = validateImplementationRevision({
      claimedRevision: derived.revision,
      metadata: {
        ...metadata,
        files: [
          {
            ...metadata.files[0],
            content: textEncoder.encode("export const value = 2;\n"),
          },
          metadata.files[1],
        ],
      },
    });

    expect(stale).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "implementation.revision.stale",
          path: "/claimedRevision",
        }),
      ],
    });
    expect(stale).not.toHaveProperty("revision");
    expect(stale).not.toHaveProperty("normalizedFiles");
  });
});
