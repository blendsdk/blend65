/**
 * Implementation tests for config-file discovery: boundary cases the ST-5
 * spec tier does not pin — root-dir starts, deep nesting, and trailing
 * separators (execution plan task 2.3.1).
 */

import { describe, expect, it } from "vitest";
import { findConfigUpwards } from "./discovery.js";

describe("findConfigUpwards boundaries", () => {
  it("probes the root exactly once when starting at the root", () => {
    const probed: string[] = [];
    const result = findConfigUpwards("/", (path) => {
      probed.push(path);
      return false;
    });
    expect(result).toBeNull();
    expect(probed).toEqual(["/blend65.json"]);
  });

  it("finds a config when starting at the root and one exists there", () => {
    expect(findConfigUpwards("/", (path) => path === "/blend65.json")).toBe("/blend65.json");
  });

  it("walks arbitrarily deep nesting up to the hit", () => {
    const deep = "/" + Array.from({ length: 40 }, (_, i) => `d${i}`).join("/");
    const exists = (path: string): boolean => path === "/d0/blend65.json";
    expect(findConfigUpwards(deep, exists)).toBe("/d0/blend65.json");
  });

  it("tolerates a trailing separator on the start directory", () => {
    const exists = (path: string): boolean => path === "/x/blend65.json";
    expect(findConfigUpwards("/x/y/z/", exists)).toBe("/x/blend65.json");
  });

  it("probes each directory at most once (no infinite loop at the root)", () => {
    const counts = new Map<string, number>();
    findConfigUpwards("/a/b", (path) => {
      counts.set(path, (counts.get(path) ?? 0) + 1);
      return false;
    });
    for (const [, count] of counts) {
      expect(count).toBe(1);
    }
    expect(counts.size).toBe(3); // /a/b, /a, /
  });
});
