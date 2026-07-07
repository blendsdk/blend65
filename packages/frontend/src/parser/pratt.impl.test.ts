/**
 * Pratt expression-parser tests.
 *
 * These exercise the 14-level binding-power parser: operator precedence,
 * left-associativity, right-associativity of assignment and the conditional
 * operator, and the prefix-vs-infix disambiguation of `<` (cast vs less-than)
 * and `&` (address-of vs bitwise-and) plus unary, cast, and the postfix
 * `.`/`[]`/`()` chain. Inputs are derived from the spec grammar — never from
 * implementation output (testing.md Rule 10).
 *
 * Each expression is embedded in `function f(): void { return <expr>; }` and the
 * `ReturnStmt`'s value is the node under test. `return` parses its value with
 * struct-literals disabled, so these tests see pure operator structure.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag } from "@blend65/core";
import type { DiagnosticBag, ExprNode } from "@blend65/core";
import { lex, parse } from "../index.js";

const SRC = 1;

/** Parses `return <src>;` inside a function body and returns the value node. */
function exprOf(src: string, bag: DiagnosticBag): ExprNode {
  const source = `module M;\nfunction f(): void { return ${src}; }`;
  const { tokens } = lex(SRC, source, bag);
  const { ast } = parse({ tokens, source, sourceId: SRC, bag });
  const fn = ast.items[0];
  if (fn === undefined || fn.kind !== "FunctionDecl") throw new Error("expected FunctionDecl");
  const ret = fn.body.statements[0];
  if (ret === undefined || ret.kind !== "ReturnStmt" || ret.value === null) {
    throw new Error("expected ReturnStmt with a value");
  }
  return ret.value;
}

describe("pratt — precedence (ST-P10)", () => {
  it("`1 + 2 * 3` binds `*` tighter than `+`", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("1 + 2 * 3", bag);
    expect(e.kind).toBe("BinaryExpr");
    if (e.kind !== "BinaryExpr") throw new Error("expected BinaryExpr");
    expect(e.op).toBe("+");
    expect(e.left.kind).toBe("NumericLitExpr");
    expect(e.right.kind).toBe("BinaryExpr");
    if (e.right.kind !== "BinaryExpr") throw new Error("expected nested BinaryExpr");
    expect(e.right.op).toBe("*");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`1 * 2 + 3` keeps `*` on the left", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("1 * 2 + 3", bag);
    if (e.kind !== "BinaryExpr") throw new Error("expected BinaryExpr");
    expect(e.op).toBe("+");
    expect(e.left.kind).toBe("BinaryExpr");
    expect(e.right.kind).toBe("NumericLitExpr");
    expect(bag.getAll()).toHaveLength(0);
  });
});

describe("pratt — left-associativity (ST-P11)", () => {
  it("`1 - 2 - 3` → `((1 - 2) - 3)`", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("1 - 2 - 3", bag);
    if (e.kind !== "BinaryExpr") throw new Error("expected BinaryExpr");
    expect(e.op).toBe("-");
    expect(e.right.kind).toBe("NumericLitExpr");
    expect(e.left.kind).toBe("BinaryExpr");
    if (e.left.kind !== "BinaryExpr") throw new Error("expected nested BinaryExpr");
    expect(e.left.op).toBe("-");
    expect(bag.getAll()).toHaveLength(0);
  });
});

describe("pratt — right-associativity (ST-P12, AC-03)", () => {
  it("`a = b = c` → `Assign(a, Assign(b, c))`", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("a = b = c", bag);
    expect(e.kind).toBe("AssignExpr");
    if (e.kind !== "AssignExpr") throw new Error("expected AssignExpr");
    expect(e.op).toBe("=");
    expect(e.target.kind).toBe("IdentExpr");
    expect(e.value.kind).toBe("AssignExpr");
    if (e.value.kind !== "AssignExpr") throw new Error("expected nested AssignExpr");
    expect(e.value.target.kind).toBe("IdentExpr");
    expect(e.value.value.kind).toBe("IdentExpr");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`a ? b : c ? d : e` → `Cond(a, b, Cond(c, d, e))`", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("a ? b : c ? d : e", bag);
    expect(e.kind).toBe("ConditionalExpr");
    if (e.kind !== "ConditionalExpr") throw new Error("expected ConditionalExpr");
    expect(e.condition.kind).toBe("IdentExpr");
    expect(e.whenTrue.kind).toBe("IdentExpr");
    expect(e.whenFalse.kind).toBe("ConditionalExpr");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("compound assignment `x += 1` → AssignExpr op `+=`", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("x += 1", bag);
    if (e.kind !== "AssignExpr") throw new Error("expected AssignExpr");
    expect(e.op).toBe("+=");
    expect(bag.getAll()).toHaveLength(0);
  });
});

