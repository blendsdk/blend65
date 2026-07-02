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
 * Array values are shared frozen templates: consumers (mergeConfig) must
 * copy them, never hand them out mutable.
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
 * Per-key schema entry: default value + shape validator + optional value
 * rules. `valueRule` covers scalar-valued rules (range, enum literal set);
 * `entryRule` covers per-entry rules on array-valued keys (warning-code
 * format), so each offending entry gets its own diagnostic with a
 * dedup-distinct per-entry synthetic span (PF-019).
 */
export interface SchemaEntry {
  /** The §4.1 default, or `undefined` for `platform` (no default — R31). */
  readonly defaultValue: unknown;
  /** Human-readable expected shape for E10243 messages, e.g. `'boolean|string[]'`. */
  readonly expected: string;
  /** Type-shape check (E10243 when false; the key falls back to its default). */
  readonly check: (value: unknown) => boolean;
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
  const detail = `one of ${literals.map((l) => `"${l}"`).join(", ")}`;
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
 */
export const CONFIG_SCHEMA: ReadonlyMap<string, SchemaEntry> = new Map<string, SchemaEntry>([
  ["platform", { defaultValue: undefined, expected: "string", check: isString }],
  ["include", { defaultValue: CONFIG_DEFAULTS.include, expected: "string[]", check: isStringArray }],
  ["exclude", { defaultValue: CONFIG_DEFAULTS.exclude, expected: "string[]", check: isStringArray }],
  ["outDir", { defaultValue: CONFIG_DEFAULTS.outDir, expected: "string", check: isString }],
  ["outName", { defaultValue: CONFIG_DEFAULTS.outName, expected: "string", check: isString }],
  ["acmePath", { defaultValue: CONFIG_DEFAULTS.acmePath, expected: "string", check: isString }],
  [
    "maxErrors",
    {
      defaultValue: CONFIG_DEFAULTS.maxErrors,
      expected: "number",
      check: (value) => typeof value === "number",
      valueRule: (value) =>
        Number.isInteger(value) && (value as number) >= 1 ? null : "an integer >= 1",
    },
  ],
  [
    "warnAsError",
    {
      defaultValue: CONFIG_DEFAULTS.warnAsError,
      expected: "boolean|string[]",
      check: (value) => isBoolean(value) || isStringArray(value),
      entryRule: wCodeRule,
    },
  ],
  [
    "suppressWarnings",
    {
      defaultValue: CONFIG_DEFAULTS.suppressWarnings,
      expected: "string[]",
      check: isStringArray,
      entryRule: wCodeRule,
    },
  ],
  [
    "diagnosticsFormat",
    {
      defaultValue: CONFIG_DEFAULTS.diagnosticsFormat,
      expected: "string",
      check: isString,
      valueRule: oneOf(["terminal", "json"]),
    },
  ],
  ["optimize", { defaultValue: CONFIG_DEFAULTS.optimize, expected: "boolean", check: isBoolean }],
  ["quiet", { defaultValue: CONFIG_DEFAULTS.quiet, expected: "boolean", check: isBoolean }],
  [
    "startup",
    {
      defaultValue: CONFIG_DEFAULTS.startup,
      expected: "string",
      check: isString,
      valueRule: oneOf(["auto", "terminating", "minimal", "bare"]),
    },
  ],
]);
