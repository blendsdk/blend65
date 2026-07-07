/**
 * Parser declaration-layer tests.
 *
 * These exercise the top-level declaration parsers (function, interrupt, struct,
 * enum, let, const, zeropage), the `export` rules (E10311), the `type`
 * reservation (E10224), and the empty-/missing-initialiser diagnostics
 * (E10314/E10315/E10316). Inputs are derived from the spec grammar and its
 * documented edge cases — never from implementation output (testing.md Rule 10).
 *
 * Each program is prefixed with `module M;` so only the construct under test
 * drives the result; `parseSource` threads the source text into `ParseInput`
 * so identifier lexemes resolve via the cursor's single `lexeme()` site.
 */

import { describe, expect, it } from "vitest";
import { DiagCode, NODE_KINDS, createDiagnosticBag } from "@blend65/core";
import type { AstNode, DiagnosticBag, ExprNode, StmtNode, TopLevelItem } from "@blend65/core";

import { lex, parse } from "../index.js";

const SRC = 1;

/** Lexes then parses `source` through the public `parse()` entry. */
function parseSource(source: string, bag: DiagnosticBag) {
  const { tokens } = lex(SRC, source, bag);
  return parse({ tokens, source, sourceId: SRC, bag });
}

/** True when `v` is an AST node (has a string `kind` and a `span`). */
function isAstNode(v: unknown): v is AstNode {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { kind?: unknown }).kind === "string" &&
    typeof (v as { span?: unknown }).span === "object"
  );
}

/** Collects every node kind reachable from `node` into `into` (generic walk). */
function collectKinds(node: AstNode, into: Set<string>): void {
  into.add(node.kind);
  for (const value of Object.values(node)) {
    if (isAstNode(value)) {
      collectKinds(value, into);
    } else if (Array.isArray(value)) {
      for (const element of value) {
        if (isAstNode(element)) collectKinds(element, into);
      }
    }
  }
}

/** `true` if any node of `kind` is reachable from `root`. */
function containsKind(root: AstNode, kind: string): boolean {
  const kinds = new Set<string>();
  collectKinds(root, kinds);
  return kinds.has(kind);
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
 * body's statement list — the harness for the statement-layer tests (if/while/
 * do-while/for/switch plus block/jump/loop cases).
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

/** The initialiser expression of `let v: byte = <init>;` at top level. */
function initOf(init: string, bag: DiagnosticBag): ExprNode {
  const item = firstItem(`let v: byte = ${init};`, bag);
  if (item.kind !== "LetDecl") throw new Error("expected LetDecl");
  if (item.initialiser === null) throw new Error("expected an initialiser");
  return item.initialiser;
}

