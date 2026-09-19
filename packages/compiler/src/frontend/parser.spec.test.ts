import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SourceRecord, SourceSpan } from "../project/types.js";
import { parseSource, readModuleHeader } from "./parser.js";

/** Construct exact decoded input without loading or changing any host file. */
function source(text: string): SourceRecord {
  return {
    sourceId: "game.blend",
    text,
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/unused/game.blend",
  };
}

function span(start: number, end: number): SourceSpan {
  return { sourceId: "game.blend", start, end };
}

function spanOf(text: string, fragment: string, occurrence = 0): SourceSpan {
  let characterStart = -1;
  let searchFrom = 0;

  for (let index = 0; index <= occurrence; index += 1) {
    characterStart = text.indexOf(fragment, searchFrom);
    if (characterStart < 0) {
      throw new Error(`Test fixture does not contain ${JSON.stringify(fragment)}`);
    }
    searchFrom = characterStart + fragment.length;
  }

  const start = Buffer.byteLength(text.slice(0, characterStart), "utf8");
  return span(start, start + Buffer.byteLength(fragment, "utf8"));
}

describe("source parsing", () => {
  // A complete source retains the spelling, order, and byte extent of every supported root.
  it("should parse a module, import, variables, a struct, and a function in source order", () => {
    const text = [
      "// leading comment",
      "module Game.Core;",
      "import { sprite, tick as update } from Engine.Core;",
      "export let score: word = 0;",
      "export const limit: byte = 2;",
      "export struct Pair { left: byte; right: word; }",
      "export function main(value: const byte, next: word): void {",
      "  let local: byte;",
      "  return;",
      "}",
    ].join("\n");

    const result = parseSource(source(text));

    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.unchecked).toEqual([]);
    expect(result.unit).toMatchObject({
      span: {
        sourceId: "game.blend",
        start: expect.any(Number),
        end: expect.any(Number),
      },
      header: {
        kind: "module",
        span: spanOf(text, "module Game.Core;"),
        name: "Game.Core",
        nameSpan: spanOf(text, "Game.Core"),
      },
      imports: [{ span: spanOf(text, "import { sprite, tick as update } from Engine.Core;") }],
      declarations: [
        {
          kind: "variable",
          span: spanOf(text, "export let score: word = 0;"),
          name: "score",
          nameSpan: spanOf(text, "score"),
          declarationKind: "let",
          exported: true,
          type: { kind: "named-type", span: spanOf(text, "word"), name: "word" },
          initializer: { kind: "number", span: spanOf(text, "0"), value: 0n },
        },
        {
          kind: "variable",
          span: spanOf(text, "export const limit: byte = 2;"),
          name: "limit",
          nameSpan: spanOf(text, "limit"),
          declarationKind: "const",
          exported: true,
          type: { kind: "named-type", span: spanOf(text, "byte", 0), name: "byte" },
          initializer: { kind: "number", span: spanOf(text, "2"), value: 2n },
        },
        {
          kind: "struct",
          span: spanOf(text, "export struct Pair { left: byte; right: word; }"),
          name: "Pair",
          nameSpan: spanOf(text, "Pair"),
          exported: true,
          fields: [
            {
              name: "left",
              nameSpan: spanOf(text, "left"),
              type: { kind: "named-type", name: "byte" },
              span: spanOf(text, "left: byte;"),
            },
            {
              name: "right",
              nameSpan: spanOf(text, "right"),
              type: { kind: "named-type", name: "word" },
              span: spanOf(text, "right: word;"),
            },
          ],
        },
        {
          kind: "function",
          span: spanOf(
            text,
            [
              "export function main(value: const byte, next: word): void {",
              "  let local: byte;",
              "  return;",
              "}",
            ].join("\n"),
          ),
          name: "main",
          nameSpan: spanOf(text, "main"),
          exported: true,
          parameters: [
            {
              name: "value",
              nameSpan: spanOf(text, "value"),
              readonly: true,
              type: { kind: "named-type", name: "byte" },
              span: spanOf(text, "value: const byte"),
            },
            {
              name: "next",
              nameSpan: spanOf(text, "next"),
              readonly: false,
              type: { kind: "named-type", name: "word" },
              span: spanOf(text, "next: word"),
            },
          ],
          returnType: { kind: "named-type", name: "void", span: spanOf(text, "void") },
          body: {
            kind: "block",
            statements: [
              {
                kind: "variable",
                name: "local",
                declarationKind: "let",
                exported: false,
                initializer: null,
              },
              { kind: "return", value: null, span: spanOf(text, "return;") },
            ],
          },
        },
      ],
    });
  });

  // Structured control flow keeps nested blocks and else-if ownership explicit.
  it("should parse conditional and while statements without flattening their blocks", () => {
    const text =
      "module Game; function main(flag: boolean): void { " +
      "if (flag) { return; } else if (false) { return; } else { return; } " +
      "while (flag) { break; } return; }";

    const result = parseSource(source(text));

    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.unchecked).toEqual([]);
    expect(result.unit?.declarations).toMatchObject([
      {
        kind: "function",
        body: {
          kind: "block",
          statements: [
            {
              kind: "if",
              condition: { kind: "name", name: "flag" },
              then: { kind: "block", statements: [{ kind: "return", value: null }] },
              otherwise: {
                kind: "if",
                condition: { kind: "boolean", value: false },
                then: { kind: "block", statements: [{ kind: "return", value: null }] },
                otherwise: {
                  kind: "block",
                  statements: [{ kind: "return", value: null }],
                },
              },
            },
            {
              kind: "while",
              condition: { kind: "name", name: "flag" },
              body: { kind: "block", statements: [{ kind: "break" }] },
            },
            { kind: "return", value: null },
          ],
        },
      },
    ]);
  });

  // Each for-header clause has its own absence, declaration, or ordered expression-list shape.
  it("should parse empty, declaration, and expression-list for headers", () => {
    const text =
      "module Game; function main(): void { " +
      "for (;;) { break; } " +
      "for (let i: word = 0; i < 2; i += 1) { continue; } " +
      "for (a = 1, b = 2; true; a += 1, b += 1) { return; } " +
      "}";

    const result = parseSource(source(text));

    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.unchecked).toEqual([]);
    expect(result.unit?.declarations).toMatchObject([
      {
        kind: "function",
        body: {
          statements: [
            {
              kind: "for",
              initializer: null,
              condition: null,
              update: null,
              body: { statements: [{ kind: "break" }] },
            },
            {
              kind: "for",
              initializer: {
                kind: "variable",
                name: "i",
                declarationKind: "let",
                type: { kind: "named-type", name: "word" },
                initializer: { kind: "number", value: 0n },
              },
              condition: {
                kind: "binary",
                operator: "<",
                left: { kind: "name", name: "i" },
                right: { kind: "number", value: 2n },
              },
              update: [
                {
                  kind: "assignment",
                  operator: "+=",
                  target: { kind: "name", name: "i" },
                  value: { kind: "number", value: 1n },
                },
              ],
              body: { statements: [{ kind: "continue" }] },
            },
            {
              kind: "for",
              initializer: [
                {
                  kind: "assignment",
                  operator: "=",
                  target: { kind: "name", name: "a" },
                  value: { kind: "number", value: 1n },
                },
                {
                  kind: "assignment",
                  operator: "=",
                  target: { kind: "name", name: "b" },
                  value: { kind: "number", value: 2n },
                },
              ],
              condition: { kind: "boolean", value: true },
              update: [
                {
                  kind: "assignment",
                  operator: "+=",
                  target: { kind: "name", name: "a" },
                  value: { kind: "number", value: 1n },
                },
                {
                  kind: "assignment",
                  operator: "+=",
                  target: { kind: "name", name: "b" },
                  value: { kind: "number", value: 1n },
                },
              ],
              body: { statements: [{ kind: "return", value: null }] },
            },
          ],
        },
      },
    ]);
  });

  // A missing local terminator rejects that declaration at the closing brace.
  it("should reject a local declaration whose semicolon is missing before a closing brace", () => {
    const text = "module Game; function main(): void { let x: byte = 1 }";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.unchecked).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        code: "PARSE_SYNTAX_ERROR",
        severity: "error",
        message: "Expected ';', found '}'",
        primarySpan: spanOf(text, "}"),
        related: [],
        help: null,
        pointer: null,
      },
    ]);
    expect(result.unit?.declarations).toMatchObject([
      {
        kind: "function",
        body: {
          statements: [{ kind: "poison", span: spanOf(text, "let x: byte = 1") }],
        },
      },
    ]);
  });

  // An unfinished block points at end of file and relates the opening delimiter.
  it("should report an unclosed function block without inventing a second language error", () => {
    const text = "module Game; function main(): void {";
    const result = parseSource(source(text));
    const eof = span(Buffer.byteLength(text, "utf8"), Buffer.byteLength(text, "utf8"));

    expect(result.complete).toBe(false);
    expect(result.unchecked).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        code: "PARSE_SYNTAX_ERROR",
        severity: "error",
        message: "Expected '}', found end of file",
        primarySpan: eof,
        related: [{ message: "Delimiter opened here", span: spanOf(text, "{") }],
        help: null,
        pointer: null,
      },
    ]);
  });

  // These language errors have dedicated public identities and never degrade to generic syntax.
  it.each([
    {
      name: "a missing module header",
      text: "",
      code: "E10001",
      message: "Module declaration required — every source file must begin with 'module <name>;'",
      primarySpan: span(0, 0),
    },
    {
      name: "a duplicate module header",
      text: "module Game; module Other;",
      code: "E10002",
      message: "Only one module declaration is allowed per source file",
      primarySpan: span(13, 26),
    },
    {
      name: "an executable module-level statement",
      text: "module Game; poke(1,2);",
      code: "E10010",
      message:
        "Executable statements are not allowed at module level — place code inside a function",
      primarySpan: span(13, 23),
    },
    {
      name: "a variable without a type",
      text: "module Game; let x = 1;",
      code: "E10150",
      message: "Type annotation required for variable 'x' — add ': <type>'",
      primarySpan: span(13, 23),
    },
    {
      name: "a function without a return type",
      text: "module Game; function f() {}",
      code: "E10170",
      message:
        "Return type required — write 'function f(): void' for a function that returns nothing",
      primarySpan: span(13, 28),
    },
    {
      name: "a const without an initializer",
      text: "module Game; const x: byte;",
      code: "E10190",
      message: "Const declaration 'x' requires an initializer",
      primarySpan: span(13, 27),
    },
  ])(
    "should report $name with its dedicated diagnostic",
    ({ text, code, message, primarySpan }) => {
      const result = parseSource(source(text));

      expect(result.complete).toBe(false);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code,
        severity: "error",
        message,
        primarySpan,
      });
      expect(result.diagnostics[0]?.code).not.toBe("PARSE_SYNTAX_ERROR");
    },
  );

  // A reserved keyword gets its normative diagnostic at the keyword itself.
  it("should reject an actual type declaration as reserved syntax", () => {
    const text = "module Game; type Thing = byte;";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: "E10224",
      severity: "error",
      message: "'type' is reserved for a future Blend65 version",
      primarySpan: spanOf(text, "type"),
    });
  });

  // A valid but unavailable declaration is bounded and retained only as unchecked syntax.
  it("should preserve an enum declaration as one unchecked region", () => {
    const text = "module Game; enum E { A }";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.unchecked).toEqual([spanOf(text, "enum E { A }")]);
    expect(result.unit?.declarations).toEqual([
      { kind: "unchecked", span: spanOf(text, "enum E { A }") },
    ]);
  });

  // A valid but unavailable statement remains bounded inside its supported function owner.
  it("should preserve a switch statement as one unchecked region", () => {
    const text = "module Game; function main(): void { switch (x) { case 1: break; } }";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.unchecked).toEqual([spanOf(text, "switch (x) { case 1: break; }")]);
    expect(result.unit?.declarations).toMatchObject([
      {
        kind: "function",
        body: {
          statements: [
            {
              kind: "unchecked",
              span: spanOf(text, "switch (x) { case 1: break; }"),
            },
          ],
        },
      },
    ]);
  });

  // A compile-time declaration is not rewritten into an ordinary runtime function.
  it("should preserve a comptime function as one unchecked region", () => {
    const text = "module Game; comptime function f(): byte { return 1; }";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.unchecked).toEqual([spanOf(text, "comptime function f(): byte { return 1; }")]);
    expect(result.unit?.declarations).toEqual([
      {
        kind: "unchecked",
        span: spanOf(text, "comptime function f(): byte { return 1; }"),
      },
    ]);
  });

  // An unavailable function type is retained at its exact type boundary.
  it("should preserve a function type as unchecked without inventing a named type", () => {
    const text = "module Game; let f: fn(byte): void;";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.unchecked).toEqual([spanOf(text, "fn(byte): void")]);
    expect(result.unit?.declarations).toMatchObject([
      {
        kind: "variable",
        name: "f",
        type: { kind: "unchecked", span: spanOf(text, "fn(byte): void") },
      },
    ]);
  });

  // Recovery stops before the next declaration and still retains a later expression statement.
  it("should preserve later local siblings after a missing semicolon", () => {
    const text =
      "module Game; function main(): void { " +
      "let broken: byte = 1 let kept: byte = 2; missingName; }";
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.unchecked).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        code: "PARSE_SYNTAX_ERROR",
        severity: "error",
        message: "Expected ';', found 'let'",
        primarySpan: spanOf(text, "let", 1),
        related: [],
        help: null,
        pointer: null,
      },
    ]);
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("E10239");
    expect(result.unit?.declarations).toMatchObject([
      {
        kind: "function",
        body: {
          statements: [
            { kind: "poison", span: spanOf(text, "let broken: byte = 1") },
            { kind: "variable", name: "kept", declarationKind: "let" },
            {
              kind: "expression-statement",
              expression: { kind: "name", name: "missingName" },
            },
          ],
        },
      },
    ]);
  });

  // Nested expression failures consume only their statements and keep safe declarations after them.
  it("should recover from balanced and unclosed nested expressions in source order", () => {
    const text =
      "module Game; function main(): void { " +
      "call((1 + )); let first: byte = 1; call(1; let second: byte = 2; }";
    const result = parseSource(source(text));
    const unclosedCall = "call(1;";

    expect(result.complete).toBe(false);
    expect(result.unchecked).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        code: "PARSE_SYNTAX_ERROR",
        severity: "error",
        message: "Expected an expression, found ')'",
        primarySpan: spanOf(text, ")", 1),
        related: [],
        help: null,
        pointer: null,
      },
      {
        code: "PARSE_SYNTAX_ERROR",
        severity: "error",
        message: "Expected ')', found ';'",
        primarySpan: spanOf(text, ";", 3),
        related: [
          {
            message: "Delimiter opened here",
            span: spanOf(text, "(", 3),
          },
        ],
        help: null,
        pointer: null,
      },
    ]);
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("E10239");
    expect(result.unit?.declarations).toMatchObject([
      {
        kind: "function",
        body: {
          statements: [
            { kind: "poison", span: spanOf(text, "call((1 + ));") },
            { kind: "variable", name: "first" },
            { kind: "poison", span: spanOf(text, unclosedCall) },
            { kind: "variable", name: "second" },
          ],
        },
      },
    ]);
  });

  // Error collection has a deterministic public ceiling even when more roots remain.
  it("should stop after twenty independent syntax errors", () => {
    const malformed = Array.from({ length: 21 }, (_, index) => `let value${index}: byte = ;`).join(
      " ",
    );
    const text = `module Game; function main(): void { ${malformed} }`;
    const result = parseSource(source(text));

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toHaveLength(20);
    expect(result.diagnostics.every(({ code }) => code === "PARSE_SYNTAX_ERROR")).toBe(true);
    expect(result.diagnostics.map(({ primarySpan }) => primarySpan?.start)).toEqual(
      [...result.diagnostics]
        .map(({ primarySpan }) => primarySpan?.start)
        .sort((left, right) => (left ?? 0) - (right ?? 0)),
    );
  });
});

describe("module header discovery", () => {
  // Header discovery succeeds without validating an unfinished body.
  it("should return a complete header while ignoring invalid body syntax", () => {
    const text = "module Game.Core; function main(): void { let x: byte =";
    const result = readModuleHeader(source(text));

    expect(result).toEqual({
      header: {
        kind: "module",
        span: spanOf(text, "module Game.Core;"),
        name: "Game.Core",
        nameSpan: spanOf(text, "Game.Core"),
      },
      diagnostics: [],
      complete: true,
    });
  });
});
