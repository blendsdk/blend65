/**
 * Implementation tests for width-aware constant evaluation: the
 * two's-complement helper boundaries, width-sensitive bitwise/shift folds,
 * lazy logical/ternary folding (the unevaluated side never folds), and the
 * full 16-pair integer cast table. Spec-level outcomes are pinned by the
 * co-located spec suite; these sweep the numeric interior and the edges.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type {
  DiagnosticBag,
  ExprNode,
  FunctionDeclNode,
  LetDeclNode,
  SemanticModel,
} from "@blend65/core";
import { lex, parse, analyze } from "../index.js";
import { evalConst, fromBits, toBits } from "./const-eval.js";
import type { ConstEvalResult } from "./const-eval.js";

const SRC = 1;

/**
 * Analyzes `let out: <declType> = <exprSrc>;` inside `main` and folds the
 * initialiser with the model's type lookup — the exact seam Pass 3 uses.
 */
function foldInMain(
  exprSrc: string,
  declType: string,
): { result: ConstEvalResult; bag: DiagnosticBag } {
  const bag = createDiagnosticBag();
  const source = `module Main;\nfunction main(): void { let out: ${declType} = ${exprSrc}; }\n`;
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  const model: SemanticModel = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });

  const fn = ast.items.find(
    (i): i is FunctionDeclNode => i.kind === "FunctionDecl" && i.name === "main",
  );
  const decl = fn?.body.statements.find(
    (s): s is LetDeclNode => s.kind === "LetDecl" && s.name === "out",
  );
  const init: ExprNode | null = decl?.initialiser ?? null;
  if (init === null) throw new Error("fixture must initialise 'out'");
  return { result: evalConst(init, undefined, (e) => model.typeOf(e)), bag };
}

/** Narrows a fold result to its numeric value (fails the test otherwise). */
function valueOf(result: ConstEvalResult): number | boolean {
  if (result.kind !== "value") throw new Error(`expected a value, got ${result.kind}`);
  return result.value;
}

describe("toBits / fromBits boundaries", () => {
  it("masks values to 8 bits (two's complement)", () => {
    expect(toBits(0, 8)).toBe(0);
    expect(toBits(255, 8)).toBe(255);
    expect(toBits(256, 8)).toBe(0);
    expect(toBits(300, 8)).toBe(44);
    expect(toBits(-1, 8)).toBe(255);
    expect(toBits(-128, 8)).toBe(128);
    expect(toBits(-256, 8)).toBe(0);
  });

  it("masks values to 16 bits (two's complement)", () => {
    expect(toBits(65535, 16)).toBe(65535);
    expect(toBits(65536, 16)).toBe(0);
    expect(toBits(-1, 16)).toBe(65535);
    expect(toBits(-32768, 16)).toBe(32768);
  });

  it("reinterprets 8-bit patterns at the sign boundary", () => {
    expect(fromBits(127, 8, true)).toBe(127);
    expect(fromBits(128, 8, true)).toBe(-128);
    expect(fromBits(255, 8, true)).toBe(-1);
    expect(fromBits(255, 8, false)).toBe(255);
  });

  it("reinterprets 16-bit patterns at the sign boundary", () => {
    expect(fromBits(32767, 16, true)).toBe(32767);
    expect(fromBits(32768, 16, true)).toBe(-32768);
    expect(fromBits(65535, 16, true)).toBe(-1);
    expect(fromBits(65535, 16, false)).toBe(65535);
  });
});

describe("width-sensitive bitwise and complement folds", () => {
  it("folds non-negative bitwise ops directly", () => {
    expect(valueOf(foldInMain("$F0 | $0F", "byte").result)).toBe(255);
    expect(valueOf(foldInMain("$FF ^ $0F", "byte").result)).toBe(240);
    expect(valueOf(foldInMain("$FF & $0F", "byte").result)).toBe(15);
  });

  it("folds negative-operand bitwise ops at the operand width", () => {
    // -16 is 0xF0 at byte width; 0xF0 & 0x0F = 0.
    expect(valueOf(foldInMain("<sbyte>(-16) & 15", "sbyte").result)).toBe(0);
    // -1 is 0xFF; 0xFF ^ 0x0F = 0xF0 → signed -16.
    expect(valueOf(foldInMain("<sbyte>(-1) ^ 15", "sbyte").result)).toBe(-16);
  });

  it("folds ~ at the operand's own width and signedness", () => {
    expect(valueOf(foldInMain("~$F0", "byte").result)).toBe(15);
    expect(valueOf(foldInMain("~1", "byte").result)).toBe(254);
    expect(valueOf(foldInMain("~<sbyte>(0)", "sbyte").result)).toBe(-1);
    expect(valueOf(foldInMain("~<word>(0)", "word").result)).toBe(65535);
  });
});

