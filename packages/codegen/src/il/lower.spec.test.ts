/**
 * Specification tests for RD-06 AST→IL lowering (ST-L1..L10).
 *
 * Derived EXCLUSIVELY from plans/rd-06-il-optimizer/07-testing-strategy.md
 * (ST-L1..L10), 03-02-lowering.md (the gate/slice-2/§4.7 goldens, as corrected
 * by registers D8 — verbatim header params — and D9 — poke/peek address lowers
 * to a symbolic `location`), and RD-06 R29/R42/R46/R68/R69 — NOT from
 * implementation logic.
 *
 * Spec-tests-first (testing.md Rule 10): authored before `lower.ts`/`builder.ts`
 * exist, expected to FAIL first (red), then PASS (green). Immutable oracle — a
 * post-implementation failure means the implementation is wrong, not this test.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, IceCode } from "@blend65/core";

import { printIL } from "./print-il.js";
import { lowerToIL } from "./lower.js";
import {
  addFixture,
  errorFixture,
  gateFixture,
  letNoInitFixture,
  slice2Fixture,
  unsupportedFixture,
} from "./test-fixtures.js";

/** The exact gate golden (03-02; D9 — address is a symbolic location `$D020`). */
const GATE_GOLDEN = [
  "function Main.main(): void {",
  "_entry:",
  "  store 5, $D020",
  "  ret",
  "}",
].join("\n");

/** The exact slice-2 golden (03-02; D9). */
const SLICE2_GOLDEN = [
  "function Main.main(): void {",
  "_entry:",
  "  %0 = const i8u 5",
  "  store %0, __frame_Main_main_c",
  "  %1 = load i8u __frame_Main_main_c",
  "  store %1, $D020",
  "  ret",
  "}",
].join("\n");

/** The exact §4.7 golden (03-02; D8 — verbatim frame-slot param symbols). */
const ADD_GOLDEN = [
  "function Math.add(__frame_Math_add_a: i8u, __frame_Math_add_b: i8u): i8u {",
  "_entry:",
  "  %0 = load i8u __frame_Math_add_a",
  "  %1 = load i8u __frame_Math_add_b",
  "  %2 = add i8u %0, %1",
  "  ret %2",
  "}",
].join("\n");

describe("Specification: RD-06 lowerToIL (§3.5/§4.7)", () => {
  // ST-L1 — gate program → gate golden.
  it("should lower the gate program to the gate golden (ST-L1, R46/AC-11)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(gateFixture, bag);
    expect(printIL(program)).toBe(GATE_GOLDEN);
    expect(bag.getAll()).toHaveLength(0);
  });

  // ST-L2 — slice-2 program → slice-2 golden.
  it("should lower the slice-2 program to the slice-2 golden (ST-L2, R29/R46)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(slice2Fixture, bag);
    expect(printIL(program)).toBe(SLICE2_GOLDEN);
    expect(bag.getAll()).toHaveLength(0);
  });

  // ST-L3 — §4.7 add function → §4.7 golden.
  it("should lower add(a,b) to the §4.7 golden (ST-L3, R18/R33/R42/§4.7)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(addFixture, bag);
    expect(printIL(program)).toBe(ADD_GOLDEN);
    expect(bag.getAll()).toHaveLength(0);
  });

  // ST-L4 — LetDecl without initialiser emits no IL for the declaration.
  it("should emit no IL for an initialiser-less let (ST-L4, R30)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(letNoInitFixture, bag);
    expect(printIL(program)).toBe(
      ["function Main.main(): void {", "_entry:", "  ret", "}"].join("\n"),
    );
    expect(bag.getAll()).toHaveLength(0);
  });

  // ST-L5 — an unsupported node (IfStmt) → exactly one E90001 ICE; never throws.
  it("should record exactly one E90001 ICE for an unsupported node (ST-L5, R69/D6)", () => {
    const bag = createDiagnosticBag();
    expect(() => lowerToIL(unsupportedFixture, bag)).not.toThrow();
    const ices = bag.getAll().filter((d) => d.code === IceCode.Unexpected);
    expect(ices).toHaveLength(1);
  });

  // ST-L6 — a function carrying ErrorType is skipped (absent from functions).
  it("should skip an ErrorType-carrying function (ST-L6, R68)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(errorFixture, bag);
    expect(program.functions).toHaveLength(0);
  });

  // ST-L7 — empty program → empty ILProgram.
  it("should lower an empty program to an empty ILProgram (ST-L7, D5)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(
      { program: [], model: gateFixture.model, plan: gateFixture.plan },
      bag,
    );
    expect(program.functions).toEqual([]);
    expect(program.initCode).toEqual([]);
    expect(program.constData).toEqual([]);
  });

  // ST-L8 — BinaryExpr evaluates left before right (instruction order).
  it("should lower BinaryExpr left-operand before right-operand (ST-L8, R33/FN-10)", () => {
    const bag = createDiagnosticBag();
    const text = printIL(lowerToIL(addFixture, bag));
    const leftIdx = text.indexOf("%0 = load i8u __frame_Math_add_a");
    const rightIdx = text.indexOf("%1 = load i8u __frame_Math_add_b");
    expect(leftIdx).toBeGreaterThanOrEqual(0);
    expect(rightIdx).toBeGreaterThan(leftIdx);
  });

  // ST-L9 — lowering the same fixture twice is byte-identical (determinism).
  it("should be deterministic across repeated lowerings (ST-L9, R53/R61)", () => {
    const a = printIL(lowerToIL(slice2Fixture, createDiagnosticBag()));
    const b = printIL(lowerToIL(slice2Fixture, createDiagnosticBag()));
    expect(a).toBe(b);
  });

  // ST-L10 — signature: accepts LowerInput {program,model,plan}, returns ILProgram.
  it("should accept a LowerInput and return an ILProgram (ST-L10, AC-01/D4)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(
      { program: gateFixture.program, model: gateFixture.model, plan: gateFixture.plan },
      bag,
    );
    expect(program.allocationPlan).toBe(gateFixture.plan);
    expect(Array.isArray(program.functions)).toBe(true);
  });
});
