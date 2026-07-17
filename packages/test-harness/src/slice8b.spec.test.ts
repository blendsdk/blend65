/**
 * Specification tests for the Slice 8b acceptance bar: the data-surface
 * fixture assembles clean through real ACME (string/embed const data, the
 * banner init stream, and the copy loop all resolve), and on real VICE the
 * observables land byte-for-byte: the PETSCII title copied to screen RAM,
 * the embedded table staged to `$C000`, the mutated banner (`B`,`I`,`.`×6)
 * at `$C010`, and the char-comparison flag at `$C020`. The `$C020` flag is
 * the fixture's LAST write, so waiting on it settles every earlier
 * observable deterministically.
 *
 * These tests derive from the fixture's documented behavior, not from
 * reading the implementation. The assemble-clean suite compiles via ACME
 * (`skipIf(!hasAcme())`); the runtime suite additionally runs on VICE
 * (`skipIf(!(hasVice && hasAcme))`, skipped in CI — the golden tier guards
 * there).
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildSlice8b, type BuiltSlice8b } from "./testing/slice8b.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { assertMemory, runUntilMemory } from "./index.js";
import type { EmulatorDriver } from "./emulator/driver.js";

const LOCAL_TEST_TIMEOUT = 120000;

/** The PETSCII bytes of `"HELLO C64!"`. */
const TITLE_BYTES = [0x48, 0x45, 0x4c, 0x4c, 0x4f, 0x20, 0x43, 0x36, 0x34, 0x21];
/** The committed `table.bin` bytes. */
const TABLE_BYTES = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];
/** The banner after the `'B'` store: `B`,`I`, then six fill dots. */
const BANNER_BYTES = [0x42, 0x49, 0x2e, 0x2e, 0x2e, 0x2e, 0x2e, 0x2e];

describe.skipIf(!hasAcme())("Specification: Slice 8b assemble-clean", () => {
  let built: BuiltSlice8b | undefined;

  afterAll(() => built?.cleanup());

  it("compiles the strings/embed fixture to a loadable c64 PRG", async () => {
    built = await buildSlice8b();
    expect(built.result.hasErrors).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: Slice 8b on VICE", () => {
  let built: BuiltSlice8b | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "lands every observable byte-for-byte (title, table, banner, comparison flag)",
    async () => {
      built = await buildSlice8b();
      expect(built.result.hasErrors).toBe(false);
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      // The comparison flag is main's last write — once it lands, every
      // earlier copy has finished.
      await runUntilMemory(driver, 0xc020, 1, LOCAL_TEST_TIMEOUT);
      await assertMemory(driver, 0xc020, 1);

      const screen = Array.from(await driver.readMemory(0x0400, TITLE_BYTES.length));
      expect(screen).toEqual(TITLE_BYTES);

      const table = Array.from(await driver.readMemory(0xc000, TABLE_BYTES.length));
      expect(table).toEqual(TABLE_BYTES);

      const banner = Array.from(await driver.readMemory(0xc010, BANNER_BYTES.length));
      expect(banner).toEqual(BANNER_BYTES);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
