/**
 * `ViceDriver` — the MVP {@link EmulatorDriver} over VICE `x64sc`'s binary-monitor
 * protocol.
 *
 * Composes the pure {@link ./protocol.js codec} with a loopback `net.Socket` and a
 * spawned `x64sc` child process. Security: the monitor binds `127.0.0.1` only,
 * VICE is spawned via an argv ARRAY (no shell string — injection-safe), and
 * the only runtime deps are Node built-ins (`net`, `child_process`, `zlib` via
 * `png.ts`).
 *
 * Register ids are resolved dynamically from `REGISTERS_AVAILABLE` at connect
 * rather than hardcoded — robust across VICE versions.
 */

import { type ChildProcess, spawn } from "node:child_process";
import net from "node:net";
import type { BreakReason, EmulatorDriver, LaunchOptions, Registers } from "../driver.js";
import { encodePng } from "./png.js";
import {
  advanceInstructionsBody,
  CMD,
  decodeResponses,
  displayGetBody,
  encodeCommand,
  EVENT_REQUEST_ID,
  executeUntilReturnBody,
  memoryGetBody,
  memorySetBody,
  paletteGetBody,
  parseCheckpointInfo,
  parseDisplayGet,
  parseMemoryGet,
  parsePaletteGet,
  parseRegistersAvailable,
  parseRegistersGet,
  checkpointSetBody,
  registersAvailableBody,
  registersGetBody,
  registersSetBody,
  RESP,
  type ResponseFrame,
} from "./protocol.js";

/** Default monitor port — overridable via {@link LaunchOptions}. */
const DEFAULT_MONITOR_PORT = 6502;
/** Bounded connect-retry window while VICE binds its monitor socket. */
const CONNECT_MAX_ATTEMPTS = 60;
const CONNECT_RETRY_MS = 250;
/** Grace period for the child to exit after QUIT before a hard kill. */
const SHUTDOWN_GRACE_MS = 2000;

/** The 6502 status (P) register bit positions, mapped to {@link Registers.flags}. */
const FLAG_BIT = {
  carry: 0,
  zero: 1,
  interrupt: 2,
  decimal: 3,
  break_: 4,
  overflow: 6,
  negative: 7,
} as const;

/** A pending request awaiting its response frame. */
interface Pending {
  resolve: (frame: ResponseFrame) => void;
  reject: (err: Error) => void;
}

export class ViceDriver implements EmulatorDriver {
  private child: ChildProcess | undefined;
  private socket: net.Socket | undefined;
  private accumulator: Uint8Array = new Uint8Array(0);
  private readonly pending = new Map<number, Pending>();
  private nextRequestId = 1;
  /** VICE register name → numeric id, from `REGISTERS_AVAILABLE`. */
  private registerIds = new Map<string, number>();

  /** The active `resume()` waiter and whether a checkpoint was hit since resuming. */
  private resumeWaiter: ((reason: BreakReason) => void) | undefined;
  private resumeHitCheckpoint = false;

  /** Build the emulator argv (array — never a shell string; injection-safe). */
  private buildArgs(options: LaunchOptions): { exe: string; args: string[]; port: number } {
    const port = options.monitorPort ?? DEFAULT_MONITOR_PORT;
    const args = [
      "-binarymonitor",
      "-binarymonitoraddress",
      `127.0.0.1:${port}`,
      "+sound",
    ];
    if (options.gui !== true) {
      // Headless: console mode (no video window) + warp speed for a fast local run.
      args.push("-warp", "-console", "-silent");
    }
    if (options.extraArgs !== undefined) {
      args.push(...options.extraArgs);
    }
    return { exe: options.executablePath, args, port };
  }

  async launch(options: LaunchOptions): Promise<void> {
    const { exe, args, port } = this.buildArgs(options);
    this.child = spawn(exe, args, { stdio: ["ignore", "ignore", "ignore"] });
    this.child.on("error", () => {
      /* surfaced by the connect-retry rejecting; also rejects pending on close */
    });
    this.child.on("close", () => this.failAllPending(new Error("VICE process exited")));

    this.socket = await this.connectWithRetry(port);
    this.socket.on("data", (chunk) => this.onData(chunk));
    this.socket.on("close", () => this.failAllPending(new Error("monitor socket closed")));
    this.socket.on("error", () => {
      /* close handler performs the rejection */
    });

    // Resolve register ids up-front; fail fast if the core set is absent.
    const frame = await this.send(CMD.REGISTERS_AVAILABLE, registersAvailableBody());
    this.registerIds = parseRegistersAvailable(frame.body);
    for (const name of ["A", "X", "Y", "SP", "PC", "FL"]) {
      if (!this.registerIds.has(name)) {
        throw new Error(
          `VICE REGISTERS_AVAILABLE is missing register '${name}'. ` +
            `Available: ${[...this.registerIds.keys()].join(", ")}`,
        );
      }
    }
  }

