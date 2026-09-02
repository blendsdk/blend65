import { createHash } from "node:crypto";

import type {
  ExecutionOperationResultV1,
  ExecutionResultV1,
  FailurePredicateV1,
  PublishedSnapshot,
} from "@blend65/readiness";
import {
  getFreshReductionCandidateInvocationStateV1,
  type ReductionExecutionPayloadV1,
  type ReductionCandidateInvocationV1,
} from "@blend65/readiness/failure-reduction-internals";

import type { ExecutionAuthorityContextV1 } from "./execution-publication-catalog.js";
import {
  isGenuineExecutionRouteRequestV1,
  type ExecutionRouteRequestV1,
} from "./execution-route-adapters.js";
import {
  getFailureConfirmationContextStateV1,
  type FailureConfirmationContextStateV1,
} from "./failure-confirmation-context.js";
import type { ExecutionReportOccurrenceStateV1 } from "./execution-report-provenance.js";
import {
  createDedicatedExecutionWorkerExecutorV1,
  createExecutionWorkerExecutorV1,
} from "./execution-worker-executor.js";
import type {
  ExecutionCancellationV1,
  ExecutionWorkerExecutorV1,
  ExecutionWorkerHandleV1,
  ExecutionWorkerRequestV1,
} from "./execution-worker-protocol.js";
import { recordFailureSequenceEvaluationV1 } from "./failure-confirmation-evaluation.js";
import { deriveFailureExecutionObservationV1 } from "./failure-execution-observation.js";
import {
  failureExecutionIssueV1 as issue,
  failureExecutionSuccessV1 as success,
  snapshotExactFailureExecutionInputV1 as exactInput,
} from "./failure-execution-operation.js";
import {
  FAILURE_EXECUTION_CONTROL_AUTHORITY_V1,
  FAILURE_EXECUTION_PROTOCOL_V1,
  REDUCTION_EXECUTION_ISOLATION_V1,
  STATEFUL_SEQUENCE_ATTEMPT_AUTHORITY_V1,
  STATEFUL_SEQUENCE_POSITION_AUTHORITY_V1,
  type BeginStatefulSequenceAttemptInputV1,
  type FailureExecutionControlAuthorityV1,
  type FailureExecutionObservationV1,
  type FailureExecutionOperationResultV1,
  type FailureExecutionProtocolV1,
  type FailureConfirmationContextAuthorityV1,
  type ReductionExecutionIsolationV1,
  type StatefulSequenceAttemptAuthorityV1,
  type StatefulSequenceNextV1,
  type StatefulSequencePositionAuthorityV1,
} from "./failure-execution-types.js";

interface ProtocolStateV1 {
  readonly context: FailureConfirmationContextStateV1;
  readonly parent: PublishedSnapshot;
  readonly execution: ExecutionAuthorityContextV1;
  readonly originalRequest: ExecutionRouteRequestV1;
  readonly isolations: Set<ReductionExecutionIsolationV1>;
  lifecycle: "live" | "closing" | "closed";
  nextStandaloneAttempt: number;
}

interface IsolationStateV1 {
  readonly protocol: FailureExecutionProtocolV1;
  readonly mode: FailureExecutionObservationV1["mode"];
  readonly executor: ExecutionWorkerExecutorV1;
  readonly ownedExecutor: ExecutionWorkerExecutorV1;
  readonly subject?: ReductionCandidateInvocationV1 | FailureExecutionControlAuthorityV1;
  readonly attempt?: StatefulSequenceAttemptAuthorityV1;
  readonly attemptOrdinal: number;
  readonly isolationOrdinal: number;
  admitted: boolean;
  launched: boolean;
  rootIdentity?: `sha256:${string}`;
  workerIdentity?: number;
  isolateIdentity?: `sha256:${string}`;
  used: boolean;
  lifecycle: "live" | "shutting-down" | "shut-down";
  shutdown?: Promise<unknown>;
}

interface ControlStateV1 {
  readonly protocol: FailureExecutionProtocolV1;
  readonly request: ExecutionRouteRequestV1;
}

