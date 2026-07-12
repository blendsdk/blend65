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
import { IL_BYTE, IL_WORD } from "../il/il-type.js";
import { addrOf, imm, loc, temp } from "../il/operand.js";
import type { ILFunction } from "../il/cfg.js";
import { lowerToIL } from "../il/lower.js";
import { generateInstr } from "./instr-program.js";
import { printInstr } from "./print-instr.js";
import { translateFunction } from "./translate.js";

/**
 * Specification tests for the `(zp),Y` translate surface: the indirect
 * load/store framings (byte fast paths, word INY sequences from memory homes
 * and immediates), the address-of store arm (`#<sym` / `#>sym` into a word
 * home), the Y-register mirror (one `LDY` for same-offset runs; invalidated
 * by INY sequences and calls), and the loud contract guards (word values
 * register-resident or beyond the INY-safe offset, non-location pointers,
 * unreserved scratch, address-of outside its two legal positions).
 *
 * Expectations derive from the documented framings — never from reading the
 * implementation. End-to-end rows run real source through the full frontend;
 * the contract-guard rows construct IL directly (those shapes are
 * unreachable from legal source by design).
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

/** The printed stream of one function (from its label to the next stream). */
function fnAsm(text: string, label: string): string {
  const start = text.indexOf(`${label}:`);
  expect(start, `label ${label} not found`).toBeGreaterThanOrEqual(0);
  const next = text.indexOf("\n\n", start);
  return next === -1 ? text.slice(start) : text.slice(start, next);
}

/** Translates one hand-built IL function against an empty plan. */
function translateRaw(fn: ILFunction): Diagnostic[] {
  const bag = createDiagnosticBag();
  const plan = planAllocation(
    { functions: [], moduleVars: [], zpUserVars: [], upstreamErrors: false },
    DEFAULT_PROFILE,
    bag,
  );
  translateFunction(fn, plan, "nmos6502", bag);
  return bag.getAll();
}

const ENEMY = "struct Enemy { hp: byte; }";
const CELL = "struct Cell { pad: byte; w: word; }";

describe("Specification: indirect load framings (ST-48)", () => {
  it("ST-48: a byte field read folds to `LDY #off / LDA (pair),Y / STA home`", () => {
    const { text, diags } = asmSources([
      [
        "module Main;",
        "struct Pos { x: byte; y: byte; }",
        "struct Enemy { pos: Pos; hp: byte; }",
        "let r: byte;",
        "function f(e: Enemy): void { r = e.hp; }",
        "function main(): void { let boss: Enemy; f(boss); }",
      ].join("\n"),
    ]);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
    const f = fnAsm(text, "Main_f");
    const lines = f.split("\n").map((l) => l.trim());
    const ldy = lines.indexOf("LDY #$02");
    expect(ldy).toBeGreaterThanOrEqual(0);
    expect(lines[ldy + 1]).toBe("LDA (__zp_ptr_Main_f_e),Y");
    expect(lines[ldy + 2]).toBe("STA __var_Main_r");
  });
});

