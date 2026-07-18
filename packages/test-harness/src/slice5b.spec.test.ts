/**
 * Specification tests for the Slice 5b acceptance bar: the module-system
 * fixture (one module across two files, import-less qualified access,
 * cross-module initializer ordering, the generated init routine) assembles
 * clean through real ACME, and on real VICE the initializers run before
 * `main` and every observable value settles — add(2,3)=5 at $C000,
 * Math.twice(4)=8 at $C001, combo=7 at $C002 (initialized from Math.scaled+1
 * BEFORE main runs), Math.base=$0102 as lo/hi at $C003/$C004, and
 * Math.base+1=$0103 at $C005/$C006 after the qualified write.
 *
 * These tests are derived directly from the fixture's documented behavior,
 * not from reading the implementation. The assemble-clean suite compiles via
 * ACME (`skipIf(!hasAcme())`); the runtime suite additionally runs on VICE
 * (`skipIf(!(hasVice && hasAcme))`, skipped in CI — the golden tier guards
 * there).
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildSlice5b, SLICE5B_OBSERVABLES, type BuiltSlice5b } from "./testing/slice5b.js";
import { assertObservables } from "./testing/observables.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

const LOCAL_TEST_TIMEOUT = 30000;

describe.skipIf(!hasAcme())("Specification: Slice 5b assemble-clean", () => {
  let built: BuiltSlice5b | undefined;

  afterAll(() => built?.cleanup());

  it("compiles the merged-module fixture to a loadable c64 PRG", async () => {
    built = await buildSlice5b();

    // Loadable PRG, zero error diagnostics (ACME rejects any undefined label
    // reference — including a phantom const or init symbol).
    expect(built.result.hasErrors).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: Slice 5b on VICE", () => {
  let built: BuiltSlice5b | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "runs the initializers before main and computes the module-system results on real VICE",
    async () => {
      built = await buildSlice5b();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      // The shared observable set — the same table the twin tier consumes.
      await assertObservables(driver, SLICE5B_OBSERVABLES);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
