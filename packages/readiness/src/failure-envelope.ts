import { isDeepStrictEqual } from "node:util";

import { copyUint8Array, isSha256Digest, uint8ArrayByteLength } from "./canonical-identity.js";
import { getPreparedCampaignState } from "./campaign-state.js";
import { getExecutionCaseEvaluationInputV1, type ExecutionCaseV1 } from "./execution-case.js";
import {
  decodeFailureEnvelopeCanonicalV1,
  encodeFailureEnvelopeCanonicalV1,
  failureEnvelopeDigestV1,
} from "./failure-envelope-codec.js";
import {
  normalizeFailureEnvelopeToolsV1,
  validateFailureEnvelopeIdentityV1,
} from "./failure-envelope-identity.js";
import { createFailureClaimWitnessesV1 } from "./failure-claim-witness.js";
import { reconstructFailureEnvelopeV1 } from "./failure-envelope-history.js";
import {
  AUTHORIZED_FAILURE_ENVELOPE_V1,
  FAILURE_ENVELOPE_MAX_BYTES_V1,
  FAILURE_HISTORICAL_AUTHORITY_AGGREGATE_MAX_BYTES_V1,
  FAILURE_HISTORICAL_AUTHORITY_RESOLVER_V1,
} from "./failure-envelope-model.js";
import {
  createFailureHistoricalRecordsV1,
  createTypedCampaignHistoricalFactsV1,
} from "./failure-envelope-records.js";
import { deriveFailurePredicateIdentityV1 } from "./failure-identity.js";
import {
  getMalformedDiagnosticCaseProjectionV1,
  type MalformedDiagnosticCaseV1,
} from "./malformed-diagnostic-case.js";
import {
  getPublishedDiagnosticCaseReductionInputV1,
  type PublishedDiagnosticCaseV1,
} from "./published-diagnostic-case.js";
import { renderSourceModule } from "./source-renderer.js";
import {
  compareExecutionText,
  readExecutionArray,
  readExecutionRecord,
} from "./execution-validation.js";
import { parseFailureReductionPolicyV1 } from "./failure-contracts.js";

import type {
  ExecutionIssueV1,
  ExecutionOperationIssueCodeV1,
  ExecutionOperationResultV1,
} from "./execution-contracts.js";
import type {
  AuthorizedFailureEnvelopeV1,
  FailureEnvelopeInitialCandidateV1,
  FailureEnvelopeResolutionV1,
  FailureEnvelopeV1,
  FailureHistoricalAuthorityRecordV1,
  FailureHistoricalAuthorityResolverV1,
  FailureReplayAuthorityV1,
} from "./failure-envelope-model.js";
import type { HistoricalAuthorityFactV1 } from "./failure-envelope-records.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { ReplayEnvelopeV1 } from "./replay-input-model.js";

export {
  AUTHORIZED_FAILURE_ENVELOPE_V1,
  FAILURE_ENVELOPE_MAX_BYTES_V1,
  FAILURE_HISTORICAL_AUTHORITY_AGGREGATE_MAX_BYTES_V1,
  FAILURE_HISTORICAL_AUTHORITY_RESOLVER_V1,
} from "./failure-envelope-model.js";
export type {
  AuthorizedFailureEnvelopeV1,
  FailureClaimWitnessV1,
  FailureEnvelopeAuthorizationInputV1,
  FailureEnvelopeInitialCandidateV1,
  FailureEnvelopeResolutionV1,
  FailureEnvelopeSourceAuthorityV1,
  FailureEnvelopeV1,
  FailureHistoricalAuthorityRecordV1,
  FailureHistoricalAuthorityResolverV1,
  FailureReplayAuthorityV1,
  FailureToolIdentityV1,
} from "./failure-envelope-model.js";

interface AuthorizedFailureEnvelopeState {
  readonly projection: FailureEnvelopeV1;
  readonly records: readonly FailureHistoricalAuthorityRecordV1[];
}

