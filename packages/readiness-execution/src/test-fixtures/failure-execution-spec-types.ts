/** Digest spelling used by the fixture's local protocol projections. */
export type FailureExecutionSpecDigestV1 = `sha256:${string}`;

/** Dynamically loaded API surface used before planned modules exist. */
export type FailureExecutionSpecApiV1 = Readonly<Record<string, unknown>>;

/** Immutable structural projection used for specification assertions. */
export type FailureExecutionSpecDataV1 = Readonly<Record<string, unknown>>;

/** Closed success/failure result used by dynamically loaded operations. */
export type FailureExecutionSpecResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly issues?: readonly { readonly code: string; readonly path: string }[];
      readonly diagnostics?: readonly { readonly code: string; readonly path: string }[];
    };

/** Planned public and package-private surfaces exercised by the oracle. */
export interface FailureExecutionProtocolApisV1 {
  readonly execution: FailureExecutionSpecApiV1;
  readonly internals: FailureExecutionSpecApiV1;
  readonly readiness: FailureExecutionSpecApiV1;
  readonly reduction: FailureExecutionSpecApiV1;
  readonly reports: FailureExecutionSpecApiV1;
  readonly published: FailureExecutionSpecApiV1;
}

/** Candidate evaluation projection returned by genuine route execution. */
export interface FailureExecutionCandidateEvaluationV1 extends FailureExecutionSpecDataV1 {
  readonly revision: "reduction-candidate-evaluation-v1";
  readonly evaluationTokenDigest: FailureExecutionSpecDigestV1;
  readonly result: FailureExecutionSpecDataV1;
  readonly predicateEvidence: FailureExecutionSpecDataV1;
  readonly digest: FailureExecutionSpecDigestV1;
}

/** Terminal confirmation projection returned by the bounded state machine. */
export interface FailureExecutionConfirmationResultV1 extends FailureExecutionSpecDataV1 {
  readonly revision: "failure-confirmation-result-v1";
  readonly disposition: "confirmed-source-failure" | "stateful-sequence-failure" | "flaky-failure";
  readonly confirmationDigests: readonly FailureExecutionSpecDigestV1[];
  readonly confirmationCheckpoints: readonly FailureExecutionCheckpointReferenceV1[];
  readonly sequenceEvidence?: FailureExecutionSpecDataV1;
}

/** Identity-only reference binding final evidence to one authenticated execution checkpoint. */
export interface FailureExecutionCheckpointReferenceV1 {
  readonly digest: FailureExecutionSpecDigestV1;
  readonly reportPosition: number;
  readonly attemptOrdinal: number;
  readonly position: number;
}

/** Authenticated activity checkpoint visible to isolation specifications. */
export interface FailureExecutionObservationV1 extends FailureExecutionSpecDataV1 {
  readonly revision: "failure-execution-observation-v1";
  readonly mode: "campaign-shared" | "standalone" | "sequence-attempt";
  readonly admitted: boolean;
  readonly launched: boolean;
  readonly attemptOrdinal: number;
  readonly position: number;
  readonly rootIdentity?: FailureExecutionSpecDigestV1;
  readonly workerIdentity?: number;
  readonly isolateIdentity?: FailureExecutionSpecDigestV1;
}

/** One opaque step issued by the confirmation state machine. */
export interface FailureExecutionConfirmationStepV1 extends FailureExecutionSpecDataV1 {
  readonly kind: "execute-candidate" | "execute-control" | "execute-sequence-position" | "complete";
  readonly authority?: object;
  readonly attempt?: object;
  readonly position?: object;
  readonly result?: FailureExecutionConfirmationResultV1;
}

/** Deterministic confirmation histories available to the failure-execution oracle. */
export type FailureExecutionSpecScenarioV1 =
  | "standalone-stable"
  | "direct-shrink-stable"
  | "sequence-only"
  | "flaky"
  | "infrastructure-with-passing-control";

/** Optional bounded sequence shape for a controlled confirmation history. */
export interface FailureExecutionSpecFixtureOptionsV1 {
  readonly failingPosition?: number;
  readonly sequenceLength?: number;
  readonly subjectTier?: "frontend" | "acme" | "vice";
  readonly candidateFamily?: "typed-valid" | "typed-invalid";
  readonly rejectOwnedShutdownOrdinal?: number;
  readonly includeForeignToolOrigin?: boolean;
}

/** One worker request observed outside the production execution coordinator. */
export interface FailureExecutionSpecWorkerRequestV1 {
  readonly caseIdentity: string;
  readonly tier: "frontend" | "compiler-api" | "cli" | "emit";
  readonly workerIdentity: number;
  readonly dedicated: boolean;
}

/** Activity emitted by real worker threads and child processes owned by one fixture. */
export interface FailureExecutionSpecActivityV1 {
  readonly workerThreads: number[];
  readonly isolateIdentities: FailureExecutionSpecDigestV1[];
  readonly rootIdentities: FailureExecutionSpecDigestV1[];
  readonly processLaunches: number[];
  readonly workerRequests: FailureExecutionSpecWorkerRequestV1[];
  readonly ownedShutdownAttempts: number[];
  readonly viceLauncherInjections: number[];
  readonly viceLauncherArmTransitions: ("armed" | "consumed")[];
}

/** Genuine envelope and candidate authorities that differ from one exact report occurrence. */
export interface FailureExecutionSpecMismatchAuthoritiesV1 {
  readonly predicate: object;
  readonly observation: object;
  readonly cleanup: object;
  readonly routePlan: object;
  readonly tool?: object;
  readonly candidate?: object;
}

/** Genuine authority inputs plus independently observable isolation activity. */
export interface FailureExecutionSpecFixtureV1 {
  readonly apis: FailureExecutionProtocolApisV1;
  readonly parent: object;
  readonly execution: object;
  readonly originalRequest: object;
  readonly controlRequest?: object;
  readonly confirmationControlPosition?: object;
  readonly report: FailureExecutionSpecDataV1;
  readonly reportPositions: readonly object[];
  readonly subjectPosition: object;
  readonly subjectIndex: number;
  readonly originatingCaseIdentities: readonly string[];
  readonly origin: object;
  readonly candidate: object;
  readonly budget: object;
  readonly mismatchAuthorities: FailureExecutionSpecMismatchAuthoritiesV1;
  readonly expectedDisposition:
    | "confirmed-source-failure"
    | "stateful-sequence-failure"
    | "flaky-failure";
  readonly expectedFailingPosition?: number;
  readonly activity: FailureExecutionSpecActivityV1;
  readonly localViceEvidence?: FailureExecutionSpecDataV1;
  cleanup(): Promise<void>;
}
