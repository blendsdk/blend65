/**
 * Specification tests for address-of (`&`) lowering. An address is a
 * link-time constant (frozen spec Ch 04 §8.5): in a plain store position —
 * a `let` initialiser, a simple assignment, a call argument, a `poke`/
 * `pokew` value — the address operand feeds the store directly and the
 * assembler materialises `#<sym` / `#>sym`. In every other position (ALU
 * arithmetic, `lo`/`hi` extraction) the address is first homed into a
 * synthetic word frame slot, and the consumer reads the slot — address
 * operands are legal only as store sources and ALU right operands, so the
 * homed copy is what keeps arbitrary expressions expressible.
 *
 * Operand → symbol mapping: module variables address their `__var_*` slot,
 * locals their `__frame_*` slot, const aggregates their `__data_*` image,
 * and functions their emitted entry label (`Module_fn`; `main` is `_main`).
 *
 * Expectations derive from the documented lowering shapes — never from
 * reading the implementation. Programs lower end-to-end through the real
 * frontend.
 */

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
import type { ILProgram } from "./cfg.js";
import { printIL } from "./print-il.js";
import { lowerToIL } from "./lower.js";

/** Lowers sources end-to-end through the REAL frontend (production inputs). */
function lowerReal(sources: string[]): {
  text: string;
  il: ILProgram;
  hasErrors: boolean;
  diags: Diagnostic[];
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
  return { text: printIL(il), il, hasErrors: bag.hasErrors(), diags: bag.getAll() };
}

/** The printed text of one function (from its header to the next function). */
function fnText(text: string, fqName: string): string {
  const start = text.indexOf(`function ${fqName}`);
  expect(start, `function ${fqName} not found in IL text`).toBeGreaterThanOrEqual(0);
  const next = text.indexOf("\nfunction ", start + 1);
  return next === -1 ? text.slice(start) : text.slice(start, next);
}

describe("Specification: address-of in store position feeds the store directly", () => {
  it("stores &moduleVar / &localVar / &constAggregate / &fn straight into let targets", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "let m: byte = 0;",
        "const T: byte[3] = [1, 2, 3];",
        "function helper(): void { }",
        "function main(): void {",
        "  let a: word = &m;",
        "  let l: byte = 2;",
        "  let b: word = &l;",
        "  let c: word = &T;",
        "  let h: word = &helper;",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const main = fnText(text, "Main.main");
    expect(main).toContain("store &__var_Main_m, __frame_Main_main_a");
    expect(main).toContain("store &__frame_Main_main_l, __frame_Main_main_b");
    expect(main).toContain("store &__data_Main_T, __frame_Main_main_c");
    expect(main).toContain("store &Main_helper, __frame_Main_main_h");
  });

  it("ST-2 shape: pokew($FFFE, &onIRQ) is one word store with the handler label as source", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "interrupt function onIRQ() { }",
        "function main(): void {",
        "  pokew($FFFE, &onIRQ);",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(fnText(text, "Main.main")).toContain("store &Main_onIRQ, $FFFE");
  });

  it("stores &var straight into a scalar call argument's frame home", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "let m: byte = 0;",
        "function take(v: word): void { let k: word = v; }",
        "function main(): void { take(&m); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(fnText(text, "Main.main")).toContain("store &__var_Main_m, __frame_Main_take_v");
  });

  it("stores &var straight through a simple assignment to a module word variable", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "let m: byte = 0;",
        "let vec: word = 0;",
        "function main(): void { vec = &m; }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(fnText(text, "Main.main")).toContain("store &__var_Main_m, __var_Main_vec");
  });
});

describe("Specification: address-of outside store position homes through a word slot", () => {
  it("ST-9: &m + 2 homes the address, adds from the slot, and stores the sum", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "let m: byte = 0;",
        "function main(): void {",
        "  let w: word = &m + 2;",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const main = fnText(text, "Main.main");
    expect(main).toContain("store &__var_Main_m, __frame_Main_main_0sc0");
    expect(main).toMatch(/add .*__frame_Main_main_0sc0/);
    expect(main).toMatch(/store %\d+, __frame_Main_main_w/);
  });

  it("ST-9b: lo(&fn) / hi(&fn) home the address and read the slot's low/high byte", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "function helper(): void { }",
        "function main(): void {",
        "  poke($C000, lo(&helper));",
        "  poke($C001, hi(&helper));",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const main = fnText(text, "Main.main");
    expect(main).toContain("store &Main_helper, __frame_Main_main_0sc0");
    expect(main).toContain("store &Main_helper, __frame_Main_main_0sc1");
    expect(main).toMatch(/load i8u __frame_Main_main_0sc0\b/);
    expect(main).toContain("load i8u __frame_Main_main_0sc1+1");
  });
});
