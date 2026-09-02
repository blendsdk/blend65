import type {
  ExecutionIssueV1,
  ExecutionOperationIssueCodeV1,
  ExecutionOperationResultV1,
  ExecutionResultV1,
  Sha256Digest,
} from "@blend65/readiness";
import type { ReductionCandidateInvocationV1 } from "@blend65/readiness/failure-reduction-internals";

import type { ExecutionAuthorityReportV1 } from "./execution-orchestration.js";
import type { ExecutionRouteRequestV1 } from "./execution-route-adapters.js";
import type {
  FailurePredicateEvidenceAuthorityV1,
  FailurePredicateEvidenceV1,
} from "./failure-predicate-evidence.js";

/** Runtime brand for one exact occurrence in a complete execution report. */
export const EXECUTION_REPORT_POSITION_AUTHORITY_V1: unique symbol = Symbol(
  "execution-report-position-authority-v1",
);

/** Opaque capability identifying one exact ordered report occurrence. */
export interface ExecutionReportPositionAuthorityV1 {
  /** Compile-time marker paired with module-private report provenance. */
  readonly [EXECUTION_REPORT_POSITION_AUTHORITY_V1]: true;
}

/** Runtime brand for one complete subject-bound confirmation join. */
export const FAILURE_CONFIRMATION_CONTEXT_AUTHORITY_V1: unique symbol = Symbol(
  "failure-confirmation-context-authority-v1",
);

/** Opaque authority binding historical report, envelope, candidate, tools and budget. */
export interface FailureConfirmationContextAuthorityV1 {
  /** Compile-time marker paired with module-private confirmation context state. */
  readonly [FAILURE_CONFIRMATION_CONTEXT_AUTHORITY_V1]: true;
}

/** Failure-execution-only issue category for unavailable retained history. */
export type FailureExecutionIssueCodeV1 =
  | ExecutionOperationIssueCodeV1
  | "historical-authority-unavailable";

/** Path-specific issue returned by failure execution operations. */
export interface FailureExecutionIssueV1 extends Omit<ExecutionIssueV1, "code"> {
  /** Stable execution or historical-authority category. */
  readonly code: FailureExecutionIssueCodeV1;
}

/** Closed success or non-empty failure-execution issue result. */
export type FailureExecutionOperationResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly issues: readonly [FailureExecutionIssueV1, ...FailureExecutionIssueV1[]];
    };

/** Runtime brand for one closed failure-execution protocol. */
export const FAILURE_EXECUTION_PROTOCOL_V1: unique symbol = Symbol("failure-execution-protocol-v1");

/** Opaque coordinator bound to one historical route and live handler context. */
export interface FailureExecutionProtocolV1 {
  /** Compile-time marker paired with module-private protocol state. */
  readonly [FAILURE_EXECUTION_PROTOCOL_V1]: true;
}

/** Runtime brand for one worker-isolation capability. */
export const REDUCTION_EXECUTION_ISOLATION_V1: unique symbol = Symbol(
  "reduction-execution-isolation-v1",
);

/** Opaque campaign, standalone, or sequence worker owner. */
export interface ReductionExecutionIsolationV1 {
  /** Compile-time marker paired with module-private isolation state. */
  readonly [REDUCTION_EXECUTION_ISOLATION_V1]: true;
}

/** Runtime brand for one known-good control subject. */
export const FAILURE_EXECUTION_CONTROL_AUTHORITY_V1: unique symbol = Symbol(
  "failure-execution-control-authority-v1",
);

/** Opaque same-route original-case control authority. */
export interface FailureExecutionControlAuthorityV1 {
  /** Compile-time marker paired with module-private control state. */
  readonly [FAILURE_EXECUTION_CONTROL_AUTHORITY_V1]: true;
}

/** Runtime brand for one dedicated ordered sequence attempt. */
export const STATEFUL_SEQUENCE_ATTEMPT_AUTHORITY_V1: unique symbol = Symbol(
  "stateful-sequence-attempt-authority-v1",
);

