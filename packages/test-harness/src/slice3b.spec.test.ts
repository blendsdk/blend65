/**
 * Specification tests for the Slice 3b acceptance bar: the module+local scalar
 * fixture assembles clean through the real width-aware path, and on real VICE
 * the computed byte `(a*b)+c` and word `x*y` results settle into plain RAM via
 * their module `__var_*` slots.
 *
 * These tests are derived directly from the fixture's documented behavior, not
 * from reading the implementation. The assemble-clean suite compiles via ACME
 * (`skipIf(!hasAcme())`); the runtime suite additionally runs on VICE
 * (`skipIf(!(hasVice && hasAcme))`, skipped in CI — the golden tier guards there).
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildSlice3b, emitAsmSlice3b, type BuiltSlice3b } from "./testing/slice3b.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { assertMemory, runUntilMemory } from "./index.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** Observable RAM: the byte result and the two little-endian bytes of the word result. */
const BYTE_ADDR = 0xc000; // accB = (5*3)+2 = 17 = $11
const BYTE_VAL = 0x11;
const WORD_LO_ADDR = 0xc001; // accW = 300*2 = 600 = $0258 → lo $58
const WORD_LO_VAL = 0x58;
const WORD_HI_ADDR = 0xc002; // hi $02
const WORD_HI_VAL = 0x02;
const LOCAL_TEST_TIMEOUT = 30000;

describe.skipIf(!hasAcme())("Specification: Slice 3b assemble-clean (ST-16)", () => {
  let built: BuiltSlice3b | undefined;

  afterAll(() => built?.cleanup());

  it("compiles the module+local scalar fixture to a loadable c64 PRG", async () => {
    built = await buildSlice3b();

    // Loadable PRG, zero error diagnostics (ACME rejects any undefined __var_*/__frame_* ref).
    expect(built.result.hasErrors).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);

    // The width-aware, module-var path emits both module scalar symbols and the
    // byte/word runtime multiply vectors.
    const asm = emitAsmSlice3b();
    expect(asm.text).toContain("__var_Main_accB");
    expect(asm.text).toContain("__var_Main_accW");
    expect(asm.text).toContain("__rt_mul8");
    expect(asm.text).toContain("__rt_mul16");
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: Slice 3b on VICE (ST-18)", () => {
  let built: BuiltSlice3b | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "computes byte a*b+c and word x*y into module vars, poked to plain RAM",
    async () => {
      built = await buildSlice3b();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      await runUntilMemory(driver, BYTE_ADDR, BYTE_VAL); // byte result settled
      await assertMemory(driver, BYTE_ADDR, BYTE_VAL); // $C000 == $11 (17)
      await assertMemory(driver, WORD_LO_ADDR, WORD_LO_VAL); // $C001 == $58 (600 lo)
      await assertMemory(driver, WORD_HI_ADDR, WORD_HI_VAL); // $C002 == $02 (600 hi)
    },
    LOCAL_TEST_TIMEOUT,
  );
});
