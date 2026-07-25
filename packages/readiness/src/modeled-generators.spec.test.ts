import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  getPublishedBinding,
  INVENTORY_V1_LIMITS,
  parseInventoryJson,
  parseRuleModelRegistry,
  validateCandidateBindings,
  validateGeneratorIr,
  validateInventorySchema,
  validateRuleModelRegistry,
} from "./index.js";
import type { GenerationBudget, InventoryV1 } from "./index.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const INVENTORY_PATH = join(REPOSITORY_ROOT, "readiness/inventory/compiler-readiness-v1.json");
const MODEL_PATH = join(REPOSITORY_ROOT, "readiness/rule-models/rule-models-v1.json");
const SEED_PATH = join(REPOSITORY_ROOT, "readiness/rule-models/rule-model-seed-v1.json");
const encoder = new TextEncoder();

const SPELLINGS = ["literal", "named-constant", "local-variable", "parameter"] as const;
const CASE_SPELLINGS = ["const", "literal", "local", "parameter"] as const;
const ADDRESS_FORMS = ["direct", "computed"] as const;

const RULE_IDS = {
  boolean: "rule.ch02.2-primitive-types.boolean.range.true",
  byte: "rule.ch02.2-primitive-types.byte.range.0-255",
  sbyte: "rule.ch02.2-primitive-types.sbyte.range.128-127",
  sword: "rule.ch02.2-primitive-types.sword.range.32768-32767",
  word: "rule.ch02.2-primitive-types.word.range.0-65535",
  peek: "rule.ch12.3-1-memory-access.peek-addr.signature.word",
  peekw: "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
  poke: "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
  pokew: "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
} as const;

type ScalarName = "boolean" | "byte" | "sbyte" | "sword" | "word";
type MemoryName = "peek" | "peekw" | "poke" | "pokew";
type CaseSpelling = (typeof CASE_SPELLINGS)[number];
type AddressForm = (typeof ADDRESS_FORMS)[number];

interface ScalarChoice {
  readonly kind: "scalar";
  readonly ruleId: string;
  readonly spelling: CaseSpelling;
  readonly value: bigint | boolean;
}

interface MemoryChoice {
  readonly kind: "memory";
  readonly ruleId: string;
  readonly addressSpelling: CaseSpelling;
  readonly addressForm: AddressForm;
  readonly valueSpelling?: CaseSpelling;
}

type ModeledChoice = ScalarChoice | MemoryChoice;

interface SuiteCapability {
  readonly opaqueSuiteBrand: unknown;
}

interface DomainSuccess {
  readonly ok: true;
  readonly state: "modeled";
  readonly ruleId: string;
  readonly handlerId: "generator.frontend-cases" | "generator.runtime-cases";
  readonly choices: readonly ModeledChoice[];
  readonly diagnostics: readonly [];
}

interface UnavailableDomain {
  readonly ok: true;
  readonly state: "unmodeled" | "not-generatable";
  readonly ruleId: string;
  readonly reason: string;
  readonly diagnostics: readonly [];
}

interface ModeledFailure {
  readonly ok: false;
  readonly diagnostics: readonly {
    readonly code: string;
    readonly path: string;
    readonly message: string;
  }[];
}

type DomainResult = DomainSuccess | UnavailableDomain | ModeledFailure;

interface GeneratedResult {
  readonly ok: true;
  readonly outcome: "generated";
  readonly case: {
    readonly projection:
      | { readonly kind: "valid"; readonly module: unknown }
      | {
          readonly kind: "invalid";
          readonly baseline: unknown;
          readonly transform: {
            readonly kind:
              | "intrinsic-argument-remove"
              | "intrinsic-argument-insert"
              | "intrinsic-argument-replace";
            readonly callPath: string;
            readonly argumentIndex: number;
            readonly argument?: unknown;
          };
        };
    readonly primaryRuleId: string;
    readonly claimedRuleIds: readonly string[];
    readonly spelling: CaseSpelling;
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
  };
  readonly diagnostics: readonly [];
}

type GenerationResult = GeneratedResult | ModeledFailure;

