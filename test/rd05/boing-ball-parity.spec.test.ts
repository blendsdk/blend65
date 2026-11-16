import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { BOING_BALL_DIR, assembleTwin, exampleFramePoint, labels } from "./boing-ball-fixture.js";

/** Sample VIC state after a fixed number of per-frame checkpoints. */
async function sample(
  prg: string,
  point: number,
  frames: number,
): Promise<{ readonly io: readonly number[]; readonly pointers: readonly number[] }> {
  const started = await startVice(prg);
  if ("kind" in started) throw new Error(started.reason);
  const { monitor } = started;
  try {
    const checkpoint = await monitor.setExecuteCheckpoint(point);
    try {
      for (let index = 0; index < frames; index += 1) {
        const stopped = monitor.waitForStop(30_000);
        await monitor.resume();
        expect(await stopped).toBe(point);
      }
      return {
        io: [...(await monitor.readIo(0xd000, 0xd02a))],
        pointers: [...(await monitor.readMemory(0x07f8, 0x07fb))],
      };
    } finally {
      await monitor.deleteCheckpoint(checkpoint);
    }
  } finally {
    await stopVice({ child: started.child, monitor });
  }
}

describe("boing-ball expert twin", () => {
  it("should match the compiled example's frame state", async () => {
    const built = await buildProject({ project: join(BOING_BALL_DIR, "blend65.json") });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return;
    const asm = await readFile(join(built.generation.directory, ".asm"), "utf8");
    const map = labels(await readFile(join(built.generation.directory, ".labels"), "utf8"));
    const examplePoint = exampleFramePoint(asm, map);
    const ball = [...map].find(([name]) => name.startsWith("b65_assets_ball_"));
    expect(ball, "the ball asset must resolve").toBeDefined();
    const ballAddress = ball![1];
    expect(ballAddress % 64, "sprite data must be 64-byte aligned").toBe(0);
    expect(ballAddress, "sprite data must be in VIC bank 0").toBeLessThan(0x4000);
    const twin = await assembleTwin();
    try {
      const twinPoint = labels(twin.symbol).get("framePoint");
      if (twinPoint === undefined) throw new Error("missing framePoint");
      for (const frames of [2, 6, 10, 99, 100]) {
        const example = await sample(
          join(built.generation.directory, built.generation.primaryArtifact),
          examplePoint,
          frames,
        );
        const handWritten = await sample(twin.prg, twinPoint, frames);
        expect(handWritten, `frame ${frames}`).toEqual(example);
        // The frame's pointer base is the asset block, advanced in fours.
        const base = ballAddress / 64;
        expect([0, 4, 8, 12], `frame ${frames} pointer phase`).toContain(
          (handWritten.pointers[0]! - base + 256) % 256,
        );
        for (const offset of [1, 2, 3])
          expect(handWritten.pointers[offset], `sprite ${offset}`).toBe(
            (handWritten.pointers[0]! + offset) & 0xff,
          );
      }
    } finally {
      await twin.cleanup();
    }
  }, 180_000);
});
