import type { ExecutionOperationResultV1 } from "@blend65/readiness";

import type { ExecutionCancellationV1 } from "./execution-worker-protocol.js";

/** Hard bounds applied independently to each process-control direction. */
export const EXECUTION_PROCESS_KERNEL_LIMITS_V1 = Object.freeze({
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
} as const);

/** Deterministic environment supplied to both anchor and target processes. */
export interface ExecutionProcessEnvironmentV1 {
  readonly LANG: "C";
  readonly LC_ALL: "C";
  readonly TZ: "UTC";
}

/** Host-observed process identity retained with bigint start time. */
export interface ExecutionHostProcessIdentityV1 {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: bigint;
  readonly processGroupId: number;
  readonly sessionId: number;
}

/** Canonical JSON representation of a process identity. */
export interface ExecutionProcessWireIdentityV1 {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: string;
  readonly processGroupId: number;
  readonly sessionId: number;
}

/** Host process termination observed without interpreting shell state. */
export type ExecutionHostProcessExitV1 =
  | { readonly kind: "exit"; readonly exitCode: number }
  | { readonly kind: "signal"; readonly signal: NodeJS.Signals }
  | { readonly kind: "crash"; readonly code: "spawn" | "io"; readonly message: string };

/** One raw control-transport read. */
export type ExecutionControlReadV1 =
  | { readonly kind: "frame"; readonly bytes: Uint8Array }
  | { readonly kind: "eof" }
  | { readonly kind: "crash"; readonly code: "io"; readonly message: string };

