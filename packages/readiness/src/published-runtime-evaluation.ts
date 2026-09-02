import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { getExecutionCaseEvaluationInputV1, type ExecutionCaseV1 } from "./execution-case.js";
import {
  claimConsumedCandidateRuntimeInputV1,
  type ConsumedReductionInvocationV1,
} from "./reduction-candidate.js";
import { getPreparedCampaignState, type PreparedCampaignState } from "./campaign-state.js";
import type {
  ExecutionInitialStateFixtureV1,
  ExecutionObservationRequestV1,
} from "./execution-envelope-contracts.js";
import { projectC64ActualWriteV1, projectC64InitialStateV1 } from "./execution-vic-projection.js";
import { deriveOracleSourceContentIdentity } from "./oracle-content-identity.js";
import { oracleFailure } from "./oracle-input.js";
import {
  ORACLE_V1_LIMITS,
  type MemoryCellV1,
  type PublishedOracleContext,
  type ValueStateObservationV1,
} from "./oracle-model.js";
import type { GeneratedModeledCase } from "./modeled-generator-model.js";
import type { OracleValidationResultV1 } from "./oracle-evaluation-identity.js";
import {
  createPublishedOracleRequest,
  evaluatePublishedCandidateRuntimeModelV1,
  evaluatePublishedOracle,
} from "./published-oracle-context.js";

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const RUNTIME_EVALUATION_REVISION = "published-runtime-evaluation-v1";
const ACTUAL_OBSERVATION_REVISION = "runtime-actual-observation-v1";
const C64_OBSERVATION_REVISION = "c64-vic-color-observation-v1";
const ORACLE_BUDGET = Object.freeze({
  inputNodes: BigInt(ORACLE_V1_LIMITS.inputNodes),
  expressionDepth: BigInt(ORACLE_V1_LIMITS.inputDepth),
  evaluationSteps: ORACLE_V1_LIMITS.executionEvents,
  frames: ORACLE_V1_LIMITS.executionEvents,
  memoryCells: ORACLE_V1_LIMITS.memoryCells,
  effects: ORACLE_V1_LIMITS.executionEvents,
  transformedNodes: BigInt(ORACLE_V1_LIMITS.inputNodes),
});

const PUBLISHED_RUNTIME_EVALUATION_AUTHORITY_V1: unique symbol = Symbol(
  "published-runtime-evaluation-authority",
);

/** Opaque single-use authority for comparing one selected runtime observation. */
export interface PublishedRuntimeEvaluationAuthorityV1 {
  /** Compile-time nominal marker paired with module-private runtime state. */
  readonly [PUBLISHED_RUNTIME_EVALUATION_AUTHORITY_V1]: true;
}

/** Passive route facts that contain no host-side expected answer. */
export interface PublishedRuntimeEvaluationProjectionV1 {
  /** Projection schema version. */
  readonly schemaVersion: 1;
  /** Genuine generated source-case identity. */
  readonly sourceCaseDigest: string;
  /** Initial target fixture required by the selected evaluation. */
  readonly fixture: ExecutionInitialStateFixtureV1;
  /** Actual observation shape required after completion. */
  readonly observation: ExecutionObservationRequestV1;
  /** Exact selected published release. */
  readonly selectedReleaseDigest: string;
  /** Identity of this evaluation without its expected truth. */
  readonly evaluationIdentity: string;
}

/** Hostile actual-observation record accepted by the readiness-owned comparator. */
export type RuntimeActualObservationV1 =
  | {
      /** Actual-observation record revision. */
      readonly revision: "runtime-actual-observation-v1";
      /** Source identity copied from the passive projection. */
      readonly sourceCaseDigest: string;
      /** Compiler-allocated scalar-byte observation. */
      readonly kind: "scalar-bytes";
      /** Actual bytes in little-endian order. */
      readonly bytes: Uint8Array;
    }
  | {
      /** Actual-observation record revision. */
      readonly revision: "runtime-actual-observation-v1";
      /** Source identity copied from the passive projection. */
      readonly sourceCaseDigest: string;
      /** Direct hardware-memory observation. */
      readonly kind: "direct-mmio";
      /** First observed hardware address. */
      readonly address: number;
      /** Versioned hardware readback projection. */
      readonly projectionRevision: "c64-vic-color-observation-v1";
      /** Actual bytes in increasing address order. */
      readonly bytes: Uint8Array;
    };

