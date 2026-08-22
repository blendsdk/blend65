import { createHash, type Hash } from "node:crypto";

import type { ExecutionOperationResultV1 } from "@blend65/readiness";

import type { ExecutionDeadlineV1 } from "./execution-budget.js";
import { createExecutionProcessRuntimeV1 } from "./execution-process-kernel.js";
import type { ExecutionCancellationV1 } from "./execution-worker-protocol.js";

export {
  EXECUTION_PROCESS_KERNEL_LIMITS_V1,
  createExecutionProcessRuntimeV1,
  runExecutionProcessAnchorV1,
  type ExecutionAnchorSpawnInputV1,
  type ExecutionControlReadV1,
  type ExecutionGroupMembershipQueryV1,
  type ExecutionGroupMembershipV1,
  type ExecutionHostProcessExitV1,
  type ExecutionHostProcessIdentityV1,
  type ExecutionProcessAnchorFrameBaseV1,
  type ExecutionProcessAnchorFrameV1,
  type ExecutionProcessAnchorHostV1,
  type ExecutionProcessAnchorTransportV1,
  type ExecutionProcessControlTransportV1,
  type ExecutionProcessEnvironmentV1,
  type ExecutionProcessParentFrameV1,
  type ExecutionProcessParentHostV1,
  type ExecutionProcessWireIdentityV1,
  type ExecutionSelfGroupSignalV1,
  type ExecutionSpawnedAnchorV1,
  type ExecutionSpawnedTargetV1,
  type ExecutionTargetSpawnInputV1,
} from "./execution-process-kernel.js";

/** Independent bounded evidence for one child stream. */
export interface ExecutionStreamEvidenceV1 {
  readonly stream: "stdout" | "stderr";
  readonly totalBytes: number;
  readonly sha256: string;
  readonly head: Uint8Array;
  readonly tail: Uint8Array;
  readonly truncated: boolean;
}

/** Diagnostic stream evidence in fixed stdout-then-stderr order. */
export interface ExecutionProcessEvidenceV1 {
  readonly stdout: ExecutionStreamEvidenceV1;
  readonly stderr: ExecutionStreamEvidenceV1;
}

/** Authority-safe process evidence. Flood scheduling details are deliberately absent. */
export type ExecutionAuthoritativeProcessEvidenceV1 =
  | {
      readonly kind: "finite-streams";
      readonly stdout: ExecutionStreamEvidenceV1;
      readonly stderr: ExecutionStreamEvidenceV1;
    }
  | {
      readonly kind: "terminated-output-exhaustion";
      readonly code: "output-exhaustion";
      readonly configuredLimit: number;
      readonly cleanupDigest: string;
    };

/** Safe argv-only process launch request. */
export interface ExecutionProcessRequestV1 {
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly deadline: ExecutionDeadlineV1;
}

/** Positive child-start identity retained without a signal capability. */
export interface ExecutionChildIdentityV1 {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: bigint;
  readonly processGroupId: number;
  readonly sessionId?: number;
}

/** Raw process exit observed after both streams close. */
export interface ExecutionProcessExitV1 {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
}

/** Streaming callbacks continuously drained by the supervisor. */
export interface ExecutionProcessSinkV1 {
  onStdout(bytes: Uint8Array): void;
  onStderr(bytes: Uint8Array): void;
}

/** Conservative process-group ownership observation. */
export type ExecutionProcessOwnershipV1 = "absent" | "present" | "unknown";

/** Parent-owned process authority implemented over a live anchor. */
export interface ExecutionProcessHandleV1 {
  readonly identity: ExecutionChildIdentityV1;
  readonly completion: Promise<ExecutionProcessExitV1>;
  revalidateIdentity(): Promise<ExecutionProcessOwnershipV1 | boolean>;
  terminate(signal: NodeJS.Signals): Promise<void>;
  waitForGroupExit?(deadlineMonotonicMs: number): Promise<boolean>;
}

