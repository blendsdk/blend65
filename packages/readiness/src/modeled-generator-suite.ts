import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { copyUint8Array, uint8ArrayByteLength } from "./canonical-identity.js";
import {
  prepareModeledConstructionRegistry,
  type PreparedModeledConstructionRegistry,
} from "./modeled-construction-templates.js";
import type { InventoryV1 } from "./model.js";
import {
  createModeledChoices,
  MODELED_RULE_FACTS,
  type ModeledRuleFact,
} from "./modeled-generator-facts.js";
import {
  MODELED_GENERATOR_SUITE_CAPABILITY,
  type ModeledGenerationDiagnostic,
  type ModeledGeneratorSuite,
  type ModeledGeneratorSuiteInput,
  type ModeledGeneratorSuiteResult,
  type RuleGenerationDomainResult,
} from "./modeled-generator-model.js";
import type {
  ModeledRuleRecord,
  RuleModelEntryInput,
  RuleModelRegistry,
  Sha256Digest,
} from "./model-registry-model.js";
import { createModeledOperationRegistry } from "./modeled-operation-registry.js";
import { parseRuleModelRegistry } from "./rule-model-input.js";
import { validateRuleModelRegistry } from "./rule-model-validator.js";
import { inspectPlainDataTree } from "./programmatic-input.js";
import { parseStrictJson } from "./strict-json.js";

interface Citation {
  readonly ruleId: string;
  readonly sourcePath: string;
  readonly contentHash: Sha256Digest;
}

interface ReviewEvidence {
  readonly outcome: string;
  readonly seedContractDigest: string;
  readonly ruleModelDigest: string;
  readonly inventoryCitationDigest: string;
  readonly citations: readonly Citation[];
}

interface SuiteState {
  readonly registry: RuleModelRegistry;
  readonly protocolVersion: "rule-model-v1";
  readonly manifestRegistryVersion: string;
  readonly ruleModelDigest: Sha256Digest;
  readonly constructions: PreparedModeledConstructionRegistry;
}

const MAX_AUTHORITY_BYTES = 16_777_216;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const SUITE_STATES = new WeakMap<object, SuiteState>();
const encoder = new TextEncoder();
const SEED_SPELLINGS = Object.freeze(["literal", "named-constant", "local-variable", "parameter"]);
const MODEL_SPELLINGS = Object.freeze(["literal", "local-variable", "named-constant", "parameter"]);

function diagnostic(
  code: ModeledGenerationDiagnostic["code"],
  path: string,
  message: string,
): ModeledGenerationDiagnostic {
  return Object.freeze({ code, path, message });
}

