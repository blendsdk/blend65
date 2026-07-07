/**
 * Config merging: defaults ← file ← overrides.
 *
 * `mergeConfig` is the single producer of `BlendConfig` values: defaults
 * come from {@link CONFIG_DEFAULTS}, the two computed fields come from the
 * caller-supplied `origin`, and only explicitly-set (non-undefined)
 * override values apply. Arrays replace wholesale — they are never
 * concatenated.
 */

import { CONFIG_DEFAULTS } from "./defaults.js";
import type { BlendConfig, ConfigOverrides } from "./types.js";

/** The two fields `loadConfig` computes for the origin. */
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
 * `undefined` — only explicitly set values should ever override.
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
 * Merges file values and invocation overrides over the defaults and stamps
 * the computed origin fields.
 *
 * Precedence (lowest → highest): defaults, `fileValues`, `overrides`.
 * `platform` starts as `""` — its "no default" marker; the semantic pass
 * reports E10245 when it is still `""` after merging. `origin` always wins
 * for `configPath`/`projectRoot`: they are computed by `loadConfig`, never
 * user-suppliable via overrides.
 *
 * @param fileValues Shape-valid keys extracted from blend65.json.
 * @param overrides Invocation overrides (CLI flags / CompilerOptions).
 * @param origin The computed configPath/projectRoot pair.
 * @returns A fully-populated config — validity is the semantic pass's
 *   concern, not this function's.
 */
export function mergeConfig(
  fileValues: Partial<BlendConfig>,
  overrides: ConfigOverrides | undefined,
  origin: ConfigOrigin,
): BlendConfig {
  return {
    // Defaults tier. Arrays are copied so the shared CONFIG_DEFAULTS
    // templates can never be mutated through a returned config.
    platform: "",
    ...CONFIG_DEFAULTS,
    include: [...CONFIG_DEFAULTS.include],
    exclude: [...CONFIG_DEFAULTS.exclude],
    suppressWarnings: [...CONFIG_DEFAULTS.suppressWarnings],
    // File tier then override tier — arrays replace.
    ...withoutUndefined(fileValues),
    ...withoutUndefined(overrides),
    // Computed fields last: origin always wins.
    configPath: origin.configPath,
    projectRoot: origin.projectRoot,
  };
}