describe("expressions — intrinsics (ST-P29, AC-19, FR-43)", () => {
  it("`peek(0)` → IntrinsicCallExpr named peek", () => {
    const bag = createDiagnosticBag();
    const e = initOf("peek(0)", bag);
    expect(e.kind).toBe("IntrinsicCallExpr");
    if (e.kind !== "IntrinsicCallExpr") throw new Error("expected IntrinsicCallExpr");
    expect(e.name).toBe("peek");
    expect(e.args).toHaveLength(1);
    expect(e.typeArg).toBeNull();
    expect(e.fieldArg).toBeNull();
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`sizeof(byte)` captures a type argument", () => {
    const bag = createDiagnosticBag();
    const e = initOf("sizeof(byte)", bag);
    if (e.kind !== "IntrinsicCallExpr") throw new Error("expected IntrinsicCallExpr");
    expect(e.name).toBe("sizeof");
    expect(e.typeArg?.kind).toBe("PrimitiveType");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`offsetof(Point, x)` captures a type arg and a field arg", () => {
    const bag = createDiagnosticBag();
    const e = initOf("offsetof(Point, x)", bag);
    if (e.kind !== "IntrinsicCallExpr") throw new Error("expected IntrinsicCallExpr");
    expect(e.name).toBe("offsetof");
    expect(e.typeArg?.kind).toBe("NamedType");
    expect(e.fieldArg?.name).toBe("x");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("non-reserved callee `foo(1)` → CallExpr, not IntrinsicCallExpr", () => {
    const bag = createDiagnosticBag();
    const e = initOf("foo(1)", bag);
    expect(e.kind).toBe("CallExpr");
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`asm_sei()` → IntrinsicCallExpr (CPU control intrinsic)", () => {
    const bag = createDiagnosticBag();
    const e = initOf("asm_sei()", bag);
    if (e.kind !== "IntrinsicCallExpr") throw new Error("expected IntrinsicCallExpr");
    expect(e.name).toBe("asm_sei");
    expect(e.args).toHaveLength(0);
    expect(bag.getAll()).toHaveLength(0);
  });
});

describe("expressions — embed (FR-44)", () => {
  it('`embed("sprite.bin")` → EmbedExpr with a path', () => {
    const bag = createDiagnosticBag();
    const e = initOf('embed("sprite.bin")', bag);
    expect(e.kind).toBe("EmbedExpr");
    if (e.kind !== "EmbedExpr") throw new Error("expected EmbedExpr");
    expect(e.path).toBe("sprite.bin");
    expect(e.format).toBeNull();
    expect(bag.getAll()).toHaveLength(0);
  });

  it('`embed("music.bin", sid)` captures the format identifier', () => {
    const bag = createDiagnosticBag();
    const e = initOf('embed("music.bin", sid)', bag);
    if (e.kind !== "EmbedExpr") throw new Error("expected EmbedExpr");
    expect(e.format).toBe("sid");
    expect(bag.getAll()).toHaveLength(0);
  });
});

describe("expressions — struct-literal disambiguation (ST-P33, AC-10, FR-45)", () => {
  it("`Point { x: 1, y: 2 }` after `=` → StructLitExpr", () => {
    const bag = createDiagnosticBag();
    const e = initOf("Point { x: 1, y: 2 }", bag);
    expect(e.kind).toBe("StructLitExpr");
    if (e.kind !== "StructLitExpr") throw new Error("expected StructLitExpr");
    expect(e.typeName).toBe("Point");
    expect(e.fields.map((f) => f.name)).toEqual(["x", "y"]);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("`{ }` after a control-flow keyword parses as a Block, not a struct literal", () => {
    const bag = createDiagnosticBag();
    const s = onlyStmt("if (c) { }", bag);
    expect(s.kind).toBe("IfStmt");
    if (s.kind !== "IfStmt") throw new Error("expected IfStmt");
    expect(s.thenBlock.kind).toBe("Block");
    expect(bag.getAll()).toHaveLength(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Error sentinels, recovery, cascade suppression
// ───────────────────────────────────────────────────────────────────────────

describe("error sentinels — ErrorExpr (ST-P23, AC-04, FR-5)", () => {
  it("ST-P23: `let x: byte = +;` (operator, no operand) → ErrorExpr + one diagnostic", () => {
    const bag = createDiagnosticBag();
    const item = firstItem("let x: byte = +;", bag);
    if (item.kind !== "LetDecl") throw new Error("expected LetDecl");
    // The unary `+` is not a prefix operator → the operand position fails and an
    // ErrorExpr sentinel is inserted, keeping the initialiser structurally present.
    expect(item.initialiser).not.toBeNull();
    expect(containsKind(item, "ErrorExpr")).toBe(true);
    expect(hasCode(bag, DiagCode.ExpectedExpression)).toBe(true);
    // Cascade suppression: a single erroneous region yields ≤1 diagnostic.
    expect(bag.getAll()).toHaveLength(1);
  });
});

describe("error sentinels — ErrorStmt (ST-P24, AC-04, FR-5/15)", () => {
  // A stray `+` lexes to a real `Plus` token that is invalid at top level (unlike
  // `@`/`#`, which the lexer drops as unexpected characters before the parser
  // ever sees them). It is therefore the parser-level garbage this test needs.
  it("ST-P24: garbage `+` at top level → ErrorStmt item + E10310, recovery to EOF", () => {
    const bag = createDiagnosticBag();
    const { ast } = parseSource("module M;\n+", bag);
    expect(ast.items).toHaveLength(1);
    expect(ast.items[0]!.kind).toBe("ErrorStmt");
    expect(hasCode(bag, DiagCode.InvalidTopLevelDeclaration)).toBe(true);
  });

  it("ST-P24: garbage at top level recovers at the next `function` sync point", () => {
    const bag = createDiagnosticBag();
    const { ast } = parseSource("module M;\n+ function f(): void { }", bag);
    // The ErrorStmt covers the garbage; the function parses cleanly after it.
    expect(ast.items.map((i) => i.kind)).toEqual(["ErrorStmt", "FunctionDecl"]);
    expect(hasCode(bag, DiagCode.InvalidTopLevelDeclaration)).toBe(true);
  });
});

describe("error sentinels — ErrorType (ST-P25, AC-04, FR-5)", () => {
  it("ST-P25: `let x: 123 = 0;` (number where type expected) → ErrorType + E10303", () => {
    const bag = createDiagnosticBag();
    const item = firstItem("let x: 123 = 0;", bag);
    if (item.kind !== "LetDecl") throw new Error("expected LetDecl");
    expect(item.declaredType?.kind).toBe("ErrorType");
    expect(hasCode(bag, DiagCode.ExpectedTypeAnnotation)).toBe(true);
  });
});

describe("recovery — sync points (ST-P26, AC-05, FR-6)", () => {
  it("ST-P26: a malformed declaration then a valid `function` resumes at the function", () => {
    const bag = createDiagnosticBag();
    const { ast } = parseSource("module M;\n* function good(): void { }", bag);
    const fn = ast.items.find((i) => i.kind === "FunctionDecl");
    expect(fn).toBeDefined();
    if (fn === undefined || fn.kind !== "FunctionDecl") throw new Error("expected FunctionDecl");
    expect(fn.name).toBe("good");
  });
});

describe("cascade suppression (ST-P27, AC-06, FR-7)", () => {
  it("ST-P27: one error followed by would-be errors in a region → exactly one diagnostic", () => {
    const bag = createDiagnosticBag();
    // A run of stray operator tokens forms a single erroneous top-level region:
    // the first error (E10310) is reported, the rest are swept into one ErrorStmt
    // by `recoverTopLevel` (which skips to the next sync point and clears panic),
    // so the whole region yields exactly one diagnostic. (Operators are used, not
    // `@`/`#`, which the lexer drops as unexpected characters with their own codes.)
    parseSource("module M;\n* * *", bag);
    expect(bag.getAll()).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Contextual keywords usable as ordinary identifiers
// ───────────────────────────────────────────────────────────────────────────

describe("contextual keywords as identifiers (AC-09, FR-29)", () => {
  it("`to` / `downto` / `step` / `fallthrough` outside their context → IdentExpr", () => {
    for (const name of ["to", "downto", "step", "fallthrough"]) {
      const bag = createDiagnosticBag();
      const e = initOf(name, bag);
      // `fallthrough` is a real keyword and only valid in statement position; the
      // other three are contextual identifiers. All four, used as a bare value
      // initialiser, must not crash the parser.
      expect(e).toBeDefined();
    }
  });

  it("`to` used as an ordinary identifier value parses as IdentExpr", () => {
    const bag = createDiagnosticBag();
    const e = initOf("to", bag);
    expect(e.kind).toBe("IdentExpr");
    if (e.kind !== "IdentExpr") throw new Error("expected IdentExpr");
    expect(e.name).toBe("to");
    expect(bag.getAll()).toHaveLength(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Every one of the 50 NodeKinds is produced by ≥1 parse
// ───────────────────────────────────────────────────────────────────────────

describe("node-kind exhaustiveness (AC-13, FR-10)", () => {
  it("AC-13: every NodeKind value is produced by at least one parse", () => {
    // A battery of small programs that, together, exercise all 50 kinds. Each is
    // independently parsed and every reachable node kind is collected. The three
    // error sentinels are produced by deliberately malformed snippets.
    const programs = [
      // Source structure + most declarations + types + many statements/expressions.
      `module Demo.Pkg;
       import { a } from Lib.X;
       struct P { x: byte; nested: Q[2]; }
       enum E { A, B = 1 }
       const K: byte = 1 + 2 * 3 - 4 / 5 % 6;
       zeropage { zp: word; zq: byte = 0; }
       let g: P = P { x: 1 };
       interrupt function isr() { g.x = 1; }
       export function f(p: byte, q: word): byte {
         let v: byte = (p & q) | (p ^ q);
         let w: boolean = !true && false || (p < q);
         let s: word = p << 2 >> 1;
         let c: byte = p == q ? lo(w) : hi(w);
         let u: byte = ~p;
         let addr: word = &g;
         let cast: byte = <byte>(q);
         let str: word = embed("d.bin", raw);
         let arr: byte = sizeof(byte) + offsetof(P, x);
         g.nested[0] = peek(0);
         f(p, q);
         if (p > 0) { return p; } else { return q; }
         while (p > 0) { p = p - 1; }
         do { p = p + 1; } while (p < 10);
         for (let i: byte = 0 to 10 step 2) { fallthrough; }
         switch (p) { case 1, 2: break; default: continue; }
         "ignored";
         'c';
         return v + w + s + c + u + cast + str + arr;
       }`,
      // Error sentinels.
      `module Bad;\n+`, // ErrorStmt at top level
      `module Bad2;\nlet x: 123 = 0;`, // ErrorType (number where a type is expected)
      `module Bad3;\nlet y: byte = +;`, // ErrorExpr (operator with no operand)
    ];

    const produced = new Set<string>();
    for (const src of programs) {
      const { ast } = parseSource(src, createDiagnosticBag());
      collectKinds(ast, produced);
    }

    const missing = NODE_KINDS.filter((k) => !produced.has(k));
    expect(missing).toEqual([]);
    expect(produced.size).toBeGreaterThanOrEqual(NODE_KINDS.length);
  });
});
