/**
 * Specification tests for RD-18 Slice 4a multi-block IL→Instr translation
 * (`translate.ts`; ST-16..ST-18).
 *
 * Expectations derive EXCLUSIVELY from the plan (03-03-multiblock-translate.md
 * §1/§2, FR-9) + the Ambiguity Register (AR-11/AR-13) — NEVER from reading the
 * implementation (immutable oracle). Each program is lowered end-to-end through
 * the REAL frontend, then run `lowerToIL → generateInstr → printInstr` (the same
 * back-end pipeline as `generate.golden.spec.test.ts`, without the compiler
 * facade) to render ACME text. Byte-exact goldens live in Phase 4; here the ASM is
 * inspected structurally. Spec-tests-first: `br`/`brcond` ICE today — RED first.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import { analyze, lex, modelToFunctionInfo, modelToModuleVars, parse, planAllocation } from "@blend65/frontend";
import { lowerToIL } from "./lower.js";
import { generateInstr } from "../instr/instr-program.js";
import { printInstr } from "../instr/print-instr.js";
import { slice2Fixture } from "./test-fixtures.js";

/** Real frontend → lowerToIL → generateInstr → printInstr; returns ACME text + bag state. */
function asmRealSource(source: string): { text: string; hasErrors: boolean } {
  const bag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast }: { ast: ProgramNode } = parse({ tokens, source, sourceId: 1, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  const plan = planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars: modelToModuleVars(model),
      zpUserVars: [],
      upstreamErrors: bag.hasErrors(),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: [ast], model, plan }, bag);
  const program = generateInstr(il, "nmos6502", bag);
  return { text: program.streams.map(printInstr).join("\n"), hasErrors: bag.hasErrors() };
}

/** A 6502 conditional branch mnemonic appears in the text. */
function hasConditionalBranch(text: string): boolean {
  return /\b(BNE|BEQ|BCC|BCS|BPL|BMI)\b/.test(text);
}

describe("Specification: RD-18 Slice 4a multi-block translate (FR-9)", () => {
  // ST-16 — the if/else program → ≥2 block labels + a JMP (br) + a conditional branch.
  it("should translate if/else to block labels + JMP + a branch (ST-16, §1/§2)", () => {
    const { text, hasErrors } = asmRealSource(
      "module Main;\nfunction main(): void { let n: byte = 1;" +
        " if (n > 0) { poke(0xC000, 1); } else { poke(0xC000, 2); } }\n",
    );
    expect(hasErrors).toBe(false);
    // Function-unique, ASM-safe block labels (Module_function prefix).
    expect((text.match(/^Main_main_L\d+:/gm) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(text).toContain("JMP"); // br → JMP
    expect(hasConditionalBranch(text)).toBe(true); // brcond → conditional branch
  });

  // ST-17 — the while program → a back-edge JMP to the cond label + a conditional branch.
  it("should translate while to a back-edge JMP + a branch (ST-17, §2)", () => {
    const { text, hasErrors } = asmRealSource(
      "module Main;\nfunction main(): void { let n: byte = 1;" +
        " while (n > 0) { n = n - 1; } }\n",
    );
    expect(hasErrors).toBe(false);
    // The body back-edges to the cond block via an absolute JMP to its label.
    expect(text).toMatch(/JMP\s+Main_main_L\d+/);
    expect(hasConditionalBranch(text)).toBe(true);
  });

  // ST-18 — a straight-line function is byte-identical to the pre-4a single-block
  // output (the multi-block loop degenerates for a single `_entry` block).
  it("should keep straight-line output byte-identical (ST-18, §5 / AR-13)", () => {
    const bag = createDiagnosticBag();
    const il = lowerToIL(slice2Fixture, bag);
    const program = generateInstr(il, "nmos6502", bag);
    const text = program.streams.map(printInstr).join("\n");
    expect(bag.hasErrors()).toBe(false);
    expect(text).toBe(
      [
        "_main:",
        "    LDA #$05",
        "    STA __frame_Main_main_c",
        "    LDA __frame_Main_main_c",
        "    STA $D020",
        "    RTS",
      ].join("\n"),
    );
    // No non-entry block labels for a straight-line function.
    expect(text).not.toMatch(/^_L\d+:/m);
    expect(text).not.toMatch(/^\w+_\w+_L\d+:/m);
  });
});
