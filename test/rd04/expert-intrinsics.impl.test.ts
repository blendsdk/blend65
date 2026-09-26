import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

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
  byteBcdTwoReads: {
    instructions: string[];
    bytes: number;
    cycles: number;
    scratchBytes: number;
  };
  byteBcdTwoReadsSubtract: {
    instructions: string[];
    bytes: number;
    cycles: number;
    scratchBytes: number;
  };
  wordBcdIncrement: { instructions: string[]; bytes: number; cycles: number; scratchBytes: number };
  wordBcdTwoReadsAdd: {
    instructions: string[];
    bytes: number;
    cycles: number;
    scratchBytes: number;
  };
  wordBcdTwoReadsSubtract: {
    instructions: string[];
    bytes: number;
    cycles: number;
    scratchBytes: number;
  };
  wordBcdDecrement: { instructions: string[]; bytes: number; cycles: number; scratchBytes: number };
};

/** Assemble one complete user routine through the public build path. */
async function bcdAssembly(sourceLine: string): Promise<string> {
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
      `module Game; function main(): void { ${sourceLine} }`,
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

/** Observe decimal results on the target CPU, independently of the assembly shape oracle. */
async function bcdResults(sourceLine: string): Promise<number[]> {
  const root = await mkdtemp(join(tmpdir(), "blend65-bcd-results-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "bcd-results",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(
      join(root, "src/game.blend"),
      `module Game; function main(): void { ${sourceLine} }`,
    );
    const result = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "none",
    });
    expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
      "success",
    );
    if (result.kind !== "success") throw new Error("BCD runtime fixture did not build");
    const labels = await readFile(join(result.generation.directory, ".labels"), "utf8");
    const returnLabel = `b65_[A-Za-z0-9_]+_${Buffer.from("startup.restore").toString("hex")}`;
    const match = labels.match(new RegExp(`^\\s*${returnLabel}\\s*=\\s*\\$([0-9a-f]+)`, "imu"));
    expect(match).not.toBeNull();
    const returnAddress = Number.parseInt(match?.[1] ?? "", 16);
    const started = await startVice(
      join(result.generation.directory, result.generation.primaryArtifact),
    );
    if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
    try {
      const checkpoint = await started.monitor.setExecuteCheckpoint(returnAddress);
      try {
        const stopped = started.monitor.waitForStop(20_000);
        await started.monitor.resume();
        expect(await stopped).toBe(returnAddress);
        return [...(await started.monitor.readMemory(0x0420, 0x0425))];
      } finally {
        await started.monitor.deleteCheckpoint(checkpoint);
      }
    } finally {
      await stopVice({ child: started.child, monitor: started.monitor });
    }
  } finally {
    await rm(root, { recursive: true });
  }
}

