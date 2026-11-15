import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Build one seed witness and read the stored answer after the startup return. */
async function runClassifier(profile: string, seed: number): Promise<number> {
  const root = await mkdtemp(join(tmpdir(), "blend65-classifier-vice-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "stable-byte-classifier",
        sourceRoot: "src",
        entry: "Game",
        target: profile,
        assetPaths: [],
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(
      join(root, "src/game.blend"),
      [
        "module Game;",
        "let data: byte[8] = [0; 8];",
        "let seed: byte = 1;",
        "let answer: byte = 0;",
        "function work(): byte {",
        "  for (let i: word = 0; i < 8; i += 1) { data[i] = byte(i); }",
        "  if (seed == 0) { return 0; }",
        "  if (seed == 1) { return 127; }",
        "  if (seed == 2) { return 255; }",
        "  if (seed == 3) { return 0; }",
        "  if (seed == 4) { return 127; }",
        "  if (seed == 5) { return 255; }",
        "  if (seed == 6) { return 0; }",
        "  if (seed == 7) { return 127; }",
        "  return 255;",
        "}",
        `function main(): void { seed = ${seed}; answer = work(); poke($0420, answer); }`,
      ].join("\n"),
    );
    const built = await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Classifier build did not succeed");
    const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
    const returnLabel = `b65_[A-Za-z0-9_]+_${Buffer.from("startup.restore").toString("hex")}`;
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
        return (await started.monitor.readMemory(0x0420, 0x0420))[0] ?? -1;
      } finally {
        await started.monitor.deleteCheckpoint(checkpoint);
      }
    } finally {
      await stopVice({ child: started.child, monitor: started.monitor });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Expected answer for each tested seed value. */
const seeds = [
  [0, 0],
  [1, 127],
  [2, 255],
  [3, 0],
  [4, 127],
  [5, 255],
  [6, 0],
  [7, 127],
  [8, 255],
  [255, 255],
] as const;

describe.sequential("stable byte classifier runtime", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const [seed, answer] of seeds) {
      // The reused A must still select the same arm and return the same byte.
      it(`should return ${answer} for seed ${seed} on ${profile}`, async () => {
        expect(await runClassifier(profile, seed)).toBe(answer);
      }, 180_000);
    }
  }
});
