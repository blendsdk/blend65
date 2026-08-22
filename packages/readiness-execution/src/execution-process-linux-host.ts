import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import type { Readable, Writable } from "node:stream";

import type { ExecutionOperationResultV1 } from "@blend65/readiness";

import type { ExecutionProcessSinkV1 } from "./execution-process.js";
import type {
  ExecutionProcessAnchorHostV1,
  ExecutionProcessParentHostV1,
} from "./execution-process-kernel.js";
import {
  EXECUTION_PROCESS_KERNEL_LIMITS_V1,
  type ExecutionAnchorSpawnInputV1,
  type ExecutionControlReadV1,
  type ExecutionGroupMembershipQueryV1,
  type ExecutionGroupMembershipV1,
  type ExecutionHostProcessExitV1,
  type ExecutionHostProcessIdentityV1,
  type ExecutionProcessControlTransportV1,
  type ExecutionProcessEnvironmentV1,
  type ExecutionSelfGroupSignalV1,
  type ExecutionSpawnedAnchorV1,
  type ExecutionSpawnedTargetV1,
  type ExecutionTargetSpawnInputV1,
} from "./execution-process-kernel-protocol.js";
import type { ExecutionCancellationV1 } from "./execution-worker-protocol.js";

type LinuxProcessRecord = ExecutionHostProcessIdentityV1;

function issue<T>(message: string): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({ code: "execution.io" as const, path: "/process", message }),
    ]) as readonly [
      { readonly code: "execution.io"; readonly path: string; readonly message: string },
    ],
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function missing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "ESRCH";
}

let bootIdPromise: Promise<string> | undefined;

function bootId(): Promise<string> {
  bootIdPromise ??= readFile("/proc/sys/kernel/random/boot_id", "utf8").then((value) =>
    value.trim(),
  );
  return bootIdPromise;
}

function parseLinuxStat(pid: number, statText: string, currentBootId: string): LinuxProcessRecord {
  const closingName = statText.lastIndexOf(")");
  const fields = statText.slice(closingName + 2).split(" ");
  const processGroupId = fields[2];
  const sessionId = fields[3];
  const startTicks = fields[19];
  if (
    closingName < 0 ||
    processGroupId === undefined ||
    sessionId === undefined ||
    startTicks === undefined ||
    !/^[0-9]+$/u.test(processGroupId) ||
    !/^[0-9]+$/u.test(sessionId) ||
    !/^[0-9]+$/u.test(startTicks)
  ) {
    throw new TypeError("Process identity is malformed.");
  }
  return Object.freeze({
    bootId: currentBootId,
    pid,
    startTicks: BigInt(startTicks),
    processGroupId: Number(processGroupId),
    sessionId: Number(sessionId),
  });
}

async function observePid(pid: number): Promise<LinuxProcessRecord> {
  const currentBootId = await bootId();
  return parseLinuxStat(pid, await readFile(`/proc/${pid}/stat`, "utf8"), currentBootId);
}

function sameIdentity(
  left: ExecutionHostProcessIdentityV1,
  right: ExecutionHostProcessIdentityV1,
): boolean {
  return (
    left.bootId === right.bootId &&
    left.pid === right.pid &&
    left.startTicks === right.startTicks &&
    left.processGroupId === right.processGroupId &&
    left.sessionId === right.sessionId
  );
}

async function scanGroup(
  query: ExecutionGroupMembershipQueryV1,
): Promise<ExecutionGroupMembershipV1> {
  let entries: readonly string[];
  try {
    entries = await readdir("/proc");
  } catch {
    return { kind: "unknown", reason: "io" };
  }
  if (entries.length > 65_536) return { kind: "unknown", reason: "limit" };
  let cursor = 0;
  let witness: ExecutionHostProcessIdentityV1 | undefined;
  let malformed = false;
  const inspect = async (): Promise<void> => {
    while (witness === undefined) {
      const entry = entries[cursor++];
      if (entry === undefined) return;
      if (!/^[1-9][0-9]*$/u.test(entry)) continue;
      const pid = Number(entry);
      if (query.scope === "excluding-anchor" && pid === query.anchor.pid) continue;
      try {
        const observed = await observePid(pid);
        if (
          observed.bootId === query.anchor.bootId &&
          observed.processGroupId === query.anchor.processGroupId &&
          observed.sessionId === query.anchor.sessionId
        ) {
          witness = observed;
        }
      } catch (error) {
        if (!missing(error)) malformed = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(16, entries.length) }, () => inspect()));
  if (witness !== undefined) return { kind: "present", witness };
  return malformed ? { kind: "unknown", reason: "malformed" } : { kind: "absent" };
}

