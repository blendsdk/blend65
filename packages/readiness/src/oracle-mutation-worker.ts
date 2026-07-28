import { isMainThread, parentPort, Worker } from "node:worker_threads";

import type { OracleMutationSelectionV1 } from "./oracle-conformance-v1.js";
import type { OracleMutantV1, OracleMutationFamilyV1 } from "./oracle-mutation-model.js";
import type { OracleDiagnostic } from "./oracle-model.js";

/** Closed worker or harness failures that never consume mutation kill credit. */
export type OracleMutationWorkerFailureV1 =
  | "worker-startup"
  | "worker-timeout"
  | "worker-crash"
  | "worker-protocol"
  | "worker-budget"
  | "harness-failure";

/** Failed stable-ID worker execution. */
export interface OracleMutationWorkerFailureResultV1 {
  /** Failure discriminator. */
  readonly ok: false;
  /** Closed worker or harness failure category. */
  readonly failure: OracleMutationWorkerFailureV1;
  /** Stable mutant identity. */
  readonly mutantId: string;
  /** Stable vector identity. */
  readonly vectorId: string;
  /** Bounded non-sensitive diagnostic. */
  readonly diagnostic: OracleDiagnostic;
}

/** Successful execution of one baseline/mutant assertion pair. */
export interface OracleMutationWorkerSuccessV1 {
  /** Success discriminator. */
  readonly ok: true;
  /** Stable mutant identity. */
  readonly mutantId: string;
  /** Stable vector identity. */
  readonly vectorId: string;
  /** Whether the independent assertion rejected the selected mutant. */
  readonly killed: boolean;
}

/** Result of one bounded stable-ID worker. */
export type OracleMutationWorkerResultV1 =
  | OracleMutationWorkerSuccessV1
  | OracleMutationWorkerFailureResultV1;

/** Finite worker-boundary probe modes. */
export type OracleMutationWorkerProbeModeV1 =
  | "timeout"
  | "crash"
  | "budget"
  | "invalid-protocol"
  | "baseline-mismatch";

interface MutationWorkerRequestV1 {
  readonly schemaVersion: 1;
  readonly mode: "mutation";
  readonly family: OracleMutationFamilyV1;
  readonly selection: OracleMutationSelectionV1;
  readonly vectorId: string;
}

interface ProbeWorkerRequestV1 {
  readonly schemaVersion: 1;
  readonly mode: OracleMutationWorkerProbeModeV1;
  readonly mutantId: string;
  readonly vectorId: string;
}

type WorkerRequestV1 = MutationWorkerRequestV1 | ProbeWorkerRequestV1;

interface WorkerSuccessMessageV1 {
  readonly schemaVersion: 1;
  readonly kind: "result";
  readonly mutantId: string;
  readonly vectorId: string;
  readonly baselinePassed: true;
  readonly killed: boolean;
}

interface WorkerFailureMessageV1 {
  readonly schemaVersion: 1;
  readonly kind: "failure";
  readonly failure: "worker-budget" | "harness-failure";
  readonly mutantId: string;
  readonly vectorId: string;
}

type WorkerResponseV1 = WorkerSuccessMessageV1 | WorkerFailureMessageV1;

interface WorkerReadyMessageV1 {
  readonly schemaVersion: 1;
  readonly kind: "ready";
}

const WORKER_URL = new URL("../dist/oracle-mutation-worker.js", import.meta.url);
const STARTUP_DEADLINE_MILLISECONDS = 1_000;
const MAX_DEADLINE_MILLISECONDS = 60_000;
const PROBE_MUTANT_ID = "mutant.worker.probe";
const PROBE_VECTOR_ID = "vector.worker.probe.v1";

function diagnostic(
  code: OracleDiagnostic["code"],
  path: string,
  message: string,
): OracleDiagnostic {
  return Object.freeze({ code, path, message: message.slice(0, 512) });
}

