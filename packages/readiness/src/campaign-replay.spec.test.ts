import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { describe, expect, it, vi } from "vitest";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const INVENTORY_PATH = resolve(REPOSITORY_ROOT, "readiness/inventory/compiler-readiness-v1.json");
const MODEL_PATH = resolve(REPOSITORY_ROOT, "readiness/rule-models/rule-models-v1.json");
const SEED_PATH = resolve(REPOSITORY_ROOT, "readiness/rule-models/rule-model-seed-v1.json");
const REVIEW_PATH = resolve(REPOSITORY_ROOT, "readiness/reviews/rule-models-v1-review.json");
const CHILD_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "test-fixtures/replay-spec-child.ts",
);
const VITE_NODE_PATH = resolve(REPOSITORY_ROOT, "node_modules/vite-node/vite-node.mjs");
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

type Digest = `sha256:${string}`;
type CampaignGeneratorId =
  | "generator.frontend-cases"
  | "generator.compiler-cases"
  | "generator.runtime-cases";
type Spelling = "literal" | "const" | "local" | "parameter";
type IdentityComponent =
  | "inventory"
  | "rule-model"
  | "generator"
  | "boundary-transform"
  | "renderer"
  | "configuration";

interface GenerationBudget {
  readonly maxModules: number;
  readonly maxDeclarations: number;
  readonly maxIrNodes: number;
  readonly maxStatements: number;
  readonly maxExpressionDepth: number;
  readonly maxLoopWork: bigint;
  readonly maxSourceBytes: number;
  readonly maxAttempts: number;
}

interface GenerationConfiguration {
  readonly caseCount: number;
  readonly maxInvalidCases: number;
  readonly enabledRuleIds: readonly string[];
  readonly spellings: readonly Spelling[];
  readonly budget: GenerationBudget;
}

interface HandlerIdentity {
  readonly handlerId: string;
  readonly contractVersion: string;
  readonly implementationRevision: Digest;
}

interface CampaignIdentityInput {
  readonly inventorySchemaVersion: 1;
  readonly inventoryVersion: string;
  readonly inventoryDigest: Digest;
  readonly specRevision: string;
  readonly ruleModelVersion: string;
  readonly ruleModelDigest: Digest;
  readonly generator: HandlerIdentity;
  readonly boundaryTransform: HandlerIdentity;
  readonly rendererRevision: Digest;
  readonly target: "c64" | "c64u" | "cx16" | "a800xl" | "a7800";
  readonly prngAlgorithm: "blend65-sha256-ctr-v1";
  readonly seed: Digest;
  readonly configurationDigest: Digest;
}

interface CaseIdentity {
  readonly campaignDigest: Digest;
  readonly generationPath: readonly number[];
  readonly ordinal: number;
  readonly digest: Digest;
}

interface ParameterValueBinding {
  readonly kind: "parameter-value";
  readonly parameterPath: string;
  readonly value: bigint | boolean;
}

type InvalidTransform =
  | {
      readonly kind:
        | "intrinsic-argument-remove"
        | "intrinsic-argument-insert"
        | "intrinsic-argument-replace";
      readonly callPath: string;
      readonly argumentIndex: number;
      readonly argument?: unknown;
    }
  | {
      readonly kind: "scalar-expression-replace";
      readonly expressionPath: string;
      readonly replacement: { readonly kind: "integer-literal"; readonly value: bigint };
    }
  | {
      readonly kind: "parameter-binding-replace";
      readonly parameterPath: string;
      readonly replacement: { readonly kind: "integer-literal"; readonly value: bigint };
    };

interface GeneratedModeledCase {
  readonly projection:
    | { readonly kind: "valid"; readonly module: unknown }
    | {
        readonly kind: "invalid";
        readonly baseline: unknown;
        readonly transform: InvalidTransform;
      };
  readonly parameterBindings: readonly ParameterValueBinding[];
  readonly primaryRuleId: string;
  readonly claimedRuleIds: readonly string[];
  readonly spelling: Spelling;
  readonly validity:
    | { readonly kind: "valid" }
    | {
        readonly kind: "invalid";
        readonly neighborId: string;
        readonly violatedPredicateId: string;
        readonly expectedDiagnosticFamily: string;
      };
  readonly constructionUsage: Readonly<
    Record<
      "modules" | "declarations" | "ir-nodes" | "statements" | "expression-depth" | "loop-work",
      bigint
    >
  >;
}

interface ModeledCaseRequest {
  readonly handlerId: CampaignGeneratorId;
  readonly modulePath: readonly string[];
  readonly choice:
    | {
        readonly kind: "scalar";
        readonly ruleId: string;
        readonly spelling: Spelling;
        readonly value: bigint | boolean;
      }
    | {
        readonly kind: "memory";
        readonly ruleId: string;
        readonly addressSpelling: Spelling;
        readonly addressForm: "direct" | "computed";
        readonly valueSpelling?: Spelling;
      };
  readonly validity:
    | { readonly kind: "valid" }
    | { readonly kind: "invalid"; readonly neighborId: string };
  readonly budget: GenerationBudget;
}

interface CampaignPlanItem {
  readonly ordinal: number;
  readonly generationPath: readonly [0 | 1 | 2, number];
  readonly lane: "coverage-valid" | "random-valid" | "invalid";
  readonly request: ModeledCaseRequest;
  readonly renderOptions: {
    readonly maxSourceBytes: number;
    readonly literalSpellings: readonly [];
  };
}

