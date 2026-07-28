import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  INVENTORY_V1_LIMITS,
  boundaryVariantsHandler,
  createCampaignPlan,
  createGenerationBudgetTracker,
  createModeledGeneratorSuite,
  createOracleSuite,
  createRevisionRegistry,
  deriveConfigurationIdentity,
  deriveImplementationRevision,
  generateCampaignCase,
  generateFrontendCase,
  getCampaignPlanItem,
  parseInventoryJson,
  registerFreshCandidateBinding,
  renderGeneratedCase,
  validateImplementationRevision,
  validateGeneratorIr,
  validateInventorySchema,
} from "../index.js";
import type {
  CampaignDependenciesV1,
  CampaignIdentityInput,
  ExecutableBindingInput,
  FreshCandidateRegistration,
  GenModule,
  GenerationConfiguration,
  GenerationBudgetDimension,
  GeneratorHandlerV1,
  InventoryV1,
  RevisionEntry,
  RevisionRegistry,
  Sha256Digest,
  ModeledCaseRequest,
} from "../index.js";
import { createOracleContractsSpecFixture } from "./oracle-contracts-spec-fixture.js";

const encoder = new TextEncoder();
const rootUrl = new URL("../../../../", import.meta.url);
const INVENTORY_URL = new URL("readiness/inventory/compiler-readiness-v1.json", rootUrl);
const MODEL_URL = new URL("readiness/rule-models/rule-models-v1.json", rootUrl);
const SEED_URL = new URL("readiness/rule-models/rule-model-seed-v1.json", rootUrl);
const REVIEW_URL = new URL("readiness/reviews/rule-models-v1-review.json", rootUrl);
const WORD_RULE = "rule.ch02.2-primitive-types.word.range.0-65535";

const budget = Object.freeze({
  inputNodes: 4_096n,
  expressionDepth: 32n,
  evaluationSteps: 16_384n,
  frames: 16n,
  memoryCells: 256n,
  effects: 256n,
  transformedNodes: 8_192n,
});

const memory = Object.freeze({
  schemaVersion: 1 as const,
  cells: Object.freeze([{ address: 0x1000n, value: 4n }]),
});

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function requireValue<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] },
): T {
  if (!result.ok) throw new TypeError(JSON.stringify(result.diagnostics));
  return result.value;
}

function deriveRevision(name: string) {
  const path = `fixtures/${name}.ts`;
  const metadata = {
    contractVersion: "1.0.0",
    entryPath: path,
    files: [{ path, content: encoder.encode(`export const fixture = "${name}";\n`) }],
  } as const;
  const result = deriveImplementationRevision(metadata);
  if (!result.ok) throw new TypeError("expected fixture revision");
  return { metadata, revision: result.revision };
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
  if (!freshness.ok) throw new TypeError("expected fresh fixture revision");
  const result = registerFreshCandidateBinding({
    binding: { ...binding, implementationRevision: derived.revision },
    freshness,
  });
  if (!result.ok) throw new TypeError("expected fixture registration");
  return result.registration;
}

function comprehensiveModule(): GenModule {
  const extrema = [
    ["byte_min", "byte", 0n],
    ["byte_max", "byte", 255n],
    ["sbyte_min", "sbyte", -128n],
    ["sbyte_max", "sbyte", 127n],
    ["word_min", "word", 0n],
    ["word_max", "word", 65_535n],
    ["sword_min", "sword", -32_768n],
    ["sword_max", "sword", 32_767n],
  ] as const;
  const result = validateGeneratorIr({
    kind: "module",
    path: ["relation_fixture"],
    constants: [
      { kind: "const", name: "first", type: "word", value: literal("word", 3n) },
      { kind: "const", name: "second", type: "word", value: literal("word", 11n) },
      { kind: "const", name: "dependency", type: "word", value: literal("word", 5n) },
      {
        kind: "const",
        name: "dependent",
        type: "word",
        value: { kind: "name", type: "word", name: "dependency" },
      },
    ],
    functions: [
      {
        kind: "function",
        name: "main",
        parameters: [{ name: "input", type: "word" }],
        returnType: "word",
        body: [
          {
            kind: "local",
            name: "lift_me",
            type: "word",
            initializer: {
              kind: "binary",
              type: "word",
              operator: "+",
              left: { kind: "name", type: "word", name: "first" },
              right: { kind: "name", type: "word", name: "input" },
            },
          },
          {
            kind: "local",
            name: "literal_holder",
            type: "byte",
            initializer: literal("byte", 42n),
          },
          {
            kind: "local",
            name: "memory_local",
            type: "byte",
            initializer: {
              kind: "memory-read",
              type: "byte",
              width: 1,
              address: literal("word", 0x1000n),
            },
          },
          {
            kind: "local",
            name: "reassigned_local",
            type: "word",
            initializer: literal("word", 1n),
          },
          {
            kind: "assign",
            target: "reassigned_local",
            value: literal("word", 2n),
          },
          ...extrema.map(([name, type, value]) => ({
            kind: "local" as const,
            name,
            type,
            initializer: literal(type, value),
          })),
          {
            kind: "return",
            value: { kind: "name", type: "word", name: "lift_me" },
          },
        ],
      },
    ],
  });
  if (!result.ok) throw new TypeError(JSON.stringify(result.diagnostics));
  return result.module;
}

