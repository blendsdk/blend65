/**
 * Specification tests for `zeropage {}` block semantics — frozen spec Ch 03
 * §2.3/§4.4. Zeropage fields are module variables with zero-page storage:
 * same namespace as every other top-level name (a duplicate rejects), always
 * mutable, placed by the allocator's user category inside the profile's ZP
 * range as zero-page equates. Multiple blocks — in one file or across a
 * module's files — merge. Initializers follow module-`let` parity: call-free
 * (a call-bearing initializer keeps the loud module-initializer rejection),
 * variable-reading initializers are legal and dependency-ordered into the
 * startup stream, and an uninitialized field generates NO startup code and
 * NO data image (its value is indeterminate). Exceeding the platform's ZP
 * budget rejects with E10032; nearing it warns W10030 at the profile
 * threshold (80% default). A string initializer keeps today's loud
 * rejection, and `export`/`let`/`const` inside a block are parse errors.
 *
 * Expectations derive from the frozen spec only. Programs run through the
 * real pipeline: `lex` → `parse` → `analyze` → projection → `planAllocation`.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { AllocationPlan, Diagnostic, ProgramNode, SemanticModel } from "@blend65/core";
import { lex, parse } from "../index.js";
import { analyze } from "../semantics/analyze.js";
import {
  modelNeedsPointerScratch,
  modelToFunctionInfo,
  modelToModuleVars,
  modelToZpUserVars,
} from "../sfa/model-adapter.js";
import { planAllocation } from "../sfa/plan-allocation.js";

/** Analyzes + plans sources through the real pipeline. */
function planReal(sources: string[]): {
  plan: AllocationPlan;
  model: SemanticModel;
  diags: Diagnostic[];
  hasErrors: boolean;
} {
  const bag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  const plan = planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars: modelToModuleVars(model),
      zpUserVars: modelToZpUserVars(model),
      upstreamErrors: bag.hasErrors(),
      needsPointerScratch: modelNeedsPointerScratch(model),
    },
    DEFAULT_PROFILE,
    bag,
  );
  return { plan, model, diags: bag.getAll(), hasErrors: bag.hasErrors() };
}

/** Every error-severity diagnostic code, in bag order. */
function errorCodes(diags: readonly Diagnostic[]): string[] {
  return diags.filter((d) => d.severity === "error").map((d) => d.code);
}

const MAIN = "function main(): void { }";

describe("zeropage placement & merging (ST-25..ST-27)", () => {
  it("ST-25: a zeropage field lands inside the profile ZP range as a zero-page equate", () => {
    const { plan, hasErrors } = planReal([
      ["module Main;", "zeropage { count: byte; }", MAIN].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const sym = plan.symbolDefinitions.find((s) => s.name === "__zp_Main_count");
    expect(sym).toBeDefined();
    expect(sym!.value).toBeGreaterThanOrEqual(DEFAULT_PROFILE.zpStart);
    expect(sym!.value).toBeLessThanOrEqual(DEFAULT_PROFILE.zpEnd);
    expect(sym!.zeroPage).toBe(true);
  });

  it("ST-26: two blocks across a module's files merge — both variables placed", () => {
    const { plan, hasErrors } = planReal([
      ["module Main;", "zeropage { a: byte; }", MAIN].join("\n"),
      ["module Main;", "zeropage { b: byte; }"].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(plan.symbolDefinitions.some((s) => s.name === "__zp_Main_a")).toBe(true);
    expect(plan.symbolDefinitions.some((s) => s.name === "__zp_Main_b")).toBe(true);
  });

  it("ST-27: a zeropage name colliding with any top-level name rejects (either order)", () => {
    const first = planReal([
      ["module Main;", "let n: byte = 0;", "zeropage { n: byte; }", MAIN].join("\n"),
    ]);
    expect(errorCodes(first.diags)).toContain(DiagCode.DuplicateDecl);

    const second = planReal([
      ["module Main;", "zeropage { m: byte; }", "let m: byte = 0;", MAIN].join("\n"),
    ]);
    expect(errorCodes(second.diags)).toContain(DiagCode.DuplicateDecl);
  });
});

describe("zeropage initializers (ST-28, ST-28b, ST-29, ST-33, ST-33b)", () => {
  it("ST-28: an initialized field joins the startup order", () => {
    const { model, hasErrors } = planReal([
      ["module Main;", "zeropage { c: byte = 7; }", MAIN].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(model.initOrder.some((s) => s.name === "c")).toBe(true);
  });

  it("ST-28b: a variable-reading initializer compiles and orders after its dependency", () => {
    const { model, hasErrors } = planReal([
      ["module Main;", "let base: byte = 6;", "zeropage { c: byte = base + 1; }", MAIN].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    const names = model.initOrder.map((s) => s.name);
    expect(names.indexOf("base")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("c")).toBeGreaterThan(names.indexOf("base"));
  });

  it("ST-29: an uninitialized field generates no startup entry and no RAM image", () => {
    const { model, hasErrors } = planReal([
      ["module Main;", "zeropage { raw: byte; }", MAIN].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(model.initOrder.some((s) => s.name === "raw")).toBe(false);
    expect(modelToModuleVars(model).some((v) => v.variableName === "raw")).toBe(false);
  });

  it("ST-33 (retired row): a string initializer now compiles and joins the startup order", () => {
    // Originally pinned the loud not-yet-supported rejection; string
    // initialisers now desugar into encoded bytes, so a zeropage field
    // initialises from a string like any other array initialiser.
    const { model, hasErrors } = planReal([
      ["module Main;", 'zeropage { msg: byte[6] = "HELLO\\0"; }', MAIN].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(model.initOrder.some((s) => s.name === "msg")).toBe(true);
  });

  it("ST-33b: a call-bearing initializer keeps the loud module-initializer rejection", () => {
    const { diags, hasErrors } = planReal([
      [
        "module Main;",
        "function seven(): byte { return 7; }",
        "zeropage { c: byte = seven(); }",
        MAIN,
      ].join("\n"),
    ]);
    expect(hasErrors).toBe(true);
    expect(diags.some((d) => d.message.includes("call-bearing module initializers"))).toBe(true);
  });
});

describe("zeropage budget (ST-30)", () => {
  it("ST-30: demand past the ZP budget rejects with E10032, once", () => {
    const { diags } = planReal([
      ["module Main;", "zeropage { big: byte[40]; }", MAIN].join("\n"),
    ]);
    const codes = errorCodes(diags);
    expect(codes.filter((c) => c === DiagCode.ZpBudgetExceeded)).toHaveLength(1);
  });

  it("ST-30: nearing the budget warns W10030 at the profile threshold without an error", () => {
    const { diags, hasErrors } = planReal([
      ["module Main;", "zeropage { big: byte[27]; }", MAIN].join("\n"),
    ]);
    expect(hasErrors).toBe(false);
    expect(diags.some((d) => d.code === DiagCode.LargeZpAllocation)).toBe(true);
  });
});

describe("zeropage block negative surface (ST-33c)", () => {
  it("ST-33c: export / let / const keywords inside a block are parse errors", () => {
    for (const bad of [
      "zeropage { export x: byte; }",
      "zeropage { let x: byte; }",
      "zeropage { const x: byte = 1; }",
    ]) {
      const { hasErrors } = planReal([["module Main;", bad, MAIN].join("\n")]);
      expect(hasErrors, bad).toBe(true);
    }
  });
});
