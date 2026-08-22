import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import type { ExecutionOperationResultV1 } from "@blend65/readiness";

import { defaultExecutionWorkspaceProviderV1 } from "./execution-workspace.js";
import {
  createExecutionWorkerExecutorV1,
  defaultExecutionWorkerExecutorV1,
} from "./execution-worker-executor.js";
import {
  parseExecutionWorkerResponseV1,
  type ExecutionWorkerRequestV1,
} from "./execution-worker-protocol.js";

const ENCODER = new TextEncoder();
const roots: { dispose(): Promise<void> }[] = [];

function requireSuccess<T>(result: ExecutionOperationResultV1<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return result.value;
}

function request(
  tier: ExecutionWorkerRequestV1["tier"],
  root: string,
  identityDigit = "1",
): ExecutionWorkerRequestV1 {
  const bytes = ENCODER.encode("module Main;\nfunction main(): void {\n  poke(0xD020, 2);\n}\n");
  const common = {
    revision: "execution-worker-request-v1" as const,
    caseIdentity: `sha256:${identityDigit.repeat(64)}`,
    caseRoot: root,
    source: {
      revision: "execution-worker-source-v1" as const,
      relativePath: "main.blend",
      bytes,
      digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    },
  };
  switch (tier) {
    case "frontend":
      return { ...common, tier, contract: "frontend-pipeline-v1" };
    case "compiler-api":
      return { ...common, tier, contract: "compiler-evidence-facade-v1" };
    case "cli":
      return {
        ...common,
        tier,
        contract: "blendc-cli-v1",
        argv: ["check", "main.blend", "--platform", "c64"],
      };
    case "emit":
      return { ...common, tier, contract: "assembly-emitter-v1" };
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((workspace) => workspace.dispose()));
});

