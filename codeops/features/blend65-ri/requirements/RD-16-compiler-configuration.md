# RD-16: Compiler Configuration (`blend65.json`)

> **Status**: 🟢 Authored
> **MVP Phase**: A
> **Depends On**: RD-01
> **Implements**: `spec-v3.0` Ch 14 §4 (diagnostic flags), Ch 15 §3 (platform selection);
>   AR-13, AR-39, AR-62, AR-73, AR-75, AR-83
> **Owning package(s)**: `@blend65/config`
> **Created**: 2026-05-31
> **Last Updated**: 2026-05-31

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
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

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
| R8 | `exclude` — excluded file globs | Array of glob patterns to exclude from `include` results (e.g., `["test/**"]`). Default: `["node_modules/**"]` | AR-39 |
| R9 | `outDir` — output directory | String path. Where build artifacts are written. Default: `"./build/"`. Overridden by `--out-dir` | Design |
| R10 | `outName` — output file base name | String. Base name for output files (`.prg`, `.asm`). Default: derived from first source file. Overridden by `--out-name` | Design |

### 3.3 Schema — ACME Settings

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R11 | `acmePath` — path to ACME executable | String. Explicit path to the ACME assembler. Tier 1 of ACME discovery (AR-62). Overridden by `--acme-path` CLI flag | AR-62 |

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
| R18 | `startup` — startup shim variant | String: `"auto"`, `"terminating"`, `"minimal"`, or `"bare"`. Default: `"auto"`. Controls the platform plugin's startup-shim selection (AR-69). Overridden by `--startup` | AR-69 |

### 3.6 Schema Validation

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R19 | Unknown keys produce a warning | If `blend65.json` contains a key not in the schema, the compiler emits a `W10xxx` warning (not an error). This allows forward-compatible config files | Design |
| R20 | Invalid value types produce an error | If a known key has the wrong type (e.g., `"maxErrors": "twenty"`), the compiler emits an `E10xxx` error with the expected type and the actual value | Design |
| R21 | Invalid platform name produces an error | If `platform` does not match any registered plugin, the compiler emits an error listing the available platforms | AR-37 |
| R22 | Validation happens at load time | All validation runs when the config is loaded, before any compilation begins. A fully invalid config stops the build with exit code 2 (RD-15 R43) | Design |

### 3.7 Merging Strategy

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R23 | CLI flags override config file values | For every property, the CLI flag takes precedence if provided. The config file provides defaults. This follows the `tsconfig.json` precedent | AR-13 |
| R24 | Programmatic API overrides both | When using the `@blend65/compiler` API, the `CompilerOptions` object overrides both the config file and any CLI defaults | AR-77 |
| R25 | Merge order is documented | `defaults ← blend65.json ← CLI flags ← programmatic API`. Each layer overrides the previous. Only explicitly set values override; `undefined` / absent values do not | Design |

### 3.8 Package Architecture

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R26 | `@blend65/config` owns config loading | A dedicated package loads, parses, and validates `blend65.json`. It exports a `loadConfig()` function returning a typed `BlendConfig` object | AR-20 |
| R27 | `@blend65/config` has minimal dependencies | It may depend on a JSONC parser (or bundle one). No dependency on `@blend65/frontend` or `@blend65/codegen` | RD-13 R dependency policy |
| R28 | Config loading is synchronous | `loadConfig(configPath?: string): BlendConfig` is synchronous (config files are small). No async I/O | Design |

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

/** Parsed and validated configuration from blend65.json + CLI overrides */
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

/** Load and validate blend65.json */
export function loadConfig(options?: LoadConfigOptions): BlendConfig;

export interface LoadConfigOptions {
  /** Explicit config file path (overrides discovery) */
  configPath?: string;

  /** Working directory for discovery (default: process.cwd()) */
  cwd?: string;

  /** CLI flag overrides — merged on top of the config file */
  overrides?: Partial<BlendConfig>;
}
```

### 4.3 Config Loading Algorithm

```
loadConfig(options):
  1. Determine config path:
     - If options.configPath is set → use it directly
     - Otherwise → walk up from options.cwd (or process.cwd()) looking for blend65.json
     - If not found → configPath = null, use all defaults

  2. Parse the file:
     - Read file content as UTF-8 string
     - Parse as JSONC (strip comments, tolerate trailing commas)
     - If parse fails → emit E10xxx "invalid blend65.json: <parse error>"

  3. Validate the schema:
     - For each known key: check type matches expected
     - For unknown keys: emit W10xxx "unknown configuration key: <key>"
     - For invalid values: emit E10xxx with expected type

  4. Apply defaults:
     - Fill in missing properties with default values

  5. Apply CLI overrides:
     - Merge options.overrides on top (only explicitly set values)

  6. Validate semantics:
     - If platform is set: verify it matches a registered plugin name
     - If warnAsError is an array: verify all codes match W10xxx pattern
     - If suppressWarnings: verify all codes match W10xxx pattern

  7. Return BlendConfig
```

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
| RD-14 | **Consumer**: the language server reads `blend65.json` for file discovery and platform selection |
| RD-15 | **Producer/consumer**: the CLI reads config and merges with CLI flags; `--config` overrides discovery; exit code 2 on config errors |
| RD-17 | **Implicit**: platform selection affects which T4 intrinsics are available |

---

## 6. Acceptance Criteria

- [ ] AC-01: `blend65.json` is parsed as JSONC (comments and trailing commas work)
- [ ] AC-02: Config discovery walks up from cwd and finds the nearest `blend65.json`
- [ ] AC-03: Missing config file is not an error — defaults are used
- [ ] AC-04: All schema properties are typed and validated at load time
- [ ] AC-05: Unknown keys produce a warning, not an error
- [ ] AC-06: Invalid value types produce a specific error with expected type
- [ ] AC-07: Invalid platform name produces an error listing available platforms
- [ ] AC-08: CLI flags override config file values
- [ ] AC-09: Programmatic API `CompilerOptions` override both config and CLI defaults
- [ ] AC-10: The `include`/`exclude` glob patterns correctly select `.blend` files
- [ ] AC-11: `loadConfig()` returns a fully populated `BlendConfig` with defaults applied
- [ ] AC-12: The minimal config `{ "platform": "c64" }` works end-to-end
- [ ] AC-13: `blend65.json` is never `require()`d or `import()`ed
- [ ] AC-14: All decisions trace to an `AR-NN` or a frozen spec section

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

None.
