import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { registerFreshCandidateBinding } from "./binding-validator.js";
import type { ExecutableBindingInput, FreshCandidateRegistration } from "./binding-model.js";
import { readBoundedRegularFileNoFollow } from "./bounded-regular-file.js";
import type { CampaignDependenciesV1 } from "./campaign-model.js";
import { renderGeneratedCase } from "./case-generator.js";
import type { GenerationConfiguration } from "./canonical-identity.js";
import { deriveConfigurationIdentity } from "./case-identity.js";
import { createGenerationBudgetTracker } from "./generation-budget.js";
import type { GenerationBudgetDimension, GenModule } from "./generator-ir.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";
import {
  deriveImplementationRevision,
  validateImplementationRevision,
} from "./implementation-revision.js";
import { INVENTORY_V1_LIMITS } from "./limits.js";
import { parseInventoryJson } from "./json-input.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { createModeledGeneratorSuite } from "./modeled-generator-suite.js";
import type { GeneratorHandlerV1, ModeledCaseRequest } from "./modeled-generator-model.js";
import { boundaryVariantsHandler, generateFrontendCase } from "./modeled-generators.js";
import { oracleFailure, snapshotOracleInput, type OracleFailure } from "./oracle-input.js";
import { ORACLE_V1_LIMITS, type OracleSuite } from "./oracle-model.js";
import { ORACLE_MUTATION_AUTHORITY_MAX_BYTES } from "./oracle-mutation-policy.js";
import type { OracleMutationSuiteDescriptorV1 } from "./oracle-mutation-packet.js";
import { createOracleSuite } from "./oracle-suite.js";
import { createRevisionRegistry, type RevisionEntry } from "./revision-registry.js";
import { validateInventorySchema } from "./schema-validator.js";

/** Successful exact suite hydration for semantic-relation mutation vectors. */
export type OracleMutationSuiteHydrationResultV1 =
  | {
      readonly ok: true;
      readonly suite: OracleSuite;
      readonly diagnostics: readonly [];
    }
  | OracleFailure;

const ROOT_URL = new URL("../../../", import.meta.url);
const INVENTORY_URL = new URL("readiness/inventory/compiler-readiness-v1.json", ROOT_URL);
const MODEL_URL = new URL("readiness/rule-models/rule-models-v1.json", ROOT_URL);
const SEED_URL = new URL("readiness/rule-models/rule-model-seed-v1.json", ROOT_URL);
const REVIEW_URL = new URL("readiness/reviews/rule-models-v1-review.json", ROOT_URL);
const DIAGNOSTIC_URL = new URL("readiness/oracles/diagnostic-oracle-v1.json", ROOT_URL);
const BINDING_URL = new URL("readiness/oracles/binding-rejections-v1.json", ROOT_URL);
const WORD_RULE = "rule.ch02.2-primitive-types.word.range.0-65535";
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
let cachedHydration:
  | {
      readonly descriptor: OracleMutationSuiteDescriptorV1;
      readonly suite: OracleSuite;
    }
  | undefined;

const FIXED_CONFIGURATION: GenerationConfiguration = Object.freeze({
  caseCount: 16,
  maxInvalidCases: 0,
  enabledRuleIds: Object.freeze([WORD_RULE]),
  spellings: Object.freeze(["literal"] as const),
  budget: Object.freeze({
    maxModules: 2,
    maxDeclarations: 128,
    maxIrNodes: 512,
    maxStatements: 128,
    maxExpressionDepth: 16,
    maxLoopWork: 1n,
    maxSourceBytes: 65_536,
    maxAttempts: 32,
  }),
});

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function literal(type: "byte" | "sbyte" | "word" | "sword", value: bigint) {
  return Object.freeze({ kind: "literal" as const, type, value });
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
  if (!result.ok) throw new TypeError("Fixed semantic relation module is invalid.");
  return result.module;
}

