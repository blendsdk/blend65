import {
  chmod,
  link,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  truncate,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ExecutionOperationResultV1, ExecutionPolicyV1 } from "@blend65/readiness";

import {
  createExecutionStreamCollectorV1,
  defaultExecutionProcessRuntimeV1,
  type ExecutionProcessRequestV1,
} from "./execution-process.js";
import {
  createExecutionSupervisorV1,
  defaultExecutionTimeRuntimeV1,
  type ExecutionWorkerParentEvidenceIdentityV1,
} from "./execution-supervisor.js";
import type {
  ExecutionWorkerCompletionV1,
  ExecutionWorkerRequestV1,
} from "./execution-worker-protocol.js";
import { defaultExecutionWorkspaceProviderV1 } from "./execution-workspace.js";

const POLICY: ExecutionPolicyV1 = {
  revision: "execution-policy-v1",
  budget: {
    operationMs: 2_000,
    launchAttemptMs: 1_000,
    routeMs: 5_000,
    cleanupGraceMs: 1_000,
    outputBytes: 1_024,
    evidenceBytes: 4_096,
    instructions: 100,
    cycles: 1_000,
    launchAttempts: 2,
  },
};

const roots: string[] = [];
const ownedWorkspaces: Array<{ dispose(): Promise<void> }> = [];

function requireSuccess<T>(result: ExecutionOperationResultV1<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return result.value;
}

async function trackedWorkspace() {
  const workspace = requireSuccess(await defaultExecutionWorkspaceProviderV1.create());
  ownedWorkspaces.push(workspace);
  return workspace;
}

function processRequest(cwd: string, argv: readonly string[]): ExecutionProcessRequestV1 {
  const now = performance.now();
  return {
    executable: process.execPath,
    argv,
    cwd,
    deadline: {
      hardDeadlineMs: now + 4_000,
      workDeadlineMs: now + 3_000,
      cleanupGraceMs: 1_000,
    },
  };
}

function workerRequest(): ExecutionWorkerRequestV1 {
  return {
    revision: "execution-worker-request-v1",
    tier: "frontend",
    contract: "frontend-pipeline-v1",
    caseIdentity: `sha256:${"1".repeat(64)}`,
    caseRoot: "/owned",
    source: {
      revision: "execution-worker-source-v1",
      relativePath: "main.blend",
      bytes: new Uint8Array(),
      digest: `sha256:${"0".repeat(64)}`,
    },
  };
}

function waitForAbort(signal: AbortSignal): Promise<"cancelled"> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve("cancelled");
    else signal.addEventListener("abort", () => resolve("cancelled"), { once: true });
  });
}

