/**
 * Harness-internal platform→emulator registry (RD-12 R7a).
 *
 * Maps a platform name to the emulator that runs it. MVP: only `c64` → VICE
 * `x64sc`. Other platforms (cx16→x16emu, atari→Altirra, 7800→Stella) register as
 * their drivers land; a future RD may migrate this table into the RD-10 platform
 * profile (PF-006). The interface accommodates them today (R9); populating them is
 * out of scope (R-Won't-Have).
 */

import type { EmulatorDriver } from "./driver.js";
import { ViceDriver } from "./vice/vice-driver.js";

/** A registry entry: how to create the driver and how to find its executable. */
export interface EmulatorEntry {
  /** Construct a fresh driver instance for this platform. */
  createDriver(): EmulatorDriver;
  /** The emulator executable name, resolved on `PATH` when no explicit path is given. */
  executableName: string;
  /** Platform-specific extra launch args (beyond the driver's standard headless args). */
  defaultArgs: string[];
}

/** The R7a table. MVP: `c64` → VICE `x64sc`. */
export const EMULATOR_REGISTRY: Record<string, EmulatorEntry> = {
  c64: {
    createDriver: (): EmulatorDriver => new ViceDriver(),
    executableName: "x64sc",
    defaultArgs: [],
  },
};

/**
 * Look up the emulator entry for `platform` (R7a).
 *
 * @throws If no emulator is registered for `platform`.
 */
export function emulatorFor(platform: string): EmulatorEntry {
  const entry = EMULATOR_REGISTRY[platform];
  if (entry === undefined) {
    throw new Error(`no emulator registered for platform '${platform}'`);
  }
  return entry;
}
