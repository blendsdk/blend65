import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

/** Build one complete source program through the public compiler service. */
async function buildSource(source: readonly string[]) {
  const root = await mkdtemp(join(tmpdir(), "blend65-comptime-"));
  await mkdir(join(root, "src"));
  await writeFile(
    join(root, "blend65.json"),
    JSON.stringify({
      schemaVersion: 1,
      name: "comptime-spec",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      outDir: "out",
      optimization: "none",
    }),
  );
  await writeFile(join(root, "src/game.blend"), source.join("\n"));
  return {
    root,
    result: await buildProject({ project: join(root, "blend65.json"), optimization: "none" }),
  };
}

describe("compile-time results in a built program", () => {
  // Scalar, struct, and array results survive as exact target data after evaluation.
  it("should retain only the requested scalar, struct and trigonometric table values", async () => {
    const { root, result } = await buildSource([
      "module Game;",
      "struct Pair { first: byte; second: word; }",
      "comptime function twice(value: byte): byte { return value + value; }",
      "comptime function makePair(): Pair { return { first: twice(7), second: 4660 }; }",
      "comptime function makeWave(): sbyte[4] {",
      "  let values: sbyte[4] = [; 0];",
      "  values[0] = sin8(0);",
      "  values[1] = cos8(0);",
      "  values[2] = sin8(32);",
      "  values[3] = sin8(192);",
      "  return values;",
      "}",
      "place(at: $2000) const ANSWER: byte = twice(9);",
      "place(at: $2010) const PAIR: Pair = makePair();",
      "place(at: $2020) const WAVE: sbyte[4] = makeWave();",
      "function main(): void { poke($0400, ANSWER); }",
    ]);
    try {
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
      if (result.kind !== "success") throw new Error("Compile-time result build did not succeed");
      const image = await readFile(
        join(result.generation.directory, result.generation.primaryArtifact),
      );
      expect(image.readUInt16LE(0)).toBe(0x0801);
      const at = (address: number, length: number) => [
        ...image.subarray(2 + address - 0x0801, 2 + address - 0x0801 + length),
      ];
      expect(at(0x2000, 1)).toEqual([18]);
      expect(at(0x2010, 3)).toEqual([14, 0x34, 0x12]);
      expect(at(0x2020, 4)).toEqual([0, 127, 90, 129]);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  // A forbidden volatile read poisons the constant root and publishes no program image.
  it("should reject a volatile compile-time dependency without publishing an artifact", async () => {
    const source = [
      "module Game;",
      "comptime function sample(): byte { return peek($D020); }",
      "const VALUE: byte = sample();",
      "function main(): void { poke($0400, VALUE); }",
    ];
    const { root, result } = await buildSource(source);
    try {
      expect(result.kind).toBe("failure");
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "E10191",
          primarySpan: expect.objectContaining({ start: source.join("\n").indexOf("peek($D020)") }),
        }),
      );
      const out = await readdir(join(root, "out")).catch(() => []);
      expect(out).not.toContain("game.prg");
      expect(out.filter((name) => name.endsWith(".prg"))).toEqual([]);
    } finally {
      await rm(root, { recursive: true });
    }
  });
});