interface PlannedApi {
  readonly createModeledGeneratorSuite: (input: unknown) =>
    | {
        readonly ok: true;
        readonly suite: SuiteCapability;
        readonly seedContractDigest: string;
        readonly ruleModelDigest: string;
        readonly diagnostics: readonly [];
      }
    | ModeledFailure;
  readonly getRuleGenerationDomain: (suite: SuiteCapability, ruleId: string) => DomainResult;
  readonly constructModeledCase: (suite: SuiteCapability, request: unknown) => GenerationResult;
  readonly evaluateModeledRule: (
    suite: SuiteCapability,
    request: unknown,
  ) =>
    | {
        readonly ok: true;
        readonly predicateId: string;
        readonly valid: boolean;
        readonly diagnostics: readonly [];
      }
    | ModeledFailure;
  readonly applyModeledRuleNeighbor: (suite: SuiteCapability, request: unknown) => GenerationResult;
  readonly generateFrontendCase: (suite: SuiteCapability, request: unknown) => GenerationResult;
  readonly generateCompilerCase: (suite: SuiteCapability, request: unknown) => GenerationResult;
  readonly generateRuntimeCase: (suite: SuiteCapability, request: unknown) => GenerationResult;
  readonly boundaryVariantsHandler: (input: unknown) => unknown;
}

const SCALAR_FACTS = {
  boolean: {
    ruleId: RULE_IDS.boolean,
    values: ["false", "true"],
    predicate: "predicate.scalar.boolean.domain",
    neighbors: ["neighbor.scalar.boolean.wrong-type"],
  },
  byte: {
    ruleId: RULE_IDS.byte,
    values: ["0", "255"],
    predicate: "predicate.scalar.byte.range",
    neighbors: ["neighbor.scalar.byte.above-max", "neighbor.scalar.byte.below-min"],
  },
  sbyte: {
    ruleId: RULE_IDS.sbyte,
    values: ["-128", "127"],
    predicate: "predicate.scalar.sbyte.range",
    neighbors: ["neighbor.scalar.sbyte.above-max", "neighbor.scalar.sbyte.below-min"],
  },
  sword: {
    ruleId: RULE_IDS.sword,
    values: ["-32768", "32767"],
    predicate: "predicate.scalar.sword.range",
    neighbors: ["neighbor.scalar.sword.above-max", "neighbor.scalar.sword.below-min"],
  },
  word: {
    ruleId: RULE_IDS.word,
    values: ["0", "65535"],
    predicate: "predicate.scalar.word.range",
    neighbors: ["neighbor.scalar.word.above-max", "neighbor.scalar.word.below-min"],
  },
} as const;

const MEMORY_FACTS = {
  peek: {
    ruleId: RULE_IDS.peek,
    parameterTypes: ["word"],
    returnType: "byte",
    neighbors: ["neighbor.memory.peek.wrong-address-type", "neighbor.memory.peek.wrong-arity"],
    valueSpellings: [],
  },
  peekw: {
    ruleId: RULE_IDS.peekw,
    parameterTypes: ["word"],
    returnType: "word",
    neighbors: ["neighbor.memory.peekw.wrong-address-type", "neighbor.memory.peekw.wrong-arity"],
    valueSpellings: [],
  },
  poke: {
    ruleId: RULE_IDS.poke,
    parameterTypes: ["word", "byte"],
    returnType: "void",
    neighbors: [
      "neighbor.memory.poke.wrong-address-type",
      "neighbor.memory.poke.wrong-arity",
      "neighbor.memory.poke.wrong-value-type",
    ],
    valueSpellings: SPELLINGS,
  },
  pokew: {
    ruleId: RULE_IDS.pokew,
    parameterTypes: ["word", "word"],
    returnType: "void",
    neighbors: [
      "neighbor.memory.pokew.wrong-address-type",
      "neighbor.memory.pokew.wrong-arity",
      "neighbor.memory.pokew.wrong-value-type",
    ],
    valueSpellings: SPELLINGS,
  },
} as const;

