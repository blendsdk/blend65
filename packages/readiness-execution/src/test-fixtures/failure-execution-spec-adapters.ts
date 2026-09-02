import { createHash } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import { vi } from "vitest";

import type { FailureCandidateViceLocalControllerV1 } from "./failure-candidate-vice-local-support.js";

type Result<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly issues: readonly { readonly code: string; readonly path: string }[];
    };

interface CancellationV1 {
  readonly signal: AbortSignal;
}

interface WorkerRequestV1 {
  readonly tier: "frontend" | "compiler-api" | "cli" | "emit";
  readonly contract: string;
  readonly caseIdentity: string;
}

interface WorkerCompletionV1 {
  readonly kind: "message" | "crash";
  readonly value?: unknown;
  readonly exitCode?: number | null;
}

interface DiagnosticOutcomeV1 {
  readonly code: string;
  readonly phase: "lexer" | "parser" | "semantic" | "sfa";
  readonly severity: "error";
}

type WorkerOutcomeV1 =
  | { readonly kind: "success" }
  | { readonly kind: "crash" }
  | {
      readonly kind: "diagnostic-entry";
      readonly entry: {
        readonly acceptedEntryId: "fixture-diagnostic-entry-v1";
        readonly code: string;
        readonly phase: DiagnosticOutcomeV1["phase"];
        readonly finalSeverity: DiagnosticOutcomeV1["severity"];
      };
    };

interface WorkerHandleV1 {
  readonly completion: Promise<WorkerCompletionV1>;
  readonly workerIdentity?: number;
  terminate(): Promise<void>;
}

interface WorkerExecutorV1 {
  start(request: WorkerRequestV1, cancellation: CancellationV1): Promise<Result<WorkerHandleV1>>;
  shutdown(): Promise<void>;
}

type ControllerV1 = FailureCandidateViceLocalControllerV1;
type Api = Readonly<Record<string, unknown>>;

const WORKER_MODULE = "../execution-worker-executor.js";
const PROCESS_MODULE = "../execution-process.js";
const WORKER_ENTRY = new URL(
  "../../dist/test-fixtures/failure-execution-worker-spec-entry.js",
  import.meta.url,
);
const PROCESS_ENTRY = fileURLToPath(
  new URL("../../dist/test-fixtures/failure-execution-process-spec-entry.js", import.meta.url),
);
let activeController: ControllerV1 | undefined;
const activeExecutors = new Set<WorkerExecutorV1>();

