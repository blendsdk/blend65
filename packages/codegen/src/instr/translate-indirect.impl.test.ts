import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelNeedsPointerScratch,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { lowerToIL } from "../il/lower.js";
import { generateInstr } from "./instr-program.js";
import { printInstr } from "./print-instr.js";

/**
 * Implementation tests for the Y-mirror state machine and its interplay with
 * the accumulator protection: block boundaries clear the mirror, a TAY serves
 * an A-resident offset without disturbing A, and the byte value-in-A fast
 * path never re-orders around the offset load.
 */

/** Real frontend over sources → lower → generate → printed ASM. */
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
      needsPointerScratch: modelNeedsPointerScratch(model),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: programs, model, plan }, bag);
  const program = generateInstr(il, "nmos6502", bag);
  return { text: program.streams.map(printInstr).join("\n"), diags: bag.getAll() };
}

/** The printed stream of one function label. */
function fnAsm(text: string, label: string): string {
  const start = text.indexOf(`${label}:`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = text.indexOf("\n\n", start);
  return next === -1 ? text.slice(start) : text.slice(start, next);
}

const ENEMY = "struct Enemy { hp: byte; }";

describe("Y-mirror state machine", () => {
  it("clears the mirror at a block boundary — a loop body re-issues its LDY every iteration", () => {
    const { text, diags } = asmSources([
      [
        "module Main;",
        ENEMY,
        "function f(e: Enemy): void {",
        "  let i: byte = 0;",
        "  while (i < 3) { e.hp = i; i = i + 1; }",
        "}",
        "function main(): void { let boss: Enemy; f(boss); }",
      ].join("\n"),
    ]);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
    const f = fnAsm(text, "Main_f");
    // The store sits inside a branch-target block, so the LDY must be inside
    // the loop (after the loop-head label), not hoisted before it.
    const lines = f.split("\n").map((l) => l.trim());
    const loopLabel = lines.findIndex((l) => /^Main_f_L\d+:$/.test(l));
    const ldy = lines.findIndex((l) => l === "LDY #$00");
    expect(loopLabel).toBeGreaterThanOrEqual(0);
    expect(ldy).toBeGreaterThan(loopLabel);
  });

  it("keeps A intact when the value is already accumulator-resident (fast path ordering)", () => {
    const { text, diags } = asmSources([
      [
        "module Main;",
        ENEMY,
        "function f(e: Enemy, v: byte): void { e.hp = v + 3; }",
        "function main(): void { let boss: Enemy; f(boss, 1); }",
      ].join("\n"),
    ]);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
    const f = fnAsm(text, "Main_f");
    const lines = f.split("\n").map((l) => l.trim());
    const adc = lines.findIndex((l) => l.startsWith("ADC"));
    const sta = lines.indexOf("STA (__zp_ptr_Main_f_e),Y");
    expect(adc).toBeGreaterThanOrEqual(0);
    expect(sta).toBeGreaterThan(adc);
    const between = lines.slice(adc + 1, sta);
    // Only the offset load may sit between the ALU result and the store —
    // never an A-clobbering instruction.
    for (const l of between) {
      expect(l.startsWith("LDA")).toBe(false);
      expect(l.startsWith("PLA")).toBe(false);
      expect(l.startsWith("TXA")).toBe(false);
    }
  });

  it("shares one LDY across a mixed read+write run at the same offset, then re-issues after INY", () => {
    const CELL = "struct Cell { pad: byte; w: word; }";
    const { text, diags } = asmSources([
      [
        "module Main;",
        CELL,
        "let out: word;",
        "function f(c: Cell): void { out = c.w; c.pad = 9; }",
        "function main(): void { let x: Cell; f(x); }",
      ].join("\n"),
    ]);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
    const f = fnAsm(text, "Main_f");
    // The word read (offset 1) INYs to offset 2; the following pad write is
    // offset 0 — the mirror was invalidated, so a fresh LDY #$00 must appear.
    expect(f).toContain("INY");
    expect(f).toContain("LDY #$00");
  });
});
