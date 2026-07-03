# CompilerHost & File Discovery: RD-15

> **Document**: 03-01-compiler-host.md
> **Parent**: [Index](00-index.md)
> **Covers**: R10, R12–R14, R47–R49 · AR-V3, AR-V6, AR-V9, AR-V10, AR-V12 (seam), AR-V17

## Overview

The `CompilerHost` abstraction decouples the compiler from the filesystem so the CLI
(disk) and the future LSP (buffer overlay, RD-14) consume the same facade. This
component ships the interface in `@blend65/core`, the `DiskCompilerHost` in
`@blend65/compiler`, the R47 glob expansion, and the two driver diagnostics.

## Architecture

### Current
No `CompilerHost` exists (verified — only a stale mention in a lexer doc comment).

### Proposed
- `packages/core/src/host/compiler-host.ts` + `index.ts` barrel, re-exported from the
  core root barrel (AR-V9; mirrors the `report/` module precedent).
- `packages/compiler/src/host/disk-host.ts` + `index.ts` (AR-V9).
- Two new codes in `core/src/diagnostics/diagnostic-codes.ts` (AR-V10), claiming the
  E10250+ driver band (RD-15 R49).

## Implementation Details

### New Types — `@blend65/core`

```typescript
// core/src/host/compiler-host.ts — transcribed from RD-15 §4.2 (R14: no more, no less)

/**
 * Abstraction over file system access (AR-40). The CLI provides a disk
 * implementation ({@link DiskCompilerHost} in `@blend65/compiler`); the LSP
 * provides a buffer overlay (RD-14).
 */
export interface CompilerHost {
  /** List all .blend source files in the project (absolute paths, sorted). */
  listSourceFiles(): string[];
  /** Read a file's content. Returns undefined if not found. */
  readFile(path: string): string | undefined;
  /** Resolve a path to an absolute path. */
  resolvePath(path: string): string;
}
```

> `listSourceFiles()` returns **absolute, lexicographically sorted** paths — the sort
> is the determinism guarantee R21's `outName` derivation and RD-13 rely on (AR-V6).
> Display-time relativization to `projectRoot` happens at interning (AR-V17), not here.

### New Codes — `@blend65/core` (AR-V10)

```typescript
// diagnostic-codes.ts additions (band comment: RD-15 claims E10250+ for driver errors)
DriverSourceFileNotFound: "E10250",   // R48 — explicit file missing → exit 2 class
DriverNoSourceFiles: "E10251",        // R49 — discovery yielded zero files → exit 2 class
```

Both are emitted with a `null` span (no source to point into; R51 degradation renders
header-only). Message texts (AR-V10):

| Code | Message |
| ---- | ------- |
| E10250 | `Source file not found: '<path>'` (the path as given by the user) |
| E10251 | `No .blend source files found (project root: '<projectRoot>')` |

### New Implementation — `@blend65/compiler`

```typescript
// compiler/src/host/disk-host.ts

import { globSync } from "tinyglobby";                    // AR-V3
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { CompilerHost } from "@blend65/core";

/** Config-derived construction inputs (AR-V6: built AFTER loadConfig resolves). */
export interface DiskHostOptions {
  readonly projectRoot: string;   // BlendConfig.projectRoot (absolute)
  readonly include: string[];     // BlendConfig.include (validated patterns, RD-16 R29)
  readonly exclude: string[];     // BlendConfig.exclude
}

/** Disk-backed CompilerHost (R12). */
export function createDiskCompilerHost(options: DiskHostOptions): CompilerHost;
```

Behavior of `listSourceFiles()` (R47 — expansion order is normative):

1. Expand `include` globs relative to `projectRoot`
   (`globSync(include, { ignore: exclude, cwd: projectRoot, absolute: true })` — the
   current tinyglobby@^0.2 signature is `globSync(patterns, options)`; the single-object
   `{ patterns, … }` form is a **deprecated** overload, PF-006 — `exclude` applied via
   `ignore`, tier 2 of R13).
2. **Root-scope filter**: drop any result whose resolved path is not within
   `projectRoot` (prefix check on `resolve(p) + sep` boundary — RD-13 R37; the config
   package validates patterns only, the host validates *results*).
3. **Sort lexicographically** (determinism; feeds R21's `outName` derivation).

`readFile()`: `readFileSync(path, "utf8")` with `undefined` on any fs error (R14
contract — never throws). `resolvePath()`: `resolve(projectRoot, path)`.

### Discovery tiers (R13) — implemented in the facade, not the host

The three-tier strategy composes in `api/run-frontend.ts` (see 03-02) per AR-V6:

| Tier | Source | Mechanism |
| ---- | ------ | --------- |
| 1 | Explicit `options.sourceFiles` (or CLI `[files..]` mapped into it) | Bypasses `listSourceFiles()`; each file `resolvePath`ed and existence-checked via `readFile !== undefined` → missing emits **E10250** per file (R48) |
| 2 | `blend65.json` `include`/`exclude` | `DiskCompilerHost` construction from resolved config |
| 3 | Default `**/*.blend` | Already the config default (`config/src/defaults.ts:30`) — tier 3 collapses into tier 2 |

Empty final set (any tier) → **E10251** (R49), guaranteeing R21's derivation always
sees a non-empty list. An injected custom host (R10) is used verbatim — its
`listSourceFiles()` IS the file set (AR-V6); tiers 2/3 do not apply, tier 1 still wins.

## Integration Points

- Facade (03-02): constructs the default host after `loadConfig`; passes host reads
  into `SourceMap.intern` (paths interned projectRoot-relative with forward slashes —
  AR-V17).
- PF-002 rename lands in this component's session (same "foundations" phase):
  `acme/emit-binary.ts` `BuildResult` → `EmitBinaryResult` + barrel update + a
  cross-reference comment on the inline E10034 check pointing at
  `checkBinaryBudget` (AR-V5 obligation). Mechanical rename; RD-09 test assertions
  are type-name-only in imports.

## Error Handling

| Error Case | Handling Strategy | Source |
| ---------- | ----------------- | ------ |
| Explicit source file missing | E10250 per missing file, null span; continue checking remaining files; abort pipeline before lexing; exit-2 class | R48, AR-V10 |
| Zero files after discovery | E10251, null span; abort before lexing; exit-2 class | R49, AR-V10 |
| Glob result escapes projectRoot | Silently filtered (not an error — the pattern was config-valid; the *result* is out of scope) | R47, RD-13 R37 |
| `readFile` on unreadable/missing file | `undefined` (interface contract; never throws) | R14 |
| Discovered file disappears between list and read (TOCTOU) | `readFile` → `undefined` → treated as E10250 at read time | R14 + R48 (same class) |

## Testing Requirements

- Spec: ST-1..ST-7 (07-testing-strategy.md) — interface shape, disk semantics,
  expansion/sort/containment, E10250/E10251 texts, rename visibility.
- Impl: fixture-dir edge cases (nested dirs, exclude precedence, dotfiles per
  tinyglobby defaults, empty include list), TOCTOU path.
- Security: ST-4 — `../`-escaping include pattern must not leak files outside
  `projectRoot`.