const AUTHORIZATION_KEYS = [
  "revision",
  "source",
  "routePlanBytes",
  "routePlanDigest",
  "predicate",
  "policy",
  "observationBytes",
  "toolVersions",
] as const;
const SOURCE_KEYS = ["kind", "authority"] as const;
const RECORD_KEYS = ["revision", "kind", "contentRevision", "bytes", "digest"] as const;
const ENVELOPE_STATES = new WeakMap<object, AuthorizedFailureEnvelopeState>();
const RESOLVER_STATES = new WeakMap<
  object,
  ReadonlyMap<Sha256Digest, FailureHistoricalAuthorityRecordV1>
>();

function issue<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  const issues: readonly [ExecutionIssueV1] = [Object.freeze({ code, path, message })];
  return Object.freeze({ ok: false, issues });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

const digest = failureEnvelopeDigestV1;
const encodeCanonical = encodeFailureEnvelopeCanonicalV1;
const decodeCanonical = decodeFailureEnvelopeCanonicalV1;

function replayEnvelope(
  campaign: ExecutionCaseV1 | PublishedDiagnosticCaseV1,
): ReplayEnvelopeV1 | undefined {
  const valid = getExecutionCaseEvaluationInputV1(campaign as ExecutionCaseV1);
  const invalid =
    valid === undefined
      ? getPublishedDiagnosticCaseReductionInputV1(campaign as PublishedDiagnosticCaseV1)
      : undefined;
  const prepared = valid?.campaign ?? invalid?.campaign;
  const generated = valid?.generatedCase ?? invalid?.generatedCase;
  const state = prepared === undefined ? undefined : getPreparedCampaignState(prepared);
  if (state === undefined || generated === undefined) return undefined;
  return Object.freeze({
    schemaVersion: 1,
    campaign: state.campaign,
    campaignDigest: state.campaignDigest,
    caseIdentity: generated.identity,
    configuration: state.configuration,
  });
}

