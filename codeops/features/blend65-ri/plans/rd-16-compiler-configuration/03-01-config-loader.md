# Config Loader: RD-16 Compiler Configuration

> **Document**: 03-01-config-loader.md
> **Parent**: [Index](00-index.md)

## Overview

Two deliverables: (1) the config diagnostic band in `@blend65/core` (additive, AR-P3),
and (2) the `@blend65/config` package body — seven modules behind an `index.ts` entry
(AR-P6) implementing `loadConfig()` per RD-16 §4.2/§4.3.

## Architecture

### Current Architecture

`packages/config/src/index.ts` is a stub. See [02-current-state.md](02-current-state.md).

### Proposed Changes

```
packages/config/src/
├── types.ts        # BlendConfig, LoadConfigOptions, LoadConfigResult, CONFIG_SOURCE_ID
├── defaults.ts     # CONFIG_DEFAULTS + CONFIG_SCHEMA descriptor table (DRY validation)
├── discovery.ts    # findConfigUpwards(startDir, fileExists) — pure walk-up (AR-P7)
├── parse.ts        # parseJsoncFile(text) → { value, tree, parseErrors[] } (jsonc-parser wrap + offset conversion)
├── validate.ts     # validateShape() (per-key, spans) + validateSemantics() (post-merge)
├── merge.ts        # mergeConfig(defaults ← fileValues ← overrides)
├── load-config.ts  # loadConfig() orchestrator (RD-16 §4.3)
└── index.ts        # public API: loadConfig, types, CONFIG_SOURCE_ID, CONFIG_DEFAULTS
```

Dependency edges: `config → core` + `config → jsonc-parser` only (RD-16 R27, AR-P1).
Data flow: `discovery → parse → validateShape → merge → validateSemantics → result`.

## Implementation Details

### New Types/Interfaces (`types.ts`)

`BlendConfig`, `LoadConfigOptions`, `LoadConfigResult` are transcribed **verbatim** from
RD-16 §4.2 (the preflighted contract), with the one addition resolved by AR-P2:

```typescript
import type { DiagnosticBag } from '@blend65/core';

/**
 * Sentinel SourceId for spans pointing into blend65.json until RD-11b's
 * SourceMap can register the file for real. -1 is the bag's null-span dedup
 * marker, so the sentinel is -2. Sorts before all real sources in getAll()
 * (config diagnostics render first). Per AR-P2.
 */
export const CONFIG_SOURCE_ID = -2;

export interface LoadConfigOptions {
  /** Shared diagnostic accumulator (bootstrap note: caller creates it with the
   *  default cap BEFORE the config is read — RD-16 §4.3). */
  readonly bag: DiagnosticBag;
  /** Explicit config file path (overrides discovery). */
  configPath?: string;
  /** Working directory for discovery (default: process.cwd()). */
  cwd?: string;
  /** Invocation overrides (CLI flags or programmatic CompilerOptions) — R24/R25. */
  overrides?: Partial<BlendConfig>;
  /** Registered platform names for R21; check skipped when omitted (PF-001). */
  knownPlatforms?: readonly string[];
  /** Real SourceId for blend65.json when the caller has one (RD-11b/LSP);
   *  defaults to CONFIG_SOURCE_ID. Per AR-P2. */
  sourceId?: number;
}
```

`BlendConfig` (all 15 fields: `configPath`, `projectRoot`, `platform`, `include`,
`exclude`, `outDir`, `outName`, `acmePath`, `maxErrors`, `warnAsError`,
`suppressWarnings`, `diagnosticsFormat`, `optimize`, `quiet`, `startup`) and
`LoadConfigResult { config, hasErrors }` — exactly as RD-16 §4.2 declares them.

### Schema descriptor (`defaults.ts`)

One table drives defaults, type checks, and enum checks (DRY — no per-key `if` ladders):

```typescript
/** Per-key schema entry: default value + shape validator + optional value rule. */
interface SchemaEntry {
  readonly defaultValue: unknown;
  /** e.g. 'string' | 'boolean' | 'number' | 'string[]' | 'boolean|string[]' */
  readonly expected: string;
  readonly check: (value: unknown) => boolean;              // type shape
  readonly valueRule?: (value: unknown) => string | null;   // range/enum/format → error detail
}
export const CONFIG_SCHEMA: ReadonlyMap<string, SchemaEntry> = /* 13 user-facing keys */;
export const CONFIG_DEFAULTS: /* the RD §4.1 table */;
```

