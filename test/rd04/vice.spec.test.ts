import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";

/** Find one public assembly label by its emitted name. */
function labelAddress(labels: string, name: string): number {
  const encoded = `b65_${Buffer.from(name).toString("hex")}`;
  const matches = [
    ...labels.matchAll(new RegExp(`^\\s*${encoded}\\s*=\\s*\\$([0-9a-f]+)`, "gimu")),
  ];
  expect(matches, `Expected one ${name} label`).toHaveLength(1);
  return Number.parseInt(matches[0]![1]!, 16);
}

/** Continue to the next execution checkpoint. */
async function resumeToStop(monitor: ViceMonitor): Promise<number> {
  const stopped = monitor.waitForStop(20_000);
  await monitor.resume();
  return stopped;
}

describe.sequential("real C64 IRQ installation and restoration", () => {
  it("chains each installed layer once and restores the original vector and stack", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-irq-vice-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "irq-vice",
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
          "import { setIRQ, restoreIRQ } from c64.system;",
          "interrupt function onIRQ(): void { poke($0421, peek($0421) + 1); }",
          "function waitForCount(goal: byte): void {",
          "  for (let spin: word = 0; spin < 50000; spin += 1) {",
          "    if (peek($0421) >= goal) { return; }",
          "  }",
          "}",
          "function installTwice(): void {",
          "  poke($0420, 255);",
          "  setIRQ(&onIRQ);",
          "  poke($0424, peek($0314)); poke($0425, peek($0315));",
          "  poke($0420, 1);",
          "  waitForCount(2);",
          "  poke($0420, 255);",
          "  setIRQ(&onIRQ);",
          "  poke($0426, peek($0314)); poke($0427, peek($0315));",
          "  poke($0420, 2);",
          "  waitForCount(6);",
          "}",
          "function main(): void {",
          "  poke($0420, 0); poke($0421, 0);",
          "  poke($0422, peek($0314)); poke($0423, peek($0315));",
          "  installTwice();",
          "  poke($0420, 255);",
          "  restoreIRQ();",
          "  poke($0428, peek($0314)); poke($0429, peek($0315));",
          "  poke($0420, 3);",
          "  waitForCount(8);",
          "  poke($0420, 255);",
          "  restoreIRQ();",
          "  poke($042A, peek($0314)); poke($042B, peek($0315));",
          "  poke($0420, 4);",
          "  for (let spin: word = 0; spin < 50000; spin += 1) {}",
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
      if (built.kind !== "success") throw new Error("IRQ runtime build did not succeed");

      const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
      const entry = labelAddress(labels, "startup.entry");
      const restore = labelAddress(labels, "startup.restore");
      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      const monitor = started.monitor;
      const checkpoints: number[] = [];
      try {
        checkpoints.push(await monitor.setExecuteCheckpoint(entry));
        expect(await resumeToStop(monitor)).toBe(entry);
        const beforeCpu = await monitor.readCpuRegisters();
        const original = [...(await monitor.readMemory(0x0314, 0x0315))];
        await monitor.writeMemory(0x0420, new Uint8Array(12));
        const low = (
          await monitor.readMemory(
            0x0100 + ((beforeCpu.sp + 1) & 0xff),
            0x0100 + ((beforeCpu.sp + 1) & 0xff),
          )
        )[0]!;
        const high = (
          await monitor.readMemory(
            0x0100 + ((beforeCpu.sp + 2) & 0xff),
            0x0100 + ((beforeCpu.sp + 2) & 0xff),
          )
        )[0]!;
        const callerReturn = ((low | (high << 8)) + 1) & 0xffff;
        const previousHandler = original[0]! | (original[1]! << 8);
        checkpoints.push(await monitor.setExecuteCheckpoint(previousHandler));
        checkpoints.push(await monitor.setExecuteCheckpoint(restore));
        checkpoints.push(await monitor.setExecuteCheckpoint(callerReturn));

        const observedPhases = new Set<number>();
        let previousCount = 0;
        let restoring = false;
        let returned = false;
        for (let stop = 0; stop < 256; stop += 1) {
          const address = await resumeToStop(monitor);
          if (address === restore) {
            restoring = true;
            expect([...(await monitor.readMemory(0x0314, 0x0315))]).toEqual(original);
            continue;
          }
          if (address === callerReturn) {
            returned = true;
            break;
          }
          expect(address).toBe(previousHandler);
          const [phase, count] = await monitor.readMemory(0x0420, 0x0421);
          if (phase === 0 || phase === 255) {
            previousCount = count!;
            continue;
          }
          expect(phase).toBeGreaterThanOrEqual(1);
          expect(phase).toBeLessThanOrEqual(4);
          expect((count! - previousCount + 256) & 0xff).toBe([0, 1, 2, 1, 0][phase]);
          previousCount = count!;
          observedPhases.add(phase!);
        }
        expect(restoring).toBe(true);
        expect(returned).toBe(true);
        expect([...observedPhases].sort()).toEqual([1, 2, 3, 4]);
        const bytes = [...(await monitor.readMemory(0x0422, 0x042b))];
        expect(bytes.slice(0, 2)).toEqual(original);
        expect(bytes.slice(2, 4)).not.toEqual(original);
        expect(bytes.slice(4, 6)).not.toEqual(original);
        expect(bytes.slice(4, 6)).not.toEqual(bytes.slice(2, 4));
        expect(bytes.slice(6, 8)).toEqual(bytes.slice(2, 4));
        expect(bytes.slice(8, 10)).toEqual(original);
        expect([...(await monitor.readMemory(0x0314, 0x0315))]).toEqual(original);
        expect((await monitor.readCpuRegisters()).sp).toBe((beforeCpu.sp + 2) & 0xff);
      } finally {
        try {
          for (const checkpoint of checkpoints) await monitor.deleteCheckpoint(checkpoint);
        } finally {
          await stopVice({ child: started.child, monitor });
        }
      }
    } finally {
      await rm(root, { recursive: true });
    }
  }, 90_000);
});
