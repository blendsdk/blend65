import { createHash } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import { vi } from "vitest";

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
  readonly sequenceEvidence?: FailureExecutionSpecDataV1;
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

/** Builds a stable authority-report projection for sidecar association tests. */
export function createFailureExecutionReportProjectionV1(
  results: readonly FailureExecutionSpecDataV1[],
): FailureExecutionSpecDataV1 {
  return {
    revision: "execution-authority-report-v1",
    parentDigest: `sha256:${"1".repeat(64)}`,
    oracleDigest: `sha256:${"2".repeat(64)}`,
    campaignDigest: `sha256:${"3".repeat(64)}`,
    routePlanDigest: `sha256:${"4".repeat(64)}`,
    target: "c64",
    seed: "5".repeat(64),
    toolVersions: [{ tool: "node", version: process.version }],
    projectionRevisions: [],
    results,
    summary: {
      status: results.every((result) => result.status === "pass") ? "pass" : "failure",
      selectedCases: results.length,
      passedCases: results.filter((result) => result.status === "pass").length,
      blockers: [],
    },
  };
}

type Digest = FailureExecutionSpecDigestV1;
type Api = FailureExecutionSpecApiV1;
type Result<T> = FailureExecutionSpecResultV1<T>;

/** Deterministic confirmation histories available to the failure-execution oracle. */
export type FailureExecutionSpecScenarioV1 =
  | "standalone-stable"
  | "sequence-only"
  | "flaky"
  | "infrastructure-with-passing-control";

/** Optional bounded sequence shape for a controlled confirmation history. */
export interface FailureExecutionSpecFixtureOptionsV1 {
  readonly failingPosition?: number;
  readonly sequenceLength?: number;
}

/** Activity emitted by real worker threads and child processes owned by one fixture. */
export interface FailureExecutionSpecActivityV1 {
  readonly workerThreads: number[];
  readonly isolateIdentities: Digest[];
  readonly rootIdentities: Digest[];
  readonly processLaunches: number[];
}

/** Genuine authority inputs plus independently observable isolation activity. */
export interface FailureExecutionSpecFixtureV1 {
  readonly parent: object;
  readonly execution: object;
  readonly originalRequest: object;
  readonly origin: object;
  readonly candidate: object;
  readonly budget: object;
  readonly expectedDisposition:
    | "confirmed-source-failure"
    | "stateful-sequence-failure"
    | "flaky-failure";
  readonly expectedFailingPosition?: number;
  readonly activity: FailureExecutionSpecActivityV1;
  cleanup(): Promise<void>;
}

interface ControllerV1 {
  readonly scenario: FailureExecutionSpecScenarioV1;
  readonly failingPosition: number;
  readonly sequenceLength: number;
  readonly activity: FailureExecutionSpecActivityV1;
  freshOrdinal: number;
  candidateIdentity?: string;
}

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

interface WorkerHandleV1 {
  readonly completion: Promise<WorkerCompletionV1>;
  terminate(): Promise<void>;
}

interface WorkerExecutorV1 {
  start(request: WorkerRequestV1, cancellation: CancellationV1): Promise<Result<WorkerHandleV1>>;
  shutdown(): Promise<void>;
}

const WORKER_MODULE = "../execution-worker-executor.js";
const PROCESS_MODULE = "../execution-process.js";
const WORKER_ENTRY = new URL("./failure-execution-worker-spec-entry.js", import.meta.url);
const PROCESS_ENTRY = fileURLToPath(
  new URL("./failure-execution-process-spec-entry.js", import.meta.url),
);
const ENCODER = new TextEncoder();
let activeController: ControllerV1 | undefined;
const activeExecutors = new Set<WorkerExecutorV1>();

function digest(label: string): Digest {
  return `sha256:${createHash("sha256").update(label).digest("hex")}`;
}

function call<T>(api: Api, name: string, ...arguments_: readonly unknown[]): T {
  const callable = api[name];
  if (typeof callable !== "function") throw new TypeError(`missing callable ${name}`);
  return Reflect.apply(callable, undefined, arguments_) as T;
}

function success<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result.issues ?? result.diagnostics ?? []));
  }
  return result.value;
}

