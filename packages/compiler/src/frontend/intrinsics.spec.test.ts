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

function analyze(text: string): ReturnType<typeof analyzeModules> {
  const manifestText = "{}";
  const project: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "intrinsic-spec",
      sourceRoot: "src",
      entry: "Game",
      target: "test.target",
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
    effectiveTarget: "test.target",
    effectiveEntry: "Game",
  };
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

describe("symbolic memory operations and aggregate queries", () => {
  // Raw memory operations accept computed word addresses and retain one ordered volatile access.
  it("should retain dynamic raw memory calls with exact volatile access metadata", () => {
    const text = [
      "module Game;",
      "function addr(): word { return $d020; }",
      "function value(): byte { return 1; }",
      "function wide(): word { return $1234; }",
      "function f(p: word): word {",
      "  poke(addr(), value());",
      "  pokew(addr(), wide());",
      "  return peekw(p);",
      "}",
      "function main(): void {}",
    ].join("\n");
    const result = analyze(text);

    expect(result.diagnostics).toEqual([]);
    expect(typedDeclaration(result, "Game.f").body).toMatchObject({
      statements: [
        {
          expression: {
            kind: "call",
            evaluation: "left-to-right",
            memory: { volatile: true, access: "write", width: 1, byteOrder: "low-first" },
            arguments: [
              { kind: "call", evaluation: "left-to-right" },
              { kind: "call", evaluation: "left-to-right" },
            ],
          },
        },
        {
          expression: {
            kind: "call",
            evaluation: "left-to-right",
            memory: { volatile: true, access: "write", width: 2, byteOrder: "low-first" },
            arguments: [
              { kind: "call", evaluation: "left-to-right" },
              { kind: "call", evaluation: "left-to-right" },
            ],
          },
        },
        {
          kind: "return",
          value: {
            kind: "call",
            evaluation: "left-to-right",
            type: { kind: "scalar", name: "word" },
            memory: { volatile: true, access: "read", width: 2, byteOrder: "low-first" },
          },
        },
      ],
    });
    expect(result.calls).toHaveLength(4);
  });

  // Size, length, and offset queries are word constants, while invalid aggregate operations stay distinct.
  it("should type aggregate queries and reject invalid index member and equality operations", () => {
    const text = [
      "module Game;",
      "struct Enemy { x: word; y: byte; alive: boolean; }",
      "let a: byte[300] = [0; 0];",
      "let enemy: Enemy = { x: 0, y: 0, alive: true };",
      "const size: word = sizeof(byte[2]);",
      "const count: word = length(a);",
      "const offset: word = offsetof(Enemy, alive);",
      "function f(): void {",
      "  a[true];",
      "  enemy.hp;",
      "  a == a;",
      "}",
      "function main(): void {}",
    ].join("\n");
    const result = analyze(text);
    const enemy = binding(result, "Game.Enemy");

    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10263", "E10242", "E10121"]);
    expect(typedDeclaration(result, "Game.size").initializer).toMatchObject({
      kind: "sizeof",
      operand: {
        kind: "array-type",
        element: { kind: "named-type", name: "byte" },
      },
      operandType: {
        kind: "array",
        element: { kind: "scalar", name: "byte" },
        length: 2,
        size: 2,
      },
      type: { kind: "scalar", name: "word" },
      constant: 2n,
    });
    expect(typedDeclaration(result, "Game.count").initializer).toMatchObject({
      kind: "length",
      operand: {
        kind: "name",
        type: { kind: "array", length: 300, size: 300 },
      },
      type: { kind: "scalar", name: "word" },
      constant: 300n,
    });
    expect(typedDeclaration(result, "Game.offset").initializer).toMatchObject({
      kind: "offsetof",
      operand: { kind: "named-type", name: "Enemy" },
      operandType: { kind: "struct", binding: enemy.id, size: 4 },
      type: { kind: "scalar", name: "word" },
      constant: 3n,
    });
  });
});

describe("CPU controls and packed decimal values", () => {
  // A function may save and restore its own processor status without changing stack depth.
  it("should accept balanced status saves around ordered CPU controls", () => {
    const result = analyze(
      "module Game; function main(): void { asm_php(); asm_sei(); asm_nop(); asm_plp(); asm_cli(); }",
    );
    expect(result.diagnostics).toEqual([]);
  });

  // A CPU-control statement has no value to assign or pass as an expression.
  it("should reject a CPU control in value position", () => {
    const result = analyze("module Game; function main(): void { let VALUE: byte = asm_nop(); }");
    expect(result.complete).toBe(false);
    expect(result.diagnostics).not.toEqual([]);
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("E10239");
  });

  // A source pull cannot consume the caller's return address or leave a save at a join or exit.
  it.each([
    ["underflow", "asm_plp();"],
    ["nonempty exit", "asm_php();"],
    ["unequal join", "if (peek($0400) != 0) { asm_php(); }"],
    ["unequal loop backedge", "for (; peek($0400) != 0; ) { asm_php(); }"],
  ])("should reject %s in function-local status-save depth", (_case, body) => {
    const result = analyze(`module Game; function main(): void { ${body} }`);
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10248");
  });

  // Only the five named controls are built-ins; opcode-shaped names do not gain magic meaning.
  it.each(["asm_lda", "asm_sta", "asm_adc", "asm_jmp"])(
    "should treat %s as an ordinary unresolved name",
    (name) => {
      const result = analyze(`module Game; function main(): void { ${name}(); }`);
      expect(result.diagnostics.some(({ message }) => message.includes(name))).toBe(true);
      expect(result.complete).toBe(false);
    },
  );

  // Valid packed decimal constants fold with independent carry and discarded final carry.
  it("should fold byte and word packed decimal addition and subtraction", () => {
    const result = analyze(
      [
        "module Game;",
        "const BYTE_SUM: byte = bcd_add(byte($99), byte($01));",
        "const BYTE_DIFF: byte = bcd_sub(byte($00), byte($01));",
        "const WORD_SUM: word = bcd_add(word($9999), word($0001));",
        "const WORD_DIFF: word = bcd_sub(word($0000), word($0001));",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics).toEqual([]);
    expect(typedDeclaration(result, "Game.BYTE_SUM").initializer?.constant).toBe(0n);
    expect(typedDeclaration(result, "Game.BYTE_DIFF").initializer?.constant).toBe(0x99n);
    expect(typedDeclaration(result, "Game.WORD_SUM").initializer?.constant).toBe(0n);
    expect(typedDeclaration(result, "Game.WORD_DIFF").initializer?.constant).toBe(0x9999n);
  });

  // A known hexadecimal nibble is never accepted as one decimal digit.
  it("should reject a statically invalid packed decimal digit", () => {
    const result = analyze(
      "module Game; const BAD: byte = bcd_add(byte($1A), byte($01)); function main(): void {}",
    );
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10254");
  });
});