/** Raw framed duplex control transport. */
export interface ExecutionProcessControlTransportV1 {
  sendFrame(
    bytes: Uint8Array,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionOperationResultV1<void>>;
  receiveFrame(cancellation: ExecutionCancellationV1): Promise<ExecutionControlReadV1>;
  close(cancellation: ExecutionCancellationV1): Promise<ExecutionOperationResultV1<void>>;
}

/** Process-control transport with target stream forwarding. */
export interface ExecutionProcessAnchorTransportV1 extends ExecutionProcessControlTransportV1 {
  onStdout(bytes: Uint8Array): void;
  onStderr(bytes: Uint8Array): void;
}

/** Conservative membership observation for an anchor-owned process group. */
export type ExecutionGroupMembershipV1 =
  | { readonly kind: "absent" }
  | { readonly kind: "present"; readonly witness: ExecutionHostProcessIdentityV1 }
  | { readonly kind: "recycled"; readonly witness: ExecutionHostProcessIdentityV1 }
  | { readonly kind: "unknown"; readonly reason: "io" | "permission" | "limit" | "malformed" };

/** Exact process-group membership query. */
export interface ExecutionGroupMembershipQueryV1 {
  readonly revision: "execution-group-membership-query-v1";
  readonly anchor: ExecutionHostProcessIdentityV1;
  readonly scope: "including-anchor" | "excluding-anchor";
}

/** Detached Node anchor launch request. */
export interface ExecutionAnchorSpawnInputV1 {
  readonly revision: "execution-anchor-spawn-v1";
  readonly executable: string;
  readonly argv: readonly [string];
  readonly cwd: string;
  readonly environment: ExecutionProcessEnvironmentV1;
  readonly detached: true;
  readonly shell: false;
  readonly stdio: "ignore-output-control-pipes";
}

/** Spawned anchor and its authenticated private control transport. */
export interface ExecutionSpawnedAnchorV1 {
  readonly identity: ExecutionHostProcessIdentityV1;
  readonly control: ExecutionProcessControlTransportV1;
  readonly completion: Promise<ExecutionHostProcessExitV1>;
}

/** Non-detached target launch request executed inside the anchor group. */
export interface ExecutionTargetSpawnInputV1 {
  readonly revision: "execution-target-spawn-v1";
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly environment: ExecutionProcessEnvironmentV1;
  readonly detached: false;
  readonly shell: false;
  readonly stdio: "ignore-output-pipes";
}

/** Spawned target identity and raw host completion. */
export interface ExecutionSpawnedTargetV1 {
  readonly identity: ExecutionHostProcessIdentityV1;
  readonly completion: Promise<ExecutionHostProcessExitV1>;
}

/** Only signal authority available inside the persistent anchor. */
export interface ExecutionSelfGroupSignalV1 {
  readonly revision: "execution-self-group-signal-v1";
  readonly target: "self-process-group";
  readonly signal: "SIGTERM" | "SIGKILL";
}

/** Base fields authenticated in every control frame. */
export interface ExecutionProcessAnchorFrameBaseV1 {
  readonly revision: "execution-process-anchor-frame-v1";
  readonly direction: "parent-to-anchor" | "anchor-to-parent";
  readonly nonce: string;
  readonly sequence: number;
}

/** Frames accepted by the anchor from its parent. */
export type ExecutionProcessParentFrameV1 =
  | (ExecutionProcessAnchorFrameBaseV1 & {
      readonly direction: "parent-to-anchor";
      readonly kind: "bootstrap";
    })
  | (ExecutionProcessAnchorFrameBaseV1 & {
      readonly direction: "parent-to-anchor";
      readonly kind: "launch";
      readonly executable: string;
      readonly argv: readonly string[];
      readonly cwd: string;
    })
  | (ExecutionProcessAnchorFrameBaseV1 & {
      readonly direction: "parent-to-anchor";
      readonly kind: "terminate";
      readonly signal: "SIGTERM" | "SIGKILL";
    });

/** Frames accepted by the parent from its anchor. */
export type ExecutionProcessAnchorFrameV1 =
  | (ExecutionProcessAnchorFrameBaseV1 & {
      readonly direction: "anchor-to-parent";
      readonly kind: "anchor-ready";
      readonly identity: ExecutionProcessWireIdentityV1;
    })
  | (ExecutionProcessAnchorFrameBaseV1 & {
      readonly direction: "anchor-to-parent";
      readonly kind: "target-started";
      readonly identity: ExecutionProcessWireIdentityV1;
    })
  | (ExecutionProcessAnchorFrameBaseV1 & {
      readonly direction: "anchor-to-parent";
      readonly kind: "target-exit";
      readonly exitCode: number | null;
      readonly signal: NodeJS.Signals | null;
    })
  | (ExecutionProcessAnchorFrameBaseV1 & {
      readonly direction: "anchor-to-parent";
      readonly kind: "term-applied" | "kill-armed" | "group-empty";
    })
  | (ExecutionProcessAnchorFrameBaseV1 & {
      readonly direction: "anchor-to-parent";
      readonly kind: "failure";
      readonly code: "spawn" | "identity" | "membership" | "protocol" | "io";
      readonly message: string;
    });

export const EXECUTION_PROCESS_ENVIRONMENT_V1: ExecutionProcessEnvironmentV1 = Object.freeze({
  LANG: "C",
  LC_ALL: "C",
  TZ: "UTC",
});

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });
const SIGNALS = new Set<NodeJS.Signals>([
  "SIGABRT",
  "SIGALRM",
  "SIGBUS",
  "SIGCHLD",
  "SIGCONT",
  "SIGFPE",
  "SIGHUP",
  "SIGILL",
  "SIGINT",
  "SIGIO",
  "SIGIOT",
  "SIGKILL",
  "SIGPIPE",
  "SIGPOLL",
  "SIGPROF",
  "SIGPWR",
  "SIGQUIT",
  "SIGSEGV",
  "SIGSTKFLT",
  "SIGSTOP",
  "SIGSYS",
  "SIGTERM",
  "SIGTRAP",
  "SIGTSTP",
  "SIGTTIN",
  "SIGTTOU",
  "SIGURG",
  "SIGUSR1",
  "SIGUSR2",
  "SIGVTALRM",
  "SIGWINCH",
  "SIGXCPU",
  "SIGXFSZ",
]);

function sameKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function validBoundedString(
  value: unknown,
  maximumBytes: number,
  allowEmpty = false,
): value is string {
  return (
    typeof value === "string" &&
    (allowEmpty || value.length > 0) &&
    ENCODER.encode(value).byteLength <= maximumBytes
  );
}

export function validKernelArgv(executable: unknown, argv: unknown, cwd: unknown): boolean {
  if (
    !validBoundedString(executable, EXECUTION_PROCESS_KERNEL_LIMITS_V1.executableBytes) ||
    !validBoundedString(cwd, EXECUTION_PROCESS_KERNEL_LIMITS_V1.cwdBytes) ||
    !Array.isArray(argv) ||
    argv.length > EXECUTION_PROCESS_KERNEL_LIMITS_V1.argvItems
  ) {
    return false;
  }
  let total = 0;
  for (const argument of argv) {
    if (!validBoundedString(argument, EXECUTION_PROCESS_KERNEL_LIMITS_V1.argumentBytes, true)) {
      return false;
    }
    total += ENCODER.encode(argument).byteLength;
    if (total > EXECUTION_PROCESS_KERNEL_LIMITS_V1.argvBytes) return false;
  }
  return true;
}

