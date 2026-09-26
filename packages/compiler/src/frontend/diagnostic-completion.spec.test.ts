import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeProjectOverlay, loadProject } from "./index.js";

/** Analyze real project inputs through the frontend-only, asset-aware entry point. */
async function diagnostics(source: string) {
  const root = await mkdtemp(join(tmpdir(), "blend65-diagnostic-completion-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "diagnostics",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    const loaded = await loadProject({ project: join(root, "blend65.json") });
    if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
    return await analyzeProjectOverlay(loaded.snapshot, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("canonical source diagnostics", () => {
  // Public messages describe the rejected source expression, with its exact proving UTF-8 span.
  it.each([
    ["E10239", "poke($0400, absent);", "absent", "'absent' is not declared in this scope"],
    [
      "E10171",
      "poke($0400);",
      "poke($0400)",
      "Wrong argument count — 'poke()' expects 2 parameters, got 1",
    ],
    [
      "E10160",
      "const ratio: byte = 7 / 0; poke($0400, ratio);",
      "7 / 0",
      "Division by zero in constant expression",
    ],
    [
      "E10154",
      "let ordered: boolean = true < false; if (ordered) {}",
      "true < false",
      "Cannot apply '<' to 'boolean' — ordered comparisons are not valid for boolean operands",
    ],
    ["E10203", "poke($0400, byte(length(7)));", "7", "'length' requires an array — found 'byte'"],
  ])("should produce the canonical %s record", async (code, body, proof, message) => {
    const source = `module Game; /* £ is UTF-8 */ function main(): void { ${body} }`;
    const result = await diagnostics(source);
    expect(result.kind).toBe("error");
    const found = result.diagnostics.filter((item) => item.code === code);
    expect(found).toHaveLength(1);
    const start = Buffer.byteLength(source.slice(0, source.indexOf(proof)));
    expect(found[0]).toMatchObject({
      code,
      severity: "error",
      message,
      primarySpan: { sourceId: "src/game.blend", start, end: start + Buffer.byteLength(proof) },
    });
    expect(
      result.diagnostics.some((item) => /internal|lowering|SSA|allocator/i.test(item.message)),
    ).toBe(false);
  });

  // Ordinary child-scope shadowing and mutable loop-header variables have no retired diagnostic.
  it("should accept nested shadowing without any retired shadowing error", async () => {
    const result = await diagnostics(
      [
        "module Game; function main(): void {",
        "let value: byte = 1;",
        "{ let value: byte = 2; poke($0400, value); }",
        "for (let value: byte = 0; value < 2; value += 1) {",
        "  let value: byte = 3; poke($0401, value);",
        "}",
        "poke($0402, value); }",
      ].join("\n"),
    );
    expect(result.kind).toBe("complete");
    expect(result.diagnostics).toEqual([]);
  });

  // A poisoned call result suppresses dependent type errors but preserves an independent bad argument.
  it("should preserve independent roots without manufacturing errors from a poisoned call", async () => {
    const result = await diagnostics(
      "module Game; function take(a: byte, b: byte): byte { return a + b; } function main(): void { let value: byte = take(missing); poke($0400, value); }",
    );
    expect(result.kind).toBe("error");
    expect(result.diagnostics.map(({ code, message }) => ({ code, message }))).toEqual([
      { code: "E10171", message: "Wrong argument count — 'take()' expects 2 parameters, got 1" },
      { code: "E10239", message: "'missing' is not declared in this scope" },
    ]);
  });
});
