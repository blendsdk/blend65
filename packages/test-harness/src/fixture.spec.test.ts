/**
 * Specification tests for the `setupEmulator` fixture.
 *
 * These tests are derived directly from the fixture's documented behavior, not
 * from reading the implementation. Local tier (skipIf-VICE); the BuildResult
 * path additionally needs ACME to build the gate, while the any-pre-built-binary
 * path needs only VICE.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGate, type BuiltGate } from "./testing/gate.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** Generous per-test budget for suites that build and/or launch VICE. */
const LOCAL_TEST_TIMEOUT = 30000;

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: setupEmulator from a BuildResult (ST-23)", () => {
  let gate: BuiltGate | undefined;
  let driver: EmulatorDriver | undefined;

  afterEach(async () => {
    if (driver !== undefined) {
      await driver.shutdown();
      driver = undefined;
    }
    gate?.cleanup();
    gate = undefined;
  });

  it("ST-23: returns { driver, symbols } with symbols from build.symbolMap and a launched driver", async () => {
    gate = await buildGate();
    const env = await setupEmulator({ build: gate.result, platform: "c64" });
    driver = env.driver;
    expect(env.symbols.get("_main")).toBe(gate.result.symbolMap!.get("_main"));
    expect(env.symbols.size).toBeGreaterThan(0);
    // The driver is live: a register read round-trips.
    const regs = await driver.readRegisters();
    expect(typeof regs.pc).toBe("number");
  }, LOCAL_TEST_TIMEOUT);
});

describe.skipIf(!hasVice("c64"))("Specification: setupEmulator from any binary + label file (ST-28, AC-15)", () => {
  let driver: EmulatorDriver | undefined;
  let cwd: string | undefined;

  afterEach(async () => {
    if (driver !== undefined) {
      await driver.shutdown();
      driver = undefined;
    }
    if (cwd !== undefined) {
      rmSync(cwd, { recursive: true, force: true });
      cwd = undefined;
    }
  });

  it("ST-28: parses a sibling VICE label file for a non-Blend65 PRG", async () => {
    cwd = mkdtempSync(join(tmpdir(), "b65-harness-anybin-"));
    // A minimal c64 BASIC autostarter: 10 SYS 2064 ($0810), then a routine that
    // sets the border and RTSes. Load address $0801.
    const prg = new Uint8Array([
      0x01, 0x08, // load address $0801
      0x0b, 0x08, // link to next line ($080b)
      0x0a, 0x00, // line number 10
      0x9e, 0x20, 0x32, 0x30, 0x36, 0x34, // "SYS 2064"
      0x00, // end of line
      0x00, 0x00, // end of program
      0xa9, 0x02, // $0810: LDA #$02
      0x8d, 0x20, 0xd0, // STA $D020
      0x60, // RTS
    ]);
    const binary = join(cwd, "any.prg");
    const labelFile = join(cwd, "any.lbl");
    writeFileSync(binary, prg);
    writeFileSync(labelFile, "al C:0810 .entry\nal C:d020 .border\n", "utf8");

    const env = await setupEmulator({ binary, labelFile, platform: "c64" });
    driver = env.driver;
    expect(env.symbols.get("entry")).toBe(0x0810);
    expect(env.symbols.get("border")).toBe(0xd020);
  }, LOCAL_TEST_TIMEOUT);
});
