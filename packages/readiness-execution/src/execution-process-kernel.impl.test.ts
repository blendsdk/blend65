import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  EXECUTION_PROCESS_KERNEL_LIMITS_V1,
  createExecutionProcessRuntimeV1,
  runExecutionProcessAnchorV1,
  type ExecutionProcessAnchorHostV1,
  type ExecutionProcessParentHostV1,
} from "./execution-process.js";
import {
  anchorFrameCodecV1,
  parentFrameCodecV1,
  validHostIdentity,
  validKernelArgv,
  wireIdentityToHost,
  type ExecutionProcessAnchorFrameV1,
  type ExecutionProcessAnchorTransportV1,
  type ExecutionControlReadV1,
  type ExecutionHostProcessExitV1,
  type ExecutionHostProcessIdentityV1,
  type ExecutionProcessParentFrameV1,
} from "./execution-process-kernel-protocol.js";
import { createExecutionRawControlTransportV1 } from "./execution-process-linux-host.js";

const cancellation = {
  signal: new AbortController().signal,
  deadlineMonotonicMs: performance.now() + 1_000,
};

const anchorIdentity: ExecutionHostProcessIdentityV1 = Object.freeze({
  bootId: "boot",
  pid: 100,
  startTicks: 1n,
  processGroupId: 100,
  sessionId: 100,
});

function encodeAnchorFrame(frame: ExecutionProcessAnchorFrameV1): ExecutionControlReadV1 {
  return { kind: "frame", bytes: anchorFrameCodecV1().encode(frame) };
}

function encodeParentFrame(frame: ExecutionProcessParentFrameV1): ExecutionControlReadV1 {
  return { kind: "frame", bytes: parentFrameCodecV1().encode(frame) };
}

function createScriptedHost(
  reads: readonly ExecutionControlReadV1[],
  identity: ExecutionHostProcessIdentityV1 = anchorIdentity,
): ExecutionProcessParentHostV1 {
  const queue = [...reads];
  return {
    randomBytes: () => new Uint8Array(32),
    async spawnAnchor() {
      return {
        ok: true,
        value: {
          identity,
          completion: new Promise(() => undefined),
          control: {
            async sendFrame() {
              return { ok: true, value: undefined };
            },
            async receiveFrame() {
              return queue.shift() ?? { kind: "eof" as const };
            },
            async close() {
              return { ok: true, value: undefined };
            },
          },
        },
      };
    },
    async observeGroup() {
      return { kind: "unknown", reason: "io" };
    },
  };
}

const processRequest = Object.freeze({
  executable: "/tool",
  argv: Object.freeze([]),
  cwd: "/owned",
  deadline: Object.freeze({ hardDeadlineMs: 2, workDeadlineMs: 1, cleanupGraceMs: 1 }),
});
const processSink = Object.freeze({ onStdout: () => undefined, onStderr: () => undefined });

type AnchorFrameFields = ExecutionProcessAnchorFrameV1 extends infer Frame
  ? Frame extends ExecutionProcessAnchorFrameV1
    ? Omit<Frame, "revision" | "direction" | "nonce" | "sequence">
    : never
  : never;

