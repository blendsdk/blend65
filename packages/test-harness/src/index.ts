/**
 * `@blend65/test-harness` — the public API (RD-12 §3 R33–R35, AC-14).
 *
 * The three-tier testing framework and runtime-verification toolkit: an abstract
 * {@link EmulatorDriver}, the VICE `x64sc` {@link ViceDriver}, timeout-guarded run
 * strategies, register/memory assertions, an `assertGolden` snapshot helper, and
 * the {@link setupEmulator} Vitest fixture. Works with any binary + VICE label file,
 * not just Blend65 output (AC-15).
 *
 * This barrel is the STABLE surface (R34): the internal VICE binary-monitor codec,
 * socket plumbing, PNG encoder, and test-only helpers are deliberately NOT exported.
 *
 * @example
 * ```typescript
 * import { setupEmulator, runUntilMemory, assertMemory, hasVice } from "@blend65/test-harness";
 * import { build } from "@blend65/compiler";
 *
 * describe.skipIf(!hasVice())("gate on c64", () => {
 *   it("pokes the border", async () => {
 *     const result = await build({ platform: "c64", sourceFiles: ["examples/gate/main.blend"] });
 *     const { driver } = await setupEmulator({ build: result, platform: "c64" });
 *     await runUntilMemory(driver, 0xd020, 0xf5); // border colour 5 (unused nibble reads 1s)
 *     await assertMemory(driver, 0xd020, 0xf5);
 *     await driver.shutdown();
 *   });
 * });
 * ```
 */

// Emulator driver contract + concrete VICE driver.
export type { EmulatorDriver, LaunchOptions, Registers, BreakReason } from "./emulator/driver.js";
export { ViceDriver } from "./emulator/vice/vice-driver.js";

// Platform → emulator registry (R7a).
export { EMULATOR_REGISTRY, emulatorFor, type EmulatorEntry } from "./emulator/registry.js";

// Run strategies (timeout-guarded).
export { runUntilLabel, runFrames, runUntilMemory, DEFAULT_TIMEOUT_MS, TimeoutError } from "./run/strategies.js";

// Register/memory assertions.
export { assertRegister, assertMemory, AssertionError } from "./run/assertions.js";

// Golden-snapshot helper.
export { assertGolden } from "./golden.js";

// Vitest lifecycle fixture + skip guards.
export {
  setupEmulator,
  hasVice,
  hasAcme,
  type SetupEmulatorOptions,
  type EmulatorEnv,
} from "./fixture.js";
