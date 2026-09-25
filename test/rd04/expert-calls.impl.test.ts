import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

const expert = JSON.parse(
  await readFile(fileURLToPath(new URL("./expert/calls.json", import.meta.url)), "utf8"),
) as {
  twoTargetVoidCall: {
    bytes: number;
    maxCycles: number;
    dispatchScratchBytes: number;
    hardwareStackBytes: number;
  };
  twoTargetScalarCall: {
    bytes: number;
    maxCycles: number;
    dispatchScratchBytes: number;
    hardwareStackBytes: number;
  };
};

/** Compare only the call dispatch with an equally prepared expert target word. */
describe("expert finite-call output", () => {
  it("uses a page-safe indirect jump with no extra pointer or runtime registry", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-expert-calls-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "expert-calls",
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
          "struct Box { cb: fn(): void; }",
          "function first(): void { poke($0420, 1); poke($0425, 1); }",
          "function second(): void { poke($0421, 2); poke($0425, 2); }",
          "function invoke(target: fn(): void): void { target(); }",
          "function mutate(box: Box): void { box.cb = &second; }",
          "function firstByte(): byte { return 7; }",
          "function secondByte(): byte { return 9; }",
          "function invokeByte(target: fn(): byte): byte { return target(); }",
          "function firstWord(): word { return $1234; }",
          "function secondWord(): word { return $5678; }",
          "function invokeWord(target: fn(): word): word { return target(); }",
          "function main(): void {",
          "  poke($0440, 0);",
          "  invoke(peek($0440) == 0 ? &first : &second);",
          "  poke($0422, invokeByte(peek($0440) == 0 ? &firstByte : &secondByte));",
          "  let wordFirst: word = invokeWord(peek($0440) == 0 ? &firstWord : &secondWord);",
          "  poke($0423, lo(wordFirst)); poke($0424, hi(wordFirst));",
          "  poke($0440, 1);",
          "  invoke(peek($0440) == 0 ? &first : &second);",
          "  poke($0426, invokeByte(peek($0440) == 0 ? &firstByte : &secondByte));",
          "  let wordSecond: word = invokeWord(peek($0440) == 0 ? &firstWord : &secondWord);",
          "  poke($0427, lo(wordSecond)); poke($0428, hi(wordSecond));",
          "  let box: Box = {cb: &first}; mutate(box); box.cb();",
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
      if (built.kind !== "success") throw new Error("Expert call fixture did not build");
      const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
      const thunkCalls = [...assembly.matchAll(/^\s*jsr\+2\s+(b65_[a-f0-9]+)\s*$/gimu)];
      const thunks = thunkCalls.filter(([, label]) =>
        new RegExp(`^${label}:\\s*\\n\\s*jmp\\+2\\s+\\(\\$[0-9a-f]{4}\\)`, "imu").test(assembly),
      );
      const thunk = thunks[0];
      expect(thunk).toBeDefined();
      expect(thunks.length).toBeGreaterThanOrEqual(3);
      const body = assembly.match(
        new RegExp(`^${thunk?.[1]}:\\s*\\n\\s*jmp\\+2\\s+\\(\\$([0-9a-f]{4})\\)`, "imu"),
      );
      expect(body).not.toBeNull();
      const pointer = Number.parseInt(body?.[1] ?? "", 16);
      expect(pointer & 0xff).not.toBe(0xff);
      expect(3 + 3).toBeLessThanOrEqual(expert.twoTargetVoidCall.bytes);
      expect(6 + 5).toBeLessThanOrEqual(expert.twoTargetVoidCall.maxCycles);
      expect(expert.twoTargetVoidCall.dispatchScratchBytes).toBe(0);
      expect(expert.twoTargetVoidCall.hardwareStackBytes).toBe(2);
      expect(3 + 3).toBeLessThanOrEqual(expert.twoTargetScalarCall.bytes);
      expect(6 + 5).toBeLessThanOrEqual(expert.twoTargetScalarCall.maxCycles);
      expect(expert.twoTargetScalarCall.dispatchScratchBytes).toBe(0);
      expect(expert.twoTargetScalarCall.hardwareStackBytes).toBe(2);
      const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
      const restore = `b65_${Buffer.from("startup.restore").toString("hex")}`;
      const restoreMatch = labels.match(
        new RegExp(`^\\s*${restore}\\s*=\\s*\\$([0-9a-f]+)`, "imu"),
      );
      expect(restoreMatch).not.toBeNull();
      const restoreAddress = Number.parseInt(restoreMatch?.[1] ?? "", 16);
      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      try {
        const checkpoint = await started.monitor.setExecuteCheckpoint(restoreAddress);
        try {
          const stopped = started.monitor.waitForStop(20_000);
          await started.monitor.resume();
          expect(await stopped).toBe(restoreAddress);
          expect([...(await started.monitor.readMemory(0x0420, 0x0428))]).toEqual([
            1, 2, 7, 0x34, 0x12, 2, 9, 0x78, 0x56,
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
  });
});
