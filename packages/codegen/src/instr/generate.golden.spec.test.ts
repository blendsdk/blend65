/**
 * End-to-end golden tests for RD-07b (ST-G1..G3) — the slice's runtime-verifiable
 * anchor (07-testing-strategy.md; AC-18).
 *
 * Each test drives a **real RD-06 lowering fixture** through the full back-end
 * pipeline — `lowerToIL` → `generateInstr` → `printInstr` — and asserts the exact
 * canonical ACME text. The inputs are genuine IL built by `lowerToIL` over a
 * fixture AST/model/plan (not hand-faked Instr), so these prove the slice not only
 * compiles but produces correct, deterministic 6502 for the live op set.
 *
 * Expected text is derived from RD-07 §4 + the component specs (03-01/03-03) + ACME
 * syntax + the D10 fold value-flow model, NOT by running the translator.
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
  // ST-G1 — `add(a, b)` (§4.7) → folded LDA/CLC/ADC, result returned in A.
  it("lowers and generates an 8-bit add function (ST-G1)", () => {
    const { text, bag } = pipeline(addFixture);
    expect(text).toBe(
      [
        "Math.add:",
        "    LDA __frame_Math_add_a",
        "    CLC",
        "    ADC __frame_Math_add_b",
        "    RTS",
      ].join("\n"),
    );
    expect(bag.hasErrors()).toBe(false);
  });

  // ST-G2 — `let c = 5; poke($D020, c)` → const/store/load/store to the address.
  it("lowers and generates a let + poke function (ST-G2)", () => {
    const { text, bag } = pipeline(slice2Fixture);
    expect(text).toBe(
      [
        "Main.main:",
        "    LDA #$05",
        "    STA __frame_Main_main_c",
        "    LDA __frame_Main_main_c",
        "    STA $D020",
        "    RTS",
      ].join("\n"),
    );
    expect(bag.hasErrors()).toBe(false);
  });

  // ST-G3 — `return a == b` → CMP-based 0/1 materialisation, result returned in A.
  it("lowers and generates a comparison-returning function (ST-G3)", () => {
    const { text, bag } = pipeline(eqFixture);
    expect(text).toBe(
      [
        "Math.eq:",
        "    LDA __frame_Math_eq_a",
        "    CMP __frame_Math_eq_b",
        "    LDA #$01",
        "    BEQ _cmp0",
        "    LDA #$00",
        "_cmp0:",
        "    RTS",
      ].join("\n"),
    );
    expect(bag.hasErrors()).toBe(false);
  });
});
