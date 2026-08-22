import { constants } from "node:fs";
import { access, lstat, readFile, readdir, readlink, realpath } from "node:fs/promises";
import net from "node:net";
import { delimiter, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ViceControlHostV1,
  ViceControlLaunchV1,
  ViceControlOwnedChildV1,
  ViceControlRawChannelV1,
  ViceControlResultV1,
} from "@blend65/test-harness/vice-control";

import {
  encodeViceLeaseRecordV1,
  parseViceLeaseRecordV1,
  processFactMatchesRecordV1,
  processFactToRecordV1,
} from "./execution-vice-record.js";
import {
  authorizeViceLauncherExecV1,
  createViceLaunchArtifactV1,
  matchesViceLaunchDescriptionV1,
  processFactFromViceLaunchArtifactV1,
  readViceLaunchArtifactV1,
  type ViceLaunchArtifactV1,
} from "./execution-vice-launch-artifact.js";
import {
  defaultExecutionProcessRuntimeV1,
  type ExecutionProcessHandleV1,
} from "./execution-process.js";
import type {
  ViceExecutionHostV1,
  ViceLeaseNodeIdentityV1,
  ViceLeaseReferenceV1,
  ViceProcessIdentityFactV1,
  ViceRecordedAttemptV1,
  ViceTerminationRequestV1,
} from "./execution-vice-types.js";

/** Record-then-exec launcher built beside this module. */
const LAUNCHER_ENTRY = fileURLToPath(
  new URL("../dist/execution-vice-launcher-entry.js", import.meta.url),
);
/** Bounded graceful termination wait. */
const TERMINATION_GRACE_MS = 2_000;

/** Resolves the fixed VICE command through the host PATH for exact `execve`. */
async function resolveViceExecutable(executable: string): Promise<string> {
  if (executable !== "x64sc") throw new TypeError("VICE executable is not supported.");
  const searchPath = process.env.PATH;
  if (searchPath === undefined) throw new TypeError("Executable search path is unavailable.");
  for (const directory of searchPath.split(delimiter)) {
    if (!isAbsolute(directory)) continue;
    try {
      const resolved = await realpath(join(directory, executable));
      const stat = await lstat(resolved, { bigint: true });
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      await access(resolved, constants.X_OK);
      return resolved;
    } catch {
      // Continue through the fixed host search path.
    }
  }
  throw new TypeError("VICE executable is unavailable.");
}

/** Linux execution-host surface needed by one recorded control attempt. */
export interface RecordedViceAttemptHostV1 extends Pick<
  ViceExecutionHostV1,
  | "compareRemoveLaunchArtifact"
  | "compareReplaceLease"
  | "delay"
  | "observeLease"
  | "observeProcess"
  | "revalidateAndTerminateVice"
> {
  /** Returns a monotonic timestamp for a durable child record. */
  nowMonotonicMilliseconds(): number;
  /** Binds one live authenticated anchor handle to its exact durable identity. */
  registerProcessHandle(process: ViceProcessIdentityFactV1, handle: ExecutionProcessHandleV1): void;
}

/** Creates a low-level raw control failure. */
function controlFailure<T>(
  code: "vice.protocol" | "vice.cancelled" | "vice.closed" | "vice.io",
  reason:
    | "vice.request"
    | "vice.spawn"
    | "vice.connect"
    | "vice.child-exited"
    | "vice.endpoint-owner"
    | "vice.binary-handshake"
    | "vice.text-handshake"
    | "vice.target"
    | "vice.version"
    | "vice.frame"
    | "vice.cancelled"
    | "vice.closed"
    | "vice.transport",
  message: string,
): ViceControlResultV1<T> {
  return Object.freeze({ ok: false, issue: Object.freeze({ code, reason, message }) });
}

/** Creates a low-level raw control success. */
function controlSuccess<T>(value: T): ViceControlResultV1<T> {
  return Object.freeze({ ok: true, value });
}

/** Tests retained directory identity while treating link count as topology metadata. */
function sameDirectory(left: ViceLeaseNodeIdentityV1, right: ViceLeaseNodeIdentityV1): boolean {
  return (
    left.device === right.device &&
    left.inode === right.inode &&
    left.uid === right.uid &&
    left.mode === right.mode
  );
}

/** Tests exact retained regular-file identity, including its single-link fact. */
function sameFile(left: ViceLeaseNodeIdentityV1, right: ViceLeaseNodeIdentityV1): boolean {
  return sameDirectory(left, right) && left.links === right.links;
}

