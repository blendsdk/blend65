import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { ChildProcess } from "node:child_process";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeTool } from "../../test-support/fake-tool.js";
import { buildProject, runProject } from "../index.js";

const profiles = [
  ["c64-pal-prg-kernal-6581", "c64", "-pal", "6569", "0"],
  ["c64-pal-prg-kernal-8580", "c64", "-pal", "6569", "1"],
  ["c64-ntsc-prg-kernal-6581", "ntsc", "-ntsc", "6567", "0"],
  ["c64-ntsc-prg-kernal-8580", "ntsc", "-ntsc", "6567", "1"],
] as const;
const roots: string[] = [];

/** Create an actual compiler project with a deliberately shell-sensitive output path. */
async function fixture(target: string = profiles[3][0], mode = "complete") {
  const root = await mkdtemp(join(tmpdir(), "blend65-vice-profile-"));
  roots.push(root);
  await mkdir(join(root, "src"));
  await mkdir(join(root, "tools"));
  const project = join(root, "blend65.json");
  const out = join(root, "literal space $(exit 73); output");
  const log = join(root, "vice.jsonl");
  const marker = join(root, "running.json");
  await writeFile(join(root, "src/game.blend"), "module Game; function main(): void {}");
  await writeFile(
    project,
    JSON.stringify({
      schemaVersion: 1,
      name: "vice-profiles",
      sourceRoot: "src",
      entry: "Game",
      target,
      assetPaths: [],
      outDir: "literal space $(exit 73); output",
      optimization: "none",
    }),
  );
  const executable = join(root, "tools/x64sc");
  // The fake replaces only the external emulator; compilation and assembly stay real.
  const script = `const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const probe = args.includes("-version");
const out = ${JSON.stringify(out)};
const pins = [];
for (const id of fs.readdirSync(path.join(out, ".pins"))) {
  for (const pin of fs.readdirSync(path.join(out, ".pins", id))) pins.push([id, pin]);
}
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, pins }) + "\\n");
const mode = ${JSON.stringify(mode)};
if (probe && mode === "mutate") {
  const file = ${JSON.stringify(project)};
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  manifest.target = "c64-pal-prg-kernal-6581";
  fs.writeFileSync(file, JSON.stringify(manifest));
}
if (probe && mode === "vanish") fs.unlinkSync(__filename);
if ((probe && mode === "block-probe") || (!probe && ["block-run", "uncertain"].includes(mode))) {
  fs.writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ pid: Number(process.env.BLEND65_FAKE_TOOL_PID) || process.pid }));
  setInterval(() => {}, 1000);
} else if (probe) process.stdout.write("x64sc (VICE 3.10)\\n");
else process.exit(mode === "fail-run" ? 17 : 0);
`;
  await fakeTool(executable, script);
  vi.stubEnv("PATH", `${join(root, "tools")}${delimiter}${process.env.PATH ?? ""}`);
  return { root, project, out, log, marker };
}

/** Observe only pin filenames belonging to this isolated project's output. */
async function pinFiles(out: string): Promise<string[]> {
  const directory = join(out, ".pins");
  const result: string[] = [];
  const generations = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const generation of generations) {
    for (const pin of await readdir(join(directory, generation)))
      result.push(join(generation, pin));
  }
  return result;
}

