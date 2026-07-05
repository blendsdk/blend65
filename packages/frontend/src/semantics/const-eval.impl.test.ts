/**
 * Implementation tests for the RD-18 Slice 3b minimal const evaluator
 * (`const-eval.ts`). These cover the folding branches + the never-throw
 * div-by-zero path (a security/robustness requirement — a constant `/ 0` must
 * become a structured `divByZero` result, not a JS `Infinity`/throw).
 *
 * Nodes are obtained from the REAL parser (prefer real objects); the evaluator is
 * exercised directly on the parsed initialiser expressions.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag } from "@blend65/core";
import type { DiagnosticBag, ExprNode, LetDeclNode, ProgramNode } from "@blend65/core";
import { lex, parse } from "../index.js";
import { evalConst } from "./const-eval.js";

const SRC = 1;

/** Parses `let z: word = <expr>;` inside main and returns the initialiser node. */
function initExpr(exprText: string): ExprNode {
  const bag: DiagnosticBag = createDiagnosticBag();
  const source = `module M;\nfunction main(): void { let z: word = ${exprText}; }\n`;
  const { tokens } = lex(SRC, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: SRC, bag });
  const fn = ast.items.find((i) => i.kind === "FunctionDecl");
  if (fn === undefined || fn.kind !== "FunctionDecl") throw new Error("no main");
  const decl = fn.body.statements.find(
    (s): s is LetDeclNode => s.kind === "LetDecl" && s.name === "z",
  );
  if (decl === undefined || decl.initialiser === null) throw new Error("no initialiser");
  return decl.initialiser;
}

describe("const-eval — folding branches", () => {
  it("folds a numeric literal to its value", () => {
    expect(evalConst(initExpr("42"))).toEqual({ kind: "value", value: 42 });
  });

  it("folds integer arithmetic on constants", () => {
    expect(evalConst(initExpr("200 + 100"))).toEqual({ kind: "value", value: 300 });
    expect(evalConst(initExpr("6 * 7"))).toEqual({ kind: "value", value: 42 });
    expect(evalConst(initExpr("10 - 3"))).toEqual({ kind: "value", value: 7 });
    expect(evalConst(initExpr("17 / 5"))).toEqual({ kind: "value", value: 3 }); // trunc
    expect(evalConst(initExpr("17 % 5"))).toEqual({ kind: "value", value: 2 });
  });

  it("folds unary minus over a constant", () => {
    expect(evalConst(initExpr("-1"))).toEqual({ kind: "value", value: -1 });
  });

  it("folds lo/hi of a constant", () => {
    expect(evalConst(initExpr("lo(0x1234)"))).toEqual({ kind: "value", value: 0x34 });
    expect(evalConst(initExpr("hi(0x1234)"))).toEqual({ kind: "value", value: 0x12 });
  });
});

describe("const-eval — non-constant + div-by-zero (never throws)", () => {
  it("reports a non-constant subtree as nonConst", () => {
    expect(evalConst(initExpr("someName + 1"))).toEqual({ kind: "nonConst" });
  });

  it("reports a constant division by zero as divByZero (not a JS Infinity/throw)", () => {
    const r = evalConst(initExpr("5 / 0"));
    expect(r.kind).toBe("divByZero");
  });

  it("reports a constant remainder by zero as divByZero", () => {
    const r = evalConst(initExpr("5 % 0"));
    expect(r.kind).toBe("divByZero");
  });

  it("propagates a div-by-zero out of an enclosing operation", () => {
    const r = evalConst(initExpr("1 + 5 / 0"));
    expect(r.kind).toBe("divByZero");
  });
});