function failure(
  code: ModeledGenerationDiagnostic["code"],
  path: string,
  message: string,
): { readonly ok: false; readonly diagnostics: readonly ModeledGenerationDiagnostic[] } {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(code, path, message)]),
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isSha256Digest(value: unknown): value is Sha256Digest {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function digest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function snapshotSuiteInput(value: unknown): ModeledGeneratorSuiteInput | undefined {
  try {
    if (
      !isRecord(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      !hasExactKeys(value, [
        "seedContractBytes",
        "ruleModelBytes",
        "reviewEvidenceBytes",
        "inventory",
      ])
    ) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of [
      "seedContractBytes",
      "ruleModelBytes",
      "reviewEvidenceBytes",
      "inventory",
    ] as const) {
      const descriptor = descriptors[key];
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
    }
    return {
      seedContractBytes: descriptors.seedContractBytes?.value,
      ruleModelBytes: descriptors.ruleModelBytes?.value,
      reviewEvidenceBytes: descriptors.reviewEvidenceBytes?.value,
      inventory: descriptors.inventory?.value,
    };
  } catch {
    return undefined;
  }
}

function wireConstructorIds(fact: ModeledRuleFact): readonly string[] {
  if (fact.kind === "memory") return [`constructor.memory.${fact.intrinsic}`];
  return ["literal", "local-variable", "named-constant", "parameter"].map(
    (spelling) => `constructor.scalar.${fact.scalarType}.${spelling}`,
  );
}

function expectedSeedContract(): unknown {
  const rules = [...MODELED_RULE_FACTS.values()]
    .map((fact) =>
      fact.kind === "scalar"
        ? {
            kind: "scalar",
            ruleId: fact.ruleId,
            handlerId: fact.handlerId,
            scalarType: fact.scalarType,
            values: fact.values.map(String),
            constructorIds: wireConstructorIds(fact),
            predicateIds: [fact.predicateId],
            neighborIds: [...fact.neighborIds],
            boundaryFamilyIds: [`boundary.scalar.${fact.scalarType}`],
            spellings: SEED_SPELLINGS,
          }
        : {
            kind: "memory",
            ruleId: fact.ruleId,
            handlerId: fact.handlerId,
            intrinsic: fact.intrinsic,
            parameterTypes: [...fact.parameterTypes],
            returnType: fact.returnType,
            constructorIds: wireConstructorIds(fact),
            predicateIds: [fact.predicateId],
            neighborIds: [...fact.neighborIds],
            boundaryFamilyIds: [`boundary.memory.${fact.intrinsic}`],
            addressSpellings: SEED_SPELLINGS,
            valueSpellings: fact.parameterTypes.length === 1 ? [] : SEED_SPELLINGS,
            addressForms: ["direct", "computed"],
          },
    )
    .sort((left, right) => left.ruleId.localeCompare(right.ruleId));
  return { schemaVersion: 1, seedVersion: "rule-model-seed-v1", rules };
}

function seedMatchesReviewedFacts(value: unknown): boolean {
  return isDeepStrictEqual(value, expectedSeedContract());
}

function parseReview(value: unknown): ReviewEvidence | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schemaVersion", "review"]) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.review)
  ) {
    return undefined;
  }
  const review = value.review;
  if (
    !hasExactKeys(review, [
      "reviewId",
      "reviewer",
      "outcome",
      "seedContractDigest",
      "ruleModelDigest",
      "inventoryCitationDigest",
      "citations",
      "resolvedDisagreementIds",
    ]) ||
    review.reviewId !== "rule-model-seed-v1" ||
    typeof review.reviewer !== "string" ||
    review.reviewer.length === 0 ||
    typeof review.outcome !== "string" ||
    typeof review.seedContractDigest !== "string" ||
    typeof review.ruleModelDigest !== "string" ||
    typeof review.inventoryCitationDigest !== "string" ||
    !Array.isArray(review.citations) ||
    !Array.isArray(review.resolvedDisagreementIds) ||
    !review.resolvedDisagreementIds.every((entry) => typeof entry === "string")
  ) {
    return undefined;
  }
  const citations: Citation[] = [];
  for (const valueCitation of review.citations) {
    if (
      !isRecord(valueCitation) ||
      !hasExactKeys(valueCitation, ["ruleId", "sourcePath", "contentHash"]) ||
      typeof valueCitation.ruleId !== "string" ||
      typeof valueCitation.sourcePath !== "string" ||
      !isSha256Digest(valueCitation.contentHash)
    ) {
      return undefined;
    }
    citations.push({
      ruleId: valueCitation.ruleId,
      sourcePath: valueCitation.sourcePath,
      contentHash: valueCitation.contentHash,
    });
  }
  return {
    outcome: review.outcome,
    seedContractDigest: review.seedContractDigest,
    ruleModelDigest: review.ruleModelDigest,
    inventoryCitationDigest: review.inventoryCitationDigest,
    citations: Object.freeze(citations),
  };
}

function isInventory(value: unknown): value is InventoryV1 {
  if (!isRecord(value) || !Array.isArray(value.rules)) return false;
  return value.rules.every(
    (rule) =>
      isRecord(rule) &&
      typeof rule.ruleId === "string" &&
      isRecord(rule.source) &&
      typeof rule.source.path === "string" &&
      isSha256Digest(rule.source.contentHash),
  );
}

function inventoryCitations(inventory: InventoryV1): readonly Citation[] | undefined {
  const citations: Citation[] = [];
  for (const ruleId of MODELED_RULE_FACTS.keys()) {
    const rule = inventory.rules.find((candidate) => candidate.ruleId === ruleId);
    if (rule === undefined) return undefined;
    const contentHash = rule.source.contentHash;
    if (!isSha256Digest(contentHash)) return undefined;
    citations.push({
      ruleId,
      sourcePath: rule.source.path,
      contentHash,
    });
  }
  return Object.freeze(citations.sort((left, right) => left.ruleId.localeCompare(right.ruleId)));
}

