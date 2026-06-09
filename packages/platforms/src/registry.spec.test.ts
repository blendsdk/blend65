/**
 * Specification tests for the platform registry + loader — ST-REG1..4
 * (07-testing-strategy.md, derived from 03-03 + RD-10 R28–R33).
 *
 * Written BEFORE `registry.ts`; verified RED first.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLATFORM,
  PLATFORM_REGISTRY,
  loadPlatform,
} from "./registry.js";
import { c64Plugin } from "./c64.js";

describe("Platform registry + loader (ST-REG1..4)", () => {
  it("loadPlatform('c64') returns the c64 plugin (identity) — ST-REG1", () => {
    expect(loadPlatform("c64")).toBe(c64Plugin);
  });

  it("loadPlatform('nope') throws listing all five IDs — ST-REG2", () => {
    expect(() => loadPlatform("nope")).toThrow(/c64, c64u, cx16, a800xl, a7800/);
  });

  it("DEFAULT_PLATFORM === 'c64' — ST-REG3", () => {
    expect(DEFAULT_PLATFORM).toBe("c64");
  });

  it("PLATFORM_REGISTRY has exactly the five built-in keys — ST-REG4", () => {
    expect([...PLATFORM_REGISTRY.keys()]).toEqual([
      "c64",
      "c64u",
      "cx16",
      "a800xl",
      "a7800",
    ]);
  });
});
