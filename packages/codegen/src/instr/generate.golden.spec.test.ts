/**
 * End-to-end golden tests — the runtime-verifiable anchor for this stage of
 * the back end.
 *
 * Each test drives a **real lowering fixture** through the full back-end
 * pipeline — `lowerToIL` → `generateInstr` → `printInstr` — and asserts the exact
 * canonical ACME text. The inputs are genuine IL built by `lowerToIL` over a
 * fixture AST/model/plan (not hand-faked Instr), so these prove the pipeline not only
 * compiles but produces correct, deterministic 6502 for the live op set.
 *
 * Expected text is derived from the specification and ACME syntax and the fold
 * value-flow model, NOT by running the translator.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag } from "@blend65/core";

import { lowerToIL } from "../il/lower.js";
import { addFixture, eqFixture, slice2Fixture } from "../il/test-fixtures.js";
import { printInstr } from "./print-instr.js";
import { generateInstr } from "./instr-program.js";

/** Lower a fixture to IL, generate Instr, and render every stream to ACME text. */
function pipeline(fixture: Parameters<typeof lowerToIL>[0]): {
  text: string;
  bag: ReturnType<typeof createDiagnosticBag>;
} {
  const bag = createDiagnosticBag();
  const il = lowerToIL(fixture, bag);
  const program = generateInstr(il, "nmos6502", bag);
  return { text: program.streams.map(printInstr).join("\n"), bag };
}

describe("Specification: RD-07b end-to-end goldens (ST-G1..G3)", () => {
  // `add(a, b)` → folded LDA/CLC/ADC, result returned in A.
  it("lowers and generates an 8-bit add function (ST-G1)", () => {
    const { text, bag } = pipeline(addFixture);
    expect(text).toBe(
      [
        "Math_add:",
        "    LDA __frame_Math_add_a",
        "    CLC",
        "    ADC __frame_Math_add_b",
        "    RTS",
      ].join("\n"),
    );
    expect(bag.hasErrors()).toBe(false);
  });

  // `let c = 5; poke($D020, c)` → const/store/load/store to the address.
  it("lowers and generates a let + poke function (ST-G2)", () => {
    const { text, bag } = pipeline(slice2Fixture);
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
    expect(bag.hasErrors()).toBe(false);
  });

  // `return a == b` → CMP-based 0/1 materialisation, result returned in A.
  // The Z-based branch follows CMP directly: an LDA between CMP and BEQ clobbers
  // Z, so the compare materialises via branch-first / fall-through.
  it("lowers and generates a comparison-returning function (ST-G3)", () => {
    const { text, bag } = pipeline(eqFixture);
    expect(text).toBe(
      [
        "Math_eq:",
        "    LDA __frame_Math_eq_a",
        "    CMP __frame_Math_eq_b",
        "    BEQ _cmp0",
        "    LDA #$00",
        "    JMP _cmp1",
        "_cmp0:",
        "    LDA #$01",
        "_cmp1:",
        "    RTS",
      ].join("\n"),
    );
    expect(bag.hasErrors()).toBe(false);
  });
});