  async loadBinary(_binaryPath: string): Promise<void> {
    // MVP relaunch-per-binary lifecycle: the binary is autostarted at
    // launch via `extraArgs`, so there is nothing to load mid-session.
    return;
  }

  async setBreakpoint(address: number): Promise<void> {
    await this.send(CMD.CHECKPOINT_SET, checkpointSetBody(address));
  }

  resume(): Promise<BreakReason> {
    return new Promise<BreakReason>((resolve) => {
      this.resumeHitCheckpoint = false;
      this.resumeWaiter = resolve;
      // EXIT (0xaa) leaves the monitor and continues the CPU. Fire-and-forget: the
      // stop is reported asynchronously via the STOPPED/CHECKPOINT_INFO events.
      this.writeFrame(CMD.EXIT, new Uint8Array(0));
    });
  }

  async readRegisters(): Promise<Registers> {
    const frame = await this.send(CMD.REGISTERS_GET, registersGetBody());
    const values = parseRegistersGet(frame.body);
    const read = (name: string): number => values.get(this.registerIds.get(name)!) ?? 0;
    const p = read("FL");
    return {
      a: read("A") & 0xff,
      x: read("X") & 0xff,
      y: read("Y") & 0xff,
      sp: read("SP") & 0xff,
      pc: read("PC") & 0xffff,
      flags: {
        carry: (p & (1 << FLAG_BIT.carry)) !== 0,
        zero: (p & (1 << FLAG_BIT.zero)) !== 0,
        interrupt: (p & (1 << FLAG_BIT.interrupt)) !== 0,
        decimal: (p & (1 << FLAG_BIT.decimal)) !== 0,
        break_: (p & (1 << FLAG_BIT.break_)) !== 0,
        overflow: (p & (1 << FLAG_BIT.overflow)) !== 0,
        negative: (p & (1 << FLAG_BIT.negative)) !== 0,
      },
    };
  }

  async readMemory(start: number, length: number): Promise<Uint8Array> {
    const frame = await this.send(CMD.MEMORY_GET, memoryGetBody(start, start + length - 1));
    return parseMemoryGet(frame.body);
  }

  async writeMemory(address: number, data: Uint8Array): Promise<void> {
    await this.send(CMD.MEMORY_SET, memorySetBody(address, data));
  }

  async captureScreenshot(): Promise<Buffer> {
    const display = await this.send(CMD.DISPLAY_GET, displayGetBody());
    const palette = await this.send(CMD.PALETTE_GET, paletteGetBody());
    return encodePng(parseDisplayGet(display.body), parsePaletteGet(palette.body));
  }

