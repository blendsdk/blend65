/**
 * Config merging (RD-16 §4.3 steps 4–5): defaults ← file ← overrides.
 *
 * `mergeConfig` is the single producer of `BlendConfig` values (PF-021):
 * defaults come from {@link CONFIG_DEFAULTS}, the two computed fields come
 * from the caller-supplied `origin`, and only explicitly-set (non-undefined)
 * override values apply (R24/R25). Arrays replace wholesale — they are never
 * concatenated (R25).
 */

import { CONFIG_DEFAULTS } from "./defaults.js";
import type { BlendConfig, ConfigOverrides } from "./types.js";

/** The two fields `loadConfig` computes in §4.3 step 1 (PF-021). */
export interface ConfigOrigin {
  /** Absolute path of the loaded blend65.json, or null on a discovery miss. */
  readonly configPath: string | null;
  /** Absolute project root: dirname(configPath) or the resolved cwd. */
  readonly projectRoot: string;
}

/**
 * Copies `source[key]` onto `target` when it is explicitly set
 * (non-undefined). The generic key keeps the write type-safe: TypeScript
 * correlates `target[key]` and `source[key]` through `K`.
 */
function copyIfDefined<K extends keyof BlendConfig>(
  target: Partial<BlendConfig>,
  source: ConfigOverrides,
  key: K,
): void {
  const value = source[key];
  if (value !== undefined) {
    target[key] = value;
  }
}

/**
 * Returns a copy of `values` with every `undefined`-valued key removed, so a
 * later object-spread cannot clobber a lower-precedence value with
 * `undefined` (R25 — "only explicitly set values").
 */
function withoutUndefined(values: ConfigOverrides | undefined): Partial<BlendConfig> {
  const defined: Partial<BlendConfig> = {};
  if (values === undefined) return defined;
  for (const key of Object.keys(values) as (keyof BlendConfig)[]) {
    copyIfDefined(defined, values, key);
  }
  return defined;
}

/**
 * Merges file values and invocation overrides over the §4.1 defaults
 * (R23/R24/R25) and stamps the computed origin fields.
 *
 * Precedence (lowest → highest): defaults, `fileValues`, `overrides`.
 * `platform` starts as `""` — its "no default" marker (R31/AR-P9); the
 * semantic pass reports E10245 when it is still `""` after merging.
 * `origin` always wins for `configPath`/`projectRoot`: they are computed by
 * `loadConfig`, never user-suppliable via overrides (PF-021).
 *
 * @param fileValues Shape-valid keys extracted from blend65.json.
 * @param overrides Invocation overrides (CLI flags / CompilerOptions).
 * @param origin The computed configPath/projectRoot pair.
 * @returns A fully-populated config (AC-11) — validity is the semantic
 *   pass's concern, not this function's.
 */
export function mergeConfig(
  fileValues: Partial<BlendConfig>,
  overrides: ConfigOverrides | undefined,
  origin: ConfigOrigin,
): BlendConfig {
  return {
    // Defaults tier (R23). Arrays are copied so the shared CONFIG_DEFAULTS
    // templates can never be mutated through a returned config.
    platform: "",
    ...CONFIG_DEFAULTS,
    include: [...CONFIG_DEFAULTS.include],
    exclude: [...CONFIG_DEFAULTS.exclude],
    suppressWarnings: [...CONFIG_DEFAULTS.suppressWarnings],
    // File tier (R23) then override tier (R24/R25) — arrays replace.
    ...withoutUndefined(fileValues),
    ...withoutUndefined(overrides),
    // Computed fields last: origin always wins (PF-021).
    configPath: origin.configPath,
    projectRoot: origin.projectRoot,
  };
}
