/**
 * Implementation tests for the SFA zero-page allocator (RD-05 §4.7).
 *
 * Edge cases and internals derived from the implementation (testing.md Rule 10
 * impl tier): exact-fit boundary, multi-byte user vars, the deferred arg-block
 * floor, pointer-byte sizing, and empty-input behaviour.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag } from "@blend65/core";
import { allocateZeroPage, layoutModuleVariables } from "./zp-allocator.js";
import { C64_FIXTURE_PROFILE } from "./test-fixtures.js";

describe("allocateZeroPage internals", () => {
  it("should produce no allocations and used 0 for an empty request", () => {
    const bag = createDiagnosticBag();
    const r = allocateZeroPage(
      { userVars: [], peakPointers: 0, mainTemps: 0, irqTemps: 0, argBlockMin: 0 },
      C64_FIXTURE_PROFILE,
      bag,
    );
    expect(r.allocations).toHaveLength(0);
    expect(r.used).toBe(0);
    expect(r.overflowed).toBe(false);
  });

  it("should fit exactly to the last ZP byte without overflowing", () => {
    // zpStart 0x02, zpEnd 0x04 → 3 inclusive bytes. Place exactly 3 → no overflow.
    const bag = createDiagnosticBag();
    const narrow = { ...C64_FIXTURE_PROFILE, zpStart: 0x02, zpEnd: 0x04 };
    const r = allocateZeroPage(
      { userVars: [{ name: "exact", size: 3 }], peakPointers: 0, mainTemps: 0, irqTemps: 0, argBlockMin: 0 },
      narrow,
      bag,
    );
    expect(r.overflowed).toBe(false);
    expect(r.used).toBe(3);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("should overflow when one byte beyond the exact fit is requested", () => {
    const bag = createDiagnosticBag();
    const narrow = { ...C64_FIXTURE_PROFILE, zpStart: 0x02, zpEnd: 0x04 }; // 3 bytes
    const r = allocateZeroPage(
      { userVars: [{ name: "tooBig", size: 4 }], peakPointers: 0, mainTemps: 0, irqTemps: 0, argBlockMin: 0 },
      narrow,
      bag,
    );
    expect(r.overflowed).toBe(true);
  });

  it("should reserve the arg-block first when its floor is non-zero (D8 plumbing)", () => {
    const bag = createDiagnosticBag();
    const r = allocateZeroPage(
      { userVars: [{ name: "u", size: 1 }], peakPointers: 0, mainTemps: 0, irqTemps: 0, argBlockMin: 2 },
      C64_FIXTURE_PROFILE,
      bag,
    );
    // arg-block occupies $02,$03; user var lands at $04.
    expect(r.allocations[0]?.category).toBe("arg-block");
    expect(r.allocations[0]?.address).toBe(0x02);
    expect(r.allocations[1]?.category).toBe("arg-block");
    expect(r.allocations[1]?.address).toBe(0x03);
    const user = r.allocations.find((a) => a.name === "u");
    expect(user?.address).toBe(0x04);
  });

  it("should size pointer slots as 2 bytes each", () => {
    const bag = createDiagnosticBag();
    const r = allocateZeroPage(
      { userVars: [], peakPointers: 2, mainTemps: 0, irqTemps: 0, argBlockMin: 0 },
      C64_FIXTURE_PROFILE,
      bag,
    );
    const ptrs = r.allocations.filter((a) => a.category === "pointer");
    expect(ptrs).toHaveLength(2);
    expect(ptrs.every((p) => p.size === 2)).toBe(true);
    expect(r.used).toBe(4); // 2 pointers × 2 bytes
  });

  it("should place a multi-byte user var contiguously", () => {
    const bag = createDiagnosticBag();
    const r = allocateZeroPage(
      { userVars: [{ name: "buf", size: 3 }], peakPointers: 0, mainTemps: 0, irqTemps: 0, argBlockMin: 0 },
      C64_FIXTURE_PROFILE,
      bag,
    );
    const buf = r.allocations.find((a) => a.name === "buf");
    expect(buf?.address).toBe(0x02);
    expect(buf?.size).toBe(3);
    expect(r.used).toBe(3);
  });
});

describe("layoutModuleVariables internals", () => {
  it("should default addresses to offsets when no ramStart is given", () => {
    const { allocations, totalSize } = layoutModuleVariables([
      { moduleName: "M", variableName: "x", type: { kind: "primitive", name: "byte" }, size: 1 },
      { moduleName: "M", variableName: "y", type: { kind: "primitive", name: "byte" }, size: 1 },
    ]);
    expect(allocations.map((a) => a.address)).toEqual([0, 1]);
    expect(totalSize).toBe(2);
  });

  it("should return total 0 for no module variables", () => {
    const { allocations, totalSize } = layoutModuleVariables([]);
    expect(allocations).toHaveLength(0);
    expect(totalSize).toBe(0);
  });
});
