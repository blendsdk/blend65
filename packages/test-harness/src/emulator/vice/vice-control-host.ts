import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { performance } from "node:perf_hooks";

import {
  viceControlFailure,
  viceControlSuccess,
  type ViceControlHostV1,
  type ViceControlLaunchV1,
  type ViceControlOwnedChildV1,
  type ViceControlRawChannelV1,
  type ViceControlResultV1,
} from "./vice-control-types.js";

/** Grace period before an unresponsive owned child receives a forced termination. */
const CHILD_CLOSE_GRACE_MS = 2_000;

/** One queued socket read result or one waiter awaiting the next fragment. */
interface ChannelReadQueue {
  readonly queued: Array<ViceControlResultV1<Uint8Array | null>>;
  readonly readers: Array<{
    readonly resolve: (result: ViceControlResultV1<Uint8Array | null>) => void;
    readonly signal: AbortSignal | undefined;
    readonly onAbort: (() => void) | undefined;
  }>;
}

/** Raw loopback socket adapter that snapshots every byte boundary. */
class NodeViceRawChannel implements ViceControlRawChannelV1 {
  readonly #socket: net.Socket;
  readonly #reads: ChannelReadQueue = { queued: [], readers: [] };
  #closed = false;
  #terminal: ViceControlResultV1<Uint8Array | null> | undefined;

  /** Wraps one already-connected loopback socket. */
  constructor(socket: net.Socket) {
    this.#socket = socket;
    socket.on("data", (chunk: Buffer) => this.#deliver(viceControlSuccess(Uint8Array.from(chunk))));
    socket.once("close", () => {
      this.#closed = true;
      this.#finish(viceControlSuccess(null));
    });
    socket.once("error", () => {
      this.#finish(viceControlFailure("vice.io", "vice.transport", "VICE socket failed."));
    });
  }

  /** Writes an immutable snapshot without shell or text conversion. */
  async write(bytes: Uint8Array): Promise<ViceControlResultV1<true>> {
    if (this.#closed) {
      return viceControlFailure("vice.closed", "vice.closed", "VICE channel is closed.");
    }
    const snapshot = Buffer.from(bytes.slice());
    return new Promise((resolve) => {
      this.#socket.write(snapshot, (error) => {
        resolve(
          error instanceof Error
            ? viceControlFailure("vice.io", "vice.transport", "VICE socket write failed.")
            : viceControlSuccess(true),
        );
      });
    });
  }

  /** Reads exactly one fresh socket fragment or end-of-stream marker. */
  async read(signal?: AbortSignal): Promise<ViceControlResultV1<Uint8Array | null>> {
    const queued = this.#reads.queued.shift();
    if (queued !== undefined) return queued;
    if (this.#terminal !== undefined) return this.#terminal;
    if (signal?.aborted) {
      return viceControlFailure("vice.cancelled", "vice.cancelled", "VICE read was cancelled.");
    }
    return new Promise((resolve) => {
      const reader = {
        resolve,
        signal,
        onAbort: signal === undefined ? undefined : (): void => this.#abortReader(reader),
      };
      this.#reads.readers.push(reader);
      signal?.addEventListener("abort", reader.onAbort!, { once: true });
    });
  }

  /** Idempotently destroys the socket and settles all blocked readers. */
  async close(): Promise<ViceControlResultV1<true>> {
    if (!this.#closed) {
      this.#closed = true;
      this.#socket.destroy();
      this.#finish(viceControlSuccess(null));
    }
    return viceControlSuccess(true);
  }

  /** Delivers a fragment to the oldest waiter before queueing it. */
  #deliver(result: ViceControlResultV1<Uint8Array | null>): void {
    const reader = this.#reads.readers.shift();
    if (reader === undefined) this.#reads.queued.push(result);
    else {
      if (reader.onAbort !== undefined) {
        reader.signal?.removeEventListener("abort", reader.onAbort);
      }
      reader.resolve(result);
    }
  }

  /** Settles every reader with one permanent terminal state. */
  #finish(result: ViceControlResultV1<Uint8Array | null>): void {
    if (this.#terminal !== undefined) return;
    this.#terminal = result;
    this.#reads.queued.length = 0;
    for (const reader of this.#reads.readers.splice(0)) {
      if (reader.onAbort !== undefined) {
        reader.signal?.removeEventListener("abort", reader.onAbort);
      }
      reader.resolve(result);
    }
  }

  /** Removes and cancels exactly one queued read without disturbing later reads. */
  #abortReader(reader: ChannelReadQueue["readers"][number]): void {
    const index = this.#reads.readers.indexOf(reader);
    if (index < 0) return;
    this.#reads.readers.splice(index, 1);
    reader.resolve(
      viceControlFailure("vice.cancelled", "vice.cancelled", "VICE read was cancelled."),
    );
  }
}

/** Child identity wrapper kept opaque to protocol code. */
class NodeViceOwnedChild implements ViceControlOwnedChildV1 {
  /** Stable PID/start-time identity. */
  readonly identity: string;
  /** Resolves exactly once when Node observes child exit. */
  readonly exited: Promise<{ readonly code: number | null; readonly signal: string | null }>;

  /** Creates an opaque wrapper for one Node child. */
  constructor(identity: string, child: ChildProcess) {
    this.identity = identity;
    this.exited = new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve({ code: child.exitCode, signal: child.signalCode });
      } else {
        child.once("exit", (code, signal) => resolve({ code, signal }));
      }
    });
  }
}

