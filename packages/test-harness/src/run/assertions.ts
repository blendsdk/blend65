/**
 * Register/memory assertion helpers (RD-12 §4.3, R17–R19, AC-07/08).
 *
 * Register and memory are the DETERMINISTIC assertion surface (AR-25); screenshots
 * are failure-only artifacts, never asserted. `assertMemory` accepts a numeric
 * address OR a symbolic label resolved via a `symbolMap` keyed per `parseLabelFile`
 * (raw label, no leading `.`/`C:` — verified live, PF-004).
 */

import type { EmulatorDriver, Registers } from "../emulator/driver.js";

/** Thrown by the assertion helpers on a mismatch (R17). */
export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

/** Format a byte as two-digit hex with a `0x` prefix. */
function hex(value: number): string {
  return `0x${value.toString(16).padStart(2, "0")}`;
}

/**
 * Assert a register value (R17, AC-07).
 *
 * @throws {AssertionError} On mismatch, reporting expected vs actual in hex.
 */
export function assertRegister(
  registers: Registers,
  register: "a" | "x" | "y" | "sp",
  expected: number,
): void {
  const actual = registers[register];
  if (actual !== expected) {
    throw new AssertionError(
      `Expected register ${register} to be ${hex(expected)}, but it was ${hex(actual)}`,
    );
  }
}

/** A short sample of available symbol keys for a helpful "unknown label" message. */
function sampleKeys(symbols: Map<string, number>): string {
  return [...symbols.keys()].slice(0, 8).join(", ");
}

/**
 * Assert memory content (R17/R19, AC-08). `address` is a numeric address OR a
 * symbolic label resolved via `symbols`; `expected` is a single byte or a byte
 * sequence (all compared).
 *
 * @throws {AssertionError} On a byte mismatch (reports symbolic + numeric address).
 * @throws {Error} If a symbolic label is not in `symbols` (lists available keys).
 */
export async function assertMemory(
  driver: EmulatorDriver,
  address: number | string,
  expected: number | number[],
  symbols?: Map<string, number>,
): Promise<void> {
  let numericAddress: number;
  let label: string | undefined;
  if (typeof address === "string") {
    if (symbols === undefined || !symbols.has(address)) {
      const available = symbols !== undefined ? sampleKeys(symbols) : "(no symbol map provided)";
      throw new Error(`assertMemory: symbol '${address}' is unknown. Available: ${available}`);
    }
    numericAddress = symbols.get(address)!;
    label = address;
  } else {
    numericAddress = address;
  }

  const expectedBytes = typeof expected === "number" ? [expected] : expected;
  const actual = await driver.readMemory(numericAddress, expectedBytes.length);

  for (let i = 0; i < expectedBytes.length; i++) {
    if (actual[i] !== expectedBytes[i]) {
      const where =
        label !== undefined
          ? `'${label}' ($${numericAddress.toString(16)})`
          : `$${numericAddress.toString(16)}`;
      const expectedStr = expectedBytes.map(hex).join(" ");
      const actualStr = [...actual].map(hex).join(" ");
      throw new AssertionError(
        `Expected memory at ${where} to be [${expectedStr}], but it was [${actualStr}]` +
          (expectedBytes.length > 1 ? ` (first difference at byte ${i})` : ""),
      );
    }
  }
}
