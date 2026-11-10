import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
  "struct Guard { data: byte[4]; canary: byte[2]; }",
  "let guard: Guard = { data: [0, 0, 0, 0], canary: [170, 187] };",
  "let ok: byte = 0;",
  "function main(): void {",
  "  if (c64.loader.load(DATA, guard.data)) {",
  "    ok = 1;",
  "    guard.canary[0] = 76;",
  "  } else {",
  "    ok = 2;",
  "  }",
  "}",
  "",
].join("\n");

/** One fixture set: the exact images and symbol addresses used by the runtime cases. */
interface RuntimeFixture {
  readonly directory: string;
  readonly target: number;
  readonly canary: number;
  readonly ok: number;
}

/** Build the success, missing-file, and longer-replacement images once. */
async function prepareFixture(): Promise<RuntimeFixture> {
  const existing = process.env.RD07_RUNTIME_DIR;
  const root = existing ?? (await mkdtemp(join(tmpdir(), "blend65-rd07-runtime-")));
  let generation = existing;
  if (generation === undefined) {
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src/game.blend"), SOURCE);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "runtime",
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
    generation = built.generation.directory;
  }
  if (generation === undefined) throw new Error("Runtime fixture generation is unavailable");
  const directory = generation;
  const labels = await readFile(join(directory, ".labels"), "utf8");
  const addressOf = (suffix: string): number => {
    const line = labels.split("\n").find((candidate) => candidate.includes(`b65_Game_${suffix}_`));
    if (line === undefined) throw new Error(`Missing ${suffix} label`);
    return Number.parseInt(/=\s*\$([0-9a-f]+)/iu.exec(line)![1]!, 16);
  };
  const guard = addressOf("guard");
  return {
    directory,
    target: guard,
    canary: guard + 4,
    ok: addressOf("ok"),
  };
}

/** Run one image for a bounded time and read the observed symbols. */
async function observe(
  imagePath: string,
  fixture: RuntimeFixture,
  waitMilliseconds: number,
): Promise<{
  readonly target: readonly number[];
  readonly canary: readonly number[];
  readonly ok: number;
  readonly pc: number;
}> {
  const identity = await viceRuntimeIdentity();
  if (identity === null) throw new Error("Pinned VICE 3.10 runtime is unavailable");
  const port = await viceLoopbackPort();
  const roms = identity.roms.flatMap((rom, index) => [
    ["-kernal", "-basic", "-chargen"][index]!,
    rom.path,
  ]);
  const child = spawn(
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
      imagePath,
    ],
    { detached: true, stdio: "ignore" },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    await new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
    const monitor = await openViceMonitor(port, child.pid!);
    try {
      const base = Math.min(fixture.target, fixture.canary, fixture.ok);
      const end = Math.max(fixture.target + 3, fixture.canary + 1, fixture.ok);
      const memory = await monitor.readMemory(base, end);
      const read = (address: number, length: number): readonly number[] => [
        ...memory.subarray(address - base, address - base + length),
      ];
      const registers = await monitor.readCpuRegisters();
      return {
        target: read(fixture.target, 4),
        canary: read(fixture.canary, 2),
        ok: read(fixture.ok, 1)[0]!,
        pc: registers.pc,
      };
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
}

// The emulator child cannot open test-created files inside the agent sandbox. Run this suite
// outside that sandbox with RD07_VICE=1; `RD07_RUNTIME_DIR` can point at prebuilt images.
describe.skipIf(process.env.RD07_VICE !== "1")("D64 loader runtime", () => {
  // The successful load publishes exactly the packaged bytes and does not touch the canary.
  it("should load the unit bytes and preserve the canary", async () => {
    const fixture = await prepareFixture();
    const observed = await observe(join(fixture.directory, "runtime.d64"), fixture, 3_500);
    expect(observed.target).toEqual([1, 2, 3, 4]);
    expect(observed.canary).toEqual([76, 187]);
    expect(observed.ok).toBe(1);
  }, 120_000);

  // A missing directory entry returns false and leaves the false path in control.
  it("should report a missing unit without running the success path", async () => {
    const fixture = await prepareFixture();
    const observed = await observe(join(fixture.directory, "runtime-missing.d64"), fixture, 8_000);
    expect(observed.ok).toBe(2);
    expect(observed.canary).toEqual([170, 187]);
  }, 120_000);

  // The stock KERNAL has no length bound: a longer readable file overwrites past the
  // destination, the canary changes, and the wrapper still reports false (HLE-010).
  it("should show the bounded-media overwrite before returning false", async () => {
    const fixture = await prepareFixture();
    const observed = await observe(join(fixture.directory, "runtime-longer.d64"), fixture, 8_000);
    expect(observed.ok).toBe(2);
    // The readable longer file changed the canary before the wrapper returned false.
    expect(observed.canary[0]).not.toBe(170);
  }, 120_000);

  // After main returns, the cooperative startup restores the machine and returns to BASIC.
  it("should return to the BASIC ROM after the program ends", async () => {
    const fixture = await prepareFixture();
    const observed = await observe(join(fixture.directory, "runtime.d64"), fixture, 4_000);
    expect(observed.pc).toBeGreaterThanOrEqual(0xa000);
  }, 120_000);
});
