import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExecutionOperationResultV1 } from "@blend65/readiness";

import type {
  ViceLeaseNodeIdentityV1,
  ViceLeaseReferenceV1,
  ViceRecordedAttemptV1,
} from "./execution-vice-types.js";

const DIRECTORY: ViceLeaseNodeIdentityV1 = {
  device: 7n,
  inode: 11n,
  uid: 1000,
  mode: 0o700,
  links: 2,
};
const FILE: ViceLeaseNodeIdentityV1 = {
  device: 7n,
  inode: 12n,
  uid: 1000,
  mode: 0o600,
  links: 1,
};
const CLAIM: ViceLeaseReferenceV1 = {
  directory: DIRECTORY,
  file: FILE,
  bytesDigest: "a".repeat(64),
};

let temporaryDirectory: string | undefined;
let priorPath: string | undefined;

afterEach(async () => {
  vi.doUnmock("./execution-process.js");
  vi.doUnmock("./execution-vice-launch-artifact.js");
  vi.resetModules();
  if (priorPath === undefined) delete process.env.PATH;
  else process.env.PATH = priorPath;
  if (temporaryDirectory !== undefined) await rm(temporaryDirectory, { recursive: true });
  temporaryDirectory = undefined;
  priorPath = undefined;
});

describe("recorded VICE launcher start cleanup", () => {
  it.each([
    ["returns cancelled pending-start cleanup to the route coordinator", true, "vice.closed", 0],
    ["retires the exact artifact after an ordinary start failure", false, "vice.spawn", 1],
  ] as const)("%s", async (_name, cancelStart, expectedReason, expectedRetirements) => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "blend65-vice-launcher-"));
    const executable = join(temporaryDirectory, "x64sc");
    await writeFile(executable, "#!/bin/sh\nexit 1\n");
    await chmod(executable, 0o755);
    priorPath = process.env.PATH;
    process.env.PATH = temporaryDirectory;

    let startedSignal: AbortSignal | undefined;
    let releaseStart = (): void => undefined;
    const enteredStart = new Promise<void>((resolve) => {
      vi.doMock("./execution-process.js", async (importOriginal) => {
        const actual = await importOriginal<Record<string, unknown>>();
        return {
          ...actual,
          defaultExecutionProcessRuntimeV1: {
            start: async (
              _request: unknown,
              _sink: unknown,
              cancellation: { readonly signal: AbortSignal },
            ): Promise<ExecutionOperationResultV1<never>> => {
              startedSignal = cancellation.signal;
              resolve();
              return new Promise((finish) => {
                releaseStart = () =>
                  finish({
                    ok: false,
                    issues: [
                      {
                        code: "execution.io",
                        path: "/process",
                        message: "controlled launcher start failure",
                      },
                    ],
                  });
              });
            },
          },
        };
      });
    });
    vi.doMock("./execution-vice-launch-artifact.js", async (importOriginal) => {
      const actual = await importOriginal<Record<string, unknown>>();
      return {
        ...actual,
        createViceLaunchArtifactV1: async (attempt: ViceRecordedAttemptV1) => ({
          schema: "blend65-vice-launch-v1",
          target: "c64",
          generation: attempt.generation,
          nonce: attempt.nonce,
          launchToken: Buffer.from(attempt.launchToken).toString("hex"),
          binaryPort: attempt.endpoints.binaryPort,
          textPort: attempt.endpoints.textPort,
          executable,
          argv: attempt.argv,
          cwd: attempt.cwd,
          display: "",
          state: "prepared",
          identity: null,
        }),
      };
    });

    const { prepareRecordedViceControlHostV1 } = await import("./execution-vice-control-host.js");
    const attempt: ViceRecordedAttemptV1 = {
      target: "c64",
      claim: CLAIM,
      generation: 1,
      nonce: "b".repeat(64),
      launchToken: new Uint8Array(32),
      launchTokenPath: `/run/user/1000/blend65/vice/c64/launch-${"0".repeat(64)}.json`,
      endpoints: { binaryPort: 20_000, textPort: 20_001 },
      executable: "x64sc",
      argv: ["-binarymonitor", "-binarymonitoraddress", "127.0.0.1:20000"],
      cwd: process.cwd(),
    };
    const removed: unknown[][] = [];
    const host = await prepareRecordedViceControlHostV1(
      {
        nowMonotonicMilliseconds: () => 1,
        delay: async () => "elapsed",
        registerProcessHandle: () => undefined,
        observeProcess: async () => ({ ok: true, value: null }),
        observeLease: async () => ({ ok: true, value: { kind: "absent", directory: DIRECTORY } }),
        compareReplaceLease: async () => ({ ok: true, value: { kind: "changed" } }),
        compareRemoveLaunchArtifact: async (...arguments_: unknown[]) => {
          removed.push(arguments_);
          return { ok: true, value: "removed" };
        },
        revalidateAndTerminateVice: async () => ({ ok: true, value: "already-exited" }),
      },
      attempt,
      1000,
    );
    const cancellation = new AbortController();
    const spawned = host.spawn(
      { executable: attempt.executable, argv: attempt.argv, cwd: attempt.cwd },
      cancellation.signal,
    );
    await enteredStart;
    if (cancelStart) cancellation.abort();
    expect(startedSignal?.aborted).toBe(cancelStart);
    releaseStart();

    await expect(spawned).resolves.toMatchObject({
      ok: false,
      issue: { reason: expectedReason },
    });
    expect(removed).toHaveLength(expectedRetirements);
    if (expectedRetirements === 1) {
      expect(removed[0]?.slice(0, 4)).toEqual(["c64", CLAIM, attempt.launchTokenPath, null]);
    }
  });
});
