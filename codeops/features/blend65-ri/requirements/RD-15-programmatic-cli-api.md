# RD-15: Programmatic & CLI API

> **Status**: 🟢 Authored
> **MVP Phase**: A
> **Depends On**: RD-01, RD-09, RD-10, RD-11, RD-16 (RD-11's remainder — severity policy,
>   renderers, `SourceMap`, `ResourceReport` — must land before this RD; preflight PF-001)
> **Implements**: `spec-v3.0` Ch 14 §4 (diagnostic flags); AR-3, AR-15, AR-16, AR-17,
>   AR-39, AR-40, AR-62, AR-75, AR-76, AR-77, AR-82, AR-83
> **Owning package(s)**: `@blend65/compiler` (programmatic API), `@blend65/cli` (CLI)
> **Created**: 2026-05-31
> **Last Updated**: 2026-07-03 (RD-15 preflight fixes applied: PF-001 deps header + RD-11b ordering, PF-002 `BuildResult` ownership, PF-003 `Design` marks sanctioned, PF-004 R47 glob expansion, PF-005 R50 exit-code classification, PF-006 R48/R49 + E10250 band claim, PF-007 R51 resolved config in results, PF-008 AC-20, PF-009 §4.3 sketch refresh, PF-010 AC-18 compile-path scope)

---

## 1. Purpose

This document specifies the **two public surfaces** through which developers invoke the
Blend65 compiler: the **programmatic API** (`@blend65/compiler`, a library) and the
**CLI** (`@blend65/cli`, the `blendc` command). AR-77 mandates a library-first design:
the compiler is callable as a library returning structured results, and the CLI is just
one consumer that renders those results to the terminal.

The programmatic API is the **foundation** — it is the same API the future language
server (RD-14) and any third-party tooling will consume. The CLI wraps the API with
argument parsing (yargs, AR-16) and terminal rendering (conditional color —
zero-dependency ANSI, AR-17 amended by AR-106).

---

## 2. Scope

**In scope:**
- `@blend65/compiler` facade: the public programmatic API (compile, emit-only, etc.)
- `@blend65/cli`: the `blendc` command (entry point, argument parsing, rendering)
- `CompilerHost` disk implementation for CLI (AR-40)
- File-set discovery (AR-39)
- CLI flags: target platform, output paths, emit flags, diagnostic flags, ACME path
- Exit codes
- Programmatic API result types (`CompileResult`, `BuildResult`)

