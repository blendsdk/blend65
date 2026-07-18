/**
 * Exact cycle measurement between two labeled program points.
 *
 * `measureCycles` stops the program at both labels via execution checkpoints
 * and reads VICE's absolute machine-cycle stopwatch at each stop; the
 * difference is the window's elapsed cost. `quiesce` forces a stopped program
 * into a phase-locked state (interrupts masked, optionally display blanked)
 * so a window measured on a program with no interrupt discipline of its own
 * is identical across fresh emulator processes.
 */

import type { EmulatorDriver, Registers } from "../emulator/driver.js";
import { DEFAULT_TIMEOUT_MS, runFrames, withTimeout } from "./strategies.js";

/** The status-register interrupt-disable (I) flag bit. */
const INTERRUPT_DISABLE = 0x04;
/** The VIC-II control register holding the display-enable (DEN) bit. */
const VIC_CONTROL_1 = 0xd011;
/** The DEN bit inside {@link VIC_CONTROL_1}. */
const DISPLAY_ENABLE = 0x10;

/**
 * The driver capabilities cycle measurement needs beyond the base
 * {@link EmulatorDriver} contract: tracked checkpoints, the machine-cycle
 * stopwatch, and named register writes. `ViceDriver` satisfies this
 * structurally.
 */
export interface CycleMeasurementDriver extends EmulatorDriver {
  /** Set an execution checkpoint, returning its number for later deletion. */
  setCheckpoint(address: number): Promise<number>;
  /** Delete a checkpoint by number. */
  deleteCheckpoint(checkpointNumber: number): Promise<void>;
  /** Read the absolute machine-cycle stopwatch (machine stopped). */
  readStopwatch(): Promise<number>;
  /** Write CPU registers by name, including the status register. */
  writeRegisters(
    values: Partial<Record<"a" | "x" | "y" | "sp" | "pc" | "fl", number>>,
  ): Promise<void>;
}

/** Options for {@link quiesce}. */
export interface QuiesceOptions {
  /**
   * Also blank the display (clear the DEN bit) and settle. Required for
   * windows inside the active display area, where badline DMA would
   * otherwise stall the CPU phase-dependently; windows outside it need only
   * the interrupt mask.
   */
  blankDisplay?: boolean;
  /**
   * Estimated frames to run after blanking (default 2). Settling executes
   * the program, so a window that begins within the first frames of
   * execution must pass 0 — one raster line of separation (which the
   * program's own path to the window provides) already outlasts any badline
   * latched on the line where the blank landed.
   */
  settleFrames?: number;
}

/**
 * Whether `driver` provides the cycle-measurement capabilities — a runtime
 * check, since the base fixture hands out the abstract contract.
 */
export function isCycleMeasurementDriver(driver: EmulatorDriver): driver is CycleMeasurementDriver {
  const candidate = driver as EmulatorDriver & Partial<CycleMeasurementDriver>;
  return (
    typeof candidate.setCheckpoint === "function" &&
    typeof candidate.deleteCheckpoint === "function" &&
    typeof candidate.readStopwatch === "function" &&
    typeof candidate.writeRegisters === "function"
  );
}

/** Narrow to the measurement capabilities or fail loudly naming the caller. */
function requireMeasurementDriver(driver: EmulatorDriver, caller: string): CycleMeasurementDriver {
  if (!isCycleMeasurementDriver(driver)) {
    throw new Error(`${caller}: this driver does not provide cycle-measurement capabilities`);
  }
  return driver;
}

/** A short sample of available symbol keys for a helpful "unknown label" message. */
function sampleKeys(symbols: Map<string, number>): string {
  return [...symbols.keys()].slice(0, 8).join(", ");
}

/** Resolve `label` through `symbols` or fail naming the available keys. */
function resolveLabel(symbols: Map<string, number>, label: string): number {
  const address = symbols.get(label);
  if (address === undefined) {
    throw new Error(
      `measureCycles: label '${label}' is not in the symbol map. Available: ${sampleKeys(symbols)}`,
    );
  }
  return address;
}

/** Rebuild the status-register byte from the decoded flags (bit 5 reads 1). */
function packStatusByte(flags: Registers["flags"]): number {
  return (
    (flags.carry ? 0x01 : 0) |
    (flags.zero ? 0x02 : 0) |
    (flags.interrupt ? 0x04 : 0) |
    (flags.decimal ? 0x08 : 0) |
    (flags.break_ ? 0x10 : 0) |
    0x20 |
    (flags.overflow ? 0x40 : 0) |
    (flags.negative ? 0x80 : 0)
  );
}

/** Resume to the next checkpoint stop and assert it is `label`'s address. */
async function stopAt(
  driver: CycleMeasurementDriver,
  label: string,
  address: number,
): Promise<void> {
  const reason = await driver.resume();
  if (reason !== "breakpoint") {
    throw new Error(`measureCycles: expected to stop at '${label}', but resumed to '${reason}'`);
  }
  const registers = await driver.readRegisters();
  if (registers.pc !== address) {
    throw new Error(
      `measureCycles: stopped at PC $${registers.pc.toString(16).padStart(4, "0")}, ` +
        `expected '${label}' at $${address.toString(16).padStart(4, "0")}`,
    );
  }
}

