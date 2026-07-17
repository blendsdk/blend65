/**
 * Specification tests for zeropage-variable lowering — frozen spec Ch 03
 * §2.3/§6.3. A zeropage variable is addressed through its own `__zp_*`
 * symbol exactly like a module variable is addressed through `__var_*`:
 * scalar reads/writes go direct, aggregates ride the existing indexed
 * framings against the ZP symbol, an aggregate initializer writes its
 * elements through the startup stream, and `&zpVar` yields the ZP address
 * like any other addressable variable.
 *
 * Expectations derive from the frozen spec only. Programs lower end-to-end
 * through the real frontend.
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
  modelToZpUserVars,
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
      zpUserVars: modelToZpUserVars(model),
      upstreamErrors: bag.hasErrors(),
      needsPointerScratch: modelNeedsPointerScratch(model),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: programs, model, plan }, bag);
  return { text: printIL(il), hasErrors: bag.hasErrors() };
}

describe("zeropage lowering (ST-31, ST-31b, ST-32)", () => {
  it("ST-31: an indexed zeropage array is addressed via its ZP symbol (existing framings)", () => {
    const { text, hasErrors } = lowerText([
      [
        "module Main;",
        "zeropage { pos: byte[4]; }",
        "function main(): void {",
        "  let i: byte = 1;",
        "  pos[i] = 9;",
        "  let v: byte = pos[2];",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("store_indexed");
    expect(text).toContain("__zp_Main_pos");
  });

  it("ST-31b: an aggregate zeropage initializer parses and writes its elements at startup", () => {
    const { text, hasErrors } = lowerText([
      [
        "module Main;",
        "zeropage { pos: byte[4] = [1, 2, 3, 4]; }",
        "function main(): void { }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("function __init");
    expect(text).toContain("__zp_Main_pos");
    expect(text).toContain("__zp_Main_pos+3");
  });

  it("ST-32: &zpVar yields the zeropage symbol's address", () => {
    const { text, hasErrors } = lowerText([
      [
        "module Main;",
        "zeropage { count: byte; }",
        "function main(): void {",
        "  let w: word = &count;",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("store &__zp_Main_count, __frame_Main_main_w");
  });

  it("scalar zeropage reads and writes address the ZP symbol directly", () => {
    const { text, hasErrors } = lowerText([
      [
        "module Main;",
        "zeropage { n: byte = 0; }",
        "function main(): void {",
        "  n = n + 1;",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(text).toContain("__zp_Main_n");
    expect(text).not.toContain("__var_Main_n");
  });
});
