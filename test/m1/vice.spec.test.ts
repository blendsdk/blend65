import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { runBehaviorOracle, type OracleFrame } from "../../examples/m1/qualification/oracle.js";
import type { M1ViceQualificationResult } from "./vice-driver.js";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const spriteSha256 = "c590c49d0e0aae8a20b39e2f6246c530bb7f52fe8b4c21131ec09a442509f68a";
let temporaryProject: string | undefined;

/** Narrow untrusted JSON to an ordinary object before reading evidence fields. */
function record(value: unknown, label: string): Record<string, unknown> {
  expect(value, label).toBeTypeOf("object");
  expect(value, label).not.toBeNull();
  expect(Array.isArray(value), label).toBe(false);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return Object.fromEntries(Object.entries(value));
}

/** Expand the frozen value/count joystick runs without adapting them to emulator state. */
async function fixedTrace(): Promise<readonly number[]> {
  const text = await readFile(join(repository, "examples/m1/qualification/win-trace.json"), "utf8");
  const input: unknown = JSON.parse(text);
  const trace = record(input, "fixed win trace");
  expect(trace).toMatchObject({
    formatVersion: 1,
    encoding: "active-low-joystick-2-runs",
  });
  const runs = trace.runs;
  if (!Array.isArray(runs)) throw new TypeError("Fixed trace runs must be an array");
  return runs.flatMap((run, index) => {
    if (
      !Array.isArray(run) ||
      run.length !== 2 ||
      !Number.isInteger(run[0]) ||
      !Number.isInteger(run[1]) ||
      run[0] < 0 ||
      run[0] > 0x1f ||
      run[1] < 1
    ) {
      throw new TypeError(`Fixed trace run ${index} is invalid`);
    }
    return Array.from({ length: run[1] }, () => run[0]);
  });
}

/** Copy the checked-in project inputs so qualification owns all generated files. */
async function projectCopy(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-m1-vice-"));
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "assets"), { recursive: true });
  await copyFile(join(repository, "examples/m1/blend65.json"), join(root, "blend65.json"));
  await copyFile(join(repository, "examples/m1/src/game.blend"), join(root, "src/game.blend"));
  await copyFile(
    join(repository, "examples/m1/assets/sprites.bin"),
    join(root, "assets/sprites.bin"),
  );
  return root;
}

/** Return the VIC bank-relative block of the first raw sprite record. */
async function spriteBaseBlock(generationDirectory: string): Promise<number> {
  const text = await readFile(join(generationDirectory, ".assets.json"), "utf8");
  const root = record(JSON.parse(text), "asset evidence");
  const assets = root.assets;
  if (!Array.isArray(assets) || assets.length !== 1) {
    throw new TypeError("M1 must publish exactly one asset record");
  }
  const asset = record(assets[0], "sprite asset");
  const placement = record(asset.placement, "sprite placement");
  const range = record(placement.range, "sprite placement range");
  if (typeof range.start !== "number" || range.start % 64 !== 0) {
    throw new TypeError("Sprite placement must start on a 64-byte boundary");
  }
  return (range.start & 0x3fff) / 64;
}

/** Extract the eight logical sprite publications from one independent oracle frame. */
function expectedSprites(frame: OracleFrame, baseBlock: number) {
  const publications = frame.deviceIntents.filter((intent) => intent.kind === "publish-sprite");
  const pointers = frame.deviceIntents.filter((intent) => intent.kind === "set-sprite-pointer");
  expect(publications).toHaveLength(8);
  expect(pointers).toHaveLength(8);
  return publications.map((sprite, index) => ({
    index: sprite.index,
    enabled: sprite.enabled,
    x: sprite.x,
    y: sprite.y,
    pointer: baseBlock + (pointers[index]?.block ?? -1),
    color: sprite.color,
  }));
}

afterAll(async () => {
  if (temporaryProject !== undefined) {
    await rm(temporaryProject, { recursive: true, force: true });
  }
});

describe.sequential("real M1 VICE qualification", () => {
  // One fixed joyport trace must reproduce every oracle frame and return through restored BASIC state.
  it("should verify the complete fixed win trace through VICE 3.10", async () => {
    temporaryProject = await projectCopy();
    const build = await buildProject({ project: join(temporaryProject, "blend65.json") });
    expect(build.kind, build.kind === "failure" ? JSON.stringify(build.diagnostics) : "").toBe(
      "success",
    );
    if (build.kind !== "success") throw new Error("The M1 qualification build did not succeed");

    const trace = await fixedTrace();
    const oracle = runBehaviorOracle(trace);
    expect(oracle).toMatchObject({ outcome: "won", returnedToBasic: true });
    const { qualifyM1WithVice } = await import("./vice-driver.js");
    const result: M1ViceQualificationResult = await qualifyM1WithVice({
      generation: build.generation,
      trace,
      oracle,
    });
    if (result.kind === "unknown") {
      throw new Error(`VICE qualification is Unknown: ${result.reason}`);
    }

    expect(result.status).toBe("VICE-verified / hardware-unverified");
    expect(result.residentSpriteSha256).toBe(spriteSha256);
    expect(result.restoredState).toBe(true);
    expect(result.returnedToBasic).toBe(true);
    expect(result.frames).toHaveLength(oracle.frames.length);
    const baseBlock = await spriteBaseBlock(build.generation.directory);
    result.frames.forEach((observed, index) => {
      const expected = oracle.frames[index];
      expect(expected, `Missing oracle frame ${index}`).toBeDefined();
      if (expected === undefined) throw new Error(`Missing oracle frame ${index}`);
      expect(observed).toMatchObject({
        index,
        sample: trace[index],
        state: expected.state,
        sprites: expectedSprites(expected, baseBlock),
        border: expected.state.border,
      });
      expect(observed.sprites.map((sprite) => sprite.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(observed.displaySha256).toMatch(/^[0-9a-f]{64}$/);
    });
  }, 180_000);
});
