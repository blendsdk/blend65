/**
 * Specification tests for the VICE label-file parser (`parseLabelFile`).
 *
 * Written from the requirements, never from the implementation. Immutable
 * oracles: the VICE line format `al C:xxxx .name` and the
 * skip-unparseable-lines rule come from the requirement, not the
 * implementation.
 */

import { describe, expect, it } from "vitest";
import { parseLabelFile } from "./label-file.js";

describe("Specification: parseLabelFile — VICE label parsing (ST-L1..L3)", () => {
  it("parses well-formed `al C:xxxx .name` lines into a symbol map (ST-L1)", () => {
    const content = "al C:080d ._main\nal C:0820 .__frame_main";
    const map = parseLabelFile(content);
    expect(map.get("_main")).toBe(0x080d);
    expect(map.get("__frame_main")).toBe(0x0820);
    expect(map.size).toBe(2);
  });

  it("parses the valid line and skips a garbage line without throwing (ST-L2)", () => {
    const content = "al C:1000 .sprite\nthis is not a label line";
    let map: Map<string, number> | undefined;
    expect(() => {
      map = parseLabelFile(content);
    }).not.toThrow();
    expect(map?.get("sprite")).toBe(0x1000);
    expect(map?.size).toBe(1);
  });

  it("returns an empty map for empty content (ST-L3)", () => {
    expect(parseLabelFile("").size).toBe(0);
  });
});
