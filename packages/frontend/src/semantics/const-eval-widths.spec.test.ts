/**
 * Specification tests for width-aware constant evaluation: const declarations
 * folding the bitwise/shift/cast surface (two's-complement semantics at the
 * declared widths), the narrowing-cast truncation warning, and the constant
 * form of the intermediate-overflow warning.
 *
 * Expectations derive exclusively from the frozen spec — Ch 02 (TS-9/TS-20
 * width semantics, TS-12 cast behavior, TS-18 const folding, TS-19 arithmetic
 * right shift) and Ch 04 §4 — plus the canonical diagnostic-code registry.
 * NOT from implementation logic. Immutable oracle. Codes are asserted by
 * their frozen numeric strings.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type {
  Diagnostic,
  DiagnosticBag,
  ModuleDeclNode,
  Scope,
  SemanticModel,
} from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Result bundle of one full `lex → parse → analyze` run. */
interface Analyzed {
  model: SemanticModel;
  bag: DiagnosticBag;
}

/** Runs `source` through the public pipeline and returns model + bag. */
function analyzeSource(source: string): Analyzed {
  const bag = createDiagnosticBag();
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  return { model, bag };
}

/** The module scope named `name` hanging off the model's global scope. */
function moduleScopeOf(model: SemanticModel, name: string): Scope {
  const scope = model.globalScope.children.find(
    (c) =>
      c.kind === "module" &&
      c.node?.kind === "ModuleDecl" &&
      (c.node as ModuleDeclNode).name === name,
  );
  if (scope === undefined) throw new Error(`fixture must declare module ${name}`);
  return scope;
}

/** The evaluated compile-time value of module const `name`. */
function constValueOf(model: SemanticModel, constName: string): number | boolean | undefined {
  const sym = moduleScopeOf(model, "Main").symbols.get(constName);
  return sym === undefined ? undefined : model.constValues.get(sym)?.value;
}

/** The error codes recorded on the bag, in the bag's sorted order. */
function errorCodes(bag: DiagnosticBag): string[] {
  return bag.getErrors().map((d: Diagnostic) => d.code);
}

/** The warning codes recorded on the bag, in the bag's sorted order. */
function warningCodes(bag: DiagnosticBag): string[] {
  return bag.getWarnings().map((d: Diagnostic) => d.code);
}

describe("Specification: const declarations fold the new operator surface (TS-18)", () => {
  it("should fold a bitwise-and const and inline it with no runtime init", () => {
    const { model, bag } = analyzeSource(
      "module Main;\nconst M: byte = $FF & $0F;\nfunction main(): void {}\n",
    );

    expect(bag.getAll()).toEqual([]);
    expect(constValueOf(model, "M")).toBe(0x0f);
    // A const is compile-time only — it never occupies an init position.
    expect(model.initOrder).toEqual([]);
  });

  it("should fold a left-shift const (TS-18)", () => {
    const { model, bag } = analyzeSource(
      "module Main;\nconst H: byte = 1 << 7;\nfunction main(): void {}\n",
    );

    expect(bag.getAll()).toEqual([]);
    expect(constValueOf(model, "H")).toBe(128);
  });

  it("should fold a narrowing cast const to the wrapped value with W10101 (TS-12)", () => {
    const { model, bag } = analyzeSource(
      "module Main;\nconst T: byte = <byte>($1FF);\nfunction main(): void {}\n",
    );

    // 511 truncates to 255 — legal (the cast is the explicit opt-in), warned.
    expect(errorCodes(bag)).toEqual([]);
    expect(constValueOf(model, "T")).toBe(255);
    expect(warningCodes(bag)).toContain("W10101");
  });

  it("should reinterpret a same-width cast and fold an arithmetic right shift (TS-12, TS-19)", () => {
    const { model, bag } = analyzeSource(
      "module Main;\nconst S: sbyte = <sbyte>($FF);\n" +
        "const N: sbyte = <sbyte>(-128) >> 1;\nfunction main(): void {}\n",
    );

    expect(errorCodes(bag)).toEqual([]);
    // $FF reinterprets bit-for-bit at the same width: 255 → -1. No warning —
    // no bits are lost.
    expect(constValueOf(model, "S")).toBe(-1);
    expect(warningCodes(bag)).not.toContain("W10101");
    // Signed right shift is arithmetic (sign-propagating): -128 >> 1 = -64.
    expect(constValueOf(model, "N")).toBe(-64);
  });
});

describe("Specification: narrowing-cast truncation warning (W10101, TS-12)", () => {
  it("should warn when a constant narrowing cast loses bits", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let b: byte = <byte>(300); }\n",
    );

    // The cast makes the truncation explicit and legal — warn, don't error.
    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).toContain("W10101");
    const warning = bag.getWarnings().find((d) => d.code === "W10101");
    expect(warning?.message).toContain("300");
    expect(warning?.message).toContain("44"); // 300 & $FF
  });

  it("should not warn when the constant fits the narrower type", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let w: word = 200; let b: byte = <byte>(200); }\n",
    );

    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).not.toContain("W10101");
  });
});

describe("Specification: constant intermediate overflow (W10161, TS-9/TS-20)", () => {
  it("should warn with the wrapped value when cast-pinned byte arithmetic provably wraps", () => {
    const { bag } = analyzeSource(
      "module Main;\nfunction main(): void { let r: word = <byte>(200) + <byte>(100); }\n",
    );

    expect(bag.hasErrors()).toBe(false);
    expect(warningCodes(bag)).toContain("W10161");
    const warning = bag.getWarnings().find((d) => d.code === "W10161");
    expect(warning?.message).toContain("44"); // 300 wraps to 44 at byte width
  });
});
