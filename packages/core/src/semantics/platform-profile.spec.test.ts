/**
 * Specification test for the RD-04 `PlatformProfile` stub (skeleton).
 *
 * Derived exclusively from plans/rd-04-semantic-analysis/07-testing-strategy.md
 * (ST-S12) and 03-01-type-model.md — NOT from implementation logic. The full
 * profile system is RD-10; this stub (D4) exists only so `analyze()` can carry
 * its R118 signature today. The passthrough never reads it.
 *
 * Spec-tests-first (testing.md Rule 10): authored before the implementation;
 * immutable oracle.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../index.js";
import type { PlatformProfile } from "../index.js";

describe("Specification: RD-04 PlatformProfile stub (D4)", () => {
  // ST-S12 — the stub is constructible and the default has a charEncoding.
  it("should construct a PlatformProfile and expose DEFAULT_PROFILE (ST-S12)", () => {
    const custom: PlatformProfile = { name: "c64", charEncoding: "petscii" };
    expect(custom.name).toBe("c64");
    expect(custom.charEncoding).toBe("petscii");

    // The neutral default callers/tests can pass to the passthrough.
    expect(typeof DEFAULT_PROFILE.name).toBe("string");
    expect(typeof DEFAULT_PROFILE.charEncoding).toBe("string");
  });
});
