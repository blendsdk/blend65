import { access, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ExecutionOperationResultV1, ExecutionResultV1 } from "@blend65/readiness";
import {
  createPublishedDiagnosticCaseV1,
  getPublishedDiagnosticCaseProjectionV1,
} from "@blend65/readiness/published-oracle";

import {
  SPEC_POLICY,
  createGenuineDiagnosticFixture,
  createGenuineRouteFixture,
  createOwnershipProbe,
  scriptedWorker,
  type DiagnosticRouteRequest,
  successfulWorkerResponse,
  type GenuineRouteFixture,
  type GenuineDiagnosticFixture,
  type RouteRequest,
  type WorkerExecutor,
} from "./test-fixtures/execution-adapters-safety-spec-fixture.js";
import {
  createExecutionRouteHandlersV1,
  type ExecutionRouteRequestV1,
} from "./execution-route-adapters.js";
import { createExecutionSupervisorV1, type ExecutionSupervisorV1 } from "./execution-supervisor.js";
import type { ExecutionWorkerRequestV1 } from "./execution-worker-protocol.js";
import * as execution from "./index.js";

const cancellation = {
  signal: new AbortController().signal,
  deadlineMonotonicMs: 10_000,
};

let genuine: GenuineRouteFixture;
let diagnostic: GenuineDiagnosticFixture;

function requireSuccess<T>(result: ExecutionOperationResultV1<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return result.value;
}

function supervisor(worker: WorkerExecutor): ExecutionSupervisorV1 {
  return requireSuccess(
    createExecutionSupervisorV1(SPEC_POLICY, {
      workerExecutor: worker,
      time: {
        monotonicNow: () => 0,
        waitUntil: async () => "deadline",
      },
    }),
  );
}

function route(tier: keyof GenuineRouteFixture["requests"]): ExecutionRouteRequestV1 {
  return requireSuccess(execution.createExecutionRouteRequestV1(genuine.requests[tier]));
}

function handlers(
  worker: WorkerExecutor,
  lifecycle: ExecutionSupervisorV1,
  runner: {
    run(
      request: {
        binaryPath: string;
        labelPath: string;
        reportPath: string;
      },
      controls: object,
    ): Promise<{ exitCode: number; stderr: string }>;
  } = { run: async () => ({ exitCode: 1, stderr: "failure" }) },
) {
  return createExecutionRouteHandlersV1({
    worker: { executor: worker },
    acme: { runner },
    lifecycle: { supervisor: lifecycle },
    vice: {
      execute: async (): Promise<ExecutionResultV1> => ({
        status: "failure",
        tier: "vice",
        stage: "vice-launch",
        code: "tier-unavailable",
        usage: {
          wallMs: 0,
          outputBytes: 0,
          evidenceBytes: 0,
          instructions: 0,
          cycles: 0,
          launchAttempts: 0,
        },
        evidence: {
          digest: `sha256:${"0".repeat(64)}`,
          retainedBytes: 0,
          truncated: false,
        },
      }),
    },
  });
}

beforeAll(async () => {
  [genuine, diagnostic] = await Promise.all([
    createGenuineRouteFixture({
      createExecutionRouteRequestV1(input) {
        return execution.createExecutionRouteRequestV1(
          input,
        ) as ExecutionOperationResultV1<RouteRequest>;
      },
    }),
    createGenuineDiagnosticFixture(
      {
        createExecutionRouteRequestV1(input: unknown) {
          return execution.createExecutionRouteRequestV1(
            input as never,
          ) as ExecutionOperationResultV1<DiagnosticRouteRequest>;
        },
      },
      {
        createPublishedDiagnosticCaseV1(context, campaign, ordinal) {
          return createPublishedDiagnosticCaseV1(context as never, campaign, ordinal) as never;
        },
        getPublishedDiagnosticCaseProjectionV1(value) {
          return getPublishedDiagnosticCaseProjectionV1(value as never) as never;
        },
      },
    ),
  ]);
}, 120_000);