function failure(
  failureKind: OracleMutationWorkerFailureV1,
  mutantId: string,
  vectorId: string,
  message: string,
): OracleMutationWorkerFailureResultV1 {
  const code =
    failureKind === "worker-budget"
      ? "oracle.budget"
      : failureKind === "harness-failure"
        ? "oracle.contract.invalid"
        : "oracle.input.invalid";
  return Object.freeze({
    ok: false,
    failure: failureKind,
    mutantId,
    vectorId,
    diagnostic: diagnostic(code, "/mutationWorker", message),
  });
}

function validMutationRequest(
  value: unknown,
  model: typeof import("./oracle-mutation-model.js"),
): value is MutationWorkerRequestV1 {
  try {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Partial<MutationWorkerRequestV1>;
    if (
      candidate.schemaVersion !== 1 ||
      candidate.mode !== "mutation" ||
      typeof candidate.vectorId !== "string" ||
      typeof candidate.family !== "string" ||
      typeof candidate.selection !== "object" ||
      candidate.selection === null
    ) {
      return false;
    }
    const selected = candidate.selection as Partial<OracleMutationSelectionV1>;
    if (
      typeof selected.mutantId !== "string" ||
      typeof selected.operationId !== "string" ||
      typeof selected.pathId !== "string" ||
      typeof selected.variantId !== "string"
    ) {
      return false;
    }
    const path = model
      .oracleMutationPathRegistry()
      .paths.find(
        (registered) =>
          registered.family === candidate.family &&
          registered.operationId === selected.operationId &&
          registered.pathId === selected.pathId &&
          registered.variantId === selected.variantId,
      );
    return (
      path !== undefined &&
      model.oracleMutationIdForPath(path) === selected.mutantId &&
      model.oracleMutationVectorIdForPath(path) === candidate.vectorId
    );
  } catch {
    return false;
  }
}

async function runMutationWorker(request: unknown): Promise<void> {
  let mutantId = "";
  let vectorId = "";
  try {
    const [assertions, model] = await Promise.all([
      import("./oracle-mutation-assertions.js"),
      import("./oracle-mutation-model.js"),
    ]);
    if (!validMutationRequest(request, model)) {
      parentPort?.postMessage({ invalid: true });
      return;
    }
    mutantId = request.selection.mutantId;
    vectorId = request.vectorId;
    const resolved = await assertions.resolveOracleMutationAssertionRow(request.vectorId);
    const baseline = await assertions.runOracleMutationVectorForConformance(request.vectorId);
    if (!resolved.ok || !baseline.ok) throw new TypeError("mutation baseline unavailable");
    const baselineAssertion = assertions.evaluateOracleMutationAssertion(
      resolved.row.assertion,
      baseline.observation,
    );
    if (!baselineAssertion.ok || !baselineAssertion.passed) {
      throw new TypeError("mutation baseline assertion failed");
    }
    const mutant = await assertions.runOracleMutationVectorForConformance(
      request.vectorId,
      request.selection,
    );
    if (!mutant.ok) throw new TypeError("mutation vector failed");
    const mutantAssertion = assertions.evaluateOracleMutationAssertion(
      resolved.row.assertion,
      mutant.observation,
    );
    if (!mutantAssertion.ok) throw new TypeError("mutation assertion failed");
    const response: WorkerSuccessMessageV1 = Object.freeze({
      schemaVersion: 1,
      kind: "result",
      mutantId,
      vectorId,
      baselinePassed: true,
      killed: !mutantAssertion.passed,
    });
    parentPort?.postMessage(response);
  } catch {
    const response: WorkerFailureMessageV1 = Object.freeze({
      schemaVersion: 1,
      kind: "failure",
      failure: "harness-failure",
      mutantId,
      vectorId,
    });
    parentPort?.postMessage(response);
  }
}

