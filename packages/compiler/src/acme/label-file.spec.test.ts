/**
 * Specification tests for the RD-09 VICE label-file parser (`parseLabelFile`) —
 * ST-L1..ST-L3.
 *
 * Derived EXCLUSIVELY from `requirements/RD-09-acme-emitter.md` (R45–R47, §4.6,
 * AC-15), the component spec
 * `plans/rd-09-acme-emitter/03-02-acme-process-layer.md`, and the testing
 * strategy `07-testing-strategy.md` (ST-L1..L3). Immutable oracles
 * (testing.md Rule 10): the VICE line format `al C:xxxx .name` and the
 * skip-unparseable-lines rule (R47) come from the RD, not the implementation.
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