export function validHostIdentity(input: unknown): input is ExecutionHostProcessIdentityV1 {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  return (
    sameKeys(value, ["bootId", "pid", "startTicks", "processGroupId", "sessionId"]) &&
    validBoundedString(value.bootId, EXECUTION_PROCESS_KERNEL_LIMITS_V1.protocolMessageBytes) &&
    Number.isSafeInteger(value.pid) &&
    Number(value.pid) > 0 &&
    typeof value.startTicks === "bigint" &&
    value.startTicks > 0n &&
    Number.isSafeInteger(value.processGroupId) &&
    Number(value.processGroupId) > 0 &&
    Number.isSafeInteger(value.sessionId) &&
    Number(value.sessionId) > 0
  );
}

export function hostIdentityToWire(
  identity: ExecutionHostProcessIdentityV1,
): ExecutionProcessWireIdentityV1 {
  return Object.freeze({
    bootId: identity.bootId,
    pid: identity.pid,
    startTicks: identity.startTicks.toString(10),
    processGroupId: identity.processGroupId,
    sessionId: identity.sessionId,
  });
}

export function wireIdentityToHost(input: unknown): ExecutionHostProcessIdentityV1 | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  const value = input as Record<string, unknown>;
  if (
    !sameKeys(value, ["bootId", "pid", "startTicks", "processGroupId", "sessionId"]) ||
    !validBoundedString(value.bootId, EXECUTION_PROCESS_KERNEL_LIMITS_V1.protocolMessageBytes) ||
    typeof value.startTicks !== "string" ||
    !/^[1-9][0-9]*$/u.test(value.startTicks) ||
    !Number.isSafeInteger(value.pid) ||
    Number(value.pid) <= 0 ||
    !Number.isSafeInteger(value.processGroupId) ||
    Number(value.processGroupId) <= 0 ||
    !Number.isSafeInteger(value.sessionId) ||
    Number(value.sessionId) <= 0
  ) {
    return undefined;
  }
  const identity = {
    bootId: value.bootId,
    pid: Number(value.pid),
    startTicks: BigInt(value.startTicks),
    processGroupId: Number(value.processGroupId),
    sessionId: Number(value.sessionId),
  };
  return Object.freeze(identity);
}

function validBase(
  value: Record<string, unknown>,
  direction: "parent-to-anchor" | "anchor-to-parent",
): boolean {
  return (
    value.revision === "execution-process-anchor-frame-v1" &&
    value.direction === direction &&
    typeof value.nonce === "string" &&
    /^[0-9a-f]{64}$/u.test(value.nonce) &&
    Number.isSafeInteger(value.sequence) &&
    Number(value.sequence) >= 0
  );
}

function validExitCode(value: unknown): value is number | null {
  return value === null || (Number.isSafeInteger(value) && Number(value) >= 0);
}

function validSignal(value: unknown): value is NodeJS.Signals | null {
  return value === null || (typeof value === "string" && SIGNALS.has(value as NodeJS.Signals));
}

function validateParentFrame(value: Record<string, unknown>): boolean {
  if (!validBase(value, "parent-to-anchor")) return false;
  if (value.kind === "bootstrap") {
    return sameKeys(value, ["revision", "direction", "nonce", "sequence", "kind"]);
  }
  if (value.kind === "launch") {
    return (
      sameKeys(value, [
        "revision",
        "direction",
        "nonce",
        "sequence",
        "kind",
        "executable",
        "argv",
        "cwd",
      ]) && validKernelArgv(value.executable, value.argv, value.cwd)
    );
  }
  return (
    value.kind === "terminate" &&
    sameKeys(value, ["revision", "direction", "nonce", "sequence", "kind", "signal"]) &&
    (value.signal === "SIGTERM" || value.signal === "SIGKILL")
  );
}

