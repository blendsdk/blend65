import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

const expert = JSON.parse(
  await readFile(fileURLToPath(new URL("./expert/aggregates.json", import.meta.url)), "utf8"),
) as {
  unsignedByteIndexLoad: { bytes: number; maxCycles: number; pointerScratchBytes: number };
  constantByteIndexLoad: { bytes: number; cycles: number; pointerScratchBytes: number };
  checkedWordIndexLoad: { bytes: number; maxCycles: number; pointerScratchBytes: number };
};

/** Keep the local array-read core separate from setup and the later screen write. */
describe("expert static byte-array output", () => {
  it("uses native absolute indexed access for a runtime byte ordinal", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-expert-aggregate-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "expert-aggregate",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        "module Game; const DATA: byte[4] = [1, 2, 3, 4]; function main(): void { let index: byte = peek($0400); poke($0420, DATA[index]); poke($0421, DATA[2]); }",
      );
      const built = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expert aggregate fixture did not build");
      const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
      const memory = await readFile(join(built.generation.directory, ".memory.json"), "utf8");
      expect(memory).not.toContain("aggregate-address");
      expect(memory).not.toContain("aggregate-index-candidate");
      const instructions = assembly
        .split(/\r?\n/u)
        .map((line) => /^\s*([a-z]{3})(?:\+([12]))?\s+(.+?)\s*$/iu.exec(line))
        .filter((match) => match !== null)
        .map((match) => ({
          opcode: match[1]!.toLowerCase(),
          width: Number(match[2] ?? 0),
          operand: match[3]!,
        }));
      const direct = instructions.findIndex(
        ({ opcode }, index) =>
          opcode === "ldy" &&
          instructions[index + 1]?.opcode === "lda" &&
          instructions[index + 1]?.width === 2 &&
          instructions[index + 1]?.operand.endsWith(",y"),
      );
      expect(direct).toBeGreaterThanOrEqual(0);
      const indexLoad = instructions[direct]!;
      expect(indexLoad.width + 1 + 3).toBeLessThanOrEqual(expert.unsignedByteIndexLoad.bytes);
      expect((indexLoad.width === 1 ? 3 : 4) + 5).toBeLessThanOrEqual(
        expert.unsignedByteIndexLoad.maxCycles,
      );
      expect(expert.unsignedByteIndexLoad.pointerScratchBytes).toBe(0);
      const fixed = instructions.find(
        ({ opcode, operand }) =>
          opcode === "lda" &&
          operand.includes("b65_") &&
          operand.includes("$0002") &&
          !operand.endsWith(",y"),
      );
      expect(fixed?.width + 1).toBe(expert.constantByteIndexLoad.bytes);
      expect(expert.constantByteIndexLoad.bytes).toBe(3);
      expect(expert.constantByteIndexLoad.cycles).toBe(4);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("scales a checked static word index without a zero-page pointer", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-expert-word-array-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "expert-word-array",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
          boundsCheck: true,
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        "module Game; const DATA: word[4] = [$1234, $5678, $9ABC, $DEF0]; function main(): void { let index: byte = peek($0400); pokew($0420, DATA[index]); }",
      );
      const built = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected a checked word-array build");
      const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
      const memory = await readFile(join(built.generation.directory, ".memory.json"), "utf8");
      expect(memory).not.toContain("aggregate-address");
      expect(memory).not.toContain("aggregate-index-candidate");
      const core = assembly.match(
        /^\s*lda\+2\s+[^\n]+\n\s*asl\s*\n\s*tay\s*\n\s*lda\+2\s+[^\n]+,y\s*\n\s*sta\+2\s+[^\n]+\n\s*iny\s*\n\s*lda\+2\s+[^\n]+,y\s*\n\s*sta\+2\s+[^\n]+/imu,
      );
      expect(core).not.toBeNull();
      const widths = core![0]
        .trim()
        .split(/\n/u)
        .map((line) => (line.includes("+2") ? 3 : 1));
      expect(widths.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(
        expert.checkedWordIndexLoad.bytes,
      );
      expect([4, 2, 2, 5, 4, 2, 5, 4].reduce((sum, cycles) => sum + cycles, 0)).toBeLessThanOrEqual(
        expert.checkedWordIndexLoad.maxCycles,
      );
      expect(expert.checkedWordIndexLoad.pointerScratchBytes).toBe(0);
    } finally {
      await rm(root, { recursive: true });
    }
  });
});