/** Replaceable argv-only process boundary. */
export interface ExecutionProcessRuntimeV1 {
  start(
    request: ExecutionProcessRequestV1,
    sink: ExecutionProcessSinkV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionOperationResultV1<ExecutionProcessHandleV1>>;
}

/** Completed bounded child-process evidence. */
export interface ExecutionProcessOutcomeV1 {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly childIdentity: ExecutionChildIdentityV1;
  readonly authority: ExecutionAuthoritativeProcessEvidenceV1;
  readonly diagnosticStreams: ExecutionProcessEvidenceV1;
}

const SAMPLE_BYTES = 4_096;

interface StreamCollector {
  readonly stream: "stdout" | "stderr";
  readonly hash: Hash;
  totalBytes: number;
  readonly head: Uint8Array;
  headLength: number;
  readonly tailRing: Uint8Array;
  tailLength: number;
  tailCursor: number;
}

/** Internal aggregate stream collector with a single irreversible limit. */
export interface ExecutionStreamCollectorV1 extends ExecutionProcessSinkV1 {
  readonly exhausted: boolean;
  /** Resolves exactly once when the first aggregate excess is observed. */
  readonly exhaustion: Promise<void>;
  readonly totalBytes: number;
  summarize(): ExecutionProcessEvidenceV1;
}

function updateSample(target: StreamCollector, bytes: Uint8Array): void {
  target.hash.update(bytes);
  target.totalBytes += bytes.byteLength;
  if (target.headLength < SAMPLE_BYTES) {
    const take = Math.min(SAMPLE_BYTES - target.headLength, bytes.byteLength);
    target.head.set(bytes.subarray(0, take), target.headLength);
    target.headLength += take;
  }
  if (bytes.byteLength >= SAMPLE_BYTES) {
    target.tailRing.set(bytes.subarray(bytes.byteLength - SAMPLE_BYTES));
    target.tailCursor = 0;
    target.tailLength = SAMPLE_BYTES;
    return;
  }
  const first = Math.min(bytes.byteLength, SAMPLE_BYTES - target.tailCursor);
  target.tailRing.set(bytes.subarray(0, first), target.tailCursor);
  if (first < bytes.byteLength) target.tailRing.set(bytes.subarray(first), 0);
  target.tailCursor = (target.tailCursor + bytes.byteLength) % SAMPLE_BYTES;
  target.tailLength = Math.min(SAMPLE_BYTES, target.tailLength + bytes.byteLength);
}

function summarizeStream(target: StreamCollector): ExecutionStreamEvidenceV1 {
  const tail = new Uint8Array(target.tailLength);
  const start = (target.tailCursor - target.tailLength + SAMPLE_BYTES) % SAMPLE_BYTES;
  const first = Math.min(target.tailLength, SAMPLE_BYTES - start);
  tail.set(target.tailRing.subarray(start, start + first));
  if (first < target.tailLength) {
    tail.set(target.tailRing.subarray(0, target.tailLength - first), first);
  }
  return Object.freeze({
    stream: target.stream,
    totalBytes: target.totalBytes,
    sha256: `sha256:${target.hash.copy().digest("hex")}`,
    head: target.head.slice(0, target.headLength),
    tail,
    truncated: target.totalBytes > target.headLength + target.tailLength,
  });
}

/**
 * Creates a fixed-memory collector with one aggregate stdout/stderr bound.
 *
 * @example
 * ```ts
 * const collector = createExecutionStreamCollectorV1(1024);
 * ```
 */
export function createExecutionStreamCollectorV1(limitBytes: number): ExecutionStreamCollectorV1 {
  const createStream = (stream: "stdout" | "stderr"): StreamCollector => ({
    stream,
    hash: createHash("sha256"),
    totalBytes: 0,
    head: new Uint8Array(SAMPLE_BYTES),
    headLength: 0,
    tailRing: new Uint8Array(SAMPLE_BYTES),
    tailLength: 0,
    tailCursor: 0,
  });
  const stdout = createStream("stdout");
  const stderr = createStream("stderr");
  let totalBytes = 0;
  let exhausted = false;
  let resolveExhaustion = (): void => undefined;
  const exhaustion = new Promise<void>((resolve) => {
    resolveExhaustion = resolve;
  });
  const append = (target: StreamCollector, bytes: Uint8Array): void => {
    if (exhausted) return;
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > limitBytes - totalBytes) {
      exhausted = true;
      totalBytes = Math.min(Number.MAX_SAFE_INTEGER, totalBytes + (bytes?.byteLength ?? 0));
      resolveExhaustion();
      return;
    }
    updateSample(target, bytes);
    totalBytes += bytes.byteLength;
  };
  return Object.freeze({
    get exhausted(): boolean {
      return exhausted;
    },
    exhaustion,
    get totalBytes(): number {
      return totalBytes;
    },
    onStdout(bytes: Uint8Array): void {
      append(stdout, bytes);
    },
    onStderr(bytes: Uint8Array): void {
      append(stderr, bytes);
    },
    summarize(): ExecutionProcessEvidenceV1 {
      return Object.freeze({ stdout: summarizeStream(stdout), stderr: summarizeStream(stderr) });
    },
  });
}

/** Production process runtime backed by a detached trusted Node anchor. */
export const defaultExecutionProcessRuntimeV1: ExecutionProcessRuntimeV1 =
  createExecutionProcessRuntimeV1();