interface SequenceAttemptStateV1 {
  readonly protocol: FailureExecutionProtocolV1;
  readonly isolation: ReductionExecutionIsolationV1;
  readonly attemptOrdinal: number;
  readonly precedingOriginals: readonly ExecutionRouteRequestV1[];
  readonly terminalCandidate: ReductionCandidateInvocationV1;
  readonly failingPosition: number;
  readonly caseLimit: number;
  nextPosition: number;
  pending: StatefulSequencePositionAuthorityV1 | undefined;
  complete: boolean;
}

interface SequencePositionStateV1 {
  readonly protocol: FailureExecutionProtocolV1;
  readonly attempt: StatefulSequenceAttemptAuthorityV1;
  readonly position: number;
  readonly subject: ExecutionRouteRequestV1 | ReductionCandidateInvocationV1;
  rootIdentity?: `sha256:${string}`;
  workerIdentity?: number;
  isolateIdentity?: `sha256:${string}`;
  recorded: boolean;
}

const PROTOCOLS = new WeakMap<object, ProtocolStateV1>();
const ISOLATIONS = new WeakMap<object, IsolationStateV1>();
const CONTROLS = new WeakMap<object, ControlStateV1>();
const ATTEMPTS = new WeakMap<object, SequenceAttemptStateV1>();
const POSITIONS = new WeakMap<object, SequencePositionStateV1>();
let nextIsolationOrdinal = 1;

function protocolState(protocol: FailureExecutionProtocolV1): ProtocolStateV1 | undefined {
  const state =
    typeof protocol === "object" && protocol !== null ? PROTOCOLS.get(protocol) : undefined;
  return state?.lifecycle === "live" ? state : undefined;
}

function candidateMatchesProtocol(
  invocation: ReductionCandidateInvocationV1,
  protocol: ProtocolStateV1,
  purpose?: ReductionCandidateInvocationV1["purpose"],
): boolean {
  const retained = getFreshReductionCandidateInvocationStateV1(invocation);
  return (
    retained !== undefined &&
    (purpose === undefined || retained.purpose === purpose) &&
    JSON.stringify(retained.candidate.originalRoute) ===
      JSON.stringify(protocol.context.predicate.routeContract) &&
    JSON.stringify(retained.candidate.predicate) === JSON.stringify(protocol.context.predicate)
  );
}

/** Opens one exact historical-route execution protocol without accepting callbacks or paths. */
export function openFailureExecutionProtocolV1(
  context: FailureConfirmationContextAuthorityV1,
): FailureExecutionOperationResultV1<FailureExecutionProtocolV1> {
  const retained = getFailureConfirmationContextStateV1(context);
  if (retained === undefined) {
    return issue("unbound-capability", "/context", "Confirmation context is not genuine.");
  }
  const protocol: FailureExecutionProtocolV1 = Object.freeze({
    [FAILURE_EXECUTION_PROTOCOL_V1]: true as const,
  });
  PROTOCOLS.set(protocol, {
    context: retained,
    parent: retained.subject.parent,
    execution: retained.subject.execution,
    originalRequest: retained.subject.request,
    isolations: new Set(),
    lifecycle: "live",
    nextStandaloneAttempt: 1,
  });
  return success(protocol);
}

