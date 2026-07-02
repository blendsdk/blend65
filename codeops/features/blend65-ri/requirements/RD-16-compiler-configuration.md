# RD-16: Compiler Configuration (`blend65.json`)

> **Status**: 🟢 Authored — 🔎 preflighted 2026-07-02 (14 findings PF-001..PF-014 resolved & applied; see `00-preflight-report.md`)
> **MVP Phase**: A
> **Depends On**: RD-01
> **Implements**: `spec-v3.0` Ch 14 §4 (diagnostic flags), Ch 15 §3 (platform selection);
>   AR-13, AR-39, AR-62, AR-73, AR-75, AR-83
> **Owning package(s)**: `@blend65/config`
> **Created**: 2026-05-31
> **Last Updated**: 2026-07-02 (preflight PF-001..PF-014 fixes applied)

---

## 1. Purpose

This document specifies the **compiler configuration file** `blend65.json` — the
project-level settings file that configures the Blend65 compiler. Modeled on TypeScript's
`tsconfig.json` (AR-13), it uses **JSONC** (JSON with Comments) so developers can
annotate their configuration. The `@blend65/config` package is responsible for locating,
parsing, validating, and merging this file with CLI flags.

The configuration file serves as the single source of truth for project settings when
CLI flags are not explicitly provided. CLI flags always override `blend65.json` values
(AR-39, RD-15).

---

## 2. Scope

**In scope:**
- File name, format, and discovery strategy
- Schema definition: all configuration properties
- JSONC parsing and validation in `@blend65/config`
- Merging strategy (config file ← CLI flag overrides)
- Error handling for invalid/missing configuration
- Default values

**Out of scope (and where it lives instead):**
- CLI flag definitions and parsing → RD-15
- Platform plugin data (profile contents) → RD-10
- Diagnostic engine and severity policy → RD-11
- ACME discovery strategy → RD-09
- Build artifact output → RD-15

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, the frozen spec section
> it implements, or be explicitly marked **`Design`** — an uncontroversial default
> settled during authoring (e.g., `outDir: "./build/"`) that raises no genuine ambiguity
> and therefore needs no register entry (preflight PF-006). No *ambiguous* decision may
> be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 File Format & Discovery

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | The config file is named `blend65.json` | Fixed name, not configurable. Lives in the project root directory | AR-13 |
| R2 | The file format is JSONC | JSON with Comments. Both `//` single-line and `/* */` block comments are supported. Trailing commas are tolerated | AR-13 |
| R3 | Config file is optional | If no `blend65.json` is found, the compiler uses defaults for all settings. Required settings (like `platform`) must then be provided via CLI flags | Design |
| R4 | Discovery walks up from cwd | `@blend65/config` searches for `blend65.json` starting from the current working directory, walking up to parent directories (like `tsconfig.json`). The first found file is used. `--config` CLI flag overrides this | AR-13 |
| R5 | The file is data, not code | `blend65.json` is parsed by a JSONC parser. It is never `require()`d or `import()`ed. No executable content | AR-13, RD-13 R38 |

### 3.2 Schema — Project Settings

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R6 | `platform` — target platform name | String. Selects the platform plugin (e.g., `"c64"`, `"cx16"`, `"a7800"`). Must match a registered plugin name. Required if not provided via `--platform` CLI flag | AR-37 |
| R7 | `include` — source file globs | Array of glob patterns (e.g., `["src/**/*.blend"]`). Defines which `.blend` files form the program. Default: `["**/*.blend"]`. Overridden by explicit CLI file list | AR-39 |
| R8 | `exclude` — excluded file globs | Array of glob patterns to exclude from `include` results (e.g., `["test/**"]`). Default: `["node_modules/**"]` | AR-39 (include tiers) + Design (exclude key & default) |
| R9 | `outDir` — output directory | String path. Where build artifacts are written. Default: `"./build/"`. Overridden by `--out-dir` | Design |
| R10 | `outName` — output file base name | String. Base name for output files (`.prg`, `.asm`). Default: `""` — the loader cannot derive it (it performs no file discovery); `""` means "derive downstream": RD-15 derives the base name from the first file, in lexicographically sorted order, of the discovered source list (deterministic per RD-13). Overridden by `--out-name` | Design |

### 3.3 Schema — ACME Settings

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R11 | `acmePath` — path to ACME executable | String. Explicit path to the ACME assembler. Tier 1 of ACME discovery (AR-62). Overridden by `--acme-path` CLI flag. **Trust model:** `acmePath` is trusted input — whoever controls a discovered `blend65.json` (including one in an ancestor directory, R4) controls which executable the build runs. Same trust model as `tsconfig.json`/npm scripts; see RD-13 R35 | AR-62 |

