import { isDeepStrictEqual } from "node:util";

import { copyUint8Array, isSha256Digest, uint8ArrayByteLength } from "./canonical-identity.js";
import {
  decodeCanonicalHistoricalRecordV1,
  encodeFailureEnvelopeCanonicalV1,
  failureEnvelopeDigestV1,
} from "./failure-envelope-codec.js";
import { normalizeFailureEnvelopeToolsV1 } from "./failure-envelope-identity.js";
import { normalizeMalformedFailureProjectionV1 } from "./failure-envelope-malformed-history.js";
import { decodeHistoricalInvalidTransformV1 } from "./failure-envelope-transform-history.js";
import { deriveFailurePredicateIdentityV1 } from "./failure-identity.js";
import { parseFailureReductionPolicyV1 } from "./failure-contracts.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";
import { validateFailureClaimWitnessesV1 } from "./failure-claim-witness.js";
import { normalizeReplayEnvelope } from "./replay-envelope-normalizer.js";
import {
  compareExecutionText,
  isExecutionIdentifier,
  readExecutionArray,
  readExecutionRecord,
} from "./execution-validation.js";

import type {
  FailureEnvelopeInitialCandidateV1,
  FailureEnvelopeV1,
  FailureHistoricalAuthorityRecordV1,
  FailureReplayAuthorityV1,
} from "./failure-envelope-model.js";
import type {
  FailureEnvelopeHistoryResultV1,
  FailureEnvelopeIdentityV1,
} from "./failure-envelope-identity.js";
import type { ExecutionOperationIssueCodeV1 } from "./execution-contracts.js";
import type { GeneratedCaseProjection, ParameterValueBinding } from "./modeled-generator-model.js";
import type { GenModule } from "./generator-ir.js";

const PROJECTION_RECORD_KEYS = ["family", "replay", "initialCandidate"] as const;
const ORACLE_RECORD_KEYS = ["predicate", "policy", "observationBytes"] as const;
const FIXTURE_RECORD_KEYS = ["routePlanBytes", "routePlanDigest"] as const;
const CLAIM_WITNESS_KEYS = ["ruleId", "path"] as const;
const BINDING_KEYS = ["kind", "parameterPath", "value"] as const;
const VALID_CANDIDATE_KEYS = [
  "revision",
  "kind",
  "sourceBytes",
  "module",
  "parameterBindings",
  "primaryRuleId",
  "claimedRuleIds",
  "claimWitnesses",
] as const;
const INVALID_CANDIDATE_KEYS = [
  "revision",
  "kind",
  "sourceBytes",
  "baseline",
  "transform",
  "parameterBindings",
  "primaryRuleId",
  "claimedRuleIds",
  "claimWitnesses",
  "neighborId",
  "violatedPredicateId",
  "diagnosticFamily",
] as const;
const TYPED_REPLAY_KEYS = ["kind", "envelope", "generatedProjection", "sourceBytes"] as const;
const REPLAY_ENVELOPE_KEYS = [
  "schemaVersion",
  "campaign",
  "campaignDigest",
  "caseIdentity",
  "configuration",
] as const;
const REPLAY_CONFIGURATION_KEYS = [
  "caseCount",
  "maxInvalidCases",
  "enabledRuleIds",
  "spellings",
  "budget",
] as const;
const REPLAY_BUDGET_KEYS = [
  "maxModules",
  "maxDeclarations",
  "maxIrNodes",
  "maxStatements",
  "maxExpressionDepth",
  "maxLoopWork",
  "maxSourceBytes",
  "maxAttempts",
] as const;
const SOURCE_MAX_BYTES = 1_048_576;
const MAX_BINDINGS = 4_096;
const MAX_CLAIMS = 4_096;

function failure<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): FailureEnvelopeHistoryResultV1<T> {
  return Object.freeze({ ok: false, code, path, message });
}

function success<T>(value: T): FailureEnvelopeHistoryResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function boundedBytes(input: unknown, maximum: number): Uint8Array | undefined {
  const length = uint8ArrayByteLength(input);
  return length === undefined || length > maximum ? undefined : copyUint8Array(input, length);
}

function isStrictlySortedUnique(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous === undefined || current === undefined || previous >= current) return false;
  }
  return true;
}

