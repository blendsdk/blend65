/**
 * Specification tests for the Slice 6 acceptance bar: the expression-system
 * fixture assembles clean through real ACME, and on real VICE every
 * observable value settles — mixed-width promotion with a compound
 * assignment (1255 at $C000/$C001), cast/shift/bitwise/complement ($DA at
 * $C002), signed negation with a cross-sign cast ($05 at $C003), mixed-width
 * + signed comparisons through `&&` and the conditional operator ($07 at
 * $C004), the SHORT-CIRCUIT SUPPRESSION PROOF (the side-effecting helper ran
 * zero times → $00 at $C005, then exactly once → $01 at $C006), and a
 * variable-count word shift ($44/$00 at $C007/$C008).
 *
 * These tests are derived directly from the fixture's documented behavior,
 * not from reading the implementation. The assemble-clean suite compiles via
 * ACME (`skipIf(!hasAcme())`); the runtime suite additionally runs on VICE
 * (`skipIf(!(hasVice && hasAcme))`, skipped in CI — the golden tier guards
 * there).
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildSlice6, SLICE6_OBSERVABLES, type BuiltSlice6 } from "./testing/slice6.js";
import { assertObservables } from "./testing/observables.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

const LOCAL_TEST_TIMEOUT = 30000;

describe.skipIf(!hasAcme())("Specification: Slice 6 assemble-clean", () => {
  let built: BuiltSlice6 | undefined;

  afterAll(() => built?.cleanup());

  it("compiles the expression fixture to a loadable c64 PRG", async () => {
    built = await buildSlice6();

    // Loadable PRG, zero error diagnostics (ACME rejects any undefined label
    // reference — including a phantom synthetic-slot equate).
    expect(built.result.hasErrors).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: Slice 6 on VICE", () => {
  let built: BuiltSlice6 | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "computes the expression results and proves short-circuit suppression on real VICE",
    async () => {
      built = await buildSlice6();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      // The shared observable set — the same table the twin tier consumes.
      await assertObservables(driver, SLICE6_OBSERVABLES);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
