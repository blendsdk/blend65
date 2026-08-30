import {
  encodeFailureEnvelopeCanonicalV1,
  failureEnvelopeDigestV1,
} from "./failure-envelope-codec.js";
import { compareExecutionText } from "./execution-validation.js";

import type {
  FailureEnvelopeInitialCandidateV1,
  FailureEnvelopeV1,
  FailureHistoricalAuthorityRecordV1,
  FailureReplayAuthorityV1,
  FailureToolIdentityV1,
} from "./failure-envelope-model.js";
import type { FailurePredicateV1 } from "./failure-identity.js";
import type { FailureReductionPolicyV1 } from "./failure-contracts.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { ReplayEnvelopeV1 } from "./replay-input-model.js";

/** One exact passive fact retained under a unique historical role. */
export interface HistoricalAuthorityFactV1 {
  readonly kind: FailureHistoricalAuthorityRecordV1["kind"];
  readonly contentRevision: string;
  readonly value: unknown;
}

/** Builds passive exact identities for every executable typed-campaign dependency. */
export function createTypedCampaignHistoricalFactsV1(
  replay: ReplayEnvelopeV1,
): readonly HistoricalAuthorityFactV1[] {
  const campaign = replay.campaign;
  return Object.freeze([
    Object.freeze({
      kind: "inventory" as const,
      contentRevision: campaign.inventoryDigest,
      value: Object.freeze({
        schemaVersion: campaign.inventorySchemaVersion,
        inventoryVersion: campaign.inventoryVersion,
        inventoryDigest: campaign.inventoryDigest,
        specRevision: campaign.specRevision,
      }),
    }),
    Object.freeze({
      kind: "rule-model" as const,
      contentRevision: campaign.ruleModelDigest,
      value: Object.freeze({
        schemaVersion: 1,
        ruleModelVersion: campaign.ruleModelVersion,
        ruleModelDigest: campaign.ruleModelDigest,
      }),
    }),
    Object.freeze({
      kind: "campaign" as const,
      contentRevision: replay.campaignDigest,
      value: replay,
    }),
    Object.freeze({
      kind: "generator" as const,
      contentRevision: campaign.generator.implementationRevision,
      value: campaign.generator,
    }),
    Object.freeze({
      kind: "boundary-transform" as const,
      contentRevision: campaign.boundaryTransform.implementationRevision,
      value: campaign.boundaryTransform,
    }),
    Object.freeze({
      kind: "renderer" as const,
      contentRevision: campaign.rendererRevision,
      value: Object.freeze({ implementationRevision: campaign.rendererRevision }),
    }),
  ]);
}

/** Complete normalized source facts required to materialize historical records. */
export interface FailureHistoricalRecordSourceV1 {
  readonly family: FailureEnvelopeV1["family"];
  readonly replay: FailureReplayAuthorityV1;
  readonly candidate: FailureEnvelopeInitialCandidateV1;
  readonly historicalFacts: readonly HistoricalAuthorityFactV1[];
}

/** Creates the sorted role-complete exact records named by a failure envelope. */
export function createFailureHistoricalRecordsV1(
  source: FailureHistoricalRecordSourceV1,
  routePlanBytes: Uint8Array,
  routePlanDigest: Sha256Digest,
  predicate: FailurePredicateV1,
  policy: FailureReductionPolicyV1,
  observationBytes: Uint8Array,
  tools: readonly FailureToolIdentityV1[],
): readonly FailureHistoricalAuthorityRecordV1[] {
  const projectionRevision =
    source.replay.kind === "typed-campaign"
      ? source.replay.envelope.caseIdentity.digest
      : source.replay.envelope.textDigest;
  const entries: readonly HistoricalAuthorityFactV1[] = Object.freeze([
    ...source.historicalFacts,
    Object.freeze({
      kind: "oracle" as const,
      contentRevision: predicate.routeContract.oracleContractDigest,
      value: Object.freeze({ predicate, policy, observationBytes }),
    }),
    Object.freeze({
      kind: "projection" as const,
      contentRevision: projectionRevision,
      value: Object.freeze({
        family: source.family,
        replay: source.replay,
        initialCandidate: source.candidate,
      }),
    }),
    Object.freeze({
      kind: "fixture" as const,
      contentRevision: routePlanDigest,
      value: Object.freeze({ routePlanBytes, routePlanDigest }),
    }),
    Object.freeze({
      kind: "platform" as const,
      contentRevision: predicate.target,
      value: Object.freeze({ target: predicate.target }),
    }),
    Object.freeze({
      kind: "tool" as const,
      contentRevision: "failure-tool-contracts-v1",
      value: tools,
    }),
  ]);
  return Object.freeze(
    entries
      .slice()
      .sort((left, right) => compareExecutionText(left.kind, right.kind))
      .map(({ kind, contentRevision, value }) => {
        const bytes = encodeFailureEnvelopeCanonicalV1(value);
        return Object.freeze({
          revision: "failure-historical-authority-record-v1" as const,
          kind,
          contentRevision,
          bytes,
          digest: failureEnvelopeDigestV1(bytes),
        });
      }),
  );
}
