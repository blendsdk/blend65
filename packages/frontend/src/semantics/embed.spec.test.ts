/**
 * Specification tests for `embed()` typing and legality.
 *
 * `embed("path")` is legal ONLY as the full initializer of a module-level
 * `const` byte-array declaration. The injected asset reader supplies the
 * bytes at analysis time, so size inference, `length()` folding, and the
 * const image land on the symbol like any other const array. Reader
 * failures map to dedicated diagnostics (not-found, outside-root,
 * too-large); an absent reader (non-compiler hosts) poisons silently with
 * no fabricated size; a `format` argument is a loud not-supported error.
 *
 * Oracles derive from the frozen spec Ch 13 and the recorded decisions.
 * Exercised through the real public path (`lex`→`parse`→`analyze`) with a
 * scripted in-test reader; never derived from the implementation.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type {
  AssetReader,
  AssetReadResult,
  ConstValue,
  Diagnostic,
  DiagnosticBag,
  ProgramNode,
  SemanticModel,
  Symbol,
} from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

const TABLE_BYTES = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];

/** A scripted reader: path → result (unknown paths report not-found). */
function readerOf(files: Record<string, AssetReadResult>): AssetReader {
  return {
    readAsset: (_sourceId, relPath) => files[relPath] ?? { kind: "not-found" },
  };
}

/** An ok result carrying the standard 8-byte table fixture. */
function tableOk(resolvedPath = "/proj/table.bin"): AssetReadResult {
  return { kind: "ok", bytes: Uint8Array.from(TABLE_BYTES), resolvedPath };
}

/** Lexes + parses + analyzes one source, optionally with an asset reader. */
function analyzeEmbed(
  source: string,
  assetReader?: AssetReader,
): { diags: Diagnostic[]; model: SemanticModel; ast: ProgramNode } {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast } = parse({ tokens, source, sourceId: 1, bag });
  const base = { programs: [ast], bag, profile: DEFAULT_PROFILE };
  const model = analyze(assetReader === undefined ? base : { ...base, assetReader });
  return { diags: bag.getAll(), model, ast };
}

/** The codes of all error-severity diagnostics. */
function errorCodes(diags: readonly Diagnostic[]): string[] {
  return diags.filter((d) => d.severity === "error").map((d) => d.code);
}

/** Looks up a folded constant's value by symbol name. */
function constValueOf(model: SemanticModel, name: string): ConstValue | undefined {
  for (const [sym, value] of model.constValues) {
    if (sym.name === name) return value;
  }
  return undefined;
}

/** The symbol of the module-level const declaration named `name`. */
function constSymbolOf(model: SemanticModel, ast: ProgramNode, name: string): Symbol | null {
  for (const item of ast.items) {
    if (item.kind === "ConstDecl" && item.name === name) return model.symbolOf(item);
  }
  return null;
}

const MAIN = "function main(): void {}";

describe("Specification: legal embed forms", () => {
  it("infers an unsized const's size from the file and folds length()", () => {
    const { diags, model } = analyzeEmbed(
      `module Main;\nconst D: byte[] = embed("table.bin");\nconst L: byte = length(D);\n${MAIN}\n`,
      readerOf({ "table.bin": tableOk() }),
    );
    expect(errorCodes(diags)).toEqual([]);
    const value = constValueOf(model, "D");
    expect(value?.type).toEqual({
      kind: "array",
      element: { kind: "primitive", name: "byte" },
      size: 8,
    });
    expect(Array.from(value?.bytes ?? [])).toEqual(TABLE_BYTES);
    expect(constValueOf(model, "L")?.value).toBe(8);
  });

  it("accepts a sized annotation matching the file size exactly", () => {
    const { diags, model } = analyzeEmbed(
      `module Main;\nconst D: byte[8] = embed("table.bin");\n${MAIN}\n`,
      readerOf({ "table.bin": tableOk() }),
    );
    expect(errorCodes(diags)).toEqual([]);
    expect(Array.from(constValueOf(model, "D")?.bytes ?? [])).toEqual(TABLE_BYTES);
  });

  it("records the embedded asset's resolved path on the model", () => {
    const { model } = analyzeEmbed(
      `module Main;\nconst D: byte[] = embed("table.bin");\n${MAIN}\n`,
      readerOf({ "table.bin": tableOk("/proj/assets/table.bin") }),
    );
    expect(model.embeddedAssets.get("Main.D")).toBe("/proj/assets/table.bin");
  });
});

