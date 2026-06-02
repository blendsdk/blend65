/**
 * Parser declaration-layer tests — RD-03 Phase 3 (ST-P14..P19, ST-P28).
 *
 * These exercise the top-level declaration parsers (function, interrupt, struct,
 * enum, let, const, zeropage), the `export` rules (E10311), the `type`
 * reservation (E10224), and the empty-/missing-initialiser diagnostics
 * (E10314/E10315/E10316). Inputs are derived from the spec, RD-03, and the
 * ambiguity register — never from implementation output (testing.md Rule 10).
 *
 * Each program is prefixed with `module M;` so only the construct under test
 * drives the result; `parseSource` threads the source text into `ParseInput`
 * (AR-8) so identifier lexemes resolve via the cursor's single `lexeme()` site.
 */

import { describe, expect, it } from "vitest";
import { DiagCode, createDiagnosticBag } from "@blend65/core";
import type { DiagnosticBag, StmtNode, TopLevelItem } from "@blend65/core";
import { lex, parse } from "../index.js";

const SRC = 1;

/** Lexes then parses `source` through the public `parse()` entry (AR-8). */
function parseSource(source: string, bag: DiagnosticBag) {
  const { tokens } = lex(SRC, source, bag);
  return parse({ tokens, source, sourceId: SRC, bag });
}

/** Parses `module M;\n` + `body` and returns the first top-level item. */
function firstItem(body: string, bag: DiagnosticBag): TopLevelItem {
  const { ast } = parseSource(`module M;\n${body}`, bag);
  const item = ast.items[0];
  if (item === undefined) {
    throw new Error("expected at least one top-level item");
  }
  return item;
}

/** True if the bag holds at least one diagnostic with `code`. */
function hasCode(bag: DiagnosticBag, code: string): boolean {
  return bag.getAll().some((d) => d.code === code);
}

describe("declarations — functions (ST-P14)", () => {
  it("ST-P14: `function f(a: byte, b: word): void { }` → FunctionDeclNode", () => {
    const bag = createDiagnosticBag();
    const item = firstItem("function f(a: byte, b: word): void { }", bag);
    expect(item.kind).toBe("FunctionDecl");
    if (item.kind !== "FunctionDecl") throw new Error("expected FunctionDecl");
    expect(item.exported).toBe(false);
    expect(item.name).toBe("f");
    expect(item.params.map((p) => p.name)).toEqual(["a", "b"]);
    expect(
      item.params.map((p) => (p.paramType.kind === "PrimitiveType" ? p.paramType.name : "?")),
    ).toEqual(["byte", "word"]);
    expect(item.returnType.kind).toBe("PrimitiveType");
    expect(item.body.kind).toBe("Block");
    expect(item.body.statements).toEqual([]);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-P14: empty parameter list is allowed", () => {
    const bag = createDiagnosticBag();
    const item = firstItem("function f(): void { }", bag);
    if (item.kind !== "FunctionDecl") throw new Error("expected FunctionDecl");
    expect(item.params).toEqual([]);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-P14: `export function` sets exported = true", () => {
    const bag = createDiagnosticBag();
    const item = firstItem("export function f(): void { }", bag);
    if (item.kind !== "FunctionDecl") throw new Error("expected FunctionDecl");
    expect(item.exported).toBe(true);
    expect(bag.getAll()).toHaveLength(0);
  });
});

describe("declarations — interrupts (ST-P15)", () => {
  it("ST-P15: `interrupt function isr() { }` → InterruptDeclNode, no params", () => {
    const bag = createDiagnosticBag();
    const item = firstItem("interrupt function isr() { }", bag);
    expect(item.kind).toBe("InterruptDecl");
    if (item.kind !== "InterruptDecl") throw new Error("expected InterruptDecl");
    expect(item.exported).toBe(false);
    expect(item.name).toBe("isr");
    expect(item.body.kind).toBe("Block");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-P15: `export interrupt function isr() { }` → E10311", () => {
    const bag = createDiagnosticBag();
    parseSource("module M;\nexport interrupt function isr() { }", bag);
    expect(hasCode(bag, DiagCode.ExportNotAllowed)).toBe(true);
  });
});