**Out of scope (and where it lives instead):**
- `blend65.json` loading and schema → RD-16
- Diagnostic engine, `DiagnosticBag`, renderers → RD-11
- Platform plugin registry → RD-10
- ACME child-process invocation → RD-09
- Language server / VS Code extension → RD-14
- Test harness CLI → RD-12

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, the frozen spec section
> it implements, or be explicitly marked **`Design`** — an uncontroversial default
> settled during authoring (e.g., `outDir: "./build/"`) that raises no genuine ambiguity
> and therefore needs no register entry (preflight PF-003, mirroring RD-16's PF-006 fix).
> No *ambiguous* decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 Architecture

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | Library-first: the compiler is a callable library | `@blend65/compiler` exports a programmatic API that returns structured results (`CompileResult` / `BuildResult`). No side effects (no printing, no process.exit). The CLI is one consumer | AR-77 |
| R2 | `@blend65/compiler` is a thin facade | It wires `@blend65/frontend`, `@blend65/codegen`, `@blend65/platforms`, and `@blend65/config` into a pipeline. It owns no compiler logic itself | AR-20 |
| R3 | `@blend65/cli` depends on `@blend65/compiler` | The CLI imports the compiler facade and calls its API. It adds argument parsing, rendering, and process lifecycle | AR-20 |
| R4 | `@blend65/cli` is the only package in the `blendc` compile path that prints to stdout/stderr | All terminal output (diagnostics, build summary, errors) originates in `@blend65/cli`. No compile-path package (`core`, `frontend`, `codegen`, `platforms`, `config`, `compiler`) uses `console.log`/`process.stdout`. (`@blend65/test-harness`'s RD-12 runner has its own output surface — preflight PF-010) | AR-77 |

### 3.2 Programmatic API

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R5 | `compile()` runs the frontend only | `compile(options)` → `CompileResult`: runs lex → parse → semantic → SFA. Returns diagnostics + `SemanticModel` + `AllocationPlan`. Does NOT invoke codegen or ACME. This is the API the LSP will use | AR-77, AR-78 |
| R6 | `build()` runs the full pipeline | `build(options)` → `BuildResult`: runs the full pipeline (compile + IL + codegen + peephole + ACME emit + ACME invoke). The emit/invoke stages wrap RD-09's `emitBinary` orchestration; its internal result type is renamed `EmitBinaryResult` so RD-15's `BuildResult` owns the public name, and its `symbols` field maps to `symbolMap` (preflight PF-002). Returns diagnostics + artifacts (`.asm`, `.prg`, symbol map, resource report) | AR-77 |
| R7 | `emitAsm()` runs everything except ACME | `emitAsm(options)` → `EmitResult`: runs compile + IL + codegen + peephole + ACME serialization. Returns the `.asm` text without invoking ACME. For `--emit-asm` use cases and golden tests | AR-60, AR-63 |
| R8 | `emitIl()` runs through IL lowering | `emitIl(options)` → `EmitResult`: runs compile + IL lowering. Returns the IL text for `--emit-il` use cases and golden tests | AR-51 |
| R9 | Options are passed as a structured object | `CompilerOptions { platform, sourceFiles?, configPath?, include?, exclude?, outDir?, outName?, acmePath?, maxErrors?, warnAsError?, suppressWarnings?, diagnosticsFormat?, optimize?, quiet?, startup? }` — covers every overridable `BlendConfig` property (RD-16 R24). No string parsing in the library | AR-77 |
| R10 | `CompilerHost` is injectable | All API functions accept an optional `CompilerHost` parameter. If omitted, a default disk-based host is used. The LSP injects its buffer-overlay host (AR-40) | AR-40 |
| R11 | Results never throw | All API functions return a result object, never throw. Errors are in the `diagnostics` array. The caller checks `result.hasErrors` | AR-15, AR-77 |
| R51 | Results expose the resolved config | Every result carries `config: BlendConfig` — the merged `defaults ← blend65.json ← overrides` outcome computed inside the facade (RD-16 R24/R25). Consumers (CLI, LSP) read effective settings (`quiet`, `diagnosticsFormat`, `outDir`, …) from it instead of re-loading or re-merging. Added by preflight PF-007 | RD-16 R24/R25 + Design |

### 3.3 CompilerHost — Disk Implementation

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R12 | CLI `CompilerHost` reads from disk | `DiskCompilerHost` reads source files via `node:fs` and resolves paths via `node:path`. It is the default host when no custom host is provided | AR-40 |
| R13 | File discovery follows the three-tier strategy | (1) Explicit CLI file list overrides; (2) `blend65.json` `include` globs; (3) default `**/*.blend` from project root | AR-39 |
| R14 | `CompilerHost` interface is minimal | `listSourceFiles(): string[]`, `readFile(path: string): string | undefined`, `resolvePath(path: string): string`. No more, no less | AR-40 |
| R47 | `DiskCompilerHost.listSourceFiles()` owns glob expansion | Expansion order: `include` globs → minus `exclude` globs → root-scope filter (every result must resolve within `projectRoot`, RD-13 R37; `@blend65/config` validates only the *patterns*, RD-16 R29). Mechanism: a small audited glob dependency (e.g. `tinyglobby`) is preferred over hand-rolling; the exact package is finalized at the plan's dependency checkpoint (RD-16 AR-P1 precedent). Added by preflight PF-004 | AR-39 + RD-13 R37 + Design |
| R48 | Explicit source file not found is a configuration error | An explicitly listed file (CLI `[files...]` or `sourceFiles`) that does not exist emits an error diagnostic and exits with code 2 (R43 class — the invocation is wrong, not the source). Added by preflight PF-006 | Design |
| R49 | Empty discovered file set is a configuration error | If discovery (all three tiers) yields zero `.blend` files, emit an error and exit 2 — never a silent no-op (this also guarantees R21's `outName` derivation always sees a non-empty list). RD-15 claims the diagnostic band `E10250+` for these driver errors; exact codes finalized at plan time (RD-16 AR-P3 precedent). Added by preflight PF-006 | Design |

### 3.4 CLI — Command & Flags

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R15 | The CLI command is `blendc` | Installed globally or via `npx @blend65/cli`. The command name is `blendc` (matches the v2 convention) | AR-3 |
| R16 | Argument parsing uses yargs | yargs provides flag parsing, help generation, and command routing | AR-16 |
| R17 | `blendc build [files...]` — build command (default) | Runs the full pipeline. If `[files...]` are provided, they override file discovery. If omitted, uses `blend65.json` or `**/*.blend` | AR-39 |
| R18 | `blendc check [files...]` — check-only command | Runs the frontend only (lex → parse → semantic → SFA). Reports diagnostics without invoking codegen or ACME. Useful for CI and IDE-like checks | AR-77 |

### 3.5 CLI — Target & Output Flags

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R19 | `--platform <name>` — target platform | Selects the platform plugin (e.g., `c64`, `cx16`, `a7800`). Overrides `blend65.json`. Required if no config file | AR-37 |
| R20 | `--out-dir <path>` — output directory | Where to write build artifacts (`.prg`, `.asm`, reports). Default: `./build/` | Design |
| R21 | `--out-name <name>` — output file name | Base name for output files. Default: `outName` from `blend65.json`; when that is `""` (auto, RD-16 R10), derived from the first file — in lexicographically sorted order, for determinism (RD-13) — of the discovered source list | Design |
| R45 | `--config <path>` — explicit config file path | Overrides `blend65.json` discovery (RD-16 R4). Maps to `CompilerOptions.configPath`. Added by RD-16 preflight PF-003 | AR-13 + Design |
| R46 | `--startup <variant>` — startup shim variant | `auto` (default) \| `terminating` \| `minimal` \| `bare`. Overrides the `startup` config key (RD-16 R18, AR-69). Added by RD-16 preflight PF-003 | AR-69 |

### 3.6 CLI — Emit Flags

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R22 | `--emit-asm` — emit ACME assembly source | Writes the `.asm` file and exits. Does not invoke ACME. Uses `emitAsm()` API | AR-60 |
| R23 | `--emit-il` — emit IL text | Writes the IL text and exits. Does not invoke codegen or ACME. Uses `emitIl()` API | AR-51 |
| R24 | `--emit-report` — write resource report to file | Writes the `ResourceReport` as JSON to a file in the output directory | AR-82 |

### 3.7 CLI — Diagnostic Flags

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R25 | `--max-errors <n>` — limit error count | Passed to `DiagnosticBag`. Default: 20 | AR-73, Ch 14 §4 |
| R26 | `--warn-as-error` — promote all warnings | Passed to `SeverityPolicy`. All warnings become errors | AR-75, Ch 14 §4 |
| R27 | `--warn-as-error=<code>` — promote specific warning | Promotes a specific warning code (e.g., `--warn-as-error=W10130`). Multiple allowed | AR-75 |
| R28 | `--suppress-warning=<code>` — suppress specific warning | Suppresses a specific warning code. Multiple allowed | AR-75 |
| R29 | `--diagnostics-format=<format>` — diagnostic output format | `terminal` (default, caret format) or `json` (machine-readable). Terminal uses `renderTerminal()`; JSON uses `renderJson()` | AR-76 |

### 3.8 CLI — ACME & Optimizer Flags

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R30 | `--acme-path <path>` — explicit ACME path | Overrides `blend65.json` `acmePath` and PATH discovery | AR-62 |
| R31 | `--optimize` / `--no-optimize` — peephole optimizer | `--optimize` enables the peephole optimizer (default: on). `--no-optimize` disables it (passthrough). In v1 both produce identical output since the rule set is empty | AR-38 |

### 3.9 CLI — Informational Flags

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R32 | `--help` — show help | Lists all commands and flags with descriptions. Generated by yargs | AR-16 |
| R33 | `--version` — show version | Prints the compiler version (from `package.json`) | Design |
| R34 | `--quiet` / `-q` — suppress build summary | Suppresses the resource-report table on successful builds. Diagnostics are still shown | AR-83 |
| R35 | `--no-color` — disable color output | Disables ANSI color output. Also respects `NO_COLOR` env var. **AR-17 runtime-amended (AR-106): zero-dependency — the CLI computes one `color: boolean` and passes it to `renderTerminal`; no chalk** | AR-17 (amended AR-106) |
| R36 | `--report=json` — JSON resource report to stdout | Prints the `ResourceReport` as JSON to stdout instead of the table. Implies `--quiet` for the table | AR-82 |

### 3.10 CLI — Color & Output Behavior

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R37 | Color is conditional | Color on by default for TTY stdout. Off for pipes, non-TTY, `NO_COLOR` env, or `--no-color` flag. Auto-detected via `process.stdout.isTTY`. **AR-17 runtime-amended (AR-106): zero-dependency `resolveColor(flag, env, isTTY)` (explicit `--color` ON > `--no-color` OFF > `NO_COLOR` OFF > `isTTY`); no chalk** | AR-17 (amended AR-106) |
| R38 | Build summary prints by default on success | After a successful build, the terminal resource-report table prints to stdout. Suppressed by `--quiet` | AR-83 |
| R39 | Diagnostics print to stderr | Error and warning diagnostics are printed to stderr so they don't mix with stdout output (e.g., JSON report) | Design |
| R40 | Build artifacts are written to the output directory | `.prg`, `.asm`, label file, and report file are written to `--out-dir` (default `./build/`) | Design |

### 3.11 Exit Codes

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R41 | Exit code 0 on success | Build completed without errors. Warnings do not affect exit code (unless `--warn-as-error`) | Design |
| R42 | Exit code 1 on compilation errors | One or more errors were found. Diagnostics printed to stderr | Design |
| R43 | Exit code 2 on configuration errors | Invalid `blend65.json`, missing platform, or invalid flags | Design |
| R44 | Exit code 3 on ACME errors (ICE) | ACME invocation failed. This is an internal compiler error (AR-68). The `.asm` file is retained. **AR-108 (runtime): exit 3 keys on the ICE band via `isIceCode(code)` — there is no ACME-specific ICE code; an ACME failure surfaces as the generic `IceCode.Unexpected` (`E90001`). ACME-*not-found* is `E10035` (a normal error) → exit 1** | AR-68 (clarified AR-108) |
| R50 | Exit-code classification rule | Exit 2 iff `loadConfig().hasErrors` is true (config band E10240–E10246, incl. missing platform) **or a discovery diagnostic (E10250/E10251) is present** or yargs rejects the invocation (a custom `.fail()` handler is required — yargs' default exit-1 behavior is overridden). Config errors short-circuit before compilation (RD-16 R22), so mixed config+compile error runs cannot occur. Otherwise: **any ICE-band diagnostic (`isIceCode`) → 3 (R44, AR-108)**; any error diagnostic → 1; else 0. Added by preflight PF-005 | RD-16 R22 + Design |

---

## 4. Design Detail

### 4.1 Programmatic API

```typescript
// @blend65/compiler — public API

export interface CompilerOptions {
  /** Target platform name (e.g., "c64", "cx16") */
  platform: string;

  /** Explicit source file list (overrides config/discovery) */
  sourceFiles?: string[];

  /** Path to blend65.json (default: auto-discover from cwd) */
  configPath?: string;

  /**
   * Base directory for config walk-up discovery, the `projectRoot` fallback, and
   * relative-path resolution (AR-107 / plan preflight PF-002). A **routing** option,
   * NOT a config override — threaded to `loadConfig`; the CLI maps `io.cwd`.
   * Default: `process.cwd()`.
   */
  cwd?: string;

  /** Source file globs (override blend65.json include/exclude — RD-16 R7/R8) */
  include?: string[];
  exclude?: string[];

  /** Explicit path to ACME executable */
  acmePath?: string;

  /** Output directory (default: "./build/") */
  outDir?: string;

  /** Output base name (default: "" = derived from the first file, lexicographically sorted, of the discovered source list — RD-16 R10) */
  outName?: string;

  /** Maximum errors before stopping (default: 20) */
  maxErrors?: number;

  /** Severity policy overrides */
  warnAsError?: boolean | string[];
  suppressWarnings?: string[];

  /** Diagnostic output format (default: "terminal" — RD-16 R15) */
  diagnosticsFormat?: 'terminal' | 'json';

  /** Enable peephole optimizer (default: true) */
  optimize?: boolean;

  /** Suppress the build summary (default: false — RD-16 R17) */
  quiet?: boolean;

  /** Startup shim variant (default: "auto" — RD-16 R18, AR-69) */
  startup?: 'auto' | 'terminating' | 'minimal' | 'bare';
}

/** Result of compile() — frontend only */
export interface CompileResult {
  /** Whether any errors were found */
  hasErrors: boolean;

  /** All diagnostics (errors + warnings) */
  diagnostics: Diagnostic[];

  /** Resolved configuration: defaults ← blend65.json ← overrides (RD-16 R24/R25; R51) */
  config: BlendConfig;

  /** Source map for span resolution */
  sourceMap: SourceMap;

  /** Semantic model (if no errors blocked it) */
  semanticModel?: SemanticModel;

  /** Allocation plan (if SFA completed) */
  allocationPlan?: AllocationPlan;
}

/**
 * Result of build() — full pipeline. Owns the public `BuildResult` name: the
 * RD-09 internal aggregate in `acme/emit-binary.ts` is renamed `EmitBinaryResult`,
 * and `build()` wraps it (`symbols` → `symbolMap`; `binary` is read back from
 * disk after a successful ACME run) — preflight PF-002.
 */
export interface BuildResult extends CompileResult {
  /** Generated ACME assembly source text */
  asmText?: string;

  /** Path to the written .asm file */
  asmPath?: string;

  /** Path to the written binary (.prg, etc.) */
  binaryPath?: string;

  /** Binary contents */
  binary?: Uint8Array;

  /** Symbol map from ACME label file */
  symbolMap?: Map<string, number>;

  /** Resource report */
  resourceReport?: ResourceReport;
}

/** Result of emitAsm() / emitIl() */
export interface EmitResult extends CompileResult {
  /** The emitted text (assembly or IL) */
  text?: string;
}

// --- API functions ---

/** Run frontend only (lex → parse → semantic → SFA) */
export function compile(
  options: CompilerOptions,
  host?: CompilerHost
): CompileResult;

/** Run full pipeline (frontend → IL → codegen → peephole → ACME) */
export function build(
  options: CompilerOptions,
  host?: CompilerHost
): Promise<BuildResult>;

/** Run through ACME serialization (no ACME invocation) */
export function emitAsm(
  options: CompilerOptions,
  host?: CompilerHost
): EmitResult;

/** Run through IL lowering (no codegen) */
export function emitIl(
  options: CompilerOptions,
  host?: CompilerHost
): EmitResult;
```

### 4.2 CompilerHost Interface

```typescript
// @blend65/core — shared interface

/**
 * Abstraction over file system access.
 * CLI provides a disk implementation; LSP provides a buffer overlay.
 */
export interface CompilerHost {
  /** List all .blend source files in the project */
  listSourceFiles(): string[];

  /** Read a file's content. Returns undefined if not found */
  readFile(path: string): string | undefined;

  /** Resolve a path to an absolute path */
  resolvePath(path: string): string;
}
```

### 4.3 CLI Entry Point

```typescript
// @blend65/cli — blendc entry point

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
// AR-106: no chalk — color is a zero-dependency `boolean` resolved by the CLI
// (`resolveColor`) and passed to `renderTerminal({ color })`.
import { build, compile, emitAsm, emitIl } from '@blend65/compiler';
import { renderTerminal, renderJson, renderReportTerminal } from '@blend65/core';

const argv = yargs(hideBin(process.argv))
  .command('build [files..]', 'Compile and assemble to binary', (y) =>
    y.positional('files', { type: 'string', array: true })
  )
  .command('check [files..]', 'Check for errors without building', (y) =>
    y.positional('files', { type: 'string', array: true })
  )
  .option('platform', { type: 'string', describe: 'Target platform' })
  .option('config', { type: 'string', describe: 'Path to blend65.json (R45)' })
  .option('startup', { choices: ['auto', 'terminating', 'minimal', 'bare'], default: 'auto' })
  .option('out-dir', { type: 'string', default: './build/' })
  .option('out-name', { type: 'string' })
  .option('emit-asm', { type: 'boolean', describe: 'Emit ACME assembly' })
  .option('emit-il', { type: 'boolean', describe: 'Emit IL text' })
  .option('emit-report', { type: 'boolean', describe: 'Write report JSON' })
  .option('max-errors', { type: 'number', default: 20 })
  // Bare `--warn-as-error` parses as `""` — coerced to `true` (R26); repeated
  // `--warn-as-error=Wxxxxx` accumulate via array (R27). (PF-009)
  .option('warn-as-error', { type: 'string', array: true, describe: 'Promote warnings' })
  .option('suppress-warning', { type: 'string', array: true })
  .option('diagnostics-format', { choices: ['terminal', 'json'], default: 'terminal' })
  .option('acme-path', { type: 'string', describe: 'Path to ACME' })
  .option('optimize', { type: 'boolean', default: true })
  .option('quiet', { alias: 'q', type: 'boolean' })
  // yargs boolean-negation idiom: `--no-color` sets `color: false` (R35, PF-009)
  .option('color', { type: 'boolean', default: true })
  .option('report', { choices: ['json'], describe: 'Report format' })
  .help()
  .version()
  .strict()
  .parseSync();

// ... dispatch to compile/build/emitAsm/emitIl based on command
// ... render diagnostics to stderr
// ... render build summary to stdout (unless --quiet)
// ... write artifacts to out-dir
// ... process.exit(exitCode)
```

### 4.4 CLI Output Flow

```
blendc build game.blend --platform c64
  │
  ├── Diagnostics → stderr (terminal caret format, with color)
  │     error[E10042]: 'poke()' expects 2 arguments — found 3
  │       --> player.blend:42:5
  │
  ├── Build Summary → stdout (unless --quiet)
  │     === Blend65 Build Summary ===
  │     Platform: c64
  │     Target: game.prg
  │     Code segment:    ... bytes ($0801–$....)
  │     ...   (the Ch 11 §6 layout — normative per RD-11 R43/§4.7; RD-11 preflight PF-003)
  │
  └── Artifacts → ./build/
        ├── game.asm        (ACME source)
        ├── game.prg        (binary, only on success)
        ├── game.labels     (VICE label file)
        └── game.report.json (if --emit-report)
```

### 4.5 Color Decision Tree

> **AR-106 (runtime amendment of AR-17):** zero-dependency. `resolveColor(flag, env,
> isTTY)` computes one `boolean` — precedence below — and the CLI passes it to
> `renderTerminal({ color })` and its own SGR accent helpers. No chalk.

```
Explicit --color flag             → Color enabled  (forces ON, AR-V16)
Explicit --no-color flag          → No color       (forces OFF)
Is NO_COLOR env var set?          → No color       (any value, no-color.org)
Is process.stdout.isTTY true?     → Color enabled
Otherwise                         → No color
```

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | **Package structure**: `@blend65/compiler` and `@blend65/cli` are two of the 10 packages |
| RD-02..RD-09 | **Wired by**: `@blend65/compiler` wires the full pipeline from these RDs |
| RD-10 | **Consumer**: the compiler facade loads the platform plugin based on `--platform` |
| RD-11 | **Consumer**: diagnostics come from `DiagnosticBag`; renderers (`renderTerminal`, `renderJson`, `renderReportTerminal`) are called by the CLI. **Hard prerequisite**: the RD-11 remainder (severity policy, renderers, `SourceMap`, `ResourceReport`) must be implemented before RD-15 — RD-11b is reordered ahead of it (preflight PF-001) |
| RD-13 | **Constrained by**: exit codes, conditional color, `--help`/`--version`, determinism |
| RD-14 | **Boundary**: the LSP calls `compile()` (not `build()`), injecting its own `CompilerHost`. The CLI and LSP are two consumers of the same API |
| RD-16 | **Consumer**: `blend65.json` is loaded by `@blend65/config` and merged with CLI flags |
| RD-17 | **Implicit**: intrinsic registry is loaded during `compile()` / `build()` |

---

## 6. Acceptance Criteria

- [ ] AC-01: `compile()` returns `CompileResult` with diagnostics and no side effects
- [ ] AC-02: `build()` returns `BuildResult` with binary, `.asm`, symbol map, and report
- [ ] AC-03: `emitAsm()` returns assembly text without invoking ACME
- [ ] AC-04: `emitIl()` returns IL text without invoking codegen
- [ ] AC-05: All API functions accept an injectable `CompilerHost`
- [ ] AC-06: No API function throws — errors are in the `diagnostics` array
- [ ] AC-07: `blendc build` produces a `.prg` on the C64 platform
- [ ] AC-08: `blendc check` reports diagnostics without producing a binary
- [ ] AC-09: `--platform`, `--out-dir`, `--out-name` flags work correctly
- [ ] AC-10: `--emit-asm` writes `.asm` and exits without invoking ACME
- [ ] AC-11: `--emit-il` writes IL text and exits without invoking codegen
- [ ] AC-12: `--max-errors`, `--warn-as-error`, `--suppress-warning` apply correctly
- [ ] AC-13: `--diagnostics-format=json` outputs JSON diagnostics
- [ ] AC-14: `--quiet` suppresses the build summary; `--report=json` outputs JSON report
- [ ] AC-15: Color output respects `NO_COLOR`, `--no-color`, and TTY detection
- [ ] AC-16: Exit codes: 0 success, 1 errors, 2 config errors, 3 ACME ICE
- [ ] AC-17: Diagnostics print to stderr; build summary and JSON report to stdout
- [ ] AC-18: No compile-path package (`core`, `frontend`, `codegen`, `platforms`, `config`, `compiler`) prints to stdout/stderr — all terminal output originates in `@blend65/cli`
- [ ] AC-19: All decisions trace to an `AR-NN`, a frozen spec section, or an explicit `Design` mark (per the §2 traceability rule)
- [ ] AC-20: `--config`, `--startup`, `--acme-path`, and `--optimize`/`--no-optimize` override their config/default counterparts correctly

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

None.