Defaults are the RD §4.1 table verbatim: `include: ["**/*.blend"]`,
`exclude: ["node_modules/**"]`, `outDir: "./build/"`, `outName: ""`, `acmePath: ""`,
`maxErrors: 20`, `warnAsError: false`, `suppressWarnings: []`,
`diagnosticsFormat: "terminal"`, `optimize: true`, `quiet: false`, `startup: "auto"`.
`platform` has **no default** — the registry's `DEFAULT_PLATFORM` is never consulted
(R31). Value rules: `maxErrors` integer ≥ 1 (§4.3 edge table); `diagnosticsFormat` ∈
{terminal, json} (R15); `startup` ∈ {auto, terminating, minimal, bare} (R18);
`warnAsError` (array form) / `suppressWarnings` entries must match `/^W\d{5}$/` — the
concrete reading of the RD's "match the W10xxx pattern" (five digits, matching every
shipped W-code in `diagnostic-codes.ts`).

### New Functions/Methods

```typescript
// discovery.ts — pure, hermetically testable (AR-P7)
/** Walks from startDir to the filesystem root; returns the first
 *  <dir>/blend65.json for which fileExists() is true, else null. (R4) */
export function findConfigUpwards(
  startDir: string,
  fileExists: (path: string) => boolean,
): string | null;

// parse.ts
/**
 * Parse errors and the recovered parse tree (AR-P4). jsonc-parser reports
 * offsets as UTF-16 code-unit string indices; parseJsoncFile converts them to
 * the UTF-8 BYTE offsets SourceSpan requires (source-span.ts contract —
 * preflight PF-017) before returning. `tree` is jsonc-parser's Node root
 * (undefined when nothing was recoverable); its node offsets are raw
 * code-unit offsets — validate.ts converts them via `toByteOffset`.
 */
export interface JsoncParseResult {
  readonly value: unknown;
  readonly tree: Node | undefined; // jsonc-parser Node root — per-key spans (PF-021)
  readonly parseErrors: readonly { offset: number; length: number; message: string }[];
}
export function parseJsoncFile(text: string): JsoncParseResult;
/** UTF-16 code-unit offset → UTF-8 byte offset converter for `text`; identity
 *  fast path when `text` is pure ASCII (PF-017). */
export function createOffsetConverter(text: string): (cuOffset: number) => number;

// validate.ts
/** Shape pass over the raw parsed object: unknown keys (W10240), wrong types
 *  (E10243). Needs the parse tree for per-key spans. Returns only valid keys. */
export function validateShape(ctx: ValidateContext): Partial<BlendConfig>;
/** Post-merge semantic pass: R21/R29/R30/R31 + value rules (§4.3 step 6). */
export function validateSemantics(ctx: SemanticContext): void;

// merge.ts
/** defaults ← file ← overrides; only non-undefined override values apply;
 *  arrays replace (R23/R24/R25). `origin` supplies the two computed fields
 *  (PF-021) so mergeConfig is the single BlendConfig producer. */
export function mergeConfig(
  fileValues: Partial<BlendConfig>,
  overrides: Partial<BlendConfig> | undefined,
  origin: { configPath: string | null; projectRoot: string },
): BlendConfig;  // defaults applied internally from CONFIG_DEFAULTS

// load-config.ts
/** RD-16 §4.3 orchestrator. Synchronous (R28); never throws (R26/AR-73). */
export function loadConfig(options: LoadConfigOptions): LoadConfigResult;
```

`ValidateContext`/`SemanticContext` carry `{ bag, sourceId, configText?, tree?,
toByteOffset?, projectRoot, knownPlatforms? }` — the context-object pattern used by the
parser and analyzer (`analyze.ts` precedent). `toByteOffset` is the PF-017 converter
from `parse.ts`; every span built from a tree node's code-unit offset goes through it.

### Algorithm (`loadConfig`, RD-16 §4.3 + AR-P2/P4 refinements)

1. **Resolve path**: explicit `configPath` → use it; if unreadable → `E10240` (span:
   whole-file synthetic `{sourceId, 0, 0}` is wrong — there is no file; use the
   missing-value ordinal span, see Span strategy). Otherwise
   `findConfigUpwards(cwd ?? process.cwd(), existsSync)`; miss → `configPath = null`,
   skip to step 4 (R3 — not an error).
2. **Read + parse**: read UTF-8; `parseJsoncFile`. Emit `E10241` per parse error with
   span `{sourceId, offset, offset+length}` (AR-P4: report ALL). Top-level non-object →
   `E10242` (span `{sourceId, 0, min(1, len)}`), treat file values as `{}` and continue.
