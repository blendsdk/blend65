import {
  checkpointDeleteBody,
  CMD,
  displayGetBody,
  executeUntilReturnBody,
  paletteGetBody,
  parseDisplayGet,
  parsePaletteGet,
  parseRegistersGet,
  registersGetBody,
  registersSetBody,
  type DisplayFrame,
  type PaletteEntry,
  type ResponseFrame,
} from "./protocol.js";
import { closeViceControlResourcesV1 } from "./vice-control-cleanup.js";
import {
  encodeViceControlCommandV1,
  isViceInstructionCountV1,
  parseViceC64ResourceV1,
  parseViceCheckpointEventV1,
  parseViceCheckpointIdV1,
  parseViceCoreRegistersV1,
  parseViceMemoryV1,
  parseViceVersionV1,
  viceAdvanceInstructionsBodyV1,
  viceC64ResourceBodyV1,
  viceCheckpointSetBodyV1,
  viceMemoryReadBodyV1,
  viceMemoryWriteBodyV1,
  viceProgramCounterBodyV1,
  VICE_CONTROL_COMMAND_V1,
  VICE_CONTROL_EVENT_REQUEST_ID_V1,
  VICE_CONTROL_HANDSHAKE_BODY_V1,
  ViceControlFrameAccumulatorV1,
} from "./vice-control-protocol.js";
import {
  viceControlFailure,
  viceControlSuccess,
  type ViceCheckpointHitV1,
  type ViceControlHostV1,
  type ViceControlLaunchV1,
  type ViceControlOwnedChildV1,
  type ViceControlRawChannelV1,
  type ViceControlResultV1,
  type ViceControlSessionV1,
} from "./vice-control-types.js";

/** Maximum text-monitor reply retained for one stopwatch exchange. */
const MAX_TEXT_REPLY_BYTES = 64 * 1024;
/** Bounded wait for each text-monitor fragment. */
const TEXT_FRAGMENT_TIMEOUT_MS = 10_000;
/** VICE unsolicited STOPPED event. */
const STOPPED_EVENT = 0x62;
/** VICE checkpoint-info response/event. */
const CHECKPOINT_EVENT = 0x11;
/** Anchored text-monitor prompt terminating a complete reply. */
const TEXT_PROMPT = /\(C:\$[0-9a-f]{4}\) $/i;
/** Only a labelled line may be interpreted as a stopwatch counter. */
const STOPWATCH_LINE = /(?:^|\r?\n|\(C:\$[0-9a-f]{4}\) )Stopwatch:\s+(\d+)\r?$/im;

/** Races a compliant abortable channel with the signal as a hostile-host backstop. */
async function readRawChannel(
  channel: ViceControlRawChannelV1,
  signal: AbortSignal,
): Promise<ViceControlResultV1<Uint8Array | null>> {
  if (signal.aborted) {
    return viceControlFailure("vice.cancelled", "vice.cancelled", "VICE read was cancelled.");
  }
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([
      channel.read(signal),
      new Promise<ViceControlResultV1<Uint8Array | null>>((resolve) => {
        abort = (): void =>
          resolve(
            viceControlFailure("vice.cancelled", "vice.cancelled", "VICE read was cancelled."),
          );
        signal.addEventListener("abort", abort, { once: true });
      }),
    ]);
  } finally {
    if (abort !== undefined) signal.removeEventListener("abort", abort);
  }
}

type RawWriteOutcome =
  | Readonly<{ readonly kind: "settled"; readonly result: ViceControlResultV1<true> }>
  | Readonly<{
      readonly kind: "cancelled";
      readonly settlement: Promise<ViceControlResultV1<true>> | undefined;
    }>;

type ViceControlFailureResult = Extract<ViceControlResultV1<unknown>, { readonly ok: false }>;

/** Races a raw write with operation cancellation while retaining any late settlement. */
async function writeRawChannel(
  channel: ViceControlRawChannelV1,
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<RawWriteOutcome> {
  if (signal.aborted) return Object.freeze({ kind: "cancelled", settlement: undefined });
  let settlement: Promise<ViceControlResultV1<true>>;
  try {
    settlement = channel
      .write(bytes.slice())
      .catch(() =>
        viceControlFailure<true>(
          "vice.io",
          "vice.transport",
          "VICE transport write failed unexpectedly.",
        ),
      );
  } catch {
    return Object.freeze({
      kind: "settled",
      result: viceControlFailure<true>(
        "vice.io",
        "vice.transport",
        "VICE transport write failed unexpectedly.",
      ),
    });
  }
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([
      settlement.then((result) => Object.freeze({ kind: "settled" as const, result })),
      new Promise<RawWriteOutcome>((resolve) => {
        abort = (): void => resolve(Object.freeze({ kind: "cancelled", settlement }));
        signal.addEventListener("abort", abort, { once: true });
      }),
    ]);
  } finally {
    if (abort !== undefined) signal.removeEventListener("abort", abort);
  }
}

/** One correlated binary request. */
type PendingBinaryRequest = {
  readonly resolve: (result: ViceControlResultV1<ResponseFrame>) => void;
  writeSucceeded: boolean;
};

