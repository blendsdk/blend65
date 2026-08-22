/**
 * Specification tests for the cancellable low-level VICE control surface.
 *
 * The fake host stops at the operating-system boundary. Tests exchange the
 * same raw binary and text bytes as VICE so framing, correlation, ownership,
 * and cancellation remain observable behavior of the control runtime.
 */

import { describe, expect, it } from "vitest";

import {
  createViceControlRuntimeV1,
  type ViceControlHostV1,
  type ViceControlIssueV1,
  type ViceControlLaunchV1,
  type ViceControlOwnedChildV1,
  type ViceControlRawChannelV1,
  type ViceControlResultV1,
} from "./vice-control.js";

const textEncoder = new TextEncoder();

function success<T>(value: T): ViceControlResultV1<T> {
  return { ok: true, value };
}

function failure(
  code: ViceControlIssueV1["code"],
  reason: ViceControlIssueV1["reason"],
): ViceControlResultV1<never> {
  return { ok: false, issue: { code, reason, message: `${code}: ${reason}` } };
}

function responseFrame(
  type: number,
  requestId: number,
  body: Uint8Array = new Uint8Array(0),
): Uint8Array {
  const frame = new Uint8Array(12 + body.length);
  const view = new DataView(frame.buffer);
  frame.set([0x02, 0x02]);
  view.setUint32(2, body.length, true);
  frame[6] = type;
  frame[7] = 0;
  view.setUint32(8, requestId, true);
  frame.set(body, 12);
  return frame;
}

function command(frame: Uint8Array): { type: number; requestId: number; body: Uint8Array } {
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const bodyLength = view.getUint32(2, true);
  return {
    type: frame[10],
    requestId: view.getUint32(6, true),
    body: frame.slice(11, 11 + bodyLength),
  };
}

function registersBody(): Uint8Array {
  const names = ["A", "X", "Y", "SP", "PC", "FL"];
  const bytes: number[] = [names.length, 0];
  names.forEach((name, id) => {
    const encoded = textEncoder.encode(name);
    bytes.push(3 + encoded.length, id, name === "PC" ? 16 : 8, encoded.length, ...encoded);
  });
  return new Uint8Array(bytes);
}

class RawChannel implements ViceControlRawChannelV1 {
  readonly writes: Uint8Array[] = [];
  onWrite?: (bytes: Uint8Array) => void;
  closeCalls = 0;
  private readonly queued: Array<ViceControlResultV1<Uint8Array | null>> = [];
  private readonly readers: Array<(result: ViceControlResultV1<Uint8Array | null>) => void> = [];

  async write(bytes: Uint8Array): Promise<ViceControlResultV1<true>> {
    const snapshot = bytes.slice();
    this.writes.push(snapshot);
    this.onWrite?.(snapshot);
    return success(true);
  }

  async read(): Promise<ViceControlResultV1<Uint8Array | null>> {
    const queued = this.queued.shift();
    if (queued !== undefined) return queued;
    return new Promise((resolve) => this.readers.push(resolve));
  }

  async close(): Promise<ViceControlResultV1<true>> {
    this.closeCalls += 1;
    return success(true);
  }

  push(bytes: Uint8Array): void {
    this.deliver(success(bytes));
  }

  pushFailure(code: ViceControlIssueV1["code"], reason: ViceControlIssueV1["reason"]): void {
    this.deliver(failure(code, reason));
  }

  private deliver(result: ViceControlResultV1<Uint8Array | null>): void {
    const reader = this.readers.shift();
    if (reader === undefined) this.queued.push(result);
    else reader(result);
  }
}

class FakeHost implements ViceControlHostV1 {
  readonly binary = new RawChannel();
  readonly text = new RawChannel();
  readonly spawnRequests: Array<Pick<ViceControlLaunchV1, "executable" | "argv" | "cwd">> = [];
  readonly connections: Array<{ role: "binary" | "text"; port: number }> = [];
  readonly ownershipChecks: Array<{ role: "binary" | "text"; port: number }> = [];
  readonly delays: number[] = [];
  closeChildCalls = 0;
  connectFailuresRemaining = 0;
  ownerResult: ViceControlResultV1<boolean> = success(true);
  spawnResult?: ViceControlResultV1<ViceControlOwnedChildV1>;
  private clock = 0;
  private resolveExit!: (exit: {
    readonly code: number | null;
    readonly signal: string | null;
  }) => void;
  readonly child: ViceControlOwnedChildV1 = {
    identity: "owned-child-1",
    exited: new Promise((resolve) => {
      this.resolveExit = resolve;
    }),
  };

