/**
 * Specification tests for the Slice 7b acceptance bar: the two-file pointer
 * fixture assembles clean through real ACME (every `__zp_ptr_*` pair symbol
 * resolves), and on real VICE every observable settles — the by-ref mutation
 * through the pass-through chain ($00 at $C000), the nested member write
 * through a pair ($2A at $C001), the const-unsized-param sum ($0F at $C002),
 * the tier-2 write/read at a RUNTIME word index 260 ($1D at $C003 — the
 * pointer-formation path executes on hardware; a dropped index high byte
 * would alias big[4] and corrupt BOTH rows), the const-indexed low-range
 * integrity proof ($11 at $C004), and the whole-struct copy through two
 * by-ref params ($0B/$16 at $C005/$C006 — the source mutates afterwards).
 *
 * These tests are derived directly from the fixture's documented behavior,
 * not from reading the implementation. The assemble-clean suite compiles via
 * ACME (`skipIf(!hasAcme())`); the runtime suite additionally runs on VICE
 * (`skipIf(!(hasVice && hasAcme))`, skipped in CI — the golden tier guards
 * there).
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildSlice7b, SLICE7B_OBSERVABLES, type BuiltSlice7b } from "./testing/slice7b.js";
import { assertObservables } from "./testing/observables.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

const LOCAL_TEST_TIMEOUT = 30000;

describe.skipIf(!hasAcme())("Specification: Slice 7b assemble-clean (ST-59)", () => {
  let built: BuiltSlice7b | undefined;

  afterAll(() => built?.cleanup());

  it("compiles the pointer fixture to a loadable c64 PRG (all pair symbols resolve)", async () => {
    built = await buildSlice7b();

    // Loadable PRG, zero error diagnostics (ACME rejects any undefined label
    // reference — including a phantom `__zp_ptr_*` pair symbol).
    expect(built.result.hasErrors).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: Slice 7b on VICE (ST-61)", () => {
  let built: BuiltSlice7b | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "computes every pointer-surface observable on real VICE",
    async () => {
      built = await buildSlice7b();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      // The shared observable set — the same table the twin tier consumes.
      await assertObservables(driver, SLICE7B_OBSERVABLES);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
