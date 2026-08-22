import { createHash } from "node:crypto";

import {
  isExecutionDigestV1,
  type ExecutionCleanupBlockerV1,
  type ExecutionEvidenceSummaryV1,
  type ExecutionOperationIssueCodeV1,
  type ExecutionOperationResultV1,
  type ExecutionPolicyV1,
  type ExecutionUsageV1,
} from "@blend65/readiness";

import {
  createExecutionBudgetScopeV1,
  createExecutionEvidenceLedgerV1,
} from "./execution-budget.js";
import {
  createExecutionStreamCollectorV1,
  defaultExecutionProcessRuntimeV1,
  type ExecutionProcessHandleV1,
  type ExecutionProcessOutcomeV1,
  type ExecutionProcessRequestV1,
  type ExecutionProcessRuntimeV1,
  type ExecutionProcessSinkV1,
  type ExecutionProcessOwnershipV1,
} from "./execution-process.js";
import {
  defaultExecutionWorkspaceProviderV1,
  type ExecutionCaseWorkspaceV1,
  type ExecutionWorkspaceProviderV1,
} from "./execution-workspace.js";
import { bindExecutionWorkerWorkspaceIdentityV1 } from "./execution-worker-executor.js";
import {
  parseExecutionWorkerResponseV1,
  type ExecutionCancellationV1,
  type ExecutionWorkerExecutorV1,
  type ExecutionWorkerHandleV1,
  type ExecutionWorkerRequestV1,
  type ExecutionWorkerResponseV1,
} from "./execution-worker-protocol.js";

/** Monotonic clock and abortable deadline boundary. */
export interface ExecutionTimeRuntimeV1 {
  monotonicNow(): number;
  waitUntil(deadlineMonotonicMs: number, signal: AbortSignal): Promise<"deadline" | "cancelled">;
}

/** Dependencies whose fakes remain outside production. */
export interface ExecutionSupervisorDependenciesV1 {
  readonly time?: ExecutionTimeRuntimeV1;
  readonly workspaceProvider?: ExecutionWorkspaceProviderV1;
  readonly workerExecutor?: ExecutionWorkerExecutorV1;
  readonly processRuntime?: ExecutionProcessRuntimeV1;
  readonly runtimeDirectory?: string;
}

/** Idempotent cleanup outcome. */
export interface ExecutionCleanupOutcomeV1 {
  readonly ok: boolean;
  readonly blocker?: ExecutionCleanupBlockerV1;
}

/** Current cumulative result evidence and budget use. */
export interface ExecutionSupervisorSnapshotV1 {
  readonly usage: ExecutionUsageV1;
  readonly evidence: ExecutionEvidenceSummaryV1;
}

/** Route-wide lifecycle owner for workspaces, workers and child process groups. */
export interface ExecutionSupervisorV1 {
  readonly deadline: {
    readonly hardDeadlineMs: number;
    readonly workDeadlineMs: number;
    readonly cleanupGraceMs: number;
  };
  createWorkspace(
    callerCancellation?: ExecutionCancellationV1,
  ): Promise<ExecutionOperationResultV1<ExecutionCaseWorkspaceV1>>;
  runWorker(
    request: ExecutionWorkerRequestV1,
    callerCancellation?: ExecutionCancellationV1,
    parentEvidenceIdentity?: ExecutionWorkerParentEvidenceIdentityV1,
  ): Promise<ExecutionOperationResultV1<ExecutionWorkerResponseV1>>;
  runProcess(
    request: ExecutionProcessRequestV1,
    callerCancellation?: ExecutionCancellationV1,
    observer?: ExecutionProcessSinkV1,
  ): Promise<ExecutionOperationResultV1<ExecutionProcessOutcomeV1>>;
  /** Charges and hashes one retained evidence chunk. */
  recordEvidence(bytes: Uint8Array): ExecutionOperationResultV1<ExecutionEvidenceSummaryV1>;
  /** Charges externally observed child output without retaining it. */
  recordOutput(bytes: number): ExecutionOperationResultV1<ExecutionUsageV1>;
  /** Returns the unspent aggregate output capacity without mutating the budget. */
  remainingOutputBytes(): number;
  /** Returns the unspent retained-evidence capacity without mutating the budget. */
  remainingEvidenceBytes(): number;
  /** Returns cumulative route usage and evidence at the current monotonic instant. */
  snapshot(): ExecutionOperationResultV1<ExecutionSupervisorSnapshotV1>;
  cleanup(): Promise<ExecutionOperationResultV1<ExecutionCleanupOutcomeV1>>;
}

/** Parent-only diagnostic provenance retained outside the worker clone boundary. */
export interface ExecutionWorkerParentEvidenceIdentityV1 {
  readonly revision: "execution-worker-parent-evidence-v1";
  readonly joinPolicyRevision: "published-diagnostic-case-equivalence-v1";
  readonly callerSourceCaseDigest: string;
  readonly selectedReleaseDigest: string;
  readonly selectedCampaignDigest: string;
  readonly selectedSourceCaseDigest: string;
  readonly evaluationIdentity: string;
  readonly sourceContentIdentity: string;
}

interface OwnedWorker {
  readonly handle: ExecutionWorkerHandleV1;
  releaseOperation?: Promise<void>;
}