function recordValue(value: unknown, message: string): object {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value;
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

function outcome(
  controller: ControllerV1,
  request: WorkerRequestV1,
  dedicated: boolean,
): "pass" | "crash" {
  if (controller.candidateIdentity === undefined)
    controller.candidateIdentity = request.caseIdentity;
  if (controller.scenario === "standalone-stable") return "crash";
  if (controller.scenario === "sequence-only") {
    return dedicated && controller.freshOrdinal === controller.failingPosition ? "crash" : "pass";
  }
  if (controller.scenario === "flaky") return controller.freshOrdinal % 2 === 1 ? "crash" : "pass";
  return request.caseIdentity === controller.candidateIdentity ? "crash" : "pass";
}

function observeWorker(controller: ControllerV1, worker: Worker, label: string): void {
  controller.activity.workerThreads.push(worker.threadId);
  controller.activity.isolateIdentities.push(digest(`isolate:${label}:${worker.threadId}`));
  controller.activity.rootIdentities.push(digest(`root:${label}:${worker.threadId}`));
}

function freshExecutor(controller: ControllerV1): WorkerExecutorV1 {
  const workers = new Set<Worker>();
  const executor: WorkerExecutorV1 = {
    async start(value, cancellation) {
      const request = workerRequest(value);
      controller.freshOrdinal += 1;
      const selectedOutcome = outcome(controller, request, false);
      const worker = new Worker(WORKER_ENTRY, {
        workerData: { request, outcome: selectedOutcome },
      });
      workers.add(worker);
      observeWorker(controller, worker, `fresh:${controller.freshOrdinal}`);
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
          async terminate() {
            workers.delete(worker);
            await worker.terminate();
          },
        },
      };
    },
    async shutdown() {
      await Promise.all([...workers].map((worker) => worker.terminate()));
      workers.clear();
    },
  };
  activeExecutors.add(executor);
  return executor;
}

