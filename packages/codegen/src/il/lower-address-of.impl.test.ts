/**
 * Implementation tests for address-of lowering internals: the entry-label
 * special case, qualified cross-module function operands, the module
 * initializer stream's direct store, the homed path feeding non-store
 * consumers (`return`, compound assignment), and the alignment demand a folded
 * divisor mints — exhaustively across every shift the fold admits.
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
import type { ILProgram } from "./cfg.js";
import { printIL } from "./print-il.js";
import { lowerToIL } from "./lower.js";

/** Lowers sources through the real frontend and prints the IL. */
function lowerText(sources: string[]): {
  text: string;
  il: ILProgram;
  hasErrors: boolean;
  codes: string[];
} {
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
  return {
    text: printIL(il),
    il,
    hasErrors: bag.hasErrors(),
    codes: bag.getAll().map((d) => d.code),
  };
}

describe("address-of lowering internals", () => {
  it("resolves a qualified exported &Math.fn to the cross-module entry label", () => {
    const { text, hasErrors } = lowerText([
      ["module Math;", "export function fn(): byte { return 1; }"].join("\n"),
      ["module Main;", "function main(): void { let h: word = &Math.fn; }"].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("store &Math_fn, __frame_Main_main_h");
  });

  it("resolves &main to the entry label _main", () => {
    const { text, hasErrors } = lowerText([
      ["module Main;", "function main(): void { let h: word = &main; }"].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("store &_main, __frame_Main_main_h");
  });

  it("stores a module initializer's &fn directly in the __init stream", () => {
    const { text, hasErrors } = lowerText([
      [
        "module Main;",
        "function helper(): void { }",
        "let vec: word = &helper;",
        "function main(): void { }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("store &Main_helper, __var_Main_vec");
  });

  it("returns an address through its homed slot (ret is not a store position)", () => {
    const { text, hasErrors } = lowerText([
      [
        "module Main;",
        "let m: byte = 0;",
        "function addr(): word { return &m; }",
        "function main(): void { let a: word = addr(); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("store &__var_Main_m, __frame_Main_addr_0sc0");
    expect(text).toMatch(/ret __frame_Main_addr_0sc0/);
  });

  it("feeds a compound assignment from the homed slot", () => {
    const { text, hasErrors } = lowerText([
      [
        "module Main;",
        "let m: byte = 0;",
        "let vec: word = 0;",
        "function main(): void { vec += &m; }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("store &__var_Main_m, __frame_Main_main_0sc0");
    expect(text).toMatch(/add .*__frame_Main_main_0sc0/);
  });
});

describe("the address-taken record's lifetime", () => {
  it("marks exactly one entry when a program spans several modules", () => {
    // Modules lower one after another, each contributing its own images. The
    // record is program-wide, so an unaddressed image in a module that lowered
    // earlier must not pick up the mark from a later module's `&`.
    //
    // Note the `&` and the image it names are deliberately in the SAME module:
    // taking the address of another module's const is rejected upstream today
    // — see the case below — so there is no cross-module case to exercise here.
    const { il, hasErrors } = lowerText([
      ["module Gfx;", "export const TABLE: byte[3] = [1, 2, 3];"].join("\n"),
      [
        "module Main;",
        "const LOCAL: byte[3] = [4, 5, 6];",
        "function main(): void {",
        "  let p: word = &LOCAL;",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const marked = il.constData.filter((e) => e.boundary !== undefined).map((e) => e.symbol);
    expect(marked).toEqual(["__data_Main_LOCAL"]);
  });

  it("yields one marked entry when the same address is taken twice", () => {
    // The record is keyed by symbol. Two `&` sites on one array must not
    // produce two entries, or the emitter would lay the image down twice.
    const { il, hasErrors } = lowerText([
      [
        "module Main;",
        "const T: byte[3] = [1, 2, 3];",
        "function main(): void {",
        "  let a: word = &T;",
        "  let b: word = &T;",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(il.constData.filter((e) => e.symbol === "__data_Main_T")).toHaveLength(1);
    expect(il.constData.filter((e) => e.boundary !== undefined).map((e) => e.symbol)).toEqual([
      "__data_Main_T",
    ]);
  });

  it("cannot mark another module's const — the qualified address-of is rejected first", () => {
    // `&Gfx.TABLE` parses as the address of a field access, which the analyzer
    // turns away before lowering ever sees it. Pinning that here keeps the
    // note above honest: if this ever starts compiling, the marking rule has a
    // cross-module case that nothing currently covers.
    const { il, codes } = lowerText([
      ["module Gfx;", "export const TABLE: byte[3] = [1, 2, 3];"].join("\n"),
      ["module Main;", "function main(): void { let p: word = &Gfx.TABLE; }"].join("\n"),
    ]);
    expect(codes).toContain("E10042");
    expect(il.constData.filter((e) => e.boundary !== undefined)).toEqual([]);
  });
});

describe("the alignment demand a folded divisor mints", () => {
  /** The boundary lowering records for `SPRITE` when its address is named as `expr`. */
  function boundaryOf(expr: string, extraDecls: string[] = []): number | undefined {
    const { il, hasErrors } = lowerText([
      [
        "module Main;",
        ...extraDecls,
        "const SPRITE: byte[64] = [",
        "  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,",
        "  17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,",
        "  33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,",
        "  49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64",
        "];",
        "function main(): void {",
        `  poke($07F8, ${expr});`,
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors, `lowering ${expr} must not error`).toBe(false);
    return il.constData.find((e) => e.symbol === "__data_Main_SPRITE")?.boundary;
  }

  it("maps only the block shift to 64 — every other divisor the fold accepts keeps a page", () => {
    // Exhaustive across the shifts the fold admits, reached through lowering
    // rather than by calling the mapping directly, so the wiring between the
    // fold and the mark is covered along with the rule itself.
    for (let k = 0; k <= 15; k++) {
      const divisor = 2 ** k;
      expect(boundaryOf(`lo(&SPRITE / ${divisor})`), `/ ${divisor}`).toBe(k === 6 ? 64 : 256);
    }
  });

  it("reads the shift, not the operator: >> 6 mints the same demand as / 64", () => {
    expect(boundaryOf("lo(&SPRITE >> 6)")).toBe(64);
    expect(boundaryOf("lo(&SPRITE >> 7)")).toBe(256);
  });

  it("keeps a page for a divisor the fold rejects, which never reaches the mapping", () => {
    // A non-power-of-two divisor falls through to the ordinary path with its
    // existing diagnostics; the symbol still collects a page from that path.
    expect(boundaryOf("lo(&SPRITE / 3)")).toBe(256);
  });

  it("takes the coarser demand whichever order the two namings appear in", () => {
    const block = "poke($07F8, lo(&SPRITE / 64));";
    const page = "poke($D000, hi(&SPRITE) * 4);";
    expect(boundaryOf(`lo(&SPRITE / 64)`, [`function pageToo(): void { ${page} }`])).toBe(256);
    // And with the statements the other way round inside one function.
    const both = (first: string, second: string): number | undefined => {
      const { il, hasErrors } = lowerText([
        [
          "module Main;",
          "const SPRITE: byte[4] = [1, 2, 3, 4];",
          "function main(): void {",
          `  ${first}`,
          `  ${second}`,
          "}",
        ].join("\n"),
      ]);
      expect(hasErrors).toBe(false);
      return il.constData.find((e) => e.symbol === "__data_Main_SPRITE")?.boundary;
    };
    expect(both(block, page)).toBe(256);
    expect(both(page, block)).toBe(256);
  });

  it("stays at 64 when the same symbol is named as a block from two functions", () => {
    // The demand map is program-wide, so a second block naming must combine
    // with the first rather than land beside it or coarsen it.
    const { il, hasErrors } = lowerText([
      [
        "module Main;",
        "const SPRITE: byte[4] = [1, 2, 3, 4];",
        "function other(): void { poke($07F9, lo(&SPRITE / 64)); }",
        "function main(): void { poke($07F8, lo(&SPRITE / 64)); other(); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(il.constData.find((e) => e.symbol === "__data_Main_SPRITE")?.boundary).toBe(64);
  });
});
