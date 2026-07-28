import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  INVENTORY_V1_LIMITS,
  boundaryVariantsHandler,
  createCampaignPlan,
  createModeledGeneratorSuite,
  createRevisionRegistry,
  deriveConfigurationIdentity,
  deriveImplementationRevision,
  generateCampaignCase,
  generateFrontendCase,
  generateRuntimeCase,
  parseInventoryJson,
  registerFreshCandidateBinding,
  renderGeneratedCase,
  validateImplementationRevision,
  validateInventorySchema,
} from "../index.js";
import type {
  CampaignDependenciesV1,
  CampaignIdentityInput,
  ExecutableBindingInput,
  FreshCandidateRegistration,
  GeneratedCase,
  GenerationConfiguration,
  InventoryV1,
  RevisionEntry,
  RevisionRegistry,
  Sha256Digest,
} from "../index.js";

const encoder = new TextEncoder();
const rootUrl = new URL("../../../../", import.meta.url);
const INVENTORY_URL = new URL("readiness/inventory/compiler-readiness-v1.json", rootUrl);
const MODEL_URL = new URL("readiness/rule-models/rule-models-v1.json", rootUrl);
const SEED_URL = new URL("readiness/rule-models/rule-model-seed-v1.json", rootUrl);
const REVIEW_URL = new URL("readiness/reviews/rule-models-v1-review.json", rootUrl);

export const ORACLE_HANDLERS = Object.freeze({
  frontend: "oracle.frontend-result",
  compiler: "oracle.compiler-result",
  emitted: "oracle.emitted-program",
  runtime: "oracle.runtime-state",
});

