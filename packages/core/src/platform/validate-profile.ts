/**
 * Shared `PlatformProfile` consistency checks — RD-10 FR-21/R22 (and R31).
 *
 * Each plugin's `validateProfile()` delegates here so the field invariants live
 * in exactly one place. Checks are **non-throwing**: every problem is collected
 * into a {@link ValidationError}[] so the driver (RD-15/16) can surface all of
 * them at once. An empty array means the profile is internally consistent.
 */

import type { PlatformProfile } from "./platform-profile.js";
import type { ValidationError } from "./platform-plugin.js";

/**
 * Render a byte/word value as a fixed `$XX`-style hex string for diagnostics.
 *
 * @param value The numeric value to render.
 * @returns The value as an upper-case `$`-prefixed hex string.
 */
function hex(value: number): string {
  return `$${value.toString(16).toUpperCase()}`;
}

/**
 * Check a {@link PlatformProfile} for internal consistency (R22).
 *
 * The invariants checked:
 * - `zpStart <= zpEnd` — the zero-page window must be non-empty and ordered.
 * - `codeStart < codeEnd` — the code segment must be a non-empty range.
 * - `maxZp === zpEnd - zpStart + 1` — the budget must match the ZP window size.
 *
 * @param profile The profile to validate.
 * @returns The list of inconsistencies (empty when the profile is consistent).
 */
export function validateProfileFields(
  profile: PlatformProfile,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (profile.zpStart > profile.zpEnd) {
    errors.push({
      field: "zpStart",
      message: `zpStart (${hex(profile.zpStart)}) must be <= zpEnd (${hex(profile.zpEnd)})`,
    });
  }

  if (profile.codeStart >= profile.codeEnd) {
    errors.push({
      field: "codeStart",
      message: `codeStart (${hex(profile.codeStart)}) must be < codeEnd (${hex(profile.codeEnd)})`,
    });
  }

  const expectedZp = profile.zpEnd - profile.zpStart + 1;
  if (profile.maxZp !== expectedZp) {
    errors.push({
      field: "maxZp",
      message: `maxZp (${profile.maxZp}) must equal zpEnd - zpStart + 1 (${expectedZp})`,
    });
  }

  return errors;
}
