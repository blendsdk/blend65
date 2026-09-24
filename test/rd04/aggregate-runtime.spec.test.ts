import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

describe.sequential("aggregate and encoded-data runtime behavior", () => {
  // Element ordinals, row strides, narrow barriers, and literal maps must survive code generation.
  it("should execute nested array indexes and emit the selected character bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-aggregate-runtime-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "aggregate-runtime",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          'const TEXT: byte[] = "AZ0 £↑←";',
          'const LOWER: byte[] = screen_codes("Az", "lower_upper");',
          'const PET: byte[] = petscii("A");',
          'const PADDED: byte[5] = ["HI"; 0];',
          "let grid: word[2][3] = [[100, 200, 300], [400, 500, 600]];",
          "let values: byte[500] = [; 0];",
          "function main(): void {",
          "  let index: byte = 255;",
          "  values[index + 10] = 77;",
          "  values[byte(index + 10)] = 33;",
          "  poke($0420, byte(grid[1][2]));",
          "  poke($0421, byte(grid[0][1]));",
          "  poke($0422, values[265]);",
          "  poke($0423, values[9]);",
          "  poke($0424, byte(length(grid)));",
          "  poke($0425, byte(length(grid[0])));",
          "  poke($0426, TEXT[0]); poke($0427, TEXT[1]); poke($0428, TEXT[2]);",
          "  poke($0429, TEXT[3]); poke($042A, TEXT[4]); poke($042B, TEXT[5]);",
          "  poke($042C, TEXT[6]); poke($042D, LOWER[0]); poke($042E, LOWER[1]);",
          "  poke($042F, PET[0]); poke($0430, byte(length(TEXT)));",
          "  let character: byte = 'A'; poke($0431, character);",
          "  poke($0432, PADDED[0]); poke($0433, PADDED[1]);",
          "  poke($0434, PADDED[2]); poke($0435, PADDED[3]); poke($0436, PADDED[4]);",
          "  poke($0437, byte(length(PADDED)));",
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
      if (built.kind !== "success") throw new Error("Aggregate runtime build did not succeed");
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
          expect([...(await started.monitor.readMemory(0x0420, 0x0437))]).toEqual([
            88, 200, 77, 33, 2, 3, 1, 26, 48, 32, 28, 30, 31, 65, 26, 65, 7, 1, 8, 9, 0, 0, 0, 5,
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
});
