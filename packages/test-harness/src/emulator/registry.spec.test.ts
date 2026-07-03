/**
 * Specification test for the platform→emulator registry (ST-19).
 *
 * Derived EXCLUSIVELY from RD-12 R7a — never from reading the implementation
 * (IMMUTABLE ORACLE RULE). Pure lookup logic, runs in CI.
 */

import { describe, expect, it } from "vitest";
import { emulatorFor } from "./registry.js";

describe("Specification: emulatorFor (ST-19, R7a)", () => {
  it("ST-19: c64 resolves to the VICE x64sc entry", () => {
    const entry = emulatorFor("c64");
    expect(entry.executableName).toBe("x64sc");
    expect(typeof entry.createDriver).toBe("function");
    expect(Array.isArray(entry.defaultArgs)).toBe(true);
  });

  it("ST-19: an unknown platform throws 'no emulator registered'", () => {
    expect(() => emulatorFor("zx")).toThrow(/no emulator registered/i);
    expect(() => emulatorFor("zx")).toThrow(/zx/);
  });
});