3. **Shape validation**: walk the parse tree's top-level properties; unknown key →
   `W10240` (span = key node); known key wrong type → `E10243` (span = value node) and
   the key is dropped (its default applies). Valid keys collect into `fileValues`.
4. **Merge**: `mergeConfig(fileValues, options.overrides, { configPath, projectRoot })`
   — defaults filled from `CONFIG_DEFAULTS`; `projectRoot` = `dirname(configPath)` or
   resolved `cwd`; `configPath` recorded (absolute) or `null` (both computed by
   `loadConfig` in step 1 and passed as `origin` — PF-021).
5. **Semantic validation** (post-merge, so overrides are checked too — §4.3 step 6):
   missing/empty `platform` → `E10245`; `knownPlatforms` membership → `E10244` listing
   the injected names; `maxErrors` integer ≥ 1 → `E10243`; each `include`/`exclude`
   entry through the AR-P5 rule → `E10246`; W-code pattern for
   `warnAsError` (array form) / `suppressWarnings` → `E10243`; overlap → `W10241`.
6. **Return** `{ config, hasErrors }` where `hasErrors` = this call **emitted** at least
   one error-severity diagnostic: every error emission in steps 1–5 goes through a local
   wrapper that sets a `hadError` flag (PF-020). Local tracking matches RD-16 §4.2's
   "emitted during loading" wording and — unlike before/after `getErrors().length`
   comparison — stays correct when the caller's bag is pre-populated, deduping, or
   already at its `maxErrors` cap with the truncation sentinel emitted (where suppressed
   adds change nothing observable in the bag).

### Span strategy (AR-P2)

| Diagnostic origin | Span |
| ----------------- | ---- |
| Parse error | `{sourceId, offset, offset+length}` — jsonc-parser offsets **converted to UTF-8 byte offsets** by `parseJsoncFile` (PF-017; `SourceSpan` documents byte offsets, `source-span.ts:30-37`) |
| Unknown key / wrong-typed value / file-sourced semantic error | key/value node offsets from the parse tree, through `toByteOffset` (PF-017) |
| Value with **no file position** (override-sourced, or missing `platform`, or explicit-path-not-found) | `{sourceId, S, S}` where `S = -(2 + ordinal * 64 + entryIndex)` — `ordinal` = the key's stable position in `CONFIG_SCHEMA` declaration order (E10240/E10245 use reserved ordinals after the schema keys), `entryIndex` = the offending entry's index for array-valued keys (0 otherwise). The stride constant (`SYNTHETIC_SPAN_STRIDE = 64`) is documented in `types.ts` |

Negative synthetic starts occupy a coordinate space disjoint from real byte offsets
(≥ 0), so a same-code file-anchored diagnostic can never dedup-collide with an
override-sourced one, and per-entry indexing keeps multiple offending entries in one
override-sourced array dedup-distinct (PF-019) — preserving AR-P2's goal (same-code
diagnostics for different keys/entries all survive `(code, sourceId, start)` dedup).
They sort ahead of file-anchored config diagnostics, which is harmless: all config
diagnostics already sort first via `sourceId = -2`. Message text always embeds the human
location: `blend65.json:3:14 — …` for file-anchored diagnostics (line/col via core's
`LineMap` over the converted byte offset — no local newline-scan helper, PF-018), or the
config path alone otherwise (F9).

### Diagnostic codes & message templates (AR-P3)

Added to `packages/core/src/diagnostics/diagnostic-codes.ts` with an RD-16 claim comment
(RD-09 E10035 precedent style):

| DiagCode name | Code | Message template |
| ------------- | ---- | ---------------- |
| `ConfigFileNotFound` | E10240 | `Configuration file not found: <path>` |
| `ConfigParseError` | E10241 | `Invalid blend65.json: <parser message> (<path>:<line>:<col>)` |
| `ConfigNotAnObject` | E10242 | `blend65.json must contain a JSON object` |
| `ConfigInvalidValue` | E10243 | `Invalid value for "<key>": expected <expected>, got <actual>` |
| `ConfigUnknownPlatform` | E10244 | `Unknown platform "<name>". Available platforms: <list>` |
| `ConfigMissingPlatform` | E10245 | `No platform specified — set "platform" in blend65.json or pass --platform` |
| `ConfigPatternEscapesRoot` | E10246 | `Invalid pattern "<pattern>" in "<key>": patterns must be relative and must not escape the project root` |
| `ConfigUnknownKey` | W10240 | `Unknown configuration key: "<key>"` |
| `ConfigPromoteSuppressOverlap` | W10241 | `Warning code "<code>" is both promoted (warnAsError) and suppressed (suppressWarnings) — suppression wins` |

