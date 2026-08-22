/**
 * Backward-compatible emulator driver over the production VICE control runtime.
 *
 * The compatibility layer retains the historic argv ordering and public
 * `EmulatorDriver` behavior while one shared runtime now owns spawning,
 * framing, response correlation, version/target probes, cancellation, and
 * cleanup. VICE is always spawned with an argv array and both monitors bind
 * to loopback-only endpoints.
 */

import type { BreakReason, EmulatorDriver, LaunchOptions, Registers } from "../driver.js";
import { encodePng } from "./png.js";
import { NodeViceControlHost } from "./vice-control-host.js";
import { createViceControlRuntimeV1 } from "./vice-control.js";
import { ViceControlSession } from "./vice-control-session.js";

/** Historic default binary-monitor port. */
const DEFAULT_MONITOR_PORT = 6502;

/** 6502 status-register bit positions exposed through the legacy flags shape. */
const FLAG_BIT = {
  carry: 0,
  zero: 1,
  interrupt: 2,
  decimal: 3,
  break_: 4,
  overflow: 6,
  negative: 7,
} as const;

/** Throws a bounded compatibility error for one failed control operation. */
function requireControl<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly issue: { readonly message: string } },
): T {
  if (!result.ok) throw new Error(result.issue.message);
  return result.value;
}

/**
 * Existing public VICE driver, implemented as a compatibility wrapper.
 *
 * @example
 * ```ts
 * const driver = new ViceDriver();
 * await driver.launch({ executablePath: "x64sc" });
 * const registers = await driver.readRegisters();
 * await driver.shutdown();
 * ```
 */
export class ViceDriver implements EmulatorDriver {
  /** Handshaken production control session, present only between launch and shutdown. */
  private session: ViceControlSession | undefined;

  /** Builds the exact historic process argument order. */
  private buildArgs(options: LaunchOptions): {
    readonly executable: string;
    readonly argv: readonly string[];
    readonly binaryPort: number;
    readonly textPort: number;
  } {
    const binaryPort = options.monitorPort ?? DEFAULT_MONITOR_PORT;
    const textPort = options.remoteMonitorPort ?? binaryPort + 1;
    const argv: string[] = [
      "-binarymonitor",
      "-binarymonitoraddress",
      `127.0.0.1:${binaryPort}`,
      "-remotemonitor",
      "-remotemonitoraddress",
      `127.0.0.1:${textPort}`,
      "+sound",
    ];
    if (options.gui !== true) argv.push("-warp", "-console", "-silent");
    if (options.extraArgs !== undefined) argv.push(...options.extraArgs);
    return { executable: options.executablePath, argv, binaryPort, textPort };
  }

  /** Launches one VICE child through the compatibility handshake profile. */
  async launch(options: LaunchOptions): Promise<void> {
    if (this.session !== undefined) throw new Error("ViceDriver is already launched");
    const request = this.buildArgs(options);
    const launched = await createViceControlRuntimeV1(new NodeViceControlHost()).launch(
      {
        executable: request.executable,
        argv: request.argv,
        cwd: process.cwd(),
        endpoints: {
          binaryPort: request.binaryPort,
          textPort: request.textPort,
        },
        handshake: {
          target: "c64",
          version: { major: 3, minimumMinor: 6, maximumMinor: 255 },
          endpointOwnership: "compatibility",
        },
      },
      new AbortController().signal,
    );
    const session = requireControl(launched);
    if (!(session instanceof ViceControlSession)) {
      await session.close();
      throw new Error("VICE control runtime returned an incompatible session");
    }
    this.session = session;
  }

  /** Retains the historic relaunch-per-binary behavior. */
  async loadBinary(_binaryPath: string): Promise<void> {
    return;
  }

  /** Sets one stopping execute checkpoint. */
  async setBreakpoint(address: number): Promise<void> {
    await this.setCheckpoint(address);
  }