### 3.4 Schema — Diagnostic Settings

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R12 | `maxErrors` — maximum error count | Number. Passed to `DiagnosticBag`. Default: `20`. Overridden by `--max-errors` | AR-73, Ch 14 §4 |
| R13 | `warnAsError` — promote warnings | Boolean or array of warning codes. `true` promotes all; `["W10130"]` promotes specific codes. Default: `false`. Overridden by `--warn-as-error` | AR-75, Ch 14 §4 |
| R14 | `suppressWarnings` — suppress warnings | Array of warning codes to suppress (e.g., `["W10130", "W10131"]`). Default: `[]`. Overridden by `--suppress-warning` | AR-75 |
| R15 | `diagnosticsFormat` — output format | String: `"terminal"` or `"json"`. Default: `"terminal"`. Overridden by `--diagnostics-format` | AR-76 |

### 3.5 Schema — Build Settings

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R16 | `optimize` — enable peephole optimizer | Boolean. Default: `true`. In v1 this has no visible effect (passthrough rule set, AR-38). Overridden by `--optimize`/`--no-optimize` | AR-38 |
| R17 | `quiet` — suppress build summary | Boolean. Default: `false`. Suppresses the resource-report table. Overridden by `--quiet` | AR-83 |
| R18 | `startup` — startup shim variant | String: `"auto"`, `"terminating"`, `"minimal"`, or `"bare"`. Default: `"auto"`. Controls the platform plugin's startup-shim selection (AR-69). Overridden by `--startup`. **Mapping to the shipped core type** (`@blend65/core` `ShimVariant = "terminating" \| "non-terminating" \| "bare"`): config `"minimal"` selects `ShimVariant "non-terminating"`; `"auto"` is resolved by the AR-69 CFG termination analysis into a concrete variant before reaching `PreambleOptions.shimVariant` — the plugin never receives `"auto"` or `"minimal"` verbatim | AR-69 |

### 3.6 Schema Validation

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R19 | Unknown keys produce a warning | If `blend65.json` contains a key not in the schema, the compiler emits a `W10xxx` warning (not an error). This allows forward-compatible config files | Design |
| R20 | Invalid value types produce an error | If a known key has the wrong type (e.g., `"maxErrors": "twenty"`), the compiler emits an `E10xxx` error with the expected type and the actual value | Design |
| R21 | Invalid platform name produces an error | When `LoadConfigOptions.knownPlatforms` is provided, a `platform` value not in the list emits an `E10xxx` error listing the available platforms. The caller (`@blend65/compiler`/CLI) passes `[...PLATFORM_REGISTRY.keys()]`; `@blend65/config` never depends on `@blend65/platforms` (AR-20). When `knownPlatforms` is omitted (e.g., the LSP host), the check is skipped and deferred to `loadPlatform()` (RD-10 R29/R30) | RD-10 R29/R30 + Design |
| R22 | Validation happens at load time | All validation runs when the config is loaded, before any compilation begins. A fully invalid config stops the build with exit code 2 (RD-15 R43) | Design |
| R29 | `include`/`exclude` patterns are project-root-scoped | Entries must be relative glob patterns that resolve within `projectRoot`. Absolute paths or patterns escaping the root (`..`) emit an `E10xxx` error at load time — upholds RD-13 R37 (scoped file-system access) | RD-13 R37 + Design |
| R30 | Overlapping `warnAsError`/`suppressWarnings` codes produce a warning | A code listed in both arrays emits a `W10xxx` "code both promoted and suppressed" warning at load time. The precedence itself is decided centrally by the severity-policy layer: **suppression wins** (RD-11 R50) | RD-11 R50 + Design |
| R31 | Missing `platform` is a load-time error | If `platform` is still unset after merging config + invocation overrides, emit `E10xxx` "no platform specified" — a configuration error (exit code 2, RD-15 R43). `BlendConfig.platform` is therefore always a validated non-empty string. The registry's `DEFAULT_PLATFORM` (`@blend65/platforms`, RD-10 R33) is an internal convenience and is **never** consulted as a config default | RD-15 R43 + Design |

