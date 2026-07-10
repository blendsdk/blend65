/**
 * Specification tests for user-call translation — the caller's ASM sequence
 * (argument stores, `JSR Module_function`, result consumed from A for a byte
 * and A:X for a word) and the never-miscompile guard for a value held in a
 * register or expression temp across a user call (the callee may clobber
 * both).
 *
 * Expectations derive from the frozen spec Ch 06 §6.1/§6.2 (caller sequence,
 * A / A:X return convention) — never from the implementation. Programs run
 * through the real frontend + lowering; the printed instruction streams are
 * the witness.
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
import { lowerToIL } from "../il/lower.js";
import { generateInstr } from "./instr-program.js";
import { printInstr } from "./print-instr.js";

/** Real frontend over multiple sources → lower → generate → printed ASM. */
function asmSources(sources: readonly string[]): { text: string; diags: Diagnostic[] } {
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
  const il = lowerToIL({ program: programs, model, plan }, bag);
  const program = generateInstr(il, "nmos6502", bag);
  return { text: program.streams.map(printInstr).join("\n"), diags: bag.getAll() };
}

describe("Specification: user-call translation — caller sequence", () => {
  it("should store byte args into the callee frame, JSR the sanitized label, and store the A result", () => {
    const { text, diags } = asmSources([
      "module Main;\n" +
        "import { add } from Math;\n" +
        "let r1: byte;\n" +
        "function main(): void { let x: byte = 10; r1 = add(x, 7); }\n",
      "module Math;\n" +
        "export function add(a: byte, b: byte): byte { return a + b; }\n",
    ]);
    expect(diags).toEqual([]);

    const storeA = text.indexOf("STA __frame_Math_add_a");
    const storeB = text.indexOf("STA __frame_Math_add_b");
    const jsr = text.indexOf("JSR Math_add");
    const result = text.indexOf("STA __var_Main_r1");
    expect(storeA).toBeGreaterThanOrEqual(0);
    expect(storeB).toBeGreaterThan(storeA);
    expect(jsr).toBeGreaterThan(storeB);
    expect(result).toBeGreaterThan(jsr);
  });

  it("should round-trip a word: two-byte arg store, JSR, result consumed from A(lo)/X(hi)", () => {
    const { text, diags } = asmSources([
      "module Main;\n" +
        "import { triple } from Math;\n" +
        "let r2: word;\n" +
        "function main(): void { r2 = triple(300); }\n",
      "module Math;\n" +
        "export function triple(v: word): word { return v * 3; }\n",
    ]);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);

    // Two-byte argument store into the callee's word slot.
    const argLo = text.indexOf("STA __frame_Math_triple_v");
    const argHi = text.indexOf("__frame_Math_triple_v+1");
    const jsr = text.indexOf("JSR Math_triple");
    expect(argLo).toBeGreaterThanOrEqual(0);
    expect(argHi).toBeGreaterThan(argLo);
    expect(jsr).toBeGreaterThan(argHi);

    // The word result comes back in A(lo)/X(hi) and lands in the module var.
    const resLo = text.indexOf("STA __var_Main_r2", jsr);
    const resHi = text.indexOf("STX __var_Main_r2+1", jsr);
    expect(resLo).toBeGreaterThan(jsr);
    expect(resHi).toBeGreaterThan(jsr);
  });
});

describe("Specification: user-call translation — live-value guard", () => {
  it("should reject a value live across a user call with an internal error, never wrong code", () => {
    const { diags } = asmSources([
      "module Main;\n" +
        "function f(): byte { return 1; }\n" +
        "function g(): byte { return 2; }\n" +
        "function main(): void { let r: byte = f() + g(); }\n",
    ]);
    const ices = diags.filter((d) => d.code.startsWith("E9"));
    expect(ices.length).toBeGreaterThanOrEqual(1);
    expect(ices.some((d) => d.message.includes("live across a call"))).toBe(true);
  });
});