function validateAnchorFrame(value: Record<string, unknown>): boolean {
  if (!validBase(value, "anchor-to-parent")) return false;
  if (value.kind === "anchor-ready" || value.kind === "target-started") {
    return (
      sameKeys(value, ["revision", "direction", "nonce", "sequence", "kind", "identity"]) &&
      wireIdentityToHost(value.identity) !== undefined
    );
  }
  if (value.kind === "target-exit") {
    return (
      sameKeys(value, [
        "revision",
        "direction",
        "nonce",
        "sequence",
        "kind",
        "exitCode",
        "signal",
      ]) &&
      validExitCode(value.exitCode) &&
      validSignal(value.signal) &&
      (value.exitCode === null) !== (value.signal === null)
    );
  }
  if (
    value.kind === "term-applied" ||
    value.kind === "kill-armed" ||
    value.kind === "group-empty"
  ) {
    return sameKeys(value, ["revision", "direction", "nonce", "sequence", "kind"]);
  }
  return (
    value.kind === "failure" &&
    sameKeys(value, ["revision", "direction", "nonce", "sequence", "kind", "code", "message"]) &&
    (value.code === "spawn" ||
      value.code === "identity" ||
      value.code === "membership" ||
      value.code === "protocol" ||
      value.code === "io") &&
    validBoundedString(value.message, EXECUTION_PROCESS_KERNEL_LIMITS_V1.protocolMessageBytes)
  );
}

export class ExecutionControlFrameCodecV1<
  Frame extends ExecutionProcessParentFrameV1 | ExecutionProcessAnchorFrameV1,
> {
  private sentFrames = 0;
  private sentBytes = 0;
  private receivedFrames = 0;
  private receivedBytes = 0;

  constructor(
    private readonly direction: Frame["direction"],
    private readonly validate: (value: Record<string, unknown>) => boolean,
  ) {}

  encode(frame: Frame): Uint8Array {
    const bytes = ENCODER.encode(`${JSON.stringify(frame)}\n`);
    this.sentFrames += 1;
    this.sentBytes += bytes.byteLength;
    if (
      bytes.byteLength > EXECUTION_PROCESS_KERNEL_LIMITS_V1.controlFrameBytes ||
      this.sentFrames > EXECUTION_PROCESS_KERNEL_LIMITS_V1.controlFramesPerDirection ||
      this.sentBytes > EXECUTION_PROCESS_KERNEL_LIMITS_V1.controlBytesPerDirection
    ) {
      throw new TypeError("Process control output exceeded its bound.");
    }
    return bytes;
  }

  decode(read: ExecutionControlReadV1): Frame {
    if (read.kind !== "frame" || !(read.bytes instanceof Uint8Array)) {
      throw new TypeError("Process control input ended without a frame.");
    }
    this.receivedFrames += 1;
    this.receivedBytes += read.bytes.byteLength;
    if (
      read.bytes.byteLength === 0 ||
      read.bytes.byteLength > EXECUTION_PROCESS_KERNEL_LIMITS_V1.controlFrameBytes ||
      this.receivedFrames > EXECUTION_PROCESS_KERNEL_LIMITS_V1.controlFramesPerDirection ||
      this.receivedBytes > EXECUTION_PROCESS_KERNEL_LIMITS_V1.controlBytesPerDirection ||
      read.bytes.at(-1) !== 0x0a
    ) {
      throw new TypeError("Process control input exceeded its bound.");
    }
    const text = DECODER.decode(read.bytes);
    if (text.slice(0, -1).includes("\n"))
      throw new TypeError("Process control frame is not singular.");
    const parsed = JSON.parse(text.slice(0, -1)) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new TypeError("Process control frame is not an object.");
    }
    const value = parsed as Record<string, unknown>;
    if (
      !this.validate(value) ||
      value.direction !== this.direction ||
      `${JSON.stringify(value)}\n` !== text
    ) {
      throw new TypeError("Process control frame is noncanonical.");
    }
    return value as unknown as Frame;
  }
}

export function parentFrameCodecV1(): ExecutionControlFrameCodecV1<ExecutionProcessParentFrameV1> {
  return new ExecutionControlFrameCodecV1("parent-to-anchor", validateParentFrame);
}

export function anchorFrameCodecV1(): ExecutionControlFrameCodecV1<ExecutionProcessAnchorFrameV1> {
  return new ExecutionControlFrameCodecV1("anchor-to-parent", validateAnchorFrame);
}
