import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type Digest = `sha256:${string}`;
type Severity = "error" | "warning" | "info";
type DiagnosticPhase = "lexer" | "parser" | "semantic" | "sfa";

interface OperationIssue {
  readonly code: string;
  readonly path: string;
  readonly message?: string;
}

type OperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly issues?: readonly OperationIssue[];
      readonly diagnostics?: readonly OperationIssue[];
    };

interface ObservationRequest {
  readonly kind: "scalar-bytes" | "direct-mmio";
  readonly byteLength: 1 | 2;
  readonly address?: number;
  readonly projectionRevision?: "c64-vic-color-readback-v1" | "c64-vic-color-observation-v1";
}

type PostEntryStore =
  | { readonly kind: "observation-byte"; readonly byteIndex: 0 | 1 }
  | { readonly kind: "completion"; readonly value: 165 };

interface Envelope {
  readonly revision: "execution-envelope-ir-v1";
  readonly sourceCaseDigest: string;
  readonly arguments: readonly {
    readonly name: string;
    readonly type: "boolean" | "byte" | "sbyte" | "word" | "sword";
    readonly value: number | boolean;
  }[];
  readonly entryFunction: string;
  readonly observation: ObservationRequest;
  readonly completionInitialValue: number;
  readonly completionSuccessValue: number;
  readonly postEntryStores: readonly PostEntryStore[];
}

interface InitialStateFixture {
  readonly revision: "c64-vic-color-readback-v1";
  readonly cells: readonly {
    readonly address: number;
    readonly logicalValue: number;
  }[];
}

interface ExecutionCaseProjection {
  readonly sourceCaseDigest: string;
  readonly sourceBytes: Uint8Array;
  readonly envelope: Envelope;
  readonly fixture: InitialStateFixture;
  readonly observation: ObservationRequest;
}

interface ObservationLayout {
  readonly revision: "execution-observation-layout-v1";
  readonly resultAddresses: readonly number[];
  readonly completionAddress: number;
  readonly proofDigest: string;
}

interface LayoutProofInput {
  readonly labels: ReadonlyMap<string, number>;
  readonly codeRanges: readonly { readonly start: number; readonly length: number }[];
  readonly dataRanges: readonly { readonly start: number; readonly length: number }[];
  readonly semanticRanges: readonly { readonly start: number; readonly length: number }[];
  readonly stackRanges: readonly { readonly start: number; readonly length: number }[];
  readonly observationSymbols: readonly string[];
  readonly completionSymbol: string;
}

interface HandlerIdentity {
  readonly capabilityId: "frontend" | "compiler-api" | "cli" | "emit" | "acme" | "vice";
  readonly contractVersion: string;
  readonly implementationRevision: string;
}

interface PrebuildIdentityInput {
  readonly sourceCaseDigest: string;
  readonly renderedSourceDigest: string;
  readonly argumentsDigest: string;
  readonly envelopeRevision: string;
  readonly selectorRevision: string;
  readonly fixtureRevision: string;
  readonly fixtureDigest: string;
  readonly observationProjectionRevision?: string;
  readonly target: "c64";
  readonly policyDigest: string;
  readonly handlers: readonly HandlerIdentity[];
  readonly observation: ObservationRequest;
}

interface PreparedCampaign {
  readonly summary: {
    readonly campaignDigest: Digest;
    readonly totalCaseCount: number;
  };
}

interface CampaignPlanItem {
  readonly ordinal: number;
  readonly lane: "coverage-valid" | "random-valid" | "invalid";
  readonly request: {
    readonly choice: {
      readonly kind: "scalar" | "memory";
      readonly ruleId: string;
      readonly spelling?: string;
      readonly addressSpelling?: string;
      readonly valueSpelling?: string;
    };
  };
}

interface GeneratedCase {
  readonly identity: { readonly digest: Digest };
  readonly sourceBytes: Uint8Array;
}

interface DiagnosticEvidenceEntry {
  readonly acceptedEntryId: string;
  readonly code: string;
  readonly phase: DiagnosticPhase;
  readonly finalSeverity: Severity;
}

interface DiagnosticEvidence {
  readonly revision: "compiler-diagnostic-evidence-v1";
  readonly entries: readonly DiagnosticEvidenceEntry[];
}

