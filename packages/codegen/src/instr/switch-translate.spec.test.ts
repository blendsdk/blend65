/**
 * Specification test for switch IL→Instr translation.
 *
 * A lowered `switch` is a fused compare-chain over the multi-block CFG
 * keystone: each dispatch test loads the discriminant, compares it against its
 * case value, and branches on that compare's own flags — `BEQ` to the case
 * body, `JMP` to the next test. A dispatch test asks a question, so nothing
 * anywhere in the chain builds a 0/1 match flag to re-test.
 *
 * Derived exclusively from the switch/case/default/fallthrough semantics —
 * never from reading the implementation under test (immutable oracle).
 * Lowered end-to-end through the REAL frontend, then `lowerToIL → generateInstr →
 * printInstr`.
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
  it("translates a switch dispatch chain as fused compare-and-branch tests", () => {
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
    expect(hasErrors).toBe(false);
    // Function-unique, ASM-safe dispatch/body block labels.
    expect((text.match(/^Main_main_L\d+:/gm) ?? []).length).toBeGreaterThanOrEqual(2);
    // Each dispatch test compares the discriminant against its case value and
    // branches on the flags that compare just set — nothing stands between the
    // CMP and the branch, so no 0/1 match flag is built, stored or re-tested.
    //
    // A dispatch test's "no match" edge is the next test, which is also the
    // next block emitted, so it is reached by falling through and no jump is
    // written for it. The negative lookahead is the whole point of the shape:
    // a jump to the very next instruction is exactly what a hand-written
    // dispatch chain never contains.
    expect(text).toMatch(/CMP #\$01\n\s+BEQ Main_main_L\d+\n(?!\s+JMP)/);
    expect(text).toMatch(/CMP #\$02\n\s+BEQ Main_main_L\d+\n(?!\s+JMP)/);
  });
});