interface OwnedProcess {
  readonly handle: ExecutionProcessHandleV1;
  completed: boolean;
  exit?: { readonly exitCode: number | null; readonly signal: NodeJS.Signals | null };
  releaseOperation?: Promise<boolean>;
}

const SUPERVISOR_WORKERS = new WeakMap<
  ExecutionSupervisorV1,
  ExecutionWorkerExecutorV1 | undefined
>();
const EXECUTOR_OWNERS = new WeakMap<ExecutionWorkerExecutorV1, { owners: number }>();
const ENCODER = new TextEncoder();
const PARENT_EVIDENCE_KEYS = [
  "revision",
  "joinPolicyRevision",
  "callerSourceCaseDigest",
  "selectedReleaseDigest",
  "selectedCampaignDigest",
  "selectedSourceCaseDigest",
  "evaluationIdentity",
  "sourceContentIdentity",
] as const;

function acquireWorkerExecutorOwnership(
  executor: ExecutionWorkerExecutorV1 | undefined,
): ExecutionWorkerExecutorV1 | undefined {
  if (executor === undefined) return undefined;
  const ownership = EXECUTOR_OWNERS.get(executor) ?? { owners: 0 };
  ownership.owners += 1;
  EXECUTOR_OWNERS.set(executor, ownership);
  let released = false;
  return Object.freeze({
    start: (request: ExecutionWorkerRequestV1, cancellation: ExecutionCancellationV1) =>
      executor.start(request, cancellation),
    async shutdown(): Promise<void> {
      if (released) return;
      released = true;
      ownership.owners -= 1;
      if (ownership.owners === 0) await executor.shutdown?.();
    },
  });
}

/** Confirms that an adapter and its lifecycle owner name the same worker boundary. */
export function executionSupervisorOwnsWorkerExecutorV1(
  supervisor: ExecutionSupervisorV1,
  executor: ExecutionWorkerExecutorV1,
): boolean {
  return SUPERVISOR_WORKERS.get(supervisor) === executor;
}

function issue<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, path, message })]) as readonly [
      { readonly code: typeof code; readonly path: string; readonly message: string },
    ],
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function canonicalParentEvidence(input: unknown): ExecutionOperationResultV1<Uint8Array> {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return issue(
        "invalid-evidence-input",
        "/worker/parentEvidence",
        "Parent evidence is invalid.",
      );
    }
    const prototype = Object.getPrototypeOf(input);
    const keys = Reflect.ownKeys(input);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.length !== PARENT_EVIDENCE_KEYS.length ||
      keys.some(
        (key) =>
          typeof key !== "string" || !(PARENT_EVIDENCE_KEYS as readonly string[]).includes(key),
      )
    ) {
      return issue(
        "invalid-evidence-input",
        "/worker/parentEvidence",
        "Parent evidence is invalid.",
      );
    }
    const values: Record<string, unknown> = {};
    for (const key of PARENT_EVIDENCE_KEYS) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return issue(
          "invalid-evidence-input",
          "/worker/parentEvidence",
          "Parent evidence is invalid.",
        );
      }
      values[key] = descriptor.value;
    }
    if (
      values.revision !== "execution-worker-parent-evidence-v1" ||
      values.joinPolicyRevision !== "published-diagnostic-case-equivalence-v1" ||
      !PARENT_EVIDENCE_KEYS.slice(2).every((key) => isExecutionDigestV1(values[key]))
    ) {
      return issue(
        "invalid-evidence-input",
        "/worker/parentEvidence",
        "Parent evidence is invalid.",
      );
    }
    return success(
      ENCODER.encode(
        JSON.stringify({
          revision: values.revision,
          joinPolicyRevision: values.joinPolicyRevision,
          callerSourceCaseDigest: values.callerSourceCaseDigest,
          selectedReleaseDigest: values.selectedReleaseDigest,
          selectedCampaignDigest: values.selectedCampaignDigest,
          selectedSourceCaseDigest: values.selectedSourceCaseDigest,
          evaluationIdentity: values.evaluationIdentity,
          sourceContentIdentity: values.sourceContentIdentity,
        }),
      ),
    );
  } catch {
    return issue("invalid-evidence-input", "/worker/parentEvidence", "Parent evidence is invalid.");
  }
}

function cleanupBlocker(reason: string): ExecutionCleanupBlockerV1 {
  return Object.freeze({
    code: "emulator-lease-recovery-blocked",
    evidenceDigest: `sha256:${createHash("sha256").update(reason, "utf8").digest("hex")}`,
  });
}

