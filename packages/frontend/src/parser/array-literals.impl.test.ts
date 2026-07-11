/**
 * Implementation tests for array-literal parsing internals: malformed-literal
 * recovery, nested aggregate literals, context gating (where a bare `[` is
 * NOT a literal), and a golden AST-shape snapshot for the new node.
 *
 * Complements the specification tier (`array-literals.spec.test.ts`) — these
 * cases probe recovery paths and edge structure rather than the language
 * contract.
 */

import { describe, expect, it } from "vitest";
import { DiagCode, createDiagnosticBag } from "@blend65/core";
import type { AstNode, DiagnosticBag, ExprNode } from "@blend65/core";
import { lex, parse } from "../index.js";

const SRC = 1;

/** Lexes then parses `source` through the public `parse()` entry. */
function parseSource(source: string, bag: DiagnosticBag) {
  const { tokens } = lex(SRC, source, bag);
  return parse({ tokens, source, sourceId: SRC, bag });
}

/** Returns the initialiser of the first top-level let/const declaration. */
function initialiserOf(source: string, bag: DiagnosticBag): ExprNode {
  const { ast } = parseSource(source, bag);
  const decl = ast.items[0]!;
  if (decl.kind !== "LetDecl" && decl.kind !== "ConstDecl") {
    throw new Error(`expected a let/const declaration, got ${decl.kind}`);
  }
  if (decl.initialiser === null) throw new Error("expected an initialiser");
  return decl.initialiser;
}

/** True when `v` is an AST node (string `kind` + `span`). */
function isAstNode(v: unknown): v is AstNode {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { kind?: unknown }).kind === "string" &&
    typeof (v as { span?: unknown }).span === "object"
  );
}

/** Serialises an AST into a stable, span-free tree for shape snapshots. */
function serialize(value: unknown): unknown {
  if (isAstNode(value)) {
    const out: Record<string, unknown> = { kind: value.kind };
    for (const [key, child] of Object.entries(value)) {
      if (key === "kind" || key === "span" || key.endsWith("Span")) continue;
      out[key] = serialize(child);
    }
    return out;
  }
  if (Array.isArray(value)) return value.map((element) => serialize(element));
  return value;
}

describe("array literals — nesting", () => {
  it("parses nested array literals `[[1, 2], [3, 4]]` recursively", () => {
    const bag = createDiagnosticBag();
    const init = initialiserOf("module M;\nlet a: byte[4] = [[1, 2], [3, 4]];", bag);
    expect(bag.getAll()).toHaveLength(0);
    if (init.kind !== "ArrayLitExpr") throw new Error("expected ArrayLitExpr");
    expect(init.elements).toHaveLength(2);
    expect(init.elements.every((e) => e.kind === "ArrayLitExpr")).toBe(true);
  });

  it("parses struct literals as array elements `[Point { x: 1, y: 2 }]`", () => {
    const bag = createDiagnosticBag();
    const init = initialiserOf("module M;\nlet a: Point[1] = [Point { x: 1, y: 2 }];", bag);
    expect(bag.getAll()).toHaveLength(0);
    if (init.kind !== "ArrayLitExpr") throw new Error("expected ArrayLitExpr");
    expect(init.elements[0]!.kind).toBe("StructLitExpr");
  });

  it("parses expression elements and a computed fill `[1 + 2, n; DIM * 2]`", () => {
    const bag = createDiagnosticBag();
    const init = initialiserOf("module M;\nlet a: byte[9] = [1 + 2, n; DIM * 2];", bag);
    expect(bag.getAll()).toHaveLength(0);
    if (init.kind !== "ArrayLitExpr") throw new Error("expected ArrayLitExpr");
    expect(init.elements.map((e) => e.kind)).toEqual(["BinaryExpr", "IdentExpr"]);
    expect(init.fill!.kind).toBe("BinaryExpr");
  });

  it("golden shape snapshot: list + fill literal", () => {
    const bag = createDiagnosticBag();
    const init = initialiserOf("module M;\nlet a: byte[5] = [1, 2, 3; 0];", bag);
    expect(serialize(init)).toMatchSnapshot();
  });
});

describe("array literals — malformed-input recovery", () => {
  it("`[1; 2; 3]` reports the second `;` as unexpected and still closes the literal", () => {
    const bag = createDiagnosticBag();
    const { ast } = parseSource("module M;\nlet a: byte[3] = [1; 2; 3];\nlet b: byte = 1;", bag);
    expect(bag.getAll().some((d) => d.code === DiagCode.UnexpectedToken)).toBe(true);
    // Recovery reaches the following declaration.
    expect(ast.items.some((i) => i.kind === "LetDecl" && i.name === "b")).toBe(true);
  });

  it("`[,]` produces an expression error without hanging or crashing", () => {
    const bag = createDiagnosticBag();
    const { ast } = parseSource("module M;\nlet a: byte[1] = [,];\nlet b: byte = 1;", bag);
    expect(bag.getAll().some((d) => d.code === DiagCode.ExpectedExpression)).toBe(true);
    expect(ast.items.some((i) => i.kind === "LetDecl" && i.name === "b")).toBe(true);
  });

  it("an unclosed nested literal `[[1, 2;` recovers to the next declaration", () => {
    const bag = createDiagnosticBag();
    const { ast } = parseSource("module M;\nlet a: byte[2] = [[1, 2;\nlet b: byte = 1;", bag);
    expect(bag.getAll().some((d) => d.code === DiagCode.MissingCloseBracket)).toBe(true);
    expect(ast.items.some((i) => i.kind === "LetDecl" && i.name === "b")).toBe(true);
  });
});

describe("array literals — context gating", () => {
  it("a bare `[` in return position stays an expression error (no literal context)", () => {
    const bag = createDiagnosticBag();
    parseSource("module M;\nfunction f(): byte { return [1, 2]; }", bag);
    expect(bag.getAll().some((d) => d.code === DiagCode.ExpectedExpression)).toBe(true);
  });

  it("a bare `[` in condition position stays an expression error", () => {
    const bag = createDiagnosticBag();
    parseSource("module M;\nfunction f(): void { while ([1]) { } }", bag);
    expect(bag.getAll().some((d) => d.code === DiagCode.ExpectedExpression)).toBe(true);
  });

  it("postfix indexing `a[i]` still parses as IndexExpr, never as a literal", () => {
    const bag = createDiagnosticBag();
    const { ast } = parseSource("module M;\nfunction f(): void { x = a[i]; }", bag);
    expect(bag.getAll()).toHaveLength(0);
    const fn = ast.items[0]!;
    if (fn.kind !== "FunctionDecl") throw new Error("expected FunctionDecl");
    const stmt = fn.body.statements[0]!;
    if (stmt.kind !== "ExpressionStmt" || stmt.expression.kind !== "AssignExpr") {
      throw new Error("expected an assignment expression statement");
    }
    expect(stmt.expression.value.kind).toBe("IndexExpr");
  });
});
