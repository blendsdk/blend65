import type { FreshCandidateRegistration } from "./binding-model.js";
import type { CampaignDependenciesV1 } from "./campaign-model.js";
import { createCampaignPlan } from "./campaign.js";
import { deriveConfigurationIdentity, type CampaignIdentityInput } from "./case-identity.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  snapshotOracleInput,
} from "./oracle-input.js";
import { deriveOracleSourceContentIdentity } from "./oracle-content-identity.js";
import {
  deriveOracleEvaluationIdentity,
  deriveOracleInitialMemoryIdentity,
  type OracleEvaluationParticipantV1,
  type OracleValidationResultV1,
} from "./oracle-evaluation-identity.js";
import {
  type OracleHandlerIdV1,
  type OracleRequestV1,
  type OracleResultV1,
  type OracleSuite,
  type PublishedOracleContext,
  type PublishedOracleEvaluationResultV1,
} from "./oracle-model.js";
import { validateOracleBudget } from "./oracle-budget.js";
import { validateOracleMemoryFixture } from "./oracle-memory.js";
import { prepareOracleRequest } from "./oracle-request.js";
import { createOracleSuite, getOracleSuiteState } from "./oracle-suite.js";
import {
  getPublishedSnapshotAuthority,
  type PublishedSnapshotAuthority,
} from "./publication-resolver.js";
import { digestPublicationBytes } from "./publication-model.js";
import { createRevisionRegistry, type RevisionEntry } from "./revision-registry.js";
import { createModeledGeneratorSuite, getRuleGenerationDomain } from "./modeled-generator-suite.js";
import type { ModeledGeneratorSuite } from "./modeled-generator-model.js";
import { generateCampaignCase } from "./generate-case.js";
import type { GenerationConfiguration } from "./canonical-identity.js";
import { isSha256Digest, normalizeGenerationConfiguration } from "./canonical-identity.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { MemoryFixtureV1, OracleBudgetV1, OracleObservableV1 } from "./oracle-model.js";
import { isRuleModelId } from "./rule-model-registry.js";

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

type CompletePublishedOracleAuthority = Omit<
  PublishedSnapshotAuthority,
  | "seedContractBytes"
  | "diagnosticManifestBytes"
  | "bindingRejectionBytes"
  | "renderer"
  | "candidateAuthorityBytes"
  | "rendererAuthorityBytes"
  | "publicationImplementationAuthority"
> & {
  readonly seedContractBytes: Uint8Array;
  readonly diagnosticManifestBytes: Uint8Array;
  readonly bindingRejectionBytes: Uint8Array;
  readonly renderer: NonNullable<PublishedSnapshotAuthority["renderer"]>;
  readonly candidateAuthorityBytes: ReadonlyMap<string, Uint8Array>;
  readonly rendererAuthorityBytes: ReadonlyMap<string, Uint8Array>;
  readonly publicationImplementationAuthority: NonNullable<
    PublishedSnapshotAuthority["publicationImplementationAuthority"]
  >;
};

interface PublishedContextState {
  readonly authority: CompletePublishedOracleAuthority;
  readonly modeledSuite: ModeledGeneratorSuite;
  readonly ruleModelDigest: Sha256Digest;
  readonly candidates: ReadonlyMap<string, FreshCandidateRegistration>;
}

interface RequestAuthority {
  readonly suite: OracleSuite;
  readonly configuration: GenerationConfiguration;
  readonly configurationDigest: Sha256Digest;
  readonly generator: FreshCandidateRegistration;
  readonly boundary: FreshCandidateRegistration;
  readonly authorityDigests: {
    readonly diagnosticManifest: Sha256Digest;
    readonly bindingRejections: Sha256Digest;
  };
}

const CONTEXT_STATES = new WeakMap<object, PublishedContextState>();
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const CAMPAIGN_SPEC_REVISION_V1 = "spec-v3.0";
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
const REQUEST_KEYS = [
  "schemaVersion",
  "handlerId",
  "ruleId",
  "sourceProvenance",
  "case",
  "entryFunction",
  "memory",
  "budget",
  "observable",
] as const;

function handlerId(value: unknown): value is OracleHandlerIdV1 {
  return (
    value === "oracle.frontend-result" ||
    value === "oracle.compiler-result" ||
    value === "oracle.emitted-program" ||
    value === "oracle.runtime-state"
  );
}