describe("Specification: indirect store framings (ST-49, ST-50, ST-51)", () => {
  it("ST-49: an ALU result in A stores through the pair without a reload", () => {
    const { text, diags } = asmSources([
      [
        "module Main;",
        ENEMY,
        "function f(e: Enemy, v: byte): void { e.hp = v + 1; }",
        "function main(): void { let boss: Enemy; f(boss, 4); }",
      ].join("\n"),
    ]);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
    const f = fnAsm(text, "Main_f");
    const lines = f.split("\n").map((l) => l.trim());
    const adc = lines.findIndex((l) => l.startsWith("ADC"));
    expect(adc).toBeGreaterThanOrEqual(0);
    const sta = lines.indexOf("STA (__zp_ptr_Main_f_e),Y");
    expect(sta).toBeGreaterThan(adc);
    // No accumulator reload between the ALU result and the indirect store.
    expect(lines.slice(adc + 1, sta).some((l) => l.startsWith("LDA"))).toBe(false);
  });

  it("ST-50: word load+store through pairs run lo/INY/hi from memory homes, and the mirror resets after INY", () => {
    const { text, diags } = asmSources([
      [
        "module Main;",
        CELL,
        "let out: word;",
        "function f(c: Cell): void { out = c.w; c.w = 300; }",
        "function main(): void { let x: Cell; f(x); }",
      ].join("\n"),
    ]);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
    const f = fnAsm(text, "Main_f");
    const lines = f.split("\n").map((l) => l.trim());
    // Word read: LDY #1 / LDA (pair),Y / STA out / INY / LDA (pair),Y / STA out+1.
    const firstLdy = lines.indexOf("LDY #$01");
    expect(firstLdy).toBeGreaterThanOrEqual(0);
    expect(lines[firstLdy + 1]).toBe("LDA (__zp_ptr_Main_f_c),Y");
    expect(lines[firstLdy + 2]).toBe("STA __var_Main_out");
    expect(lines[firstLdy + 3]).toBe("INY");
    expect(lines[firstLdy + 4]).toBe("LDA (__zp_ptr_Main_f_c),Y");
    expect(lines[firstLdy + 5]).toBe("STA __var_Main_out+1");
    // The INY invalidated the mirror: the following word store re-issues LDY.
    expect(lines.slice(firstLdy + 6).some((l) => l === "LDY #$01")).toBe(true);
    // Word immediate store: lo/hi via INY.
    const rest = lines.slice(firstLdy + 6).join("\n");
    expect(rest).toContain("LDA #$2C"); // 300 & 0xFF
    expect(rest).toContain("LDA #$01"); // 300 >> 8
    expect(rest).toContain("STA (__zp_ptr_Main_f_c),Y");
  });

  it("ST-51: a word indirect store from a register-resident value is a loud ICE", () => {
    const { diags } = asmSources([
      [
        "module Main;",
        CELL,
        "function getw(): word { return 300; }",
        "function f(c: Cell): void { c.w = getw(); }",
        "function main(): void { let x: Cell; f(x); }",
      ].join("\n"),
    ]);
    const ice = diags.find((d) => isIceCode(d.code));
    expect(ice).toBeDefined();
    expect(ice!.message).toContain("variable");
  });
});

describe("Specification: the addr store arm (ST-52, ST-53)", () => {
  it("ST-52: address bytes resolve as `#<sym / #>sym` — the marshalling store and the formation add", () => {
    const { text, diags } = asmSources([
      [
        "module Main;",
        ENEMY,
        "let big: byte[300];",
        "function f(e: Enemy): void { e.hp = 0; }",
        "function main(): void { let boss: Enemy; f(boss); let w: word = 260; big[w] = 1; }",
      ].join("\n"),
    ]);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
    const m = fnAsm(text, "_main");
    const lines = m.split("\n").map((l) => l.trim());
    // Marshalling: the argument's address into the callee's frame word.
    const lo = lines.indexOf("LDA #<__frame_Main_main_boss");
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(lines[lo + 1]).toBe("STA __frame_Main_f_e");
    expect(lines[lo + 2]).toBe("LDA #>__frame_Main_main_boss");
    expect(lines[lo + 3]).toBe("STA __frame_Main_f_e+1");
    // The formation adds the base address per byte and homes the sum in scratch.
    expect(m).toContain("ADC #<__var_Main_big");
    expect(m).toContain("ADC #>__var_Main_big");
    expect(m).toContain("STA __zp_ptr_scratch");
    expect(m).toContain("STA __zp_ptr_scratch+1");
    expect(m).toContain("STA (__zp_ptr_scratch),Y");
  });

  it("ST-53: an addr operand outside its two legal positions is a loud ICE (ALU left operand)", () => {
    const fn: ILFunction = {
      name: "Main.bad",
      params: [],
      returnType: "void",
      blocks: [
        {
          label: "_entry",
          instructions: [
            { op: "add", dest: temp(0, IL_WORD), left: addrOf("x"), right: imm(1, IL_WORD), type: IL_WORD },
            { op: "store", a: temp(0, IL_WORD), b: loc("__var_Main_v", IL_WORD) },
          ],
          terminator: { kind: "ret" },
        },
      ],
      tempCount: 1,
      isInterrupt: false,
    };
    const diags = translateRaw(fn);
    expect(diags.some((d) => isIceCode(d.code) && d.message.includes("addr"))).toBe(true);
  });
});

