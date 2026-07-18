/**
 * Specification tests for the Slice 4a acceptance bar: the conditionals + loops
 * fixture assembles clean through the real multi-block CFG path, and on real
 * VICE the computed byte result (a for-loop with break/continue plus a
 * while-loop, then a two-armed if/else) settles into observable RAM.
 *
 * These tests are derived directly from the fixture's documented behavior, not
 * from reading the implementation. The assemble-clean suite compiles via ACME
 * (`skipIf(!hasAcme())`); the runtime suite additionally runs on VICE
 * (`skipIf(!(hasVice && hasAcme))`, skipped in CI — the golden tier guards
 * there).
 */

import { afterAll, describe, expect, it } from "vitest";
import {
  buildSlice4a,
  emitAsmSlice4a,
  SLICE4A_OBSERVABLES,
  type BuiltSlice4a,
} from "./testing/slice4a.js";
import { assertObservables } from "./testing/observables.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

const LOCAL_TEST_TIMEOUT = 30000;

describe.skipIf(!hasAcme())("Specification: Slice 4a assemble-clean (ST-19)", () => {
  let built: BuiltSlice4a | undefined;

  afterAll(() => built?.cleanup());

  it("compiles the conditionals+loops fixture to a loadable c64 PRG", async () => {
    built = await buildSlice4a();

    // Loadable PRG, zero error diagnostics (ACME rejects any undefined label ref).
    expect(built.result.hasErrors).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);

    // The multi-block CFG path emits function-unique block labels, branch
    // instructions, and the module scalar symbol.
    const asm = emitAsmSlice4a();
    expect(asm.text).toContain("Main_main_L"); // multi-block labels
    expect(asm.text).toContain("JMP"); // br → JMP
    expect(asm.text).toMatch(/\b(BNE|BEQ|BCC|BCS)\b/); // brcond / comparison branch
    expect(asm.text).toContain("__var_Main_result");
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: Slice 4a on VICE (ST-21)", () => {
  let built: BuiltSlice4a | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "computes the loop sum (21) and takes the two-armed if, poked to plain RAM",
    async () => {
      built = await buildSlice4a();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      // The shared observable set — the same table the twin tier consumes.
      await assertObservables(driver, SLICE4A_OBSERVABLES);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