  constructor() {
    this.installSuccessfulHandshake();
  }

  nowMilliseconds(): number {
    return this.clock;
  }

  async delay(milliseconds: number, signal: AbortSignal): Promise<"elapsed" | "aborted"> {
    this.delays.push(milliseconds);
    if (signal.aborted) return "aborted";
    this.clock += milliseconds;
    return "elapsed";
  }

  async spawn(
    request: Pick<ViceControlLaunchV1, "executable" | "argv" | "cwd">,
    _signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlOwnedChildV1>> {
    this.spawnRequests.push(request);
    return this.spawnResult ?? success(this.child);
  }

  async connectLoopback(
    role: "binary" | "text",
    port: number,
    _signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlRawChannelV1>> {
    this.connections.push({ role, port });
    if (this.connectFailuresRemaining > 0) {
      this.connectFailuresRemaining -= 1;
      return failure("vice.io", "vice.connect");
    }
    return success(role === "binary" ? this.binary : this.text);
  }

  async endpointBelongsToChild(
    _child: ViceControlOwnedChildV1,
    role: "binary" | "text",
    port: number,
  ): Promise<ViceControlResultV1<boolean>> {
    this.ownershipChecks.push({ role, port });
    return this.ownerResult;
  }

  async closeOwnedChild(_child: ViceControlOwnedChildV1): Promise<ViceControlResultV1<true>> {
    this.closeChildCalls += 1;
    return success(true);
  }

  exit(code: number | null, signal: string | null): void {
    this.resolveExit({ code, signal });
  }

  installSuccessfulHandshake(): void {
    this.binary.onWrite = (bytes) => {
      const request = command(bytes);
      if (request.type === 0x83)
        this.binary.push(responseFrame(0x83, request.requestId, registersBody()));
      else if (request.type === 0x85) {
        this.binary.push(responseFrame(0x85, request.requestId, new Uint8Array([4, 3, 10, 0, 0])));
      } else if (request.type === 0x51) {
        this.binary.push(responseFrame(0x51, request.requestId, new Uint8Array([1, 1, 0])));
      }
    };
    this.text.onWrite = (bytes) => {
      if (new TextDecoder().decode(bytes) === "stopwatch\n") {
        this.text.push(textEncoder.encode("Stopwatch: 1234\n(C:$e5cf) "));
      }
    };
  }
}

function launchRequest(overrides: Partial<ViceControlLaunchV1> = {}): ViceControlLaunchV1 {
  return {
    executable: "/opt/vice/x64sc",
    argv: ["-silent", "-warp"],
    cwd: "/tmp/vice-workspace",
    endpoints: { binaryPort: 6502, textPort: 6510 },
    handshake: {
      target: "c64",
      version: { major: 3, minimumMinor: 7, maximumMinor: 10 },
      endpointOwnership: "required",
    },
    ...overrides,
  };
}

async function launch(host: FakeHost) {
  return createViceControlRuntimeV1(host).launch(launchRequest(), new AbortController().signal);
}

async function launchedSession(host: FakeHost) {
  const result = await launch(host);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.issue.message);
  return result.value;
}

function expectIssue(
  result: ViceControlResultV1<unknown>,
  code: ViceControlIssueV1["code"],
  reason: ViceControlIssueV1["reason"],
): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.issue).toMatchObject({ code, reason });
}