/** Cost the deliberately small hand reference without a second assembler model. */
function cost(instructions: readonly string[]): { bytes: number; cycles: number } {
  const forms = new Map<string, readonly [number, number]>([
    ["LDA $0400", [3, 4]],
    ["LDA $0401", [3, 4]],
    ["LDX $0401", [3, 4]],
    ["LDY $0401", [3, 4]],
    ["LDA $0402", [3, 4]],
    ["LDX $0402", [3, 4]],
    ["LDX $0403", [3, 4]],
    ["TXA", [1, 2]],
    ["TYA", [1, 2]],
    ["STA SCRATCH", [3, 4]],
    ["STX SCRATCH", [3, 4]],
    ["STY SCRATCH", [3, 4]],
    ["ADC SCRATCH", [3, 4]],
    ["SBC SCRATCH", [3, 4]],
    ["SED", [1, 2]],
    ["CLC", [1, 2]],
    ["SEC", [1, 2]],
    ["ADC #$01", [2, 2]],
    ["ADC #$00", [2, 2]],
    ["SBC #$01", [2, 2]],
    ["SBC #$00", [2, 2]],
    ["CLD", [1, 2]],
    ["STA $0420", [3, 4]],
    ["STA $0421", [3, 4]],
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

/** Extract the complete main routine, excluding only the common startup-return jump. */
function routineInstructions(assembly: string): string[] {
  const lines = assembly.split(/\r?\n/u);
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
  return region.slice(0, -1).map((line) => line.trim().toUpperCase());
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
    const actual = routineInstructions(
      await bcdAssembly("poke($0420, bcd_add(peek($0400), byte(1)));"),
    );
    expect(actual).toEqual(expert.byteBcdIncrement.instructions);
    expect(cost(actual)).toEqual({ bytes: 11, cycles: 16 });
    expect(expert.byteBcdIncrement.scratchBytes).toBe(0);
  });

  it("uses one staged byte for two ordered volatile BCD operands", async () => {
    expect(cost(expert.byteBcdTwoReads.instructions)).toEqual({
      bytes: expert.byteBcdTwoReads.bytes,
      cycles: expert.byteBcdTwoReads.cycles,
    });
    const actual = routineInstructions(
      await bcdAssembly("poke($0420, bcd_add(peek($0400), peek($0401)));"),
    );
    const scratch = actual
      .find((line) => /^STA \$[0-9A-F]{4}$/u.test(line) && line !== "STA $0420")
      ?.slice(4);
    expect(scratch).toBeDefined();
    const normalized = actual.map((line) => line.replace(scratch ?? "", "SCRATCH"));
    expect(normalized).toEqual(expert.byteBcdTwoReads.instructions);
    expect(cost(normalized)).toEqual({ bytes: 18, cycles: 26 });
    expect(expert.byteBcdTwoReads.scratchBytes).toBe(1);
  });

  it("subtracts two ordered volatile BCD bytes with one staged operand", async () => {
    const reference = expert.byteBcdTwoReadsSubtract;
    expect(cost(reference.instructions)).toEqual({
      bytes: reference.bytes,
      cycles: reference.cycles,
    });
    const actual = routineInstructions(
      await bcdAssembly("poke($0420, bcd_sub(peek($0400), peek($0401)));"),
    );
    const scratch = actual.find((line) => /^STX \$[0-9A-F]{4}$/u.test(line))?.slice(4);
    expect(scratch).toBeDefined();
    const normalized = actual.map((line) => line.replace(scratch ?? "", "SCRATCH"));
    expect(normalized).toEqual(reference.instructions);
    expect(cost(normalized)).toEqual({ bytes: 18, cycles: 26 });
    expect(reference.scratchBytes).toBe(1);
  });

  it.each([
    ["add", "wordBcdIncrement"],
    ["sub", "wordBcdDecrement"],
  ] as const)("writes a %s word directly in the owned decimal region", async (operator, key) => {
    const reference = expert[key];
    expect(cost(reference.instructions)).toEqual({
      bytes: reference.bytes,
      cycles: reference.cycles,
    });
    const actual = routineInstructions(
      await bcdAssembly(`pokew($0420, bcd_${operator}(peekw($0400), word(1)));`),
    );
    expect(actual).toEqual(reference.instructions);
    expect(cost(actual)).toEqual({ bytes: 20, cycles: 28 });
    expect(reference.scratchBytes).toBe(0);
  });

  it("adds two ordered volatile BCD words with one reused staged byte", async () => {
    const reference = expert.wordBcdTwoReadsAdd;
    expect(cost(reference.instructions)).toEqual({
      bytes: reference.bytes,
      cycles: reference.cycles,
    });
    const actual = routineInstructions(
      await bcdAssembly("pokew($0420, bcd_add(peekw($0400), peekw($0402)));"),
    );
    const scratch = actual
      .find(
        (line) => /^STA \$[0-9A-F]{4}$/u.test(line) && line !== "STA $0420" && line !== "STA $0421",
      )
      ?.slice(4);
    expect(scratch).toBeDefined();
    const normalized = actual.map((line) => line.replace(scratch ?? "", "SCRATCH"));
    expect(normalized).toEqual(reference.instructions);
    expect(cost(normalized)).toEqual({ bytes: 34, cycles: 48 });
    expect(reference.scratchBytes).toBe(1);
  });

  it("subtracts two ordered volatile BCD words with one reused staged byte", async () => {
    const reference = expert.wordBcdTwoReadsSubtract;
    expect(cost(reference.instructions)).toEqual({
      bytes: reference.bytes,
      cycles: reference.cycles,
    });
    const actual = routineInstructions(
      await bcdAssembly("pokew($0420, bcd_sub(peekw($0400), peekw($0402)));"),
    );
    const scratch = actual.find((line) => /^STX \$[0-9A-F]{4}$/u.test(line))?.slice(4);
    expect(scratch).toBeDefined();
    const normalized = actual.map((line) => line.replace(scratch ?? "", "SCRATCH"));
    expect(normalized).toEqual(reference.instructions);
    expect(cost(normalized)).toEqual({ bytes: 34, cycles: 48 });
    expect(reference.scratchBytes).toBe(1);
  });

  it("executes two-read byte and word arithmetic with decimal carry and borrow", async () => {
    const bytes = await bcdResults(
      "poke($0421, 0); poke($0400, $25); poke($0401, $07); " +
        "poke($0420, bcd_sub(peek($0400), peek($0401))); " +
        "pokew($0400, $1299); pokew($0402, $0001); " +
        "pokew($0422, bcd_add(peekw($0400), peekw($0402))); " +
        "pokew($0404, $1300); pokew($0406, $0001); " +
        "pokew($0424, bcd_sub(peekw($0404), peekw($0406)));",
    );
    expect(bytes).toEqual([0x18, 0, 0x00, 0x13, 0x99, 0x12]);
  }, 60_000);

  it("keeps reusable word results in stable storage", async () => {
    const bytes = await bcdResults(
      "pokew($0400, $1250); pokew($0402, $0001); " +
        "let difference: word = bcd_sub(peekw($0400), peekw($0402)); " +
        "pokew($0420, difference); pokew($0422, difference); " +
        "let sum: word = bcd_add(peekw($0400), peekw($0402)); pokew($0424, sum);",
    );
    expect(bytes).toEqual([0x49, 0x12, 0x49, 0x12, 0x51, 0x12]);
  }, 60_000);
});
