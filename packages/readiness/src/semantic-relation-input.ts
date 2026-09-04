import { Buffer } from "node:buffer";
import { isDeepStrictEqual } from "node:util";

import { isGenIdentifier } from "./generator-ir.js";
import type { GenForStatement, GenFunction, GenModule } from "./generator-ir.js";
import type { GeneratedCase } from "./campaign-model.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  snapshotOracleInput,
  type OracleFailure,
} from "./oracle-input.js";
import { validateOracleBudget } from "./oracle-budget.js";
import { validateOracleMemoryFixture } from "./oracle-memory.js";
import { ORACLE_V1_LIMITS, type OracleSuite, type SemanticRelationId } from "./oracle-model.js";
import { validateOracleReplay } from "./oracle-provenance.js";
import { getOracleSuiteState, type OracleSuiteState } from "./oracle-suite.js";
import { snapshotSemanticRelationValue } from "./semantic-relation-freeze.js";
import type {
  SemanticRelationRequestV1,
  SemanticRelationRequestV2,
  SemanticRelationResultV1,
} from "./semantic-relation-model.js";
import {
  structuredCaseAuthorityForSuiteV1,
  type StructuredCaseAuthorityV1,
} from "./structured-case-families.js";

/** Replay-verified immutable state consumed by semantic-relation dispatch. */
export interface PreparedSemanticRelationRequestV1 {
  /** Validated closed relation request. */
  readonly request: SemanticRelationRequestV1;
  /** Exact regenerated campaign case retaining effective bindings. */
  readonly generatedCase: GeneratedCase;
  /** Unique selected entry function in the source module. */
  readonly entryFunction: GenFunction;
  /** Stable source-module index of the selected entry function. */
  readonly entryFunctionIndex: number;
  /** Module transformed by the selected relation. */
  readonly sourceModule: GenModule;
  /** Private accepted suite authority. */
  readonly suiteState: OracleSuiteState;
}

/** Authenticated immutable state consumed by structured loop-unrolling dispatch. */
export interface PreparedSemanticRelationRequestV2 {
  readonly request: SemanticRelationRequestV2;
  readonly authority: StructuredCaseAuthorityV1;
  readonly selectedLoop: GenForStatement;
  readonly functionIndex: number;
  readonly statementIndex: number;
}

const REQUEST_KEYS = [
  "schemaVersion",
  "handlerId",
  "relationId",
  "sourceProvenance",
  "sourceCase",
  "entryFunction",
  "selectionPath",
  "variantId",
  "memory",
  "budget",
] as const;
const STRUCTURED_REQUEST_KEYS = [...REQUEST_KEYS, "generationBudget"] as const;

const VARIANTS: Readonly<Record<SemanticRelationId, readonly string[]>> = Object.freeze({
  "relation.identifier-renaming": Object.freeze(["fresh-sibling-v1"]),
  "relation.literal-to-local": Object.freeze(["introduce-local-v1"]),
  "relation.local-to-parameter": Object.freeze(["lift-entry-local-v1"]),
  "relation.algebraic-identity": Object.freeze([
    "add-zero-right",
    "subtract-zero-right",
    "multiply-one-right",
    "divide-one-right",
    "or-zero-right",
    "xor-zero-right",
    "and-all-ones-right",
    "shift-left-zero",
    "shift-right-zero",
  ]),
  "relation.independent-declaration-reordering": Object.freeze(["swap-independent-constants-v1"]),
});

function isRelationId(value: unknown): value is SemanticRelationId {
  return typeof value === "string" && Object.hasOwn(VARIANTS, value);
}

function canonicalPointer(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Buffer.byteLength(value, "utf8") <= ORACLE_V1_LIMITS.identifierBytes * 4 &&
    /^(?:\/(?:[^~/]|~0|~1)+)+$/u.test(value)
  );
}

function sourceModule(generatedCase: GeneratedCase): GenModule {
  const projection = generatedCase.modeledCase.projection;
  return projection.kind === "valid" ? projection.module : projection.baseline;
}

