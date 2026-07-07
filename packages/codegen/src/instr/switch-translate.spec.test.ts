/**
 * Specification test for RD-18 Slice 4b switch IL→Instr translation (ST-17).
 *
 * A lowered `switch` (a `brcond` compare-chain over the 4a multi-block CFG
 * keystone) must translate through the EXISTING `translate.ts` with **zero** new
 * terminator kinds and **zero** new translate work (AR-1): `br`→`JMP`,
 * `brcond`→`BNE`/`JMP`, and each `eq` compare uses the DEF-1-corrected form
 * (branch on the fresh `CMP` flag before materialising 0/1).
 *
 * Derived EXCLUSIVELY from the plan (03-02-switch-lowering.md §3, AR-1/AR-13) +
 * the DEF-1/AR-16 fix — NEVER from reading the implementation (immutable oracle).
 * Lowered end-to-end through the REAL frontend, then `lowerToIL → generateInstr →
 * printInstr`. Spec-tests-first: `SwitchStmt` ICEs today — RED first, then GREEN.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import { analyze, lex, modelToFunctionInfo, modelToModuleVars, parse, planAllocation } from "@blend65/frontend";
import { lowerToIL } from "../il/lower.js";
import { generateInstr } from "./instr-program.js";
import { printInstr } from "./print-instr.js";

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

describe("Specification: RD-18 Slice 4b switch translate (ST-17, AR-1/AR-13)", () => {
  it("translates a switch dispatch chain with no new terminator, DEF-1 eq form", () => {
    const { text, hasErrors } = asmRealSource(
      "module Main;\nfunction main(): void {\n" +
        "  let x: byte = 2;\n" +
        "  switch (x) {\n" +
        "    case 1: poke(0xC000, 1);\n" +
        "    case 2: poke(0xC000, 2);\n" +
        "    default: poke(0xC000, 0);\n" +
        "  }\n" +
        "}\n",
    );
    // No ICE — the existing terminator set (br/brcond) suffices (AR-1).
    expect(hasErrors).toBe(false);
    // Function-unique, ASM-safe dispatch/body block labels.
    expect((text.match(/^Main_main_L\d+:/gm) ?? []).length).toBeGreaterThanOrEqual(2);
    // The discriminant is compared per case value.
    expect(text).toContain("CMP");
    // eq's DEF-1 form: branch on the fresh compare flag (BEQ) before materialising.
    expect(text).toContain("BEQ");
    // brcond → BNE (true target) + JMP (false target / br).
    expect(text).toContain("BNE");
    expect(text).toContain("JMP");
  });
});
