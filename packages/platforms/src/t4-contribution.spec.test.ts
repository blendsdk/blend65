/**
 * Specification tests for the RD-17 T4 contribution mechanism (ST-31).
 *
 * Derived EXCLUSIVELY from RD-17 R11/R25, AC-15/AC-16, and PF-015 — never from
 * implementation (IMMUTABLE ORACLE RULE):
 *  - ST-31: `createIntrinsicRegistry(fixturePlugin.intrinsics, id)` returns a
 *    registry where `get('fix_probe')` yields the T4 descriptor (AC-16), fully
 *    populated at construction (AC-15).
 *  - The merged descriptor's availability is keyed on the contributing
 *    platform's id (R25/PF-015): true on the owning platform's canonical
 *    profile, false on another platform's.
 *
 * ST-32 (the full analyze→lower→translate→serialize pipeline) lives in
 * `@blend65/compiler` per the D10 package-boundary rule — this package depends
 * only on `@blend65/core` and cannot drive the pipeline.
 */

import { describe, expect, it } from "vitest";
import { createIntrinsicRegistry } from "@blend65/core";
import { FIX_PROBE, fixturePlugin } from "./__fixtures__/fixture-plugin.js";
import { a7800Plugin } from "./a7800.js";

describe("Specification: RD-17 T4 registry merge (ST-31, AC-15/AC-16)", () => {
  it("ST-31: the fixture plugin's T4 descriptor is registered and retrievable", () => {
    const registry = createIntrinsicRegistry(fixturePlugin.intrinsics, fixturePlugin.id);
    const d = registry.get("fix_probe");
    expect(d).toBeDefined();
    expect(d?.tier).toBe("T4");
    expect(d?.loweringStrategy).toBe("call");
    expect(d?.signature).toEqual(FIX_PROBE.signature);
    // The registry is fully populated at construction (AC-15): the core catalog
    // is present alongside the contribution.
    expect(registry.get("poke")).toBeDefined();
    expect(registry.get("__rt_mul8")).toBeDefined();
  });

  it("merged availability is keyed on the contributing platform id (R25/PF-015)", () => {
    const registry = createIntrinsicRegistry(fixturePlugin.intrinsics, fixturePlugin.id);
    const d = registry.get("fix_probe");
    expect(d?.availability(fixturePlugin.profile)).toBe(true);
    expect(d?.availability(a7800Plugin.profile)).toBe(false);
  });

  it("a merged T4 name is reserved for shadowing checks (R20)", () => {
    const registry = createIntrinsicRegistry(fixturePlugin.intrinsics, fixturePlugin.id);
    expect(registry.isReserved("fix_probe")).toBe(true);
  });

  it("a T4 name colliding with a core name throws at merge (AR-P9 setup bug)", () => {
    const collider = { ...FIX_PROBE, name: "poke" };
    expect(() => createIntrinsicRegistry([collider], "c64")).toThrow(/already registered/);
  });
});