export const ORACLE_RULES = Object.freeze({
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

const DIAGNOSTIC_ROWS = Object.freeze([
  [ORACLE_RULES.boolean, "neighbor.scalar.boolean.wrong-type", "initializer", "E10152"],
  [ORACLE_RULES.boolean, "neighbor.scalar.boolean.wrong-type", "return-expression", "E10172"],
  [ORACLE_RULES.byte, "neighbor.scalar.byte.above-max", undefined, "E10084"],
  [ORACLE_RULES.byte, "neighbor.scalar.byte.below-min", undefined, "E10084"],
  [ORACLE_RULES.sbyte, "neighbor.scalar.sbyte.above-max", undefined, "E10084"],
  [ORACLE_RULES.sbyte, "neighbor.scalar.sbyte.below-min", undefined, "E10084"],
  [ORACLE_RULES.sword, "neighbor.scalar.sword.above-max", undefined, "E10084"],
  [ORACLE_RULES.sword, "neighbor.scalar.sword.below-min", undefined, "E10084"],
  [ORACLE_RULES.word, "neighbor.scalar.word.above-max", undefined, "E10084"],
  [ORACLE_RULES.word, "neighbor.scalar.word.below-min", undefined, "E10084"],
  [ORACLE_RULES.peek, "neighbor.memory.peek.wrong-address-type", undefined, "E10172"],
  [ORACLE_RULES.peek, "neighbor.memory.peek.wrong-arity", undefined, "E10041"],
  [ORACLE_RULES.peekw, "neighbor.memory.peekw.wrong-address-type", undefined, "E10172"],
  [ORACLE_RULES.peekw, "neighbor.memory.peekw.wrong-arity", undefined, "E10041"],
  [ORACLE_RULES.poke, "neighbor.memory.poke.wrong-address-type", undefined, "E10172"],
  [ORACLE_RULES.poke, "neighbor.memory.poke.wrong-arity", undefined, "E10041"],
  [ORACLE_RULES.poke, "neighbor.memory.poke.wrong-value-type", undefined, "E10172"],
  [ORACLE_RULES.pokew, "neighbor.memory.pokew.wrong-address-type", undefined, "E10172"],
  [ORACLE_RULES.pokew, "neighbor.memory.pokew.wrong-arity", undefined, "E10041"],
  [ORACLE_RULES.pokew, "neighbor.memory.pokew.wrong-value-type", undefined, "E10172"],
] as const);

export const BINDING_ROWS = Object.freeze([
  Object.freeze({
    ruleId: ORACLE_RULES.boolean,
    neighborId: "neighbor.scalar.boolean.wrong-type",
    spelling: "parameter" as const,
    rejectionCode: "binding.value.type-invalid" as const,
  }),
  ...[
    [ORACLE_RULES.byte, "neighbor.scalar.byte.above-max"],
    [ORACLE_RULES.byte, "neighbor.scalar.byte.below-min"],
    [ORACLE_RULES.sbyte, "neighbor.scalar.sbyte.above-max"],
    [ORACLE_RULES.sbyte, "neighbor.scalar.sbyte.below-min"],
    [ORACLE_RULES.sword, "neighbor.scalar.sword.above-max"],
    [ORACLE_RULES.sword, "neighbor.scalar.sword.below-min"],
    [ORACLE_RULES.word, "neighbor.scalar.word.above-max"],
    [ORACLE_RULES.word, "neighbor.scalar.word.below-min"],
  ].map(([ruleId, neighborId]) =>
    Object.freeze({
      ruleId,
      neighborId,
      spelling: "parameter" as const,
      rejectionCode: "binding.value.range-invalid" as const,
    }),
  ),
]);

function sha256(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function diagnosticRecords(): Readonly<Record<string, unknown>>[] {
  return DIAGNOSTIC_ROWS.map(([ruleId, neighborId, diagnosticContext, diagnosticCode]) =>
    Object.freeze({
      ruleId,
      neighborId,
      ...(diagnosticContext === undefined ? {} : { diagnosticContext }),
      diagnosticCode,
      phase: "semantic" as const,
      severity: "error" as const,
      observableFields: Object.freeze(["code", "phase", "severity"] as const),
    }),
  );
}

function diagnosticManifest(
  inventory: InventoryV1,
  records: readonly Readonly<Record<string, unknown>>[] = diagnosticRecords(),
) {
  return Object.freeze({
    schemaVersion: 1 as const,
    manifestVersion: "1.0.0",
    specRevision: inventory.specRevision,
    policyRevision: "diagnostic-oracle-policy-v1",
    records: Object.freeze(records),
  });
}

function bindingManifest(records: readonly Readonly<Record<string, unknown>>[] = BINDING_ROWS) {
  return Object.freeze({
    schemaVersion: 1 as const,
    manifestVersion: "1.0.0",
    policyRevision: "binding-rejection-policy-v1",
    records: Object.freeze(records),
  });
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
  const derived = deriveImplementationRevision(metadata);
  if (!derived.ok) throw new TypeError("expected implementation revision derivation");
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
  if (!freshness.ok) throw new TypeError("expected a fresh implementation revision");
  const registered = registerFreshCandidateBinding({
    binding: { ...binding, implementationRevision: derived.revision },
    freshness,
  });
  if (!registered.ok) throw new TypeError("expected a fresh candidate registration");
  return registered.registration;
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
    throw new TypeError("expected inventory parsing");
  }
  const validated = validateInventorySchema(parsed.inventory);
  if (!validated.ok || validated.inventory === undefined) {
    throw new TypeError("expected inventory validation");
  }
  const modeled = createModeledGeneratorSuite({
    inventory: validated.inventory,
    seedContractBytes,
    ruleModelBytes,
    reviewEvidenceBytes,
  });
  if (!modeled.ok) throw new TypeError("expected reviewed modeled authority");
  return {
    inventory: validated.inventory,
    inventoryBytes,
    modeledSuite: modeled.suite,
    ruleModelDigest: modeled.ruleModelDigest,
  };
}

function configuration(route: "frontend" | "runtime"): GenerationConfiguration {
  return {
    caseCount: route === "frontend" ? 72 : 120,
    maxInvalidCases: route === "frontend" ? 24 : 32,
    enabledRuleIds:
      route === "frontend"
        ? [
            ORACLE_RULES.boolean,
            ORACLE_RULES.byte,
            ORACLE_RULES.sbyte,
            ORACLE_RULES.sword,
            ORACLE_RULES.word,
          ].sort()
        : [ORACLE_RULES.peek, ORACLE_RULES.peekw, ORACLE_RULES.poke, ORACLE_RULES.pokew].sort(),
    spellings: ["const", "literal", "local", "parameter"],
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
  const entries = rows.map(([component, revision, value]) => ({ component, revision, value }));
  const result = createRevisionRegistry(entries);
  if (!result.ok) throw new TypeError("expected complete revision registry");
  return result.registry;
}

function campaignFixture(
  route: "frontend" | "runtime",
  authorities: Awaited<ReturnType<typeof loadAuthorities>>,
) {
  const configurationValue = configuration(route);
  const configurationIdentity = deriveConfigurationIdentity(configurationValue);
  if (!configurationIdentity.ok) throw new TypeError("expected configuration identity");
  const generator = freshRegistration(`oracle-${route}-generator`, {
    handlerId: route === "frontend" ? "generator.frontend-cases" : "generator.runtime-cases",
    kind: "generator",
    contractVersion: "1.0.0",
    implementation: route === "frontend" ? generateFrontendCase : generateRuntimeCase,
  });
  const boundaryTransform = freshRegistration(`oracle-${route}-boundary`, {
    handlerId: "transform.boundary-variants",
    kind: "transform",
    contractVersion: "1.0.0",
    implementation: boundaryVariantsHandler,
  });
  const rendererRevision = deriveRevision(`oracle-${route}-renderer`).revision;
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
    renderer: {
      implementationRevision: rendererRevision,
      implementation: renderGeneratedCase,
    },
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
    seed: `sha256:${"0".repeat(64)}`,
    configurationDigest: configurationIdentity.identity,
  };
  const prepared = requireValue(
    createCampaignPlan({
      campaign,
      configuration: configurationValue,
      dependencies,
    }),
  );
  return {
    campaign,
    configuration: configurationValue,
    prepared,
    registry: completeRegistry(campaign, configurationValue, dependencies),
  };
}

function generatedCases(fixture: ReturnType<typeof campaignFixture>): readonly GeneratedCase[] {
  return Array.from({ length: fixture.configuration.caseCount }, (_, ordinal) =>
    requireValue(generateCampaignCase(fixture.prepared, ordinal)),
  );
}

function caseFixture(fixture: ReturnType<typeof campaignFixture>, generatedCase: GeneratedCase) {
  const projection = generatedCase.modeledCase.projection;
  const module = projection.kind === "valid" ? projection.module : projection.baseline;
  const entry = module.functions[0];
  if (entry === undefined) throw new TypeError("expected generated entry function");
  return Object.freeze({
    generatedCase,
    entryFunction: entry.name,
    projectionKind:
      projection.kind === "valid"
        ? ("valid" as const)
        : projection.transform.kind === "parameter-binding-replace"
          ? ("invalid-parameter-binding" as const)
          : ("invalid-source-transform" as const),
    sourceProvenance: Object.freeze({
      schemaVersion: 1,
      campaign: fixture.campaign,
      campaignDigest: fixture.prepared.summary.campaignDigest,
      caseIdentity: generatedCase.identity,
      configuration: fixture.configuration,
    }),
    registry: fixture.registry,
  });
}

function requireCase(
  cases: readonly GeneratedCase[],
  predicate: (generatedCase: GeneratedCase) => boolean,
): GeneratedCase {
  const generatedCase = cases.find(predicate);
  if (generatedCase === undefined) throw new TypeError("expected generated campaign case");
  return generatedCase;
}

interface AuthorityMutation<T> {
  readonly name: "removed" | "added" | "duplicate" | "reordered" | "misclassified";
  readonly records: readonly T[];
  readonly code:
    | "oracle.authority.missing"
    | "oracle.authority.not-accepted"
    | "oracle.contract.invalid";
  readonly field?: string;
}

function mutations<T>(
  records: readonly T[],
  added: T,
  misclassified: T,
  field: string,
): readonly AuthorityMutation<T>[] {
  const first = records[0];
  const second = records[1];
  if (first === undefined || second === undefined) {
    throw new TypeError("expected canonical authority records");
  }
  return [
    { name: "removed", records: records.slice(0, -1), code: "oracle.authority.missing" },
    { name: "added", records: [...records, added], code: "oracle.authority.not-accepted" },
    { name: "duplicate", records: [first, ...records], code: "oracle.authority.not-accepted" },
    {
      name: "reordered",
      records: [second, first, ...records.slice(2)],
      code: "oracle.authority.not-accepted",
    },
    {
      name: "misclassified",
      records: [misclassified, ...records.slice(1)],
      code: "oracle.contract.invalid",
      field,
    },
  ];
}

function authorityVariants(
  inventory: InventoryV1,
  diagnosticManifestBytes: Uint8Array,
  bindingRejectionBytes: Uint8Array,
) {
  const diagnostic = diagnosticRecords();
  const binding: Readonly<Record<string, unknown>>[] = [...BINDING_ROWS];
  const diagnosticPath = "/diagnosticManifestBytes/records";
  const bindingPath = "/bindingRejectionBytes/records";
  const diagnosticMutations = mutations(
    diagnostic,
    { ...diagnostic[18], neighborId: "neighbor.memory.pokew.unreviewed" },
    { ...diagnostic[0], phase: "parser" },
    "phase",
  );
  const bindingMutations = mutations(
    binding,
    { ...binding[8], neighborId: "neighbor.scalar.word.unreviewed" },
    { ...binding[0], spelling: "local" },
    "spelling",
  );
  return Object.freeze([
    ...diagnosticMutations.map(({ name, records, code, field }) => ({
      name: `${name} diagnostic`,
      diagnosticManifestBytes: jsonBytes(diagnosticManifest(inventory, records)),
      bindingRejectionBytes,
      code,
      path: field === undefined ? diagnosticPath : `${diagnosticPath}/0/${field}`,
    })),
    {
      name: "invalid diagnostic context",
      diagnosticManifestBytes: jsonBytes(
        diagnosticManifest(inventory, [
          { ...diagnostic[0], diagnosticContext: "condition" },
          ...diagnostic.slice(1),
        ]),
      ),
      bindingRejectionBytes,
      code: "oracle.contract.invalid" as const,
      path: `${diagnosticPath}/0/diagnosticContext`,
    },
    ...bindingMutations.map(({ name, records, code, field }) => ({
      name: `${name} binding`,
      diagnosticManifestBytes,
      bindingRejectionBytes: jsonBytes(bindingManifest(records)),
      code,
      path: field === undefined ? bindingPath : `${bindingPath}/0/${field}`,
    })),
  ]);
}

export async function createOracleContractsSpecFixture() {
  const authorities = await loadAuthorities();
  const frontend = campaignFixture("frontend", authorities);
  const runtime = campaignFixture("runtime", authorities);
  const frontendCases = generatedCases(frontend);
  const runtimeCase = requireValue(generateCampaignCase(runtime.prepared, 0));
  const sourceInvalid = requireCase(
    frontendCases,
    ({ modeledCase }) =>
      modeledCase.primaryRuleId === ORACLE_RULES.byte &&
      modeledCase.validity.kind === "invalid" &&
      modeledCase.validity.neighborId === "neighbor.scalar.byte.above-max" &&
      modeledCase.projection.kind === "invalid" &&
      modeledCase.projection.transform.kind !== "parameter-binding-replace",
  );
  const bindingInvalid = requireCase(
    frontendCases,
    ({ modeledCase }) =>
      modeledCase.validity.kind === "invalid" &&
      modeledCase.spelling === "parameter" &&
      modeledCase.projection.kind === "invalid" &&
      modeledCase.projection.transform.kind === "parameter-binding-replace",
  );
  const booleanInitializer = requireCase(
    frontendCases,
    ({ modeledCase }) =>
      modeledCase.primaryRuleId === ORACLE_RULES.boolean &&
      modeledCase.spelling === "local" &&
      modeledCase.validity.kind === "invalid" &&
      modeledCase.validity.neighborId === "neighbor.scalar.boolean.wrong-type" &&
      modeledCase.projection.kind === "invalid" &&
      modeledCase.projection.transform.kind === "scalar-expression-replace" &&
      modeledCase.projection.transform.expressionPath === "/functions/0/body/0/initializer",
  );
  const booleanReturnExpression = requireCase(
    frontendCases,
    ({ modeledCase }) =>
      modeledCase.primaryRuleId === ORACLE_RULES.boolean &&
      modeledCase.spelling === "literal" &&
      modeledCase.validity.kind === "invalid" &&
      modeledCase.validity.neighborId === "neighbor.scalar.boolean.wrong-type" &&
      modeledCase.projection.kind === "invalid" &&
      modeledCase.projection.transform.kind === "scalar-expression-replace" &&
      modeledCase.projection.transform.expressionPath === "/functions/0/body/0/value",
  );
  if (
    runtimeCase.modeledCase.validity.kind !== "valid" ||
    runtimeCase.planItem.request.choice.kind !== "memory"
  ) {
    throw new TypeError("expected a valid generated memory case");
  }
  const diagnostic = diagnosticManifest(authorities.inventory);
  const binding = bindingManifest();
  const diagnosticManifestBytes = jsonBytes(diagnostic);
  const bindingRejectionBytes = jsonBytes(binding);
  return Object.freeze({
    inventory: authorities.inventory,
    modeledSuite: authorities.modeledSuite,
    diagnosticManifest: diagnostic,
    bindingManifest: binding,
    diagnosticManifestBytes,
    bindingRejectionBytes,
    authorityVariants: authorityVariants(
      authorities.inventory,
      diagnosticManifestBytes,
      bindingRejectionBytes,
    ),
    sourceInvalid: caseFixture(frontend, sourceInvalid),
    bindingInvalid: caseFixture(frontend, bindingInvalid),
    booleanInitializer: caseFixture(frontend, booleanInitializer),
    booleanReturnExpression: caseFixture(frontend, booleanReturnExpression),
    runtimeValid: caseFixture(runtime, runtimeCase),
  });
}