/** One in-flight instruction advance awaiting an unsolicited stop event. */
type PendingAdvance = {
  readonly resolve: (result: ViceControlResultV1<ViceCheckpointHitV1 | null>) => void;
  checkpoint: ViceCheckpointHitV1 | null;
};

/** One legacy continue waiter used only by the compatibility driver. */
type PendingContinue = {
  /** Resolves when VICE reports the next stopped state. */
  readonly resolve: (result: ViceControlResultV1<"breakpoint" | "exit">) => void;
  readonly requestId: number;
  writeSucceeded: boolean;
  hitCheckpoint: boolean;
};

/** Internal session returned only after launch and handshake validation. */
export class ViceControlSession implements ViceControlSessionV1 {
  readonly #binary: ViceControlRawChannelV1;
  readonly #text: ViceControlRawChannelV1;
  readonly #child: ViceControlOwnedChildV1;
  readonly #host: ViceControlHostV1;
  readonly #signal: AbortSignal;
  readonly #onAbort: () => void;
  readonly #pending = new Map<number, PendingBinaryRequest>();
  readonly #binaryWrites = new Set<AbortController>();
  readonly #retiredBinaryRequests = new Set<number>();
  readonly #drainingBinaryReplies = new Set<number>();
  #binaryTerminal: ViceControlFailureResult | undefined;
  readonly #accumulator = new ViceControlFrameAccumulatorV1();
  #nextRequestId = 1;
  #pump: Promise<void> | undefined;
  #advance: PendingAdvance | undefined;
  #continue: PendingContinue | undefined;
  #drainingExecution = false;
  #drainPromise: Promise<void> | undefined;
  #settleDrain: (() => void) | undefined;
  #registers: ReadonlyMap<string, number> = new Map();
  readonly #textLifetime = new AbortController();
  #textExchange: AbortController | undefined;
  #textDrain: Promise<boolean> | undefined;
  #textDrainFailed = false;
  #textBusy = false;
  #closed = false;
  #closePromise: Promise<ViceControlResultV1<true>> | undefined;

  /** Creates a session over channels and a child that are already owned by the caller. */
  constructor(
    binary: ViceControlRawChannelV1,
    text: ViceControlRawChannelV1,
    child: ViceControlOwnedChildV1,
    host: ViceControlHostV1,
    signal: AbortSignal = new AbortController().signal,
  ) {
    this.#binary = binary;
    this.#text = text;
    this.#child = child;
    this.#host = host;
    this.#signal = signal;
    this.#onAbort = (): void => {
      this.#terminalizeBinary("vice.cancelled", "vice.cancelled", "VICE operation was cancelled.");
      this.#textExchange?.abort();
    };
    signal.addEventListener("abort", this.#onAbort, { once: true });
    if (signal.aborted) this.#onAbort();
    void child.exited.then(() => {
      if (!this.#closed) {
        this.#terminalizeBinary("vice.io", "vice.child-exited", "VICE child exited.");
      }
    });
  }

  /** Performs every binary and text semantic probe required before authority is returned. */
  async handshake(request: ViceControlLaunchV1): Promise<ViceControlResultV1<true>> {
    const registers = await this.#send(
      VICE_CONTROL_COMMAND_V1.registersAvailable,
      VICE_CONTROL_HANDSHAKE_BODY_V1.registersAvailable(),
    );
    if (!registers.ok) {
      return this.#handshakeFailure(registers, "vice.binary-handshake", "core registers");
    }
    try {
      this.#registers = parseViceCoreRegistersV1(registers.value.body);
    } catch {
      return viceControlFailure(
        "vice.protocol",
        "vice.binary-handshake",
        "VICE core-register handshake failed.",
      );
    }

