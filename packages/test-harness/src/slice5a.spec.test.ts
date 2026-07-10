/**
 * Specification tests for the Slice 5a acceptance bar: the first
 * multi-function, multi-module fixture assembles clean through the real
 * calling-convention path, and on real VICE the computed results settle into
 * observable RAM — add(10,7)=17 at $C000, triple(300)=900=$0384 as lo/hi at
 * $C001/$C002, combo(5)=16 at $C003 (a two-level call chain through a
 * function declared after its call site).
 *
 * These tests are derived directly from the fixture's documented behavior,
 * not from reading the implementation. The assemble-clean suite compiles via
 * ACME (`skipIf(!hasAcme())`); the runtime suite additionally runs on VICE
 * (`skipIf(!(hasVice && hasAcme))`, skipped in CI — the golden tier guards
 * there).
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildSlice5a, emitAsmSlice5a, type BuiltSlice5a } from "./testing/slice5a.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { assertMemory, runUntilMemory } from "./index.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** Observable RAM: the three call results. */
const R1_ADDR = 0xc000; // add(10, 7) = 17 = $11
const R1_VAL = 0x11;
const R2_LO_ADDR = 0xc001; // triple(300) = 900 = $0384 — lo byte
const R2_LO_VAL = 0x84;
const R2_HI_ADDR = 0xc002; // $0384 — hi byte (contiguous pokew)
const R2_HI_VAL = 0x03;
const R3_ADDR = 0xc003; // combo(5): t = add(5,3) = 8; t + t = 16 = $10
const R3_VAL = 0x10;
const LOCAL_TEST_TIMEOUT = 30000;

describe.skipIf(!hasAcme())("Specification: Slice 5a assemble-clean", () => {
  let built: BuiltSlice5a | undefined;

  afterAll(() => built?.cleanup());

  it("compiles the two-module call fixture to a loadable c64 PRG", async () => {
    built = await buildSlice5a();

    // Loadable PRG, zero error diagnostics (ACME rejects any undefined label ref).
    expect(built.result.hasErrors).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);

    // The calling convention is visible in the ACME source: argument stores
    // into the callee frames, bare JSR transfers to both modules' functions,
    // and the module scalars.
    const asm = emitAsmSlice5a();
    expect(asm.text).toContain("STA __frame_Math_add_a");
    expect(asm.text).toContain("JSR Math_add");
    expect(asm.text).toContain("JSR Math_triple");
    expect(asm.text).toContain("JSR Main_combo");
    expect(asm.text).toContain("Math_add:");
    expect(asm.text).toContain("Math_triple:");
    expect(asm.text).toContain("Main_combo:");
    expect(asm.text).toContain("__var_Main_r1");
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: Slice 5a on VICE", () => {
  let built: BuiltSlice5a | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "computes the cross-module and chained call results on real VICE",
    async () => {
      built = await buildSlice5a();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      await runUntilMemory(driver, R3_ADDR, R3_VAL); // the last result settled
      await assertMemory(driver, R1_ADDR, R1_VAL); // $C000 == $11 (add)
      await assertMemory(driver, R2_LO_ADDR, R2_LO_VAL); // $C001 == $84 (triple lo)
      await assertMemory(driver, R2_HI_ADDR, R2_HI_VAL); // $C002 == $03 (triple hi)
      await assertMemory(driver, R3_ADDR, R3_VAL); // $C003 == $10 (combo)
    },
    LOCAL_TEST_TIMEOUT,
  );
});
