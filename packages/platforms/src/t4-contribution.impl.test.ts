/**
 * Implementation tests for the RD-17 T4 contribution internals (03-05, 5.3.1):
 * the id-stamped availability wrapper, `[]`-plugin neutrality, and fixture
 * isolation (AR-P2 — never in the package barrel).
 */

import { describe, expect, it } from "vitest";
import { createIntrinsicRegistry } from "@blend65/core";
import * as barrel from "./index.js";
import { FIX_PROBE, fixturePlugin } from "./__fixtures__/fixture-plugin.js";
import { c64Plugin } from "./c64.js";

describe("registry merge — id-stamped availability wrapper", () => {
  it("stamps the contributing platformId on the merged descriptor", () => {
    const registry = createIntrinsicRegistry([FIX_PROBE], "c64");
    expect(registry.get("fix_probe")?.platformId).toBe("c64");
  });

  it("does not mutate the plugin-authored descriptor", () => {
    createIntrinsicRegistry([FIX_PROBE], "c64");
    expect(FIX_PROBE.platformId).toBeUndefined();
    // The original availability is untouched (still platform-agnostic).
    expect(FIX_PROBE.availability(fixturePlugin.profile)).toBe(true);
  });

  it("the wrapper ANDs the original predicate (a false original stays false)", () => {
    const never = { ...FIX_PROBE, availability: () => false };
    const registry = createIntrinsicRegistry([never], "c64");
    expect(registry.get("fix_probe")?.availability(fixturePlugin.profile)).toBe(false);
  });

  it("without a platformId the descriptors register unwrapped (test/back-compat path)", () => {
    const registry = createIntrinsicRegistry([FIX_PROBE]);
    expect(registry.get("fix_probe")?.platformId).toBeUndefined();
    expect(registry.get("fix_probe")?.availability(barrel.a7800Plugin.profile)).toBe(true);
  });
});

describe("production plugins — [] contributions are a no-op", () => {
  it("merging the real c64 plugin's empty intrinsics changes nothing", () => {
    const coreOnly = createIntrinsicRegistry();
    const merged = createIntrinsicRegistry(c64Plugin.intrinsics, c64Plugin.id);
    expect(merged.getAll().map((d) => d.name).sort()).toEqual(
      coreOnly.getAll().map((d) => d.name).sort(),
    );
  });
});

describe("fixture isolation (AR-P2)", () => {
  it("the fixture plugin is NOT exported from the package barrel", () => {
    expect(Object.keys(barrel)).not.toContain("fixturePlugin");
    expect(Object.keys(barrel)).not.toContain("FIX_PROBE");
  });
});
