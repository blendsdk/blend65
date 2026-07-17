/**
 * Implementation tests for argument-address formation internals: byte-domain
 * indexes widen before joining the word add, word-domain indexes scale by the
 * element size, a pair base folds a non-zero field offset into the formed
 * word, and a pair base composes with a runtime element index. Every formed
 * word homes through the one scratch pair before the callee-home store.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelNeedsPointerScratch,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { printIL } from "./print-il.js";
import { lowerToIL } from "./lower.js";

/** Lowers sources through the real frontend and prints the IL. */
function lowerText(sources: string[]): { text: string; hasErrors: boolean } {
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
  return { text: printIL(il), hasErrors: bag.hasErrors() };
}

describe("argument-address formation internals", () => {
  it("widens a scaled byte-domain index (multi-byte elements) before the word add", () => {
    const { text, hasErrors } = lowerText([
      [
        "module Main;",
        "struct Pos { x: byte; y: byte; }",
        "function f(p: Pos): void { p.x = 1; }",
        "function main(): void { let ps: Pos[4]; let i: byte = 1; f(ps[i]); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("zext");
    expect(text).toMatch(/add .*&__frame_Main_main_ps/);
    expect(text).toContain("store __zp_ptr_scratch, __frame_Main_f_p");
  });

  it("folds a non-zero field offset of a pair base into the formed word", () => {
    const { text, hasErrors } = lowerText([
      [
        "module Main;",
        "struct Pos { x: byte; y: byte; }",
        "struct Enemy { hp: byte; pos: Pos; }",
        "function g(p: Pos): void { p.x = 1; }",
        "function f(e: Enemy): void { g(e.pos); }",
        "function main(): void { let boss: Enemy; f(boss); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toMatch(/add .*__zp_ptr_Main_f_e.*, 1\b|add .*, 1\n/);
    expect(text).toContain("store __zp_ptr_scratch, __frame_Main_g_p");
  });

  it("composes a pair base with a runtime element index", () => {
    const { text, hasErrors } = lowerText([
      [
        "module Main;",
        "struct Room { door: byte; }",
        "struct World { rooms: Room[4]; }",
        "function g(r: Room): void { r.door = 1; }",
        "function f(w: World): void { let i: byte = 2; g(w.rooms[i]); }",
        "function main(): void { let earth: World; f(earth); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("zext");
    expect(text).toMatch(/add .*__zp_ptr_scratch|add .*%\d+/);
    expect(text).toContain("store __zp_ptr_scratch, __frame_Main_g_r");
  });
});
