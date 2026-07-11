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
import { buildSlice5b, type BuiltSlice5b } from "./testing/slice5b.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { assertMemory, runUntilMemory } from "./index.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** Observable RAM: the six poked results (seven bytes). */
const ADD_ADDR = 0xc000; // add(2, 3) = 5
const ADD_VAL = 0x05;
const TWICE_ADDR = 0xc001; // Math.twice(4) = add(4, 4) = 8
const TWICE_VAL = 0x08;
const COMBO_ADDR = 0xc002; // combo = Math.scaled + 1 = 3*2 + 1 = 7 (init order)
const COMBO_VAL = 0x07;
const BASE_LO_ADDR = 0xc003; // Math.base = $0102 — lo byte
const BASE_LO_VAL = 0x02;
const BASE_HI_ADDR = 0xc004; // $0102 — hi byte (contiguous pokew)
const BASE_HI_VAL = 0x01;
const BASE2_LO_ADDR = 0xc005; // Math.base + 1 = $0103 — lo byte
const BASE2_LO_VAL = 0x03;
const BASE2_HI_ADDR = 0xc006; // $0103 — hi byte
const BASE2_HI_VAL = 0x01;
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

      await runUntilMemory(driver, BASE2_LO_ADDR, BASE2_LO_VAL); // the last result settled
      await assertMemory(driver, ADD_ADDR, ADD_VAL); // $C000 == $05 (imported add)
      await assertMemory(driver, TWICE_ADDR, TWICE_VAL); // $C001 == $08 (qualified twice)
      await assertMemory(driver, COMBO_ADDR, COMBO_VAL); // $C002 == $07 (init order)
      await assertMemory(driver, BASE_LO_ADDR, BASE_LO_VAL); // $C003 == $02 (base lo)
      await assertMemory(driver, BASE_HI_ADDR, BASE_HI_VAL); // $C004 == $01 (base hi)
      await assertMemory(driver, BASE2_LO_ADDR, BASE2_LO_VAL); // $C005 == $03 (base+1 lo)
      await assertMemory(driver, BASE2_HI_ADDR, BASE2_HI_VAL); // $C006 == $01 (base+1 hi)
    },
    LOCAL_TEST_TIMEOUT,
  );
});