interface PreparedCampaign {
  readonly summary: {
    readonly schemaVersion: 1;
    readonly campaignDigest: Digest;
    readonly totalCaseCount: number;
    readonly validCaseCount: number;
    readonly invalidCaseCount: number;
  };
}

interface GeneratedCase {
  readonly identity: CaseIdentity;
  readonly planItem: CampaignPlanItem;
  readonly modeledCase: GeneratedModeledCase;
  readonly source: string;
  readonly sourceBytes: Uint8Array;
  readonly roundTripProjection: unknown;
  readonly effectiveParameterBindings: readonly ParameterValueBinding[];
  readonly usage: Readonly<
    Record<
      | "modules"
      | "declarations"
      | "ir-nodes"
      | "statements"
      | "expression-depth"
      | "loop-work"
      | "source-bytes"
      | "attempts",
      bigint
    >
  >;
  readonly attempts: number;
}

interface ExecutableBinding {
  readonly handlerId: string;
  readonly kind: "generator" | "transform";
  readonly contractVersion: "1.0.0";
  readonly implementationRevision: Digest;
  readonly implementation: (...args: readonly unknown[]) => unknown;
}

interface FreshCandidateRegistration {
  readonly binding: ExecutableBinding;
}

interface ImplementationRevisionInput {
  readonly contractVersion: "1.0.0";
  readonly entryPath: string;
  readonly files: readonly {
    readonly path: string;
    readonly content: Uint8Array;
  }[];
}

type ImplementationRevisionResult =
  | {
      readonly ok: true;
      readonly revision: Digest;
      readonly normalizedFiles: readonly {
        readonly path: string;
        readonly content: Uint8Array;
      }[];
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly unknown[] };

interface CampaignDependencies {
  readonly inventory: {
    readonly schemaVersion: 1;
    readonly inventoryVersion: string;
    readonly inventoryDigest: Digest;
    readonly specRevision: string;
  };
  readonly ruleModel: {
    readonly schemaVersion: 1;
    readonly ruleModelVersion: string;
    readonly ruleModelDigest: Digest;
    readonly suite: unknown;
  };
  readonly generator: FreshCandidateRegistration;
  readonly boundaryTransform: FreshCandidateRegistration;
  readonly renderer: {
    readonly implementationRevision: Digest;
    readonly implementation: (
      generatedCase: GeneratedModeledCase,
      options: CampaignPlanItem["renderOptions"],
    ) => unknown;
  };
}

interface ReplayEnvelope {
  readonly schemaVersion: 1;
  readonly campaign: CampaignIdentityInput;
  readonly campaignDigest: Digest;
  readonly caseIdentity: CaseIdentity;
  readonly configuration: GenerationConfiguration;
}

type CampaignResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly diagnostics: readonly { readonly code: string; readonly path: string }[];
    };

type ReplayResult =
  | { readonly ok: true; readonly case: GeneratedCase; readonly source: Uint8Array }
  | {
      readonly ok: false;
      readonly kind: "replay-incompatible";
      readonly missing: IdentityComponent;
    }
  | {
      readonly ok: false;
      readonly kind: "replay-invalid";
      readonly diagnostics: readonly { readonly code: string; readonly path: string }[];
    };

interface RevisionRegistry {
  resolve(component: IdentityComponent, revision: Digest): unknown | undefined;
}

interface PlannedApi {
  readonly INVENTORY_V1_LIMITS: unknown;
  readonly parseInventoryJson: (
    bytes: Uint8Array,
    limits: unknown,
  ) => { readonly ok: boolean; readonly inventory?: unknown };
  readonly validateInventorySchema: (inventory: unknown) => {
    readonly ok: boolean;
    readonly inventory?: unknown;
  };
  readonly createModeledGeneratorSuite: (
    input: unknown,
  ) =>
    | { readonly ok: true; readonly suite: unknown; readonly diagnostics: readonly [] }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] };
  readonly generateFrontendCase: (...args: readonly unknown[]) => unknown;
  readonly generateRuntimeCase: (...args: readonly unknown[]) => unknown;
  readonly boundaryVariantsHandler: (...args: readonly unknown[]) => unknown;
  readonly deriveConfigurationIdentity: (
    configuration: GenerationConfiguration,
  ) =>
    | { readonly ok: true; readonly identity: Digest }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] };
  readonly deriveCampaignIdentity: (
    campaign: CampaignIdentityInput,
  ) =>
    | { readonly ok: true; readonly identity: Digest }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] };
  readonly deriveImplementationRevision: (
    input: ImplementationRevisionInput,
  ) => ImplementationRevisionResult;
  readonly validateImplementationRevision: (input: {
    readonly claimedRevision: Digest;
    readonly metadata: ImplementationRevisionInput;
  }) => ImplementationRevisionResult;
  readonly registerFreshCandidateBinding: (input: {
    readonly binding: ExecutableBinding;
    readonly freshness: Extract<ImplementationRevisionResult, { readonly ok: true }>;
  }) =>
    | {
        readonly ok: true;
        readonly registration: FreshCandidateRegistration;
        readonly diagnostics: readonly [];
      }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] };
  readonly createRevisionRegistry: (
    entries: readonly { component: IdentityComponent; revision: Digest; value: unknown }[],
  ) =>
    | { readonly ok: true; readonly registry: RevisionRegistry }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] };
  readonly renderGeneratedCase: (
    generatedCase: GeneratedModeledCase,
    options: CampaignPlanItem["renderOptions"],
  ) => unknown;
  readonly createCampaignCollisionIndex: (input: {
    readonly campaignDigest: Digest;
    readonly digest?: (preimage: Uint8Array) => Uint8Array;
  }) => CampaignResult<unknown>;
  readonly createCampaignPlan: (input: {
    readonly campaign: CampaignIdentityInput;
    readonly configuration: GenerationConfiguration;
    readonly dependencies: CampaignDependencies;
    readonly collisionIndex?: unknown;
  }) => CampaignResult<PreparedCampaign>;
  readonly getCampaignPlanItem: (
    campaign: PreparedCampaign,
    ordinal: number,
  ) => CampaignResult<CampaignPlanItem>;
  readonly generateCase: (
    campaign: PreparedCampaign,
    item: CampaignPlanItem,
  ) => CampaignResult<GeneratedCase>;
  readonly generateCampaignCase: (
    campaign: PreparedCampaign,
    ordinal: number,
  ) => CampaignResult<GeneratedCase>;
  readonly replayCase: (input: {
    readonly envelopeBytes: Uint8Array;
    readonly registry: RevisionRegistry;
    readonly collisionIndex?: unknown;
  }) => ReplayResult;
}

