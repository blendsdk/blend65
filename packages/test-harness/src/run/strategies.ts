/**
 * Run strategies (RD-12 §4.2, R20–R24, AC-03/04/05/06).
 *
 * The three public strategies tests use to drive a program to a sync point, each
 * wrapped in the MANDATORY shared timeout guard (R23/AC-06) — the load-bearing
 * safety property: no strategy can hang a test suite. The three exported functions
 * are the ONLY entry points and each wraps its body in {@link withTimeout}.
 */

import type { EmulatorDriver, Registers } from "../emulator/driver.js";

/** Default per-strategy timeout (R23). Overridable per call/test (R24). */
export const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Coarse c64 instructions-per-frame estimate for {@link runFrames} (PF-004). c64
 * ≈ 19656 cycles/frame ÷ ~3 cycles/instruction ≈ 6000 instructions. This is an
 * APPROXIMATE frame count, not a cycle-exact boundary (instructions ≠ cycles); a
 * cycle-exact frame primitive is a post-MVP refinement (PF-004, ST-22).
 */
const INSTRUCTIONS_PER_FRAME = 6000;

/** Instruction batch size between memory polls in {@link runUntilMemory}. */
const MEMORY_POLL_BATCH = 20000;

/** Thrown by the mandatory timeout guard when a strategy exceeds its budget (R23). */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * The mandatory timeout guard (R23/AC-06). Races `work` against a timer that
 * rejects with a {@link TimeoutError} naming the strategy. Deadline-bounded loops
 * (see {@link runUntilMemory}) also self-terminate so no work spins on past the
 * rejection.
 */
function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}

/** A short sample of available symbol keys for a helpful "unknown label" message. */
function sampleKeys(symbols: Map<string, number>): string {
  return [...symbols.keys()].slice(0, 8).join(", ");
}

/**
 * Break at a labeled address and return the registers there (R20, AC-03). Resolves
 * `label` via `symbols` (keys per `parseLabelFile` — no leading dot).
 *
 * @throws If `label` is absent from `symbols` (guards the DEF-2 class of failure).
 */
export function runUntilLabel(
  driver: EmulatorDriver,
  symbols: Map<string, number>,
  label: string,
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<Registers> {
  const address = symbols.get(label);
  if (address === undefined) {
    throw new Error(
      `runUntilLabel: label '${label}' is not in the symbol map. Available: ${sampleKeys(symbols)}`,
    );
  }
  const work = (async (): Promise<Registers> => {
    await driver.setBreakpoint(address);
    const reason = await driver.resume();
    if (reason !== "breakpoint") {
      throw new Error(`runUntilLabel('${label}'): resumed to '${reason}', not the breakpoint`);
    }
    return driver.readRegisters();
  })();
  return withTimeout(work, timeout, `runUntilLabel('${label}')`);
}

/**
 * Run for approximately `frames` video frames (R21, AC-04) by advancing an
 * instructions-per-frame estimate per frame, guard-bounded. AC-04 is verified at
 * the "advances and completes within the guard" level (ST-22, PF-004).
 */
export function runFrames(
  driver: EmulatorDriver,
  frames: number,
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const work = (async (): Promise<void> => {
    for (let i = 0; i < frames; i++) {
      await driver.advanceInstructions(INSTRUCTIONS_PER_FRAME);
    }
  })();
  return withTimeout(work, timeout, `runFrames(${frames})`);
}

/**
 * Poll a memory address until it holds `value` (R22, AC-05) — the gate program's
 * primary proof (AR-H9). Advances the CPU in instruction batches and reads the
 * byte between batches until it matches or the guard fires. The loop is
 * deadline-bounded so it self-terminates on timeout rather than spinning on.
 */
export function runUntilMemory(
  driver: EmulatorDriver,
  address: number,
  value: number,
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeout;
  const work = (async (): Promise<void> => {
    for (;;) {
      const byte = (await driver.readMemory(address, 1))[0];
      if (byte === value) return;
      if (Date.now() >= deadline) {
        throw new TimeoutError(
          `runUntilMemory($${address.toString(16)}, ${value}) timed out after ${timeout}ms`,
        );
      }
      await driver.advanceInstructions(MEMORY_POLL_BATCH);
    }
  })();
  return withTimeout(work, timeout, `runUntilMemory($${address.toString(16)}, ${value})`);
}
