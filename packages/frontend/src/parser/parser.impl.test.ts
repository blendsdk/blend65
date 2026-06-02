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
import type { DiagnosticBag, TopLevelItem } from "@blend65/core";
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