/** Closed semantic decision that never returns actual or expected bytes. */
export interface PublishedRuntimeEvaluationDecisionV1 {
  /** Decision format revision. */
  readonly revision: "published-runtime-evaluation-v1";
  /** Exact semantic equality outcome. */
  readonly outcome: "match" | "semantic-mismatch";
  /** Identity copied from the consumed authority. */
  readonly evaluationIdentity: string;
}

interface RuntimeEvaluationState {
  readonly projection: PublishedRuntimeEvaluationProjectionV1;
  readonly expectedObservation: ValueStateObservationV1;
  readonly expectedBytes: Uint8Array;
  consumed: boolean;
}

const RUNTIME_EVALUATION_STATES = new WeakMap<object, RuntimeEvaluationState>();

function samePublishedEnvironment(
  caller: PreparedCampaignState["campaign"],
  selected: PreparedCampaignState["campaign"],
): boolean {
  return isDeepStrictEqual(
    [
      caller.inventorySchemaVersion,
      caller.inventoryVersion,
      caller.inventoryDigest,
      caller.specRevision,
      caller.ruleModelVersion,
      caller.ruleModelDigest,
      caller.target,
      caller.prngAlgorithm,
      caller.generator.handlerId,
      caller.generator.contractVersion,
      caller.boundaryTransform.handlerId,
      caller.boundaryTransform.contractVersion,
    ],
    [
      selected.inventorySchemaVersion,
      selected.inventoryVersion,
      selected.inventoryDigest,
      selected.specRevision,
      selected.ruleModelVersion,
      selected.ruleModelDigest,
      selected.target,
      selected.prngAlgorithm,
      selected.generator.handlerId,
      selected.generator.contractVersion,
      selected.boundaryTransform.handlerId,
      selected.boundaryTransform.contractVersion,
    ],
  );
}

function sameReplayInput(
  caller: PreparedCampaignState,
  selected: PreparedCampaignState["campaign"],
  selectedConfiguration: PreparedCampaignState["configuration"],
): boolean {
  return isDeepStrictEqual(
    [selected.seed, selected.configurationDigest, selectedConfiguration],
    [caller.campaign.seed, caller.campaign.configurationDigest, caller.configuration],
  );
}

function cloneFixture(fixture: ExecutionInitialStateFixtureV1): ExecutionInitialStateFixtureV1 {
  return Object.freeze({
    revision: fixture.revision,
    cells: Object.freeze(
      fixture.cells.map(({ address, logicalValue }) => Object.freeze({ address, logicalValue })),
    ),
  });
}

function cloneObservation(
  observation: ExecutionObservationRequestV1,
): ExecutionObservationRequestV1 {
  return observation.kind === "scalar-bytes"
    ? Object.freeze({ kind: observation.kind, byteLength: observation.byteLength })
    : Object.freeze({
        kind: observation.kind,
        byteLength: observation.byteLength,
        ...(observation.address === undefined ? {} : { address: observation.address }),
        ...(observation.projectionRevision === undefined
          ? {}
          : { projectionRevision: observation.projectionRevision }),
      });
}

function encodeInteger(value: bigint, width: 1 | 2): Uint8Array {
  const normalized = BigInt.asUintN(width * 8, value);
  return width === 1
    ? Uint8Array.of(Number(normalized))
    : Uint8Array.of(Number(normalized & 0xffn), Number((normalized >> 8n) & 0xffn));
}

function scalarExpectedBytes(
  expected: ValueStateObservationV1,
  width: 1 | 2,
): Uint8Array | undefined {
  const value = expected.returnValue;
  if (value === null) return undefined;
  if (value.kind === "boolean") return width === 1 ? Uint8Array.of(value.value ? 1 : 0) : undefined;
  const expectedWidth = value.type === "byte" || value.type === "sbyte" ? 1 : 2;
  return expectedWidth === width ? encodeInteger(value.value, width) : undefined;
}