function sourceAuthority(input: unknown):
  | {
      readonly family: FailureEnvelopeV1["family"];
      readonly replay: FailureReplayAuthorityV1;
      readonly candidate: FailureEnvelopeInitialCandidateV1;
      readonly historicalFacts: readonly HistoricalAuthorityFactV1[];
    }
  | undefined {
  const source = readExecutionRecord(input, SOURCE_KEYS);
  if (source === undefined) return undefined;
  if (source.kind === "typed-valid") {
    const execution = getExecutionCaseEvaluationInputV1(source.authority as ExecutionCaseV1);
    const replay = replayEnvelope(source.authority as ExecutionCaseV1);
    const modeledCase = execution?.generatedCase.modeledCase;
    if (
      execution === undefined ||
      replay === undefined ||
      modeledCase === undefined ||
      modeledCase.projection.kind !== "valid"
    ) {
      return undefined;
    }
    const generated = execution.generatedCase;
    const modeled = modeledCase;
    const projection = modeledCase.projection;
    const rendered = renderSourceModule(projection.module, {
      maxSourceBytes: 1_048_576,
      literalSpellings: [],
    });
    if (!rendered.ok) return undefined;
    const claims = Object.freeze([...modeled.claimedRuleIds].sort(compareExecutionText));
    const claimWitnesses = createFailureClaimWitnessesV1(projection.module, claims, "module");
    if (claimWitnesses === undefined) return undefined;
    return {
      family: "typed-valid",
      replay: Object.freeze({
        kind: "typed-campaign",
        envelope: replay,
        generatedProjection: projection,
        sourceBytes: generated.sourceBytes.slice(),
      }),
      candidate: Object.freeze({
        revision: "reduction-candidate-draft-v1",
        kind: "typed-valid",
        sourceBytes: rendered.sourceBytes.slice(),
        module: projection.module,
        parameterBindings: generated.effectiveParameterBindings,
        primaryRuleId: modeled.primaryRuleId,
        claimedRuleIds: claims,
        claimWitnesses,
      }),
      historicalFacts: createTypedCampaignHistoricalFactsV1(replay),
    };
  }
  if (source.kind === "typed-invalid") {
    const diagnostic = getPublishedDiagnosticCaseReductionInputV1(
      source.authority as PublishedDiagnosticCaseV1,
    );
    const replay = replayEnvelope(source.authority as PublishedDiagnosticCaseV1);
    const modeledCase = diagnostic?.generatedCase.modeledCase;
    if (
      diagnostic === undefined ||
      replay === undefined ||
      modeledCase === undefined ||
      modeledCase.projection.kind !== "invalid" ||
      modeledCase.validity.kind !== "invalid"
    ) {
      return undefined;
    }
    const generated = diagnostic.generatedCase;
    const modeled = modeledCase;
    const projection = modeledCase.projection;
    const validity = modeledCase.validity;
    const claims = Object.freeze([...modeled.claimedRuleIds].sort(compareExecutionText));
    const claimWitnesses = createFailureClaimWitnessesV1(projection.baseline, claims, "baseline");
    if (claimWitnesses === undefined) return undefined;
    return {
      family: "typed-invalid",
      replay: Object.freeze({
        kind: "typed-campaign",
        envelope: replay,
        generatedProjection: projection,
        sourceBytes: generated.sourceBytes.slice(),
      }),
      candidate: Object.freeze({
        revision: "reduction-candidate-draft-v1",
        kind: "typed-invalid",
        sourceBytes: generated.sourceBytes.slice(),
        baseline: projection.baseline,
        transform: projection.transform,
        parameterBindings: generated.effectiveParameterBindings,
        primaryRuleId: modeled.primaryRuleId,
        claimedRuleIds: claims,
        claimWitnesses,
        neighborId: validity.neighborId,
        violatedPredicateId: validity.violatedPredicateId,
        diagnosticFamily: validity.expectedDiagnosticFamily,
      }),
      historicalFacts: Object.freeze([
        ...createTypedCampaignHistoricalFactsV1(replay),
        Object.freeze({
          kind: "diagnostic" as const,
          contentRevision: diagnostic.projection.authority.evaluationIdentity,
          value: diagnostic.projection,
        }),
        Object.freeze({
          kind: "execution-publication" as const,
          contentRevision: diagnostic.projection.authority.selectedReleaseDigest,
          value: diagnostic.projection.authority,
        }),
      ]),
    };
  }
  if (source.kind === "raw-malformed") {
    const malformed = getMalformedDiagnosticCaseProjectionV1(
      source.authority as MalformedDiagnosticCaseV1,
    );
    if (!malformed.ok) return undefined;
    return {
      family: "raw-malformed",
      replay: Object.freeze({ kind: "raw-malformed", envelope: malformed.value }),
      candidate: Object.freeze({
        revision: "reduction-candidate-draft-v1",
        kind: "raw-malformed",
        sourceBytes: malformed.value.sourceBytes.slice(),
        tokens: malformed.value.provenance.tokens,
      }),
      historicalFacts: Object.freeze([
        Object.freeze({
          kind: "diagnostic" as const,
          contentRevision: malformed.value.diagnosticAuthorityDigest,
          value: malformed.value,
        }),
        Object.freeze({
          kind: "execution-publication" as const,
          contentRevision: malformed.value.selectedReleaseDigest,
          value: Object.freeze({
            selectedReleaseDigest: malformed.value.selectedReleaseDigest,
            diagnosticAuthorityDigest: malformed.value.diagnosticAuthorityDigest,
          }),
        }),
      ]),
    };
  }
  return undefined;
}

function createAuthority(
  projection: FailureEnvelopeV1,
  records: readonly FailureHistoricalAuthorityRecordV1[],
): AuthorizedFailureEnvelopeV1 {
  const authority: AuthorizedFailureEnvelopeV1 = Object.freeze({
    [AUTHORIZED_FAILURE_ENVELOPE_V1]: true as const,
  });
  ENVELOPE_STATES.set(authority, Object.freeze({ projection, records }));
  return authority;
}

/**
 * Authorizes a complete failure envelope from one genuine source capability.
 *
 * @param input Closed route, predicate, policy and genuine source authority.
 * @returns Opaque canonical envelope or one deterministic issue.
 */
