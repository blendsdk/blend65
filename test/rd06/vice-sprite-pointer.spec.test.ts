import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { patternedBytes, withProject } from "./project-fixture.js";

const screen = patternedBytes(1000, 41);
const sprites = patternedBytes(64, 42);

describe.sequential("relocated-screen sprite pointer in native VICE", () => {
  // The pointer table lives at the active screen's final eighth-KiB tail.
  it("should write $0FF8 while $D018 selects the relocated screen", async () => {
    const source = `module Game;
place(at: $0C00) const SCREEN: byte[] = embed("screen.bin");
const SPRITES: byte[] = embed("sprites.bin");
function main(): void {
  poke($D018, c64.vic.vicScreenSelect(&SCREEN));
  c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES));
  while (true) { poke($D020, 0); }
}
`;
    await withProject(
      source,
      [
        { path: "screen.bin", bytes: screen },
        { path: "sprites.bin", bytes: sprites },
      ],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error("Expected the relocated-screen build");
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
          if (loop === null) throw new Error("Relocated-screen loop label is missing");
          const address = Number.parseInt(loop[1]!, 16);
          await started.monitor.setExecuteCheckpoint(address);
          const stopped = started.monitor.waitForStop(10_000);
          await started.monitor.resume();
          expect(await stopped).toBe(address);
          expect(await started.monitor.readMemory(0x0ff8, 0x0ff8)).toEqual(Uint8Array.of(0x80));
          expect((await started.monitor.readMemory(0xd018, 0xd018))[0]! & 0xf0).toBe(0x30);
        } finally {
          await stopVice(started);
        }
      },
    );
  }, 60_000);
});
