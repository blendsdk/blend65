import type { GenerationConfiguration } from "./canonical-identity.js";
import { isSha256Digest } from "./canonical-identity.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  snapshotOracleInput,
} from "./oracle-input.js";
import type { OracleValidationResultV1 } from "./oracle-evaluation-identity.js";
import {
  type OracleHandlerIdV1,
  type OracleRequestV1,
  type PublishedOracleContext,
  type PublishedOracleEvaluationResultV1,
} from "./oracle-model.js";
import { validateOracleBudget } from "./oracle-budget.js";
import { validateOracleMemoryFixture } from "./oracle-memory.js";
import { getOracleSuiteState } from "./oracle-suite.js";
import { getPublishedSnapshotAuthority } from "./publication-resolver.js";
import { digestPublicationBytes } from "./publication-model.js";
import { createModeledGeneratorSuite } from "./modeled-generator-suite.js";
import { evaluateOracleProgram } from "./oracle-evaluator.js";
import { resolveOracleRoute } from "./oracle-routing.js";
import { evaluateRuntimeStateCandidate } from "./oracle-runtime-state-candidate.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { MemoryFixtureV1, OracleBudgetV1, OracleObservableV1 } from "./oracle-model.js";
import type { GeneratedModeledCase } from "./modeled-generator-model.js";
import { isRuleModelId } from "./rule-model-registry.js";
import {
  preparePublishedCampaignCaseWithAuthority,
  selectPublishedRequestAuthority,
  type PublishedCampaignCaseAuthorityV1,
} from "./published-oracle-campaign.js";
import {
  evaluatePublishedOracleWithAuthority,
  isPublishedOracleHandlerId,
} from "./published-oracle-evaluation.js";
import type {
  CompletePublishedOracleAuthority,
  PublishedContextState,
} from "./published-oracle-state.js";

export type {
  PublishedCampaignCaseAuthorityV1,
  PublishedCampaignCaseIntentV1,
} from "./published-oracle-campaign.js";

/** Semantic-only input accepted by the published request factory. */
export interface PublishedOracleRequestIntentV1 {
  /** Request schema version. */
  readonly schemaVersion: 1;
  /** Selected raw oracle façade. */
  readonly handlerId: OracleHandlerIdV1;
  /** Reviewed rule generated for the request. */
  readonly ruleId: string;
  /** Deterministic campaign seed. */
  readonly seed: Sha256Digest;
  /** Complete bounded generation configuration. */
  readonly configuration: GenerationConfiguration;
  /** Zero-based generated-case ordinal. */
  readonly ordinal: number;
  /** Explicit initial memory. */
  readonly memory: MemoryFixtureV1;
  /** Explicit bounded evaluation budget. */
  readonly budget: OracleBudgetV1;
  /** Requested observable projection. */
  readonly observable: OracleObservableV1;
}

/** Result of authenticating one resolver snapshot as published oracle authority. */
export type PublishedOracleContextResult =
  | {
      readonly ok: true;
      readonly value: PublishedOracleContext;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: ReturnType<typeof oracleFailure>["diagnostics"];
    };

/** Authority facts needed to bind separately authenticated malformed diagnostic source. */
export interface PublishedOracleReductionAuthorityV1 {
  /** Exact selected publication whose diagnostic contract is retained. */
  readonly selectedReleaseDigest: Sha256Digest;
  /** Digest of the selected diagnostic manifest. */
  readonly diagnosticAuthorityDigest: Sha256Digest;
}

const CONTEXT_STATES = new WeakMap<object, PublishedContextState>();
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const INTENT_KEYS = [
  "schemaVersion",
  "handlerId",
  "ruleId",
  "seed",
  "configuration",
  "ordinal",
  "memory",
  "budget",
  "observable",
] as const;

/** Selected result and handler identity for one authenticated candidate runtime model. */
export interface PublishedCandidateRuntimeModelEvaluationV1 {
  readonly result: ReturnType<typeof evaluateOracleProgram>;
  readonly authorityIdentity: Sha256Digest;
}