export function authorizeFailureEnvelopeV1(
  input: unknown,
): ExecutionOperationResultV1<AuthorizedFailureEnvelopeV1> {
  const record = readExecutionRecord(input, AUTHORIZATION_KEYS);
  if (record === undefined || record.revision !== "failure-envelope-authorization-input-v1") {
    return issue(
      "execution.invalid-schema",
      "/envelope",
      "Envelope input must use the exact version-one shape.",
    );
  }
  const source = sourceAuthority(record.source);
  if (source === undefined) {
    return issue(
      "unbound-capability",
      "/envelope/source",
      "Envelope source authority is not genuine.",
    );
  }
  const routePlanByteLength = uint8ArrayByteLength(record.routePlanBytes);
  const observationByteLength = uint8ArrayByteLength(record.observationBytes);
  const routePlanBytes =
    routePlanByteLength !== undefined && routePlanByteLength <= FAILURE_ENVELOPE_MAX_BYTES_V1
      ? copyUint8Array(record.routePlanBytes)
      : undefined;
  const observationBytes =
    observationByteLength !== undefined && observationByteLength <= FAILURE_ENVELOPE_MAX_BYTES_V1
      ? copyUint8Array(record.observationBytes)
      : undefined;
  const predicate = deriveFailurePredicateIdentityV1(record.predicate);
  const policy = parseFailureReductionPolicyV1(record.policy);
  const tools = normalizeFailureEnvelopeToolsV1(record.toolVersions);
  if (
    routePlanBytes === undefined ||
    routePlanBytes.byteLength === 0 ||
    !isSha256Digest(record.routePlanDigest) ||
    digest(routePlanBytes) !== record.routePlanDigest ||
    observationBytes === undefined ||
    !predicate.ok ||
    !policy.ok ||
    tools === undefined
  ) {
    return issue(
      "execution.invalid-schema",
      "/envelope",
      "Envelope fields are incomplete or inconsistent.",
    );
  }
  const expectedRouteKind =
    source.family === "typed-valid" ? "valid-envelope" : "invalid-diagnostic";
  if (predicate.value.predicate.routeContract.originalRouteKind !== expectedRouteKind) {
    return issue(
      "invalid-evidence-input",
      "/envelope/predicate/routeContract",
      "Route kind does not match source authority.",
    );
  }
  const primaryRuleId =
    source.candidate.kind === "raw-malformed"
      ? source.replay.kind === "raw-malformed"
        ? source.replay.envelope.ruleId
        : undefined
      : source.candidate.primaryRuleId;
  let sourceClaimsMatch: boolean;
  if (source.candidate.kind === "raw-malformed") {
    sourceClaimsMatch =
      source.replay.kind === "raw-malformed" &&
      predicate.value.predicate.requiredClaimedRuleIds.length === 1 &&
      predicate.value.predicate.requiredClaimedRuleIds[0] === source.replay.envelope.ruleId;
  } else {
    const sourceClaimedRuleIds = source.candidate.claimedRuleIds;
    sourceClaimsMatch = predicate.value.predicate.requiredClaimedRuleIds.every((ruleId) =>
      sourceClaimedRuleIds.includes(ruleId),
    );
  }
  if (
    primaryRuleId === undefined ||
    predicate.value.predicate.primaryRuleId !== primaryRuleId ||
    !sourceClaimsMatch ||
    (predicate.value.predicate.observation.kind === "observed"
      ? predicate.value.predicate.observation.digest
      : predicate.value.predicate.observation.terminalReasonDigest) !== digest(observationBytes)
  ) {
    return issue(
      "invalid-evidence-input",
      "/envelope/predicate",
      "Predicate authority does not match source claims or observation bytes.",
    );
  }
  const toolDigests = tools.map((tool) => tool.digest).sort(compareExecutionText);
  if (
    !isDeepStrictEqual(toolDigests, predicate.value.predicate.routeContract.toolContractDigests)
  ) {
    return issue(
      "invalid-evidence-input",
      "/envelope/toolVersions",
      "Tool authority does not match the selected route contract.",
    );
  }
  const records = createFailureHistoricalRecordsV1(
    source,
    routePlanBytes,
    record.routePlanDigest,
    predicate.value.predicate,
    policy.value,
    observationBytes,
    tools,
  );
  const authorityDigests = Object.freeze(
    records.map((entry) => entry.digest).sort(compareExecutionText),
  );
  const withoutDigest = {
    revision: "failure-envelope-v1" as const,
    family: source.family,
    replay: source.replay,
    routePlanBytes,
    routePlanDigest: record.routePlanDigest,
    predicate: predicate.value.predicate,
    policy: policy.value,
    observationBytes,
    toolVersions: tools,
    initialCandidate: source.candidate,
    authorityDigests,
  };
  const projection = Object.freeze({
    ...withoutDigest,
    digest: digest(encodeCanonical(withoutDigest)),
  });
  return success(createAuthority(projection, records));
}