describe("production compiler worker executor", () => {
  it("should execute each real tier contract without a parent-side compiler call", async () => {
    for (const tier of ["frontend", "compiler-api", "cli", "emit"] as const) {
      const workspace = requireSuccess(await defaultExecutionWorkspaceProviderV1.create());
      roots.push(workspace);
      const selected = request(tier, workspace.root);
      const handle = requireSuccess(
        await defaultExecutionWorkerExecutorV1.start(selected, {
          signal: new AbortController().signal,
          deadlineMonotonicMs: performance.now() + 10_000,
        }),
      );
      const completion = await handle.completion;
      expect(completion.kind).toBe("message");
      if (completion.kind === "message") {
        expect(parseExecutionWorkerResponseV1(selected, completion.value)).toMatchObject({
          ok: true,
          value: { tier, caseIdentity: selected.caseIdentity },
        });
      }
      await handle.terminate();
      await handle.terminate();
    }
  }, 60_000);

  it("should reject a launch whose cancellation already fired", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await defaultExecutionWorkerExecutorV1.start(request("frontend", "/unused"), {
      signal: controller.signal,
      deadlineMonotonicMs: 0,
    });
    expect(result).toMatchObject({ ok: false, issues: [{ code: "execution.io" }] });
  });

  it("should reuse a prewarmed worker without crossing case roots or response identities", async () => {
    const executor = createExecutionWorkerExecutorV1();
    const identities: number[] = [];
    try {
      for (const digit of ["2", "3", "4"]) {
        const workspace = requireSuccess(await defaultExecutionWorkspaceProviderV1.create());
        roots.push(workspace);
        const selected = request("frontend", workspace.root, digit);
        const handle = requireSuccess(
          await executor.start(selected, {
            signal: new AbortController().signal,
            deadlineMonotonicMs: performance.now() + 10_000,
          }),
        );
        identities.push(handle.workerIdentity ?? -1);
        const completion = await handle.completion;
        expect(completion).toMatchObject({
          kind: "message",
          value: { caseIdentity: selected.caseIdentity },
        });
        await handle.release?.();
      }
      expect(new Set(identities).size).toBe(1);
    } finally {
      await executor.shutdown?.();
    }
  }, 60_000);

  it("should bound leases to two workers and replace a resource-failed worker", async () => {
    const executor = createExecutionWorkerExecutorV1();
    try {
      const workspaces = await Promise.all(
        ["5", "6", "7", "8"].map(async () => {
          const workspace = requireSuccess(await defaultExecutionWorkspaceProviderV1.create());
          roots.push(workspace);
          return workspace;
        }),
      );
      const first = requireSuccess(
        await executor.start(request("frontend", workspaces[0]?.root ?? "", "5"), {
          signal: new AbortController().signal,
          deadlineMonotonicMs: performance.now() + 10_000,
        }),
      );
      const second = requireSuccess(
        await executor.start(request("frontend", workspaces[1]?.root ?? "", "6"), {
          signal: new AbortController().signal,
          deadlineMonotonicMs: performance.now() + 10_000,
        }),
      );
      let thirdStarted = false;
      const thirdPromise = executor
        .start(request("frontend", workspaces[2]?.root ?? "", "7"), {
          signal: new AbortController().signal,
          deadlineMonotonicMs: performance.now() + 10_000,
        })
        .then((started) => {
          thirdStarted = true;
          return started;
        });
      await Promise.all([first.completion, second.completion]);
      await Promise.resolve();
      expect(thirdStarted).toBe(false);
      await first.release?.();
      const third = requireSuccess(await thirdPromise);
      expect(third.workerIdentity).toBe(first.workerIdentity);
      await Promise.all([second.release?.(), third.completion.then(() => third.release?.())]);

      const bounded = request("emit", workspaces[3]?.root ?? "", "8");
      const failed = requireSuccess(
        await executor.start(bounded, {
          signal: new AbortController().signal,
          deadlineMonotonicMs: performance.now() + 10_000,
          outputLimitBytes: 8,
          evidenceLimitBytes: 1_024,
        }),
      );
      const failedIdentity = failed.workerIdentity;
      expect(await failed.completion).toMatchObject({
        kind: "crash",
        resourceFailure: "output-exhaustion",
      });
      await failed.terminate();

      const replacementWorkspace = requireSuccess(
        await defaultExecutionWorkspaceProviderV1.create(),
      );
      roots.push(replacementWorkspace);
      const replacement = requireSuccess(
        await executor.start(request("frontend", replacementWorkspace.root, "9"), {
          signal: new AbortController().signal,
          deadlineMonotonicMs: performance.now() + 10_000,
        }),
      );
      expect(replacement.workerIdentity).not.toBe(failedIdentity);
      await replacement.completion;
      await replacement.release?.();
    } finally {
      await executor.shutdown?.();
    }
  }, 60_000);

  it("should cancel a queued lease without disturbing the two active workers", async () => {
    const executor = createExecutionWorkerExecutorV1();
    try {
      const workspaces = await Promise.all(
        ["a", "b", "c"].map(async () => {
          const workspace = requireSuccess(await defaultExecutionWorkspaceProviderV1.create());
          roots.push(workspace);
          return workspace;
        }),
      );
      const first = requireSuccess(
        await executor.start(request("frontend", workspaces[0]?.root ?? "", "a"), {
          signal: new AbortController().signal,
          deadlineMonotonicMs: performance.now() + 10_000,
        }),
      );
      const second = requireSuccess(
        await executor.start(request("frontend", workspaces[1]?.root ?? "", "b"), {
          signal: new AbortController().signal,
          deadlineMonotonicMs: performance.now() + 10_000,
        }),
      );
      await Promise.all([first.completion, second.completion]);

      const queuedCancellation = new AbortController();
      const queued = executor.start(request("frontend", workspaces[2]?.root ?? "", "c"), {
        signal: queuedCancellation.signal,
        deadlineMonotonicMs: performance.now() + 10_000,
      });
      await Promise.resolve();
      queuedCancellation.abort();
      expect(await queued).toMatchObject({ ok: false, issues: [{ code: "execution.io" }] });

      await Promise.all([first.release?.(), second.release?.()]);
    } finally {
      await executor.shutdown?.();
    }
  }, 60_000);

  it("should reject oversized transfers and replace a worker after a malformed job", async () => {
    const executor = createExecutionWorkerExecutorV1();
    try {
      const evidenceWorkspace = requireSuccess(await defaultExecutionWorkspaceProviderV1.create());
      roots.push(evidenceWorkspace);
      const exhausted = await executor.start(request("frontend", evidenceWorkspace.root, "d"), {
        signal: new AbortController().signal,
        deadlineMonotonicMs: performance.now() + 10_000,
        outputLimitBytes: 1_024,
        evidenceLimitBytes: 1,
      });
      expect(exhausted).toMatchObject({
        ok: false,
        issues: [{ code: "execution.io" }],
      });

      const malformedWorkspace = requireSuccess(await defaultExecutionWorkspaceProviderV1.create());
      roots.push(malformedWorkspace);
      const selected = request("frontend", malformedWorkspace.root, "e");
      const malformed = requireSuccess(
        await executor.start(
          {
            ...selected,
            source: { ...selected.source, digest: `sha256:${"0".repeat(64)}` },
          },
          {
            signal: new AbortController().signal,
            deadlineMonotonicMs: performance.now() + 10_000,
          },
        ),
      );
      expect(await malformed.completion).toMatchObject({ kind: "crash", exitCode: null });
      await malformed.terminate();

      const mismatchedWorkspace = requireSuccess(
        await defaultExecutionWorkspaceProviderV1.create(),
      );
      roots.push(mismatchedWorkspace);
      const identityBound = request("frontend", mismatchedWorkspace.root, "0");
      const mismatched = requireSuccess(
        await executor.start(
          {
            ...identityBound,
            workspaceIdentity: {
              ...mismatchedWorkspace.identity,
              inode: mismatchedWorkspace.identity.inode + 1n,
            },
          },
          {
            signal: new AbortController().signal,
            deadlineMonotonicMs: performance.now() + 10_000,
          },
        ),
      );
      expect(await mismatched.completion).toMatchObject({ kind: "crash", exitCode: null });
      await mismatched.terminate();
    } finally {
      await executor.shutdown?.();
    }
  }, 60_000);

  it("should replace a healthy worker after its bounded batch and shut down idempotently", async () => {
    const executor = createExecutionWorkerExecutorV1();
    let firstIdentity: number | undefined;
    try {
      for (let index = 0; index < 9; index += 1) {
        const workspace = requireSuccess(await defaultExecutionWorkspaceProviderV1.create());
        roots.push(workspace);
        const handle = requireSuccess(
          await executor.start(request("frontend", workspace.root, "f"), {
            signal: new AbortController().signal,
            deadlineMonotonicMs: performance.now() + 10_000,
          }),
        );
        firstIdentity ??= handle.workerIdentity;
        await handle.completion;
        await handle.release?.();
        if (index === 8) expect(handle.workerIdentity).not.toBe(firstIdentity);
      }
    } finally {
      await executor.shutdown?.();
      await executor.shutdown?.();
    }
  }, 60_000);

  it("should leave the Node event loop idle when only the default executor module is imported", async () => {
    const moduleUrl = new URL("../dist/execution-worker-executor.js", import.meta.url).href;
    const child = spawn(
      process.execPath,
      ["--input-type=module", "-e", `await import(${JSON.stringify(moduleUrl)})`],
      { stdio: "ignore" },
    );
    let timeout: NodeJS.Timeout | undefined;
    try {
      const exitCode = await Promise.race([
        new Promise<number | null>((resolve) => child.once("exit", resolve)),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new TypeError("import-only process stayed live")),
            2_000,
          );
          timeout.unref();
        }),
      ]);
      expect(exitCode).toBe(0);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  });
});