const SEED_RULES = [
  ...Object.entries(SCALAR_FACTS).map(([scalarType, fact]) => ({
    kind: "scalar",
    ruleId: fact.ruleId,
    handlerId: "generator.frontend-cases",
    scalarType,
    values: fact.values,
    constructorIds: [
      `constructor.scalar.${scalarType}.literal`,
      `constructor.scalar.${scalarType}.local-variable`,
      `constructor.scalar.${scalarType}.named-constant`,
      `constructor.scalar.${scalarType}.parameter`,
    ],
    predicateIds: [fact.predicate],
    neighborIds: fact.neighbors,
    boundaryFamilyIds: [`boundary.scalar.${scalarType}`],
    spellings: SPELLINGS,
  })),
  ...Object.entries(MEMORY_FACTS).map(([intrinsic, fact]) => ({
    kind: "memory",
    ruleId: fact.ruleId,
    handlerId: "generator.runtime-cases",
    intrinsic,
    parameterTypes: fact.parameterTypes,
    returnType: fact.returnType,
    constructorIds: [`constructor.memory.${intrinsic}`],
    predicateIds: [`predicate.memory.${intrinsic}.signature`],
    neighborIds: fact.neighbors,
    boundaryFamilyIds: [`boundary.memory.${intrinsic}`],
    addressSpellings: SPELLINGS,
    valueSpellings: fact.valueSpellings,
    addressForms: ADDRESS_FORMS,
  })),
].sort((left, right) => left.ruleId.localeCompare(right.ruleId));

const SEED = {
  schemaVersion: 1,
  seedVersion: "rule-model-seed-v1",
  rules: SEED_RULES,
} as const;
const SEED_BYTES = encoder.encode(JSON.stringify(SEED));

const PLANNED_API_CALLABLES = [
  "createModeledGeneratorSuite",
  "getRuleGenerationDomain",
  "constructModeledCase",
  "evaluateModeledRule",
  "applyModeledRuleNeighbor",
  "generateFrontendCase",
  "generateCompilerCase",
  "generateRuntimeCase",
  "boundaryVariantsHandler",
] as const;

const BUDGET: GenerationBudget = {
  maxModules: 4,
  maxDeclarations: 128,
  maxIrNodes: 512,
  maxStatements: 256,
  maxExpressionDepth: 16,
  maxLoopWork: 1n,
  maxSourceBytes: 65_536,
  maxAttempts: 128,
};

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function digestJson(value: unknown): `sha256:${string}` {
  return digest(encoder.encode(JSON.stringify(value)));
}

function isPlannedApi(value: object): value is PlannedApi {
  return PLANNED_API_CALLABLES.every(
    (exportName) => exportName in value && typeof Reflect.get(value, exportName) === "function",
  );
}

async function plannedApi(): Promise<PlannedApi> {
  const api = await import("./index.js");
  if (!isPlannedApi(api)) {
    throw new TypeError("The complete modeled-generator API must be exported.");
  }
  return api;
}

async function loadInventory(): Promise<InventoryV1> {
  const parsed = parseInventoryJson(await readFile(INVENTORY_PATH), INVENTORY_V1_LIMITS);
  if (!parsed.ok || parsed.inventory === undefined) {
    throw new TypeError("The authoritative inventory must parse.");
  }

  const validated = validateInventorySchema(parsed.inventory);
  if (!validated.ok || validated.inventory === undefined) {
    throw new TypeError("The authoritative inventory must satisfy its schema.");
  }
  return validated.inventory;
}