/** Returns a defensive passive projection for a genuine envelope. */
export function getFailureEnvelopeProjectionV1(
  envelope: AuthorizedFailureEnvelopeV1,
): ExecutionOperationResultV1<FailureEnvelopeV1> {
  const state =
    typeof envelope === "object" && envelope !== null ? ENVELOPE_STATES.get(envelope) : undefined;
  if (state === undefined)
    return issue("unbound-capability", "/envelope", "Failure envelope is not genuine.");
  return success(structuredClone(state.projection));
}

/** Returns defensive canonical records needed to resolve one envelope after restart. */
export function getFailureHistoricalAuthorityRecordsV1(
  envelope: AuthorizedFailureEnvelopeV1,
): ExecutionOperationResultV1<readonly FailureHistoricalAuthorityRecordV1[]> {
  const state =
    typeof envelope === "object" && envelope !== null ? ENVELOPE_STATES.get(envelope) : undefined;
  if (state === undefined)
    return issue("unbound-capability", "/envelope", "Failure envelope is not genuine.");
  return success(
    Object.freeze(
      state.records.map((entry) => Object.freeze({ ...entry, bytes: entry.bytes.slice() })),
    ),
  );
}

function normalizeHistoricalRecord(input: unknown): FailureHistoricalAuthorityRecordV1 | undefined {
  const record = readExecutionRecord(input, RECORD_KEYS);
  if (record === undefined || record.revision !== "failure-historical-authority-record-v1")
    return undefined;
  const byteLength = uint8ArrayByteLength(record.bytes);
  if (
    (record.kind !== "inventory" &&
      record.kind !== "rule-model" &&
      record.kind !== "campaign" &&
      record.kind !== "generator" &&
      record.kind !== "boundary-transform" &&
      record.kind !== "renderer" &&
      record.kind !== "oracle" &&
      record.kind !== "diagnostic" &&
      record.kind !== "execution-publication" &&
      record.kind !== "projection" &&
      record.kind !== "fixture" &&
      record.kind !== "platform" &&
      record.kind !== "tool") ||
    typeof record.contentRevision !== "string" ||
    record.contentRevision.length === 0 ||
    record.contentRevision.length > 256 ||
    !/^[\x21-\x7e]+$/u.test(record.contentRevision) ||
    byteLength === undefined ||
    byteLength > FAILURE_ENVELOPE_MAX_BYTES_V1 ||
    !isSha256Digest(record.digest)
  )
    return undefined;
  const bytes = copyUint8Array(record.bytes, byteLength);
  if (bytes === undefined) return undefined;
  if (digest(bytes) !== record.digest) return undefined;
  return Object.freeze({
    revision: "failure-historical-authority-record-v1",
    kind: record.kind,
    contentRevision: record.contentRevision,
    bytes,
    digest: record.digest,
  });
}

/** Creates an opaque no-fallback resolver from exact canonical historical records. */
export function createFailureHistoricalAuthorityResolverV1(
  input: unknown,
): ExecutionOperationResultV1<FailureHistoricalAuthorityResolverV1> {
  const values = readExecutionArray(input, 4_096);
  if (values === undefined)
    return issue(
      "execution.invalid-schema",
      "/resolver",
      "Resolver records must be a bounded dense array.",
    );
  const records = new Map<Sha256Digest, FailureHistoricalAuthorityRecordV1>();
  let aggregateBytes = 0;
  for (const value of values) {
    const record = normalizeHistoricalRecord(value);
    if (record === undefined) {
      const raw = readExecutionRecord(value, RECORD_KEYS);
      const rawByteLength = raw === undefined ? undefined : uint8ArrayByteLength(raw.bytes);
      const structurallyBounded =
        raw !== undefined &&
        rawByteLength !== undefined &&
        rawByteLength <= FAILURE_ENVELOPE_MAX_BYTES_V1;
      const code =
        structurallyBounded && isSha256Digest(raw.digest)
          ? "execution.identity"
          : "execution.invalid-schema";
      return issue(
        code,
        "/resolver",
        "Historical record is malformed or its digest does not match.",
      );
    }
    aggregateBytes += record.bytes.byteLength;
    if (aggregateBytes > FAILURE_HISTORICAL_AUTHORITY_AGGREGATE_MAX_BYTES_V1) {
      return issue(
        "execution.invalid-schema",
        "/resolver",
        "Historical records exceed the aggregate byte bound.",
      );
    }
    const existing = records.get(record.digest);
    if (existing !== undefined && !isDeepStrictEqual(existing, record)) {
      return issue(
        "execution.identity",
        "/resolver",
        "One historical digest names unequal canonical bytes.",
      );
    }
    records.set(record.digest, record);
  }
  const resolver: FailureHistoricalAuthorityResolverV1 = Object.freeze({
    [FAILURE_HISTORICAL_AUTHORITY_RESOLVER_V1]: true as const,
  });
  RESOLVER_STATES.set(resolver, records);
  return success(resolver);
}

