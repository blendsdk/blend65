/**
 * Specification tests for user-call lowering — the store-per-argument calling
 * convention (each argument is stored into the callee's frame slot the moment
 * it is evaluated, left to right), the bare `call` op with a destination
 * temp, the never-miscompile guard for a callee reachable from its own later
 * arguments, and the first-argument exemption (nothing is stored before the
 * first argument, so calls nested there are safe).
 *
 * Expectations derive from the frozen spec Ch 06 §5.4/§6.1 (interleaved
 * store shape, left-to-right evaluation) — never from the implementation.
 * Programs run through the real frontend; the printed IL is the witness.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { lowerToIL } from "./lower.js";
import { printIL } from "./print-il.js";

/** Real frontend over multiple sources → lowerToIL → printed IL + diagnostics. */
function lowerSources(sources: readonly string[]): { text: string; diags: Diagnostic[] } {
  const bag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  const plan = planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars: modelToModuleVars(model),
      zpUserVars: [],
      upstreamErrors: bag.hasErrors(),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const text = printIL(lowerToIL({ program: programs, model, plan }, bag));
  return { text, diags: bag.getAll() };
}

const MATH_SRC =
  "module Math;\n" +
  "export function add(a: byte, b: byte): byte { return a + b; }\n";

describe("Specification: user-call lowering — store-per-arg + bare call", () => {
  it("should store each argument into the callee's frame slot in order, then emit a bare call with a dest", () => {
    const { text, diags } = lowerSources([
      "module Main;\n" +
        "import { add } from Math;\n" +
        "let r1: byte;\n" +
        "function main(): void { let x: byte = 10; r1 = add(x, 7); }\n",
      MATH_SRC,
    ]);
    expect(diags).toEqual([]);

    // The interleaved store shape: arg 1 lands in the callee's first slot,
    // arg 2 in the second, THEN the transfer — in that order. A store renders
    // as `store <value>, <location>`.
    const storeA = text.indexOf(", __frame_Math_add_a");
    const storeB = text.indexOf(", __frame_Math_add_b");
    const call = text.indexOf("call Math.add");
    const resultStore = text.indexOf(", __var_Main_r1");
    expect(storeA).toBeGreaterThanOrEqual(0);
    expect(storeB).toBeGreaterThan(storeA);
    expect(call).toBeGreaterThan(storeB);
    expect(resultStore).toBeGreaterThan(call);

    // The call binds its result to a temp and carries NO IL args — the
    // marshalling is the explicit stores above.
    expect(text).toMatch(/%\d+ = call Math\.add\(\)/);
  });
});

describe("Specification: user-call lowering — never-miscompile guards", () => {
  it("should reject a callee reachable from its own later argument with an internal error, never wrong code", () => {
    const { diags } = lowerSources([
      "module Main;\n" +
        "function f(a: byte, b: byte): byte { return a; }\n" +
        "function g(): byte { return f(1, 2); }\n" +
        "function main(): void { let r: byte = f(1, g()); }\n",
    ]);
    const ices = diags.filter((d) => d.code.startsWith("E9"));
    expect(ices.length).toBeGreaterThanOrEqual(1);
    expect(ices.some((d) => d.message.includes("argument"))).toBe(true);
  });

  it("should compile a call nested in the FIRST argument cleanly (guards not over-broad)", () => {
    const { text, diags } = lowerSources([
      "module Main;\n" +
        "function g(n: byte): byte { return n; }\n" +
        "function f(a: byte, b: byte): byte { return a; }\n" +
        "function main(): void { let r: byte = f(g(1), 2); }\n",
    ]);
    expect(diags).toEqual([]);
    // Both calls lowered: the nested g first (its result feeds f's first slot).
    const callG = text.indexOf("call Main.g");
    const callF = text.indexOf("call Main.f");
    expect(callG).toBeGreaterThanOrEqual(0);
    expect(callF).toBeGreaterThan(callG);
  });
});
