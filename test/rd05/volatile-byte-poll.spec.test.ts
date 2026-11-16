import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { BOING_BALL_DIR } from "./boing-ball-fixture.js";
import { profileRecords, readProfileArtifacts } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

/** Inspect detached artifacts while keeping every generated file in an owned scratch tree. */
async function buildPoll(profile: string, operator?: "==" | "!=") {
  const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "blend65-poll-"));
  try {
    await mkdir(join(root, "src"));
    if (operator === undefined) {
      await mkdir(join(root, "assets"));
      await copyFile(join(BOING_BALL_DIR, "src/main.blend"), join(root, "src/main.blend"));
      await copyFile(join(BOING_BALL_DIR, "assets/ball.bin"), join(root, "assets/ball.bin"));
      await copyFile(join(BOING_BALL_DIR, "blend65.json"), join(root, "blend65.json"));
    } else {
      await writeFile(
        join(root, "src/main.blend"),
        `module Main; function main(): void { while (peek($D012) ${operator} 251) {} }`,
      );
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "volatile-poll",
          sourceRoot: "src",
          entry: "Main",
          target: profile,
          assetPaths: [],
          outDir: "out",
          optimization: "none",
        }),
      );
    }
    const built = await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    return await readProfileArtifacts(built);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Require the final machine-code poll, including its taken-branch page condition. */
function expectNineCyclePoll(
  artifacts: Awaited<ReturnType<typeof readProfileArtifacts>>,
  branch: 0xd0 | 0xf0,
): void {
  const { prg } = artifacts;
  const load = prg.readUInt16LE(0);
  const code = profileRecords(artifacts.memory.intervals).filter((entry) => entry.kind === "code");
  expect(code.length).toBeGreaterThan(0);
  const reads: number[] = [];
  for (let offset = 2; offset + 2 < prg.length; offset += 1) {
    const address = load + offset - 2;
    if (
      prg[offset] === 0xad &&
      prg[offset + 1] === 0x12 &&
      prg[offset + 2] === 0xd0 &&
      code.some((entry) => Number(entry.start) <= address && Number(entry.end) >= address + 3)
    )
      reads.push(address);
  }
  expect(reads, "one volatile raster read instruction, not a captured byte home").toHaveLength(1);
  const address = reads[0]!;
  expect(
    code.some((entry) => Number(entry.start) <= address && Number(entry.end) >= address + 7),
    "the complete poll must be executable code",
  ).toBe(true);
  const offset = address - load + 2;
  const loop = [...prg.subarray(offset, offset + 7)];
  expect(loop.slice(0, 3)).toEqual([0xad, 0x12, 0xd0]);
  expect([0x49, 0xc9], "either EOR or CMP immediate is valid").toContain(loop[3]);
  expect(loop.slice(4)).toEqual([0xfb, branch, 0xf9]);
  // LDA absolute costs four cycles, the immediate test two, and a taken
  // same-page branch three. IRQ service and VIC DMA are outside this nominal cost.
  expect((address + 7) & 0xff00, "the taken branch must not cross a page").toBe(address & 0xff00);
  expect(loop).toHaveLength(7);
}

describe("volatile byte raster polling", () => {
  for (const profile of profiles) {
    for (const [operator, branch] of [
      ["!=", 0xd0],
      ["==", 0xf0],
    ] as const) {
      it(`should read once per iteration in seven bytes and nine nominal cycles when polling ${operator} on ${profile}`, async () => {
        expectNineCyclePoll(await buildPoll(profile, operator), branch);
      }, 120_000);
    }
  }

  it("should retain the same seven-byte, nine-nominal-cycle poll in the canonical ball workload", async () => {
    expectNineCyclePoll(await buildPoll("c64-pal-prg-kernal-6581"), 0xd0);
  }, 120_000);
});