function literal(type: "byte" | "sbyte" | "word" | "sword", value: bigint) {
  return { kind: "literal" as const, type, value };
}

const semanticFixtureGenerator: GeneratorHandlerV1 = (suite, request) => {
  const generated = generateFrontendCase(suite, request);
  if (!generated.ok || generated.outcome !== "generated") return generated;
  const module = comprehensiveModule();
  const constructionUsage = {
    modules: 1n,
    declarations: 6n,
    "ir-nodes": 42n,
    statements: 14n,
    "expression-depth": 2n,
    "loop-work": 0n,
  } as const;
  const tracker = createGenerationBudgetTracker((request as ModeledCaseRequest).budget);
  for (const [dimension, amount] of Object.entries({
    ...constructionUsage,
    "source-bytes": 0,
    attempts: 1,
  })) {
    const consumed = tracker.consume(
      dimension as GenerationBudgetDimension,
      dimension === "loop-work" ? amount : Number(amount),
    );
    if (!consumed.ok) throw new TypeError(JSON.stringify(consumed.diagnostics));
  }
  const finalized = tracker.finalize(module, 0, 1);
  if (!finalized.ok) throw new TypeError(JSON.stringify(finalized.diagnostics));
  return {
    ok: true,
    outcome: "generated",
    case: {
      ...generated.case,
      projection: { kind: "valid", module },
      parameterBindings: [
        {
          kind: "parameter-value",
          parameterPath: "/functions/0/parameters/0",
          value: 5n,
        },
      ],
      validity: { kind: "valid" },
      constructionUsage,
    },
    diagnostics: [],
  };
};

function configuration(): GenerationConfiguration {
  return {
    caseCount: 16,
    maxInvalidCases: 0,
    enabledRuleIds: [WORD_RULE],
    spellings: ["literal"],
    budget: {
      maxModules: 2,
      maxDeclarations: 128,
      maxIrNodes: 512,
      maxStatements: 128,
      maxExpressionDepth: 16,
      maxLoopWork: 1n,
      maxSourceBytes: 65_536,
      maxAttempts: 32,
    },
  };
}

function completeRegistry(
  campaign: CampaignIdentityInput,
  configurationValue: GenerationConfiguration,
  dependencies: CampaignDependenciesV1,
): RevisionRegistry {
  const rows = [
    ["inventory", campaign.inventoryDigest, dependencies.inventory],
    ["rule-model", campaign.ruleModelDigest, dependencies.ruleModel.suite],
    ["generator", campaign.generator.implementationRevision, dependencies.generator],
    [
      "boundary-transform",
      campaign.boundaryTransform.implementationRevision,
      dependencies.boundaryTransform,
    ],
    ["renderer", campaign.rendererRevision, dependencies.renderer],
    ["configuration", campaign.configurationDigest, configurationValue],
  ] satisfies readonly (readonly [RevisionEntry["component"], Sha256Digest, unknown])[];
  const result = createRevisionRegistry(
    rows.map(([component, revision, value]) => ({ component, revision, value })),
  );
  if (!result.ok) throw new TypeError("expected complete fixture registry");
  return result.registry;
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
  if (!parsed.ok || parsed.inventory === undefined) throw new TypeError("expected inventory");
  const validated = validateInventorySchema(parsed.inventory);
  if (!validated.ok || validated.inventory === undefined) {
    throw new TypeError("expected validated inventory");
  }
  const modeled = createModeledGeneratorSuite({
    inventory: validated.inventory,
    seedContractBytes,
    ruleModelBytes,
    reviewEvidenceBytes,
  });
  if (!modeled.ok) throw new TypeError("expected modeled fixture suite");
  return {
    inventory: validated.inventory,
    inventoryBytes,
    modeledSuite: modeled.suite,
    ruleModelDigest: modeled.ruleModelDigest,
  };
}

