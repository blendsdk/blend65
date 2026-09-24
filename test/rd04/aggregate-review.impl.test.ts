import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Build one short source file through the public compiler service. */
async function buildSource(name: string, lines: readonly string[]) {
  const root = await mkdtemp(join(tmpdir(), `blend65-${name}-`));
  await mkdir(join(root, "src"));
  await writeFile(
    join(root, "blend65.json"),
    JSON.stringify({
      schemaVersion: 1,
      name,
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      outDir: "out",
      optimization: "none",
    }),
  );
  await writeFile(join(root, "src/game.blend"), lines.join("\n"));
  return { root, result: await buildProject({ project: join(root, "blend65.json") }) };
}

describe.sequential("aggregate review regressions", () => {
  it("should copy nested aggregate values instead of their pointer bytes", async () => {
    const { root, result } = await buildSource("nested-value", [
      "module Game;",
      "struct Holder { inner: byte[3]; }",
      "struct Swap { a: byte[3]; b: byte[3]; }",
      "let source: byte[3] = [1, 2, 3];",
      "let swapped: Swap = { a: [1, 2, 3], b: [4, 5, 6] };",
      "let large: byte[1024] = [; 0];",
      "function first(input: const byte[1024]): byte { return input[0]; }",
      "function fillAndRead(output: byte[1024]): byte { return first(output = [; 7]); }",
      "function main(): void {",
      "  let value: Holder = { inner: source };",
      "  poke($0440, value.inner[0]);",
      "  poke($0441, value.inner[1]);",
      "  poke($0442, value.inner[2]);",
      "  swapped = { a: swapped.b, b: swapped.a };",
      "  poke($0443, swapped.a[0]); poke($0444, swapped.a[1]); poke($0445, swapped.a[2]);",
      "  poke($0446, swapped.b[0]); poke($0447, swapped.b[1]); poke($0448, swapped.b[2]);",
      "  poke($0449, fillAndRead(large));",
      "}",
    ]);
    try {
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
      if (result.kind !== "success") throw new Error("Nested aggregate build failed");
      const labels = await readFile(join(result.generation.directory, ".labels"), "utf8");
      const returnLabel = `b65_${Buffer.from("startup.restore").toString("hex")}`;
      const returnMatch = labels.match(
        new RegExp(`^\\s*${returnLabel}\\s*=\\s*\\$([0-9a-f]+)`, "imu"),
      );
      expect(returnMatch).not.toBeNull();
      const returnAddress = Number.parseInt(returnMatch?.[1] ?? "", 16);
      const started = await startVice(
        join(result.generation.directory, result.generation.primaryArtifact),
      );
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      try {
        const checkpoint = await started.monitor.setExecuteCheckpoint(returnAddress);
        try {
          const stopped = started.monitor.waitForStop(20_000);
          await started.monitor.resume();
          expect(await stopped).toBe(returnAddress);
          expect([...(await started.monitor.readMemory(0x0440, 0x0449))]).toEqual([
            1, 2, 3, 4, 5, 6, 1, 2, 3, 7,
          ]);
        } finally {
          await started.monitor.deleteCheckpoint(checkpoint);
        }
      } finally {
        await stopVice({ child: started.child, monitor: started.monitor });
      }
    } finally {
      await rm(root, { recursive: true });
    }
  }, 60_000);

  it("should allocate no bytes for a zero-length local array", async () => {
    const { root, result } = await buildSource("empty-local", [
      "module Game;",
      "function makeEmpty(): byte[0] { return []; }",
      "function countEmpty(input: const byte[0]): word { return length(input); }",
      "function main(): void {",
      "  let empty: byte[0] = [];",
      "  poke($0440, byte(length(empty)));",
      "  poke($0441, byte(countEmpty(makeEmpty())));",
      "}",
    ]);
    try {
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
    } finally {
      await rm(root, { recursive: true });
    }
  }, 60_000);
});
