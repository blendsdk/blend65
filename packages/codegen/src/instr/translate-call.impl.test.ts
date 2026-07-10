/**
 * Implementation tests for user-call translation internals — the A-result
 * binding after a `JSR` (no redundant reload before the consuming store),
 * sanitized multi-module labels, the void-call statement path, and the
 * remaining-use ledger's precision (a read consumed by a folded-away store
 * still counts, so a later call raises no false alarm).
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

describe("user-call translation internals", () => {
  it("binds a byte result to A: the consuming store follows the JSR without a reload", () => {
    const { text, diags } = asmSources([
      "module Main;\n" +
        "import { add } from Math;\n" +
        "let r1: byte;\n" +
        "function main(): void { r1 = add(1, 2); }\n",
      "module Math;\n" +
        "export function add(a: byte, b: byte): byte { return a + b; }\n",
    ]);
    expect(diags).toEqual([]);

    // Between the JSR and the result store there must be no instruction —
    // the result already sits in A.
    const lines = text.split("\n").map((l) => l.trim());
    const jsrAt = lines.indexOf("JSR Math_add");
    expect(jsrAt).toBeGreaterThanOrEqual(0);
    expect(lines[jsrAt + 1]).toBe("STA __var_Main_r1");
  });

  it("sanitizes multi-module call targets into distinct labels", () => {
    const { text, diags } = asmSources([
      "module Main;\n" +
        "import { add } from Math;\n" +
        "import { twice } from Util;\n" +
        "let r: byte;\n" +
        "function main(): void { r = add(twice(2), 1); }\n",
      "module Math;\nexport function add(a: byte, b: byte): byte { return a + b; }\n",
      "module Util;\nexport function twice(n: byte): byte { return n + n; }\n",
    ]);
    expect(diags).toEqual([]);
    expect(text).toContain("JSR Math_add");
    expect(text).toContain("JSR Util_twice");
    expect(text).toContain("Math_add:");
    expect(text).toContain("Util_twice:");
  });

  it("lowers a void call statement to a bare JSR with no result store", () => {
    const { text, diags } = asmSources([
      "module Main;\n" +
        "function ping(): void { let t: byte = 1; }\n" +
        "function main(): void { ping(); }\n",
    ]);
    expect(diags).toEqual([]);
    const lines = text.split("\n").map((l) => l.trim());
    const jsrAt = lines.indexOf("JSR Main_ping");
    expect(jsrAt).toBeGreaterThanOrEqual(0);
    // Nothing consumes a result: the next instruction is main's epilogue.
    expect(lines[jsrAt + 1]).toBe("RTS");
  });

  it("counts a read consumed by a folded-away store: no false live-value alarm at a later call", () => {
    // The word add folds its result directly into the store's target (the
    // store instruction itself is skipped); its operand reads must still be
    // consumed in the remaining-use ledger, or the later call would see a
    // phantom live value and refuse to compile.
    const { text, diags } = asmSources([
      "module Main;\n" +
        "import { add } from Math;\n" +
        "let w: word;\n" +
        "let r: byte;\n" +
        "function main(): void { let a: word = 1; let b: word = 2; w = a + b; r = add(1, 2); }\n",
      "module Math;\nexport function add(a: byte, b: byte): byte { return a + b; }\n",
    ]);
    expect(diags).toEqual([]);
    expect(text).toContain("JSR Math_add");
  });
});
