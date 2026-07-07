/**
 * Specification tests for the RD-18 Slice 4a acceptance bar (parts 1 & 3): the
 * conditionals + loops fixture assembles clean through the real multi-block CFG
 * path, and on real VICE the computed byte result (a for-loop with break/continue
 * plus a while-loop, then a two-armed if/else) settles into observable RAM.
 *
 * Derived EXCLUSIVELY from `03-04-acceptance-fixtures.md` (ST-19/ST-21) + the
 * Ambiguity Register (AR-13) — never from reading the implementation (IMMUTABLE
 * ORACLE). The assemble-clean suite compiles via ACME (`skipIf(!hasAcme())`); the
 * runtime suite additionally runs on VICE (`skipIf(!(hasVice && hasAcme))`, skipped
 * in CI — the golden tier guards there).
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildSlice4a, emitAsmSlice4a, type BuiltSlice4a } from "./testing/slice4a.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { assertMemory, runUntilMemory } from "./index.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** Observable RAM: the byte sum result and the if/else branch marker. */
const SUM_ADDR = 0xc000; // result = (1+2+4+5+6) + (1+1+1) = 18 + 3 = 21 = $15
const SUM_VAL = 0x15;
const BRANCH_ADDR = 0xc001; // result (21) > 20 → the `then` arm pokes 1
const BRANCH_VAL = 0x01;
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

      await runUntilMemory(driver, SUM_ADDR, SUM_VAL); // sum result settled
      await assertMemory(driver, SUM_ADDR, SUM_VAL); // $C000 == $15 (21)
      await assertMemory(driver, BRANCH_ADDR, BRANCH_VAL); // $C001 == $01 (then arm)
    },
    LOCAL_TEST_TIMEOUT,
  );
});