interface ReadinessApi {
  readonly INVENTORY_V1_LIMITS: unknown;
  readonly parseInventoryJson: (
    bytes: Uint8Array,
    limits: unknown,
  ) => { readonly ok: boolean; readonly inventory?: unknown };
  readonly validateInventorySchema: (input: unknown) => {
    readonly ok: boolean;
    readonly inventory?: unknown;
  };
  readonly createModeledGeneratorSuite: (input: object) => {
    readonly ok: boolean;
    readonly suite?: unknown;
  };
  readonly deriveConfigurationIdentity: (input: object) => {
    readonly ok: boolean;
    readonly identity?: Digest;
  };
  readonly deriveImplementationRevision: (input: object) => {
    readonly ok: boolean;
    readonly revision?: Digest;
  };
  readonly validateImplementationRevision: (input: object) => {
    readonly ok: boolean;
    readonly revision?: Digest;
  };
  readonly registerFreshCandidateBinding: (input: object) => {
    readonly ok: boolean;
    readonly registration?: object;
  };
  readonly generateFrontendCase: (...args: readonly unknown[]) => unknown;
  readonly generateRuntimeCase: (...args: readonly unknown[]) => unknown;
  readonly boundaryVariantsHandler: (...args: readonly unknown[]) => unknown;
  readonly renderGeneratedCase: (...args: readonly unknown[]) => unknown;
  readonly createCampaignPlan: (input: object) => OperationResult<PreparedCampaign>;
  readonly getCampaignPlanItem: (
    campaign: PreparedCampaign,
    ordinal: number,
  ) => OperationResult<CampaignPlanItem>;
  readonly generateCampaignCase: (
    campaign: PreparedCampaign,
    ordinal: number,
  ) => OperationResult<GeneratedCase>;
  readonly parseExecutionEnvelopeIrV1: (input: unknown) => OperationResult<Envelope>;
  readonly parseExecutionInitialStateFixtureV1: (
    input: unknown,
  ) => OperationResult<InitialStateFixture>;
  readonly createExecutionCaseV1: (
    campaign: PreparedCampaign,
    ordinal: number,
    observation: ObservationRequest,
  ) => OperationResult<object>;
  readonly resolveExecutionEnvelopeReplayV1: (
    campaign: PreparedCampaign,
    envelope: Envelope,
  ) => OperationResult<object>;
  readonly getExecutionCaseProjectionV1: (
    executionCase: object,
  ) => OperationResult<ExecutionCaseProjection>;
  readonly projectC64InitialStateV1: (
    address: number,
    logicalByte: number,
  ) => OperationResult<number>;
  readonly projectC64ActualWriteV1: (
    address: number,
    logicalByte: number,
  ) => OperationResult<number>;
}

interface ExecutionApi {
  readonly renderExecutionEnvelopeV1: (executionCase: object) => OperationResult<string>;
  readonly validateRenderedExecutionSourceV1: (
    executionCase: object,
    sourceBytes: Uint8Array,
  ) => OperationResult<{ readonly revision: string; readonly sourceDigest: string }>;
  readonly deriveExecutionFixtureDigestV1: (
    fixture: InitialStateFixture,
  ) => OperationResult<string>;
  readonly validateExecutionFixtureReadbackV1: (
    executionCase: object,
    readback: unknown,
  ) => "pass" | "invalid-evidence-input";
  readonly derivePrebuildExecutionIdentityV1: (input: PrebuildIdentityInput) => string;
  readonly resolveExecutionObservationLayoutV1: (
    input: LayoutProofInput,
  ) => OperationResult<ObservationLayout>;
  readonly deriveFinalExecutionIdentityV1: (
    prebuildIdentity: string,
    layout: ObservationLayout,
  ) => string;
  readonly classifyExecutionDiagnosticEvidenceV1: (
    expected: {
      readonly code: string;
      readonly phase: DiagnosticPhase;
      readonly severity: Severity;
    },
    observed: DiagnosticEvidence,
  ) => "pass" | "diagnostic-mismatch";
  readonly classifyInvalidCaseEmissionV1: (presence: unknown) => "pass" | "unexpected-emission";
}

interface CompilerApi {
  readonly compileWithEvidence: (options: object) => {
    readonly result: {
      readonly diagnostics: readonly { readonly code: string; readonly severity: Severity }[];
    };
    readonly evidence: DiagnosticEvidence;
  };
}

interface FixtureSet {
  readonly readiness: ReadinessApi;
  readonly execution: ExecutionApi;
  readonly compiler: CompilerApi;
  readonly scalarCampaign: PreparedCampaign;
  readonly runtimeCampaign: PreparedCampaign;
}

