import type { AuthorizedFailureEnvelopeV1 } from "./failure-envelope.js";
import type {
  FailureTransformationTraceEntryV1,
  FailureTransformationV1,
} from "./failure-transformation-model.js";
import type { ReductionSizeV1 } from "./reduction-candidate.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { digestReductionValueV1 } from "./reduction-value.js";

interface TraceAuthorityState {
  readonly envelope: AuthorizedFailureEnvelopeV1;
  readonly predecessor: FailureTransformationTraceEntryV1 | undefined;
  readonly beforeDigest: Sha256Digest;
  readonly afterDigest: Sha256Digest;
  readonly length: number;
  readonly digest: Sha256Digest;
}

const TRACE_STATES = new WeakMap<object, TraceAuthorityState>();
const EMPTY_TRACE_DIGEST = digestReductionValueV1({ revision: "failure-trace-chain-v1" });

/** Mints one passive trace entry bound privately to the exact accepted candidate transition. */
export function createFailureTransformationTraceEntryV1(
  envelope: AuthorizedFailureEnvelopeV1,
  previousTrace: readonly FailureTransformationTraceEntryV1[],
  beforeDigest: Sha256Digest,
  afterDigest: Sha256Digest,
  catalogOrdinal: number,
  transformation: FailureTransformationV1,
  beforeSize: ReductionSizeV1,
  afterSize: ReductionSizeV1,
  candidateDigest: Sha256Digest,
): FailureTransformationTraceEntryV1 {
  const entry: FailureTransformationTraceEntryV1 = Object.freeze({
    revision: "failure-transformation-trace-entry-v1",
    catalogOrdinal,
    transformation,
    beforeSize,
    afterSize,
    candidateDigest,
  });
  const previous = previousTrace.at(-1);
  const previousState = previous === undefined ? undefined : TRACE_STATES.get(previous);
  if (
    (previousTrace.length === 0 && previous !== undefined) ||
    (previousTrace.length > 0 &&
      (previousState === undefined ||
        previousState.envelope !== envelope ||
        previousState.length !== previousTrace.length ||
        previousState.afterDigest !== beforeDigest))
  ) {
    throw new TypeError("Failure trace entries require one exact reducer-owned predecessor chain.");
  }
  const previousDigest = previousState?.digest ?? EMPTY_TRACE_DIGEST;
  const chainDigest = digestReductionValueV1({
    revision: "failure-trace-chain-v1",
    previousDigest,
    entry,
  });
  TRACE_STATES.set(entry, {
    envelope,
    predecessor: previous,
    beforeDigest,
    afterDigest,
    length: previousTrace.length + 1,
    digest: chainDigest,
  });
  return entry;
}

/** Proves that trace entries form one reducer-minted chain for the supplied envelope. */
export function validateFailureTransformationTraceV1(
  envelope: AuthorizedFailureEnvelopeV1,
  trace: readonly unknown[],
  finalCandidateDigest: Sha256Digest,
  requireFinalCandidate = true,
): boolean {
  const last = trace.at(-1);
  if (last === undefined) return true;
  const state = typeof last === "object" && last !== null ? TRACE_STATES.get(last) : undefined;
  if (
    state === undefined ||
    state.envelope !== envelope ||
    state.length !== trace.length ||
    (requireFinalCandidate && state.afterDigest !== finalCandidateDigest)
  ) {
    return false;
  }
  return hasExactTracePredecessorChain(trace, state);
}

/** Returns the append-only digest retained by a genuine reducer-owned trace chain. */
export function failureTransformationTraceDigestV1(
  trace: readonly unknown[],
): Sha256Digest | undefined {
  const last = trace.at(-1);
  if (last === undefined) return EMPTY_TRACE_DIGEST;
  const state = typeof last === "object" && last !== null ? TRACE_STATES.get(last) : undefined;
  return state?.length === trace.length && hasExactTracePredecessorChain(trace, state)
    ? state.digest
    : undefined;
}

/** Checks every supplied position against the private identity chain minted during append. */
function hasExactTracePredecessorChain(
  trace: readonly unknown[],
  finalState: TraceAuthorityState,
): boolean {
  const finalEntry = trace.at(-1);
  if (typeof finalEntry !== "object" || finalEntry === null) return false;
  let expectedEntry: object | undefined = finalEntry;
  let expectedState: TraceAuthorityState | undefined = finalState;
  for (let index = trace.length - 1; index >= 0; index -= 1) {
    const suppliedEntry = trace[index];
    if (
      expectedEntry === undefined ||
      suppliedEntry !== expectedEntry ||
      expectedState === undefined ||
      expectedState.length !== index + 1
    ) {
      return false;
    }
    expectedEntry = expectedState.predecessor;
    expectedState = expectedEntry === undefined ? undefined : TRACE_STATES.get(expectedEntry);
  }
  return expectedEntry === undefined;
}
