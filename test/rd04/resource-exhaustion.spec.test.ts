import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

/** Build a complete program whose individually legal objects exceed their shared range. */
async function buildSource(source: string) {
  const root = await mkdtemp(join(tmpdir(), "blend65-resource-exhaustion-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "resource-exhaustion",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    return await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("combined emitted and non-emitted resource exhaustion", () => {
  it.each([
    {
      name: "a full-budget module buffer sharing RAM with the loaded program",
      source:
        "module Game; let buffer: byte[51199]; function main(): void { buffer[0] = 7; poke($0400, buffer[0]); }",
      // The mandatory twelve-byte BASIC line alone makes the full-budget buffer impossible.
      minimumUsed: 51_199 + 12,
    },
    {
      name: "a local frame sharing RAM with an upper-range emitted constant",
      source:
        "module Game; place(at: $CF00) const MARK: byte = 1; function main(): void { let buffer: byte[512]; buffer[0] = 7; buffer[511] = 9; poke($0400, buffer[0]); poke($0401, buffer[511]); poke($0402, MARK); }",
      // The placed byte ends the emitted prefix at $CF01; the complete local array follows it.
      minimumUsed: 0xcf01 - 0x0801 + 512,
    },
  ])(
    "should report a canonical shared-budget error for $name",
    async (testCase) => {
      const result = await buildSource(testCase.source);
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors.map(({ code }) => code)).toEqual(["E10238"]);
      const error = errors[0];
      expect(error).toMatchObject({ severity: "error", pointer: null });
      const match =
        /^Target resource budget exceeded for '([^']+)' — used (\d+), available 51199 on 'c64-pal-prg-kernal-6581'$/u.exec(
          error?.message ?? "",
        );
      expect(match, error?.message).not.toBeNull();
      expect(match?.[1]).toMatch(/ram|frame/iu);
      expect(Number(match?.[2])).toBeGreaterThanOrEqual(testCase.minimumUsed);
      expect(error?.primarySpan?.sourceId).toBe("src/game.blend");
      expect(error?.primarySpan?.start).toBeGreaterThanOrEqual(0);
      expect(error?.primarySpan?.end).toBeGreaterThan(error?.primarySpan?.start ?? Infinity);
      expect(error?.primarySpan?.end).toBeLessThanOrEqual(Buffer.byteLength(testCase.source));
      expect(result).not.toHaveProperty("generation");
    },
    60_000,
  );
});