describe("declarations — structs (ST-P16)", () => {
  it("ST-P16: `struct P { x: byte; y: byte; }` → StructDeclNode, 2 fields", () => {
    const bag = createDiagnosticBag();
    const item = firstItem("struct P { x: byte; y: byte; }", bag);
    expect(item.kind).toBe("StructDecl");
    if (item.kind !== "StructDecl") throw new Error("expected StructDecl");
    expect(item.name).toBe("P");
    expect(item.fields.map((f) => f.name)).toEqual(["x", "y"]);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-P16: empty `struct E { }` → E10316", () => {
    const bag = createDiagnosticBag();
    firstItem("struct E { }", bag);
    expect(hasCode(bag, DiagCode.EmptyStructDeclaration)).toBe(true);
  });
});

describe("declarations — enums (ST-P17)", () => {
  it("ST-P17: `enum C { A, B = 5, }` → EnumDeclNode, trailing comma ok", () => {
    const bag = createDiagnosticBag();
    const item = firstItem("enum C { A, B = 5, }", bag);
    expect(item.kind).toBe("EnumDecl");
    if (item.kind !== "EnumDecl") throw new Error("expected EnumDecl");
    expect(item.name).toBe("C");
    expect(item.members.map((m) => m.name)).toEqual(["A", "B"]);
    expect(item.members[0]!.value).toBeNull();
    expect(item.members[1]!.value).not.toBeNull();
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-P17: empty `enum E { }` → E10315", () => {
    const bag = createDiagnosticBag();
    firstItem("enum E { }", bag);
    expect(hasCode(bag, DiagCode.EmptyEnumDeclaration)).toBe(true);
  });
});

describe("declarations — let / const (ST-P18)", () => {
  it("ST-P18: `let x: byte = 1;` → LetDeclNode with initialiser", () => {
    const bag = createDiagnosticBag();
    const item = firstItem("let x: byte = 1;", bag);
    expect(item.kind).toBe("LetDecl");
    if (item.kind !== "LetDecl") throw new Error("expected LetDecl");
    expect(item.name).toBe("x");
    expect(item.declaredType?.kind).toBe("PrimitiveType");
    expect(item.initialiser).not.toBeNull();
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-P18: `let y: byte;` without initialiser is allowed", () => {
    const bag = createDiagnosticBag();
    const item = firstItem("let y: byte;", bag);
    if (item.kind !== "LetDecl") throw new Error("expected LetDecl");
    expect(item.initialiser).toBeNull();
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-P18: `const k: byte;` without initialiser → E10314", () => {
    const bag = createDiagnosticBag();
    firstItem("const k: byte;", bag);
    expect(hasCode(bag, DiagCode.MissingConstInitialiser)).toBe(true);
  });

  it("ST-P18: `const k: byte = 4;` → ConstDeclNode with initialiser", () => {
    const bag = createDiagnosticBag();
    const item = firstItem("const k: byte = 4;", bag);
    expect(item.kind).toBe("ConstDecl");
    if (item.kind !== "ConstDecl") throw new Error("expected ConstDecl");
    expect(item.initialiser).not.toBeNull();
    expect(bag.getAll()).toHaveLength(0);
  });
});

describe("declarations — zeropage (ST-P19, AR-9)", () => {
  it("ST-P19: `zeropage { p: word; q: byte = 0; }` → 2 fields, optional init", () => {
    const bag = createDiagnosticBag();
    const item = firstItem("zeropage { p: word; q: byte = 0; }", bag);
    expect(item.kind).toBe("ZeropageBlock");
    if (item.kind !== "ZeropageBlock") throw new Error("expected ZeropageBlock");
    expect(item.fields.map((f) => f.name)).toEqual(["p", "q"]);
    expect(item.fields[0]!.initialiser).toBeNull();
    expect(item.fields[1]!.initialiser).not.toBeNull();
    expect(bag.getAll()).toHaveLength(0);
  });

  it("ST-P19: `export zeropage { ... }` → E10311", () => {
    const bag = createDiagnosticBag();
    parseSource("module M;\nexport zeropage { p: byte; }", bag);
    expect(hasCode(bag, DiagCode.ExportNotAllowed)).toBe(true);
  });
});

describe("declarations — type reservation (ST-P28, AR-2)", () => {
  it("ST-P28: `type Foo = byte;` → E10224, parsing continues", () => {
    const bag = createDiagnosticBag();
    parseSource("module M;\ntype Foo = byte;", bag);
    expect(hasCode(bag, DiagCode.ReservedKeyword)).toBe(true);
  });
});

