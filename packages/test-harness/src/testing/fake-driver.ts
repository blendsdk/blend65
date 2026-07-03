/**
 * An in-memory {@link EmulatorDriver} for the CI-tier strategy/assertion tests
 * (07 §Mock Requirements). A REAL object implementing the interface — not a mock
 * framework — so the timeout guard, assertions, and symbolic resolution are
 * exercised with no emulator (the true external, VICE, is covered by the Local
 * tier). Test-only support: NOT re-exported from the package barrel (mirrors the
 * compiler `test-fixtures.ts` precedent).
 */

import type { BreakReason, EmulatorDriver, LaunchOptions, Registers } from "../emulator/driver.js";

/** A promise that never resolves — models a driver that "never breaks" (ST-14/15). */
const NEVER = new Promise<never>(() => {});

/** Zeroed default registers for the fake. */
function zeroRegisters(): Registers {
  return {
    a: 0,
    x: 0,
    y: 0,
    sp: 0,
    pc: 0,
    flags: {
      carry: false,
      zero: false,
      interrupt: false,
      decimal: false,
      break_: false,
      overflow: false,
      negative: false,
    },
  };
}

/** Behaviour knobs for {@link FakeDriver}. */
export interface FakeDriverOptions {
  /** What `resume()` resolves to, or `"hang"` to never resolve (timeout test). Default `"breakpoint"`. */
  resume?: BreakReason | "hang";
  /** Whether `advanceInstructions()` resolves (`"ok"`) or hangs (timeout test). Default `"ok"`. */
  advance?: "ok" | "hang";
  /** Register file `readRegisters()` reports. Default all-zero. */
  registers?: Registers;
  /** Sparse memory contents (address → byte); unset addresses read as 0. */
  memory?: Map<number, number>;
}

/** In-memory {@link EmulatorDriver} with scriptable resume/advance/memory behaviour. */
export class FakeDriver implements EmulatorDriver {
  /** Addresses passed to `setBreakpoint`, in order (for assertions). */
  readonly breakpoints: number[] = [];
  /** `advanceInstructions` call count (proves a strategy actually stepped). */
  advanceCalls = 0;
  /** Whether `launch`/`shutdown` were called. */
  launched = false;
  shutdownCalled = false;

  private readonly memory: Map<number, number>;
  private readonly options: FakeDriverOptions;

  constructor(options: FakeDriverOptions = {}) {
    this.options = options;
    this.memory = options.memory ?? new Map<number, number>();
  }

  async launch(_options: LaunchOptions): Promise<void> {
    this.launched = true;
  }

  async loadBinary(_binaryPath: string): Promise<void> {}

  async setBreakpoint(address: number): Promise<void> {
    this.breakpoints.push(address);
  }

  resume(): Promise<BreakReason> {
    if (this.options.resume === "hang") {
      return NEVER;
    }
    return Promise.resolve(this.options.resume ?? "breakpoint");
  }

  advanceInstructions(_count: number): Promise<void> {
    this.advanceCalls += 1;
    if (this.options.advance === "hang") {
      return NEVER;
    }
    return Promise.resolve();
  }

  async readRegisters(): Promise<Registers> {
    return this.options.registers ?? zeroRegisters();
  }

  async readMemory(start: number, length: number): Promise<Uint8Array> {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      out[i] = this.memory.get(start + i) ?? 0;
    }
    return out;
  }

  async writeMemory(address: number, data: Uint8Array): Promise<void> {
    for (let i = 0; i < data.length; i++) {
      this.memory.set(address + i, data[i]);
    }
  }

  async captureScreenshot(): Promise<Buffer> {
    return Buffer.alloc(0);
  }

  async shutdown(): Promise<void> {
    this.shutdownCalled = true;
  }
}
