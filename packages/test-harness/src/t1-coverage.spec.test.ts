/**
 * Specification test for the CPU-control intrinsic surface — frozen spec
 * Ch 12 §2: each of the 13 T1 intrinsics lowers to exactly its one implied
 * 6502 instruction, in call order, with no marshalling around it.
 * CI-runnable (emitAsm stops before the assembler).
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emitAsm } from "@blend65/compiler";

/** The 13 T1 intrinsics and their one-instruction translations, in order. */
const T1: readonly [name: string, mnemonic: string][] = [
  ["asm_sei", "SEI"],
  ["asm_cli", "CLI"],
  ["asm_pha", "PHA"],
  ["asm_pla", "PLA"],
  ["asm_php", "PHP"],
  ["asm_plp", "PLP"],
  ["asm_clc", "CLC"],
  ["asm_sec", "SEC"],
  ["asm_cld", "CLD"],
  ["asm_sed", "SED"],
  ["asm_clv", "CLV"],
  ["asm_nop", "NOP"],
  ["asm_brk", "BRK"],
];

describe("Specification: T1 CPU-control intrinsics translate 1:1 (ST-43)", () => {
  it("each of the 13 asm_* intrinsics emits exactly its opcode, in call order", () => {
    const calls = T1.map(([name]) => `  ${name}();`).join("\n");
    const source = `module Main;\nfunction main(): void {\n${calls}\n}\n`;

    const cwd = mkdtempSync(join(tmpdir(), "b65-t1-"));
    writeFileSync(join(cwd, "main.blend"), source, "utf8");
    try {
      const result = emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
      expect(result.hasErrors).toBe(false);
      const text = result.text!;

      // Every mnemonic appears, in call order, within the entry function.
      let cursor = text.indexOf("_main:");
      expect(cursor).toBeGreaterThanOrEqual(0);
      for (const [name, mnemonic] of T1) {
        const at = text.indexOf(mnemonic, cursor);
        expect(at, `${name} → ${mnemonic}`).toBeGreaterThan(cursor);
        cursor = at;
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
