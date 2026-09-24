import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SourceRecord, SourceSpan } from "../project/types.js";
import { parseSource } from "./parser.js";

/** Construct an exact decoded source for grammar-level parser checks. */
function source(text: string): SourceRecord {
  return {
    sourceId: "game.blend",
    text,
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/unused/game.blend",
  };
}

/** Locate a fixture fragment using the source format's UTF-8 byte offsets. */
function spanOf(text: string, fragment: string, occurrence = 0): SourceSpan {
  let characterStart = -1;
  let searchFrom = 0;
  for (let index = 0; index <= occurrence; index += 1) {
    characterStart = text.indexOf(fragment, searchFrom);
    if (characterStart < 0) throw new Error(`Missing fixture fragment ${JSON.stringify(fragment)}`);
    searchFrom = characterStart + fragment.length;
  }
  const start = Buffer.byteLength(text.slice(0, characterStart), "utf8");
  return {
    sourceId: "game.blend",
    start,
    end: start + Buffer.byteLength(fragment, "utf8"),
  };
}

describe("complete grammar forms", () => {
  // Assignment is below conditional, which is below addition and multiplication.
  it("should preserve assignment and arithmetic precedence inside a conditional expression", () => {
    const text = "module Game; function main(): void { a = b ? c + d * e : (f = g); }";
    const result = parseSource(source(text));

    expect(result.diagnostics).toEqual([]);
    expect(result.unchecked).toEqual([]);
    expect(result.complete).toBe(true);
    expect(result.unit?.declarations).toMatchObject([
      {
        kind: "function",
        body: {
          statements: [
            {
              kind: "expression-statement",
              expression: {
                kind: "assignment",
                operator: "=",
                target: { kind: "name", name: "a" },
                value: {
                  kind: "conditional",
                  condition: { kind: "name", name: "b" },
                  whenTrue: {
                    kind: "binary",
                    operator: "+",
                    left: { kind: "name", name: "c" },
                    right: {
                      kind: "binary",
                      operator: "*",
                      left: { kind: "name", name: "d" },
                      right: { kind: "name", name: "e" },
                    },
                  },
                  whenFalse: {
                    kind: "assignment",
                    operator: "=",
                    target: { kind: "name", name: "f" },
                    value: { kind: "name", name: "g" },
                  },
                },
              },
            },
          ],
        },
      },
    ]);
  });

  // Each source is a complete grammar form, so none may be treated as pending syntax.
  it.each([
    ["enum declaration", "module Game; enum Direction { Up, Down = 1, }"],
    [
      "compile-time function",
      "module Game; comptime function twice(x: byte): byte { return x + x; }",
    ],
    ["interrupt function", "module Game; interrupt function irq(): void { return; }"],
    ["do-while statement", "module Game; function main(): void { do { } while (false); }"],
    [
      "switch statement",
      "module Game; function main(): void { switch (1) { case 1: break; default: break; } }",
    ],
  ])("should parse a complete %s without unchecked syntax", (_name, text) => {
    const result = parseSource(source(text));
    expect(result.diagnostics).toEqual([]);
    expect(result.unchecked).toEqual([]);
    expect(result.complete).toBe(true);
    expect(result.unit).not.toBeNull();
  });

  // The opening delimiter explains one root error; synchronization retains later declarations.
  it("should recover after a missing closing parenthesis and retain two later declarations", () => {
    const text =
      "module Game; function main(): void { let broken: byte = (1 + 2; let first: byte = 3; let second: byte = 4; }";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.unchecked).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        code: "PARSE_SYNTAX_ERROR",
        severity: "error",
        message: "Expected ')', found ';'",
        primarySpan: spanOf(text, ";", 1),
        related: [{ message: "Delimiter opened here", span: spanOf(text, "(", 1) }],
        help: null,
        pointer: null,
      },
    ]);
    expect(result.unit?.declarations).toMatchObject([
      {
        kind: "function",
        body: {
          statements: [
            { kind: "poison" },
            { kind: "variable", name: "first", declarationKind: "let" },
            { kind: "variable", name: "second", declarationKind: "let" },
          ],
        },
      },
    ]);
  });
});
