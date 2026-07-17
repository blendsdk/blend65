import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, isIceCode } from "@blend65/core";
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

/**
 * Specification tests for the by-reference lowering surface: address-of
 * argument marshalling into the callee's frame home, the one-time entry-block
 * frame→pair prologue copies, indirect element/field access through bound
 * pairs, tier-2/big-offset runtime pointer formation through the scratch
 * pair, and the loud deferred-argument rejections.
 *
 * Expectations derive from the documented lowering shapes (the by-ref calling
 * convention: caller stores the address into the callee's 2-byte frame slot;
 * the callee copies frame→pair once and accesses `(pair),Y`) — never from
 * reading the implementation. Programs lower end-to-end through the real
 * frontend.
 */

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

const ENEMY = "struct Enemy { hp: byte; }";

describe("Specification: by-ref argument marshalling (ST-34..ST-36)", () => {
  it("ST-34: a whole-var argument stores the ADDRESS into the callee's frame home before the call", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        ENEMY,
        "function f(e: Enemy): void { e.hp = 0; }",
        "function main(): void { let boss: Enemy; f(boss); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const main = fnText(text, "Main.main");
    expect(main).toContain("store &__frame_Main_main_boss, __frame_Main_f_e");
    expect(main.indexOf("store &__frame_Main_main_boss")).toBeLessThan(main.indexOf("call Main.f"));
  });

  it("ST-35: const-indexed elements, module vars, and const tables marshal as folded addresses", () => {
    const gfx = "module Gfx;\nexport struct Enemy { hp: byte; }\nexport let shared: Enemy;\n";
    const main = [
      "module Main;",
      "import { Enemy, shared } from Gfx;",
      "const TABLE: byte[3] = [1, 2, 3];",
      "function f(e: Enemy): void { e.hp = 0; }",
      "function g(t: const byte[3]): byte { return t[0]; }",
      "function main(): void {",
      "  let enemies: Enemy[4];",
      "  f(enemies[3]);",
      "  f(Gfx.shared);",
      "  poke($C000, g(TABLE));",
      "}",
    ].join("\n");
    const { text, hasErrors } = lowerReal([gfx, main]);
    expect(hasErrors).toBe(false);
    const m = fnText(text, "Main.main");
    expect(m).toContain("store &__frame_Main_main_enemies+3, __frame_Main_f_e");
    expect(m).toContain("store &__var_Gfx_shared, __frame_Main_f_e");
    expect(m).toContain("store &__data_Main_TABLE, __frame_Main_g_t");
  });

  it("ST-36: whole pass-through copies the caller's frame WORD — no pair read", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        ENEMY,
        "function h(s: Enemy): void { s.hp = 3; }",
        "function relay(s: Enemy): void { h(s); }",
        "function main(): void { let a: Enemy; relay(a); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const relay = fnText(text, "Main.relay");
    expect(relay).toContain("load i16u __frame_Main_relay_s");
    expect(relay).toContain("__frame_Main_h_s");
    expect(relay).not.toContain("__zp_ptr_Main_relay_s");
  });
});

describe("Specification: prologue copies (ST-37)", () => {
  it("ST-37: an accessed by-ref param opens the entry block with the two frame→pair byte copies", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        ENEMY,
        "function f(e: Enemy): void { e.hp = 0; }",
        "function main(): void { let boss: Enemy; f(boss); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const f = fnText(text, "Main.f");
    expect(f).toContain("store %0, __zp_ptr_Main_f_e");
    expect(f).toContain("store %1, __zp_ptr_Main_f_e+1");
    expect(f).toContain("load i8u __frame_Main_f_e+1");
    // The prologue precedes every through-pair access.
    expect(f.indexOf("store %0, __zp_ptr_Main_f_e")).toBeLessThan(f.indexOf("store_indirect"));
  });
});

describe("Specification: indirect places through bound pairs (ST-38, ST-39)", () => {
  it("ST-38: field reads/writes through a param emit load_indirect/store_indirect at imm offsets", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "struct Pos { x: byte; y: byte; }",
        "struct Enemy { pos: Pos; hp: byte; }",
        "function f(e: Enemy): void { e.pos.y = e.hp; }",
        "function main(): void { let boss: Enemy; f(boss); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const f = fnText(text, "Main.f");
    expect(f).toContain("load_indirect"); // e.hp read at +2
    expect(f).toContain("__zp_ptr_Main_f_e, 2");
    expect(f).toContain("store_indirect"); // e.pos.y write at +1
    expect(f).toContain("__zp_ptr_Main_f_e, 1");
  });

  it("ST-39: a byte index into an unsized byte[] param rides the offset operand — no scratch", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "function f(d: byte[]): void { let i: byte = 1; d[i] = 9; }",
        "function main(): void { let a: byte[4] = [1, 2, 3, 4]; f(a); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const f = fnText(text, "Main.f");
    expect(f).toContain("store_indirect");
    expect(f).toContain("__zp_ptr_Main_f_d, %");
    expect(f).not.toContain("__zp_ptr_scratch");
  });
});

