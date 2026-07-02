/**
 * Config defaults and the schema descriptor table (RD-16 §4.1, AR-P6).
 *
 * One table — {@link CONFIG_SCHEMA} — drives default filling, type-shape
 * checks (E10243 "wrong type"), and value rules (range / enum / warning-code
 * format), so validation never degenerates into per-key `if` ladders (DRY).
 * `platform` deliberately has NO default: the platform registry's
 * `DEFAULT_PLATFORM` is never consulted (RD-16 R31).
 */

import type { BlendConfig } from "./types.js";

/**
 * Warning-code format accepted by `warnAsError` (array form) and
 * `suppressWarnings` entries: `W` + exactly five digits — the concrete
 * reading of RD-16's "match the W10xxx pattern", matching every shipped
 * W-code in `@blend65/core`'s registry.
 */
export const W_CODE_PATTERN = /^W\d{5}$/;

/**
 * The RD-16 §4.1 defaults table, verbatim. Excludes the two computed fields
 * (`configPath`, `projectRoot`) and `platform` (no default — R31).
 * Array values are shared templates: consumers (mergeConfig) must copy
 * them, never hand them out mutable.
 */
export const CONFIG_DEFAULTS: Readonly<
  Omit<BlendConfig, "configPath" | "projectRoot" | "platform">
> = {
  include: ["**/*.blend"],
  exclude: ["node_modules/**"],
  outDir: "./build/",
  outName: "",
  acmePath: "",
  maxErrors: 20,
  warnAsError: false,
  suppressWarnings: [],
  diagnosticsFormat: "terminal",
  optimize: true,
  quiet: false,
  startup: "auto",
};

/**
 * Per-key schema entry: default value, expected-shape text, a typed
 * shape-check-and-assign, and optional value rules.
 *
 * `apply` both narrows AND assigns: it writes `value` onto `target` iff the
 * value has the key's expected runtime shape, returning `false` on mismatch
 * (→ E10243, key falls back to its default). Combining the check and the
 * assignment keeps the runtime type guard and the TypeScript-visible
 * assignment in one place, so no cast is ever needed to build a
 * `Partial<BlendConfig>` from parsed JSON.
 *
 * `valueRule` covers scalar-valued rules (range, enum literal set);
 * `entryRule` covers per-entry rules on array-valued keys (warning-code
 * format), so each offending entry gets its own diagnostic with a
 * dedup-distinct per-entry synthetic span (PF-019).
 */
export interface SchemaEntry {
  /** The §4.1 default, or `undefined` for `platform` (no default — R31). */
  readonly defaultValue: unknown;
  /** Human-readable expected shape for E10243 messages, e.g. `'boolean|string[]'`. */
  readonly expected: string;
  /** Shape-checks `value` and assigns it onto `target`; `false` = wrong type. */
  readonly apply: (target: Partial<BlendConfig>, value: unknown) => boolean;
  /** Scalar value rule (range/enum); returns the expected-detail text or null when valid. */
  readonly valueRule?: (value: unknown) => string | null;
  /** Per-entry rule for array-valued keys; returns the expected-detail text or null when valid. */
  readonly entryRule?: (entry: unknown) => string | null;
}

/** `true` when `value` is a string. */
function isString(value: unknown): value is string {
  return typeof value === "string";
}

/** `true` when `value` is a boolean. */
function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/** `true` when `value` is an array whose every element is a string. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/** Enum-literal rule factory: value must be one of `literals`. */
function oneOf(literals: readonly string[]): (value: unknown) => string | null {
  const detail = `one of ${literals.map((literal) => `"${literal}"`).join(", ")}`;
  return (value) => (literals.includes(value as string) ? null : detail);
}

/** Warning-code format rule for `warnAsError`/`suppressWarnings` entries. */
function wCodeRule(entry: unknown): string | null {
  return typeof entry === "string" && W_CODE_PATTERN.test(entry)
    ? null
    : 'a warning code matching the "W10xxx" pattern (W + five digits)';
}

/**
 * The 13 user-facing `blend65.json` keys in RD-16 §4.1 declaration order.
 * Map insertion order is load-bearing: it defines each key's stable ordinal
 * for the synthetic-span scheme (AR-P2/PF-019) — never reorder entries.
 *
 * The enum-typed keys (`diagnosticsFormat`, `startup`) shape-check as plain
 * strings and enforce their literal sets via `valueRule` (E10243 naming the
 * literals, R15/R18); per AR-P9 an errored config carries the invalid string
 * as-merged, so their `apply` narrows through the string check only — the
 * literal-type assignment is the one sanctioned widening, gated at runtime
 * by `valueRule` + the caller's `hasErrors` contract.
 */
