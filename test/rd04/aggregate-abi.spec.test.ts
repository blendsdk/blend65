import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

async function runProgram(source: readonly string[], lastAddress: number): Promise<number[]> {
  const root = await mkdtemp(join(tmpdir(), "blend65-aggregate-abi-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "aggregate-abi",
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
    if (built.kind !== "success") throw new Error("Aggregate ABI build did not succeed");

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
        return [...(await started.monitor.readMemory(0x0420, lastAddress))];
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

describe.sequential("aggregate calls and values", () => {
  // A nested fixed-struct result and a self-aliasing assignment preserve whole values and effects.
  it("should return nested structs into caller storage and evaluate assignment effects once", async () => {
    const observed = await runProgram(
      [
        "module Game;",
        "struct Pair { first: byte; second: byte; }",
        "let pairs: Pair[2] = [{ first: 1, second: 2 }, { first: 3, second: 4 }];",
        "function index(): word { poke($0430, peek($0430) + 1); return 1; }",
        "function make(value: byte): Pair {",
        "  poke($0431, peek($0431) + 1);",
        "  poke($0432, peek($0430));",
        "  return { first: value, second: value + 1 };",
        "}",
        "function relay(value: byte): Pair { return make(value); }",
        "function same(value: Pair): Pair { return value = value; }",
        "function main(): void {",
        "  poke($0430, 0); poke($0431, 0); poke($0432, 0);",
        "  let assigned: Pair = pairs[index()] = make(7);",
        "  let aliased: Pair = same(pairs[1]);",
        "  let nested: Pair = relay(12);",
        "  let bytes: byte[2] = [5, 6];",
        "  let arrayCopy: byte[2] = bytes = bytes;",
        "  poke($0420, pairs[1].first); poke($0421, pairs[1].second);",
        "  poke($0422, assigned.first); poke($0423, assigned.second);",
        "  poke($0424, aliased.first); poke($0425, aliased.second);",
        "  poke($0426, nested.first); poke($0427, nested.second);",
        "  poke($0428, peek($0430)); poke($0429, peek($0431)); poke($042A, peek($0432));",
        "  poke($042B, bytes[0]); poke($042C, arrayCopy[1]);",
        "}",
      ],
      0x042c,
    );
    expect(observed).toEqual([7, 8, 7, 8, 7, 8, 12, 13, 1, 2, 1, 5, 6]);
  }, 60_000);

  // The same fixed array is borrowed by exact and unsized parameters; forwarding keeps its word count.
  it("should pass an exact array address and forward the full unsized outer count", async () => {
    const observed = await runProgram(
      [
        "module Game;",
        "let values: byte[300] = [; 0];",
        "function change(data: byte[300]): void { data[0] = 9; }",
        "function first(data: const byte[300]): byte { return data[0]; }",
        "function count(data: const byte[]): word { return length(data); }",
        "function forward(data: const byte[]): word { return count(data); }",
        "function main(): void {",
        "  change(values);",
        "  poke($0420, first(values));",
        "  let size: word = forward(values);",
        "  poke($0421, lo(size)); poke($0422, hi(size));",
        "}",
      ],
      0x0422,
    );
    expect(observed).toEqual([9, 44, 1]);
  }, 60_000);
});