/** Opaque authority owning one dedicated worker and bounded sequence. */
export interface StatefulSequenceAttemptAuthorityV1 {
  /** Compile-time marker paired with module-private attempt state. */
  readonly [STATEFUL_SEQUENCE_ATTEMPT_AUTHORITY_V1]: true;
}

/** Runtime brand for one exact next sequence position. */
export const STATEFUL_SEQUENCE_POSITION_AUTHORITY_V1: unique symbol = Symbol(
  "stateful-sequence-position-authority-v1",
);

/** Opaque single-use position issued in strict attempt order. */
export interface StatefulSequencePositionAuthorityV1 {
  /** Compile-time marker paired with module-private position state. */
  readonly [STATEFUL_SEQUENCE_POSITION_AUTHORITY_V1]: true;
}

/** Runtime brand for a bounded confirmation state machine. */
export const FAILURE_CONFIRMATION_SESSION_V1: unique symbol = Symbol(
  "failure-confirmation-session-v1",
);

/** Opaque confirmation session that issues one step at a time. */
export interface FailureConfirmationSessionV1 {
  /** Compile-time marker paired with module-private confirmation state. */
  readonly [FAILURE_CONFIRMATION_SESSION_V1]: true;
}

/** Runtime brand for one exact confirmation step. */
export const FAILURE_CONFIRMATION_STEP_AUTHORITY_V1: unique symbol = Symbol(
  "failure-confirmation-step-authority-v1",
);

/** Opaque single-use confirmation step bound to one session. */
export interface FailureConfirmationStepAuthorityV1 {
  /** Compile-time marker paired with module-private step state. */
  readonly [FAILURE_CONFIRMATION_STEP_AUTHORITY_V1]: true;
}

/** Runtime brand for one genuine fixed-handler step evaluation. */
export const FAILURE_EXECUTION_STEP_EVALUATION_V1: unique symbol = Symbol(
  "failure-execution-step-evaluation-v1",
);

/** Opaque evaluation accepted only by the session that requested it. */
export interface FailureExecutionStepEvaluationV1 {
  /** Compile-time marker paired with module-private evaluation state. */
  readonly [FAILURE_EXECUTION_STEP_EVALUATION_V1]: true;
}

/** Authenticated lifecycle checkpoint for one isolated execution subject. */
export interface FailureExecutionObservationV1 {
  /** Closed observation schema. */
  readonly revision: "failure-execution-observation-v1";
  /** Isolation mode that owns the subject. */
  readonly mode: "campaign-shared" | "standalone" | "sequence-attempt";
  /** Whether admission checks completed. */
  readonly admitted: boolean;
  /** Whether the fixed handler was launched. */
  readonly launched: boolean;
  /** One-based attempt ordinal, or zero outside a sequence. */
  readonly attemptOrdinal: number;
  /** One-based sequence position, or zero outside a sequence. */
  readonly position: number;
  /** One-based exact source-report occurrence used by this execution. */
  readonly reportPosition: number;
  /** Path-free workspace identity when observed by the execution boundary. */
  readonly rootIdentity?: Sha256Digest;
  /** Worker-thread identity when observed by the execution boundary. */
  readonly workerIdentity?: number;
  /** Domain-separated isolate identity when observed by the execution boundary. */
  readonly isolateIdentity?: Sha256Digest;
  /** Digest binding the complete path-free lifecycle checkpoint. */
  readonly checkpointDigest: Sha256Digest;
}

/** Stable result reference to one authenticated lifecycle checkpoint. */
export interface FailureExecutionCheckpointReferenceV1 {
  /** Exact checkpoint identity. */
  readonly digest: Sha256Digest;
  /** One-based source-report occurrence. */
  readonly reportPosition: number;
  /** One-based isolated run or sequence-attempt ordinal. */
  readonly attemptOrdinal: number;
  /** One-based sequence position, or zero for a standalone run. */
  readonly position: number;
}

