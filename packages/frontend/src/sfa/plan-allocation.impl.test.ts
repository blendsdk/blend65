/**
 * Implementation tests for the `planAllocation` pipeline (RD-05 §4.1).
 *
 * Internals and integration derived from the implementation (testing.md Rule 10
 * impl tier): frame sharing across the pipeline, module-variable placement and the
 * frame-region base, sharingSaved bookkeeping, immutability, and ZP wiring.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, primitive } from "@blend65/core";
import { planAllocation } from "./plan-allocation.js";
import { C64_FIXTURE_PROFILE, makeFn, byteVar } from "./test-fixtures.js";

describe("planAllocation integration", () => {
  it("should place the frame region after the module-variable block", () => {
    const bag = createDiagnosticBag();
    const plan = planAllocation(
      {
        functions: [makeFn("main", { locals: [byteVar("x")] })],
        moduleVars: [
          { moduleName: "M", variableName: "g", type: primitive("word"), size: 2 },
        ],
        zpUserVars: [],
        upstreamErrors: false,
      },
      C64_FIXTURE_PROFILE,
      bag,
    );

    expect(plan.moduleVariablesSize).toBe(2);
    // frameRegionBase = ramStart + moduleVarsSize.
    expect(plan.frameRegionBase).toBe(C64_FIXTURE_PROFILE.ramStart + 2);
    const mainFrame = plan.frames.get("main");
    expect(mainFrame?.absoluteAddress).toBe(plan.frameRegionBase + (mainFrame?.offset ?? 0));
  });

  it("should report frame sharing via sharingSaved for sequential siblings", () => {
    const bag = createDiagnosticBag();
    // main → {a, b}; a and b are non-interfering siblings, each 2-byte frames.
    const plan = planAllocation(
      {
        functions: [
          makeFn("main", { callees: ["a", "b"] }),
          makeFn("a", { locals: [byteVar("p"), byteVar("q")] }), // 2 bytes
          makeFn("b", { locals: [byteVar("r"), byteVar("s")] }), // 2 bytes
        ],
        moduleVars: [],
        zpUserVars: [],
        upstreamErrors: false,
      },
      C64_FIXTURE_PROFILE,
      bag,
    );

    // a and b share, so the region is smaller than the sum of all frame sizes.
    expect(plan.sharingSaved).toBeGreaterThan(0);
    expect(plan.resourceData.frameSharingSaved).toBe(plan.sharingSaved);
  });

  it("should wire the zero-page allocations into the plan and resourceData", () => {
    const bag = createDiagnosticBag();
    const plan = planAllocation(
      {
        functions: [makeFn("main")],
        moduleVars: [],
        zpUserVars: [{ name: "rasterLine", size: 1 }],
        upstreamErrors: false,
      },
      C64_FIXTURE_PROFILE,
      bag,
    );

    // user var + mainTemps(4) + irqTemps(2) = 7 bytes (no pointers in this program).
    expect(plan.zpUsed).toBe(7);
    expect(plan.resourceData.zpUsed).toBe(7);
    expect(plan.zpAllocations.some((z) => z.name === "rasterLine")).toBe(true);
  });

  it("should return a frozen plan (immutability, R59)", () => {
    const bag = createDiagnosticBag();
    const plan = planAllocation(
      { functions: [makeFn("main")], moduleVars: [], zpUserVars: [], upstreamErrors: false },
      C64_FIXTURE_PROFILE,
      bag,
    );
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("should emit a frame slot symbol for a function local", () => {
    const bag = createDiagnosticBag();
    const plan = planAllocation(
      { functions: [makeFn("Game.tick", { locals: [byteVar("counter")] })], moduleVars: [], zpUserVars: [], upstreamErrors: false },
      C64_FIXTURE_PROFILE,
      bag,
    );
    expect(plan.symbolDefinitions.some((s) => s.name === "__frame_Game_tick_counter")).toBe(true);
  });
});