describe("Specification: low-level VICE launch and handshake", () => {
  it("forwards the launch request, connects binary then text on loopback, proves ownership, and closes once", async () => {
    const host = new FakeHost();
    const request = launchRequest();
    const result = await createViceControlRuntimeV1(host).launch(
      request,
      new AbortController().signal,
    );

    expect(result.ok).toBe(true);
    expect(host.spawnRequests).toEqual([
      { executable: request.executable, argv: request.argv, cwd: request.cwd },
    ]);
    expect(host.connections).toEqual([
      { role: "binary", port: 6502 },
      { role: "text", port: 6510 },
    ]);
    expect(host.ownershipChecks).toEqual(host.connections);
    expect(host.binary.writes.map((bytes) => command(bytes).type)).toEqual([0x83, 0x85, 0x51]);
    expect(host.text.writes.map((bytes) => new TextDecoder().decode(bytes))).toEqual([
      "stopwatch\n",
    ]);
    if (!result.ok) return;
    await result.value.close();
    await result.value.close();
    expect(host.closeChildCalls).toBe(1);
  });

  it.each([
    { binaryPort: 0, textPort: 6510 },
    { binaryPort: 65536, textPort: 6510 },
    { binaryPort: 6502.5, textPort: 6510 },
    { binaryPort: 6502, textPort: 6502 },
  ])("rejects malformed endpoints before spawning: %o", async (endpoints) => {
    const host = new FakeHost();
    const result = await createViceControlRuntimeV1(host).launch(
      launchRequest({ endpoints }),
      new AbortController().signal,
    );
    expectIssue(result, "vice.protocol", "vice.request");
    expect(host.spawnRequests).toHaveLength(0);
  });

  it("classifies spawn failure and does not attempt a connection", async () => {
    const host = new FakeHost();
    host.spawnResult = failure("vice.io", "vice.spawn");
    const result = await launch(host);
    expectIssue(result, "vice.io", "vice.spawn");
    expect(host.connections).toHaveLength(0);
  });

  it("uses one child and bounded 250 ms connection rounds before a stable connection failure", async () => {
    const host = new FakeHost();
    host.connectFailuresRemaining = Number.MAX_SAFE_INTEGER;
    const result = await launch(host);
    expectIssue(result, "vice.io", "vice.connect");
    expect(host.spawnRequests).toHaveLength(1);
    expect(host.connections.length).toBeLessThanOrEqual(60);
    expect(host.connections.length).toBeGreaterThan(0);
    expect(host.delays.every((delay) => delay === 250)).toBe(true);
    expect(host.nowMilliseconds()).toBeLessThanOrEqual(15000);
    expect(host.closeChildCalls).toBe(1);
  });

  it("classifies an observed child exit and closes the owned child once", async () => {
    const host = new FakeHost();
    host.connectFailuresRemaining = Number.MAX_SAFE_INTEGER;
    host.binary.onWrite = () => undefined;
    host.exit(23, null);
    const result = await launch(host);
    expectIssue(result, "vice.io", "vice.child-exited");
    expect(host.spawnRequests).toHaveLength(1);
    expect(host.closeChildCalls).toBe(1);
  });

  it.each([success(false), failure("vice.io", "vice.transport")])(
    "fails closed when required endpoint ownership cannot be proven",
    async (ownerResult) => {
      const host = new FakeHost();
      host.ownerResult = ownerResult;
      const result = await launch(host);
      expectIssue(result, "vice.protocol", "vice.endpoint-owner");
      expect(host.closeChildCalls).toBe(1);
    },
  );

  it("compatibility mode skips only endpoint ownership proof", async () => {
    const host = new FakeHost();
    host.ownerResult = success(false);
    const request = launchRequest({
      handshake: {
        target: "c64",
        version: { major: 3, minimumMinor: 7, maximumMinor: 10 },
        endpointOwnership: "compatibility",
      },
    });
    const result = await createViceControlRuntimeV1(host).launch(
      request,
      new AbortController().signal,
    );
    expect(result.ok).toBe(true);
    expect(host.ownershipChecks).toHaveLength(0);
    expect(host.binary.writes).toHaveLength(3);
    expect(host.text.writes).toHaveLength(1);
    if (result.ok) await result.value.close();
  });

  it("classifies malformed binary framing separately from semantic handshake failures", async () => {
    const host = new FakeHost();
    host.binary.onWrite = () => host.binary.push(new Uint8Array([0x02, 0x02, 0xff]));
    host.binary.pushFailure("vice.protocol", "vice.frame");
    const result = await launch(host);
    expectIssue(result, "vice.protocol", "vice.frame");
    expect(host.closeChildCalls).toBe(1);
  });

  it("rejects a text handshake without an anchored stopwatch line and terminal prompt", async () => {
    const host = new FakeHost();
    host.text.onWrite = () => host.text.push(textEncoder.encode("1234\n(C:$e5cf) "));
    const result = await launch(host);
    expectIssue(result, "vice.protocol", "vice.text-handshake");
  });

  it("rejects a non-integer machine resource as the wrong target", async () => {
    const host = new FakeHost();
    const normal = host.binary.onWrite;
    host.binary.onWrite = (bytes) => {
      const request = command(bytes);
      if (request.type === 0x51)
        host.binary.push(responseFrame(0x51, request.requestId, new Uint8Array([0, 1, 48])));
      else normal?.(bytes);
    };
    const result = await launch(host);
    expectIssue(result, "vice.protocol", "vice.target");
  });

  it.each([6, 11])("rejects VICE 3.%i outside the inclusive requested range", async (minor) => {
    const host = new FakeHost();
    const normal = host.binary.onWrite;
    host.binary.onWrite = (bytes) => {
      const request = command(bytes);
      if (request.type === 0x85) {
        host.binary.push(
          responseFrame(0x85, request.requestId, new Uint8Array([4, 3, minor, 0, 0])),
        );
      } else normal?.(bytes);
    };
    const result = await launch(host);
    expectIssue(result, "vice.protocol", "vice.version");
  });

  it("maps launch abort to cancellation and closes the one spawned child", async () => {
    const host = new FakeHost();
    host.connectFailuresRemaining = Number.MAX_SAFE_INTEGER;
    const controller = new AbortController();
    host.delay = async () => {
      controller.abort();
      return "aborted";
    };
    const result = await createViceControlRuntimeV1(host).launch(
      launchRequest(),
      controller.signal,
    );
    expectIssue(result, "vice.cancelled", "vice.cancelled");
    expect(host.spawnRequests).toHaveLength(1);
    expect(host.closeChildCalls).toBe(1);
  });
});

