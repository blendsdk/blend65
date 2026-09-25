import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Build and execute one complete source program, then read its observation bytes. */
async function runProgram(source: readonly string[]): Promise<number[]> {
  const root = await mkdtemp(join(tmpdir(), "blend65-function-values-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "function-values",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(join(root, "src/game.blend"), source.join("\n"));
    const built = await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Function-value build did not succeed");

    const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
    const returnLabel = `b65_${Buffer.from("startup.restore").toString("hex")}`;
    const returnMatch = labels.match(
      new RegExp(`^\\s*${returnLabel}\\s*=\\s*\\$([0-9a-f]+)`, "imu"),
    );
    expect(returnMatch).not.toBeNull();
    const returnAddress = Number.parseInt(returnMatch?.[1] ?? "", 16);
    const started = await startVice(
      join(built.generation.directory, built.generation.primaryArtifact),
    );
    if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
    try {
      const checkpoint = await started.monitor.setExecuteCheckpoint(returnAddress);
      try {
        const stopped = started.monitor.waitForStop(20_000);
        await started.monitor.resume();
        expect(await stopped).toBe(returnAddress);
        return [...(await started.monitor.readMemory(0x0420, 0x0428))];
      } finally {
        await started.monitor.deleteCheckpoint(checkpoint);
      }
    } finally {
      await stopVice({ child: started.child, monitor: started.monitor });
    }
  } finally {
    await rm(root, { recursive: true });
  }
}

describe.sequential("ordinary function values", () => {
  // A target expression runs before its arguments, and typed values survive storage, selection, passing, return, and dynamic indexing.
  it("should call singleton and finite function values in exact source order", async () => {
    const observed = await runProgram([
      "module Game;",
      "let step: byte = 0;",
      "function record(tag: byte): void { poke($0424 + word(step), tag); step += 1; }",
      "function plusOne(value: byte): byte { record(3); return value + 1; }",
      "function plusTwo(value: byte): byte { record(4); return value + 2; }",
      "function choose(useOne: boolean): fn(byte): byte {",
      "  record(1);",
      "  return useOne ? &plusOne : &plusTwo;",
      "}",
      "function argument(): byte { record(2); return 5; }",
      "function pass(callback: fn(byte): byte): fn(byte): byte { return callback; }",
      "function main(): void {",
      "  step = 0;",
      "  let first: byte = choose(false)(argument());",
      "  let stored: fn(byte): byte = &plusOne;",
      "  let selected: fn(byte): byte = true ? stored : &plusOne;",
      "  let returned: fn(byte): byte = pass(selected);",
      "  let second: byte = returned(8);",
      "  let callbacks: (fn(byte): byte)[2] = [&plusOne, &plusTwo];",
      "  poke($0440, 1);",
      "  let which: byte = peek($0440);",
      "  let third: byte = callbacks[word(which)](10);",
      "  poke($0420, first);",
      "  poke($0421, second);",
      "  poke($0422, third);",
      "  poke($0423, step);",
      "}",
    ]);

    expect(observed).toEqual([7, 9, 12, 5, 1, 2, 4, 3, 4]);
  }, 60_000);
});
