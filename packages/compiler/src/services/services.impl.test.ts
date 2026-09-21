import { createHash } from "node:crypto";
import {
  access,
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildProject, runProject } from "./services.js";

const M1_PROJECT = fileURLToPath(new URL("../../../../examples/m1/", import.meta.url));
const FOUNDATION_PROJECT = fileURLToPath(
  new URL("../../../../examples/foundation/", import.meta.url),
);
const temporaryRoots: string[] = [];

/** Copy the complete milestone project without retaining checked-in output. */
async function freshM1(): Promise<string> {
  const container = await mkdtemp(join(tmpdir(), "blend65-services-impl-"));
  temporaryRoots.push(container);
  const root = join(container, "m1");
  await cp(M1_PROJECT, root, { recursive: true });
  await rm(join(root, "out"), { recursive: true, force: true });
  return root;
}

/** Copy the small foundation project for focused source-level service fixtures. */
async function freshFoundation(): Promise<string> {
  const container = await mkdtemp(join(tmpdir(), "blend65-services-foundation-"));
  temporaryRoots.push(container);
  const root = join(container, "foundation");
  await cp(FOUNDATION_PROJECT, root, { recursive: true });
  await rm(join(root, "out"), { recursive: true, force: true });
  return root;
}

/** Install one executable fake x64sc with the supplied direct Node body. */
async function fakeVice(container: string, body: string): Promise<string> {
  const directory = join(container, `vice-${temporaryRoots.length}-${Date.now()}`);
  await mkdir(directory);
  const executable = join(directory, "x64sc");
  await writeFile(executable, `#!/usr/bin/env node\n${body}\n`);
  await chmod(executable, 0o755);
  return directory;
}

/** Wait for a fake emulator marker without leaving an unbounded test process. */
async function waitForFile(path: string): Promise<void> {
  const deadline = performance.now() + 10_000;
  while (performance.now() < deadline) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
  }
  throw new Error("Timed out waiting for the fake emulator marker");
}

