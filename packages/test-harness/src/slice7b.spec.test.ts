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
import { buildSlice7b, type BuiltSlice7b } from "./testing/slice7b.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { assertMemory, runUntilMemory } from "./index.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** Observable RAM: the poked results ($C000..$C006). */
const MUTATE_ADDR = 0xc000; // boss.hp after relay → resetEnemy
const MUTATE_VAL = 0x00;
const NESTED_ADDR = 0xc001; // boss.pos.y = 42 through the pair
const NESTED_VAL = 0x2a;
const SUM_ADDR = 0xc002; // sum(TABLE, length(TABLE)) = 3+5+7
const SUM_VAL = 0x0f;
const TIER2_ADDR = 0xc003; // big[260] via the runtime word index
const TIER2_VAL = 0x1d;
const LOWRANGE_ADDR = 0xc004; // big[4] via the const index — not aliased by 260
const LOWRANGE_VAL = 0x11;
const COPYX_ADDR = 0xc005; // b.x after copyPoint(b, a); a.x = 99 → still 11
const COPYX_VAL = 0x0b;
const COPYY_ADDR = 0xc006; // b.y
const COPYY_VAL = 0x16;
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

      await runUntilMemory(driver, COPYY_ADDR, COPYY_VAL); // the last poke settled
      await assertMemory(driver, MUTATE_ADDR, MUTATE_VAL); // $C000 == $00
      await assertMemory(driver, NESTED_ADDR, NESTED_VAL); // $C001 == $2A
      await assertMemory(driver, SUM_ADDR, SUM_VAL); // $C002 == $0F
      await assertMemory(driver, TIER2_ADDR, TIER2_VAL); // $C003 == $1D
      await assertMemory(driver, LOWRANGE_ADDR, LOWRANGE_VAL); // $C004 == $11
      await assertMemory(driver, COPYX_ADDR, COPYX_VAL); // $C005 == $0B
      await assertMemory(driver, COPYY_ADDR, COPYY_VAL); // $C006 == $16
    },
    LOCAL_TEST_TIMEOUT,
  );
});