function directExpectedBytes(
  expected: ValueStateObservationV1,
  observation: ExecutionObservationRequestV1,
): Uint8Array | undefined {
  if (
    observation.kind !== "direct-mmio" ||
    expected.returnValue !== null ||
    observation.address === undefined ||
    observation.projectionRevision !== C64_OBSERVATION_REVISION
  ) {
    return undefined;
  }
  const effect = expected.effects.find(
    (candidate) =>
      candidate.kind === "write" &&
      observation.address !== undefined &&
      candidate.address === BigInt(observation.address) &&
      candidate.width === observation.byteLength,
  );
  if (effect === undefined || effect.kind !== "write") return undefined;
  const logical = encodeInteger(effect.value, observation.byteLength);
  const projected = new Uint8Array(observation.byteLength);
  for (let index = 0; index < projected.byteLength; index += 1) {
    const address = observation.address + index;
    const finalCell = expected.finalMemory.find((cell) => cell.address === BigInt(address));
    if (finalCell === undefined || finalCell.value !== BigInt(logical[index]!)) return undefined;
    const byte = projectC64ActualWriteV1(address, logical[index]!);
    if (!byte.ok) return undefined;
    projected[index] = byte.value;
  }
  return projected;
}

function deriveEvaluationIdentity(
  selectedReleaseDigest: string,
  publishedEvaluationIdentity: string,
  sourceCaseDigest: string,
  expected: ValueStateObservationV1,
  expectedBytes: Uint8Array,
): string {
  const hash = createHash("sha256");
  hash.update("blend65-published-runtime-evaluation-v1\0");
  hash.update(`${selectedReleaseDigest}\0${publishedEvaluationIdentity}\0${sourceCaseDigest}\0`);
  hash.update(expectedBytes);
  for (const effect of expected.effects) {
    hash.update(
      `\0${effect.kind}:${effect.width}:${effect.address.toString()}:${effect.value.toString()}:${effect.ordinal.toString()}`,
    );
  }
  for (const cell of expected.finalMemory) {
    hash.update(`\0${cell.address.toString()}:${cell.value.toString()}`);
  }
  return `sha256:${hash.digest("hex")}`;
}

function actualRecord(input: unknown): RuntimeActualObservationV1 | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  try {
    if (Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) return undefined;
    const kindDescriptor = Reflect.getOwnPropertyDescriptor(input, "kind");
    if (kindDescriptor === undefined || !("value" in kindDescriptor)) return undefined;
    const kind = kindDescriptor.value;
    const keys =
      kind === "scalar-bytes"
        ? (["revision", "sourceCaseDigest", "kind", "bytes"] as const)
        : kind === "direct-mmio"
          ? ([
              "revision",
              "sourceCaseDigest",
              "kind",
              "address",
              "projectionRevision",
              "bytes",
            ] as const)
          : undefined;
    if (keys === undefined) return undefined;
    const ownKeys = Reflect.ownKeys(input);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !(keys as readonly string[]).includes(key))
    ) {
      return undefined;
    }
    const record: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      record[key] = descriptor.value;
    }
    if (
      record.revision !== ACTUAL_OBSERVATION_REVISION ||
      typeof record.sourceCaseDigest !== "string" ||
      !(record.bytes instanceof Uint8Array) ||
      Object.getPrototypeOf(record.bytes) !== Uint8Array.prototype ||
      (record.bytes.byteLength !== 1 && record.bytes.byteLength !== 2)
    ) {
      return undefined;
    }
    const bytes = record.bytes.slice();
    if (kind === "scalar-bytes") {
      return Object.freeze({
        revision: ACTUAL_OBSERVATION_REVISION,
        sourceCaseDigest: record.sourceCaseDigest,
        kind,
        bytes,
      });
    }
    if (
      typeof record.address !== "number" ||
      !Number.isSafeInteger(record.address) ||
      record.address < 0 ||
      record.address > 65_535 ||
      record.projectionRevision !== C64_OBSERVATION_REVISION
    ) {
      return undefined;
    }
    return Object.freeze({
      revision: ACTUAL_OBSERVATION_REVISION,
      sourceCaseDigest: record.sourceCaseDigest,
      kind,
      address: record.address,
      projectionRevision: C64_OBSERVATION_REVISION,
      bytes,
    });
  } catch {
    return undefined;
  }
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

