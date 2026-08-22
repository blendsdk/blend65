import { describe, expect, it } from "vitest";
import net from "node:net";

import {
  decodeViceControlFramesV1,
  parseViceC64ResourceV1,
  viceAdvanceInstructionsBodyV1,
  viceC64ResourceBodyV1,
  ViceControlFrameAccumulatorV1,
} from "./vice-control-protocol.js";
import { NodeViceControlHost } from "./vice-control-host.js";
import { closeViceControlResourcesV1 } from "./vice-control-cleanup.js";
import { ViceControlSession } from "./vice-control-session.js";
import { createViceControlRuntimeV1 } from "./vice-control.js";
import {
  viceControlFailure,
  viceControlSuccess,
  type ViceControlHostV1,
  type ViceControlLaunchV1,
  type ViceControlRawChannelV1,
  type ViceControlResultV1,
} from "./vice-control-types.js";

function launchRequest(): ViceControlLaunchV1 {
  return {
    executable: "x64sc",
    argv: ["-silent"],
    cwd: "/tmp",
    endpoints: { binaryPort: 6502, textPort: 6503 },
    handshake: {
      target: "c64",
      version: { major: 3, minimumMinor: 10, maximumMinor: 10 },
      endpointOwnership: "required",
    },
  };
}

class QueuedRawChannel implements ViceControlRawChannelV1 {
  readonly writes: Uint8Array[] = [];
  readCalls = 0;
  readonly #queued: Array<ViceControlResultV1<Uint8Array | null>> = [];
  readonly #readers: Array<(result: ViceControlResultV1<Uint8Array | null>) => void> = [];

  get pendingReads(): number {
    return this.#readers.length;
  }

  async write(bytes: Uint8Array): Promise<ViceControlResultV1<true>> {
    this.writes.push(bytes.slice());
    return viceControlSuccess(true);
  }

