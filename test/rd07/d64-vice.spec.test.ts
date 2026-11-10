import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { openViceMonitor } from "../m1/vice-monitor.js";
import { viceLoopbackPort, viceRuntimeIdentity } from "../m1/vice-runtime.js";

const SOURCE = [
  "module Game;",
  "",
  "loadable const DATA: byte[4] = [1, 2, 3, 4];",
  "let target: byte[4];",
  "function main(): void { if (!c64.loader.load(DATA, target)) { return; } }",
  "",
].join("\n");

/** Build one real D64 and run its first entry under a bounded VICE process. */
async function withViceRuntime<T>(
  inspect: (input: {
    readonly d64Path: string;
    readonly target: number;
    readonly monitorPort: number;
    readonly spawn: () => ReturnType<typeof spawn>;
  }) => Promise<T>,
): Promise<T> {
  const root = join(process.env.CODEOPS_TMPDIR ?? "/tmp/opencode", "rd07-vice-runtime");
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  try {
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src/game.blend"), SOURCE);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "rd07vice",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-d64-kernal-6581",
        assetPaths: [],
        outDir: "out",
        optimization: "none",
      }),
    );
    const built = await buildProject({ project: join(root, "blend65.json") });
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
    const line = labels.split("\n").find((candidate) => candidate.includes("b65_Game_target_"));
    if (line === undefined) throw new Error("Missing Game.target label");
    const match = /=\s*\$([0-9a-f]+)/iu.exec(line);
    if (match === null) throw new Error(`Malformed target label: ${line}`);
    const identity = await viceRuntimeIdentity();
    if (identity === null) {
      throw new Error("Pinned VICE 3.10 runtime is unavailable");
    }
    const port = await viceLoopbackPort();
    const d64Path = join(built.generation.directory, built.generation.primaryArtifact);
    return inspect({
      d64Path,
      target: Number.parseInt(match[1]!, 16),
      monitorPort: port,
      spawn: () => {
        const roms = identity.roms.flatMap((rom, index) => [
          ["-kernal", "-basic", "-chargen"][index]!,
          rom.path,
        ]);
        return spawn(
          identity.executable,
          [
            "-default",
            "-model",
            "c64",
            "-pal",
            "-VICIImodel",
            "6569",
            "-sidmodel",
            "0",
            "-ciamodel",
            "0",
            ...roms,
            "-console",
            "+sound",
            "+warp",
            "-binarymonitor",
            "-binarymonitoraddress",
            `127.0.0.1:${port}`,
            "-limitcycles",
            "80000000",
            "-autostart",
            d64Path,
          ],
          { detached: true, stdio: "ignore" },
        );
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

// The emulator child is blocked from test-created paths in the agent sandbox. Run this suite
// outside that sandbox with RD07_VICE=1; the bounded manual run records the same oracle.
describe.skipIf(process.env.RD07_VICE !== "1")("D64 loader runtime", () => {
  // The KERNAL writes the exact packaged unit bytes into the final destination.
  it("should load the unit bytes into the destination", async () => {
    await withViceRuntime(async ({ target, monitorPort, spawn }) => {
      const child = spawn();
      try {
        await new Promise<void>((resolve, reject) => {
          child.once("spawn", resolve);
          child.once("error", reject);
        });
        // The autostart boot has already run the synchronous load by this point.
        await new Promise((resolve) => setTimeout(resolve, 3_000));
        const monitor = await openViceMonitor(monitorPort, child.pid!);
        try {
          const bytes = await monitor.readMemory(target, target + 3);
          expect([...bytes]).toEqual([1, 2, 3, 4]);
        } finally {
          await monitor.quit();
        }
      } finally {
        if (child.exitCode === null && child.signalCode === null) {
          try {
            process.kill(-child.pid!, "SIGKILL");
          } catch {
            child.kill("SIGKILL");
          }
        }
      }
    });
  }, 120_000);
});