/** Evaluates a previously authenticated candidate model through the selected runtime route. */
export function evaluatePublishedCandidateRuntimeModelV1(
  context: PublishedOracleContext,
  modeledCase: GeneratedModeledCase,
  configuration: GenerationConfiguration,
  memory: MemoryFixtureV1,
  budget: OracleBudgetV1,
): OracleValidationResultV1<PublishedCandidateRuntimeModelEvaluationV1> {
  const state =
    typeof context === "object" && context !== null ? CONTEXT_STATES.get(context) : undefined;
  const projection = modeledCase.projection;
  const entry = projection.kind === "valid" ? projection.module.functions[0] : undefined;
  if (state === undefined || projection.kind !== "valid" || entry === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/candidate",
      "Candidate runtime evaluation requires selected valid-model authority.",
    );
  }
  const selected = selectPublishedRequestAuthority(state, modeledCase.primaryRuleId, configuration);
  if ("ok" in selected) return selected;
  const binding = state.candidates.get("oracle.runtime-state");
  const route = resolveOracleRoute(selected.suite, {
    handlerId: "oracle.runtime-state",
    ruleId: modeledCase.primaryRuleId,
    observable: Object.freeze({ kind: "value-state" as const }),
    projectionKind: "valid",
  });
  if (
    binding === undefined ||
    binding.binding.implementation !== evaluateRuntimeStateCandidate ||
    !route.ok ||
    route.outcome !== "routed"
  ) {
    return oracleFailure(
      "oracle.authority.stale",
      "/candidate",
      "Selected runtime evaluator cannot authorize this candidate model.",
    );
  }
  const result = evaluateOracleProgram({
    schemaVersion: 1,
    module: projection.module,
    entryFunction: entry.name,
    parameterBindings: modeledCase.parameterBindings,
    memory,
    budget,
  });
  const authorityIdentity = digestPublicationBytes(
    new TextEncoder().encode(
      JSON.stringify({
        domain: "blend65-published-candidate-runtime-authority-v1",
        selectedReleaseDigest: state.authority.publicationDigest,
        generator: selected.generator.binding.implementationRevision,
        boundary: selected.boundary.binding.implementationRevision,
        evaluator: binding.binding.implementationRevision,
        ruleId: modeledCase.primaryRuleId,
      }),
    ),
  );
  return Object.freeze({
    ok: true,
    value: Object.freeze({ result, authorityIdentity }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Returns the minimal diagnostic authority retained by a genuine published context.
 *
 * This package-internal operation deliberately returns no handlers or resolver state. It lets
 * malformed-source authority bind the selected diagnostic contract without allowing callers to
 * manufacture a context from passive digest fields.
 *
 * @param context Candidate published context.
 * @returns Selected diagnostic facts, or `undefined` for a plain or copied value.
 */
export function getPublishedOracleReductionAuthorityV1(
  context: PublishedOracleContext,
): PublishedOracleReductionAuthorityV1 | undefined {
  const state =
    typeof context === "object" && context !== null ? CONTEXT_STATES.get(context) : undefined;
  if (state === undefined) return undefined;
  return Object.freeze({
    selectedReleaseDigest: state.authority.publicationDigest,
    diagnosticAuthorityDigest: digestPublicationBytes(state.authority.diagnosticManifestBytes),
  });
}

/**
 * Authenticates one nine-binding resolver snapshot for published oracle invocation.
 *
 * @param snapshot Genuine resolver-created staged or selected snapshot.
 * @returns Opaque context retaining no caller-supplied authority.
 *
 * @example
 * ```ts
 * const context = createPublishedOracleContext(snapshot);
 * ```
 */
export function createPublishedOracleContext(snapshot: unknown): PublishedOracleContextResult {
  const authority = getPublishedSnapshotAuthority(snapshot as never);
  if (
    authority === undefined ||
    authority.bindingRows.length !== 9 ||
    new Set(authority.bindingRows.map(({ handlerId: id }) => id)).size !== 9 ||
    authority.seedContractBytes === undefined ||
    authority.diagnosticManifestBytes === undefined ||
    authority.bindingRejectionBytes === undefined ||
    authority.renderer === undefined ||
    authority.candidateAuthorityBytes === undefined ||
    authority.rendererAuthorityBytes === undefined ||
    authority.publicationImplementationAuthority === undefined
  ) {
    return oracleFailure(
      "oracle.authority.missing",
      "/snapshot",
      "Published oracle context requires one genuine nine-binding snapshot.",
    );
  }
  const ruleModelBytes = authority.memberBytes.get("rule-models-v1.json");
  const ruleModelReviewBytes = authority.memberBytes.get("rule-models-v1-review.json");
  if (ruleModelBytes === undefined || ruleModelReviewBytes === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/snapshot",
      "Published rule-model authority is incomplete.",
    );
  }
  const modeled = createModeledGeneratorSuite({
    inventory: authority.inventory,
    seedContractBytes: authority.seedContractBytes,
    ruleModelBytes,
    reviewEvidenceBytes: ruleModelReviewBytes,
  });
  if (!modeled.ok) {
    return oracleFailure(
      "oracle.authority.not-accepted",
      "/snapshot",
      modeled.diagnostics[0]?.message ?? "Published rule-model authority could not be loaded.",
    );
  }
  const candidates = new Map(
    authority.candidates.map((candidate) => [candidate.binding.handlerId, candidate]),
  );
  const context = Object.freeze({
    selectedReleaseDigest: authority.publicationDigest,
  }) as PublishedOracleContext;
  CONTEXT_STATES.set(
    context,
    Object.freeze({
      authority: authority as CompletePublishedOracleAuthority,
      modeledSuite: modeled.suite,
      ruleModelDigest: modeled.ruleModelDigest,
      candidates,
    }),
  );
  return Object.freeze({ ok: true, value: context, diagnostics: EMPTY_DIAGNOSTICS });
}

/**
 * Prepares one publication-bound campaign case without exposing its hidden callables publicly.
 *
 * This source-module seam is shared by published request construction and diagnostic joining. It
 * is intentionally absent from package export maps, so a restart consumer receives only the
 * narrower diagnostic capability minted by the published façade.
 */
export function preparePublishedCampaignCaseV1(
  context: PublishedOracleContext,
  intent: unknown,
): OracleValidationResultV1<PublishedCampaignCaseAuthorityV1> {
  const state =
    typeof context === "object" && context !== null ? CONTEXT_STATES.get(context) : undefined;
  if (state === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/context",
      "Published oracle context is not authentic.",
    );
  }
  return preparePublishedCampaignCaseWithAuthority(state, intent);
}

/**
 * Constructs one replay-complete raw oracle request from semantic intent.
 *
 * @param context Opaque published authority.
 * @param intent Hostile semantic-only request intent.
 * @returns Serializable replay request without evaluation evidence.
 *
 * @example
 * ```ts
 * const request = createPublishedOracleRequest(context, intent);
 * ```
 */
export function createPublishedOracleRequest(
  context: PublishedOracleContext,
  intent: unknown,
): OracleValidationResultV1<OracleRequestV1> {
  const state =
    typeof context === "object" && context !== null ? CONTEXT_STATES.get(context) : undefined;
  if (state === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/context",
      "Published oracle context is not authentic.",
    );
  }
  const snapshot = snapshotOracleInput(intent, "/intent");
  if (
    !snapshot.ok ||
    !isOracleRecord(snapshot.value) ||
    !hasExactOracleKeys(snapshot.value, INTENT_KEYS)
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "/intent",
      "Published oracle intent must use the exact semantic-only shape.",
    );
  }
  const value = snapshot.value;
  if (
    value.schemaVersion !== 1 ||
    !isPublishedOracleHandlerId(value.handlerId) ||
    !isRuleModelId(value.ruleId) ||
    !isSha256Digest(value.seed) ||
    typeof value.ordinal !== "number" ||
    !Number.isSafeInteger(value.ordinal) ||
    value.ordinal < 0
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "/intent",
      "Published oracle intent contains invalid scalar fields.",
    );
  }
  const memory = validateOracleMemoryFixture(value.memory);
  if (!memory.ok) return memory;
  const budget = validateOracleBudget(value.budget);
  if (!budget.ok) return budget;
  if (
    !isOracleRecord(value.observable) ||
    !hasExactOracleKeys(value.observable, ["kind"]) ||
    (value.observable.kind !== "diagnostic" && value.observable.kind !== "value-state")
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "/intent/observable",
      "Observable must use the exact supported shape.",
    );
  }
  const preparedCase = preparePublishedCampaignCaseV1(context, {
    schemaVersion: 1,
    ruleId: value.ruleId,
    seed: value.seed,
    configuration: value.configuration,
    ordinal: value.ordinal,
  });
  if (!preparedCase.ok) return preparedCase;
  const projection = preparedCase.value.generatedCase.modeledCase.projection;
  const module = projection.kind === "valid" ? projection.module : projection.baseline;
  const entryFunction = module.functions[0]?.name;
  if (entryFunction === undefined) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/intent/ordinal",
      "Generated case has no entry function.",
    );
  }
  const request: OracleRequestV1 = Object.freeze({
    schemaVersion: 1,
    handlerId: value.handlerId,
    ruleId: value.ruleId,
    sourceProvenance: Object.freeze({
      schemaVersion: 1,
      campaign: preparedCase.value.campaignIdentity,
      campaignDigest: preparedCase.value.campaign.summary.campaignDigest,
      caseIdentity: preparedCase.value.generatedCase.identity,
      configuration: preparedCase.value.configuration,
    }),
    case: preparedCase.value.generatedCase.modeledCase,
    entryFunction,
    memory: memory.memory,
    budget: budget.budget,
    observable: Object.freeze({ kind: value.observable.kind }),
  });
  return Object.freeze({ ok: true, value: request, diagnostics: EMPTY_DIAGNOSTICS });
}

