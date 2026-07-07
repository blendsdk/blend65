/**
 * Specification test for the `PlatformProfile` stub (skeleton).
 *
 * Derived exclusively from the testing strategy and type-model specification
 * documents — NOT from implementation logic. The full profile system is not
 * implemented yet; this stub exists only so `analyze()` can carry its
 * signature today. The passthrough never reads it.
 *
 * Spec-tests-first: authored before the implementation; immutable oracle.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../index.js";
import type { PlatformProfile } from "../index.js";

describe("Specification: RD-04 PlatformProfile stub (D4)", () => {
  // The stub is constructible and the default has a charEncoding.
  // NOTE: `PlatformProfile` was later extended with interim SFA budget fields,
  // so a literal now needs those fields too. We spread `DEFAULT_PROFILE` for
  // the budget fields and override the two original fields under test — the
  // original name/charEncoding round-trip assertions are unchanged.
  it("should construct a PlatformProfile and expose DEFAULT_PROFILE (ST-S12)", () => {
    const custom: PlatformProfile = {
      ...DEFAULT_PROFILE,
      name: "c64",
      charEncoding: "petscii",
    };
    expect(custom.name).toBe("c64");
    expect(custom.charEncoding).toBe("petscii");

    // The neutral default callers/tests can pass to the passthrough.
    expect(typeof DEFAULT_PROFILE.name).toBe("string");
    expect(typeof DEFAULT_PROFILE.charEncoding).toBe("string");
  });
});