/** Minimal public request carrying only invocation and isolation authority. */
export interface ReductionExecutionRouteRequestV1 {
  /** Closed candidate-route discriminator. */
  readonly kind: "reduction-candidate";
  /** Genuine single-use invocation. */
  readonly invocation: ReductionCandidateInvocationV1;
  /** Genuine worker-isolation capability. */
  readonly isolation: ReductionExecutionIsolationV1;
}

/** Complete authenticated result of executing one candidate invocation. */
export interface ReductionCandidateExecutionEvaluationV1 {
  /** Closed evaluation schema. */
  readonly revision: "reduction-candidate-evaluation-v1";
  /** Digest identifying the consumed single-use evaluation token. */
  readonly evaluationTokenDigest: Sha256Digest;
  /** Result returned by the retained published handler. */
  readonly result: ExecutionResultV1;
  /** Stable predicate evidence minted beside the compatible result. */
  readonly predicateEvidence: FailurePredicateEvidenceAuthorityV1 & FailurePredicateEvidenceV1;
  /** Digest binding the token, result, and sidecar identities. */
  readonly digest: Sha256Digest;
}

/** Ordered evidence retained for a reproduced stateful sequence. */
export interface StatefulSequenceEvidenceV1 {
  /** Closed sequence evidence schema. */
  readonly revision: "stateful-sequence-evidence-v1";
  /** One-based position at which the reduced candidate reproduced. */
  readonly failingPosition: number;
  /** Digest of each authenticated position evaluation in order. */
  readonly evaluationDigests: readonly Sha256Digest[];
  /** Authenticated lifecycle checkpoints in the same exact position order. */
  readonly checkpoints: readonly FailureExecutionCheckpointReferenceV1[];
}

/** Terminal bounded confirmation classification. */
export interface FailureConfirmationResultV1 {
  /** Closed result schema. */
  readonly revision: "failure-confirmation-result-v1";
  /** Stable source, stateful sequence, or flaky disposition. */
  readonly disposition: "confirmed-source-failure" | "stateful-sequence-failure" | "flaky-failure";
  /** Stable evidence digests from fresh candidate confirmation. */
  readonly confirmationDigests: readonly Sha256Digest[];
  /** Authenticated lifecycle checkpoints for the two fresh candidate runs. */
  readonly confirmationCheckpoints: readonly FailureExecutionCheckpointReferenceV1[];
  /** Ordered sequence evidence only when state is required to reproduce. */
  readonly sequenceEvidence?: StatefulSequenceEvidenceV1;
}

/** Bounded input for one dedicated sequence attempt. */
export interface BeginStatefulSequenceAttemptInputV1 {
  /** One-based attempt number within its confirmation session. */
  readonly attemptOrdinal: number;
  /** Authenticated original requests before the terminal candidate. */
  readonly precedingOriginals: readonly ExecutionRouteRequestV1[];
  /** Exact confirmation invocation at the failing position. */
  readonly terminalCandidate: ReductionCandidateInvocationV1;
  /** One-based position occupied by the terminal candidate. */
  readonly failingPosition: number;
  /** Exact worker lifetime, bounded to 64 cases. */
  readonly caseLimit: number;
}

/** Next legal stateful-sequence action. */
export type StatefulSequenceNextV1 =
  | { readonly kind: "execute"; readonly position: StatefulSequencePositionAuthorityV1 }
  | { readonly kind: "complete" };

/** Next legal confirmation-machine action. */
export type FailureConfirmationNextV1 =
  | {
      readonly kind: "execute-candidate" | "execute-control";
      readonly authority: FailureConfirmationStepAuthorityV1;
    }
  | {
      readonly kind: "execute-sequence-position";
      readonly authority: FailureConfirmationStepAuthorityV1;
      readonly attempt: StatefulSequenceAttemptAuthorityV1;
      readonly position: StatefulSequencePositionAuthorityV1;
    }
  | { readonly kind: "complete"; readonly result: FailureConfirmationResultV1 };

/** Shared function shape used by package-private report-sidecar access. */
export type FailureReportSidecarAccessorV1 = (
  report: ExecutionAuthorityReportV1,
) => ExecutionOperationResultV1<readonly FailurePredicateEvidenceV1[]>;