function digest(label: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(label).digest("hex")}`;
}

function workerRequest(value: unknown): WorkerRequestV1 {
  if (typeof value !== "object" || value === null) throw new TypeError("worker request");
  const tier = Reflect.get(value, "tier");
  const contract = Reflect.get(value, "contract");
  const caseIdentity = Reflect.get(value, "caseIdentity");
  if (
    !["frontend", "compiler-api", "cli", "emit"].includes(String(tier)) ||
    typeof contract !== "string" ||
    typeof caseIdentity !== "string"
  ) {
    throw new TypeError("worker request projection");
  }
  return { tier: tier as WorkerRequestV1["tier"], contract, caseIdentity };
}

function diagnosticWorkerOutcome(
  diagnostic: DiagnosticOutcomeV1,
  mismatch: boolean,
): WorkerOutcomeV1 {
  const code = mismatch ? (diagnostic.code === "E00000" ? "E00001" : "E00000") : diagnostic.code;
  return {
    kind: "diagnostic-entry",
    entry: {
      acceptedEntryId: "fixture-diagnostic-entry-v1",
      code,
      phase: diagnostic.phase,
      finalSeverity: diagnostic.severity,
    },
  };
}

function outcome(
  controller: ControllerV1,
  request: WorkerRequestV1,
  dedicated: boolean,
): WorkerOutcomeV1 {
  if (controller.phase === "report") controller.reportRoutePosition += 1;
  if (controller.phase === "report") {
    const selectedOccurrence =
      controller.reportRoutePosition === controller.failingPosition &&
      request.caseIdentity === controller.reportFailureIdentity;
    const mappedDiagnostic = controller.diagnosticOutcomes.get(request.caseIdentity);
    if (mappedDiagnostic !== undefined) {
      return diagnosticWorkerOutcome(
        mappedDiagnostic,
        selectedOccurrence && request.tier === controller.subjectTier,
      );
    }
    if (
      selectedOccurrence &&
      (controller.subjectTier === "acme" || controller.subjectTier === "vice") &&
      request.tier === "emit"
    ) {
      controller.armedProcessTier = controller.subjectTier;
      controller.armedProcessOrdinal = 0;
    }
    return selectedOccurrence && request.tier === controller.subjectTier
      ? { kind: "crash" }
      : { kind: "success" };
  }
  const mappedDiagnostic = controller.diagnosticOutcomes.get(request.caseIdentity);
  if (mappedDiagnostic !== undefined) return diagnosticWorkerOutcome(mappedDiagnostic, false);
  if (
    controller.selectedDiagnosticOutcome !== undefined &&
    request.tier === controller.subjectTier
  ) {
    return diagnosticWorkerOutcome(controller.selectedDiagnosticOutcome, true);
  }
  if (controller.candidateIdentity === undefined)
    controller.candidateIdentity = request.caseIdentity;
  if (controller.scenario === "standalone-stable") {
    return selectedWorkerOutcome(
      controller,
      request,
      request.caseIdentity === controller.candidateIdentity,
    );
  }
  if (controller.scenario === "sequence-only") {
    return selectedWorkerOutcome(
      controller,
      request,
      dedicated && request.caseIdentity === controller.candidateIdentity,
    );
  }
  if (controller.scenario === "flaky") {
    return selectedWorkerOutcome(controller, request, controller.freshOrdinal % 2 === 1);
  }
  return selectedWorkerOutcome(
    controller,
    request,
    request.caseIdentity === controller.candidateIdentity,
  );
}

function selectedWorkerOutcome(
  controller: ControllerV1,
  request: WorkerRequestV1,
  selectedOccurrence: boolean,
): WorkerOutcomeV1 {
  if (
    selectedOccurrence &&
    (controller.subjectTier === "acme" || controller.subjectTier === "vice") &&
    request.tier === "emit"
  ) {
    controller.armedProcessTier = controller.subjectTier;
    controller.armedProcessOrdinal = 0;
  }
  return selectedOccurrence && request.tier === controller.subjectTier
    ? { kind: "crash" }
    : { kind: "success" };
}

function observeWorker(controller: ControllerV1, worker: Worker, label: string): void {
  controller.activity.workerThreads.push(worker.threadId);
  controller.activity.isolateIdentities.push(digest(`isolate:${label}:${worker.threadId}`));
  controller.activity.rootIdentities.push(digest(`root:${label}:${worker.threadId}`));
}

function freshExecutor(controller: ControllerV1, owned: boolean): WorkerExecutorV1 {
  const workers = new Set<Worker>();
  const ownedOrdinal = owned ? (controller.ownedExecutorOrdinal += 1) : 0;
  const executor: WorkerExecutorV1 = {
    async start(value, cancellation) {
      const request = workerRequest(value);
      if (controller.phase === "candidate") controller.freshOrdinal += 1;
      const worker = new Worker(WORKER_ENTRY, {
        workerData: { request, outcome: outcome(controller, request, false) },
      });
      workers.add(worker);
      observeWorker(controller, worker, `fresh:${controller.freshOrdinal}`);
      controller.activity.workerRequests.push({
        caseIdentity: request.caseIdentity,
        tier: request.tier,
        workerIdentity: worker.threadId,
        dedicated: false,
      });
      const completion = new Promise<WorkerCompletionV1>((resolve) => {
        worker.once("message", (message: WorkerCompletionV1) => resolve(message));
        worker.once("error", () => resolve({ kind: "crash", exitCode: 1 }));
        worker.once("exit", (exitCode) => {
          workers.delete(worker);
          if (exitCode !== 0) resolve({ kind: "crash", exitCode });
        });
      });
      if (cancellation.signal.aborted) await worker.terminate();
      return {
        ok: true,
        value: {
          completion,
          workerIdentity: worker.threadId,
          async terminate() {
            workers.delete(worker);
            await worker.terminate();
          },
        },
      };
    },
    async shutdown() {
      if (owned) controller.activity.ownedShutdownAttempts.push(ownedOrdinal);
      await Promise.allSettled([...workers].map((worker) => worker.terminate()));
      workers.clear();
      if (
        owned &&
        controller.rejectOwnedShutdownOrdinal === ownedOrdinal &&
        !controller.rejectedOwnedShutdown
      ) {
        controller.rejectedOwnedShutdown = true;
        throw new Error("external worker fixture secret");
      }
    },
  };
  activeExecutors.add(executor);
  return executor;
}

function dedicatedExecutor(controller: ControllerV1, caseLimit: number): WorkerExecutorV1 {
  if (!Number.isSafeInteger(caseLimit) || caseLimit < 1 || caseLimit > 64) {
    throw new TypeError("dedicated executor case limit");
  }
  const sequenceAttempt = caseLimit >= 2;
  const worker = new Worker(WORKER_ENTRY, { workerData: { persistent: true } });
  const ownedOrdinal = (controller.ownedExecutorOrdinal += 1);
  observeWorker(
    controller,
    worker,
    sequenceAttempt
      ? `sequence:${controller.failingPosition}`
      : `standalone:${controller.freshOrdinal + 1}`,
  );
  let position = 0;
  let pending: ((completion: WorkerCompletionV1) => void) | undefined;
  worker.on("message", (message: WorkerCompletionV1) => {
    pending?.(message);
    pending = undefined;
  });
  const executor: WorkerExecutorV1 = {
    async start(value, cancellation) {
      const request = workerRequest(value);
      if (pending !== undefined || position >= caseLimit) {
        return { ok: false, issues: [{ code: "execution-plan-capacity", path: "/worker" }] };
      }
      position += 1;
      controller.freshOrdinal = position;
      controller.activity.workerRequests.push({
        caseIdentity: request.caseIdentity,
        tier: request.tier,
        workerIdentity: worker.threadId,
        dedicated: sequenceAttempt,
      });
      const completion = new Promise<WorkerCompletionV1>((resolve) => {
        pending = resolve;
      });
      worker.postMessage({ request, outcome: outcome(controller, request, sequenceAttempt) });
      if (cancellation.signal.aborted) await worker.terminate();
      return {
        ok: true,
        value: {
          completion,
          workerIdentity: worker.threadId,
          terminate: async () => void (await worker.terminate()),
        },
      };
    },
    async shutdown() {
      controller.activity.ownedShutdownAttempts.push(ownedOrdinal);
      await worker.terminate();
      if (
        controller.rejectOwnedShutdownOrdinal === ownedOrdinal &&
        !controller.rejectedOwnedShutdown
      ) {
        controller.rejectedOwnedShutdown = true;
        throw new Error("external worker fixture secret");
      }
    },
  };
  activeExecutors.add(executor);
  return executor;
}

function fixedProcessRuntime(controller: ControllerV1): object {
  return {
    async start(request: unknown, sink: unknown, cancellation: CancellationV1) {
      if (typeof request !== "object" || request === null) {
        return { ok: false, issues: [{ code: "execution.invalid-schema", path: "/request" }] };
      }
      let processOutcome: "pass" | "crash" = "pass";
      if (controller.armedProcessTier !== undefined) {
        controller.armedProcessOrdinal += 1;
        if (
          (controller.armedProcessTier === "acme" && controller.armedProcessOrdinal === 1) ||
          (controller.armedProcessTier === "vice" && controller.armedProcessOrdinal === 2)
        ) {
          processOutcome = "crash";
          delete controller.armedProcessTier;
          controller.armedProcessOrdinal = 0;
        }
      }
      const argv = Reflect.get(request, "argv");
      const cwd = String(Reflect.get(request, "cwd"));
      if (processOutcome === "pass" && Array.isArray(argv) && argv.includes("--vicelabels")) {
        writeFileSync(join(cwd, "main.prg"), Uint8Array.of(1, 2));
        writeFileSync(join(cwd, "main.lbl"), "labels");
        writeFileSync(join(cwd, "main.report"), "report");
      }
      const child: ChildProcessWithoutNullStreams = spawn(
        process.execPath,
        [PROCESS_ENTRY, processOutcome],
        { cwd, stdio: ["pipe", "pipe", "pipe"] },
      );
      if (child.pid === undefined) {
        return { ok: false, issues: [{ code: "tier-unavailable", path: "/process" }] };
      }
      controller.activity.processLaunches.push(child.pid);
      child.stdout.on("data", (bytes: Buffer) => {
        const onStdout =
          typeof sink === "object" && sink !== null ? Reflect.get(sink, "onStdout") : undefined;
        if (typeof onStdout === "function") Reflect.apply(onStdout, sink, [new Uint8Array(bytes)]);
      });
      child.stderr.on("data", (bytes: Buffer) => {
        const onStderr =
          typeof sink === "object" && sink !== null ? Reflect.get(sink, "onStderr") : undefined;
        if (typeof onStderr === "function") Reflect.apply(onStderr, sink, [new Uint8Array(bytes)]);
      });
      if (cancellation.signal.aborted) child.kill("SIGKILL");
      return {
        ok: true,
        value: {
          identity: {
            bootId: "failure-execution-spec-boot",
            pid: child.pid,
            startTicks: BigInt(child.pid),
            processGroupId: child.pid,
          },
          completion: new Promise((resolve) => {
            child.once("exit", (exitCode) => resolve({ exitCode, signal: null }));
          }),
          revalidateIdentity: async () => child.exitCode === null,
          terminate: async (signal: NodeJS.Signals) => void child.kill(signal),
        },
      };
    },
  };
}

/** Installs deterministic true-boundary worker and process adapters for one controlled oracle. */
export async function installControlledFailureExecutionAdaptersV1(
  controller: ControllerV1,
): Promise<void> {
  activeController = controller;
  const actualWorker = await vi.importActual<Api>(WORKER_MODULE);
  const actualProcess = await vi.importActual<Api>(PROCESS_MODULE);
  vi.resetModules();
  vi.doMock(WORKER_MODULE, async () => {
    const defaultExecutor = freshExecutor(controller, false);
    return {
      ...actualWorker,
      defaultExecutionWorkerExecutorV1: defaultExecutor,
      createExecutionWorkerExecutorV1: () => freshExecutor(controller, true),
      createDedicatedExecutionWorkerExecutorV1: (caseLimit: number) =>
        dedicatedExecutor(controller, caseLimit),
    };
  });
  vi.doMock(PROCESS_MODULE, async () => {
    const runtime = fixedProcessRuntime(controller);
    return {
      ...actualProcess,
      defaultExecutionProcessRuntimeV1: runtime,
      createExecutionProcessRuntimeV1: () => runtime,
    };
  });
}

/** Settles every controlled adapter and removes its module substitutions. */
export async function cleanupControlledFailureExecutionAdaptersV1(
  controller: ControllerV1,
): Promise<void> {
  await Promise.allSettled([...activeExecutors].map((executor) => executor.shutdown()));
  activeExecutors.clear();
  vi.doUnmock(WORKER_MODULE);
  vi.doUnmock(PROCESS_MODULE);
  vi.resetModules();
  if (activeController === controller) activeController = undefined;
}
