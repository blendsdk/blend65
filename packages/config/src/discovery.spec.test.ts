/**
 * Specification tests for config-file discovery: the upward walk for
 * `blend65.json`, nearest file wins.
 *
 * `findConfigUpwards` is a pure helper taking an injected `fileExists`
 * predicate, so these tests are hermetic (no real filesystem). Expectations
 * derive from the discovery contract only, never from the implementation.
 */

import { describe, expect, it } from "vitest";
import { findConfigUpwards } from "./discovery.js";

describe("findConfigUpwards (ST-5 / R4 / AR-P7)", () => {
  it("returns the nearest ancestor blend65.json for which the predicate is true", () => {
    const exists = (path: string): boolean => path === "/x/blend65.json";
    expect(findConfigUpwards("/x/y/z", exists)).toBe("/x/blend65.json");
  });

  it("returns null when the predicate is always false", () => {
    expect(findConfigUpwards("/x/y/z", () => false)).toBeNull();
  });

  it("checks every directory up to and including the filesystem root", () => {
    const probed: string[] = [];
    findConfigUpwards("/x/y/z", (path) => {
      probed.push(path);
      return false;
    });
    expect(probed).toContain("/x/y/z/blend65.json");
    expect(probed).toContain("/x/y/blend65.json");
    expect(probed).toContain("/x/blend65.json");
    expect(probed).toContain("/blend65.json");
  });

  it("finds a config in the start directory itself (nearest wins)", () => {
    const exists = (path: string): boolean =>
      path === "/x/y/z/blend65.json" || path === "/x/blend65.json";
    expect(findConfigUpwards("/x/y/z", exists)).toBe("/x/y/z/blend65.json");
  });

  it("finds a config at the filesystem root", () => {
    const exists = (path: string): boolean => path === "/blend65.json";
    expect(findConfigUpwards("/x/y/z", exists)).toBe("/blend65.json");
  });
});