describe("Specification: the regY mirror (ST-54, ST-56)", () => {
  it("ST-54: two same-offset accesses share ONE LDY", () => {
    const { text, diags } = asmSources([
      [
        "module Main;",
        ENEMY,
        "function f(e: Enemy): void { e.hp = e.hp; }",
        "function main(): void { let boss: Enemy; f(boss); }",
      ].join("\n"),
    ]);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
    const f = fnAsm(text, "Main_f");
    const ldyCount = f.split("\n").filter((l) => l.trim() === "LDY #$00").length;
    expect(ldyCount).toBe(1);
  });

  it("ST-56: a JSR between pair accesses clears the mirror — LDY re-issues", () => {
    const { text, diags } = asmSources([
      [
        "module Main;",
        ENEMY,
        "function ping(): void { let t: byte = 1; }",
        "function f(e: Enemy): void { e.hp = 1; ping(); e.hp = 2; }",
        "function main(): void { let boss: Enemy; f(boss); }",
      ].join("\n"),
    ]);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
    const f = fnAsm(text, "Main_f");
    const ldyCount = f.split("\n").filter((l) => l.trim() === "LDY #$00").length;
    expect(ldyCount).toBe(2);
  });
});

describe("Specification: contract guards (ST-55, ST-57)", () => {
  it("ST-55: an indirect access naming an unreserved pair symbol is the loud staging backstop", () => {
    const fn: ILFunction = {
      name: "Main.bad",
      params: [],
      returnType: "void",
      blocks: [
        {
          label: "_entry",
          instructions: [
            {
              op: "store_indirect",
              value: imm(1, IL_BYTE),
              ptr: loc("__zp_ptr_scratch", IL_WORD),
              offset: imm(0, IL_BYTE),
            },
          ],
          terminator: { kind: "ret" },
        },
      ],
      tempCount: 0,
      isInterrupt: false,
    };
    const diags = translateRaw(fn);
    expect(
      diags.some((d) => isIceCode(d.code) && d.message.includes("reserved")),
    ).toBe(true);
  });

  it("ST-57: a non-location ptr operand is an ICE (lowering contract violation)", () => {
    const fn: ILFunction = {
      name: "Main.bad",
      params: [],
      returnType: "void",
      blocks: [
        {
          label: "_entry",
          instructions: [
            {
              op: "load_indirect",
              value: temp(0, IL_BYTE),
              ptr: imm(0, IL_WORD),
              offset: imm(0, IL_BYTE),
            },
            { op: "store", a: temp(0, IL_BYTE), b: loc("__var_Main_v", IL_BYTE) },
          ],
          terminator: { kind: "ret" },
        },
      ],
      tempCount: 1,
      isInterrupt: false,
    };
    const diags = translateRaw(fn);
    expect(diags.some((d) => isIceCode(d.code))).toBe(true);
  });
});

describe("Specification: golden safety (ST-58)", () => {
  it("ST-58: a pointer-free program emits no Y-indexed access and no pair symbol", () => {
    const { text, diags } = asmSources([
      [
        "module Main;",
        "struct Point { x: byte; y: byte; }",
        "function main(): void {",
        "  let pts: Point[2] = [Point { x: 1, y: 2 }, Point { x: 3, y: 4 }];",
        "  let i: byte = 1; pts[i].x = 5;",
        "  poke($C000, pts[0].y);",
        "}",
      ].join("\n"),
    ]);
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
    expect(text).not.toContain("),Y");
    expect(text).not.toContain("LDY");
    expect(text).not.toContain("__zp_ptr_");
  });
});