const REQUIRED_CALLABLES = [
  "parseInventoryJson",
  "validateInventorySchema",
  "createModeledGeneratorSuite",
  "generateFrontendCase",
  "generateRuntimeCase",
  "boundaryVariantsHandler",
  "deriveConfigurationIdentity",
  "deriveCampaignIdentity",
  "deriveImplementationRevision",
  "validateImplementationRevision",
  "registerFreshCandidateBinding",
  "createRevisionRegistry",
  "renderGeneratedCase",
  "createCampaignCollisionIndex",
  "createCampaignPlan",
  "getCampaignPlanItem",
  "generateCase",
  "generateCampaignCase",
  "replayCase",
] as const;

const RULES = {
  byte: "rule.ch02.2-primitive-types.byte.range.0-255",
  sbyte: "rule.ch02.2-primitive-types.sbyte.range.128-127",
  sword: "rule.ch02.2-primitive-types.sword.range.32768-32767",
  word: "rule.ch02.2-primitive-types.word.range.0-65535",
  peek: "rule.ch12.3-1-memory-access.peek-addr.signature.word",
  peekw: "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
  poke: "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
  pokew: "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
} as const;

const BASE_BUDGET: GenerationBudget = {
  maxModules: 4,
  maxDeclarations: 128,
  maxIrNodes: 512,
  maxStatements: 256,
  maxExpressionDepth: 16,
  maxLoopWork: 1n,
  maxSourceBytes: 65_536,
  maxAttempts: 128,
};

function sha256(bytes: Uint8Array): Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fixedDigest(digit: string): Digest {
  return `sha256:${digit.repeat(64)}`;
}

function requireSuccess<T>(result: CampaignResult<T>): T {
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result.diagnostics));
  }
  expect(result.ok).toBe(true);
  return result.value;
}

function requireIdentity(
  result:
    | { readonly ok: true; readonly identity: Digest }
    | { readonly ok: false; readonly diagnostics: readonly unknown[] },
): Digest {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError("expected identity derivation to succeed");
  }
  return result.identity;
}

function freshCandidate(
  api: PlannedApi,
  fixtureName: string,
  binding: Omit<ExecutableBinding, "implementationRevision">,
): FreshCandidateRegistration {
  const path = `fixtures/${fixtureName}.ts`;
  const metadata: ImplementationRevisionInput = {
    contractVersion: "1.0.0",
    entryPath: path,
    files: [
      {
        path,
        content: encoder.encode(`export const fixture = "${fixtureName}";\n`),
      },
    ],
  };
  const derived = api.deriveImplementationRevision(metadata);
  expect(derived.ok).toBe(true);
  if (!derived.ok) {
    throw new TypeError("fixture implementation revision derivation failed");
  }
  const freshness = api.validateImplementationRevision({
    claimedRevision: derived.revision,
    metadata,
  });
  expect(freshness.ok).toBe(true);
  if (!freshness.ok) {
    throw new TypeError("fixture implementation revision validation failed");
  }
  const registered = api.registerFreshCandidateBinding({
    binding: {
      ...binding,
      implementationRevision: derived.revision,
    },
    freshness,
  });
  expect(registered.ok).toBe(true);
  if (!registered.ok) {
    throw new TypeError("fixture candidate registration failed");
  }
  return registered.registration;
}

function isPlannedApi(value: object): value is PlannedApi {
  return (
    "INVENTORY_V1_LIMITS" in value &&
    REQUIRED_CALLABLES.every(
      (name) => name in value && typeof Reflect.get(value, name) === "function",
    )
  );
}

async function plannedApi(): Promise<PlannedApi> {
  const value = await import("./index.js");
  const missing: string[] = REQUIRED_CALLABLES.filter(
    (name) => !(name in value) || typeof Reflect.get(value, name) !== "function",
  );
  if (!("INVENTORY_V1_LIMITS" in value)) {
    missing.push("INVENTORY_V1_LIMITS");
  }
  if (missing.length > 0) {
    throw new TypeError(`Missing campaign composition exports: ${missing.join(", ")}`);
  }
  if (!isPlannedApi(value)) {
    throw new TypeError("The campaign composition API has an invalid runtime shape.");
  }
  return value;
}

