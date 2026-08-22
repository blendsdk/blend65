/** One complete launch request for the low-level VICE control runtime. */
export interface ViceControlLaunchV1 {
  /** Absolute or caller-resolved VICE executable passed directly to process spawning. */
  readonly executable: string;
  /** Exact argument vector passed without shell interpretation. */
  readonly argv: readonly string[];
  /** Exact working directory used by the child. */
  readonly cwd: string;
  /** Distinct loopback endpoints reserved by the caller. */
  readonly endpoints: {
    /** VICE binary-monitor TCP port. */
    readonly binaryPort: number;
    /** VICE text-monitor TCP port. */
    readonly textPort: number;
  };
  /** Facts that the runtime must prove before returning a session. */
  readonly handshake: {
    /** Machine family expected from the VICE resource probe. */
    readonly target: "c64";
    /** Inclusive accepted VICE version range. */
    readonly version: {
      /** Accepted VICE major version. */
      readonly major: 3;
      /** Lowest accepted minor version. */
      readonly minimumMinor: number;
      /** Highest accepted minor version. */
      readonly maximumMinor: number;
    };
    /** Whether both listener endpoints must be positively tied to the spawned child. */
    readonly endpointOwnership: "required" | "compatibility";
  };
}

/** Exact checkpoint event returned by an instruction advance. */
export interface ViceCheckpointHitV1 {
  /** VICE-assigned checkpoint identifier. */
  readonly checkpointId: number;
  /** Exact address reported by VICE. */
  readonly address: number;
  /** CPU access class that caused the hit. */
  readonly operation: "load" | "store" | "execute";
}

/** Stable low-level VICE failure with a broad public category and precise reason. */
export interface ViceControlIssueV1 {
  /** Broad error category suitable for callers that do not inspect transport details. */
  readonly code: "vice.protocol" | "vice.cancelled" | "vice.closed" | "vice.io";
  /** Stable failure point within launch, framing, or session operation. */
  readonly reason:
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
    | "vice.transport";
  /** Bounded explanation that contains no raw process output. */
  readonly message: string;
}

/** Closed success/failure result used by every low-level control operation. */
export type ViceControlResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issue: ViceControlIssueV1 };

/** A launched, handshaken VICE monitor session. */
export interface ViceControlSessionV1 {
  /** Copies a binary image into emulator memory. */
  loadBinary(bytes: Uint8Array, address: number): Promise<ViceControlResultV1<true>>;
  /** Reads a fresh byte array from emulator memory. */
  readMemory(address: number, length: number): Promise<ViceControlResultV1<Uint8Array>>;
  /** Copies bytes into emulator memory. */
  writeMemory(address: number, bytes: Uint8Array): Promise<ViceControlResultV1<true>>;
  /** Sets the main CPU program counter. */
  setProgramCounter(address: number): Promise<ViceControlResultV1<true>>;
  /** Creates an enabled stopping checkpoint for one exact address and operation. */
  setCheckpoint(
    address: number,
    operation: "load" | "store" | "execute",
  ): Promise<ViceControlResultV1<number>>;
  /** Advances by an exact validated count and reports a checkpoint hit, if any. */
  advanceInstructions(count: number): Promise<ViceControlResultV1<ViceCheckpointHitV1 | null>>;
  /** Reads the absolute text-monitor stopwatch count. */
  readStopwatch(): Promise<ViceControlResultV1<bigint>>;
  /** Cancels every currently pending command while leaving the session usable. */
  cancelPending(): Promise<ViceControlResultV1<true>>;
  /** Closes channels and the owned child exactly once. */
  close(): Promise<ViceControlResultV1<true>>;
}

/** Fragment-preserving raw byte channel supplied by a host adapter. */
export interface ViceControlRawChannelV1 {
  /** Writes a complete caller-owned byte snapshot. */
  write(bytes: Uint8Array): Promise<ViceControlResultV1<true>>;
  /** Reads the next fragment, with `null` representing end of stream. */
  read(signal?: AbortSignal): Promise<ViceControlResultV1<Uint8Array | null>>;
  /** Idempotently closes the channel. */
  close(): Promise<ViceControlResultV1<true>>;
}

/** Opaque identity and exit observation for exactly one spawned child. */
export interface ViceControlOwnedChildV1 {
  /** Non-empty opaque identity meaningful only to the supplying host. */
  readonly identity: string;
  /** Resolves once when the child exits. */
  readonly exited: Promise<{ readonly code: number | null; readonly signal: string | null }>;
}

/** Least-authority operating-system boundary for the VICE control runtime. */
export interface ViceControlHostV1 {
  /** Reads a monotonic clock in milliseconds. */
  nowMilliseconds(): number;
  /** Waits without hiding caller cancellation. */
  delay(milliseconds: number, signal: AbortSignal): Promise<"elapsed" | "aborted">;
  /** Spawns one owned child from an exact shell-free request. */
  spawn(
    request: Pick<ViceControlLaunchV1, "executable" | "argv" | "cwd">,
    signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlOwnedChildV1>>;
  /** Connects to one named loopback monitor endpoint. */
  connectLoopback(
    role: "binary" | "text",
    port: number,
    signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlRawChannelV1>>;
  /** Positively proves that a listener belongs to the exact owned child. */
  endpointBelongsToChild(
    child: ViceControlOwnedChildV1,
    role: "binary" | "text",
    port: number,
  ): Promise<ViceControlResultV1<boolean>>;
  /** Closes only the supplied owned child. */
  closeOwnedChild(child: ViceControlOwnedChildV1): Promise<ViceControlResultV1<true>>;
}

/** Factory-produced low-level runtime with production-owned protocol policy. */
export interface ViceControlRuntimeV1 {
  /** Launches one child and returns only after the full composite handshake succeeds. */
  launch(
    request: ViceControlLaunchV1,
    signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlSessionV1>>;
}

/** Creates a successful immutable low-level result. */
export function viceControlSuccess<T>(value: T): ViceControlResultV1<T> {
  return Object.freeze({ ok: true, value });
}

/** Creates a bounded immutable low-level failure result. */
export function viceControlFailure<T>(
  code: ViceControlIssueV1["code"],
  reason: ViceControlIssueV1["reason"],
  message: string,
): ViceControlResultV1<T> {
  return Object.freeze({
    ok: false,
    issue: Object.freeze({ code, reason, message: message.slice(0, 256) }),
  });
}