function citationsEqual(left: readonly Citation[], right: readonly Citation[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (citation, index) =>
        citation.ruleId === right[index]?.ruleId &&
        citation.sourcePath === right[index]?.sourcePath &&
        citation.contentHash === right[index]?.contentHash,
    )
  );
}

function modelCitations(registry: RuleModelRegistry): readonly Citation[] {
  const citations: Citation[] = [];
  for (const ruleId of MODELED_RULE_FACTS.keys()) {
    const record = registry.get(ruleId);
    if (record?.state !== "modeled") continue;
    for (const citation of record.citations) {
      citations.push({ ruleId, ...citation });
    }
  }
  return Object.freeze(citations.sort((left, right) => left.ruleId.localeCompare(right.ruleId)));
}

function modelFactsAgree(record: ModeledRuleRecord): boolean {
  const fact = MODELED_RULE_FACTS.get(record.ruleId);
  if (fact === undefined) return false;
  const expectedPreconditions =
    fact.kind === "scalar"
      ? [
          { kind: "spelling-in", subject: "value", values: MODEL_SPELLINGS },
          { kind: "type-in", subject: "value", values: [fact.scalarType] },
          ...(fact.scalarType === "boolean"
            ? []
            : [{ kind: "value-range", subject: "value", values: fact.values.map(String) }]),
        ]
      : [
          { kind: "arity", subject: "arguments", values: [String(fact.parameterTypes.length)] },
          { kind: "spelling-in", subject: "address", values: MODEL_SPELLINGS },
          { kind: "type-in", subject: "address", values: ["word"] },
          ...(fact.parameterTypes[1] === undefined
            ? []
            : [
                { kind: "spelling-in", subject: "value", values: MODEL_SPELLINGS },
                {
                  kind: "type-in",
                  subject: "value",
                  values: [fact.parameterTypes[1]],
                },
              ]),
        ];
  const expectedDomains =
    fact.kind === "scalar"
      ? [{ subject: "value", type: fact.scalarType, values: fact.values.map(String) }]
      : [
          { subject: "address", type: "word", values: ["0", "65535"] },
          ...(fact.returnType === "void"
            ? [
                {
                  subject: "value",
                  type: fact.parameterTypes[1],
                  values: fact.parameterTypes[1] === "byte" ? ["0", "255"] : ["0", "65535"],
                },
              ]
            : [
                {
                  subject: "result",
                  type: fact.returnType,
                  values: fact.returnType === "byte" ? ["0", "255"] : ["0", "65535"],
                },
              ]),
        ];
  const expectedInvalidContracts = [
    {
      contractId:
        fact.kind === "scalar"
          ? fact.scalarType === "boolean"
            ? "value.domain"
            : "value.range"
          : "memory.signature",
      diagnosticFamily:
        fact.kind === "scalar"
          ? fact.scalarType === "boolean"
            ? "type.domain"
            : "type.range"
          : "intrinsic.signature",
      neighborIds: [...fact.neighborIds],
    },
  ];
  return isDeepStrictEqual(
    {
      constructionPreconditions: record.constructionPreconditions,
      typedDomains: record.typedDomains,
      invalidContracts: record.invalidContracts,
      constructorIds: record.constructorIds,
      predicateIds: record.predicateIds,
      neighborIds: record.neighborIds,
      boundaryFamilyIds: record.boundaryFamilyIds,
      spellings: record.spellings,
    },
    {
      constructionPreconditions: expectedPreconditions,
      typedDomains: expectedDomains,
      invalidContracts: expectedInvalidContracts,
      constructorIds: wireConstructorIds(fact),
      predicateIds: [fact.predicateId],
      neighborIds: [...fact.neighborIds],
      boundaryFamilyIds: [
        fact.kind === "scalar"
          ? `boundary.scalar.${fact.scalarType}`
          : `boundary.memory.${fact.intrinsic}`,
      ],
      spellings: MODEL_SPELLINGS,
    },
  );
}

