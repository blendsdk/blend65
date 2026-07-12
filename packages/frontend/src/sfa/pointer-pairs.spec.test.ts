import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode } from "@blend65/core";
import type { AllocationPlan, DiagnosticBag, SemanticModel } from "@blend65/core";
import { lex, parse, analyze } from "../index.js";
import { modelNeedsPointerScratch, modelToFunctionInfo, modelToModuleVars } from "./model-adapter.js";
import { planAllocation } from "./plan-allocation.js";
import { C64_FIXTURE_PROFILE, frameVar, makeFn, structType } from "./test-fixtures.js";

/**
 * Specification tests for the zero-page pointer-pair surface (frozen spec
 * Ch 11 §4.2/§4.3/§4.7): each pair-accessed by-reference parameter gets a
 * named, interference-colored ZP pair overlaid onto the pointer pool;
 * sequential callees share pair addresses while nested ones stay disjoint;
 * pass-through-only and dead by-ref params get no pair; the tier-2 scratch
 * pair reserves exactly when the program can demand runtime pointer
 * formation; pointer-free programs keep a byte-identical ZP layout; and the
 * pool participates in the E10032 budget guard.
 *
 * Expectations derive from the frozen spec chapters — never from the
 * implementation. Models come from the real public path
 * (`lex`→`parse`→`analyze`); the planner runs directly, as every SFA suite does.
 */

/** Lexes + parses + analyzes `source`; expects an ERROR-free model (warnings ok). */
function analyzeClean(source: string): SemanticModel {
  const bag: DiagnosticBag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast } = parse({ tokens, source, sourceId: 1, bag });
  const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
  expect(bag.getErrors()).toEqual([]);
  return model;
}

/** Plans `source` through the adapter with the production input shape. */
function planOf(source: string): AllocationPlan {
  const model = analyzeClean(source);
  return planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars: modelToModuleVars(model),
      zpUserVars: [],
      upstreamErrors: false,
      needsPointerScratch: modelNeedsPointerScratch(model),
    },
    C64_FIXTURE_PROFILE,
    createDiagnosticBag(),
  );
}

/** The value of a named symbol definition, or `undefined`. */
function symValue(plan: AllocationPlan, name: string): number | undefined {
  return plan.symbolDefinitions.find((s) => s.name === name)?.value;
}

/** The pointer-category ZP allocations of a plan. */
function pointerAllocs(plan: AllocationPlan) {
  return plan.zpAllocations.filter((a) => a.category === "pointer");
}

const ENEMY = "struct Enemy { hp: byte; }";

describe("Specification: pair binding (ST-25..ST-28)", () => {
  it("ST-25: an accessed by-ref param gets a named 2-byte pair in the pointer category", () => {
    const plan = planOf(
      [
        "module Main;",
        ENEMY,
        "function damage(e: Enemy): void { e.hp = 0; }",
        "function main(): void { let boss: Enemy; damage(boss); }",
      ].join("\n"),
    );
    const pair = symValue(plan, "__zp_ptr_Main_damage_e");
    expect(pair).toBeDefined();
    const pool = pointerAllocs(plan);
    expect(pool.length).toBeGreaterThanOrEqual(1);
    for (const slot of pool) expect(slot.size).toBe(2);
    expect(pool.map((s) => s.address)).toContain(pair);
  });

  it("ST-26: sequential callees SHARE a pair address (2 pointer bytes for both)", () => {
    const plan = planOf(
      [
        "module Main;",
        ENEMY,
        "function f(s: Enemy): void { s.hp = 1; }",
        "function g(s: Enemy): void { s.hp = 2; }",
        "function main(): void { let a: Enemy; f(a); g(a); }",
      ].join("\n"),
    );
    const fPair = symValue(plan, "__zp_ptr_Main_f_s");
    const gPair = symValue(plan, "__zp_ptr_Main_g_s");
    expect(fPair).toBeDefined();
    expect(gPair).toBeDefined();
    expect(fPair).toBe(gPair);
  });

  it("ST-27: nested callees get DISJOINT pairs (6 pointer bytes across the chain)", () => {
    const plan = planOf(
      [
        "module Main;",
        ENEMY,
        "function h(s: Enemy): void { s.hp = 3; }",
        "function g(s: Enemy): void { s.hp = 2; h(s); }",
        "function f(s: Enemy): void { s.hp = 1; g(s); }",
        "function main(): void { let a: Enemy; f(a); }",
      ].join("\n"),
    );
    const pairs = [
      symValue(plan, "__zp_ptr_Main_f_s"),
      symValue(plan, "__zp_ptr_Main_g_s"),
      symValue(plan, "__zp_ptr_Main_h_s"),
    ];
    for (const p of pairs) expect(p).toBeDefined();
    expect(new Set(pairs).size).toBe(3);
    // Three simultaneously-live pairs: at least 6 pool bytes.
    const poolBytes = pointerAllocs(plan).reduce((n, a) => n + a.size, 0);
    expect(poolBytes).toBeGreaterThanOrEqual(6);
  });

  it("ST-28: pass-through-only and dead by-ref params get NO pair symbol", () => {
    const plan = planOf(
      [
        "module Main;",
        ENEMY,
        "function h(s: Enemy): void { s.hp = 3; }",
        "function relay(s: Enemy): void { h(s); }",
        "function dead(s: Enemy): void { let x: byte = 1; }",
        "function main(): void { let a: Enemy; relay(a); dead(a); }",
      ].join("\n"),
    );
    expect(symValue(plan, "__zp_ptr_Main_relay_s")).toBeUndefined();
    expect(symValue(plan, "__zp_ptr_Main_dead_s")).toBeUndefined();
    expect(symValue(plan, "__zp_ptr_Main_h_s")).toBeDefined();
  });
});

