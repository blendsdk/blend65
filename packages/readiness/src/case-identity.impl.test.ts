import { describe, expect, it, vi } from "vitest";

import {
  createIdentityCollisionRegistry,
  deriveCampaignIdentity,
  deriveCaseIdentity,
  deriveConfigurationIdentity,
  IDENTITY_COLLISION_REGISTRY_LIMITS,
  type CampaignIdentityInput,
  type GenerationConfiguration,
  type Sha256Digest,
} from "./case-identity.js";
import { deriveIdentityDigest } from "./identity-collision-registry.js";

function digest(character: string): Sha256Digest {
  return `sha256:${character.repeat(64)}`;
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

function identityOf<T>(
  value:
    | { readonly ok: true; readonly identity: T }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] },
): T {
  expect(value.ok).toBe(true);
  if (!value.ok) throw new Error("expected identity");
  return value.identity;
}

function campaign(): CampaignIdentityInput {
  return {
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
    configurationDigest: identityOf(deriveConfigurationIdentity(configuration())),
  };
}

describe("identity collision registry", () => {
  it("is idempotent for equal preimages and rejects unequal preimages", () => {
    const registry = createIdentityCollisionRegistry();
    const preimage = Uint8Array.of(1, 2);
    const registeredDigest = digest("a");

    expect(registry.register(registeredDigest, preimage)).toMatchObject({ ok: true });
    preimage[0] = 9;
    expect(registry.register(registeredDigest, Uint8Array.of(1, 2))).toMatchObject({ ok: true });
    expect(registry.register(registeredDigest, Uint8Array.of(1, 3))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "identity.collision", path: "/digest" }],
    });
    // @ts-expect-error Runtime registry input intentionally violates the digest type.
    expect(registry.register("invalid", new Uint8Array())).toMatchObject({
      ok: false,
      diagnostics: [{ code: "identity.input.invalid", path: "/digest" }],
    });
    // @ts-expect-error Runtime registry preimage intentionally violates the byte type.
    expect(registry.register(registeredDigest, {})).toMatchObject({
      ok: false,
      diagnostics: [{ code: "identity.input.invalid", path: "/digest" }],
    });
  });

  it("rejects invalid, throwing and forged collision capabilities as data", () => {
    const invalidDigest = createIdentityCollisionRegistry(() => new Uint8Array(31));
    const throwingDigest = createIdentityCollisionRegistry(() => {
      throw new TypeError("blocked");
    });
    const baseline = campaign();
    expect(deriveCampaignIdentity(baseline, invalidDigest)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/digest" }],
    });
    expect(deriveCampaignIdentity(baseline, throwingDigest)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/digest" }],
    });

    expect(
      // @ts-expect-error Runtime validation must reject structurally forged capabilities.
      deriveCampaignIdentity(baseline, Object.freeze({ register: () => ({ ok: true }) })),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/digest" }],
    });
  });

  it("fails closed at explicit retention bounds and releases state on disposal", () => {
    const registry = createIdentityCollisionRegistry();
    for (let index = 0; index < IDENTITY_COLLISION_REGISTRY_LIMITS.maxEntries; index += 1) {
      const indexedDigest: Sha256Digest = `sha256:${index.toString(16).padStart(64, "0")}`;
      expect(registry.register(indexedDigest, new Uint8Array())).toMatchObject({ ok: true });
    }
    expect(
      registry.register(
        `sha256:${IDENTITY_COLLISION_REGISTRY_LIMITS.maxEntries.toString(16).padStart(64, "0")}`,
        new Uint8Array(),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "identity.registry.limit", path: "/registry" }],
    });

    registry.dispose();
    expect(registry.register(digest("a"), new Uint8Array())).toMatchObject({
      ok: false,
      diagnostics: [{ code: "identity.registry.disposed", path: "/registry" }],
    });
    expect(deriveCampaignIdentity(campaign(), registry)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "identity.registry.disposed", path: "/registry" }],
    });
  });

  it("rejects a byte-overflowing preimage for an existing digest before copying", () => {
    const registry = createIdentityCollisionRegistry();
    const oversized = new Uint8Array(IDENTITY_COLLISION_REGISTRY_LIMITS.maxPreimageBytes + 1);
    expect(registry.register(digest("b"), Uint8Array.of(1))).toMatchObject({ ok: true });
    const slice = vi.spyOn(Uint8Array.prototype, "slice");
    try {
      expect(registry.register(digest("b"), oversized)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "identity.registry.limit", path: "/registry" }],
      });
      expect(deriveIdentityDigest(oversized, undefined)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "identity.registry.limit", path: "/registry" }],
      });
      expect(slice).not.toHaveBeenCalled();
    } finally {
      slice.mockRestore();
      registry.dispose();
    }
  });

  it("checks an injected identity digest length before copying its output", () => {
    const registry = createIdentityCollisionRegistry(() => new Uint8Array(31));
    const slice = vi.spyOn(Uint8Array.prototype, "slice");
    try {
      expect(deriveIdentityDigest(Uint8Array.of(1, 2), registry)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "identity.input.invalid", path: "/digest" }],
      });
      expect(slice).toHaveBeenCalledTimes(2);
    } finally {
      slice.mockRestore();
      registry.dispose();
    }
  });
});

