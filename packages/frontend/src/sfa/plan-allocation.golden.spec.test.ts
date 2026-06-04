/**
 * Golden-snapshot specification test for `planAllocation` (ST-P2 / AC-07 / AC-21).
 *
 * Serializes the full `AllocationPlan` for the Ch 11 §3.4 worked program to a
 * stable JSON snapshot, asserting the planner is deterministic (AC-21) and that
 * the §3.4 frame-sharing result (AC-07) is reproduced end-to-end. The snapshot is
 * the immutable oracle: if it changes, the implementation changed — re-run with
 * `--update` only after a deliberate, reviewed behaviour change.
 *
 * The expected sharing structure is derived from 03-02-interference-and-coloring.md
 * (the §3.4 example), NOT from the implementation. Spec-tests-first / Rule 10.
 */

import { describe, expect, it } from "vitest";
import type { AllocationPlan } from "@blend65/core";
import { createDiagnosticBag } from "@blend65/core";
import { planAllocation } from "./plan-allocation.js";
import { C64_FIXTURE_PROFILE, makeFn, byteVar } from "./test-fixtures.js";

/**
 * Renders an `AllocationPlan` to a plain, stable, snapshot-friendly object
 * (Maps → sorted entry arrays) so the JSON snapshot is deterministic.
 */
function serializePlan(plan: AllocationPlan): unknown {
  return {
    frameRegionBase: plan.frameRegionBase,
    frameRegionSize: plan.frameRegionSize,
    peakSimultaneous: plan.peakSimultaneous,
    sharingSaved: plan.sharingSaved,
    frames: [...plan.frames.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, fa]) => ({
        name,
        offset: fa.offset,
        absoluteAddress: fa.absoluteAddress,
        totalSize: fa.frame.totalSize,
      })),
    zpAllocations: plan.zpAllocations,
    zpUsed: plan.zpUsed,
    zpBudget: plan.zpBudget,
    moduleVariables: plan.moduleVariables,
    moduleVariablesSize: plan.moduleVariablesSize,
    stackAnalysis: plan.stackAnalysis,
    symbolDefinitions: plan.symbolDefinitions,
    resourceData: plan.resourceData,
    hasErrors: plan.hasErrors,
  };
}

/** The Ch 11 §3.4 worked program (call graph from 03-02). */
function ch11Section34Program() {
  return [
    makeFn("main", { callees: ["init", "update", "render"] }),
    makeFn("init", { locals: [byteVar("i")] }),
    makeFn("update", { callees: ["handleInput", "moveEnemies"], locals: [byteVar("dt")] }),
    makeFn("render", { callees: ["drawBackground", "drawSprites"], locals: [byteVar("y")] }),
    makeFn("handleInput", { locals: [byteVar("key")] }),
    makeFn("moveEnemies", { locals: [byteVar("n")] }),
    makeFn("drawBackground", { locals: [byteVar("col")] }),
    makeFn("drawSprites", { locals: [byteVar("spr")] }),
  ];
}

describe("Specification: planAllocation Ch 11 §3.4 golden (ST-P2 / AC-07 / AC-21)", () => {
  it("should produce a deterministic AllocationPlan snapshot for the §3.4 program", () => {
    const bag = createDiagnosticBag();
    const plan = planAllocation(
      { functions: ch11Section34Program(), moduleVars: [], zpUserVars: [], upstreamErrors: false },
      C64_FIXTURE_PROFILE,
      bag,
    );

    // No diagnostics for this small, well-formed program.
    expect(bag.getAll()).toHaveLength(0);
    // The §3.4 sharing result: the region is far smaller than the 8 unshared
    // 1-byte frames would need, proving sharing occurred (AC-07).
    expect(plan.sharingSaved).toBeGreaterThan(0);

    expect(serializePlan(plan)).toMatchSnapshot();
  });

  it("should be byte-for-byte identical across two runs (AC-21 determinism)", () => {
    const p1 = planAllocation(
      { functions: ch11Section34Program(), moduleVars: [], zpUserVars: [], upstreamErrors: false },
      C64_FIXTURE_PROFILE,
      createDiagnosticBag(),
    );
    const p2 = planAllocation(
      { functions: ch11Section34Program(), moduleVars: [], zpUserVars: [], upstreamErrors: false },
      C64_FIXTURE_PROFILE,
      createDiagnosticBag(),
    );
    expect(serializePlan(p1)).toEqual(serializePlan(p2));
  });
});