/** Semantic intent whose oracle handler is selected from private publication state. */
export type PublishedDiagnosticOracleIntentV1 = Omit<PublishedOracleRequestIntentV1, "handlerId">;

/**
 * Constructs a diagnostic replay request using the selected rule's private oracle route.
 *
 * This package-internal seam prevents callers from choosing a diagnostic handler while retaining
 * the ordinary published request validator as the single request-construction boundary.
 *
 * @param context Opaque selected publication authority.
 * @param intent Diagnostic semantics without a caller-selected handler.
 * @returns Replay-complete request or a closed authority/route failure.
 *
 * @example
 * ```ts
 * const request = createPublishedDiagnosticOracleRequest(context, intent);
 * ```
 */
export function createPublishedDiagnosticOracleRequest(
  context: PublishedOracleContext,
  intent: PublishedDiagnosticOracleIntentV1,
): OracleValidationResultV1<OracleRequestV1> {
  const state =
    typeof context === "object" && context !== null ? CONTEXT_STATES.get(context) : undefined;
  if (state === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/context",
      "Published oracle context is not authentic.",
    );
  }
  const selected = selectPublishedRequestAuthority(state, intent.ruleId, intent.configuration);
  if ("ok" in selected) return selected;
  const route = getOracleSuiteState(selected.suite)?.routesByRuleId.get(intent.ruleId);
  if (route === undefined) {
    return oracleFailure(
      "oracle.route.invalid",
      "/intent/ruleId",
      "Selected rule has no published diagnostic route.",
    );
  }
  return createPublishedOracleRequest(context, { ...intent, handlerId: route });
}

/**
 * Evaluates one raw request and emits evidence bound to the context's exact snapshot.
 *
 * @param context Opaque published authority.
 * @param request Hostile raw request.
 * @returns Revision-complete evidence or a closed failure with no partial identities.
 *
 * @example
 * ```ts
 * const evidence = evaluatePublishedOracle(context, request);
 * ```
 */
export function evaluatePublishedOracle(
  context: PublishedOracleContext,
  request: unknown,
): PublishedOracleEvaluationResultV1 {
  const state =
    typeof context === "object" && context !== null ? CONTEXT_STATES.get(context) : undefined;
  if (state === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/context",
      "Published oracle context is not authentic.",
    );
  }
  return evaluatePublishedOracleWithAuthority(state, request);
}