interface GenuineExecutionCase {
  readonly handle: object;
  readonly ordinal: number;
  readonly projection: ExecutionCaseProjection;
}

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const INVENTORY_PATH = resolve(REPOSITORY_ROOT, "readiness/inventory/compiler-readiness-v1.json");
const MODEL_PATH = resolve(REPOSITORY_ROOT, "readiness/rule-models/rule-models-v1.json");
const SEED_PATH = resolve(REPOSITORY_ROOT, "readiness/rule-models/rule-model-seed-v1.json");
const REVIEW_PATH = resolve(REPOSITORY_ROOT, "readiness/reviews/rule-models-v1-review.json");
const encoder = new TextEncoder();
const temporaryRoots: string[] = [];

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

function digest(character: string): Digest {
  return `sha256:${character.repeat(64)}`;
}

function sha256(bytes: Uint8Array): Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function requireSuccess<T>(result: OperationResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result.issues ?? result.diagnostics));
  }
  return result.value;
}

function expectFailure(result: OperationResult<unknown>): void {
  expect(result.ok).toBe(false);
  expect(result).not.toHaveProperty("value");
}

function requirePresent<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new TypeError(message);
  }
  return value;
}

async function loadApis(): Promise<{
  readonly readiness: ReadinessApi;
  readonly execution: ExecutionApi;
  readonly compiler: CompilerApi;
}> {
  const readiness = await vi.importActual<Partial<ReadinessApi>>("@blend65/readiness");
  const execution = await vi.importActual<Partial<ExecutionApi>>("./index.js");
  const compiler = await vi.importActual<Partial<CompilerApi>>("@blend65/compiler");
  const readinessNames = [
    "parseExecutionEnvelopeIrV1",
    "parseExecutionInitialStateFixtureV1",
    "createExecutionCaseV1",
    "resolveExecutionEnvelopeReplayV1",
    "getExecutionCaseProjectionV1",
    "projectC64InitialStateV1",
    "projectC64ActualWriteV1",
  ] as const;
  const executionNames = [
    "renderExecutionEnvelopeV1",
    "validateRenderedExecutionSourceV1",
    "deriveExecutionFixtureDigestV1",
    "validateExecutionFixtureReadbackV1",
    "derivePrebuildExecutionIdentityV1",
    "resolveExecutionObservationLayoutV1",
    "deriveFinalExecutionIdentityV1",
    "classifyExecutionDiagnosticEvidenceV1",
    "classifyInvalidCaseEmissionV1",
  ] as const;
  const missing = [
    ...readinessNames.filter((name) => typeof readiness[name] !== "function"),
    ...executionNames.filter((name) => typeof execution[name] !== "function"),
    ...(typeof compiler.compileWithEvidence === "function" ? [] : ["compileWithEvidence"]),
  ];
  if (missing.length > 0) {
    throw new TypeError(`Missing envelope and evidence exports: ${missing.join(", ")}`);
  }
  return {
    readiness: readiness as ReadinessApi,
    execution: execution as ExecutionApi,
    compiler: compiler as CompilerApi,
  };
}

