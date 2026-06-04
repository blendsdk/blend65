/**
 * Specification tests for the SFA module-variable layout and zero-page allocator
 * (RD-05 §4.5/§4.7/§4.8, R24–R36; spec Ch 11 §4/§7).
 *
 * Expectations derive exclusively from plans/rd-05-sfa-frame-planner/
 * 07-testing-strategy.md (ST-Z1..ST-Z8) and 03-03-zp-and-layout.md — NOT from
 * implementation logic. Immutable oracle.
 *
 * Spec-tests-first: authored before `zp-allocator.ts`; verified to FAIL (red). The
 * W10030 large-ZP warning (ST-Z7) is owned by `checkBudgets` (03-04) and is
 * verified in `budgets.spec.test.ts`; this file covers the allocator's own
 * behaviour: layout, ordering, names, peak-pointer counting, the E10032 overflow,
 * and determinism.
 */

import { describe, expect, it } from "vitest";
import type { InterferenceGraph, ZpAllocation } from "@blend65/core";
import { primitive, createDiagnosticBag, DiagCode } from "@blend65/core";
import {
  layoutModuleVariables,
  allocateZeroPage,
  computePeakPointers,
} from "./zp-allocator.js";
import { C64_FIXTURE_PROFILE, makeFn, frameVar, structType } from "./test-fixtures.js";

/** Builds a symmetric interference graph from undirected edge pairs. */
function graph(names: readonly string[], pairs: readonly [string, string][]): InterferenceGraph {
  const edges = new Map<string, Set<string>>();
  for (const n of names) {
    edges.set(n, new Set());
  }
  for (const [a, b] of pairs) {
    edges.get(a)?.add(b);
    edges.get(b)?.add(a);
  }
  return { nodes: new Set(names), edges };
}

/** Extracts the ordered distinct category sequence from ZP allocations. */
function categorySequence(allocs: readonly ZpAllocation[]): ZpAllocation["category"][] {
  const seq: ZpAllocation["category"][] = [];
  for (const a of allocs) {
    if (seq[seq.length - 1] !== a.category) {
      seq.push(a.category);
    }
  }
  return seq;
}

describe("Specification: SFA module-variable layout (R24, §4.5)", () => {
  // ST-Z1 — module vars [byte, word, byte] → offsets 0,1,3; total 4;
  // addresses ramStart+offset.
  it("should lay out module vars sequentially with ramStart-relative addresses (ST-Z1)", () => {
    const vars = [
      { moduleName: "M", variableName: "a", type: primitive("byte"), size: 1 },
      { moduleName: "M", variableName: "b", type: primitive("word"), size: 2 },
      { moduleName: "M", variableName: "c", type: primitive("byte"), size: 1 },
    ];
    const base = C64_FIXTURE_PROFILE.ramStart;
    const { allocations, totalSize } = layoutModuleVariables(vars, base);

    expect(allocations.map((a) => a.offset)).toEqual([0, 1, 3]);
    expect(totalSize).toBe(4);
    expect(allocations.map((a) => a.address)).toEqual([base, base + 1, base + 3]);
  });
});