describe("pratt — prefix vs infix (ST-P13, FR-40)", () => {
  it("prefix `-a` → UnaryExpr `-`", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("-a", bag);
    expect(e.kind).toBe("UnaryExpr");
    if (e.kind !== "UnaryExpr") throw new Error("expected UnaryExpr");
    expect(e.op).toBe("-");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("infix `a & b` → BinaryExpr `&` (bitwise-and)", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("a & b", bag);
    if (e.kind !== "BinaryExpr") throw new Error("expected BinaryExpr");
    expect(e.op).toBe("&");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("prefix `&a` → UnaryExpr `&` (address-of)", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("&a", bag);
    expect(e.kind).toBe("UnaryExpr");
    if (e.kind !== "UnaryExpr") throw new Error("expected UnaryExpr");
    expect(e.op).toBe("&");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("infix `a < b` → BinaryExpr `<` (less-than)", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("a < b", bag);
    if (e.kind !== "BinaryExpr") throw new Error("expected BinaryExpr");
    expect(e.op).toBe("<");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("prefix `<byte>(a)` → CastExpr to a primitive type", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("<byte>(a)", bag);
    expect(e.kind).toBe("CastExpr");
    if (e.kind !== "CastExpr") throw new Error("expected CastExpr");
    expect(e.targetType.kind).toBe("PrimitiveType");
    expect(e.operand.kind).toBe("IdentExpr");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("prefix `!a` and `~a` → UnaryExpr", () => {
    const bag = createDiagnosticBag();
    expect(exprOf("!a", bag).kind).toBe("UnaryExpr");
    expect(exprOf("~a", bag).kind).toBe("UnaryExpr");
    expect(bag.getAll()).toHaveLength(0);
  });
});

describe("pratt — postfix chain (ST-P13, FR-41)", () => {
  it("`a.b` → FieldAccessExpr", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("a.b", bag);
    expect(e.kind).toBe("FieldAccessExpr");
    if (e.kind !== "FieldAccessExpr") throw new Error("expected FieldAccessExpr");
    expect(e.field).toBe("b");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`a[0]` → IndexExpr", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("a[0]", bag);
    expect(e.kind).toBe("IndexExpr");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`f(1, 2)` → CallExpr with two args", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("f(1, 2)", bag);
    expect(e.kind).toBe("CallExpr");
    if (e.kind !== "CallExpr") throw new Error("expected CallExpr");
    expect(e.args).toHaveLength(2);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`a.b[i].c` chains left-associatively", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("a.b[i].c", bag);
    expect(e.kind).toBe("FieldAccessExpr");
    if (e.kind !== "FieldAccessExpr") throw new Error("expected FieldAccessExpr");
    expect(e.field).toBe("c");
    expect(e.object.kind).toBe("IndexExpr");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("parenthesised `(1 + 2) * 3` overrides precedence", () => {
    const bag = createDiagnosticBag();
    const e = exprOf("(1 + 2) * 3", bag);
    if (e.kind !== "BinaryExpr") throw new Error("expected BinaryExpr");
    expect(e.op).toBe("*");
    expect(e.left.kind).toBe("BinaryExpr");
    if (e.left.kind !== "BinaryExpr") throw new Error("expected nested BinaryExpr");
    expect(e.left.op).toBe("+");
    expect(bag.getAll()).toHaveLength(0);
  });
});
