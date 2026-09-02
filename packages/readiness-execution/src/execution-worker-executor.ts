import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { Worker } from "node:worker_threads";

import type { ExecutionOperationResultV1 } from "@blend65/readiness";
import { EXECUTION_MAXIMUM_BUDGET_V1 } from "@blend65/readiness/execution-runtime";

import type {
  ExecutionCancellationV1,
  ExecutionWorkerCompletionV1,
  ExecutionWorkerExecutorV1,
  ExecutionWorkerHandleV1,
  ExecutionWorkerRequestV1,
  ExecutionWorkerWorkspaceIdentityV1,
} from "./execution-worker-protocol.js";

const POOL_SIZE = 2;
const MAX_CASES_PER_WORKER = 8;
const WORKER_SHUTDOWN_MS = 1_000;
const MAX_WAITERS = 4_096;
const REQUEST_WORKSPACE_IDENTITIES = new WeakMap<object, ExecutionWorkerWorkspaceIdentityV1>();

/** Binds a supervisor-pinned root identity without widening the observable request record. */
export function bindExecutionWorkerWorkspaceIdentityV1(
  request: ExecutionWorkerRequestV1,
  identity: ExecutionWorkerWorkspaceIdentityV1,
): void {
  REQUEST_WORKSPACE_IDENTITIES.set(request, Object.freeze({ ...identity }));
}

async function observeWorkspaceIdentity(root: string): Promise<ExecutionWorkerWorkspaceIdentityV1> {
  if (constants.O_NOFOLLOW === undefined || constants.O_DIRECTORY === undefined) {
    throw new TypeError("No-follow worker workspace primitives are unavailable.");
  }
  if ((await realpath(root)) !== root) throw new TypeError("Worker workspace is not canonical.");
  const handle = await open(
    root,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    const [pinned, lexical] = await Promise.all([
      handle.stat({ bigint: true }),
      lstat(root, { bigint: true }),
    ]);
    const uid = typeof process.getuid === "function" ? process.getuid() : Number(pinned.uid);
    if (
      !pinned.isDirectory() ||
      pinned.dev !== lexical.dev ||
      pinned.ino !== lexical.ino ||
      pinned.uid !== lexical.uid ||
      Number(pinned.mode & 0o777n) !== 0o700 ||
      Number(pinned.uid) !== uid
    ) {
      throw new TypeError("Worker workspace identity is unsafe.");
    }
    return Object.freeze({ device: pinned.dev, inode: pinned.ino, uid });
  } finally {
    await handle.close();
  }
}

interface WorkerJobV1 {
  readonly revision: "execution-worker-job-v1";
  readonly request: ExecutionWorkerRequestV1;
  readonly outputLimitBytes: number;
  readonly evidenceLimitBytes: number;
}

interface PendingJob {
  readonly resolve: (completion: ExecutionWorkerCompletionV1) => void;
}

interface WorkerSlot {
  worker: Worker | undefined;
  generation: number;
  ready: Promise<void> | undefined;
  resolveReady: (() => void) | undefined;
  rejectReady: ((error: Error) => void) | undefined;
  pending: PendingJob | undefined;
  leased: boolean;
  completedCases: number;
  termination: Promise<void> | undefined;
}

interface Waiter {
  previous: Waiter | undefined;
  next: Waiter | undefined;
  wake(): void;
}

function failure(message: string): ExecutionOperationResultV1<ExecutionWorkerHandleV1> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({ code: "execution.io" as const, path: "/worker", message }),
    ]) as readonly [
      { readonly code: "execution.io"; readonly path: "/worker"; readonly message: string },
    ],
  });
}

function isReadyMessage(input: unknown): boolean {
  return (
    typeof input === "object" &&
    input !== null &&
    Reflect.get(input, "revision") === "execution-worker-ready-v1"
  );
}

function resourceFailure(error: Error): "output-exhaustion" | "evidence-exhaustion" | undefined {
  if (error.message.startsWith("output-exhaustion:")) return "output-exhaustion";
  if (error.message.startsWith("evidence-exhaustion:")) return "evidence-exhaustion";
  return undefined;
}

function workerEntryUrl(): URL {
  return new URL(
    import.meta.url.endsWith(".ts")
      ? "../dist/execution-worker-entry.js"
      : "./execution-worker-entry.js",
    import.meta.url,
  );
}

function workerEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  // NODE_OPTIONS is Node's environment-level startup channel for --import and --require preloads.
  // Other NODE_* variables do not independently inject an arbitrary startup module.
  // Tool lookup and real route subprocesses still need the remaining production environment.
  delete environment.NODE_OPTIONS;
  return environment;
}

async function boundedShutdown(operation: Promise<unknown>): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  let timedOut = false;
  try {
    await Promise.race([
      operation,
      new Promise<void>((resolve) => {
        timeout = setTimeout(() => {
          timedOut = true;
          resolve();
        }, WORKER_SHUTDOWN_MS);
        timeout.unref();
      }),
    ]);
    if (timedOut) throw new TypeError("Worker shutdown was not confirmed within its bound.");
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function validTransferInput(
  request: ExecutionWorkerRequestV1,
  outputLimitBytes: number,
  evidenceLimitBytes: number,
): boolean {
  return (
    request.source.bytes instanceof Uint8Array &&
    Object.getPrototypeOf(request.source.bytes) === Uint8Array.prototype &&
    (request.source.bytes.byteLength > 0 || request.caseKind === "invalid-diagnostic") &&
    request.source.bytes.byteLength <= evidenceLimitBytes &&
    Number.isSafeInteger(outputLimitBytes) &&
    outputLimitBytes > 0 &&
    outputLimitBytes <= EXECUTION_MAXIMUM_BUDGET_V1.outputBytes &&
    Number.isSafeInteger(evidenceLimitBytes) &&
    evidenceLimitBytes > 0 &&
    evidenceLimitBytes <= EXECUTION_MAXIMUM_BUDGET_V1.evidenceBytes
  );
}

/**
 * Creates a lazy fixed-slot pool with one in-flight case per worker.
 *
 * Each worker is replaced after a bounded batch and immediately after cancellation, crash or
 * protocol failure. The two slot records themselves are reused, so dead-worker history cannot
 * grow with campaign size.
 *
 * @example
 * ```ts
 * const workers = createExecutionWorkerExecutorV1();
 * const started = await workers.start(request, cancellation);
 * ```
 */
function createExecutionWorkerExecutorWithLimitV1(
  maxCasesPerWorker: number,
): ExecutionWorkerExecutorV1 {
  const slots: WorkerSlot[] = Array.from({ length: POOL_SIZE }, () => ({
    worker: undefined,
    generation: 0,
    ready: undefined,
    resolveReady: undefined,
    rejectReady: undefined,
    pending: undefined,
    leased: false,
    completedCases: 0,
    termination: undefined,
  }));
  let waiterHead: Waiter | undefined;
  let waiterTail: Waiter | undefined;
  let waiterCount = 0;
  let shuttingDown = false;
  let shutdownPromise: Promise<void> | undefined;

  const unlinkWaiter = (waiter: Waiter): void => {
    if (waiter.previous === undefined) waiterHead = waiter.next;
    else waiter.previous.next = waiter.next;
    if (waiter.next === undefined) waiterTail = waiter.previous;
    else waiter.next.previous = waiter.previous;
    waiter.previous = undefined;
    waiter.next = undefined;
    waiterCount -= 1;
  };

  const notifyWaiter = (): void => waiterHead?.wake();

  const resetSlot = (slot: WorkerSlot): void => {
    slot.worker = undefined;
    slot.ready = undefined;
    slot.resolveReady = undefined;
    slot.rejectReady = undefined;
    slot.pending = undefined;
    slot.leased = false;
    slot.completedCases = 0;
    slot.termination = undefined;
  };

  const spawnInto = (slot: WorkerSlot): void => {
    if (shuttingDown || slot.worker !== undefined) return;
    slot.generation += 1;
    const generation = slot.generation;
    let resolveReady = (): void => undefined;
    let rejectReady = (_error: Error): void => undefined;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    void ready.catch(() => undefined);
    const worker = new Worker(workerEntryUrl(), {
      execArgv: [],
      env: workerEnvironment(),
      resourceLimits: {
        maxOldGenerationSizeMb: 96,
        maxYoungGenerationSizeMb: 16,
        stackSizeMb: 4,
      },
    });
    slot.worker = worker;
    slot.ready = ready;
    slot.resolveReady = resolveReady;
    slot.rejectReady = rejectReady;
    slot.pending = undefined;
    slot.leased = false;
    slot.completedCases = 0;
    slot.termination = undefined;
    worker.on("message", (value: unknown) => {
      if (slot.generation !== generation || slot.worker !== worker) return;
      if (isReadyMessage(value)) {
        slot.resolveReady?.();
        return;
      }
      const pending = slot.pending;
      if (pending === undefined) return;
      slot.pending = undefined;
      pending.resolve({ kind: "message", value });
    });
    worker.on("error", (error) => {
      if (slot.generation !== generation || slot.worker !== worker) return;
      slot.rejectReady?.(error);
      const pending = slot.pending;
      slot.pending = undefined;
      const observed = resourceFailure(error);
      pending?.resolve({
        kind: "crash",
        exitCode: null,
        ...(observed === undefined ? {} : { resourceFailure: observed }),
      });
      notifyWaiter();
    });
    worker.on("exit", (exitCode) => {
      if (slot.generation !== generation || slot.worker !== worker) return;
      slot.rejectReady?.(new Error(`Worker exited before readiness (${exitCode}).`));
      const pending = slot.pending;
      slot.pending = undefined;
      pending?.resolve({ kind: "crash", exitCode });
      resetSlot(slot);
      notifyWaiter();
    });
    worker.unref();
  };

  const terminateSlot = (slot: WorkerSlot): Promise<void> => {
    slot.termination ??= (async () => {
      const worker = slot.worker;
      if (worker === undefined) {
        resetSlot(slot);
        return;
      }
      slot.leased = true;
      slot.pending = undefined;
      await boundedShutdown(worker.terminate());
      if (slot.worker === worker) resetSlot(slot);
      notifyWaiter();
    })();
    return slot.termination;
  };

  const acquire = async (
    cancellation: ExecutionCancellationV1,
  ): Promise<WorkerSlot | undefined> => {
    for (;;) {
      if (
        shuttingDown ||
        cancellation.signal.aborted ||
        performance.now() > cancellation.deadlineMonotonicMs
      ) {
        return undefined;
      }
      for (const slot of slots) {
        if (slot.worker === undefined) spawnInto(slot);
        if (slot.worker === undefined || slot.leased || slot.termination !== undefined) continue;
        slot.leased = true;
        slot.worker.ref();
        try {
          await slot.ready;
          if (cancellation.signal.aborted || performance.now() > cancellation.deadlineMonotonicMs) {
            await terminateSlot(slot);
            return undefined;
          }
          return slot;
        } catch {
          await terminateSlot(slot).catch(() => undefined);
        }
      }
      if (waiterCount >= MAX_WAITERS) return undefined;
      let timeout: NodeJS.Timeout | undefined;
      let onAbort = (): void => undefined;
      await new Promise<void>((resolve) => {
        let settled = false;
        const waiter: Waiter = {
          previous: waiterTail,
          next: undefined,
          wake: () => {
            if (settled) return;
            settled = true;
            unlinkWaiter(waiter);
            if (timeout !== undefined) clearTimeout(timeout);
            cancellation.signal.removeEventListener("abort", onAbort);
            resolve();
          },
        };
        if (waiterTail === undefined) waiterHead = waiter;
        else waiterTail.next = waiter;
        waiterTail = waiter;
        waiterCount += 1;
        onAbort = waiter.wake;
        cancellation.signal.addEventListener("abort", onAbort, { once: true });
        timeout = setTimeout(
          waiter.wake,
          Math.max(0, cancellation.deadlineMonotonicMs - performance.now()),
        );
        timeout.unref();
      });
    }
  };

  return Object.freeze({
    async start(
      request: ExecutionWorkerRequestV1,
      cancellation: ExecutionCancellationV1,
    ): Promise<ExecutionOperationResultV1<ExecutionWorkerHandleV1>> {
      if (cancellation.signal.aborted) return failure("Worker launch was already cancelled.");
      const outputLimitBytes =
        cancellation.outputLimitBytes ?? EXECUTION_MAXIMUM_BUDGET_V1.outputBytes;
      const evidenceLimitBytes =
        cancellation.evidenceLimitBytes ?? EXECUTION_MAXIMUM_BUDGET_V1.evidenceBytes;
      if (!validTransferInput(request, outputLimitBytes, evidenceLimitBytes)) {
        return failure("Worker request exceeds its retained transfer bounds.");
      }
      let workspaceIdentity =
        REQUEST_WORKSPACE_IDENTITIES.get(request) ?? request.workspaceIdentity;
      if (workspaceIdentity === undefined) {
        try {
          workspaceIdentity = await observeWorkspaceIdentity(request.caseRoot);
        } catch (error) {
          return failure(
            error instanceof Error ? error.message : "Worker workspace identity is unavailable.",
          );
        }
      }
      const slot = await acquire(cancellation);
      if (slot === undefined) return failure("Worker launch exceeded its cancellation bound.");
      const worker = slot.worker;
      if (worker === undefined) return failure("Worker slot lost its owned worker.");
      const sourceBytes = request.source.bytes.slice();
      const copiedRequest = {
        ...request,
        workspaceIdentity,
        source: { ...request.source, bytes: sourceBytes },
      } as ExecutionWorkerRequestV1;
      const job: WorkerJobV1 = {
        revision: "execution-worker-job-v1",
        request: copiedRequest,
        outputLimitBytes,
        evidenceLimitBytes,
      };
      const completion = new Promise<ExecutionWorkerCompletionV1>((resolve) => {
        slot.pending = { resolve };
      });
      try {
        worker.postMessage(job, [sourceBytes.buffer]);
      } catch (error) {
        await terminateSlot(slot).catch(() => undefined);
        return failure(error instanceof Error ? error.message : "Worker request transfer failed.");
      }
      let settled = false;
      const settleSlot = async (healthy: boolean): Promise<void> => {
        if (settled) return;
        settled = true;
        slot.pending = undefined;
        if (!healthy || slot.worker !== worker) {
          await terminateSlot(slot);
          return;
        }
        slot.completedCases += 1;
        slot.leased = false;
        worker.unref();
        if (slot.completedCases >= maxCasesPerWorker) await terminateSlot(slot);
        else notifyWaiter();
      };
      return Object.freeze({
        ok: true,
        value: Object.freeze({
          completion,
          workerIdentity: worker.threadId,
          batchOrdinal: slot.completedCases + 1,
          terminate: () => settleSlot(false),
          release: () => settleSlot(true),
        }),
      });
    },
    shutdown(): Promise<void> {
      shutdownPromise ??= (async () => {
        shuttingDown = true;
        while (waiterHead !== undefined) waiterHead.wake();
        const results = await Promise.allSettled(slots.map((slot) => terminateSlot(slot)));
        const failed = results.find((result) => result.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
      })();
      return shutdownPromise;
    },
  });
}

/** Creates the ordinary bounded worker pool with eight cases per worker. */
export function createExecutionWorkerExecutorV1(): ExecutionWorkerExecutorV1 {
  return createExecutionWorkerExecutorWithLimitV1(MAX_CASES_PER_WORKER);
}

/** Creates a dedicated executor whose worker survives exactly one bounded attempt. */
export function createDedicatedExecutionWorkerExecutorV1(
  caseLimit: number,
): ExecutionWorkerExecutorV1 {
  if (!Number.isSafeInteger(caseLimit) || caseLimit < 1 || caseLimit > 64) {
    throw new TypeError("Dedicated worker case limit must be between 1 and 64.");
  }
  return createExecutionWorkerExecutorWithLimitV1(caseLimit);
}

let sharedExecutor: ExecutionWorkerExecutorV1 | undefined;

/** Lazy shared production pool. Importing the package creates no worker or event-loop authority. */
export const defaultExecutionWorkerExecutorV1: ExecutionWorkerExecutorV1 = Object.freeze({
  start(request: ExecutionWorkerRequestV1, cancellation: ExecutionCancellationV1) {
    sharedExecutor ??= createExecutionWorkerExecutorV1();
    return sharedExecutor.start(request, cancellation);
  },
  async shutdown(): Promise<void> {
    const executor = sharedExecutor;
    sharedExecutor = undefined;
    await executor?.shutdown?.();
  },
});