describe("Specification: embed reader-failure diagnostics", () => {
  it("reports a missing file naming the path, with no asset-path suggestion", () => {
    const { diags } = analyzeEmbed(
      `module Main;\nconst D: byte[] = embed("missing.bin");\n${MAIN}\n`,
      readerOf({}),
    );
    const e = diags.find((d) => d.code === DiagCode.EmbedFileNotFound);
    expect(e, "expected the file-not-found diagnostic").toBeDefined();
    expect(e?.message).toContain("missing.bin");
    expect(e?.message).not.toContain("--asset-path");
  });

  it("reports a path escaping the project root with its own code", () => {
    const { diags } = analyzeEmbed(
      `module Main;\nconst D: byte[] = embed("../../outside.bin");\n${MAIN}\n`,
      readerOf({ "../../outside.bin": { kind: "outside-root" } }),
    );
    const e = diags.find((d) => d.code === DiagCode.EmbedPathEscapesRoot);
    expect(e, "expected the escapes-root diagnostic").toBeDefined();
    expect(e?.message).toContain("../../outside.bin");
  });

  it("reports a size mismatch naming both byte counts", () => {
    const { diags } = analyzeEmbed(
      `module Main;\nconst D: byte[4] = embed("table.bin");\n${MAIN}\n`,
      readerOf({ "table.bin": tableOk() }),
    );
    const e = diags.find((d) => d.code === DiagCode.EmbedSizeMismatch);
    expect(e, "expected the size-mismatch diagnostic").toBeDefined();
    expect(e?.message).toContain("8 bytes");
    expect(e?.message).toContain("4");
  });

  it("reports an oversized file naming the 65536-byte cap", () => {
    const { diags } = analyzeEmbed(
      `module Main;\nconst D: byte[] = embed("huge.bin");\n${MAIN}\n`,
      readerOf({ "huge.bin": { kind: "too-large", size: 65537 } }),
    );
    const e = diags.find((d) => d.code === DiagCode.EmbedSizeMismatch);
    expect(e, "expected the too-large diagnostic").toBeDefined();
    expect(e?.message).toContain("65536");
  });
});

describe("Specification: embed legality (const byte-array initializer only)", () => {
  const READER = readerOf({ "t.bin": tableOk() });

  it("rejects embed as a module-let initializer", () => {
    const { diags } = analyzeEmbed(
      `module Main;\nlet d: byte[] = embed("t.bin");\n${MAIN}\n`,
      READER,
    );
    expect(errorCodes(diags)).toContain(DiagCode.EmbedNonConst);
  });

  it("rejects embed as a local-let initializer", () => {
    const { diags } = analyzeEmbed(
      `module Main;\nfunction main(): void {\nlet d: byte[8] = embed("t.bin");\n}\n`,
      READER,
    );
    expect(errorCodes(diags)).toContain(DiagCode.EmbedNonConst);
  });

  it("rejects embed as a zeropage-field initializer", () => {
    const { diags } = analyzeEmbed(
      `module Main;\nzeropage { d: byte[8] = embed("t.bin"); }\n${MAIN}\n`,
      READER,
    );
    expect(errorCodes(diags)).toContain(DiagCode.EmbedNonConst);
  });

  it("rejects embed in expression position", () => {
    const { diags } = analyzeEmbed(
      `module Main;\nfunction main(): void {\npoke($C000, embed("t.bin"));\n}\n`,
      READER,
    );
    expect(errorCodes(diags)).toContain(DiagCode.EmbedNonConst);
  });

  it("rejects embed on a non-byte element type", () => {
    const { diags } = analyzeEmbed(
      `module Main;\nconst W: word[] = embed("t.bin");\n${MAIN}\n`,
      READER,
    );
    expect(errorCodes(diags)).toContain(DiagCode.EmbedNonConst);
  });

  it("rejects a format argument loudly as not supported yet", () => {
    const { diags } = analyzeEmbed(
      `module Main;\nconst D: byte[] = embed("t.bin", spritepad);\n${MAIN}\n`,
      READER,
    );
    const e = diags.find((d) => d.code === "E90001");
    expect(e, "expected the loud not-supported error").toBeDefined();
    expect(e?.message).toContain("format-aware");
  });
});

describe("Specification: absent reader (non-compiler hosts)", () => {
  it("poisons silently — no diagnostics, an error-typed symbol, no fabricated size", () => {
    const { diags, model, ast } = analyzeEmbed(
      `module Main;\nconst D: byte[] = embed("table.bin");\n${MAIN}\n`,
    );
    expect(diags).toEqual([]);
    expect(constSymbolOf(model, ast, "D")?.type.kind).toBe("error");
    expect(constValueOf(model, "D")).toBeUndefined();
  });
});