const semanticMutationGenerator: GeneratorHandlerV1 = (suite, request) => {
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
    if (!consumed.ok) throw new TypeError("Fixed semantic relation budget is invalid.");
  }
  const finalized = tracker.finalize(module, 0, 1);
  if (!finalized.ok) throw new TypeError("Fixed semantic relation usage is invalid.");
  return Object.freeze({
    ok: true,
    outcome: "generated",
    case: Object.freeze({
      ...generated.case,
      projection: Object.freeze({ kind: "valid", module }),
      parameterBindings: Object.freeze([
        Object.freeze({
          kind: "parameter-value",
          parameterPath: "/functions/0/parameters/0",
          value: 5n,
        }),
      ]),
      validity: Object.freeze({ kind: "valid" }),
      constructionUsage: Object.freeze(constructionUsage),
    }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
};

function deriveRevision(name: string) {
  const path = `fixtures/${name}.ts`;
  const metadata = {
    contractVersion: "1.0.0",
    entryPath: path,
    files: [{ path, content: new TextEncoder().encode(`export const fixture = "${name}";\n`) }],
  } as const;
  const result = deriveImplementationRevision(metadata);
  if (!result.ok) throw new TypeError("Fixed fixture revision could not be derived.");
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
  if (!freshness.ok) throw new TypeError("Fixed fixture revision is stale.");
  const registered = registerFreshCandidateBinding({
    binding: { ...binding, implementationRevision: derived.revision },
    freshness,
  });
  if (!registered.ok) throw new TypeError("Fixed fixture binding is invalid.");
  return registered.registration;
}

function descriptorMatches(
  descriptor: OracleMutationSuiteDescriptorV1,
  values: {
    readonly inventoryBytes: Uint8Array;
    readonly seedBytes: Uint8Array;
    readonly modelBytes: Uint8Array;
    readonly reviewBytes: Uint8Array;
    readonly diagnosticBytes: Uint8Array;
    readonly bindingBytes: Uint8Array;
  },
): boolean {
  return (
    descriptor.schemaVersion === 1 &&
    descriptor.suiteId === "oracle-suite.phase4-mutation-v1" &&
    descriptor.inventoryDigest === sha256(values.inventoryBytes) &&
    descriptor.seedContractDigest === sha256(values.seedBytes) &&
    descriptor.ruleModelDigest === sha256(values.modelBytes) &&
    descriptor.ruleModelReviewDigest === sha256(values.reviewBytes) &&
    descriptor.diagnosticManifestDigest === sha256(values.diagnosticBytes) &&
    descriptor.bindingRejectionDigest === sha256(values.bindingBytes)
  );
}

/**
 * Reconstructs the exact package-owned suite selected by a data-only descriptor.
 *
 * @param descriptor Exact artifact and replay revisions.
 * @param configuration Carried replay configuration that must equal the fixed recipe.
 * @returns Hydrated suite or one closed authority/revision failure.
 *
 * @example
 * ```ts
 * const hydrated = await hydrateOracleMutationSuite(descriptor, configuration);
 * ```
 */
export async function hydrateOracleMutationSuite(
  descriptorInput: OracleMutationSuiteDescriptorV1,
  configurationInput: GenerationConfiguration,
): Promise<OracleMutationSuiteHydrationResultV1> {
  try {
    const descriptorSnapshot = snapshotOracleInput(descriptorInput, "/mutationFixture/suite");
    const configurationSnapshot = snapshotOracleInput(
      configurationInput,
      "/mutationFixture/configuration",
    );
    if (!descriptorSnapshot.ok) return descriptorSnapshot;
    if (!configurationSnapshot.ok) return configurationSnapshot;
    const descriptor = descriptorSnapshot.value as OracleMutationSuiteDescriptorV1;
    const configuration = configurationSnapshot.value as GenerationConfiguration;
    if (!isDeepStrictEqual(configuration, FIXED_CONFIGURATION)) {
      return oracleFailure(
        "oracle.authority.stale",
        "/mutationFixture/suite/replayRevisions/configuration",
        "Mutation suite configuration does not match its fixed recipe.",
      );
    }
    const [inventoryBytes, seedBytes, modelBytes, reviewBytes, diagnosticBytes, bindingBytes] =
      await Promise.all([
        readBoundedRegularFileNoFollow(INVENTORY_URL, INVENTORY_V1_LIMITS.maxInputBytes),
        readBoundedRegularFileNoFollow(SEED_URL, ORACLE_MUTATION_AUTHORITY_MAX_BYTES),
        readBoundedRegularFileNoFollow(MODEL_URL, ORACLE_MUTATION_AUTHORITY_MAX_BYTES),
        readBoundedRegularFileNoFollow(REVIEW_URL, ORACLE_MUTATION_AUTHORITY_MAX_BYTES),
        readBoundedRegularFileNoFollow(DIAGNOSTIC_URL, ORACLE_V1_LIMITS.authorityBytes),
        readBoundedRegularFileNoFollow(BINDING_URL, ORACLE_V1_LIMITS.authorityBytes),
      ]);
    const artifacts = {
      inventoryBytes,
      seedBytes,
      modelBytes,
      reviewBytes,
      diagnosticBytes,
      bindingBytes,
    };
    if (!descriptorMatches(descriptor, artifacts)) {
      return oracleFailure(
        "oracle.authority.stale",
        "/mutationFixture/suite",
        "Mutation suite authority digest is missing or stale.",
      );
    }
    if (
      cachedHydration !== undefined &&
      isDeepStrictEqual(cachedHydration.descriptor, descriptor)
    ) {
      return Object.freeze({
        ok: true,
        suite: cachedHydration.suite,
        diagnostics: EMPTY_DIAGNOSTICS,
      });
    }
    const parsed = parseInventoryJson(inventoryBytes, INVENTORY_V1_LIMITS);
    if (!parsed.ok || parsed.inventory === undefined) {
      return oracleFailure(
        "oracle.authority.stale",
        "/mutationFixture/suite/inventoryDigest",
        "Mutation suite inventory is invalid.",
      );
    }
    const validated = validateInventorySchema(parsed.inventory);
    if (!validated.ok || validated.inventory === undefined) {
      return oracleFailure(
        "oracle.authority.stale",
        "/mutationFixture/suite/inventoryDigest",
        "Mutation suite inventory schema is invalid.",
      );
    }
    const modeled = createModeledGeneratorSuite({
      inventory: validated.inventory,
      seedContractBytes: seedBytes,
      ruleModelBytes: modelBytes,
      reviewEvidenceBytes: reviewBytes,
    });
    if (!modeled.ok || modeled.ruleModelDigest !== descriptor.replayRevisions.ruleModel) {
      return oracleFailure(
        "oracle.authority.stale",
        "/mutationFixture/suite/replayRevisions/ruleModel",
        "Mutation suite rule-model revision is stale.",
      );
    }
    const configurationIdentity = deriveConfigurationIdentity(FIXED_CONFIGURATION);
    if (
      !configurationIdentity.ok ||
      configurationIdentity.identity !== descriptor.replayRevisions.configuration
    ) {
      return oracleFailure(
        "oracle.authority.stale",
        "/mutationFixture/suite/replayRevisions/configuration",
        "Mutation suite configuration revision is stale.",
      );
    }
    const generator = freshRegistration("semantic-relations-generator", {
      handlerId: "generator.frontend-cases",
      kind: "generator",
      contractVersion: "1.0.0",
      implementation: semanticMutationGenerator,
    });
    const boundaryTransform = freshRegistration("semantic-relations-boundary", {
      handlerId: "transform.boundary-variants",
      kind: "transform",
      contractVersion: "1.0.0",
      implementation: boundaryVariantsHandler,
    });
    const rendererRevision = deriveRevision("semantic-relations-renderer").revision;
    if (
      descriptor.replayRevisions.inventory !== sha256(inventoryBytes) ||
      descriptor.replayRevisions.generator !== generator.binding.implementationRevision ||
      descriptor.replayRevisions.boundaryTransform !==
        boundaryTransform.binding.implementationRevision ||
      descriptor.replayRevisions.renderer !== rendererRevision
    ) {
      return oracleFailure(
        "oracle.authority.stale",
        "/mutationFixture/suite/replayRevisions",
        "Mutation suite replay revisions do not match the fixed recipe.",
      );
    }
    const dependencies: CampaignDependenciesV1 = {
      inventory: {
        schemaVersion: 1,
        inventoryVersion: validated.inventory.inventoryVersion,
        inventoryDigest: sha256(inventoryBytes),
        specRevision: "spec-v3.0",
      },
      ruleModel: {
        schemaVersion: 1,
        ruleModelVersion: "rule-model-v1",
        ruleModelDigest: modeled.ruleModelDigest,
        suite: modeled.suite,
      },
      generator,
      boundaryTransform,
      renderer: {
        implementationRevision: rendererRevision,
        implementation: renderGeneratedCase,
      },
    };
    const registryRows = [
      ["inventory", descriptor.replayRevisions.inventory, dependencies.inventory],
      ["rule-model", descriptor.replayRevisions.ruleModel, modeled.suite],
      ["generator", descriptor.replayRevisions.generator, generator],
      ["boundary-transform", descriptor.replayRevisions.boundaryTransform, boundaryTransform],
      ["renderer", descriptor.replayRevisions.renderer, dependencies.renderer],
      ["configuration", descriptor.replayRevisions.configuration, FIXED_CONFIGURATION],
    ] satisfies readonly (readonly [RevisionEntry["component"], Sha256Digest, unknown])[];
    const registry = createRevisionRegistry(
      registryRows.map(([component, revision, value]) => ({
        component,
        revision,
        value,
      })),
    );
    if (!registry.ok) {
      return oracleFailure(
        "oracle.authority.stale",
        "/mutationFixture/suite/replayRevisions",
        "Mutation suite replay registry is invalid.",
      );
    }
    const suite = createOracleSuite({
      modeledSuite: modeled.suite,
      replayRegistry: registry.registry,
      inventory: validated.inventory,
      diagnosticManifestBytes: diagnosticBytes,
      bindingRejectionBytes: bindingBytes,
    });
    if (!suite.ok) return suite;
    cachedHydration = Object.freeze({
      descriptor,
      suite: suite.suite,
    });
    return Object.freeze({
      ok: true,
      suite: suite.suite,
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  } catch {
    return oracleFailure(
      "oracle.authority.stale",
      "/mutationFixture/suite",
      "Mutation suite could not be hydrated safely.",
    );
  }
}
