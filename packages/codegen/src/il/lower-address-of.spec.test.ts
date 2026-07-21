/**
 * Specification tests for address-of (`&`) lowering. An address is a
 * link-time constant (frozen spec Ch 04 §8.5): in a plain store position —
 * a `let` initialiser, a simple assignment, a call argument, a `poke`/
 * `pokew` value — the address operand feeds the store directly and the
 * assembler materialises `#<sym` / `#>sym`. A `lo`/`hi` extraction is
 * link-time too and selects its byte from the symbol directly. In ALU
 * arithmetic the address is first homed into a synthetic word frame slot and
 * the consumer reads the slot — address operands are legal only as store
 * sources and ALU right operands, so the homed copy is what keeps arbitrary
 * expressions expressible.
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
import type { ConstDataEntry, ILProgram } from "./cfg.js";
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

  it("ST-9b: lo(&fn) / hi(&fn) select a byte directly, and still claim their slot", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "function helper(): void { }",
        "function main(): void {",
        "  poke($C000, lo(&helper));",
        "  poke($C001, hi(&helper));",
        "  let w: word = &helper + 2;",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const main = fnText(text, "Main.main");
    // The byte select carries the symbol itself: nothing is homed, and nothing
    // is read back out of a slot.
    expect(main).toContain("store <&Main_helper, $C000");
    expect(main).toContain("store >&Main_helper, $C001");
    expect(main).not.toMatch(/store &Main_helper, __frame_Main_main_0sc[01]\b/);
    expect(main).not.toMatch(/load i8u __frame_Main_main_0sc[01]\b/);
    // The two byte selects still CLAIM their scratch slots — they simply never
    // write them. The trailing ALU site is the one position that still homes,
    // so it names the third slot, and it is what would notice if the positional
    // slot counter had shifted: dropping the claims would name `0sc0` here.
    expect(main).toContain("store &Main_helper, __frame_Main_main_0sc2");
  });
});

/** The const-data entry for `symbol`, asserted to exist before use. */
function constEntry(il: ILProgram, symbol: string): ConstDataEntry {
  const entry = il.constData.find((e) => e.symbol === symbol);
  expect(entry, `const-data entry ${symbol} not found`).toBeDefined();
  return entry!;
}

