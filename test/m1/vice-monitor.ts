import { readdir, readFile, readlink } from "node:fs/promises";
import net from "node:net";

const COMMAND_HEADER_BYTES = 11;
const RESPONSE_HEADER_BYTES = 12;
const MAX_RESPONSE_BODY_BYTES = 1_048_576;
const REQUEST_TIMEOUT_MS = 15_000;

interface MonitorResponse {
  readonly type: number;
  readonly requestId: number;
  readonly body: Uint8Array;
}

interface PendingRequest {
  readonly expectedType: number;
  readonly resolve: (response: MonitorResponse) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
}

/** Validated indexed VIC-II display returned by VICE. */
export interface ViceDisplay {
  /** Complete validated response body, including dimensions and offsets. */
  readonly evidence: Uint8Array;
  /** Uncropped display width. */
  readonly width: number;
  /** Uncropped display height. */
  readonly height: number;
  /** Inner-screen horizontal offset. */
  readonly xOffset: number;
  /** Inner-screen vertical offset. */
  readonly yOffset: number;
  /** Inner-screen width. */
  readonly innerWidth: number;
  /** Inner-screen height. */
  readonly innerHeight: number;
}

/** The small binary-monitor surface used by the M1 qualification driver. */
export interface ViceMonitor {
  /** Return the exact VICE version components reported by the monitor. */
  readonly viceInfo: () => Promise<readonly number[]>;
  /** Add one enabled execute checkpoint and return its monitor identity. */
  readonly setExecuteCheckpoint: (address: number) => Promise<number>;
  /** Delete one checkpoint created by this client. */
  readonly deleteCheckpoint: (checkpoint: number) => Promise<void>;
  /** Read one inclusive main-memory range without side effects. */
  readonly readMemory: (start: number, end: number) => Promise<Uint8Array>;
  /** Read one inclusive C64 I/O-bank range without side effects. */
  readonly readIo: (start: number, end: number) => Promise<Uint8Array>;
  /** Capture one validated indexed VIC-II display. */
  readonly readDisplay: () => Promise<ViceDisplay>;
  /** Set the active-low value supplied to emulated joystick port 2. */
  readonly setJoystick2: (value: number) => Promise<void>;
  /** Arm one wait for the next stopped event before resuming. */
  readonly waitForStop: (timeoutMs?: number) => Promise<number>;
  /** Resume execution until a checkpoint stops the machine. */
  readonly resume: () => Promise<void>;
  /** Ask VICE to terminate, then close the monitor socket. */
  readonly quit: () => Promise<void>;
  /** Close the client socket without sending another command. */
  readonly close: () => void;
}

/** Decode one little-endian unsigned 16-bit field. */
function uint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

/** Decode one little-endian unsigned 32-bit field. */
function uint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

/** Append one process and its Linux descendants to a stable identity set. */
async function collectProcessTree(processId: number, result: Set<number>): Promise<void> {
  if (result.has(processId)) return;
  result.add(processId);
  try {
    const text = await readFile(`/proc/${processId}/task/${processId}/children`, "utf8");
    for (const token of text.trim().split(/\s+/u)) {
      if (token === "") continue;
      const child = Number.parseInt(token, 10);
      if (Number.isInteger(child) && child > 0) await collectProcessTree(child, result);
    }
  } catch {
    // A process which exited during attestation simply owns no usable socket.
  }
}

/** Return every socket inode held by the still-owned Linux process tree. */
async function ownedSocketInodes(processId: number): Promise<ReadonlySet<string>> {
  const processes = new Set<number>();
  await collectProcessTree(processId, processes);
  const sockets = new Set<string>();
  for (const pid of processes) {
    try {
      for (const descriptor of await readdir(`/proc/${pid}/fd`)) {
        try {
          const target = await readlink(`/proc/${pid}/fd/${descriptor}`);
          const match = /^socket:\[(\d+)\]$/u.exec(target);
          if (match !== null) sockets.add(match[1]!);
        } catch {
          // Descriptor churn cannot create positive ownership evidence.
        }
      }
    } catch {
      // A process which exited during attestation simply contributes no descriptors.
    }
  }
  return sockets;
}

interface TcpSocketRecord {
  readonly local: string;
  readonly remote: string;
  readonly state: string;
  readonly inode: string;
}

