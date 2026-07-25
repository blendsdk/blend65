import { expect, it, vi } from "vitest";

vi.mock("./campaign-dependencies.js", () => ({
  campaignDependenciesMatch: () => true,
  normalizeCampaignDependencies: (value: unknown) => value,
  normalizeReplayDependencies: (value: unknown) => value,
}));

vi.mock("./modeled-generator-suite.js", () => ({
  getRuleGenerationDomain: () =>
    Object.freeze({
      ok: true,
      state: "modeled",
      ruleId: "rule.ch02.2-primitive-types.byte.range.0-255",
      handlerId: "generator.frontend-cases",
      choices: Object.freeze([
        Object.freeze({
          kind: "scalar",
          ruleId: "rule.ch02.2-primitive-types.byte.range.0-255",
          spelling: "literal",
          value: 0n,
        }),
      ]),
      diagnostics: Object.freeze([]),
    }),
}));

it("prepares a 100,000-case default replay as one target-only item", async () => {
  const [{ createBoundaryVariants }, campaignApi, identityApi, targetApi] = await Promise.all([
    import("./boundary-variants.js"),
    import("./campaign.js"),
    import("./case-identity.js"),
    import("./replay-target.js"),
  ]);
  const configuration = Object.freeze({
    caseCount: 100_000,
    maxInvalidCases: 0,
    enabledRuleIds: Object.freeze(["rule.ch02.2-primitive-types.byte.range.0-255"]),
    spellings: Object.freeze(["literal" as const]),
    budget: Object.freeze({
      maxModules: 1,
      maxDeclarations: 8,
      maxIrNodes: 64,
      maxStatements: 32,
      maxExpressionDepth: 8,
      maxLoopWork: 1n,
      maxSourceBytes: 4096,
      maxAttempts: 1,
    }),
  });
  const configurationIdentity = identityApi.deriveConfigurationIdentity(configuration);
  if (!configurationIdentity.ok) throw new TypeError("Expected configuration identity.");
  const campaign = Object.freeze({
    inventorySchemaVersion: 1 as const,
    inventoryVersion: "inventory-v1",
    inventoryDigest: `sha256:${"1".repeat(64)}` as const,
    specRevision: "spec-v3.0",
    ruleModelVersion: "rule-model-v1",
    ruleModelDigest: `sha256:${"2".repeat(64)}` as const,
    generator: Object.freeze({
      handlerId: "generator.frontend-cases" as const,
      contractVersion: "1.0.0" as const,
      implementationRevision: `sha256:${"3".repeat(64)}` as const,
    }),
    boundaryTransform: Object.freeze({
      handlerId: "transform.boundary-variants" as const,
      contractVersion: "1.0.0" as const,
      implementationRevision: `sha256:${"4".repeat(64)}` as const,
    }),
    rendererRevision: `sha256:${"5".repeat(64)}` as const,
    target: "c64" as const,
    prngAlgorithm: "blend65-sha256-ctr-v1" as const,
    seed: `sha256:${"6".repeat(64)}` as const,
    configurationDigest: configurationIdentity.identity,
  });
  const campaignIdentity = identityApi.deriveCampaignIdentity(campaign);
  if (!campaignIdentity.ok) throw new TypeError("Expected campaign identity.");
  const carried = identityApi.deriveCaseIdentity(
    campaignIdentity.identity,
    Object.freeze([1, 99_998]),
    99_999,
  );
  if (!carried.ok) throw new TypeError("Expected carried case identity.");
  const target = campaignApi.createReplayCampaignTarget(
    {
      campaign,
      configuration,
      dependencies: {
        inventory: {},
        ruleModel: { suite: {} },
        generator: {
          handlerId: "generator.frontend-cases",
          implementation: () => undefined,
        },
        boundaryTransform: {
          implementation: createBoundaryVariants,
        },
        renderer: { implementation: () => undefined },
      },
    },
    carried.identity,
  );

  expect(target).toMatchObject({ ok: true, diagnostics: [] });
  if (target.ok) {
    expect(Object.hasOwn(target.value, "summary")).toBe(false);
    expect(targetApi.getReplayCampaignTargetState(target.value)).toMatchObject({
      item: { ordinal: 99_999, generationPath: [1, 99_998] },
      identity: carried.identity,
    });
  }
});