/** Return whether a native process identity is still signalable. */
function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("compiler service hardening", () => {
  it("should publish a fresh generation for each unchanged build", async () => {
    const root = await freshM1();
    const project = join(root, "blend65.json");
    const first = await buildProject({ project });
    const second = await buildProject({ project });

    expect(first.kind).toBe("success");
    expect(second.kind).toBe("success");
    if (first.kind !== "success" || second.kind !== "success") {
      throw new Error("Expected two successful builds");
    }
    expect(second.generation.generationId).not.toBe(first.generation.generationId);
    await access(join(first.generation.directory, first.generation.primaryArtifact));
    await access(join(second.generation.directory, second.generation.primaryArtifact));
    const memory = JSON.parse(
      await readFile(join(first.generation.directory, ".memory.json"), "utf8"),
    );
    const debug = JSON.parse(
      await readFile(join(first.generation.directory, ".debug.json"), "utf8"),
    );
    const sfaIntervals = memory.intervals.filter((interval: Record<string, unknown>) =>
      ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)),
    );
    expect(sfaIntervals.length).toBeGreaterThan(0);
    expect(memory.sfaClosureSha256).not.toBe(createHash("sha256").update("[]").digest("hex"));
    expect(debug.addressSpaces.length).toBeGreaterThan(0);
    expect(debug.functions.length).toBeGreaterThan(0);
    expect(debug.contexts.length).toBeGreaterThan(0);
    expect(debug.symbols.length).toBeGreaterThan(0);
    expect(debug.locations.length).toBeGreaterThan(0);
    expect(debug.ranges.length).toBeGreaterThan(0);
    const current = JSON.parse(await readFile(join(root, "out/current.json"), "utf8"));
    expect(current.generationId).toBe(second.generation.generationId);
  });

  it("should publish disjoint live ranges for SFA occupants that share one home", async () => {
    const root = await freshFoundation();
    await writeFile(
      join(root, "src/main.blend"),
      [
        "module Foundation;",
        "function f(a: byte, b: byte): byte { return a + b; }",
        "function probe(): byte {",
        "  let x: byte = f(1, f(2, 3));",
        "  let y: byte = f(4, f(5, 6));",
        "  return x + y;",
        "}",
        "function main(): void { c64.vic.setBorderColor(probe()); }",
      ].join("\n"),
    );

    const result = await buildProject({ project: join(root, "blend65.json") });
    expect(result.kind).toBe("success");
    if (result.kind !== "success") throw new Error("Expected a successful fixture build");
    const debug = JSON.parse(
      await readFile(join(result.generation.directory, ".debug.json"), "utf8"),
    );
    const occupants = debug.locations.filter((location: Record<string, unknown>) => {
      const symbol = debug.symbols[Number(location.symbolIndex)];
      return String(symbol.qualifiedName).includes(":argument-stage:");
    });
    expect(occupants).toHaveLength(2);
    const [first, second] = occupants;
    expect(first.availability.pieces[0].machine).toEqual(second.availability.pieces[0].machine);
    const secondRanges = new Set(second.liveRangeIndexes);
    expect(first.liveRangeIndexes.every((index: number) => !secondRanges.has(index))).toBe(true);
  });

  it.each(["3.100", "3.10beta", "3.10-evil", "3.10.0"])(
    "should reject the non-exact VICE %s banner",
    async (version) => {
      const root = await freshM1();
      const originalPath = process.env.PATH;
      const tools = await fakeVice(root, `process.stdout.write("x64sc (VICE ${version})\\n");`);
      process.env.PATH = `${tools}${delimiter}${originalPath ?? ""}`;
      try {
        const result = await runProject({ project: join(root, "blend65.json") });
        expect(result).toMatchObject({ kind: "failure", category: "tool-discovery" });
      } finally {
        if (originalPath === undefined) delete process.env.PATH;
        else process.env.PATH = originalPath;
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "should stop the complete VICE process group before returning cancellation",
    async () => {
      const root = await freshM1();
      const marker = join(root, "vice-pids.json");
      const originalPath = process.env.PATH;
      const originalMarker = process.env.BLEND65_IMPL_VICE_MARKER;
      const tools = await fakeVice(
        root,
        [
          'const { spawn } = require("node:child_process");',
          'const fs = require("node:fs");',
          'if (process.argv.includes("--version")) { process.stdout.write("x64sc (VICE 3.10)\\n"); process.exit(0); }',
          'const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });',
          "fs.writeFileSync(process.env.BLEND65_IMPL_VICE_MARKER, JSON.stringify({ parent: process.pid, child: child.pid }));",
          "setInterval(() => {}, 1000);",
        ].join("\n"),
      );
      process.env.PATH = `${tools}${delimiter}${originalPath ?? ""}`;
      process.env.BLEND65_IMPL_VICE_MARKER = marker;
      const controller = new AbortController();
      try {
        const pending = runProject({
          project: join(root, "blend65.json"),
          signal: controller.signal,
        });
        await waitForFile(marker);
        const pids = JSON.parse(await readFile(marker, "utf8")) as {
          parent: number;
          child: number;
        };
        controller.abort();
        await expect(pending).resolves.toMatchObject({ kind: "failure", category: "cancelled" });
        expect(processExists(pids.parent)).toBe(false);
        expect(processExists(pids.child)).toBe(false);
      } finally {
        if (originalPath === undefined) delete process.env.PATH;
        else process.env.PATH = originalPath;
        if (originalMarker === undefined) delete process.env.BLEND65_IMPL_VICE_MARKER;
        else process.env.BLEND65_IMPL_VICE_MARKER = originalMarker;
      }
    },
  );

  it("should leave stale output untouched when run is already cancelled", async () => {
    const root = await freshM1();
    const out = join(root, "out");
    const stale = join(out, "stale.prg");
    await mkdir(out);
    await writeFile(stale, Uint8Array.from([0x01, 0x08, 0x60]));
    const before = await readFile(stale);
    const controller = new AbortController();
    controller.abort();

    const result = await runProject({
      project: join(root, "blend65.json"),
      signal: controller.signal,
    });

    expect(result).toMatchObject({ kind: "failure", category: "cancelled" });
    expect(await readdir(out)).toEqual(["stale.prg"]);
    expect(await readFile(stale)).toEqual(before);
  });
});