/** Production monotonic time runtime. */
export const defaultExecutionTimeRuntimeV1: ExecutionTimeRuntimeV1 = Object.freeze({
  monotonicNow(): number {
    return performance.now();
  },
  waitUntil(deadlineMonotonicMs: number, signal: AbortSignal): Promise<"deadline" | "cancelled"> {
    return new Promise<"deadline" | "cancelled">((resolveWait) => {
      if (signal.aborted) {
        resolveWait("cancelled");
        return;
      }
      const remaining = Math.max(0, deadlineMonotonicMs - performance.now());
      const timeout = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolveWait("deadline");
      }, remaining);
      timeout.unref();
      const onAbort = (): void => {
        clearTimeout(timeout);
        resolveWait("cancelled");
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  },
});

/** Creates one bounded lifecycle owner. */
export function createExecutionSupervisorV1(
  policy: ExecutionPolicyV1,
  dependencies: ExecutionSupervisorDependenciesV1 = {},
): ExecutionOperationResultV1<ExecutionSupervisorV1> {
  const time = dependencies.time ?? defaultExecutionTimeRuntimeV1;
  const budget = createExecutionBudgetScopeV1(policy, time.monotonicNow());
  if (!budget.ok) return budget;
  const ledger = createExecutionEvidenceLedgerV1(policy.budget.evidenceBytes);
  if (!ledger.ok) return ledger;
  const workspaceProvider = dependencies.workspaceProvider ?? defaultExecutionWorkspaceProviderV1;
  const processRuntime = dependencies.processRuntime ?? defaultExecutionProcessRuntimeV1;
  const suppliedWorkerExecutor = dependencies.workerExecutor;
  const workerExecutor = acquireWorkerExecutorOwnership(suppliedWorkerExecutor);
  const workspaces: ExecutionCaseWorkspaceV1[] = [];
  const workers: OwnedWorker[] = [];
  const processes: OwnedProcess[] = [];
  const inFlightPublishers = new Set<Promise<void>>();
  const operationPublishers = new Set<Promise<void>>();
  const closingController = new AbortController();
  let state: "open" | "cleaning" | "closed" = "open";
  let activeOperation: "worker" | "process" | undefined;
  let activeOperationMarker: Promise<void> | undefined;
  let finishActiveOperationMarker = (): void => undefined;
  let publisherCleanupFailed = false;
  let cleanupPromise: Promise<ExecutionOperationResultV1<ExecutionCleanupOutcomeV1>> | undefined;

  const recordEvidence = (
    bytes: Uint8Array,
  ): ExecutionOperationResultV1<ExecutionEvidenceSummaryV1> => {
    if (!(bytes instanceof Uint8Array)) {
      return issue("invalid-evidence-input", "/evidence", "Evidence must be bytes.");
    }
    const charged = budget.value.chargeEvidence(bytes.byteLength);
    if (!charged.ok) return charged;
    return ledger.value.append(bytes);
  };

  const trackPublisher = <T>(publisher: Promise<T>): Promise<T> => {
    const marker = publisher.then(
      () => undefined,
      () => undefined,
    );
    inFlightPublishers.add(marker);
    void marker.finally(() => inFlightPublishers.delete(marker));
    return publisher;
  };

  const trackOperationPublisher = <T>(publisher: Promise<T>): Promise<T> => {
    const tracked = trackPublisher(publisher);
    const marker = tracked.then(
      () => undefined,
      () => undefined,
    );
    operationPublishers.add(marker);
    void marker.finally(() => operationPublishers.delete(marker));
    return tracked;
  };

  const reserveOperation = (kind: "worker" | "process"): boolean => {
    if (activeOperation !== undefined || operationPublishers.size > 0) return false;
    activeOperation = kind;
    activeOperationMarker = new Promise<void>((resolve) => {
      finishActiveOperationMarker = resolve;
    });
    inFlightPublishers.add(activeOperationMarker);
    return true;
  };

  const finishOperation = (): void => {
    activeOperation = undefined;
    if (activeOperationMarker !== undefined) inFlightPublishers.delete(activeOperationMarker);
    activeOperationMarker = undefined;
    finishActiveOperationMarker();
    finishActiveOperationMarker = (): void => undefined;
  };

  const cleanupAuthorityDeadline = (): number =>
    Math.max(
      budget.value.deadline.hardDeadlineMs,
      time.monotonicNow() + budget.value.deadline.cleanupGraceMs,
    );

  const bounded = async <T>(operation: Promise<T>, deadline: number): Promise<T | undefined> => {
    const controller = new AbortController();
    let operationSettled = false;
    const observed = operation.then((value) => {
      operationSettled = true;
      return { kind: "operation" as const, value };
    });
    try {
      let winner = await Promise.race([
        observed,
        Promise.resolve()
          .then(() => time.waitUntil(deadline, controller.signal))
          .then(() => ({ kind: "deadline" as const })),
      ]);
      if (winner.kind === "deadline" && time.monotonicNow() <= deadline) {
        await Promise.resolve();
        if (operationSettled) winner = await observed;
      }
      return winner.kind === "operation" ? winner.value : undefined;
    } finally {
      controller.abort();
    }
  };

  const releaseWorker = async (
    owned: OwnedWorker,
    healthy: boolean,
    deadlineMonotonicMs = cleanupAuthorityDeadline(),
  ): Promise<boolean> => {
    owned.releaseOperation ??= Promise.resolve().then(() =>
      healthy && owned.handle.release !== undefined
        ? owned.handle.release()
        : owned.handle.terminate(),
    );
    try {
      return (
        (await bounded(
          owned.releaseOperation.then(() => true),
          deadlineMonotonicMs,
        )) === true
      );
    } catch {
      return false;
    }
  };

  const releaseProcess = (
    owned: OwnedProcess,
    deadlineMonotonicMs = cleanupAuthorityDeadline(),
  ): Promise<boolean> => {
    owned.releaseOperation ??= (async () => {
      try {
        const observed = await bounded(owned.handle.revalidateIdentity(), deadlineMonotonicMs);
        const ownership: ExecutionProcessOwnershipV1 | undefined =
          observed === true ? "present" : observed === false ? "absent" : observed;
        if (ownership === undefined || ownership === "unknown") return false;
        if (ownership === "absent") {
          if (owned.completed) return true;
          return (
            (await bounded(
              owned.handle.completion.then(() => true),
              deadlineMonotonicMs,
            )) === true
          );
        }
        const terminated = await bounded(
          owned.handle.terminate("SIGTERM").then(() => true),
          deadlineMonotonicMs,
        );
        if (terminated !== true) return false;
        const gracefulDeadline = Math.min(
          deadlineMonotonicMs,
          time.monotonicNow() + Math.floor(budget.value.deadline.cleanupGraceMs / 2),
        );
        const graceful =
          owned.handle.waitForGroupExit === undefined
            ? await bounded(
                owned.handle.completion.then(() => true),
                gracefulDeadline,
              )
            : await bounded(owned.handle.waitForGroupExit(gracefulDeadline), gracefulDeadline);
        const observedAfterTerm = await bounded(
          owned.handle.revalidateIdentity(),
          deadlineMonotonicMs,
        );
        const afterTerm: ExecutionProcessOwnershipV1 | undefined =
          observedAfterTerm === true
            ? "present"
            : observedAfterTerm === false
              ? "absent"
              : observedAfterTerm;
        if (afterTerm === undefined || afterTerm === "unknown") return false;
        if (afterTerm === "absent") return graceful !== undefined;
        const killed = await bounded(
          owned.handle.terminate("SIGKILL").then(() => true),
          deadlineMonotonicMs,
        );
        if (killed !== true) return false;
        if (owned.handle.waitForGroupExit !== undefined) {
          return (
            (await bounded(
              owned.handle.waitForGroupExit(deadlineMonotonicMs),
              deadlineMonotonicMs,
            )) === true
          );
        }
        const reaped = await bounded(
          owned.handle.completion.then(() => true),
          deadlineMonotonicMs,
        );
        return reaped === true;
      } catch {
        return false;
      }
    })();
    return owned.releaseOperation;
  };

  const acquisitionCancellation = (
    caller: ExecutionCancellationV1 | undefined,
    deadlineMonotonicMs: number,
  ): {
    readonly value: ExecutionCancellationV1;
    readonly cancelled: Promise<void>;
    readonly dispose: () => void;
  } => {
    const controller = new AbortController();
    let resolveCancelled = (): void => undefined;
    const cancelled = new Promise<void>((resolve) => {
      resolveCancelled = resolve;
    });
    const abort = (): void => {
      controller.abort();
      resolveCancelled();
    };
    caller?.signal.addEventListener("abort", abort, { once: true });
    closingController.signal.addEventListener("abort", abort, { once: true });
    if (
      caller?.signal.aborted === true ||
      closingController.signal.aborted ||
      time.monotonicNow() > deadlineMonotonicMs
    ) {
      abort();
    }
    const waitController = new AbortController();
    void time.waitUntil(deadlineMonotonicMs, waitController.signal).then((reason) => {
      if (
        reason === "cancelled"
          ? caller?.signal.aborted === true
          : time.monotonicNow() > deadlineMonotonicMs
      ) {
        abort();
      }
    });
    return {
      value: Object.freeze({
        signal: controller.signal,
        deadlineMonotonicMs,
      }),
      cancelled,
      dispose: () => {
        waitController.abort();
        caller?.signal.removeEventListener("abort", abort);
        closingController.signal.removeEventListener("abort", abort);
      },
    };
  };

  const cancellationFor = (
    operation: ExecutionCancellationV1,
    caller?: ExecutionCancellationV1,
  ): {
    readonly value: ExecutionCancellationV1;
    readonly cancelled: Promise<void>;
    readonly dispose: () => void;
  } => {
    const controller = new AbortController();
    let resolveCancelled = (): void => undefined;
    const cancelled = new Promise<void>((resolve) => {
      resolveCancelled = resolve;
    });
    const abort = (): void => {
      controller.abort();
      resolveCancelled();
    };
    operation.signal.addEventListener("abort", abort, { once: true });
    caller?.signal.addEventListener("abort", abort, { once: true });
    closingController.signal.addEventListener("abort", abort, { once: true });
    if (operation.signal.aborted || caller?.signal.aborted || closingController.signal.aborted)
      abort();
    return {
      value: Object.freeze({
        signal: controller.signal,
        deadlineMonotonicMs: Math.min(
          operation.deadlineMonotonicMs,
          caller?.deadlineMonotonicMs ?? Number.POSITIVE_INFINITY,
        ),
        outputLimitBytes: budget.value.remainingOutputBytes(),
        evidenceLimitBytes: budget.value.remainingEvidenceBytes(),
      }),
      cancelled,
      dispose: () => {
        controller.abort();
        operation.signal.removeEventListener("abort", abort);
        caller?.signal.removeEventListener("abort", abort);
        closingController.signal.removeEventListener("abort", abort);
      },
    };
  };

  const deadlineWatch = (
    cancellation: ExecutionCancellationV1,
    completed: () => boolean,
  ): {
    readonly promise: Promise<void>;
    readonly expired: () => boolean;
    readonly dispose: () => void;
  } => {
    const controller = new AbortController();
    let fired = false;
    const abort = (): void => controller.abort();
    cancellation.signal.addEventListener("abort", abort, { once: true });
    if (cancellation.signal.aborted) controller.abort();
    const promise = time.waitUntil(cancellation.deadlineMonotonicMs, controller.signal).then(
      (reason) => {
        if (
          !completed() &&
          (cancellation.signal.aborted ||
            (reason === "deadline" && time.monotonicNow() > cancellation.deadlineMonotonicMs))
        ) {
          fired = true;
        }
      },
      () => {
        fired = true;
      },
    );
    return {
      promise,
      expired: () =>
        fired ||
        (!completed() && cancellation.signal.aborted) ||
        time.monotonicNow() > cancellation.deadlineMonotonicMs,
      dispose: () => {
        controller.abort();
        cancellation.signal.removeEventListener("abort", abort);
      },
    };
  };

  const recordWorker = (
    request: ExecutionWorkerRequestV1,
    response: ExecutionWorkerResponseV1,
  ): ExecutionOperationResultV1<ExecutionEvidenceSummaryV1> => {
    const output =
      response.tier === "cli"
        ? response.stdout.byteLength + response.stderr.byteLength
        : response.tier === "emit"
          ? response.assemblyBytes.byteLength
          : 0;
    const outputCharge = budget.value.chargeOutput(output);
    if (!outputCharge.ok) return outputCharge;
    const metadata = ENCODER.encode(
      JSON.stringify({
        caseIdentity: request.caseIdentity,
        sourceDigest: request.source.digest,
        tier: response.tier,
        diagnostics: response.diagnostics,
        emission: response.emission,
        ...(response.tier === "frontend"
          ? {
              semanticModelPresent: response.semanticModelPresent,
              allocationPlanPresent: response.allocationPlanPresent,
            }
          : response.tier === "compiler-api"
            ? { hasErrors: response.hasErrors }
            : response.tier === "cli"
              ? { exitCode: response.exitCode }
              : {}),
      }),
    );
    const chunks =
      response.tier === "cli"
        ? [metadata, response.stdout, response.stderr]
        : response.tier === "emit"
          ? [metadata, response.assemblyBytes]
          : [metadata];
    let summary: ExecutionOperationResultV1<ExecutionEvidenceSummaryV1> = success(
      ledger.value.summarize(),
    );
    for (const chunk of chunks) {
      summary = recordEvidence(chunk);
      if (!summary.ok) return summary;
    }
    return summary;
  };

  const supervisor: ExecutionSupervisorV1 = Object.freeze({
    deadline: budget.value.deadline,
    async createWorkspace(
      callerCancellation?: ExecutionCancellationV1,
    ): Promise<ExecutionOperationResultV1<ExecutionCaseWorkspaceV1>> {
      if (state !== "open") {
        return issue("execution.stale-authority", "/workspace", "Supervisor is closing.");
      }
      const acquisitionDeadline = Math.min(
        budget.value.deadline.hardDeadlineMs,
        callerCancellation?.deadlineMonotonicMs ?? Number.POSITIVE_INFINITY,
      );
      const guard = acquisitionCancellation(callerCancellation, acquisitionDeadline);
      try {
        const publisher = trackPublisher(
          (async () => {
            const created = await workspaceProvider.create(guard.value);
            if (!created.ok) return { created, accepted: false as const };
            if (
              state !== "open" ||
              guard.value.signal.aborted ||
              time.monotonicNow() > acquisitionDeadline
            ) {
              let disposed = false;
              try {
                await created.value.dispose(cleanupAuthorityDeadline());
                disposed = true;
              } catch {
                if (state === "open") workspaces.push(created.value);
                else publisherCleanupFailed = true;
              }
              return { created, accepted: false as const, disposed };
            }
            workspaces.push(created.value);
            return { created, accepted: true as const };
          })(),
        );
        const winner = await Promise.race([
          publisher.then((value) => ({ kind: "publisher" as const, value })),
          guard.cancelled.then(() => ({ kind: "cancelled" as const })),
        ]);
        if (winner.kind === "cancelled") {
          return issue(
            state === "open" ? "wall-time-exhaustion" : "execution.stale-authority",
            "/workspace",
            "Workspace acquisition was cancelled.",
          );
        }
        if (!winner.value.created.ok) return winner.value.created;
        if (!winner.value.accepted) {
          return issue(
            state === "open" ? "wall-time-exhaustion" : "execution.stale-authority",
            "/workspace",
            "Supervisor closed during acquire.",
          );
        }
        return winner.value.created;
      } finally {
        guard.dispose();
      }
    },
    async runWorker(
      request: ExecutionWorkerRequestV1,
      callerCancellation?: ExecutionCancellationV1,
      parentEvidenceIdentity?: ExecutionWorkerParentEvidenceIdentityV1,
    ): Promise<ExecutionOperationResultV1<ExecutionWorkerResponseV1>> {
      if (state !== "open") {
        return issue("execution.stale-authority", "/worker", "Supervisor is closing.");
      }
      if (workerExecutor === undefined) {
        return issue("execution.io", "/worker", "No worker executor is configured.");
      }
      if (!reserveOperation("worker")) {
        return issue(
          "execution.stale-authority",
          "/worker",
          "Supervisor already owns an active operation.",
        );
      }
      const operation = budget.value.beginOperation(request.tier, time.monotonicNow());
      if (!operation.ok) {
        finishOperation();
        return operation;
      }
      const combined = cancellationFor(operation.value, callerCancellation);
      let watchdog: ReturnType<typeof deadlineWatch> | undefined;
      try {
        if (parentEvidenceIdentity !== undefined) {
          const canonical = canonicalParentEvidence(parentEvidenceIdentity);
          if (!canonical.ok) return canonical;
          const recordedIdentity = recordEvidence(canonical.value);
          if (!recordedIdentity.ok) return recordedIdentity;
        }
        const workspace = workspaces.find(({ root }) => root === request.caseRoot);
        if (workspace !== undefined) {
          bindExecutionWorkerWorkspaceIdentityV1(request, workspace.identity);
        }
        const startGuard = acquisitionCancellation(
          combined.value,
          combined.value.deadlineMonotonicMs,
        );
        const startCancellation = Object.freeze({
          ...combined.value,
          signal: startGuard.value.signal,
        });
        const publisher = trackOperationPublisher(
          (async () => {
            let started: ExecutionOperationResultV1<ExecutionWorkerHandleV1>;
            try {
              started = await workerExecutor.start(request, startCancellation);
            } catch {
              started = issue("execution.io", "/worker", "Worker acquisition failed.");
            }
            if (!started.ok) return { started };
            const owned: OwnedWorker = { handle: started.value };
            if (
              state !== "open" ||
              startGuard.value.signal.aborted ||
              time.monotonicNow() > combined.value.deadlineMonotonicMs
            ) {
              if (!(await releaseWorker(owned, false, cleanupAuthorityDeadline())))
                publisherCleanupFailed = true;
            } else {
              workers.push(owned);
            }
            return { started, owned };
          })(),
        );
        const acquisitionWinner = await Promise.race([
          publisher.then((value) => ({ kind: "publisher" as const, value })),
          startGuard.cancelled.then(() => ({ kind: "cancelled" as const })),
        ]);
        startGuard.dispose();
        if (acquisitionWinner.kind === "cancelled") {
          return issue(
            state === "open" ? "wall-time-exhaustion" : "execution.stale-authority",
            "/worker",
            "Worker acquisition was cancelled.",
          );
        }
        const acquisition = acquisitionWinner.value;
        if (!acquisition.started.ok) return acquisition.started;
        const owned = acquisition.owned;
        if (owned === undefined || state !== "open") {
          return issue("execution.stale-authority", "/worker", "Supervisor closed during acquire.");
        }
        if (
          combined.value.signal.aborted ||
          time.monotonicNow() > combined.value.deadlineMonotonicMs
        ) {
          if (await releaseWorker(owned, false)) workers.splice(workers.indexOf(owned), 1);
          return issue("wall-time-exhaustion", "/worker", "Worker authority was cancelled.");
        }
        let completionLatched = false;
        const completion = owned.handle.completion.then(
          (observed) => {
            completionLatched = true;
            return { kind: "completion" as const, completion: observed };
          },
          () => {
            completionLatched = true;
            return { kind: "completion-failure" as const };
          },
        );
        watchdog = deadlineWatch(combined.value, () => completionLatched);
        let winner = await Promise.race([
          completion,
          watchdog.promise.then(() => ({ kind: "deadline" as const })),
        ]);
        if (winner.kind === "deadline" && !watchdog.expired()) {
          await Promise.resolve();
          if (completionLatched) winner = await completion;
        }
        if (winner.kind === "deadline" || watchdog.expired()) {
          await releaseWorker(owned, false);
          return issue("wall-time-exhaustion", "/worker", "Worker authority was cancelled.");
        }
        if (winner.kind === "completion-failure") {
          await releaseWorker(owned, false);
          return issue("compiler-ice", "/worker", "Compiler worker completion was rejected.");
        }
        if (winner.completion.kind === "crash") {
          await releaseWorker(owned, false);
          const code = winner.completion.resourceFailure ?? "compiler-ice";
          return issue(code, "/worker", "Compiler worker exited without valid evidence.");
        }
        const parsed = parseExecutionWorkerResponseV1(request, winner.completion.value);
        if (!parsed.ok) {
          await releaseWorker(owned, false);
          return issue("compiler-ice", "/worker", "Compiler worker returned malformed evidence.");
        }
        const recorded = recordWorker(request, parsed.value);
        if (!recorded.ok) {
          await releaseWorker(owned, false);
          return recorded;
        }
        if (watchdog.expired()) {
          await releaseWorker(owned, false);
          return issue("wall-time-exhaustion", "/worker", "Worker deadline expired.");
        }
        if (await releaseWorker(owned, true)) {
          workers.splice(workers.indexOf(owned), 1);
        } else {
          return issue("execution.io", "/worker", "Worker release could not be confirmed.");
        }
        if (watchdog.expired()) {
          return issue("wall-time-exhaustion", "/worker", "Worker deadline expired.");
        }
        return parsed;
      } finally {
        watchdog?.dispose();
        combined.dispose();
        finishOperation();
      }
    },
    async runProcess(
      request: ExecutionProcessRequestV1,
      callerCancellation?: ExecutionCancellationV1,
      observer?: ExecutionProcessSinkV1,
    ): Promise<ExecutionOperationResultV1<ExecutionProcessOutcomeV1>> {
      if (state !== "open") {
        return issue("execution.stale-authority", "/process", "Supervisor is closing.");
      }
      if (!reserveOperation("process")) {
        return issue(
          "execution.stale-authority",
          "/process",
          "Supervisor already owns an active operation.",
        );
      }
      const operation = budget.value.beginOperation("acme", time.monotonicNow());
      if (!operation.ok) {
        finishOperation();
        return operation;
      }
      const combined = cancellationFor(operation.value, callerCancellation);
      let watchdog: ReturnType<typeof deadlineWatch> | undefined;
      const streamLimit = budget.value.remainingOutputBytes();
      const streams = createExecutionStreamCollectorV1(streamLimit);
      const sink: ExecutionProcessSinkV1 = {
        onStdout(bytes) {
          streams.onStdout(bytes);
          try {
            observer?.onStdout(bytes);
          } catch {
            // An evidence observer cannot stop draining the child.
          }
        },
        onStderr(bytes) {
          streams.onStderr(bytes);
          try {
            observer?.onStderr(bytes);
          } catch {
            // An evidence observer cannot stop draining the child.
          }
        },
      };
      try {
        const startGuard = acquisitionCancellation(
          combined.value,
          combined.value.deadlineMonotonicMs,
        );
        const startCancellation = Object.freeze({
          ...combined.value,
          signal: startGuard.value.signal,
        });
        const publisher = trackOperationPublisher(
          (async () => {
            let started: ExecutionOperationResultV1<ExecutionProcessHandleV1>;
            try {
              started = await processRuntime.start(request, sink, startCancellation);
            } catch {
              started = issue("execution.io", "/process", "Process acquisition failed.");
            }
            if (!started.ok) return { started };
            const owned: OwnedProcess = { handle: started.value, completed: false };
            void owned.handle.completion.then(
              (exit) => {
                owned.completed = true;
                owned.exit = exit;
              },
              () => {
                owned.completed = true;
              },
            );
            if (
              state !== "open" ||
              startGuard.value.signal.aborted ||
              time.monotonicNow() > combined.value.deadlineMonotonicMs
            ) {
              if (!(await releaseProcess(owned, cleanupAuthorityDeadline())))
                publisherCleanupFailed = true;
            } else {
              processes.push(owned);
            }
            return { started, owned };
          })(),
        );
        const acquisitionWinner = await Promise.race([
          publisher.then((value) => ({ kind: "publisher" as const, value })),
          startGuard.cancelled.then(() => ({ kind: "cancelled" as const })),
        ]);
        startGuard.dispose();
        if (acquisitionWinner.kind === "cancelled") {
          return issue(
            state === "open" ? "wall-time-exhaustion" : "execution.stale-authority",
            "/process",
            "Process acquisition was cancelled.",
          );
        }
        const acquisition = acquisitionWinner.value;
        if (!acquisition.started.ok) return acquisition.started;
        const started = acquisition.started;
        const owned = acquisition.owned;
        if (owned === undefined) {
          return issue(
            "execution.stale-authority",
            "/process",
            "Supervisor closed during acquire.",
          );
        }
        if (state !== "open") {
          return issue(
            "execution.stale-authority",
            "/process",
            "Supervisor closed during acquire.",
          );
        }
        if (
          combined.value.signal.aborted ||
          time.monotonicNow() > combined.value.deadlineMonotonicMs
        ) {
          if (await releaseProcess(owned)) processes.splice(processes.indexOf(owned), 1);
          return issue("wall-time-exhaustion", "/process", "Process authority was cancelled.");
        }
        let completionLatched = false;
        const completion = owned.handle.completion.then(
          (exit) => {
            completionLatched = true;
            return { kind: "completion" as const, exit };
          },
          () => {
            completionLatched = true;
            return { kind: "completion-failure" as const };
          },
        );
        watchdog = deadlineWatch(combined.value, () => completionLatched);
        let winner = await Promise.race([
          completion,
          streams.exhaustion.then(() => ({ kind: "output" as const })),
          watchdog.promise.then(() => ({ kind: "deadline" as const })),
        ]);
        if (winner.kind === "deadline" && !watchdog.expired()) {
          await Promise.resolve();
          if (completionLatched) winner = await completion;
        }
        if (winner.kind === "completion-failure") {
          await releaseProcess(owned);
          return issue("execution.io", "/process", "Process completion was rejected.");
        }
        if (winner.kind === "output" || streams.exhausted) {
          const released = await releaseProcess(owned, cleanupAuthorityDeadline());
          if (released && owned.exit === undefined) {
            const observedExit = await bounded(owned.handle.completion, cleanupAuthorityDeadline());
            if (observedExit !== undefined) owned.exit = observedExit;
          }
          if (!released || owned.exit === undefined) {
            return issue(
              "output-exhaustion",
              "/process/output",
              "Process output was exhausted; termination remains owned for cleanup.",
            );
          }
          processes.splice(processes.indexOf(owned), 1);
          const cleanupDigest = `sha256:${createHash("sha256")
            .update(
              JSON.stringify({
                revision: "terminated-output-cleanup-v1",
                code: "output-exhaustion",
                configuredLimit: streamLimit,
                childIdentity: {
                  bootId: owned.handle.identity.bootId,
                  pid: owned.handle.identity.pid,
                  startTicks: owned.handle.identity.startTicks.toString(10),
                  processGroupId: owned.handle.identity.processGroupId,
                  sessionId: owned.handle.identity.sessionId ?? null,
                },
                exitCode: owned.exit.exitCode,
                signal: owned.exit.signal,
              }),
              "utf8",
            )
            .digest("hex")}`;
          const authority = Object.freeze({
            kind: "terminated-output-exhaustion" as const,
            code: "output-exhaustion" as const,
            configuredLimit: streamLimit,
            cleanupDigest,
          });
          return issue(
            authority.code,
            "/process/output",
            `Process output exceeded ${authority.configuredLimit} bytes; cleanup proof ${authority.cleanupDigest}.`,
          );
        }
        if (winner.kind === "deadline" || watchdog.expired()) {
          await releaseProcess(owned);
          return issue("wall-time-exhaustion", "/process", "Process authority was cancelled.");
        }
        owned.completed = true;
        owned.exit = winner.exit;
        const diagnosticStreams = streams.summarize();
        const outputCharge = budget.value.chargeOutput(streams.totalBytes);
        if (!outputCharge.ok) return outputCharge;
        const recorded = recordEvidence(
          ENCODER.encode(
            JSON.stringify({
              exitCode: winner.exit.exitCode,
              signal: winner.exit.signal,
              stdout: {
                totalBytes: diagnosticStreams.stdout.totalBytes,
                sha256: diagnosticStreams.stdout.sha256,
              },
              stderr: {
                totalBytes: diagnosticStreams.stderr.totalBytes,
                sha256: diagnosticStreams.stderr.sha256,
              },
            }),
          ),
        );
        if (!recorded.ok) return recorded;
        if (watchdog.expired()) {
          await releaseProcess(owned);
          return issue("wall-time-exhaustion", "/process", "Process deadline expired.");
        }
        return success(
          Object.freeze({
            exitCode: winner.exit.exitCode,
            signal: winner.exit.signal,
            childIdentity: started.value.identity,
            authority: Object.freeze({
              kind: "finite-streams" as const,
              stdout: diagnosticStreams.stdout,
              stderr: diagnosticStreams.stderr,
            }),
            diagnosticStreams,
          }),
        );
      } finally {
        watchdog?.dispose();
        combined.dispose();
        finishOperation();
      }
    },
    recordEvidence,
    recordOutput(bytes: number): ExecutionOperationResultV1<ExecutionUsageV1> {
      return budget.value.chargeOutput(bytes);
    },
    remainingOutputBytes(): number {
      return budget.value.remainingOutputBytes();
    },
    remainingEvidenceBytes(): number {
      return budget.value.remainingEvidenceBytes();
    },
    snapshot() {
      const usage = budget.value.snapshot(time.monotonicNow());
      return usage.ok
        ? success(Object.freeze({ usage: usage.value, evidence: ledger.value.summarize() }))
        : usage;
    },
    cleanup() {
      cleanupPromise ??= (async () => {
        state = "cleaning";
        closingController.abort();
        let blocker: ExecutionCleanupBlockerV1 | undefined;
        const cleanupDeadlineMs = cleanupAuthorityDeadline();
        const starts = await bounded(
          Promise.all([...inFlightPublishers]).then(() => true),
          cleanupDeadlineMs,
        );
        if (starts !== true) blocker ??= cleanupBlocker("resource-acquisition-did-not-settle");
        if (publisherCleanupFailed) blocker ??= cleanupBlocker("late-resource-cleanup-unconfirmed");

        for (const owned of [...processes].reverse()) {
          if (await releaseProcess(owned, cleanupDeadlineMs))
            processes.splice(processes.indexOf(owned), 1);
          else blocker ??= cleanupBlocker("child-process-cleanup-unconfirmed");
        }
        for (const owned of [...workers].reverse()) {
          if (await releaseWorker(owned, false, cleanupDeadlineMs))
            workers.splice(workers.indexOf(owned), 1);
          else blocker ??= cleanupBlocker("worker-cleanup-unconfirmed");
        }
        for (const workspace of [...workspaces].reverse()) {
          try {
            const released = await bounded(
              workspace.dispose(cleanupDeadlineMs).then(() => true),
              cleanupDeadlineMs,
            );
            if (released === true) workspaces.splice(workspaces.indexOf(workspace), 1);
            else blocker ??= cleanupBlocker("workspace-cleanup-unconfirmed");
          } catch {
            blocker ??= cleanupBlocker("workspace-cleanup-failed");
          }
        }
        if (workerExecutor?.shutdown !== undefined) {
          const shutdown = await bounded(
            workerExecutor.shutdown().then(() => true),
            cleanupDeadlineMs,
          );
          if (shutdown !== true) blocker ??= cleanupBlocker("worker-pool-shutdown-unconfirmed");
        }
        state = "closed";
        return success(
          Object.freeze({
            ok: blocker === undefined,
            ...(blocker === undefined ? {} : { blocker }),
          }),
        );
      })();
      return cleanupPromise;
    },
  });
  SUPERVISOR_WORKERS.set(supervisor, suppliedWorkerExecutor);
  return success(supervisor);
}