### 3.7 Merging Strategy

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R23 | CLI flags override config file values | For every property, the CLI flag takes precedence if provided. The config file provides defaults. This follows the `tsconfig.json` precedent | AR-13 |
| R24 | CLI flags and programmatic options are the *same* top layer | The CLI translates parsed flags into `CompilerOptions` (RD-15 R2: the CLI is a thin wrapper over `@blend65/compiler`), so CLI flags and programmatic options never coexist in one invocation — both arrive as `LoadConfigOptions.overrides`. `CompilerOptions` (RD-15 R9) covers every overridable `BlendConfig` property | AR-77 + Design |
| R25 | Merge order is documented | Three layers: `defaults ← blend65.json ← invocation overrides` (where "invocation overrides" = CLI flags translated by `@blend65/cli`, or a programmatic caller's `CompilerOptions` — R24). Each layer overrides the previous. Only explicitly set values override; `undefined` / absent values do not | Design |

### 3.8 Package Architecture

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R26 | `@blend65/config` owns config loading | A dedicated package loads, parses, and validates `blend65.json`. It exports a `loadConfig()` function returning `LoadConfigResult { config: BlendConfig; hasErrors: boolean }`; all diagnostics are appended to the caller-supplied `DiagnosticBag` (AR-73 — accumulate, never throw) | AR-20, AR-73 |
| R27 | `@blend65/config` has minimal dependencies | It may depend on a JSONC parser (or bundle one). No dependency on `@blend65/frontend` or `@blend65/codegen` | RD-13 R dependency policy |
| R28 | Config loading is synchronous | `loadConfig(options: LoadConfigOptions): LoadConfigResult` is synchronous (config files are small). No async I/O | Design |

---

## 4. Design Detail

### 4.1 Full Schema

```jsonc
// blend65.json — complete schema with defaults
{
  // --- Project ---
  "platform": "c64",                    // required if not --platform
  "include": ["**/*.blend"],            // source file globs
  "exclude": ["node_modules/**"],       // excluded globs

  // --- Output ---
  "outDir": "./build/",                 // output directory
  "outName": "",                        // output base name (empty = auto)

  // --- ACME ---
  "acmePath": "",                       // path to ACME (empty = PATH discovery)

  // --- Diagnostics ---
  "maxErrors": 20,                      // max errors before stopping
  "warnAsError": false,                 // true | false | ["W10130", ...]
  "suppressWarnings": [],               // ["W10130", "W10131", ...]
  "diagnosticsFormat": "terminal",      // "terminal" | "json"

  // --- Build ---
  "optimize": true,                     // enable peephole optimizer
  "quiet": false,                       // suppress build summary
  "startup": "auto"                     // "auto" | "terminating" | "minimal" | "bare"
}
```

### 4.2 TypeScript Types

```typescript
// @blend65/config — exported types

import type { DiagnosticBag } from '@blend65/core';

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
  diagnosticsFormat: 'terminal' | 'json';

  // --- Build ---
  optimize: boolean;
  quiet: boolean;
  startup: 'auto' | 'terminating' | 'minimal' | 'bare';
}

/**
 * Load and validate blend65.json.
 *
 * All warnings/errors are appended to `options.bag` (AR-73 — accumulate,
 * never throw). The function never throws on invalid input.
 */
export function loadConfig(options: LoadConfigOptions): LoadConfigResult;

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
}

/** Result of loadConfig() — mirrors the parser's { ast, hasErrors } shape */
export interface LoadConfigResult {
  /** The merged, validated configuration (defaults applied) */
  config: BlendConfig;

  /** True if any error-severity diagnostic was emitted during loading (→ exit code 2, RD-15 R43) */
  hasErrors: boolean;
}
```

### 4.3 Config Loading Algorithm

All diagnostics below are appended to `options.bag` (AR-73 — accumulate, never throw).
The concrete `E10xxx`/`W10xxx` codes are claimed additively from the RD-11 band at
implementation time (precedent: RD-09's E10035).

```
loadConfig(options) → { config, hasErrors }:
  1. Determine config path:
     - If options.configPath is set → use it directly.
       If that file does not exist → emit E10xxx "config file not found: <path>"
       (an EXPLICIT path that is missing is an error — unlike a discovery miss)
     - Otherwise → walk up from options.cwd (or process.cwd()) looking for blend65.json
     - If not found by discovery → configPath = null, use all defaults (R3 — not an error)

  2. Parse the file:
     - Read file content as UTF-8 string
     - Parse as JSONC (strip comments, tolerate trailing commas)
     - If parse fails → emit E10xxx "invalid blend65.json: <parse error>"
     - If the top-level value is not an object ([], "x", null, 42) →
       emit E10xxx "blend65.json must contain a JSON object"

  3. Validate the schema:
     - For each known key: check type matches expected
     - For unknown keys: emit W10xxx "unknown configuration key: <key>" (R19)
     - For invalid values: emit E10xxx with expected type (R20)

  4. Apply defaults:
     - Fill in missing properties with default values

  5. Apply invocation overrides:
     - Merge options.overrides on top (only explicitly set values — R24/R25)

  6. Validate semantics (post-merge):
     - If platform is unset → emit E10xxx "no platform specified" (R31)
     - If platform is set and options.knownPlatforms is provided:
       verify membership, else emit E10xxx listing the available platforms (R21)
     - maxErrors must be an integer >= 1, else emit E10xxx (see edge table)
     - include/exclude entries must be relative patterns inside projectRoot (R29)
     - If warnAsError is an array: verify all codes match the W10xxx pattern
     - If suppressWarnings: verify all codes match the W10xxx pattern
     - If a code appears in both warnAsError and suppressWarnings →
       emit W10xxx "code both promoted and suppressed" (R30; suppression wins, RD-11 R50)

  7. Return { config, hasErrors: bag gained error-severity entries during this call }
```

**Validation edge table** (contract decisions, not implementation details):

| Input | Behavior |
|-------|----------|
| Explicit `configPath` does not exist | `E10xxx` error (step 1) |
| Discovery finds no `blend65.json` | Not an error — all defaults (R3) |
| Top-level value not an object | `E10xxx` error (step 2) |
| `maxErrors` not an integer ≥ 1 (`0`, negative, fractional) | `E10xxx` error (step 6) |
| `include: []` | Accepted by the loader — file-set emptiness ("no source files") is diagnosed by the RD-15 discovery tier, which owns file discovery |
| Absolute or root-escaping `include`/`exclude` pattern | `E10xxx` error (R29) |

**Bootstrap note:** the caller creates `options.bag` with the default cap (20, AR-73)
*before* the config is read, so the config's own `maxErrors` value cannot govern config
loading itself — it configures the downstream compilation pipeline's bag.

### 4.4 Example Configuration Files

**Minimal (C64 project):**
```jsonc
{
  "platform": "c64"
}
```

**Full project:**
```jsonc
{
  // Blend65 project configuration
  "platform": "c64",
  "include": ["src/**/*.blend"],
  "exclude": ["src/test/**"],

  "outDir": "./dist/",
  "outName": "mygame",

  // ACME assembler (only needed for build, not check)
  "acmePath": "/usr/local/bin/acme",

  // Diagnostics
  "maxErrors": 50,
  "warnAsError": ["W10130"],  // unreachable code is an error in this project
  "suppressWarnings": ["W10180"],  // we know our stack is fine

  // Build
  "optimize": true,
  "quiet": false,
  "startup": "auto"
}
```

**Commander X16 project:**
```jsonc
{
  "platform": "cx16",
  "include": ["**/*.blend"],
  "outDir": "./build/",
  "startup": "terminating"
}
```

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | **Package**: `@blend65/config` is one of the 10 monorepo packages |
| RD-09 | **Consumer**: `acmePath` feeds into ACME discovery tier 1 (AR-62) |
| RD-10 | **Consumer**: `platform` selects the platform plugin from the registry |
| RD-11 | **Consumer**: `maxErrors`, `warnAsError`, `suppressWarnings`, `diagnosticsFormat` configure the diagnostics engine and renderers |
| RD-13 | **Constrained by**: config is data-only JSONC (R38), no executable content |
| RD-14 | **Consumer**: the language server reads `blend65.json` for file discovery and platform selection. Note: this requires blessing a new `language-server → @blend65/config` dependency edge (not in the AR-20 diagram or the CLAUDE.md table today; permitted by the R15 boundary, which forbids only codegen) — to be decided explicitly at RD-14 planning (preflight PF-014) |
| RD-15 | **Producer/consumer**: the CLI reads config and merges with CLI flags; `--config` overrides discovery; exit code 2 on config errors |
| RD-17 | **Implicit**: platform selection affects which T4 intrinsics are available |

---

## 6. Acceptance Criteria

- [x] AC-01: `blend65.json` is parsed as JSONC (comments and trailing commas work)
- [x] AC-02: Config discovery walks up from cwd and finds the nearest `blend65.json`
- [x] AC-03: Missing config file is not an error — defaults are used
- [x] AC-04: All schema properties are typed and validated at load time
- [x] AC-05: Unknown keys produce a warning, not an error
- [x] AC-06: Invalid value types produce a specific error with expected type
- [x] AC-07: When `knownPlatforms` is provided, an invalid platform name produces an error listing the available platforms; when omitted, the check is skipped (R21)
- [x] AC-08: Invocation overrides (CLI flags / programmatic `CompilerOptions`) override config file values (R24/R25)
- [x] AC-09: Missing `platform` after merging produces the "no platform specified" error; `include`/`exclude` root-escape, `maxErrors` range, and promote/suppress-overlap validations behave per the §4.3 edge table (R29–R31)
- [x] AC-10: The `include`/`exclude` values are validated (arrays of relative, root-scoped glob strings) and carried into `BlendConfig` verbatim for the RD-15/RD-14 discovery tier to expand
- [x] AC-11: `loadConfig()` returns `{ config, hasErrors }` with a fully populated `BlendConfig` (defaults applied) and all diagnostics appended to the supplied `DiagnosticBag`
- [x] AC-12: The minimal config `{ "platform": "c64" }` works end-to-end
- [x] AC-13: `blend65.json` is never `require()`d or `import()`ed
- [x] AC-14: All decisions trace to an `AR-NN`, a frozen spec section, or an explicit `Design` mark (per the §2 traceability rule)

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

None.
