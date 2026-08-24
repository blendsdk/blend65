import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  INVENTORY_V1_LIMITS,
  boundaryVariantsHandler,
  createCampaignPlan,
  createModeledGeneratorSuite,
  deriveConfigurationIdentity,
  deriveImplementationRevision,
  generateFrontendCase,
  generateRuntimeCase,
  parseInventoryJson,
  registerFreshCandidateBinding,
  renderGeneratedCase,
  resolvePublishedSnapshotByDigest,
  validateImplementationRevision,
  validateInventorySchema,
  type CampaignDependenciesV1,
  type CampaignIdentityInput,
  type ExecutableBindingInput,
  type FreshCandidateRegistration,
  type GenerationConfiguration,
  type PreparedCampaign,
  type Sha256Digest,
} from "@blend65/readiness";
import { createPublishedExecutionCampaignV1 } from "@blend65/readiness/execution-campaign-identity";

import { CURRENT_EXECUTION_PARENT_DIGEST } from "./execution-publication-catalog-spec-fixture.js";

const ENCODER = new TextEncoder();
const REPOSITORY_ROOT_URL = new URL("../../../../", import.meta.url);
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const INVENTORY_URL = new URL(
  "readiness/inventory/compiler-readiness-v1.json",
  REPOSITORY_ROOT_URL,
);
const MODEL_URL = new URL("readiness/rule-models/rule-models-v1.json", REPOSITORY_ROOT_URL);
const SEED_URL = new URL("readiness/rule-models/rule-model-seed-v1.json", REPOSITORY_ROOT_URL);
const REVIEW_URL = new URL("readiness/reviews/rule-models-v1-review.json", REPOSITORY_ROOT_URL);

const RULES = Object.freeze({
  boolean: "rule.ch02.2-primitive-types.boolean.range.true",
  byte: "rule.ch02.2-primitive-types.byte.range.0-255",
  sbyte: "rule.ch02.2-primitive-types.sbyte.range.128-127",
  sword: "rule.ch02.2-primitive-types.sword.range.32768-32767",
  word: "rule.ch02.2-primitive-types.word.range.0-65535",
  peek: "rule.ch12.3-1-memory-access.peek-addr.signature.word",
  peekw: "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
  poke: "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
  pokew: "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
});

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function deriveRevision(name: string) {
  const path = `fixtures/${name}.ts`;
  const metadata = {
    contractVersion: "1.0.0",
    entryPath: path,
    files: [{ path, content: ENCODER.encode(`export const fixture = "${name}";\n`) }],
  } as const;
  const derived = deriveImplementationRevision(metadata);
  if (!derived.ok) throw new TypeError("Expected implementation revision derivation.");
  return { metadata, revision: derived.revision };
}

function freshRegistration(
  name: string,
  binding: Omit<ExecutableBindingInput, "implementationRevision">,
): FreshCandidateRegistration {
  const derived = deriveRevision(name);
  const freshness = validateImplementationRevision({
    claimedRevision: derived.revision,
    metadata: derived.metadata,
  });
  if (!freshness.ok) throw new TypeError("Expected a fresh implementation revision.");
  const registered = registerFreshCandidateBinding({
    binding: { ...binding, implementationRevision: derived.revision },
    freshness,
  });
  if (!registered.ok) throw new TypeError("Expected a fresh candidate registration.");
  return registered.registration;
}

type GenuineCampaignKind = "frontend" | "runtime" | "orchestration";

function configuration(route: GenuineCampaignKind): GenerationConfiguration {
  return {
    caseCount: route === "frontend" ? 72 : route === "runtime" ? 120 : 40,
    maxInvalidCases: route === "frontend" ? 24 : route === "runtime" ? 32 : 16,
    enabledRuleIds:
      route === "frontend"
        ? [RULES.boolean, RULES.byte, RULES.sbyte, RULES.sword, RULES.word].sort()
        : [RULES.peek, RULES.peekw, RULES.poke, RULES.pokew].sort(),
    spellings:
      route === "orchestration"
        ? ["literal", "parameter"]
        : ["const", "literal", "local", "parameter"],
    budget: {
      maxModules: 4,
      maxDeclarations: 128,
      maxIrNodes: 512,
      maxStatements: 256,
      maxExpressionDepth: 16,
      maxLoopWork: 1n,
      maxSourceBytes: 65_536,
      maxAttempts: 128,
    },
  };
}

