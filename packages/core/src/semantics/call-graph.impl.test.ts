/**
 * Implementation tests for the call-graph cycle finder — anchor determinism,
 * diamond (acyclic) graphs, self-loops, multiple cycles, and termination on
 * dense cyclic input.
 */

import { describe, expect, it } from "vitest";
import { createScope, ERROR_TYPE } from "./index.js";
import type { AstNode } from "../ast/index.js";
import type { Symbol } from "./symbol.js";
import { findCallCycles } from "./call-graph.js";

/** A minimal function symbol — only identity and `name` matter to the graph. */
function fn(name: string): Symbol {
  const decl: AstNode = { kind: "FunctionDecl", span: { sourceId: 1, start: 0, end: 0 } };
  return {
    name,
    kind: "function",
    type: ERROR_TYPE,
    decl,
    scope: createScope("module", null, null),
    exported: false,
    mutable: false,
    byRef: false,
  };
}

/** Builds the (functions, edges) pair from adjacency by name. */
function graph(
  names: readonly string[],
  adjacency: Readonly<Record<string, readonly string[]>>,
): { functions: Set<Symbol>; edges: Map<Symbol, Set<Symbol>>; byName: Map<string, Symbol> } {
  const byName = new Map(names.map((n) => [n, fn(n)]));
  const functions = new Set(byName.values());
  const edges = new Map<Symbol, Set<Symbol>>();
  for (const [caller, callees] of Object.entries(adjacency)) {
    const from = byName.get(caller);
    if (from === undefined) continue;
    edges.set(
      from,
      new Set(
        callees.flatMap((c) => {
          const target = byName.get(c);
          return target === undefined ? [] : [target];
        }),
      ),
    );
  }
  return { functions, edges, byName };
}

describe("findCallCycles", () => {
  it("finds no cycles in a diamond graph", () => {
    const g = graph(["main", "a", "b", "c"], {
      main: ["a", "b"],
      a: ["c"],
      b: ["c"],
    });
    expect(findCallCycles(g.functions, g.edges)).toEqual([]);
  });

  it("reports a self-loop as a one-member cycle", () => {
    const g = graph(["main", "f"], { main: ["f"], f: ["f"] });
    const cycles = findCallCycles(g.functions, g.edges);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].map((s) => s.name)).toEqual(["f"]);
  });

  it("anchors a cycle at its first-declared member regardless of edge direction", () => {
    // `pong` is declared before `ping`; the cycle must anchor at `pong`.
    const g = graph(["main", "pong", "ping"], {
      main: ["ping"],
      ping: ["pong"],
      pong: ["ping"],
    });
    const cycles = findCallCycles(g.functions, g.edges);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].map((s) => s.name)).toEqual(["pong", "ping"]);
  });

  it("orders multiple cycles by their anchors' declaration order", () => {
    const g = graph(["a", "b", "x", "y"], {
      a: ["b"],
      b: ["a"],
      x: ["y"],
      y: ["x"],
    });
    const cycles = findCallCycles(g.functions, g.edges);
    expect(cycles.map((c) => c.map((s) => s.name))).toEqual([
      ["a", "b"],
      ["x", "y"],
    ]);
  });

  it("terminates on a dense fully-connected component and reports it once", () => {
    const g = graph(["p", "q", "r"], {
      p: ["q", "r"],
      q: ["p", "r"],
      r: ["p", "q"],
    });
    const cycles = findCallCycles(g.functions, g.edges);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toHaveLength(3);
    expect(cycles[0][0].name).toBe("p"); // anchored at the first-declared member
  });

  it("ignores callees that are not in the function set", () => {
    const g = graph(["main"], { main: ["main"] });
    // A phantom edge target outside `functions` must not be walked.
    const main = g.byName.get("main");
    expect(main).toBeDefined();
    if (main === undefined) return;
    g.edges.set(main, new Set([fn("phantom")]));
    expect(findCallCycles(g.functions, g.edges)).toEqual([]);
  });
});
