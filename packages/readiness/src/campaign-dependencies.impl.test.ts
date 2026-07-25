import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { registerFreshCandidateBinding } from "./binding-validator.js";
import type { ExecutableBindingInput, FreshCandidateRegistration } from "./binding-model.js";
import {
  normalizeCampaignDependencies,
  normalizeReplayDependencies,
  resolveReplayCampaignDependencies,
} from "./campaign-dependencies.js";
import type { CampaignIdentityInput } from "./case-identity.js";
import {
  deriveImplementationRevision,
  validateImplementationRevision,
} from "./implementation-revision.js";
import { parseInventoryJson } from "./json-input.js";
import { INVENTORY_V1_LIMITS } from "./limits.js";
import type { ModeledGeneratorSuite } from "./modeled-generator-model.js";
import { createModeledGeneratorSuite, getModeledSuiteState } from "./modeled-generator-suite.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { createRevisionRegistry, isResolvedFreshReplayBinding } from "./revision-registry.js";
import { validateInventorySchema } from "./schema-validator.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const encoder = new TextEncoder();

function digest(character: string): Sha256Digest {
  return `sha256:${character.repeat(64)}`;
}

function freshRegistration(
  binding: Omit<ExecutableBindingInput, "implementationRevision">,
): FreshCandidateRegistration {
  const path = `fixtures/${binding.handlerId}.ts`;
  const metadata = {
    contractVersion: binding.contractVersion,
    entryPath: path,
    files: [{ path, content: encoder.encode(`export const handler = "${binding.handlerId}";\n`) }],
  };
  const derived = deriveImplementationRevision(metadata);
  if (!derived.ok) throw new Error("expected implementation revision");
  const freshness = validateImplementationRevision({
    claimedRevision: derived.revision,
    metadata,
  });
  if (!freshness.ok) throw new Error("expected fresh implementation revision");
  const registered = registerFreshCandidateBinding({
    binding: { ...binding, implementationRevision: derived.revision },
    freshness,
  });
  if (!registered.ok) throw new Error("expected fresh candidate registration");
  return registered.registration;
}

interface ModeledSuiteFixture {
  readonly suite: ModeledGeneratorSuite;
  readonly digest: Sha256Digest;
  readonly protocolVersion: string;
  readonly manifestRegistryVersion: string;
}

async function modeledSuite(): Promise<ModeledSuiteFixture> {
  const [inventoryBytes, seedContractBytes, ruleModelBytes, reviewEvidenceBytes] =
    await Promise.all([
      readFile(resolve(REPOSITORY_ROOT, "readiness/inventory/compiler-readiness-v1.json")),
      readFile(resolve(REPOSITORY_ROOT, "readiness/rule-models/rule-model-seed-v1.json")),
      readFile(resolve(REPOSITORY_ROOT, "readiness/rule-models/rule-models-v1.json")),
      readFile(resolve(REPOSITORY_ROOT, "readiness/reviews/rule-models-v1-review.json")),
    ]);
  const parsed = parseInventoryJson(inventoryBytes, INVENTORY_V1_LIMITS);
  if (!parsed.ok) throw new Error("expected parsed inventory");
  const validated = validateInventorySchema(parsed.inventory);
  if (!validated.ok) throw new Error("expected validated inventory");
  const result = createModeledGeneratorSuite({
    inventory: validated.inventory,
    seedContractBytes,
    ruleModelBytes,
    reviewEvidenceBytes,
  });
  if (!result.ok) throw new Error("expected modeled suite");
  const state = getModeledSuiteState(result.suite);
  if (state === undefined) throw new Error("expected modeled suite state");
  return {
    suite: result.suite,
    digest: state.ruleModelDigest,
    protocolVersion: state.protocolVersion,
    manifestRegistryVersion: state.manifestRegistryVersion,
  };
}

