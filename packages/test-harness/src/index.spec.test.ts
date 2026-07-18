/**
 * Specification test for the public package barrel.
 *
 * These tests are derived directly from the package's documented public
 * surface, not from reading the implementation. The barrel exports exactly the
 * stable API; internal VICE protocol / socket plumbing and test-only helpers
 * must NOT leak.
 */

import { describe, expect, it } from "vitest";
import * as harness from "./index.js";
// Type-only imports: fail to compile if the barrel stops exporting these types.
import type {
  BreakReason,
  EmulatorDriver,
  LaunchOptions,
  Registers,
} from "./index.js";

/** The stable VALUE exports the barrel must expose. */
const PUBLIC_VALUE_EXPORTS = [
  "ViceDriver",
  "runUntilLabel",
  "runFrames",
  "runUntilMemory",
  "withTimeout",
  "DEFAULT_TIMEOUT_MS",
  "TimeoutError",
  "measureCycles",
  "quiesce",
  "isCycleMeasurementDriver",
  "assertRegister",
  "assertMemory",
  "AssertionError",
  "assertGolden",
  "setupEmulator",
  "hasVice",
  "hasAcme",
  "EMULATOR_REGISTRY",
  "emulatorFor",
];

/** Internal symbols that must stay OFF the public surface. */
const INTERNAL_SYMBOLS = [
  "encodeCommand",
  "decodeResponses",
  "CMD",
  "parseMemoryGet",
  "parseRegistersAvailable",
  "encodePng",
  "FakeDriver",
  "buildGate",
  "GATE_SRC",
  "VERSION",
];

describe("Specification: public package barrel (ST-27)", () => {
  it("ST-27: exports every documented stable value symbol", () => {
    for (const name of PUBLIC_VALUE_EXPORTS) {
      expect(harness, `missing export: ${name}`).toHaveProperty(name);
    }
  });

  it("ST-27: does NOT leak internal protocol / socket / test-only symbols", () => {
    const keys = Object.keys(harness);
    for (const name of INTERNAL_SYMBOLS) {
      expect(keys, `internal symbol leaked: ${name}`).not.toContain(name);
    }
  });

  it("ST-27: exposes no unexpected extra value exports beyond the documented surface", () => {
    // The barrel's value surface is exactly the documented set (types are erased).
    expect(Object.keys(harness).sort()).toEqual([...PUBLIC_VALUE_EXPORTS].sort());
  });

  it("ST-27: the exported types are usable (compile-time surface)", () => {
    // A no-op that only type-checks if the types are exported from the barrel.
    const _driver: EmulatorDriver | undefined = undefined;
    const _opts: LaunchOptions | undefined = undefined;
    const _regs: Registers | undefined = undefined;
    const _reason: BreakReason | undefined = undefined;
    expect([_driver, _opts, _regs, _reason].every((v) => v === undefined)).toBe(true);
  });
});