describe("Specification: source-level & on a const aggregate demands a boundary for its image", () => {
  // A `&`-taken const aggregate is data the hardware will read in place
  // (sprite images, character sets), so its image must start on a boundary the
  // hardware dereferences in. The demand rides on the const-data entry as a
  // boundary in bytes, and an aggregate whose address is handed out with no
  // arithmetic around it demands a page — 256. The demand is *syntactic*: only
  // a source-level `&` registers one, and an entry nothing demanded a boundary
  // of carries no boundary at all rather than a default one, because absent is
  // what says "nothing was ever registered here".

  it("ST-C5: &T on a const array inside a function body demands a page for its entry", () => {
    const { il, hasErrors } = lowerReal([
      [
        "module Main;",
        "const T: byte[3] = [1, 2, 3];",
        "function main(): void {",
        "  let p: word = &T;",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(constEntry(il, "__data_Main_T").boundary).toBe(256);
  });

  it("ST-C6: passing the const array only by reference demands nothing", () => {
    // A by-reference argument lowers to the very same IL address-of operand
    // that `&T` produces, so an operand-level rule could not tell them apart
    // and would align every table ever passed to a helper. This is why the
    // rule keys on the source-level `&` and nothing downstream of it.
    const { il, hasErrors } = lowerReal([
      [
        "module Main;",
        "const T: byte[3] = [1, 2, 3];",
        "function sum(data: const byte[], len: byte): byte {",
        "  let total: byte = 0;",
        "  let i: byte = 0;",
        "  while (i < len) { total += data[i]; i += 1; }",
        "  return total;",
        "}",
        "function main(): void { poke($C000, sum(T, 3)); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(constEntry(il, "__data_Main_T").boundary).toBeUndefined();
  });

  it("ST-C7: & on an interrupt handler demands nothing — code has no data image", () => {
    // The module also carries a const array that is never addressed. Without
    // it the expectation would be vacuous — a program with no const data
    // trivially has nothing marked — and could not distinguish a correct rule
    // from one that marks every image the moment any `&` appears anywhere.
    const { il, hasErrors } = lowerReal([
      [
        "module Main;",
        "const T: byte[3] = [1, 2, 3];",
        "interrupt function onIRQ() { }",
        "function main(): void {",
        "  let i: byte = 1;",
        "  poke($C000, T[i]);",
        "  pokew($FFFE, &onIRQ);",
        "}",
      ].join("\n"),
    ]);
    // Lowering must survive a non-data `&` without inventing an entry to
    // demand a boundary of.
    expect(hasErrors).toBe(false);
    expect(constEntry(il, "__data_Main_T").boundary).toBeUndefined();
    expect(il.constData.filter((e) => e.boundary !== undefined)).toEqual([]);
  });

  it("ST-C8: & on a mutable module array demands nothing — RAM owns no image", () => {
    // A `let` array lives in the RAM region; there is no emitted const image
    // whose placement could be constrained, so its `&` must leave the
    // const-data table untouched. The unaddressed const array is what gives
    // that table something to be untouched: with an empty table the
    // expectation holds no matter what the rule does.
    const { il, hasErrors } = lowerReal([
      [
        "module Main;",
        "const T: byte[3] = [1, 2, 3];",
        "let arr: byte[3] = [1, 2, 3];",
        "function main(): void {",
        "  let p: word = &arr;",
        "  let i: byte = 1;",
        "  poke($C000, T[i]);",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(constEntry(il, "__data_Main_T").boundary).toBeUndefined();
    for (const entry of il.constData) {
      expect(entry.boundary, `${entry.symbol} must carry no alignment demand`).toBeUndefined();
    }
  });

  it("ST-C9: & on a const struct demands a page for its entry — any aggregate qualifies", () => {
    const { il, hasErrors } = lowerReal([
      [
        "module Main;",
        "struct Point { x: byte; y: byte; }",
        "const P: Point = Point { x: 1, y: 2 };",
        "function main(): void {",
        "  let p: word = &P;",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(constEntry(il, "__data_Main_P").boundary).toBe(256);
  });

  it("ST-C10: with two const arrays and one &-taken, exactly that one demands a boundary", () => {
    const { il, hasErrors } = lowerReal([
      [
        "module Main;",
        "const A: byte[3] = [1, 2, 3];",
        "const B: byte[3] = [4, 5, 6];",
        "function main(): void {",
        "  let p: word = &A;",
        "  let i: byte = 1;",
        "  poke($C000, B[i]);",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(constEntry(il, "__data_Main_A").boundary).toBe(256);
    expect(constEntry(il, "__data_Main_B").boundary).toBeUndefined();
  });

  it("ST-C19: with two const arrays both &-taken, both demand a boundary", () => {
    // ST-C10 alone is satisfied by an implementation that remembers a single
    // symbol slot instead of a table. A two-sprite program — the canonical game
    // shape this feature exists for — would then align only one image and
    // silently corrupt the other's display. Both entries must carry a demand.
    const { il, hasErrors } = lowerReal([
      [
        "module Main;",
        "const SPRITE_A: byte[3] = [1, 2, 3];",
        "const SPRITE_B: byte[3] = [4, 5, 6];",
        "function main(): void {",
        "  let a: word = &SPRITE_A;",
        "  let b: word = &SPRITE_B;",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(constEntry(il, "__data_Main_SPRITE_A").boundary).toBe(256);
    expect(constEntry(il, "__data_Main_SPRITE_B").boundary).toBe(256);
  });

  it("ST-C19b: & taken only in a module-scope initializer still demands a boundary", () => {
    // Module initializers lower through a second, separate lowering context
    // from function bodies. If that context kept a private record of &-taken
    // symbols, every function-body case above would still pass while an array
    // addressed only at module scope silently never aligned — so the demand
    // must survive regardless of which context saw the `&`.
    const { il, hasErrors } = lowerReal([
      [
        "module Main;",
        "const T: byte[3] = [1, 2, 3];",
        "let ptr: word = &T;",
        "function main(): void {",
        "  pokew($C000, ptr);",
        "}",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(constEntry(il, "__data_Main_T").boundary).toBe(256);
  });
});