/** Serializes exact canonical envelope bytes from opaque retained state. */
export function serializeFailureEnvelopeV1(envelope: AuthorizedFailureEnvelopeV1): Uint8Array {
  const state =
    typeof envelope === "object" && envelope !== null ? ENVELOPE_STATES.get(envelope) : undefined;
  if (state === undefined) throw new TypeError("Failure envelope authority is not genuine.");
  return encodeCanonical(state.projection);
}

/**
 * Parses an envelope only when every exact named historical record is available.
 *
 * @param bytes Canonical serialized envelope.
 * @param resolver Opaque exact-content resolver.
 * @returns Resolved authority, closed unavailability, or a validation issue.
 */
export function parseFailureEnvelopeV1(
  bytes: Uint8Array,
  resolver: FailureHistoricalAuthorityResolverV1,
): ExecutionOperationResultV1<FailureEnvelopeResolutionV1> {
  const resolverState =
    typeof resolver === "object" && resolver !== null ? RESOLVER_STATES.get(resolver) : undefined;
  if (resolverState === undefined)
    return issue("unbound-capability", "/resolver", "Historical resolver is not genuine.");
  const byteLength = uint8ArrayByteLength(bytes);
  if (byteLength === undefined || byteLength === 0 || byteLength > FAILURE_ENVELOPE_MAX_BYTES_V1) {
    return issue(
      "execution.invalid-schema",
      "/envelope",
      "Serialized envelope exceeds its closed byte bounds.",
    );
  }
  const retained = copyUint8Array(bytes, byteLength);
  if (retained === undefined) {
    return issue("execution.invalid-schema", "/envelope", "Serialized envelope cannot be copied.");
  }
  let decoded: unknown;
  try {
    decoded = decodeCanonical(retained);
  } catch {
    return issue(
      "execution.invalid-schema",
      "/envelope",
      "Serialized envelope is not canonical version-one data.",
    );
  }
  const identity = validateFailureEnvelopeIdentityV1(decoded, retained);
  if (!identity.ok) return issue(identity.code, identity.path, identity.message);
  const missing = Object.freeze(
    identity.value.authorityDigests.filter((value) => !resolverState.has(value)),
  );
  if (missing.length > 0) {
    return success(
      Object.freeze({
        outcome: "historical-authority-unavailable" as const,
        missingAuthorityDigests: missing,
      }),
    );
  }
  const records = Object.freeze(
    identity.value.authorityDigests
      .map((value) => resolverState.get(value))
      .filter((value): value is FailureHistoricalAuthorityRecordV1 => value !== undefined),
  );
  const reconstructed = reconstructFailureEnvelopeV1(identity.value, records);
  if (!reconstructed.ok) {
    return issue(reconstructed.code, reconstructed.path, reconstructed.message);
  }
  const envelope = createAuthority(reconstructed.value, records);
  return success(
    Object.freeze({
      outcome: "resolved" as const,
      envelope,
      missingAuthorityDigests: Object.freeze([]) as readonly [],
    }),
  );
}

/** Resolves module-private envelope state for the deterministic reducer. */
export function getAuthorizedFailureEnvelopeStateV1(
  envelope: AuthorizedFailureEnvelopeV1,
): AuthorizedFailureEnvelopeState | undefined {
  return typeof envelope === "object" && envelope !== null
    ? ENVELOPE_STATES.get(envelope)
    : undefined;
}
