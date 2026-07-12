import { describe, expect, it } from "vitest";
import { DiagCode, NODE_KINDS, createDiagnosticBag } from "@blend65/core";
import type { AstNode, DiagnosticBag, FunctionDeclNode } from "@blend65/core";
import { lex, parse } from "../index.js";

/**
 * Specification tests for the parameter surface of function declarations:
 * the optional `const` qualifier after the parameter's colon (spec Ch 08 §7
 * CP-1 — a read-only parameter) and the unsized array form `T[]` in parameter
 * position (spec Ch 08 §8.2). `const` is legal ONLY between a parameter's
 * colon and its type; every other type-annotation position rejects it
 * unchanged (E10303).
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
 * Parses a program expected to be error-free and returns its first top-level
 * function declaration.
 */
function firstFunction(source: string): FunctionDeclNode {
  const bag = createDiagnosticBag();
  const { ast, hasErrors } = parseSource(source, bag);
  expect(hasErrors).toBe(false);
  expect(bag.getAll()).toHaveLength(0);
  const decl = ast.items[0]!;
  if (decl.kind !== "FunctionDecl") {
    throw new Error(`expected a function declaration, got ${decl.kind}`);
  }
  return decl;
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

/**
 * Serialises an AST into a stable, span-free plain-object tree — the same
 * shape the golden-snapshot printer uses — so scalar fields like the `const`
 * qualifier are proven to round-trip into textual dumps.
 */
function serialize(value: unknown): unknown {
  if (isAstNode(value)) {
    const out: Record<string, unknown> = { kind: value.kind };
    for (const [key, child] of Object.entries(value)) {
      if (key === "kind" || key === "span" || key.endsWith("Span")) continue;
      out[key] = serialize(child);
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map((element) => serialize(element));
  }
  return value;
}

describe("const + unsized parameters — parse surface (ST-1..ST-5)", () => {
  it("ST-1: should parse `p: const byte[4]` with the const flag set and the sized array type", () => {
    const fn = firstFunction("module Main;\nfunction f(p: const byte[4]): void {}");
    expect(fn.params).toHaveLength(1);
    const p = fn.params[0]!;
    expect(p.name).toBe("p");
    expect(p.isConst).toBe(true);
    expect(p.paramType.kind).toBe("ArrayType");
    if (p.paramType.kind === "ArrayType") {
      expect(p.paramType.elementType.kind).toBe("PrimitiveType");
      expect(p.paramType.size).not.toBeNull();
      if (p.paramType.size !== null && p.paramType.size.kind === "NumericLitExpr") {
        expect(p.paramType.size.value).toBe(4);
      }
    }
  });

  it("ST-2: should set the const flag per parameter — `p: const Enemy` true, `q: word` false", () => {
    const fn = firstFunction("module Main;\nfunction f(p: const Enemy, q: word): void {}");
    expect(fn.params).toHaveLength(2);
    expect(fn.params[0]!.isConst).toBe(true);
    expect(fn.params[0]!.paramType.kind).toBe("NamedType");
    expect(fn.params[1]!.isConst).toBe(false);
    expect(fn.params[1]!.paramType.kind).toBe("PrimitiveType");
  });

  it("ST-3: should parse the unsized parameter form `d: byte[]` with a null array size", () => {
    const fn = firstFunction("module Main;\nfunction f(d: byte[]): void {}");
    expect(fn.params).toHaveLength(1);
    const d = fn.params[0]!;
    expect(d.isConst).toBe(false);
    expect(d.paramType.kind).toBe("ArrayType");
    if (d.paramType.kind === "ArrayType") {
      expect(d.paramType.size).toBeNull();
    }
  });

  it("ST-4: should reject `const` in a non-parameter type annotation with E10303 (unchanged)", () => {
    const bag = createDiagnosticBag();
    const source = "module Main;\nlet x: const byte = 1;";
    const { hasErrors } = parseSource(source, bag);
    expect(hasErrors).toBe(true);
    const diag = bag.getAll().find((d) => d.code === DiagCode.ExpectedTypeAnnotation);
    expect(diag).toBeDefined();
    // The error points at the offending `const` token itself.
    expect(diag!.primarySpan?.start).toBe(source.indexOf("const byte"));
  });

  it("ST-5: should keep the 51-kind AST surface and round-trip `const` through the span-free printer", () => {
    expect(NODE_KINDS).toHaveLength(51);
    const bag = createDiagnosticBag();
    const source = [
      "module Main;",
      "function f(p: const byte[4], d: byte[], e: const Enemy[], s: word): byte {",
      "  return s;",
      "}",
    ].join("\n");
    const { ast, hasErrors } = parseSource(source, bag);
    expect(hasErrors).toBe(false);

    // Every kind produced is one of the canonical 51 — no new node kinds.
    const kinds = new Set<string>();
    const collect = (n: AstNode): void => {
      kinds.add(n.kind);
      for (const child of Object.values(n)) {
        if (isAstNode(child)) collect(child);
        else if (Array.isArray(child)) {
          for (const el of child) if (isAstNode(el)) collect(el);
        }
      }
    };
    collect(ast);
    for (const k of kinds) expect(NODE_KINDS).toContain(k);

    // The printer's serialised parameter shape carries the qualifier, so
    // textual AST dumps round-trip `const` and unsized `[]` faithfully.
    const fn = ast.items[0]!;
    if (fn.kind !== "FunctionDecl") throw new Error(`expected FunctionDecl, got ${fn.kind}`);
    const printed = serialize(fn.params) as Array<Record<string, unknown>>;
    expect(printed[0]).toMatchObject({ kind: "Parameter", name: "p", isConst: true });
    expect(printed[1]).toMatchObject({ kind: "Parameter", name: "d", isConst: false });
    expect(printed[2]).toMatchObject({ kind: "Parameter", name: "e", isConst: true });
    const eType = printed[2]!.paramType as Record<string, unknown>;
    expect(eType.kind).toBe("ArrayType");
    expect(eType.size).toBeNull();
  });
});
