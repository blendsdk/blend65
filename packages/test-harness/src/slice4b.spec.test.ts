/**
 * Specification tests for the RD-18 Slice 4b acceptance bar (parts 1 & 3): the
 * `switch` fixture assembles clean through the real `brcond` compare-chain path,
 * and on real VICE the computed byte results (Switch A: multi-value case +
 * fallthrough + auto-break → 25; Switch B: the default path → 7) settle into
 * observable RAM.
 *
 * Derived EXCLUSIVELY from `03-03-acceptance-fixtures.md` (ST-19/ST-21) + the
 * Ambiguity Register (AR-13) — never from reading the implementation (IMMUTABLE
 * ORACLE). The assemble-clean suite compiles via ACME (`skipIf(!hasAcme())`); the
 * runtime suite additionally runs on VICE (`skipIf(!(hasVice && hasAcme))`, skipped
 * in CI — the golden tier guards there).
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildSlice4b, emitAsmSlice4b, type BuiltSlice4b } from "./testing/slice4b.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { assertMemory, runUntilMemory } from "./index.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** Observable RAM: the two switch results. */
const OUT1_ADDR = 0xc000; // Switch A: case 2,3 (acc=20) --fallthrough--> case 4 (+5) = 25 = $19
const OUT1_VAL = 0x19;
const OUT2_ADDR = 0xc001; // Switch B: sel2=9 matches no case → default → 7 = $07
const OUT2_VAL = 0x07;
const LOCAL_TEST_TIMEOUT = 30000;

describe.skipIf(!hasAcme())("Specification: Slice 4b assemble-clean (ST-19)", () => {
  let built: BuiltSlice4b | undefined;

  afterAll(() => built?.cleanup());

  it("compiles the switch fixture to a loadable c64 PRG", async () => {
    built = await buildSlice4b();

    // Loadable PRG, zero error diagnostics (ACME rejects any undefined label ref).
    expect(built.result.hasErrors).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);

    // The compare-chain path emits dispatch/body block labels, branch instructions,
    // per-case comparisons, and the module scalar symbols.
    const asm = emitAsmSlice4b();
    expect(asm.text).toContain("Main_main_L"); // multi-block dispatch/body labels
    expect(asm.text).toContain("CMP"); // per-case-value comparison
    expect(asm.text).toContain("JMP"); // br → JMP
    expect(asm.text).toMatch(/\b(BNE|BEQ)\b/); // brcond / DEF-1 eq branch
    expect(asm.text).toContain("__var_Main_out1");
    expect(asm.text).toContain("__var_Main_out2");
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: Slice 4b on VICE (ST-21)", () => {
  let built: BuiltSlice4b | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "computes the switch results (25 and 7) on real VICE, poked to plain RAM",
    async () => {
      built = await buildSlice4b();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      await runUntilMemory(driver, OUT1_ADDR, OUT1_VAL); // Switch A result settled
      await assertMemory(driver, OUT1_ADDR, OUT1_VAL); // $C000 == $19 (25)
      await assertMemory(driver, OUT2_ADDR, OUT2_VAL); // $C001 == $07 (7)
    },
    LOCAL_TEST_TIMEOUT,
  );
});
