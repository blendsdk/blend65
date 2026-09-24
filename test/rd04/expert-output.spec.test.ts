import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

type Instruction = { mnemonic: string; operand: string };

// Keep every documented NMOS instruction so an intervening operation cannot be skipped.
const NMOS_INSTRUCTIONS = new Set(
  "ADC AND ASL BCC BCS BEQ BIT BMI BNE BPL BRK BVC BVS CLC CLD CLI CLV CMP CPX CPY DEC DEX DEY EOR INC INX INY JMP JSR LDA LDX LDY LSR NOP ORA PHA PHP PLA PLP ROL ROR RTI RTS SBC SEC SED SEI STA STX STY TAX TAY TSX TXA TXS TYA".split(
    " ",
  ),
);

const expert = JSON.parse(
  await readFile(fileURLToPath(new URL("./expert/scalars.json", import.meta.url)), "utf8"),
) as {
  constantTimesThree: { bytes: number; cycles: number; zeroPageScratchBytes: number };
  variableTimesVariable: {
    helperBodyBytesIncludingRts: number;
    zeroPageScratchBytes: number;
    iterations: number;
  };
};

async function put(root: string, name: string, content: string): Promise<void> {
  const path = join(root, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function build(
  body: readonly string[],
  declarations: readonly string[] = [],
): Promise<{ assembly: string }> {
  const root = await mkdtemp(join(tmpdir(), "blend65-expert-scalars-"));
  try {
    await put(
      root,
      "blend65.json",
      JSON.stringify({
        schemaVersion: 1,
        name: "expert-scalars",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    await put(
      root,
      "src/game.blend",
      ["module Game;", ...declarations, "function main(): void {", ...body, "}"].join("\n"),
    );
    const result = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "none",
    });
    expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
      "success",
    );
    if (result.kind !== "success") throw new Error("Expert scalar fixture did not build");
    return {
      assembly: await readFile(join(result.generation.directory, ".asm"), "utf8"),
    };
  } finally {
    await rm(root, { recursive: true });
  }
}

function instructions(assembly: string): Instruction[] {
  const result: Instruction[] = [];
  for (const line of assembly.split(/\r?\n/u)) {
    const code = line.split(";")[0] ?? "";
    const matched = /^\s*(?:[A-Za-z_][\w.]*:\s*)?([a-z]{3})\b\s*(.*?)\s*$/iu.exec(code);
    if (matched && NMOS_INSTRUCTIONS.has(matched[1]!.toUpperCase())) {
      result.push({ mnemonic: matched[1]!.toUpperCase(), operand: matched[2]!.trim() });
    }
  }
  return result;
}

function jsrCount(assembly: string): number {
  return assembly.match(/^\s*jsr(?:\+\d+)?\s+\S+/gimu)?.length ?? 0;
}

describe("independent byte arithmetic output baselines", () => {
  it("uses the local expert sequence for byte times three", async () => {
    const { assembly } = await build([
      "let value: byte = peek($0400);",
      "poke($0420, value * byte(3));",
    ]);
    const code = instructions(assembly);
    const candidates = code.flatMap((step, index) =>
      step.mnemonic === "STA" &&
      code[index + 1]?.mnemonic === "ASL" &&
      ["", "A"].includes(code[index + 1]?.operand.toUpperCase() ?? "") &&
      code[index + 2]?.mnemonic === "CLC" &&
      code[index + 3]?.mnemonic === "ADC" &&
      code[index + 3]?.operand === step.operand
        ? [step.operand]
        : [],
    );
    expect(candidates, "one local modular multiply-by-three sequence").toHaveLength(1);
    expect(assembly).not.toMatch(/^\s*jsr(?:\+\d+)?\s+\S*mul\S*/imu);
  });

  it("uses a compact shared eight-step helper for variable byte multiply", async () => {
    const { assembly } = await build([
      "let left: byte = peek($0400); let right: byte = peek($0401);",
      "poke($0420, left * right);",
      "poke($0421, right * left);",
    ]);
    const code = instructions(assembly);
    const pattern = [
      "LDA",
      "LDX",
      "LSR",
      "BCC",
      "CLC",
      "ADC",
      "ROR",
      "ROR",
      "DEX",
      "BNE",
      "LDA",
      "RTS",
    ];
    const candidates = code.flatMap((step, index) =>
      step.mnemonic === pattern[0] &&
      pattern.every((mnemonic, offset) => code[index + offset]?.mnemonic === mnemonic)
        ? [code.slice(index, index + pattern.length)]
        : [],
    );
    expect(candidates, "one bounded shared multiply helper body").toHaveLength(1);
    const helper = candidates[0]!;
    expect(helper[0]?.operand).toMatch(/^#(?:\$0+|0)$/iu);
    expect(helper[1]?.operand).toMatch(/^#(?:\$0*8|8)$/iu);
    expect(helper[2]?.operand).toBe(helper[7]?.operand);
    expect(helper[7]?.operand).toBe(helper[10]?.operand);
    expect(helper[3]?.operand).not.toBe("");
    expect(helper[9]?.operand).not.toBe("");
    expect(["", "A"]).toContain(helper[6]?.operand.toUpperCase());
    const scratch = [helper[2]?.operand, helper[5]?.operand];
    expect(new Set(scratch).size).toBe(expert.variableTimesVariable.zeroPageScratchBytes);
    expect(assembly.match(/^\s*jsr(?:\+\d+)?\s+\S+/gimu)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("lowers unsigned byte division by two to one logical right shift", async () => {
    const baseline = await build(["let value: byte = peek($0400);", "poke($0420, value);"]);
    const { assembly } = await build([
      "let value: byte = peek($0400);",
      "poke($0420, value / byte(2));",
    ]);
    const code = instructions(assembly);
    expect(
      code.filter(
        ({ mnemonic, operand }) => mnemonic === "LSR" && ["", "A"].includes(operand.toUpperCase()),
      ),
    ).toHaveLength(1);
    expect(jsrCount(assembly)).toBe(jsrCount(baseline.assembly));
  });

  it("negates a modular byte instead of calling multiplication for times 255", async () => {
    const { assembly } = await build([
      "let value: byte = peek($0400);",
      "poke($0420, value * byte(255));",
    ]);
    const code = instructions(assembly);
    const matches = code.filter(
      (step, index) =>
        step.mnemonic === "EOR" &&
        /^#(?:\$ff|255)$/iu.test(step.operand) &&
        code[index + 1]?.mnemonic === "CLC" &&
        code[index + 2]?.mnemonic === "ADC" &&
        /^#(?:\$0*1|1)$/iu.test(code[index + 2]!.operand),
    );
    expect(matches).toHaveLength(1);
    expect(assembly).not.toMatch(/^\s*jsr(?:\+\d+)?\s+\S*mul\S*/imu);
  });

  it("bounds a runtime byte shift count before a finite shift loop", async () => {
    const { assembly } = await build([
      "let value: byte = peek($0400); let count: byte = peek($0401);",
      "poke($0420, value << count);",
    ]);
    const code = instructions(assembly);
    expect(
      code.some(
        ({ mnemonic, operand }) =>
          ["CMP", "CPX", "CPY"].includes(mnemonic) && /^#(?:\$0*8|8)$/iu.test(operand),
      ),
    ).toBe(true);
    expect(code.some(({ mnemonic }) => mnemonic === "BEQ")).toBe(true);
    expect(
      code.some(
        ({ mnemonic }, index) =>
          mnemonic === "ASL" &&
          ["", "A"].includes(code[index]!.operand.toUpperCase()) &&
          ["DEX", "DEY"].includes(code[index + 1]?.mnemonic ?? "") &&
          code[index + 2]?.mnemonic === "BNE",
      ),
    ).toBe(true);
  });

  it("reuses one selected division call for stable quotient and remainder operands", async () => {
    const inputs = ["let left: byte = peek($0400); let right: byte = peek($0401);"];
    const identity = await build([
      ...inputs,
      "let quotient: byte = left; let remainder: byte = left;",
      "poke($0420, quotient); poke($0421, remainder);",
    ]);
    const quotientOnly = await build([
      ...inputs,
      "let quotient: byte = left / right; let remainder: byte = left;",
      "poke($0420, quotient); poke($0421, remainder);",
    ]);
    const pair = await build([
      ...inputs,
      "let quotient: byte = left / right; let remainder: byte = left % right;",
      "poke($0420, quotient); poke($0421, remainder);",
    ]);
    expect(jsrCount(quotientOnly.assembly) - jsrCount(identity.assembly)).toBe(1);
    expect(jsrCount(pair.assembly)).toBe(jsrCount(quotientOnly.assembly));
  });

  it("shares one byte multiply helper body across sequential mainline functions", async () => {
    const { assembly } = await build(
      [
        "poke($0420, first(peek($0400), peek($0401)));",
        "poke($0421, second(peek($0402), peek($0403)));",
      ],
      [
        "function first(left: byte, right: byte): byte { return left * right; }",
        "function second(left: byte, right: byte): byte { return left * right; }",
      ],
    );
    const code = instructions(assembly);
    const pattern = [
      "LDA",
      "LDX",
      "LSR",
      "BCC",
      "CLC",
      "ADC",
      "ROR",
      "ROR",
      "DEX",
      "BNE",
      "LDA",
      "RTS",
    ];
    const bodies = code.filter(
      (step, index) =>
        step.mnemonic === pattern[0] &&
        pattern.every((mnemonic, offset) => code[index + offset]?.mnemonic === mnemonic),
    );
    expect(bodies).toHaveLength(1);
    const targets = code.filter(({ mnemonic }) => mnemonic === "JSR").map(({ operand }) => operand);
    expect(targets.some((target) => targets.filter((other) => other === target).length >= 2)).toBe(
      true,
    );
  });

  it("uses the short subtractive chain for modular byte times seven", async () => {
    const { assembly } = await build([
      "let value: byte = peek($0400);",
      "poke($0420, value * byte(7));",
    ]);
    const code = instructions(assembly);
    const matches = code.filter(
      (step, index) =>
        step.mnemonic === "STA" &&
        [1, 2, 3].every(
          (offset) =>
            code[index + offset]?.mnemonic === "ASL" &&
            ["", "A"].includes(code[index + offset]!.operand.toUpperCase()),
        ) &&
        code[index + 4]?.mnemonic === "SEC" &&
        code[index + 5]?.mnemonic === "SBC" &&
        code[index + 5]?.operand === step.operand,
    );
    expect(matches).toHaveLength(1);
  });

  it("checks a word shift count's high byte before an accumulator X-loop", async () => {
    const { assembly } = await build([
      "let value: byte = peek($0400); let count: word = peekw($0401);",
      "poke($0420, value << count);",
    ]);
    const code = instructions(assembly);
    expect(
      code.some(
        (step, index) =>
          step.mnemonic === "LDY" &&
          code[index + 1]?.mnemonic === "BNE" &&
          code[index + 2]?.mnemonic === "LDX",
      ),
    ).toBe(true);
    expect(
      code.some(
        (step, index) =>
          step.mnemonic === "ASL" &&
          ["", "A"].includes(step.operand.toUpperCase()) &&
          code[index + 1]?.mnemonic === "DEX" &&
          code[index + 2]?.mnemonic === "BNE",
      ),
    ).toBe(true);
  });
});