describe("process anchor kernel", () => {
  it("should retain the closed process-control resource limits", () => {
    expect(EXECUTION_PROCESS_KERNEL_LIMITS_V1).toEqual({
      controlFrameBytes: 8_388_608,
      controlBytesPerDirection: 16_777_216,
      controlFramesPerDirection: 16,
      nonceBytes: 32,
      executableBytes: 65_536,
      cwdBytes: 65_536,
      argvItems: 1_024,
      argumentBytes: 65_536,
      argvBytes: 524_288,
      environmentEntries: 3,
      environmentBytes: 131_072,
      protocolMessageBytes: 4_096,
    });
  });

  it("should preserve raw frame boundaries across fragmented control-pipe reads", async () => {
    const incoming = new PassThrough();
    const outgoing = new PassThrough();
    const sent: Buffer[] = [];
    outgoing.on("data", (chunk: Buffer) => sent.push(Buffer.from(chunk)));
    const transport = createExecutionRawControlTransportV1(incoming, outgoing);
    incoming.write(Buffer.from('{"first":1}\n{"second"'));
    incoming.write(Buffer.from(":2}\n"));
    await expect(transport.receiveFrame(cancellation)).resolves.toEqual({
      kind: "frame",
      bytes: new TextEncoder().encode('{"first":1}\n'),
    });
    await expect(transport.receiveFrame(cancellation)).resolves.toEqual({
      kind: "frame",
      bytes: new TextEncoder().encode('{"second":2}\n'),
    });
    expect(await transport.sendFrame(Uint8Array.of(1, 2, 3), cancellation)).toMatchObject({
      ok: true,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(Buffer.concat(sent)).toEqual(Buffer.from([1, 2, 3]));
    expect(await transport.close(cancellation)).toMatchObject({ ok: true });
    expect(await transport.close(cancellation)).toMatchObject({ ok: true });
  });

  it("should reject invalid requests and cancellation before asking the host to spawn", async () => {
    let spawnCalls = 0;
    const host: ExecutionProcessParentHostV1 = {
      randomBytes: () => new Uint8Array(32),
      async spawnAnchor() {
        spawnCalls += 1;
        throw new TypeError("unreachable");
      },
      async observeGroup() {
        return { kind: "unknown", reason: "io" };
      },
    };
    const runtime = createExecutionProcessRuntimeV1(host);
    const sink = { onStdout: () => undefined, onStderr: () => undefined };
    expect(
      await runtime.start(
        {
          executable: "",
          argv: [],
          cwd: "/owned",
          deadline: { hardDeadlineMs: 2, workDeadlineMs: 1, cleanupGraceMs: 1 },
        },
        sink,
        cancellation,
      ),
    ).toMatchObject({ ok: false });
    const controller = new AbortController();
    controller.abort();
    expect(
      await runtime.start(
        {
          executable: "/tool",
          argv: [],
          cwd: "/owned",
          deadline: { hardDeadlineMs: 2, workDeadlineMs: 1, cleanupGraceMs: 1 },
        },
        sink,
        { signal: controller.signal, deadlineMonotonicMs: 1 },
      ),
    ).toMatchObject({ ok: false });
    expect(spawnCalls).toBe(0);
    expect(host).not.toHaveProperty("signal");
  });

  it("should reject malformed and noncanonical control identities", () => {
    expect(validHostIdentity(null)).toBe(false);
    expect(validHostIdentity([])).toBe(false);
    expect(validHostIdentity(anchorIdentity)).toBe(true);
    expect(validHostIdentity({ ...anchorIdentity, bootId: "" })).toBe(false);
    expect(validHostIdentity({ ...anchorIdentity, pid: 0 })).toBe(false);
    expect(validHostIdentity({ ...anchorIdentity, startTicks: 0n })).toBe(false);
    expect(validHostIdentity({ ...anchorIdentity, processGroupId: 0 })).toBe(false);
    expect(validHostIdentity({ ...anchorIdentity, sessionId: 0 })).toBe(false);
    expect(wireIdentityToHost([])).toBeUndefined();
    expect(
      wireIdentityToHost({
        bootId: "boot",
        pid: 1,
        startTicks: "0",
        processGroupId: 1,
        sessionId: 1,
      }),
    ).toBeUndefined();
    expect(
      wireIdentityToHost({
        bootId: "boot",
        pid: 1,
        startTicks: "1",
        processGroupId: 1,
        sessionId: 1,
      }),
    ).toEqual({
      bootId: "boot",
      pid: 1,
      startTicks: 1n,
      processGroupId: 1,
      sessionId: 1,
    });
  });

  it("should reject noncanonical frames and enforce per-direction frame bounds", () => {
    const nonce = "01".repeat(32);
    const bootstrap: ExecutionProcessParentFrameV1 = {
      revision: "execution-process-anchor-frame-v1",
      direction: "parent-to-anchor",
      nonce,
      sequence: 0,
      kind: "bootstrap",
    };
    const parentCodec = parentFrameCodecV1();
    expect(() =>
      parentCodec.decode({
        kind: "frame",
        bytes: new TextEncoder().encode(
          `${JSON.stringify({ ...bootstrap, revision: "unknown" })}\n`,
        ),
      }),
    ).toThrow("noncanonical");
    expect(() =>
      parentCodec.decode({
        kind: "frame",
        bytes: new TextEncoder().encode("null\n"),
      }),
    ).toThrow("not an object");

    const anchorCodec = anchorFrameCodecV1();
    expect(() =>
      anchorCodec.decode({
        kind: "frame",
        bytes: new TextEncoder().encode(
          `${JSON.stringify({ ...bootstrap, direction: "anchor-to-parent" })}\n`,
        ),
      }),
    ).toThrow("noncanonical");
    const failure: ExecutionProcessAnchorFrameV1 = {
      revision: "execution-process-anchor-frame-v1",
      direction: "anchor-to-parent",
      nonce,
      sequence: 0,
      kind: "failure",
      code: "protocol",
      message: "invalid control frame",
    };
    expect(anchorCodec.decode({ kind: "frame", bytes: anchorCodec.encode(failure) })).toEqual(
      failure,
    );

    const bounded = parentFrameCodecV1();
    for (
      let index = 0;
      index < EXECUTION_PROCESS_KERNEL_LIMITS_V1.controlFramesPerDirection;
      index += 1
    ) {
      bounded.encode({ ...bootstrap, sequence: index });
    }
    expect(() =>
      bounded.encode({
        ...bootstrap,
        sequence: EXECUTION_PROCESS_KERNEL_LIMITS_V1.controlFramesPerDirection,
      }),
    ).toThrow("output exceeded");
  });

  it("should reject argument payloads above the aggregate bound", () => {
    const argument = "x".repeat(EXECUTION_PROCESS_KERNEL_LIMITS_V1.argumentBytes);
    const argv = Array.from({ length: 9 }, () => argument);
    expect(validKernelArgv("/tool", argv, "/owned")).toBe(false);
    expect(validKernelArgv("/tool", [null], "/owned")).toBe(false);
  });

  it("should fail closed on invalid nonce and anchor spawn identities", async () => {
    const invalidNonceHost = createScriptedHost([]);
    invalidNonceHost.randomBytes = () => new Uint8Array(31);
    await expect(
      createExecutionProcessRuntimeV1(invalidNonceHost).start(
        processRequest,
        processSink,
        cancellation,
      ),
    ).resolves.toMatchObject({ ok: false });

    const thrownNonceHost = createScriptedHost([]);
    thrownNonceHost.randomBytes = () => {
      throw "unavailable";
    };
    await expect(
      createExecutionProcessRuntimeV1(thrownNonceHost).start(
        processRequest,
        processSink,
        cancellation,
      ),
    ).resolves.toMatchObject({
      ok: false,
      issues: [{ message: "Process control failed." }],
    });

    await expect(
      createExecutionProcessRuntimeV1(
        createScriptedHost([], { ...anchorIdentity, processGroupId: 101 }),
      ).start(processRequest, processSink, cancellation),
    ).resolves.toMatchObject({ ok: false });
  });

  it("should retain authenticated group control through fresh bounded termination cleanup", async () => {
    const nonce = "00".repeat(32);
    const targetIdentity: ExecutionHostProcessIdentityV1 = {
      ...anchorIdentity,
      pid: 101,
      startTicks: 2n,
    };
    let sequence = 0;
    const frame = (fields: AnchorFrameFields): ExecutionControlReadV1 =>
      encodeAnchorFrame({
        revision: "execution-process-anchor-frame-v1",
        direction: "anchor-to-parent",
        nonce,
        sequence: sequence++,
        ...fields,
      } as ExecutionProcessAnchorFrameV1);
    const queued: ExecutionControlReadV1[] = [
      frame({
        kind: "anchor-ready",
        identity: {
          bootId: anchorIdentity.bootId,
          pid: anchorIdentity.pid,
          startTicks: anchorIdentity.startTicks.toString(),
          processGroupId: anchorIdentity.processGroupId,
          sessionId: anchorIdentity.sessionId,
        },
      }),
      frame({
        kind: "target-started",
        identity: {
          bootId: targetIdentity.bootId,
          pid: targetIdentity.pid,
          startTicks: targetIdentity.startTicks.toString(),
          processGroupId: targetIdentity.processGroupId,
          sessionId: targetIdentity.sessionId,
        },
      }),
    ];
    const readers: Array<(read: ExecutionControlReadV1) => void> = [];
    const deliver = (read: ExecutionControlReadV1): void => {
      const reader = readers.shift();
      if (reader === undefined) queued.push(read);
      else reader(read);
    };
    const host: ExecutionProcessParentHostV1 = {
      randomBytes: () => new Uint8Array(32),
      async spawnAnchor() {
        return {
          ok: true,
          value: {
            identity: anchorIdentity,
            completion: new Promise<ExecutionHostProcessExitV1>(() => undefined),
            control: {
              async sendFrame(bytes) {
                const decoded = JSON.parse(new TextDecoder().decode(bytes)) as { kind?: string };
                if (decoded.kind === "terminate") deliver(frame({ kind: "term-applied" }));
                return { ok: true, value: undefined };
              },
              async receiveFrame() {
                return queued.shift() ?? new Promise((resolve) => readers.push(resolve));
              },
              async close() {
                return { ok: true, value: undefined };
              },
            },
          },
        };
      },
      async observeGroup() {
        return { kind: "present", witness: anchorIdentity };
      },
    };
    const started = await createExecutionProcessRuntimeV1(host).start(
      processRequest,
      processSink,
      cancellation,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(await started.value.revalidateIdentity()).toBe("present");
    await expect(started.value.terminate("SIGHUP")).rejects.toThrow("Unsupported");
    const cleanup = new AbortController();
    await started.value.terminate("SIGTERM", {
      signal: cleanup.signal,
      deadlineMonotonicMs: performance.now() + 1_000,
    });
    expect(await started.value.waitForGroupExit?.(performance.now())).toBe(false);
    deliver(frame({ kind: "target-exit", exitCode: 0, signal: null }));
    deliver(frame({ kind: "group-empty" }));
    await expect(started.value.completion).resolves.toEqual({ exitCode: 0, signal: null });
    expect(await started.value.revalidateIdentity()).toBe("absent");
    expect(await started.value.waitForGroupExit?.(performance.now())).toBe(true);
  });

  it("should recover termination serialization after a cancelled TERM acknowledgement", async () => {
    const nonce = "00".repeat(32);
    const targetIdentity: ExecutionHostProcessIdentityV1 = {
      ...anchorIdentity,
      pid: 101,
      startTicks: 2n,
    };
    let sequence = 0;
    const frame = (fields: AnchorFrameFields): ExecutionControlReadV1 =>
      encodeAnchorFrame({
        revision: "execution-process-anchor-frame-v1",
        direction: "anchor-to-parent",
        nonce,
        sequence: sequence++,
        ...fields,
      } as ExecutionProcessAnchorFrameV1);
    const queued: ExecutionControlReadV1[] = [
      frame({
        kind: "anchor-ready",
        identity: {
          bootId: anchorIdentity.bootId,
          pid: anchorIdentity.pid,
          startTicks: anchorIdentity.startTicks.toString(),
          processGroupId: anchorIdentity.processGroupId,
          sessionId: anchorIdentity.sessionId,
        },
      }),
      frame({
        kind: "target-started",
        identity: {
          bootId: targetIdentity.bootId,
          pid: targetIdentity.pid,
          startTicks: targetIdentity.startTicks.toString(),
          processGroupId: targetIdentity.processGroupId,
          sessionId: targetIdentity.sessionId,
        },
      }),
    ];
    const readers: Array<(read: ExecutionControlReadV1) => void> = [];
    const deliver = (read: ExecutionControlReadV1): void => {
      const reader = readers.shift();
      if (reader === undefined) queued.push(read);
      else reader(read);
    };
    const signals: string[] = [];
    const host: ExecutionProcessParentHostV1 = {
      randomBytes: () => new Uint8Array(32),
      async spawnAnchor() {
        return {
          ok: true,
          value: {
            identity: anchorIdentity,
            completion: new Promise<ExecutionHostProcessExitV1>(() => undefined),
            control: {
              async sendFrame(bytes) {
                const decoded = JSON.parse(new TextDecoder().decode(bytes)) as {
                  kind?: string;
                  signal?: string;
                };
                if (decoded.kind === "terminate" && decoded.signal !== undefined) {
                  signals.push(decoded.signal);
                  if (decoded.signal === "SIGKILL") {
                    deliver(frame({ kind: "term-applied" }));
                    deliver(frame({ kind: "kill-armed" }));
                    deliver(frame({ kind: "target-exit", exitCode: null, signal: "SIGKILL" }));
                    deliver(frame({ kind: "group-empty" }));
                  }
                }
                return { ok: true, value: undefined };
              },
              async receiveFrame() {
                return queued.shift() ?? new Promise((resolve) => readers.push(resolve));
              },
              async close() {
                return { ok: true, value: undefined };
              },
            },
          },
        };
      },
      async observeGroup() {
        return { kind: "absent" };
      },
    };
    const started = await createExecutionProcessRuntimeV1(host).start(
      processRequest,
      processSink,
      cancellation,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const termCancellation = new AbortController();
    const term = started.value.terminate("SIGTERM", {
      signal: termCancellation.signal,
      deadlineMonotonicMs: performance.now() + 1_000,
    });
    for (let turn = 0; turn < 10 && signals.length === 0; turn += 1) await Promise.resolve();
    expect(signals).toEqual(["SIGTERM"]);
    termCancellation.abort();
    await expect(term).rejects.toThrow("cancelled");

    await expect(
      started.value.terminate("SIGKILL", {
        signal: new AbortController().signal,
        deadlineMonotonicMs: performance.now() + 1_000,
      }),
    ).resolves.toBeUndefined();
    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
    await expect(started.value.completion).resolves.toEqual({
      exitCode: null,
      signal: "SIGKILL",
    });
    expect(await started.value.waitForGroupExit?.(performance.now())).toBe(true);
  });

  it("should fail closed on hostile readiness and target-start proofs", async () => {
    const nonce = "00".repeat(32);
    const wireAnchor = {
      bootId: anchorIdentity.bootId,
      pid: anchorIdentity.pid,
      startTicks: anchorIdentity.startTicks.toString(),
      processGroupId: anchorIdentity.processGroupId,
      sessionId: anchorIdentity.sessionId,
    };
    const wireTarget = {
      ...wireAnchor,
      pid: 101,
      startTicks: "2",
    };
    const frame = (
      sequence: number,
      fields: AnchorFrameFields,
      frameNonce = nonce,
    ): ExecutionProcessAnchorFrameV1 =>
      ({
        revision: "execution-process-anchor-frame-v1",
        direction: "anchor-to-parent",
        nonce: frameNonce,
        sequence,
        ...fields,
      }) as ExecutionProcessAnchorFrameV1;
    const ready = frame(0, { kind: "anchor-ready", identity: wireAnchor });
    const scenarios: readonly (readonly ExecutionControlReadV1[])[] = [
      [
        encodeAnchorFrame(
          frame(0, { kind: "anchor-ready", identity: wireAnchor }, "01".repeat(32)),
        ),
      ],
      [encodeAnchorFrame(frame(0, { kind: "failure", code: "protocol", message: "rejected" }))],
      [encodeAnchorFrame(frame(0, { kind: "group-empty" }))],
      [
        encodeAnchorFrame(
          frame(0, {
            kind: "anchor-ready",
            identity: { ...wireAnchor, startTicks: "2" },
          }),
        ),
      ],
      [
        encodeAnchorFrame(ready),
        encodeAnchorFrame(
          frame(1, { kind: "target-started", identity: wireTarget }, "01".repeat(32)),
        ),
      ],
      [
        encodeAnchorFrame(ready),
        encodeAnchorFrame(frame(1, { kind: "failure", code: "spawn", message: "rejected" })),
      ],
      [encodeAnchorFrame(ready), encodeAnchorFrame(frame(1, { kind: "group-empty" }))],
      [
        encodeAnchorFrame(ready),
        encodeAnchorFrame(
          frame(1, { kind: "target-started", identity: { ...wireTarget, pid: 100 } }),
        ),
      ],
    ];

    for (const reads of scenarios) {
      await expect(
        createExecutionProcessRuntimeV1(createScriptedHost(reads)).start(
          processRequest,
          processSink,
          cancellation,
        ),
      ).resolves.toMatchObject({ ok: false });
    }
  });

  it("should fail closed on anchor identity, spawn, membership, and signal errors", async () => {
    const nonce = "00".repeat(32);
    const bootstrap: ExecutionProcessParentFrameV1 = {
      revision: "execution-process-anchor-frame-v1",
      direction: "parent-to-anchor",
      nonce,
      sequence: 0,
      kind: "bootstrap",
    };
    const launch: ExecutionProcessParentFrameV1 = {
      revision: "execution-process-anchor-frame-v1",
      direction: "parent-to-anchor",
      nonce,
      sequence: 1,
      kind: "launch",
      executable: "/tool",
      argv: [],
      cwd: "/owned",
    };
    const terminate: ExecutionProcessParentFrameV1 = {
      revision: "execution-process-anchor-frame-v1",
      direction: "parent-to-anchor",
      nonce,
      sequence: 2,
      kind: "terminate",
      signal: "SIGTERM",
    };
    const targetIdentity: ExecutionHostProcessIdentityV1 = {
      ...anchorIdentity,
      pid: 101,
      startTicks: 2n,
    };
    const failure = (message: string) => ({
      ok: false as const,
      issues: [{ code: "execution.io" as const, path: "/process", message }] as const,
    });
    const createTransport = (
      reads: readonly ExecutionControlReadV1[],
      failSend = false,
    ): ExecutionProcessAnchorTransportV1 => {
      const queue = [...reads];
      return {
        async sendFrame() {
          return failSend ? failure("control write failed") : { ok: true, value: undefined };
        },
        async receiveFrame() {
          const next = queue.shift();
          return next ?? new Promise<ExecutionControlReadV1>(() => undefined);
        },
        async close() {
          return { ok: true, value: undefined };
        },
        onStdout: () => undefined,
        onStderr: () => undefined,
      };
    };
    interface HostOverrides {
      readonly self?: ExecutionHostProcessIdentityV1 | "failure";
      readonly target?: ExecutionHostProcessIdentityV1 | "failure";
      readonly exit?: ExecutionHostProcessExitV1;
      readonly membership?: "absent" | "unknown";
      readonly signalFailure?: boolean;
    }
    const createAnchorHost = (overrides: HostOverrides = {}): ExecutionProcessAnchorHostV1 => ({
      async observeSelf() {
        return overrides.self === "failure"
          ? failure("self observation failed")
          : { ok: true, value: overrides.self ?? anchorIdentity };
      },
      async spawnTarget() {
        return overrides.target === "failure"
          ? failure("target spawn failed")
          : {
              ok: true,
              value: {
                identity: overrides.target ?? targetIdentity,
                completion:
                  overrides.exit === undefined
                    ? new Promise<ExecutionHostProcessExitV1>(() => undefined)
                    : Promise.resolve(overrides.exit),
              },
            };
      },
      async signalSelfProcessGroup() {
        return overrides.signalFailure
          ? failure("self-group signal failed")
          : { ok: true, value: undefined };
      },
      async observeGroup() {
        return overrides.membership === "unknown"
          ? { kind: "unknown", reason: "io" }
          : { kind: "absent" };
      },
    });
    const bootstrapOnly = [encodeParentFrame(bootstrap)];
    const launched = [encodeParentFrame(bootstrap), encodeParentFrame(launch)];
    const scenarios = [
      [createAnchorHost({ self: "failure" }), createTransport(bootstrapOnly)],
      [
        createAnchorHost({ self: { ...anchorIdentity, sessionId: 101 } }),
        createTransport(bootstrapOnly),
      ],
      [createAnchorHost({ target: "failure" }), createTransport(launched)],
      [
        createAnchorHost({ target: { ...targetIdentity, processGroupId: 101 } }),
        createTransport(launched),
      ],
      [
        createAnchorHost({ exit: { kind: "crash", code: "io", message: "target crashed" } }),
        createTransport(launched),
      ],
      [
        createAnchorHost({ exit: { kind: "invalid" } as unknown as ExecutionHostProcessExitV1 }),
        createTransport(launched),
      ],
      [
        createAnchorHost({ exit: { kind: "exit", exitCode: 0 }, membership: "unknown" }),
        createTransport(launched),
      ],
      [
        createAnchorHost({ signalFailure: true }),
        createTransport([...launched, encodeParentFrame(terminate)]),
      ],
      [createAnchorHost(), createTransport(bootstrapOnly, true)],
    ] as const;
    for (const [host, transport] of scenarios) {
      await expect(
        runExecutionProcessAnchorV1(host, transport, cancellation),
      ).resolves.toMatchObject({ ok: false });
    }

    await expect(
      runExecutionProcessAnchorV1(
        createAnchorHost({ exit: { kind: "signal", signal: "SIGTERM" } }),
        createTransport(launched),
        cancellation,
      ),
    ).resolves.toMatchObject({ ok: true });
  });
});
