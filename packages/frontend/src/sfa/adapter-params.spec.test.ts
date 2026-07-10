/**
 * Specification tests for the adapter's call-surface projections — parameters
 * (params-first frame layout), callees (call-graph projection), and the
 * argument-window interference channel that keeps a callee's frame disjoint
 * from every function that can run while its arguments are being stored.
 *
 * Expectations derive from the frozen spec Ch 06 §5 (static frames, params
 * first) and Ch 11 (frame sharing requires interference) — never from the
 * implementation. Models are produced by the real public path
 * (`lex`→`parse`→`analyze`); the projections and planner passes run directly.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, primitive } from "@blend65/core";
import type { AllocationPlan, DiagnosticBag, SemanticModel } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";
import { modelToFunctionInfo } from "./model-adapter.js";
import { buildInterferenceGraph } from "./interference.js";
import { planAllocation } from "./plan-allocation.js";
import { computeFrames } from "./frame-computation.js";
import { C64_FIXTURE_PROFILE } from "./test-fixtures.js";

/** Lexes + parses + analyzes `source` (single file); expects a clean model. */
function analyzeClean(source: string): SemanticModel {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast } = parse({ tokens, source, sourceId: 1, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  expect(bag.getAll()).toEqual([]);
  return model;
}

/** The half-open frame range `[start, end)` of `name` in the plan. */
function frameRange(plan: AllocationPlan, name: string): readonly [number, number] {
  const fa = plan.frames.get(name);
  expect(fa).toBeDefined();
  if (fa === undefined) return [0, 0];
  return [fa.offset, fa.offset + fa.frame.totalSize];
}

/** `true` when two half-open ranges do not overlap. */
function disjoint(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[1] <= b[0] || b[1] <= a[0];
}

describe("Specification: adapter parameter projection", () => {
  it("should project parameters in declaration order, before the locals, with params-first frame offsets", () => {
    const model = analyzeClean(
      "module Main;\n" +
        "function f(a: byte, x: word): byte { let t: byte = 1; return t; }\n" +
        "function main(): void { let r: byte = f(1, 2); }\n",
    );

    const infos = modelToFunctionInfo(model);
    const f = infos.find((fn) => fn.name === "Main.f");
    expect(f).toBeDefined();
    if (f === undefined) return;

    expect(f.parameters).toEqual([
      { name: "a", type: primitive("byte"), byRef: false },
      { name: "x", type: primitive("word"), byRef: false },
    ]);
    expect(f.locals).toEqual([{ name: "t", type: primitive("byte"), byRef: false }]);

    // Frame layout: parameters first (a at 0, x at 1), locals after (t at 3).
    const frame = computeFrames([f]).get("Main.f");
    expect(frame?.slots.map((s) => ({ name: s.name, kind: s.kind, offset: s.offset }))).toEqual([
      { name: "a", kind: "parameter", offset: 0 },
      { name: "x", kind: "parameter", offset: 1 },
      { name: "t", kind: "local", offset: 3 },
    ]);
  });
});

describe("Specification: adapter callee projection + interference", () => {
  const SRC =
    "module Main;\n" +
    "function g(): void { let gb: byte = 1; }\n" +
    "function f(): void { let fb: byte = 1; g(); }\n" +
    "function main(): void { f(); g(); }\n";

  it("should project callees as sorted fully-qualified names", () => {
    const infos = modelToFunctionInfo(analyzeClean(SRC));
    const byName = new Map(infos.map((fn) => [fn.name, fn]));
    expect(byName.get("Main.f")?.callees).toEqual(["Main.g"]);
    expect(byName.get("Main.main")?.callees).toEqual(["Main.f", "Main.g"]);
    expect(byName.get("Main.g")?.callees).toEqual([]);
  });

  it("should keep an ancestor's frame disjoint from its descendant's in the plan", () => {
    const infos = modelToFunctionInfo(analyzeClean(SRC));

    // f calls g: they can be live simultaneously → interference edge f↔g.
    const graph = buildInterferenceGraph(infos);
    expect(graph.edges.get("Main.f")?.has("Main.g")).toBe(true);

    const plan = planAllocation(
      { functions: infos, moduleVars: [], zpUserVars: [], upstreamErrors: false },
      C64_FIXTURE_PROFILE,
      createDiagnosticBag(),
    );
    expect(disjoint(frameRange(plan, "Main.f"), frameRange(plan, "Main.g"))).toBe(true);
  });
});

describe("Specification: argument-window interference", () => {
  // `main` calls f(1, g()) and g calls h: while f's first argument is already
  // stored in f's frame, g (and transitively h) executes — so f's frame must
  // stay disjoint from everything reachable from calls in its later
  // arguments, even though h is only f's sibling in the call tree.
  const SRC =
    "module Main;\n" +
    "function h(): void { let hb: byte = 1; }\n" +
    "function g(): byte { h(); return 1; }\n" +
    "function f(a: byte, b: byte): byte { let fb: byte = a; return fb; }\n" +
    "function main(): void { let r: byte = f(1, g()); }\n";

  it("should record everything reachable from later-argument calls in the callee's argument window", () => {
    const infos = modelToFunctionInfo(analyzeClean(SRC));
    const f = infos.find((fn) => fn.name === "Main.f");
    expect(f?.argWindowInterferes).toEqual(["Main.g", "Main.h"]);
  });

  it("should keep the callee's frame disjoint from a sibling reachable during argument marshalling", () => {
    const infos = modelToFunctionInfo(analyzeClean(SRC));
    const plan = planAllocation(
      { functions: infos, moduleVars: [], zpUserVars: [], upstreamErrors: false },
      C64_FIXTURE_PROFILE,
      createDiagnosticBag(),
    );
    expect(disjoint(frameRange(plan, "Main.f"), frameRange(plan, "Main.h"))).toBe(true);
  });
});