describe("Specification: instruction count validation", () => {
  it.each([0, -1, 1.5, 65536])(
    "rejects instruction count %s without a wire write",
    async (count) => {
      const host = new FakeHost();
      const session = await launchedSession(host);
      const writesBefore = host.binary.writes.length;
      const result = await session.advanceInstructions(count);
      expectIssue(result, "vice.protocol", "vice.request");
      expect(host.binary.writes).toHaveLength(writesBefore);
      await session.close();
    },
  );

  it.each([
    [1, [0x00, 0x01, 0x00]],
    [65535, [0x00, 0xff, 0xff]],
  ] as const)(
    "encodes accepted count %i exactly once without masking",
    async (count, expectedBody) => {
      const host = new FakeHost();
      const session = await launchedSession(host);
      host.binary.onWrite = (bytes) => {
        const request = command(bytes);
        host.binary.push(responseFrame(request.type, request.requestId));
        host.binary.push(responseFrame(0x62, 0xffffffff));
      };
      const result = await session.advanceInstructions(count);
      expect(result.ok).toBe(true);
      const request = command(host.binary.writes.at(-1)!);
      expect(request.type).toBe(0x71);
      expect([...request.body]).toEqual(expectedBody);
      await session.close();
    },
  );
});

describe("Specification: raw response ownership and pending-command races", () => {
  it("correlates fragmented out-of-order replies by request id while ignoring an unsolicited event", async () => {
    const host = new FakeHost();
    const session = await launchedSession(host);
    host.binary.onWrite = () => undefined;
    const firstPromise = session.readMemory(0xc000, 1);
    const secondPromise = session.readMemory(0xc001, 1);
    const first = command(host.binary.writes.at(-2)!);
    const second = command(host.binary.writes.at(-1)!);
    const secondFrame = responseFrame(0x01, second.requestId, new Uint8Array([1, 0, 0x22]));
    host.binary.push(responseFrame(0x62, 0xffffffff));
    host.binary.push(secondFrame.slice(0, 5));
    host.binary.push(secondFrame.slice(5));
    host.binary.push(responseFrame(0x01, first.requestId, new Uint8Array([1, 0, 0x11])));
    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);
    expect(firstResult).toEqual(success(new Uint8Array([0x11])));
    expect(secondResult).toEqual(success(new Uint8Array([0x22])));
    await session.close();
  });

  it("cancels pending work, discards its late reply, and leaves the session usable", async () => {
    const host = new FakeHost();
    const session = await launchedSession(host);
    host.binary.onWrite = () => undefined;
    const pending = session.readMemory(0xc000, 1);
    const cancelledRequest = command(host.binary.writes.at(-1)!);
    expect(await session.cancelPending()).toEqual(success(true));
    expectIssue(await pending, "vice.cancelled", "vice.cancelled");
    host.binary.push(responseFrame(0x01, cancelledRequest.requestId, new Uint8Array([1, 0, 0xaa])));
    const next = session.readMemory(0xc001, 1);
    const nextRequest = command(host.binary.writes.at(-1)!);
    host.binary.push(responseFrame(0x01, nextRequest.requestId, new Uint8Array([1, 0, 0x44])));
    expect(await next).toEqual(success(new Uint8Array([0x44])));
    await session.close();
  });

  it("preserves a completed response when it wins before cancellation", async () => {
    const host = new FakeHost();
    const session = await launchedSession(host);
    host.binary.onWrite = (bytes) => {
      const request = command(bytes);
      host.binary.push(responseFrame(request.type, request.requestId));
    };
    const completed = await session.writeMemory(0xc000, new Uint8Array([0x55]));
    expect(await session.cancelPending()).toEqual(success(true));
    expect(completed).toEqual(success(true));
    await session.close();
  });

  it("makes close idempotent and terminal while settling pending work", async () => {
    const host = new FakeHost();
    const session = await launchedSession(host);
    host.binary.onWrite = () => undefined;
    const pending = session.readMemory(0xc000, 1);
    expect(await session.close()).toEqual(success(true));
    expect(await session.close()).toEqual(success(true));
    expectIssue(await pending, "vice.closed", "vice.closed");
    const writesAfterClose = host.binary.writes.length;
    expectIssue(await session.readStopwatch(), "vice.closed", "vice.closed");
    expect(host.binary.writes).toHaveLength(writesAfterClose);
    expect(host.closeChildCalls).toBe(1);
  });

  it("snapshots write bytes before the first await", async () => {
    const host = new FakeHost();
    const session = await launchedSession(host);
    host.binary.onWrite = () => undefined;
    const input = new Uint8Array([0x11, 0x22]);
    const pending = session.writeMemory(0xc000, input);
    input.fill(0xff);
    const request = command(host.binary.writes.at(-1)!);
    expect([...request.body.slice(-2)]).toEqual([0x11, 0x22]);
    host.binary.push(responseFrame(request.type, request.requestId));
    expect(await pending).toEqual(success(true));
    await session.close();
  });

  it("returns fresh read bytes independent of raw chunks and later caller mutation", async () => {
    const host = new FakeHost();
    const session = await launchedSession(host);
    host.binary.onWrite = () => undefined;
    const firstPending = session.readMemory(0xc000, 1);
    const firstRequest = command(host.binary.writes.at(-1)!);
    const raw = responseFrame(0x01, firstRequest.requestId, new Uint8Array([1, 0, 0x33]));
    host.binary.push(raw);
    const first = await firstPending;
    expect(first).toEqual(success(new Uint8Array([0x33])));
    raw.fill(0);
    if (first.ok) first.value[0] = 0xee;

    const secondPending = session.readMemory(0xc000, 1);
    const secondRequest = command(host.binary.writes.at(-1)!);
    host.binary.push(responseFrame(0x01, secondRequest.requestId, new Uint8Array([1, 0, 0x33])));
    expect(await secondPending).toEqual(success(new Uint8Array([0x33])));
    await session.close();
  });
});