/**
 * Snapshots, validates and replay-verifies one hostile relation request.
 *
 * @param suite Factory-created source-authoring authority.
 * @param input Hostile request candidate.
 * @returns Prepared immutable relation state or one closed failure.
 */
export function prepareSemanticRelationRequest(
  suite: OracleSuite,
  input: unknown,
): PreparedSemanticRelationRequestV1 | SemanticRelationResultV1 {
  const suiteState = getOracleSuiteState(suite);
  if (suiteState === undefined) {
    return oracleFailure(
      "oracle.authority.not-accepted",
      "/suite",
      "Oracle suite capability is not accepted.",
    );
  }
  const snapshot = snapshotOracleInput(input);
  if (!snapshot.ok) return snapshot;
  if (
    !isOracleRecord(snapshot.value) ||
    !hasExactOracleKeys(snapshot.value, REQUEST_KEYS) ||
    snapshot.value.schemaVersion !== 1 ||
    snapshot.value.handlerId !== "transform.semantic-relations"
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Semantic relation request must use the exact version-one shape.",
    );
  }
  const value = snapshot.value;
  if (!isRelationId(value.relationId)) {
    return oracleFailure(
      "oracle.relation.invalid",
      "/relationId",
      "Semantic relation ID is not supported.",
    );
  }
  if (
    typeof value.variantId !== "string" ||
    !VARIANTS[value.relationId].includes(value.variantId)
  ) {
    return oracleFailure(
      "oracle.relation.invalid",
      "/variantId",
      "Variant does not belong to the selected relation.",
    );
  }
  if (!canonicalPointer(value.selectionPath)) {
    return oracleFailure(
      "oracle.relation.invalid",
      "/selectionPath",
      "Selection path must be one canonical JSON pointer.",
    );
  }
  if (!isGenIdentifier(value.entryFunction)) {
    return oracleFailure(
      "oracle.input.invalid",
      "/entryFunction",
      "Entry function must be a canonical identifier.",
    );
  }
  const budget = validateOracleBudget(value.budget);
  if (!budget.ok) return budget;
  if (
    BigInt(snapshot.nodes) > budget.budget.inputNodes ||
    BigInt(snapshot.depth) > budget.budget.expressionDepth
  ) {
    return oracleFailure("oracle.budget", "", "Relation request exceeds its structural budget.");
  }
  const memory = validateOracleMemoryFixture(value.memory);
  if (!memory.ok) return memory;
  const replay = validateOracleReplay({
    sourceProvenance: value.sourceProvenance,
    generatedCase: value.sourceCase,
    registry: suiteState.replayRegistry,
    modeledSuite: suiteState.modeledSuite,
    inventoryVersion: suiteState.inventory.inventoryVersion,
  });
  if (!replay.ok) return replay;
  const module = sourceModule(replay.generatedCase);
  const entries = module.functions.filter((fn) => fn.name === value.entryFunction);
  if (entries.length !== 1 || entries[0] === undefined) {
    return oracleFailure(
      "oracle.input.invalid",
      "/entryFunction",
      "Entry function must resolve exactly once.",
    );
  }
  const sourceCaseSnapshot = snapshotSemanticRelationValue(replay.generatedCase.modeledCase);
  const request: SemanticRelationRequestV1 = Object.freeze({
    schemaVersion: 1,
    handlerId: "transform.semantic-relations",
    relationId: value.relationId,
    sourceProvenance: replay.provenance,
    sourceCase: sourceCaseSnapshot,
    entryFunction: value.entryFunction,
    selectionPath: value.selectionPath,
    variantId: value.variantId,
    memory: memory.memory,
    budget: budget.budget,
  });
  return Object.freeze({
    request,
    generatedCase: replay.generatedCase,
    entryFunction: entries[0],
    entryFunctionIndex: module.functions.indexOf(entries[0]),
    sourceModule: sourceModule({
      ...replay.generatedCase,
      modeledCase: sourceCaseSnapshot,
    }),
    suiteState,
  });
}

