/**
 * Implementation tests for the SourceMap registry.
 *
 * Covers internals and edge cases beyond the specification tests:
 * LineMap cache identity/invalidation details, empty content, long id
 * sequences, and `has()` over fractional/negative probe values.
 */

import { describe, expect, it } from "vitest";
import { createSourceMap } from "./source-map.js";

describe("SourceMap implementation details", () => {
  it("caches the LineMap across many calls and rebuilds only after a content change", () => {
    const sm = createSourceMap();
    const id = sm.intern("main.blend", "one\ntwo\n");

    const first = sm.getLineMap(id);
    expect(sm.getLineMap(id)).toBe(first);
    expect(sm.getLineMap(id)).toBe(first);

    // Re-intern with IDENTICAL content must NOT invalidate the cache.
    sm.intern("main.blend", "one\ntwo\n");
    expect(sm.getLineMap(id)).toBe(first);

    // A real change rebuilds once, then the new instance is cached again.
    sm.intern("main.blend", "one\ntwo\nthree\n");
    const rebuilt = sm.getLineMap(id);
    expect(rebuilt).not.toBe(first);
    expect(sm.getLineMap(id)).toBe(rebuilt);
  });

  it("handles an empty-content file", () => {
    const sm = createSourceMap();
    const id = sm.intern("empty.blend", "");

    expect(sm.getContent(id)).toBe("");
    expect(sm.getLineMap(id).getLineCol(0)).toEqual({ line: 1, column: 1 });
    // Offsets beyond the end clamp rather than throw (LineMap totality).
    expect(sm.getLineMap(id).getLineCol(50)).toEqual({ line: 1, column: 1 });
  });

  it("assigns dense sequential ids across many files", () => {
    const sm = createSourceMap();
    for (let i = 0; i < 50; i++) {
      expect(sm.intern(`file-${i}.blend`, `module m${i};\n`)).toBe(i);
    }
    expect(sm.has(49)).toBe(true);
    expect(sm.has(50)).toBe(false);
    expect(sm.getPath(25)).toBe("file-25.blend");
  });

  it("builds the cached LineMap with the owning sourceId", () => {
    const sm = createSourceMap();
    sm.intern("a.blend", "a\n");
    const id = sm.intern("b.blend", "b\n");
    expect(sm.getLineMap(id).sourceId).toBe(id);
  });

  it("rejects fractional and negative ids in has() and the getters", () => {
    const sm = createSourceMap();
    sm.intern("main.blend", "module main;\n");

    expect(sm.has(0.5)).toBe(false);
    expect(sm.has(-1)).toBe(false);
    expect(sm.has(Number.NaN)).toBe(false);

    // A fractional id must not alias entry 0 through array-index coercion.
    expect(() => sm.getPath(0.5)).toThrowError(/Unknown SourceId: 0.5/);
    expect(() => sm.getContent(-1)).toThrowError(/Unknown SourceId: -1/);
    expect(() => sm.getLineMap(Number.NaN)).toThrowError(/Unknown SourceId/);
  });
});