describe("Specification: runtime-computed argument places marshal a formed address (ST-40 retired → ST-10b)", () => {
  it("ST-10b: a runtime-indexed arg place forms base + scaled index through the scratch pair into the callee's frame home", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        ENEMY,
        "function f(e: Enemy): void { e.hp = 0; }",
        "function main(): void { let enemies: Enemy[4]; let i: byte = 1; f(enemies[i]); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const m = fnText(text, "Main.main");
    expect(m).toContain("__zp_ptr_scratch");
    expect(m).toContain("&__frame_Main_main_enemies");
    expect(m).toContain("store __zp_ptr_scratch, __frame_Main_f_e");
  });

  it("ST-10b: a pair-relative arg place forms pair + field offset into the callee's frame home", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "struct Pos { x: byte; y: byte; }",
        "struct Enemy { pos: Pos; hp: byte; }",
        "function g(p: Pos): void { p.x = 1; }",
        "function f(e: Enemy): void { g(e.pos); }",
        "function main(): void { let boss: Enemy; f(boss); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const f = fnText(text, "Main.f");
    expect(f).toContain("__zp_ptr_Main_f_e");
    expect(f).toContain("__zp_ptr_scratch");
    expect(f).toContain("store __zp_ptr_scratch, __frame_Main_g_p");
  });
});

describe("Specification: tier-2 / formation (ST-41, ST-42, ST-44, ST-45)", () => {
  it("ST-41: a runtime word index on word elements scales in the WORD domain (shl) into the formation", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "let wa: word[130];",
        "function main(): void { let w: word = 129; wa[w] = 5; }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const m = fnText(text, "Main.main");
    expect(m).toContain("shl");
    expect(m).toContain("__zp_ptr_scratch");
    expect(m).toContain("store_indirect");
    expect(m).toContain("&__var_Main_wa");
  });

  it("ST-42: a byte index into an unsized word[] param routes zext → word formation, never the byte scaler", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "function f(d: word[]): void { let b: byte = 128; d[b] = 1; }",
        "function main(): void { let a: word[4]; f(a); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const f = fnText(text, "Main.f");
    expect(f).toContain("zext");
    expect(f).toContain("shl");
    expect(f).toContain("__zp_ptr_scratch");
    expect(f).not.toContain("mul"); // the mod-256 byte scaler must never see this
  });

  it("ST-44: a WORD field at pair offset 255 rides the formation — never a straddling LDY #255 access", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "struct Padded { pad: byte[255]; v: word; }",
        "function f(p: Padded): void { p.v = 300; }",
        "function main(): void { let x: Padded; f(x); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const f = fnText(text, "Main.f");
    expect(f).toContain("__zp_ptr_scratch");
    expect(f).not.toContain("store_indirect %"); // no direct-offset word store at 255
    expect(f).toContain("store_indirect");
    expect(f).toContain("__zp_ptr_scratch, 0");
  });

  it("ST-45: a direct tier-2 word-index read seeds scratch with the base address, adds, then loads at +0", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "let big: byte[300];",
        "function main(): void { let w: word = 260; poke($C000, big[w]); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const m = fnText(text, "Main.main");
    // The base address enters the formation as the add's right operand
    // (assembler-resolved); the sum homes in scratch and the access is at +0.
    expect(m).toContain("&__var_Main_big");
    expect(m).toContain("add");
    expect(m).toContain("load_indirect");
    expect(m).toContain("__zp_ptr_scratch, 0");
  });
});

describe("Specification: pair-base compound & whole-copy (ST-43, ST-46, ST-47)", () => {
  it("ST-43: a non-indexed compound through a MUTABLE by-ref param is an indirect RMW — the pointer bytes stay untouched", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        ENEMY,
        "function f(e: Enemy): void { e.hp += 1; }",
        "function main(): void { let boss: Enemy; f(boss); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const f = fnText(text, "Main.f");
    expect(f).toContain("load_indirect");
    expect(f).toContain("add");
    expect(f).toContain("store_indirect");
    // Direct (non-indirect) stores naming the pair: exactly the two prologue
    // byte copies — a third would be the pointer-clobbering rewrite.
    const directPairStores = f
      .split("\n")
      .filter((l) => l.trim().startsWith("store ") && l.includes("__zp_ptr_Main_f_e"));
    expect(directPairStores).toHaveLength(2);
  });

  it("ST-46: `p = q` with both sides by-ref params copies per byte through BOTH pairs", () => {
    const { text, hasErrors } = lowerReal([
      [
        "module Main;",
        "struct Pair { a: byte; b: byte; }",
        "function f(p: Pair, q: Pair): void { p = q; }",
        "function main(): void { let x: Pair; let y: Pair; f(x, y); }",
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const f = fnText(text, "Main.f");
    const loads = f.split("\n").filter((l) => l.includes("load_indirect") && l.includes("_q"));
    const stores = f.split("\n").filter((l) => l.includes("store_indirect") && l.includes("_p"));
    expect(loads).toHaveLength(2);
    expect(stores).toHaveLength(2);
  });

  it("ST-47: an INDEXED compound through a pair stays the loud deferral; a >255 const offset rides scratch", () => {
    const indexedCompound = lowerReal([
      [
        "module Main;",
        "function f(d: byte[]): void { let i: byte = 1; d[i] += 1; }",
        "function main(): void { let a: byte[4] = [1, 2, 3, 4]; f(a); }",
      ].join("\n"),
    ]);
    expect(indexedCompound.hasErrors).toBe(true);
    expect(indexedCompound.diags.some((d) => isIceCode(d.code))).toBe(true);

    const bigOffset = lowerReal([
      [
        "module Main;",
        "struct Big { pad: byte[300]; v: byte; }",
        "function f(p: Big): void { p.v = 7; }",
        "function main(): void { let x: Big; f(x); }",
      ].join("\n"),
    ]);
    expect(bigOffset.hasErrors).toBe(false);
    expect(fnText(bigOffset.text, "Main.f")).toContain("__zp_ptr_scratch");
  });
});