async function createCampaign(
  api: ReadinessApi,
  route: "scalar" | "runtime",
  seed: Digest,
): Promise<PreparedCampaign> {
  const [inventoryBytes, modelBytes, seedContractBytes, reviewEvidenceBytes] = await Promise.all([
    readFile(INVENTORY_PATH),
    readFile(MODEL_PATH),
    readFile(SEED_PATH),
    readFile(REVIEW_PATH),
  ]);
  const parsed = api.parseInventoryJson(inventoryBytes, api.INVENTORY_V1_LIMITS);
  const inventory = requirePresent(parsed.inventory, "the inventory fixture must parse");
  const validated = api.validateInventorySchema(inventory);
  const validatedInventory = requirePresent(
    validated.inventory,
    "the inventory fixture must validate",
  );
  const suiteResult = api.createModeledGeneratorSuite({
    seedContractBytes,
    ruleModelBytes: modelBytes,
    reviewEvidenceBytes,
    inventory: validatedInventory,
  });
  const suite = requirePresent(suiteResult.suite, "the modeled suite must load");
  const configuration = {
    caseCount: route === "runtime" ? 120 : 72,
    maxInvalidCases: route === "runtime" ? 32 : 24,
    enabledRuleIds:
      route === "runtime"
        ? [RULES.peek, RULES.peekw, RULES.poke, RULES.pokew].sort()
        : [RULES.byte, RULES.sbyte, RULES.sword, RULES.word].sort(),
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
  const configurationDigest = requirePresent(
    api.deriveConfigurationIdentity(configuration).identity,
    "the campaign configuration must identify",
  );
  const generatorId = route === "runtime" ? "generator.runtime-cases" : "generator.frontend-cases";
  const generatorImplementation =
    route === "runtime" ? api.generateRuntimeCase : api.generateFrontendCase;
  const generator = registerBinding(api, `${route}-generator`, {
    handlerId: generatorId,
    kind: "generator",
    contractVersion: "1.0.0",
    implementation: generatorImplementation,
  });
  const boundary = registerBinding(api, `${route}-boundary`, {
    handlerId: "transform.boundary-variants",
    kind: "transform",
    contractVersion: "1.0.0",
    implementation: api.boundaryVariantsHandler,
  });
  const inventoryDigest = sha256(inventoryBytes);
  const ruleModelDigest = sha256(modelBytes);
  const rendererRevision = digest("5");
  const dependencies = {
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
      suite,
    },
    generator,
    boundaryTransform: boundary,
    renderer: {
      implementationRevision: rendererRevision,
      implementation: api.renderGeneratedCase,
    },
  };
  const campaign = {
    inventorySchemaVersion: 1,
    inventoryVersion: dependencies.inventory.inventoryVersion,
    inventoryDigest,
    specRevision: dependencies.inventory.specRevision,
    ruleModelVersion: dependencies.ruleModel.ruleModelVersion,
    ruleModelDigest,
    generator: bindingIdentity(generator),
    boundaryTransform: bindingIdentity(boundary),
    rendererRevision,
    target: "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed,
    configurationDigest,
  };
  return requireSuccess(api.createCampaignPlan({ campaign, configuration, dependencies }));
}

function registerBinding(
  api: ReadinessApi,
  name: string,
  binding: {
    readonly handlerId: string;
    readonly kind: string;
    readonly contractVersion: string;
    readonly implementation: (...args: readonly unknown[]) => unknown;
  },
): object {
  const path = `fixtures/${name}.ts`;
  const metadata = {
    contractVersion: "1.0.0",
    entryPath: path,
    files: [{ path, content: encoder.encode(`export const fixture = "${name}";\n`) }],
  };
  const revision = requirePresent(
    api.deriveImplementationRevision(metadata).revision,
    "the fixture revision must derive",
  );
  const freshness = api.validateImplementationRevision({
    claimedRevision: revision,
    metadata,
  });
  const registration = api.registerFreshCandidateBinding({
    binding: { ...binding, implementationRevision: revision },
    freshness,
  });
  return requirePresent(registration.registration, "the fixture binding must register");
}

function bindingIdentity(registration: object): object {
  const descriptor = Object.getOwnPropertyDescriptor(registration, "binding");
  const binding = descriptor?.value;
  if (typeof binding !== "object" || binding === null) {
    throw new TypeError("the registered binding must expose its public identity");
  }
  const handlerId = Reflect.get(binding, "handlerId");
  const contractVersion = Reflect.get(binding, "contractVersion");
  const implementationRevision = Reflect.get(binding, "implementationRevision");
  return { handlerId, contractVersion, implementationRevision };
}

async function createFixtureSet(): Promise<FixtureSet> {
  const apis = await loadApis();
  const [scalarCampaign, runtimeCampaign] = await Promise.all([
    createCampaign(apis.readiness, "scalar", digest("6")),
    createCampaign(apis.readiness, "runtime", digest("7")),
  ]);
  return { ...apis, scalarCampaign, runtimeCampaign };
}

let fixturePromise: Promise<FixtureSet>;

beforeAll(() => {
  fixturePromise = createFixtureSet();
});

afterAll(() => {
  for (const root of temporaryRoots) {
    rmSync(root, { recursive: true, force: true });
  }
});