async function loadAuthorities() {
  const [inventoryBytes, ruleModelBytes, seedContractBytes, reviewEvidenceBytes] =
    await Promise.all([
      readFile(INVENTORY_URL),
      readFile(MODEL_URL),
      readFile(SEED_URL),
      readFile(REVIEW_URL),
    ]);
  const parsed = parseInventoryJson(inventoryBytes, INVENTORY_V1_LIMITS);
  if (!parsed.ok || parsed.inventory === undefined) {
    throw new TypeError("Expected inventory parsing.");
  }
  const validated = validateInventorySchema(parsed.inventory);
  if (!validated.ok || validated.inventory === undefined) {
    throw new TypeError("Expected inventory validation.");
  }
  const modeled = createModeledGeneratorSuite({
    inventory: validated.inventory,
    seedContractBytes,
    ruleModelBytes,
    reviewEvidenceBytes,
  });
  if (!modeled.ok) throw new TypeError("Expected reviewed modeled authority.");
  return {
    inventory: validated.inventory,
    inventoryBytes,
    modeledSuite: modeled.suite,
    ruleModelDigest: modeled.ruleModelDigest,
  };
}

async function createCampaign(
  route: GenuineCampaignKind,
  authorities: Awaited<ReturnType<typeof loadAuthorities>>,
): Promise<PreparedCampaign> {
  const configurationValue = configuration(route);
  if (route === "orchestration") {
    const selected = await resolvePublishedSnapshotByDigest({
      repositoryRoot: REPOSITORY_ROOT,
      publicationDigest: CURRENT_EXECUTION_PARENT_DIGEST,
    });
    if (!selected.ok) {
      throw new TypeError("Expected the selected execution parent publication.");
    }
    const prepared = createPublishedExecutionCampaignV1(selected.value, {
      schemaVersion: 1,
      target: "c64",
      seed: `sha256:${"7".repeat(64)}`,
      configuration: configurationValue,
    });
    if (!prepared.ok) {
      throw new TypeError("Expected a genuine published oracle campaign.");
    }
    return prepared.value;
  }
  const configurationIdentity = deriveConfigurationIdentity(configurationValue);
  if (!configurationIdentity.ok) throw new TypeError("Expected configuration identity.");
  const generator = freshRegistration(`execution-${route}-generator`, {
    handlerId: route === "frontend" ? "generator.frontend-cases" : "generator.runtime-cases",
    kind: "generator",
    contractVersion: "1.0.0",
    implementation: route === "frontend" ? generateFrontendCase : generateRuntimeCase,
  });
  const boundaryTransform = freshRegistration(`execution-${route}-boundary`, {
    handlerId: "transform.boundary-variants",
    kind: "transform",
    contractVersion: "1.0.0",
    implementation: boundaryVariantsHandler,
  });
  const renderer: CampaignDependenciesV1["renderer"] = {
    implementationRevision: deriveRevision(`execution-${route}-renderer`).revision,
    implementation: renderGeneratedCase,
  };
  const dependencies: CampaignDependenciesV1 = {
    inventory: {
      schemaVersion: 1,
      inventoryVersion: authorities.inventory.inventoryVersion,
      inventoryDigest: sha256(authorities.inventoryBytes),
      specRevision: "spec-v3.0",
    },
    ruleModel: {
      schemaVersion: 1,
      ruleModelVersion: "rule-model-v1",
      ruleModelDigest: authorities.ruleModelDigest,
      suite: authorities.modeledSuite,
    },
    generator,
    boundaryTransform,
    renderer,
  };
  const campaign: CampaignIdentityInput = {
    inventorySchemaVersion: 1,
    inventoryVersion: dependencies.inventory.inventoryVersion,
    inventoryDigest: dependencies.inventory.inventoryDigest,
    specRevision: dependencies.inventory.specRevision,
    ruleModelVersion: dependencies.ruleModel.ruleModelVersion,
    ruleModelDigest: dependencies.ruleModel.ruleModelDigest,
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
    seed: `sha256:${(route === "frontend" ? "6" : "7").repeat(64)}`,
    configurationDigest: configurationIdentity.identity,
  };
  const prepared = createCampaignPlan({
    campaign,
    configuration: configurationValue,
    dependencies,
  });
  if (!prepared.ok) throw new TypeError("Expected a genuine prepared campaign.");
  return prepared.value;
}

/** Creates genuine scalar, runtime, and bounded orchestration campaigns for integration tests. */
export async function createGenuineExecutionCampaigns(): Promise<{
  readonly frontend: PreparedCampaign;
  readonly runtime: PreparedCampaign;
  readonly orchestration: PreparedCampaign;
}> {
  const authorities = await loadAuthorities();
  return Object.freeze({
    frontend: await createCampaign("frontend", authorities),
    runtime: await createCampaign("runtime", authorities),
    orchestration: await createCampaign("orchestration", authorities),
  });
}