afterAll(async () => {
  await Promise.all([genuine.cleanup(), diagnostic.cleanup()]);
});

describe("execution route adapter classifications", () => {
  it("should accept only the exact invalid expensive-obligation projection", () => {
    const base = diagnostic.requests["compiler-api"];
    for (const obligation of ["emit", "acme", "vice"] as const) {
      expect(
        execution.createExecutionRouteRequestV1({
          ...base,
          route: { ...base.route, obligation },
        } as never),
      ).toMatchObject({
        ok: true,
        value: { route: { obligation, terminalTier: "compiler-api" } },
      });
    }
    for (const route of [
      { ...base.route, obligation: "vice", terminalTier: "frontend", prerequisiteTiers: [] },
      { ...base.route, obligation: "vice", terminalTier: "emit" },
      { ...base.route, obligation: "frontend" },
    ]) {
      expect(execution.createExecutionRouteRequestV1({ ...base, route } as never).ok).toBe(false);
    }
  });

  it("should reject route, policy, case, and oracle authority mutants", () => {
    const base = genuine.requests.frontend;
    expect(
      execution.createExecutionRouteRequestV1({
        ...base,
        route: { ...base.route, caseIdentity: `sha256:${"0".repeat(64)}` },
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-evidence-input", path: "/route" }] });
    expect(
      execution.createExecutionRouteRequestV1({
        ...base,
        route: { ...base.route, prerequisiteTiers: ["frontend"] },
      }),
    ).toMatchObject({ ok: false, issues: [{ path: "/route" }] });
    expect(
      execution.createExecutionRouteRequestV1({
        ...base,
        policy: { ...base.policy, budget: { ...base.policy.budget, outputBytes: 0 } },
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "execution.invalid-schema" }] });
    expect(
      Reflect.apply(execution.createExecutionRouteRequestV1, undefined, [
        { ...base, executionCase: {} },
      ]),
    ).toMatchObject({ ok: false });
    expect(
      Reflect.apply(execution.createExecutionRouteRequestV1, undefined, [
        { ...base, oracle: { selectedReleaseDigest: base.oracle.selectedReleaseDigest } },
      ]),
    ).toMatchObject({ ok: false, issues: [{ path: "/oracle" }] });
  });

  it("should render the canonical envelope into all four worker mappings", async () => {
    for (const tier of ["frontend", "compiler-api", "cli", "emit"] as const) {
      const worker = scriptedWorker("success", createOwnershipProbe());
      const lifecycle = supervisor(worker);
      const result = await handlers(worker, lifecycle)[tier].execute(route(tier), cancellation);
      expect(result).toMatchObject({ status: "pass", tier });
      expect(new TextDecoder().decode(worker.requests[0]?.source.bytes)).toContain(
        "__execution_completion = 165;",
      );
      expect(worker.requests[0]?.tier).toBe(tier);
      await lifecycle.cleanup();
    }
  });

  it("should reject cross-tier and pre-cancelled requests before acquiring resources", async () => {
    const worker = scriptedWorker("success", createOwnershipProbe());
    const lifecycle = supervisor(worker);
    expect(
      await handlers(worker, lifecycle).frontend.execute(route("cli"), cancellation),
    ).toMatchObject({ status: "failure", stage: "input", code: "invalid-evidence-input" });
    const controller = new AbortController();
    controller.abort();
    expect(
      await handlers(worker, lifecycle).emit.execute(route("emit"), {
        signal: controller.signal,
        deadlineMonotonicMs: 0,
      }),
    ).toMatchObject({ status: "failure", stage: "input", code: "invalid-evidence-input" });
    expect(worker.requests).toEqual([]);

    const mismatched = scriptedWorker("success", createOwnershipProbe());
    expect(
      await handlers(mismatched, lifecycle).frontend.execute(route("frontend"), cancellation),
    ).toMatchObject({ status: "failure", stage: "input", code: "invalid-evidence-input" });
    expect(mismatched.requests).toEqual([]);
  });

  it("should classify workspace acquisition failures at both compiler boundaries", async () => {
    const worker = scriptedWorker("success", createOwnershipProbe());
    const lifecycle = requireSuccess(
      createExecutionSupervisorV1(SPEC_POLICY, {
        workerExecutor: worker,
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
        workspaceProvider: {
          create: async () => ({
            ok: false,
            issues: [{ code: "execution.io", path: "/workspace", message: "injected" }],
          }),
        },
      }),
    );
    const selected = handlers(worker, lifecycle);
    expect(await selected.frontend.execute(route("frontend"), cancellation)).toMatchObject({
      status: "failure",
      code: "compiler-ice",
    });
    expect(await selected.acme.execute(route("acme"), cancellation)).toMatchObject({
      status: "failure",
      code: "assembler-failure",
    });
    await lifecycle.cleanup();
  });

  it("should reject validly shaped later-artifact evidence", async () => {
    const worker: WorkerExecutor = {
      async start(request) {
        const response = successfulWorkerResponse(request);
        return {
          ok: true,
          value: {
            completion: Promise.resolve({
              kind: "message",
              value: { ...response, emission: { il: false, assembly: false, binary: true } },
            }),
            terminate: async () => undefined,
          },
        };
      },
    };
    const lifecycle = supervisor(worker);
    expect(
      await handlers(worker, lifecycle).frontend.execute(route("frontend"), cancellation),
    ).toMatchObject({ status: "failure", code: "unexpected-emission" });
    await lifecycle.cleanup();
  });

  it("should reject each tier's missing positive evidence without widening the contract", async () => {
    for (const tier of ["frontend", "compiler-api", "cli", "emit"] as const) {
      const worker: WorkerExecutor = {
        async start(request) {
          const response = successfulWorkerResponse(request);
          const value =
            response.tier === "frontend"
              ? { ...response, semanticModelPresent: false }
              : response.tier === "compiler-api"
                ? { ...response, hasErrors: true }
                : response.tier === "cli"
                  ? { ...response, exitCode: 1 as const }
                  : { ...response, hasErrors: true };
          return {
            ok: true,
            value: {
              completion: Promise.resolve({ kind: "message", value }),
              terminate: async () => undefined,
            },
          };
        },
      };
      const lifecycle = supervisor(worker);
      expect(
        await handlers(worker, lifecycle)[tier].execute(route(tier), cancellation),
      ).toMatchObject({ status: "failure", code: "unexpected-emission" });
      await lifecycle.cleanup();
    }
  });

  it("should preserve worker resource failures and classify an unqualified crash as an ICE", async () => {
    for (const [resourceFailure, expected] of [
      ["output-exhaustion", "output-exhaustion"],
      ["evidence-exhaustion", "evidence-exhaustion"],
      [undefined, "compiler-ice"],
    ] as const) {
      const worker: WorkerExecutor = {
        async start() {
          return {
            ok: true,
            value: {
              completion: Promise.resolve({
                kind: "crash",
                exitCode: null,
                ...(resourceFailure === undefined ? {} : { resourceFailure }),
              }),
              terminate: async () => undefined,
            },
          };
        },
      };
      const lifecycle = supervisor(worker);
      expect(
        await handlers(worker, lifecycle).frontend.execute(route("frontend"), cancellation),
      ).toMatchObject({ status: "failure", code: expected });
      await lifecycle.cleanup();
    }
  });

  it("should require emit evidence and all declared ACME artifacts before passing", async () => {
    const worker = scriptedWorker("success", createOwnershipProbe());
    const lifecycle = supervisor(worker);
    let observedControls: object | undefined;
    const result = await handlers(worker, lifecycle, {
      async run(request, controls) {
        observedControls = controls;
        await Promise.all([
          writeFile(request.binaryPath, Uint8Array.of(1, 2)),
          writeFile(request.labelPath, "labels"),
          writeFile(request.reportPath, "report"),
        ]);
        return { exitCode: 0, stderr: "" };
      },
    }).acme.execute(route("acme"), cancellation);
    expect(result).toMatchObject({ status: "pass", tier: "acme" });
    expect(worker.requests).toHaveLength(1);
    expect(worker.requests[0]?.tier).toBe("emit");
    expect(observedControls).toMatchObject({ deadlineMonotonicMs: 9_000 });
    await lifecycle.cleanup();
  });

  it("should classify missing artifacts and non-discovery exceptions as assembler failures", async () => {
    const worker = scriptedWorker("success", createOwnershipProbe());
    const firstLifecycle = supervisor(worker);
    expect(
      await handlers(worker, firstLifecycle, {
        run: async () => ({ exitCode: 0, stderr: "" }),
      }).acme.execute(route("acme"), cancellation),
    ).toMatchObject({ status: "failure", code: "assembler-failure" });
    await firstLifecycle.cleanup();

    const secondWorker = scriptedWorker("success", createOwnershipProbe());
    const secondLifecycle = supervisor(secondWorker);
    expect(
      await handlers(secondWorker, secondLifecycle, {
        run: async () => {
          throw new TypeError("broken runner");
        },
      }).acme.execute(route("acme"), cancellation),
    ).toMatchObject({ status: "failure", code: "assembler-failure" });
    await secondLifecycle.cleanup();
  });

  it("should distinguish discovery errors from nonzero assembler exits", async () => {
    for (const thrown of [
      Object.assign(new Error("missing"), { code: "ENOENT" }),
      Object.assign(new Error("spawn ENOENT"), { code: "execution.io" }),
    ]) {
      const worker = scriptedWorker("success", createOwnershipProbe());
      const lifecycle = supervisor(worker);
      expect(
        await handlers(worker, lifecycle, {
          run: async () => {
            throw thrown;
          },
        }).acme.execute(route("acme"), cancellation),
      ).toMatchObject({ status: "failure", code: "tier-unavailable" });
      await lifecycle.cleanup();
    }

    const worker = scriptedWorker("success", createOwnershipProbe());
    const lifecycle = supervisor(worker);
    expect(
      await handlers(worker, lifecycle, {
        run: async () => ({ exitCode: 1, stderr: "assembly failed" }),
      }).acme.execute(route("acme"), cancellation),
    ).toMatchObject({ status: "failure", code: "assembler-failure" });
    await lifecycle.cleanup();
  });

  it("should stop ACME before invocation when emitter evidence is malformed", async () => {
    let runnerCalled = false;
    const worker: WorkerExecutor = {
      async start(_request: ExecutionWorkerRequestV1) {
        return {
          ok: true,
          value: {
            completion: Promise.resolve({ kind: "message", value: { revision: "wrong" } }),
            terminate: async () => undefined,
          },
        };
      },
    };
    const lifecycle = supervisor(worker);
    expect(
      await handlers(worker, lifecycle, {
        run: async () => {
          runnerCalled = true;
          return { exitCode: 0, stderr: "" };
        },
      }).acme.execute(route("acme"), cancellation),
    ).toMatchObject({ status: "failure", stage: "emit", code: "emission-failure" });
    expect(runnerCalled).toBe(false);
    await lifecycle.cleanup();
  });

  it("should stop ACME before invocation when the emitter reports compiler errors", async () => {
    let runnerCalled = false;
    const worker: WorkerExecutor = {
      async start(request) {
        return {
          ok: true,
          value: {
            completion: Promise.resolve({
              kind: "message",
              value: { ...successfulWorkerResponse(request), hasErrors: true },
            }),
            terminate: async () => undefined,
          },
        };
      },
    };
    const lifecycle = supervisor(worker);
    expect(
      await handlers(worker, lifecycle, {
        run: async () => {
          runnerCalled = true;
          return { exitCode: 0, stderr: "" };
        },
      }).acme.execute(route("acme"), cancellation),
    ).toMatchObject({ status: "failure", stage: "emit", code: "emission-failure" });
    expect(runnerCalled).toBe(false);
    await lifecycle.cleanup();
  });

  it("should preserve emitter resource exhaustion through the ACME prerequisite", async () => {
    for (const code of ["output-exhaustion", "evidence-exhaustion"] as const) {
      const worker: WorkerExecutor = {
        async start() {
          return {
            ok: true,
            value: {
              completion: Promise.resolve({ kind: "crash", exitCode: 1, resourceFailure: code }),
              terminate: async () => undefined,
            },
          };
        },
      };
      const lifecycle = supervisor(worker);
      expect(
        await handlers(worker, lifecycle).acme.execute(route("acme"), cancellation),
      ).toMatchObject({ status: "failure", stage: "emit", code });
      await lifecycle.cleanup();
    }

    let now = 0;
    const worker: WorkerExecutor = {
      async start() {
        now = Number.MAX_SAFE_INTEGER;
        return {
          ok: true,
          value: {
            completion: new Promise(() => undefined),
            terminate: async () => undefined,
          },
        };
      },
    };
    const lifecycle = requireSuccess(
      createExecutionSupervisorV1(SPEC_POLICY, {
        workerExecutor: worker,
        time: { monotonicNow: () => now, waitUntil: async () => "deadline" },
      }),
    );
    expect(
      await handlers(worker, lifecycle).acme.execute(route("acme"), cancellation),
    ).toMatchObject({ status: "failure", stage: "emit", code: "wall-time-exhaustion" });
    await lifecycle.cleanup();
  });

  it("should preserve worker diagnostic severity and bounded process failures", async () => {
    const diagnosticWorker: WorkerExecutor = {
      async start(request) {
        const response = successfulWorkerResponse(request);
        return {
          ok: true,
          value: {
            completion: Promise.resolve({
              kind: "message",
              value: {
                ...response,
                diagnostics: {
                  revision: "compiler-diagnostic-evidence-v1",
                  entries: [
                    {
                      acceptedEntryId: `sha256:${"a".repeat(64)}`,
                      code: "E10001",
                      phase: "semantic",
                      finalSeverity: "error",
                    },
                  ],
                },
              },
            }),
            terminate: async () => undefined,
          },
        };
      },
    };
    const diagnosticLifecycle = supervisor(diagnosticWorker);
    const diagnostic = await handlers(diagnosticWorker, diagnosticLifecycle).frontend.execute(
      route("frontend"),
      cancellation,
    );
    expect(diagnostic).toMatchObject({
      status: "failure",
      code: "diagnostic-mismatch",
      evidence: { retainedBytes: expect.any(Number) },
    });
    expect(diagnostic.evidence.retainedBytes).toBeGreaterThan(0);
    await diagnosticLifecycle.cleanup();

    const warningWorker: WorkerExecutor = {
      async start(request) {
        const response = successfulWorkerResponse(request);
        return {
          ok: true,
          value: {
            completion: Promise.resolve({
              kind: "message",
              value: {
                ...response,
                diagnostics: {
                  revision: "compiler-diagnostic-evidence-v1",
                  entries: [
                    {
                      acceptedEntryId: `sha256:${"b".repeat(64)}`,
                      code: "W10001",
                      phase: "semantic",
                      finalSeverity: "warning",
                    },
                  ],
                },
              },
            }),
            terminate: async () => undefined,
          },
        };
      },
    };
    const warningLifecycle = supervisor(warningWorker);
    expect(
      await handlers(warningWorker, warningLifecycle).frontend.execute(
        route("frontend"),
        cancellation,
      ),
    ).toMatchObject({ status: "pass" });
    await warningLifecycle.cleanup();

    for (const code of [
      "output-exhaustion",
      "evidence-exhaustion",
      "wall-time-exhaustion",
    ] as const) {
      const worker = scriptedWorker("success", createOwnershipProbe());
      const lifecycle = supervisor(worker);
      expect(
        await handlers(worker, lifecycle, {
          run: async () => {
            throw Object.assign(new Error(code), { code });
          },
        }).acme.execute(route("acme"), cancellation),
      ).toMatchObject({ status: "failure", code });
      await lifecycle.cleanup();
    }
  });

  it("should latch injected-runner floods and reject empty artifacts", async () => {
    const floodWorker = scriptedWorker("success", createOwnershipProbe());
    const floodLifecycle = supervisor(floodWorker);
    expect(
      await handlers(floodWorker, floodLifecycle, {
        run: async (_request, controls: { onStdout(bytes: Uint8Array): void }) => {
          controls.onStdout(new Uint8Array(SPEC_POLICY.budget.outputBytes + 1));
          controls.onStdout(Uint8Array.of(1));
          return { exitCode: 0, stderr: "" };
        },
      }).acme.execute(route("acme"), cancellation),
    ).toMatchObject({ status: "failure", code: "output-exhaustion" });
    await floodLifecycle.cleanup();

    const artifactWorker = scriptedWorker("success", createOwnershipProbe());
    const artifactLifecycle = supervisor(artifactWorker);
    expect(
      await handlers(artifactWorker, artifactLifecycle, {
        async run(request) {
          await Promise.all([
            writeFile(request.binaryPath, Uint8Array.of(1, 2)),
            writeFile(request.labelPath, new Uint8Array()),
            writeFile(request.reportPath, "report"),
          ]);
          return { exitCode: 0, stderr: "" };
        },
      }).acme.execute(route("acme"), cancellation),
    ).toMatchObject({ status: "failure", code: "assembler-failure" });
    await artifactLifecycle.cleanup();
  });

  it("should route the production bounded ACME runner through the supervised process boundary", async () => {
    const worker = scriptedWorker("success", createOwnershipProbe());
    const processRequests: Array<{ executable: string; argv: readonly string[]; cwd: string }> = [];
    let observedAssembly = "";
    const lifecycle = requireSuccess(
      createExecutionSupervisorV1(SPEC_POLICY, {
        workerExecutor: worker,
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
        processRuntime: {
          async start(request, sink) {
            processRequests.push(request);
            observedAssembly = await readFile(request.argv.at(-1) ?? "", "utf8");
            sink.onStdout(new TextEncoder().encode("assembled"));
            await Promise.all([
              writeFile(join(request.cwd, "main.prg"), Uint8Array.of(1, 2)),
              writeFile(join(request.cwd, "main.lbl"), "labels"),
              writeFile(join(request.cwd, "main.report"), "report"),
            ]);
            return {
              ok: true,
              value: {
                identity: { bootId: "boot", pid: 7, startTicks: 7n, processGroupId: 7 },
                completion: Promise.resolve({ exitCode: 0, signal: null }),
                revalidateIdentity: async () => false,
                terminate: async () => undefined,
              },
            };
          },
        },
      }),
    );
    const selected = createExecutionRouteHandlersV1({
      worker: { executor: worker },
      acme: { executable: "/tools/acme" },
      lifecycle: { supervisor: lifecycle },
      vice: {
        execute: async () => {
          throw new TypeError("VICE is not exercised by this adapter test.");
        },
      },
    });
    const result = await selected.acme.execute(route("acme"), cancellation);
    expect(result).toMatchObject({
      status: "pass",
      tier: "acme",
      usage: { outputBytes: expect.any(Number), evidenceBytes: expect.any(Number) },
      evidence: { retainedBytes: expect.any(Number), digest: expect.stringMatching(/^sha256:/u) },
    });
    expect(result.usage.outputBytes).toBeGreaterThan(0);
    expect(result.evidence.retainedBytes).toBeGreaterThan(0);
    expect(observedAssembly).toContain("!cpu 6510");
    expect(processRequests).toMatchObject([
      {
        executable: "/tools/acme",
        argv: [
          "--vicelabels",
          expect.stringMatching(/main\.lbl$/u),
          "--report",
          expect.stringMatching(/main\.report$/u),
          expect.stringMatching(/^\/proc\/[0-9]+\/fd\/[0-9]+$/u),
        ],
        cwd: expect.any(String),
      },
    ]);
    const workspaceRoot = processRequests[0]?.cwd;
    if (workspaceRoot === undefined) throw new TypeError("Process request was not observed.");
    await expect(access(workspaceRoot)).rejects.toMatchObject({ code: "ENOENT" });
    await lifecycle.cleanup();
  });

  it("should reject replacement of the retained assembly path during ACME execution", async () => {
    const worker = scriptedWorker("success", createOwnershipProbe());
    const lifecycle = requireSuccess(
      createExecutionSupervisorV1(SPEC_POLICY, {
        workerExecutor: worker,
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
        processRuntime: {
          async start(request) {
            const retainedPath = request.argv.at(-1) ?? "";
            expect(await readFile(retainedPath, "utf8")).toContain("!cpu 6510");
            await rename(join(request.cwd, "main.asm"), join(request.cwd, "displaced.asm"));
            await writeFile(join(request.cwd, "main.asm"), "replacement", { mode: 0o600 });
            await Promise.all([
              writeFile(join(request.cwd, "main.prg"), Uint8Array.of(1, 2)),
              writeFile(join(request.cwd, "main.lbl"), "labels"),
              writeFile(join(request.cwd, "main.report"), "report"),
            ]);
            return {
              ok: true as const,
              value: {
                identity: { bootId: "boot", pid: 71, startTicks: 71n, processGroupId: 71 },
                completion: Promise.resolve({ exitCode: 0, signal: null }),
                revalidateIdentity: async () => false,
                terminate: async () => undefined,
              },
            };
          },
        },
      }),
    );
    const selected = createExecutionRouteHandlersV1({
      worker: { executor: worker },
      acme: { executable: "/tools/acme" },
      lifecycle: { supervisor: lifecycle },
      vice: { execute: handlers(worker, lifecycle).vice.execute },
    });
    expect(await selected.acme.execute(route("acme"), cancellation)).toMatchObject({
      status: "failure",
      code: "assembler-failure",
    });
    await lifecycle.cleanup();
  });

  it("should preserve supervised process-start failures and null exits", async () => {
    const startFailureWorker = scriptedWorker("success", createOwnershipProbe());
    const startFailureLifecycle = requireSuccess(
      createExecutionSupervisorV1(SPEC_POLICY, {
        workerExecutor: startFailureWorker,
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
        processRuntime: {
          start: async () => ({
            ok: false,
            issues: [{ code: "execution.io", path: "/process", message: "injected" }],
          }),
        },
      }),
    );
    const startFailureHandlers = createExecutionRouteHandlersV1({
      worker: { executor: startFailureWorker },
      acme: { executable: "/tools/acme" },
      lifecycle: { supervisor: startFailureLifecycle },
      vice: { execute: handlers(startFailureWorker, startFailureLifecycle).vice.execute },
    });
    expect(await startFailureHandlers.acme.execute(route("acme"), cancellation)).toMatchObject({
      status: "failure",
      code: "assembler-failure",
    });
    await startFailureLifecycle.cleanup();

    const nullExitWorker = scriptedWorker("success", createOwnershipProbe());
    const nullExitLifecycle = requireSuccess(
      createExecutionSupervisorV1(SPEC_POLICY, {
        workerExecutor: nullExitWorker,
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
        processRuntime: {
          start: async () => ({
            ok: true,
            value: {
              identity: { bootId: "boot", pid: 8, startTicks: 8n, processGroupId: 8 },
              completion: Promise.resolve({ exitCode: null, signal: null }),
              revalidateIdentity: async () => false,
              terminate: async () => undefined,
            },
          }),
        },
      }),
    );
    const nullExitHandlers = createExecutionRouteHandlersV1({
      worker: { executor: nullExitWorker },
      acme: { executable: "/tools/acme" },
      lifecycle: { supervisor: nullExitLifecycle },
      vice: { execute: handlers(nullExitWorker, nullExitLifecycle).vice.execute },
    });
    expect(await nullExitHandlers.acme.execute(route("acme"), cancellation)).toMatchObject({
      status: "failure",
      code: "assembler-failure",
    });
    await nullExitLifecycle.cleanup();
  });
});
