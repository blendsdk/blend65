/**
 * Run strategies.
 *
 * The public strategies tests use to drive a program to a sync point, each
 * wrapped in the MANDATORY shared timeout guard — the load-bearing safety
 * property: no strategy can hang a test suite. Every entry point here wraps its
 * body in {@link withTimeout}; the guard itself is also exported for the
 * cycle-measurement helpers (`./measure.js`), which uphold the same property.
 */

import type { EmulatorDriver, Registers } from "../emulator/driver.js";
import { isCycleMeasurementDriver } from "./measure.js";

/** Default per-strategy timeout. Overridable per call/test. */
export const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Coarse c64 instructions-per-frame estimate for {@link runFrames}. c64
 * ≈ 19656 cycles/frame ÷ ~3 cycles/instruction ≈ 6000 instructions. This is an
 * APPROXIMATE frame count, not a cycle-exact boundary (instructions ≠ cycles); a
 * cycle-exact frame primitive is a post-MVP refinement.
 */
const INSTRUCTIONS_PER_FRAME = 6000;

/** Instruction batch size between memory polls in {@link runUntilMemory}. */
const MEMORY_POLL_BATCH = 20000;

/** Thrown by the mandatory timeout guard when a strategy exceeds its budget. */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * The mandatory timeout guard. Races `work` against a timer that rejects with
 * a {@link TimeoutError} naming the strategy. Deadline-bounded loops (see
 * {@link runUntilMemory}) also self-terminate so no work spins on past the
 * rejection.
 *
 * @param work The promise to guard.
 * @param ms The timeout budget in milliseconds.
 * @param label The operation name carried by the {@link TimeoutError}.
 * @returns The settled `work` result, or a rejection when the timer fires first.
 * @example
 * await withTimeout(driver.resume(), 5000, "resume to demo_from");
 */
export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
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
 * Break at a labeled address and return the registers there. Resolves
 * `label` via `symbols` (keys per `parseLabelFile` — no leading dot).
 *
 * @throws If `label` is absent from `symbols`.
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
 * Run to the `arrivals`-th arrival at `label`; the machine is STOPPED at
 * that arrival on return.
 *
 * One TRACKED checkpoint is set at the label, the machine resumes once per
 * arrival — resuming from a stop AT the armed address fires on the NEXT
 * arrival — and the checkpoint is deleted on every exit path (success,
 * error, timeout), so later strategies in the same session never stop on a
 * stale checkpoint. Requires the cycle-measurement driver capabilities
 * (tracked checkpoints); the shared observables runner is the primary
 * consumer, stopping frame-looping programs for deterministic checks.
 *
 * @param baseDriver The launched driver (must provide tracked checkpoints).
 * @param symbols The program's label map (keys without the leading dot).
 * @param label The label whose n-th arrival to stop at.
 * @param arrivals Which arrival to stop at (1 = first).
 * @param timeout Overall guard in milliseconds.
 * @returns The register file at the stopped n-th arrival.
 * @throws {Error} If `arrivals` is not a positive integer, the driver lacks
 *   tracked checkpoints, `label` is unknown, or a stop lands elsewhere; a
 *   {@link TimeoutError} when an arrival never comes.
 * @example
 * const regs = await runUntilLabelArrivals(driver, symbols, "Main_main_L0", 2);
 */
export function runUntilLabelArrivals(
  baseDriver: EmulatorDriver,
  symbols: Map<string, number>,
  label: string,
  arrivals: number,
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<Registers> {
  if (!Number.isInteger(arrivals) || arrivals < 1) {
    throw new Error(
      `runUntilLabelArrivals: arrivals must be a positive integer, got ${String(arrivals)}`,
    );
  }
  if (!isCycleMeasurementDriver(baseDriver)) {
    throw new Error(
      "runUntilLabelArrivals: this driver does not provide cycle-measurement capabilities",
    );
  }
  const driver = baseDriver;
  const address = symbols.get(label);
  if (address === undefined) {
    throw new Error(
      `runUntilLabelArrivals: label '${label}' is not in the symbol map. ` +
        `Available: ${sampleKeys(symbols)}`,
    );
  }

  return (async (): Promise<Registers> => {
    const checkpoint = await driver.setCheckpoint(address);
    try {
      const work = (async (): Promise<Registers> => {
        for (let arrival = 1; arrival <= arrivals; arrival++) {
          const reason = await driver.resume();
          if (reason !== "breakpoint") {
            throw new Error(
              `runUntilLabelArrivals('${label}'): resumed to '${reason}', not the checkpoint`,
            );
          }
        }
        const registers = await driver.readRegisters();
        if (registers.pc !== address) {
          throw new Error(
            `runUntilLabelArrivals('${label}'): stopped at PC ` +
              `$${registers.pc.toString(16).padStart(4, "0")}, expected ` +
              `$${address.toString(16).padStart(4, "0")}`,
          );
        }
        return registers;
      })();
      // The checkpoint lives OUTSIDE the race so the finally still deletes
      // it when the guard fires while a resume is in flight.
      return await withTimeout(work, timeout, `runUntilLabelArrivals('${label}', ${arrivals})`);
    } finally {
      try {
        await driver.deleteCheckpoint(checkpoint);
      } catch {
        /* the primary outcome stands */
      }
    }
  })();
}

/**
 * Run for approximately `frames` video frames by advancing an
 * instructions-per-frame estimate per frame, guard-bounded. This is verified
 * at the "advances and completes within the guard" level.
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
 * Poll a memory address until it holds `value` — the gate program's primary
 * proof. Advances the CPU in instruction batches and reads the byte between
 * batches until it matches or the guard fires. The loop is deadline-bounded
 * so it self-terminates on timeout rather than spinning on.
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
