/**
 * Implementation tests for expression lowering internals: adapter↔lowering
 * slot parity (count AND size) on nested shapes, the coercion quadrants,
 * compound-assignment single-store, the `__init` pseudo-frame's presence and
 * absence, and the loud rejection of a switch discriminant carrying a slot
 * site (re-lowered per case value, so its claims over-run the planned count).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, FunctionInfo, ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { printIL } from "./print-il.js";
import { lowerToIL } from "./lower.js";

/** Lowers `source` end-to-end through the REAL frontend. */
function lowerRealSource(source: string): {
  text: string;
  hasErrors: boolean;
  diags: Diagnostic[];
  functions: FunctionInfo[];
} {
  const bag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: 1, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  const functions = modelToFunctionInfo(model);
  const plan = planAllocation(
    {
      functions,
      moduleVars: modelToModuleVars(model),
      zpUserVars: [],
      upstreamErrors: bag.hasErrors(),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: [ast], model, plan }, bag);
  return { text: printIL(il), hasErrors: bag.hasErrors(), diags: bag.getAll(), functions };
}

/** The `main` fixture wrapper. */
function inMain(body: string): string {
  return `module Main;\nfunction main(): void { ${body} }\n`;
}

describe("synthetic slot collection (adapter↔lowering parity)", () => {
  it("collects nested sites in preorder and lowering claims them all", () => {
    const { text, hasErrors, functions } = lowerRealSource(
      inMain(
        "let a: boolean = true; let c: boolean = false;" +
          " let f1: boolean = true; let f2: boolean = false;" +
          " let r: boolean = a && (c ? f1 : f2);",
      ),
    );
    expect(hasErrors).toBe(false);

    // The outer && is visited before the nested ternary — 0sc0 then 0sc1.
    const main = functions.find((f) => f.name === "Main.main");
    const slotNames = main?.locals.filter((l) => l.name.startsWith("0sc")).map((l) => l.name);
    expect(slotNames).toEqual(["0sc0", "0sc1"]);

    // Lowering resolved both (no frame-miss rejection) and both round-trip.
    expect(text).toContain("__frame_Main_main_0sc0");
    expect(text).toContain("__frame_Main_main_0sc1");
  });

  it("sizes slots from the site's result type (mixed byte/word sites)", () => {
    const { hasErrors, functions } = lowerRealSource(
      inMain(
        "let c: boolean = true; let wv: word = 1000; let f1: boolean = true;" +
          " let f2: boolean = false;" +
          " let x: word = c ? wv : 1000; let y: boolean = f1 || f2;",
      ),
    );
    expect(hasErrors).toBe(false);

    const main = lowerBy(functions, "Main.main");
    const bySlot = new Map(main.locals.map((l) => [l.name, l.type]));
    // The word ternary owns a 2-byte slot; the boolean || owns a 1-byte slot.
    expect(bySlot.get("0sc0")).toEqual({ kind: "primitive", name: "word" });
    expect(bySlot.get("0sc1")).toEqual({ kind: "primitive", name: "boolean" });
  });

  it("does not touch slot-free functions (no synthetic locals appended)", () => {
    const { functions } = lowerRealSource(inMain("let b: byte = 1; b = b + 1;"));
    const main = lowerBy(functions, "Main.main");
    expect(main.locals.some((l) => l.name.startsWith("0sc"))).toBe(false);
    expect(functions.some((f) => f.name === "__init")).toBe(false);
  });
});

/** The named projection entry (throws when absent — a test fixture bug). */
function lowerBy(functions: FunctionInfo[], name: string): FunctionInfo {
  const fn = functions.find((f) => f.name === name);
  if (fn === undefined) throw new Error(`expected projection entry ${name}`);
  return fn;
}

describe("the __init pseudo-frame", () => {
  it("appears when a module initializer carries a slot site and its slots resolve", () => {
    const { text, hasErrors, functions } = lowerRealSource(
      "module Main;\nlet flag: boolean = true;\nlet sel: byte = flag ? 1 : 2;\n" +
        "function main(): void { poke($C000, sel); }\n",
    );
    expect(hasErrors).toBe(false);

    const init = functions.find((f) => f.name === "__init");
    expect(init).toBeDefined();
    expect(init?.locals.map((l) => l.name)).toEqual(["0sc0"]);
    // The init stream's diamond resolves against the pseudo-frame.
    expect(text).toContain("__frame___init_0sc0");
  });

  it("is absent for slot-free initializers (layout unchanged)", () => {
    const { functions, hasErrors } = lowerRealSource(
      "module Main;\nlet sel: byte = 2;\nfunction main(): void { poke($C000, sel); }\n",
    );
    expect(hasErrors).toBe(false);
    expect(functions.some((f) => f.name === "__init")).toBe(false);
  });
});

