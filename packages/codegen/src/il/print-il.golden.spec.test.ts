/**
 * Golden-snapshot tests for RD-06 IL textual form (AR-22 tier 2; AC-18).
 *
 * These pin the byte-exact `printIL` output of the canonical programs — the §4.7
 * `add`, the gate program, and the slice-2 program — as Vitest inline snapshots.
 * They cover ST-L1/L2/L3 and ST-P1 from the golden angle (07-testing-strategy.md)
 * so any unintended change to lowering or the printer is caught as a snapshot
 * diff (R55: a deliberate change requires an intentional snapshot update).
 *
 * Derived from the goldens in 03-02-lowering.md (D8 verbatim params; D9 symbolic
 * poke/peek address). The lowering is driven through the public fixtures.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag } from "@blend65/core";

import { lowerToIL } from "./lower.js";
import { printIL } from "./print-il.js";
import { addFixture, gateFixture, slice2Fixture } from "./test-fixtures.js";

describe("Golden: RD-06 printIL canonical programs (AC-18)", () => {
  it("gate program (poke(0xD020, 5)) — ST-L1/AC-11", () => {
    const text = printIL(lowerToIL(gateFixture, createDiagnosticBag()));
    expect(text).toMatchInlineSnapshot(`
      "function Main.main(): void {
      _entry:
        store 5, $D020
        ret
      }"
    `);
  });

  it("slice-2 program (let c: byte = 5; poke(0xD020, c)) — ST-L2", () => {
    const text = printIL(lowerToIL(slice2Fixture, createDiagnosticBag()));
    expect(text).toMatchInlineSnapshot(`
      "function Main.main(): void {
      _entry:
        %0 = const i8u 5
        store %0, __frame_Main_main_c
        %1 = load i8u __frame_Main_main_c
        store %1, $D020
        ret
      }"
    `);
  });

  it("§4.7 add(a, b) — ST-L3/ST-P1", () => {
    const text = printIL(lowerToIL(addFixture, createDiagnosticBag()));
    expect(text).toMatchInlineSnapshot(`
      "function Math.add(__frame_Math_add_a: i8u, __frame_Math_add_b: i8u): i8u {
      _entry:
        %0 = load i8u __frame_Math_add_a
        %1 = load i8u __frame_Math_add_b
        %2 = add i8u %0, %1
        ret %2
      }"
    `);
  });
});