/** Parse the kernel's IPv4 TCP table without accepting malformed rows. */
async function tcpSocketRecords(): Promise<readonly TcpSocketRecord[]> {
  const rows = (await readFile("/proc/net/tcp", "utf8")).trim().split("\n").slice(1);
  return rows.flatMap((row) => {
    const fields = row.trim().split(/\s+/u);
    if (fields.length < 10) return [];
    const [local, remote, state] = fields.slice(1, 4);
    const inode = fields[9];
    if (
      local === undefined ||
      remote === undefined ||
      state === undefined ||
      inode === undefined ||
      !/^[0-9A-F]{8}:[0-9A-F]{4}$/iu.test(local) ||
      !/^[0-9A-F]{8}:[0-9A-F]{4}$/iu.test(remote) ||
      !/^[0-9A-F]{2}$/iu.test(state) ||
      !/^\d+$/u.test(inode)
    ) {
      return [];
    }
    return [{ local: local.toUpperCase(), remote: remote.toUpperCase(), state, inode }];
  });
}

/** Prove both the listener and this connected peer belong to the spawned VICE tree. */
async function attestSocketOwnership(
  processId: number,
  monitorPort: number,
  clientPort: number,
): Promise<void> {
  const monitor = monitorPort.toString(16).padStart(4, "0").toUpperCase();
  const client = clientPort.toString(16).padStart(4, "0").toUpperCase();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const owned = await ownedSocketInodes(processId);
    const sockets = await tcpSocketRecords();
    const listener = sockets.some(
      ({ local, state, inode }) =>
        local === `0100007F:${monitor}` && state === "0A" && owned.has(inode),
    );
    const peer = sockets.some(
      ({ local, remote, state, inode }) =>
        local === `0100007F:${monitor}` &&
        remote === `0100007F:${client}` &&
        state === "01" &&
        owned.has(inode),
    );
    if (listener && peer) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(
    "The VICE monitor listener or connected peer is not owned by the spawned process",
  );
}

/** Connect to a fresh loopback monitor endpoint with one bounded retry window. */
async function connectLoopback(port: number): Promise<net.Socket> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const socket = await new Promise<net.Socket | null>((resolve) => {
      const candidate = net.connect({ host: "127.0.0.1", port });
      candidate.once("connect", () => resolve(candidate));
      candidate.once("error", () => {
        candidate.destroy();
        resolve(null);
      });
    });
    if (socket !== null) return socket;
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("VICE did not open its binary monitor within the bounded startup window");
}

/** Encode one API-v2 binary-monitor command. */
function encodeCommand(type: number, requestId: number, body: Uint8Array): Uint8Array {
  const frame = new Uint8Array(COMMAND_HEADER_BYTES + body.length);
  const view = new DataView(frame.buffer);
  frame[0] = 0x02;
  frame[1] = 0x02;
  view.setUint32(2, body.length, true);
  view.setUint32(6, requestId, true);
  frame[10] = type;
  frame.set(body, COMMAND_HEADER_BYTES);
  return frame;
}

/**
 * Open the one binary-monitor connection used by M1 qualification.
 * The Linux socket attestation is completed before any monitor command is sent.
 */