/**
 * Authenticates and closes one structured loop-unrolling request.
 *
 * @param suite Package-created structured oracle capability.
 * @param input Hostile request candidate.
 * @returns Authenticated loop selection or one stable oracle failure.
 */
export function prepareStructuredSemanticRelationRequest(
  suite: OracleSuite,
  input: unknown,
): PreparedSemanticRelationRequestV2 | OracleFailure {
  const authority = structuredCaseAuthorityForSuiteV1(suite);
  if (authority === undefined) {
    return oracleFailure(
      "oracle.authority.not-accepted",
      "/suite",
      "Oracle suite capability is not accepted.",
    );
  }
  const snapshot = snapshotOracleInput(input);
  if (!snapshot.ok) return snapshot;
  const value = snapshot.value;
  if (
    !isOracleRecord(value) ||
    !hasExactOracleKeys(value, STRUCTURED_REQUEST_KEYS) ||
    value.schemaVersion !== 2 ||
    value.handlerId !== "transform.semantic-relations" ||
    value.relationId !== "relation.loop-unrolling" ||
    value.variantId !== "unroll-exact-domain-v1"
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Structured relation request must use the exact version-two shape.",
    );
  }
  if (
    value.entryFunction !== authority.oracleInput.entryFunction ||
    value.selectionPath !== authority.relationSelectionPath ||
    !isDeepStrictEqual(value.sourceProvenance, authority.sourceProvenance) ||
    !isDeepStrictEqual(value.sourceCase, authority.generatedCase) ||
    !isDeepStrictEqual(value.memory, authority.oracleInput.memory) ||
    !isDeepStrictEqual(value.budget, authority.oracleInput.budget) ||
    !isDeepStrictEqual(value.generationBudget, authority.oracleInput.generationBudget)
  ) {
    return oracleFailure(
      "oracle.authority.stale",
      "/sourceCase",
      "Structured relation authority does not match the registered case.",
    );
  }
  if (typeof value.selectionPath !== "string") {
    return oracleFailure("oracle.relation.invalid", "/selectionPath", "Loop selection is invalid.");
  }
  const match = /^\/functions\/(0|[1-9][0-9]*)\/body\/(0|[1-9][0-9]*)$/u.exec(value.selectionPath);
  const functionIndex = match?.[1] === undefined ? undefined : Number(match[1]);
  const statementIndex = match?.[2] === undefined ? undefined : Number(match[2]);
  if (functionIndex === undefined || statementIndex === undefined) {
    return oracleFailure("oracle.relation.invalid", "/selectionPath", "Loop selection is invalid.");
  }
  const statement =
    functionIndex === undefined || statementIndex === undefined
      ? undefined
      : authority.oracleInput.module.functions[functionIndex]?.body[statementIndex];
  if (statement?.kind !== "for") {
    return oracleFailure(
      "oracle.relation.invalid",
      "/selectionPath",
      "Selection must name one top-level finite loop.",
    );
  }
  const request: SemanticRelationRequestV2 = Object.freeze({
    schemaVersion: 2,
    handlerId: "transform.semantic-relations",
    relationId: "relation.loop-unrolling",
    sourceProvenance: authority.sourceProvenance,
    sourceCase: authority.generatedCase,
    entryFunction: authority.oracleInput.entryFunction,
    selectionPath: value.selectionPath,
    variantId: "unroll-exact-domain-v1",
    memory: authority.oracleInput.memory,
    budget: authority.oracleInput.budget,
    generationBudget: authority.oracleInput.generationBudget,
  });
  return Object.freeze({
    authority,
    request,
    selectedLoop: statement,
    functionIndex,
    statementIndex,
  });
}

/**
 * Narrows a prepared-result union without relying on implementation casts.
 *
 * @param value Prepared request or closed failure result.
 * @returns Whether `value` is a closed failure/result branch.
 */
export function isSemanticRelationResult(
  value: PreparedSemanticRelationRequestV1 | SemanticRelationResultV1,
): value is SemanticRelationResultV1 {
  return "ok" in value;
}