async function observeGroup(
  query: ExecutionGroupMembershipQueryV1,
): Promise<ExecutionGroupMembershipV1> {
  if (process.platform !== "linux") return { kind: "unknown", reason: "io" };
  if (query.scope === "including-anchor") {
    try {
      const observed = await observePid(query.anchor.pid);
      return sameIdentity(observed, query.anchor)
        ? { kind: "present", witness: observed }
        : { kind: "recycled", witness: observed };
    } catch (error) {
      if (!missing(error)) return { kind: "unknown", reason: "io" };
    }
  }
  return scanGroup(query);
}

class RawFrameQueue {
  private readonly values: ExecutionControlReadV1[] = [];
  private readonly readers: Array<(value: ExecutionControlReadV1) => void> = [];
  private buffered = Buffer.alloc(0);
  private ended = false;

  constructor(input: Readable) {
    input.on("data", (chunk: Buffer) => this.pushBytes(chunk));
    input.once("end", () => this.finish({ kind: "eof" }));
    input.once("error", (error) =>
      this.finish({ kind: "crash", code: "io", message: error.message }),
    );
  }

  private deliver(value: ExecutionControlReadV1): void {
    const reader = this.readers.shift();
    if (reader === undefined) this.values.push(value);
    else reader(value);
  }

  private pushBytes(chunk: Buffer): void {
    if (this.ended) return;
    this.buffered =
      this.buffered.byteLength === 0
        ? Buffer.from(chunk)
        : Buffer.concat([this.buffered, chunk], this.buffered.byteLength + chunk.byteLength);
    if (this.buffered.byteLength > EXECUTION_PROCESS_KERNEL_LIMITS_V1.controlFrameBytes) {
      this.finish({ kind: "crash", code: "io", message: "Control frame exceeded its bound." });
      return;
    }
    for (;;) {
      const newline = this.buffered.indexOf(0x0a);
      if (newline < 0) return;
      const bytes = Uint8Array.from(this.buffered.subarray(0, newline + 1));
      this.buffered = this.buffered.subarray(newline + 1);
      this.deliver({ kind: "frame", bytes });
    }
  }

  private finish(value: ExecutionControlReadV1): void {
    if (this.ended) return;
    this.ended = true;
    if (this.buffered.byteLength > 0) {
      this.deliver({ kind: "frame", bytes: Uint8Array.from(this.buffered) });
      this.buffered = Buffer.alloc(0);
    }
    this.deliver(value);
  }

  receive(signal: AbortSignal): Promise<ExecutionControlReadV1> {
    const value = this.values.shift();
    if (value !== undefined) return Promise.resolve(value);
    return new Promise((resolve) => {
      const reader = (next: ExecutionControlReadV1): void => {
        signal.removeEventListener("abort", onAbort);
        resolve(next);
      };
      const onAbort = (): void => {
        const index = this.readers.indexOf(reader);
        if (index >= 0) this.readers.splice(index, 1);
        resolve({ kind: "crash", code: "io", message: "Control receive was cancelled." });
      };
      this.readers.push(reader);
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}

/** Creates a raw newline-frame transport over dedicated process pipes. */
export function createExecutionRawControlTransportV1(
  input: Readable,
  output: Writable,
): ExecutionProcessControlTransportV1 {
  const frames = new RawFrameQueue(input);
  let closed = false;
  const transport: ExecutionProcessControlTransportV1 = {
    async sendFrame(
      bytes: Uint8Array,
      cancellation: ExecutionCancellationV1,
    ): Promise<ExecutionOperationResultV1<void>> {
      if (closed || cancellation.signal.aborted || !(bytes instanceof Uint8Array)) {
        return issue("Control send was cancelled or closed.");
      }
      return new Promise<ExecutionOperationResultV1<void>>((resolve) => {
        output.write(bytes, (error) => {
          resolve(
            error === null || error === undefined ? success(undefined) : issue(error.message),
          );
        });
      });
    },
    receiveFrame: (cancellation: ExecutionCancellationV1) => frames.receive(cancellation.signal),
    async close() {
      if (closed) return success(undefined);
      closed = true;
      output.end();
      return success(undefined);
    },
  };
  return Object.freeze(transport);
}

function attachStreams(child: ChildProcess, sink: ExecutionProcessSinkV1): void {
  child.stdout?.on("data", (chunk: Buffer) => sink.onStdout(chunk));
  child.stderr?.on("data", (chunk: Buffer) => sink.onStderr(chunk));
}

function completionFor(child: ChildProcess): Promise<ExecutionHostProcessExitV1> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: ExecutionHostProcessExitV1): void => {
      if (settled) return;
      settled = true;
      resolve(Object.freeze(value));
    };
    child.once("error", (error) => finish({ kind: "crash", code: "io", message: error.message }));
    child.once("close", (exitCode, signal) => {
      if (signal !== null) finish({ kind: "signal", signal });
      else if (exitCode !== null) finish({ kind: "exit", exitCode });
      else finish({ kind: "crash", code: "io", message: "Process closed without status." });
    });
  });
}