afterEach(async () => {
  await Promise.all(
    ownedWorkspaces.splice(0).map((workspace) => workspace.dispose().catch(() => undefined)),
  );
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("canonical execution workspace", () => {
  it("should create a private pinned root and resolve only single-link regular files", async () => {
    const workspace = await trackedWorkspace();
    roots.push(workspace.root);
    const rootStat = await import("node:fs/promises").then(({ stat }) => stat(workspace.root));
    expect(rootStat.mode & 0o777).toBe(0o700);
    await writeFile(join(workspace.root, "artifact.bin"), Uint8Array.of(1), { mode: 0o600 });
    expect(await workspace.resolveRegularFile("artifact.bin")).toBe(
      join(workspace.root, "artifact.bin"),
    );

    await link(join(workspace.root, "artifact.bin"), join(workspace.root, "hard.bin"));
    await expect(workspace.resolveRegularFile("artifact.bin")).rejects.toThrow(/single-link/u);
    await expect(workspace.resolveRegularFile("hard.bin")).rejects.toThrow(/single-link/u);
    await mkdir(join(workspace.root, "folder"));
    await expect(workspace.resolveRegularFile("folder")).rejects.toThrow(/regular/u);
  });

  it("should reject every unsafe lexical component before filesystem lookup", async () => {
    const workspace = await trackedWorkspace();
    roots.push(workspace.root);
    for (const path of [
      "",
      ".",
      "..",
      "a//b",
      "a/./b",
      "a/../b",
      "a\\b",
      "/tmp/x",
      "-x",
      "a".repeat(256),
      `${"a/".repeat(2_048)}z`,
    ]) {
      await expect(workspace.resolveRegularFile(path)).rejects.toThrow(/relative path/u);
    }
  });

  it("should use no-follow handles for flat bounded reads and exclusive writes", async () => {
    const workspace = await trackedWorkspace();
    roots.push(workspace.root);
    expect(workspace.writeFileExclusive).toBeDefined();
    expect(workspace.readRegularFile).toBeDefined();
    await workspace.writeFileExclusive?.("artifact.bin", Uint8Array.of(1, 2, 3));
    expect(await workspace.readRegularFile?.("artifact.bin", 3)).toEqual(Uint8Array.of(1, 2, 3));
    await expect(workspace.readRegularFile?.("artifact.bin", 2)).rejects.toThrow(/bound/u);
    await expect(workspace.readRegularFile?.("artifact.bin", 0)).rejects.toThrow(/bound/u);
    await expect(workspace.resolveRegularFile("nested/artifact.bin")).rejects.toThrow(/flat/u);
    await expect(workspace.writeFileExclusive?.("../escape", Uint8Array.of(1))).rejects.toThrow(
      /invalid/u,
    );
    await expect(
      Reflect.apply(workspace.writeFileExclusive ?? (() => undefined), workspace, [
        "nested/invalid.bin",
        "bad",
      ]),
    ).rejects.toThrow(/invalid/u);
  });

  it("should secure an externally created artifact before reading its bytes", async () => {
    const workspace = await trackedWorkspace();
    roots.push(workspace.root);
    const artifact = join(workspace.root, "external.bin");
    await writeFile(artifact, Uint8Array.of(4, 5, 6));
    await chmod(artifact, 0o664);

    expect(await workspace.readRegularFile?.("external.bin", 3)).toEqual(Uint8Array.of(4, 5, 6));
    expect((await stat(artifact)).mode & 0o777).toBe(0o600);
  });

  it("should retain the exact artifact inode across an external descriptor-backed open", async () => {
    const workspace = await trackedWorkspace();
    roots.push(workspace.root);
    await workspace.writeFileExclusive?.("main.asm", new TextEncoder().encode("original"));
    const retained = await workspace.retainRegularFile?.("main.asm");
    expect(retained).toBeDefined();
    if (retained === undefined) throw new TypeError("Retained file authority is unavailable.");
    expect(await readFile(retained.externalPath, "utf8")).toBe("original");

    await rename(join(workspace.root, "main.asm"), join(workspace.root, "moved.asm"));
    await writeFile(join(workspace.root, "main.asm"), "replacement", { mode: 0o600 });
    expect(await readFile(retained.externalPath, "utf8")).toBe("original");
    await expect(retained.revalidate()).rejects.toThrow(/identity/u);
    await retained.close();
  });

  it("should dispose idempotently without following a replaced root identity", async () => {
    const workspace = await trackedWorkspace();
    const root = workspace.root;
    await workspace.dispose();
    await workspace.dispose();
    await expect(workspace.resolveRegularFile("artifact.bin")).rejects.toThrow(/closing/u);
    await expect(workspace.writeFileExclusive?.("artifact.bin", Uint8Array.of(1))).rejects.toThrow(
      /closing/u,
    );
    await expect(readFile(root)).rejects.toThrow();
  });

  it("should fail closed when the pinned root path is swapped before use or cleanup", async () => {
    const workspace = await trackedWorkspace();
    const moved = `${workspace.root}.moved`;
    await rename(workspace.root, moved);
    await mkdir(workspace.root, { mode: 0o700 });
    roots.push(workspace.root, moved);
    await writeFile(join(workspace.root, "sentinel"), "replacement");

    await expect(workspace.resolveRegularFile("sentinel")).rejects.toThrow(/identity/u);
    await expect(workspace.dispose()).rejects.toThrow(/identity/u);
    expect(await readFile(join(workspace.root, "sentinel"), "utf8")).toBe("replacement");
  });

  it("should enforce cleanup quotas and cancellation without following workspace contents", async () => {
    const crowded = await trackedWorkspace();
    const quarantine = join(dirname(crowded.root), `.${basename(crowded.root)}.cleanup`);
    roots.push(crowded.root, quarantine);
    await Promise.all(
      Array.from({ length: 65 }, (_, index) =>
        writeFile(join(crowded.root, `artifact-${index}.bin`), Uint8Array.of(index), {
          mode: 0o600,
        }),
      ),
    );
    await expect(crowded.dispose()).rejects.toThrow(/entry quota/u);

    const cancelled = await trackedWorkspace();
    roots.push(cancelled.root);
    const controller = new AbortController();
    controller.abort();
    await expect(cancelled.dispose(performance.now() + 1_000, controller.signal)).rejects.toThrow(
      /exhausted/u,
    );
    expect(await import("node:fs/promises").then(({ stat }) => stat(cancelled.root))).toBeDefined();
  });

  it("should reject unsafe artifact modes and every declared workspace resource quota", async () => {
    const unsafeMode = await trackedWorkspace();
    roots.push(unsafeMode.root);
    const executableArtifact = join(unsafeMode.root, "executable.bin");
    await writeFile(executableArtifact, Uint8Array.of(1), { mode: 0o700 });
    await expect(unsafeMode.readRegularFile?.("executable.bin", 1)).rejects.toThrow(/mode/u);
    await expect(
      unsafeMode.writeFileExclusive?.("oversized.bin", new Uint8Array(8_388_609)),
    ).rejects.toThrow(/invalid/u);

    const oversized = await trackedWorkspace();
    const oversizedQuarantine = join(
      dirname(oversized.root),
      `.${basename(oversized.root)}.cleanup`,
    );
    roots.push(oversized.root, oversizedQuarantine);
    const sparse = join(oversized.root, "sparse.bin");
    await writeFile(sparse, Uint8Array.of(0), { mode: 0o600 });
    await truncate(sparse, 16_777_217);
    await expect(oversized.dispose()).rejects.toThrow(/byte quota/u);

    const nested = await trackedWorkspace();
    const nestedQuarantine = join(dirname(nested.root), `.${basename(nested.root)}.cleanup`);
    roots.push(nested.root, nestedQuarantine);
    await mkdir(join(nested.root, "a/b/c/d/e/f/g/h/i"), { recursive: true, mode: 0o700 });
    await expect(nested.dispose()).rejects.toThrow(/nesting quota/u);

    const invalidDeadline = await trackedWorkspace();
    roots.push(invalidDeadline.root);
    await expect(invalidDeadline.dispose(Number.NaN)).rejects.toThrow(/invalid/u);
  });
});

describe("aggregate process evidence", () => {
  it("should retain deterministic overlapping head and tail samples", async () => {
    const collector = createExecutionStreamCollectorV1(10_000);
    collector.onStdout(new Uint8Array(5_000).fill(1));
    const summary = collector.summarize().stdout;
    expect(summary).toMatchObject({ totalBytes: 5_000, truncated: false });
    expect(summary.head).toHaveLength(4_096);
    expect(summary.tail).toHaveLength(4_096);
    collector.onStdout(new Uint8Array(5_000).fill(2));
    expect(collector.summarize().stdout).toMatchObject({ totalBytes: 10_000, truncated: true });
    collector.onStderr(Uint8Array.of(3));
    await collector.exhaustion;
    expect(collector.exhausted).toBe(true);
    Reflect.apply(collector.onStderr, collector, ["bad"]);
    expect(collector.totalBytes).toBe(10_001);

    const wrapped = createExecutionStreamCollectorV1(8_000);
    wrapped.onStdout(new Uint8Array(3_000).fill(4));
    wrapped.onStdout(new Uint8Array(3_000).fill(5));
    expect(wrapped.summarize().stdout.tail).toHaveLength(4_096);

    const hostile = createExecutionStreamCollectorV1(1);
    Reflect.apply(hostile.onStdout, hostile, [null]);
    expect(hostile.exhausted).toBe(true);
    expect(hostile.totalBytes).toBe(0);
  });

  it("should fail a missing executable through the spawn handshake without an unhandled error", async () => {
    const workspace = await trackedWorkspace();
    roots.push(workspace.root);
    const missing = await defaultExecutionProcessRuntimeV1.start(
      { ...processRequest(workspace.root, []), executable: "/definitely/missing/blend65-tool" },
      createExecutionStreamCollectorV1(1),
      { signal: new AbortController().signal, deadlineMonotonicMs: performance.now() + 1_000 },
    );
    expect(missing).toMatchObject({
      ok: false,
      issues: [{ code: "execution.io", message: expect.stringMatching(/ENOENT/u) }],
    });
  });

  it("should launch a real argv-only process group and drain both streams", async () => {
    const workspace = await trackedWorkspace();
    roots.push(workspace.root);
    const supervisor = requireSuccess(createExecutionSupervisorV1(POLICY));
    const script = "process.stdout.write('out'); process.stderr.write('err')";
    const outcome = requireSuccess(
      await supervisor.runProcess(processRequest(workspace.root, ["-e", script])),
    );
    expect(outcome).toMatchObject({
      exitCode: 0,
      signal: null,
      authority: {
        kind: "finite-streams",
        stdout: { totalBytes: 3 },
        stderr: { totalBytes: 3 },
      },
    });
    expect(outcome.childIdentity.pid).toBeGreaterThan(0);
    expect(requireSuccess(await supervisor.cleanup())).toMatchObject({ ok: true });
  });

  it.skipIf(process.platform !== "linux")(
    "should retain exact identities for immediately exiting real targets",
    async () => {
      const workspace = await trackedWorkspace();
      roots.push(workspace.root);
      for (let iteration = 0; iteration < 8; iteration += 1) {
        const now = performance.now();
        const started = requireSuccess(
          await defaultExecutionProcessRuntimeV1.start(
            {
              executable: "/bin/true",
              argv: [],
              cwd: workspace.root,
              deadline: {
                hardDeadlineMs: now + 4_000,
                workDeadlineMs: now + 3_000,
                cleanupGraceMs: 1_000,
              },
            },
            { onStdout: () => undefined, onStderr: () => undefined },
            {
              signal: new AbortController().signal,
              deadlineMonotonicMs: now + 4_000,
            },
          ),
        );
        expect(started.identity.pid).toBeGreaterThan(0);
        await expect(started.completion).resolves.toEqual({ exitCode: 0, signal: null });
        expect(await started.revalidateIdentity()).toBe("absent");
      }
    },
    30_000,
  );

  it("should reject invalid or pre-cancelled process launches without a child", async () => {
    const cancellation = new AbortController();
    cancellation.abort();
    const invalid = await defaultExecutionProcessRuntimeV1.start(
      {
        executable: "",
        argv: [],
        cwd: "/",
        deadline: { hardDeadlineMs: 2, workDeadlineMs: 1, cleanupGraceMs: 1 },
      },
      createExecutionStreamCollectorV1(1),
      { signal: cancellation.signal, deadlineMonotonicMs: 1 },
    );
    expect(invalid).toMatchObject({ ok: false, issues: [{ code: "execution.io" }] });
    for (const request of [
      {
        executable: process.execPath,
        argv: new Array(1_025).fill("x"),
        cwd: "/",
        deadline: { hardDeadlineMs: 2, workDeadlineMs: 1, cleanupGraceMs: 1 },
      },
      {
        executable: process.execPath,
        argv: ["x".repeat(65_537)],
        cwd: "/",
        deadline: { hardDeadlineMs: 2, workDeadlineMs: 1, cleanupGraceMs: 1 },
      },
      {
        executable: process.execPath,
        argv: [],
        cwd: "",
        deadline: { hardDeadlineMs: 2, workDeadlineMs: 1, cleanupGraceMs: 1 },
      },
      {
        executable: process.execPath,
        argv: [],
        cwd: "/",
        deadline: { hardDeadlineMs: 1, workDeadlineMs: 2, cleanupGraceMs: 1 },
      },
    ]) {
      expect(
        await defaultExecutionProcessRuntimeV1.start(request, createExecutionStreamCollectorV1(1), {
          signal: new AbortController().signal,
          deadlineMonotonicMs: 1,
        }),
      ).toMatchObject({ ok: false });
    }

    for (const request of [
      {
        executable: 1,
        argv: [],
        cwd: "/",
        deadline: { hardDeadlineMs: 2, workDeadlineMs: 1, cleanupGraceMs: 1 },
      },
      {
        executable: process.execPath,
        argv: [1],
        cwd: "/",
        deadline: { hardDeadlineMs: 2, workDeadlineMs: 1, cleanupGraceMs: 1 },
      },
      {
        executable: process.execPath,
        argv: [],
        cwd: "/",
        deadline: { hardDeadlineMs: Number.NaN, workDeadlineMs: 1, cleanupGraceMs: 1 },
      },
      {
        executable: process.execPath,
        argv: [],
        cwd: "/",
        deadline: { hardDeadlineMs: 2, workDeadlineMs: Number.NaN, cleanupGraceMs: 1 },
      },
      {
        executable: process.execPath,
        argv: [],
        cwd: "/",
        deadline: { hardDeadlineMs: 2, workDeadlineMs: 1, cleanupGraceMs: 1.5 },
      },
    ]) {
      expect(
        await Reflect.apply(
          defaultExecutionProcessRuntimeV1.start,
          defaultExecutionProcessRuntimeV1,
          [
            request,
            createExecutionStreamCollectorV1(1),
            { signal: new AbortController().signal, deadlineMonotonicMs: 1 },
          ],
        ),
      ).toMatchObject({ ok: false });
    }
  });
});

describe("supervisor cleanup blockers", () => {
  it("should reject an invalid lifecycle policy before acquiring any authority", () => {
    expect(
      createExecutionSupervisorV1({
        ...POLICY,
        budget: { ...POLICY.budget, operationMs: 0 },
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "execution.invalid-schema" }] });
  });

  it("should settle the production watchdog on pre-cancellation, later cancellation, or deadline", async () => {
    const preCancelled = new AbortController();
    preCancelled.abort();
    await expect(
      defaultExecutionTimeRuntimeV1.waitUntil(performance.now() + 1_000, preCancelled.signal),
    ).resolves.toBe("cancelled");

    const laterCancellation = new AbortController();
    const waiting = defaultExecutionTimeRuntimeV1.waitUntil(
      performance.now() + 1_000,
      laterCancellation.signal,
    );
    laterCancellation.abort();
    await expect(waiting).resolves.toBe("cancelled");
    await expect(
      defaultExecutionTimeRuntimeV1.waitUntil(performance.now(), new AbortController().signal),
    ).resolves.toBe("deadline");
  });

  it("should enforce supervisor evidence/output charges and hard snapshot time", () => {
    let now = 0;
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => now, waitUntil: async () => "deadline" },
      }),
    );
    expect(Reflect.apply(supervisor.recordEvidence, supervisor, ["bad"])).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-evidence-input" }],
    });
    expect(supervisor.recordOutput(-1)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-evidence-input" }],
    });
    expect(supervisor.recordEvidence(new Uint8Array(POLICY.budget.evidenceBytes))).toMatchObject({
      ok: true,
    });
    expect(supervisor.recordEvidence(Uint8Array.of(1))).toMatchObject({
      ok: false,
      issues: [{ code: "evidence-exhaustion" }],
    });
    expect(supervisor.recordOutput(POLICY.budget.outputBytes)).toMatchObject({ ok: true });
    expect(supervisor.recordOutput(1)).toMatchObject({
      ok: false,
      issues: [{ code: "output-exhaustion" }],
    });
    now = POLICY.budget.routeMs + 1;
    expect(supervisor.snapshot()).toMatchObject({
      ok: false,
      issues: [{ code: "wall-time-exhaustion" }],
    });
  });

  it("should enforce previously charged output and evidence at process completion", async () => {
    const makeSupervisor = (emitOutput: boolean) =>
      requireSuccess(
        createExecutionSupervisorV1(POLICY, {
          time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
          processRuntime: {
            start: async (_request, sink) => {
              if (emitOutput) sink.onStdout(Uint8Array.of(1));
              return {
                ok: true,
                value: {
                  identity: { bootId: "boot", pid: 9, startTicks: 9n, processGroupId: 9 },
                  completion: Promise.resolve({ exitCode: 0, signal: null }),
                  revalidateIdentity: async () => false,
                  terminate: async () => undefined,
                },
              };
            },
          },
        }),
      );
    const selectedRequest = {
      executable: "/tool",
      argv: [],
      cwd: "/owned",
      deadline: { hardDeadlineMs: 4_000, workDeadlineMs: 3_000, cleanupGraceMs: 1_000 },
    };

    const outputSupervisor = makeSupervisor(true);
    requireSuccess(outputSupervisor.recordOutput(POLICY.budget.outputBytes));
    expect(await outputSupervisor.runProcess(selectedRequest)).toMatchObject({
      ok: false,
      issues: [
        {
          code: "output-exhaustion",
          message: expect.stringMatching(/0 bytes; cleanup proof sha256:[0-9a-f]{64}/u),
        },
      ],
    });
    await outputSupervisor.cleanup();

    const evidenceSupervisor = makeSupervisor(false);
    requireSuccess(evidenceSupervisor.recordEvidence(new Uint8Array(POLICY.budget.evidenceBytes)));
    expect(await evidenceSupervisor.runProcess(selectedRequest)).toMatchObject({
      ok: false,
      issues: [{ code: "evidence-exhaustion" }],
    });
    await evidenceSupervisor.cleanup();
  });

  it("should enforce previously charged output at worker completion", async () => {
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
        workerExecutor: {
          start: async (request) => ({
            ok: true,
            value: {
              completion: Promise.resolve({
                kind: "message",
                value: {
                  revision: "execution-worker-response-v1",
                  tier: "cli",
                  contract: "blendc-cli-v1",
                  caseIdentity: request.caseIdentity,
                  exitCode: 0,
                  stdout: Uint8Array.of(1),
                  stderr: new Uint8Array(),
                  diagnostics: { revision: "compiler-diagnostic-evidence-v1", entries: [] },
                  emission: { il: false, assembly: false, binary: false },
                },
              }),
              terminate: async () => undefined,
            },
          }),
        },
      }),
    );
    requireSuccess(supervisor.recordOutput(POLICY.budget.outputBytes));
    const request = {
      ...workerRequest(),
      tier: "cli" as const,
      contract: "blendc-cli-v1" as const,
      argv: ["check", "main.blend", "--platform", "c64"] as const,
    };
    expect(await supervisor.runWorker(request)).toMatchObject({
      ok: false,
      issues: [{ code: "output-exhaustion" }],
    });
    await supervisor.cleanup();
  });

  it("should keep draining when an external process observer rejects both streams", async () => {
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
        processRuntime: {
          start: async (_request, sink) => {
            sink.onStdout(Uint8Array.of(1));
            sink.onStderr(Uint8Array.of(2));
            return {
              ok: true,
              value: {
                identity: { bootId: "boot", pid: 3, startTicks: 3n, processGroupId: 3 },
                completion: Promise.resolve({ exitCode: 0, signal: null }),
                revalidateIdentity: async () => false,
                terminate: async () => undefined,
              },
            };
          },
        },
      }),
    );
    const outcome = requireSuccess(
      await supervisor.runProcess(
        {
          executable: "/tool",
          argv: [],
          cwd: "/owned",
          deadline: { hardDeadlineMs: 4_000, workDeadlineMs: 3_000, cleanupGraceMs: 1_000 },
        },
        undefined,
        {
          onStdout: () => {
            throw new Error("observer stdout");
          },
          onStderr: () => {
            throw new Error("observer stderr");
          },
        },
      ),
    );
    expect(outcome.authority).toMatchObject({
      stdout: { totalBytes: 1 },
      stderr: { totalBytes: 1 },
    });
  });

  it("should serialize cleanup behind an in-flight acquisition and reject later acquisition", async () => {
    let finishCreate = (
      _value: ExecutionOperationResultV1<{
        root: string;
        identity: { device: bigint; inode: bigint; uid: number };
        resolveRegularFile(path: string): Promise<string>;
        dispose(): Promise<void>;
      }>,
    ): void => undefined;
    let disposed = false;
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        workspaceProvider: {
          create: () =>
            new Promise((resolve) => {
              finishCreate = resolve;
            }),
        },
      }),
    );
    const acquisition = supervisor.createWorkspace();
    const cleanup = supervisor.cleanup();
    finishCreate({
      ok: true,
      value: {
        root: "/owned/racing",
        identity: { device: 1n, inode: 1n, uid: 1 },
        resolveRegularFile: async (path) => `/owned/racing/${path}`,
        dispose: async () => {
          disposed = true;
        },
      },
    });
    expect(await acquisition).toMatchObject({
      ok: false,
      issues: [{ code: "execution.stale-authority" }],
    });
    expect(requireSuccess(await cleanup)).toMatchObject({ ok: true });
    expect(disposed).toBe(true);
    expect(await supervisor.createWorkspace()).toMatchObject({
      ok: false,
      issues: [{ code: "execution.stale-authority" }],
    });
  });

  it("should self-dispose a workspace that settles after caller cancellation", async () => {
    let settle = (
      _value: ExecutionOperationResultV1<{
        root: string;
        identity: { device: bigint; inode: bigint; uid: number };
        resolveRegularFile(path: string): Promise<string>;
        dispose(): Promise<void>;
      }>,
    ): void => undefined;
    let disposed = 0;
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => 0, waitUntil: (_deadline, signal) => waitForAbort(signal) },
        workspaceProvider: {
          create: () =>
            new Promise((resolve) => {
              settle = resolve;
            }),
        },
      }),
    );
    const controller = new AbortController();
    const acquisition = supervisor.createWorkspace({
      signal: controller.signal,
      deadlineMonotonicMs: 1_000,
    });
    controller.abort();
    expect(await acquisition).toMatchObject({
      ok: false,
      issues: [{ code: "wall-time-exhaustion" }],
    });
    settle({
      ok: true,
      value: {
        root: "/owned/late",
        identity: { device: 1n, inode: 2n, uid: 3 },
        resolveRegularFile: async (path) => `/owned/late/${path}`,
        dispose: async () => {
          disposed += 1;
        },
      },
    });
    expect(requireSuccess(await supervisor.cleanup())).toMatchObject({ ok: true });
    expect(disposed).toBe(1);
  });

  it("should terminate late worker and process acquisitions before cleanup completes", async () => {
    let settleWorker = (
      _value: ExecutionOperationResultV1<{
        completion: Promise<never>;
        terminate(): Promise<void>;
      }>,
    ): void => undefined;
    let settleProcess = (
      _value: ExecutionOperationResultV1<{
        identity: { bootId: string; pid: number; startTicks: bigint; processGroupId: number };
        completion: Promise<{ exitCode: null; signal: NodeJS.Signals }>;
        revalidateIdentity(): Promise<boolean>;
        terminate(signal: NodeJS.Signals): Promise<void>;
      }>,
    ): void => undefined;
    let workerTerminated = 0;
    const processSignals: NodeJS.Signals[] = [];
    let processLive = true;
    let finishProcess = (_exit: { exitCode: null; signal: NodeJS.Signals }): void => undefined;
    const processCompletion = new Promise<{ exitCode: null; signal: NodeJS.Signals }>((resolve) => {
      finishProcess = resolve;
    });
    const workerSupervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => 0, waitUntil: (_deadline, signal) => waitForAbort(signal) },
        workerExecutor: {
          start: () =>
            new Promise((resolve) => {
              settleWorker = resolve;
            }),
        },
      }),
    );
    const workerController = new AbortController();
    const workerRun = workerSupervisor.runWorker(workerRequest(), {
      signal: workerController.signal,
      deadlineMonotonicMs: 1_000,
    });
    workerController.abort();
    expect(await workerRun).toMatchObject({
      ok: false,
      issues: [{ code: "wall-time-exhaustion" }],
    });
    settleWorker({
      ok: true,
      value: {
        completion: new Promise<never>(() => undefined),
        terminate: async () => {
          workerTerminated += 1;
        },
      },
    });
    expect(requireSuccess(await workerSupervisor.cleanup())).toMatchObject({ ok: true });
    expect(workerTerminated).toBe(1);

    const processSupervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => 0, waitUntil: (_deadline, signal) => waitForAbort(signal) },
        processRuntime: {
          start: () =>
            new Promise((resolve) => {
              settleProcess = resolve;
            }),
        },
      }),
    );
    const processController = new AbortController();
    const processRun = processSupervisor.runProcess(
      {
        executable: "/tool",
        argv: [],
        cwd: "/owned",
        deadline: { hardDeadlineMs: 4_000, workDeadlineMs: 3_000, cleanupGraceMs: 1_000 },
      },
      { signal: processController.signal, deadlineMonotonicMs: 1_000 },
    );
    processController.abort();
    expect(await processRun).toMatchObject({
      ok: false,
      issues: [{ code: "wall-time-exhaustion" }],
    });
    settleProcess({
      ok: true,
      value: {
        identity: { bootId: "boot", pid: 30, startTicks: 30n, processGroupId: 30 },
        completion: processCompletion,
        revalidateIdentity: async () => processLive,
        terminate: async (signal) => {
          processSignals.push(signal);
          processLive = false;
          finishProcess({ exitCode: null, signal });
        },
      },
    });
    expect(requireSuccess(await processSupervisor.cleanup())).toMatchObject({ ok: true });
    expect(processSignals).toEqual(["SIGTERM"]);
  });

  it("should propagate caller cancellation after launch and cancel the losing watchdog", async () => {
    const caller = new AbortController();
    let launched = (): void => undefined;
    const launchedPromise = new Promise<void>((resolve) => {
      launched = resolve;
    });
    let terminated = 0;
    let activeWaits = 0;
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: {
          monotonicNow: () => 0,
          waitUntil: (_deadline, signal) =>
            new Promise((resolve) => {
              activeWaits += 1;
              const finish = (): void => {
                activeWaits -= 1;
                resolve("cancelled");
              };
              if (signal.aborted) finish();
              else signal.addEventListener("abort", finish, { once: true });
            }),
        },
        workerExecutor: {
          start: async () => {
            launched();
            return {
              ok: true,
              value: {
                completion: new Promise(() => undefined),
                terminate: async () => {
                  terminated += 1;
                },
              },
            };
          },
        },
      }),
    );
    const running = supervisor.runWorker(workerRequest(), {
      signal: caller.signal,
      deadlineMonotonicMs: 1_000,
    });
    await launchedPromise;
    caller.abort();
    expect(await running).toMatchObject({
      ok: false,
      issues: [{ code: "wall-time-exhaustion" }],
    });
    await Promise.resolve();
    expect(terminated).toBe(1);
    expect(activeWaits).toBe(0);
  });

  it("should serialize worker and process operations before either acquires authority", async () => {
    let finishWorker = (_value: ExecutionWorkerCompletionV1): void => undefined;
    let workerStarted = 0;
    let processStarted = 0;
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => 0, waitUntil: (_deadline, signal) => waitForAbort(signal) },
        workerExecutor: {
          start: async () => {
            workerStarted += 1;
            return {
              ok: true,
              value: {
                completion: new Promise((resolve) => {
                  finishWorker = resolve;
                }),
                terminate: async () => undefined,
              },
            };
          },
        },
        processRuntime: {
          start: async () => {
            processStarted += 1;
            return {
              ok: true,
              value: {
                identity: { bootId: "boot", pid: 40, startTicks: 40n, processGroupId: 40 },
                completion: Promise.resolve({ exitCode: 0, signal: null }),
                revalidateIdentity: async () => false,
                terminate: async () => undefined,
              },
            };
          },
        },
      }),
    );
    const workerRun = supervisor.runWorker(workerRequest());
    await Promise.resolve();
    expect(
      await supervisor.runProcess({
        executable: "/tool",
        argv: [],
        cwd: "/owned",
        deadline: { hardDeadlineMs: 4_000, workDeadlineMs: 3_000, cleanupGraceMs: 1_000 },
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "execution.stale-authority" }] });
    expect(workerStarted).toBe(1);
    expect(processStarted).toBe(0);
    finishWorker({
      kind: "message",
      value: {
        revision: "execution-worker-response-v1",
        tier: "frontend",
        contract: "frontend-pipeline-v1",
        caseIdentity: workerRequest().caseIdentity,
        diagnostics: { revision: "compiler-diagnostic-evidence-v1", entries: [] },
        semanticModelPresent: true,
        allocationPlanPresent: true,
        emission: { il: false, assembly: false, binary: false },
      },
    });
    expect(await workerRun).toMatchObject({ ok: true });
    expect(
      await supervisor.runProcess({
        executable: "/tool",
        argv: [],
        cwd: "/owned",
        deadline: { hardDeadlineMs: 4_000, workDeadlineMs: 3_000, cleanupGraceMs: 1_000 },
      }),
    ).toMatchObject({ ok: true });
    expect(processStarted).toBe(1);
    await supervisor.cleanup();
  });

  it("should keep shared worker executors alive until the last supervisor releases ownership", async () => {
    let shutdowns = 0;
    const executor = {
      start: async () => ({
        ok: false as const,
        issues: [{ code: "execution.io" as const, path: "/worker", message: "unused" }] as const,
      }),
      shutdown: async () => {
        shutdowns += 1;
      },
    };
    const first = requireSuccess(createExecutionSupervisorV1(POLICY, { workerExecutor: executor }));
    const second = requireSuccess(
      createExecutionSupervisorV1(POLICY, { workerExecutor: executor }),
    );
    expect(requireSuccess(await first.cleanup())).toMatchObject({ ok: true });
    expect(shutdowns).toBe(0);
    expect(requireSuccess(await second.cleanup())).toMatchObject({ ok: true });
    expect(shutdowns).toBe(1);
  });

  it("should bind parent-only diagnostic provenance into the evidence digest", async () => {
    const baseIdentity: ExecutionWorkerParentEvidenceIdentityV1 = {
      revision: "execution-worker-parent-evidence-v1",
      joinPolicyRevision: "published-diagnostic-case-equivalence-v1",
      callerSourceCaseDigest: `sha256:${"1".repeat(64)}`,
      selectedReleaseDigest: `sha256:${"2".repeat(64)}`,
      selectedCampaignDigest: `sha256:${"3".repeat(64)}`,
      selectedSourceCaseDigest: `sha256:${"4".repeat(64)}`,
      evaluationIdentity: `sha256:${"5".repeat(64)}`,
      sourceContentIdentity: `sha256:${"6".repeat(64)}`,
    };
    let starts = 0;
    const make = () =>
      requireSuccess(
        createExecutionSupervisorV1(POLICY, {
          time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
          workerExecutor: {
            start: async (request) => {
              starts += 1;
              return {
                ok: true as const,
                value: {
                  completion: Promise.resolve({
                    kind: "message" as const,
                    value: {
                      revision: "execution-worker-response-v1",
                      tier: "frontend",
                      contract: "frontend-pipeline-v1",
                      caseIdentity: request.caseIdentity,
                      diagnostics: { revision: "compiler-diagnostic-evidence-v1", entries: [] },
                      semanticModelPresent: true,
                      allocationPlanPresent: true,
                      emission: { il: false, assembly: false, binary: false },
                    },
                  }),
                  terminate: async () => undefined,
                },
              };
            },
          },
        }),
      );
    const first = make();
    requireSuccess(await first.runWorker(workerRequest(), undefined, baseIdentity));
    const firstDigest = requireSuccess(first.snapshot()).evidence.digest;
    await first.cleanup();

    const second = make();
    requireSuccess(
      await second.runWorker(workerRequest(), undefined, {
        ...baseIdentity,
        selectedCampaignDigest: `sha256:${"7".repeat(64)}`,
      }),
    );
    const secondDigest = requireSuccess(second.snapshot()).evidence.digest;
    expect(secondDigest).not.toBe(firstDigest);
    await second.cleanup();

    const hostile = make();
    const invalid = Object.defineProperty({ ...baseIdentity }, "selectedReleaseDigest", {
      enumerable: true,
      get: () => baseIdentity.selectedReleaseDigest,
    });
    expect(
      await hostile.runWorker(
        workerRequest(),
        undefined,
        invalid as ExecutionWorkerParentEvidenceIdentityV1,
      ),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-evidence-input" }] });
    expect(starts).toBe(2);
    await hostile.cleanup();
  });

  it("should accept completion exactly at the operation deadline and reject a later completion", async () => {
    const runAt = async (completionTime: number) => {
      let now = 0;
      const supervisor = requireSuccess(
        createExecutionSupervisorV1(POLICY, {
          time: { monotonicNow: () => now, waitUntil: async () => "deadline" },
          workerExecutor: {
            start: async (request) => {
              now = completionTime;
              return {
                ok: true as const,
                value: {
                  completion: Promise.resolve({
                    kind: "message" as const,
                    value: {
                      revision: "execution-worker-response-v1",
                      tier: "frontend",
                      contract: "frontend-pipeline-v1",
                      caseIdentity: request.caseIdentity,
                      diagnostics: { revision: "compiler-diagnostic-evidence-v1", entries: [] },
                      semanticModelPresent: true,
                      allocationPlanPresent: true,
                      emission: { il: false, assembly: false, binary: false },
                    },
                  }),
                  terminate: async () => undefined,
                },
              };
            },
          },
        }),
      );
      const result = await supervisor.runWorker(workerRequest());
      await supervisor.cleanup();
      return result;
    };
    expect(await runAt(POLICY.budget.operationMs)).toMatchObject({ ok: true });
    expect(await runAt(POLICY.budget.operationMs + 1)).toMatchObject({
      ok: false,
      issues: [{ code: "wall-time-exhaustion" }],
    });
  });

  it("should terminate and reap immediately when output crosses the aggregate limit", async () => {
    let resolveCompletion = (_value: { exitCode: null; signal: null }): void => undefined;
    const completion = new Promise<{ exitCode: null; signal: null }>((resolve) => {
      resolveCompletion = resolve;
    });
    let live = true;
    const signals: NodeJS.Signals[] = [];
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        processRuntime: {
          start: async (_request, sink) => {
            sink.onStdout(new Uint8Array(POLICY.budget.outputBytes + 1));
            return {
              ok: true,
              value: {
                identity: { bootId: "boot", pid: 2, startTicks: 2n, processGroupId: 2 },
                completion,
                revalidateIdentity: async () => live,
                terminate: async (signal) => {
                  signals.push(signal);
                  live = false;
                  resolveCompletion({ exitCode: null, signal: null });
                },
              },
            };
          },
        },
      }),
    );
    expect(
      await supervisor.runProcess({
        executable: "/tool",
        argv: [],
        cwd: "/owned",
        deadline: { hardDeadlineMs: 4_000, workDeadlineMs: 3_000, cleanupGraceMs: 1_000 },
      }),
    ).toMatchObject({
      ok: false,
      issues: [
        {
          code: "output-exhaustion",
          message: expect.stringMatching(/1024 bytes; cleanup proof sha256:[0-9a-f]{64}/u),
        },
      ],
    });
    expect(signals).toEqual(["SIGTERM"]);
    expect(requireSuccess(await supervisor.cleanup())).toMatchObject({ ok: true });
  });

  it("should withhold output-exhaustion authority when termination cannot be confirmed", async () => {
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
        processRuntime: {
          start: async (_request, sink) => {
            sink.onStdout(new Uint8Array(POLICY.budget.outputBytes + 1));
            return {
              ok: true as const,
              value: {
                identity: { bootId: "boot", pid: 41, startTicks: 41n, processGroupId: 41 },
                completion: new Promise<{ exitCode: null; signal: null }>(() => undefined),
                revalidateIdentity: async () => "unknown" as const,
                terminate: async () => undefined,
              },
            };
          },
        },
      }),
    );
    expect(
      await supervisor.runProcess({
        executable: "/tool",
        argv: [],
        cwd: "/owned",
        deadline: { hardDeadlineMs: 4_000, workDeadlineMs: 3_000, cleanupGraceMs: 1_000 },
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "output-exhaustion" }] });
    expect(requireSuccess(await supervisor.cleanup())).toMatchObject({
      ok: false,
      blocker: { code: "emulator-lease-recovery-blocked" },
    });
  });

  it("should propagate absent and failed worker or process acquisition boundaries", async () => {
    const noWorker = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
      }),
    );
    expect(await noWorker.runWorker(workerRequest())).toMatchObject({
      ok: false,
      issues: [{ code: "execution.io" }],
    });

    const failed = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
        workerExecutor: {
          start: async () => ({
            ok: false,
            issues: [{ code: "execution.io", path: "/worker", message: "injected" }],
          }),
        },
        processRuntime: {
          start: async () => ({
            ok: false,
            issues: [{ code: "execution.io", path: "/process", message: "injected" }],
          }),
        },
      }),
    );
    expect(await failed.runWorker(workerRequest())).toMatchObject({ ok: false });
    expect(
      await failed.runProcess({
        executable: "/tool",
        argv: [],
        cwd: "/owned",
        deadline: { hardDeadlineMs: 2, workDeadlineMs: 1, cleanupGraceMs: 1 },
      }),
    ).toMatchObject({ ok: false });
  });

  it("should retain a cleanup blocker when a live child identity cannot be revalidated", async () => {
    const completion = new Promise<{ exitCode: null; signal: null }>(() => undefined);
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: {
          monotonicNow: () => 0,
          waitUntil: async () => "deadline",
        },
        processRuntime: {
          start: async () => ({
            ok: true,
            value: {
              identity: { bootId: "boot", pid: 1, startTicks: 1n, processGroupId: 1 },
              completion,
              revalidateIdentity: async () => false,
              terminate: async () => undefined,
            },
          }),
        },
      }),
    );
    await supervisor.runProcess({
      executable: "/tool",
      argv: [],
      cwd: "/owned",
      deadline: { hardDeadlineMs: 5_000, workDeadlineMs: 4_000, cleanupGraceMs: 1_000 },
    });
    const cleaned = requireSuccess(await supervisor.cleanup());
    expect(cleaned).toMatchObject({
      ok: false,
      blocker: { code: "emulator-lease-recovery-blocked" },
    });
    expect(requireSuccess(await supervisor.cleanup())).toEqual(cleaned);
  });

  it("should never signal a process group whose ownership observation is unknown", async () => {
    const signals: NodeJS.Signals[] = [];
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
        processRuntime: {
          start: async () => ({
            ok: true,
            value: {
              identity: { bootId: "boot", pid: 14, startTicks: 14n, processGroupId: 14 },
              completion: Promise.resolve({ exitCode: 0, signal: null }),
              revalidateIdentity: async () => "unknown" as const,
              terminate: async (signal) => {
                signals.push(signal);
              },
            },
          }),
        },
      }),
    );
    requireSuccess(
      await supervisor.runProcess({
        executable: "/tool",
        argv: [],
        cwd: "/owned",
        deadline: { hardDeadlineMs: 4_000, workDeadlineMs: 3_000, cleanupGraceMs: 1_000 },
      }),
    );
    expect(requireSuccess(await supervisor.cleanup())).toMatchObject({ ok: false });
    expect(signals).toEqual([]);
  });

  it("should escalate a still-live process group and confirm descendant reaping", async () => {
    let live = true;
    const signals: NodeJS.Signals[] = [];
    let groupWaits = 0;
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
        processRuntime: {
          start: async () => ({
            ok: true,
            value: {
              identity: { bootId: "boot", pid: 4, startTicks: 4n, processGroupId: 4 },
              completion: Promise.resolve({ exitCode: 0, signal: null }),
              revalidateIdentity: async () => live,
              terminate: async (signal) => {
                signals.push(signal);
                if (signal === "SIGKILL") live = false;
              },
              waitForGroupExit: async () => {
                groupWaits += 1;
                return !live;
              },
            },
          }),
        },
      }),
    );
    requireSuccess(
      await supervisor.runProcess({
        executable: "/tool",
        argv: [],
        cwd: "/owned",
        deadline: { hardDeadlineMs: 4_000, workDeadlineMs: 3_000, cleanupGraceMs: 1_000 },
      }),
    );
    expect(requireSuccess(await supervisor.cleanup())).toMatchObject({ ok: true });
    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(groupWaits).toBe(2);
    expect(await supervisor.runWorker(workerRequest())).toMatchObject({
      ok: false,
      issues: [{ code: "execution.stale-authority" }],
    });
    expect(
      await supervisor.runProcess({
        executable: "/tool",
        argv: [],
        cwd: "/owned",
        deadline: { hardDeadlineMs: 4_000, workDeadlineMs: 3_000, cleanupGraceMs: 1_000 },
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "execution.stale-authority" }] });
  });

  it("should aggregate worker and workspace cleanup exceptions into one stable blocker", async () => {
    const supervisor = requireSuccess(
      createExecutionSupervisorV1(POLICY, {
        time: { monotonicNow: () => 0, waitUntil: async () => "deadline" },
        workspaceProvider: {
          create: async () => ({
            ok: true,
            value: {
              root: "/owned",
              identity: { device: 1n, inode: 1n, uid: 1 },
              resolveRegularFile: async (path) => `/owned/${path}`,
              dispose: async () => {
                throw new Error("workspace cleanup");
              },
            },
          }),
        },
        workerExecutor: {
          start: async (request) => ({
            ok: true,
            value: {
              completion: Promise.resolve({
                kind: "message",
                value: {
                  revision: "execution-worker-response-v1",
                  tier: "frontend",
                  contract: "frontend-pipeline-v1",
                  caseIdentity: request.caseIdentity,
                  diagnostics: { revision: "compiler-diagnostic-evidence-v1", entries: [] },
                  semanticModelPresent: true,
                  allocationPlanPresent: true,
                  emission: { il: false, assembly: false, binary: false },
                },
              }),
              terminate: async () => {
                throw new Error("worker cleanup");
              },
            },
          }),
        },
      }),
    );
    requireSuccess(await supervisor.createWorkspace());
    expect(await supervisor.runWorker(workerRequest())).toMatchObject({
      ok: false,
      issues: [{ code: "execution.io" }],
    });
    expect(requireSuccess(await supervisor.cleanup())).toMatchObject({
      ok: false,
      blocker: { code: "emulator-lease-recovery-blocked" },
    });
  });
});