/**
 * Measure the exact elapsed machine cycles between arrival at `fromLabel` and
 * arrival at `toLabel`.
 *
 * The count is ELAPSED MACHINE CYCLES: VIC-II DMA stalls (badlines, sprites)
 * and any interrupt handler cycles inside the window are included. This is
 * deliberately distinct from a static, table-based estimate, which counts CPU
 * execution cycles only.
 *
 * Determinism: identical binaries give identical counts within one emulator
 * process. Across FRESH processes the count is identical only for
 * phase-locked windows — interrupts disabled and display state settled (see
 * {@link quiesce}), or a program that installs its own raster interrupt and
 * synchronises to the raster before the window. Windows left unlocked are
 * exact per run but phase-dependent across processes, because the emulator
 * powers on at a different bus phase each launch.
 *
 * `fromLabel === toLabel` measures one full traversal (arrival to next
 * arrival). Both checkpoints are set before running and deleted on every
 * exit path, so later strategies in the same session never stop on a stale
 * checkpoint.
 *
 * @param driver The launched driver (autostarted program running or stopped).
 * @param symbols The program's label map (keys without the leading dot).
 * @param fromLabel The window-start label.
 * @param toLabel The window-end label (may equal `fromLabel`).
 * @param timeout Overall guard in milliseconds.
 * @returns The elapsed machine cycles between the two stops.
 * @throws {Error} On an unknown label, a wrong-address stop, or an
 *   unparseable stopwatch reply; a `TimeoutError` when `toLabel` (or
 *   `fromLabel`) is never reached.
 * @example
 * const cycles = await measureCycles(driver, symbols, "Main_update", "Main_pollEntry");
 */
export async function measureCycles(
  baseDriver: EmulatorDriver,
  symbols: Map<string, number>,
  fromLabel: string,
  toLabel: string,
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<number> {
  const driver = requireMeasurementDriver(baseDriver, "measureCycles");
  const fromAddress = resolveLabel(symbols, fromLabel);
  const toAddress = resolveLabel(symbols, toLabel);

  const fromCheckpoint = await driver.setCheckpoint(fromAddress);
  let toCheckpoint: number | undefined;
  try {
    const work = (async (): Promise<number> => {
      await stopAt(driver, fromLabel, fromAddress);
      if (toAddress !== fromAddress) {
        // The from-checkpoint's job is done — and it must not stay armed: a
        // window whose control flow revisits the from-address (a per-frame
        // loop) would stop there instead of at the window end.
        await driver.deleteCheckpoint(fromCheckpoint);
        // Arm the window end only NOW: the window is temporal (from-arrival
        // strictly precedes to-arrival), and arming it up-front would stop a
        // mid-loop start at the end label BEFORE the window even begins.
        toCheckpoint = await driver.setCheckpoint(toAddress);
      } else {
        // One label: the single checkpoint measures arrival-to-arrival.
        toCheckpoint = fromCheckpoint;
      }
      const start = await driver.readStopwatch();
      await stopAt(driver, toLabel, toAddress);
      const end = await driver.readStopwatch();
      return end - start;
    })();
    return await withTimeout(work, timeout, `measureCycles('${fromLabel}' → '${toLabel}')`);
  } finally {
    // Best-effort on every exit path — VICE deletes checkpoints regardless of
    // run state. A dead process cannot leak checkpoints, so a cleanup failure
    // never masks the primary result or error.
    try {
      if (toCheckpoint === undefined) {
        // Timed out before the from-stop: only the from-checkpoint is armed.
        await driver.deleteCheckpoint(fromCheckpoint);
      } else {
        await driver.deleteCheckpoint(toCheckpoint);
      }
    } catch {
      /* the primary outcome stands */
    }
  }
}

/**
 * Force a stopped program into a phase-locked state before measuring.
 *
 * Sets the CPU's interrupt-disable flag so no maskable interrupt can land
 * inside the subsequent window — the external equivalent of the program
 * executing SEI, for programs that carry no interrupt discipline of their
 * own (they must not later execute CLI/PLP inside the window). With
 * `blankDisplay`, additionally clears the VIC-II display-enable bit and
 * settles for a frame, eliminating badline DMA stalls for windows inside the
 * active display area.
 *
 * Call at a monitor stop (e.g. a label checkpoint) before the window's
 * from-label; the measured numbers are then "quiesced machine cycles",
 * identical across fresh emulator processes.
 *
 * @param driver The driver, currently at a monitor stop.
 * @param options See {@link QuiesceOptions}.
 * @example
 * await quiesce(driver, { blankDisplay: true }); // window sits in the display area
 */
export async function quiesce(
  baseDriver: EmulatorDriver,
  options: QuiesceOptions = {},
): Promise<void> {
  const driver = requireMeasurementDriver(baseDriver, "quiesce");
  const registers = await driver.readRegisters();
  await driver.writeRegisters({ fl: packStatusByte(registers.flags) | INTERRUPT_DISABLE });
  if (options.blankDisplay === true) {
    const control = (await driver.readMemory(VIC_CONTROL_1, 1))[0];
    await driver.writeMemory(VIC_CONTROL_1, Uint8Array.of(control & ~DISPLAY_ENABLE));
    // Settling drains any in-flight display DMA state — but it RUNS the
    // program, so early one-shot windows pass settleFrames: 0 instead.
    const settleFrames = options.settleFrames ?? 2;
    if (settleFrames > 0) {
      await runFrames(driver, settleFrames);
    }
  }
}
