import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeModules } from "./analyzer.js";
import { indexModules, resolveModules } from "./modules.js";

/** Run one in-memory program through the real module and semantic frontends. */
function analyze(text: string): ReturnType<typeof analyzeModules> {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const source: SourceRecord = {
    sourceId: "game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/game.blend",
  };
  const manifestText = "{}";
  const project: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "comptime-implementation",
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
    sources: [source],
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
  if (resolved.graph === null) throw new Error("Expected a Game module");
  return analyzeModules(project, resolved.graph);
}

/** Read one successfully folded scalar constant by source name. */
function scalar(result: ReturnType<typeof analyzeModules>, name: string): bigint | boolean | null {
  const binding = result.bindings.find((candidate) => candidate.qualifiedName === `Game.${name}`);
  const declaration = result.declarations.find(
    (candidate) =>
      candidate.kind === "typed" &&
      candidate.binding.sourceId === binding?.id.sourceId &&
      candidate.binding.span.start === binding.id.span.start,
  );
  return declaration?.kind === "typed" ? (declaration.initializer?.constant ?? null) : null;
}

describe("compile-time aggregate implementation edges", () => {
  it("should write nested scalar fields and array elements at their full byte offset", () => {
    const result = analyze(
      [
        "module Game;",
        "struct Inner { left: byte; right: byte; }",
        "struct Outer { prefix: byte; inner: Inner; }",
        "comptime function make(): byte {",
        "  let value: Outer = { prefix: 9, inner: { left: 1, right: 2 } };",
        "  value.inner.right = 7;",
        "  return value.prefix + value.inner.right;",
        "}",
        "const RESULT: byte = make();",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics).toEqual([]);
    expect(scalar(result, "RESULT")).toBe(16n);
  });

  it("should assign a nested fixed array without overwriting its neighboring field", () => {
    const result = analyze(
      [
        "module Game;",
        "struct Outer { prefix: byte; data: byte[2]; suffix: byte; }",
        "comptime function make(): byte {",
        "  let value: Outer = { prefix: 8, data: [1, 2], suffix: 9 };",
        "  value.data = [4, 5];",
        "  return value.prefix + value.data[1] + value.suffix;",
        "}",
        "const RESULT: byte = make();",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics).toEqual([]);
    expect(scalar(result, "RESULT")).toBe(22n);
  });
});

describe("compile-time packed-BCD implementation", () => {
  it("should evaluate typed decimal arithmetic inside a compile-time function", () => {
    const result = analyze(
      [
        "module Game;",
        "comptime function add(value: word): word { return bcd_add(value, word($0001)); }",
        "const RESULT: word = add(word($0099));",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics).toEqual([]);
    expect(scalar(result, "RESULT")).toBe(0x0100n);
  });

  it("should reject an invalid digit that becomes known during compile-time evaluation", () => {
    const result = analyze(
      [
        "module Game;",
        "comptime function add(value: byte): byte { return bcd_add(value, byte(1)); }",
        "const RESULT: byte = add(byte($1A));",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10254");
  });
});
