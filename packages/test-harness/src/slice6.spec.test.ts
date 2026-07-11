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
import { buildSlice6, type BuiltSlice6 } from "./testing/slice6.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { assertMemory, runUntilMemory } from "./index.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** Observable RAM: the poked results ($C000..$C008). */
const PROMO_LO_ADDR = 0xc000; // base + a += 55 = 1255 = $04E7 — lo byte
const PROMO_LO_VAL = 0xe7;
const PROMO_HI_ADDR = 0xc001; // $04E7 — hi byte
const PROMO_HI_VAL = 0x04;
const BITS_ADDR = 0xc002; // ~((<byte>($0304) << 3) | 5) = ~37 = $DA
const BITS_VAL = 0xda;
const NEG_ADDR = 0xc003; // <byte>(-(-5)) = 5
const NEG_VAL = 0x05;
const TERNARY_ADDR = 0xc004; // (a < base) && (s < 0) ? 7 : 9 = 7
const TERNARY_VAL = 0x07;
const SUPPRESS_ADDR = 0xc005; // witness after two SUPPRESSED bump() calls
const SUPPRESS_VAL = 0x00;
const RAN_ADDR = 0xc006; // witness after bump() ran exactly once
const RAN_VAL = 0x01;
const SHIFT_LO_ADDR = 0xc007; // $0011 << 2 = $0044 — lo byte (the sentinel)
const SHIFT_LO_VAL = 0x44;
const SHIFT_HI_ADDR = 0xc008; // $0044 — hi byte
const SHIFT_HI_VAL = 0x00;
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

      await runUntilMemory(driver, SHIFT_LO_ADDR, SHIFT_LO_VAL); // the sentinel settled
      await assertMemory(driver, PROMO_LO_ADDR, PROMO_LO_VAL); // $C000 == $E7
      await assertMemory(driver, PROMO_HI_ADDR, PROMO_HI_VAL); // $C001 == $04
      await assertMemory(driver, BITS_ADDR, BITS_VAL); // $C002 == $DA
      await assertMemory(driver, NEG_ADDR, NEG_VAL); // $C003 == $05
      await assertMemory(driver, TERNARY_ADDR, TERNARY_VAL); // $C004 == $07
      await assertMemory(driver, SUPPRESS_ADDR, SUPPRESS_VAL); // $C005 == $00 — SUPPRESSED
      await assertMemory(driver, RAN_ADDR, RAN_VAL); // $C006 == $01 — ran exactly once
      await assertMemory(driver, SHIFT_LO_ADDR, SHIFT_LO_VAL); // $C007 == $44
      await assertMemory(driver, SHIFT_HI_ADDR, SHIFT_HI_VAL); // $C008 == $00
    },
    LOCAL_TEST_TIMEOUT,
  );
});
