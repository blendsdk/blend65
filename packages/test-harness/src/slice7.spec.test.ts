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
import { buildSlice7, type BuiltSlice7 } from "./testing/slice7.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { assertMemory, runUntilMemory } from "./index.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** Observable RAM: the poked results ($C000..$C009). */
const SUM_ADDR = 0xc000; // 1+2+3+4+4 over byte[5] = [1,2,3;4]
const SUM_VAL = 0x0e;
const NESTED_ADDR = 0xc001; // player.pos.y = 42
const NESTED_VAL = 0x2a;
const SCALED_ADDR = 0xc002; // pts[1].x = 8 (runtime index × 2)
const SCALED_VAL = 0x08;
const SWITCH_ADDR = 0xc003; // case Direction.DOWN → 2
const SWITCH_VAL = 0x02;
const LENGTH_ADDR = 0xc004; // length(TABLE) — size DIM + sizeof(Point) = 6
const LENGTH_VAL = 0x06;
const SIZEOF_ADDR = 0xc005; // sizeof(Point) = 2
const SIZEOF_VAL = 0x02;
const OFFSETOF_ADDR = 0xc006; // offsetof(Point, y) = 1
const OFFSETOF_VAL = 0x01;
const XMOD_ADDR = 0xc007; // Gfx.TABLE[1] = 20
const XMOD_VAL = 0x14;
const COPY_ADDR = 0xc008; // b.x after b = a; a.x = 99 → still 11
const COPY_VAL = 0x0b;
const CAST_ADDR = 0xc009; // <byte>(<word>(Direction.DOWN)) = 3 — the sentinel
const CAST_VAL = 0x03;
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

      await runUntilMemory(driver, CAST_ADDR, CAST_VAL); // the last poke settled
      await assertMemory(driver, SUM_ADDR, SUM_VAL); // $C000 == $0E
      await assertMemory(driver, NESTED_ADDR, NESTED_VAL); // $C001 == $2A
      await assertMemory(driver, SCALED_ADDR, SCALED_VAL); // $C002 == $08
      await assertMemory(driver, SWITCH_ADDR, SWITCH_VAL); // $C003 == $02
      await assertMemory(driver, LENGTH_ADDR, LENGTH_VAL); // $C004 == $06
      await assertMemory(driver, SIZEOF_ADDR, SIZEOF_VAL); // $C005 == $02
      await assertMemory(driver, OFFSETOF_ADDR, OFFSETOF_VAL); // $C006 == $01
      await assertMemory(driver, XMOD_ADDR, XMOD_VAL); // $C007 == $14
      await assertMemory(driver, COPY_ADDR, COPY_VAL); // $C008 == $0B
      await assertMemory(driver, CAST_ADDR, CAST_VAL); // $C009 == $03
    },
    LOCAL_TEST_TIMEOUT,
  );
});