function mintIsolation(
  protocol: FailureExecutionProtocolV1,
  mode: IsolationStateV1["mode"],
  executor: ExecutionWorkerExecutorV1,
  subject?: ReductionCandidateInvocationV1 | FailureExecutionControlAuthorityV1,
  attempt?: StatefulSequenceAttemptAuthorityV1,
  attemptOrdinal = 0,
): ExecutionOperationResultV1<ReductionExecutionIsolationV1> {
  const owner = protocolState(protocol);
  if (owner === undefined) {
    return issue("unbound-capability", "/protocol", "Failure execution protocol is unavailable.");
  }
  const retainedExecutor = executor;
  const routeExecutor: ExecutionWorkerExecutorV1 = Object.freeze({
    async start(request: ExecutionWorkerRequestV1, cancellation: ExecutionCancellationV1) {
      if (retainedIsolation.lifecycle !== "live") {
        return issue<ExecutionWorkerHandleV1>(
          "unbound-capability",
          "/isolation",
          "Isolation is shutting down.",
        );
      }
      const started = await retainedExecutor.start(request, cancellation);
      if (started.ok && retainedIsolation.lifecycle === "live") {
        const rootIdentity = `sha256:${createHash("sha256")
          .update("blend65-failure-execution-root-v1\0")
          .update(request.caseRoot)
          .digest("hex")}` as const;
        retainedIsolation.launched = true;
        retainedIsolation.rootIdentity = rootIdentity;
        if (started.value.workerIdentity !== undefined) {
          retainedIsolation.workerIdentity = started.value.workerIdentity;
          retainedIsolation.isolateIdentity ??= `sha256:${createHash("sha256")
            .update("blend65-failure-execution-isolate-v1\0")
            .update(String(retainedIsolation.isolationOrdinal))
            .update("\0")
            .update(String(started.value.workerIdentity))
            .digest("hex")}` as const;
        }
      }
      if (!started.ok || started.value.release !== undefined) return started;
      return success(
        Object.freeze({
          ...started.value,
          release: async () => undefined,
        }),
      );
    },
    shutdown: async () => undefined,
  });
  const isolation: ReductionExecutionIsolationV1 = Object.freeze({
    [REDUCTION_EXECUTION_ISOLATION_V1]: true as const,
  });
  const retainedIsolation: IsolationStateV1 = {
    protocol,
    mode,
    executor: routeExecutor,
    ownedExecutor: retainedExecutor,
    ...(subject === undefined ? {} : { subject }),
    ...(attempt === undefined ? {} : { attempt }),
    attemptOrdinal,
    isolationOrdinal: nextIsolationOrdinal,
    admitted: true,
    launched: false,
    used: false,
    lifecycle: "live",
  };
  nextIsolationOrdinal += 1;
  ISOLATIONS.set(isolation, retainedIsolation);
  owner.isolations.add(isolation);
  return success(isolation);
}

function ownerReportPosition(
  protocol: FailureExecutionProtocolV1,
  isolation: IsolationStateV1,
): number {
  const owner = protocolState(protocol);
  if (owner === undefined) return 0;
  const control =
    isolation.subject === undefined ? undefined : CONTROLS.get(isolation.subject as object);
  return control === undefined
    ? owner.context.subject.index + 1
    : (owner.context.control?.index ?? -1) + 1;
}

function reportPositionForSequence(
  protocol: FailureExecutionProtocolV1,
  position: SequencePositionStateV1,
): number {
  const owner = protocolState(protocol);
  if (owner === undefined) return 0;
  if (!isGenuineExecutionRouteRequestV1(position.subject)) {
    return owner.context.subject.index + 1;
  }
  const occurrence = owner.context.preceding.find(
    (candidate) => candidate.request === position.subject,
  );
  return (occurrence?.index ?? -1) + 1;
}

/** Mints one reusable campaign-bound isolation capability for ordinary reduction. */
export function mintCampaignFailureExecutionIsolationV1(
  protocol: FailureExecutionProtocolV1,
): ExecutionOperationResultV1<ReductionExecutionIsolationV1> {
  return mintIsolation(protocol, "campaign-shared", createExecutionWorkerExecutorV1());
}

/** Mints one fresh single-invocation worker isolation. */
export function mintStandaloneFailureExecutionIsolationV1(
  protocol: FailureExecutionProtocolV1,
  subject: ReductionCandidateInvocationV1 | FailureExecutionControlAuthorityV1,
): ExecutionOperationResultV1<ReductionExecutionIsolationV1> {
  const owner = protocolState(protocol);
  const control =
    typeof subject === "object" && subject !== null ? CONTROLS.get(subject) : undefined;
  if (
    owner === undefined ||
    typeof subject !== "object" ||
    subject === null ||
    (!candidateMatchesProtocol(subject as ReductionCandidateInvocationV1, owner, "confirmation") &&
      control?.protocol !== protocol)
  ) {
    return issue("unbound-capability", "/subject", "Standalone subject is not genuine.");
  }
  const attemptOrdinal = owner.nextStandaloneAttempt;
  owner.nextStandaloneAttempt += 1;
  return mintIsolation(
    protocol,
    "standalone",
    createDedicatedExecutionWorkerExecutorV1(1),
    subject,
    undefined,
    attemptOrdinal,
  );
}