function createSuite(input: {
  readonly inventory: InventoryV1;
  readonly modeledSuite: CampaignDependenciesV1["ruleModel"]["suite"];
  readonly registry: RevisionRegistry;
  readonly diagnosticManifestBytes: Uint8Array;
  readonly bindingRejectionBytes: Uint8Array;
}) {
  const result = createOracleSuite({
    modeledSuite: input.modeledSuite,
    replayRegistry: input.registry,
    inventory: input.inventory,
    diagnosticManifestBytes: input.diagnosticManifestBytes,
    bindingRejectionBytes: input.bindingRejectionBytes,
  });
  if (!result.ok) throw new TypeError(JSON.stringify(result.diagnostics));
  return result.suite;
}

export async function createSemanticRelationsSpecFixture() {
  const [authorities, oracle] = await Promise.all([
    loadAuthorities(),
    createOracleContractsSpecFixture(),
  ]);
  const configurationValue = configuration();
  const configurationIdentity = deriveConfigurationIdentity(configurationValue);
  if (!configurationIdentity.ok) throw new TypeError("expected configuration identity");
  const generator = freshRegistration("semantic-relations-generator", {
    handlerId: "generator.frontend-cases",
    kind: "generator",
    contractVersion: "1.0.0",
    implementation: semanticFixtureGenerator,
  });
  const boundaryTransform = freshRegistration("semantic-relations-boundary", {
    handlerId: "transform.boundary-variants",
    kind: "transform",
    contractVersion: "1.0.0",
    implementation: boundaryVariantsHandler,
  });
  const rendererRevision = deriveRevision("semantic-relations-renderer").revision;
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
    renderer: { implementationRevision: rendererRevision, implementation: renderGeneratedCase },
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
    rendererRevision,
    target: "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: `sha256:${"1".repeat(64)}`,
    configurationDigest: configurationIdentity.identity,
  };
  const prepared = requireValue(
    createCampaignPlan({ campaign, configuration: configurationValue, dependencies }),
  );
  const planItem = requireValue(getCampaignPlanItem(prepared, 0));
  semanticFixtureGenerator(authorities.modeledSuite, planItem.request);
  const generated = requireValue(generateCampaignCase(prepared, 0));
  const registry = completeRegistry(campaign, configurationValue, dependencies);
  const valid = {
    suite: createSuite({
      ...authorities,
      registry,
      diagnosticManifestBytes: oracle.diagnosticManifestBytes,
      bindingRejectionBytes: oracle.bindingRejectionBytes,
    }),
    sourceCase: generated.modeledCase,
    sourceProvenance: {
      schemaVersion: 1 as const,
      campaign,
      campaignDigest: prepared.summary.campaignDigest,
      caseIdentity: generated.identity,
      configuration: configurationValue,
    },
    entryFunction: "main",
    memory,
  };
  const invalid = [oracle.sourceInvalid, oracle.bindingInvalid].map((item) => ({
    suite: createSuite({
      inventory: oracle.inventory,
      modeledSuite: oracle.modeledSuite,
      registry: item.registry,
      diagnosticManifestBytes: oracle.diagnosticManifestBytes,
      bindingRejectionBytes: oracle.bindingRejectionBytes,
    }),
    sourceCase: item.generatedCase.modeledCase,
    sourceProvenance: item.sourceProvenance,
    entryFunction: item.entryFunction,
    memory: { schemaVersion: 1 as const, cells: [] },
  }));
  return Object.freeze({ valid: Object.freeze(valid), invalid: Object.freeze(invalid), budget });
}