async function createReviewedInput(
  overrides: Partial<{
    seedContractBytes: Uint8Array;
    ruleModelBytes: Uint8Array;
    reviewEvidenceBytes: Uint8Array;
    inventory: InventoryV1;
  }> = {},
) {
  const inventory = overrides.inventory ?? (await loadInventory());
  const ruleModelBytes = overrides.ruleModelBytes ?? (await readFile(MODEL_PATH));
  const citations = [...SEED_RULES]
    .map(({ ruleId }) => {
      const rule = inventory.rules.find((candidate) => candidate.ruleId === ruleId);
      if (rule === undefined) {
        throw new TypeError(`Missing inventory rule ${ruleId}.`);
      }
      return {
        ruleId,
        sourcePath: rule.source.path,
        contentHash: rule.source.contentHash,
      };
    })
    .sort((left, right) => left.ruleId.localeCompare(right.ruleId));
  const reviewEvidenceBytes =
    overrides.reviewEvidenceBytes ??
    encoder.encode(
      JSON.stringify({
        schemaVersion: 1,
        review: {
          reviewId: "rule-model-seed-v1",
          reviewer: "independent semantic reviewer",
          outcome: "accepted",
          seedContractDigest: digest(overrides.seedContractBytes ?? SEED_BYTES),
          ruleModelDigest: digest(ruleModelBytes),
          inventoryCitationDigest: digestJson(citations),
          citations,
          resolvedDisagreementIds: [],
        },
      }),
    );

  return {
    seedContractBytes: overrides.seedContractBytes ?? SEED_BYTES,
    ruleModelBytes,
    reviewEvidenceBytes,
    inventory,
  };
}

async function createSuite(): Promise<{
  readonly api: PlannedApi;
  readonly suite: SuiteCapability;
}> {
  const api = await plannedApi();
  const result = api.createModeledGeneratorSuite(await createReviewedInput());
  expect(result).toMatchObject({
    ok: true,
    seedContractDigest: digest(SEED_BYTES),
    diagnostics: [],
  });
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result.diagnostics));
  }
  return { api, suite: result.suite };
}

function operationIds(): string[] {
  return SEED_RULES.flatMap((rule) => [
    ...rule.constructorIds,
    ...rule.predicateIds,
    ...rule.neighborIds,
    ...rule.boundaryFamilyIds,
  ]);
}

function scalarChoices(type: ScalarName): ScalarChoice[] {
  const fact = SCALAR_FACTS[type];
  const values = type === "boolean" ? [false, true] : fact.values.map((value) => BigInt(value));
  return values
    .flatMap((value) =>
      CASE_SPELLINGS.map((spelling) => ({
        kind: "scalar" as const,
        ruleId: fact.ruleId,
        spelling,
        value,
      })),
    )
    .sort((left, right) => choiceKey(left).localeCompare(choiceKey(right)));
}

function memoryChoices(intrinsic: MemoryName): MemoryChoice[] {
  const fact = MEMORY_FACTS[intrinsic];
  const valueSpellings = fact.valueSpellings.length === 0 ? [undefined] : [...CASE_SPELLINGS];
  return CASE_SPELLINGS.flatMap((addressSpelling) =>
    ADDRESS_FORMS.flatMap((addressForm) =>
      valueSpellings.map((valueSpelling) => ({
        kind: "memory" as const,
        ruleId: fact.ruleId,
        addressSpelling,
        addressForm,
        ...(valueSpelling === undefined ? {} : { valueSpelling }),
      })),
    ),
  ).sort((left, right) => choiceKey(left).localeCompare(choiceKey(right)));
}

function choiceKey(choice: ModeledChoice): string {
  if (choice.kind === "scalar") {
    return [
      choice.kind,
      choice.ruleId,
      choice.spelling,
      typeof choice.value === "bigint" ? choice.value.toString() : String(choice.value),
    ].join("|");
  }
  return [
    choice.kind,
    choice.ruleId,
    choice.addressSpelling,
    choice.addressForm,
    choice.valueSpelling ?? "",
  ].join("|");
}

function validRequest(
  handlerId: "generator.frontend-cases" | "generator.compiler-cases" | "generator.runtime-cases",
  choice: ModeledChoice,
  budget: GenerationBudget = BUDGET,
) {
  return {
    handlerId,
    modulePath: ["ModeledCases"],
    choice,
    validity: { kind: "valid" },
    budget,
  } as const;
}

function expectModeledFailure(
  result: {
    readonly ok: boolean;
    readonly diagnostics: readonly unknown[];
  },
  code: string,
): void {
  expect(result).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      {
        code,
        path: expect.any(String),
        message: expect.any(String),
      },
    ]),
  });
}