async function findExecutionCase(
  fixtures: FixtureSet,
  campaign: PreparedCampaign,
  kind: "scalar" | "memory",
  validity: "valid" | "invalid" = "valid",
): Promise<GenuineExecutionCase | undefined> {
  const observations: readonly ObservationRequest[] =
    kind === "scalar"
      ? [
          { kind: "scalar-bytes", byteLength: 1 },
          { kind: "scalar-bytes", byteLength: 2 },
        ]
      : [
          {
            kind: "direct-mmio",
            byteLength: 1,
            address: 0xd020,
            projectionRevision: "c64-vic-color-observation-v1",
          },
          {
            kind: "direct-mmio",
            byteLength: 2,
            address: 0xd020,
            projectionRevision: "c64-vic-color-observation-v1",
          },
          {
            kind: "direct-mmio",
            byteLength: 2,
            address: 0xd021,
            projectionRevision: "c64-vic-color-observation-v1",
          },
        ];
  for (let ordinal = 0; ordinal < campaign.summary.totalCaseCount; ordinal += 1) {
    const item = requireSuccess(fixtures.readiness.getCampaignPlanItem(campaign, ordinal));
    if (
      item.request.choice.kind !== kind ||
      (item.lane === "invalid") !== (validity === "invalid")
    ) {
      continue;
    }
    for (const observation of observations) {
      const created = fixtures.readiness.createExecutionCaseV1(campaign, ordinal, observation);
      if (!created.ok) {
        continue;
      }
      const projection = requireSuccess(
        fixtures.readiness.getExecutionCaseProjectionV1(created.value),
      );
      if (validity === "valid" && projection.envelope.arguments.length === 0) {
        continue;
      }
      return { handle: created.value, ordinal, projection };
    }
  }
  return undefined;
}

function acceptedLayout(offset = 0): LayoutProofInput {
  return {
    labels: new Map([
      ["result-low", 0x2000 + offset],
      ["result-high", 0x2001 + offset],
      ["completion", 0x2002 + offset],
    ]),
    codeRanges: [{ start: 0x0801, length: 0x100 }],
    dataRanges: [{ start: 0x1000, length: 0x100 }],
    semanticRanges: [{ start: 0x3000, length: 0x100 }],
    stackRanges: [{ start: 0x0100, length: 0x100 }],
    observationSymbols: ["result-low", "result-high"],
    completionSymbol: "completion",
  };
}

function scalarEnvelope(): Envelope {
  return {
    revision: "execution-envelope-ir-v1",
    sourceCaseDigest: digest("8"),
    arguments: [{ name: "value", type: "word", value: 0x2000 }],
    entryFunction: "evaluate",
    observation: { kind: "scalar-bytes", byteLength: 2 },
    completionInitialValue: 0,
    completionSuccessValue: 165,
    postEntryStores: [
      { kind: "observation-byte", byteIndex: 0 },
      { kind: "observation-byte", byteIndex: 1 },
      { kind: "completion", value: 165 },
    ],
  };
}

describe("execution envelope construction", () => {
  it("renders valid scalar and direct-memory cases with completion stored last", async () => {
    const fixtures = await fixturePromise;
    const scalar = requirePresent(
      await findExecutionCase(fixtures, fixtures.scalarCampaign, "scalar"),
      "a valid parameterized scalar case must exist",
    );
    const memory = requirePresent(
      await findExecutionCase(fixtures, fixtures.runtimeCampaign, "memory"),
      "a valid parameterized memory case must exist",
    );

    for (const executionCase of [scalar, memory]) {
      const rendered = requireSuccess(
        fixtures.execution.renderExecutionEnvelopeV1(executionCase.handle),
      );
      expect(rendered).toMatch(/function main\(\): void/u);
      expect(executionCase.projection.envelope.arguments.length).toBeGreaterThan(0);
      expect(executionCase.projection.envelope.postEntryStores.at(-1)).toEqual({
        kind: "completion",
        value: 165,
      });
      expect(
        executionCase.projection.envelope.postEntryStores
          .slice(0, -1)
          .every((store) => store.kind === "observation-byte"),
      ).toBe(true);
    }
  });

  it("rejects invalid and forged authority while genuine historical replay is exact", async () => {
    const fixtures = await fixturePromise;
    expect(
      await findExecutionCase(fixtures, fixtures.scalarCampaign, "scalar", "invalid"),
    ).toBeUndefined();
    const genuine = requirePresent(
      await findExecutionCase(fixtures, fixtures.scalarCampaign, "scalar"),
      "a valid scalar case must exist",
    );
    const original = requireSuccess(
      fixtures.readiness.generateCampaignCase(fixtures.scalarCampaign, genuine.ordinal),
    );

    expectFailure(fixtures.execution.renderExecutionEnvelopeV1({}));
    expectFailure(fixtures.execution.renderExecutionEnvelopeV1({ ...genuine.projection }));
    expectFailure(
      fixtures.readiness.resolveExecutionEnvelopeReplayV1(
        fixtures.runtimeCampaign,
        genuine.projection.envelope,
      ),
    );
    const replayed = requireSuccess(
      fixtures.readiness.resolveExecutionEnvelopeReplayV1(
        fixtures.scalarCampaign,
        genuine.projection.envelope,
      ),
    );
    expect(
      requireSuccess(fixtures.readiness.getExecutionCaseProjectionV1(replayed)).sourceBytes,
    ).toEqual(original.sourceBytes);
    expect(
      requireSuccess(
        fixtures.readiness.generateCampaignCase(fixtures.scalarCampaign, genuine.ordinal),
      ).identity,
    ).toEqual(original.identity);
  });

  it("rejects executable source containing seeded expectation material", async () => {
    const fixtures = await fixturePromise;
    const genuine = requirePresent(
      await findExecutionCase(fixtures, fixtures.scalarCampaign, "scalar"),
      "a valid scalar case must exist",
    );
    const rendered = requireSuccess(fixtures.execution.renderExecutionEnvelopeV1(genuine.handle));
    expect(
      fixtures.execution.validateRenderedExecutionSourceV1(
        genuine.handle,
        encoder.encode(rendered),
      ),
    ).toMatchObject({ ok: true });
    expectFailure(
      fixtures.execution.validateRenderedExecutionSourceV1(
        genuine.handle,
        encoder.encode(`${rendered}\n// expected value: 61680\n`),
      ),
    );
  });
});