function createCapability(
  registry: RuleModelRegistry,
  ruleModelDigest: Sha256Digest,
  constructions: PreparedModeledConstructionRegistry,
): ModeledGeneratorSuite {
  const capability: ModeledGeneratorSuite = Object.freeze({
    [MODELED_GENERATOR_SUITE_CAPABILITY]: true as const,
  });
  SUITE_STATES.set(
    capability,
    Object.freeze({
      registry,
      protocolVersion: "rule-model-v1",
      manifestRegistryVersion: registry.registryVersion,
      ruleModelDigest,
      constructions,
    }),
  );
  return capability;
}

/** Resolves the private state behind a validated modeled-generator capability. */
export function getModeledSuiteState(suite: ModeledGeneratorSuite): SuiteState | undefined {
  if (typeof suite !== "object" || suite === null) return undefined;
  return SUITE_STATES.get(suite);
}

/**
 * Validates all digest-bound authority before enabling modeled generation.
 *
 * @param input Raw seed, model, review, and inventory authority.
 * @returns An opaque generator suite or one stable closed failure.
 */
export function createModeledGeneratorSuite(input: unknown): ModeledGeneratorSuiteResult {
  const snapshot = snapshotSuiteInput(input);
  if (snapshot === undefined) {
    return failure("modeled.input.invalid", "", "Suite input must be a closed record.");
  }
  const authorityInputs = [
    ["/seedContractBytes", snapshot.seedContractBytes],
    ["/ruleModelBytes", snapshot.ruleModelBytes],
    ["/reviewEvidenceBytes", snapshot.reviewEvidenceBytes],
  ] as const;
  for (const [path, value] of authorityInputs) {
    const byteLength = uint8ArrayByteLength(value);
    if (byteLength === undefined) {
      return failure("modeled.input.invalid", path, "Authority artifact must be a byte array.");
    }
    if (byteLength > MAX_AUTHORITY_BYTES) {
      return failure("modeled.input.limit", path, "Authority artifact exceeds the byte limit.");
    }
  }
  const seedBytes = copyUint8Array(snapshot.seedContractBytes);
  const modelBytes = copyUint8Array(snapshot.ruleModelBytes);
  const reviewBytes = copyUint8Array(snapshot.reviewEvidenceBytes);
  if (seedBytes === undefined || modelBytes === undefined || reviewBytes === undefined) {
    return failure("modeled.input.invalid", "", "Suite authority artifacts must be byte arrays.");
  }

  const parsedSeed = parseStrictJson(seedBytes);
  if (!parsedSeed.ok) {
    return failure(
      "modeled.input.invalid",
      `/seedContractBytes${parsedSeed.problem.path}`,
      parsedSeed.problem.message,
    );
  }
  const parsedReview = parseStrictJson(reviewBytes);
  if (!parsedReview.ok) {
    return failure(
      "modeled.input.invalid",
      `/reviewEvidenceBytes${parsedReview.problem.path}`,
      parsedReview.problem.message,
    );
  }
  const seedValue = parsedSeed.value;
  const reviewValue = parsedReview.value;
  if (!seedMatchesReviewedFacts(seedValue)) {
    return failure("modeled.seed.mismatch", "/seedContractBytes", "Seed contract is not exact.");
  }
  const review = parseReview(reviewValue);
  if (review === undefined) {
    return failure("modeled.review.missing", "/reviewEvidenceBytes", "Review evidence is invalid.");
  }
  const seedDigest = digest(seedBytes);
  const modelDigest = digest(modelBytes);
  if (review.seedContractDigest !== seedDigest || review.ruleModelDigest !== modelDigest) {
    return failure(
      "modeled.review.stale",
      "/reviewEvidenceBytes/review",
      "Review evidence does not match the supplied artifacts.",
    );
  }
  if (review.outcome !== "accepted") {
    return failure(
      "modeled.review.not-accepted",
      "/reviewEvidenceBytes/review/outcome",
      "Independent review did not accept the modeled facts.",
    );
  }
  const inventoryStructure = inspectPlainDataTree(snapshot.inventory, "/inventory", () => false);
  if (inventoryStructure !== undefined || !isInventory(snapshot.inventory)) {
    return failure("modeled.input.invalid", "/inventory", "Inventory authority is invalid.");
  }
  const citations = inventoryCitations(snapshot.inventory);
  if (citations === undefined) {
    return failure(
      "modeled.citation.mismatch",
      "/inventory/rules",
      "Inventory is missing a reviewed rule citation.",
    );
  }
  if (
    review.inventoryCitationDigest !== digest(encoder.encode(JSON.stringify(citations))) ||
    !citationsEqual(review.citations, citations)
  ) {
    return failure(
      "modeled.review.stale",
      "/reviewEvidenceBytes/review/citations",
      "Review evidence does not match current inventory citations.",
    );
  }

  const parsed = parseRuleModelRegistry(modelBytes);
  if (!parsed.ok) {
    return failure("modeled.input.invalid", "/ruleModelBytes", "Rule-model registry is invalid.");
  }
  const operations = createModeledOperationRegistry();
  if (!operations.ok) {
    return failure(
      "modeled.operation.failed",
      "/ruleModelBytes/rules",
      "Reviewed executable operation registry is invalid.",
    );
  }
  if (operations.registry.operations.some(({ implementation }) => implementation() !== true)) {
    return failure(
      "modeled.operation.failed",
      "/ruleModelBytes/rules",
      "A reviewed executable operation failed its canonical semantic probe.",
    );
  }
  const validated = validateRuleModelRegistry(
    parsed.input,
    snapshot.inventory.rules.map(({ ruleId }) => ruleId),
    operations.registry.operationIds,
  );
  if (!validated.ok) {
    return failure("modeled.input.invalid", "/ruleModelBytes", "Rule-model registry is invalid.");
  }
  const modeledRecords = validated.registry.rules.filter(
    (record): record is ModeledRuleRecord => record.state === "modeled",
  );
  if (
    modeledRecords.length !== MODELED_RULE_FACTS.size ||
    !modeledRecords.every(modelFactsAgree) ||
    !modeledRecords.every(
      (record) =>
        record.constructorIds.every((id) => operations.registry.has("constructor", id)) &&
        record.predicateIds.every((id) => operations.registry.has("predicate", id)) &&
        record.neighborIds.every((id) => operations.registry.has("neighbor", id)) &&
        record.boundaryFamilyIds.every((id) => operations.registry.has("boundary-family", id)),
    ) ||
    !citationsEqual(modelCitations(validated.registry), citations)
  ) {
    return failure(
      "modeled.citation.mismatch",
      "/ruleModelBytes/rules",
      "Modeled facts or citations do not match reviewed inventory authority.",
    );
  }
  const constructions = prepareModeledConstructionRegistry();
  if (constructions === undefined) {
    return failure(
      "modeled.operation.failed",
      "/ruleModelBytes/rules",
      "A reviewed construction template failed structural preparation.",
    );
  }

  return Object.freeze({
    ok: true,
    suite: createCapability(validated.registry, modelDigest, constructions),
    seedContractDigest: seedDigest,
    ruleModelDigest: modelDigest,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Returns the reviewed construction domain or retained unavailable state for one rule.
 *
 * @param suite Validated modeled-generator capability.
 * @param ruleId Inventory rule identity.
 * @returns Immutable modeled choices, explicit unavailable state, or a closed failure.
 */
export function getRuleGenerationDomain(
  suite: ModeledGeneratorSuite,
  ruleId: string,
): RuleGenerationDomainResult {
  const state = getModeledSuiteState(suite);
  if (state === undefined) {
    return failure("modeled.input.invalid", "/suite", "Generator suite capability is invalid.");
  }
  const record: RuleModelEntryInput | undefined = state.registry.get(ruleId);
  if (record === undefined) {
    return failure("modeled.rule.unavailable", "/ruleId", "Rule is not present in the registry.");
  }
  if (record.state !== "modeled") {
    return Object.freeze({ ok: true, ...record, diagnostics: EMPTY_DIAGNOSTICS });
  }
  const fact = MODELED_RULE_FACTS.get(ruleId);
  if (fact === undefined) {
    return failure("modeled.rule.unavailable", "/ruleId", "Rule has no reviewed generator.");
  }
  return Object.freeze({
    ok: true,
    state: "modeled",
    ruleId,
    handlerId: fact.handlerId,
    choices: createModeledChoices(fact),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
