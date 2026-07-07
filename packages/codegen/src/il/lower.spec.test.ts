/**
 * Specification tests for AST→IL lowering.
 *
 * Derived exclusively from the documented gate/slice-2/add-function goldens
 * (verbatim header params for frame-slot symbols; poke/peek address lowers to
 * a symbolic `location`) — not from implementation logic.
 *
 * Spec-tests-first: authored before `lower.ts`/`builder.ts` exist, expected to
 * fail first (red), then pass (green). Immutable oracle — a post-implementation
 * failure means the implementation is wrong, not this test.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, IceCode } from "@blend65/core";
import type { ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";

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

/** The exact gate golden (the address is a symbolic location `$D020`). */
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

/** The exact add-function golden (verbatim frame-slot param symbols). */
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
  // Gate program → gate golden.
  it("should lower the gate program to the gate golden (ST-L1, R46/AC-11)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(gateFixture, bag);
    expect(printIL(program)).toBe(GATE_GOLDEN);
    expect(bag.getAll()).toHaveLength(0);
  });

  // Slice-2 program → slice-2 golden.
  it("should lower the slice-2 program to the slice-2 golden (ST-L2, R29/R46)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(slice2Fixture, bag);
    expect(printIL(program)).toBe(SLICE2_GOLDEN);
    expect(bag.getAll()).toHaveLength(0);
  });

  // Add function → the add-function golden.
  it("should lower add(a,b) to the §4.7 golden (ST-L3, R18/R33/R42/§4.7)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(addFixture, bag);
    expect(printIL(program)).toBe(ADD_GOLDEN);
    expect(bag.getAll()).toHaveLength(0);
  });

  // LetDecl without initialiser emits no IL for the declaration.
  it("should emit no IL for an initialiser-less let (ST-L4, R30)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(letNoInitFixture, bag);
    expect(printIL(program)).toBe(
      ["function Main.main(): void {", "_entry:", "  ret", "}"].join("\n"),
    );
    expect(bag.getAll()).toHaveLength(0);
  });

  // An unsupported node (fallthrough — a switch-only statement that, bare
  // and out of any switch, is not lowered) → exactly one E90001 ICE; never throws.
  it("should record exactly one E90001 ICE for an unsupported node (ST-L5, R69/D6)", () => {
    const bag = createDiagnosticBag();
    expect(() => lowerToIL(unsupportedFixture, bag)).not.toThrow();
    const ices = bag.getAll().filter((d) => d.code === IceCode.Unexpected);
    expect(ices).toHaveLength(1);
  });

  // A function carrying ErrorType is skipped (absent from functions).
  it("should skip an ErrorType-carrying function (ST-L6, R68)", () => {
    const bag = createDiagnosticBag();
    const program = lowerToIL(errorFixture, bag);
    expect(program.functions).toHaveLength(0);
  });

  // Empty program → empty ILProgram.
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

  // BinaryExpr evaluates left before right (instruction order).
  it("should lower BinaryExpr left-operand before right-operand (ST-L8, R33/FN-10)", () => {
    const bag = createDiagnosticBag();
    const text = printIL(lowerToIL(addFixture, bag));
    const leftIdx = text.indexOf("%0 = load i8u __frame_Math_add_a");
    const rightIdx = text.indexOf("%1 = load i8u __frame_Math_add_b");
    expect(leftIdx).toBeGreaterThanOrEqual(0);
    expect(rightIdx).toBeGreaterThan(leftIdx);
  });

  // Lowering the same fixture twice is byte-identical (determinism).
  it("should be deterministic across repeated lowerings (ST-L9, R53/R61)", () => {
    const a = printIL(lowerToIL(slice2Fixture, createDiagnosticBag()));
    const b = printIL(lowerToIL(slice2Fixture, createDiagnosticBag()));
    expect(a).toBe(b);
  });

  // Signature: accepts LowerInput {program,model,plan}, returns ILProgram.
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

// ───────────────────────────────────────────────────────────────────────────
// Width-aware lowering + module-var access
// ───────────────────────────────────────────────────────────────────────────

/**
 * Lowers `source` end-to-end through the real frontend (lex → parse → analyze →
 * planAllocation) so the model carries a populated `typeMap`/`symbolMap` and the
 * plan carries real frames + module vars — the conditions width-aware lowering
 * and module-var access depend on. Returns the printed IL + the bag.
 */
function lowerRealSource(source: string): { text: string; hasErrors: boolean } {
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
  return { text: printIL(il), hasErrors: bag.hasErrors() };
}

describe("Specification: RD-18 Slice 3b width-aware lowering (FR-7)", () => {
  // A word literal lowers to an i16u immediate (not i8u).
  it("should lower a word literal to an i16u immediate (ST-13, AR-8)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nfunction main(): void { let x: word = 300; pokew(0xC000, x); }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("const i16u 300"); // was byte-hardcoded before the fix
  });

  // A word * word binary result is i16u (translate maps i16u mul → __rt_mul16).
  it("should type a word*word multiply result as i16u (ST-14)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nlet accW: word;\nfunction main(): void {" +
        " let x: word = 300; let y: word = 2; accW = x * y; }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("mul i16u");
  });

  // A module-scope variable lowers to load/store against its __var_* symbol.
  it("should lower a module variable to load/store __var_* (ST-15)", () => {
    const { text, hasErrors } = lowerRealSource(
      "module Main;\nlet accB: byte;\nfunction main(): void {" +
        " let a: byte = 5; accB = a; poke(0xC000, accB); }\n",
    );
    expect(hasErrors).toBe(false);
    expect(text).toContain("store %"); // rhs materialised then stored
    expect(text).toContain("__var_Main_accB"); // module-var symbol (store + load)
    expect(text).toContain("load i8u __var_Main_accB");
  });
});