E10243's `<expected>` covers all four parameterizations (type / integer ≥ 1 / enum
literal list / warning-code format) — one code, distinct detail (AR-P3 resolution note).
Spec tests assert **code + severity + salient substrings** (key name, expected text),
not full sentences — the RD fixes codes and semantics, not prose.

### AR-P5 pattern rule (`validate.ts`)

```
isPatternInsideRoot(pattern):
  p = pattern.replaceAll('\\', '/')
  if path.posix.isAbsolute(p) or path.win32.isAbsolute(pattern) → false   // '/x', 'C:\x', '\\unc'
  if any '/'-separated segment of p === '..' → false
  else → true
```

Sound because glob metacharacters never match upward across separators; deliberately
rejects pathological-but-technically-inside patterns like `src/../src/*.blend`.

### Integration Points

- **RD-15 / `@blend65/compiler` + CLI**: creates the bag (default cap — bootstrap note),
  translates flags/`CompilerOptions` into `overrides`, passes
  `[...PLATFORM_REGISTRY.keys()]` as `knownPlatforms`, exits 2 on `hasErrors` (R43).
- **RD-14 LSP** (future): omits `knownPlatforms` (check deferred to `loadPlatform()`),
  supplies a real `sourceId`; the `language-server → config` dep edge is blessed at
  RD-14 planning (PF-014).
- **RD-11b renderer** (future): must special-case `CONFIG_SOURCE_ID` (documented AR-P2 cost).
- **`startup` mapping**: config carries the literal; `"minimal"` → core
  `"non-terminating"` and `"auto"` resolution happen downstream (RD-16 R18 note).

## Code Examples

### Example: end-to-end (AC-12)

```typescript
// temp/blend65.json = { "platform": "c64" }   (JSONC, may contain comments)
const bag = createDiagnosticBag();
const { config, hasErrors } = loadConfig({ bag, cwd: tempDir, knownPlatforms: ['c64'] });
// hasErrors === false; config.platform === 'c64'; config.outDir === './build/';
// config.configPath === join(tempDir, 'blend65.json'); config.projectRoot === tempDir
```

## Error Handling

| Error Case | Handling Strategy | Ref |
| ---------- | ----------------- | --- |
| Explicit `configPath` missing/unreadable | `E10240`, continue with defaults+overrides, `hasErrors: true` | RD-16 §4.3 edge table |
| Discovery miss | Not an error; all defaults | RD-16 R3 |
| JSONC parse error(s) | `E10241` each; validate recovered tree | AR-P4 |
| Top level not an object | `E10242`; file values treated as `{}` | RD-16 §4.3 edge table |
| Unknown key | `W10240` per key (span-distinct) | RD-16 R19, AR-P2 |
| Known key, wrong type / bad range / bad enum / bad W-code | `E10243`; key falls back to default | RD-16 R20 + edge table, AR-P3 |
| Unknown platform (knownPlatforms given) | `E10244` listing names | RD-16 R21 |
| Platform unset after merge | `E10245` | RD-16 R31 |
| Absolute / `..` pattern | `E10246` per offending entry | RD-16 R29, AR-P5 |
| Promote+suppress overlap | `W10241` per code | RD-16 R30 |
| File read I/O error (exists but unreadable) | `E10240` (same class as not-found; message says why) | RD-16 §4.3 step 1 |
| Anything else | `add*` never throws; `loadConfig` never throws | RD-16 R26, AR-73 |

> **Traceability:** every strategy above cites its RD-16 requirement or AR-P entry.

**Post-error field values (AR-P9):** when a semantic-stage check fails, the returned
config keeps the value **as-merged** — no post-hoc mutation; `platform` is `""` when
still unset after merge (E10245). An errored config is fully populated (AC-11) but
untrusted: consumers gate on `hasErrors` (RD-15 exits 2 before anything reads it).

## Testing Requirements

- Spec tests ST-1..ST-31 per [07-testing-strategy.md](07-testing-strategy.md) —
  spec-first ordering enforced by the execution plan.
- Impl tests: discovery boundary cases (root dir, deep nesting), UTF-8 BOM handling,
  code-unit→byte offset conversion on non-ASCII content (PF-017), synthetic-span scheme
  stability (negative ordinal space, per-entry stride — PF-019), `hasErrors` with a
  pre-populated bag including the at-cap case (PF-020).
- Security tests: R29 traversal attempts (absolute POSIX/win32/UNC, `..` variants),
  data-only guarantee (no `require`/dynamic `import` — audit + lint).