describe("execution identity and layout", () => {
  it("changes identity for every semantic input while preserving source-case identity", async () => {
    const fixtures = await fixturePromise;
    const genuine = requirePresent(
      await findExecutionCase(fixtures, fixtures.scalarCampaign, "scalar"),
      "a valid scalar case must exist",
    );
    const fixtureA = requireSuccess(
      fixtures.readiness.parseExecutionInitialStateFixtureV1({
        revision: "c64-vic-color-readback-v1",
        cells: [
          { address: 0xd020, logicalValue: 0 },
          { address: 0xd021, logicalValue: 0x20 },
        ],
      }),
    );
    const fixtureB = requireSuccess(
      fixtures.readiness.parseExecutionInitialStateFixtureV1({
        revision: "c64-vic-color-readback-v1",
        cells: [
          { address: 0xd020, logicalValue: 1 },
          { address: 0xd021, logicalValue: 0x20 },
        ],
      }),
    );
    const fixtureDigestA = requireSuccess(
      fixtures.execution.deriveExecutionFixtureDigestV1(fixtureA),
    );
    const fixtureDigestB = requireSuccess(
      fixtures.execution.deriveExecutionFixtureDigestV1(fixtureB),
    );
    const sourceCaseIdentity = genuine.projection.sourceCaseDigest;
    const base: PrebuildIdentityInput = {
      sourceCaseDigest: sourceCaseIdentity,
      renderedSourceDigest: digest("b"),
      argumentsDigest: digest("c"),
      envelopeRevision: "execution-envelope-ir-v1",
      selectorRevision: "execution-selector-v1",
      fixtureRevision: "c64-vic-color-readback-v1",
      fixtureDigest: fixtureDigestA,
      observationProjectionRevision: "c64-vic-color-observation-v1",
      target: "c64",
      policyDigest: digest("d"),
      handlers: [
        {
          capabilityId: "frontend",
          contractVersion: "1.0.0",
          implementationRevision: digest("e"),
        },
      ],
      observation: { kind: "scalar-bytes", byteLength: 1 },
    };
    const identity = fixtures.execution.derivePrebuildExecutionIdentityV1(base);
    const mutations: readonly PrebuildIdentityInput[] = [
      { ...base, renderedSourceDigest: digest("0") },
      { ...base, argumentsDigest: digest("1") },
      { ...base, selectorRevision: "execution-selector-v2" },
      { ...base, fixtureDigest: fixtureDigestB },
      { ...base, policyDigest: digest("2") },
      {
        ...base,
        handlers: [{ ...base.handlers[0]!, capabilityId: "emit" }],
      },
      {
        ...base,
        handlers: [{ ...base.handlers[0]!, contractVersion: "2.0.0" }],
      },
      {
        ...base,
        handlers: [{ ...base.handlers[0]!, implementationRevision: digest("3") }],
      },
      { ...base, observation: { kind: "scalar-bytes", byteLength: 2 } },
    ];

    for (const mutation of mutations) {
      expect(fixtures.execution.derivePrebuildExecutionIdentityV1(mutation)).not.toBe(identity);
    }
    expect(
      requireSuccess(fixtures.readiness.getExecutionCaseProjectionV1(genuine.handle))
        .sourceCaseDigest,
    ).toBe(sourceCaseIdentity);
  });

  it("derives distinct final identities from two exact accepted layouts", async () => {
    const fixtures = await fixturePromise;
    const first = requireSuccess(
      fixtures.execution.resolveExecutionObservationLayoutV1(acceptedLayout()),
    );
    const second = requireSuccess(
      fixtures.execution.resolveExecutionObservationLayoutV1(acceptedLayout(0x10)),
    );
    expect(first.resultAddresses).toEqual([0x2000, 0x2001]);
    expect(first.completionAddress).toBe(0x2002);
    expect(second.resultAddresses).toEqual([0x2010, 0x2011]);
    expect(second.completionAddress).toBe(0x2012);
    expect(second.proofDigest).not.toBe(first.proofDigest);
    expect(fixtures.execution.deriveFinalExecutionIdentityV1(digest("4"), second)).not.toBe(
      fixtures.execution.deriveFinalExecutionIdentityV1(digest("4"), first),
    );
  });

  it("rejects missing, overlapping, reserved and semantic-footprint labels", async () => {
    const fixtures = await fixturePromise;
    const accepted = acceptedLayout();
    const missing = { ...accepted, labels: new Map([["completion", 0x2002]]) };
    const overlapping = {
      ...accepted,
      labels: new Map([
        ["result-low", 0x2000],
        ["result-high", 0x2000],
        ["completion", 0x2002],
      ]),
    };
    const stack = {
      ...accepted,
      labels: new Map([
        ["result-low", 0x0100],
        ["result-high", 0x0101],
        ["completion", 0x0102],
      ]),
    };
    const mmio = {
      ...accepted,
      labels: new Map([
        ["result-low", 0xd020],
        ["result-high", 0xd021],
        ["completion", 0xd022],
      ]),
    };
    const semantic = {
      ...accepted,
      semanticRanges: [{ start: 0x2000, length: 3 }],
    };

    for (const mutant of [missing, overlapping, stack, mmio, semantic]) {
      expectFailure(fixtures.execution.resolveExecutionObservationLayoutV1(mutant));
    }
  });
});

