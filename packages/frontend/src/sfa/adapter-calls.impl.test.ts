/**
 * Implementation tests for the adapter's call projections — FrameVar
 * ordering, argument-window dedup/sort determinism, reach() over diamond and
 * cyclic graphs (the visited-set bound must terminate on any input), and the
 * self-pair skip in the interference union.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, primitive } from "@blend65/core";
import type { DiagnosticBag, SemanticModel } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";
import { modelToFunctionInfo } from "./model-adapter.js";
import { buildInterferenceGraph } from "./interference.js";

/** Lexes + parses + analyzes `source`; diagnostics are the caller's concern. */
function analyzeModel(source: string): SemanticModel {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast } = parse({ tokens, source, sourceId: 1, bag });
  return analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
}

describe("adapter projections", () => {
  it("orders parameters before locals, each in declaration order", () => {
    const model = analyzeModel(
      "module Main;\n" +
        "function f(b: byte, a: word): byte { let z: byte = b; let y: byte = z; return y; }\n" +
        "function main(): void { let r: byte = f(1, 2); }\n",
    );
    const f = modelToFunctionInfo(model).find((fn) => fn.name === "Main.f");
    expect(f?.parameters.map((p) => p.name)).toEqual(["b", "a"]);
    expect(f?.parameters[1]?.type).toEqual(primitive("word"));
    expect(f?.locals.map((l) => l.name)).toEqual(["z", "y"]);
  });

  it("dedupes and sorts the argument window across multiple call sites", () => {
    // Two call sites of f contribute overlapping reach sets: g→x and h→x.
    const model = analyzeModel(
      "module Main;\n" +
        "function x(): void {}\n" +
        "function g(): byte { x(); return 1; }\n" +
        "function h(): byte { x(); return 2; }\n" +
        "function f(a: byte, b: byte): byte { return a; }\n" +
        "function helper(): void { let s: byte = f(2, h()); }\n" +
        "function main(): void { let r: byte = f(1, g()); helper(); }\n",
    );
    const f = modelToFunctionInfo(model).find((fn) => fn.name === "Main.f");
    // Each name exactly once, lexicographically sorted.
    expect(f?.argWindowInterferes).toEqual(["Main.g", "Main.h", "Main.x"]);
  });

  it("walks a diamond reach without duplicates", () => {
    const model = analyzeModel(
      "module Main;\n" +
        "function d(): void {}\n" +
        "function l(): void { d(); }\n" +
        "function r(): void { d(); }\n" +
        "function g(): byte { l(); r(); return 1; }\n" +
        "function f(a: byte, b: byte): byte { return a; }\n" +
        "function main(): void { let v: byte = f(1, g()); }\n",
    );
    const f = modelToFunctionInfo(model).find((fn) => fn.name === "Main.f");
    expect(f?.argWindowInterferes).toEqual(["Main.d", "Main.g", "Main.l", "Main.r"]);
  });

  it("terminates on a cyclic call graph and still projects the window", () => {
    // The analyzer rejects the g↔h cycle (the driver would gate planning),
    // but the adapter itself must stay bounded on ANY input as defense.
    const model = analyzeModel(
      "module Main;\n" +
        "function g(): byte { h(); return 1; }\n" +
        "function h(): byte { g(); return 2; }\n" +
        "function f(a: byte, b: byte): byte { return a; }\n" +
        "function main(): void { let r: byte = f(1, g()); }\n",
    );
    const f = modelToFunctionInfo(model).find((fn) => fn.name === "Main.f");
    expect(f?.argWindowInterferes).toEqual(["Main.g", "Main.h"]);
  });

  it("skips the self-pair in the interference union", () => {
    // f nested in f's own later argument: the window contains f itself; the
    // interference union must not record a self-edge (the shape is rejected
    // loudly at lowering instead).
    const model = analyzeModel(
      "module Main;\n" +
        "function f(a: byte, b: byte): byte { return a; }\n" +
        "function main(): void { let r: byte = f(1, f(1, 2)); }\n",
    );
    const infos = modelToFunctionInfo(model);
    const f = infos.find((fn) => fn.name === "Main.f");
    expect(f?.argWindowInterferes).toEqual(["Main.f"]);

    const graph = buildInterferenceGraph(infos);
    expect(graph.edges.get("Main.f")?.has("Main.f")).toBe(false);
  });
});
