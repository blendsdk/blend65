/**
 * Implementation tests for the assertion helpers — diff/message formatting edge
 * cases beyond the specification tests. CI tier (fake driver).
 */

import { describe, expect, it } from "vitest";
import { FakeDriver } from "../testing/fake-driver.js";
import { AssertionError, assertMemory, assertRegister } from "./assertions.js";
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

describe("assertRegister formatting", () => {
  it("throws an AssertionError (typed) with zero-padded hex", () => {
    try {
      assertRegister(registers({ x: 0x05 }), "x", 0xff);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AssertionError);
      expect((e as Error).message).toContain("0x05");
      expect((e as Error).message).toContain("0xff");
    }
  });
});

describe("assertMemory formatting", () => {
  it("a multi-byte mismatch names the first differing byte index", async () => {
    const driver = new FakeDriver({ memory: new Map([[0x2000, 0x01], [0x2001, 0x99]]) });
    await expect(assertMemory(driver, 0x2000, [0x01, 0x02])).rejects.toThrow(/first difference at byte 1/);
  });

  it("a symbolic mismatch reports both the label and the numeric address", async () => {
    const driver = new FakeDriver({ memory: new Map([[0x0819, 0x00]]) });
    const symbols = new Map<string, number>([["_main", 0x0819]]);
    let message = "";
    try {
      await assertMemory(driver, "_main", 0xa9, symbols);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("_main");
    expect(message).toContain("819"); // numeric address in hex
  });

  it("a numeric-address failure carries the AssertionError type", async () => {
    const driver = new FakeDriver({ memory: new Map([[0xc000, 0x00]]) });
    await expect(assertMemory(driver, 0xc000, 0x2a)).rejects.toBeInstanceOf(AssertionError);
  });
});
