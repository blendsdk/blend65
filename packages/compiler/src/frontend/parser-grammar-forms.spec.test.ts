import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SourceRecord, SourceSpan } from "../project/types.js";
import { parseSource } from "./parser.js";

/** Keep source bytes and their reported length identical for parser observations. */
function source(text: string): SourceRecord {
  return {
    sourceId: "grammar.blend",
    text,
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/unused/grammar.blend",
  };
}

/** Locate a grammar fixture's exact UTF-8 byte range. */
function spanOf(text: string, fragment: string): SourceSpan {
  const characterStart = text.indexOf(fragment);
  if (characterStart < 0) throw new Error(`Missing fixture fragment ${JSON.stringify(fragment)}`);
  const start = Buffer.byteLength(text.slice(0, characterStart), "utf8");
  return { sourceId: "grammar.blend", start, end: start + Buffer.byteLength(fragment, "utf8") };
}

describe("additional complete source grammar", () => {
  // These are grammar productions, not semantic acceptance or machine-layout claims.
  it.each([
    [
      "function-typed variable",
      "module Game; let callback: fn(byte, const word): void; function main(): void {}",
    ],
    [
      "array of function values",
      "module Game; let callbacks: (fn(byte): void)[2]; function main(): void {}",
    ],
    ["loadable constant", "module Game; loadable const UNIT: byte = 1; function main(): void {}"],
    [
      "placed variable",
      "module Game; place(align: 256, noCross: 4096) let data: byte[2]; function main(): void {}",
    ],
    ["zero-page block", "module Game; zeropage { counter: byte = 1; } function main(): void {}"],
    [
      "loop-local loadable constant",
      "module Game; function main(): void { for (loadable const UNIT: byte = 1; true; ) { break; } }",
    ],
    [
      "multi-value switch with fallthrough",
      "module Game; function main(): void { let value: byte = 1; switch (value) { case 1, 2: value += 1; fallthrough; case 3: value += 2; default: value += 3; } }",
    ],
  ])("should parse a %s without treating valid syntax as unchecked", (_name, text) => {
    const result = parseSource(source(text));
    expect(result.diagnostics).toEqual([]);
    expect(result.unchecked).toEqual([]);
    expect(result.complete).toBe(true);
    expect(result.unit).not.toBeNull();
  });

  // A broken initializer is one error; independent later declarations remain discoverable.
  it("should recover after a malformed loadable initializer and retain later declarations", () => {
    const text =
      "module Game; loadable const BROKEN: byte = ; const FIRST: byte = 1; const SECOND: byte = 2; function main(): void {}";
    const result = parseSource(source(text));
    const recovery = spanOf(text, "; const FIRST");

    expect(result.complete).toBe(false);
    expect(result.unchecked).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        code: "PARSE_SYNTAX_ERROR",
        severity: "error",
        message: "Expected an expression, found ';'",
        primarySpan: {
          sourceId: recovery.sourceId,
          start: recovery.start,
          end: recovery.start + 1,
        },
        related: [],
        help: null,
        pointer: null,
      },
    ]);
    expect(
      result.unit?.declarations.flatMap((declaration) =>
        "name" in declaration ? [declaration.name] : [],
      ),
    ).toEqual(["FIRST", "SECOND", "main"]);
  });

  // Zero-page storage is mutable, so a constant in its block has its own root error.
  it("should reject a const inside zeropage with its canonical diagnostic", () => {
    const text =
      "module Game; zeropage { const BAD: byte = 1; good: byte; } function main(): void {}";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.unchecked).toEqual([]);
    expect(result.diagnostics).toMatchObject([
      {
        code: "E10031",
        message: "Constants are not allowed in 'zeropage' — use a module-level 'const' declaration",
        primarySpan: spanOf(text, "const"),
      },
    ]);
    expect(result.unit?.declarations).toMatchObject([
      { kind: "zeropage", variables: [{ name: "good" }] },
      { kind: "function", name: "main" },
    ]);
  });

  // The block's keyword-free declaration form remains distinct from ordinary let declarations.
  it("should reject let inside zeropage with its canonical diagnostic", () => {
    const text = "module Game; zeropage { let BAD: byte; good: byte; } function main(): void {}";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.unchecked).toEqual([]);
    expect(result.diagnostics).toMatchObject([
      {
        code: "E10033",
        message:
          "Unexpected 'let' in zeropage block — declare '[export] name: type [= expression];' without 'let' or 'const'",
        primarySpan: spanOf(text, "let"),
      },
    ]);
    expect(result.unit?.declarations).toMatchObject([
      { kind: "zeropage", variables: [{ name: "good" }] },
      { kind: "function", name: "main" },
    ]);
  });

  // An empty enum has its own diagnostic, and its closing brace must not become module code.
  it("should diagnose an empty enum and retain the next declaration", () => {
    const text = "module Game; enum Empty {} function main(): void {}";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toMatchObject([
      { code: "E10234", message: "Enum 'Empty' must declare at least one member" },
    ]);
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("E10010");
    expect(result.unit?.declarations.at(-1)).toMatchObject({ kind: "function", name: "main" });
  });

  // An invalid placement key rejects its owner rather than making that owner unplaced storage.
  it("should diagnose an illegal place key and reject its whole declaration", () => {
    const text = "module Game; place(foo: 1) let x: byte; function main(): void {}";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toMatchObject([
      { code: "E10272", primarySpan: spanOf(text, "foo") },
    ]);
    expect(result.unit?.declarations).toMatchObject([
      { kind: "poison" },
      { kind: "function", name: "main" },
    ]);
  });

  // A bad placement inside zero page rejects only that member, not the whole block.
  it("should retain later zeropage members after an illegal place key", () => {
    const text =
      "module Game; zeropage { place(foo: 1) bad: byte; good: byte; } function main(): void {}";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toMatchObject([
      { code: "E10272", primarySpan: spanOf(text, "foo") },
    ]);
    expect(result.unit?.declarations).toMatchObject([
      { kind: "zeropage", variables: [{ name: "good" }] },
      { kind: "function", name: "main" },
    ]);
  });

  // A missing terminator must not erase a following structured statement or return.
  it.each([
    ["switch", "switch (1) { case 1: break; }", "switch"],
    ["do", "do { break; } while (true);", "do-while"],
    ["loadable", "loadable const UNIT: byte = 1;", "variable"],
  ])("should recover before a %s statement", (_name, next, kind) => {
    const text = `module Game; function main(): void { let x: byte = 1 ${next} return; }`;
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["PARSE_SYNTAX_ERROR"]);
    expect(result.unit?.declarations).toMatchObject([
      {
        kind: "function",
        body: { statements: [{ kind: "poison" }, { kind }, { kind: "return" }] },
      },
    ]);
  });

  // The grammar allows a default clause only after all case clauses.
  it("should reject a case clause after the default clause", () => {
    const text =
      "module Game; function main(): void { switch (1) { default: break; case 1: break; } }";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toMatchObject([
      { code: "PARSE_SYNTAX_ERROR", primarySpan: spanOf(text, "case") },
    ]);
  });
});
