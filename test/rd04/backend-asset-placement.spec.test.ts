import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

/** Build two canonical-equivalent references to one raw payload with independent placement requests. */
async function buildPlacedAssets(secondAddress: number) {
  const root = await mkdtemp(join(tmpdir(), "blend65-deduplicated-placement-"));
  await mkdir(join(root, "src"));
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "assets/data.bin"), Uint8Array.of(0x91, 0xa2, 0xb3));
  await writeFile(
    join(root, "blend65.json"),
    JSON.stringify({
      schemaVersion: 1,
      name: "placed-assets",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: ["assets"],
      outDir: "out",
      optimization: "none",
    }),
  );
  await writeFile(
    join(root, "src/game.blend"),
    [
      "module Game;",
      'place(at: $3000, align: 256) const FIRST: byte[] = embed("data.bin");',
      `place(at: ${secondAddress}, noCross: 256) const SECOND: byte[] = embed("./data.bin");`,
      "function main(): void { poke($0400, FIRST[0]); poke($0401, SECOND[1]); }",
    ].join("\n"),
  );
  return {
    root,
    result: await buildProject({ project: join(root, "blend65.json"), optimization: "none" }),
  };
}

describe("canonical raw asset placement", () => {
  // Equivalent references combine compatible constraints and still emit exactly one resident payload.
  it("should combine compatible placements on one deduplicated resident object", async () => {
    const { root, result } = await buildPlacedAssets(0x3000);
    try {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      if (result.kind !== "success") throw new Error("Expected compatible asset placement");
      const image = await readFile(
        join(result.generation.directory, result.generation.primaryArtifact),
      );
      const payload = Buffer.from([0x91, 0xa2, 0xb3]);
      const addressOffset = 2 + 0x3000 - image.readUInt16LE(0);
      expect(image.subarray(addressOffset, addressOffset + payload.length)).toEqual(payload);
      expect(image.indexOf(payload)).toBe(addressOffset);
      expect(image.indexOf(payload, addressOffset + 1)).toBe(-1);
      const assets = JSON.parse(
        await readFile(join(result.generation.directory, ".assets.json"), "utf8"),
      );
      expect(assets.assets).toHaveLength(1);
      expect(assets.assets[0]).toMatchObject({
        payloadBytes: 3,
        emittedBytes: 3,
        placement: { kind: "single", range: { start: 0x3000, end: 0x3003 } },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  // One immutable identity cannot satisfy two different fixed addresses by silently duplicating bytes.
  it("should reject contradictory addresses for one deduplicated asset without publication", async () => {
    const { root, result } = await buildPlacedAssets(0x3100);
    try {
      expect(result.kind).toBe("failure");
      expect(result.diagnostics.map(({ code }) => code)).toContain("E10273");
      const names = await readdir(join(root, "out")).catch(() => [] as string[]);
      expect(names).not.toContain("current.json");
      expect(names.filter((name) => name.startsWith(".staging-"))).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});