/** Creates one private dedicated worker used only to discover a bounded failing position. */
export function mintFailureExecutionProbeIsolationV1(
  protocol: FailureExecutionProtocolV1,
): ExecutionOperationResultV1<ReductionExecutionIsolationV1> {
  return mintIsolation(protocol, "sequence-attempt", createDedicatedExecutionWorkerExecutorV1(64));
}

/** Mints a distinct same-route original-case control authority. */
export function createFailureExecutionControlV1(
  protocol: FailureExecutionProtocolV1,
  request: ExecutionRouteRequestV1,
): ExecutionOperationResultV1<FailureExecutionControlAuthorityV1> {
  const owner = protocolState(protocol);
  if (owner === undefined || owner.context.control?.request !== request) {
    return issue(
      "unbound-capability",
      "/control",
      "Control must be the exact retained passing route.",
    );
  }
  const authority: FailureExecutionControlAuthorityV1 = Object.freeze({
    [FAILURE_EXECUTION_CONTROL_AUTHORITY_V1]: true as const,
  });
  CONTROLS.set(authority, { protocol, request });
  return success(authority);
}

/** Begins one bounded sequence with one terminal candidate at its failing position. */
export function beginStatefulSequenceAttemptV1(
  protocol: FailureExecutionProtocolV1,
  input: BeginStatefulSequenceAttemptInputV1,
): ExecutionOperationResultV1<StatefulSequenceAttemptAuthorityV1> {
  const owner = protocolState(protocol);
  const record = exactInput(input, [
    "attemptOrdinal",
    "precedingOriginals",
    "terminalCandidate",
    "failingPosition",
    "caseLimit",
  ]);
  if (
    owner === undefined ||
    record === undefined ||
    !Number.isSafeInteger(input.attemptOrdinal) ||
    input.attemptOrdinal < 1 ||
    !Number.isSafeInteger(input.failingPosition) ||
    !Number.isSafeInteger(input.caseLimit) ||
    input.failingPosition < 1 ||
    input.failingPosition > owner.context.sequenceLimit ||
    input.caseLimit !== input.failingPosition ||
    !Array.isArray(input.precedingOriginals) ||
    input.precedingOriginals.length !== input.failingPosition - 1 ||
    input.precedingOriginals.some(
      (request, index) => request !== owner.context.preceding[index]?.request,
    )
  ) {
    return issue(
      "execution-plan-capacity",
      "/sequence",
      "Sequence attempts require one terminal candidate within the selected case bound.",
    );
  }
  if (!candidateMatchesProtocol(input.terminalCandidate, owner, "confirmation")) {
    return issue(
      "unbound-capability",
      "/sequence/terminalCandidate",
      "Sequence terminal candidate is foreign, stale, or has the wrong purpose.",
    );
  }
  const attempt: StatefulSequenceAttemptAuthorityV1 = Object.freeze({
    [STATEFUL_SEQUENCE_ATTEMPT_AUTHORITY_V1]: true as const,
  });
  const isolated = mintIsolation(
    protocol,
    "sequence-attempt",
    createDedicatedExecutionWorkerExecutorV1(input.caseLimit),
    undefined,
    attempt,
    input.attemptOrdinal,
  );
  if (!isolated.ok) return isolated;
  ATTEMPTS.set(attempt, {
    protocol,
    isolation: isolated.value,
    attemptOrdinal: input.attemptOrdinal,
    precedingOriginals: Object.freeze([...input.precedingOriginals]),
    terminalCandidate: input.terminalCandidate,
    failingPosition: input.failingPosition,
    caseLimit: input.caseLimit,
    nextPosition: 1,
    pending: undefined,
    complete: false,
  });
  return success(attempt);
}

