import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

/** Locate an exact source spelling in raw UTF-8 bytes. */
function span(source: string, spelling: string) {
  const start = Buffer.byteLength(source.slice(0, source.indexOf(spelling)));
  return { sourceId: "src/game.blend", start, end: start + Buffer.byteLength(spelling) };
}

describe("conflicting placement of aliases to one immutable asset", () => {
  // Both constraints prove the conflict; neither source declaration may disappear from the report.
  it("should point to the later place clause and relate the earlier conflicting clause", async () => {
    const first = "place(at: $3000)";
    const second = "place(at: $3100)";
    const source = [
      "module Game;",
      `${first} const FIRST: byte[] = embed("data.bin");`,
      `${second} const SECOND: byte[] = embed("./data.bin");`,
      "function main(): void { poke($0400, FIRST[0]); poke($0401, SECOND[1]); }",
    ].join("\n");
    const root = await mkdtemp(join(tmpdir(), "blend65-asset-alias-diagnostic-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(join(root, "src/game.blend"), source);
      await writeFile(join(root, "src/data.bin"), Uint8Array.of(3, 5, 7));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "asset-alias-diagnostic",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      const result = await buildProject({ project: join(root, "blend65.json") });
      expect(result.kind).toBe("failure");
      expect(result).not.toHaveProperty("generation");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10273",
        severity: "error",
        pointer: null,
        message: expect.stringMatching(
          /^Cannot place '[^']+' — .+ conflict with .+; change or remove the explicit constraint$/u,
        ),
        primarySpan: span(source, second),
      });
      expect(errors[0]?.related.map(({ span }) => span)).toEqual([span(source, first)]);
      expect(errors[0]?.related[0]?.message).toEqual(expect.stringMatching(/\S/u));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
