import type {
  ExecutionPolicyV1,
  ExecutionResultV1,
  ExecutionRoutePlanItemV1,
  FailureObservationIdentityV1,
  FailurePredicateV1,
  Sha256Digest,
} from "@blend65/readiness";
import type { FailurePredicateIngredientsV1 } from "@blend65/readiness/failure-predicate-ingredients";

/** Stable route facts retained without the live request capability. */
export interface FailurePredicateEvidenceRouteV1 {
  /** Closed public request family. */
  readonly requestKind: "valid-envelope" | "invalid-diagnostic" | "raw-malformed";
  /** Exact selected route subject. */
  readonly caseIdentity: string;
  /** Exact deterministic planner rank. */
  readonly rankDigest: string;
  /** Reviewed rule exercised by the route. */
  readonly ruleId: string;
  /** Selected evidence obligation. */
  readonly obligation: string;
  /** Last route tier. */
  readonly terminalTier: ExecutionRoutePlanItemV1["terminalTier"];
  /** Ordered prerequisite tiers. */
  readonly prerequisiteTiers: ExecutionRoutePlanItemV1["prerequisiteTiers"];
  /** Complete normalized execution policy. */
  readonly policy: ExecutionPolicyV1;
  /** Stable subject identity retained independently of route position. */
  readonly subjectDigest: string;
  /** Stable source-content or generated-case identity. */
  readonly sourceDigest: string;
}

/** Stable terminal facts with volatile timing and retained-size values removed. */
export interface FailurePredicateEvidenceOutcomeV1 {
  /** Terminal classification. */
  readonly status: ExecutionResultV1["status"];
  /** Last route tier. */
  readonly tier: ExecutionResultV1["tier"];
  /** Terminal pipeline stage. */
  readonly stage: ExecutionResultV1["stage"];
  /** Stable public result code. */
  readonly code: ExecutionResultV1["code"];
  /** Complete evidence-stream identity. */
  readonly evidenceDigest: string;
  /** Optional stable adapter detail. */
  readonly adapterSubcode?: string;
  /** Whether cleanup retained a blocker. */
  readonly cleanup: "clear" | "blocked";
}

/** Genuine candidate evidence retaining the complete historical predicate. */
export interface CandidateFailurePredicateEvidenceV1 {
  /** Closed sidecar schema. */
  readonly revision: "failure-predicate-evidence-v1";
  /** Closed evidence arm. */
  readonly kind: "candidate-full-predicate";
  /** Candidate or original execution subject. */
  readonly subjectDigest: Sha256Digest;
  /** Exact historical predicate evaluated by the fixed route. */
  readonly predicate: FailurePredicateV1;
  /** Stable terminal result classification retained for compatibility. */
  readonly resultCode: ExecutionResultV1["code"];
  /** Stable reached or not-reached observation identity retained for compatibility. */
  readonly observation: FailureObservationIdentityV1;
  /** Stable terminal outcome. */
  readonly outcome: FailurePredicateEvidenceOutcomeV1;
  /** Digest binding every preceding sidecar field. */
  readonly digest: Sha256Digest;
}

/** Ordinary executed route facts carrying either a pass or derivable failure predicate. */
export interface OrdinaryFailurePredicateEvidenceV1 {
  /** Closed sidecar schema. */
  readonly revision: "failure-predicate-evidence-v1";
  /** Closed evidence arm. */
  readonly kind: "ordinary-route-facts";
  /** Exact route subject. */
  readonly subjectDigest: Sha256Digest;
  /** Stable request and planner facts. */
  readonly route: FailurePredicateEvidenceRouteV1;
  /** Stable terminal outcome. */
  readonly outcome: FailurePredicateEvidenceOutcomeV1;
  /** Pass marker or normalized data-only failure ingredients. */
  readonly predicateBasis:
    | Readonly<{ readonly kind: "pass" }>
    | Readonly<{
        readonly kind: "failure-ingredients";
        readonly value: FailurePredicateIngredientsV1;
      }>;
  /** Digest binding every preceding sidecar field. */
  readonly digest: Sha256Digest;
}

/** Orchestration-owned evidence for a route intentionally not dispatched to a handler. */
export interface ClosedNonExecutedFailurePredicateEvidenceV1 {
  /** Closed sidecar schema. */
  readonly revision: "failure-predicate-evidence-v1";
  /** Closed evidence arm. */
  readonly kind: "closed-non-executed";
  /** Reason no live handler result exists. */
  readonly disposition: "tier-unavailable" | "injected-substitution" | "caught-compiler-ice";
  /** Exact route subject. */
  readonly subjectDigest: Sha256Digest;
  /** Stable request and planner facts. */
  readonly route: FailurePredicateEvidenceRouteV1;
  /** Stable terminal outcome. */
  readonly outcome: FailurePredicateEvidenceOutcomeV1;
  /** Pass marker or normalized data-only failure ingredients. */
  readonly predicateBasis:
    | Readonly<{ readonly kind: "pass" }>
    | Readonly<{
        readonly kind: "failure-ingredients";
        readonly value: FailurePredicateIngredientsV1;
      }>;
  /** Digest binding every preceding sidecar field. */
  readonly digest: Sha256Digest;
}

/** Authenticated predicate evidence carried outside compatible report bytes. */
export type FailurePredicateEvidenceV1 =
  | CandidateFailurePredicateEvidenceV1
  | OrdinaryFailurePredicateEvidenceV1
  | ClosedNonExecutedFailurePredicateEvidenceV1;

/** Opaque sidecar authority associated with one exact result object. */
export interface FailurePredicateEvidenceAuthorityV1 {
  readonly [FAILURE_PREDICATE_EVIDENCE_AUTHORITY_V1]: true;
}

/** Runtime brand for privately minted predicate sidecar authority. */
export const FAILURE_PREDICATE_EVIDENCE_AUTHORITY_V1: unique symbol = Symbol(
  "failure-predicate-evidence-authority-v1",
);
