/**
 * Implementation tests for embed typing internals: the provenance tag on
 * the const value, size-inference parity with array literals, and the
 * SourceId the reader is keyed with in multi-file programs.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type {
  AssetReader,
  ConstValue,
  DiagnosticBag,
  ProgramNode,
  SemanticModel,
  SourceId,
} from "@blend65/core";
import { lex, parse, analyze } from "../index.js";

/** Analyzes several sources (ids 1..n) with the given reader. */
function analyzeWith(
  sources: readonly string[],
  assetReader: AssetReader,
): { model: SemanticModel; hadErrors: boolean } {
  const bag: DiagnosticBag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE, assetReader });
  return { model, hadErrors: bag.hasErrors() };
}

/** Looks up a folded constant's value by symbol name. */
function constValueOf(model: SemanticModel, name: string): ConstValue | undefined {
  for (const [sym, value] of model.constValues) {
    if (sym.name === name) return value;
  }
  return undefined;
}

const OK_READER: AssetReader = {
  readAsset: () => ({
    kind: "ok",
    bytes: Uint8Array.from([1, 2, 3]),
    resolvedPath: "/proj/a.bin",
  }),
};

describe("embed typing internals", () => {
  it("tags the const value with embed provenance; folded arrays stay untagged", () => {
    const { model } = analyzeWith(
      [
        'module Main;\nconst D: byte[] = embed("a.bin");\nconst A: byte[3] = [1, 2, 3];\nfunction main(): void {}\n',
      ],
      OK_READER,
    );
    expect(constValueOf(model, "D")?.source).toBe("embed");
    expect(constValueOf(model, "A")?.source).toBeUndefined();
  });

  it("infers the same type shape an equivalent array literal infers", () => {
    const { model } = analyzeWith(
      [
        'module Main;\nconst D: byte[] = embed("a.bin");\nconst A: byte[] = [9, 9, 9];\nfunction main(): void {}\n',
      ],
      OK_READER,
    );
    expect(constValueOf(model, "D")?.type).toEqual(constValueOf(model, "A")?.type);
  });

  it("keys the reader with the SourceId of the file containing the call", () => {
    const seen: SourceId[] = [];
    const recorder: AssetReader = {
      readAsset: (sourceId) => {
        seen.push(sourceId);
        return { kind: "ok", bytes: Uint8Array.from([1]), resolvedPath: "/p/b.bin" };
      },
    };
    analyzeWith(
      [
        "module Lib;\nexport const L: byte[] = embed(\"b.bin\");\n",
        "module Main;\nfunction main(): void {}\n",
      ],
      recorder,
    );
    expect(seen).toEqual([1]);
  });
});