/** Tests an exact compare-and-swap reference. */
function sameReference(left: ViceLeaseReferenceV1, right: ViceLeaseReferenceV1): boolean {
  return (
    sameDirectory(left.directory, right.directory) &&
    sameFile(left.file, right.file) &&
    left.bytesDigest === right.bytesDigest
  );
}

/** Finds the listening socket inode for one exact loopback port. */
async function listenerInode(port: number): Promise<string | undefined> {
  const expected = port.toString(16).toUpperCase().padStart(4, "0");
  for (const path of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    const table = await readFile(path, "utf8");
    for (const line of table.trim().split("\n").slice(1)) {
      const columns = line.trim().split(/\s+/);
      if (columns[1]?.endsWith(`:${expected}`) && columns[3] === "0A") return columns[9];
    }
  }
  return undefined;
}

/** Proves one process owns a specific socket inode. */
async function ownsSocket(pid: number, inode: string): Promise<boolean> {
  const directory = `/proc/${pid}/fd`;
  for (const entry of await readdir(directory)) {
    try {
      if ((await readlink(`${directory}/${entry}`)) === `socket:[${inode}]`) return true;
    } catch {
      // File descriptors may disappear while the directory is enumerated.
    }
  }
  return false;
}

/** Raw loopback socket channel for a constrained record-then-exec child. */
class ExecutionViceRawChannel implements ViceControlRawChannelV1 {
  readonly #socket: net.Socket;
  readonly #queued: Array<ViceControlResultV1<Uint8Array | null>> = [];
  readonly #readers: Array<{
    readonly resolve: (result: ViceControlResultV1<Uint8Array | null>) => void;
    readonly signal: AbortSignal | undefined;
    readonly abort: (() => void) | undefined;
  }> = [];
  #closed = false;
  #terminal: ViceControlResultV1<Uint8Array | null> | undefined;

  constructor(socket: net.Socket) {
    this.#socket = socket;
    socket.on("data", (chunk: Buffer) => this.#deliver(controlSuccess(Uint8Array.from(chunk))));
    socket.once("close", () => {
      this.#closed = true;
      this.#finish(controlSuccess(null));
    });
    socket.once("error", () =>
      this.#finish(controlFailure("vice.io", "vice.transport", "VICE socket failed.")),
    );
  }

  async write(bytes: Uint8Array): Promise<ViceControlResultV1<true>> {
    if (this.#closed) return controlFailure("vice.closed", "vice.closed", "VICE socket is closed.");
    return new Promise((resolve) => {
      this.#socket.write(Buffer.from(bytes.slice()), (error) =>
        resolve(
          error instanceof Error
            ? controlFailure("vice.io", "vice.transport", "VICE socket write failed.")
            : controlSuccess(true),
        ),
      );
    });
  }

  async read(signal?: AbortSignal): Promise<ViceControlResultV1<Uint8Array | null>> {
    const queued = this.#queued.shift();
    if (queued !== undefined) return queued;
    if (this.#terminal !== undefined) return this.#terminal;
    if (signal?.aborted) {
      return controlFailure("vice.cancelled", "vice.cancelled", "VICE read was cancelled.");
    }
    return new Promise((resolve) => {
      const reader = {
        resolve,
        signal,
        abort:
          signal === undefined
            ? undefined
            : (): void => {
                const index = this.#readers.indexOf(reader);
                if (index < 0) return;
                this.#readers.splice(index, 1);
                resolve(
                  controlFailure("vice.cancelled", "vice.cancelled", "VICE read was cancelled."),
                );
              },
      };
      this.#readers.push(reader);
      signal?.addEventListener("abort", reader.abort!, { once: true });
    });
  }

  async close(): Promise<ViceControlResultV1<true>> {
    if (!this.#closed) this.#socket.destroy();
    this.#closed = true;
    this.#finish(controlSuccess(null));
    return controlSuccess(true);
  }

  #deliver(result: ViceControlResultV1<Uint8Array | null>): void {
    const reader = this.#readers.shift();
    if (reader === undefined) this.#queued.push(result);
    else {
      if (reader.abort !== undefined) reader.signal?.removeEventListener("abort", reader.abort);
      reader.resolve(result);
    }
  }

  #finish(result: ViceControlResultV1<Uint8Array | null>): void {
    if (this.#terminal !== undefined) return;
    this.#terminal = result;
    this.#queued.length = 0;
    for (const reader of this.#readers.splice(0)) {
      if (reader.abort !== undefined) reader.signal?.removeEventListener("abort", reader.abort);
      reader.resolve(result);
    }
  }
}

/** Opaque child capability for the same-PID Node-launcher-to-VICE transition. */
class ExecutionViceOwnedChild implements ViceControlOwnedChildV1 {
  readonly identity: string;
  readonly exited: Promise<{ readonly code: number | null; readonly signal: string | null }>;

  constructor(identity: string, handle: ExecutionProcessHandleV1) {
    this.identity = identity;
    this.exited = handle.completion.then((exit) => ({ code: exit.exitCode, signal: exit.signal }));
  }
}

/** Constrained raw control host for one exact recorded attempt. */
class RecordedViceControlHost implements ViceControlHostV1 {
  readonly #executionHost: RecordedViceAttemptHostV1;
  readonly #attempt: ViceRecordedAttemptV1;
  readonly #prepared: ViceLaunchArtifactV1 | undefined;
  readonly #children = new WeakMap<
    ViceControlOwnedChildV1,
    {
      readonly handle: ExecutionProcessHandleV1;
      readonly process: ViceProcessIdentityFactV1;
      readonly lease: ViceLeaseReferenceV1;
      readonly lifetime: AbortController;
    }
  >();
  readonly #orphaned = new Set<{
    readonly handle: ExecutionProcessHandleV1;
    readonly lifetime: AbortController;
  }>();

  constructor(
    executionHost: RecordedViceAttemptHostV1,
    attempt: ViceRecordedAttemptV1,
    prepared?: ViceLaunchArtifactV1,
  ) {
    this.#executionHost = executionHost;
    this.#attempt = attempt;
    this.#prepared = prepared;
  }

  nowMilliseconds(): number {
    return this.#executionHost.nowMonotonicMilliseconds();
  }

  delay(milliseconds: number, signal: AbortSignal): Promise<"elapsed" | "aborted"> {
    return this.#executionHost.delay(milliseconds, signal);
  }

  async spawn(
    request: Pick<ViceControlLaunchV1, "executable" | "argv" | "cwd">,
    signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlOwnedChildV1>> {
    if (
      request.executable !== this.#attempt.executable ||
      request.cwd !== this.#attempt.cwd ||
      request.argv.length !== this.#attempt.argv.length ||
      request.argv.some((argument, index) => argument !== this.#attempt.argv[index])
    )
      return controlFailure(
        "vice.protocol",
        "vice.request",
        "VICE spawn request differs from the recorded attempt.",
      );
    if (signal.aborted)
      return controlFailure("vice.cancelled", "vice.cancelled", "VICE spawn was cancelled.");
    if (this.#prepared === undefined) {
      return controlFailure("vice.io", "vice.spawn", "VICE prepared launch authority is absent.");
    }
    let handle: ExecutionProcessHandleV1 | undefined;
    let retainedLease = this.#attempt.claim;
    let retainedProcess: ViceProcessIdentityFactV1 | null = null;
    const lifetime = new AbortController();
    try {
      const started = this.nowMilliseconds();
      const deadline = started + 15_000;
      const launched = await defaultExecutionProcessRuntimeV1.start(
        {
          executable: process.execPath,
          argv: [LAUNCHER_ENTRY, this.#attempt.launchTokenPath],
          cwd: request.cwd,
          deadline: {
            hardDeadlineMs: deadline + TERMINATION_GRACE_MS,
            workDeadlineMs: deadline,
            cleanupGraceMs: TERMINATION_GRACE_MS,
          },
        },
        { onStdout: () => undefined, onStderr: () => undefined },
        { signal: lifetime.signal, deadlineMonotonicMs: deadline + TERMINATION_GRACE_MS },
      );
      if (!launched.ok) {
        lifetime.abort();
        if (!(await this.#retireArtifact(retainedLease, null))) {
          return controlFailure(
            "vice.closed",
            "vice.closed",
            "VICE launch artifact cleanup could not be proven.",
          );
        }
        return controlFailure("vice.io", "vice.spawn", "VICE launcher could not start.");
      }
      handle = launched.value;
      let artifact = await readViceLaunchArtifactV1(
        this.#attempt.launchTokenPath,
        process.geteuid!(),
      );
      while (
        artifact.state === "prepared" &&
        !signal.aborted &&
        this.nowMilliseconds() < deadline
      ) {
        await this.#executionHost.delay(10, signal);
        artifact = await readViceLaunchArtifactV1(
          this.#attempt.launchTokenPath,
          process.geteuid!(),
        );
      }
      const processFact = processFactFromViceLaunchArtifactV1(
        artifact,
        this.#attempt.launchTokenPath,
      );
      if (
        processFact === undefined ||
        !matchesViceLaunchDescriptionV1(artifact, this.#prepared) ||
        processFact.pid !== handle.identity.pid ||
        processFact.startTicks !== handle.identity.startTicks ||
        processFact.bootId !== handle.identity.bootId ||
        processFact.processGroupId !== handle.identity.processGroupId
      )
        throw new TypeError("VICE launcher identity is unavailable.");
      retainedProcess = processFact;
      const current = await this.#executionHost.observeLease("c64", signal);
      if (
        !current.ok ||
        current.value.kind !== "present" ||
        !sameReference(current.value.reference, this.#attempt.claim)
      ) {
        throw new TypeError("VICE lease changed before child recording.");
      }
      const record = parseViceLeaseRecordV1(current.value.bytes);
      if (
        record === undefined ||
        record.generation !== this.#attempt.generation ||
        record.nonce !== this.#attempt.nonce
      ) {
        throw new TypeError("VICE lease generation changed.");
      }
      const bytes = encodeViceLeaseRecordV1({
        schema: record.schema,
        target: record.target,
        generation: record.generation,
        nonce: record.nonce,
        uid: record.uid,
        acquiredAtMs: record.acquiredAtMs,
        updatedAtMs: Math.max(record.updatedAtMs, this.nowMilliseconds()),
        lifecycle: "child-recorded",
        owner: record.owner,
        attempt: record.attempt,
        child: processFactToRecordV1(processFact),
      });
      const replaced = await this.#executionHost.compareReplaceLease(
        "c64",
        current.value.reference,
        bytes,
        signal,
      );
      if (
        !replaced.ok ||
        replaced.value.kind !== "replaced" ||
        replaced.value.snapshot.kind !== "present"
      ) {
        throw new TypeError("VICE child identity could not be recorded.");
      }
      retainedLease = replaced.value.snapshot.reference;
      await authorizeViceLauncherExecV1(
        this.#attempt.launchTokenPath,
        process.geteuid!(),
        this.#prepared,
        processFact,
      );
      this.#executionHost.registerProcessHandle(processFact, handle);
      const owned = new ExecutionViceOwnedChild(
        `${processFact.pid}:${processFact.startTicks}`,
        handle,
      );
      this.#children.set(owned, {
        handle,
        process: processFact,
        lease: retainedLease,
        lifetime,
      });
      return controlSuccess(owned);
    } catch {
      let exited = false;
      if (handle !== undefined) {
        const cleanupSignal = AbortSignal.timeout(TERMINATION_GRACE_MS);
        await handle
          .terminate("SIGKILL", {
            signal: cleanupSignal,
            deadlineMonotonicMs: this.nowMilliseconds() + TERMINATION_GRACE_MS,
          })
          .catch(() => undefined);
        exited =
          (await handle.waitForGroupExit!(this.nowMilliseconds() + TERMINATION_GRACE_MS).catch(
            () => false,
          )) === true;
        if (exited) {
          lifetime.abort();
        } else {
          const orphaned = { handle, lifetime };
          this.#orphaned.add(orphaned);
          const releaseOrphan = (): void => {
            lifetime.abort();
            this.#orphaned.delete(orphaned);
          };
          void handle.completion.then(releaseOrphan, releaseOrphan);
        }
      } else {
        lifetime.abort();
      }
      if (handle === undefined || exited) {
        if (!(await this.#retireArtifact(retainedLease, retainedProcess))) {
          return controlFailure(
            "vice.closed",
            "vice.closed",
            "VICE launch artifact cleanup could not be proven.",
          );
        }
      }
      return controlFailure("vice.io", "vice.spawn", "VICE launcher failed.");
    }
  }

  async connectLoopback(
    _role: "binary" | "text",
    port: number,
    signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlRawChannelV1>> {
    if (signal.aborted)
      return controlFailure("vice.cancelled", "vice.cancelled", "VICE connect was cancelled.");
    return new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port });
      const cleanup = (): void => {
        signal.removeEventListener("abort", onAbort);
        socket.removeListener("connect", onConnect);
        socket.removeListener("error", onError);
      };
      const onAbort = (): void => {
        cleanup();
        socket.destroy();
        resolve(controlFailure("vice.cancelled", "vice.cancelled", "VICE connect was cancelled."));
      };
      const onConnect = (): void => {
        cleanup();
        resolve(controlSuccess(new ExecutionViceRawChannel(socket)));
      };
      const onError = (): void => {
        cleanup();
        socket.destroy();
        resolve(controlFailure("vice.io", "vice.connect", "VICE loopback connection failed."));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      socket.once("connect", onConnect);
      socket.once("error", onError);
    });
  }

  async endpointBelongsToChild(
    child: ViceControlOwnedChildV1,
    _role: "binary" | "text",
    port: number,
  ): Promise<ViceControlResultV1<boolean>> {
    const owned = this.#children.get(child);
    if (owned === undefined)
      return controlFailure("vice.io", "vice.transport", "VICE child is foreign.");
    try {
      const identity = await this.#executionHost.observeProcess(
        owned.process.pid,
        new AbortController().signal,
        owned.process.launchTokenPath ?? undefined,
      );
      if (
        !identity.ok ||
        identity.value === null ||
        !processFactMatchesRecordV1(identity.value, processFactToRecordV1(owned.process))
      )
        return controlSuccess(false);
      const inode = await listenerInode(port);
      return controlSuccess(inode !== undefined && (await ownsSocket(owned.process.pid, inode)));
    } catch {
      return controlFailure("vice.io", "vice.transport", "VICE endpoint identity is unreadable.");
    }
  }

  async closeOwnedChild(child: ViceControlOwnedChildV1): Promise<ViceControlResultV1<true>> {
    const owned = this.#children.get(child);
    if (owned === undefined)
      return controlFailure("vice.io", "vice.transport", "VICE child is foreign.");
    const request: ViceTerminationRequestV1 = {
      target: "c64",
      lease: owned.lease,
      process: owned.process,
      generation: this.#attempt.generation,
      nonce: this.#attempt.nonce,
      phase: "graceful",
    };
    const graceful = await this.#executionHost.revalidateAndTerminateVice(
      request,
      AbortSignal.timeout(TERMINATION_GRACE_MS),
    );
    if (!graceful.ok || graceful.value === "lease-changed" || graceful.value === "identity-changed")
      return controlFailure("vice.io", "vice.transport", "VICE termination authority changed.");
    let exited = graceful.value === "already-exited";
    if (!exited) {
      exited = await owned.handle.waitForGroupExit!(this.nowMilliseconds() + TERMINATION_GRACE_MS);
    }
    if (!exited) {
      const forced = await this.#executionHost.revalidateAndTerminateVice(
        { ...request, phase: "forced" },
        AbortSignal.timeout(TERMINATION_GRACE_MS),
      );
      if (!forced.ok || forced.value === "lease-changed" || forced.value === "identity-changed")
        return controlFailure(
          "vice.io",
          "vice.transport",
          "VICE forced termination authority changed.",
        );
      exited =
        forced.value === "already-exited" ||
        (await owned.handle.waitForGroupExit!(this.nowMilliseconds() + TERMINATION_GRACE_MS));
      if (!exited) {
        return controlFailure("vice.closed", "vice.closed", "VICE child exit could not be proven.");
      }
    }
    if (!(await this.#retireArtifact(owned.lease, owned.process))) {
      return controlFailure("vice.closed", "vice.closed", "VICE launch artifact was retained.");
    }
    this.#children.delete(child);
    owned.lifetime.abort();
    return controlSuccess(true);
  }

  /** Removes one superseded artifact through the pinned execution-host mutation boundary. */
  async #retireArtifact(
    lease: ViceLeaseReferenceV1,
    processFact: ViceProcessIdentityFactV1 | null,
  ): Promise<boolean> {
    const removeArtifact = this.#executionHost.compareRemoveLaunchArtifact;
    if (removeArtifact === undefined) return false;
    const removed = await removeArtifact.call(
      this.#executionHost,
      "c64",
      lease,
      this.#attempt.launchTokenPath,
      processFact,
      AbortSignal.timeout(TERMINATION_GRACE_MS),
    );
    return removed.ok && (removed.value === "removed" || removed.value === "missing");
  }
}

/** Creates a least-authority raw host for one exact recorded attempt. */
export function createRecordedViceControlHostV1(
  executionHost: RecordedViceAttemptHostV1,
  attempt: ViceRecordedAttemptV1,
): ViceControlHostV1 {
  return new RecordedViceControlHost(executionHost, attempt);
}

/** Creates the durable token artifact before exposing a production launch host. */
export async function prepareRecordedViceControlHostV1(
  executionHost: RecordedViceAttemptHostV1,
  attempt: ViceRecordedAttemptV1,
  uid: number,
): Promise<ViceControlHostV1> {
  const resolvedExecutable = await resolveViceExecutable(attempt.executable);
  const prepared = await createViceLaunchArtifactV1(attempt, uid, resolvedExecutable);
  return new RecordedViceControlHost(executionHost, attempt, prepared);
}
