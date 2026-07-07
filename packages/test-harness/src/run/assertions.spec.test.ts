/**
 * Specification tests for the assertion helpers.
 *
 * These tests are derived directly from the assertion helpers' documented
 * behavior, not from reading the implementation. All logic is unit-testable
 * against a fake driver / literal Registers, so these run in CI with no
 * emulator.
 */

import { describe, expect, it } from "vitest";
import { FakeDriver } from "../testing/fake-driver.js";
import { assertMemory, assertRegister } from "./assertions.js";
import type { Registers } from "../emulator/driver.js";

function registers(overrides: Partial<Registers>): Registers {
  return {
    a: 0,
    x: 0,
    y: 0,
    sp: 0,
    pc: 0,
    flags: { carry: false, zero: false, interrupt: false, decimal: false, break_: false, overflow: false, negative: false },
    ...overrides,
  };
}

describe("Specification: assertRegister (ST-16)", () => {
  it("ST-16: passes when the register matches", () => {
    expect(() => assertRegister(registers({ a: 42 }), "a", 42)).not.toThrow();
  });

  it("ST-16: throws an AssertionError with expected-vs-actual (hex) on mismatch", () => {
    expect(() => assertRegister(registers({ a: 42 }), "a", 7)).toThrow(/a/);
    // The message reports both values in hex.
    let message = "";
    try {
      assertRegister(registers({ a: 42 }), "a", 7);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/0x2a/i); // actual 42
    expect(message).toMatch(/0x07/i); // expected 7
  });
});

describe("Specification: assertMemory numeric (ST-17)", () => {
  it("ST-17: passes when the byte at a numeric address matches", async () => {
    const driver = new FakeDriver({ memory: new Map([[0xd020, 5]]) });
    await expect(assertMemory(driver, 0xd020, 5)).resolves.toBeUndefined();
  });

  it("ST-17: throws an AssertionError when the byte differs", async () => {
    const driver = new FakeDriver({ memory: new Map([[0xd020, 4]]) });
    await expect(assertMemory(driver, 0xd020, 5)).rejects.toThrow();
  });
});

describe("Specification: assertMemory symbolic (ST-18)", () => {
  const symbols = new Map<string, number>([["_main", 0x0819]]);

  it("ST-18: resolves a symbolic label via the symbol map and compares", async () => {
    const driver = new FakeDriver({ memory: new Map([[0x0819, 0xa9]]) });
    await expect(assertMemory(driver, "_main", 0xa9, symbols)).resolves.toBeUndefined();
  });

  it("ST-18: an unknown label throws, listing available keys", async () => {
    const driver = new FakeDriver();
    let message = "";
    try {
      await assertMemory(driver, "_nope", 0xa9, symbols);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/_nope/);
    expect(message).toMatch(/_main/); // lists an available key
  });

  it("ST-18: a byte sequence compares all bytes", async () => {
    const driver = new FakeDriver({ memory: new Map([[0x0819, 0xa9], [0x081a, 0x05]]) });
    await expect(assertMemory(driver, "_main", [0xa9, 0x05], symbols)).resolves.toBeUndefined();
    await expect(assertMemory(driver, "_main", [0xa9, 0x06], symbols)).rejects.toThrow();
  });
});
