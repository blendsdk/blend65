/**
 * Specification tests for the SFA interference-graph pass (RD-05 §4.3, R10–R17).
 *
 * Expectations derive exclusively from plans/rd-05-sfa-frame-planner/
 * 07-testing-strategy.md (ST-I1..ST-I6) and 03-02-interference-and-coloring.md /
 * spec Ch 11 §3.4 — NOT from implementation logic. Immutable oracle.
 *
 * Spec-tests-first: authored before `interference.ts`; verified to FAIL (red).
 */

import { describe, expect, it } from "vitest";
import type { InterferenceGraph } from "@blend65/core";
import { buildInterferenceGraph } from "./interference.js";
import { makeFn } from "./test-fixtures.js";

/** Helper: does `a` interfere with `b` (symmetric) in the graph? */
function interferes(graph: InterferenceGraph, a: string, b: string): boolean {
  return graph.edges.get(a)?.has(b) === true && graph.edges.get(b)?.has(a) === true;
}

describe("Specification: SFA interference graph (R10–R17, §4.3)", () => {
  // ST-I1 — chain a→b→c: all ancestor-descendant pairs interfere {a-b, a-c, b-c}.
  it("should connect all ancestor-descendant pairs in a chain (ST-I1)", () => {
    const fns = [
      makeFn("a", { callees: ["b"] }),
      makeFn("b", { callees: ["c"] }),
      makeFn("c"),
    ];
    const g = buildInterferenceGraph(fns);

    expect(interferes(g, "a", "b")).toBe(true);
    expect(interferes(g, "a", "c")).toBe(true);
    expect(interferes(g, "b", "c")).toBe(true);
  });

  // ST-I2 — siblings m→{x,y}: m-x and m-y interfere, but x-y do NOT.
  it("should not connect non-overlapping sibling subtrees (ST-I2)", () => {
    const fns = [makeFn("m", { callees: ["x", "y"] }), makeFn("x"), makeFn("y")];
    const g = buildInterferenceGraph(fns);

    expect(interferes(g, "m", "x")).toBe(true);
    expect(interferes(g, "m", "y")).toBe(true);
    expect(interferes(g, "x", "y")).toBe(false);
  });

  // ST-I3 — an interrupt handler interferes with every other node (R14).
  it("should make an interrupt handler interfere with all (ST-I3)", () => {
    const fns = [makeFn("irq", { isInterrupt: true }), makeFn("f")];
    const g = buildInterferenceGraph(fns);
    expect(interferes(g, "irq", "f")).toBe(true);
  });

  // ST-I4 — an escaped (address-taken) function interferes with all (R15).
  it("should make an escaped function interfere with all (ST-I4)", () => {
    const fns = [makeFn("g", { isEscaped: true }), makeFn("f")];
    const graph = buildInterferenceGraph(fns);
    expect(interferes(graph, "g", "f")).toBe(true);
  });

  // ST-I5 — an unreachable function is absent from nodes and edges (R17).
  it("should exclude unreachable functions entirely (ST-I5)", () => {
    const fns = [makeFn("live"), makeFn("dead", { isReachable: false })];
    const g = buildInterferenceGraph(fns);

    expect(g.nodes.has("live")).toBe(true);
    expect(g.nodes.has("dead")).toBe(false);
    expect(g.edges.has("dead")).toBe(false);
  });

  // ST-I6 — main→{a,b}: main interferes with both descendants (R13).
  it("should make main interfere with its descendants (ST-I6)", () => {
    const fns = [makeFn("main", { callees: ["a", "b"] }), makeFn("a"), makeFn("b")];
    const g = buildInterferenceGraph(fns);
    expect(interferes(g, "main", "a")).toBe(true);
    expect(interferes(g, "main", "b")).toBe(true);
  });

  // R61 — a dangling callee name (no matching node) is ignored, never throws.
  it("should tolerate a dangling callee edge without throwing (R61)", () => {
    const fns = [makeFn("a", { callees: ["missing"] })];
    expect(() => buildInterferenceGraph(fns)).not.toThrow();
    const g = buildInterferenceGraph(fns);
    expect(g.nodes.has("a")).toBe(true);
    expect(g.nodes.has("missing")).toBe(false);
  });
});