export const CONFIG_SCHEMA: ReadonlyMap<string, SchemaEntry> = new Map<string, SchemaEntry>([
  [
    "platform",
    {
      defaultValue: undefined,
      expected: "string",
      apply: (target, value) => {
        if (!isString(value)) return false;
        target.platform = value;
        return true;
      },
    },
  ],
  [
    "include",
    {
      defaultValue: CONFIG_DEFAULTS.include,
      expected: "string[]",
      apply: (target, value) => {
        if (!isStringArray(value)) return false;
        target.include = value;
        return true;
      },
    },
  ],
  [
    "exclude",
    {
      defaultValue: CONFIG_DEFAULTS.exclude,
      expected: "string[]",
      apply: (target, value) => {
        if (!isStringArray(value)) return false;
        target.exclude = value;
        return true;
      },
    },
  ],
  [
    "outDir",
    {
      defaultValue: CONFIG_DEFAULTS.outDir,
      expected: "string",
      apply: (target, value) => {
        if (!isString(value)) return false;
        target.outDir = value;
        return true;
      },
    },
  ],
  [
    "outName",
    {
      defaultValue: CONFIG_DEFAULTS.outName,
      expected: "string",
      apply: (target, value) => {
        if (!isString(value)) return false;
        target.outName = value;
        return true;
      },
    },
  ],
  [
    "acmePath",
    {
      defaultValue: CONFIG_DEFAULTS.acmePath,
      expected: "string",
      apply: (target, value) => {
        if (!isString(value)) return false;
        target.acmePath = value;
        return true;
      },
    },
  ],
  [
    "maxErrors",
    {
      defaultValue: CONFIG_DEFAULTS.maxErrors,
      expected: "number",
      apply: (target, value) => {
        if (typeof value !== "number") return false;
        target.maxErrors = value;
        return true;
      },
      valueRule: (value) =>
        typeof value === "number" && Number.isInteger(value) && value >= 1
          ? null
          : "an integer >= 1",
    },
  ],
  [
    "warnAsError",
    {
      defaultValue: CONFIG_DEFAULTS.warnAsError,
      expected: "boolean|string[]",
      apply: (target, value) => {
        if (!isBoolean(value) && !isStringArray(value)) return false;
        target.warnAsError = value;
        return true;
      },
      entryRule: wCodeRule,
    },
  ],
  [
    "suppressWarnings",
    {
      defaultValue: CONFIG_DEFAULTS.suppressWarnings,
      expected: "string[]",
      apply: (target, value) => {
        if (!isStringArray(value)) return false;
        target.suppressWarnings = value;
        return true;
      },
      entryRule: wCodeRule,
    },
  ],
  [
    "diagnosticsFormat",
    {
      defaultValue: CONFIG_DEFAULTS.diagnosticsFormat,
      expected: "string",
      apply: (target, value) => {
        if (!isString(value)) return false;
        // AR-P9 widening: an invalid literal (e.g. "xml") stays as-merged and
        // is rejected by valueRule (E10243) — see the CONFIG_SCHEMA doc comment.
        target.diagnosticsFormat = value as BlendConfig["diagnosticsFormat"];
        return true;
      },
      valueRule: oneOf(["terminal", "json"]),
    },
  ],
  [
    "optimize",
    {
      defaultValue: CONFIG_DEFAULTS.optimize,
      expected: "boolean",
      apply: (target, value) => {
        if (!isBoolean(value)) return false;
        target.optimize = value;
        return true;
      },
    },
  ],
  [
    "quiet",
    {
      defaultValue: CONFIG_DEFAULTS.quiet,
      expected: "boolean",
      apply: (target, value) => {
        if (!isBoolean(value)) return false;
        target.quiet = value;
        return true;
      },
    },
  ],
  [
    "startup",
    {
      defaultValue: CONFIG_DEFAULTS.startup,
      expected: "string",
      apply: (target, value) => {
        if (!isString(value)) return false;
        // AR-P9 widening — same contract as diagnosticsFormat above.
        target.startup = value as BlendConfig["startup"];
        return true;
      },
      valueRule: oneOf(["auto", "terminating", "minimal", "bare"]),
    },
  ],
]);