async function runBaselineMismatchProbe(request: ProbeWorkerRequestV1): Promise<void> {
  try {
    const [assertions, model] = await Promise.all([
      import("./oracle-mutation-assertions.js"),
      import("./oracle-mutation-model.js"),
    ]);
    const path = model.oracleMutationPathRegistry().paths[0];
    if (path === undefined) throw new TypeError("missing mutation vector");
    const vectorId = model.oracleMutationVectorIdForPath(path);
    const [resolved, baseline] = await Promise.all([
      assertions.resolveOracleMutationAssertionRow(vectorId),
      assertions.runOracleMutationVectorForConformance(vectorId),
    ]);
    if (!resolved.ok || !baseline.ok) throw new TypeError("baseline probe unavailable");
    const assertion = assertions.evaluateOracleMutationAssertion(
      assertions.impossibleOracleMutationAssertion(resolved.row),
      baseline.observation,
    );
    if (!assertion.ok || assertion.passed) {
      throw new TypeError("baseline mismatch probe did not reject");
    }
  } catch {
    // Every probe-path defect remains a no-credit harness failure.
  }
  const response: WorkerFailureMessageV1 = Object.freeze({
    schemaVersion: 1,
    kind: "failure",
    failure: "harness-failure",
    mutantId: request.mutantId,
    vectorId: request.vectorId,
  });
  parentPort?.postMessage(response);
}

function runWorkerProcess(request: unknown): void {
  if (
    typeof request === "object" &&
    request !== null &&
    (request as Partial<MutationWorkerRequestV1>).mode === "mutation"
  ) {
    void runMutationWorker(request);
    return;
  }
  if (typeof request !== "object" || request === null) {
    parentPort?.postMessage({ invalid: true });
    return;
  }
  const probe = request as Partial<ProbeWorkerRequestV1>;
  if (probe.mode === "baseline-mismatch") {
    void runBaselineMismatchProbe(probe as ProbeWorkerRequestV1);
    return;
  }
  if (probe.mode === "timeout") {
    for (;;) {
      // The absolute parent deadline terminates this deliberately non-cooperative probe.
    }
  }
  if (probe.mode === "crash") {
    throw new Error("worker crash probe");
  }
  if (probe.mode === "budget") {
    parentPort?.postMessage({
      schemaVersion: 1,
      kind: "failure",
      failure: "worker-budget",
      mutantId: probe.mutantId,
      vectorId: probe.vectorId,
    });
    return;
  }
  parentPort?.postMessage({ schemaVersion: 99, kind: "unknown" });
}

function isWorkerResponse(value: unknown): value is WorkerResponseV1 {
  if (typeof value !== "object" || value === null) return false;
  const response = value as Partial<WorkerResponseV1>;
  if (
    response.schemaVersion !== 1 ||
    typeof response.mutantId !== "string" ||
    typeof response.vectorId !== "string"
  ) {
    return false;
  }
  return response.kind === "result"
    ? response.baselinePassed === true && typeof response.killed === "boolean"
    : response.kind === "failure" &&
        (response.failure === "worker-budget" || response.failure === "harness-failure");
}

function isWorkerReadyMessage(value: unknown): value is WorkerReadyMessageV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<WorkerReadyMessageV1>).schemaVersion === 1 &&
    (value as Partial<WorkerReadyMessageV1>).kind === "ready"
  );
}