describe("coercion quadrants", () => {
  it("zero-extends an unsigned 8-bit operand into a word operation", () => {
    const { text, hasErrors } = lowerRealSource(
      inMain("let b: byte = 5; let wv: word = 1000; let r: word = wv + b;"),
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("zext");
  });

  it("sign-extends a signed 8-bit operand into an sword operation", () => {
    const { text, hasErrors } = lowerRealSource(
      inMain("let s: sbyte = -5; let swv: sword = -1000; let r: sword = swv + s;"),
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("sext");
  });

  it("truncates an explicit 16→8 cast", () => {
    const { text, hasErrors } = lowerRealSource(
      inMain("let wv: word = 1000; let b2: byte = <byte>(wv);"),
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("trunc");
  });

  it("re-types a same-width cross-sign cast with a copy (no width op)", () => {
    const { text, hasErrors } = lowerRealSource(
      inMain("let b: byte = 200; let s2: sbyte = <sbyte>(b);"),
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("copy");
    expect(text).not.toContain("zext");
    expect(text).not.toContain("trunc");
  });

  it("re-encodes immediates in place (no conversion instruction for literals)", () => {
    const { text, hasErrors } = lowerRealSource(inMain("let w: word = <word>(5);"));
    expect(hasErrors).toBe(false);
    expect(text).not.toContain("zext");
  });
});

describe("compound assignment internals", () => {
  it("stores the compound result exactly once (single write-back)", () => {
    const { text, hasErrors } = lowerRealSource(
      inMain("let w: word = 100; let b: byte = 5; w += b;"),
    );
    expect(hasErrors).toBe(false);
    // Two stores total: the initialiser and the compound write-back.
    const stores = text.match(/store .*__frame_Main_main_w\b/g) ?? [];
    expect(stores).toHaveLength(2);
    // The byte operand widens into the word addition.
    expect(text).toContain("zext");
    expect(text).toContain("add i16u");
  });

  it("lowers a shift compound at the target's width with the raw amount", () => {
    const { text, hasErrors } = lowerRealSource(
      inMain("let b: byte = 8; let n: byte = 2; b <<= n;"),
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("shl i8u");
  });

  it("rejects a signed div-compound loudly", () => {
    const { diags } = lowerRealSource(
      inMain("let s: sbyte = -8; let d: sbyte = 2; s /= d;"),
    );
    const ice = diags.find((d) => d.code === "E90001");
    expect(ice?.message).toContain("signed division");
  });
});

describe("unary lowering internals", () => {
  it("folds a negative literal to its two's-complement immediate", () => {
    const { text, hasErrors } = lowerRealSource(inMain("let s: sbyte = -1;"));
    expect(hasErrors).toBe(false);
    expect(text).toContain("const i8s 255"); // -1 at 8 bits
    expect(text).not.toContain("neg");
  });

  it("emits neg/not/eq-0 for runtime unary operands", () => {
    const { text, hasErrors } = lowerRealSource(
      inMain(
        "let s: sbyte = -5; let b: byte = 12; let f: boolean = true;" +
          " let n: sbyte = -s; let m: byte = ~b; let g: boolean = !f;",
      ),
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("neg i8s");
    expect(text).toContain("not i8u");
    expect(text).toMatch(/eq i8u .*0/);
  });
});

describe("switch discriminant with a slot site (documented loud limitation)", () => {
  it("rejects the over-claiming discriminant with a frame-slot rejection, never wrong code", () => {
    // The discriminant is re-lowered once per case value, so its ternary
    // claims a second slot the planner never counted — a loud rejection.
    const { diags } = lowerRealSource(
      inMain(
        "let c: boolean = true; let a: byte = 1; let b: byte = 2;" +
          " switch (c ? a : b) { case 1: poke($C000, 1); case 2: poke($C000, 2);" +
          " default: poke($C000, 3); }",
      ),
    );
    const ice = diags.find((d) => d.code === "E90001" && d.message.includes("result slot"));
    expect(ice).toBeDefined();
  });
});
