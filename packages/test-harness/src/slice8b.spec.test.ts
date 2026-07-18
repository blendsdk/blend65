/**
 * Specification tests for the Slice 8b acceptance bar: the data-surface
 * fixture assembles clean through real ACME (string/embed const data, the
 * banner init stream, and the copy loop all resolve), and on real VICE the
 * observables land byte-for-byte: the PETSCII title copied to screen RAM,
 * the embedded table staged to `$C000`, the mutated banner (`B`,`I`,`.`×6)
 * at `$C010`, and the char-comparison flag at `$C020`. The `$C020` flag is
 * the fixture's LAST write, so waiting on it settles every earlier
 * observable deterministically.
 *
 * These tests derive from the fixture's documented behavior, not from
 * reading the implementation. The assemble-clean suite compiles via ACME
 * (`skipIf(!hasAcme())`); the runtime suite additionally runs on VICE
 * (`skipIf(!(hasVice && hasAcme))`, skipped in CI — the golden tier guards
 * there).
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildSlice8b, SLICE8B_OBSERVABLES, type BuiltSlice8b } from "./testing/slice8b.js";
import { assertObservables } from "./testing/observables.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

const LOCAL_TEST_TIMEOUT = 120000;

describe.skipIf(!hasAcme())("Specification: Slice 8b assemble-clean", () => {
  let built: BuiltSlice8b | undefined;

  afterAll(() => built?.cleanup());

  it("compiles the strings/embed fixture to a loadable c64 PRG", async () => {
    built = await buildSlice8b();
    expect(built.result.hasErrors).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: Slice 8b on VICE", () => {
  let built: BuiltSlice8b | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "lands every observable byte-for-byte (title, table, banner, comparison flag)",
    async () => {
      built = await buildSlice8b();
      expect(built.result.hasErrors).toBe(false);
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      // The shared observable set — the same table the twin tier consumes.
      // Its landmark waits on the comparison flag (main's last write), so
      // every earlier copy has finished before the checks run.
      await assertObservables(driver, SLICE8B_OBSERVABLES, { timeout: LOCAL_TEST_TIMEOUT });
    },
    LOCAL_TEST_TIMEOUT,
  );
});