  async read(signal?: AbortSignal): Promise<ViceControlResultV1<Uint8Array | null>> {
    this.readCalls += 1;
    const queued = this.#queued.shift();
    if (queued !== undefined) return queued;
    if (signal?.aborted) {
      return viceControlFailure("vice.cancelled", "vice.cancelled", "cancelled");
    }
    return new Promise((resolve) => this.#readers.push(resolve));
  }

  async close(): Promise<ViceControlResultV1<true>> {
    for (const resolve of this.#readers.splice(0)) resolve(viceControlSuccess(null));
    return viceControlSuccess(true);
  }

  pushText(text: string): void {
    this.pushBytes(new TextEncoder().encode(text));
  }

  pushBytes(bytes: Uint8Array): void {
    const result = viceControlSuccess<Uint8Array | null>(bytes.slice());
    const reader = this.#readers.shift();
    if (reader === undefined) this.#queued.push(result);
    else reader(result);
  }

  pushEnd(): void {
    const result = viceControlSuccess<Uint8Array | null>(null);
    const reader = this.#readers.shift();
    if (reader === undefined) this.#queued.push(result);
    else reader(result);
  }
}

class DeferredWriteChannel extends QueuedRawChannel {
  readonly #writers: Array<(result: ViceControlResultV1<true>) => void> = [];

  get pendingWrites(): number {
    return this.#writers.length;
  }

  override async write(bytes: Uint8Array): Promise<ViceControlResultV1<true>> {
    this.writes.push(bytes.slice());
    return new Promise((resolve) => this.#writers.push(resolve));
  }

  settleNextWrite(result: ViceControlResultV1<true> = viceControlSuccess(true)): void {
    const writer = this.#writers.shift();
    if (writer === undefined) throw new Error("No deferred VICE write is pending.");
    writer(result);
  }
}

function responseFrame(requestId: number, body: Uint8Array): Uint8Array {
  const frame = new Uint8Array(12 + body.byteLength);
  const view = new DataView(frame.buffer);
  frame.set([2, 2], 0);
  view.setUint32(2, body.byteLength, true);
  frame[6] = 0x01;
  view.setUint32(8, requestId, true);
  frame.set(body, 12);
  return frame;
}

function sessionHost(): ViceControlHostV1 {
  return {
    nowMilliseconds: () => 0,
    delay: async (_milliseconds, signal) =>
      new Promise((resolve) => {
        if (signal.aborted) resolve("aborted");
        else signal.addEventListener("abort", () => resolve("aborted"), { once: true });
      }),
    spawn: async () => viceControlFailure("vice.io", "vice.spawn", "unused"),
    connectLoopback: async () => viceControlFailure("vice.io", "vice.connect", "unused"),
    endpointBelongsToChild: async () => viceControlSuccess(false),
    closeOwnedChild: async () => viceControlSuccess(true),
  };
}

describe("VICE control codec implementation", () => {
  it.each([0, -1, 1.25, 65_536, Number.NaN])("rejects a non-wire instruction count %s", (count) => {
    expect(() => viceAdvanceInstructionsBodyV1(count)).toThrow(RangeError);
  });

  it("encodes the C64 resource probe as an exact length-prefixed name", () => {
    expect([...viceC64ResourceBodyV1()]).toEqual([10, ...new TextEncoder().encode("VICIIModel")]);
  });

  it.each([
    [Uint8Array.of(1, 1, 7), 7],
    [Uint8Array.of(1, 4, 1, 0, 0, 0), 1],
    [Uint8Array.of(1, 2, 49, 50), 12],
  ] as const)("parses integer resource wire form %#", (body, expected) => {
    expect(parseViceC64ResourceV1(body)).toBe(expected);
  });

  it("fails closed instead of scanning past a malformed response prefix", () => {
    expect(() => decodeViceControlFramesV1(Uint8Array.of(0, 2, ...new Uint8Array(10)))).toThrow(
      TypeError,
    );
  });

  it("retains a fragmented response until the complete body arrives", () => {
    const partial = Uint8Array.of(2, 2, 1, 0, 0, 0, 0x85, 0, 1, 0, 0, 0);
    const first = decodeViceControlFramesV1(partial);
    expect(first.frames).toHaveLength(0);
    expect(first.remainder).toEqual(partial);
    const completed = new Uint8Array([...first.remainder, 3]);
    expect(decodeViceControlFramesV1(completed).frames).toHaveLength(1);
  });

  it("assembles adversarial byte-at-a-time fragments with one bounded frame allocation", () => {
    const body = Uint8Array.from({ length: 4_096 }, (_, index) => index & 0xff);
    const frame = new Uint8Array(12 + body.byteLength);
    frame.set([2, 2, body.byteLength & 0xff, (body.byteLength >>> 8) & 0xff], 0);
    frame[6] = 0x85;
    frame[8] = 7;
    frame.set(body, 12);
    const accumulator = new ViceControlFrameAccumulatorV1();
    const completed = [];
    for (const byte of frame) completed.push(...accumulator.push(Uint8Array.of(byte)));
    expect(completed).toHaveLength(1);
    expect(completed[0].requestId).toBe(7);
    expect(completed[0].body).toEqual(body);
    expect(accumulator.partialBytes).toBe(0);
  });

  it("cancels one socket reader without abandoning or desynchronizing later readers", async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("server address missing");
    const accepted = new Promise<net.Socket>((resolve) => server.once("connection", resolve));
    const connected = await new NodeViceControlHost().connectLoopback(
      "text",
      address.port,
      new AbortController().signal,
    );
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;
    const peer = await accepted;
    const cancelled = new AbortController();
    const first = connected.value.read(cancelled.signal);
    const second = connected.value.read();
    cancelled.abort();
    peer.write(Buffer.from([0x41]));
    expect(await first).toMatchObject({ ok: false, issue: { reason: "vice.cancelled" } });
    expect(await second).toEqual(viceControlSuccess(Uint8Array.of(0x41)));
    const closingReaders = [connected.value.read(), connected.value.read()];
    await connected.value.close();
    expect(await Promise.all(closingReaders)).toEqual([
      viceControlSuccess(null),
      viceControlSuccess(null),
    ]);
    peer.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("reports a terminal cleanup issue when an invalid child cannot be closed", async () => {
    const host: ViceControlHostV1 = {
      nowMilliseconds: () => 0,
      delay: async () => "elapsed",
      spawn: async () => viceControlSuccess({ identity: "", exited: new Promise(() => undefined) }),
      connectLoopback: async () =>
        viceControlFailure("vice.io", "vice.connect", "unexpected connect"),
      endpointBelongsToChild: async () => viceControlSuccess(false),
      closeOwnedChild: async () =>
        viceControlFailure("vice.io", "vice.transport", "cleanup failed"),
    };

    const result = await createViceControlRuntimeV1(host).launch(
      launchRequest(),
      new AbortController().signal,
    );

    expect(result).toEqual({
      ok: false,
      issue: {
        code: "vice.closed",
        reason: "vice.closed",
        message: "VICE owned-child cleanup could not be proven.",
      },
    });
  });

  it("settles a never-reply handshake on caller abort and still cleans the owned child", async () => {
    let closeCalls = 0;
    const channel: ViceControlRawChannelV1 = {
      write: async () => viceControlSuccess(true),
      read: async () => new Promise(() => undefined),
      close: async () => viceControlSuccess(true),
    };
    const host: ViceControlHostV1 = {
      nowMilliseconds: () => 0,
      delay: async (_milliseconds, signal) => (signal.aborted ? "aborted" : "elapsed"),
      spawn: async () =>
        viceControlSuccess({ identity: "child", exited: new Promise(() => undefined) }),
      connectLoopback: async () => viceControlSuccess(channel),
      endpointBelongsToChild: async () => viceControlSuccess(true),
      closeOwnedChild: async () => {
        closeCalls += 1;
        return viceControlSuccess(true);
      },
    };
    const controller = new AbortController();
    const launched = createViceControlRuntimeV1(host).launch(launchRequest(), controller.signal);
    await Promise.resolve();
    controller.abort();
    expect(await launched).toMatchObject({
      ok: false,
      issue: { code: "vice.cancelled", reason: "vice.cancelled" },
    });
    expect(closeCalls).toBe(1);
  });

  it("attempts child cleanup even when both raw channel closes throw", async () => {
    let childCloseCalls = 0;
    const channel: ViceControlRawChannelV1 = {
      write: async () => viceControlSuccess(true),
      read: async () => viceControlSuccess(null),
      close: async () => {
        throw new Error("close failed");
      },
    };
    const host: ViceControlHostV1 = {
      nowMilliseconds: () => 0,
      delay: async () => "elapsed",
      spawn: async () => viceControlFailure("vice.io", "vice.spawn", "unused"),
      connectLoopback: async () => viceControlFailure("vice.io", "vice.connect", "unused"),
      endpointBelongsToChild: async () => viceControlSuccess(false),
      closeOwnedChild: async () => {
        childCloseCalls += 1;
        return viceControlSuccess(true);
      },
    };

    const result = await closeViceControlResourcesV1(
      channel,
      channel,
      { identity: "owned", exited: new Promise(() => undefined) },
      host,
    );

    expect(result.ok).toBe(false);
    expect(childCloseCalls).toBe(1);
  });

  it("cancels an in-flight stopwatch exchange and drains its late reply before reuse", async () => {
    const binary = new QueuedRawChannel();
    const text = new QueuedRawChannel();
    const session = new ViceControlSession(
      binary,
      text,
      { identity: "child", exited: new Promise(() => undefined) },
      sessionHost(),
    );
    const first = session.readStopwatch();
    for (let turn = 0; turn < 10 && text.pendingReads === 0; turn += 1) await Promise.resolve();
    expect(text.pendingReads).toBe(1);
    expect(await session.cancelPending()).toEqual(viceControlSuccess(true));
    expect(await first).toMatchObject({
      ok: false,
      issue: { code: "vice.cancelled", reason: "vice.cancelled" },
    });

    const second = session.readStopwatch();
    await Promise.resolve();
    expect(text.writes).toHaveLength(1);
    text.pushText("Stopwatch: 11\r\n(C:$0000) ");
    for (let turn = 0; turn < 10 && text.writes.length < 2; turn += 1) await Promise.resolve();
    expect(text.writes).toHaveLength(2);
    text.pushText("Stopwatch: 22\r\n(C:$0000) ");
    expect(await second).toEqual(viceControlSuccess(22n));
    await session.close();
  });

  it("cancels a never-settling binary write and discards its late reply before reuse", async () => {
    const binary = new DeferredWriteChannel();
    const session = new ViceControlSession(
      binary,
      new QueuedRawChannel(),
      { identity: "child", exited: new Promise(() => undefined) },
      sessionHost(),
    );
    const first = session.readMemory(0x0200, 1);
    for (let turn = 0; turn < 10 && binary.pendingWrites === 0; turn += 1) {
      await Promise.resolve();
    }
    expect(binary.pendingWrites).toBe(1);
    expect(await session.cancelPending()).toEqual(viceControlSuccess(true));
    expect(await first).toMatchObject({
      ok: false,
      issue: { code: "vice.cancelled", reason: "vice.cancelled" },
    });

    const second = session.readMemory(0x0201, 1);
    for (let turn = 0; turn < 10 && binary.pendingWrites < 2; turn += 1) {
      await Promise.resolve();
    }
    expect(binary.pendingWrites).toBe(2);
    binary.settleNextWrite();
    binary.settleNextWrite();
    await Promise.resolve();
    binary.pushBytes(responseFrame(1, Uint8Array.of(1, 0, 0xaa)));
    binary.pushBytes(responseFrame(2, Uint8Array.of(1, 0, 0xbb)));
    expect(await second).toEqual(viceControlSuccess(Uint8Array.of(0xbb)));
    await session.close();
  });

  it("terminalizes a cancelled known-sent request when EOF arrives before its late reply", async () => {
    const binary = new QueuedRawChannel();
    const text = new QueuedRawChannel();
    const session = new ViceControlSession(
      binary,
      text,
      { identity: "child", exited: new Promise(() => undefined) },
      sessionHost(),
    );
    const request = session.readMemory(0x0200, 1);
    for (let turn = 0; turn < 10 && binary.pendingReads === 0; turn += 1) {
      await Promise.resolve();
    }
    expect(binary.writes).toHaveLength(1);
    expect(binary.readCalls).toBe(1);
    expect(await session.cancelPending()).toEqual(viceControlSuccess(true));
    expect(await request).toMatchObject({
      ok: false,
      issue: { code: "vice.cancelled", reason: "vice.cancelled" },
    });

    binary.pushEnd();
    for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
    expect(binary.pendingReads).toBe(0);
    expect(binary.readCalls).toBe(1);
    const firstFailure = await session.readMemory(0x0201, 1);
    const secondFailure = await session.readMemory(0x0202, 1);
    expect(firstFailure).toEqual({
      ok: false,
      issue: {
        code: "vice.io",
        reason: "vice.transport",
        message: "VICE binary monitor closed before completing pending work.",
      },
    });
    expect(secondFailure).toEqual(firstFailure);
    expect(await session.readStopwatch()).toEqual(firstFailure);
    expect(binary.writes).toHaveLength(1);
    expect(binary.readCalls).toBe(1);
    expect(text.writes).toHaveLength(0);
    expect(await session.close()).toEqual(viceControlSuccess(true));
    expect(await session.close()).toEqual(viceControlSuccess(true));
  });

  it("does not restart the pump when a late abandoned write settles after permanent abort", async () => {
    const binary = new DeferredWriteChannel();
    const controller = new AbortController();
    const session = new ViceControlSession(
      binary,
      new QueuedRawChannel(),
      { identity: "child", exited: new Promise(() => undefined) },
      sessionHost(),
      controller.signal,
    );
    const request = session.readMemory(0x0200, 1);
    for (let turn = 0; turn < 10 && binary.pendingWrites === 0; turn += 1) {
      await Promise.resolve();
    }
    expect(binary.pendingWrites).toBe(1);
    controller.abort();
    const cancelled = await request;
    expect(cancelled).toMatchObject({
      ok: false,
      issue: { code: "vice.cancelled", reason: "vice.cancelled" },
    });

    binary.settleNextWrite();
    for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
    expect(binary.pendingReads).toBe(0);
    expect(binary.readCalls).toBe(0);
    expect(await session.readMemory(0x0201, 1)).toEqual(cancelled);
    expect(await session.readMemory(0x0202, 1)).toEqual(cancelled);
    expect(binary.writes).toHaveLength(1);
    expect(binary.readCalls).toBe(0);
    expect(await session.close()).toEqual(viceControlSuccess(true));
    expect(await session.close()).toEqual(viceControlSuccess(true));
  });

  it("cancels a never-settling text write and drains a late successful command before reuse", async () => {
    const text = new DeferredWriteChannel();
    const session = new ViceControlSession(
      new QueuedRawChannel(),
      text,
      { identity: "child", exited: new Promise(() => undefined) },
      sessionHost(),
    );
    const first = session.readStopwatch();
    for (let turn = 0; turn < 10 && text.pendingWrites === 0; turn += 1) {
      await Promise.resolve();
    }
    expect(text.pendingWrites).toBe(1);
    expect(await session.cancelPending()).toEqual(viceControlSuccess(true));
    expect(await first).toMatchObject({
      ok: false,
      issue: { code: "vice.cancelled", reason: "vice.cancelled" },
    });

    const second = session.readStopwatch();
    text.settleNextWrite();
    for (let turn = 0; turn < 10 && text.pendingReads === 0; turn += 1) {
      await Promise.resolve();
    }
    expect(text.pendingReads).toBe(1);
    text.pushText("Stopwatch: 11\r\n(C:$0000) ");
    for (let turn = 0; turn < 10 && text.pendingWrites === 0; turn += 1) {
      await Promise.resolve();
    }
    expect(text.pendingWrites).toBe(1);
    text.settleNextWrite();
    for (let turn = 0; turn < 10 && text.pendingReads === 0; turn += 1) {
      await Promise.resolve();
    }
    text.pushText("Stopwatch: 22\r\n(C:$0000) ");
    expect(await second).toEqual(viceControlSuccess(22n));
    await session.close();
  });

  it("preserves an empty legacy register write as a wire-free no-op", async () => {
    const binary = new QueuedRawChannel();
    const session = new ViceControlSession(
      binary,
      new QueuedRawChannel(),
      { identity: "child", exited: new Promise(() => undefined) },
      sessionHost(),
    );
    expect(await session.writeLegacyRegisters(new Map())).toEqual(viceControlSuccess(true));
    expect(binary.writes).toEqual([]);
    await session.close();
  });

  it("retains an opaque default-host child capability through observed exit until close", async () => {
    const host = new NodeViceControlHost();
    const spawned = await host.spawn(
      { executable: process.execPath, argv: ["-e", "process.exit(0)"], cwd: process.cwd() },
      new AbortController().signal,
    );
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    expect(spawned.value.identity).toMatch(/^node-child-\d+$/);
    await spawned.value.exited;
    expect(await host.endpointBelongsToChild(spawned.value, "binary", 6502)).toEqual(
      viceControlSuccess(false),
    );
    expect(await host.closeOwnedChild(spawned.value)).toEqual(viceControlSuccess(true));
    expect(await host.closeOwnedChild(spawned.value)).toEqual(viceControlSuccess(true));
  });
});