function dedicatedExecutor(controller: ControllerV1, caseLimit: number): WorkerExecutorV1 {
  if (!Number.isSafeInteger(caseLimit) || caseLimit < 1 || caseLimit > 64) {
    throw new TypeError("dedicated executor case limit");
  }
  const worker = new Worker(WORKER_ENTRY, { workerData: { persistent: true } });
  observeWorker(controller, worker, `sequence:${controller.failingPosition}`);
  let position = 0;
  let pending: ((completion: WorkerCompletionV1) => void) | undefined;
  worker.on("message", (message: WorkerCompletionV1) => {
    pending?.(message);
    pending = undefined;
  });
  const executor: WorkerExecutorV1 = {
    async start(value, cancellation) {
      if (pending !== undefined || position >= caseLimit) {
        return { ok: false, issues: [{ code: "execution-plan-capacity", path: "/worker" }] };
      }
      const request = workerRequest(value);
      position += 1;
      controller.freshOrdinal = position;
      const completion = new Promise<WorkerCompletionV1>((resolve) => {
        pending = resolve;
      });
      worker.postMessage({ request, outcome: outcome(controller, request, true) });
      if (cancellation.signal.aborted) await worker.terminate();
      return {
        ok: true,
        value: { completion, terminate: async () => void (await worker.terminate()) },
      };
    },
    async shutdown() {
      await worker.terminate();
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
      const child: ChildProcessWithoutNullStreams = spawn(
        process.execPath,
        [PROCESS_ENTRY, "pass"],
        {
          cwd: String(Reflect.get(request, "cwd")),
          stdio: ["pipe", "pipe", "pipe"],
        },
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

async function installControlledAdapters(controller: ControllerV1): Promise<void> {
  activeController = controller;
  vi.resetModules();
  vi.doMock(WORKER_MODULE, async () => {
    const actual = await vi.importActual<Api>(WORKER_MODULE);
    const defaultExecutor = freshExecutor(controller);
    return {
      ...actual,
      defaultExecutionWorkerExecutorV1: defaultExecutor,
      createExecutionWorkerExecutorV1: () => freshExecutor(controller),
      createDedicatedExecutionWorkerExecutorV1: (caseLimit: number) =>
        dedicatedExecutor(controller, caseLimit),
    };
  });
  vi.doMock(PROCESS_MODULE, async () => {
    const actual = await vi.importActual<Api>(PROCESS_MODULE);
    const runtime = fixedProcessRuntime(controller);
    return {
      ...actual,
      defaultExecutionProcessRuntimeV1: runtime,
      createExecutionProcessRuntimeV1: () => runtime,
    };
  });
}

function validateOptions(
  scenario: FailureExecutionSpecScenarioV1,
  options: FailureExecutionSpecFixtureOptionsV1,
): { readonly failingPosition: number; readonly sequenceLength: number } {
  if (
    ![
      "standalone-stable",
      "sequence-only",
      "flaky",
      "infrastructure-with-passing-control",
    ].includes(scenario)
  ) {
    throw new TypeError("unknown failure-execution scenario");
  }
  const failingPosition = options.failingPosition ?? 2;
  const sequenceLength = options.sequenceLength ?? failingPosition;
  if (
    !Number.isSafeInteger(failingPosition) ||
    !Number.isSafeInteger(sequenceLength) ||
    failingPosition < 1 ||
    failingPosition > 64 ||
    sequenceLength < failingPosition ||
    sequenceLength > 64
  ) {
    throw new TypeError("failure-execution sequence bounds");
  }
  return { failingPosition, sequenceLength };
}

/**
 * Creates one genuine publication-bound confirmation input with controlled external activity.
 * Invalid scenario bounds are rejected before any production module is loaded.
 */
export async function createFailureExecutionSpecFixtureV1(
  scenario: FailureExecutionSpecScenarioV1,
  options: FailureExecutionSpecFixtureOptionsV1 = {},
): Promise<FailureExecutionSpecFixtureV1> {
  const { failingPosition, sequenceLength } = validateOptions(scenario, options);
  const activity: FailureExecutionSpecActivityV1 = {
    workerThreads: [],
    isolateIdentities: [],
    rootIdentities: [],
    processLaunches: [],
  };
  const controller: ControllerV1 = {
    scenario,
    failingPosition,
    sequenceLength,
    activity,
    freshOrdinal: 0,
  };
  await installControlledAdapters(controller);

  const catalogFixtures = await vi.importActual<Api>(
    "./execution-publication-catalog-spec-fixture.js",
  );
  const campaignFixtures = await vi.importActual<Api>("./genuine-execution-campaign.js");
  const readiness = await vi.importActual<Api>("@blend65/readiness");
  const reduction = await vi.importActual<Api>("@blend65/readiness/failure-reduction-internals");
  const published = await vi.importActual<Api>("@blend65/readiness/published-oracle");
  const executionApi = await vi.importActual<Api>("../index.js");
  const catalog = await call<
    Promise<{
      readonly repositoryRoot: string;
      readonly parentDigest: Digest;
      cleanup(): Promise<void>;
    }>
  >(catalogFixtures, "createExecutionPublicationCatalogFixtureV1");
  try {
    const parent = success(
      await call<Promise<Result<object>>>(readiness, "resolvePublishedSnapshotByDigest", {
        repositoryRoot: catalog.repositoryRoot,
        publicationDigest: catalog.parentDigest,
      }),
    );
    const execution = success(
      call<Result<object>>(executionApi, "resolveExecutionReviewContextV1", parent),
    );
    const oracle = success(call<Result<object>>(published, "createPublishedOracleContext", parent));
    const campaign = (
      await call<Promise<{ readonly orchestration: object }>>(
        campaignFixtures,
        "createGenuineExecutionCampaigns",
        parent,
      )
    ).orchestration;
    const item = success(
      call<Result<Record<string, unknown>>>(readiness, "getCampaignPlanItem", campaign, 0),
    );
    const executionCase = success(
      call<Result<object>>(readiness, "createExecutionCaseV1", campaign, 0, {
        kind: "scalar-bytes",
        byteLength: 1,
      }),
    );
    const projection = success(
      call<Result<Record<string, unknown>>>(
        readiness,
        "getExecutionCaseProjectionV1",
        executionCase,
      ),
    );
    const request = recordValue(Reflect.get(item, "request"), "campaign request");
    const choice = recordValue(Reflect.get(request, "choice"), "campaign choice");
    const ruleId = String(Reflect.get(choice, "ruleId"));
    const caseIdentity = String(projection.sourceCaseDigest);
    const route = {
      caseIdentity,
      ruleId,
      obligation: "frontend",
      terminalTier: "frontend",
      prerequisiteTiers: [],
      rankDigest: digest("failure-execution-route"),
    };
    const executionPolicy = Object.freeze({
      revision: "execution-policy-v1",
      budget: Object.freeze({
        operationMs: 1_000,
        launchAttemptMs: 1_000,
        routeMs: 10_000,
        cleanupGraceMs: 1_000,
        outputBytes: 64,
        evidenceBytes: 16_777_216,
        instructions: 100,
        cycles: 1_000,
        launchAttempts: 2,
      }),
    });
    const originalRequest = success(
      call<Result<object>>(executionApi, "createExecutionRouteRequestV1", {
        route,
        executionCase,
        oracle,
        policy: executionPolicy,
      }),
    );
    const routePlanBytes = ENCODER.encode(`${JSON.stringify(route)}\n`);
    const predicate = success(
      call<Result<{ readonly predicate: object }>>(readiness, "deriveFailurePredicateIdentityV1", {
        revision: "failure-predicate-v1",
        resultCode: "compiler-ice",
        terminalTier: "frontend",
        terminalStage: "frontend",
        observation: { kind: "observed", digest: digest("failure-observation") },
        cleanup: "cleanup-clear",
        primaryRuleId: ruleId,
        requiredClaimedRuleIds: [ruleId],
        target: "c64",
        routeContract: {
          originalRouteKind: "valid-envelope",
          terminalTier: "frontend",
          obligation: "frontend",
          prerequisiteTiers: [],
          policyDigest: digest(JSON.stringify(executionPolicy)),
          fixtureDigest: digest("failure-execution-fixture"),
          oracleContractDigest: digest("failure-execution-oracle"),
          toolContractDigests: [],
        },
      }),
    ).predicate;
    const failurePolicy = readiness.FAILURE_REDUCTION_DEFAULT_POLICY_V1;
    const origin = success(
      call<Result<object>>(readiness, "authorizeFailureEnvelopeV1", {
        revision: "failure-envelope-authorization-input-v1",
        source: { kind: "typed-valid", authority: executionCase },
        routePlanBytes,
        routePlanDigest: digest(new TextDecoder().decode(routePlanBytes)),
        predicate,
        policy: failurePolicy,
        observationBytes: new Uint8Array(),
        toolVersions: [],
      }),
    );
    const initial = success(
      call<Result<object>>(reduction, "createInitialReductionCandidateV1", origin),
    );
    const candidate = success(
      call<Result<object>>(reduction, "createReductionCandidateAuthorityV1", origin, initial, []),
    );
    const budget = success(
      call<Result<object>>(readiness, "createFailureCampaignBudgetAuthorityV1", failurePolicy, {
        nonPassResults: 0,
        resolvableNonPassResults: 0,
      }),
    );
    const expectedDisposition =
      scenario === "standalone-stable" || scenario === "infrastructure-with-passing-control"
        ? "confirmed-source-failure"
        : scenario === "sequence-only"
          ? "stateful-sequence-failure"
          : "flaky-failure";
    return {
      parent,
      execution,
      originalRequest,
      origin,
      candidate,
      budget,
      expectedDisposition,
      ...(scenario === "sequence-only" ? { expectedFailingPosition: failingPosition } : {}),
      activity,
      async cleanup() {
        await Promise.all([...activeExecutors].map((executor) => executor.shutdown()));
        activeExecutors.clear();
        await catalog.cleanup();
        vi.doUnmock(WORKER_MODULE);
        vi.doUnmock(PROCESS_MODULE);
        vi.resetModules();
        if (activeController === controller) activeController = undefined;
      },
    };
  } catch (error) {
    await catalog.cleanup();
    vi.doUnmock(WORKER_MODULE);
    vi.doUnmock(PROCESS_MODULE);
    vi.resetModules();
    throw error;
  }
}