/**
 * Mints one single-use evaluator capability from genuine published and execution authorities.
 *
 * @param context Resolver-owned selected oracle context.
 * @param executionCase Genuine regenerated executable case.
 * @returns Opaque authority or one closed authority/semantic failure.
 *
 * @example
 * ```ts
 * const created = createPublishedRuntimeEvaluationAuthorityV1(context, executionCase);
 * if (!created.ok) throw new Error("Runtime evaluation authority was unavailable.");
 * ```
 */
function createRuntimeEvaluationAuthorityV1(
  context: PublishedOracleContext,
  executionCase: ExecutionCaseV1,
  modeledCase: GeneratedModeledCase,
  sourceBytes: Uint8Array,
  sourceCaseDigest: string,
): OracleValidationResultV1<PublishedRuntimeEvaluationAuthorityV1> {
  const input = getExecutionCaseEvaluationInputV1(executionCase);
  const campaign = input === undefined ? undefined : getPreparedCampaignState(input.campaign);
  if (input === undefined || modeledCase.projection.kind !== "valid" || campaign === undefined) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/executionCase",
      "Runtime evaluation requires a valid generated program.",
    );
  }
  const memoryCells: MemoryCellV1[] = [];
  for (const cell of input.fixture.cells) {
    const projected = projectC64InitialStateV1(cell.address, cell.logicalValue);
    if (!projected.ok) {
      return oracleFailure(
        "oracle.contract.invalid",
        "/executionCase/fixture",
        "Runtime fixture cannot be projected for host evaluation.",
      );
    }
    memoryCells.push(
      Object.freeze({ address: BigInt(cell.address), value: BigInt(projected.value) }),
    );
  }
  const memory = Object.freeze({ schemaVersion: 1 as const, cells: Object.freeze(memoryCells) });
  let expectedObservation: ValueStateObservationV1;
  let publishedEvaluationIdentity: string;
  let evaluatedSourceIdentity: string;
  if (isDeepStrictEqual(modeledCase, input.generatedCase.modeledCase)) {
    const request = createPublishedOracleRequest(context, {
      schemaVersion: 1,
      handlerId: "oracle.runtime-state",
      ruleId: input.generatedCase.modeledCase.primaryRuleId,
      seed: campaign.campaign.seed,
      configuration: campaign.configuration,
      ordinal: input.ordinal,
      memory,
      budget: ORACLE_BUDGET,
      observable: Object.freeze({ kind: "value-state" }),
    });
    if (!request.ok) return request;
    const selectedProvenance = request.value.sourceProvenance;
    if (
      !samePublishedEnvironment(campaign.campaign, selectedProvenance.campaign) ||
      !sameReplayInput(campaign, selectedProvenance.campaign, selectedProvenance.configuration) ||
      !isDeepStrictEqual(request.value.case, modeledCase)
    ) {
      return oracleFailure(
        "oracle.contract.invalid",
        "/executionCase",
        "Runtime execution case does not match the selected published replay.",
      );
    }
    const evaluated = evaluatePublishedOracle(context, request.value);
    if (
      !evaluated.ok ||
      !evaluated.result.ok ||
      evaluated.result.outcome !== "modeled" ||
      evaluated.result.observation.kind !== "value-state"
    ) {
      return oracleFailure(
        "oracle.contract.invalid",
        "/executionCase",
        "Selected runtime evaluator did not produce one modeled value-state answer.",
      );
    }
    expectedObservation = evaluated.result.observation;
    publishedEvaluationIdentity = evaluated.evaluationIdentity;
    evaluatedSourceIdentity = evaluated.contentIdentities.source;
  } else {
    const evaluated = evaluatePublishedCandidateRuntimeModelV1(
      context,
      modeledCase,
      campaign.configuration,
      memory,
      ORACLE_BUDGET,
    );
    if (
      !evaluated.ok ||
      !evaluated.value.result.ok ||
      evaluated.value.result.outcome !== "modeled" ||
      evaluated.value.result.observation.kind !== "value-state"
    ) {
      return oracleFailure(
        "oracle.contract.invalid",
        "/candidate",
        "Selected runtime evaluator did not produce one candidate value-state answer.",
      );
    }
    expectedObservation = evaluated.value.result.observation;
    publishedEvaluationIdentity = evaluated.value.authorityIdentity;
    const evaluatedSource = deriveOracleSourceContentIdentity(sourceBytes);
    if (!evaluatedSource.ok) return evaluatedSource;
    evaluatedSourceIdentity = evaluatedSource.identity;
  }
  const sourceIdentity = deriveOracleSourceContentIdentity(sourceBytes);
  if (!sourceIdentity.ok || sourceIdentity.identity !== evaluatedSourceIdentity) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/executionCase/sourceBytes",
      "Runtime source identity does not match the selected published replay.",
    );
  }
  const expectedBytes =
    input.observation.kind === "scalar-bytes"
      ? scalarExpectedBytes(expectedObservation, input.observation.byteLength)
      : directExpectedBytes(expectedObservation, input.observation);
  if (expectedBytes === undefined) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/executionCase/observation",
      "Selected runtime answer does not match the declared observation.",
    );
  }
  const evaluationIdentity = deriveEvaluationIdentity(
    context.selectedReleaseDigest,
    publishedEvaluationIdentity,
    sourceCaseDigest,
    expectedObservation,
    expectedBytes,
  );
  const passive: PublishedRuntimeEvaluationProjectionV1 = Object.freeze({
    schemaVersion: 1,
    sourceCaseDigest,
    fixture: cloneFixture(input.fixture),
    observation: cloneObservation(input.observation),
    selectedReleaseDigest: context.selectedReleaseDigest,
    evaluationIdentity,
  });
  const authority: PublishedRuntimeEvaluationAuthorityV1 = Object.freeze({
    [PUBLISHED_RUNTIME_EVALUATION_AUTHORITY_V1]: true as const,
  });
  RUNTIME_EVALUATION_STATES.set(authority, {
    projection: passive,
    expectedObservation,
    expectedBytes: expectedBytes.slice(),
    consumed: false,
  });
  return Object.freeze({ ok: true, value: authority, diagnostics: EMPTY_DIAGNOSTICS });
}

