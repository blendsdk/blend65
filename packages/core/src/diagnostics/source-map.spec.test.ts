/**
 * Specification tests for the SourceMap registry (RD-11b Phase 1).
 *
 * ST-1..ST-5 — transcribed from RD-11 §4.2 (as amended by AR-104), AR-Q7, and
 * R14/R51 (see plans/rd-11b-diagnostics-reporting/07-testing-strategy.md).
 * IMMUTABLE ORACLE: these expectations derive from the requirements, never from
 * the implementation. If the implementation disagrees, the implementation is
 * wrong.
 */

import { describe, expect, it } from "vitest";
import { createSourceMap } from "./source-map.js";

describe("SourceMap (RD-11 §4.2 / AR-104)", () => {
  // ST-1 · §4.2, AR-Q7 — sequential ids from 0; path/content round-trip.
  it("ST-1: interns files with sequential ids starting at 0 and round-trips path/content", () => {
    const sm = createSourceMap();
    const contentA = "module a;\n";
    const contentB = "module b;\nlet x = 1;\n";

    const a = sm.intern("a.blend", contentA);
    const b = sm.intern("b.blend", contentB);

    expect(a).toBe(0);
    expect(b).toBe(1);
    expect(sm.getPath(a)).toBe("a.blend");
    expect(sm.getContent(a)).toBe(contentA);
    expect(sm.getPath(b)).toBe("b.blend");
    expect(sm.getContent(b)).toBe(contentB);
  });

  // ST-2 · R14/PF-006 — LineMap resolves positions and is cached per source.
  it("ST-2: getLineMap resolves 1-based line/byte-column and returns a cached instance", () => {
    const sm = createSourceMap();
    // Offset 7 sits on line 1; byte column is 1-based, so offset 7 → column 8.
    const id = sm.intern("main.blend", "module main;\nlet y = 2;\n");

    const lineMap = sm.getLineMap(id);
    expect(lineMap.getLineCol(7)).toEqual({ line: 1, column: 8 });
    // Offset 13 is the first byte after the "\n" — start of line 2.
    expect(lineMap.getLineCol(13)).toEqual({ line: 2, column: 1 });

    // R14: the LineMap is built once and cached — same instance both calls.
    expect(sm.getLineMap(id)).toBe(lineMap);
  });

  // ST-3 · AR-Q7 — re-intern with identical content is a no-op.
  it("ST-3: re-interning the same path with the same content returns the same id without consuming one", () => {
    const sm = createSourceMap();
    const content = "module main;\n";

    const first = sm.intern("main.blend", content);
    const again = sm.intern("main.blend", content);
    expect(again).toBe(first);

    // No id was consumed by the no-op: the next NEW path is still sequential.
    const next = sm.intern("other.blend", "module other;\n");
    expect(next).toBe(first + 1);
  });

  // ST-4 · AR-Q7 — re-intern with changed content replaces in place (LSP re-edit path).
  it("ST-4: re-interning the same path with different content keeps the id, replaces content, and rebuilds the LineMap", () => {
    const sm = createSourceMap();
    const id = sm.intern("main.blend", "module main;\n");
    const staleLineMap = sm.getLineMap(id);

    const newContent = "module main;\nlet z = 3;\n";
    const sameId = sm.intern("main.blend", newContent);

    expect(sameId).toBe(id);
    expect(sm.getContent(id)).toBe(newContent);

    // The cached LineMap was invalidated: a NEW instance resolving new offsets.
    const freshLineMap = sm.getLineMap(id);
    expect(freshLineMap).not.toBe(staleLineMap);
    // Offset 13 now starts line 2 of the new content ("let z = 3;").
    expect(freshLineMap.getLineCol(13)).toEqual({ line: 2, column: 1 });
  });

  // ST-5 · AR-Q7/AR-104, R51 — has() is a total probe; getters throw on unknown ids.
  it("ST-5: has() never throws and getters throw 'Unknown SourceId' for unknown ids", () => {
    const sm = createSourceMap();
    sm.intern("main.blend", "module main;\n");

    expect(sm.has(0)).toBe(true);
    // The RD-16 config sentinel (-2) is never interned — has() must say so
    // without throwing, so renderers can degrade (R51).
    expect(sm.has(-2)).toBe(false);

    expect(() => sm.getPath(-2)).toThrowError(/Unknown SourceId/);
    expect(() => sm.getContent(99)).toThrowError(/Unknown SourceId/);
    expect(() => sm.getLineMap(99)).toThrowError(/Unknown SourceId/);
  });
});
