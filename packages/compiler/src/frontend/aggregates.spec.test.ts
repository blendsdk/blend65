import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeModules } from "./analyzer.js";
import { indexModules, resolveModules } from "./modules.js";

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function source(text: string): SourceRecord {
  return {
    sourceId: "game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/game.blend",
  };
}

function snapshot(text: string, target = "test.target"): ProjectSnapshot {
  const manifestText = "{}";
  return {
    manifest: {
      schemaVersion: 1,
      name: "aggregate-spec",
      sourceRoot: "src",
      entry: "Game",
      target,
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: manifestText,
      sha256: hash(manifestText),
      byteLength: Buffer.byteLength(manifestText, "utf8"),
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source(text)],
    inputSha256: hash(text),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: target,
    effectiveEntry: "Game",
  };
}

function analyze(text: string, target?: string): ReturnType<typeof analyzeModules> {
  const project = snapshot(text, target);
  const indexed = indexModules(project);
  const resolved = resolveModules(project, indexed.index);
  expect(indexed.diagnostics).toEqual([]);
  expect(resolved.graph).not.toBeNull();
  if (resolved.graph === null) throw new Error("Expected a resolved Game module");
  return analyzeModules(project, resolved.graph);
}

type AnalysisResult = ReturnType<typeof analyzeModules>;

function binding(result: AnalysisResult, qualifiedName: string) {
  const found = result.bindings.find((candidate) => candidate.qualifiedName === qualifiedName);
  expect(found).toBeDefined();
  if (found === undefined) throw new Error(`Missing binding ${qualifiedName}`);
  return found;
}

function localBinding(result: AnalysisResult, name: string) {
  const found = result.bindings.find(
    (candidate) => candidate.name === name && candidate.storage === "local",
  );
  expect(found).toBeDefined();
  if (found === undefined) throw new Error(`Missing local binding ${name}`);
  return found;
}

function typedDeclaration(result: AnalysisResult, qualifiedName: string) {
  const foundBinding = binding(result, qualifiedName);
  const declaration = result.declarations.find(
    (candidate) =>
      candidate.binding.sourceId === foundBinding.id.sourceId &&
      candidate.binding.span.start === foundBinding.id.span.start &&
      candidate.binding.span.end === foundBinding.id.span.end,
  );
  expect(declaration?.kind).toBe("typed");
  if (declaration?.kind !== "typed") throw new Error(`Expected typed declaration ${qualifiedName}`);
  return declaration;
}

function diagnosticCodes(result: AnalysisResult): string[] {
  return result.diagnostics.map(({ code }) => code);
}

