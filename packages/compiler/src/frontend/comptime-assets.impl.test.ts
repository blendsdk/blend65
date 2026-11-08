import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import type { EmbeddedValue } from "../assets/asset-types.js";
import { analyzeModules } from "./analyzer.js";
import { indexModules, resolveModules } from "./modules.js";

/** Stable content hash for synthetic source and manifest records. */
function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Resolve one source module and analyze it with optional test-only resource limits. */
function analyze(
  text: string,
  embedded: EmbeddedValue,
  limits: {
    readonly maxSteps: number;
    readonly maxLiveBytes: number;
    readonly maxActiveCalls: number;
  },
): ReturnType<typeof analyzeModules> {
  const manifestText = "{}";
  const source: SourceRecord = {
    sourceId: "game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/game.blend",
  };
  const project: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "comptime-assets-impl",
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
  if (resolved.graph === null) throw new Error("Expected a resolved module");
  const start = text.indexOf('embed("data.bin")');
  const end = start + 'embed("data.bin")'.length;
  expect(start).toBeGreaterThanOrEqual(0);
  const values = new Map([[`game.blend:${start}:${end}`, embedded]]);
  return analyzeModules(project, resolved.graph, null, values, limits);
}

/** Build one embedded array value of the requested length. */
function arrayValue(length: number): EmbeddedValue {
  const bytes = Object.freeze(Array.from({ length }, (_, index) => index & 0xff));
  return Object.freeze({
    kind: "embedded",
    assetId: "asset",
    type: Object.freeze({
      kind: "array",
      element: Object.freeze({ kind: "scalar", name: "byte" }),
      length,
      size: length,
    }),
    constant: true,
    bytes,
  });
}

/** Build one embedded scalar word value. */
function scalarValue(value: bigint): EmbeddedValue {
  return Object.freeze({
    kind: "embedded-scalar",
    assetId: "scalar",
    type: Object.freeze({ kind: "scalar", name: "word" }),
    constant: true,
    value,
  });
}

describe("compile-time embedded visibility budget", () => {
  // Reading a shared embed twice charges only the small roots, never the payload.
  it("should not charge the 64-byte embed per root", () => {
    const text = `module Game;
const DATA: byte[] = embed("data.bin");
comptime function first(): byte { return DATA[0]; }
comptime function last(): byte { return DATA[63]; }
const FIRST: byte = first();
const LAST: byte = last();`;
    const result = analyze(text, arrayValue(64), {
      maxSteps: 16_777_216,
      maxLiveBytes: 4,
      maxActiveCalls: 512,
    });
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("E10270");
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("E10269");
    expect(result.bindings.some(({ qualifiedName }) => qualifiedName === "Game.FIRST")).toBe(true);
  });

  // A transformation loop consumes the shared step budget and reports its root.
  it("should reject a transformation that exceeds the step budget", () => {
    const text = `module Game;
const DATA: byte[] = embed("data.bin");
comptime function invert(): byte[64] {
  let result: byte[64] = [; 0];
  for (let index: byte = 0; index < 64; index += 1) {
    result[index] = DATA[index] ^ $ff;
  }
  return result;
}
const OUT: byte[64] = invert();`;
    const result = analyze(text, arrayValue(64), {
      maxSteps: 8,
      maxLiveBytes: 16_777_216,
      maxActiveCalls: 512,
    });
    const budget = result.diagnostics.find(({ code }) => code === "E10269");
    expect(budget).toBeDefined();
    expect(budget?.message).toContain("comptime-budget-v1");
  });

  // An embedded scalar is visible as a compile-time word with no live allocation.
  it("should read an embedded scalar without a payload charge", () => {
    const text = `module Game;
const INIT: word = embed("data.bin");
comptime function get(): word { return INIT; }
const VALUE: word = get();`;
    const result = analyze(text, scalarValue(0xc000n), {
      maxSteps: 16_777_216,
      maxLiveBytes: 8,
      maxActiveCalls: 512,
    });
    expect(result.diagnostics.map(({ code }) => code)).not.toContain("E10270");
    const value = result.declarations.find(
      (declaration) =>
        declaration.kind === "typed" && declaration.initializer?.constant === 0xc000n,
    );
    expect(value).toBeDefined();
  });
});
