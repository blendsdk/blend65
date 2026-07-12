import { describe, expect, it } from "vitest";
import { DiagCode, createDiagnosticBag } from "@blend65/core";
import type { DiagnosticBag } from "@blend65/core";
import { lex, parse } from "../index.js";

/**
 * Implementation tests for the `const`-parameter parse path: recovery inside
 * parameter lists when the type after `const` is malformed or missing, and
 * EOF edges around the qualifier. These exercise the parser's never-throw /
 * always-progress guarantees, not the spec surface (which the sibling spec
 * suite owns).
 */

/** The synthetic source id used by every parse in this file. */
const SRC = 1;

/** Lexes `source` then parses it through the public `parse()` entry. */
function parseSource(source: string, bag: DiagnosticBag) {
  const { tokens } = lex(SRC, source, bag);
  return parse({ tokens, source, sourceId: SRC, bag });
}

describe("const-parameter recovery & EOF edges", () => {
  it("recovers from a missing type after `const` (E10303) and keeps the param list intact", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource(
      "module Main;\nfunction f(p: const): void {}\nlet ok: byte = 1;",
      bag,
    );
    expect(hasErrors).toBe(true);
    expect(bag.getAll().some((d) => d.code === DiagCode.ExpectedTypeAnnotation)).toBe(true);
    // The function node survives with a structurally complete parameter.
    const fn = ast.items[0]!;
    if (fn.kind !== "FunctionDecl") throw new Error(`expected FunctionDecl, got ${fn.kind}`);
    expect(fn.params).toHaveLength(1);
    expect(fn.params[0]!.isConst).toBe(true);
    expect(fn.params[0]!.paramType.kind).toBe("ErrorType");
    // Recovery still surfaces the following declaration.
    expect(ast.items.some((item) => item.kind === "LetDecl" && item.name === "ok")).toBe(true);
  });

  it("recovers when `const` is followed by another parameter (comma) instead of a type", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource(
      "module Main;\nfunction f(p: const, q: byte): void {}",
      bag,
    );
    expect(hasErrors).toBe(true);
    const fn = ast.items[0]!;
    if (fn.kind !== "FunctionDecl") throw new Error(`expected FunctionDecl, got ${fn.kind}`);
    // Both parameters survive: p with an error type, q parsed normally.
    expect(fn.params.length).toBe(2);
    expect(fn.params[0]!.isConst).toBe(true);
    expect(fn.params[0]!.paramType.kind).toBe("ErrorType");
    expect(fn.params[1]!.name).toBe("q");
    expect(fn.params[1]!.isConst).toBe(false);
    expect(fn.params[1]!.paramType.kind).toBe("PrimitiveType");
  });

  it("does not hang at EOF directly after `const`", () => {
    const bag = createDiagnosticBag();
    expect(() => parseSource("module Main;\nfunction f(p: const", bag)).not.toThrow();
    expect(bag.getAll().length).toBeGreaterThan(0);
  });

  it("does not hang at EOF directly after a complete const parameter and a comma", () => {
    const bag = createDiagnosticBag();
    const { ast } = parseSource("module Main;\nfunction f(p: const byte,", bag);
    const fn = ast.items[0]!;
    if (fn.kind !== "FunctionDecl") throw new Error(`expected FunctionDecl, got ${fn.kind}`);
    expect(fn.params[0]!.isConst).toBe(true);
    expect(fn.params[0]!.paramType.kind).toBe("PrimitiveType");
  });

  it("parses `const` on a later parameter and unsized arrays in any position", () => {
    const bag = createDiagnosticBag();
    const { ast, hasErrors } = parseSource(
      "module Main;\nfunction f(a: byte, b: const word[], c: byte[]): void {}",
      bag,
    );
    expect(hasErrors).toBe(false);
    const fn = ast.items[0]!;
    if (fn.kind !== "FunctionDecl") throw new Error(`expected FunctionDecl, got ${fn.kind}`);
    expect(fn.params.map((p) => p.isConst)).toEqual([false, true, false]);
    const b = fn.params[1]!.paramType;
    expect(b.kind).toBe("ArrayType");
    if (b.kind === "ArrayType") expect(b.size).toBeNull();
  });
});
