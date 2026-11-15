import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** One runtime shift witness and its expected stored answer. */
interface Case {
  readonly seed: number;
  readonly declaration: string;
  readonly expression: string;
  readonly answer: number;
}

/** Build and run one witness, reading the answer after the startup return. */
async function runShift(profile: string, testCase: Case): Promise<number> {
  const root = await mkdtemp(join(tmpdir(), "blend65-shift-vice-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "variable-shift-zero-count",
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
        "let seed: byte = 7;",
        "let answer: byte = 0;",
        "function main(): void {",
        `  seed = ${testCase.seed};`,
        `  ${testCase.declaration}`,
        `  answer = ${testCase.expression};`,
        "  poke($0420, answer);",
        "}",
      ].join("\n"),
    );
    const built = await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Shift build did not succeed");
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

const cases: readonly Case[] = [
  // A masked private byte count stays in 0..7 and uses the fresh LDX zero gate.
  { seed: 0, declaration: "let count: byte = seed & 7;", expression: "1 << count", answer: 1 },
  { seed: 1, declaration: "let count: byte = seed & 7;", expression: "1 << count", answer: 2 },
  { seed: 7, declaration: "let count: byte = seed & 7;", expression: "1 << count", answer: 128 },
  {
    seed: 0,
    declaration: "let count: byte = seed & 7;",
    expression: "byte(128) >> count",
    answer: 128,
  },
  {
    seed: 7,
    declaration: "let count: byte = seed & 7;",
    expression: "byte(128) >> count",
    answer: 1,
  },
  // An unbounded count keeps the saturation tests and returns zero at 8.
  { seed: 8, declaration: "let count: byte = seed;", expression: "1 << count", answer: 0 },
  { seed: 8, declaration: "let count: byte = seed;", expression: "byte(128) >> count", answer: 0 },
  // A word count exercises both saturation tests and the fill path.
  { seed: 0, declaration: "let count: word = word(seed);", expression: "1 << count", answer: 1 },
  { seed: 8, declaration: "let count: word = word(seed);", expression: "1 << count", answer: 0 },
];

describe.sequential("variable shift zero-count runtime", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const testCase of cases) {
      // The reordered immediate/count and the bounded countdown preserve the result.
      it(`should return ${testCase.answer} for seed ${testCase.seed} '${testCase.expression}' on ${profile}`, async () => {
        expect(await runShift(profile, testCase)).toBe(testCase.answer);
      }, 180_000);
    }
  }
});