/** Issues only the next legal position from one dedicated sequence attempt. */
export function nextStatefulSequencePositionV1(
  protocol: FailureExecutionProtocolV1,
  attempt: StatefulSequenceAttemptAuthorityV1,
): ExecutionOperationResultV1<StatefulSequenceNextV1> {
  const state = typeof attempt === "object" && attempt !== null ? ATTEMPTS.get(attempt) : undefined;
  if (
    protocolState(protocol) === undefined ||
    state?.protocol !== protocol ||
    state.pending !== undefined
  ) {
    return issue("unbound-capability", "/sequence", "Sequence attempt is foreign or out of order.");
  }
  if (state.complete) {
    return issue(
      "execution-plan-capacity",
      "/sequence",
      "Sequence attempt has exhausted its selected case bound.",
    );
  }
  const position = state.nextPosition;
  const authority: StatefulSequencePositionAuthorityV1 = Object.freeze({
    [STATEFUL_SEQUENCE_POSITION_AUTHORITY_V1]: true as const,
  });
  POSITIONS.set(authority, {
    protocol,
    attempt,
    position,
    subject:
      position === state.failingPosition
        ? state.terminalCandidate
        : state.precedingOriginals[position - 1]!,
    recorded: false,
  });
  state.pending = authority;
  return success(Object.freeze({ kind: "execute" as const, position: authority }));
}

/** Records the exact issued sequence position once and advances strict order. */
export function recordStatefulSequencePositionV1(
  protocol: FailureExecutionProtocolV1,
  attempt: StatefulSequenceAttemptAuthorityV1,
  position: StatefulSequencePositionAuthorityV1,
  evaluation: object,
): ExecutionOperationResultV1<true> {
  const attemptState =
    typeof attempt === "object" && attempt !== null ? ATTEMPTS.get(attempt) : undefined;
  const positionState =
    typeof position === "object" && position !== null ? POSITIONS.get(position) : undefined;
  if (
    protocolState(protocol) === undefined ||
    attemptState?.protocol !== protocol ||
    positionState?.protocol !== protocol ||
    positionState.attempt !== attempt ||
    attemptState.pending !== position ||
    positionState.recorded
  ) {
    return issue(
      "unbound-capability",
      "/sequence/position",
      "Sequence position is foreign or replayed.",
    );
  }
  const checkpoint = recordFailureSequenceEvaluationV1(evaluation, protocol, attempt, position);
  if (checkpoint === undefined) {
    return issue(
      "unbound-capability",
      "/sequence/position",
      "Sequence evaluation is foreign, reordered, or replayed.",
    );
  }
  positionState.recorded = true;
  if (checkpoint.rootIdentity !== undefined) positionState.rootIdentity = checkpoint.rootIdentity;
  if (checkpoint.workerIdentity !== undefined) {
    positionState.workerIdentity = checkpoint.workerIdentity;
  }
  if (checkpoint.isolateIdentity !== undefined) {
    positionState.isolateIdentity = checkpoint.isolateIdentity;
  }
  attemptState.pending = undefined;
  attemptState.nextPosition += 1;
  if (positionState.position === attemptState.caseLimit) attemptState.complete = true;
  return success(true);
}

