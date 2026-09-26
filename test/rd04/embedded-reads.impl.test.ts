import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Narrow the published memory intervals before checking actual resident and frame sizes. */
function memoryIntervals(value: unknown): { kind: string; start: number; end: number }[] {
  if (
    value === null ||
    typeof value !== "object" ||
    !("intervals" in value) ||
    !Array.isArray(value.intervals)
  )
    throw new Error("Expected memory intervals");
  return value.intervals.map((interval: unknown) => {
    if (
      interval === null ||
      typeof interval !== "object" ||
      !("kind" in interval) ||
      typeof interval.kind !== "string" ||
      !("start" in interval) ||
      typeof interval.start !== "number" ||
      !("end" in interval) ||
      typeof interval.end !== "number"
    )
      throw new Error("Expected a numeric memory interval");
    return { kind: interval.kind, start: interval.start, end: interval.end };
  });
}

it("reads one resident asset directly across byte and word indices without an SFA copy", async () => {
  const root = await mkdtemp(join(tmpdir(), "blend65-embedded-reads-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "embedded-reads",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    const bytes = new Uint8Array(512);
    bytes[0] = 7;
    bytes[255] = 19;
    bytes[256] = 23;
    bytes[300] = 37;
    bytes[511] = 31;
    await writeFile(join(root, "src/data.bin"), bytes);
    await writeFile(
      join(root, "src/game.blend"),
      [
        "module Game;",
        'const DATA: byte[] = embed("data.bin");',
        'const ALIAS: byte[] = embed("data.bin");',
        "function main(): void {",
        "poke($0420, DATA[0]); poke($0421, DATA[255]); poke($0422, ALIAS[256]);",
        "poke($0423, DATA[511]); pokew($0400, 300); poke($0424, DATA[peekw($0400)]);",
        "poke($0425, peek(&DATA[256]));",
        "}",
      ].join("\n"),
    );
    const result = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "none",
    });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    if (result.kind !== "success") throw new Error("Expected an embedded-data build");
    const assembly = await readFile(join(result.generation.directory, ".asm"), "utf8");
    // Direct symbol reads need one absolute LDA: three bytes, four cycles, no pointer setup.
    expect(assembly).toMatch(/lda\+2\s+b65_src_data_bin_[0-9a-f]+\s*\n/iu);
    const intervals = memoryIntervals(
      JSON.parse(await readFile(join(result.generation.directory, ".memory.json"), "utf8")),
    );
    const assets = intervals.filter((interval) => interval.kind === "asset");
    expect(assets).toHaveLength(1);
    expect(assets[0]!.end - assets[0]!.start).toBe(512);
    const frameBytes = intervals
      .filter((interval) => interval.kind === "sfa")
      .reduce((total, interval) => total + interval.end - interval.start, 0);
    expect(frameBytes).toBeLessThan(64);
    const labels = await readFile(join(result.generation.directory, ".labels"), "utf8");
    const restore = labels.match(
      new RegExp(
        `^\\s*b65_[A-Za-z0-9_]+_${Buffer.from("startup.restore").toString("hex")}\\s*=\\s*\\$([0-9a-f]+)`,
        "imu",
      ),
    );
    expect(restore).not.toBeNull();
    const address = Number.parseInt(restore![1]!, 16);
    const started = await startVice(
      join(result.generation.directory, result.generation.primaryArtifact),
    );
    if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
    try {
      const checkpoint = await started.monitor.setExecuteCheckpoint(address);
      try {
        const stopped = started.monitor.waitForStop(20_000);
        await started.monitor.resume();
        expect(await stopped).toBe(address);
        expect([...(await started.monitor.readMemory(0x0420, 0x0425))]).toEqual([
          7, 19, 23, 31, 37, 23,
        ]);
      } finally {
        await started.monitor.deleteCheckpoint(checkpoint);
      }
    } finally {
      await stopVice({ child: started.child, monitor: started.monitor });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