function wireText(value: unknown): string {
  return JSON.stringify(value, (_key, member: unknown) =>
    typeof member === "bigint" ? member.toString(10) : member,
  );
}

function wireBytes(value: unknown): Uint8Array {
  return encoder.encode(wireText(value));
}

function wireObject(value: unknown): Record<string, unknown> {
  return JSON.parse(wireText(value)) as Record<string, unknown>;
}

interface Fixture {
  readonly api: PlannedApi;
  readonly configuration: GenerationConfiguration;
  readonly campaign: CampaignIdentityInput;
  readonly dependencies: CampaignDependencies;
  readonly prepared: PreparedCampaign;
}

async function createFixture(
  route: "frontend" | "runtime",
  overrides: Partial<GenerationConfiguration> = {},
  dependencySpies?: {
    readonly generator?: ReturnType<typeof vi.fn>;
    readonly boundary?: ReturnType<typeof vi.fn>;
    readonly renderer?: ReturnType<typeof vi.fn>;
  },
): Promise<Fixture> {
  const api = await plannedApi();
  const [inventoryBytes, modelBytes, seedContractBytes, reviewEvidenceBytes] = await Promise.all([
    readFile(INVENTORY_PATH),
    readFile(MODEL_PATH),
    readFile(SEED_PATH),
    readFile(REVIEW_PATH),
  ]);
  const parsed = api.parseInventoryJson(inventoryBytes, api.INVENTORY_V1_LIMITS);
  if (!parsed.ok || parsed.inventory === undefined) {
    throw new TypeError("the fixed inventory must parse");
  }
  const validated = api.validateInventorySchema(parsed.inventory);
  if (!validated.ok || validated.inventory === undefined) {
    throw new TypeError("the fixed inventory must validate");
  }
  const suiteResult = api.createModeledGeneratorSuite({
    seedContractBytes,
    ruleModelBytes: modelBytes,
    reviewEvidenceBytes,
    inventory: validated.inventory,
  });
  if (!suiteResult.ok) {
    throw new TypeError("the independently reviewed modeled suite must load");
  }

  const enabledRuleIds =
    route === "runtime"
      ? [RULES.peek, RULES.peekw, RULES.poke, RULES.pokew].sort()
      : [RULES.byte, RULES.sbyte, RULES.sword, RULES.word].sort();
  const configuration: GenerationConfiguration = {
    caseCount: route === "runtime" ? 120 : 72,
    maxInvalidCases: route === "runtime" ? 32 : 24,
    enabledRuleIds,
    spellings: ["const", "literal", "local", "parameter"],
    budget: BASE_BUDGET,
    ...overrides,
  };
  const configurationDigest = requireIdentity(api.deriveConfigurationIdentity(configuration));
  const generatorId = route === "runtime" ? "generator.runtime-cases" : "generator.frontend-cases";
  const generatorImplementation =
    route === "runtime" ? api.generateRuntimeCase : api.generateFrontendCase;
  const inventoryDigest = sha256(inventoryBytes);
  const ruleModelDigest = sha256(modelBytes);
  const rendererRevision = fixedDigest("5");
  const generator = freshCandidate(
    api,
    dependencySpies?.generator === undefined ? `generator-${route}` : `generator-${route}-spy`,
    {
      handlerId: generatorId,
      kind: "generator",
      contractVersion: "1.0.0",
      implementation: dependencySpies?.generator ?? generatorImplementation,
    },
  );
  const boundaryTransform = freshCandidate(
    api,
    dependencySpies?.boundary === undefined ? "boundary-default" : "boundary-spy",
    {
      handlerId: "transform.boundary-variants",
      kind: "transform",
      contractVersion: "1.0.0",
      implementation: dependencySpies?.boundary ?? api.boundaryVariantsHandler,
    },
  );
  const dependencies: CampaignDependencies = {
    inventory: {
      schemaVersion: 1,
      inventoryVersion: "compiler-readiness-v1",
      inventoryDigest,
      specRevision: "spec-v3.0",
    },
    ruleModel: {
      schemaVersion: 1,
      ruleModelVersion: "rule-model-v1",
      ruleModelDigest,
      suite: suiteResult.suite,
    },
    generator,
    boundaryTransform,
    renderer: {
      implementationRevision: rendererRevision,
      implementation: dependencySpies?.renderer ?? api.renderGeneratedCase,
    },
  };
  const campaign: CampaignIdentityInput = {
    inventorySchemaVersion: 1,
    inventoryVersion: dependencies.inventory.inventoryVersion,
    inventoryDigest,
    specRevision: dependencies.inventory.specRevision,
    ruleModelVersion: dependencies.ruleModel.ruleModelVersion,
    ruleModelDigest,
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
    seed: fixedDigest("0"),
    configurationDigest,
  };
  const prepared = requireSuccess(
    api.createCampaignPlan({ campaign, configuration, dependencies }),
  );
  return { api, configuration, campaign, dependencies, prepared };
}

function planItems(fixture: Fixture): CampaignPlanItem[] {
  return Array.from({ length: fixture.configuration.caseCount }, (_, ordinal) =>
    requireSuccess(fixture.api.getCampaignPlanItem(fixture.prepared, ordinal)),
  );
}