/** Returns a path-free authenticated activity projection for one owned subject. */
export function getFailureExecutionObservationV1(
  protocol: FailureExecutionProtocolV1,
  subject:
    | ReductionExecutionIsolationV1
    | StatefulSequenceAttemptAuthorityV1
    | StatefulSequencePositionAuthorityV1,
): ExecutionOperationResultV1<FailureExecutionObservationV1> {
  if (protocolState(protocol) === undefined) {
    return issue("unbound-capability", "/protocol", "Failure execution protocol is closed.");
  }
  const isolation =
    typeof subject === "object" && subject !== null ? ISOLATIONS.get(subject) : undefined;
  const attempt =
    typeof subject === "object" && subject !== null ? ATTEMPTS.get(subject) : undefined;
  const position =
    typeof subject === "object" && subject !== null ? POSITIONS.get(subject) : undefined;
  const attemptState = position === undefined ? attempt : ATTEMPTS.get(position.attempt);
  const ownedIsolation =
    isolation ?? (attemptState === undefined ? undefined : ISOLATIONS.get(attemptState.isolation));
  if (ownedIsolation?.protocol !== protocol) {
    return issue(
      "unbound-capability",
      "/subject",
      "Observed subject is not owned by this protocol.",
    );
  }
  const reportPosition =
    position === undefined
      ? ownerReportPosition(protocol, ownedIsolation)
      : reportPositionForSequence(protocol, position);
  const rootIdentity =
    position === undefined
      ? ownedIsolation.rootIdentity
      : (position.rootIdentity ?? ownedIsolation.rootIdentity);
  const workerIdentity =
    position === undefined
      ? ownedIsolation.workerIdentity
      : (position.workerIdentity ?? ownedIsolation.workerIdentity);
  const isolateIdentity =
    position === undefined
      ? ownedIsolation.isolateIdentity
      : (position.isolateIdentity ?? ownedIsolation.isolateIdentity);
  const attemptOrdinal = attemptState?.attemptOrdinal ?? ownedIsolation.attemptOrdinal;
  const sequencePosition = position?.position ?? 0;
  return success(
    deriveFailureExecutionObservationV1({
      mode: ownedIsolation.mode,
      admitted: ownedIsolation.admitted,
      launched: ownedIsolation.launched,
      attemptOrdinal,
      position: sequencePosition,
      reportPosition,
      ...(rootIdentity === undefined ? {} : { rootIdentity }),
      ...(workerIdentity === undefined ? {} : { workerIdentity }),
      ...(isolateIdentity === undefined ? {} : { isolateIdentity }),
    }),
  );
}

/** Shuts down one exact isolation and rejects later use. */
export async function shutdownFailureExecutionIsolationV1(
  protocol: FailureExecutionProtocolV1,
  isolation: ReductionExecutionIsolationV1,
): Promise<ExecutionOperationResultV1<true>> {
  const state =
    typeof isolation === "object" && isolation !== null ? ISOLATIONS.get(isolation) : undefined;
  if (
    protocolState(protocol) === undefined ||
    state?.protocol !== protocol ||
    state.lifecycle !== "live"
  ) {
    return issue("unbound-capability", "/isolation", "Isolation is foreign or already shut down.");
  }
  const settled = await Promise.allSettled([beginIsolationShutdown(state)]);
  state.lifecycle = "shut-down";
  const failed = settled.filter((entry) => entry.status === "rejected").length;
  return failed === 0
    ? success(true)
    : issue("execution.io", "/isolation/shutdown", String(failed));
}

function beginIsolationShutdown(state: IsolationStateV1): Promise<unknown> {
  if (state.shutdown !== undefined) return state.shutdown;
  state.lifecycle = "shutting-down";
  state.shutdown = Promise.resolve().then(() => state.ownedExecutor.shutdown?.());
  return state.shutdown;
}

/** Closes a protocol after shutting down every worker isolation it minted. */
export async function closeFailureExecutionProtocolV1(
  protocol: FailureExecutionProtocolV1,
): Promise<ExecutionOperationResultV1<true>> {
  const state =
    typeof protocol === "object" && protocol !== null ? PROTOCOLS.get(protocol) : undefined;
  if (state === undefined || state.lifecycle !== "live") {
    return issue(
      "unbound-capability",
      "/protocol",
      "Failure execution protocol is already closed.",
    );
  }
  state.lifecycle = "closing";
  const owned = [...state.isolations]
    .map((isolation) => ISOLATIONS.get(isolation))
    .filter((isolation): isolation is IsolationStateV1 => isolation !== undefined);
  const settled = await Promise.allSettled(
    owned.map((isolation) => beginIsolationShutdown(isolation)),
  );
  for (const isolation of owned) isolation.lifecycle = "shut-down";
  state.lifecycle = "closed";
  const failed = settled.filter((entry) => entry.status === "rejected").length;
  return failed === 0
    ? success(true)
    : issue("execution.io", "/isolation/shutdown", String(failed));
}