describe("closed campaign and case identities", () => {
  it.each([
    [{ ...campaign(), extra: true }, "/campaign"],
    [{ ...campaign(), inventoryVersion: "../inventory" }, "/campaign/inventoryVersion"],
    [{ ...campaign(), inventoryDigest: "bad" }, "/campaign/inventoryDigest"],
    [
      { ...campaign(), generator: { ...campaign().generator, handlerId: "../generator" } },
      "/campaign/generator/handlerId",
    ],
    [
      { ...campaign(), generator: { ...campaign().generator, contractVersion: "" } },
      "/campaign/generator/contractVersion",
    ],
    [{ ...campaign(), generator: null }, "/campaign/generator"],
    [
      {
        ...campaign(),
        generator: { ...campaign().generator, implementationRevision: "bad" },
      },
      "/campaign/generator/implementationRevision",
    ],
    [{ ...campaign(), boundaryTransform: null }, "/campaign/boundaryTransform"],
    [
      {
        ...campaign(),
        boundaryTransform: {
          ...campaign().boundaryTransform,
          implementationRevision: "bad",
        },
      },
      "/campaign/boundaryTransform/implementationRevision",
    ],
    [{ ...campaign(), inventorySchemaVersion: 2 }, "/campaign/inventorySchemaVersion"],
    [{ ...campaign(), target: "host" }, "/campaign/target"],
    [{ ...campaign(), prngAlgorithm: "random" }, "/campaign/prngAlgorithm"],
  ])("rejects malformed campaign data at a stable path", (input, path) => {
    // @ts-expect-error Hostile runtime input intentionally violates the public campaign type.
    expect(deriveCampaignIdentity(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "identity.input.invalid", path }],
    });
  });

  it("defensively closes case identity output", () => {
    const campaignDigest = identityOf(deriveCampaignIdentity(campaign()));
    const sourcePath = [1, 2];
    const result = deriveCaseIdentity(campaignDigest, sourcePath, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    sourcePath[0] = 9;
    result.preimage[0] = 0xff;

    expect(result.identity.generationPath).toEqual([1, 2]);
    expect(Object.isFrozen(result.identity)).toBe(true);
    expect(Object.isFrozen(result.identity.generationPath)).toBe(true);
    expect(deriveCaseIdentity(campaignDigest, [1, 2], 3)).toMatchObject({
      ok: true,
      identity: { digest: result.identity.digest },
    });
  });

  it.each([
    ["bad", [0], 0, "/campaignDigest"],
    [digest("a"), [-1], 0, "/generationPath/0"],
    [digest("a"), [0], -1, "/ordinal"],
  ])("rejects malformed case identity input", (campaignDigest, path, ordinal, expectedPath) => {
    expect(
      deriveCaseIdentity(
        // @ts-expect-error Hostile digest is intentional.
        campaignDigest,
        path,
        ordinal,
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: expectedPath }],
    });
  });

  it("rejects invalid configuration shape without hashing it", () => {
    expect(
      deriveConfigurationIdentity({
        ...configuration(),
        enabledRuleIds: ["S3-T1", "S3-T1"],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/configuration/enabledRuleIds" }],
    });
  });

  it("rejects cyclic and proxy campaign/path structures without exceptions", () => {
    const cyclic: Record<string, unknown> = { ...campaign() };
    cyclic.self = cyclic;
    // @ts-expect-error Cyclic runtime campaign intentionally violates the public type.
    expect(deriveCampaignIdentity(cyclic)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "identity.input.invalid" }],
    });
    const hostileCampaign = new Proxy(campaign(), {
      ownKeys: () => {
        throw new TypeError("blocked");
      },
    });
    expect(deriveCampaignIdentity(hostileCampaign)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/campaign" }],
    });

    const hostilePath = new Proxy([1], {
      ownKeys: () => {
        throw new TypeError("blocked");
      },
    });
    expect(deriveCaseIdentity(digest("a"), hostilePath, 0)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "identity.input.invalid" }],
    });
  });
});
