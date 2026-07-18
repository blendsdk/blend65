/**
 * Abstract emulator-driver contract.
 *
 * The published interface every concrete driver implements. A driver loads a
 * binary into an emulated 6502 platform, runs it, and reports register/memory
 * state — the substrate the run strategies (`src/run/strategies.ts`) and the
 * assertion helpers (`src/run/assertions.ts`) build on. The MVP concrete
 * implementation is `ViceDriver` (`vice/vice-driver.ts`), speaking VICE's
 * binary-monitor protocol.
 *
 * Uses the reserved-word work-around `Registers.flags.break_` for the Break
 * flag, since `break` is a reserved word — no divergence from the published
 * shape otherwise.
 */

/**
 * A driver over an emulated 6502 platform. Any emulator that can load a
 * binary, run it, and report register/memory state implements this.
 */
export interface EmulatorDriver {
  /** Launch the emulator process and connect its control channel. */
  launch(options: LaunchOptions): Promise<void>;
  /** Load a binary into the emulator (a no-op when the binary was autostarted at launch). */
  loadBinary(binaryPath: string): Promise<void>;
  /** Set an execution breakpoint at `address`. */
  setBreakpoint(address: number): Promise<void>;
  /** Resume execution, resolving with why the machine next stopped. */
  resume(): Promise<BreakReason>;
  /**
   * Advance the CPU by `count` instructions, then re-stop. The incremental-step
   * primitive `runUntilMemory`/`runFrames` poll between calls, since `resume()`
   * alone cannot poll a running machine.
   */
  advanceInstructions(count: number): Promise<void>;
  /** Read the current CPU registers. */
  readRegisters(): Promise<Registers>;
  /** Read `length` bytes of memory starting at `start`. */
  readMemory(start: number, length: number): Promise<Uint8Array>;
  /** Write `data` to memory starting at `address`. */
  writeMemory(address: number, data: Uint8Array): Promise<void>;
  /** Capture the current display as a PNG buffer (failure artifact only). */
  captureScreenshot(): Promise<Buffer>;
  /** Shut the emulator down and release its resources. */
  shutdown(): Promise<void>;
}

/** Options controlling {@link EmulatorDriver.launch}. */
export interface LaunchOptions {
  /** Absolute path to the emulator executable (e.g. VICE's `x64sc`). */
  executablePath: string;
  /** Control-channel TCP port; defaults to 6502, bound to 127.0.0.1 only. */
  monitorPort?: number;
  /**
   * Remote TEXT-monitor TCP port (the stopwatch transport); defaults to
   * `monitorPort + 1`, bound to 127.0.0.1 only. Callers that acquire the
   * monitor port dynamically should acquire and pass this one too — the +1
   * neighbor of an ephemeral port is otherwise unchecked.
   */
  remoteMonitorPort?: number;
  /** Show the emulator GUI window; defaults to false (headless). */
  gui?: boolean;
  /** Extra emulator CLI arguments, appended verbatim. */
  extraArgs?: string[];
}

/** The 6502 register file as reported by {@link EmulatorDriver.readRegisters}. */
export interface Registers {
  /** Accumulator. */
  a: number;
  /** X index register. */
  x: number;
  /** Y index register. */
  y: number;
  /** Stack pointer (low byte). */
  sp: number;
  /** Program counter. */
  pc: number;
  /** The decoded processor-status (P) flags. */
  flags: {
    /** Carry (C). */
    carry: boolean;
    /** Zero (Z). */
    zero: boolean;
    /** Interrupt-disable (I). */
    interrupt: boolean;
    /** Decimal (D). */
    decimal: boolean;
    /** Break (B) — spelled `break_` since `break` is a reserved word. */
    break_: boolean;
    /** Overflow (V). */
    overflow: boolean;
    /** Negative (N). */
    negative: boolean;
  };
}

/** Why {@link EmulatorDriver.resume} stopped. */
export type BreakReason = "breakpoint" | "timeout" | "exit";
