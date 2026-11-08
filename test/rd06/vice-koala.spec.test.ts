import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { withProject } from "./project-fixture.js";

const fixture = readFileSync(
  join(process.cwd(), "test/rd06/fixtures/public/koala/koala-patterned.kla"),
);

describe.sequential("Koala visibility in native VICE", () => {
  // Bitmap, screen and Color RAM transfer reach their exact resident addresses.
  it("should observe the bitmap, screen and Color RAM transfer", async () => {
    const source = `module Game;
place(at: $2000) const BITMAP: byte[] = embed("level.kla", "bitmap");
place(at: $0C00) const SCREEN: byte[] = embed("level.kla", "screen");
place(at: $4000) const COLORS: byte[] = embed("level.kla", "color_ram");
function main(): void {
  let index: byte = 0;
  while (index < 8) {
    poke($D800 + word(index), COLORS[index] & $0f);
    index += 1;
  }
  poke($D018, c64.vic.vicBitmapSelect(&BITMAP) | c64.vic.vicScreenSelect(&SCREEN));
  while (true) { poke($D020, 0); }
}
`;
    await withProject(source, [{ path: "level.kla", bytes: fixture }], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected the Koala build");
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
        if (loop === null) throw new Error("Koala loop label is missing");
        await started.monitor.setExecuteCheckpoint(Number.parseInt(loop[1]!, 16));
        const stopped = started.monitor.waitForStop(10_000);
        await started.monitor.resume();
        expect(await stopped).toBe(Number.parseInt(loop[1]!, 16));
        expect([...(await started.monitor.readMemory(0x2000, 0x2007))]).toEqual([
          ...fixture.subarray(2, 10),
        ]);
        expect([...(await started.monitor.readMemory(0x0c00, 0x0c07))]).toEqual([
          ...fixture.subarray(8002, 8010),
        ]);
        expect(
          [...(await started.monitor.readMemory(0xd800, 0xd807))].map((byte) => byte & 0x0f),
        ).toEqual([...fixture.subarray(9002, 9010)].map((byte) => byte & 0x0f));
      } finally {
        await stopVice(started);
      }
    });
  }, 60_000);
});
