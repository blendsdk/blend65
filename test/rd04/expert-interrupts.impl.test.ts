import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

const expert = JSON.parse(
  await readFile(fileURLToPath(new URL("./expert/interrupts.json", import.meta.url)), "utf8"),
) as {
  chainEntry: { bytes: number; cycles: number; stackBytes: number };
  exclusiveEntry: { bytes: number; cycles: number; stackBytes: number };
  install: { bytes: number; cycles: number; stackBytes: number; savedPredecessorBytes: number };
  restore: { bytes: number; cycles: number; stackBytes: number };
};

interface DebugEvidence {
  functions: {
    qualifiedName: string;
    kind: string;
    entryVariants: { id: string; label: string; rangeIndexes: number[] }[];
  }[];
  ranges: { machine: { start: number; end: number } }[];
}

/** Build one minimal, independently costed CINV contract. */
async function buildInterrupt(exclusive: boolean): Promise<{
  assembly: string;
  debug: DebugEvidence;
}> {
  const root = await mkdtemp(join(tmpdir(), "blend65-expert-interrupt-"));
  try {
    const source = join(root, "src/game.blend");
    await mkdir(dirname(source), { recursive: true });
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "expert-interrupt",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(
      source,
      [
        "module Game;",
        `import { ${exclusive ? "setIRQExclusive" : "setIRQ"}, restoreIRQ } from c64.system;`,
        "interrupt function handler(): void { poke($D019, 1); }",
        `function main(): void { ${exclusive ? "setIRQExclusive" : "setIRQ"}(&handler); restoreIRQ(); }`,
      ].join("\n"),
    );
    const result = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "none",
    });
    expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
      "success",
    );
    if (result.kind !== "success") throw new Error("Expert interrupt fixture did not build");
    return {
      assembly: await readFile(join(result.generation.directory, ".asm"), "utf8"),
      debug: JSON.parse(
        await readFile(join(result.generation.directory, ".debug.json"), "utf8"),
      ) as DebugEvidence,
    };
  } finally {
    await rm(root, { recursive: true });
  }
}

/** Count final assembled instruction bytes belonging to one entry variant. */
function variantBytes(debug: DebugEvidence, indexes: readonly number[]): number {
  return indexes.reduce((bytes, index) => {
    const range = debug.ranges[index]!.machine;
    return bytes + range.end - range.start;
  }, 0);
}

/** Cost only the admitted NMOS instructions in the equal-contract hand reference. */
function measuredCost(sequence: string): { bytes: number; cycles: number } {
  let bytes = 0;
  let cycles = 0;
  for (const line of sequence.trim().split(/\r?\n/u)) {
    const match = /^\s*(\w{3})(?:\+\d)?(?:\s+(.*))?\s*$/iu.exec(line);
    if (match === null) throw new Error(`Unexpected expert instruction '${line}'`);
    const opcode = match[1]!.toLowerCase();
    const operand = match[2]?.trim() ?? "";
    if (["php", "pha", "pla", "plp", "sei", "cld"].includes(opcode)) {
      bytes += 1;
      cycles += { php: 3, pha: 3, pla: 4, plp: 4, sei: 2, cld: 2 }[
        opcode as "php" | "pha" | "pla" | "plp" | "sei" | "cld"
      ];
    } else if (opcode === "lda") {
      bytes += operand.startsWith("#") ? 2 : 3;
      cycles += operand.startsWith("#") ? 2 : 4;
    } else if (opcode === "sta") {
      bytes += 3;
      cycles += 4;
    } else if (opcode === "jmp") {
      bytes += 3;
      cycles += operand.startsWith("(") ? 5 : 3;
    } else {
      throw new Error(`Unexpected expert opcode '${opcode}'`);
    }
  }
  return { bytes, cycles };
}

describe("equal-contract C64 interrupt output", () => {
  it("matches the hand-written KERNAL chain entry and vector update", async () => {
    const { assembly, debug } = await buildInterrupt(false);
    const interrupt = debug.functions.find(({ kind }) => kind === "interrupt");
    const entry = interrupt?.entryVariants[0];
    expect(entry).toBeDefined();
    expect(variantBytes(debug, entry?.rangeIndexes ?? [])).toBeLessThanOrEqual(
      expert.chainEntry.bytes,
    );
    const chain = assembly.match(
      /^\s*php\s*\n\s*cld\s*\n\s*lda\s+#\$01\s*\n\s*sta\+2\s+\$d019\s*\n\s*plp\s*\n\s*jmp\s+\(\$[0-9a-f]{4}\)/imu,
    );
    expect(chain).not.toBeNull();
    expect(measuredCost(chain![0])).toEqual({
      bytes: expert.chainEntry.bytes,
      cycles: expert.chainEntry.cycles,
    });
    const install = assembly.match(
      /^\s*php\s*\n\s*pha\s*\n\s*sei\s*\n\s*lda\+2\s+\$0314\s*\n\s*sta\+2\s+\$[0-9a-f]{4}\s*\n\s*lda\+2\s+\$0315\s*\n\s*sta\+2\s+\$[0-9a-f]{4}\s*\n\s*lda\s+#<\(.+\)\s*\n\s*sta\+2\s+\$0314\s*\n\s*lda\s+#>\(.+\)\s*\n\s*sta\+2\s+\$0315\s*\n\s*pla\s*\n\s*plp/imu,
    );
    expect(install).not.toBeNull();
    expect(measuredCost(install![0])).toEqual({
      bytes: expert.install.bytes,
      cycles: expert.install.cycles,
    });
    const restore = assembly.match(
      /^\s*php\s*\n\s*pha\s*\n\s*sei\s*\n\s*lda\+2\s+\$[0-9a-f]{4}\s*\n\s*sta\+2\s+\$0314\s*\n\s*lda\+2\s+\$[0-9a-f]{4}\s*\n\s*sta\+2\s+\$0315\s*\n\s*pla\s*\n\s*plp/imu,
    );
    expect(restore).not.toBeNull();
    expect(measuredCost(restore![0])).toEqual({
      bytes: expert.restore.bytes,
      cycles: expert.restore.cycles,
    });
    expect(expert.chainEntry.stackBytes).toBe(1);
    expect(expert.install.stackBytes).toBe(2);
    expect(expert.install.savedPredecessorBytes).toBe(2);
    expect(expert.restore.stackBytes).toBe(2);
  });

  it("matches the hand-written exclusive entry with the declared ROM tail", async () => {
    const { assembly, debug } = await buildInterrupt(true);
    const interrupt = debug.functions.find(({ kind }) => kind === "interrupt");
    const entry = interrupt?.entryVariants[0];
    expect(entry).toBeDefined();
    expect(variantBytes(debug, entry?.rangeIndexes ?? [])).toBeLessThanOrEqual(
      expert.exclusiveEntry.bytes,
    );
    const exclusive = assembly.match(
      /^\s*cld\s*\n\s*lda\s+#\$01\s*\n\s*sta\+2\s+\$d019\s*\n\s*jmp\s+\$ea81/imu,
    );
    expect(exclusive).not.toBeNull();
    expect(measuredCost(exclusive![0])).toEqual({
      bytes: expert.exclusiveEntry.bytes,
      cycles: expert.exclusiveEntry.cycles,
    });
    expect(expert.exclusiveEntry.stackBytes).toBe(0);
  });
});