describe("Specification: SFA zero-page allocator (R28–R36, §4.7)", () => {
  // ST-Z2 — priority order arg-block → user → pointer → temp → irq-temp. We pass a
  // non-zero argBlockMin (4) to exercise the deferred arg-block path (D8: RD-17
  // raises the real floor; here we verify the loop is plumbed and ordered first).
  it("should place ZP categories in priority order (ST-Z2)", () => {
    const bag = createDiagnosticBag();
    const { allocations } = allocateZeroPage(
      {
        userVars: [{ name: "rasterLine", size: 1 }],
        peakPointers: 1,
        mainTemps: 4,
        irqTemps: 2,
        argBlockMin: 4,
      },
      C64_FIXTURE_PROFILE,
      bag,
    );

    expect(categorySequence(allocations)).toEqual([
      "arg-block",
      "user",
      "pointer",
      "temp",
      "irq-temp",
    ]);
  });

  // ST-Z3 — generated names for pointer/temp/irq-temp categories.
  it("should generate deterministic ZP slot names (ST-Z3)", () => {
    const bag = createDiagnosticBag();
    const { allocations } = allocateZeroPage(
      { userVars: [], peakPointers: 1, mainTemps: 1, irqTemps: 1, argBlockMin: 0 },
      C64_FIXTURE_PROFILE,
      bag,
    );
    const names = allocations.map((a) => a.name);
    expect(names).toContain("__zp_ptr_0");
    expect(names).toContain("__zp_tmp_0");
    expect(names).toContain("__zp_irq_tmp_0");
  });

  // C64 worked example (03-03): user rasterLine @ $02, ptr @ $03-04, temps @ $05-08,
  // irq temps @ $09-0A; used = 9 (argBlockMin 0).
  it("should reproduce the C64 worked-example layout with argBlockMin 0", () => {
    const bag = createDiagnosticBag();
    const { allocations, used, overflowed } = allocateZeroPage(
      {
        userVars: [{ name: "rasterLine", size: 1 }],
        peakPointers: 1,
        mainTemps: 4,
        irqTemps: 2,
        argBlockMin: 0,
      },
      C64_FIXTURE_PROFILE,
      bag,
    );

    expect(overflowed).toBe(false);
    expect(used).toBe(9);
    const byName = new Map(allocations.map((a) => [a.name, a]));
    expect(byName.get("rasterLine")?.address).toBe(0x02);
    expect(byName.get("__zp_ptr_0")?.address).toBe(0x03);
    expect(byName.get("__zp_tmp_0")?.address).toBe(0x05);
    expect(byName.get("__zp_irq_tmp_0")?.address).toBe(0x09);
  });

  // ST-Z6 — ZP allocation that exceeds zpEnd emits E10032 once, sets overflowed,
  // and stops. A narrow ZP window forces the overflow.
  it("should emit E10032 once and stop on ZP overflow (ST-Z6 / AC-11)", () => {
    const bag = createDiagnosticBag();
    const narrow = { ...C64_FIXTURE_PROFILE, zpStart: 0x02, zpEnd: 0x04 }; // 3 bytes
    const { overflowed } = allocateZeroPage(
      {
        userVars: [{ name: "big", size: 10 }],
        peakPointers: 0,
        mainTemps: 0,
        irqTemps: 0,
        argBlockMin: 0,
      },
      narrow,
      bag,
    );

    expect(overflowed).toBe(true);
    const zpErrors = bag.getAll().filter((d) => d.code === DiagCode.ZpBudgetExceeded);
    expect(zpErrors).toHaveLength(1);
  });

  // ST-Z8 — identical input produces identical layout (determinism, R36).
  it("should be deterministic across runs (ST-Z8)", () => {
    const input = {
      userVars: [{ name: "u", size: 1 }],
      peakPointers: 2,
      mainTemps: 3,
      irqTemps: 1,
      argBlockMin: 0,
    };
    const r1 = allocateZeroPage(input, C64_FIXTURE_PROFILE, createDiagnosticBag());
    const r2 = allocateZeroPage(input, C64_FIXTURE_PROFILE, createDiagnosticBag());

    expect(r1.allocations).toEqual(r2.allocations);
    expect(r1.used).toBe(r2.used);
  });
});

describe("Specification: SFA ZP pointer sharing (R31/R32, §4.7)", () => {
  // ST-Z4 — sequential f(struct byref); g(struct byref), non-interfering → 1 slot.
  it("should share one pointer slot for sequential by-ref functions (ST-Z4)", () => {
    const sp = structType("P", 4);
    const fns = [
      makeFn("f", { parameters: [frameVar("p", sp, true)] }),
      makeFn("g", { parameters: [frameVar("q", sp, true)] }),
    ];
    const g = graph(["f", "g"], []); // non-interfering
    expect(computePeakPointers(fns, g)).toBe(1);
  });

  // ST-Z5 — nested f→g (both by-ref), interfering → 2 slots.
  it("should accumulate pointer slots for nested by-ref calls (ST-Z5)", () => {
    const sp = structType("P", 4);
    const fns = [
      makeFn("f", { parameters: [frameVar("p", sp, true)], callees: ["g"] }),
      makeFn("g", { parameters: [frameVar("q", sp, true)] }),
    ];
    const g = graph(["f", "g"], [["f", "g"]]); // interfering (ancestor-descendant)
    expect(computePeakPointers(fns, g)).toBe(2);
  });
});
