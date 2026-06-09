/**
 * The static platform registry + loader — RD-10 R28–R33; spec Ch 15 §2;
 * decision D4. Wires the five built-in plugins into a deterministic map with a
 * by-id loader; no dynamic plugin loading in v1.
 */

import type { PlatformPlugin } from "@blend65/core/platform";

import { c64Plugin } from "./c64.js";
import { c64uPlugin } from "./c64u.js";
import { cx16Plugin } from "./cx16.js";
import { a800xlPlugin } from "./a800xl.js";
import { a7800Plugin } from "./a7800.js";

/**
 * Static registry of all built-in platform plugins (R28). Insertion order is
 * `c64, c64u, cx16, a800xl, a7800` — deterministic, so the loader's error
 * message lists the IDs in a stable order.
 */
export const PLATFORM_REGISTRY: ReadonlyMap<string, PlatformPlugin> = new Map([
  ["c64", c64Plugin],
  ["c64u", c64uPlugin],
  ["cx16", cx16Plugin],
  ["a800xl", a800xlPlugin],
  ["a7800", a7800Plugin],
]);

/** The default platform for the MVP (R33). */
export const DEFAULT_PLATFORM = "c64";

/**
 * Load a platform plugin by ID (R29/R30).
 *
 * Throws a plain {@link Error} (not a compiler diagnostic — wiring the message
 * into the diagnostics engine is RD-15/16's job) listing the available platform
 * IDs in registry order when `id` is unknown.
 *
 * @param id The platform ID, e.g. `"c64"`.
 * @returns The matching {@link PlatformPlugin}.
 * @throws {Error} When `id` is not a registered platform.
 */
export function loadPlatform(id: string): PlatformPlugin {
  const plugin = PLATFORM_REGISTRY.get(id);
  if (plugin === undefined) {
    const available = [...PLATFORM_REGISTRY.keys()].join(", ");
    throw new Error(
      `Unknown platform '${id}' — available platforms: ${available}`,
    );
  }
  return plugin;
}
