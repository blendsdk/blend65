import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";

/** Write one source or manifest file inside the test-owned temporary project. */
async function put(root: string, name: string, content: string): Promise<void> {
  const path = join(root, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

/** Resume the emulator and require the next stop to be the requested checkpoint. */
async function resumeTo(monitor: ViceMonitor, address: number): Promise<void> {
  const stopped = monitor.waitForStop(20_000);
  await monitor.resume();
  expect(await stopped).toBe(address);
}

describe.sequential("scalar and control-flow runtime behavior", () => {
  // Fixed RAM observations distinguish effect order, selected paths, fixed-width values, and loop exits.
  it("should execute scalar expressions and structured flow in exact source order", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-scalars-runtime-"));
    try {
      await put(
        root,
        "blend65.json",
        JSON.stringify({
          schemaVersion: 1,
          name: "scalars-runtime",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await put(
        root,
        "src/game.blend",
        [
          "module Game;",
          "const FOLDED: word = byte(250) + byte(10);",
          "let runtimeWord: word = byte(250) + byte(10);",
          "let values: byte[2] = [10, 20];",
          "let logCount: byte = 0;",
          "let stagingSource: byte = 250;",
          "enum Mode { One, Two, Three }",
          "function mark(code: byte): void { poke($0400 + word(logCount), code); logCount += 1; }",
          "function index(): word { mark(1); return 1; }",
          "function delta(): byte { values[1] = 40; mark(3); return 7; }",
          "function skipped(): boolean { mark(9); return true; }",
          "function yes(): byte { mark(4); return 11; }",
          "function no(): byte { mark(5); return 12; }",
          "function overwriteSource(): byte { stagingSource = 1; return 10; }",
          "function combine(first: word, second: byte): word { return first + word(second); }",
          "function main(): void {",
          "  let copy: byte = values[index()] += delta();",
          "  let both: boolean = false && skipped();",
          "  let either: boolean = true || skipped();",
          "  let first: byte = true ? yes() : no();",
          "  let second: byte = false ? yes() : no();",
          "  let bothByte: byte = 0;",
          "  let eitherByte: byte = 0;",
          "  if (both) { bothByte = 1; }",
          "  if (either) { eitherByte = 1; }",
          "  let updates: byte = 0;",
          "  let bodyCount: byte = 0;",
          "  for (let i: word = 0; i < 3; i += 1, updates += 1) {",
          "    if (i == 1) { continue; }",
          "    bodyCount += 1;",
          "  }",
          "  let cursor: byte = 254;",
          "  let ringCount: byte = 0;",
          "  for (;;) { ringCount += 1; if (cursor == 1) { break; } cursor += 1; }",
          "  let mode: Mode = Mode.One;",
          "  switch (mode) {",
          "    case Mode.One, Mode.Two: mark(6); fallthrough;",
          "    case Mode.Three: mark(7);",
          "    default: mark(8);",
          "  }",
          "  let signedWide: sword = sword(sbyte(-5));",
          "  let unsignedWide: word = word(byte(250));",
          "  poke($0410, values[1]);",
          "  poke($0411, copy);",
          "  poke($0412, byte(FOLDED));",
          "  poke($0413, byte(FOLDED >> 8));",
          "  poke($0414, byte(runtimeWord));",
          "  poke($0415, byte(runtimeWord >> 8));",
          "  poke($0416, bothByte);",
          "  poke($0417, eitherByte);",
          "  poke($0418, first);",
          "  poke($0419, second);",
          "  poke($041A, updates);",
          "  poke($041B, bodyCount);",
          "  poke($041C, ringCount);",
          "  poke($041D, logCount);",
          "  poke($041E, lo(signedWide));",
          "  poke($041F, hi(signedWide));",
          "  poke($0420, lo(unsignedWide));",
          "  poke($0421, hi(unsignedWide));",
          "  let frozen: word = word(stagingSource);",
          "  stagingSource = 2;",
          "  poke($0422, lo(frozen));",
          "  poke($0423, hi(frozen));",
          "  poke($0424, stagingSource);",
          "  stagingSource = 250;",
          "  let nested: word = combine(word(stagingSource), overwriteSource());",
          "  poke($0425, lo(nested));",
          "  poke($0426, hi(nested));",
          "  poke($0427, stagingSource);",
          "}",
        ].join("\n"),
      );

      const built = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Scalar runtime build did not succeed");
      const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
      const returnLabel = `b65_${Buffer.from("startup.restore").toString("hex")}`;
      const returnMatches = [
        ...labels.matchAll(new RegExp(`^\\s*${returnLabel}\\s*=\\s*\\$([0-9a-f]+)`, "gimu")),
      ];
      expect(returnMatches).toHaveLength(1);
      const addressText = returnMatches[0]?.[1];
      if (addressText === undefined) throw new Error("Missing startup return checkpoint");
      const returnAddress = Number.parseInt(addressText, 16);
      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      let checkpoint: number | undefined;
      try {
        checkpoint = await started.monitor.setExecuteCheckpoint(returnAddress);
        await resumeTo(started.monitor, returnAddress);
        expect([...(await started.monitor.readMemory(0x0400, 0x0405))]).toEqual([1, 3, 4, 5, 6, 7]);
        expect([...(await started.monitor.readMemory(0x0410, 0x041d))]).toEqual([
          27, 27, 4, 1, 4, 0, 0, 1, 11, 12, 3, 2, 4, 6,
        ]);
        expect([...(await started.monitor.readMemory(0x041e, 0x0421))]).toEqual([
          0xfb, 0xff, 0xfa, 0x00,
        ]);
        expect([...(await started.monitor.readMemory(0x0422, 0x0427))]).toEqual([
          250, 0, 2, 4, 1, 1,
        ]);
      } finally {
        try {
          if (checkpoint !== undefined) await started.monitor.deleteCheckpoint(checkpoint);
        } finally {
          await stopVice({ child: started.child, monitor: started.monitor });
        }
      }
    } finally {
      await rm(root, { recursive: true });
    }
  }, 60_000);
});
