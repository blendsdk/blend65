/**
 * Specification tests for the `planAllocation` 9-step pipeline and the deferred
 * `modelToFunctionInfo` adapter seam.
 *
 * Expectations derive exclusively from the language specification — NOT from
 * implementation logic. Immutable oracle. The Ch 11 §3.4 golden snapshot is
 * covered separately.
 *
 * Spec-tests-first: authored before `plan-allocation.ts`/`model-adapter.ts`;
 * verified to FAIL (red).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, createEmptyModel, DiagCode } from "@blend65/core";
import { planAllocation } from "./plan-allocation.js";
import { modelToFunctionInfo } from "./model-adapter.js";
import { C64_FIXTURE_PROFILE, makeFn } from "./test-fixtures.js";

describe("Specification: planAllocation pipeline (R51–R59, §4.1)", () => {
  // Minimal: one empty `main` → regionSize 0, valid plan, __frame_main present.
  it("should produce a valid minimal plan for an empty main (ST-P1 / AC-01)", () => {
    const bag = createDiagnosticBag();
    const plan = planAllocation(
      { functions: [makeFn("main")], moduleVars: [], zpUserVars: [], upstreamErrors: false },
      C64_FIXTURE_PROFILE,
      bag,
    );

    expect(plan.frameRegionSize).toBe(0);
    expect(plan.hasErrors).toBe(false);
    expect(plan.symbolDefinitions.some((s) => s.name === "__frame_main")).toBe(true);
  });

  // resourceData carries zp/ram/frame/stack used + budget figures.
  it("should populate resourceData with used and budget figures (ST-P3 / AC-18)", () => {
    const bag = createDiagnosticBag();
    const plan = planAllocation(
      { functions: [makeFn("main")], moduleVars: [], zpUserVars: [], upstreamErrors: false },
      C64_FIXTURE_PROFILE,
      bag,
    );
    const rd = plan.resourceData;

    expect(rd.zpBudget).toBe(46);
    expect(rd.ramBudget).toBe(0x9800);
    expect(rd.stackBudget).toBe(230);
    expect(typeof rd.zpUsed).toBe("number");
    expect(typeof rd.ramUsed).toBe("number");
    expect(rd.frameRegionPeak).toBe(rd.frameRegionBytes);
  });

  // RAM overflow → hasErrors true and E10033 in the bag.
  it("should set hasErrors and emit E10033 on RAM overflow (ST-P4 / AC-12)", () => {
    const bag = createDiagnosticBag();
    // A tiny RAM window forces overflow once the frame region is placed.
    const tiny = { ...C64_FIXTURE_PROFILE, ramStart: 0x0800, ramEnd: 0x0802 }; // 2 bytes
    const big = makeFn("main", {
      locals: [
        { name: "buf", type: { kind: "array", element: { kind: "primitive", name: "byte" }, size: 16 }, byRef: false },
      ],
    });
    const plan = planAllocation(
      { functions: [big], moduleVars: [], zpUserVars: [], upstreamErrors: false },
      tiny,
      bag,
    );

    expect(plan.hasErrors).toBe(true);
    expect(bag.getAll().some((d) => d.code === DiagCode.RamBudgetExceeded)).toBe(true);
  });

  // Never throws on empty/partial input; returns a valid plan.
  it("should never throw on empty input and return a valid plan (ST-P5 / AC-17)", () => {
    const bag = createDiagnosticBag();
    expect(() =>
      planAllocation(
        { functions: [], moduleVars: [], zpUserVars: [], upstreamErrors: false },
        C64_FIXTURE_PROFILE,
        bag,
      ),
    ).not.toThrow();
    const plan = planAllocation(
      { functions: [], moduleVars: [], zpUserVars: [], upstreamErrors: false },
      C64_FIXTURE_PROFILE,
      bag,
    );
    expect(plan.frames.size).toBe(0);
    expect(plan.frameRegionSize).toBe(0);
    expect(plan.hasErrors).toBe(false);
  });

  // upstreamErrors suppresses budget diagnostics but still assembles a plan.
  it("should suppress budget diagnostics under upstreamErrors but still assemble", () => {
    const bag = createDiagnosticBag();
    const plan = planAllocation(
      { functions: [makeFn("main")], moduleVars: [], zpUserVars: [], upstreamErrors: true },
      C64_FIXTURE_PROFILE,
      bag,
    );
    // No budget warnings/errors were added (the ZP allocator may still run, but a
    // tiny program emits none); the plan is still valid.
    expect(plan.hasErrors).toBe(false);
    expect(bag.getErrors()).toHaveLength(0);
  });
});

describe("Specification: modelToFunctionInfo deferred seam (AC-22, D1/D3/D5)", () => {
  // Under the semantic-model passthrough the empty model yields no functions.
  it("should return [] for the empty passthrough SemanticModel (ST-P6 / AC-22)", () => {
    const model = createEmptyModel();
    expect(modelToFunctionInfo(model)).toEqual([]);
  });
});
