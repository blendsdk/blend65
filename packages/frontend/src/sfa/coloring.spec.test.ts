/**
 * Specification tests for the SFA frame-coloring pass (RD-05 §4.4, R12/R16/R18,
 * R21/R22; spec Ch 11 §3.4 / AC-07).
 *
 * Expectations derive exclusively from plans/rd-05-sfa-frame-planner/
 * 07-testing-strategy.md (ST-C1..ST-C6) and 03-02-interference-and-coloring.md —
 * NOT from implementation logic. Immutable oracle.
 *
 * Spec-tests-first: authored before `coloring.ts`; verified to FAIL (red). The
 * coloring suite builds `FunctionFrame`/`InterferenceGraph` inputs directly so it
 * is independent of the frame-computation and interference passes.
 */

import { describe, expect, it } from "vitest";
import type { FunctionFrame, InterferenceGraph } from "@blend65/core";
import { primitive } from "@blend65/core";
import { colorFrames } from "./coloring.js";

/** Builds a {@link FunctionFrame} of the given total size (one synthetic local). */
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

/** Builds a symmetric {@link InterferenceGraph} from undirected edge pairs. */
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

/** Builds a `Map<string, FunctionFrame>` from frames. */
function frameMap(frames: readonly FunctionFrame[]): Map<string, FunctionFrame> {
  return new Map(frames.map((f) => [f.functionName, f]));
}

describe("Specification: SFA frame coloring (R12/R16/R18, §3.4)", () => {
  // ST-C1 — two non-interfering frames of size 2 share offset 0; region size 2.
  it("should overlap two non-interfering frames at offset 0 (ST-C1)", () => {
    const frames = frameMap([frame("f", 2), frame("g", 2)]);
    const g = graph(["f", "g"], []);
    const result = colorFrames(frames, g);

    expect(result.offsets.get("f")).toBe(0);
    expect(result.offsets.get("g")).toBe(0);
    expect(result.frameRegionSize).toBe(2);
  });

  // ST-C2 — two interfering frames of size 2 get offsets 0 and 2; region size 4.
  it("should separate two interfering frames (ST-C2)", () => {
    const frames = frameMap([frame("f", 2), frame("g", 2)]);
    const g = graph(["f", "g"], [["f", "g"]]);
    const result = colorFrames(frames, g);

    const offsets = [result.offsets.get("f"), result.offsets.get("g")].sort((a, b) => a! - b!);
    expect(offsets).toEqual([0, 2]);
    expect(result.frameRegionSize).toBe(4);
  });

  // ST-C3 — interfering sizes [3,1] ordered size-desc: 3@0, 1@3; region 4.
  it("should place the larger interfering frame first (ST-C3)", () => {
    const frames = frameMap([frame("big", 3), frame("small", 1)]);
    const g = graph(["big", "small"], [["big", "small"]]);
    const result = colorFrames(frames, g);

    expect(result.offsets.get("big")).toBe(0);
    expect(result.offsets.get("small")).toBe(3);
    expect(result.frameRegionSize).toBe(4);
  });

  // ST-C4 — running coloring twice on the same input is identical (determinism).
  it("should be deterministic across runs (ST-C4)", () => {
    const frames = frameMap([frame("a", 2), frame("b", 3), frame("c", 1)]);
    const g = graph(["a", "b", "c"], [["a", "b"], ["b", "c"]]);
    const r1 = colorFrames(frames, g);
    const r2 = colorFrames(frames, g);

    expect([...r1.offsets.entries()].sort()).toEqual([...r2.offsets.entries()].sort());
    expect(r1.frameRegionSize).toBe(r2.frameRegionSize);
  });

  // ST-C5 — a zero-size frame gets offset 0 and does not grow the region.
  it("should not grow the region for a zero-size frame (ST-C5)", () => {
    const frames = frameMap([frame("real", 2), frame("zero", 0)]);
    const g = graph(["real", "zero"], [["real", "zero"]]);
    const result = colorFrames(frames, g);

    expect(result.offsets.get("zero")).toBe(0);
    expect(result.frameRegionSize).toBe(2);
  });

  // ST-C6 — Ch 11 §3.4 example (AC-07). The spec guarantees two things for this
  // call graph: (a) SOUNDNESS — interfering frames never overlap; and (b) the
  // frameRegionSize equals the PEAK simultaneous footprint (R21/R22): the deepest
  // call chain is 3 levels (e.g. main→update→handleInput) × 2 bytes = 6, far below
  // the 16 bytes the eight frames would need without sharing. The spec describes
  // which functions MAY share (init/update/render; handleInput/drawSprites;
  // moveEnemies/drawBackground), proven here by region 6 < 16 — but greedy
  // name-ordered coloring may realize sharing via different concrete offsets, so we
  // assert the guaranteed properties (soundness + peak region), not exact slots.
  it("should minimize the frame region via sharing for the Ch 11 §3.4 example (ST-C6 / AC-07)", () => {
    const names = [
      "main",
      "init",
      "update",
      "render",
      "handleInput",
      "moveEnemies",
      "drawBackground",
      "drawSprites",
    ];
    const frames = frameMap(names.map((n) => frame(n, 2)));
    const edgePairs: [string, string][] = [
      ["main", "init"],
      ["main", "update"],
      ["main", "render"],
      ["main", "handleInput"],
      ["main", "moveEnemies"],
      ["main", "drawBackground"],
      ["main", "drawSprites"],
      ["update", "handleInput"],
      ["update", "moveEnemies"],
      ["render", "drawBackground"],
      ["render", "drawSprites"],
    ];
    const g = graph(names, edgePairs);
    const result = colorFrames(frames, g);

    const off = (n: string): number => result.offsets.get(n)!;

    // (a) Soundness — every interfering pair occupies disjoint [offset, offset+2)
    // intervals. All frames are size 2, so disjoint ⇔ different offset.
    for (const [a, b] of edgePairs) {
      expect(off(a)).not.toBe(off(b));
    }

    // (b) Peak region: deepest chain is 3 levels × 2 bytes = 6 (R21/R22), and
    // sharing demonstrably occurred (6 < the 16 bytes eight unshared frames need).
    expect(result.frameRegionSize).toBe(6);
    expect(result.frameRegionSize).toBeLessThan(16);
  });
});
