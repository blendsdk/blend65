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
      "struct LargeHolder { inner: byte[300]; tail: byte; }",
      "struct EffectHolder { inner: byte[3]; tag: byte; }",
      "struct LargeSwap { a: byte[300]; b: byte[300]; }",
      "let source: byte[3] = [1, 2, 3];",
      "let effectSource: byte[3] = [1, 2, 3];",
      "let assignedSource: byte[3] = [1, 2, 3];",
      "let assignedTarget: byte[3] = [; 0];",
      "let largeSource: byte[300] = [; 0];",
      "let largeTarget: LargeHolder;",
      "let largeSwap: LargeSwap = { a: [; 0], b: [; 0] };",
      "let swapped: Swap = { a: [1, 2, 3], b: [4, 5, 6] };",
      "let large: byte[1024] = [; 0];",
      "function first(input: const byte[1024]): byte { return input[0]; }",
      "function fillAndRead(output: byte[1024]): byte { return first(output = [; 7]); }",
      "function firstLarge(input: const LargeHolder): byte { return input.inner[0]; }",
      "function buildAndRead(output: LargeHolder): byte { return firstLarge(output = { inner: largeSource, tail: 1 }); }",
      "function changeSource(): byte { effectSource[0] = 9; return 0; }",
      "function changeLargeSource(): byte { largeSource[0] = 9; return 0; }",
      "function changeAssignedTarget(): byte { assignedTarget[0] = 9; return 0; }",
      "function main(): void {",
      "  let value: Holder = { inner: source };",
      "  poke($0440, value.inner[0]);",
      "  poke($0441, value.inner[1]);",
      "  poke($0442, value.inner[2]);",
      "  swapped = { a: swapped.b, b: swapped.a };",
      "  poke($0443, swapped.a[0]); poke($0444, swapped.a[1]); poke($0445, swapped.a[2]);",
      "  poke($0446, swapped.b[0]); poke($0447, swapped.b[1]); poke($0448, swapped.b[2]);",
      "  poke($0449, fillAndRead(large));",
      "  largeSource[0] = 1; largeSource[255] = 2; largeSource[256] = 3; largeSource[299] = 4;",
      "  poke($044a, buildAndRead(largeTarget));",
      "  let ordered: EffectHolder = { inner: effectSource, tag: changeSource() };",
      "  poke($044b, ordered.inner[0]);",
      "  poke($044c, effectSource[0]);",
      "  largeSwap.a[0] = 11; largeSwap.a[299] = 12;",
      "  largeSwap.b[0] = 21; largeSwap.b[299] = 22;",
      "  largeSwap = { a: largeSwap.b, b: largeSwap.a };",
      "  poke($044d, largeSwap.a[0]); poke($044e, largeSwap.a[299]);",
      "  poke($044f, largeSwap.b[0]); poke($0450, largeSwap.b[299]);",
      "  let orderedLarge: LargeHolder = { inner: largeSource, tail: changeLargeSource() };",
      "  poke($0451, orderedLarge.inner[0]); poke($0452, largeSource[0]);",
      "  let orderedAssignment: EffectHolder = { inner: assignedTarget = assignedSource, tag: changeAssignedTarget() };",
      "  poke($0453, orderedAssignment.inner[0]); poke($0454, assignedTarget[0]);",
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
          expect([...(await started.monitor.readMemory(0x0440, 0x0454))]).toEqual([
            1, 2, 3, 4, 5, 6, 1, 2, 3, 7, 1, 1, 9, 21, 22, 11, 12, 1, 9, 1, 9,
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