function generatedCases(fixture: Fixture): GeneratedCase[] {
  return Array.from({ length: fixture.configuration.caseCount }, (_, ordinal) =>
    requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, ordinal)),
  );
}

function replayEnvelope(fixture: Fixture, generatedCase: GeneratedCase): ReplayEnvelope {
  return {
    schemaVersion: 1,
    campaign: fixture.campaign,
    campaignDigest: fixture.prepared.summary.campaignDigest,
    caseIdentity: generatedCase.identity,
    configuration: fixture.configuration,
  };
}

function revisionEntries(
  fixture: Fixture,
): readonly { component: IdentityComponent; revision: Digest; value: unknown }[] {
  return [
    {
      component: "inventory",
      revision: fixture.campaign.inventoryDigest,
      value: fixture.dependencies.inventory,
    },
    {
      component: "rule-model",
      revision: fixture.campaign.ruleModelDigest,
      value: fixture.dependencies.ruleModel.suite,
    },
    {
      component: "generator",
      revision: fixture.campaign.generator.implementationRevision,
      value: fixture.dependencies.generator,
    },
    {
      component: "boundary-transform",
      revision: fixture.campaign.boundaryTransform.implementationRevision,
      value: fixture.dependencies.boundaryTransform,
    },
    {
      component: "renderer",
      revision: fixture.campaign.rendererRevision,
      value: fixture.dependencies.renderer,
    },
    {
      component: "configuration",
      revision: fixture.campaign.configurationDigest,
      value: fixture.configuration,
    },
  ];
}

function registry(fixture: Fixture, entries = revisionEntries(fixture)): RevisionRegistry {
  const result = fixture.api.createRevisionRegistry(entries);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError("expected an exact revision registry");
  }
  return result.registry;
}

function expectCampaignFailure(result: CampaignResult<unknown>, code: string): void {
  expect(result).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([expect.objectContaining({ code })]),
  });
}

function childReplay(envelope: ReplayEnvelope, cwd: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [VITE_NODE_PATH, CHILD_PATH], {
      cwd,
      env: { PATH: process.env.PATH, NODE_NO_WARNINGS: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString("utf8")));
        return;
      }
      resolvePromise(Buffer.concat(stdout).toString("utf8"));
    });
    child.stdin.end(wireBytes(envelope));
  });
}