  async shutdown(): Promise<void> {
    if (this.socket !== undefined) {
      this.writeFrame(CMD.QUIT, new Uint8Array(0));
    }
    const child = this.child;
    await new Promise<void>((resolve) => {
      if (child === undefined || child.exitCode !== null || child.killed) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, SHUTDOWN_GRACE_MS);
      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    this.socket?.destroy();
    this.socket = undefined;
    this.child = undefined;
  }

  async advanceInstructions(count: number): Promise<void> {
    await this.send(CMD.ADVANCE_INSTRUCTIONS, advanceInstructionsBody(count));
  }

  /**
   * Write CPU registers by name (a/x/y/sp/pc) via REGISTERS_SET, resolving ids
   * through the REGISTERS_AVAILABLE map. A driver-specific extension beyond the
   * {@link EmulatorDriver} contract — used by the runtime routine vectors to
   * seed a routine's ABI inputs and entry PC (not part of the published API).
   */
  async writeRegisters(values: Partial<Record<"a" | "x" | "y" | "sp" | "pc", number>>): Promise<void> {
    const nameForKey: Record<string, string> = { a: "A", x: "X", y: "Y", sp: "SP", pc: "PC" };
    const items: Array<{ id: number; value: number }> = [];
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) continue;
      const id = this.registerIds.get(nameForKey[key]);
      if (id === undefined) {
        throw new Error(`writeRegisters: register '${key}' is not available on this VICE`);
      }
      items.push({ id, value });
    }
    if (items.length > 0) {
      await this.send(CMD.REGISTERS_SET, registersSetBody(items));
    }
  }

  /** Run the EXECUTE_UNTIL_RETURN command (used by the runtime routine vectors). */
  async executeUntilReturn(): Promise<void> {
    await this.send(CMD.EXECUTE_UNTIL_RETURN, executeUntilReturnBody());
  }

  // ─────────────────────────── transport internals ───────────────────────────

  private connectWithRetry(port: number): Promise<net.Socket> {
    return new Promise<net.Socket>((resolve, reject) => {
      let attempts = 0;
      const attempt = (): void => {
        const socket = net.connect(port, "127.0.0.1");
        socket.once("connect", () => resolve(socket));
        socket.once("error", () => {
          socket.destroy();
          attempts += 1;
          if (attempts >= CONNECT_MAX_ATTEMPTS) {
            reject(new Error(`could not connect to the VICE monitor on 127.0.0.1:${port}`));
          } else {
            setTimeout(attempt, CONNECT_RETRY_MS);
          }
        });
      };
      attempt();
    });
  }

  /** Write a framed command without registering a response waiter (fire-and-forget). */
  private writeFrame(type: number, body: Uint8Array): void {
    const id = this.takeRequestId();
    this.socket?.write(Buffer.from(encodeCommand(type, id, body)));
  }

  /** Send a command and resolve with its correlated response frame. */
  private send(type: number, body: Uint8Array): Promise<ResponseFrame> {
    return new Promise<ResponseFrame>((resolve, reject) => {
      if (this.socket === undefined) {
        reject(new Error("ViceDriver is not connected"));
        return;
      }
      const id = this.takeRequestId();
      this.pending.set(id, { resolve, reject });
      this.socket.write(Buffer.from(encodeCommand(type, id, body)));
    });
  }

  private takeRequestId(): number {
    const id = this.nextRequestId;
    // Stay in [1, 0xfffffe] — 0xffffffff is reserved for unsolicited events.
    this.nextRequestId = this.nextRequestId >= 0xfffffe ? 1 : this.nextRequestId + 1;
    return id;
  }

  private onData(chunk: Buffer): void {
    const merged = new Uint8Array(this.accumulator.length + chunk.length);
    merged.set(this.accumulator, 0);
    merged.set(chunk, this.accumulator.length);
    const { frames, consumed } = decodeResponses(merged);
    this.accumulator = merged.slice(consumed);
    for (const frame of frames) {
      if (frame.requestId === EVENT_REQUEST_ID) {
        this.handleEvent(frame);
        continue;
      }
      const waiter = this.pending.get(frame.requestId);
      if (waiter === undefined) {
        continue;
      }
      this.pending.delete(frame.requestId);
      if (frame.errorCode !== 0) {
        waiter.reject(new Error(`VICE command failed (type 0x${frame.type.toString(16)}, error ${frame.errorCode})`));
      } else {
        waiter.resolve(frame);
      }
    }
  }

  private handleEvent(frame: ResponseFrame): void {
    switch (frame.type) {
      case RESP.CHECKPOINT_INFO:
        if (parseCheckpointInfo(frame.body).hit) {
          this.resumeHitCheckpoint = true;
        }
        break;
      case RESP.STOPPED: {
        const waiter = this.resumeWaiter;
        if (waiter !== undefined) {
          this.resumeWaiter = undefined;
          waiter(this.resumeHitCheckpoint ? "breakpoint" : "exit");
        }
        break;
      }
      default:
        // RESUMED / JAM and other events are informational for the MVP.
        break;
    }
  }

  private failAllPending(err: Error): void {
    for (const [, waiter] of this.pending) {
      waiter.reject(err);
    }
    this.pending.clear();
    if (this.resumeWaiter !== undefined) {
      const waiter = this.resumeWaiter;
      this.resumeWaiter = undefined;
      waiter("exit");
    }
  }
}