export async function openViceMonitor(port: number, processId: number): Promise<ViceMonitor> {
  const socket = await connectLoopback(port);
  if (socket.remoteAddress !== "127.0.0.1" || socket.remotePort !== port) {
    socket.destroy();
    throw new Error("VICE monitor connected to an unexpected peer");
  }
  const clientPort = socket.localPort;
  if (clientPort === undefined) {
    socket.destroy();
    throw new Error("VICE monitor connection has no local port identity");
  }
  await attestSocketOwnership(processId, port, clientPort);

  let nextRequestId = 1;
  let accumulator = new Uint8Array(0);
  let terminalError: Error | null = null;
  let stopWaiter:
    | {
        readonly resolve: (programCounter: number) => void;
        readonly reject: (error: Error) => void;
        readonly timer: NodeJS.Timeout;
      }
    | undefined;
  const pending = new Map<number, PendingRequest>();

  const fail = (error: Error): void => {
    if (terminalError !== null) return;
    terminalError = error;
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
    if (stopWaiter !== undefined) {
      clearTimeout(stopWaiter.timer);
      stopWaiter.reject(error);
      stopWaiter = undefined;
    }
  };

  socket.on("error", (error) => fail(error));
  socket.on("close", () => fail(new Error("VICE monitor connection closed unexpectedly")));
  socket.on("data", (chunk: Buffer) => {
    const merged = new Uint8Array(accumulator.length + chunk.length);
    merged.set(accumulator);
    merged.set(chunk, accumulator.length);
    let offset = 0;
    while (merged.length - offset >= RESPONSE_HEADER_BYTES) {
      if (merged[offset] !== 0x02 || merged[offset + 1] !== 0x02) {
        fail(new Error("VICE monitor returned an invalid frame header"));
        socket.destroy();
        return;
      }
      const bodyLength = uint32(merged, offset + 2);
      if (bodyLength > MAX_RESPONSE_BODY_BYTES) {
        fail(new Error("VICE monitor response exceeded the bounded body size"));
        socket.destroy();
        return;
      }
      const frameLength = RESPONSE_HEADER_BYTES + bodyLength;
      if (merged.length - offset < frameLength) break;
      const response: MonitorResponse = Object.freeze({
        type: merged[offset + 6]!,
        requestId: uint32(merged, offset + 8),
        body: merged.slice(offset + RESPONSE_HEADER_BYTES, offset + frameLength),
      });
      const errorCode = merged[offset + 7]!;
      offset += frameLength;
      if (errorCode !== 0) {
        fail(
          new Error(`VICE monitor response 0x${response.type.toString(16)} failed (${errorCode})`),
        );
        socket.destroy();
        return;
      }
      if (response.requestId === 0xffffffff) {
        if (response.type === 0x62 && response.body.length === 2 && stopWaiter !== undefined) {
          const waiter = stopWaiter;
          stopWaiter = undefined;
          clearTimeout(waiter.timer);
          waiter.resolve(uint16(response.body, 0));
        }
        continue;
      }
      const request = pending.get(response.requestId);
      if (request === undefined) {
        fail(new Error(`VICE monitor returned unknown request ${response.requestId}`));
        socket.destroy();
        return;
      }
      pending.delete(response.requestId);
      clearTimeout(request.timer);
      if (response.type !== request.expectedType) {
        request.reject(
          new Error(
            `VICE monitor request ${response.requestId} returned type 0x${response.type.toString(16)}`,
          ),
        );
      } else {
        request.resolve(response);
      }
    }
    accumulator = merged.slice(offset);
  });

  const request = (
    type: number,
    body: Uint8Array,
    expectedType = type,
  ): Promise<MonitorResponse> => {
    if (terminalError !== null) return Promise.reject(terminalError);
    const requestId = nextRequestId;
    nextRequestId += 1;
    return new Promise<MonitorResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending.delete(requestId)) {
          reject(new Error(`VICE monitor request 0x${type.toString(16)} timed out`));
        }
      }, REQUEST_TIMEOUT_MS);
      pending.set(requestId, { expectedType, resolve, reject, timer });
      socket.write(Buffer.from(encodeCommand(type, requestId, body)), (error) => {
        if (error === null || error === undefined) return;
        const active = pending.get(requestId);
        if (active === undefined) return;
        pending.delete(requestId);
        clearTimeout(active.timer);
        reject(error);
      });
    });
  };

  /** Read one validated range from a pinned VICE C64 monitor bank. */
  const readRange = async (start: number, end: number, bankId: 0 | 3): Promise<Uint8Array> => {
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start ||
      end > 0xffff ||
      end - start + 1 > 0xffff
    ) {
      throw new RangeError("VICE memory range is invalid");
    }
    const body = new Uint8Array(8);
    const view = new DataView(body.buffer);
    body[0] = 0;
    view.setUint16(1, start, true);
    view.setUint16(3, end, true);
    body[5] = 0;
    view.setUint16(6, bankId, true);
    const response = await request(0x01, body);
    const expected = end - start + 1;
    if (response.body.length !== expected + 2 || uint16(response.body, 0) !== expected) {
      throw new Error("VICE memory response length does not match the requested range");
    }
    return response.body.slice(2);
  };

  return Object.freeze({
    viceInfo: async () => {
      const { body } = await request(0x85, new Uint8Array(0));
      if (body.length < 2) throw new Error("VICE info response is truncated");
      const length = body[0]!;
      if (length === 0 || 1 + length >= body.length) {
        throw new Error("VICE info version field is invalid");
      }
      return Object.freeze([...body.slice(1, 1 + length)]);
    },
    setExecuteCheckpoint: async (address) => {
      if (!Number.isInteger(address) || address < 0 || address > 0xffff) {
        throw new RangeError("VICE checkpoint address must be a 16-bit integer");
      }
      const body = new Uint8Array(8);
      const view = new DataView(body.buffer);
      view.setUint16(0, address, true);
      view.setUint16(2, address, true);
      body[4] = 1;
      body[5] = 1;
      body[6] = 4;
      body[7] = 0;
      const response = await request(0x12, body, 0x11);
      if (response.body.length < 23) throw new Error("VICE checkpoint response is truncated");
      return uint32(response.body, 0);
    },
    deleteCheckpoint: async (checkpoint) => {
      if (!Number.isInteger(checkpoint) || checkpoint < 0 || checkpoint > 0xffffffff) {
        throw new RangeError("VICE checkpoint identity is invalid");
      }
      const body = new Uint8Array(4);
      new DataView(body.buffer).setUint32(0, checkpoint, true);
      const response = await request(0x13, body);
      if (response.body.length !== 0) throw new Error("VICE checkpoint deletion returned data");
    },
    readMemory: async (start, end) => readRange(start, end, 0),
    readIo: async (start, end) => readRange(start, end, 3),
    readDisplay: async () => {
      const response = await request(0x84, new Uint8Array([1, 0]));
      const body = response.body;
      if (body.length < 21 || uint32(body, 0) !== 13) {
        throw new Error(
          `VICE display response field layout is invalid: body=${body.length}, fields=${uint32(body, 0)}`,
        );
      }
      const width = uint16(body, 4);
      const height = uint16(body, 6);
      const xOffset = uint16(body, 8);
      const yOffset = uint16(body, 10);
      const innerWidth = uint16(body, 12);
      const innerHeight = uint16(body, 14);
      const bitsPerPixel = body[16]!;
      const bufferLength = uint32(body, 17);
      // VICE 3.10 counts the four-byte buffer-length prefix inside this field.
      if (
        width === 0 ||
        height === 0 ||
        innerWidth === 0 ||
        innerHeight === 0 ||
        xOffset + innerWidth > width ||
        yOffset + innerHeight > height ||
        bitsPerPixel !== 8 ||
        bufferLength !== width * height ||
        body.length !== 17 + bufferLength
      ) {
        throw new Error(
          `VICE display dimensions or indexed buffer are invalid: ${width}x${height}, inner=${innerWidth}x${innerHeight}@${xOffset},${yOffset}, bpp=${bitsPerPixel}, buffer=${bufferLength}, body=${body.length}`,
        );
      }
      return Object.freeze({
        evidence: body,
        width,
        height,
        xOffset,
        yOffset,
        innerWidth,
        innerHeight,
      });
    },
    setJoystick2: async (value) => {
      if (!Number.isInteger(value) || value < 0 || value > 0x1f) {
        throw new RangeError("Joystick value must contain only the five active-low input bits");
      }
      const body = new Uint8Array(4);
      const view = new DataView(body.buffer);
      view.setUint16(0, 1, true);
      view.setUint16(2, value, true);
      const response = await request(0xa2, body);
      if (response.body.length !== 0) throw new Error("VICE joyport command returned data");
    },
    waitForStop: (timeoutMs = 45_000) => {
      if (stopWaiter !== undefined)
        return Promise.reject(new Error("A VICE stop wait is already armed"));
      return new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (stopWaiter?.timer !== timer) return;
          stopWaiter = undefined;
          reject(new Error("VICE did not reach the expected checkpoint"));
        }, timeoutMs);
        stopWaiter = { resolve, reject, timer };
      });
    },
    resume: async () => {
      const response = await request(0xaa, new Uint8Array(0));
      if (response.body.length !== 0) throw new Error("VICE resume command returned data");
    },
    quit: async () => {
      if (!socket.destroyed) {
        const requestId = nextRequestId;
        nextRequestId += 1;
        await new Promise<void>((resolve, reject) => {
          socket.write(Buffer.from(encodeCommand(0xbb, requestId, new Uint8Array(0))), (error) =>
            error === null || error === undefined ? resolve() : reject(error),
          );
        });
        socket.end();
      }
    },
    close: () => socket.destroy(),
  });
}