describe("campaign planning and case composition", () => {
  it("builds a deterministic immutable plan with stable metadata and mandatory memory spellings", async () => {
    const fixture = await createFixture("runtime");
    const repeated = await createFixture("runtime");
    const items = planItems(fixture);

    expect(fixture.prepared.summary).toEqual(repeated.prepared.summary);
    expect(fixture.prepared.summary).toMatchObject({
      schemaVersion: 1,
      totalCaseCount: fixture.configuration.caseCount,
    });
    expect(
      fixture.prepared.summary.validCaseCount + fixture.prepared.summary.invalidCaseCount,
    ).toBe(fixture.configuration.caseCount);
    expect(Object.isFrozen(fixture.prepared)).toBe(true);
    expect(Object.keys(fixture.prepared)).not.toContain("cursor");

    for (const [ordinal, item] of items.entries()) {
      expect(item.ordinal).toBe(ordinal);
      expect(item.generationPath).toEqual([
        item.lane === "coverage-valid" ? 0 : item.lane === "random-valid" ? 1 : 2,
        expect.any(Number),
      ]);
      expect(item.renderOptions).toEqual({
        maxSourceBytes: fixture.configuration.budget.maxSourceBytes,
        literalSpellings: [],
      });
    }

    const memoryChoices = items
      .map(({ request }) => request.choice)
      .filter((choice) => choice.kind === "memory");
    for (const spelling of ["local", "parameter"] as const) {
      expect(
        memoryChoices.some(
          (choice) =>
            choice.addressSpelling === spelling &&
            (choice.ruleId === RULES.peek ||
              choice.ruleId === RULES.peekw ||
              choice.ruleId === RULES.poke ||
              choice.ruleId === RULES.pokew),
        ),
      ).toBe(true);
      expect(
        memoryChoices.some(
          (choice) =>
            choice.valueSpelling === spelling &&
            (choice.ruleId === RULES.poke || choice.ruleId === RULES.pokew),
        ),
      ).toBe(true);
    }
  });

  it("composes valid and invalid cases with parameter-binding and source-transform evidence", async () => {
    const runtime = await createFixture("runtime");
    const frontend = await createFixture("frontend");
    const cases = [...generatedCases(runtime), ...generatedCases(frontend)];
    const valid = cases.find(({ modeledCase }) => modeledCase.validity.kind === "valid");
    const parameterInvalid = cases.find(
      ({ modeledCase }) =>
        modeledCase.projection.kind === "invalid" &&
        modeledCase.projection.transform.kind === "parameter-binding-replace",
    );
    const sourceInvalid = cases.find(
      ({ modeledCase }) =>
        modeledCase.projection.kind === "invalid" &&
        modeledCase.projection.transform.kind !== "parameter-binding-replace",
    );

    expect(valid).toBeDefined();
    expect(parameterInvalid).toBeDefined();
    expect(sourceInvalid).toBeDefined();
    if (parameterInvalid?.modeledCase.projection.kind === "invalid") {
      const transform = parameterInvalid.modeledCase.projection.transform;
      expect(transform.kind).toBe("parameter-binding-replace");
      if (transform.kind === "parameter-binding-replace") {
        expect(parameterInvalid.effectiveParameterBindings).toContainEqual({
          kind: "parameter-value",
          parameterPath: transform.parameterPath,
          value: transform.replacement.value,
        });
      }
      const replayed = frontend.api.replayCase({
        envelopeBytes: wireBytes(replayEnvelope(frontend, parameterInvalid)),
        registry: registry(frontend),
      });
      expect(replayed).toMatchObject({
        ok: true,
        case: {
          effectiveParameterBindings: parameterInvalid.effectiveParameterBindings,
        },
      });
    }
    if (sourceInvalid?.modeledCase.projection.kind === "invalid") {
      expect(sourceInvalid.modeledCase.projection.transform.kind).not.toBe(
        "parameter-binding-replace",
      );
      expect(sourceInvalid.roundTripProjection).toBeDefined();
      expect(decoder.decode(sourceInvalid.sourceBytes)).toBe(sourceInvalid.source);
      const owner =
        sourceInvalid.planItem.request.handlerId === "generator.runtime-cases" ? runtime : frontend;
      const replayed = owner.api.replayCase({
        envelopeBytes: wireBytes(replayEnvelope(owner, sourceInvalid)),
        registry: registry(owner),
      });
      expect(replayed).toMatchObject({
        ok: true,
        case: {
          modeledCase: { projection: sourceInvalid.modeledCase.projection },
          roundTripProjection: sourceInvalid.roundTripProjection,
        },
      });
    }
  });

  it("independently finalizes structural, source-byte and attempt usage before success", async () => {
    const fixture = await createFixture("runtime");
    for (const generated of generatedCases(fixture)) {
      expect(generated.usage["source-bytes"]).toBe(BigInt(generated.sourceBytes.byteLength));
      expect(generated.usage.attempts).toBe(BigInt(generated.attempts));
      for (const dimension of [
        "modules",
        "declarations",
        "ir-nodes",
        "statements",
        "expression-depth",
        "loop-work",
      ] as const) {
        expect(generated.usage[dimension]).toBe(generated.modeledCase.constructionUsage[dimension]);
      }
      expect(generated.usage["source-bytes"]).toBeLessThanOrEqual(
        BigInt(fixture.configuration.budget.maxSourceBytes),
      );
      expect(generated.usage.attempts).toBeLessThanOrEqual(
        BigInt(fixture.configuration.budget.maxAttempts),
      );
    }
  });

  it("is random-access stable under repeated, reversed and concurrent ordinal requests", async () => {
    const fixture = await createFixture("runtime");
    const ordinals = [0, 7, 31, 63, fixture.configuration.caseCount - 1];
    const forward = ordinals.map((ordinal) =>
      requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, ordinal)),
    );
    const reversed = [...ordinals]
      .reverse()
      .map((ordinal) => requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, ordinal)))
      .reverse();
    const concurrent = await Promise.all(
      ordinals.map(async (ordinal) =>
        requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, ordinal)),
      ),
    );

    expect(reversed).toEqual(forward);
    expect(concurrent).toEqual(forward);
    for (const [index, ordinal] of ordinals.entries()) {
      const item = requireSuccess(fixture.api.getCampaignPlanItem(fixture.prepared, ordinal));
      expect(requireSuccess(fixture.api.generateCase(fixture.prepared, item))).toEqual(
        forward[index],
      );
      expect(requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, ordinal))).toEqual(
        forward[index],
      );
    }
  });

  it("fails before handlers and rendering when coverage, routing or total limits are invalid", async () => {
    const generator = vi.fn();
    const renderer = vi.fn();
    const tooSmall = await createFixture("runtime", {}, { generator, renderer });
    const insufficientConfiguration = {
      ...tooSmall.configuration,
      caseCount: 1,
      maxInvalidCases: 1,
    };
    expectCampaignFailure(
      tooSmall.api.createCampaignPlan({
        campaign: {
          ...tooSmall.campaign,
          configurationDigest: requireIdentity(
            tooSmall.api.deriveConfigurationIdentity(insufficientConfiguration),
          ),
        },
        configuration: insufficientConfiguration,
        dependencies: tooSmall.dependencies,
      }),
      "campaign.coverage.insufficient",
    );
    expect(generator).not.toHaveBeenCalled();
    expect(renderer).not.toHaveBeenCalled();

    const mixedConfiguration = {
      ...tooSmall.configuration,
      enabledRuleIds: [RULES.byte, RULES.peek].sort(),
    };
    const mixedCampaign = {
      ...tooSmall.campaign,
      configurationDigest: requireIdentity(
        tooSmall.api.deriveConfigurationIdentity(mixedConfiguration),
      ),
    };
    expectCampaignFailure(
      tooSmall.api.createCampaignPlan({
        campaign: mixedCampaign,
        configuration: mixedConfiguration,
        dependencies: tooSmall.dependencies,
      }),
      "campaign.dependency.mismatch",
    );

    const excessiveConfiguration = {
      ...tooSmall.configuration,
      caseCount: 100_001,
    };
    expectCampaignFailure(
      tooSmall.api.createCampaignPlan({
        campaign: {
          ...tooSmall.campaign,
          configurationDigest: requireIdentity(
            tooSmall.api.deriveConfigurationIdentity(excessiveConfiguration),
          ),
        },
        configuration: excessiveConfiguration,
        dependencies: tooSmall.dependencies,
      }),
      "campaign.input.invalid",
    );
  });

  it("rejects collisions and used or wrong-campaign collision indexes before generation", async () => {
    const fixture = await createFixture("frontend");
    const constantDigest = vi.fn(() => new Uint8Array(32));
    const collidingIndex = requireSuccess(
      fixture.api.createCampaignCollisionIndex({
        campaignDigest: fixture.prepared.summary.campaignDigest,
        digest: constantDigest,
      }),
    );
    expectCampaignFailure(
      fixture.api.createCampaignPlan({
        campaign: fixture.campaign,
        configuration: fixture.configuration,
        dependencies: fixture.dependencies,
        collisionIndex: collidingIndex,
      }),
      "campaign.identity.collision",
    );

    const freshIndex = requireSuccess(
      fixture.api.createCampaignCollisionIndex({
        campaignDigest: fixture.prepared.summary.campaignDigest,
      }),
    );
    requireSuccess(
      fixture.api.createCampaignPlan({
        campaign: fixture.campaign,
        configuration: fixture.configuration,
        dependencies: fixture.dependencies,
        collisionIndex: freshIndex,
      }),
    );
    expectCampaignFailure(
      fixture.api.createCampaignPlan({
        campaign: fixture.campaign,
        configuration: fixture.configuration,
        dependencies: fixture.dependencies,
        collisionIndex: freshIndex,
      }),
      "campaign.input.invalid",
    );

    const wrongIndex = requireSuccess(
      fixture.api.createCampaignCollisionIndex({ campaignDigest: fixedDigest("f") }),
    );
    expectCampaignFailure(
      fixture.api.createCampaignPlan({
        campaign: fixture.campaign,
        configuration: fixture.configuration,
        dependencies: fixture.dependencies,
        collisionIndex: wrongIndex,
      }),
      "campaign.identity.mismatch",
    );
  });

  it("returns no case when rendered UTF-8 exceeds the final source budget", async () => {
    const fixture = await createFixture("frontend", {
      budget: { ...BASE_BUDGET, maxSourceBytes: 1 },
    });
    const result = fixture.api.generateCampaignCase(fixture.prepared, 0);
    expectCampaignFailure(result, "campaign.render.invalid");
    expect(result).not.toHaveProperty("value");
  });
});

