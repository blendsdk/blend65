import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { withProject, type ProjectAsset } from "./project-fixture.js";

const fixtureRoot = join(process.cwd(), "test/rd06/fixtures/public/psid");

/** Build one project-local fixed-load fixture at $3000. */
function fixedPsid(name: string): ProjectAsset {
  const bytes = Buffer.from(readFileSync(join(fixtureRoot, `${name}.sid`)));
  bytes.writeUInt16BE(0x3000, 0x08);
  bytes.writeUInt16BE(0x3000, 0x0a);
  bytes.writeUInt16BE(0x3003, 0x0c);
  return { path: "music.sid", bytes };
}

/** Build one project-local payload-load fixture whose embedded load is $3000. */
function payloadPsid(name: string): ProjectAsset {
  const bytes = Buffer.from(readFileSync(join(fixtureRoot, `${name}.sid`)));
  bytes.writeUInt16BE(0, 0x08);
  bytes.writeUInt16BE(0, 0x0a);
  bytes.writeUInt16BE(0x3003, 0x0c);
  bytes[0x76] = 0x00;
  bytes[0x77] = 0x30;
  return { path: "music.sid", bytes };
}

/** Build the PSID data program and observe its resident payload in native VICE. */
async function observe(asset: ProjectAsset, profile: string): Promise<void> {
  const source =
    'module Game;\n\nconst MUSIC: byte[] = embed("music.sid");\nfunction main(): void { let counter: byte = 0; while (true) { counter = counter + 1; poke($0420, counter); } }\n';
  await withProject(
    source,
    [asset],
    async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected a successful PSID build");
      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
        80_000_000,
        profile,
      );
      if ("kind" in started && started.kind === "unknown") {
        expect.soft(started.reason).toMatch(/unavailable/u);
        return;
      }
      try {
        const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
        const main = /b65_Game_main_block_2_[A-Za-z0-9_]+\s*=\s*\$([0-9a-f]+)/iu.exec(labels);
        if (main === null) throw new Error("PSID probe loop label is missing");
        await started.monitor.setExecuteCheckpoint(Number.parseInt(main[1]!, 16));
        const stopped = started.monitor.waitForStop(10_000);
        await started.monitor.resume();
        expect(await stopped).toBe(Number.parseInt(main[1]!, 16));
        const observed = await started.monitor.readMemory(0x3000, 0x3007);
        expect([...observed]).toEqual([0x60, 0xea, 0xea, 0x60, 0xa9, 0x00, 0x60, 0xea]);
      } finally {
        await stopVice(started);
      }
    },
    profile,
  );
}

describe.sequential("PSID resident placement in native VICE", () => {
  // Fixed-load data must appear at the header address, not at an automatic location.
  it("should observe fixed-load data at $3000 on the PAL 6581 profile", async () => {
    await observe(fixedPsid("psid-v1-fixed"), "c64-pal-prg-kernal-6581");
  }, 60_000);

  // A payload-supplied load address is stripped and applied exactly once.
  it("should observe payload-load data at $3000 on the NTSC 8580 profile", async () => {
    await observe(payloadPsid("psid-v1-payload"), "c64-ntsc-prg-kernal-8580");
  }, 60_000);
});
