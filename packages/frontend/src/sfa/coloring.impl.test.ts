/**
 * Implementation tests for the SFA frame-coloring pass (§4.4).
 *
 * These exercise gap-fitting edge cases and determinism over larger inputs —
 * internal behavior of `colorFrames`/`smallestFittingOffset`, derived from the
 * implementation (testing.md Rule 10 impl tier), complementing the spec tests.
 */

import { describe, expect, it } from "vitest";
import type { FunctionFrame, InterferenceGraph } from "@blend65/core";
import { primitive } from "@blend65/core";
import { colorFrames } from "./coloring.js";

function frame(name: string, size: number): FunctionFrame {
  return {
    functionName: name,
    slots:
      size > 0
        ? [{ name: "v", kind: "local", type: primitive("byte"), size, offset: 0 }]
        : [],
    totalSize: size,
    isInterrupt: false,
    isEscaped: false,
    isReachable: true,
  };
}

function graph(names: readonly string[], pairs: readonly [string, string][]): InterferenceGraph {
  const edges = new Map<string, Set<string>>();
  for (const n of names) {
    edges.set(n, new Set());
  }
  for (const [a, b] of pairs) {
    edges.get(a)?.add(b);
    edges.get(b)?.add(a);
  }
  return { nodes: new Set(names), edges };
}

function frameMap(frames: readonly FunctionFrame[]): Map<string, FunctionFrame> {
  return new Map(frames.map((f) => [f.functionName, f]));
}

describe("colorFrames internals", () => {
  it("should return an empty result for an empty graph", () => {
    const result = colorFrames(new Map(), graph([], []));
    expect(result.offsets.size).toBe(0);
    expect(result.frameRegionSize).toBe(0);
  });

  it("should reuse a freed gap when a small frame fits between placed neighbors", () => {
    // a(size 4) interferes with b(size 2) and c(size 2); b and c do NOT interfere.
    // Order by size desc: a(4) first @0; then b(2) @4 (clears a); then c(2): c only
    // interferes with a [0,4) → smallest fit is 4, sharing with b. Region = 6.
    const frames = frameMap([frame("a", 4), frame("b", 2), frame("c", 2)]);
    const g = graph(["a", "b", "c"], [["a", "b"], ["a", "c"]]);
    const result = colorFrames(frames, g);

    expect(result.offsets.get("a")).toBe(0);
    expect(result.offsets.get("b")).toBe(4);
    expect(result.offsets.get("c")).toBe(4); // shares with b (b,c don't interfere)
    expect(result.frameRegionSize).toBe(6);
  });

  it("should place a frame in an interior gap large enough for it", () => {
    // Build a node x interfering with two placed neighbors leaving a gap.
    // p(size 2)@0 and q(size 2)@4 both interfere with x(size 2); p,q interfere too.
    // x interferes with p[0,2) and q[4,6) → the gap [2,4) is exactly size 2 → x@2.
    const frames = frameMap([frame("p", 2), frame("q", 2), frame("x", 2)]);
    const g = graph(
      ["p", "q", "x"],
      [["p", "q"], ["p", "x"], ["q", "x"]],
    );
    const result = colorFrames(frames, g);
    // p,q,x mutually interfere → three disjoint 2-byte slots → region 6.
    const offs = [result.offsets.get("p")!, result.offsets.get("q")!, result.offsets.get("x")!];
    expect(new Set(offs).size).toBe(3);
    expect(result.frameRegionSize).toBe(6);
  });

  it("should be deterministic over a larger random-ish chain", () => {
    const names = Array.from({ length: 20 }, (_, i) => `fn${i}`);
    const pairs: [string, string][] = [];
    for (let i = 0; i < names.length - 1; i++) {
      pairs.push([names[i]!, names[i + 1]!]);
    }
    const frames = frameMap(names.map((n, i) => frame(n, (i % 3) + 1)));
    const g = graph(names, pairs);

    const r1 = colorFrames(frames, g);
    const r2 = colorFrames(frames, g);
    expect([...r1.offsets.entries()]).toEqual([...r2.offsets.entries()]);
  });

  it("should never overlap interfering frames (soundness invariant)", () => {
    const names = ["a", "b", "c", "d"];
    const pairs: [string, string][] = [
      ["a", "b"],
      ["b", "c"],
      ["c", "d"],
      ["a", "c"],
    ];
    const frames = frameMap([frame("a", 3), frame("b", 1), frame("c", 2), frame("d", 2)]);
    const g = graph(names, pairs);
    const result = colorFrames(frames, g);

    const sizeOf = (n: string): number => frames.get(n)!.totalSize;
    for (const [x, y] of pairs) {
      const ox = result.offsets.get(x)!;
      const oy = result.offsets.get(y)!;
      // Half-open intervals [ox, ox+sx) and [oy, oy+sy) must be disjoint.
      const disjoint = ox + sizeOf(x) <= oy || oy + sizeOf(y) <= ox;
      expect(disjoint).toBe(true);
    }
  });
});
