import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { withProject, type ProjectAsset } from "./project-fixture.js";

const producerRoot = "/home/gevik/workdir/github/blend65.ri/apps";
const SPD = join(
  producerRoot,
  "SpritePad C64 3.80 Pro/Examples (SPD5)/Sprite Sheets (Subchrist)/ChromeFont.spd",
);
const CTM = join(
  producerRoot,
  "CharPad C64 3.80 Pro/Examples (CTM9)/Maps (Subchrist)/Hexagone (5x5).ctm",
);

/** Read one optional producer file. */
function producer(path: string, projectPath: string): ProjectAsset | null {
  try {
    return { path: projectPath, bytes: readFileSync(path) };
  } catch {
    return null;
  }
}

/** Build one asset program and observe its first resident bytes in VICE. */
async function observe(
  asset: ProjectAsset | null,
  source: string,
  expectedBytes: number,
  offset: number,
  alignment: number,
): Promise<void> {
  if (asset === null) return;
  await withProject(source, [asset], async (project) => {
    const built = await buildProject({ project });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Expected a producer build");
    const assets = JSON.parse(
      await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
    ) as { assets: { selector: string; placement: { range: { start: number } } }[] };
    const start = assets.assets[0]?.placement.range.start;
    if (start === undefined) throw new Error("Producer asset has no placement");
    expect(start % alignment).toBe(0);
    expect(start).toBeLessThan(0x4000);
    const started = await startVice(
      join(built.generation.directory, built.generation.primaryArtifact),
      80_000_000,
      "c64-pal-prg-kernal-6581",
    );
    if ("kind" in started && started.kind === "unknown") {
      expect.soft(started.reason).toMatch(/unavailable/u);
      return;
    }
    try {
      const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
      const loop = /b65_Game_main_block_2_[A-Za-z0-9_]+\s*=\s*\$([0-9a-f]+)/iu.exec(labels);
      if (loop === null) throw new Error("Producer loop label is missing");
      await started.monitor.setExecuteCheckpoint(Number.parseInt(loop[1]!, 16));
      const stopped = started.monitor.waitForStop(10_000);
      await started.monitor.resume();
      expect(await stopped).toBe(Number.parseInt(loop[1]!, 16));
      expect([...(await started.monitor.readMemory(start, start + expectedBytes - 1))]).toEqual([
        ...asset.bytes.subarray(offset, offset + expectedBytes),
      ]);
    } finally {
      await stopVice(started);
    }
  });
}

describe.sequential("producer assets in native VICE", () => {
  // SpritePad sprite records appear at their 64-byte-aligned resident address.
  it("should observe SpritePad sprite bytes", async () => {
    const asset = producer(SPD, "player.spd");
    const source =
      asset === null
        ? ""
        : `module Game;
const SPRITES: byte[] = embed("player.spd");
function main(): void { poke($D015, 1); while (true) { poke($D020, 0); } }
`;
    await observe(asset, source, 64, 20, 64);
  }, 60_000);

  // CharPad charset bytes appear at their 2-KiB-aligned resident address.
  it("should observe CharPad charset bytes", async () => {
    const asset = producer(CTM, "level.ctm");
    const source =
      asset === null
        ? ""
        : `module Game;
const CHARSET: byte[] = embed("level.ctm", "charset");
function main(): void { poke($D018, c64.vic.vicCharsetSelect(&CHARSET)); while (true) { poke($D020, 0); } }
`;
    await observe(asset, source, 8, 23, 2048);
  }, 60_000);
});