async function waitForSpawn(child: ChildProcess, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error): void => {
      child.removeListener("spawn", onSpawn);
      child.removeListener("error", onError);
      signal.removeEventListener("abort", onAbort);
      if (error === undefined) resolve();
      else reject(error);
    };
    const onSpawn = (): void => finish();
    const onError = (error: Error): void => finish(error);
    const onAbort = (): void => finish(new TypeError("Process spawn was cancelled."));
    child.once("spawn", onSpawn);
    child.once("error", onError);
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

function exactEnvironment(environment: ExecutionProcessEnvironmentV1): NodeJS.ProcessEnv {
  return { LANG: environment.LANG, LC_ALL: environment.LC_ALL, TZ: environment.TZ };
}

async function spawnAnchor(
  input: ExecutionAnchorSpawnInputV1,
  sink: ExecutionProcessSinkV1,
  cancellation: ExecutionCancellationV1,
): Promise<ExecutionOperationResultV1<ExecutionSpawnedAnchorV1>> {
  if (process.platform !== "linux") return issue("Process anchors require Linux.");
  let child: ChildProcess;
  try {
    child = spawn(input.executable, [...input.argv], {
      cwd: input.cwd,
      detached: true,
      shell: false,
      env: exactEnvironment(input.environment),
      stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"],
    });
  } catch (error) {
    return issue(error instanceof Error ? error.message : "Anchor spawn failed.");
  }
  const completion = completionFor(child);
  attachStreams(child, sink);
  try {
    await waitForSpawn(child, cancellation.signal);
    if (child.pid === undefined) throw new TypeError("Anchor PID is unavailable.");
    const identity = await observePid(child.pid);
    const output = child.stdio[3];
    const inputStream = child.stdio[4];
    if (output === null || inputStream === null)
      throw new TypeError("Anchor control pipes are unavailable.");
    return success({
      identity,
      control: createExecutionRawControlTransportV1(inputStream as Readable, output as Writable),
      completion,
    });
  } catch (error) {
    child.kill("SIGKILL");
    return issue(error instanceof Error ? error.message : "Anchor identity failed.");
  }
}

async function spawnTarget(
  input: ExecutionTargetSpawnInputV1,
  sink: ExecutionProcessSinkV1,
  cancellation: ExecutionCancellationV1,
): Promise<ExecutionOperationResultV1<ExecutionSpawnedTargetV1>> {
  const options: SpawnOptions = {
    cwd: input.cwd,
    detached: false,
    shell: false,
    env: exactEnvironment(input.environment),
    stdio: ["ignore", "pipe", "pipe"],
  };
  let child: ChildProcess;
  try {
    child = spawn(input.executable, [...input.argv], options);
  } catch (error) {
    return issue(error instanceof Error ? error.message : "Target spawn failed.");
  }
  const completion = completionFor(child);
  attachStreams(child, sink);
  try {
    await waitForSpawn(child, cancellation.signal);
    if (child.pid === undefined) throw new TypeError("Target PID is unavailable.");
    return success({ identity: await observePid(child.pid), completion });
  } catch (error) {
    child.kill("SIGKILL");
    return issue(error instanceof Error ? error.message : "Target identity failed.");
  }
}

/** Default Linux parent host for the persistent process-anchor runtime. */
export const defaultExecutionProcessParentHostV1: ExecutionProcessParentHostV1 = Object.freeze({
  randomBytes(byteLength: 32): Uint8Array {
    return randomBytes(byteLength);
  },
  spawnAnchor,
  observeGroup: (query: ExecutionGroupMembershipQueryV1) => observeGroup(query),
});

/** Default Linux anchor host used only by the dedicated anchor entry. */
export const defaultExecutionProcessAnchorHostV1: ExecutionProcessAnchorHostV1 = Object.freeze({
  async observeSelf(): Promise<ExecutionOperationResultV1<ExecutionHostProcessIdentityV1>> {
    try {
      return success(await observePid(process.pid));
    } catch (error) {
      return issue(error instanceof Error ? error.message : "Anchor self identity failed.");
    }
  },
  spawnTarget,
  async signalSelfProcessGroup(
    input: ExecutionSelfGroupSignalV1,
  ): Promise<ExecutionOperationResultV1<void>> {
    try {
      process.kill(0, input.signal);
      return success<void>(undefined);
    } catch (error) {
      return issue(error instanceof Error ? error.message : "Self-group signal failed.");
    }
  },
  observeGroup: (query: ExecutionGroupMembershipQueryV1) => observeGroup(query),
});
