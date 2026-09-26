import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

const expert = JSON.parse(
  await readFile(fileURLToPath(new URL("./expert/intrinsics.json", import.meta.url)), "utf8"),
) as {
  schemaVersion: number;
  authority: { skillVersion: string; skillContentCommit: string };
  byteBcdIncrement: {
    instructions: string[];
    bytes: number;
    cycles: number;
    scratchBytes: number;
  };
};

/** Assemble one complete user routine through the public build path. */
async function bcdAssembly(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-expert-intrinsics-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "expert-intrinsics",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(
      join(root, "src/game.blend"),
      "module Game; function main(): void { poke($0420, bcd_add(peek($0400), byte(1))); }",
    );
    const result = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "none",
    });
    expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
      "success",
    );
    if (result.kind !== "success") throw new Error("Expert intrinsic fixture did not build");
    return readFile(join(result.generation.directory, ".asm"), "utf8");
  } finally {
    await rm(root, { recursive: true });
  }
}

/** Cost the deliberately small hand reference without a second assembler model. */
function cost(instructions: readonly string[]): { bytes: number; cycles: number } {
  const forms = new Map<string, readonly [number, number]>([
    ["LDA $0400", [3, 4]],
    ["SED", [1, 2]],
    ["CLC", [1, 2]],
    ["ADC #$01", [2, 2]],
    ["CLD", [1, 2]],
    ["STA $0420", [3, 4]],
  ]);
  return instructions.reduce(
    (sum, instruction) => {
      const form = forms.get(instruction);
      if (form === undefined) throw new Error(`Unknown expert form '${instruction}'`);
      return { bytes: sum.bytes + form[0], cycles: sum.cycles + form[1] };
    },
    { bytes: 0, cycles: 0 },
  );
}

describe("equal-contract intrinsic output", () => {
  it("matches the complete hand-written byte BCD read/modify/write routine", async () => {
    expect(expert.schemaVersion).toBe(1);
    expect(expert.authority.skillVersion).toBe("2.0.0");
    expect(expert.authority.skillContentCommit).toMatch(/^[0-9a-f]{40}$/u);
    expect(cost(expert.byteBcdIncrement.instructions)).toEqual({
      bytes: expert.byteBcdIncrement.bytes,
      cycles: expert.byteBcdIncrement.cycles,
    });
    const lines = (await bcdAssembly()).split(/\r?\n/u);
    const decimalIndex = lines.findIndex((line) => /^\s*sed\s*$/iu.test(line));
    expect(decimalIndex).toBeGreaterThan(0);
    const regionStart = lines.findLastIndex(
      (line, index) => index < decimalIndex && /^\* =/u.test(line),
    );
    const regionEnd = lines.findIndex((line, index) => index > decimalIndex && /^\* =/u.test(line));
    const region = lines
      .slice(regionStart + 1, regionEnd)
      .filter((line) => /^\s+[a-z]{3}(?:\+\d+)?\b/iu.test(line));
    expect(region.at(-1)).toMatch(/^\s*jmp(?:\+\d+)?\s+/iu);
    const actual = region.slice(0, -1).map((line) => line.trim().toUpperCase());
    expect(actual).toEqual(expert.byteBcdIncrement.instructions);
    expect(cost(actual)).toEqual({ bytes: 11, cycles: 16 });
    expect(expert.byteBcdIncrement.scratchBytes).toBe(0);
  });
});