/**
 * Mints a single-use runtime comparator from one genuine published execution case.
 *
 * @example
 * ```ts
 * const created = createPublishedRuntimeEvaluationAuthorityV1(context, executionCase);
 * if (!created.ok) throw new Error("Runtime evaluation authority was unavailable.");
 * ```
 */
export function createPublishedRuntimeEvaluationAuthorityV1(
  context: PublishedOracleContext,
  executionCase: ExecutionCaseV1,
): OracleValidationResultV1<PublishedRuntimeEvaluationAuthorityV1> {
  const input = getExecutionCaseEvaluationInputV1(executionCase);
  if (input === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/executionCase",
      "Runtime evaluation requires a genuine execution case.",
    );
  }
  return createRuntimeEvaluationAuthorityV1(
    context,
    executionCase,
    input.generatedCase.modeledCase,
    input.generatedCase.sourceBytes,
    input.sourceCaseDigest,
  );
}

/** Mints a single-use runtime comparator from one genuine consumed typed-valid candidate. */
export function createCandidateRuntimeEvaluationAuthorityV1(
  context: PublishedOracleContext,
  executionCase: ExecutionCaseV1,
  consumed: ConsumedReductionInvocationV1,
): OracleValidationResultV1<PublishedRuntimeEvaluationAuthorityV1> {
  const input = getExecutionCaseEvaluationInputV1(executionCase);
  if (input === undefined || input.generatedCase.modeledCase.projection.kind !== "valid") {
    return oracleFailure(
      "oracle.authority.missing",
      "/executionCase",
      "Candidate runtime evaluation requires a genuine valid execution case.",
    );
  }
  const claimed = claimConsumedCandidateRuntimeInputV1(consumed);
  if (claimed === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/candidate",
      "Candidate runtime evaluation requires fresh typed-valid candidate authority.",
    );
  }
  const original = input.generatedCase.modeledCase;
  const modeledCase: GeneratedModeledCase = Object.freeze({
    projection: Object.freeze({ kind: "valid" as const, module: claimed.payload.module }),
    parameterBindings: claimed.payload.parameterBindings,
    primaryRuleId: claimed.payload.primaryRuleId,
    claimedRuleIds: claimed.payload.claimedRuleIds,
    spelling: original.spelling,
    validity: Object.freeze({ kind: "valid" as const }),
    constructionUsage: original.constructionUsage,
  });
  return createRuntimeEvaluationAuthorityV1(
    context,
    executionCase,
    modeledCase,
    claimed.payload.sourceBytes,
    claimed.candidate.candidateExecutionIdentity,
  );
}