describe("observation and diagnostic evidence", () => {
  it("rejects stale completion and completion-before-result envelope mutants", async () => {
    const fixtures = await fixturePromise;
    const valid = scalarEnvelope();
    expect(requireSuccess(fixtures.readiness.parseExecutionEnvelopeIrV1(valid))).toEqual(valid);
    expectFailure(
      fixtures.readiness.parseExecutionEnvelopeIrV1({
        ...valid,
        completionInitialValue: 165,
      }),
    );
    expectFailure(
      fixtures.readiness.parseExecutionEnvelopeIrV1({
        ...valid,
        postEntryStores: [
          { kind: "completion", value: 165 },
          { kind: "observation-byte", byteIndex: 0 },
          { kind: "observation-byte", byteIndex: 1 },
        ],
      }),
    );
  });

  it("projects VIC input and writes nibble-wise with little-endian word composition", async () => {
    const fixtures = await fixturePromise;
    const addresses = [0xd020, 0xd021, 0xd022] as const;
    for (const address of addresses) {
      expect(requireSuccess(fixtures.readiness.projectC64InitialStateV1(address, 0x20))).toBe(0xf0);
      expect(requireSuccess(fixtures.readiness.projectC64ActualWriteV1(address, 0x20))).toBe(0xf0);
      expect(requireSuccess(fixtures.readiness.projectC64ActualWriteV1(address, 0x21))).toBe(0xf1);
    }
    const firstWord =
      requireSuccess(fixtures.readiness.projectC64ActualWriteV1(0xd020, 0x00)) |
      (requireSuccess(fixtures.readiness.projectC64ActualWriteV1(0xd021, 0x20)) << 8);
    const secondWord =
      requireSuccess(fixtures.readiness.projectC64ActualWriteV1(0xd021, 0x00)) |
      (requireSuccess(fixtures.readiness.projectC64ActualWriteV1(0xd022, 0x20)) << 8);
    expect(firstWord).toBe(0xf0f0);
    expect(secondWord).toBe(0xf0f0);
    expectFailure(fixtures.readiness.projectC64ActualWriteV1(0xd023, 0x20));
  });

  it("returns one stable non-passing fixture result for missing, mismatched or stale state", async () => {
    const fixtures = await fixturePromise;
    const genuine = requirePresent(
      await findExecutionCase(fixtures, fixtures.runtimeCampaign, "memory"),
      "a valid memory case must exist",
    );
    expect(genuine.projection.fixture.cells.length).toBeGreaterThan(0);
    const cells = genuine.projection.fixture.cells.map((cell) => ({
      address: cell.address,
      projectedValue: requireSuccess(
        fixtures.readiness.projectC64InitialStateV1(cell.address, cell.logicalValue),
      ),
    }));
    const readback = {
      revision: "execution-fixture-readback-v1",
      cells,
      completionValueBeforeEntry: 0,
    };
    expect(fixtures.execution.validateExecutionFixtureReadbackV1(genuine.handle, readback)).toBe(
      "pass",
    );
    const mutants = [
      { ...readback, cells: cells.slice(1) },
      {
        ...readback,
        cells: [{ ...cells[0]!, projectedValue: cells[0]!.projectedValue ^ 1 }, ...cells.slice(1)],
      },
      { ...readback, completionValueBeforeEntry: 165 },
    ];
    for (const mutant of mutants) {
      expect(fixtures.execution.validateExecutionFixtureReadbackV1(genuine.handle, mutant)).toBe(
        "invalid-evidence-input",
      );
    }
  });

  it("classifies the same diagnostic code from a wrong phase or severity as a mismatch", async () => {
    const fixtures = await fixturePromise;
    const evidence: DiagnosticEvidence = {
      revision: "compiler-diagnostic-evidence-v1",
      entries: [
        {
          acceptedEntryId: digest("5"),
          code: "E10210",
          phase: "lexer",
          finalSeverity: "error",
        },
      ],
    };
    const expected = { code: "E10210", phase: "lexer", severity: "error" } as const;
    expect(fixtures.execution.classifyExecutionDiagnosticEvidenceV1(expected, evidence)).toBe(
      "pass",
    );
    expect(
      fixtures.execution.classifyExecutionDiagnosticEvidenceV1(
        { ...expected, phase: "parser" },
        evidence,
      ),
    ).toBe("diagnostic-mismatch");
    expect(
      fixtures.execution.classifyExecutionDiagnosticEvidenceV1(
        { ...expected, severity: "warning" },
        evidence,
      ),
    ).toBe("diagnostic-mismatch");
  });

  it("classifies every invalid-case artifact kind as unexpected emission", async () => {
    const fixtures = await fixturePromise;
    expect(
      fixtures.execution.classifyInvalidCaseEmissionV1({
        il: false,
        assembly: false,
        binary: false,
      }),
    ).toBe("pass");
    for (const field of ["il", "assembly", "binary"] as const) {
      expect(
        fixtures.execution.classifyInvalidCaseEmissionV1({
          il: field === "il",
          assembly: field === "assembly",
          binary: field === "binary",
        }),
      ).toBe("unexpected-emission");
    }
  });

  it("records only accepted diagnostics with their final adjusted severity", async () => {
    const fixtures = await fixturePromise;
    const root = mkdtempSync(join(tmpdir(), "blend65-evidence-"));
    temporaryRoots.push(root);
    writeFileSync(
      join(root, "promoted.blend"),
      "module Main;\nfunction main(): void { poke(0xD020, 05); }\n",
      "utf8",
    );
    const promoted = fixtures.compiler.compileWithEvidence({
      platform: "c64",
      cwd: root,
      sourceFiles: ["promoted.blend"],
      warnAsError: true,
    });
    const promotedDiagnostic = requirePresent(
      promoted.result.diagnostics.find((diagnostic) => diagnostic.severity === "error"),
      "the leading-zero warning must be promoted",
    );
    expect(
      promoted.evidence.entries.find((entry) => entry.code === promotedDiagnostic.code),
    ).toMatchObject({ finalSeverity: "error" });

    writeFileSync(
      join(root, "capped.blend"),
      "module Main;\nfunction main(): void {\n@\n@\n@\n@\n@\n}\n",
      "utf8",
    );
    const capped = fixtures.compiler.compileWithEvidence({
      platform: "c64",
      cwd: root,
      sourceFiles: ["capped.blend"],
      maxErrors: 3,
    });
    expect(
      capped.evidence.entries.map((entry) => ({
        code: entry.code,
        severity: entry.finalSeverity,
      })),
    ).toEqual(
      capped.result.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        severity: diagnostic.severity,
      })),
    );
    expect(new Set(capped.evidence.entries.map((entry) => entry.acceptedEntryId)).size).toBe(
      capped.evidence.entries.length,
    );
  });
});
