/**
 * Specification tests for module-level initializer and const typing — a call
 * anywhere in a module `let` initializer (user function or builtin intrinsic
 * alike) is a loud not-supported rejection, never a silent widening of the
 * call-free surface; module consts evaluate at compile time (declaration-order
 * independent, frozen spec Ch 03 §5 VAR-6) into the model's const-value table
 * and contribute no runtime initialization; a non-constant const initializer
 * is E10193; and a module `let` initializer is checked with exactly the same
 * strict assignability + range codes as a function-local `let` (E10152 /
 * E10084).
 *
 * Expectations derive from the frozen spec Ch 03 and Ch 10 §5.4 — never from
 * the implementation. Exercised through the real public path
 * (`lex`→`parse`→`analyze`).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode, IceCode } from "@blend65/core";
import type {
  Diagnostic,
  DiagnosticBag,
  ModuleDeclNode,
  ProgramNode,
  Scope,
  SemanticModel,
} from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

/** Lexes + parses each source (ids 1..n) + analyzes them together. */
function analyzeMulti(sources: readonly string[]): {
  diags: Diagnostic[];
  model: SemanticModel;
} {
  const bag: DiagnosticBag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  return { diags: bag.getAll(), model };
}

/** Every error-severity diagnostic code, in bag order. */
function errorCodes(diags: readonly Diagnostic[]): string[] {
  return diags.filter((d) => d.severity === "error").map((d) => d.code);
}

/** The module scope named `name` hanging off the model's global scope. */
function moduleScopeOf(model: SemanticModel, name: string): Scope {
  const scope = model.globalScope.children.find(
    (c) =>
      c.kind === "module" &&
      c.node?.kind === "ModuleDecl" &&
      (c.node as ModuleDeclNode).name === name,
  );
  if (scope === undefined) throw new Error(`model has no module scope '${name}'`);
  return scope;
}

describe("Specification: module initializers — call rejection", () => {
  it("should reject a user-function call in a module let initializer loudly", () => {
    const { diags } = analyzeMulti([
      "module Main;\n" +
        "function f(): byte { return 1; }\n" +
        "let x: byte = f();\n" +
        "function main(): void {}\n",
    ]);
    expect(errorCodes(diags)).toEqual([IceCode.Unexpected]);
    const ice = diags.find((d) => d.code === IceCode.Unexpected);
    expect(ice?.message).toContain(
      "call-bearing module initializers are not supported yet",
    );
  });

  it("should reject a builtin intrinsic call in a module let initializer with the same rejection", () => {
    const { diags } = analyzeMulti([
      "module Main;\n" + "let x: byte = peek($D012);\n" + "function main(): void {}\n",
    ]);
    expect(errorCodes(diags)).toEqual([IceCode.Unexpected]);
    const ice = diags.find((d) => d.code === IceCode.Unexpected);
    expect(ice?.message).toContain(
      "call-bearing module initializers are not supported yet",
    );
  });
});

describe("Specification: module consts — compile-time evaluation", () => {
  it("should evaluate a const, record its value, and keep it out of the init order", () => {
    const { diags, model } = analyzeMulti([
      "module Main;\n" +
        "const K: byte = 3;\n" +
        "let x: byte = K + 1;\n" +
        "function main(): void {}\n",
    ]);
    expect(diags).toEqual([]);

    const kSym = moduleScopeOf(model, "Main").symbols.get("K");
    expect(kSym).toBeDefined();
    if (kSym === undefined) return;
    expect(model.constValues.get(kSym)?.value).toBe(3);

    // The const is compile-time only: it never occupies an init position.
    expect(model.initOrder.map((s) => s.name)).toEqual(["x"]);
  });

  it("should reject a const initialized from a runtime variable with E10193", () => {
    const { diags } = analyzeMulti([
      "module Main;\n" +
        "let v: byte;\n" +
        "const B: byte = v;\n" +
        "function main(): void {}\n",
    ]);
    expect(errorCodes(diags)).toEqual([DiagCode.NonConstInit]);
    const nonConst = diags.find((d) => d.code === DiagCode.NonConstInit);
    expect(nonConst?.message).toBe(
      "Initializer for const 'B' is not a compile-time constant expression",
    );
  });

  it("should evaluate consts independent of declaration order", () => {
    const { diags, model } = analyzeMulti([
      "module Main;\n" +
        "const B: byte = A + 1;\n" +
        "const A: byte = 2;\n" +
        "function main(): void {}\n",
    ]);
    expect(diags).toEqual([]);
    const bSym = moduleScopeOf(model, "Main").symbols.get("B");
    expect(bSym).toBeDefined();
    if (bSym === undefined) return;
    expect(model.constValues.get(bSym)?.value).toBe(3);
  });
});

describe("Specification: module initializers — local-let parity checks", () => {
  it("should reject a boolean initializer for a byte module let with the assignment code", () => {
    const { diags } = analyzeMulti([
      "module Main;\n" + "let x: byte = true;\n" + "function main(): void {}\n",
    ]);
    expect(errorCodes(diags)).toEqual([DiagCode.TypeMismatchAssignment]);
  });

  it("should reject an out-of-range constant initializer for a byte module let", () => {
    const { diags } = analyzeMulti([
      "module Main;\n" + "let x: byte = 300;\n" + "function main(): void {}\n",
    ]);
    expect(errorCodes(diags)).toEqual([DiagCode.ValueOutOfRange]);
  });
});