function executeBoundedWorker(
  request: WorkerRequestV1,
  deadlineMilliseconds: number,
): Promise<OracleMutationWorkerResultV1> {
  const mutantId = request.mode === "mutation" ? request.selection.mutantId : request.mutantId;
  const vectorId = request.vectorId;
  if (
    !Number.isSafeInteger(deadlineMilliseconds) ||
    deadlineMilliseconds < 1 ||
    deadlineMilliseconds > MAX_DEADLINE_MILLISECONDS
  ) {
    return Promise.resolve(
      failure("harness-failure", mutantId, vectorId, "Worker deadline is outside fixed bounds."),
    );
  }
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(WORKER_URL);
    } catch {
      resolve(failure("worker-startup", mutantId, vectorId, "Worker could not be started."));
      return;
    }
    let settled = false;
    let ready = false;
    let executionTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: OracleMutationWorkerResultV1): void => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimer);
      if (executionTimer !== undefined) clearTimeout(executionTimer);
      void worker.terminate().catch(() => undefined);
      resolve(result);
    };
    const startupTimer = setTimeout(() => {
      finish(
        failure(
          "worker-startup",
          mutantId,
          vectorId,
          "Worker did not become ready within its fixed startup bound.",
        ),
      );
    }, STARTUP_DEADLINE_MILLISECONDS);
    worker.once("message", (message: unknown) => {
      if (!isWorkerReadyMessage(message)) {
        finish(
          failure("worker-protocol", mutantId, vectorId, "Worker did not announce readiness."),
        );
        return;
      }
      ready = true;
      clearTimeout(startupTimer);
      executionTimer = setTimeout(() => {
        finish(
          failure(
            "worker-timeout",
            mutantId,
            vectorId,
            "Worker exceeded its caller-selected execution deadline.",
          ),
        );
      }, deadlineMilliseconds);
      worker.postMessage(request);
      worker.once("message", (response: unknown) => {
        if (!isWorkerResponse(response)) {
          finish(
            failure("worker-protocol", mutantId, vectorId, "Worker returned an invalid message."),
          );
          return;
        }
        if (response.mutantId !== mutantId || response.vectorId !== vectorId) {
          finish(
            failure("worker-protocol", mutantId, vectorId, "Worker IDs do not match request."),
          );
          return;
        }
        if (response.kind === "failure") {
          finish(
            failure(
              response.failure,
              mutantId,
              vectorId,
              response.failure === "worker-budget"
                ? "Worker exhausted its fixed budget."
                : "Mutation harness did not complete its assertion.",
            ),
          );
          return;
        }
        finish(Object.freeze({ ok: true, mutantId, vectorId, killed: response.killed }));
      });
    });
    worker.once("error", () => {
      finish(
        failure(
          ready ? "worker-crash" : "worker-startup",
          mutantId,
          vectorId,
          ready ? "Worker terminated unexpectedly." : "Worker failed during startup.",
        ),
      );
    });
    worker.once("exit", (code) => {
      if (!settled && code !== 0) {
        finish(
          failure(
            ready ? "worker-crash" : "worker-startup",
            mutantId,
            vectorId,
            ready ? "Worker exited unsuccessfully." : "Worker exited during startup.",
          ),
        );
      }
    });
  });
}

function startWorkerProtocol(): void {
  if (parentPort === null) return;
  parentPort.once("message", (message: unknown) => {
    runWorkerProcess(message);
  });
  const ready: WorkerReadyMessageV1 = Object.freeze({ schemaVersion: 1, kind: "ready" });
  parentPort.postMessage(ready);
}

if (!isMainThread) startWorkerProtocol();

/**
 * Executes one catalog row through the bounded stable-ID worker protocol.
 *
 * @param mutant Exact validated catalog row.
 * @param vectorId Exact private vector identity.
 * @param deadlineMilliseconds Execution deadline applied after worker readiness.
 * @returns Kill status or a closed worker/harness failure.
 */
export function runOracleMutationWorkerSelection(
  mutant: OracleMutantV1,
  vectorId: string,
  deadlineMilliseconds: number,
): Promise<OracleMutationWorkerResultV1> {
  const selection = Object.freeze({
    mutantId: mutant.mutantId,
    operationId: mutant.operationId,
    pathId: mutant.pathId,
    variantId: mutant.variantId,
  });
  return executeBoundedWorker(
    Object.freeze({
      schemaVersion: 1,
      mode: "mutation",
      family: mutant.family,
      selection,
      vectorId,
    }),
    deadlineMilliseconds,
  );
}

/**
 * Exercises one finite worker failure mode through the ordinary worker boundary.
 *
 * @param mode Closed finite probe mode.
 * @param deadlineMilliseconds Execution deadline applied after worker readiness.
 * @returns Closed failure result without mutation kill credit.
 *
 * @example
 * ```ts
 * const result = await runOracleMutationWorkerProbe("timeout", 50);
 * ```
 */
export function runOracleMutationWorkerProbe(
  mode: OracleMutationWorkerProbeModeV1,
  deadlineMilliseconds: number,
): Promise<OracleMutationWorkerResultV1> {
  return executeBoundedWorker(
    Object.freeze({
      schemaVersion: 1,
      mode,
      mutantId: PROBE_MUTANT_ID,
      vectorId: PROBE_VECTOR_ID,
    }),
    deadlineMilliseconds,
  );
}
