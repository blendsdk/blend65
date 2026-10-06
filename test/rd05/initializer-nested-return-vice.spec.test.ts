import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { readProfileArtifacts, withProfileProject } from "./profile-fixture.js";

const targets = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

const source = `module Game;
let first: byte = peek($c010);
let out: byte = choose(first, inner(7));
function inner(x: byte): byte { return x; }
function choose(a: byte, b: byte): byte { return b; }
export function main(): void { poke($c016, out); }
`;

function startupAddress(labels: string, name: "startup.entry" | "startup.restore"): number {
  const suffix = Buffer.from(name, "utf8").toString("hex");
  const matches = labels.split(/\r?\n/u).flatMap((line) => {
    const match = /^\s*([^\s=]+)\s*=\s*\$([0-9a-f]+)\b/iu.exec(line);
    return match !== null && match[1]!.toLowerCase().endsWith(suffix)
      ? [Number.parseInt(match[2]!, 16)]
      : [];
  });
  expect(matches, `One emitted ${name} label`).toHaveLength(1);
  const address = matches[0]!;
  expect(Number.isInteger(address) && address >= 0 && address <= 0xffff).toBe(true);
  return address;
}

describe.sequential("initializer nested return values in VICE", () => {
  for (const target of targets) {
    it(`preserves the nested second argument on ${target}`, async () => {
      await withProfileProject(source, target, async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected a successful public build");
        const artifacts = await readProfileArtifacts(built);
        const entry = startupAddress(artifacts.labels, "startup.entry");
        const restore = startupAddress(artifacts.labels, "startup.restore");
        expect(entry).not.toBe(restore);
        const runtime = await startVice(
          join(built.generation.directory, built.generation.primaryArtifact),
          100_000_000,
          target,
          false,
          false,
        );
        if ("kind" in runtime) throw new Error(runtime.reason);
        try {
          const monitor = runtime.monitor;
          const entryCheckpoint = await monitor.setExecuteCheckpoint(entry);
          const entryStop = monitor.waitForStop();
          await monitor.resume();
          expect(await entryStop).toBe(entry);
          await monitor.deleteCheckpoint(entryCheckpoint);
          // Seed only source-visible data before normal initializer execution.
          await monitor.writeMemory(0xc010, Uint8Array.of(0x11));
          await monitor.writeMemory(0xc016, Uint8Array.of(0xee));
          const restoreCheckpoint = await monitor.setExecuteCheckpoint(restore);
          const restoreStop = monitor.waitForStop();
          await monitor.resume();
          expect(await restoreStop).toBe(restore);
          expect([...(await monitor.readMemory(0xc016, 0xc016))]).toEqual([7]);
          await monitor.deleteCheckpoint(restoreCheckpoint);
        } finally {
          await stopVice(runtime);
        }
      });
    }, 180_000);
  }
});