/** Wait for a real external process to reach its bounded cancellation boundary. */
async function waitForPid(marker: string): Promise<number> {
  const deadline = performance.now() + 10_000;
  while (performance.now() < deadline) {
    try {
      const value = JSON.parse(await readFile(marker, "utf8")) as { pid: number };
      return value.pid;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  throw new Error("External VICE did not reach its cancellation boundary");
}

/** Read literal argv and pin observations produced by the external process. */
async function invocations(log: string): Promise<{ args: string[]; pins: string[][] }[]> {
  return (await readFile(log, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

/** Bound an external-process assertion so cleanup still runs when the contract fails. */
async function bounded<T>(pending: Promise<T>, milliseconds = 8_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Owned emulator outcome did not settle")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Terminate only the process identity captured from this test's fake emulator. */
function terminate(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* Already stopped. */
    }
  }
}

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
});

describe.sequential("generation-owned interactive VICE profiles", () => {
  // Every fixed identity travels with its own freshly built, pinned PRG as literal argv.
  it.each(profiles)(
    "should launch %s with exact fixed arguments and its pinned artifact",
    async (target, model, video, vic, sid) => {
      const data = await fixture(target);
      const result = await runProject({ project: data.project, optimization: "none" });
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      if (result.kind !== "success") throw new Error("Expected an interactive run");
      expect(result).toMatchObject({ status: "exited", verification: "interactive-unverified" });
      const calls = await invocations(data.log);
      expect(calls).toHaveLength(2);
      expect(calls[0]!.args).toEqual(["-version"]);
      expect(calls[1]!.args).toEqual([
        "-default",
        "-model",
        model,
        video,
        "-VICIImodel",
        vic,
        "-sidmodel",
        sid,
        "-ciamodel",
        "0",
        "-autostart",
        join(result.generation.directory, result.generation.primaryArtifact),
      ]);
      for (const call of calls) {
        expect(call.pins).toHaveLength(1);
        expect(call.pins[0]![0]).toBe(result.generation.generationId);
        expect(call.pins[0]![1]).toMatch(/\.pin$/u);
      }
      expect(await pinFiles(data.out)).toEqual([]);
    },
    30_000,
  );

  // Editing a manifest after the build cannot relabel the generation already pinned for launch.
  it("should retain the fresh NTSC 8580 identity when the manifest changes during the probe", async () => {
    const data = await fixture(profiles[3][0], "mutate");
    const result = await runProject({ project: data.project, optimization: "none" });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    if (result.kind !== "success") throw new Error("Expected an interactive run");
    expect(JSON.parse(await readFile(data.project, "utf8")).target).toBe(profiles[0][0]);
    expect((await invocations(data.log))[1]!.args).toEqual([
      "-default",
      "-model",
      "ntsc",
      "-ntsc",
      "-VICIImodel",
      "6567",
      "-sidmodel",
      "1",
      "-ciamodel",
      "0",
      "-autostart",
      join(result.generation.directory, result.generation.primaryArtifact),
    ]);
    const evidence = JSON.parse(
      await readFile(join(result.generation.directory, ".build.json"), "utf8"),
    );
    expect(evidence.semanticInputs.target.profileId).toBe(profiles[3][0]);
    expect(await pinFiles(data.out)).toEqual([]);
  }, 30_000);

  // Invalid fresh source cannot cause an older, otherwise valid generation to run.
  it("should launch nothing when a fresh build fails after a real successful generation", async () => {
    const data = await fixture();
    const old = await buildProject({ project: data.project, optimization: "none" });
    expect(old.kind, JSON.stringify(old.diagnostics)).toBe("success");
    if (old.kind !== "success") throw new Error("Expected an initial real generation");
    const prg = join(old.generation.directory, old.generation.primaryArtifact);
    const before = await readFile(prg);
    await writeFile(
      join(data.root, "src/game.blend"),
      "module Game; function main(): void { absent(); }",
    );
    expect(await runProject({ project: data.project })).toMatchObject({
      kind: "failure",
      category: "source",
    });
    await expect(access(data.log)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(prg)).toEqual(before);
  }, 30_000);

  // Both version probing and interactive execution preserve cancellation and release stopped work.
  it.each(["block-probe", "block-run"])(
    "should cancel %s and release its generation pin",
    async (mode) => {
      const data = await fixture(profiles[3][0], mode);
      const controller = new AbortController();
      const pending = runProject({ project: data.project, signal: controller.signal });
      const pid = await waitForPid(data.marker);
      try {
        expect(await pinFiles(data.out)).toHaveLength(1);
        controller.abort();
        expect(await bounded(pending)).toMatchObject({ kind: "failure", category: "cancelled" });
        expect(() => process.kill(pid, 0)).toThrow();
        expect(await pinFiles(data.out)).toEqual([]);
      } finally {
        controller.abort();
        terminate(pid);
        await bounded(pending);
      }
    },
    30_000,
  );

  // Launch failure and an emulator's nonzero exit remain distinct, unverified outcomes.
  it.each(
    [
      ["vanish", "emulator-start"],
      ["fail-run", "emulator-runtime"],
    ].filter(([mode]) => process.platform !== "win32" || mode !== "vanish"),
  )(
    "should classify %s as %s and release its generation pin",
    async (mode, category) => {
      const data = await fixture(profiles[3][0], mode);
      expect(await runProject({ project: data.project })).toMatchObject({
        kind: "failure",
        category,
      });
      expect(await pinFiles(data.out)).toEqual([]);
    },
    30_000,
  );

  // Uncertain external process cleanup must retain the artifact pin for manual recovery.
  it("should retain the generation pin when cancellation cannot prove the emulator stopped", async () => {
    const data = await fixture(profiles[3][0], "uncertain");
    const controller = new AbortController();
    const pending = runProject({ project: data.project, signal: controller.signal });
    const pid = await waitForPid(data.marker);
    const before = await pinFiles(data.out);
    expect(before).toHaveLength(1);
    const realKill = process.kill.bind(process);
    const realChildKill = ChildProcess.prototype.kill;
    const kill =
      process.platform === "win32"
        ? vi.spyOn(ChildProcess.prototype, "kill").mockImplementation(function (
            this: ChildProcess,
            signal,
          ) {
            if (this.pid === pid)
              throw Object.assign(new Error("Owned process access denied"), { code: "EPERM" });
            return realChildKill.call(this, signal);
          })
        : vi.spyOn(process, "kill").mockImplementation((candidate, signal) => {
            if (Math.abs(candidate) === pid)
              throw Object.assign(new Error("Owned process access denied"), { code: "EPERM" });
            return realKill(candidate, signal);
          });
    try {
      controller.abort();
      expect(await bounded(pending)).toMatchObject({
        kind: "failure",
        category: "recovery-required",
      });
      expect(await pinFiles(data.out)).toEqual(before);
    } finally {
      kill.mockRestore();
      terminate(pid);
      await bounded(pending);
    }
  }, 30_000);
});
