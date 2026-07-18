/**
 * Specification tests for the Slice 3a acceptance bar: the local-`byte` fixture
 * assembles clean through the real populated-model path, and on real VICE the
 * local's frame slot drives the VIC-II border register.
 *
 * These tests are derived directly from the fixture's documented behavior, not
 * from reading the implementation. This proves `__frame_Main_main_x` resolves
 * in a real `load`, not merely appears in the symbol header.
 *
 * The assemble-clean suite compiles via ACME (`skipIf(!hasAcme())`, CI installs
 * ACME); the runtime suite additionally runs on VICE (`skipIf(!(hasVice && hasAcme))`,
 * skipped in CI — the golden tier guards regression there).
 */

import { afterAll, describe, expect, it } from "vitest";
import {
  buildSlice3a,
  emitAsmSlice3a,
  SLICE3A_OBSERVABLES,
  type BuiltSlice3a,
} from "./testing/slice3a.js";
import { assertObservables } from "./testing/observables.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

const LOCAL_TEST_TIMEOUT = 30000;

describe.skipIf(!hasAcme())("Specification: Slice 3a assemble-clean (ST-5)", () => {
  let built: BuiltSlice3a | undefined;

  afterAll(() => built?.cleanup());

  it("compiles the local-byte fixture to a loadable c64 PRG with the frame symbols", async () => {
    built = await buildSlice3a();

    // Loadable PRG, zero error diagnostics (ACME rejects any undefined __frame_* ref).
    expect(built.result.hasErrors).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);

    // The real populated-model path emits both the frame base and the slot symbol.
    const asm = emitAsmSlice3a();
    expect(asm.text).toContain("__frame_Main_main");
    expect(asm.text).toContain("__frame_Main_main_x");
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))(
  "Specification: Slice 3a on VICE (ST-7)",
  () => {
    let built: BuiltSlice3a | undefined;
    let driver: EmulatorDriver | undefined;

    afterAll(async () => {
      if (driver !== undefined) await driver.shutdown();
      built?.cleanup();
    });

    it(
      "drives $D020 to 0xF5 via the local's frame slot on real VICE",
      async () => {
        built = await buildSlice3a();
        const env = await setupEmulator({ build: built.result, platform: "c64" });
        driver = env.driver;

        // The shared observable set — the same table the twin tier consumes.
        await assertObservables(driver, SLICE3A_OBSERVABLES);
      },
      LOCAL_TEST_TIMEOUT,
    );
  },
);
