/**
 * Specification tests for the Slice 7 acceptance bar: the two-file aggregate
 * fixture assembles clean through real ACME, and on real VICE every
 * observable value settles — the indexed loop sum ($0E at $C000), a nested
 * member write/read ($2A at $C001), a scaled struct-array element ($08 at
 * $C002), the enum-dispatch switch ($02 at $C003), the three query folds
 * (6/2/1 at $C004..$C006), a cross-module const-table read ($14 at $C007),
 * whole-struct COPY semantics ($0B at $C008 — the copy is unaffected by a
 * later write through the source), and the enum→word cast's low byte ($03 at
 * $C009).
 *
 * These tests are derived directly from the fixture's documented behavior,
 * not from reading the implementation. The assemble-clean suite compiles via
 * ACME (`skipIf(!hasAcme())`); the runtime suite additionally runs on VICE
 * (`skipIf(!(hasVice && hasAcme))`, skipped in CI — the golden tier guards
 * there).
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildSlice7, SLICE7_OBSERVABLES, type BuiltSlice7 } from "./testing/slice7.js";
import { assertObservables } from "./testing/observables.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

const LOCAL_TEST_TIMEOUT = 30000;

describe.skipIf(!hasAcme())("Specification: Slice 7 assemble-clean (ST-59)", () => {
  let built: BuiltSlice7 | undefined;

  afterAll(() => built?.cleanup());

  it("compiles the aggregate fixture to a loadable c64 PRG", async () => {
    built = await buildSlice7();

    // Loadable PRG, zero error diagnostics (ACME rejects any undefined label
    // reference — including a phantom `__data_*` symbol).
    expect(built.result.hasErrors).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: Slice 7 on VICE (ST-61)", () => {
  let built: BuiltSlice7 | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "computes every aggregate-surface observable on real VICE",
    async () => {
      built = await buildSlice7();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      // The shared observable set — the same table the twin tier consumes.
      await assertObservables(driver, SLICE7_OBSERVABLES);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