describe("reviewed modeled generator suite", () => {
  it("publishes the exact seed contract and exact 2,112-state model counts", async () => {
    expect(JSON.parse(await readFile(SEED_PATH, "utf8"))).toEqual(SEED);

    const inventory = await loadInventory();
    const parsed = parseRuleModelRegistry(await readFile(MODEL_PATH));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const result = validateRuleModelRegistry(
      parsed.input,
      inventory.rules.map(({ ruleId }) => ruleId),
      operationIds(),
    );

    expect(result).toMatchObject({
      ok: true,
      counts: {
        modeled: 9,
        unmodeled: 2_103,
        "not-generatable": 0,
      },
      diagnostics: [],
    });
    expect(
      parsed.input.rules
        .filter(({ state }) => state === "modeled")
        .map(({ ruleId }) => ruleId)
        .sort(),
    ).toEqual(Object.values(RULE_IDS).sort());
  });

  it("requires exact citation authority and rejects stale semantic review", async () => {
    const api = await plannedApi();
    const accepted = api.createModeledGeneratorSuite(await createReviewedInput());
    expect(accepted).toMatchObject({ ok: true, diagnostics: [] });

    const rawModel = JSON.parse(await readFile(MODEL_PATH, "utf8")) as {
      rules: {
        state: string;
        typedDomains?: { values: string[] }[];
      }[];
    };
    const mutatedModel = structuredClone(rawModel);
    const modeled = mutatedModel.rules.find(({ state }) => state === "modeled");
    if (modeled?.typedDomains?.[0]?.values === undefined) {
      throw new TypeError("The modeled semantic fact must exist.");
    }
    modeled.typedDomains[0].values = [...modeled.typedDomains[0].values, "mutated"];
    const stale = api.createModeledGeneratorSuite(
      await createReviewedInput({
        ruleModelBytes: encoder.encode(JSON.stringify(mutatedModel)),
        reviewEvidenceBytes: (await createReviewedInput()).reviewEvidenceBytes,
      }),
    );
    expectModeledFailure(stale, "modeled.review.stale");

    const inventory = await loadInventory();
    const changedRuleId = RULE_IDS.byte;
    const changedInventory = {
      ...inventory,
      rules: inventory.rules.map((rule) =>
        rule.ruleId === changedRuleId
          ? {
              ...rule,
              source: {
                ...rule.source,
                contentHash: `sha256:${"f".repeat(64)}`,
              },
            }
          : rule,
      ),
    };
    const citationMismatch = api.createModeledGeneratorSuite(
      await createReviewedInput({ inventory: changedInventory }),
    );
    expectModeledFailure(citationMismatch, "modeled.citation.mismatch");
  });

  it("retains the state and reason for every unavailable rule", async () => {
    const { api, suite } = await createSuite();
    const parsed = parseRuleModelRegistry(await readFile(MODEL_PATH));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    for (const rule of parsed.input.rules) {
      if (rule.state === "modeled") {
        continue;
      }
      const result = api.getRuleGenerationDomain(suite, rule.ruleId);
      expect(result).toEqual({
        ok: true,
        state: rule.state,
        ruleId: rule.ruleId,
        reason: rule.reason,
        diagnostics: [],
      });
    }
  });

  it("exposes every scalar boundary with every required spelling and no other value", async () => {
    const { api, suite } = await createSuite();

    for (const type of Object.keys(SCALAR_FACTS) as ScalarName[]) {
      const result = api.getRuleGenerationDomain(suite, SCALAR_FACTS[type].ruleId);
      expect(result).toMatchObject({
        ok: true,
        state: "modeled",
        ruleId: SCALAR_FACTS[type].ruleId,
        handlerId: "generator.frontend-cases",
        diagnostics: [],
      });
      if (!result.ok || result.state !== "modeled") {
        continue;
      }
      expect([...result.choices]).toEqual(
        [...scalarChoices(type)].sort((left, right) =>
          choiceKey(left).localeCompare(choiceKey(right)),
        ),
      );
      expect(Object.isFrozen(result.choices)).toBe(true);
    }
  });

  it("constructs all four memory intrinsics across every direct and computed spelling", async () => {
    const { api, suite } = await createSuite();

    for (const intrinsic of Object.keys(MEMORY_FACTS) as MemoryName[]) {
      const expectedChoices = memoryChoices(intrinsic);
      const domain = api.getRuleGenerationDomain(suite, MEMORY_FACTS[intrinsic].ruleId);
      expect(domain).toMatchObject({
        ok: true,
        state: "modeled",
        handlerId: "generator.runtime-cases",
        diagnostics: [],
      });
      if (!domain.ok || domain.state !== "modeled") {
        continue;
      }
      expect([...domain.choices]).toEqual(expectedChoices);

      for (const choice of expectedChoices) {
        const request = validRequest("generator.runtime-cases", choice);
        const predicate = api.evaluateModeledRule(suite, request);
        expect(predicate).toMatchObject({ ok: true, valid: true, diagnostics: [] });

        const result = api.generateRuntimeCase(suite, request);
        expect(result).toMatchObject({
          ok: true,
          outcome: "generated",
          case: {
            projection: { kind: "valid" },
            primaryRuleId: choice.ruleId,
            claimedRuleIds: [choice.ruleId],
            validity: { kind: "valid" },
          },
          diagnostics: [],
        });
        if (result.ok && result.case.projection.kind === "valid") {
          expect(validateGeneratorIr(result.case.projection.module)).toMatchObject({
            ok: true,
            diagnostics: [],
          });
        }
      }
    }
  });

  it("constructs each scalar spelling through the frontend handler", async () => {
    const { api, suite } = await createSuite();

    for (const type of Object.keys(SCALAR_FACTS) as ScalarName[]) {
      for (const choice of scalarChoices(type)) {
        const result = api.generateFrontendCase(
          suite,
          validRequest("generator.frontend-cases", choice),
        );
        expect(result).toMatchObject({
          ok: true,
          outcome: "generated",
          case: {
            projection: { kind: "valid" },
            primaryRuleId: choice.ruleId,
            claimedRuleIds: [choice.ruleId],
            spelling: choice.spelling,
            validity: { kind: "valid" },
          },
          diagnostics: [],
        });
      }
    }
  });

  it("creates every wrong-arity and wrong-type memory neighbor as exactly one structural delta", async () => {
    const { api, suite } = await createSuite();

    for (const intrinsic of Object.keys(MEMORY_FACTS) as MemoryName[]) {
      const fact = MEMORY_FACTS[intrinsic];
      const choice = memoryChoices(intrinsic)[0]!;
      for (const neighborId of fact.neighbors) {
        const result = api.applyModeledRuleNeighbor(suite, {
          ...validRequest("generator.runtime-cases", choice),
          validity: { kind: "invalid", neighborId },
        });
        expect(result).toMatchObject({
          ok: true,
          outcome: "generated",
          case: {
            projection: {
              kind: "invalid",
              transform: {
                callPath: expect.stringMatching(/^\//),
                argumentIndex: expect.any(Number),
              },
            },
            primaryRuleId: fact.ruleId,
            claimedRuleIds: [fact.ruleId],
            validity: {
              kind: "invalid",
              neighborId,
              violatedPredicateId: `predicate.memory.${intrinsic}.signature`,
              expectedDiagnosticFamily: expect.any(String),
            },
          },
          diagnostics: [],
        });
        if (!result.ok || result.case.projection.kind !== "invalid") {
          continue;
        }

        expect(validateGeneratorIr(result.case.projection.baseline)).toMatchObject({
          ok: true,
          diagnostics: [],
        });
        const { kind } = result.case.projection.transform;
        if (neighborId.endsWith("wrong-arity")) {
          expect(["intrinsic-argument-remove", "intrinsic-argument-insert"]).toContain(kind);
        } else {
          expect(kind).toBe("intrinsic-argument-replace");
        }
      }
    }
  });

  it("routes only scalar and memory direct domains and keeps compiler composition empty", async () => {
    const { api, suite } = await createSuite();

    for (const type of Object.keys(SCALAR_FACTS) as ScalarName[]) {
      const choice = scalarChoices(type)[0]!;
      expectModeledFailure(
        api.generateRuntimeCase(suite, validRequest("generator.runtime-cases", choice)),
        "modeled.handler.route",
      );
      expectModeledFailure(
        api.generateCompilerCase(suite, validRequest("generator.compiler-cases", choice)),
        "modeled.handler.route",
      );
    }

    for (const intrinsic of Object.keys(MEMORY_FACTS) as MemoryName[]) {
      const choice = memoryChoices(intrinsic)[0]!;
      expectModeledFailure(
        api.generateFrontendCase(suite, validRequest("generator.frontend-cases", choice)),
        "modeled.handler.route",
      );
      expectModeledFailure(
        api.generateCompilerCase(suite, validRequest("generator.compiler-cases", choice)),
        "modeled.handler.route",
      );
    }
  });

  it("fails closed on budgets, invalid identifiers, traversal shapes, and oversized input", async () => {
    const { api, suite } = await createSuite();
    const choice = scalarChoices("byte")[0]!;
    const tooSmall = {
      ...BUDGET,
      maxDeclarations: 1,
      maxIrNodes: 1,
      maxStatements: 1,
    };
    const budgetFailure = api.constructModeledCase(
      suite,
      validRequest("generator.frontend-cases", choice, tooSmall),
    );
    expectModeledFailure(budgetFailure, "modeled.operation.failed");
    expect(budgetFailure).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringMatching(/^\/usage\/(declarations|ir-nodes|statements)$/),
        }),
      ]),
    });

    for (const segment of ["", "../escape", "not-valid!", "a".repeat(65_537)]) {
      const result = api.constructModeledCase(suite, {
        ...validRequest("generator.frontend-cases", choice),
        modulePath: [segment],
      });
      expectModeledFailure(result, "modeled.choice.invalid");
      expect(result).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([expect.objectContaining({ path: "/modulePath/0" })]),
      });
    }

    const oversized = api.createModeledGeneratorSuite({
      ...(await createReviewedInput()),
      seedContractBytes: new Uint8Array(16_777_217),
    });
    expectModeledFailure(oversized, "modeled.input.limit");
  });

  it("keeps all four reviewed callables candidate-only and unavailable to published lookup", async () => {
    const api = await plannedApi();
    const declarations = [
      {
        id: "generator.frontend-cases",
        kind: "generator",
        owner: "readiness",
        contractVersion: "1.0.0",
        binding: "unbound",
      },
      {
        id: "generator.compiler-cases",
        kind: "generator",
        owner: "readiness",
        contractVersion: "1.0.0",
        binding: "unbound",
      },
      {
        id: "generator.runtime-cases",
        kind: "generator",
        owner: "readiness",
        contractVersion: "1.0.0",
        binding: "unbound",
      },
      {
        id: "transform.boundary-variants",
        kind: "transform",
        owner: "readiness",
        contractVersion: "1.0.0",
        binding: "unbound",
      },
    ] as const;
    const implementations = [
      ["generator.frontend-cases", "generator", api.generateFrontendCase],
      ["generator.compiler-cases", "generator", api.generateCompilerCase],
      ["generator.runtime-cases", "generator", api.generateRuntimeCase],
      ["transform.boundary-variants", "transform", api.boundaryVariantsHandler],
    ] as const;

    for (const [, , implementation] of implementations) {
      expect(implementation).toBeTypeOf("function");
    }

    const result = validateCandidateBindings(
      declarations,
      implementations.map(([handlerId, kind, implementation]) => ({
        handlerId,
        kind,
        contractVersion: "1.0.0",
        implementationRevision: `sha256:${"a".repeat(64)}`,
        implementation,
      })),
    );
    expect(result).toMatchObject({ ok: true, diagnostics: [] });

    const candidateLookupCannotBeCalled = (): void => {
      if (!result.ok) {
        return;
      }

      // @ts-expect-error Candidate bindings do not create a published capability.
      getPublishedBinding(result.bindings, "generator.frontend-cases");
    };
    expect(candidateLookupCannotBeCalled).toBeTypeOf("function");
  });
});
