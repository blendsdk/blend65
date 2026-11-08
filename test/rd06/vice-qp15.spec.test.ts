import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { qualificationProject } from "./qualification-fixture.js";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

const qualification = join(process.cwd(), "test/rd06/qualification/q-p15");

/** Read one expected hex sequence. */
async function expectedHex(name: string): Promise<number[]> {
  const expected = JSON.parse(
    await readFile(join(qualification, "expected.json"), "utf8"),
  ) as Record<string, { hex: string }>;
  return [...Buffer.from(expected[name]!.hex, "hex")];
}

describe.sequential("Q-P15 runtime in native VICE", () => {
  // The user renderer must reach screen, Color RAM and both representations exactly.
  it("should observe the rendered panels and conflict bytes on PAL 6581", async () => {
    const copy = await qualificationProject("q-p15");
    try {
      const built = await buildProject({ project: copy.project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected the Q-P15 build");
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
        if (loop === null) throw new Error("Q-P15 renderer loop label is missing");
        await started.monitor.setExecuteCheckpoint(Number.parseInt(loop[1]!, 16));
        const stopped = started.monitor.waitForStop(10_000);
        await started.monitor.resume();
        expect(await stopped).toBe(Number.parseInt(loop[1]!, 16));

        expect([...(await started.monitor.readMemory(0x0c00, 0x0c07))]).toEqual(
          await expectedHex("screenFinal"),
        );
        // Color RAM stores only the low nibble; the upper bits are not VIC state.
        expect(
          [...(await started.monitor.readMemory(0xd800, 0xd807))].map((byte) => byte & 0x0f),
        ).toEqual(await expectedHex("colorFinal"));
        expect([...(await started.monitor.readMemory(0x2000, 0x2007))]).toEqual(
          await expectedHex("bitmapHead"),
        );
        expect([...(await started.monitor.readMemory(0x0700, 0x0700))]).toEqual([2]);
        expect([...(await started.monitor.readMemory(0x0702, 0x0703))]).toEqual([0x3f, 0x00]);
        // VIC register readback through the monitor is not a reliable oracle in this
        // harness; the generated stores and the visible bitmap/screen/Color RAM are.
      } finally {
        await stopVice(started);
      }
    } finally {
      await copy.cleanup();
    }
  }, 60_000);
});