function generatedProjection(input: unknown): GeneratedCaseProjection | undefined {
  const valid = readExecutionRecord(input, ["kind", "module"]);
  if (valid?.kind === "valid") {
    const module = validateGeneratorIr(valid.module);
    return module.ok ? Object.freeze({ kind: "valid" as const, module: module.module }) : undefined;
  }
  const invalid = readExecutionRecord(input, ["kind", "baseline", "transform"]);
  if (invalid?.kind !== "invalid") return undefined;
  const baseline = validateGeneratorIr(invalid.baseline);
  const transform = decodeHistoricalInvalidTransformV1(invalid.transform);
  return baseline.ok && transform !== undefined
    ? Object.freeze({ kind: "invalid" as const, baseline: baseline.module, transform })
    : undefined;
}

function parameterBindings(input: unknown): readonly ParameterValueBinding[] | undefined {
  const values = readExecutionArray(input, MAX_BINDINGS);
  if (values === undefined) return undefined;
  const bindings: ParameterValueBinding[] = [];
  const paths = new Set<string>();
  for (const value of values) {
    const binding = readExecutionRecord(value, BINDING_KEYS);
    if (
      binding === undefined ||
      binding.kind !== "parameter-value" ||
      typeof binding.parameterPath !== "string" ||
      !/^\/functions\/[0-9]+\/parameters\/[0-9]+$/u.test(binding.parameterPath) ||
      (typeof binding.value !== "bigint" && typeof binding.value !== "boolean") ||
      paths.has(binding.parameterPath)
    ) {
      return undefined;
    }
    paths.add(binding.parameterPath);
    bindings.push(
      Object.freeze({
        kind: "parameter-value",
        parameterPath: binding.parameterPath,
        value: binding.value,
      }),
    );
  }
  return Object.freeze(bindings);
}

interface ClaimsV1 {
  readonly primaryRuleId: string;
  readonly claimedRuleIds: readonly string[];
  readonly claimWitnesses: readonly { readonly ruleId: string; readonly path: string }[];
}

function claims(
  candidate: Readonly<Record<string, unknown>>,
  root: "module" | "baseline",
  module: GenModule,
): ClaimsV1 | undefined {
  if (!isExecutionIdentifier(candidate.primaryRuleId)) return undefined;
  const ids = readExecutionArray(candidate.claimedRuleIds, MAX_CLAIMS);
  const witnessValues = readExecutionArray(candidate.claimWitnesses, MAX_CLAIMS);
  if (
    ids === undefined ||
    witnessValues === undefined ||
    ids.length === 0 ||
    ids.length !== witnessValues.length ||
    ids.some((value) => !isExecutionIdentifier(value)) ||
    !isStrictlySortedUnique(ids.filter(isExecutionIdentifier)) ||
    !ids.includes(candidate.primaryRuleId)
  ) {
    return undefined;
  }
  const witnesses: { readonly ruleId: string; readonly path: string }[] = [];
  for (let index = 0; index < witnessValues.length; index += 1) {
    const witness = readExecutionRecord(witnessValues[index], CLAIM_WITNESS_KEYS);
    if (
      witness === undefined ||
      !isExecutionIdentifier(witness.ruleId) ||
      witness.ruleId !== ids[index] ||
      typeof witness.path !== "string" ||
      !witness.path.startsWith(`/${root}/`)
    ) {
      return undefined;
    }
    witnesses.push(Object.freeze({ ruleId: witness.ruleId, path: witness.path }));
  }
  if (!validateFailureClaimWitnessesV1(module, witnesses, root)) return undefined;
  return Object.freeze({
    primaryRuleId: candidate.primaryRuleId,
    claimedRuleIds: Object.freeze(ids.filter(isExecutionIdentifier)),
    claimWitnesses: Object.freeze(witnesses),
  });
}