function requestAuthority(
  state: PublishedContextState,
  ruleId: string,
  configurationInput: unknown,
): RequestAuthority | ReturnType<typeof oracleFailure> {
  const normalized = normalizeGenerationConfiguration(configurationInput);
  if (!normalized.ok) {
    return oracleFailure(
      "oracle.input.invalid",
      `/configuration${normalized.problem.path}`,
      normalized.problem.message,
    );
  }
  const configuration = normalized.configuration;
  const configurationIdentity = deriveConfigurationIdentity(configuration);
  if (!configurationIdentity.ok) {
    return oracleFailure(
      "oracle.input.invalid",
      "/configuration",
      "Generation configuration identity could not be derived.",
    );
  }
  const domain = getRuleGenerationDomain(state.modeledSuite, ruleId);
  if (!domain.ok || domain.state !== "modeled") {
    return oracleFailure(
      "oracle.contract.invalid",
      "/ruleId",
      "Requested rule has no reviewed modeled source generator.",
    );
  }
  const generator = state.candidates.get(domain.handlerId);
  const boundary = state.candidates.get("transform.boundary-variants");
  if (generator === undefined || boundary === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/context",
      "Published generation participants are unavailable.",
    );
  }
  const inventoryBytes = state.authority.memberBytes.get("compiler-readiness-v1.json");
  if (inventoryBytes === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/context",
      "Inventory bytes are unavailable.",
    );
  }
  const inventoryDigest = digestPublicationBytes(inventoryBytes);
  const specRevision = CAMPAIGN_SPEC_REVISION_V1;
  const entries: RevisionEntry[] = [
    {
      component: "inventory",
      revision: inventoryDigest,
      value: Object.freeze({
        schemaVersion: 1,
        inventoryVersion: state.authority.inventory.inventoryVersion,
        inventoryDigest,
        specRevision,
      }),
    },
    {
      component: "rule-model",
      revision: state.ruleModelDigest,
      value: state.modeledSuite,
    },
    {
      component: "generator",
      revision: generator.binding.implementationRevision,
      value: generator,
    },
    {
      component: "boundary-transform",
      revision: boundary.binding.implementationRevision,
      value: boundary,
    },
    {
      component: "renderer",
      revision: state.authority.renderer.implementationRevision,
      value: state.authority.renderer,
    },
    {
      component: "configuration",
      revision: configurationIdentity.identity,
      value: configuration,
    },
  ];
  const registry = createRevisionRegistry(entries);
  if (!registry.ok) {
    return oracleFailure(
      "oracle.authority.not-accepted",
      "/context",
      registry.diagnostics[0]?.message ?? "Published replay registry could not be created.",
    );
  }
  const suite = createOracleSuite({
    modeledSuite: state.modeledSuite,
    replayRegistry: registry.registry,
    inventory: state.authority.inventory,
    diagnosticManifestBytes: state.authority.diagnosticManifestBytes,
    bindingRejectionBytes: state.authority.bindingRejectionBytes,
  });
  if (!suite.ok) return suite;
  return Object.freeze({
    suite: suite.suite,
    configuration,
    configurationDigest: configurationIdentity.identity,
    generator,
    boundary,
    authorityDigests: suite.authorityDigests,
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
    !handlerId(value.handlerId) ||
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
  const selected = requestAuthority(state, value.ruleId, value.configuration);
  if ("ok" in selected) return selected;
  if (!selected.configuration.enabledRuleIds.includes(value.ruleId)) {
    return oracleFailure(
      "oracle.input.invalid",
      "/intent/ruleId",
      "Requested rule is not enabled by the generation configuration.",
    );
  }
  if (value.ordinal >= selected.configuration.caseCount) {
    return oracleFailure(
      "oracle.input.invalid",
      "/intent/ordinal",
      "Requested ordinal exceeds the configured campaign.",
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
  const inventoryBytes = state.authority.memberBytes.get("compiler-readiness-v1.json");
  if (inventoryBytes === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/context",
      "Inventory bytes are unavailable.",
    );
  }
  const dependencies: CampaignDependenciesV1 = {
    inventory: {
      schemaVersion: 1,
      inventoryVersion: state.authority.inventory.inventoryVersion,
      inventoryDigest: digestPublicationBytes(inventoryBytes),
      specRevision: CAMPAIGN_SPEC_REVISION_V1,
    },
    ruleModel: {
      schemaVersion: 1,
      ruleModelVersion: "rule-model-v1",
      ruleModelDigest: state.ruleModelDigest,
      suite: state.modeledSuite,
    },
    generator: selected.generator,
    boundaryTransform: selected.boundary,
    renderer: state.authority.renderer,
  };
  const campaign: CampaignIdentityInput = Object.freeze({
    inventorySchemaVersion: 1,
    inventoryVersion: dependencies.inventory.inventoryVersion,
    inventoryDigest: dependencies.inventory.inventoryDigest,
    specRevision: dependencies.inventory.specRevision,
    ruleModelVersion: dependencies.ruleModel.ruleModelVersion,
    ruleModelDigest: dependencies.ruleModel.ruleModelDigest,
    generator: Object.freeze({
      handlerId: selected.generator.binding.handlerId,
      contractVersion: selected.generator.binding.contractVersion,
      implementationRevision: selected.generator.binding.implementationRevision,
    }),
    boundaryTransform: Object.freeze({
      handlerId: selected.boundary.binding.handlerId,
      contractVersion: selected.boundary.binding.contractVersion,
      implementationRevision: selected.boundary.binding.implementationRevision,
    }),
    rendererRevision: state.authority.renderer.implementationRevision,
    target: "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: value.seed,
    configurationDigest: selected.configurationDigest,
  });
  const prepared = createCampaignPlan({
    campaign,
    configuration: selected.configuration,
    dependencies,
  });
  if (!prepared.ok) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/intent/configuration",
      prepared.diagnostics[0]?.message ?? "Published campaign could not be prepared.",
    );
  }
  const generated = generateCampaignCase(prepared.value, value.ordinal);
  if (!generated.ok) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/intent/ordinal",
      generated.diagnostics[0]?.message ?? "Published case could not be generated.",
    );
  }
  if (generated.value.modeledCase.primaryRuleId !== value.ruleId) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/intent/ordinal",
      "Generated case does not match the requested primary rule.",
    );
  }
  const projection = generated.value.modeledCase.projection;
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
      campaign,
      campaignDigest: prepared.value.summary.campaignDigest,
      caseIdentity: generated.value.identity,
      configuration: selected.configuration,
    }),
    case: generated.value.modeledCase,
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
  const selected = requestAuthority(state, intent.ruleId, intent.configuration);
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
  const snapshot = snapshotOracleInput(request);
  if (
    !snapshot.ok ||
    !isOracleRecord(snapshot.value) ||
    !hasExactOracleKeys(snapshot.value, REQUEST_KEYS) ||
    !handlerId(snapshot.value.handlerId) ||
    !isRuleModelId(snapshot.value.ruleId) ||
    !isOracleRecord(snapshot.value.sourceProvenance)
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Published oracle request must use the exact raw request shape.",
    );
  }
  const provenance = snapshot.value.sourceProvenance;
  const selected = requestAuthority(state, snapshot.value.ruleId, provenance.configuration);
  if ("ok" in selected) return selected;
  const campaign = provenance.campaign;
  if (
    !isOracleRecord(campaign) ||
    !isOracleRecord(campaign.generator) ||
    !isOracleRecord(campaign.boundaryTransform) ||
    campaign.generator.handlerId !== selected.generator.binding.handlerId ||
    campaign.generator.implementationRevision !==
      selected.generator.binding.implementationRevision ||
    campaign.boundaryTransform.handlerId !== selected.boundary.binding.handlerId ||
    campaign.boundaryTransform.implementationRevision !==
      selected.boundary.binding.implementationRevision ||
    campaign.rendererRevision !== state.authority.renderer.implementationRevision
  ) {
    return oracleFailure(
      "oracle.authority.stale",
      "/sourceProvenance/campaign",
      "Request provenance does not match selected published participants.",
    );
  }
  const binding = state.candidates.get(snapshot.value.handlerId);
  if (binding === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/handlerId",
      "Selected oracle handler is unavailable.",
    );
  }
  const evaluate = binding.binding.implementation as unknown as (
    suite: OracleSuite,
    value: unknown,
  ) => OracleResultV1;
  const result = evaluate(selected.suite, snapshot.value);
  if (!result.ok) {
    return Object.freeze({
      ok: false,
      diagnostics: result.diagnostics,
    });
  }
  const prepared = prepareOracleRequest(selected.suite, snapshot.value.handlerId, snapshot.value);
  if ("ok" in prepared) {
    if (!prepared.ok) {
      return Object.freeze({
        ok: false,
        diagnostics: prepared.diagnostics,
      });
    }
    return oracleFailure(
      "oracle.contract.invalid",
      "",
      "Published request preparation returned an unexpected terminal result.",
    );
  }
  const sourceIdentity = deriveOracleSourceContentIdentity(prepared.generatedCase.sourceBytes);
  if (!sourceIdentity.ok) return sourceIdentity;
  const memoryIdentity = deriveOracleInitialMemoryIdentity(prepared.request.memory);
  if (!memoryIdentity.ok) return memoryIdentity;
  const participants: OracleEvaluationParticipantV1[] = [
    selected.generator.binding,
    selected.boundary.binding,
    binding.binding,
  ].map(({ handlerId: id, contractVersion, implementationRevision }) =>
    Object.freeze({ handlerId: id, contractVersion, implementationRevision }),
  );
  const evaluationIdentity = deriveOracleEvaluationIdentity({
    schemaVersion: 1,
    sourceProvenance: prepared.request.sourceProvenance,
    sourceContentIdentity: sourceIdentity.identity,
    entryFunction: prepared.request.entryFunction,
    initialMemoryIdentity: memoryIdentity.identity,
    diagnosticManifestDigest: selected.authorityDigests.diagnosticManifest,
    bindingRejectionDigest: selected.authorityDigests.bindingRejections,
    budget: prepared.request.budget,
    policyRevision: "oracle-policy-v1",
    observableProjectionId: `oracle.${prepared.request.observable.kind}`,
    participants,
  });
  if (!evaluationIdentity.ok) return evaluationIdentity;
  return Object.freeze({
    ok: true,
    result,
    evaluationIdentity: evaluationIdentity.identity,
    sourceProvenance: prepared.request.sourceProvenance,
    contentIdentities: Object.freeze({ source: sourceIdentity.identity }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
