import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Exercise a successful indexed read and the selected inline failure stop on the target CPU. */
describe.sequential("checked aggregate ordinals", () => {
  it("keeps valid work and stops before an out-of-range read", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-bounds-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "checked-bounds",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
          boundsCheck: true,
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          "struct Pair { flag: byte; value: word; }",
          "let data: byte[4] = [1, 2, 3, 4];",
          "let grid: byte[2][3] = [[10, 11, 12], [20, 21, 22]];",
          "let pairs: Pair[2];",
          "function main(): void {",
          "  poke($0402, 3);",
          "  let index: byte = peek($0402);",
          "  let local: byte[4] = [7, 8, 9, 10];",
          "  poke($0400, data[index]);",
          "  poke($0408, local[index]);",
          "  poke($0404, 1); poke($0405, 2);",
          "  let row: word = word(peek($0404));",
          "  let column: word = word(peek($0405));",
          "  poke($0403, grid[row][column]);",
          "  pairs[row].value = 513;",
          "  poke($0406, byte(pairs[row].value));",
          "  poke($0401, 99);",
          "  poke($0402, 5);",
          "  index = peek($0402);",
          "  poke($0401, data[index]);",
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
      if (built.kind !== "success") throw new Error("Checked array build did not succeed");
      const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
      const stopAddress = labels
        .split("\n")
        .map((line) => line.match(/^\s*(b65_([0-9a-f]+))\s*=\s*\$([0-9a-f]+)/iu))
        .filter((match) => match !== null)
        .map((match) => ({
          id: Buffer.from(match[2]!, "hex").toString("utf8"),
          address: Number.parseInt(match[3]!, 16),
        }))
        .find(({ id }) => id.endsWith(".bounds.stop"))?.address;
      expect(stopAddress).toBeDefined();
      if (stopAddress === undefined) throw new Error("Checked build has no safety stop");
      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      try {
        const checkpoint = await started.monitor.setExecuteCheckpoint(stopAddress);
        try {
          const stopped = started.monitor.waitForStop(20_000);
          await started.monitor.resume();
          expect(await stopped).toBe(stopAddress);
          expect([...(await started.monitor.readMemory(0x0400, 0x0403))]).toEqual([4, 99, 5, 22]);
          expect([...(await started.monitor.readMemory(0x0406, 0x0406))]).toEqual([1]);
          expect([...(await started.monitor.readMemory(0x0408, 0x0408))]).toEqual([10]);
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

  it("wraps an unchecked word ordinal in the 16-bit address domain", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-address-wrap-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "address-wrap",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
          boundsCheck: false,
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        "module Game; place(at: $BFFF) let data: byte[1]; function main(): void { poke($0402, 0); let index: word = word(peek($0402)) + $4001; pokew($0420, &data[index]); }",
      );
      const built = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Unchecked address-wrap build did not succeed");
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
          expect([...(await started.monitor.readMemory(0x0420, 0x0421))]).toEqual([0, 0]);
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

  it("checks a borrowed array against its full caller-supplied word count", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-borrowed-bounds-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "borrowed-bounds",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
          boundsCheck: true,
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          "function read(data: const byte[], index: word): byte { return data[index]; }",
          "function main(): void {",
          "  let data: byte[300] = [; 0];",
          "  data[299] = 55;",
          "  let valid: word = 299;",
          "  poke($0400, read(data, valid));",
          "  poke($0401, 77);",
          "  let invalid: word = 300;",
          "  poke($0401, read(data, invalid));",
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
      if (built.kind !== "success") throw new Error("Borrowed array build did not succeed");
      const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
      const stopAddress = labels
        .split("\n")
        .map((line) => line.match(/^\s*(b65_([0-9a-f]+))\s*=\s*\$([0-9a-f]+)/iu))
        .filter((match) => match !== null)
        .map((match) => ({
          id: Buffer.from(match[2]!, "hex").toString("utf8"),
          address: Number.parseInt(match[3]!, 16),
        }))
        .find(({ id }) => id.endsWith(".bounds.stop"))?.address;
      expect(stopAddress).toBeDefined();
      if (stopAddress === undefined) throw new Error("Borrowed array has no safety stop");
      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      try {
        const checkpoint = await started.monitor.setExecuteCheckpoint(stopAddress);
        try {
          const stopped = started.monitor.waitForStop(20_000);
          await started.monitor.resume();
          expect(await stopped).toBe(stopAddress);
          expect([...(await started.monitor.readMemory(0x0400, 0x0401))]).toEqual([55, 77]);
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
