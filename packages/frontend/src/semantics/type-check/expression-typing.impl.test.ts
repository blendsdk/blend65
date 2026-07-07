/**
 * Implementation tests for expression/statement typing edge cases
 * (`expression-typing.ts` + `statement-typing.ts`), exercised through the real
 * `analyze()` path. These cover literal adaptation, poison-cascade suppression,
 * the assignment-compat branches, const-folded range/div-by-zero, and the
 * never-throw contract on malformed input.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode, primitive } from "@blend65/core";
import type {
  BinaryExprNode,
  Diagnostic,
  DiagnosticBag,
  ExprNode,
  FunctionDeclNode,
  LetDeclNode,
  ProgramNode,
} from "@blend65/core";
import { lex, parse, analyze } from "../../index.js";

const SRC = 1;

function parseSource(source: string, bag: DiagnosticBag): ProgramNode {
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  return ast;
}

function letInMain(program: ProgramNode, name: string): LetDeclNode {
  const fn = program.items.find(
    (i): i is FunctionDeclNode => i.kind === "FunctionDecl" && i.name === "main",
  );
  if (fn === undefined) throw new Error("no main");
  const decl = fn.body.statements.find(
    (s): s is LetDeclNode => s.kind === "LetDecl" && s.name === name,
  );
  if (decl === undefined) throw new Error(`no let ${name}`);
  return decl;
}

function initOf(decl: LetDeclNode): ExprNode {
  if (decl.initialiser === null) throw new Error("no initialiser");
  return decl.initialiser;
}

function errorCodes(bag: DiagnosticBag): string[] {
  return bag.getErrors().map((d: Diagnostic) => d.code);
}

describe("expression typing — literal adaptation", () => {
  it("adapts a numeric-literal operand to the other operand's width (word + 1 → word)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void { let x: word = 300; let r: word = x + 1; }\n",
      bag,
    );
    const model = analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    const rInit = initOf(letInMain(program, "r")) as BinaryExprNode;
    expect(model.typeOf(rInit)).toEqual(primitive("word"));
    expect(model.typeOf(rInit.right)).toEqual(primitive("word")); // literal 1 adapted
    expect(bag.hasErrors()).toBe(false);
  });
});

describe("statement typing — assignment compatibility branches", () => {
  it("reports boolean→integer assignment with E10152", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void { let f: boolean = true; let n: byte = f; }\n",
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });
    expect(errorCodes(bag)).toContain(DiagCode.TypeMismatchAssignment); // E10152
  });

  it("reports a const-folded out-of-range initialiser with E10084", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void { let b: byte = 200 + 100; }\n",
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });
    expect(errorCodes(bag)).toContain(DiagCode.ValueOutOfRange); // E10084 (folded 300)
  });

  it("reports a constant division by zero with E10082 (no throw)", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void { let b: byte = 5 / 0; }\n",
      bag,
    );
    expect(() => analyze({ programs: [program], bag, profile: DEFAULT_PROFILE })).not.toThrow();
    expect(errorCodes(bag)).toContain(DiagCode.ConstDivisionByZero); // E10082
  });
});

describe("expression typing — poison-cascade suppression (R114)", () => {
  it("emits one diagnostic per undeclared name, no operand-type cascade", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void { let r: byte = undefA + undefB; }\n",
      bag,
    );
    analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });

    // Two undeclared names → two E10100; the poisoned `+` adds NO E10080/E10081.
    expect(errorCodes(bag)).toEqual([
      DiagCode.UndeclaredIdentifier,
      DiagCode.UndeclaredIdentifier,
    ]);
  });
});

describe("type engine — never throws on malformed input (FR-9)", () => {
  it("analyzes a deeply nested / malformed body without throwing", () => {
    const bag = createDiagnosticBag();
    const program = parseSource(
      "module Main;\nfunction main(): void { let r: byte = ((a + ) * ; poke(); }\n",
      bag,
    );
    expect(() => analyze({ programs: [program], bag, profile: DEFAULT_PROFILE })).not.toThrow();
  });
});