function typedCandidate(
  input: unknown,
  family: "typed-valid" | "typed-invalid",
  projection: GeneratedCaseProjection,
  sourceBytes: Uint8Array,
): FailureEnvelopeInitialCandidateV1 | undefined {
  const candidate = readExecutionRecord(
    input,
    family === "typed-valid" ? VALID_CANDIDATE_KEYS : INVALID_CANDIDATE_KEYS,
  );
  if (
    candidate === undefined ||
    candidate.revision !== "reduction-candidate-draft-v1" ||
    candidate.kind !== family
  ) {
    return undefined;
  }
  const retainedSource = boundedBytes(candidate.sourceBytes, SOURCE_MAX_BYTES);
  const bindings = parameterBindings(candidate.parameterBindings);
  if (
    retainedSource === undefined ||
    retainedSource.byteLength === 0 ||
    !isDeepStrictEqual(retainedSource, sourceBytes) ||
    bindings === undefined
  ) {
    return undefined;
  }
  if (family === "typed-valid") {
    if (projection.kind !== "valid") return undefined;
    const module = validateGeneratorIr(candidate.module);
    if (!module.ok || !isDeepStrictEqual(module.module, projection.module)) return undefined;
    const normalizedClaims = claims(candidate, "module", module.module);
    if (normalizedClaims === undefined) return undefined;
    return Object.freeze({
      revision: "reduction-candidate-draft-v1",
      kind: "typed-valid",
      sourceBytes: retainedSource,
      module: module.module,
      parameterBindings: bindings,
      ...normalizedClaims,
    });
  }
  if (
    projection.kind !== "invalid" ||
    !isExecutionIdentifier(candidate.neighborId) ||
    !isExecutionIdentifier(candidate.violatedPredicateId) ||
    !isExecutionIdentifier(candidate.diagnosticFamily)
  ) {
    return undefined;
  }
  const baseline = validateGeneratorIr(candidate.baseline);
  const transform = decodeHistoricalInvalidTransformV1(candidate.transform);
  if (
    !baseline.ok ||
    transform === undefined ||
    !isDeepStrictEqual(baseline.module, projection.baseline) ||
    !isDeepStrictEqual(transform, projection.transform)
  ) {
    return undefined;
  }
  const normalizedClaims = claims(candidate, "baseline", baseline.module);
  if (normalizedClaims === undefined) return undefined;
  return Object.freeze({
    revision: "reduction-candidate-draft-v1",
    kind: "typed-invalid",
    sourceBytes: retainedSource,
    baseline: baseline.module,
    transform,
    parameterBindings: bindings,
    ...normalizedClaims,
    neighborId: candidate.neighborId,
    violatedPredicateId: candidate.violatedPredicateId,
    diagnosticFamily: candidate.diagnosticFamily,
  });
}

function typedReplay(input: unknown): FailureReplayAuthorityV1 | undefined {
  const replay = readExecutionRecord(input, TYPED_REPLAY_KEYS);
  if (replay?.kind !== "typed-campaign") return undefined;
  const retainedEnvelope = readExecutionRecord(replay.envelope, REPLAY_ENVELOPE_KEYS);
  const configuration = readExecutionRecord(
    retainedEnvelope?.configuration,
    REPLAY_CONFIGURATION_KEYS,
  );
  const budget = readExecutionRecord(configuration?.budget, REPLAY_BUDGET_KEYS);
  if (retainedEnvelope === undefined || configuration === undefined || budget === undefined) {
    return undefined;
  }
  const envelope = normalizeReplayEnvelope({
    ...retainedEnvelope,
    configuration: {
      ...configuration,
      budget: {
        ...budget,
        maxLoopWork:
          typeof budget.maxLoopWork === "bigint"
            ? budget.maxLoopWork.toString()
            : budget.maxLoopWork,
      },
    },
  });
  const projection = generatedProjection(replay.generatedProjection);
  const sourceBytes = boundedBytes(replay.sourceBytes, SOURCE_MAX_BYTES);
  if (
    !envelope.ok ||
    projection === undefined ||
    sourceBytes === undefined ||
    sourceBytes.byteLength === 0
  ) {
    return undefined;
  }
  return Object.freeze({
    kind: "typed-campaign" as const,
    envelope: envelope.envelope,
    generatedProjection: projection,
    sourceBytes,
  });
}

function requiredKinds(
  family: FailureEnvelopeV1["family"],
): readonly FailureHistoricalAuthorityRecordV1["kind"][] {
  const shared = ["fixture", "oracle", "platform", "projection", "tool"] as const;
  const kinds: FailureHistoricalAuthorityRecordV1["kind"][] = [];
  if (family === "raw-malformed") {
    kinds.push("diagnostic", "execution-publication", ...shared);
  } else {
    kinds.push("boundary-transform", "campaign");
    if (family === "typed-invalid") kinds.push("diagnostic", "execution-publication");
    kinds.push("generator", "inventory", ...shared, "renderer", "rule-model");
  }
  kinds.sort(compareExecutionText);
  return Object.freeze(kinds);
}

