/**
 * Implementation tests for address-of lowering internals: the entry-label
 * special case, qualified cross-module function operands, the module
 * initializer stream's direct store, and the homed path feeding non-store
 * consumers (`return`, compound assignment).
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
function lowerText(sources: string[]): { text: string; il: ILProgram; hasErrors: boolean } {
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
  return { text: printIL(il), il, hasErrors: bag.hasErrors() };
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
    // — a qualified name parses as a field access, and addressing a field is
    // not supported — so there is no cross-module case to exercise here.
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
    const marked = il.constData.filter((e) => e.aligned).map((e) => e.symbol);
    expect(marked).toEqual(["__data_Main_LOCAL"]);
  });

  it("yields one marked entry when the same address is taken twice", () => {
    // The record is a set. Two `&` sites on one array must not produce two
    // entries, or the emitter would lay the image down twice.
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
    expect(il.constData.filter((e) => e.aligned).map((e) => e.symbol)).toEqual(["__data_Main_T"]);
  });
});
