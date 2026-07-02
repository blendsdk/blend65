/**
 * Public types for the `@blend65/config` loader (RD-16 §4.2).
 *
 * `BlendConfig`, `LoadConfigOptions`, and `LoadConfigResult` are transcribed
 * verbatim from RD-16 §4.2 (the preflighted contract), plus the two AR-P2
 * additions: the {@link CONFIG_SOURCE_ID} sentinel and the optional
 * `LoadConfigOptions.sourceId` override.
 */

import type { DiagnosticBag } from "@blend65/core";

/**
 * Sentinel `SourceId` for spans pointing into `blend65.json` until RD-11b's
 * SourceMap can register the file for real. `-1` is the diagnostic bag's
 * null-span dedup marker, so the sentinel is `-2`. It sorts before all real
 * sources in `getAll()` (config diagnostics render first). Per AR-P2.
 */
export const CONFIG_SOURCE_ID = -2;

/**
 * Stride for synthetic spans of diagnostics whose value has no file position
 * (override-sourced, missing `platform`, or an explicit config path that does
 * not exist). Such spans start at `-(2 + ordinal * SYNTHETIC_SPAN_STRIDE +
 * entryIndex)` where `ordinal` is the key's stable position in `CONFIG_SCHEMA`
 * declaration order and `entryIndex` the offending entry's index for
 * array-valued keys (0 otherwise). Negative starts occupy a coordinate space
 * disjoint from real byte offsets (≥ 0), so same-code diagnostics for
 * different keys/entries all survive the bag's `(code, sourceId, start)`
 * dedup (AR-P2, PF-019).
 */
export const SYNTHETIC_SPAN_STRIDE = 64;

/** Parsed and validated configuration from blend65.json + invocation overrides */
export interface BlendConfig {
  /** Absolute path to the blend65.json file (null if no file found) */
  configPath: string | null;

  /** Absolute path to the project root (directory containing blend65.json or cwd) */
  projectRoot: string;

  // --- Project ---
  platform: string;
  include: string[];
  exclude: string[];

  // --- Output ---
  outDir: string;
  outName: string;

  // --- ACME ---
  acmePath: string;

  // --- Diagnostics ---
  maxErrors: number;
  warnAsError: boolean | string[];
  suppressWarnings: string[];
  diagnosticsFormat: "terminal" | "json";

  // --- Build ---
  optimize: boolean;
  quiet: boolean;
  startup: "auto" | "terminating" | "minimal" | "bare";
}

/** Options for `loadConfig()` (RD-16 §4.2 + AR-P2 `sourceId`). */
export interface LoadConfigOptions {
  /**
   * Shared diagnostic accumulator (from @blend65/core). Created by the caller
   * with the default cap (20) — the config's own `maxErrors` cannot apply to
   * config loading itself (bootstrap: it isn't known until the file is read);
   * it configures the downstream pipeline bag.
   */
  readonly bag: DiagnosticBag;

  /** Explicit config file path (overrides discovery) */
  configPath?: string;

  /** Working directory for discovery (default: process.cwd()) */
  cwd?: string;

  /** Invocation overrides (CLI flags or programmatic CompilerOptions) — merged on top of the config file */
  overrides?: Partial<BlendConfig>;

  /**
   * Registered platform names for semantic validation (R21). The caller
   * (@blend65/compiler or the CLI) passes [...PLATFORM_REGISTRY.keys()];
   * @blend65/config itself never depends on @blend65/platforms (AR-20).
   * When omitted, the platform-name check is skipped (deferred to loadPlatform()).
   */
  knownPlatforms?: readonly string[];

  /**
   * Real SourceId for blend65.json when the caller has one (RD-11b/LSP);
   * defaults to {@link CONFIG_SOURCE_ID}. Per AR-P2.
   */
  sourceId?: number;
}

/** Result of loadConfig() — mirrors the parser's { ast, hasErrors } shape */
export interface LoadConfigResult {
  /** The merged, validated configuration (defaults applied) */
  config: BlendConfig;

  /** True if any error-severity diagnostic was emitted during loading (→ exit code 2, RD-15 R43) */
  hasErrors: boolean;
}
