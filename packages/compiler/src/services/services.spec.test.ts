import {
  access,
  appendFile,
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import * as compiler from "../index.js";
import type {
  BuildOptions,
  BuildResult,
  CheckOptions,
  CheckResult,
  RunOptions,
  RunResult,
  ServiceMeasurements,
} from "../index.js";

const M1_PROJECT = fileURLToPath(new URL("../../../../examples/m1/", import.meta.url));
const temporaryRoots: string[] = [];

interface CompilerServices {
  readonly checkProject: (options?: CheckOptions) => Promise<CheckResult>;
  readonly buildProject: (options?: BuildOptions) => Promise<BuildResult>;
  readonly runProject: (options?: RunOptions) => Promise<RunResult>;
}

/** Resolve one public service without making a missing export fail test collection. */
function publicService<Name extends keyof CompilerServices>(name: Name): CompilerServices[Name] {
  const candidate: unknown = Reflect.get(compiler, name);
  expect(candidate, `public ${name} must exist`).toBeTypeOf("function");
  if (typeof candidate !== "function") throw new Error(`Public ${name} is missing`);
  return candidate as CompilerServices[Name];
}

/** Copy the complete milestone project so service output never changes checked-in evidence. */
async function freshM1(): Promise<string> {
  const container = await mkdtemp(join(tmpdir(), "blend65-services-spec-"));
  temporaryRoots.push(container);
  const root = join(container, "m1");
  await cp(M1_PROJECT, root, { recursive: true });
  await rm(join(root, "out"), { recursive: true, force: true });
  return root;
}

/** Install a bounded fake emulator that records every argument and exits successfully. */
async function fakeVice(container: string, log: string): Promise<string> {
  const directory = join(container, "tools");
  await mkdir(directory);
  const script = [
    "#!/usr/bin/env node",
    'const fs = require("node:fs");',
    "const log = process.env.BLEND65_SPEC_VICE_LOG;",
    'if (log) fs.appendFileSync(log, JSON.stringify(process.argv.slice(2)) + "\\n");',
    'process.stdout.write("x64sc (VICE 3.10)\\n");',
  ].join("\n");
  await writeFile(join(directory, "x64sc.cjs"), script);
  await writeFile(join(directory, "x64sc.cmd"), '@node "%~dp0\\x64sc.cjs" %*\r\n');
  await writeFile(join(directory, "x64sc"), script);
  await chmod(join(directory, "x64sc"), 0o755);
  process.env.BLEND65_SPEC_VICE_LOG = log;
  return directory;
}

/** Assert the public measurement pair without prescribing a host-specific numeric value. */
function expectMeasurements(measurements: ServiceMeasurements): void {
  for (const value of [measurements.durationMilliseconds, measurements.peakRssBytes]) {
    if (value !== "Unknown") expect(value).toBeGreaterThanOrEqual(0);
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("compiler project services", () => {
  // Checking completes every pre-layout proof and leaves the project tree unchanged.
  it("should check the milestone project without creating output or invoking tools", async () => {
    const root = await freshM1();
    const result = await publicService("checkProject")({ project: join(root, "blend65.json") });

    expect(result.kind).toBe("success");
    if (result.kind !== "success") throw new Error(`Check failed as ${result.category}`);
    expect(result.snapshotSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(result.profileId).toBe("c64-pal-prg-kernal-6581");
    expect(result.diagnostics).toEqual([]);
    expectMeasurements(result.measurements);
    await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  // Build always observes fresh inputs, and run launches the primary artifact from its own new generation.
  it("should build freshly and run the exact artifact produced by its own build", async () => {
    const root = await freshM1();
    const container = join(root, "..");
    const log = join(container, "vice-invocations.jsonl");
    const originalPath = process.env.PATH;
    const originalLog = process.env.BLEND65_SPEC_VICE_LOG;
    const toolDirectory = await fakeVice(container, log);
    process.env.PATH = `${toolDirectory}${delimiter}${originalPath ?? ""}`;
    try {
      const built = await publicService("buildProject")({ project: join(root, "blend65.json") });
      expect(built.kind).toBe("success");
      if (built.kind !== "success") throw new Error(`Build failed as ${built.category}`);
      expectMeasurements(built.measurements);
      await access(join(built.generation.directory, built.generation.primaryArtifact));

      await appendFile(join(root, "src/game.blend"), "\n");
      const ran = await publicService("runProject")({ project: join(root, "blend65.json") });
      expect(ran.kind).toBe("success");
      if (ran.kind !== "success") throw new Error(`Run failed as ${ran.category}`);
      expect(ran.generation.generationId).not.toBe(built.generation.generationId);
      expect(ran.status).toBe("exited");
      expect(ran.verification).toBe("interactive-unverified");
      expectMeasurements(ran.measurements);
      const launchedArtifact = join(ran.generation.directory, ran.generation.primaryArtifact);
      expect(await readFile(log, "utf8")).toContain(launchedArtifact);
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      if (originalLog === undefined) delete process.env.BLEND65_SPEC_VICE_LOG;
      else process.env.BLEND65_SPEC_VICE_LOG = originalLog;
    }
  });

  // Cancellation is a normal typed outcome for every service and never escapes as an exception.
  it.each(["checkProject", "buildProject", "runProject"] as const)(
    "should return a cancelled result from %s when already aborted",
    async (name) => {
      const root = await freshM1();
      const controller = new AbortController();
      controller.abort();
      const result = await publicService(name)({
        project: join(root, "blend65.json"),
        signal: controller.signal,
      });

      expect(result).toMatchObject({ kind: "failure", category: "cancelled" });
      if (result.kind !== "failure") throw new Error("Expected cancellation");
      expect(result.diagnostics).toEqual(expect.any(Array));
    },
  );

  // A failed fresh analysis prevents run from launching any previously present program.
  it("should return a source failure without launching stale output", async () => {
    const root = await freshM1();
    const container = join(root, "..");
    const log = join(container, "vice-invocations.jsonl");
    await mkdir(join(root, "out"));
    await writeFile(join(root, "out/stale.prg"), Uint8Array.from([0x01, 0x08, 0x60]));
    await writeFile(
      join(root, "src/game.blend"),
      "module Game; function main(): void { missing; }",
    );
    const originalPath = process.env.PATH;
    const originalLog = process.env.BLEND65_SPEC_VICE_LOG;
    const toolDirectory = await fakeVice(container, log);
    await writeFile(log, "");
    process.env.PATH = `${toolDirectory}${delimiter}${originalPath ?? ""}`;
    try {
      const result = await publicService("runProject")({ project: join(root, "blend65.json") });
      expect(result).toMatchObject({ kind: "failure", category: "source" });
      expect(await readFile(log, "utf8")).not.toContain(join(root, "out/stale.prg"));
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      if (originalLog === undefined) delete process.env.BLEND65_SPEC_VICE_LOG;
      else process.env.BLEND65_SPEC_VICE_LOG = originalLog;
    }
  });
});