/** Waits for a process exit with a bounded timeout. */
async function waitForExit(child: ChildProcess, milliseconds: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (exited: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      resolve(exited);
    };
    const onExit = (): void => finish(true);
    const timer = setTimeout(() => finish(false), milliseconds);
    child.once("exit", onExit);
    if (child.exitCode !== null || child.signalCode !== null) finish(true);
  });
}

/** Production raw host using direct Node child and loopback socket primitives. */
export class NodeViceControlHost implements ViceControlHostV1 {
  readonly #children = new WeakMap<ViceControlOwnedChildV1, ChildProcess>();
  readonly #closedChildren = new WeakSet<ViceControlOwnedChildV1>();
  #nextChildIdentity = 1;

  /** Reads Node's monotonic process clock. */
  nowMilliseconds(): number {
    return performance.now();
  }

  /** Performs an abort-aware bounded delay. */
  async delay(milliseconds: number, signal: AbortSignal): Promise<"elapsed" | "aborted"> {
    if (signal.aborted) return "aborted";
    return new Promise((resolve) => {
      const onAbort = (): void => {
        clearTimeout(timer);
        resolve("aborted");
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve("elapsed");
      }, milliseconds);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  /** Spawns one exact executable and argv without invoking a shell. */
  async spawn(
    request: Pick<ViceControlLaunchV1, "executable" | "argv" | "cwd">,
    signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlOwnedChildV1>> {
    if (signal.aborted) {
      return viceControlFailure("vice.cancelled", "vice.cancelled", "VICE spawn was cancelled.");
    }
    try {
      const child = spawn(request.executable, [...request.argv], {
        cwd: request.cwd,
        shell: false,
        stdio: ["ignore", "ignore", "ignore"],
      });
      const spawned = await new Promise<ViceControlResultV1<number>>((resolve) => {
        const onSpawn = (): void => {
          cleanup();
          const pid = child.pid;
          resolve(
            pid === undefined
              ? viceControlFailure("vice.io", "vice.spawn", "VICE child PID is unavailable.")
              : viceControlSuccess(pid),
          );
        };
        const onError = (): void => {
          cleanup();
          resolve(viceControlFailure("vice.io", "vice.spawn", "VICE process could not start."));
        };
        const cleanup = (): void => {
          child.removeListener("spawn", onSpawn);
          child.removeListener("error", onError);
        };
        child.once("spawn", onSpawn);
        child.once("error", onError);
      });
      if (!spawned.ok) return spawned;
      const identity = `node-child-${this.#nextChildIdentity++}`;
      const owned = new NodeViceOwnedChild(identity, child);
      this.#children.set(owned, child);
      return viceControlSuccess(owned);
    } catch {
      return viceControlFailure("vice.io", "vice.spawn", "VICE process could not start.");
    }
  }

  /** Connects only to the IPv4 loopback address. */
  async connectLoopback(
    _role: "binary" | "text",
    port: number,
    signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlRawChannelV1>> {
    if (signal.aborted) {
      return viceControlFailure(
        "vice.cancelled",
        "vice.cancelled",
        "VICE connection was cancelled.",
      );
    }
    return new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port });
      const onAbort = (): void => {
        cleanup();
        socket.destroy();
        resolve(
          viceControlFailure("vice.cancelled", "vice.cancelled", "VICE connection was cancelled."),
        );
      };
      const onConnect = (): void => {
        cleanup();
        resolve(viceControlSuccess(new NodeViceRawChannel(socket)));
      };
      const onError = (): void => {
        cleanup();
        socket.destroy();
        resolve(viceControlFailure("vice.io", "vice.connect", "VICE loopback connection failed."));
      };
      const cleanup = (): void => {
        signal.removeEventListener("abort", onAbort);
        socket.removeListener("connect", onConnect);
        socket.removeListener("error", onError);
      };
      signal.addEventListener("abort", onAbort, { once: true });
      socket.once("connect", onConnect);
      socket.once("error", onError);
    });
  }

  /** Fails closed when positive operating-system endpoint ownership is requested. */
  async endpointBelongsToChild(
    child: ViceControlOwnedChildV1,
    _role: "binary" | "text",
    port: number,
  ): Promise<ViceControlResultV1<boolean>> {
    const process = this.#children.get(child);
    if (process === undefined) {
      return viceControlFailure("vice.io", "vice.transport", "VICE child authority is unknown.");
    }
    void port;
    return viceControlSuccess(false);
  }

  /** Terminates only an exact child capability created by this host. */
  async closeOwnedChild(child: ViceControlOwnedChildV1): Promise<ViceControlResultV1<true>> {
    const process = this.#children.get(child);
    if (process === undefined) {
      if (this.#closedChildren.has(child)) return viceControlSuccess(true);
      return viceControlFailure("vice.io", "vice.transport", "VICE child authority is unknown.");
    }
    if (process.exitCode === null && process.signalCode === null) {
      process.kill("SIGTERM");
      if (!(await waitForExit(process, CHILD_CLOSE_GRACE_MS))) {
        process.kill("SIGKILL");
        if (!(await waitForExit(process, CHILD_CLOSE_GRACE_MS))) {
          return viceControlFailure(
            "vice.closed",
            "vice.closed",
            "VICE child exit could not be proven.",
          );
        }
      }
    }
    this.#children.delete(child);
    this.#closedChildren.add(child);
    return viceControlSuccess(true);
  }
}