describe("declarations — type position (E10303)", () => {
  it("`let x: 123 = 0;` → E10303 (number where type expected)", () => {
    const bag = createDiagnosticBag();
    firstItem("let x: 123 = 0;", bag);
    expect(hasCode(bag, DiagCode.ExpectedTypeAnnotation)).toBe(true);
  });
});

/**
 * Parses `module M;\nfunction f(): void { <body> }` and returns the function
 * body's statement list — the harness for the Phase 4 statement layer (ST-P20..
 * P22 plus block/jump/loop cases).
 */
function bodyStmts(body: string, bag: DiagnosticBag): StmtNode[] {
  const item = firstItem(`function f(): void { ${body} }`, bag);
  if (item.kind !== "FunctionDecl") throw new Error("expected FunctionDecl");
  return item.body.statements;
}

/** The single statement produced by `body`; fails if there is not exactly one. */
function onlyStmt(body: string, bag: DiagnosticBag): StmtNode {
  const stmts = bodyStmts(body, bag);
  expect(stmts).toHaveLength(1);
  const s = stmts[0];
  if (s === undefined) throw new Error("expected one statement");
  return s;
}

describe("statements — block (FR-24)", () => {
  it("empty block body → zero statements, no diagnostics", () => {
    const bag = createDiagnosticBag();
    expect(bodyStmts("", bag)).toEqual([]);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("nested `{ }` block parses as a BlockNode statement", () => {
    const bag = createDiagnosticBag();
    const s = onlyStmt("{ }", bag);
    expect(s.kind).toBe("Block");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("multiple statements are collected in order", () => {
    const bag = createDiagnosticBag();
    const stmts = bodyStmts("break; continue;", bag);
    expect(stmts.map((s) => s.kind)).toEqual(["BreakStmt", "ContinueStmt"]);
    expect(bag.getAll()).toHaveLength(0);
  });
});

describe("statements — if / else (ST-P20, FR-25)", () => {
  it("ST-P20: `if (c) { } else if (d) { } else { }` → composed else-if", () => {
    const bag = createDiagnosticBag();
    const s = onlyStmt("if (c) { } else if (d) { } else { }", bag);
    expect(s.kind).toBe("IfStmt");
    if (s.kind !== "IfStmt") throw new Error("expected IfStmt");
    expect(s.condition.kind).toBe("IdentExpr");
    expect(s.thenBlock.kind).toBe("Block");
    // else clause holds the nested `else if` as an IfStmt
    const elseClause = s.elseClause;
    expect(elseClause).not.toBeNull();
    if (elseClause === null || elseClause.kind !== "IfStmt") {
      throw new Error("expected else-if IfStmt");
    }
    // ...whose own else clause is the trailing `else { }` block
    expect(elseClause.elseClause?.kind).toBe("Block");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`if (c) { }` with no else → elseClause null", () => {
    const bag = createDiagnosticBag();
    const s = onlyStmt("if (c) { }", bag);
    if (s.kind !== "IfStmt") throw new Error("expected IfStmt");
    expect(s.elseClause).toBeNull();
    expect(bag.getAll()).toHaveLength(0);
  });
});

describe("statements — while / do-while (FR-26, FR-27)", () => {
  it("`while (c) { }` → WhileStmtNode", () => {
    const bag = createDiagnosticBag();
    const s = onlyStmt("while (c) { }", bag);
    expect(s.kind).toBe("WhileStmt");
    if (s.kind !== "WhileStmt") throw new Error("expected WhileStmt");
    expect(s.body.kind).toBe("Block");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`do { } while (c);` → DoWhileStmtNode", () => {
    const bag = createDiagnosticBag();
    const s = onlyStmt("do { } while (c);", bag);
    expect(s.kind).toBe("DoWhileStmt");
    if (s.kind !== "DoWhileStmt") throw new Error("expected DoWhileStmt");
    expect(s.body.kind).toBe("Block");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`do { } while (c)` without trailing `;` → E10305", () => {
    const bag = createDiagnosticBag();
    bodyStmts("do { } while (c)", bag);
    expect(hasCode(bag, DiagCode.MissingSemicolon)).toBe(true);
  });
});

describe("statements — for (ST-P21, FR-28/29)", () => {
  it("ST-P21: `for (let i: byte = 0 to 10 step 2) { }` → ForStmtNode", () => {
    const bag = createDiagnosticBag();
    const s = onlyStmt("for (let i: byte = 0 to 10 step 2) { }", bag);
    expect(s.kind).toBe("ForStmt");
    if (s.kind !== "ForStmt") throw new Error("expected ForStmt");
    expect(s.varName).toBe("i");
    expect(s.varType?.kind).toBe("PrimitiveType");
    expect(s.direction).toBe("to");
    expect(s.init.kind).toBe("NumericLitExpr");
    expect(s.bound.kind).toBe("NumericLitExpr");
    expect(s.step).not.toBeNull();
    expect(s.body.kind).toBe("Block");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`for (let i: byte = 10 downto 0) { }` → direction downto, no step", () => {
    const bag = createDiagnosticBag();
    const s = onlyStmt("for (let i: byte = 10 downto 0) { }", bag);
    if (s.kind !== "ForStmt") throw new Error("expected ForStmt");
    expect(s.direction).toBe("downto");
    expect(s.step).toBeNull();
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`for (let i: byte = 0 until 10) { }` → E10309 (not to/downto)", () => {
    const bag = createDiagnosticBag();
    bodyStmts("for (let i: byte = 0 until 10) { }", bag);
    expect(hasCode(bag, DiagCode.ExpectedToOrDownto)).toBe(true);
  });
});

describe("statements — switch (ST-P22, FR-30/31/32)", () => {
  it("ST-P22: `switch (x) { case 1, 2: break; default: break; }`", () => {
    const bag = createDiagnosticBag();
    const s = onlyStmt("switch (x) { case 1, 2: break; default: break; }", bag);
    expect(s.kind).toBe("SwitchStmt");
    if (s.kind !== "SwitchStmt") throw new Error("expected SwitchStmt");
    expect(s.discriminant.kind).toBe("IdentExpr");
    expect(s.cases).toHaveLength(1);
    expect(s.cases[0]!.values).toHaveLength(2);
    expect(s.cases[0]!.body.map((b) => b.kind)).toEqual(["BreakStmt"]);
    expect(s.defaultClause.body.map((b) => b.kind)).toEqual(["BreakStmt"]);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`switch (x) { case 1: break; }` with no default → E10072", () => {
    const bag = createDiagnosticBag();
    bodyStmts("switch (x) { case 1: break; }", bag);
    expect(hasCode(bag, DiagCode.MissingDefaultClause)).toBe(true);
  });
});

describe("statements — jumps & fallthrough (FR-33/34)", () => {
  it("`return;` and `return x;` → ReturnStmtNode (value null / set)", () => {
    const bag = createDiagnosticBag();
    const stmts = bodyStmts("return; return x;", bag);
    expect(stmts.map((s) => s.kind)).toEqual(["ReturnStmt", "ReturnStmt"]);
    if (stmts[0]!.kind !== "ReturnStmt" || stmts[1]!.kind !== "ReturnStmt") {
      throw new Error("expected ReturnStmts");
    }
    expect(stmts[0]!.value).toBeNull();
    expect(stmts[1]!.value).not.toBeNull();
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`break;` / `continue;` / `fallthrough;` → matching jump nodes", () => {
    const bag = createDiagnosticBag();
    const stmts = bodyStmts("break; continue; fallthrough;", bag);
    expect(stmts.map((s) => s.kind)).toEqual(["BreakStmt", "ContinueStmt", "FallthroughStmt"]);
    expect(bag.getAll()).toHaveLength(0);
  });
});

describe("statements — expression & local declarations (FR-35)", () => {
  it("`x;` → ExpressionStmtNode", () => {
    const bag = createDiagnosticBag();
    const s = onlyStmt("x;", bag);
    expect(s.kind).toBe("ExpressionStmt");
    if (s.kind !== "ExpressionStmt") throw new Error("expected ExpressionStmt");
    expect(s.expression.kind).toBe("IdentExpr");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("local `let n: byte = 1;` parses as a LetDecl statement", () => {
    const bag = createDiagnosticBag();
    const s = onlyStmt("let n: byte = 1;", bag);
    expect(s.kind).toBe("LetDecl");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`type` in statement position → E10224 (AR-2)", () => {
    const bag = createDiagnosticBag();
    bodyStmts("type T = byte;", bag);
    expect(hasCode(bag, DiagCode.ReservedKeyword)).toBe(true);
  });
});