describe("shift folds", () => {
  it("folds left shifts and drops the overflow out of the width", () => {
    expect(valueOf(foldInMain("1 << 7", "byte").result)).toBe(128);
    // 0x81 << 1 = 0x102 → 0x02 at byte width.
    expect(valueOf(foldInMain("<byte>($81) << 1", "byte").result)).toBe(2);
    expect(valueOf(foldInMain("<word>(1) << 15", "word").result)).toBe(32768);
  });

  it("folds a left shift at or beyond the width to 0", () => {
    expect(valueOf(foldInMain("<byte>($FF) << 8", "byte").result)).toBe(0);
    expect(valueOf(foldInMain("<word>($FFFF) << 16", "word").result)).toBe(0);
  });

  it("folds unsigned right shifts logically", () => {
    expect(valueOf(foldInMain("<byte>($FF) >> 4", "byte").result)).toBe(15);
    expect(valueOf(foldInMain("<byte>($FF) >> 8", "byte").result)).toBe(0);
    expect(valueOf(foldInMain("<word>($8000) >> 15", "word").result)).toBe(1);
  });

  it("folds signed right shifts arithmetically (sign-propagating)", () => {
    expect(valueOf(foldInMain("<sbyte>(-128) >> 1", "sbyte").result)).toBe(-64);
    expect(valueOf(foldInMain("<sbyte>(-2) >> 1", "sbyte").result)).toBe(-1);
    expect(valueOf(foldInMain("<sbyte>(-1) >> 8", "sbyte").result)).toBe(-1); // saturates
    expect(valueOf(foldInMain("<sword>(-4) >> 1", "sword").result)).toBe(-2);
  });
});

describe("lazy logical and selected-arm ternary folds", () => {
  it("does NOT surface a division by zero in a short-circuited operand", () => {
    expect(valueOf(foldInMain("false && (1 / 0 == 0)", "boolean").result)).toBe(false);
    expect(valueOf(foldInMain("true || (1 % 0 == 0)", "boolean").result)).toBe(true);
  });

  it("surfaces a division by zero in an operand that IS evaluated", () => {
    expect(foldInMain("true && (1 / 0 == 0)", "boolean").result.kind).toBe("divByZero");
  });

  it("folds only the selected ternary arm", () => {
    expect(valueOf(foldInMain("true ? 2 : 1 / 0", "byte").result)).toBe(2);
    expect(foldInMain("false ? 2 : 1 / 0", "byte").result.kind).toBe("divByZero");
  });

  it("folds comparisons over constants to booleans", () => {
    expect(valueOf(foldInMain("3 < 4", "boolean").result)).toBe(true);
    expect(valueOf(foldInMain("4 <= 3", "boolean").result)).toBe(false);
    expect(valueOf(foldInMain("true == false", "boolean").result)).toBe(false);
    expect(valueOf(foldInMain("5 != 6", "boolean").result)).toBe(true);
  });

  it("folds logical not", () => {
    expect(valueOf(foldInMain("!true", "boolean").result)).toBe(false);
    expect(valueOf(foldInMain("!!false", "boolean").result)).toBe(false);
  });
});

describe("the 16 integer cast pairs", () => {
  // One representative value per source type, cast to all four targets. The
  // expected values are hand-computed two's-complement reinterpretations.
  const CASES: [from: string, literal: string, to: string, expected: number][] = [
    ["byte", "200", "byte", 200],
    ["byte", "200", "sbyte", -56],
    ["byte", "200", "word", 200],
    ["byte", "200", "sword", 200],
    ["sbyte", "-100", "byte", 156],
    ["sbyte", "-100", "sbyte", -100],
    ["sbyte", "-100", "word", 65436],
    ["sbyte", "-100", "sword", -100],
    ["word", "40000", "byte", 64],
    ["word", "40000", "sbyte", 64],
    ["word", "40000", "word", 40000],
    ["word", "40000", "sword", -25536],
    ["sword", "-20000", "byte", 224],
    ["sword", "-20000", "sbyte", -32],
    ["sword", "-20000", "word", 45536],
    ["sword", "-20000", "sword", -20000],
  ];

  for (const [from, literal, to, expected] of CASES) {
    it(`folds <${to}>(<${from}>(${literal})) to ${expected}`, () => {
      const { result } = foldInMain(`<${to}>(<${from}>(${literal}))`, to);
      expect(valueOf(result)).toBe(expected);
    });
  }

  it("does not fold a cast to a named (non-primitive) target", () => {
    // The named target does not resolve — the cast is a silent poison at
    // typing and unfoldable here.
    const { result } = foldInMain("<Enemy>(1)", "byte");
    expect(result.kind).toBe("nonConst");
  });
});