  /** Sets one stopping execute checkpoint and returns its VICE id. */
  async setCheckpoint(address: number): Promise<number> {
    return requireControl(await this.requireSession().setCheckpoint(address, "execute"));
  }

  /** Deletes one exact checkpoint. */
  async deleteCheckpoint(checkpointNumber: number): Promise<void> {
    requireControl(await this.requireSession().deleteLegacyCheckpoint(checkpointNumber));
  }

  /** Continues until VICE reports the next stopped state. */
  async resume(): Promise<BreakReason> {
    return requireControl(await this.requireSession().continueLegacy());
  }

  /** Reads and maps all named main-CPU registers. */
  async readRegisters(): Promise<Registers> {
    const values = requireControl(await this.requireSession().readLegacyRegisters());
    const read = (name: string): number => values.get(name) ?? 0;
    const flags = read("FL");
    return {
      a: read("A") & 0xff,
      x: read("X") & 0xff,
      y: read("Y") & 0xff,
      sp: read("SP") & 0xff,
      pc: read("PC") & 0xffff,
      flags: {
        carry: (flags & (1 << FLAG_BIT.carry)) !== 0,
        zero: (flags & (1 << FLAG_BIT.zero)) !== 0,
        interrupt: (flags & (1 << FLAG_BIT.interrupt)) !== 0,
        decimal: (flags & (1 << FLAG_BIT.decimal)) !== 0,
        break_: (flags & (1 << FLAG_BIT.break_)) !== 0,
        overflow: (flags & (1 << FLAG_BIT.overflow)) !== 0,
        negative: (flags & (1 << FLAG_BIT.negative)) !== 0,
      },
    };
  }

  /** Reads a fresh memory snapshot. */
  async readMemory(start: number, length: number): Promise<Uint8Array> {
    return requireControl(await this.requireSession().readMemory(start, length));
  }

  /** Writes a defensive copy into emulator memory. */
  async writeMemory(address: number, data: Uint8Array): Promise<void> {
    requireControl(await this.requireSession().writeMemory(address, data));
  }

  /** Captures the indexed display and encodes it as a PNG. */
  async captureScreenshot(): Promise<Buffer> {
    const captured = requireControl(await this.requireSession().readLegacyDisplay());
    return encodePng(captured.display, captured.palette);
  }

  /** Idempotently closes monitors and the owned child. */
  async shutdown(): Promise<void> {
    const session = this.session;
    this.session = undefined;
    if (session !== undefined) requireControl(await session.close());
  }

  /** Advances by an exact validated instruction count and waits for stop. */
  async advanceInstructions(count: number): Promise<void> {
    requireControl(await this.requireSession().advanceInstructions(count));
  }

  /** Writes a supported subset of named CPU registers. */
  async writeRegisters(
    values: Partial<Record<"a" | "x" | "y" | "sp" | "pc" | "fl", number>>,
  ): Promise<void> {
    const names: Readonly<Record<string, string>> = {
      a: "A",
      x: "X",
      y: "Y",
      sp: "SP",
      pc: "PC",
      fl: "FL",
    };
    const registers = new Map<string, number>();
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) registers.set(names[key], value);
    }
    requireControl(await this.requireSession().writeLegacyRegisters(registers));
  }

  /** Executes until VICE observes a subroutine return. */
  async executeUntilReturn(): Promise<void> {
    requireControl(await this.requireSession().executeUntilReturnLegacy());
  }

  /** Reads the absolute machine-cycle stopwatch as a safe JavaScript number. */
  async readStopwatch(): Promise<number> {
    const value = requireControl(await this.requireSession().readStopwatch());
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RangeError("VICE stopwatch exceeds JavaScript's safe integer range");
    }
    return Number(value);
  }

  /** Returns the active internal session or rejects use before launch. */
  private requireSession(): ViceControlSession {
    if (this.session === undefined) throw new Error("ViceDriver is not connected");
    return this.session;
  }
}