describe("fixed aggregates and places", () => {
  // A literal supplies the omitted extent; a fill completes only an explicitly sized array.
  it("should infer a string extent and complete an explicit string fill", () => {
    const result = analyze(
      [
        "module Game;",
        'let inferred: byte[] = "HI";',
        'const padded: byte[5] = ["HI"; 0];',
        "function main(): void {}",
      ].join("\n"),
      "c64-pal-prg-kernal-6581",
    );

    expect(result.diagnostics).toEqual([]);
    expect(typedDeclaration(result, "Game.inferred").type).toMatchObject({
      kind: "array",
      length: 2,
      size: 2,
    });
    expect(typedDeclaration(result, "Game.padded").type).toMatchObject({
      kind: "array",
      length: 5,
      size: 5,
    });
  });

  // A string is one byte sequence, not a value that can be silently truncated or concatenated.
  it.each([
    ["oversize string", 'const VALUE: byte[1] = "HI";', "E10124"],
    ["mixed string/value list", 'let VALUE: byte[] = ["HI", 3];', "E10116"],
  ])("should reject %s with its specific error", (_name, declaration, code) => {
    const result = analyze(
      `module Game; ${declaration} function main(): void {}`,
      "c64-pal-prg-kernal-6581",
    );
    expect(diagnosticCodes(result)).toContain(code);
  });

  // C64 screen codes and PETSCII intentionally give the same letter different byte values.
  it("should encode a character literal with the selected C64 map", () => {
    const result = analyze(
      "module Game; const screen: byte = 'A'; const pet: byte = petscii('A'); function main(): void {}",
      "c64-pal-prg-kernal-6581",
    );

    expect(result.diagnostics).toEqual([]);
    expect(typedDeclaration(result, "Game.screen").initializer?.constant).toBe(1n);
    expect(typedDeclaration(result, "Game.pet").initializer?.constant).toBe(65n);
  });

  // Missing Unicode mappings, encoding names, and map keys are errors rather than substitutions.
  it.each([
    ["unsupported scalar", "const VALUE: byte = 'é';", "E10249"],
    ["unavailable encoding", "const VALUE: byte = atascii('H');", "E10125"],
    ["unknown map", "const VALUE: byte = screen_codes('H', \"unknown\");", "E10125"],
    [
      "nonliteral map key",
      "const MAP: byte = 1; const VALUE: byte = screen_codes('H', MAP);",
      "E10251",
    ],
  ])("should reject %s without replacing the literal", (_name, declaration, code) => {
    const result = analyze(
      `module Game; ${declaration} function main(): void {}`,
      "c64-pal-prg-kernal-6581",
    );
    expect(diagnosticCodes(result)).toContain(code);
  });

  // Each array dimension has its own extent, and the inner extent determines the row stride.
  it("should retain rectangular array shape and word-typed length at each level", () => {
    const result = analyze(
      [
        "module Game;",
        "let grid: byte[2][3] = [[1, 2, 3], [4, 5, 6]];",
        "const rows: word = length(grid);",
        "const columns: word = length(grid[0]);",
        "function main(): void {}",
      ].join("\n"),
    );

    expect(result.diagnostics).toEqual([]);
    expect(typedDeclaration(result, "Game.grid").type).toMatchObject({
      kind: "array",
      length: 2,
      size: 6,
      element: { kind: "array", length: 3, size: 3 },
    });
    expect(typedDeclaration(result, "Game.rows").initializer).toMatchObject({
      type: { kind: "scalar", name: "word" },
      constant: 2n,
    });
    expect(typedDeclaration(result, "Game.columns").initializer).toMatchObject({
      type: { kind: "scalar", name: "word" },
      constant: 3n,
    });
  });

  // A nested struct is inlined; neither its fields nor a following array gain hidden padding.
  it("should calculate packed nested struct and array field offsets", () => {
    const result = analyze(
      [
        "module Game;",
        "struct Position { x: word; y: word; }",
        "struct Actor { active: boolean; pos: Position; colors: byte[3]; score: word; }",
        "const size: word = sizeof(Actor);",
        "const position: word = offsetof(Actor, pos);",
        "const colors: word = offsetof(Actor, colors);",
        "const score: word = offsetof(Actor, score);",
        "let actors: Actor[2];",
        "function main(): void {}",
      ].join("\n"),
    );

    expect(diagnosticCodes(result)).toEqual(["W10141"]);
    expect(typedDeclaration(result, "Game.size").initializer?.constant).toBe(10n);
    expect(typedDeclaration(result, "Game.position").initializer?.constant).toBe(1n);
    expect(typedDeclaration(result, "Game.colors").initializer?.constant).toBe(5n);
    expect(typedDeclaration(result, "Game.score").initializer?.constant).toBe(8n);
    expect(typedDeclaration(result, "Game.actors").type).toMatchObject({
      kind: "array",
      length: 2,
      size: 20,
    });
  });

  // Direct and indirect self-containment cannot have a finite compile-time byte size.
  it.each([
    ["direct", "struct Node { value: byte; next: Node; }", "E10091"],
    ["indirect", "struct A { b: B; } struct B { a: A; }", "E10092"],
  ])("should reject %s recursive struct containment", (_name, declaration, code) => {
    const result = analyze(`module Game; ${declaration} function main(): void {}`);
    expect(diagnosticCodes(result)).toContain(code);
  });

  // Struct fields keep their declared order and identity, and fixed arrays use the complete element size.
  it("should lay out a nominal struct and its fixed array without padding", () => {
    const text = [
      "module Game;",
      "struct Enemy { x: word; y: byte; alive: boolean; }",
      "let enemies: Enemy[6] = [{ x: 0, y: 0, alive: true }; { x: 0, y: 0, alive: true }];",
      "function main(): void {}",
    ].join("\n");
    const result = analyze(text);
    const enemy = binding(result, "Game.Enemy");

    expect(result.diagnostics).toEqual([]);
    expect(result.types).toContainEqual(
      expect.objectContaining({
        kind: "struct",
        binding: enemy.id,
        size: 4,
        fields: [
          expect.objectContaining({ name: "x", type: { kind: "scalar", name: "word" }, offset: 0 }),
          expect.objectContaining({ name: "y", type: { kind: "scalar", name: "byte" }, offset: 2 }),
          expect.objectContaining({
            name: "alive",
            type: { kind: "scalar", name: "boolean" },
            offset: 3,
          }),
        ],
      }),
    );
    expect(typedDeclaration(result, "Game.enemies").type).toMatchObject({
      kind: "array",
      element: { kind: "struct", binding: enemy.id, size: 4 },
      length: 6,
      size: 24,
    });
  });

  // A complete struct literal must use every declared field once and in declaration order.
  it("should diagnose missing reordered and unknown struct literal fields", () => {
    const text = [
      "module Game;",
      "struct Enemy { x: word; y: byte; alive: boolean; }",
      "let missing: Enemy = { x: 1, y: 2 };",
      "let reordered: Enemy = { y: 2, x: 1, alive: true };",
      "let unknown: Enemy = { x: 1, y: 2, alive: true, hp: 3 };",
      "let valid: Enemy = { x: 1, y: 2, alive: true };",
      "function main(): void {}",
    ].join("\n");
    const result = analyze(text);

    expect(diagnosticCodes(result)).toEqual(["E10096", "E10097", "E10243"]);
    expect(typedDeclaration(result, "Game.valid").initializer).toMatchObject({
      kind: "struct-literal",
      fields: [
        { name: "x", value: { constant: 1n } },
        { name: "y", value: { constant: 2n } },
        { name: "alive", value: { constant: true } },
      ],
    });
  });

  // Array inference uses explicit elements, while a fixed array may use a fill to cover its remaining range.
  it("should infer arrays and reject illegal fill incomplete const and excess elements", () => {
    const text = [
      "module Game;",
      "let a: byte[] = [1, 2, 3];",
      "let b: byte[5] = [1, 2; 0];",
      "let c: byte[] = [1; 0];",
      "const d: byte[5] = [1, 2];",
      "let e: byte[2] = [1, 2, 3];",
      "function main(): void {}",
    ].join("\n");
    const result = analyze(text);

    expect(diagnosticCodes(result)).toEqual(["E10114", "E10113", "E10112"]);
    expect(typedDeclaration(result, "Game.a")).toMatchObject({
      type: { kind: "array", element: { kind: "scalar", name: "byte" }, length: 3, size: 3 },
      initializer: {
        kind: "array-literal",
        elements: [{ constant: 1n }, { constant: 2n }, { constant: 3n }],
        fill: null,
        initialized: [{ start: 0, end: 3 }],
      },
    });
    expect(typedDeclaration(result, "Game.b")).toMatchObject({
      type: { kind: "array", element: { kind: "scalar", name: "byte" }, length: 5, size: 5 },
      initializer: {
        kind: "array-literal",
        elements: [{ constant: 1n }, { constant: 2n }],
        fill: { constant: 0n },
        initialized: [{ start: 0, end: 5 }],
      },
    });
  });

  // A zero-length array is a valid zero-size object, but every index is outside its range.
  it("should accept zero extent and reject index zero against it", () => {
    const declaration = analyze("module Game; let a: byte[0] = []; function main(): void {}");
    expect(declaration.diagnostics).toEqual([]);
    expect(typedDeclaration(declaration, "Game.a").type).toMatchObject({
      kind: "array",
      length: 0,
      size: 0,
    });

    const access = analyze("module Game; let a: byte[0] = []; function main(): void { a[0]; }");
    expect(diagnosticCodes(access)).toEqual(["E10240"]);
    expect(diagnosticCodes(access)).not.toContain("W10141");
  });

  // Extents and complete object sizes use full precision and stop at the 65535-byte object limit.
  it("should validate array extents and total object size without truncation", () => {
    const text = [
      "module Game;",
      "let negative: byte[-1] = [0; 0];",
      "let tooWide: byte[65535 + 1] = [0; 0];",
      "let nonInteger: byte[true] = [0; 0];",
      "let oversized: word[32768] = [0; 0];",
      "let accepted: byte[65535] = [0; 0];",
      "function main(): void {}",
    ].join("\n");
    const result = analyze(text);

    expect(diagnosticCodes(result)).toEqual(["E10264", "E10264", "E10264", "E10265"]);
    expect(typedDeclaration(result, "Game.accepted").type).toMatchObject({
      kind: "array",
      length: 65535,
      size: 65535,
    });
  });

  // Direct arithmetic used as an index widens before evaluation, so it does not wrap at byte width.
  it("should widen direct index arithmetic before checking the array bound", () => {
    const validText = [
      "module Game;",
      "function f(): void {",
      "  let a: byte[500] = [0; 0];",
      "  let b: byte[600] = [0; 0];",
      "  let i: byte = 255;",
      "  a[i + 10];",
      "  b[i << 1];",
      "}",
      "function main(): void {}",
    ].join("\n");
    const valid = analyze(validText);

    expect(valid.diagnostics).toEqual([]);
    expect(typedDeclaration(valid, "Game.f").body).toMatchObject({
      statements: [
        {},
        {},
        {},
        {
          expression: {
            kind: "index",
            index: {
              kind: "binary",
              type: { kind: "scalar", name: "word" },
              constant: 265n,
            },
          },
        },
        {
          expression: {
            kind: "index",
            index: {
              kind: "binary",
              type: { kind: "scalar", name: "word" },
              constant: 510n,
            },
          },
        },
      ],
    });

    const invalid = analyze(
      [
        "module Game;",
        "function f(): void {",
        "  let a: byte[500] = [0; 0];",
        "  let i: byte = 255;",
        "  a[i << 1];",
        "}",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(diagnosticCodes(invalid)).toEqual(["E10240"]);
  });

  // Explicit casts, stored values, and call results keep their narrow width, while parentheses alone do not.
  it("should preserve index barriers and evaluate a compound indexed assignment once", () => {
    const text = [
      "module Game;",
      "function g(): byte { return byte(255 + 10); }",
      "function index(): word { return 1; }",
      "function delta(): byte { return 2; }",
      "function f(): byte {",
      "  let a: byte[500] = [0; 0];",
      "  let i: byte = 255;",
      "  a[byte(i + 10)];",
      "  let j: byte = i + 10;",
      "  a[j];",
      "  a[g()];",
      "  a[(i + 10)];",
      "  return a[index()] += delta();",
      "}",
      "function main(): void {}",
    ].join("\n");
    const result = analyze(text);
    const a = localBinding(result, "a");

    expect(diagnosticCodes(result)).not.toContain("E10240");
    expect(typedDeclaration(result, "Game.f").body).toMatchObject({
      statements: [
        {},
        {},
        {
          expression: {
            kind: "index",
            index: { type: { kind: "scalar", name: "byte" }, constant: 9n },
          },
        },
        { kind: "variable", initializer: { type: { kind: "scalar", name: "byte" }, constant: 9n } },
        {
          expression: {
            kind: "index",
            index: { kind: "name", type: { kind: "scalar", name: "byte" }, constant: 9n },
          },
        },
        {
          expression: {
            kind: "index",
            index: { kind: "call", type: { kind: "scalar", name: "byte" } },
          },
        },
        {
          expression: {
            kind: "index",
            index: { kind: "binary", type: { kind: "scalar", name: "word" }, constant: 265n },
          },
        },
        {
          kind: "return",
          value: {
            kind: "assignment",
            type: { kind: "scalar", name: "byte" },
            evaluation: ["place", "old-read", "rhs", "operation", "store", "result"],
            target: {
              kind: "index",
              place: {
                binding: a.id,
                path: [expect.objectContaining({ kind: "call" })],
                readonly: false,
              },
            },
            value: { kind: "call", evaluation: "left-to-right" },
          },
        },
      ],
    });
    expect(result.calls).toHaveLength(3);
  });

  // Aggregate parameters use exact by-reference shapes and allow mutable storage to satisfy a const parameter only.
  it("should enforce transitive const aggregate parameters without hidden copies", () => {
    const validText = [
      "module Game;",
      "struct Enemy { x: word; y: byte; alive: boolean; }",
      "function inspect(p: const Enemy): word { return p.x; }",
      "function mutate(values: byte[2]): void {}",
      "function main(): void {",
      "  let enemy: Enemy = { x: 0, y: 0, alive: true };",
      "  inspect(enemy);",
      "  let values: byte[2] = [1, 2];",
      "  mutate(values);",
      "}",
    ].join("\n");
    const valid = analyze(validText);
    const enemy = binding(valid, "Game.Enemy");

    expect(valid.diagnostics).toEqual([]);
    expect(typedDeclaration(valid, "Game.inspect").body).toMatchObject({
      statements: [
        {
          kind: "return",
          value: {
            kind: "member",
            place: { readonly: true, path: ["x"] },
          },
        },
      ],
    });
    expect(typedDeclaration(valid, "Game.main").body).toMatchObject({
      statements: [
        {},
        {
          expression: {
            kind: "call",
            signature: {
              parameters: [
                expect.objectContaining({
                  type: expect.objectContaining({ kind: "struct", binding: enemy.id }),
                  readonly: true,
                }),
              ],
            },
          },
        },
        {},
        {
          expression: {
            kind: "call",
            signature: {
              parameters: [
                expect.objectContaining({
                  type: expect.objectContaining({
                    kind: "array",
                    element: expect.objectContaining({ kind: "scalar", name: "byte" }),
                    length: 2,
                  }),
                  readonly: false,
                }),
              ],
            },
          },
        },
      ],
    });

    const readonlyWrite = analyze(
      [
        "module Game;",
        "struct Enemy { x: word; y: byte; alive: boolean; }",
        "function inspect(p: const Enemy): void { p.x = 1; }",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(diagnosticCodes(readonlyWrite)).toEqual(["E10123"]);

    const readonlyArgument = analyze(
      [
        "module Game;",
        "function mutate(values: byte[2]): void {}",
        "function main(): void {",
        "  const fixed: byte[2] = [1, 2];",
        "  mutate(fixed);",
        "}",
      ].join("\n"),
    );
    expect(diagnosticCodes(readonlyArgument)).toEqual(["E10122"]);

    const scalarConst = analyze(
      "module Game; function invalid(value: const byte): void {} function main(): void {}",
    );
    expect(diagnosticCodes(scalarConst)).toEqual(["E10246"]);
  });

  // Mutable uninitialized arrays warn at declaration, and local reads warn only for uncovered elements.
  it("should preserve partial initialization and distinguish declaration from read warnings", () => {
    const text = [
      "module Game;",
      "let moduleArray: byte[2];",
      "function f(flag: boolean): byte {",
      "  let localArray: byte[2];",
      "  localArray[0];",
      "  let partial: byte[2] = [1];",
      "  partial[1];",
      "  let scalar: byte;",
      "  scalar;",
      "  let assigned: byte;",
      "  if (flag) { assigned = 1; } else { assigned = 2; }",
      "  return assigned;",
      "}",
      "function main(): void {}",
    ].join("\n");
    const result = analyze(text);
    const codes = diagnosticCodes(result);

    expect(codes.filter((code) => code === "W10141")).toHaveLength(2);
    expect(codes.filter((code) => code === "W10140")).toHaveLength(1);
    expect(codes.filter((code) => code === "W10190")).toHaveLength(3);
    expect(codes).toHaveLength(6);
    expect(typedDeclaration(result, "Game.f").body).toMatchObject({
      statements: [
        {},
        {},
        {
          kind: "variable",
          name: "partial",
          initializer: {
            kind: "array-literal",
            initialized: [{ start: 0, end: 1 }],
            fill: null,
          },
        },
        {},
        {},
        {},
        {},
        {},
        { kind: "return", value: { kind: "name", name: "assigned" } },
      ],
    });
  });
});
