/**
 * `CompilerOptions` and its mapping to `@blend65/config`'s `ConfigOverrides`
 * (RD-15 §4.1, R9; AR-V20/PF-002).
 *
 * `CompilerOptions` is the single input type for every facade function. Most of
 * its fields are `BlendConfig` overrides (mapped by {@link optionsToOverrides});
 * three are **routing** options that are NOT config keys — `configPath` (config
 * discovery), `sourceFiles` (tier-1 file set), and `cwd` (the base directory for
 * config walk-up + the `projectRoot` fallback + relative-path resolution).
 */

import type { ConfigOverrides } from "@blend65/config";

/**
 * Options for the programmatic API (`compile`/`build`/`emitAsm`/`emitIl`).
 * Transcribed from RD-15 §4.1 (the preflighted contract). `platform` is required;
 * every other field is optional.
 */
export interface CompilerOptions {
  /** Target platform name (e.g. `"c64"`, `"cx16"`). */
  platform: string;

  /** Explicit source-file list (tier-1 discovery; overrides config/globs). */
  sourceFiles?: string[];

  /** Path to `blend65.json` (default: auto-discover from `cwd`). */
  configPath?: string;

  /**
   * Base directory for config walk-up discovery, the `projectRoot` fallback, and
   * relative-path resolution (AR-V20/PF-002). A routing option, NOT a config
   * override. Default: `process.cwd()`.
   */
  cwd?: string;

  /** Source-file globs (override `blend65.json` include/exclude). */
  include?: string[];
  exclude?: string[];

  /** Explicit path to the ACME executable. */
  acmePath?: string;

  /** Output directory (default `"./build/"`). */
  outDir?: string;

  /** Output base name (default `""` → derived from the first discovered file). */
  outName?: string;

  /** Maximum errors before stopping (default 20). */
  maxErrors?: number;

  /** Severity policy overrides. */
  warnAsError?: boolean | string[];
  suppressWarnings?: string[];

  /** Diagnostic output format (default `"terminal"`). */
  diagnosticsFormat?: "terminal" | "json";

  /** Enable the peephole optimizer (default `true`). */
  optimize?: boolean;

  /** Suppress the build summary (default `false`). */
  quiet?: boolean;

  /** Startup shim variant (default `"auto"`). */
  startup?: "auto" | "terminating" | "minimal" | "bare";
}

/**
 * Map {@link CompilerOptions} to `@blend65/config`'s {@link ConfigOverrides} (R9 →
 * RD-16 R24). Every overridable `BlendConfig` key is copied through; an explicitly
 * `undefined` value is legal and means "not set" (never overrides — see
 * `config/src/types.ts`). `configPath`, `sourceFiles`, and `cwd` are deliberately
 * excluded — they route to `loadConfig` options / tier-1 discovery / the
 * `loadConfig` `cwd`, respectively, not to the config merge.
 *
 * @param options The caller's options.
 * @returns The config overrides to pass to `loadConfig`.
 */
export function optionsToOverrides(options: CompilerOptions): ConfigOverrides {
  return {
    // Empty `platform` is the config's own "no-platform" marker (`config/src/merge.ts`
    // seeds `platform: ""`), so an empty override must NOT clobber a config-file
    // platform — forward it only when non-empty. This lets the CLI pass
    // `parsed.platform ?? ""` and still honour a `blend65.json` platform.
    platform: options.platform !== "" ? options.platform : undefined,
    include: options.include,
    exclude: options.exclude,
    outDir: options.outDir,
    outName: options.outName,
    acmePath: options.acmePath,
    maxErrors: options.maxErrors,
    warnAsError: options.warnAsError,
    suppressWarnings: options.suppressWarnings,
    diagnosticsFormat: options.diagnosticsFormat,
    optimize: options.optimize,
    quiet: options.quiet,
    startup: options.startup,
  };
}
