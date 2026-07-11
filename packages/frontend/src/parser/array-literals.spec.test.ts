import { describe, expect, it } from "vitest";
import { DiagCode, createDiagnosticBag } from "@blend65/core";
import type { DiagnosticBag, ExprNode } from "@blend65/core";
import { lex, parse } from "../index.js";

/**
 * Specification tests for array-literal parsing (spec Ch 08 §4.1/§4.2 list +
 * fill forms, grammar §6.7 trailing comma) and the aggregate-literal parse
 * contexts: `let` initialisers, `const` initialisers (the grammar's
 * `const_expression = expression` includes aggregate literals), and
 * assignment right-hand sides in statement position.
 *
 * These tests derive from the frozen spec chapters only — they are the
 * immutable oracle for the parser surface: a failure here means the parser is
 * wrong, never the test.
 */

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Lexes `source` then parses it through the public `parse()` entry. */
function parseSource(source: string, bag: DiagnosticBag) {
  const { tokens } = lex(SRC, source, bag);
  return parse({ tokens, source, sourceId: SRC, bag });
}

/**
 * Parses a program expected to be error-free and returns the initialiser
 * expression of the first top-level `let`/`const` declaration.
 */
function initialiserOf(source: string): ExprNode {
  const bag = createDiagnosticBag();
  const { ast, hasErrors } = parseSource(source, bag);
  expect(hasErrors).toBe(false);
  expect(bag.getAll()).toHaveLength(0);
  const decl = ast.items[0]!;
  if (decl.kind !== "LetDecl" && decl.kind !== "ConstDecl") {
    throw new Error(`expected a let/const declaration, got ${decl.kind}`);
  }
  if (decl.initialiser === null) throw new Error("expected an initialiser");
  return decl.initialiser;
}

/** Narrows an expression to an array literal or fails the test loudly. */
function asArrayLit(expr: ExprNode) {
  if (expr.kind !== "ArrayLitExpr") {
    throw new Error(`expected ArrayLitExpr, got ${expr.kind}`);
  }
  return expr;
}

describe("array literals — parse surface (ST-1..ST-6b)", () => {
  it("ST-1: should parse a plain element list `[1, 2, 3]` with no fill in a let initialiser", () => {
    const lit = asArrayLit(initialiserOf("module Main;\nlet a: byte[3] = [1, 2, 3];"));
    expect(lit.elements).toHaveLength(3);
    expect(lit.fill).toBeNull();
    const values = lit.elements.map((e) => (e.kind === "NumericLitExpr" ? e.value : NaN));
    expect(values).toEqual([1, 2, 3]);
  });

  it("ST-2: should parse the fill form `[1, 2, 3; 0]` — elements plus a fill value", () => {
    const lit = asArrayLit(initialiserOf("module Main;\nlet a: byte[5] = [1, 2, 3; 0];"));
    expect(lit.elements).toHaveLength(3);
    expect(lit.fill).not.toBeNull();
    expect(lit.fill!.kind).toBe("NumericLitExpr");
    if (lit.fill!.kind === "NumericLitExpr") expect(lit.fill!.value).toBe(0);
  });

  it("ST-3: should parse the pure-fill form `[; $FF]` — zero elements, fill only", () => {
    const lit = asArrayLit(initialiserOf("module Main;\nlet a: byte[8] = [; $FF];"));
    expect(lit.elements).toHaveLength(0);
    expect(lit.fill).not.toBeNull();
    if (lit.fill!.kind === "NumericLitExpr") expect(lit.fill!.value).toBe(0xff);
  });

  it("ST-4: should accept a trailing comma `[1, 2,]` without a phantom element", () => {
    const lit = asArrayLit(initialiserOf("module Main;\nlet a: byte[2] = [1, 2,];"));
    expect(lit.elements).toHaveLength(2);
    expect(lit.fill).toBeNull();
  });

  it("ST-5: should parse array AND struct literals as assignment right-hand sides in statement position", () => {
    const bag = createDiagnosticBag();
    const source = [
      "module Main;",
      "function main(): void {",
      "  a = [1, 2];",
      "  p = Point { x: 1, y: 2 };",
      "}",
    ].join("\n");
    const { ast, hasErrors } = parseSource(source, bag);
    expect(hasErrors).toBe(false);
    const fn = ast.items[0]!;
    if (fn.kind !== "FunctionDecl") throw new Error(`expected FunctionDecl, got ${fn.kind}`);
    const [first, second] = fn.body.statements;
    if (first?.kind !== "ExpressionStmt" || first.expression.kind !== "AssignExpr") {
      throw new Error("expected an assignment expression statement for the array literal");
    }
    expect(first.expression.value.kind).toBe("ArrayLitExpr");
    if (second?.kind !== "ExpressionStmt" || second.expression.kind !== "AssignExpr") {
      throw new Error("expected an assignment expression statement for the struct literal");
    }
    expect(second.expression.value.kind).toBe("StructLitExpr");
  });

  it("ST-6: should report a missing `]` on an unclosed literal and keep parsing later declarations", () => {
    const bag = createDiagnosticBag();
    const source = "module Main;\nlet a: byte[2] = [1, 2;\nlet b: byte = 1;";
    const { ast, hasErrors } = parseSource(source, bag);
    expect(hasErrors).toBe(true);
    expect(bag.getAll().some((d) => d.code === DiagCode.MissingCloseBracket)).toBe(true);
    // Recovery: the parser must still surface the following declaration.
    expect(ast.items.some((item) => item.kind === "LetDecl" && item.name === "b")).toBe(true);
  });

  it("ST-6a: should parse an array literal in a const initialiser", () => {
    const lit = asArrayLit(initialiserOf("module Main;\nconst T: byte[3] = [1, 2, 3];"));
    expect(lit.elements).toHaveLength(3);
    expect(lit.fill).toBeNull();
  });

  it("ST-6b: should parse a struct literal in a const initialiser", () => {
    const init = initialiserOf("module Main;\nconst P: Point = Point { x: 1, y: 2 };");
    expect(init.kind).toBe("StructLitExpr");
    if (init.kind === "StructLitExpr") {
      expect(init.typeName).toBe("Point");
      expect(init.fields.map((f) => f.name)).toEqual(["x", "y"]);
    }
  });
});