describe("Specification: the scratch pair (ST-29, ST-30)", () => {
  it("ST-29: by-ref params OR a >256-byte declared array each reserve __zp_ptr_scratch", () => {
    const byRef = planOf(
      [
        "module Main;",
        ENEMY,
        "function damage(e: Enemy): void { e.hp = 0; }",
        "function main(): void { let boss: Enemy; damage(boss); }",
      ].join("\n"),
    );
    expect(symValue(byRef, "__zp_ptr_scratch")).toBeDefined();

    const tier2 = planOf(
      [
        "module Main;",
        "let big: byte[300];",
        "function main(): void { big[260] = 1; }",
      ].join("\n"),
    );
    expect(symValue(tier2, "__zp_ptr_scratch")).toBeDefined();
    // No by-ref params anywhere: the scratch is the pool's ONLY slot.
    expect(pointerAllocs(tier2)).toHaveLength(1);
  });

  it("ST-30: a >256-byte CONST aggregate alone still reserves the scratch pair", () => {
    const plan = planOf(
      [
        "module Main;",
        "const TABLE: byte[300] = [1; 0];",
        "function main(): void { let w: word = 260; poke($C000, TABLE[w]); }",
      ].join("\n"),
    );
    expect(symValue(plan, "__zp_ptr_scratch")).toBeDefined();
    expect(pointerAllocs(plan)).toHaveLength(1);
  });
});

describe("Specification: golden safety & budget (ST-31..ST-33)", () => {
  it("ST-31: a pointer-free program's ZP layout is byte-identical to the prior-slice layout", () => {
    const plan = planOf(
      [
        "module Main;",
        "function add(a: byte, b: byte): byte { return a + b; }",
        "function main(): void { poke($C000, add(1, 2)); }",
      ].join("\n"),
    );
    // The exact 7a layout under the fixture profile: four main temps then the
    // two IRQ temps, packed from zpStart — no pointer category, no pairs.
    expect(plan.zpAllocations.map((a) => [a.name, a.address, a.size, a.category])).toEqual([
      ["__zp_tmp_0", 0x02, 1, "temp"],
      ["__zp_tmp_1", 0x03, 1, "temp"],
      ["__zp_tmp_2", 0x04, 1, "temp"],
      ["__zp_tmp_3", 0x05, 1, "temp"],
      ["__zp_irq_tmp_0", 0x06, 1, "irq-temp"],
      ["__zp_irq_tmp_1", 0x07, 1, "irq-temp"],
    ]);
    expect(plan.symbolDefinitions.some((s) => s.name.startsWith("__zp_ptr_"))).toBe(false);
  });

  it("ST-32: a ZP-budget-busting pair demand is E10032, exactly once", () => {
    // A 24-deep call chain, each function holding one accessed by-ref pair:
    // every chain member interferes with every other, so the pool needs
    // 24 × 2 = 48 bytes against the fixture's 46-byte budget.
    const fns = Array.from({ length: 24 }, (_, i) =>
      makeFn(`Main.f${i}`, {
        parameters: [frameVar("s", structType("S", 3), true)],
        callees: i < 23 ? [`Main.f${i + 1}`] : [],
      }),
    );
    const bag = createDiagnosticBag();
    planAllocation(
      { functions: fns, moduleVars: [], zpUserVars: [], upstreamErrors: false },
      C64_FIXTURE_PROFILE,
      bag,
    );
    const hits = bag.getAll().filter((d) => d.code === DiagCode.ZpBudgetExceeded);
    expect(hits).toHaveLength(1);
  });

  it("ST-33: a by-ref param occupies a 2-byte frame slot (its frame home)", () => {
    const plan = planOf(
      [
        "module Main;",
        ENEMY,
        "function damage(e: Enemy): void { e.hp = 0; }",
        "function main(): void { let boss: Enemy; damage(boss); }",
      ].join("\n"),
    );
    const frame = plan.frames.get("Main.damage");
    expect(frame).toBeDefined();
    const slot = frame!.frame.slots.find((s) => s.name === "e");
    expect(slot).toMatchObject({ kind: "parameter", size: 2, offset: 0 });
  });
});