describe("exact replay", () => {
  it("reconstructs the exact case, byte array and complete identity", async () => {
    const fixture = await createFixture("runtime");
    const generated = requireSuccess(
      fixture.api.generateCampaignCase(fixture.prepared, fixture.configuration.caseCount - 1),
    );
    const result = fixture.api.replayCase({
      envelopeBytes: wireBytes(replayEnvelope(fixture, generated)),
      registry: registry(fixture),
    });

    expect(result).toMatchObject({ ok: true, case: generated });
    if (!result.ok) {
      throw new TypeError("expected exact replay");
    }
    expect(result.case.identity).toEqual(generated.identity);
    expect(result.source).toEqual(generated.sourceBytes);
    expect(result.source).toBe(result.case.sourceBytes);
  });

  it("treats every campaign mutation as an identity failure or explicit incompatibility", async () => {
    const fixture = await createFixture("runtime");
    const generated = requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, 0));
    const baseline = replayEnvelope(fixture, generated);
    const mutations: readonly ((campaign: CampaignIdentityInput) => object)[] = [
      (campaign) => ({
        ...campaign,
        inventorySchemaVersion: 2,
      }),
      (campaign) => ({ ...campaign, inventoryVersion: "other-inventory" }),
      (campaign) => ({ ...campaign, inventoryDigest: fixedDigest("a") }),
      (campaign) => ({ ...campaign, specRevision: "other-spec" }),
      (campaign) => ({ ...campaign, ruleModelVersion: "other-model" }),
      (campaign) => ({ ...campaign, ruleModelDigest: fixedDigest("b") }),
      (campaign) => ({
        ...campaign,
        generator: { ...campaign.generator, handlerId: "generator.frontend-cases" },
      }),
      (campaign) => ({
        ...campaign,
        generator: { ...campaign.generator, contractVersion: "2.0.0" },
      }),
      (campaign) => ({
        ...campaign,
        generator: { ...campaign.generator, implementationRevision: fixedDigest("c") },
      }),
      (campaign) => ({
        ...campaign,
        boundaryTransform: {
          ...campaign.boundaryTransform,
          handlerId: "transform.other",
        },
      }),
      (campaign) => ({
        ...campaign,
        boundaryTransform: {
          ...campaign.boundaryTransform,
          contractVersion: "2.0.0",
        },
      }),
      (campaign) => ({
        ...campaign,
        boundaryTransform: {
          ...campaign.boundaryTransform,
          implementationRevision: fixedDigest("d"),
        },
      }),
      (campaign) => ({ ...campaign, rendererRevision: fixedDigest("e") }),
      (campaign) => ({ ...campaign, target: "cx16" }),
      (campaign) => ({
        ...campaign,
        prngAlgorithm: "other-prng",
      }),
      (campaign) => ({ ...campaign, seed: fixedDigest("f") }),
      (campaign) => ({ ...campaign, configurationDigest: fixedDigest("9") }),
    ];

    for (const mutate of mutations) {
      const result = fixture.api.replayCase({
        envelopeBytes: wireBytes({ ...baseline, campaign: mutate(baseline.campaign) }),
        registry: registry(fixture),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(["replay-incompatible", "replay-invalid"]).toContain(result.kind);
      }
    }
  });

  it.each(["rule-model", "generator", "boundary-transform", "renderer"] as const)(
    "names a missing exact %s revision without invoking a current handler",
    async (missing) => {
      const fixture = await createFixture("runtime");
      const current = vi.fn();
      const generated = requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, 0));
      let entries = revisionEntries(fixture).filter(({ component }) => component !== missing);
      if (missing === "rule-model") {
        const requestedGeneratorSpy = freshCandidate(fixture.api, "generator-runtime", {
          handlerId: "generator.runtime-cases",
          kind: "generator",
          contractVersion: "1.0.0",
          implementation: current,
        });
        entries = entries.map((entry) =>
          entry.component === "generator" ? { ...entry, value: requestedGeneratorSpy } : entry,
        );
      }
      let alternative: unknown;
      let alternativeRevision: Digest;
      if (missing === "generator") {
        const registration = freshCandidate(fixture.api, "generator-runtime-nonrequested", {
          handlerId: "generator.runtime-cases",
          kind: "generator",
          contractVersion: "1.0.0",
          implementation: current,
        });
        alternative = registration;
        alternativeRevision = registration.binding.implementationRevision;
      } else if (missing === "boundary-transform") {
        const registration = freshCandidate(fixture.api, "boundary-nonrequested", {
          handlerId: "transform.boundary-variants",
          kind: "transform",
          contractVersion: "1.0.0",
          implementation: current,
        });
        alternative = registration;
        alternativeRevision = registration.binding.implementationRevision;
      } else if (missing === "renderer") {
        alternativeRevision = fixedDigest("f");
        alternative = { implementationRevision: alternativeRevision, implementation: current };
      } else {
        alternativeRevision = fixedDigest("f");
        alternative = fixture.dependencies.ruleModel.suite;
      }
      entries.push({
        component: missing,
        revision: alternativeRevision,
        value: alternative,
      });
      const result = fixture.api.replayCase({
        envelopeBytes: wireBytes(replayEnvelope(fixture, generated)),
        registry: registry(fixture, entries),
      });

      expect(result).toEqual({ ok: false, kind: "replay-incompatible", missing });
      expect(current).not.toHaveBeenCalled();
    },
  );

  it("rejects bounded malformed input before revision resolution or generation", async () => {
    const fixture = await createFixture("runtime");
    const resolve = vi.fn();
    const invalidInputs = [
      encoder.encode(
        wireText(
          replayEnvelope(
            fixture,
            requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, 0)),
          ),
        ).replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'),
      ),
      wireBytes({
        ...wireObject(
          replayEnvelope(
            fixture,
            requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, 0)),
          ),
        ),
        unknown: true,
      }),
      new Uint8Array(1_048_577),
      wireBytes({
        ...wireObject(
          replayEnvelope(
            fixture,
            requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, 0)),
          ),
        ),
        campaign: {
          ...(wireObject(
            replayEnvelope(
              fixture,
              requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, 0)),
            ),
          ).campaign as object),
          generator: {
            ...wireObject(fixture.campaign.generator),
            handlerId: "../generator.runtime-cases",
          },
        },
      }),
    ];

    for (const envelopeBytes of invalidInputs) {
      const result = fixture.api.replayCase({
        envelopeBytes,
        registry: { resolve },
      });
      expect(result).toMatchObject({ ok: false, kind: "replay-invalid" });
    }
    expect(resolve).not.toHaveBeenCalled();
  });

  it("requires complete carried configuration and never consults ambient configuration", async () => {
    const fixture = await createFixture("runtime");
    const generated = requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, 0));
    const complete = wireObject(replayEnvelope(fixture, generated));
    const { configuration: _removed, ...missingConfiguration } = complete;
    const mismatchedConfiguration = {
      ...complete,
      configuration: {
        ...(complete.configuration as Record<string, unknown>),
        maxInvalidCases: fixture.configuration.maxInvalidCases - 1,
      },
    };

    for (const envelope of [missingConfiguration, mismatchedConfiguration]) {
      const result = fixture.api.replayCase({
        envelopeBytes: wireBytes(envelope),
        registry: registry(fixture),
      });
      expect(result).toEqual({
        ok: false,
        kind: "replay-incompatible",
        missing: "configuration",
      });
    }
  });

  it("produces the same canonical response and source in two genuinely fresh processes", async () => {
    const fixture = await createFixture("runtime");
    const generated = requireSuccess(fixture.api.generateCampaignCase(fixture.prepared, 0));
    const envelope = replayEnvelope(fixture, generated);
    const [first, second] = await Promise.all([
      childReplay(envelope, "/tmp"),
      childReplay(envelope, "/"),
    ]);

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    const response = JSON.parse(first) as {
      readonly schemaVersion: number;
      readonly ok: boolean;
      readonly caseDigest: string;
      readonly sourceBase64: string;
    };
    expect(response).toEqual({
      schemaVersion: 1,
      ok: true,
      caseDigest: generated.identity.digest,
      sourceBase64: Buffer.from(generated.sourceBytes).toString("base64"),
    });
    expect(Buffer.from(response.sourceBase64, "base64")).toEqual(
      Buffer.from(generated.sourceBytes),
    );
  });
});
