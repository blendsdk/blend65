import { describe, expect, it } from "vitest";
import { analyzeProjectOverlay, loadProject } from "@blend65/compiler/frontend";
import type { AnalysisResult } from "@blend65/compiler/frontend";
import { patternedBytes, withProject, type ProjectAsset } from "../rd06/project-fixture.js";

/** Analyze one real temporary project and return the complete frontend result. */
async function analyze(
  source: string,
  assets: readonly ProjectAsset[] = [],
): Promise<Extract<AnalysisResult, { kind: "complete" }>> {
  return withProject(source, assets, async (project) => {
    const loaded = await loadProject({ project });
    if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
    const analyzed = await analyzeProjectOverlay(loaded.snapshot, []);
    if (analyzed.kind !== "complete") {
      throw new Error(JSON.stringify(analyzed.diagnostics));
    }
    return analyzed;
  });
}

const MAIN = "\nfunction main(): void {}\n";

describe("loadable unit model", () => {
  // A scalar loadable const retains its exact logical bytes and no resident address.
  it("should retain one scalar unit with exact bytes", async () => {
    const analyzed = await analyze(`module Game;\n\nloadable const N: byte = 7;\n${MAIN}`);
    expect(analyzed.program.loadUnits).toHaveLength(1);
    const unit = analyzed.program.loadUnits[0]!;
    expect(unit.declaration).toContain("N");
    expect(unit.type).toMatchObject({ kind: "scalar", name: "byte" });
    expect(unit.size).toBe(1);
    expect(unit.bytes).toEqual([7]);
    expect(unit.logicalSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  // A fixed array unit keeps packed little-endian order.
  it("should retain a fixed array unit in packed order", async () => {
    const analyzed = await analyze(
      `module Game;\n\nloadable const A: byte[4] = [1, 2, 3, 4];\n${MAIN}`,
    );
    expect(analyzed.program.loadUnits).toHaveLength(1);
    expect(analyzed.program.loadUnits[0]!.bytes).toEqual([1, 2, 3, 4]);
    expect(analyzed.program.loadUnits[0]!.size).toBe(4);
  });

  // A fixed struct unit packs fields in declaration order.
  it("should retain a fixed struct unit in field order", async () => {
    const analyzed = await analyze(
      [
        "module Game;",
        "struct S { a: byte; b: word; }",
        "loadable const S0: S = { a: 1, b: 515 };",
        MAIN,
      ].join("\n"),
    );
    expect(analyzed.program.loadUnits).toHaveLength(1);
    expect(analyzed.program.loadUnits[0]!.bytes).toEqual([1, 3, 2]);
    expect(analyzed.program.loadUnits[0]!.size).toBe(3);
  });

  // A raw asset may initialize a loadable const and keeps its exact bytes.
  it("should accept a raw asset under loadable const", async () => {
    const bytes = patternedBytes(16, 11);
    const analyzed = await analyze(
      `module Game;\n\nloadable const DATA: byte[16] = embed("data.bin");\n${MAIN}`,
      [{ path: "data.bin", bytes }],
    );
    expect(analyzed.program.loadUnits).toHaveLength(1);
    expect(analyzed.program.loadUnits[0]!.bytes).toEqual([...bytes]);
    expect(analyzed.program.loadUnits[0]!.provenance.kind).toBe("embedded");
  });

  // Two distinct declarations with equal bytes remain two units.
  it("should keep equal-byte declarations distinct", async () => {
    const analyzed = await analyze(
      [
        "module Game;",
        "loadable const FIRST: byte[4] = [1, 2, 3, 4];",
        "loadable const SECOND: byte[4] = [1, 2, 3, 4];",
        MAIN,
      ].join("\n"),
    );
    expect(analyzed.program.loadUnits).toHaveLength(2);
    expect(new Set(analyzed.program.loadUnits.map(({ id }) => id)).size).toBe(2);
  });

  // A resident twin remains a resident declaration while its loadable twin is a unit.
  it("should separate resident and loadable twins", async () => {
    const analyzed = await analyze(
      [
        "module Game;",
        "const RESIDENT: byte[4] = [1, 2, 3, 4];",
        "loadable const DISK: byte[4] = [1, 2, 3, 4];",
        MAIN,
      ].join("\n"),
    );
    expect(analyzed.program.loadUnits).toHaveLength(1);
    expect(analyzed.program.loadUnits[0]!.declaration).toContain("DISK");
    expect(
      analyzed.program.declarations.some(
        (declaration) =>
          declaration.loadable !== true &&
          declaration.initializer !== null &&
          declaration.type.kind === "array",
      ),
    ).toBe(true);
  });

  // A loadable declaration whose type cannot be fixed is not a unit.
  it("should reject an unfixed loadable array declaration", async () => {
    await expect(analyze(`module Game;\n\nloadable const X: byte[];\n${MAIN}`)).rejects.toThrow(
      /E10/u,
    );
  });

  // A non-constant initializer cannot form a unit.
  it("should reject a non-constant loadable initializer", async () => {
    await expect(
      analyze(
        [
          "module Game;",
          "let runtimeValue: byte = 1;",
          "loadable const X: byte = runtimeValue;",
          MAIN,
        ].join("\n"),
      ),
    ).rejects.toThrow(/E10/u);
  });

  // A local loadable declaration is collected with a function-qualified identity.
  it("should collect a local loadable unit", async () => {
    const analyzed = await analyze(
      [
        "module Game;",
        "function main(): void {",
        "  loadable const LOCAL: byte[2] = [9, 8];",
        "}",
      ].join("\n"),
    );
    expect(analyzed.program.loadUnits).toHaveLength(1);
    expect(analyzed.program.loadUnits[0]!.declaration).toContain("LOCAL");
    expect(analyzed.program.loadUnits[0]!.source.sourceId).toBe("src/game.blend");
    expect(analyzed.program.loadUnits[0]!.bytes).toEqual([9, 8]);
  });

  // The frontend handoff exposes unit facts and illegal-use diagnostics without packaging.
  it("should expose the packaging-free loadable handoff", async () => {
    const analyzed = await analyze(`module Game;\n\nloadable const N: byte = 7;\n${MAIN}`);
    expect(analyzed.program.loadableHandoff.units).toHaveLength(1);
    expect(analyzed.program.loadableHandoff.units[0]!.id).toBe(analyzed.program.loadUnits[0]!.id);
    expect(analyzed.program.loadableHandoff.illegalUses).toEqual([]);
  });

  // Every illegal resident use reports E10274.
  it.each([
    [
      "index",
      "loadable const N: byte[4] = [1, 2, 3, 4];\nfunction main(): void { let x: byte = N[0]; }",
    ],
    ["mutate", "loadable const N: byte = 7;\nfunction main(): void { N = 8; }"],
    ["address", "loadable const N: byte = 7;\nfunction main(): void { let p: word = &N; }"],
    [
      "return",
      "loadable const N: byte = 7;\nfunction f(): byte { return N; }\nfunction main(): void { f(); }",
    ],
    ["store", "loadable const N: byte = 7;\nlet slot: byte;\nfunction main(): void { slot = N; }"],
    ["compare", "loadable const N: byte = 7;\nfunction main(): void { if (N == 7) {} }"],
    [
      "argument",
      "loadable const N: byte = 7;\nfunction f(x: byte): void {}\nfunction main(): void { f(N); }",
    ],
  ])("should reject the illegal %s use with E10274", async (_name, body) => {
    await expect(analyze(`module Game;\n${body}\n`)).rejects.toThrow(/E10274/u);
  });
});