/**
 * Reconstructs one envelope exclusively from complete, role-checked historical records.
 *
 * @param identity Previously identity-checked envelope header.
 * @param records Exact records named by the header.
 * @returns Fresh normalized envelope state or a deterministic issue.
 */
export function reconstructFailureEnvelopeV1(
  identity: FailureEnvelopeIdentityV1,
  records: readonly FailureHistoricalAuthorityRecordV1[],
): FailureEnvelopeHistoryResultV1<FailureEnvelopeV1> {
  const sortedRecords = [...records].sort((left, right) =>
    compareExecutionText(left.kind, right.kind),
  );
  const actualKinds = sortedRecords.map((record) => record.kind);
  const expectedKinds = requiredKinds(identity.family);
  if (!isDeepStrictEqual(actualKinds, expectedKinds) || !isStrictlySortedUnique(actualKinds)) {
    return failure(
      "execution.identity",
      "/envelope/authorityDigests",
      "Historical records are not the exact role-complete set for this family.",
    );
  }
  const byKind = new Map<
    FailureHistoricalAuthorityRecordV1["kind"],
    { record: FailureHistoricalAuthorityRecordV1; value: unknown }
  >();
  for (const record of sortedRecords) {
    const value = decodeCanonicalHistoricalRecordV1(record);
    if (value === undefined) {
      return failure(
        "execution.invalid-schema",
        "/resolver",
        "Historical record bytes are not canonical closed data.",
      );
    }
    byKind.set(record.kind, { record, value });
  }
  const projectionEntry = byKind.get("projection");
  const projectionRecord = readExecutionRecord(projectionEntry?.value, PROJECTION_RECORD_KEYS);
  if (projectionRecord?.family !== identity.family) {
    return failure(
      "execution.identity",
      "/envelope/replay",
      "Historical projection family does not match the envelope.",
    );
  }
  const malformed =
    identity.family === "raw-malformed"
      ? normalizeMalformedFailureProjectionV1(
          projectionRecord.replay,
          projectionRecord.initialCandidate,
        )
      : undefined;
  const replay = malformed?.replay ?? typedReplay(projectionRecord.replay);
  if (replay === undefined) {
    return failure(
      "execution.invalid-schema",
      "/envelope/replay",
      "Historical replay authority is invalid.",
    );
  }
  const initialCandidate =
    malformed?.candidate ??
    (replay.kind === "typed-campaign" && identity.family !== "raw-malformed"
      ? typedCandidate(
          projectionRecord.initialCandidate,
          identity.family,
          replay.generatedProjection,
          replay.sourceBytes,
        )
      : undefined);
  if (initialCandidate === undefined) {
    return failure(
      "execution.invalid-schema",
      "/envelope/initialCandidate",
      "Historical initial candidate is invalid.",
    );
  }

  const oracleEntry = byKind.get("oracle");
  const oracle = readExecutionRecord(oracleEntry?.value, ORACLE_RECORD_KEYS);
  const predicate = deriveFailurePredicateIdentityV1(oracle?.predicate);
  const policy = parseFailureReductionPolicyV1(oracle?.policy);
  const observationBytes = boundedBytes(oracle?.observationBytes, 67_108_864);
  if (!predicate.ok || !policy.ok || observationBytes === undefined) {
    return failure(
      "execution.invalid-schema",
      "/envelope/predicate",
      "Historical oracle fields are invalid.",
    );
  }
  if (
    predicate.value.predicate.primaryRuleId !==
      (initialCandidate.kind === "raw-malformed"
        ? replay.kind === "raw-malformed"
          ? replay.envelope.ruleId
          : ""
        : initialCandidate.primaryRuleId) ||
    (predicate.value.predicate.observation.kind === "observed"
      ? predicate.value.predicate.observation.digest
      : predicate.value.predicate.observation.terminalReasonDigest) !==
      failureEnvelopeDigestV1(observationBytes)
  ) {
    return failure(
      "execution.identity",
      "/envelope/predicate",
      "Historical predicate does not match its source and observation.",
    );
  }
  const sourceClaimsMatch =
    initialCandidate.kind === "raw-malformed"
      ? replay.kind === "raw-malformed" &&
        predicate.value.predicate.requiredClaimedRuleIds.length === 1 &&
        predicate.value.predicate.requiredClaimedRuleIds[0] === replay.envelope.ruleId
      : predicate.value.predicate.requiredClaimedRuleIds.every((ruleId) =>
          initialCandidate.claimedRuleIds.includes(ruleId),
        );
  if (!sourceClaimsMatch) {
    return failure(
      "execution.identity",
      "/envelope/predicate",
      "Required predicate claims are absent from the historical candidate.",
    );
  }

  const fixtureEntry = byKind.get("fixture");
  const fixture = readExecutionRecord(fixtureEntry?.value, FIXTURE_RECORD_KEYS);
  const routePlanBytes = boundedBytes(fixture?.routePlanBytes, 67_108_864);
  if (
    routePlanBytes === undefined ||
    routePlanBytes.byteLength === 0 ||
    !isSha256Digest(fixture?.routePlanDigest) ||
    failureEnvelopeDigestV1(routePlanBytes) !== fixture.routePlanDigest ||
    fixtureEntry?.record.contentRevision !== fixture.routePlanDigest
  ) {
    return failure(
      "execution.identity",
      "/envelope/routePlanDigest",
      "Historical route fixture identity is invalid.",
    );
  }
  const toolEntry = byKind.get("tool");
  const tools = normalizeFailureEnvelopeToolsV1(toolEntry?.value);
  const platform = readExecutionRecord(byKind.get("platform")?.value, ["target"]);
  if (
    tools === undefined ||
    toolEntry?.record.contentRevision !== "failure-tool-contracts-v1" ||
    platform?.target !== predicate.value.predicate.target ||
    byKind.get("platform")?.record.contentRevision !== predicate.value.predicate.target
  ) {
    return failure(
      "execution.identity",
      "/envelope/toolVersions",
      "Historical platform or tool authority is inconsistent.",
    );
  }
  const toolDigests = tools.map((tool) => tool.digest).sort(compareExecutionText);
  if (
    !isDeepStrictEqual(toolDigests, predicate.value.predicate.routeContract.toolContractDigests)
  ) {
    return failure(
      "execution.identity",
      "/envelope/toolVersions",
      "Historical tools do not match the route contract.",
    );
  }

  if (
    oracleEntry?.record.contentRevision !==
    predicate.value.predicate.routeContract.oracleContractDigest
  ) {
    return failure(
      "execution.identity",
      "/envelope/predicate/routeContract",
      "Historical oracle revision does not match the route contract.",
    );
  }
  if (replay.kind === "typed-campaign") {
    const campaign = replay.envelope.campaign;
    const inventory = Object.freeze({
      schemaVersion: campaign.inventorySchemaVersion,
      inventoryVersion: campaign.inventoryVersion,
      inventoryDigest: campaign.inventoryDigest,
      specRevision: campaign.specRevision,
    });
    const ruleModel = Object.freeze({
      schemaVersion: 1,
      ruleModelVersion: campaign.ruleModelVersion,
      ruleModelDigest: campaign.ruleModelDigest,
    });
    if (
      !isDeepStrictEqual(byKind.get("campaign")?.value, replay.envelope) ||
      byKind.get("campaign")?.record.contentRevision !== replay.envelope.campaignDigest ||
      !isDeepStrictEqual(byKind.get("inventory")?.value, inventory) ||
      byKind.get("inventory")?.record.contentRevision !== campaign.inventoryDigest ||
      !isDeepStrictEqual(byKind.get("rule-model")?.value, ruleModel) ||
      byKind.get("rule-model")?.record.contentRevision !== campaign.ruleModelDigest ||
      !isDeepStrictEqual(byKind.get("generator")?.value, campaign.generator) ||
      byKind.get("generator")?.record.contentRevision !==
        campaign.generator.implementationRevision ||
      !isDeepStrictEqual(byKind.get("boundary-transform")?.value, campaign.boundaryTransform) ||
      byKind.get("boundary-transform")?.record.contentRevision !==
        campaign.boundaryTransform.implementationRevision ||
      !isDeepStrictEqual(byKind.get("renderer")?.value, {
        implementationRevision: campaign.rendererRevision,
      }) ||
      byKind.get("renderer")?.record.contentRevision !== campaign.rendererRevision ||
      projectionEntry?.record.contentRevision !== replay.envelope.caseIdentity.digest
    ) {
      return failure(
        "execution.identity",
        "/envelope/replay",
        "Typed historical authority roles do not match replay identity.",
      );
    }
  } else if (
    !isDeepStrictEqual(byKind.get("diagnostic")?.value, replay.envelope) ||
    byKind.get("diagnostic")?.record.contentRevision !==
      replay.envelope.diagnosticAuthorityDigest ||
    projectionEntry?.record.contentRevision !== replay.envelope.textDigest ||
    !isDeepStrictEqual(byKind.get("execution-publication")?.value, {
      selectedReleaseDigest: replay.envelope.selectedReleaseDigest,
      diagnosticAuthorityDigest: replay.envelope.diagnosticAuthorityDigest,
    }) ||
    byKind.get("execution-publication")?.record.contentRevision !==
      replay.envelope.selectedReleaseDigest
  ) {
    return failure(
      "execution.identity",
      "/envelope/replay",
      "Malformed historical authority roles do not match replay identity.",
    );
  }

  if (identity.family === "typed-invalid") {
    const diagnostic = readExecutionRecord(byKind.get("diagnostic")?.value, [
      "schemaVersion",
      "kind",
      "sourceCaseDigest",
      "sourceBytes",
      "expectedDiagnostic",
      "authority",
    ]);
    const authority = readExecutionRecord(diagnostic?.authority, [
      "joinPolicyRevision",
      "selectedReleaseDigest",
      "selectedCampaignDigest",
      "selectedSourceCaseDigest",
      "evaluationIdentity",
      "sourceContentIdentity",
    ]);
    if (
      replay.kind !== "typed-campaign" ||
      diagnostic?.schemaVersion !== 1 ||
      diagnostic.kind !== "invalid-source-transform" ||
      diagnostic.sourceCaseDigest !== replay.envelope.caseIdentity.digest ||
      !isDeepStrictEqual(diagnostic.sourceBytes, replay.sourceBytes) ||
      authority?.joinPolicyRevision !== "published-diagnostic-case-equivalence-v1" ||
      authority.selectedCampaignDigest !== replay.envelope.campaignDigest ||
      authority.selectedSourceCaseDigest !== replay.envelope.caseIdentity.digest ||
      !isSha256Digest(authority.selectedReleaseDigest) ||
      !isSha256Digest(authority.evaluationIdentity) ||
      byKind.get("diagnostic")?.record.contentRevision !== authority.evaluationIdentity ||
      !isDeepStrictEqual(byKind.get("execution-publication")?.value, authority) ||
      byKind.get("execution-publication")?.record.contentRevision !==
        authority.selectedReleaseDigest
    ) {
      return failure(
        "execution.identity",
        "/envelope/replay",
        "Diagnostic publication history does not match the typed replay.",
      );
    }
  }

  const routeKind = identity.family === "typed-valid" ? "valid-envelope" : "invalid-diagnostic";
  if (predicate.value.predicate.routeContract.originalRouteKind !== routeKind) {
    return failure(
      "execution.identity",
      "/envelope/predicate/routeContract",
      "Historical route kind does not match the source family.",
    );
  }
  const reconstructedWithoutDigest = Object.freeze({
    revision: "failure-envelope-v1" as const,
    family: identity.family,
    replay,
    routePlanBytes,
    routePlanDigest: fixture.routePlanDigest,
    predicate: predicate.value.predicate,
    policy: policy.value,
    observationBytes,
    toolVersions: tools,
    initialCandidate,
    authorityDigests: identity.authorityDigests,
  });
  const reconstructed = Object.freeze({ ...reconstructedWithoutDigest, digest: identity.digest });
  const outerWithoutDigest = { ...identity.decoded };
  delete outerWithoutDigest.digest;
  if (
    !isDeepStrictEqual(outerWithoutDigest, reconstructedWithoutDigest) ||
    failureEnvelopeDigestV1(encodeFailureEnvelopeCanonicalV1(reconstructedWithoutDigest)) !==
      identity.digest
  ) {
    return failure(
      "execution.identity",
      "/envelope",
      "Serialized fields do not match reconstructed historical authority.",
    );
  }
  return success(reconstructed);
}