    const version = await this.#send(
      VICE_CONTROL_COMMAND_V1.viceInfo,
      VICE_CONTROL_HANDSHAKE_BODY_V1.viceInfo(),
    );
    if (!version.ok) return this.#handshakeFailure(version, "vice.binary-handshake", "version");
    try {
      const parsed = parseViceVersionV1(version.value.body);
      if (
        parsed.major !== request.handshake.version.major ||
        parsed.minor < request.handshake.version.minimumMinor ||
        parsed.minor > request.handshake.version.maximumMinor
      ) {
        return viceControlFailure(
          "vice.protocol",
          "vice.version",
          "VICE version is outside the accepted range.",
        );
      }
    } catch {
      return viceControlFailure("vice.protocol", "vice.version", "VICE version is invalid.");
    }

    const resource = await this.#send(VICE_CONTROL_COMMAND_V1.resourceGet, viceC64ResourceBodyV1());
    if (!resource.ok)
      return this.#handshakeFailure(resource, "vice.binary-handshake", "C64 resource");
    try {
      parseViceC64ResourceV1(resource.value.body);
    } catch {
      return viceControlFailure("vice.protocol", "vice.target", "VICE target is not a C64.");
    }

    const stopwatch = await this.readStopwatch();
    if (!stopwatch.ok) {
      return stopwatch.issue.reason === "vice.closed" || stopwatch.issue.reason === "vice.cancelled"
        ? stopwatch
        : viceControlFailure(
            "vice.protocol",
            "vice.text-handshake",
            "VICE text-monitor handshake failed.",
          );
    }
    return viceControlSuccess(true);
  }

  /** Copies a binary image into emulator memory. */
  async loadBinary(bytes: Uint8Array, address: number): Promise<ViceControlResultV1<true>> {
    return this.writeMemory(address, bytes);
  }

  /** Reads a fresh byte array from emulator memory. */
  async readMemory(address: number, length: number): Promise<ViceControlResultV1<Uint8Array>> {
    if (this.#closed) return this.#closedFailure();
    let body: Uint8Array;
    try {
      body = viceMemoryReadBodyV1(address, length);
    } catch {
      return viceControlFailure("vice.protocol", "vice.request", "VICE memory read is invalid.");
    }
    const response = await this.#send(VICE_CONTROL_COMMAND_V1.memoryGet, body);
    if (!response.ok) return response;
    try {
      return viceControlSuccess(parseViceMemoryV1(response.value.body));
    } catch {
      return viceControlFailure("vice.protocol", "vice.frame", "VICE memory response is invalid.");
    }
  }

  /** Copies caller-owned bytes before issuing a memory write. */
  async writeMemory(address: number, bytes: Uint8Array): Promise<ViceControlResultV1<true>> {
    if (this.#closed) return this.#closedFailure();
    if (!(bytes instanceof Uint8Array)) {
      return viceControlFailure("vice.protocol", "vice.request", "VICE memory bytes are invalid.");
    }
    const snapshot = bytes.slice();
    let body: Uint8Array;
    try {
      body = viceMemoryWriteBodyV1(address, snapshot);
    } catch {
      return viceControlFailure("vice.protocol", "vice.request", "VICE memory write is invalid.");
    }
    const response = await this.#send(VICE_CONTROL_COMMAND_V1.memorySet, body);
    return response.ok ? viceControlSuccess(true) : response;
  }

  /** Sets the main CPU program counter using the handshaken register id. */
  async setProgramCounter(address: number): Promise<ViceControlResultV1<true>> {
    if (this.#closed) return this.#closedFailure();
    const registerId = this.#registers.get("PC");
    if (registerId === undefined) {
      return viceControlFailure(
        "vice.protocol",
        "vice.binary-handshake",
        "VICE PC register is unavailable.",
      );
    }
    let body: Uint8Array;
    try {
      body = viceProgramCounterBodyV1(registerId, address);
    } catch {
      return viceControlFailure(
        "vice.protocol",
        "vice.request",
        "VICE program counter is invalid.",
      );
    }
    const response = await this.#send(VICE_CONTROL_COMMAND_V1.registersSet, body);
    return response.ok ? viceControlSuccess(true) : response;
  }

  /** Creates an enabled stopping checkpoint at one exact address. */
  async setCheckpoint(
    address: number,
    operation: "load" | "store" | "execute",
  ): Promise<ViceControlResultV1<number>> {
    if (this.#closed) return this.#closedFailure();
    let body: Uint8Array;
    try {
      body = viceCheckpointSetBodyV1(address, operation);
    } catch {
      return viceControlFailure("vice.protocol", "vice.request", "VICE checkpoint is invalid.");
    }
    const response = await this.#send(VICE_CONTROL_COMMAND_V1.checkpointSet, body);
    if (!response.ok) return response;
    try {
      return viceControlSuccess(parseViceCheckpointIdV1(response.value.body));
    } catch {
      return viceControlFailure(
        "vice.protocol",
        "vice.frame",
        "VICE checkpoint response is invalid.",
      );
    }
  }

  /** Advances by an exact wire count and waits until VICE reports a stop. */
  async advanceInstructions(
    count: number,
  ): Promise<ViceControlResultV1<ViceCheckpointHitV1 | null>> {
    if (this.#closed) return this.#closedFailure();
    if (this.#binaryTerminal !== undefined) return this.#binaryTerminal;
    if (!isViceInstructionCountV1(count) || this.#advance !== undefined) {
      return viceControlFailure(
        "vice.protocol",
        "vice.request",
        "VICE instruction advance request is invalid.",
      );
    }
    await this.#awaitExecutionDrain();
    if (this.#signal.aborted) return this.#cancelledFailure();
    const event = new Promise<ViceControlResultV1<ViceCheckpointHitV1 | null>>((resolve) => {
      this.#advance = { resolve, checkpoint: null };
    });
    const response = await this.#send(
      VICE_CONTROL_COMMAND_V1.advanceInstructions,
      viceAdvanceInstructionsBodyV1(count),
    );
    if (!response.ok) {
      this.#settleAdvance(response);
      return response;
    }
    return event;
  }

  /** Reads one bounded anchored stopwatch response from the text monitor. */
  async readStopwatch(): Promise<ViceControlResultV1<bigint>> {
    if (this.#closed) return this.#closedFailure();
    if (this.#binaryTerminal !== undefined) return this.#binaryTerminal;
    if (this.#textBusy) {
      return viceControlFailure("vice.protocol", "vice.request", "A text exchange is in flight.");
    }
    this.#textBusy = true;
    const exchange = new AbortController();
    this.#textExchange = exchange;
    const cancelExchange = (): void => exchange.abort();
    this.#signal.addEventListener("abort", cancelExchange, { once: true });
    if (this.#signal.aborted) exchange.abort();
    try {
      if (!(await this.#awaitTextDrain(exchange.signal))) {
        return exchange.signal.aborted
          ? this.#cancelledFailure()
          : viceControlFailure(
              "vice.io",
              "vice.transport",
              "VICE cancelled text reply could not be drained.",
            );
      }
      const write = await writeRawChannel(
        this.#text,
        new TextEncoder().encode("stopwatch\n"),
        exchange.signal,
      );
      if (write.kind === "cancelled") {
        if (write.settlement !== undefined) this.#beginTextWriteDrain(write.settlement);
        return this.#cancelledFailure();
      }
      if (!write.result.ok) return write.result;
      let retained = new Uint8Array(0);
      let completedPrompts = 0;
      while (!this.#closed) {
        const delayController = new AbortController();
        const pendingRead = this.#text.read(this.#textLifetime.signal);
        if (exchange.signal.aborted) {
          delayController.abort();
          this.#beginTextDrain(pendingRead);
          return this.#cancelledFailure();
        }
        const raced = await Promise.race([
          pendingRead.then((result) => ({
            kind: "read" as const,
            result,
          })),
          new Promise<{ readonly kind: "cancelled" }>((resolve) =>
            exchange.signal.addEventListener("abort", () => resolve({ kind: "cancelled" }), {
              once: true,
            }),
          ),
          this.#host
            .delay(TEXT_FRAGMENT_TIMEOUT_MS, delayController.signal)
            .then(() => ({ kind: "timeout" as const })),
        ]);
        delayController.abort();
        if (raced.kind === "cancelled") {
          this.#beginTextDrain(pendingRead);
          return this.#cancelledFailure();
        }
        if (raced.kind === "timeout") {
          this.#beginTextDrain(pendingRead);
          return viceControlFailure(
            "vice.protocol",
            "vice.text-handshake",
            "VICE stopwatch reply timed out.",
          );
        }
        const read = raced.result;
        if (!read.ok) return read;
        if (read.value === null) {
          return viceControlFailure("vice.io", "vice.transport", "VICE text monitor closed.");
        }
        if (read.value.byteLength > MAX_TEXT_REPLY_BYTES - retained.byteLength) {
          return viceControlFailure(
            "vice.protocol",
            "vice.text-handshake",
            "VICE text reply exceeds the bounded limit.",
          );
        }
        const next = new Uint8Array(retained.byteLength + read.value.byteLength);
        next.set(retained);
        next.set(read.value, retained.byteLength);
        retained = next;
        const text = new TextDecoder("latin1").decode(retained);
        if (!TEXT_PROMPT.test(text)) continue;
        const match = STOPWATCH_LINE.exec(text);
        if (match === null) {
          // VICE emits an unsolicited initial prompt when a text monitor
          // connects. Drop complete prompt-only segments while preserving the
          // post-command requirement for an anchored labelled stopwatch line.
          completedPrompts += 1;
          if (completedPrompts > 4) {
            return viceControlFailure(
              "vice.protocol",
              "vice.text-handshake",
              "VICE stopwatch reply is not anchored.",
            );
          }
          retained = new Uint8Array(0);
          continue;
        }
        return viceControlSuccess(BigInt(match[1]));
      }
      return this.#closedFailure();
    } finally {
      this.#signal.removeEventListener("abort", cancelExchange);
      if (this.#textExchange === exchange) this.#textExchange = undefined;
      this.#textBusy = false;
    }
  }

  /** Cancels pending binary and text work without making the session terminal. */
  async cancelPending(): Promise<ViceControlResultV1<true>> {
    if (this.#closed) return this.#closedFailure();
    this.#markExecutionDrain();
    this.#failPending("vice.cancelled", "vice.cancelled", "VICE operation was cancelled.");
    this.#cancelBinaryWrites();
    this.#textExchange?.abort();
    return viceControlSuccess(true);
  }

  /** Closes channels and the exact owned child once. */
  async close(): Promise<ViceControlResultV1<true>> {
    if (this.#closePromise !== undefined) return this.#closePromise;
    this.#closed = true;
    this.#cancelBinaryWrites();
    this.#textExchange?.abort();
    this.#textLifetime.abort();
    this.#signal.removeEventListener("abort", this.#onAbort);
    this.#failPending("vice.closed", "vice.closed", "VICE session is closed.");
    this.#retiredBinaryRequests.clear();
    this.#drainingBinaryReplies.clear();
    this.#closePromise = this.#closeResources();
    return this.#closePromise;
  }

  /** Reads raw main-CPU registers for the legacy `ViceDriver` wrapper. */
  async readLegacyRegisters(): Promise<ViceControlResultV1<ReadonlyMap<string, number>>> {
    const response = await this.#send(CMD.REGISTERS_GET, registersGetBody());
    if (!response.ok) return response;
    try {
      const byId = parseRegistersGet(response.value.body);
      const named = new Map<string, number>();
      for (const [name, id] of this.#registers) named.set(name, byId.get(id) ?? 0);
      return viceControlSuccess(named);
    } catch {
      return viceControlFailure(
        "vice.protocol",
        "vice.frame",
        "VICE register response is invalid.",
      );
    }
  }

  /** Writes named main-CPU registers for the legacy `ViceDriver` wrapper. */
  async writeLegacyRegisters(
    values: ReadonlyMap<string, number>,
  ): Promise<ViceControlResultV1<true>> {
    const items: Array<{ id: number; value: number }> = [];
    for (const [name, value] of values) {
      const id = this.#registers.get(name);
      if (id === undefined || !Number.isInteger(value) || value < 0 || value > 0xffff) {
        return viceControlFailure(
          "vice.protocol",
          "vice.request",
          "VICE register write is invalid.",
        );
      }
      items.push({ id, value });
    }
    if (items.length === 0) return viceControlSuccess(true);
    const response = await this.#send(CMD.REGISTERS_SET, registersSetBody(items));
    return response.ok ? viceControlSuccess(true) : response;
  }

  /** Deletes one VICE checkpoint for the legacy `ViceDriver` wrapper. */
  async deleteLegacyCheckpoint(checkpointId: number): Promise<ViceControlResultV1<true>> {
    if (!Number.isSafeInteger(checkpointId) || checkpointId < 0 || checkpointId > 0xffffffff) {
      return viceControlFailure("vice.protocol", "vice.request", "VICE checkpoint id is invalid.");
    }
    const response = await this.#send(CMD.CHECKPOINT_DELETE, checkpointDeleteBody(checkpointId));
    return response.ok ? viceControlSuccess(true) : response;
  }

  /** Continues execution until the next stopped event for the compatibility driver. */
  async continueLegacy(): Promise<ViceControlResultV1<"breakpoint" | "exit">> {
    if (this.#closed) return this.#closedFailure();
    if (this.#binaryTerminal !== undefined) return this.#binaryTerminal;
    if (this.#continue !== undefined || this.#advance !== undefined) {
      return viceControlFailure("vice.protocol", "vice.request", "VICE is already executing.");
    }
    await this.#awaitExecutionDrain();
    if (this.#signal.aborted) return this.#cancelledFailure();
    let settle!: (result: ViceControlResultV1<"breakpoint" | "exit">) => void;
    const stopped = new Promise<ViceControlResultV1<"breakpoint" | "exit">>((resolve) => {
      settle = resolve;
    });
    const requestId = this.#takeRequestId();
    this.#continue = { resolve: settle, requestId, writeSucceeded: false, hitCheckpoint: false };
    const write = await this.#writeBinary(
      encodeViceControlCommandV1(CMD.EXIT, requestId, new Uint8Array(0)),
      requestId,
      this.#beginBinaryWrite(),
    );
    if (!write.ok) {
      if (this.#continue !== undefined) {
        this.#continue = undefined;
        settle(write);
        return write;
      }
      return stopped;
    }
    if (this.#continue === undefined) this.#retireBinaryRequest(requestId, true);
    else this.#continue.writeSucceeded = true;
    this.#ensurePump();
    return stopped;
  }

  /** Executes until a subroutine returns for the compatibility driver. */
  async executeUntilReturnLegacy(): Promise<ViceControlResultV1<true>> {
    if (this.#closed) return this.#closedFailure();
    if (this.#binaryTerminal !== undefined) return this.#binaryTerminal;
    if (this.#advance !== undefined || this.#continue !== undefined) {
      return viceControlFailure("vice.protocol", "vice.request", "VICE is already executing.");
    }
    await this.#awaitExecutionDrain();
    if (this.#signal.aborted) return this.#cancelledFailure();
    const event = new Promise<ViceControlResultV1<ViceCheckpointHitV1 | null>>((resolve) => {
      this.#advance = { resolve, checkpoint: null };
    });
    const response = await this.#send(CMD.EXECUTE_UNTIL_RETURN, executeUntilReturnBody());
    if (!response.ok) {
      this.#settleAdvance(response);
      return response;
    }
    const stopped = await event;
    return stopped.ok ? viceControlSuccess(true) : stopped;
  }

  /** Reads indexed display and palette frames for compatibility screenshots. */
  async readLegacyDisplay(): Promise<
    ViceControlResultV1<{ readonly display: DisplayFrame; readonly palette: PaletteEntry[] }>
  > {
    const display = await this.#send(CMD.DISPLAY_GET, displayGetBody());
    if (!display.ok) return display;
    const palette = await this.#send(CMD.PALETTE_GET, paletteGetBody());
    if (!palette.ok) return palette;
    try {
      return viceControlSuccess({
        display: parseDisplayGet(display.value.body),
        palette: parsePaletteGet(palette.value.body),
      });
    } catch {
      return viceControlFailure("vice.protocol", "vice.frame", "VICE display response is invalid.");
    }
  }

  /** Retains the abandoned raw read until its complete prompt has been discarded. */
  #beginTextDrain(firstRead: Promise<ViceControlResultV1<Uint8Array | null>>): void {
    this.#installTextDrain(this.#drainTextReply(firstRead));
  }

  /** Waits for a cancelled text write and drains its reply only if the write succeeded. */
  #beginTextWriteDrain(settlement: Promise<ViceControlResultV1<true>>): void {
    this.#installTextDrain(
      settlement.then((result) =>
        result.ok
          ? this.#drainTextReply(this.#text.read(this.#textLifetime.signal))
          : Promise.resolve(true),
      ),
    );
  }

  /** Installs one ordered text drain and makes an undrainable stream terminal for reuse. */
  #installTextDrain(drain: Promise<boolean>): void {
    this.#textDrain = drain;
    void drain.then((drained) => {
      if (!drained) this.#textDrainFailed = true;
      if (this.#textDrain === drain) this.#textDrain = undefined;
    });
  }

  /** Waits abortably for an earlier cancelled text reply to leave the stream. */
  async #awaitTextDrain(signal: AbortSignal): Promise<boolean> {
    if (this.#textDrainFailed) return false;
    const drain = this.#textDrain;
    if (drain === undefined) return true;
    if (signal.aborted) return false;
    let abort: (() => void) | undefined;
    try {
      const drained = await Promise.race([
        drain,
        new Promise<false>((resolve) => {
          abort = (): void => resolve(false);
          signal.addEventListener("abort", abort, { once: true });
        }),
      ]);
      return drained && !this.#textDrainFailed;
    } finally {
      if (abort !== undefined) signal.removeEventListener("abort", abort);
    }
  }

  /** Consumes one cancelled stopwatch response without interpreting its value. */
  async #drainTextReply(
    firstRead: Promise<ViceControlResultV1<Uint8Array | null>>,
  ): Promise<boolean> {
    let retained = new Uint8Array(0);
    let pending = firstRead;
    try {
      while (!this.#closed) {
        const read = await pending;
        if (!read.ok || read.value === null) return false;
        if (read.value.byteLength > MAX_TEXT_REPLY_BYTES - retained.byteLength) return false;
        const next = new Uint8Array(retained.byteLength + read.value.byteLength);
        next.set(retained);
        next.set(read.value, retained.byteLength);
        retained = next;
        if (TEXT_PROMPT.test(new TextDecoder("latin1").decode(retained))) return true;
        pending = this.#text.read(this.#textLifetime.signal);
      }
    } catch {
      return false;
    }
    return false;
  }

  /** Maps an earlier handshake transport failure without erasing framing classification. */
  #handshakeFailure<T>(
    result: ViceControlResultV1<T>,
    reason: "vice.binary-handshake" | "vice.text-handshake",
    stage: string,
  ): ViceControlResultV1<never> {
    if (result.ok) {
      return viceControlFailure("vice.protocol", reason, `VICE ${stage} handshake failed.`);
    }
    if (
      result.issue.reason === "vice.frame" ||
      result.issue.reason === "vice.closed" ||
      result.issue.reason === "vice.cancelled" ||
      result.issue.reason === "vice.child-exited"
    ) {
      return result;
    }
    return viceControlFailure(
      "vice.protocol",
      reason,
      `VICE ${stage} handshake failed (${result.issue.reason}: ${result.issue.message}).`,
    );
  }

  /** Stores one stable terminal binary failure and releases every abandoned drain. */
  #terminalizeBinary(
    code: ViceControlFailureResult["issue"]["code"],
    reason: ViceControlFailureResult["issue"]["reason"],
    message: string,
  ): void {
    if (this.#binaryTerminal !== undefined) return;
    const failure = viceControlFailure<never>(code, reason, message);
    if (failure.ok) return;
    this.#binaryTerminal = failure;
    this.#cancelBinaryWrites();
    this.#failPending(failure.issue.code, failure.issue.reason, failure.issue.message);
    this.#retiredBinaryRequests.clear();
    this.#drainingBinaryReplies.clear();
    this.#accumulator.reset();
    this.#finishExecutionDrain();
  }

  /** Creates one session-owned cancellation capability for a raw binary write. */
  #beginBinaryWrite(): AbortController {
    const controller = new AbortController();
    this.#binaryWrites.add(controller);
    if (this.#signal.aborted || this.#closed || this.#binaryTerminal !== undefined) {
      controller.abort();
    }
    return controller;
  }

  /** Cancels every raw binary write that has not yet settled. */
  #cancelBinaryWrites(): void {
    for (const controller of this.#binaryWrites) controller.abort();
    this.#binaryWrites.clear();
  }

  /** Retains a cancelled request id until a known-sent command's late reply is discarded. */
  #retireBinaryRequest(requestId: number, writeSucceeded: boolean): void {
    if (this.#closed || this.#binaryTerminal !== undefined) return;
    this.#retiredBinaryRequests.add(requestId);
    if (writeSucceeded) {
      this.#drainingBinaryReplies.add(requestId);
      this.#ensurePump();
    }
  }

  /** Tracks a cancelled write's late settlement without abandoning a rejection or reply. */
  #trackLateBinaryWrite(requestId: number, settlement: Promise<ViceControlResultV1<true>>): void {
    this.#retireBinaryRequest(requestId, false);
    void settlement.then((result) => {
      if (this.#closed || this.#binaryTerminal !== undefined) return;
      if (!result.ok) {
        this.#retiredBinaryRequests.delete(requestId);
        this.#drainingBinaryReplies.delete(requestId);
        return;
      }
      this.#drainingBinaryReplies.add(requestId);
      this.#ensurePump();
    });
  }

  /** Writes one binary frame with operation cancellation and late-settlement tracking. */
  async #writeBinary(
    frame: Uint8Array,
    requestId: number,
    controller: AbortController,
  ): Promise<ViceControlResultV1<true>> {
    const outcome = await writeRawChannel(this.#binary, frame, controller.signal);
    this.#binaryWrites.delete(controller);
    if (this.#binaryTerminal !== undefined) return this.#binaryTerminal;
    if (outcome.kind === "settled") return outcome.result;
    if (outcome.settlement === undefined) {
      this.#retiredBinaryRequests.delete(requestId);
      this.#drainingBinaryReplies.delete(requestId);
    } else {
      this.#trackLateBinaryWrite(requestId, outcome.settlement);
    }
    return this.#cancelledFailure();
  }

  /** Issues one correlated command and snapshots the encoded frame before awaiting I/O. */
  async #send(type: number, body: Uint8Array): Promise<ViceControlResultV1<ResponseFrame>> {
    if (this.#closed) return this.#closedFailure();
    if (this.#binaryTerminal !== undefined) return this.#binaryTerminal;
    if (this.#signal.aborted) {
      this.#terminalizeBinary("vice.cancelled", "vice.cancelled", "VICE operation was cancelled.");
      return this.#binaryTerminal ?? this.#cancelledFailure();
    }
    const requestId = this.#takeRequestId();
    const frame = encodeViceControlCommandV1(type, requestId, body.slice());
    const writeController = this.#beginBinaryWrite();
    const response = new Promise<ViceControlResultV1<ResponseFrame>>((resolve) => {
      this.#pending.set(requestId, { resolve, writeSucceeded: false });
    });
    const write = await this.#writeBinary(frame, requestId, writeController);
    if (!write.ok) {
      const pending = this.#pending.get(requestId);
      if (pending !== undefined) {
        this.#pending.delete(requestId);
        pending.resolve(write);
        return write;
      }
      return response;
    }
    const pending = this.#pending.get(requestId);
    if (pending !== undefined) pending.writeSucceeded = true;
    else this.#retireBinaryRequest(requestId, true);
    this.#ensurePump();
    return response;
  }

  /** Starts at most one raw-channel read pump. */
  #ensurePump(): void {
    if (
      this.#pump !== undefined ||
      this.#closed ||
      this.#binaryTerminal !== undefined ||
      this.#signal.aborted
    ) {
      return;
    }
    this.#pump = this.#pumpFrames().finally(() => {
      this.#pump = undefined;
      if (
        !this.#closed &&
        this.#binaryTerminal === undefined &&
        !this.#signal.aborted &&
        (this.#pending.size > 0 ||
          this.#drainingBinaryReplies.size > 0 ||
          this.#advance !== undefined ||
          this.#continue !== undefined ||
          this.#drainingExecution)
      ) {
        this.#ensurePump();
      }
    });
  }

  /** Reads fragmented binary frames until no operation needs another frame. */
  async #pumpFrames(): Promise<void> {
    while (
      !this.#closed &&
      this.#binaryTerminal === undefined &&
      !this.#signal.aborted &&
      (this.#pending.size > 0 ||
        this.#drainingBinaryReplies.size > 0 ||
        this.#advance !== undefined ||
        this.#continue !== undefined ||
        this.#drainingExecution)
    ) {
      let read: ViceControlResultV1<Uint8Array | null>;
      try {
        read = await readRawChannel(this.#binary, this.#signal);
      } catch {
        this.#terminalizeBinary(
          "vice.io",
          "vice.transport",
          "VICE binary monitor read failed unexpectedly.",
        );
        return;
      }
      if (!read.ok) {
        this.#terminalizeBinary(read.issue.code, read.issue.reason, read.issue.message);
        return;
      }
      if (read.value === null) {
        const reason = this.#accumulator.partialBytes > 0 ? "vice.frame" : "vice.transport";
        this.#terminalizeBinary(
          reason === "vice.frame" ? "vice.protocol" : "vice.io",
          reason,
          "VICE binary monitor closed before completing pending work.",
        );
        return;
      }
      try {
        for (const frame of this.#accumulator.push(read.value)) this.#dispatchFrame(frame);
      } catch {
        this.#accumulator.reset();
        this.#terminalizeBinary("vice.protocol", "vice.frame", "VICE response frame is invalid.");
        return;
      }
    }
  }

  /** Correlates one validated frame or dispatches one unsolicited event. */
  #dispatchFrame(frame: ResponseFrame): void {
    if (frame.requestId === VICE_CONTROL_EVENT_REQUEST_ID_V1) {
      this.#dispatchEvent(frame);
      return;
    }
    const pending = this.#pending.get(frame.requestId);
    if (pending === undefined) {
      this.#retiredBinaryRequests.delete(frame.requestId);
      this.#drainingBinaryReplies.delete(frame.requestId);
      return;
    }
    this.#pending.delete(frame.requestId);
    if (frame.errorCode !== 0) {
      pending.resolve(
        viceControlFailure(
          "vice.protocol",
          "vice.transport",
          `VICE command returned error ${frame.errorCode} for response type ${frame.type}.`,
        ),
      );
    } else {
      pending.resolve(viceControlSuccess(frame));
    }
  }

  /** Settles an instruction advance from the first relevant unsolicited event. */
  #dispatchEvent(frame: ResponseFrame): void {
    if (this.#drainingExecution) {
      if (frame.type === STOPPED_EVENT) this.#finishExecutionDrain();
      return;
    }
    if (this.#continue !== undefined) {
      if (frame.type === CHECKPOINT_EVENT) {
        try {
          if (parseViceCheckpointEventV1(frame.body).hit) this.#continue.hitCheckpoint = true;
        } catch {
          const pending = this.#continue;
          this.#continue = undefined;
          pending.resolve(
            viceControlFailure("vice.protocol", "vice.frame", "VICE checkpoint event is invalid."),
          );
        }
        return;
      }
      if (frame.type === STOPPED_EVENT) {
        const pending = this.#continue;
        this.#continue = undefined;
        pending.resolve(viceControlSuccess(pending.hitCheckpoint ? "breakpoint" : "exit"));
        return;
      }
    }
    if (this.#advance === undefined) return;
    if (frame.type === STOPPED_EVENT) {
      this.#settleAdvance(viceControlSuccess(this.#advance.checkpoint));
      return;
    }
    if (frame.type !== CHECKPOINT_EVENT) return;
    try {
      const event = parseViceCheckpointEventV1(frame.body);
      if (event.hit) this.#advance.checkpoint = event.checkpoint;
    } catch {
      this.#settleAdvance(
        viceControlFailure("vice.protocol", "vice.frame", "VICE checkpoint event is invalid."),
      );
    }
  }

  /** Resolves and removes the active instruction event waiter. */
  #settleAdvance(result: ViceControlResultV1<ViceCheckpointHitV1 | null>): void {
    const advance = this.#advance;
    if (advance === undefined) return;
    this.#advance = undefined;
    advance.resolve(result);
  }

  /** Marks a cancelled execution epoch for STOPPED-event draining. */
  #markExecutionDrain(): void {
    if (this.#advance === undefined && this.#continue === undefined) return;
    if (this.#drainingExecution) return;
    this.#drainingExecution = true;
    this.#drainPromise = new Promise((resolve) => {
      this.#settleDrain = resolve;
    });
    this.#ensurePump();
  }

  /** Waits until the preceding cancelled execution reports its own STOPPED event. */
  async #awaitExecutionDrain(): Promise<void> {
    await this.#drainPromise;
  }

  /** Completes the cancelled execution epoch without exposing its late events. */
  #finishExecutionDrain(): void {
    if (!this.#drainingExecution) return;
    this.#drainingExecution = false;
    const settle = this.#settleDrain;
    this.#settleDrain = undefined;
    this.#drainPromise = undefined;
    settle?.();
  }

  /** Rejects every pending operation; map removal wins all later-frame races. */
  #failPending(
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
  ): void {
    for (const [requestId, pending] of this.#pending) {
      this.#pending.delete(requestId);
      if (reason === "vice.cancelled") {
        this.#retireBinaryRequest(requestId, pending.writeSucceeded);
      }
      pending.resolve(viceControlFailure(code, reason, message));
    }
    this.#settleAdvance(viceControlFailure(code, reason, message));
    const continued = this.#continue;
    this.#continue = undefined;
    if (reason === "vice.cancelled" && continued !== undefined) {
      this.#retireBinaryRequest(continued.requestId, continued.writeSucceeded);
    }
    continued?.resolve(viceControlFailure(code, reason, message));
  }

  /** Returns a request id that never collides with VICE's event id. */
  #takeRequestId(): number {
    const first = this.#nextRequestId;
    do {
      const requestId = this.#nextRequestId;
      this.#nextRequestId = requestId >= 0xfffffffe ? 1 : requestId + 1;
      if (!this.#pending.has(requestId) && !this.#retiredBinaryRequests.has(requestId)) {
        return requestId;
      }
    } while (this.#nextRequestId !== first);
    throw new RangeError("VICE request id space is exhausted by pending replies.");
  }

  /** Returns a typed terminal result for operations attempted after close. */
  #closedFailure<T>(): ViceControlResultV1<T> {
    return viceControlFailure("vice.closed", "vice.closed", "VICE session is closed.");
  }

  /** Returns the stable result for a caller or deadline abort. */
  #cancelledFailure<T>(): ViceControlResultV1<T> {
    return viceControlFailure("vice.cancelled", "vice.cancelled", "VICE operation was cancelled.");
  }

  /** Closes both channels before releasing the owned child. */
  async #closeResources(): Promise<ViceControlResultV1<true>> {
    return closeViceControlResourcesV1(this.#binary, this.#text, this.#child, this.#host);
  }
}
