import { describe, expect, it } from "vitest";
import { buildInterferenceGraph } from "./interference.js";
import { bindPointerPairs } from "./pointer-pairs.js";
import { computePeakPointers } from "./zp-allocator.js";
import { frameVar, makeFn, structType } from "./test-fixtures.js";
import type { FunctionInfo } from "@blend65/core";

/**
 * Implementation tests for the pointer-pair coloring: the chain-max
 * assignment stays within the peak-sized pool on adversarial call graphs,
 * and the coloring is deterministic across runs.
 */

/** A function with `n` pair-bound by-ref params. */
function fnWithPairs(name: string, n: number, callees: string[] = []): FunctionInfo {
  return makeFn(name, {
    parameters: Array.from({ length: n }, (_, i) =>
      frameVar(`p${i}`, structType("S", 3), true),
    ),
    callees,
  });
}

/** Colors `fns` and asserts the pool invariant (coloring ≤ peak bytes). */
function colorAndCheck(fns: FunctionInfo[]) {
  const graph = buildInterferenceGraph(fns);
  const pairs = bindPointerPairs(fns, graph);
  const peak = computePeakPointers(fns, graph);
  expect(pairs.poolBytes).toBeLessThanOrEqual(peak * 2);
  return pairs;
}

describe("chain-max coloring vs the peak-sized pool", () => {
  it("stays within the pool on a deep chain with mixed pair counts", () => {
    const fns = [
      fnWithPairs("M.a", 2, ["M.b"]),
      fnWithPairs("M.b", 0, ["M.c"]),
      fnWithPairs("M.c", 3, ["M.d"]),
      fnWithPairs("M.d", 1, []),
    ];
    const pairs = colorAndCheck(fns);
    // Live simultaneously along one chain: 2 + 0 + 3 + 1 pairs → 12 bytes.
    expect(pairs.poolBytes).toBe(12);
    // Disjointness along the chain.
    const offsets = new Map(pairs.bindings.map((b) => [`${b.functionName}.${b.paramName}`, b.offset]));
    expect(offsets.get("M.a.p0")).not.toBe(offsets.get("M.c.p0"));
  });

  it("stays within the pool on a diamond (b and c both called by a, both calling d)", () => {
    const fns = [
      fnWithPairs("M.a", 1, ["M.b", "M.c"]),
      fnWithPairs("M.b", 1, ["M.d"]),
      fnWithPairs("M.c", 2, ["M.d"]),
      fnWithPairs("M.d", 1, []),
    ];
    const pairs = colorAndCheck(fns);
    // b and c are not simultaneously live with each other, so they may share;
    // d must clear BOTH b and c.
    const byKey = new Map(pairs.bindings.map((b) => [`${b.functionName}.${b.paramName}`, b.offset]));
    const a = byKey.get("M.a.p0")!;
    const b = byKey.get("M.b.p0")!;
    const c0 = byKey.get("M.c.p0")!;
    const d = byKey.get("M.d.p0")!;
    expect(b).not.toBe(a);
    expect(c0).not.toBe(a);
    expect(d).not.toBe(a);
    expect(d).not.toBe(b);
    expect(d).not.toBe(c0);
    expect(d).not.toBe(byKey.get("M.c.p1")!);
  });

  it("shares addresses between fully independent (sequential) functions", () => {
    const fns = [fnWithPairs("M.f", 1, []), fnWithPairs("M.g", 1, [])];
    const pairs = colorAndCheck(fns);
    const [f, g] = pairs.bindings;
    expect(f!.offset).toBe(g!.offset);
    expect(pairs.poolBytes).toBe(2);
  });

  it("survives a (defensive) cyclic graph without hanging", () => {
    const fns = [fnWithPairs("M.a", 1, ["M.b"]), fnWithPairs("M.b", 1, ["M.a"])];
    const graph = buildInterferenceGraph(fns);
    expect(() => bindPointerPairs(fns, graph)).not.toThrow();
  });
});

describe("determinism", () => {
  it("produces identical bindings across runs and input orderings", () => {
    const build = (reversed: boolean) => {
      const fns = [
        fnWithPairs("M.a", 2, ["M.b"]),
        fnWithPairs("M.b", 1, ["M.c"]),
        fnWithPairs("M.c", 1, []),
      ];
      if (reversed) fns.reverse();
      return bindPointerPairs(fns, buildInterferenceGraph(fns));
    };
    const one = build(false);
    const two = build(false);
    expect(two).toEqual(one);
    const reordered = build(true);
    expect(new Map(reordered.bindings.map((b) => [`${b.functionName}.${b.paramName}`, b.offset]))).toEqual(
      new Map(one.bindings.map((b) => [`${b.functionName}.${b.paramName}`, b.offset])),
    );
  });
});