it("separates public freshness registrations from private replay binding provenance", async () => {
  const modeled = await modeledSuite();
  expect(modeled.protocolVersion).toBe("rule-model-v1");
  expect(modeled.manifestRegistryVersion).toBe("rule-models-v1");
  const generator = freshRegistration({
    handlerId: "generator.frontend-cases",
    kind: "generator",
    contractVersion: "1.0.0",
    implementation: () => undefined,
  });
  const boundaryTransform = freshRegistration({
    handlerId: "transform.boundary-variants",
    kind: "transform",
    contractVersion: "1.0.0",
    implementation: () => undefined,
  });
  const inventory = {
    schemaVersion: 1,
    inventoryVersion: "inventory-v1",
    inventoryDigest: digest("1"),
    specRevision: "spec-v3.0",
  } as const;
  const renderer = {
    implementationRevision: digest("5"),
    implementation: () => ({ ok: false, diagnostics: [] }),
  } as const;
  const publicDependencies = {
    inventory,
    ruleModel: {
      schemaVersion: 1,
      ruleModelVersion: "rule-model-v1",
      ruleModelDigest: modeled.digest,
      suite: modeled.suite,
    },
    generator,
    boundaryTransform,
    renderer,
  } as const;

  expect(normalizeCampaignDependencies(publicDependencies)).toBeDefined();
  for (const alias of ["rule-models-v1", "models-v1"]) {
    expect(
      normalizeCampaignDependencies({
        ...publicDependencies,
        ruleModel: { ...publicDependencies.ruleModel, ruleModelVersion: alias },
      }),
    ).toBeUndefined();
  }
  expect(
    normalizeCampaignDependencies({
      ...publicDependencies,
      ruleModel: { ...publicDependencies.ruleModel, ruleModelDigest: digest("2") },
    }),
  ).toBeUndefined();
  expect(
    normalizeCampaignDependencies({
      ...publicDependencies,
      generator: generator.binding,
      boundaryTransform: boundaryTransform.binding,
    }),
  ).toBeUndefined();
  expect(isResolvedFreshReplayBinding(generator.binding, "generator")).toBe(false);

  const registryResult = createRevisionRegistry([
    { component: "rule-model", revision: modeled.digest, value: modeled.suite },
    {
      component: "generator",
      revision: generator.binding.implementationRevision,
      value: generator,
    },
    {
      component: "boundary-transform",
      revision: boundaryTransform.binding.implementationRevision,
      value: boundaryTransform,
    },
  ]);
  if (!registryResult.ok) throw new Error("expected exact registry");
  const resolvedGenerator = registryResult.registry.resolve(
    "generator",
    generator.binding.implementationRevision,
  );
  const resolvedBoundary = registryResult.registry.resolve(
    "boundary-transform",
    boundaryTransform.binding.implementationRevision,
  );
  const resolvedSuite = registryResult.registry.resolve("rule-model", modeled.digest);
  expect(resolvedSuite).toBe(modeled.suite);
  expect(isResolvedFreshReplayBinding(resolvedGenerator, "generator")).toBe(true);

  const campaign: CampaignIdentityInput = {
    inventorySchemaVersion: 1,
    inventoryVersion: inventory.inventoryVersion,
    inventoryDigest: inventory.inventoryDigest,
    specRevision: inventory.specRevision,
    ruleModelVersion: "rule-model-v1",
    ruleModelDigest: modeled.digest,
    generator: {
      handlerId: generator.binding.handlerId,
      contractVersion: generator.binding.contractVersion,
      implementationRevision: generator.binding.implementationRevision,
    },
    boundaryTransform: {
      handlerId: boundaryTransform.binding.handlerId,
      contractVersion: boundaryTransform.binding.contractVersion,
      implementationRevision: boundaryTransform.binding.implementationRevision,
    },
    rendererRevision: renderer.implementationRevision,
    target: "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: digest("0"),
    configurationDigest: digest("6"),
  };
  expect(
    normalizeReplayDependencies(
      {
        inventory,
        ruleModel: resolvedSuite,
        generator: resolvedGenerator,
        boundaryTransform: resolvedBoundary,
        renderer,
      },
      campaign,
    ),
  ).toBeDefined();
  expect(
    normalizeReplayDependencies(
      {
        inventory,
        ruleModel: resolvedSuite,
        generator: resolvedGenerator,
        boundaryTransform: resolvedBoundary,
        renderer,
      },
      { ...campaign, ruleModelVersion: "rule-models-v1" },
    ),
  ).toBeUndefined();
  expect(
    normalizeReplayDependencies(
      {
        inventory,
        ruleModel: resolvedSuite,
        generator: resolvedGenerator,
        boundaryTransform: resolvedBoundary,
        renderer,
      },
      { ...campaign, ruleModelDigest: digest("2") },
    ),
  ).toBeUndefined();
  expect(
    resolveReplayCampaignDependencies(
      {
        inventory: { ...inventory, inventoryDigest: digest("9") },
        ruleModel: resolvedSuite,
        generator: resolvedGenerator,
        boundaryTransform: resolvedBoundary,
        renderer,
      },
      campaign,
    ),
  ).toEqual({ ok: false, missing: "inventory" });
  expect(
    resolveReplayCampaignDependencies(
      {
        inventory,
        ruleModel: resolvedSuite,
        generator: resolvedGenerator,
        boundaryTransform: resolvedBoundary,
        renderer: { ...renderer, implementationRevision: digest("9") },
      },
      campaign,
    ),
  ).toEqual({ ok: false, missing: "renderer" });
});