/** Resolves private protocol state for the route and confirmation coordinators. */
export function getFailureExecutionProtocolStateV1(
  protocol: FailureExecutionProtocolV1,
): ProtocolStateV1 | undefined {
  return protocolState(protocol);
}

/** Resolves a live isolation only for its exact owning protocol. */
export function getReductionExecutionIsolationStateV1(
  isolation: ReductionExecutionIsolationV1,
): IsolationStateV1 | undefined {
  const state =
    typeof isolation === "object" && isolation !== null ? ISOLATIONS.get(isolation) : undefined;
  return state === undefined ||
    state.lifecycle !== "live" ||
    protocolState(state.protocol) === undefined
    ? undefined
    : state;
}

/** Resolves a genuine control authority for the confirmation coordinator. */
export function getFailureExecutionControlStateV1(
  control: FailureExecutionControlAuthorityV1,
): ControlStateV1 | undefined {
  return typeof control === "object" && control !== null ? CONTROLS.get(control) : undefined;
}

/** Resolves an issued sequence position without exposing mutable attempt state. */
export function getStatefulSequencePositionStateV1(
  position: StatefulSequencePositionAuthorityV1,
): SequencePositionStateV1 | undefined {
  return typeof position === "object" && position !== null ? POSITIONS.get(position) : undefined;
}

/** Resolves a genuine sequence attempt for its fixed confirmation coordinator. */
export function getStatefulSequenceAttemptStateV1(
  attempt: StatefulSequenceAttemptAuthorityV1,
): SequenceAttemptStateV1 | undefined {
  return typeof attempt === "object" && attempt !== null ? ATTEMPTS.get(attempt) : undefined;
}

/** Marks a single-use isolation consumed after all subject checks succeed. */
export function consumeFailureExecutionIsolationV1(
  isolation: ReductionExecutionIsolationV1,
  subject: ReductionCandidateInvocationV1 | FailureExecutionControlAuthorityV1,
): ExecutionOperationResultV1<IsolationStateV1> {
  const state = getReductionExecutionIsolationStateV1(isolation);
  if (
    state === undefined ||
    (state.mode !== "campaign-shared" && (state.used || state.subject !== subject)) ||
    (state.mode === "campaign-shared" && state.subject !== undefined)
  ) {
    return issue("unbound-capability", "/isolation", "Isolation mode or subject does not match.");
  }
  if (state.mode !== "campaign-shared") state.used = true;
  return success(state);
}

/** Returns the original payload retained by the protocol for control and sequence probes. */
export function getFailureExecutionOriginalPayloadV1(
  protocol: FailureExecutionProtocolV1,
): ReductionExecutionPayloadV1 | undefined {
  return protocolState(protocol)?.context.originProjection.initialCandidate;
}

/** Returns the exact predicate retained by the protocol. */
export function getFailureExecutionPredicateV1(
  protocol: FailureExecutionProtocolV1,
): FailurePredicateV1 | undefined {
  return protocolState(protocol)?.context.predicate;
}

/** Resolves the exact retained report occurrence currently owned by one isolation. */
export function getFailureExecutionIsolationOccurrenceV1(
  isolation: ReductionExecutionIsolationV1,
): ExecutionReportOccurrenceStateV1 | undefined {
  const state = getReductionExecutionIsolationStateV1(isolation);
  if (state === undefined) return undefined;
  const owner = protocolState(state.protocol);
  if (owner === undefined) return undefined;
  const control = state.subject === undefined ? undefined : CONTROLS.get(state.subject as object);
  if (control !== undefined) return owner.context.control;
  const attempt = state.attempt === undefined ? undefined : ATTEMPTS.get(state.attempt);
  const position = attempt?.pending === undefined ? undefined : POSITIONS.get(attempt.pending);
  if (position !== undefined && isGenuineExecutionRouteRequestV1(position.subject)) {
    return owner.context.preceding.find((occurrence) => occurrence.request === position.subject);
  }
  return owner.context.subject;
}

/** Type anchor for sequence records accepting compatible execution results. */
export type FailureSequenceRecordedEvaluationV1 = ExecutionResultV1 | object;
