/**
 * Shared program observables — one assertion source per fixture, consumed
 * both by the fixture's VICE suite (against the compiled program) and by
 * the hand-written twin tier (against the assembled twin).
 *
 * An observable set is DATA: ordered wait landmarks plus memory checks at
 * source-mandated addresses. Because a row cannot execute driver probes,
 * implementation-coupled assertions — opcode peeks, allocator-chosen
 * addresses — stay in the fixture suites by construction; equivalence
 * between a program and its twin is judged only on what the program's
 * SOURCE mandates. Test-only support: NOT re-exported from the package
 * barrel (mirrors the other `testing/` helpers).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { EmulatorDriver } from "../emulator/driver.js";
import { AssertionError, assertMemory } from "../run/assertions.js";
import { runUntilLabelArrivals, runUntilMemory } from "../run/strategies.js";

/** The repository root — `bytesFile` paths resolve against it. */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** A wait target that must be reached before the checks run. Ordered. */
export type Landmark =
  /** Poll a RUNNING machine until [address] holds [value] (stable-state programs). */
  | { readonly kind: "memory"; readonly address: number; readonly value: number }
  /**
   * Stop the machine at the [arrivals]-th arrival at the consumer-supplied
   * loop-head label (frame-looping programs; deterministic checks at a
   * stopped CPU).
   */
  | { readonly kind: "loopHead"; readonly arrivals: number };

/** One shared memory-observable check, at a source-mandated address. */
export type Check =
  | { readonly address: number; readonly value: number; readonly note?: string }
  /** A block compared against the bytes of a committed asset file. */
  | { readonly address: number; readonly bytesFile: string; readonly note?: string };

/** A fixture's complete shared observable set — the twin-equivalence contract. */
export interface ProgramObservables {
  readonly landmarks: readonly Landmark[];
  readonly checks: readonly Check[];
}

/** Consumer-side inputs a loop-head landmark needs. */
export interface ObservableRunOptions {
  readonly symbols?: Map<string, number>;
  /** The consumer's own frame-loop-head label (generated label vs twin label). */
  readonly loopHeadLabel?: string;
  readonly timeout?: number;
}

/** Format an address as four-digit hex with a `$` prefix. */
function hexAddress(address: number): string {
  return `$${address.toString(16).padStart(4, "0")}`;
}

/** Format a byte as two-digit hex with a `0x` prefix. */
function hexByte(value: number): string {
  return `0x${value.toString(16).padStart(2, "0")}`;
}

/** Compare the block at `address` against the committed asset's bytes. */
async function assertBlock(
  driver: EmulatorDriver,
  address: number,
  bytesFile: string,
): Promise<void> {
  const filePath = join(REPO_ROOT, bytesFile);
  let expected: Buffer;
  try {
    expected = readFileSync(filePath);
  } catch {
    throw new Error(
      `assertObservables: block-check file '${bytesFile}' could not be read ` +
        `(resolved to ${filePath})`,
    );
  }
  const actual = await driver.readMemory(address, expected.length);
  if (actual.length !== expected.length) {
    throw new AssertionError(
      `Expected the block at ${hexAddress(address)} to match '${bytesFile}' ` +
        `(${expected.length} bytes), but the driver returned ${actual.length}`,
    );
  }
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new AssertionError(
        `Expected the block at ${hexAddress(address)} to match '${bytesFile}', ` +
          `but byte ${i} differs (expected ${hexByte(expected[i])}, got ${hexByte(actual[i])})`,
      );
    }
  }
}

/**
 * Walk the observable set's landmarks in order, then assert every check.
 *
 * `memory` landmarks poll the running machine; a `loopHead` landmark stops
 * it at the n-th arrival of `options.loopHeadLabel` — each consumer supplies
 * its OWN loop-head label, since the generated program and its twin name
 * theirs differently.
 *
 * @throws {AssertionError} On any failed check, naming address, expected,
 *   and actual (block checks name the asset file and the differing offset).
 * @throws {Error} On a `loopHead` landmark without `options.symbols` +
 *   `options.loopHeadLabel`, or an unreadable block-check file.
 * @example
 * // Name the block that runs once per frame — the frame body. A raster poll
 * // above it spins once per raster line, so arming there would stop the
 * // machine inside the first frame with nothing yet updated.
 * await assertObservables(driver, RASTERPOLL_OBSERVABLES, {
 *   symbols: env.symbols,
 *   loopHeadLabel: "Main_main_L5",
 * });
 */
export async function assertObservables(
  driver: EmulatorDriver,
  observables: ProgramObservables,
  options: ObservableRunOptions = {},
): Promise<void> {
  for (const landmark of observables.landmarks) {
    if (landmark.kind === "memory") {
      await runUntilMemory(driver, landmark.address, landmark.value, options.timeout);
    } else {
      if (options.symbols === undefined || options.loopHeadLabel === undefined) {
        throw new Error(
          "assertObservables: this observable set has a loop-head landmark — " +
            "pass options.symbols and options.loopHeadLabel (each consumer " +
            "supplies its own loop-head label)",
        );
      }
      await runUntilLabelArrivals(
        driver,
        options.symbols,
        options.loopHeadLabel,
        landmark.arrivals,
        options.timeout,
      );
    }
  }
  for (const check of observables.checks) {
    if ("bytesFile" in check) {
      await assertBlock(driver, check.address, check.bytesFile);
    } else {
      await assertMemory(driver, check.address, check.value);
    }
  }
}