/**
 * Returns a fresh passive projection for one unconsumed genuine authority.
 *
 * @example
 * ```ts
 * const projected = getPublishedRuntimeEvaluationProjectionV1(authority);
 * if (projected.ok) await prepareFixture(projected.value.fixture);
 * ```
 */
export function getPublishedRuntimeEvaluationProjectionV1(
  authority: PublishedRuntimeEvaluationAuthorityV1,
): OracleValidationResultV1<PublishedRuntimeEvaluationProjectionV1> {
  const state =
    typeof authority === "object" && authority !== null
      ? RUNTIME_EVALUATION_STATES.get(authority)
      : undefined;
  if (state === undefined || state.consumed) {
    return oracleFailure(
      "oracle.authority.missing",
      "/authority",
      "Runtime evaluation authority is invalid or consumed.",
    );
  }
  const projection = state.projection;
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      ...projection,
      fixture: cloneFixture(projection.fixture),
      observation: cloneObservation(projection.observation),
    }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Consumes one authority and compares an exact hostile actual-observation record.
 *
 * Consumption happens before parsing the actual record. A malformed probe therefore cannot be
 * corrected and retried against the same expected answer.
 *
 * @example
 * ```ts
 * const decision = evaluatePublishedRuntimeObservationV1(authority, {
 *   revision: "runtime-actual-observation-v1",
 *   sourceCaseDigest,
 *   kind: "scalar-bytes",
 *   bytes: Uint8Array.of(actualByte),
 * });
 * ```
 */
export function evaluatePublishedRuntimeObservationV1(
  authority: PublishedRuntimeEvaluationAuthorityV1,
  actual: unknown,
): OracleValidationResultV1<PublishedRuntimeEvaluationDecisionV1> {
  const state =
    typeof authority === "object" && authority !== null
      ? RUNTIME_EVALUATION_STATES.get(authority)
      : undefined;
  if (state === undefined || state.consumed) {
    return oracleFailure(
      "oracle.authority.missing",
      "/authority",
      "Runtime evaluation authority is invalid or consumed.",
    );
  }
  state.consumed = true;
  const parsed = actualRecord(actual);
  if (parsed === undefined) {
    return oracleFailure(
      "oracle.input.invalid",
      "/actual",
      "Runtime actual observation must use the exact version-one shape.",
    );
  }
  const observation = state.projection.observation;
  const identityMatches = parsed.sourceCaseDigest === state.projection.sourceCaseDigest;
  const shapeMatches =
    parsed.kind === observation.kind &&
    parsed.bytes.byteLength === observation.byteLength &&
    (parsed.kind === "scalar-bytes" ||
      (observation.kind === "direct-mmio" &&
        parsed.address === observation.address &&
        parsed.projectionRevision === observation.projectionRevision));
  const outcome =
    identityMatches && shapeMatches && equalBytes(parsed.bytes, state.expectedBytes)
      ? "match"
      : "semantic-mismatch";
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      revision: RUNTIME_EVALUATION_REVISION,
      outcome,
      evaluationIdentity: state.projection.evaluationIdentity,
    }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
